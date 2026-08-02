"use client";

import { useState, useEffect } from "react";

export interface BandwidthHint {
  isSlowConnection: boolean;
  effectiveType: string;
  saveData: boolean;
}

export function useBandwidthHint(): BandwidthHint {
  const [hint, setHint] = useState<BandwidthHint>({
    isSlowConnection: false,
    effectiveType: "4g",
    saveData: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    const updateConnectionInfo = () => {
      if (connection) {
        const effectiveType = connection.effectiveType || "4g";
        const saveData = Boolean(connection.saveData);
        const isSlow =
          effectiveType === "slow-2g" ||
          effectiveType === "2g" ||
          effectiveType === "3g" ||
          saveData;

        setHint({
          isSlowConnection: isSlow,
          effectiveType,
          saveData,
        });
      }
    };

    updateConnectionInfo();

    if (connection && connection.addEventListener) {
      connection.addEventListener("change", updateConnectionInfo);
      return () => {
        connection.removeEventListener("change", updateConnectionInfo);
      };
    }
  }, []);

  return hint;
}
