/**
 * network-quality.ts
 * ------------------
 * Detects the current network quality and exposes a React hook that updates
 * in real-time.  Used by DataRefreshProvider and the reader route pages to
 * adapt their behaviour (polling interval, SSE, UI banners) for weak / no
 * connectivity situations.
 *
 * Detection strategy (in priority order):
 *   1. navigator.onLine === false  → 'offline'
 *   2. navigator.connection (Network Information API, Chrome/Android)
 *      effective types '2g' | 'slow-2g'  → 'weak'
 *      downlink < 1 Mbps              → 'weak'
 *   3. Latency ping to /api/ping
 *      RTT > 1 500 ms or timeout      → 'weak'
 *   4. Default fallback               → 'strong'
 */

"use client";

import { useEffect, useState, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type NetworkQuality = "strong" | "weak" | "offline";

export interface NetworkQualityInfo {
  quality: NetworkQuality;
  /** effectiveType reported by navigator.connection, or null */
  effectiveType: string | null;
  /** downlink Mbps reported by navigator.connection, or null */
  downlink: number | null;
  /** True while online events are active */
  isOnline: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core detection (non-hook)
// ─────────────────────────────────────────────────────────────────────────────
const PING_URL = "/api/ping";
const PING_TIMEOUT_MS = 4_000;
const WEAK_RTT_THRESHOLD_MS = 1_500;

let _lastPingRtt: number | null = null;
let _pingInFlight = false;

async function measurePingRtt(): Promise<number | null> {
  if (_pingInFlight) return _lastPingRtt;
  _pingInFlight = true;
  try {
    const start = performance.now();
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
    await fetch(PING_URL, { method: "GET", cache: "no-store", signal: ctrl.signal });
    clearTimeout(timeoutId);
    _lastPingRtt = performance.now() - start;
  } catch {
    _lastPingRtt = null; // timeout / offline
  } finally {
    _pingInFlight = false;
  }
  return _lastPingRtt;
}

export function classifyQuality(conn?: any): Omit<NetworkQualityInfo, "isOnline"> {
  const effectiveType: string | null = conn?.effectiveType ?? null;
  const downlink: number | null = conn?.downlink ?? null;

  let quality: NetworkQuality;

  if (typeof window !== "undefined" && !window.navigator.onLine) {
    quality = "offline";
  } else if (
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    (downlink !== null && downlink < 1)
  ) {
    quality = "weak";
  } else if (_lastPingRtt !== null && _lastPingRtt > WEAK_RTT_THRESHOLD_MS) {
    quality = "weak";
  } else {
    quality = "strong";
  }

  return { quality, effectiveType, downlink };
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook
// ─────────────────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000; // re-evaluate every 30 s

export function useNetworkQuality(): NetworkQualityInfo {
  const getConn = () =>
    typeof navigator !== "undefined" ? (navigator as any).connection ?? null : null;

  const evaluate = useCallback((): NetworkQualityInfo => {
    const conn = getConn();
    const { quality, effectiveType, downlink } = classifyQuality(conn);
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    return { quality: isOnline ? quality : "offline", effectiveType, downlink, isOnline };
  }, []);

  const [info, setInfo] = useState<NetworkQualityInfo>((): NetworkQualityInfo => {
    // Safe SSR default
    if (typeof window === "undefined") {
      return { quality: "strong", effectiveType: null, downlink: null, isOnline: true };
    }
    return evaluate();
  });

  useEffect(() => {
    let mounted = true;

    const update = () => {
      if (mounted) setInfo(evaluate());
    };

    // Re-measure ping periodically and re-classify
    const pingAndUpdate = async () => {
      await measurePingRtt();
      update();
    };

    // Immediate ping measurement on mount
    void pingAndUpdate();

    // Recurring ping
    const interval = setInterval(pingAndUpdate, REFRESH_INTERVAL_MS);

    // Native browser events
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const conn = getConn();
    if (conn) {
      conn.addEventListener("change", update);
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if (conn) conn.removeEventListener("change", update);
    };
  }, [evaluate]);

  return info;
}
