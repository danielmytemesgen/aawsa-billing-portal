"use client";

import * as React from "react";
import { AlertTriangle, Settings } from "lucide-react";
import { usePenaltyEngineStatus } from "@/hooks/usePenaltyEngineStatus";
import { usePathname } from "next/navigation";
import Link from "next/link";

/**
 * PenaltyEngineBanner
 *
 * Shows a sticky warning banner when the penalty engine is OFF.
 * Renders ONLY on the admin Tariff Management page (/admin/tariffs).
 * Renders nothing when the engine is ON or on other pages — zero visual overhead elsewhere.
 */
export function PenaltyEngineBanner() {
  const pathname = usePathname();
  const penaltyEnabled = usePenaltyEngineStatus();

  // Display ONLY in admin's Tariff Management page (/admin/tariffs)
  const isTariffPage = pathname === "/admin/tariffs" || pathname?.startsWith("/admin/tariffs/");
  if (!isTariffPage) {
    return null;
  }

  // Engine is ON — render nothing
  if (penaltyEnabled) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                 bg-amber-50 border-b-2 border-amber-400 text-amber-900 shadow-sm"
    >
      <AlertTriangle
        className="h-4 w-4 shrink-0 text-amber-600 animate-pulse"
        aria-hidden="true"
      />
      <span className="flex-1">
        <strong>Penalty Engine is OFF</strong> — Penalties are not being
        calculated or applied to any bills.
      </span>
      <Link
        href="/admin/tariffs"
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1
                   text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
        aria-label="Go to Tariff Settings to re-enable the penalty engine"
      >
        <Settings className="h-3 w-3" aria-hidden="true" />
        Tariff Settings
      </Link>
    </div>
  );
}
