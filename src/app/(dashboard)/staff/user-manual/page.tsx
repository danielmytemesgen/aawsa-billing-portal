"use client";

import * as React from "react";
import { BookOpen, ChevronRight, Search, Users, Zap, BarChart3, Settings, Trash2, Shield, FileText, CreditCard, Gauge, MapPin, Activity, Database, BookMarked, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentBlock = {
  heading: string;
  body?: string;
  steps?: string[];
  table?: { headers: string[]; rows: string[][] };
};

// ─── Manual Content Data ─────────────────────────────────────────────────────


const sections = [
  {
    id: "roles",
    icon: Users,
    title: "User Roles Overview",
    badge: "All Users",
    color: "bg-blue-500",
    content: [
      {
        heading: "Role Capabilities",
        body: `The portal has three access levels:\n\n• Admin — Full system access across all branches (Head Office, System Administrators)\n• Staff — Branch-scoped access (Cashiers, Meter Readers, Branch Supervisors)\n• Customer — Read-only access to their own bills`,
      },
      {
        heading: "What each role can do",
        table: {
          headers: ["Feature", "Admin", "Branch Staff", "Meter Reader", "Customer"],
          rows: [
            ["View all branches data", "✅", "Own branch only", "❌", "❌"],
            ["Create/Edit bulk meters", "✅", "With permission", "❌", "❌"],
            ["Run billing cycle", "✅", "With permission", "❌", "❌"],
            ["Approve bills", "✅", "With permission", "❌", "❌"],
            ["Record payments", "✅", "With permission", "❌", "❌"],
            ["Enter meter readings", "✅", "✅", "✅", "❌"],
            ["View reports", "✅", "Branch reports", "❌", "❌"],
            ["Manage staff", "✅", "❌", "❌", "❌"],
            ["System settings", "✅", "❌", "❌", "❌"],
            ["View own bill", "❌", "❌", "❌", "✅"],
          ],
        },
      },
    ],
  },
  {
    id: "login",
    icon: Shield,
    title: "Login & Authentication",
    badge: "All Users",
    color: "bg-slate-500",
    content: [
      {
        heading: "How to Log In",
        steps: [
          "Open your web browser and navigate to the portal URL.",
          "Enter your Email Address and Password.",
          'Click "Sign In".',
          "If your account is inactive or credentials are wrong, contact your system administrator.",
        ],
      },
      {
        heading: "Password Reset",
        body: "Contact your system administrator to reset your password. Admins can update staff passwords from Staff Management → Edit Staff.",
      },
    ],
  },
  {
    id: "dashboard",
    icon: Gauge,
    title: "Dashboard",
    badge: "Admin / Staff",
    color: "bg-indigo-500",
    content: [
      {
        heading: "Admin Dashboard — System-Wide View",
        steps: [
          "Log in as Admin and click Dashboard in the left sidebar.",
          "Review summary cards: Total Bills, Paid/Unpaid/Overdue, Total Revenue, Collection Efficiency.",
          "Use the Branch Filter (top right) to narrow data to a specific branch.",
          "Click any summary card to drill into the filtered bill list.",
          "Use Head Office Dashboard for a comparative branch-by-branch table.",
        ],
      },
      {
        heading: "Staff Dashboard — Branch View",
        steps: [
          "Log in as Staff and click Dashboard in the sidebar.",
          "View bills pending your action (Draft, Pending Approval).",
          "Review your branch collection summary and overdue meters.",
        ],
      },
    ],
  },
  {
    id: "bulk-meters",
    icon: Zap,
    title: "Bulk Meters",
    badge: "Admin / Staff",
    color: "bg-amber-500",
    content: [
      {
        heading: "View Bulk Meters",
        steps: [
          "Click Bulk Meters in the sidebar.",
          "Search by name or customer key using the Search bar.",
          "Filter by Branch or Status.",
          "Click any row to open the Bulk Meter Details page.",
        ],
      },
      {
        heading: "Create a New Bulk Meter",
        steps: [
          "Click Bulk Meters → New Bulk Meter (or the + Add button).",
          "Fill in: Name, Contract Number, Meter Key, Branch, Charge Group, Sewerage Connection, Meter Size, Initial Readings.",
          "Optionally fill: Route, Sub-City, Woreda, GPS coordinates.",
          'Click Save. The meter is created with status "Active".',
        ],
      },
      {
        heading: "Run Billing Cycle (Single Meter)",
        steps: [
          "Open the bulk meter details page.",
          'Click "Run Billing Cycle".',
          "Select the Billing Period (Month/Year) and Carry Balance option.",
          "Review computed charges in the preview.",
          'Click "Confirm and Generate Bill".',
          "The bill is created with status Draft and payment status Unpaid.",
        ],
      },
      {
        heading: "Credit / Deposit Balance",
        steps: [
          "Open the bulk meter details page.",
          "Scroll to the Credit / Deposit section.",
          'Click "Add Credit" to record an overpayment or deposit.',
          'Click "Void" on a credit entry to reverse an unused credit.',
        ],
      },
    ],
  },
  {
    id: "readings",
    icon: ClipboardList,
    title: "Meter Readings",
    badge: "Admin / Staff / Reader",
    color: "bg-teal-500",
    content: [
      {
        heading: "Enter a Single Manual Reading",
        steps: [
          "Click Meter Readings → Add Reading.",
          "Select Customer Type (Bulk or Individual), Customer Key, Reading Date, Current Reading value.",
          "The system computes consumption = Current − Previous automatically.",
          'Click "Submit Reading".',
        ],
      },
      {
        heading: "Upload Readings via CSV",
        steps: [
          "Go to Meter Readings → Upload CSV.",
          "Click Download Template and fill it: columns CUSTOMER_KEY, READING_DATE, METER_READING.",
          "Click Choose File and select your CSV.",
          "Click Upload & Preview to validate.",
          "Fix any errors, then click Confirm Upload.",
        ],
      },
      {
        heading: "Edit / Recalculate a Reading",
        steps: [
          "Find the reading in the list.",
          "Click the Edit (pencil) icon on the row.",
          "Update the reading value.",
          'Click "Save & Recalculate" — consumption is recalculated automatically.',
        ],
      },
    ],
  },
  {
    id: "billing",
    icon: FileText,
    title: "Billing Management",
    badge: "Admin / Staff",
    color: "bg-purple-500",
    content: [
      {
        heading: "View All Bills",
        steps: [
          "Click Bill Management in the sidebar.",
          "Use filters: Branch, Status (Draft/Pending/Approved/Posted/Paid/Unpaid), Period, Search.",
          "Click any bill row to open Bill Details.",
        ],
      },
      {
        heading: "Bill Lifecycle / Workflow",
        body: "Draft → Pending Approval → Approved → Posted → Paid or Unpaid\n\nRework is possible from Pending back to Draft.\nPosted bills can be Reversed if a correction is needed.",
      },
      {
        heading: "Batch Billing (All Meters in a Branch)",
        steps: [
          "Click Bill Management → Bulk Billing (process-job tab).",
          "Select Branch, Billing Period, and Carry Balance option.",
          'Click "Start Batch Billing".',
          "A job is queued — progress is shown in the job status panel.",
          "When complete, all meters in the branch have a new Draft bill.",
        ],
      },
      {
        heading: "Bulk Delete / Reset Bills for a Period",
        steps: [
          "Click the Bulk Delete / Reset Bills button (top right of Bill Management).",
          "Select Billing Period and Branch in the dialog.",
          "Click Preview Impact to see total scope, protected paid bills, and balance to reverse.",
          'Check "Preserve paid & settled bills" (recommended — on by default).',
          'Type DELETE in the confirmation box.',
          'Click "Delete Bills" to archive to Recycle Bin, or "Delete & Rebill Now" to immediately re-bill.',
        ],
      },
    ],
  },
  {
    id: "bill-details",
    icon: BookMarked,
    title: "Bill Details & Workflow",
    badge: "Admin / Staff",
    color: "bg-rose-500",
    content: [
      {
        heading: "Submit Bill for Approval (Draft → Pending)",
        steps: [
          "Open the bill in Draft status.",
          'Click "Submit for Approval".',
          "The bill moves to Pending Approval. Approvers are notified.",
        ],
      },
      {
        heading: "Approve a Bill (Pending → Approved)",
        steps: [
          "Open the bill in Pending status (or go to the Approvals page).",
          "Review all charges and readings.",
          'Click "Approve". The bill moves to Approved status.',
          'To reject, click "Send Back for Rework" — the bill returns to Draft with a note.',
        ],
      },
      {
        heading: "Post a Bill (Approved → Posted)",
        steps: [
          "Open the Approved bill.",
          'Click "Post Bill".',
          "The bill is now Posted — locked from further editing.",
          "It is visible to customers and ready for payment collection.",
        ],
      },
      {
        heading: "Print / Export as PDF",
        steps: [
          "Open any bill.",
          "Click Print Bill (printer icon) — opens a print-ready browser view.",
          "Click Export PDF — downloads the PDF file.",
          "The print shows itemized charges, reading info, payment status stamp, and billing cycle.",
        ],
      },
      {
        heading: "Create a Correction",
        steps: [
          "Open the Posted bill to be corrected.",
          'Click "Create Correction".',
          "The original bill is marked Reversed.",
          "A new CORR- prefixed bill is created in Draft.",
          "Edit and re-submit through the normal approval workflow.",
        ],
      },
    ],
  },
  {
    id: "payments",
    icon: CreditCard,
    title: "Payments & Credit",
    badge: "Admin / Staff",
    color: "bg-green-500",
    content: [
      {
        heading: "Record a Payment",
        steps: [
          "Open the bill in Bill Details.",
          'Click "Record Payment".',
          "Fill in: Amount Paid, Payment Method, Transaction Reference, Payment Date.",
          'Click "Save Payment".',
          "If full amount is covered, the bill is automatically marked Paid.",
        ],
      },
      {
        heading: "Reverse a Payment (Mark as Unpaid)",
        steps: [
          "Open a Paid bill.",
          "Click Update Status → Mark as Unpaid.",
          "Enter a Reversal Reason.",
          "Click Confirm Reversal. A reversal entry is recorded in the audit log.",
        ],
      },
      {
        heading: "Add Credit / Deposit",
        steps: [
          "Open the Bulk Meter Details page.",
          "Scroll to the Credit / Deposit section.",
          "Click Add Credit and enter Amount, Reason, Notes.",
          "The credit is automatically applied to the next billing cycle.",
        ],
      },
    ],
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Reports & Exports",
    badge: "Admin / Staff",
    color: "bg-cyan-500",
    content: [
      {
        heading: "Generate a Report",
        steps: [
          "Click Reports in the sidebar.",
          "Click on a report name to select it.",
          "Apply filters: Branch, Date Range, Charge Group.",
          "Click Preview to see data on screen.",
          "Click Export XLSX to download as Excel.",
        ],
      },
      {
        heading: "GL Monthly Summary by GL Code",
        body: "This report divides billing revenue by Branch, Charge Group, and GL Code.\n\nGL Code Reference:\n• WDGL — Water Domestic\n• WNDGL — Water Non-domestic\n• WBORGL — Water Borehole\n• WPFNTGL — Water Public Fountain\n• SEWERGL — Sewerage Charge\n• SNTGL — Sanitation Fee\n• MTRRNTGL — Meter Rent\n• MNTGL — Maintenance Fee\n• FIREGL — Additional Fees / Penalty",
      },
    ],
  },
  {
    id: "recycle-bin",
    icon: Trash2,
    title: "Recycle Bin",
    badge: "Admin",
    color: "bg-orange-500",
    content: [
      {
        heading: "Restore a Single Item",
        steps: [
          "Click Recycle Bin in the sidebar.",
          "Filter by Entity Type, Branch, or Date Deleted.",
          "Click Restore on the item row.",
          "The item is restored. Bill balances are recalculated automatically.",
        ],
      },
      {
        heading: "Batch Restore",
        steps: [
          "Apply filters to show the items to restore.",
          "Use checkboxes to select multiple items.",
          "Click Restore Selected in the action bar.",
          "Confirm in the dialog.",
        ],
      },
      {
        heading: "Permanently Delete",
        steps: [
          "Select one or more items.",
          "Click Delete Permanently.",
          "Type DELETE in the confirmation box.",
          "Click Confirm. This action is irreversible.",
        ],
      },
    ],
  },
  {
    id: "staff",
    icon: Users,
    title: "Staff Management",
    badge: "Admin",
    color: "bg-violet-500",
    content: [
      {
        heading: "Create a New Staff Member",
        steps: [
          "Click Staff Management → + Add Staff.",
          "Fill in: Name, Email (login username), Temporary Password, Branch, Role.",
          "Click Create Staff.",
        ],
      },
      {
        heading: "Edit / Deactivate Staff",
        steps: [
          "Click the staff member's row → Edit.",
          "Update name, email, branch, or role.",
          "To deactivate: change Status to Inactive → Save. They cannot log in.",
          "To permanently remove: click Delete → confirm.",
        ],
      },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Tariffs & Settings",
    badge: "Admin",
    color: "bg-slate-600",
    content: [
      {
        heading: "Update Tariff Rates",
        steps: [
          "Click Tariffs in the sidebar.",
          "Click the tariff to edit.",
          "Update rate fields (base rate tiers, fees, VAT %).",
          "Click Save.",
          "Warning: changes affect all future billing cycles — existing bills are not retroactively changed.",
        ],
      },
      {
        heading: "Penalty Settings",
        body: "In the tariff, configure:\n• Penalty Month Threshold — months of non-payment before penalty starts\n• Bank Lending Rate — base rate for penalty calculation\n• Penalty Tiered Rates — additional rate per aging tier (30/60/90+ days)",
      },
      {
        heading: "System Settings",
        steps: [
          "Click Settings in the sidebar.",
          "Configure: System Name, Currency, Due Date Rule, Email notifications.",
          "Click Save Settings.",
        ],
      },
    ],
  },
  {
    id: "errors",
    icon: Activity,
    title: "Common Error Messages",
    badge: "All Users",
    color: "bg-red-500",
    content: [
      {
        heading: "Error Reference",
        table: {
          headers: ["Error Message", "Cause", "Solution"],
          rows: [
            ["A billing job is currently in progress", "Billing job is running", "Wait for completion or reset the job"],
            ["Bill not found", "Bill deleted or invalid ID", "Check the Recycle Bin"],
            ["Cannot edit core billing data", "Bill is Posted or Approved", "Only payment fields editable on Posted bills"],
            ["Deletion Failed", "SQL or system error", "Contact administrator"],
            ["Forbidden: Missing permission", "Role lacks this permission", "Contact your administrator"],
            ["Billing period overlaps with existing bill", "Bill exists for that period", "Delete or correct the existing bill first"],
          ],
        },
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserManualPage() {
  const [search, setSearch] = React.useState("");
  const [active, setActive] = React.useState<string | null>(null);

  const filtered = sections.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.content.some(
        (raw) => {
          const c = raw as ContentBlock;
          return (
            c.heading?.toLowerCase().includes(q) ||
            c.body?.toLowerCase().includes(q) ||
            c.steps?.some((step: string) => step.toLowerCase().includes(q))
          );
        }
      )
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">User Manual</h1>
              <p className="text-sm text-muted-foreground">
                AAWSA Bulk Billing Portal — Step-by-step guide for all features
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search manual..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">

          {/* Sidebar TOC */}
          <aside className="hidden md:block">
            <div className="sticky top-6 space-y-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contents
              </p>
              {filtered.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActive(active === s.id ? null : s.id);
                      document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted text-left",
                      active === s.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {s.title}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main content */}
          <main className="space-y-6">
            {filtered.length === 0 && (
              <div className="py-20 text-center text-muted-foreground">
                No sections match your search.
              </div>
            )}

            {filtered.map((section) => {
              const Icon = section.icon;
              return (
                <div
                  key={section.id}
                  id={`section-${section.id}`}
                  className="scroll-mt-6 rounded-xl border bg-card shadow-sm overflow-hidden"
                >
                  {/* Section header */}
                  <div className="flex items-center gap-3 border-b px-6 py-4">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-white shrink-0", section.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-base">{section.title}</h2>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {section.badge}
                    </Badge>
                  </div>

                   {/* Section body */}
                  <div className="divide-y">
                    {section.content.map((rawBlock, bi) => {
                      const block = rawBlock as ContentBlock;
                      return (
                      <div key={bi} className="px-6 py-5">
                        <h3 className="font-medium text-sm mb-3 text-foreground">{block.heading}</h3>

                        {/* Steps */}
                        {block.steps && (
                          <ol className="space-y-2">
                            {block.steps.map((step, si) => (
                              <li key={si} className="flex gap-3 text-sm">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                                  {si + 1}
                                </span>
                                <span className="text-muted-foreground leading-5">{step}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {/* Body text */}
                        {block.body && (
                          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                            {block.body}
                          </p>
                        )}

                        {/* Table */}
                        {block.table && (
                          <div className="overflow-x-auto -mx-2">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-muted/50">
                                  {block.table.headers.map((h) => (
                                    <th key={h} className="px-3 py-2 text-left font-medium text-foreground border border-border">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {block.table.rows.map((row, ri) => (
                                  <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                    {row.map((cell, ci) => (
                                      <td key={ci} className="px-3 py-2 text-muted-foreground border border-border">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Billing Workflow Quick Reference */}
            {!search && (
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 border-b px-6 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <h2 className="font-semibold text-base">Billing Workflow — Quick Reference</h2>
                </div>
                <div className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {[
                      { label: "Enter Readings", color: "bg-teal-100 text-teal-800 border-teal-200" },
                      { label: "→", color: "text-muted-foreground font-bold text-lg" },
                      { label: "Run Billing Cycle", color: "bg-amber-100 text-amber-800 border-amber-200" },
                      { label: "→", color: "text-muted-foreground font-bold text-lg" },
                      { label: "Draft Created", color: "bg-slate-100 text-slate-700 border-slate-200" },
                      { label: "→", color: "text-muted-foreground font-bold text-lg" },
                      { label: "Submit for Approval", color: "bg-blue-100 text-blue-800 border-blue-200" },
                      { label: "→", color: "text-muted-foreground font-bold text-lg" },
                      { label: "Approve", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
                      { label: "→", color: "text-muted-foreground font-bold text-lg" },
                      { label: "Post Bill", color: "bg-purple-100 text-purple-800 border-purple-200" },
                      { label: "→", color: "text-muted-foreground font-bold text-lg" },
                      { label: "Record Payment", color: "bg-green-100 text-green-800 border-green-200" },
                      { label: "→", color: "text-muted-foreground font-bold text-lg" },
                      { label: "PAID ✓", color: "bg-green-500 text-white" },
                    ].map((item, i) =>
                      item.label.startsWith("→") ? (
                        <span key={i} className={item.color}>{item.label}</span>
                      ) : (
                        <span key={i} className={cn("px-2.5 py-1 rounded-md border text-xs font-medium", item.color)}>
                          {item.label}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
