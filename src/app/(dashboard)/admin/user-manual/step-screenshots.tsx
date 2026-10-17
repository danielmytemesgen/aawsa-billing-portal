"use client";

import * as React from "react";
import {
  ExternalLink,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Check,
  Expand,
} from "lucide-react";
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
  "meter-readings":        "admin/meter-readings",
  "meter-change":          "admin/meter-change",
  "reader-monitoring":     "admin/routes",
  "route-management":      "admin/routes",
  approvals:               "admin/approvals",
  "bill-management":       "admin/bill-management",
  "paid-bills":            "admin/reports/paid-bills",
  "sent-bills":            "admin/reports/sent-bills",
  "unsettled-bills":       "admin/reports/unsettled-bills",
  "data-entry":            "admin/data-entry",
  "bulk-meters":           "admin/bulk-meters",
  "individual-customers":  "admin/individual-customers",
  branches:                "admin/branches",
  "staff-management":      "admin/staff-management",
  roles:                   "admin/roles-and-permissions",
  tariffs:                 "admin/tariffs",
  "fault-codes":           "admin/fault-codes",
  notifications:           "admin/notifications",
  promotions:              "admin/settings",
  reports:                 "admin/reports",
  support:                 "admin/support",
  "knowledge-base":        "admin/knowledge-base",
  settings:                "admin/settings",
  "security-logs":         "admin/security-logs",
  backup:                  "admin/backup",
  maintenance:             "admin/maintenance",
  errors:                  "admin/support",
  "recycle-bin":           "admin/recycle-bin",
};

export function StepScreenshotPreview({
  sectionId,
  heading,
  language,
}: StepScreenshotProps) {
  const isAm = language === "am";
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [zoom, setZoom] = React.useState<number>(1);
  const [copied, setCopied] = React.useState(false);

  const filename = SCREENSHOT_MAP[sectionId];
  const urlPath  = URL_MAP[sectionId] ?? `admin/${sectionId}`;
  const imgSrc   = filename ? `/images/manual/${filename}` : null;

  // Reset zoom on close/open
  React.useEffect(() => {
    if (!lightboxOpen) {
      setZoom(1);
    }
  }, [lightboxOpen]);

  // Keyboard escape to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && lightboxOpen) {
        setLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen]);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((prev) => Math.max(prev - 0.25, 0.75));
  };

  const handleZoomReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(1);
  };

  return (
    <>
      {/* ── Fullscreen Lightbox Modal ────────────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 print:hidden"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative w-full max-w-[96vw] max-h-[96vh] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox chrome & action header */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-slate-900 border-b border-slate-700/80 shrink-0">
              {/* Traffic dots & title */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
                </div>
                <div className="hidden md:flex items-center text-[11px] font-mono text-slate-300 bg-slate-800 px-3 py-1 rounded-md border border-slate-700 truncate max-w-[340px]">
                  <span className="text-emerald-400 font-bold mr-1">https://</span>
                  <span className="text-slate-200">portal.aawsa.gov.et/{urlPath}</span>
                </div>
                <span className="text-xs font-semibold text-slate-300 truncate ml-1 max-w-[200px] sm:max-w-xs">
                  {heading}
                </span>
              </div>

              {/* Controls: Zoom, Download, Open New Tab, Close */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Zoom Controls */}
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.75}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 rounded transition-all"
                    title={isAm ? "አሳንስ (Zoom Out)" : "Zoom Out"}
                    aria-label="Zoom Out"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleZoomReset}
                    className="px-2 py-0.5 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-all min-w-[48px] text-center"
                    title={isAm ? "ወደ ነባር መጠን (Reset Zoom)" : "Reset to 100%"}
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoom >= 2.5}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 rounded transition-all"
                    title={isAm ? "አጎላ (Zoom In)" : "Zoom In"}
                    aria-label="Zoom In"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Direct Download Button */}
                {imgSrc && (
                  <a
                    href={imgSrc}
                    download={`${sectionId}-screenshot.png`}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
                    title={isAm ? "ምስሉን ወደ ኮምፒውተርህ አውርድ" : "Download Full Screenshot"}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{isAm ? "አውርድ" : "Download"}</span>
                  </a>
                )}

                {/* Open in New Tab */}
                {imgSrc && (
                  <a
                    href={imgSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-all"
                    title={isAm ? "በአዲስ ትር ክፈት" : "Open Original in New Tab"}
                    aria-label="Open original"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                {/* Close Button */}
                <button
                  onClick={() => setLightboxOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-rose-600 hover:text-white border border-slate-700 transition-all"
                  aria-label="Close"
                  title={isAm ? "ዝጋ" : "Close (Esc)"}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable & Zoomable Screenshot viewport */}
            <div className="flex-1 overflow-auto bg-slate-950 p-2 sm:p-4 flex items-start justify-center min-h-[300px]">
              {imgSrc ? (
                <div
                  className="transition-transform duration-150 origin-top flex items-center justify-center"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                  }}
                >
                  <img
                    src={imgSrc}
                    alt={`${heading} – AAWSA Bulk Billing Portal`}
                    className="max-w-full rounded-lg shadow-2xl border border-slate-800 block select-none"
                    style={{
                      maxHeight: zoom === 1 ? "82vh" : "none",
                      objectFit: "contain",
                    }}
                  />
                </div>
              ) : (
                <div className="w-[800px] h-[400px] flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
                  {isAm ? "ስክሪንሾት አልተገኘም" : "No screenshot available"}
                </div>
              )}
            </div>

            {/* Lightbox Footer Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 shrink-0">
              <span className="truncate">
                {heading} &bull; <span className="font-mono text-emerald-400">/{urlPath}</span>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[10px] text-slate-500 uppercase">
                  1440 &times; 900 Live UI
                </span>
                {imgSrc && (
                  <a
                    href={imgSrc}
                    download={`${sectionId}-screenshot.png`}
                    className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Download className="h-3 w-3" />
                    <span>{isAm ? "ሙሉ ምስል አስቀምጥ" : "Save Image"}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Thumbnail Card ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "group rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden",
          "transition-all duration-200 hover:shadow-md hover:border-slate-300 w-full",
          "print:border-slate-300 print:shadow-none print:break-inside-avoid print:page-break-inside-avoid",
          imgSrc && "cursor-pointer"
        )}
        onClick={() => imgSrc && setLightboxOpen(true)}
        title={imgSrc ? (isAm ? "ለማስፋትና ሙሉ ዳታ ለማየት ጠቅ ያድርጉ" : "Click to expand & inspect full UI") : undefined}
      >
        {/* Browser chrome titlebar */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 text-slate-300 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/90 print:bg-slate-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/90 print:bg-slate-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90 print:bg-slate-400" />
          </div>

          {/* URL bar */}
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700/60 truncate max-w-[200px] print:bg-white print:text-slate-700 print:border-slate-300">
            <span className="text-emerald-400 font-bold print:text-slate-700">https://</span>
            <span className="truncate">portal.aawsa.gov.et/{urlPath}</span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 print:hidden">
            <div className="flex items-center gap-1 text-[9.5px] font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{isAm ? "ቀጥታ UI" : "Live UI"}</span>
            </div>
            {imgSrc && (
              <ZoomIn className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>

        {/* Screenshot or fallback */}
        {imgSrc ? (
          <div className="relative overflow-hidden bg-slate-100 print:overflow-visible print:bg-white">
            <img
              src={imgSrc}
              alt={`${heading} – AAWSA Portal screenshot`}
              className={cn(
                "w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.015]",
                "h-[220px] print:h-auto print:max-h-none print:object-contain print:scale-100"
              )}
              loading="eager"
            />
            {/* Hover expand overlay (hidden during print) */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 group-hover:bg-slate-900/25 transition-all duration-200 print:hidden pointer-events-none">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-white/95 text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-lg">
                <Maximize2 className="h-3.5 w-3.5" />
                <span>{isAm ? "ለማስፋት ጠቅ ያድርጉ" : "Click to expand & zoom"}</span>
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

        {/* Caption bar with quick download */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between print:bg-white print:border-slate-200">
          <p className="text-[10px] text-slate-500 truncate leading-tight">
            <span className="font-semibold text-slate-700">{heading}</span>
          </p>
          {imgSrc && (
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider print:hidden">
                {isAm ? "ቀጥታ ምስል" : "Live capture"}
              </span>
              <a
                href={imgSrc}
                download={`${sectionId}-screenshot.png`}
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors print:hidden"
                title={isAm ? "ምስሉን አውርድ" : "Download screenshot"}
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
