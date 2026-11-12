"use client";

import * as React from "react";
import { Sidebar } from "@/components/Sidebar";
import { MENU_ITEMS } from "@/lib/menu";
import {
  CheckCircle2,
  Sparkles,
  Sliders,
  Layers,
  ArrowRight,
  ShieldCheck,
  MousePointerClick,
  Code2,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SidebarDemoPage() {
  const [singleOpen, setSingleOpen] = React.useState<boolean>(true);
  const [simulatedPath, setSimulatedPath] = React.useState<string>("/nrw/gis-map");

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      {/* ── Collapsible Sidebar Instance ── */}
      <Sidebar
        items={MENU_ITEMS}
        singleOpen={singleOpen}
        header={
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#6B76D6] to-indigo-700 text-white shadow-md shadow-indigo-500/20 font-black text-base">
              A
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">
                AAWSA Portal
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Collapsible Navigation
              </div>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-700">Online · v2.4</span>
            </div>
            <Badge variant="outline" className="text-[10px] bg-white border-slate-200">
              {singleOpen ? "Accordion" : "Multi"}
            </Badge>
          </div>
        }
      />

      {/* ── Main Content Showcase & Verification Controls ── */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8">
        {/* Banner */}
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F1F4FA] text-[#6B76D6] border border-[#6B76D6]/20">
                <Sparkles className="w-3.5 h-3.5" /> Next.js + Tailwind + Lucide
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                Collapsible Sidebar Navigation
              </h1>
              <p className="text-sm text-slate-500 max-w-2xl">
                High-fidelity, accessible accordion navigation with CSS Grid height animation, exact
                <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-xs">#F1F4FA</code>
                submenu panel, thick
                <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-100 text-[#6B76D6] font-mono text-xs">#6B76D6</code>
                indigo accent border, and 56px indented submenu items.
              </p>
            </div>

            {/* Interactive Control Pill */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2 shrink-0">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#6B76D6]" /> Behavior Settings
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">
                  Accordion Mode (<code className="text-indigo-600 font-mono text-[11px]">singleOpen</code>):
                </span>
                <button
                  type="button"
                  onClick={() => setSingleOpen((v) => !v)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    singleOpen
                      ? "bg-[#6B76D6] text-white shadow-xs"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {singleOpen ? "Enabled (Single Open)" : "Disabled (Multi-Open)"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Verification Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Visual Design */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-[#6B76D6] flex items-center justify-center">
                <Palette className="w-4 h-4" />
              </div>
              Visual Design Specs
            </div>
            <ul className="text-xs text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Top-level row:</strong> Height 48px, horizontal padding 16px, 20px outline slate icons, 15px font-semibold.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Submenu panel:</strong> <code className="bg-[#F1F4FA] text-slate-900 px-1 rounded font-mono">#F1F4FA</code> background, <code className="text-indigo-600 font-mono">rounded-2xl</code>, thick 3.5px indigo border (<code className="text-indigo-600 font-mono">#6B76D6</code>).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Submenu items:</strong> 56px left padding past parent icon, 10px vertical padding, line wrapping allowed.
                </span>
              </li>
            </ul>
          </div>

          {/* Card 2: Interactive Behavior */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
              <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              Interactive Accordion
            </div>
            <ul className="text-xs text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Smooth Animation:</strong> 200ms ease transition using CSS Grid (<code className="bg-slate-100 font-mono text-[10px]">grid-template-rows: 0fr -&gt; 1fr</code>) with zero layout jump.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Chevrons:</strong> Far-right gray ChevronRight when closed, ChevronDown when open.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Plain Links:</strong> Items without children (e.g. <em>Phone Management</em>) render without chevrons.
                </span>
              </li>
            </ul>
          </div>

          {/* Card 3: Accessibility */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              Accessibility & Standards
            </div>
            <ul className="text-xs text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Semantic <code className="bg-slate-100 px-1 rounded">&lt;button&gt;</code> with <code className="text-slate-900 font-mono">aria-expanded</code> and <code className="text-slate-900 font-mono">aria-controls</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Full keyboard navigation (<kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Enter</kbd> / <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Space</kbd>) with visible focus ring.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Vertical scrolling with smooth thumb when content exceeds viewport height.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Code Usage Example */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Code2 className="w-4 h-4 text-[#6B76D6]" />
            Quick Usage Example in Next.js App Router Layout
          </div>
          <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
{`// app/layout.tsx
import { Sidebar } from "@/components/Sidebar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        {/* Collapsible Accordion Sidebar */}
        <Sidebar singleOpen={true} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {children}
        </main>
      </body>
    </html>
  );
}`}
          </pre>
        </div>
      </main>
    </div>
  );
}

