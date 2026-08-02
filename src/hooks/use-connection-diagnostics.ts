"use client";

import { useState, useEffect } from "react";

export interface NetworkDiagnostics {
  rttMs?: number;
  downlinkMbps?: number;
  effectiveType: string;
  saveData: boolean;
  online: boolean;
}

export function useConnectionDiagnostics(): NetworkDiagnostics {
  const [diagnostics, setDiagnostics] = useState<NetworkDiagnostics>({
    effectiveType: "4g",
    saveData: false,
    online: typeof window !== "undefined" ? window.navigator.onLine : true,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    const updateDiagnostics = () => {
      const isOnline = window.navigator.onLine;
      if (connection) {
        setDiagnostics({
          rttMs: connection.rtt,
          downlinkMbps: connection.downlink,
          effectiveType: connection.effectiveType || "4g",
          saveData: Boolean(connection.saveData),
          online: isOnline,
        });
      } else {
        setDiagnostics({
          effectiveType: "unknown",
          saveData: false,
          online: isOnline,
        });
      }
    };

    updateDiagnostics();

    window.addEventListener("online", updateDiagnostics);
    window.addEventListener("offline", updateDiagnostics);

    if (connection && connection.addEventListener) {
      connection.addEventListener("change", updateDiagnostics);
    }

    return () => {
      window.removeEventListener("online", updateDiagnostics);
      window.removeEventListener("offline", updateDiagnostics);
      if (connection && connection.removeEventListener) {
        connection.removeEventListener("change", updateDiagnostics);
      }
    };
  }, []);

  return diagnostics;
}
