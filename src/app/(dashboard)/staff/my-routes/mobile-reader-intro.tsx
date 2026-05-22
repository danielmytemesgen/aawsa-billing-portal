"use client";

import * as React from "react";
import { MapPin, Wifi, WifiOff, Battery, Signal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * MobileReaderIntro — shown at the top of My Routes for field staff.
 * Displays live connection status and a greeting.
 */
export function MobileReaderIntro({ userName }: { userName?: string }) {
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check IndexedDB pending queue
    const checkPending = async () => {
      try {
        const { getPendingReadings } = await import("@/lib/offline-db");
        const pending = await getPendingReadings();
        setPendingCount(pending.length);
      } catch {}
    };
    checkPending();
    window.addEventListener("offline-queue-updated", checkPending);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-queue-updated", checkPending);
    };
  }, []);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white p-5 mb-4 shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">
            AAWSA Reader App
          </p>
          <h2 className="text-2xl font-bold">
            {userName ? `Hello, ${userName.split(" ")[0]}` : "Good morning"} 👋
          </h2>
          <p className="text-blue-100 text-sm mt-1">Your field routes are ready below.</p>
        </div>
        <MapPin className="h-10 w-10 text-blue-300 opacity-60 mt-1" />
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <Badge
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 border-0 ${
            isOnline
              ? "bg-green-500/20 text-green-200"
              : "bg-red-500/20 text-red-200"
          }`}
        >
          {isOnline ? (
            <><Wifi className="h-3 w-3" /> Online</>
          ) : (
            <><WifiOff className="h-3 w-3" /> Offline Mode</>
          )}
        </Badge>

        {pendingCount > 0 && (
          <Badge className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 border-0 bg-amber-400/20 text-amber-200">
            <Signal className="h-3 w-3" />
            {pendingCount} readings pending sync
          </Badge>
        )}
      </div>
    </div>
  );
}
