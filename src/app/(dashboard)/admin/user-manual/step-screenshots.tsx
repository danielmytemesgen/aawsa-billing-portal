"use client";

import * as React from "react";
import { ExternalLink, Maximize2, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LanguageMode } from "./manual-data";

interface StepScreenshotProps {
  sectionId: string;
  heading: string;
  language: LanguageMode;
}

/**
 * Maps every sectionId to its captured screenshot filename.
 * All images live in /images/manual/ and were captured from the live portal.
 */
const SCREENSHOT_MAP: Record<string, string> = {
  // Dashboards
  dashboard:               "dashboard.png",
  "head-office-dashboard": "head-office-dashboard.png",
  // Field operations
  "my-routes":             "my-routes.png",
  "meter-readings":        "meter-readings.png",
  "meter-change":          "meter-change.png",
  "reader-monitoring":     "reader-monitoring.png",
  "route-management":      "route-management.png",
  // Billing
  approvals:               "approvals.png",
  "bill-management":       "bill-management.png",
  "paid-bills":            "paid-bills.png",
  "sent-bills":            "sent-bills.png",
  "unsettled-bills":       "unsettled-bills.png",
  "data-entry":            "data-entry.png",
  // Customer & Meter Registry
  "bulk-meters":           "bulk-meters.png",
  "individual-customers":  "individual-customers.png",
  // Administration
  branches:                "branches.png",
  "staff-management":      "staff-management.png",
  roles:                   "roles.png",
  tariffs:                 "tariffs.png",
  "fault-codes":           "fault-codes.png",
  // Communication
  notifications:           "notifications.png",
  promotions:              "promotions.png",
  // Reports
  reports:                 "reports.png",
  // Support
  support:                 "support.png",
  "knowledge-base":        "knowledge-base.png",
  // System
  settings:                "settings.png",
  "security-logs":         "security-logs.png",
  backup:                  "backup.png",
  maintenance:             "maintenance.png",
  errors:                  "errors.png",
  "recycle-bin":           "recycle-bin.png",
};

const URL_MAP: Record<string, string> = {
  dashboard:               "admin/dashboard",
  "head-office-dashboard": "admin/head-office-dashboard",
  "my-routes":             "staff/my-routes",
  "meter-readings":        "staff/meter-readings",
  "meter-change":          "admin/meter-change",
  "reader-monitoring":     "admin/reader-monitoring",
  "route-management":      "admin/route-management",
  approvals:               "admin/approvals",
  "bill-management":       "admin/bill-management",
  "paid-bills":            "admin/paid-bills",
  "sent-bills":            "admin/sent-bills",
  "unsettled-bills":       "admin/unsettled-bills",
  "data-entry":            "admin/data-entry",
  "bulk-meters":           "admin/bulk-meters",
  "individual-customers":  "admin/individual-customers",
  branches:                "admin/branches",
  "staff-management":      "admin/staff-management",
  roles:                   "admin/roles",
  tariffs:                 "admin/tariffs",
  "fault-codes":           "admin/fault-codes",
  notifications:           "admin/notifications",
  promotions:              "admin/promotions",
  reports:                 "admin/reports",
  support:                 "admin/support",
  "knowledge-base":        "admin/knowledge-base",
  settings:                "admin/settings",
  "security-logs":         "admin/security-logs",
  backup:                  "admin/backup",
  maintenance:             "admin/maintenance",
  errors:                  "admin/errors",
  "recycle-bin":           "admin/recycle-bin",
};

export function StepScreenshotPreview({
  sectionId,
  heading,
  language,
}: StepScreenshotProps) {
  const isAm = language === "am";
  const [lightboxOpen, setLightboxOpen] = React.useState(false);

  const filename = SCREENSHOT_MAP[sectionId];
  const urlPath  = URL_MAP[sectionId] ?? `admin/${sectionId}`;
  const imgSrc   = filename ? `/images/manual/${filename}` : null;

  return (
    <>
      {/* ── Fullscreen Lightbox ──────────────────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-[95vw] max-h-[93vh] rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox chrome */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border-b border-slate-700 shrink-0">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
              <div className="ml-3 flex-1 text-[11px] font-mono text-slate-400 bg-slate-800 px-3 py-0.5 rounded-md border border-slate-700 truncate">
                <span className="text-emerald-400 font-bold">https://</span>
                portal.aawsa.gov.et/{urlPath}
              </div>
              <button
                onClick={() => setLightboxOpen(false)}
                className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-all"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Full-size screenshot */}
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={`${heading} – AAWSA Portal`}
                className="block object-contain overflow-auto"
                style={{ maxHeight: "88vh" }}
              />
            ) : (
              <div className="w-[800px] h-[400px] flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
                No screenshot available
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Thumbnail Card ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "group rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden",
          "transition-all duration-200 hover:shadow-md hover:border-slate-300 w-full",
          imgSrc && "cursor-pointer"
        )}
        onClick={() => imgSrc && setLightboxOpen(true)}
        title={imgSrc ? (isAm ? "ለማስፋት ጠቅ ያድርጉ" : "Click to expand") : undefined}
      >
        {/* Browser chrome titlebar */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 text-slate-300 border-b border-slate-800 select-none">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
          </div>

          {/* URL bar */}
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700/60 truncate max-w-[200px]">
            <span className="text-emerald-400 font-bold">https://</span>
            <span className="truncate">portal.aawsa.gov.et/{urlPath}</span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-[9.5px] font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{isAm ? "ቀጥታ UI" : "Live UI"}</span>
            </div>
            {imgSrc && (
              <ZoomIn className="h-3.5 w-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>

        {/* Screenshot or fallback */}
        {imgSrc ? (
          <div className="relative overflow-hidden bg-slate-100">
            <img
              src={imgSrc}
              alt={`${heading} – AAWSA Portal screenshot`}
              className="w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.015]"
              style={{ height: "220px" }}
              loading="lazy"
            />
            {/* Hover expand overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 group-hover:bg-slate-900/25 transition-all duration-200">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-white/95 text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-lg">
                <Maximize2 className="h-3.5 w-3.5" />
                <span>{isAm ? "ለማስፋት ጠቅ ያድርጉ" : "Click to expand"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[180px] bg-slate-50 text-slate-400 text-xs">
            <div className="text-center space-y-1">
              <ExternalLink className="h-6 w-6 mx-auto text-slate-300" />
              <p>{isAm ? "ስክሪንሾት አልተገኘም" : "Screenshot not available"}</p>
            </div>
          </div>
        )}

        {/* Caption bar */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-500 truncate leading-tight">
            <span className="font-semibold text-slate-700">{heading}</span>
          </p>
          {imgSrc && (
            <span className="text-[9px] text-slate-400 font-mono shrink-0 ml-2 uppercase tracking-wider">
              {isAm ? "ቀጥታ ምስል" : "Live capture"}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
