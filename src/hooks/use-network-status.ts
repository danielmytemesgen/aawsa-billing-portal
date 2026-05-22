"use client";

import { useState, useEffect, useCallback } from "react";
import { getPendingReadings, getFailedReadings } from "@/lib/offline-db";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? window.navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);

  const updateQueueCounts = useCallback(async () => {
    try {
      const [pending, failed] = await Promise.all([
        getPendingReadings(),
        getFailedReadings(),
      ]);
      setPendingCount(pending.length);
      setFailedCount(failed.length);
    } catch (err) {
      console.error("Error reading offline queue counts:", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setOfflineSince(null);
      // Trigger wasOffline banner transition
      setWasOffline(true);
      const timer = setTimeout(() => setWasOffline(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineSince(new Date());
      setWasOffline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-queue-updated", updateQueueCounts);

    // Initial load checks
    updateQueueCounts();
    if (!window.navigator.onLine) {
      setOfflineSince(new Date());
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-queue-updated", updateQueueCounts);
    };
  }, [updateQueueCounts]);

  return {
    isOnline,
    wasOffline,
    pendingCount,
    failedCount,
    offlineSince,
    refreshCounts: updateQueueCounts,
  };
}
