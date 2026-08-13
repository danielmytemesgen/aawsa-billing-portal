"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  initializeBranches,
  initializeCustomers,
  initializeBulkMeters,
  initializeBills,
  initializeIndividualCustomerReadings,
  initializeBulkMeterReadings,
  initializeStaffMembers,
  initializeNotifications,
  initializePayments,
} from "@/lib/data-store";
import { useNetworkQuality, type NetworkQuality } from "@/lib/network-quality";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
/** Polling intervals per network quality tier */
const POLL_INTERVALS: Record<NetworkQuality, number> = {
  strong: 30_000,       //  30 s — normal
  weak:   3 * 60_000,   //   3 min — conserve bandwidth on 2G/3G
  offline: Infinity,    //  paused — no polling when offline
};

/** SSE reconnect: exponential backoff 10 s → 20 s → 40 s → 80 s, cap at 5 min */
const SSE_BACKOFF_BASE_MS   = 10_000;
const SSE_BACKOFF_MAX_MS    = 5 * 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────
interface DataRefreshContextValue {
  /** ISO timestamp of last successful background refresh */
  lastRefreshed: string | null;
  /** True while a refresh is in-flight */
  isRefreshing: boolean;
  /** Trigger a manual, immediate refresh of all entities */
  refresh: () => Promise<void>;
  /** Current network quality tier */
  networkQuality: NetworkQuality;
  /** True while the browser reports navigator.onLine = true */
  isOnline: boolean;
}

const DataRefreshContext = createContext<DataRefreshContextValue>({
  lastRefreshed: null,
  isRefreshing: false,
  refresh: async () => {},
  networkQuality: "strong",
  isOnline: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useDataRefresh() {
  return useContext(DataRefreshContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: refresh all critical entities from the server
// Each initialize(force=true) re-fetches from the DB and calls notifyListeners()
// so every subscribed component updates automatically.
// ─────────────────────────────────────────────────────────────────────────────
async function refreshAllEntities(): Promise<void> {
  await Promise.allSettled([
    initializeBranches(true),
    initializeCustomers(true),
    initializeBulkMeters(true),
    initializeBills(true),
    initializeIndividualCustomerReadings(true),
    initializeBulkMeterReadings(true),
    initializeStaffMembers(true),
    initializeNotifications(true),
    initializePayments(true),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function DataRefreshProvider({ children }: { children: React.ReactNode }) {
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing]   = useState(false);
  const isRefreshingRef = useRef(false);    // prevents concurrent runs
  const sseRef          = useRef<EventSource | null>(null);
  const sseBackoffRef   = useRef(SSE_BACKOFF_BASE_MS);
  const sseTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { quality: networkQuality, isOnline } = useNetworkQuality();

  // ── Refresh action ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    // Don't fetch while offline — serve from the in-memory store
    if (!isOnline) return;
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await refreshAllEntities();
      const now = new Date().toISOString();
      setLastRefreshed(now);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("data-refreshed", { detail: { ts: now } }));
      }
    } catch (err) {
      console.warn("[DataRefresh] Background refresh failed:", err);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [isOnline]);

  // ── Adaptive polling ───────────────────────────────────────────────────────
  // Reschedule whenever networkQuality changes.
  useEffect(() => {
    // Clear any existing timer
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    const intervalMs = POLL_INTERVALS[networkQuality];
    if (!isFinite(intervalMs)) return; // offline — no polling

    // Boot refresh shortly after mount / quality change
    const boot = setTimeout(() => refresh(), 5_000);

    // Recursive setTimeout so the interval adapts dynamically
    const scheduleNext = () => {
      pollTimerRef.current = setTimeout(() => {
        void refresh().then(scheduleNext);
      }, intervalMs);
    };
    scheduleNext();

    return () => {
      clearTimeout(boot);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [networkQuality, refresh]);

  // ── SSE instant invalidation ───────────────────────────────────────────────
  // Only connect SSE on strong networks.  On weak/offline we rely on polling
  // to avoid hammering a slow radio with a persistent TCP connection.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Tear down existing SSE whenever quality changes
    const teardown = () => {
      if (sseTimerRef.current) clearTimeout(sseTimerRef.current);
      sseRef.current?.close();
      sseRef.current = null;
    };

    if (networkQuality !== "strong") {
      teardown();
      return;
    }

    // Reset backoff when quality becomes strong again
    sseBackoffRef.current = SSE_BACKOFF_BASE_MS;

    const connect = () => {
      teardown();
      try {
        const es = new EventSource("/api/data-events");
        sseRef.current = es;

        es.addEventListener("data-changed", () => {
          sseBackoffRef.current = SSE_BACKOFF_BASE_MS; // success — reset backoff
          void refresh();
        });

        es.onerror = () => {
          es.close();
          sseRef.current = null;
          // Exponential backoff
          const delay = Math.min(sseBackoffRef.current, SSE_BACKOFF_MAX_MS);
          sseBackoffRef.current = Math.min(delay * 2, SSE_BACKOFF_MAX_MS);
          sseTimerRef.current = setTimeout(connect, delay);
        };
      } catch {
        // SSE not supported / blocked — polling is the fallback
      }
    };

    connect();

    return () => {
      teardown();
    };
  }, [networkQuality, refresh]);

  // ── Visibility-based refresh ───────────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isOnline) {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refresh, isOnline]);

  return (
    <DataRefreshContext.Provider value={{ lastRefreshed, isRefreshing, refresh, networkQuality, isOnline }}>
      {children}
    </DataRefreshContext.Provider>
  );
}
