"use client";

import * as React from "react";
import {
  BookOpen, Search, BookMarked, Printer, Info, AlertTriangle,
  ArrowRight, GitBranch, Languages, Sparkles, FileDown,
  Maximize, Minimize, CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type LanguageMode,
  type Callout,
  type Section,
  SECTIONS,
  BILINGUAL_GLOSSARY,
  GROUP_CONFIG,
  GROUPS,
  CATEGORY_NAMES,
} from "./manual-data";
import { StepScreenshotPreview } from "./step-screenshots";

// ─── Font & Print Styles ───────────────────────────────────────────────────────

const STYLE_BLOCK = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+Ethiopic:wght@400;500;600;700;800&display=swap');
  .manual-root {
    font-family: 'Inter', 'Noto Sans Ethiopic', 'Abyssinica SIL', 'Nyala', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .amharic-font {
    font-family: 'Noto Sans Ethiopic', 'Nyala', 'Abyssinica SIL', sans-serif;
  }
  @media print {
    @page { size: A4 portrait; margin: 10mm 12mm; }
    body, html { font-family: 'Inter', 'Noto Sans Ethiopic', sans-serif !important; background: #fff !important; color: #0f172a !important; font-size: 9.5pt !important; }
    div[class*="sm:ml-"], div[class*="ml-"], div[data-sidebar="inset"], main, main > div, .manual-content-wrapper {
      margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important;
    }
    .manual-section-card { page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 12pt !important; box-shadow: none !important; }
    .manual-group-heading { page-break-after: avoid !important; break-after: avoid !important; }
    table { page-break-inside: avoid !important; width: 100% !important; }
    img { max-width: 100% !important; height: auto !important; page-break-inside: avoid !important; break-inside: avoid !important; }
    img[src*="/images/manual/"] {
      height: auto !important;
      max-height: none !important;
      object-fit: contain !important;
      display: block !important;
      page-break-inside: avoid !important;
    }
    .print-hidden { display: none !important; }
    .print-block { display: block !important; }
  }
`;

// ─── SVG Diagrams ─────────────────────────────────────────────────────────────

function BillingWorkflowDiagram({ language = "both" }: { language?: LanguageMode }) {
  const steps = [
    { label: "Meter\nReading",        amLabel: "የቆጣሪ\nንባብ",       color: "#0d9488" },
    { label: "Run\nBilling",          amLabel: "ቢል\nማስላት",      color: "#6366f1" },
    { label: "Draft\nCreated",        amLabel: "ረቂቅ\nቢል",         color: "#64748b" },
    { label: "Submit\nApproval",      amLabel: "ይሁንታ\nመጠየቅ",      color: "#3b82f6" },
    { label: "Approved",              amLabel: "የጸደቀ",            color: "#8b5cf6" },
    { label: "Posted\n(Locked)",      amLabel: "የተለጠፈ\nቢል",       color: "#7c3aed" },
    { label: "Record\nPayment",       amLabel: "ክፍያ\nማወራረድ",     color: "#059669" },
    { label: "PAID ✓",                amLabel: "ተከፍሏል ✓",        color: "#16a34a" },
  ];
  const W = 76, GAP = 20, SH = 52;
  const total = steps.length * W + (steps.length - 1) * GAP;

  return (
    <div className="overflow-x-auto py-1">
      <svg viewBox={`0 0 ${total} 76`} xmlns="http://www.w3.org/2000/svg" style={{ minWidth: total, height: 76 }}>
        {steps.map((s, i) => {
          const x = i * (W + GAP);
          const lines = language === "am" ? s.amLabel.split("\n") : s.label.split("\n");
          return (
            <g key={i}>
              <rect x={x} y={0} width={W} height={SH} rx={7} fill={s.color} opacity={0.92} />
              {lines.map((l, li) => (
                <text
                  key={li}
                  x={x + W / 2}
                  y={23 + li * 13}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="white"
                  fontFamily="'Noto Sans Ethiopic', Inter, sans-serif"
                >
                  {l}
                </text>
              ))}
              {i < steps.length - 1 && (
                <>
                  <line x1={x + W} y1={SH / 2} x2={x + W + GAP - 5} y2={SH / 2} stroke="#94a3b8" strokeWidth="1.5" />
                  <polygon points={`${x + W + GAP - 5},${SH / 2 - 4} ${x + W + GAP},${SH / 2} ${x + W + GAP - 5},${SH / 2 + 4}`} fill="#94a3b8" />
                </>
              )}
              {i === 3 && (
                <text
                  x={x + W / 2 - 25}
                  y={70}
                  fontSize="7"
                  fill="#ef4444"
                  fontFamily="'Noto Sans Ethiopic', Inter, sans-serif"
                >
                  {language === "am" ? "↑ ወደ ረቂቅ ይመለሳል" : "↑ Rework to Draft"}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MeterHierarchyDiagram({ language = "both" }: { language?: LanguageMode }) {
  const headTitle = language === "am" ? "አ.አ.ው.ፍ.ባ (ዋና መ/ቤት)" : language === "en" ? "AAWSA (Head Office)" : "AAWSA / አ.አ.ው.ፍ.ባ";
  const branches = [
    { x: 20, en: "Megenagna", am: "መገናኛ" },
    { x: 170, en: "Bole", am: "ቦሌ" },
    { x: 320, en: "Kirkos", am: "ቂርቆስ" },
  ];
  const bulks = [
    { x: 5, en: "Bulk Meter A", am: "የጅምላ ቆጣሪ ሀ" },
    { x: 60, en: "Bulk Meter B", am: "የጅምላ ቆጣሪ ለ" },
  ];
  const legend = [
    { c: "#6366f1", en: "Authority", am: "ባለስልጣን መ/ቤት" },
    { c: "#0d9488", en: "Branch Office", am: "ቅርንጫፍ ጽ/ቤት" },
    { c: "#f59e0b", en: "Bulk Meter", am: "የጅምላ ቆጣሪ" },
  ];

  return (
    <div className="overflow-x-auto py-1">
      <svg viewBox="0 0 440 135" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: 360, height: 135 }}>
        <rect x="155" y="4" width="130" height="28" rx="7" fill="#6366f1" />
        <text x="220" y="22" textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
          {headTitle}
        </text>
        <line x1="220" y1="32" x2="70" y2="56" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="220" y1="32" x2="220" y2="56" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="220" y1="32" x2="370" y2="56" stroke="#94a3b8" strokeWidth="1.5" />

        {branches.map((b, i) => {
          const text = language === "am" ? b.am : language === "en" ? b.en : `${b.en}\n${b.am}`;
          return (
            <g key={i}>
              <rect x={b.x} y={56} width={100} height={28} rx={5} fill="#0d9488" opacity={0.9} />
              {text.split("\n").map((l, li) => (
                <text key={li} x={b.x + 50} y={language === "both" ? 68 + li * 11 : 73} textAnchor="middle" fontSize="8" fontWeight="600" fill="white" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
                  {l}
                </text>
              ))}
            </g>
          );
        })}

        <line x1="70" y1="84" x2="45" y2="104" stroke="#94a3b8" strokeWidth="1" />
        <line x1="70" y1="84" x2="95" y2="104" stroke="#94a3b8" strokeWidth="1" />

        {bulks.map((m, i) => {
          const text = language === "am" ? m.am : language === "en" ? m.en : `${m.en} / ${m.am}`;
          return (
            <g key={i}>
              <rect x={m.x} y={104} width={75} height={22} rx={4} fill="#f59e0b" opacity={0.9} />
              <text x={m.x + 37} y={118} textAnchor="middle" fontSize="7" fontWeight="600" fill="white" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
                {text}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        {legend.map((leg, i) => {
          const lText = language === "am" ? leg.am : language === "en" ? leg.en : `${leg.en} / ${leg.am}`;
          return (
            <g key={i}>
              <rect x={280} y={104 + i * 14} width={10} height={10} rx={2.5} fill={leg.c} />
              <text x={296} y={112 + i * 14} fontSize="7" fill="#475569" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
                {lText}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function UserRolesDiagram({ language = "both" }: { language?: LanguageMode }) {
  const roles = [
    {
      label: "Admin",
      amLabel: "አድሚን",
      permsEn: ["Full system access", "All branches", "Settings"],
      permsAm: ["የሙሉ ሲስተም ፈቃድ", "ሁሉም ቅርንጫፎች", "ቅንብሮች"],
      color: "#7c3aed",
      pct: 100,
    },
    {
      label: "Head Office",
      amLabel: "ዋና መ/ቤት",
      permsEn: ["All branches view", "Reports only"],
      permsAm: ["የሁሉም ቅርንጫፍ እይታ", "ሪፖርቶች ብቻ"],
      color: "#3b82f6",
      pct: 80,
    },
    {
      label: "Supervisor",
      amLabel: "ተቆጣጣሪ",
      permsEn: ["Approve bills", "Manage branch"],
      permsAm: ["ቢሎችን ማጽደቅ", "ቅርንጫፍ መቆጣጠር"],
      color: "#0d9488",
      pct: 65,
    },
    {
      label: "Staff",
      amLabel: "ሰራተኛ",
      permsEn: ["Enter readings", "Create bills"],
      permsAm: ["ንባብ ማስገባት", "ቢል ማውጣት"],
      color: "#f59e0b",
      pct: 45,
    },
    {
      label: "Meter Reader",
      amLabel: "ቆጣሪ አንባቢ",
      permsEn: ["View routes", "Submit readings"],
      permsAm: ["መስመሮችን ማየት", "ንባብ መላክ"],
      color: "#64748b",
      pct: 25,
    },
  ];

  const W = 100, GAP = 16;
  const total = roles.length * W + (roles.length - 1) * GAP;

  return (
    <div className="overflow-x-auto py-1">
      <svg viewBox={`0 0 ${total} 105`} xmlns="http://www.w3.org/2000/svg" style={{ minWidth: Math.max(total, 300), height: 105 }}>
        {roles.map((r, i) => {
          const x = i * (W + GAP);
          const perms = language === "am" ? r.permsAm : r.permsEn;
          const title = language === "am" ? r.amLabel : r.label;
          return (
            <g key={i}>
              <rect x={x} y={0} width={W} height={75} rx={7} fill={r.color} opacity={0.88} />
              <text x={x + W / 2} y={15} textAnchor="middle" fontSize="9" fontWeight="800" fill="white" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
                {title}
              </text>
              {language === "both" && (
                <text x={x + W / 2} y={24} textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.8)" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
                  ({r.amLabel})
                </text>
              )}
              <line x1={x + 8} y1={28} x2={x + W - 8} y2={28} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
              {perms.map((p, pi) => (
                <text key={pi} x={x + W / 2} y={38 + pi * 11} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.85)" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
                  • {p}
                </text>
              ))}
              <rect x={x + 4} y={80} width={W - 8} height={5} rx={2.5} fill="#e2e8f0" />
              <rect x={x + 4} y={80} width={(W - 8) * r.pct / 100} height={5} rx={2.5} fill={r.color} />
              <text x={x + W / 2} y={97} textAnchor="middle" fontSize="6.5" fill="#475569" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
                {language === "am" ? `የፈቃድ መጠን: ${r.pct}%` : `Access: ${r.pct}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PaymentFlowDiagram({ language = "both" }: { language?: LanguageMode }) {
  const steps = [
    { label: "Posted Bill",      amLabel: "የተለጠፈ ቢል",     color: "#6366f1" },
    { label: "Payment\nReceived", amLabel: "ክፍያ\nተቀብሏል",    color: "#0d9488" },
    { label: "Amount\nVerified",  amLabel: "መጠን\nተረጋግጧል",    color: "#3b82f6" },
    { label: "Marked\nPAID",      amLabel: "ተከፍሏል\nተብሏል",     color: "#059669" },
    { label: "Balance\nCarried",  amLabel: "ቀሪ\nተሸጋግሯል",     color: "#f59e0b" },
  ];
  const W = 88, GAP = 18;
  const total = steps.length * W + (steps.length - 1) * GAP;

  return (
    <div className="overflow-x-auto py-1">
      <svg viewBox={`0 0 ${total} 64`} xmlns="http://www.w3.org/2000/svg" style={{ minWidth: total, height: 64 }}>
        {steps.map((s, i) => {
          const x = i * (W + GAP);
          const lines = (language === "am" ? s.amLabel : s.label).split("\n");
          return (
            <g key={i}>
              <rect x={x} y={2} width={W} height={42} rx={7} fill={s.color} opacity={0.9} />
              {lines.map((l, li) => (
                <text key={li} x={x + W / 2} y={19 + li * 13} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="white" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
                  {l}
                </text>
              ))}
              {i < steps.length - 1 && (
                <>
                  <line x1={x + W} y1={23} x2={x + W + GAP - 5} y2={23} stroke="#94a3b8" strokeWidth="1.5" />
                  <polygon points={`${x + W + GAP - 5},19 ${x + W + GAP},23 ${x + W + GAP - 5},27`} fill="#94a3b8" />
                </>
              )}
            </g>
          );
        })}
        <text x={4 * (W + GAP) + W / 2} y={58} textAnchor="middle" fontSize="7" fill="#f59e0b" fontFamily="'Noto Sans Ethiopic', Inter, sans-serif">
          {language === "am" ? "→ ወደሚቀጥለው ቢል ይሸጋገራል" : language === "en" ? "→ Rolls over to next bill" : "→ ወደሚቀጥለው ቢል ይሸጋገራል / Rolls over"}
        </text>
      </svg>
    </div>
  );
}

// ─── Callout Component ────────────────────────────────────────────────────────

function CalloutBox({ type, text, amharicText, language = "both" }: Callout & { language?: LanguageMode }) {
  const config = {
    info:    { bg: "bg-blue-50 border-blue-200 text-blue-900",       icon: Info,          iconClass: "text-blue-500",   textClass: "text-blue-800" },
    warning: { bg: "bg-amber-50 border-amber-200 text-amber-900",     icon: AlertTriangle, iconClass: "text-amber-500",  textClass: "text-amber-800" },
    tip:     { bg: "bg-emerald-50 border-emerald-200 text-emerald-900", icon: Sparkles,      iconClass: "text-emerald-500", textClass: "text-emerald-800" },
    danger:  { bg: "bg-red-50 border-red-200 text-red-900",         icon: AlertTriangle, iconClass: "text-red-500",    textClass: "text-red-800" },
  };
  const c = config[type];
  const Icon = c.icon;

  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-xl border text-xs my-2.5", c.bg)}>
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", c.iconClass)} />
      <div className="flex-1 space-y-1">
        {language === "am" && (
          <p className={cn("text-xs leading-relaxed amharic-font", c.textClass)}>
            {amharicText || text}
          </p>
        )}
        {language === "en" && (
          <p className={cn("text-xs leading-relaxed", c.textClass)}>
            {text}
          </p>
        )}
        {language === "both" && (
          <>
            <p className={cn("text-xs leading-relaxed", c.textClass)}>{text}</p>
            {amharicText && (
              <p className={cn("text-xs leading-relaxed opacity-90 amharic-font", c.textClass)}>
                {amharicText}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function UserManualPage() {
  const [search, setSearch] = React.useState("");
  const [activeGroup, setActiveGroup] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<string | null>(null);
  const [language, setLanguage] = React.useState<LanguageMode>("am");
  const [glossaryCategory, setGlossaryCategory] = React.useState<string>("All");
  const [glossarySearch, setGlossarySearch] = React.useState<string>("");
  const [printDate, setPrintDate] = React.useState("October 2026");
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Track browser fullscreen state
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Load language preference from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("aawsa_manual_language") as LanguageMode | null;
      if (saved === "en" || saved === "am" || saved === "both") {
        setLanguage(saved);
      }
    } catch {}
    setPrintDate(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
  }, []);

  const handleLanguageChange = (mode: LanguageMode) => {
    setLanguage(mode);
    try {
      localStorage.setItem("aawsa_manual_language", mode);
    } catch {}
  };

  const handleDownloadPdf = async (mode: "all" | "filtered" = "all") => {
    const prevGroup = activeGroup, prevSearch = search;
    if (mode === "all" && (activeGroup || search)) { setActiveGroup(null); setSearch(""); }
    const prevTitle = document.title;
    document.title = mode === "filtered" && activeGroup
      ? `AAWSA_User_Manual_${activeGroup.replace(/\s+/g, "_")}`
      : "AAWSA_Bulk_Billing_Portal_User_Manual";

    // Preload & decode all images on the page before print to prevent missing screenshots
    try {
      const imgs = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );
    } catch {}

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = prevTitle;
        if (mode === "all" && (prevGroup || prevSearch)) { setActiveGroup(prevGroup); setSearch(prevSearch); }
      }, 1000);
    }, mode === "all" && (prevGroup || prevSearch) ? 200 : 100);
  };

  const filtered = SECTIONS.filter((s) => {
    const groupOk = !activeGroup || s.group === activeGroup;
    if (!search.trim()) return groupOk;
    const q = search.toLowerCase();
    return groupOk && (
      s.title.toLowerCase().includes(q) ||
      s.amharicTitle.toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q) ||
      s.content.some((c) =>
        c.heading?.toLowerCase().includes(q) ||
        c.amharicHeading?.toLowerCase().includes(q) ||
        c.body?.toLowerCase().includes(q) ||
        c.amharicBody?.toLowerCase().includes(q) ||
        c.steps?.some((st) => st.toLowerCase().includes(q)) ||
        c.amharicSteps?.some((st) => st.includes(q))
      )
    );
  });

  const filteredGlossary = BILINGUAL_GLOSSARY.filter((t) => {
    const catOk = glossaryCategory === "All" || t.category === glossaryCategory;
    if (!glossarySearch.trim()) return catOk;
    const q = glossarySearch.toLowerCase();
    return catOk && (
      t.english.toLowerCase().includes(q) ||
      t.amharic.includes(q) ||
      t.phonetic.toLowerCase().includes(q) ||
      t.definitionEn.toLowerCase().includes(q) ||
      t.definitionAm.includes(q)
    );
  });

  const groupedFiltered = GROUPS
    .map((g) => ({ group: g, items: filtered.filter((s) => s.group === g) }))
    .filter((g) => g.items.length > 0);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const categories = ["All", "Metering", "Billing", "Workflow", "Tariff & Finance", "System"];

  const DIAGRAMS: Record<string, React.ReactNode> = {
    "billing-workflow": <BillingWorkflowDiagram language={language} />,
    "meter-hierarchy":  <MeterHierarchyDiagram language={language} />,
    "user-roles":       <UserRolesDiagram language={language} />,
    "payment-flow":     <PaymentFlowDiagram language={language} />,
  };

  const WORKFLOW_STEPS = [
    { label: "Enter Readings",    amLabel: "ንባብ ማስገባት",       color: "bg-teal-100 text-teal-800 border-teal-200" },
    { label: "Run Billing Cycle", amLabel: "ቢል ማስላት",         color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    { label: "Draft Created",     amLabel: "ረቂቅ ቢል",          color: "bg-slate-100 text-slate-700 border-slate-200" },
    { label: "Submit Approval",   amLabel: "ይሁንታ መጠየቅ",      color: "bg-blue-100 text-blue-800 border-blue-200" },
    { label: "Approve",           amLabel: "ማጽደቅ",             color: "bg-violet-100 text-violet-800 border-violet-200" },
    { label: "Post Bill",         amLabel: "ቢል መለጠፍ",          color: "bg-purple-100 text-purple-800 border-purple-200" },
    { label: "Record Payment",    amLabel: "ክፍያ ማወራረድ",      color: "bg-green-100 text-green-800 border-green-200" },
    { label: "PAID ✓",            amLabel: "ተከፍሏል ✓",          color: "bg-green-500 text-white border-green-500" },
  ];

  return (
    <div className="manual-root min-h-screen bg-[#f8fafc] print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="print:hidden relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 px-6 sm:px-8 lg:px-12 py-8 border-b border-slate-800 w-full">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative w-full">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 shrink-0">
                <BookOpen className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className={cn("text-3xl font-black text-white tracking-tight", language === "am" && "amharic-font")}>
                    {language === "am" ? "የተጠቃሚ መመሪያ" : "User Manual"}
                  </h1>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 amharic-font">
                    {language === "am" ? "የተሟላ መመሪያ · v2.0" : language === "en" ? "Operational SOPs · v2.0" : "የተጠቃሚ መመሪያ · v2.0"}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {language === "am" ? `${SECTIONS.length} ሞጁሎች` : `${SECTIONS.length} Modules`}
                  </span>
                </div>
                <p className="text-sm text-slate-300 max-w-3xl">
                  {language === "am"
                    ? "የአዲስ አበባ ውሃና ፍሳሽ ባለስልጣን (አ.አ.ው.ፍ.ባ) — የተሟላ የአሰራር መመሪያ፣ SOPs እና የቴክኒክ ማጣቀሻ"
                    : language === "en"
                    ? "Addis Ababa Water & Sewerage Authority (AAWSA) — Complete Operational Manual, SOPs & Technical Reference"
                    : "Addis Ababa Water & Sewerage Authority (AAWSA) — Complete Operational Manual, SOPs & Bilingual Reference"}
                </p>
                {language === "both" && (
                  <p className="text-xs text-slate-400 mt-0.5 amharic-font">
                    የአዲስ አበባ ውሃና ፍሳሽ ባለስልጣን የጅምላ ቢል ፖርታል የተሟላ የአሰራር መመሪያና መዝገበ-ቃላት
                  </p>
                )}
              </div>
            </div>

            {/* Quick Action Buttons & Language Switcher */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Language Switcher Controls */}
              <div className="flex items-center rounded-xl bg-white/10 p-1 border border-white/20 backdrop-blur-md shadow-inner">
                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                    language === "en"
                      ? "bg-white text-slate-900 shadow-md font-extrabold"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                  title="Switch to full English"
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("am")}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all amharic-font",
                    language === "am"
                      ? "bg-white text-slate-900 shadow-md font-extrabold"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                  title="ሙሉ በሙሉ ወደ አማርኛ ቀይር"
                >
                  አማርኛ
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("both")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                    language === "both"
                      ? "bg-blue-600 text-white shadow-md font-extrabold"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                  title="Bilingual / ሁለቱም ቋንቋዎች ጎን ለጎን"
                >
                  <Languages className="h-3.5 w-3.5" />
                  <span>English + አማርኛ</span>
                </button>
              </div>

              {/* Fullscreen Button */}
              <Button
                type="button"
                onClick={toggleFullscreen}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9 bg-white/5 border-white/20 text-white hover:bg-white/10"
                title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
              >
                {isFullscreen ? <Minimize className="h-3.5 w-3.5 text-cyan-400" /> : <Maximize className="h-3.5 w-3.5 text-cyan-400" />}
                <span className={cn(language === "am" && "amharic-font")}>
                  {isFullscreen
                    ? (language === "am" ? "ሙሉ ስክሪን ውጣ" : "Exit Fullscreen")
                    : (language === "am" ? "ሙሉ ስክሪን" : "Full Screen")}
                </span>
              </Button>

              <Button
                onClick={() => scrollToSection("bilingual-glossary")}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9 bg-white/5 border-white/20 text-white hover:bg-white/10"
              >
                <BookMarked className="h-3.5 w-3.5 text-amber-400" />
                <span className={cn(language === "am" && "amharic-font")}>
                  {language === "am" ? "መዝገበ-ቃላት" : language === "en" ? "Glossary" : "Glossary / መዝገበ-ቃላት"}
                </span>
              </Button>
              {(activeGroup || search) && (
                <Button onClick={() => handleDownloadPdf("filtered")} variant="outline" size="sm"
                  className="gap-1.5 text-xs h-9 bg-white/5 border-white/20 text-white hover:bg-white/10">
                  <Printer className="h-3.5 w-3.5" />
                  <span className={cn(language === "am" && "amharic-font")}>
                    {language === "am" ? "የህትመት እይታ" : "Print View"}
                  </span>
                </Button>
              )}
              <Button onClick={() => handleDownloadPdf("all")} size="sm"
                className="gap-2 h-9 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 shadow-lg shadow-blue-500/25 font-semibold">
                <FileDown className="h-4 w-4" />
                <span className={cn(language === "am" && "amharic-font")}>
                  {language === "am" ? "ፒዲኤፍ አውርድ" : "Download PDF"}
                </span>
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10 w-full">
            {[
              { labelEn: "System Modules",    labelAm: "የሲስተም ሞጁሎች",       value: SECTIONS.length, color: "text-blue-400" },
              { labelEn: "Functional Groups", labelAm: "የስራ ምድቦች",          value: GROUPS.length,   color: "text-indigo-400" },
              { labelEn: "Glossary Terms",    labelAm: "የቃላት መፍቻዎች",       value: BILINGUAL_GLOSSARY.length, color: "text-emerald-400" },
              { labelEn: "Step-by-Step SOPs", labelAm: "የአሰራር ደረጃዎች (SOPs)", value: SECTIONS.reduce((a, s) => a + s.content.filter(c => c.steps).length, 0), color: "text-teal-400" },
              { labelEn: "Reference Tables",  labelAm: "ማጠቃለያ ሠንጠረዦች",    value: SECTIONS.reduce((a, s) => a + s.content.filter(c => c.table).length, 0), color: "text-amber-400" },
              { labelEn: "Process Diagrams",  labelAm: "የስራ ሂደት ቻርቶች",     value: 4,               color: "text-pink-400" },
            ].map(stat => (
              <div key={stat.labelEn} className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className={cn("text-2xl font-black", stat.color)}>{stat.value}</div>
                <div className={cn("text-[11px] text-slate-300 font-medium", language === "am" && "amharic-font")}>
                  {language === "am" ? stat.labelAm : stat.labelEn}
                </div>
                {language === "both" && (
                  <div className="text-[10px] text-slate-500 amharic-font">{stat.labelAm}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sticky Filter Bar ─────────────────────────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-20 border-b bg-white/95 backdrop-blur shadow-sm px-6 sm:px-8 lg:px-12 py-2.5 w-full">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={
                  language === "am"
                    ? "መመሪያውን ይፈልጉ (በአማርኛ ወይም በእንግሊዝኛ)..."
                    : language === "en"
                    ? "Search manual (English)..."
                    : "Search manual (English / አማርኛ)…"
                }
                className="pl-8 h-8 text-sm bg-slate-50 border-slate-200 rounded-lg"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveGroup(null)}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-semibold transition-all border",
                  !activeGroup
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400",
                  language === "am" && "amharic-font"
                )}
              >
                {language === "am" ? "ሁሉም" : language === "en" ? "All" : "All / ሁሉም"}
              </button>
              {GROUPS.map((g) => {
                const gc = GROUP_CONFIG[g];
                const GIcon = gc.icon;
                const isGroupActive = activeGroup === g;
                return (
                  <button
                    key={g}
                    onClick={() => setActiveGroup(isGroupActive ? null : g)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all border",
                      isGroupActive
                        ? `bg-gradient-to-r ${gc.gradient} text-slate-800 border-slate-300 shadow-sm`
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-400",
                      language === "am" && "amharic-font"
                    )}
                  >
                    <GIcon className="h-3 w-3" />
                    <span>{language === "am" ? gc.amharicTitle : g}</span>
                    {language === "both" && (
                      <span className="opacity-70 text-[10px] amharic-font">({gc.amharicTitle.split("/")[0].trim()})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Language Pill in Sticky Bar */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 shrink-0">
            <button
              onClick={() => handleLanguageChange("en")}
              className={cn(
                "px-2 py-1 text-[11px] font-bold rounded-md transition-all",
                language === "en" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              EN
            </button>
            <button
              onClick={() => handleLanguageChange("am")}
              className={cn(
                "px-2 py-1 text-[11px] font-bold rounded-md transition-all amharic-font",
                language === "am" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              አማርኛ
            </button>
            <button
              onClick={() => handleLanguageChange("both")}
              className={cn(
                "px-2 py-1 text-[11px] font-bold rounded-md transition-all",
                language === "both" ? "bg-blue-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Both
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Layout ──────────────────────────────────────────────────────── */}
      <div className="w-full px-6 sm:px-8 lg:px-12 py-6 flex gap-6 manual-content-wrapper print:max-w-none print:px-0">

        {/* Sidebar */}
        <aside className="print:hidden w-64 lg:w-72 shrink-0 self-start sticky top-[57px] max-h-[calc(100vh-80px)] overflow-y-auto pr-1 space-y-3">
          {/* Quick jump to Glossary */}
          <button
            onClick={() => scrollToSection("bilingual-glossary")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-xs font-bold bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border border-amber-200 shadow-xs hover:border-amber-300"
          >
            <BookMarked className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="flex-1 truncate">
              <div className={cn(language === "am" && "amharic-font")}>
                {language === "am" ? "የስራ ቃላት መዝገብ" : language === "en" ? "Glossary" : "Bilingual Glossary"}
              </div>
              {language === "both" && (
                <div className="text-[10px] text-amber-700 font-normal amharic-font">የቃላት መፍቻ ሰንጠረዥ</div>
              )}
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
              {BILINGUAL_GLOSSARY.length}
            </span>
          </button>

          {GROUPS.map((g) => {
            const gc = GROUP_CONFIG[g];
            const GIcon = gc.icon;
            const groupItems = SECTIONS.filter(s => s.group === g);
            const isGroupActive = activeGroup === g;
            return (
              <div key={g}>
                <button
                  onClick={() => setActiveGroup(isGroupActive ? null : g)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-[11px] font-bold uppercase tracking-wider",
                    isGroupActive
                      ? `bg-gradient-to-r ${gc.gradient} ${gc.color} shadow-sm border border-slate-200`
                      : "text-slate-400 hover:text-slate-700 hover:bg-slate-100",
                    language === "am" && "amharic-font normal-case"
                  )}
                >
                  <GIcon className="h-3.5 w-3.5 shrink-0" />
                  <div className="flex-1 truncate">
                    <span>{language === "am" ? gc.amharicTitle : g}</span>
                    {language === "both" && (
                      <span className="block text-[9px] font-normal normal-case opacity-75 amharic-font">{gc.amharicTitle}</span>
                    )}
                  </div>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    isGroupActive ? "bg-white/70 text-slate-600" : "bg-slate-100 text-slate-400")}>
                    {groupItems.length}
                  </span>
                </button>
                {isGroupActive && (
                  <div className="ml-2 mt-1 space-y-0.5 border-l-2 border-slate-200 pl-3">
                    {groupItems.map(s => {
                      const SIcon = s.icon;
                      return (
                        <button
                          key={s.id}
                          onClick={() => scrollToSection(s.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-all",
                            activeSection === s.id
                              ? "bg-slate-900 text-white font-semibold"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100",
                            language === "am" && "amharic-font"
                          )}
                        >
                          <SIcon className="h-3 w-3 shrink-0" />
                          <div className="flex-1 truncate">
                            <span>{language === "am" ? s.amharicTitle : s.title}</span>
                            {language === "both" && (
                              <span className="block text-[9.5px] opacity-75 font-normal amharic-font">{s.amharicTitle}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 space-y-8 print:space-y-4">
          {/* Print header */}
          <div className="hidden print:block mb-8 pb-6 border-b-2 border-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-600">
                  Addis Ababa Water and Sewerage Authority (AAWSA) • የአዲስ አበባ ውሃና ፍሳሽ ባለስልጣን
                </div>
                <h1 className={cn("text-2xl font-black text-slate-900 mt-1", language === "am" && "amharic-font")}>
                  {language === "am"
                    ? "የጅምላ ውሃ ቢል ፖርታል — የተሟላ የአሰራር መመሪያና SOPs"
                    : "Bulk Water Billing Portal — Operational Manual & Standard Operating Procedures"}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {language === "am"
                    ? "ይፋዊ የአሰራር መመሪያና የቴክኒክ ማጠቃለያ ለሁሉም የስራ ሚናዎች"
                    : "Official SOP guide & Technical reference for all operational and administrative roles"}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500 font-mono">
                <div className="font-bold text-slate-800">AAWSA-SOP-2026</div>
                <div>Generated: {printDate}</div>
                <div>{language === "am" ? "ሁሉም የስራ ሚናዎች" : "All User Roles"}</div>
              </div>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="py-24 text-center">
              <Search className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className={cn("text-slate-400 font-medium", language === "am" && "amharic-font")}>
                {language === "am" ? "ከፍለጋዎ ጋር የሚዛመድ ሞጁል አልተገኘም።" : "No modules match your search."}
              </p>
              <button
                onClick={() => { setSearch(""); setActiveGroup(null); }}
                className={cn("mt-2 text-xs text-blue-500 hover:underline", language === "am" && "amharic-font")}
              >
                {language === "am" ? "ማጣሪያዎችን አጽዳ" : "Clear filters"}
              </button>
            </div>
          )}

          {groupedFiltered.map(({ group, items }) => {
            const gc = GROUP_CONFIG[group];
            const GIcon = gc.icon;
            return (
              <div key={group}>
                {/* Group heading */}
                <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl mb-4 bg-gradient-to-r manual-group-heading", gc.gradient)}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm shrink-0">
                    <GIcon className={cn("h-4 w-4", gc.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className={cn("text-sm font-black text-slate-800", language === "am" && "amharic-font")}>
                        {language === "am" ? gc.amharicTitle : group}
                      </h2>
                      {language === "both" && (
                        <span className="text-xs font-semibold text-slate-600 amharic-font">({gc.amharicTitle})</span>
                      )}
                    </div>
                    <p className={cn("text-[11px] text-slate-500", language === "am" && "amharic-font")}>
                      {language === "am" ? gc.amharicDescription : gc.description}
                    </p>
                  </div>
                  <span className={cn("text-[11px] font-bold text-slate-400 print:hidden", language === "am" && "amharic-font")}>
                    {items.length} {language === "am" ? "ሞጁሎች" : `module${items.length !== 1 ? "s" : ""}`}
                  </span>
                </div>

                <div className="space-y-4">
                  {items.map((section) => {
                    const Icon = section.icon;
                    return (
                      <div
                        key={section.id}
                        id={`section-${section.id}`}
                        className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden manual-section-card transition-shadow hover:shadow-md"
                      >
                        {/* Section header */}
                        <div className={cn("flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r", section.gradient)}>
                          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm shrink-0", section.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <h3 className={cn("font-bold text-slate-800 text-sm", language === "am" && "amharic-font")}>
                                {language === "am" ? section.amharicTitle : section.title}
                              </h3>
                              {language === "both" && (
                                <span className="text-xs font-semibold text-slate-600 amharic-font">
                                  • {section.amharicTitle}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge className={cn("shrink-0 text-[10px] font-semibold bg-white/70 text-slate-600 border-0 shadow-sm px-2.5 py-0.5", language === "am" && "amharic-font")}>
                            {language === "am" ? section.amharicBadge : section.badge}
                          </Badge>
                        </div>

                        {/* Section body */}
                        <div className="divide-y divide-slate-100">
                          {section.content.map((block, bi) => (
                            <div key={bi} className="px-5 py-4">
                              <div className="flex items-center gap-2 mb-3">
                                <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", section.color)} />
                                <h4 className={cn("font-bold text-[13px] text-slate-800", language === "am" && "amharic-font")}>
                                  {language === "am" ? (block.amharicHeading || block.heading) : block.heading}
                                </h4>
                                {language === "both" && block.amharicHeading && (
                                  <span className="text-xs font-medium text-slate-500 amharic-font">
                                    ({block.amharicHeading})
                                  </span>
                                )}
                              </div>

                              {/* Diagram */}
                              {block.diagram && (
                                <div className={cn("rounded-xl border p-3.5 mb-3.5", section.accentLight)}>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className={cn("text-[10px] font-bold uppercase tracking-wider text-slate-500", language === "am" && "amharic-font normal-case")}>
                                      {language === "am"
                                        ? "የስራ ሂደት ቻርት"
                                        : language === "en"
                                        ? "PROCESS DIAGRAM"
                                        : "Process Diagram • የስራ ሂደት ቻርት"}
                                    </p>
                                    <Badge variant="outline" className="text-[9px] bg-white/70 text-slate-600 font-mono">
                                      {block.diagram}
                                    </Badge>
                                  </div>
                                  {DIAGRAMS[block.diagram]}
                                </div>
                              )}

                              {/* Body text */}
                              {language === "en" && block.body && (
                                <p className="text-[13px] text-slate-600 whitespace-pre-line leading-relaxed mb-3">
                                  {block.body}
                                </p>
                              )}
                              {language === "am" && (block.amharicBody || block.body) && (
                                <p className="text-[13px] text-slate-700 whitespace-pre-line leading-relaxed mb-3 amharic-font">
                                  {block.amharicBody || block.body}
                                </p>
                              )}
                              {language === "both" && (
                                <>
                                  {block.body && (
                                    <p className="text-[13px] text-slate-600 whitespace-pre-line leading-relaxed mb-1.5">
                                      {block.body}
                                    </p>
                                  )}
                                  {block.amharicBody && (
                                    <p className="text-[12.5px] text-slate-500 whitespace-pre-line leading-relaxed mb-3 amharic-font italic">
                                      {block.amharicBody}
                                    </p>
                                  )}
                                </>
                              )}

                              {/* Steps with Right-Side Screenshot Preview */}
                              {((language === "en" && block.steps) ||
                                (language === "am" && (block.amharicSteps || block.steps)) ||
                                (language === "both" && (block.steps || block.amharicSteps))) && (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start mb-4">
                                  {/* Left: Procedural steps */}
                                  <div className="lg:col-span-7 xl:col-span-7 space-y-2.5">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      <span>
                                        {language === "am"
                                          ? "የአሰራር ቅደም ተከተል (SOP)"
                                          : language === "en"
                                          ? "PROCEDURAL STEPS (SOP)"
                                          : "Procedural Steps • የአሰራር ቅደም ተከተል"}
                                      </span>
                                    </div>
                                    <ol className="space-y-2.5">
                                      {((language === "am" ? (block.amharicSteps || block.steps) : block.steps) || []).map((step, si) => (
                                        <li key={si} className="flex gap-3 text-[13px] group">
                                          <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-black mt-0.5 shadow-2xs transition-transform group-hover:scale-110", section.color)}>
                                            {si + 1}
                                          </span>
                                          <div className="flex-1 leading-5">
                                            {language === "en" && (
                                              <span className="text-slate-700">{step}</span>
                                            )}
                                            {language === "am" && (
                                              <span className="text-slate-800 amharic-font">{step}</span>
                                            )}
                                            {language === "both" && (
                                              <>
                                                <div className="text-slate-800 font-medium">{step}</div>
                                                {block.amharicSteps?.[si] && (
                                                  <div className="text-[12px] text-slate-500 amharic-font mt-0.5">
                                                    {block.amharicSteps[si]}
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </li>
                                      ))}
                                    </ol>
                                  </div>

                                  {/* Right: Realistic UI Screenshot Mockup */}
                                  <div className="lg:col-span-5 xl:col-span-5 w-full">
                                    <StepScreenshotPreview
                                      sectionId={section.id}
                                      heading={block.heading}
                                      language={language}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Callouts */}
                              {block.callouts?.map((c, ci) => (
                                <CalloutBox key={ci} {...c} language={language} />
                              ))}

                              {/* Table */}
                              {block.table && (
                                <div className="overflow-x-auto mt-2 rounded-xl border border-slate-200">
                                  <table className="w-full text-[12px] border-collapse">
                                    <thead>
                                      <tr className={cn("bg-gradient-to-r", section.gradient)}>
                                        {(language === "am" && block.amharicTable
                                          ? block.amharicTable.headers
                                          : block.table.headers
                                        ).map((h, hi) => (
                                          <th
                                            key={hi}
                                            className={cn(
                                              "px-3 py-2.5 text-left font-bold text-slate-700 border-b border-slate-200",
                                              language === "am" && "amharic-font"
                                            )}
                                          >
                                            {h}
                                            {language === "both" && block.amharicTable?.headers[hi] && (
                                              <span className="block text-[10px] font-medium text-slate-500 amharic-font">
                                                {block.amharicTable.headers[hi]}
                                              </span>
                                            )}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(language === "am" && block.amharicTable
                                        ? block.amharicTable.rows
                                        : block.table.rows
                                      ).map((row, ri) => (
                                        <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                                          {row.map((cell, ci) => (
                                            <td
                                              key={ci}
                                              className={cn(
                                                "px-3 py-2 text-slate-600 border-b border-slate-100",
                                                language === "am" && "amharic-font"
                                              )}
                                            >
                                              <div>{cell}</div>
                                              {language === "both" && block.amharicTable?.rows[ri]?.[ci] && (
                                                <div className="text-[11px] text-slate-400 amharic-font mt-0.5">
                                                  {block.amharicTable.rows[ri][ci]}
                                                </div>
                                              )}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ── Bilingual Glossary Section ───────────────────────────────────────── */}
          <div id="section-bilingual-glossary" className="scroll-mt-20 rounded-2xl border border-amber-200 bg-white shadow-sm overflow-hidden manual-section-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white shrink-0 shadow-xs">
                  <BookMarked className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={cn("font-bold text-base", language === "am" && "amharic-font")}>
                      {language === "am"
                        ? "የስራ ቃላት መዝገበ-ቃላት እና ማመሳከሪያ"
                        : language === "en"
                        ? "Glossary & Term Reference"
                        : "Bilingual Glossary & Term Reference"}
                    </h3>
                    {language === "both" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-bold amharic-font">
                        ባለሁለት ቋንቋ መዝገበ-ቃላት
                      </span>
                    )}
                  </div>
                  <p className={cn("text-xs text-white/90 mt-0.5", language === "am" && "amharic-font")}>
                    {language === "am"
                      ? "የአዲስ አበባ ውሃና ፍሳሽ ባለስልጣን ይፋዊ የስራ ቃላት ትርጉም፣ የአነባበብ እና የፍቺ ማመሳከሪያ"
                      : language === "en"
                      ? "Official AAWSA operational terminology reference with phonetic guide and comprehensive definitions"
                      : "Official AAWSA terminology reference in English and Amharic with phonetics and definitions"}
                  </p>
                </div>
              </div>
              <Badge className="self-start sm:self-auto bg-white text-amber-900 border-0 text-xs font-bold">
                {BILINGUAL_GLOSSARY.length} {language === "am" ? "ቃላት" : "Terms"}
              </Badge>
            </div>

            <div className="p-5">
              {/* Category pills & search bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const cInfo = CATEGORY_NAMES[cat];
                    const label = language === "am" ? cInfo.am : language === "en" ? cInfo.en : `${cInfo.en} / ${cInfo.am}`;
                    return (
                      <button
                        key={cat}
                        onClick={() => setGlossaryCategory(cat)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-semibold transition-all border",
                          glossaryCategory === cat
                            ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
                          language === "am" && "amharic-font"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="relative min-w-[200px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder={
                      language === "am"
                        ? "ቃላትን ይፈልጉ..."
                        : language === "en"
                        ? "Search terms..."
                        : "Search terms (English / አማርኛ)…"
                    }
                    className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 rounded-lg"
                    value={glossarySearch}
                    onChange={(e) => setGlossarySearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Glossary Grid of Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredGlossary.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/50 p-4 transition-all hover:border-amber-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        {language === "en" ? (
                          <>
                            <div className="font-bold text-slate-900 text-sm">{item.english}</div>
                            <div className="text-[11px] text-slate-400 italic">
                              Pronunciation: {item.phonetic}
                            </div>
                          </>
                        ) : language === "am" ? (
                          <>
                            <div className="font-bold text-blue-900 text-sm amharic-font">{item.amharic}</div>
                            <div className="text-xs text-slate-500 font-medium">
                              {item.english} <span className="text-slate-400 italic">({item.phonetic})</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-bold text-slate-900 text-sm flex items-baseline gap-2">
                              <span>{item.english}</span>
                            </div>
                            <div className="text-xs font-semibold text-blue-700 font-sans amharic-font mt-0.5">
                              {item.amharic}
                            </div>
                            <div className="text-[11px] text-slate-400 italic">
                              Pronunciation: {item.phonetic}
                            </div>
                          </>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] font-medium shrink-0 bg-slate-100 text-slate-600 border-slate-200", language === "am" && "amharic-font")}>
                        {language === "am" ? (CATEGORY_NAMES[item.category]?.am || item.category) : item.category}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                      {language === "en" && (
                        <div>
                          <span className="font-semibold text-slate-700">Definition: </span>
                          <span className="text-slate-600 leading-relaxed">{item.definitionEn}</span>
                        </div>
                      )}
                      {language === "am" && (
                        <div>
                          <span className="font-semibold text-blue-800 amharic-font">ፍቺ፡ </span>
                          <span className="text-slate-700 amharic-font leading-relaxed">{item.definitionAm}</span>
                        </div>
                      )}
                      {language === "both" && (
                        <>
                          <div>
                            <span className="font-semibold text-slate-700">EN: </span>
                            <span className="text-slate-600 leading-relaxed">{item.definitionEn}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-blue-800 amharic-font">አማርኛ: </span>
                            <span className="text-slate-600 amharic-font leading-relaxed">{item.definitionAm}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* End-to-End Quick Reference */}
          {!search && !activeGroup && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden manual-section-card">
              <div className="flex items-center gap-3 border-b bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white shrink-0">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div>
                  <h3 className={cn("font-bold text-white text-sm", language === "am" && "amharic-font")}>
                    {language === "am"
                      ? "የቢል አሰራር ቅደም ተከተል — ሙሉ ማጠቃለያ"
                      : language === "en"
                      ? "Billing Workflow — End-to-End Quick Reference"
                      : "Billing Workflow — End-to-End Quick Reference"}
                  </h3>
                  {language === "both" && (
                    <p className="text-[11px] text-slate-300 amharic-font">የቢል አሰራር ቅደም ተከተል ማጠቃለያ</p>
                  )}
                </div>
              </div>
              <div className="px-5 py-5">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 mb-4">
                  <BillingWorkflowDiagram language={language} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {WORKFLOW_STEPS.map((item, i, arr) => (
                    <React.Fragment key={i}>
                      <div className={cn("px-3 py-1.5 rounded-lg border text-center", item.color)}>
                        <div className={cn("text-[11px] font-bold", language === "am" && "amharic-font")}>
                          {language === "am" ? item.amLabel : item.label}
                        </div>
                        {language === "both" && (
                          <div className="text-[9.5px] opacity-80 amharic-font">{item.amLabel}</div>
                        )}
                      </div>
                      {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-slate-300 self-center shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Print Footer */}
          <div className="hidden print:block pt-6 mt-10 border-t border-slate-300 text-center text-xs text-slate-500">
            <p className={cn("font-medium text-slate-700", language === "am" && "amharic-font")}>
              {language === "am"
                ? "© 2026 የአዲስ አበባ ውሃና ፍሳሽ ባለስልጣን (አ.አ.ው.ፍ.ባ)። መብቱ በህግ የተጠበቀ ነው።"
                : "© 2026 Addis Ababa Water and Sewerage Authority (AAWSA). All rights reserved."}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              AAWSA Bulk Billing Portal Standard Operating Manual · Document Version 2.0 · Generated: {printDate}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
