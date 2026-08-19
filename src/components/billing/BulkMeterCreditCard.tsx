"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet, PlusCircle, Undo2, Loader2, Info, Ban, Sparkles, Eye,
  Copy, Check, Download, AlertTriangle, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getMeterCreditAction, addMeterCreditAction, voidMeterCreditAction } from "@/lib/actions";
import type { CreditLedgerEntry } from "@/lib/db-queries";
import { format, formatDistanceToNow, differenceInMonths } from "date-fns";

const REASON_LABELS: Record<string, string> = {
  duplicate_transaction: "Duplicate payment",
  bill_correction: "Bill correction",
  billing_cycle: "Billing cycle",
  manual: "Manual",
  bill_removed: "Bill removed",
};

const EVENT_STYLES: Record<string, string> = {
  created: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  applied:  "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  voided:   "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

type FilterType = "all" | "created" | "applied" | "voided";

/* ─── helpers ─── */

function formatDate(value?: string | Date | null) {
  if (!value) return "N/A";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    if (isNaN(d.getTime())) return "N/A";
    return format(d, "MMM d, yyyy HH:mm");
  } catch { return "N/A"; }
}

function relativeDate(value?: string | Date | null): string {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    if (isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch { return ""; }
}

function isOldCredit(entry: CreditLedgerEntry): boolean {
  if (!entry.created_at) return false;
  try {
    const d = typeof entry.created_at === "string" ? new Date(entry.created_at) : entry.created_at;
    return differenceInMonths(new Date(), d) >= 6;
  } catch { return false; }
}

function exportToCsv(ledger: CreditLedgerEntry[], bulkMeterKey: string) {
  const headers = ["Date", "Event", "Amount (ETB)", "Reason", "Source Bill", "Balance After (ETB)", "Created By", "Notes", "Entry ID"];
  const rows = ledger.map((e) => {
    const signed = e.event_type === "created" ? e.amount : -e.amount;
    return [
      formatDate(e.created_at),
      e.event_type + (e.voided_ledger_id ? " (void)" : ""),
      signed.toFixed(2),
      REASON_LABELS[e.reason ?? ""] ?? e.reason ?? "",
      e.source_bill_key ?? e.source_bill_id ?? "",
      e.balance_after.toFixed(2),
      e.created_by ?? "",
      (e.notes ?? "").replace(/"/g, '""'),
      e.id,
    ];
  });
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `credit-ledger-${bulkMeterKey}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── CopyButton ─── */

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/* ─── Sparkline ─── */

function BalanceSparkline({ ledger }: { ledger: CreditLedgerEntry[] }) {
  if (ledger.length < 2) return null;
  const points = [...ledger].reverse();
  const values = points.map((e) => e.balance_after);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 200, H = 36, PAD = 4;
  const coords = values.map((v, i) => ({
    x: PAD + ((W - PAD * 2) * i) / (values.length - 1),
    y: H - PAD - ((v - min) / range) * (H - PAD * 2),
  }));
  const d = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const lastPt = coords[coords.length - 1];
  const isPositive = values[values.length - 1] > 0;
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Balance trend</span>
      <svg width={W} height={H} className="overflow-visible">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isPositive ? "#22c55e" : "#94a3b8"} stopOpacity="0.25" />
            <stop offset="100%" stopColor={isPositive ? "#22c55e" : "#94a3b8"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${lastPt.x.toFixed(1)},${H} L${PAD},${H} Z`} fill="url(#sparkGrad)" />
        <path d={d} fill="none" stroke={isPositive ? "#22c55e" : "#94a3b8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill={isPositive ? "#22c55e" : "#94a3b8"} />
      </svg>
      <span className={`text-[10px] font-semibold tabular-nums ${isPositive ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
        ETB {values[values.length - 1].toFixed(2)}
      </span>
    </div>
  );
}

export interface BulkMeterCreditData {
  creditBalance: number;
  ledger: CreditLedgerEntry[];
}

export interface CreditSourceBill {
  id: string;
  billKey: string;
  monthYear: string;
  total: number;
  /** how much was actually paid against this bill (for overpaid-bill suggestions) */
  amountPaid?: number;
}

interface BulkMeterCreditCardProps {
  bulkMeterKey: string;
  /** initial balance from the client store, for immediate render before fetch */
  initialBalance?: number;
  canManage?: boolean;
  canAdd?: boolean;
  canVoid?: boolean;
  /** the meter's bills, for optionally attaching a source bill to a manual credit */
  bills?: CreditSourceBill[];
  /** the meter's overpaid bills (paid > total), newest first — for the duplicate-payment suggestion */
  overpaidBills?: CreditSourceBill[];
  /** open a bill's payslip directly (instead of navigating to bill management) */
  onViewBill?: (billId: string) => void;
}

export function BulkMeterCreditCard({ bulkMeterKey, initialBalance, canManage = false, canAdd, canVoid, bills, overpaidBills, onViewBill }: BulkMeterCreditCardProps) {
  const allowAdd = canAdd !== undefined ? canAdd : canManage;
  const allowVoid = canVoid !== undefined ? canVoid : canManage;
  const { toast } = useToast();
  const [data, setData] = useState<BulkMeterCreditData | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("manual");
  const [sourceBillId, setSourceBillId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [voidTarget, setVoidTarget] = useState<CreditLedgerEntry | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidNotes, setVoidNotes] = useState("");

  const [detailEntry, setDetailEntry] = useState<CreditLedgerEntry | null>(null);

  // #2 – hover state for void-pair highlighting
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // #5 – event filter
  const [eventFilter, setEventFilter] = useState<FilterType>("all");

  const refresh = useCallback(async () => {
    try {
      const res = await getMeterCreditAction(bulkMeterKey);
      if (res.data) setData(res.data);
    } catch (e) {
      console.error("Failed to load credit data:", e);
    } finally {
      setLoading(false);
    }
  }, [bulkMeterKey]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // IDs of ledger rows that have been voided
  const voidedIds = useMemo(() => {
    const ids = new Set<string>();
    (data?.ledger ?? []).forEach((e) => {
      if (e.event_type === "voided" && e.voided_ledger_id) ids.add(e.voided_ledger_id);
    });
    return ids;
  }, [data]);

  // #2 – map both directions: created_id ↔ voided_row_id for pair highlighting
  const voidPairMap = useMemo(() => {
    const map = new Map<string, string>();
    (data?.ledger ?? []).forEach((e) => {
      if (e.event_type === "voided" && e.voided_ledger_id) {
        map.set(e.voided_ledger_id, e.id);
        map.set(e.id, e.voided_ledger_id);
      }
    });
    return map;
  }, [data]);

  // Bills already carrying a live (non-voided) 'created' credit — don't re-suggest them
  const linkedBillIds = useMemo(() => {
    const ids = new Set<string>();
    (data?.ledger ?? []).forEach((e) => {
      if (e.event_type === "created" && e.source_bill_id && !voidedIds.has(e.id)) ids.add(e.source_bill_id);
    });
    return ids;
  }, [data, voidedIds]);

  const suggestedBill = useMemo(() => {
    if (reason !== "duplicate_transaction" || sourceBillId) return null;
    return (overpaidBills ?? []).find((b) => !linkedBillIds.has(b.id)) ?? null;
  }, [reason, sourceBillId, overpaidBills, linkedBillIds]);

  const balance = data?.creditBalance ?? initialBalance ?? 0;

  // #5 – filtered ledger
  const filteredLedger = useMemo(() => {
    const all = data?.ledger ?? [];
    if (eventFilter === "all") return all;
    return all.filter((e) => e.event_type === eventFilter);
  }, [data, eventFilter]);

  const paginated = filteredLedger.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // #5 – tab counts
  const counts = useMemo(() => {
    const all = data?.ledger ?? [];
    return {
      all: all.length,
      created: all.filter((e) => e.event_type === "created").length,
      applied:  all.filter((e) => e.event_type === "applied").length,
      voided:   all.filter((e) => e.event_type === "voided").length,
    };
  }, [data]);

  // #2 – highlight colour for a row
  const getRowHighlight = (entry: CreditLedgerEntry): string => {
    if (!hoveredId) return "";
    const pairedId = voidPairMap.get(hoveredId);
    if (entry.id === hoveredId || (pairedId && entry.id === pairedId))
      return "ring-1 ring-inset ring-amber-400 bg-amber-50/80 dark:bg-amber-950/40";
    return "";
  };

  // Session expired mid-use: bounce to login with a clear notice instead of a bare error toast.
  const handleAuthFailure = (message?: string | null): boolean => {
    if (message && /User not authenticated/i.test(message)) {
      toast({ variant: "destructive", title: "Session expired", description: "Please sign in again to continue." });
      window.location.href = "/";
      return true;
    }
    return false;
  };

  const handleAdd = async () => {
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      toast({ variant: "destructive", title: "Invalid amount", description: "Enter a credit amount greater than zero." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await addMeterCreditAction(bulkMeterKey, amt, reason, notes || undefined, sourceBillId || undefined);
      if (res.error) {
        if (handleAuthFailure(res.error.message)) return;
        toast({ variant: "destructive", title: "Failed to add credit", description: res.error.message });
        return;
      }
      toast({ title: "Credit added", description: `Deposit of ETB ${amt.toFixed(2)} recorded on this meter.` });
      setIsAddOpen(false);
      setAmount("");
      setNotes("");
      setReason("manual");
      setSourceBillId("");
      setPage(0);
      await refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to add credit" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      const res = await voidMeterCreditAction(bulkMeterKey, voidTarget.id);
      if (res.error) {
        if (handleAuthFailure(res.error.message)) { setVoidTarget(null); return; }
        toast({ variant: "destructive", title: "Failed to void credit", description: res.error.message });
        setVoidTarget(null);
        return;
      }
      toast({ title: "Credit voided", description: `ETB ${res.data.voidedAmount.toFixed(2)} returned to the meter's outstanding balance.` });
      setVoidTarget(null); setVoidReason(""); setVoidNotes("");
      await refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to void credit" });
    } finally { setVoiding(false); }
  };

  return (
    <Card className="shadow-lg border-emerald-500/25 non-printable">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Credit / Deposit
              {balance > 0.005 ? (
                <Badge variant="outline" className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                  Credit Note
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>Overpayments held as a deposit and applied to future bills</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Balance</div>
          <div className={`text-xl font-bold tabular-nums ${balance > 0.005 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
            ETB {balance.toFixed(2)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {allowAdd && (
              <Button size="sm" className="h-8" onClick={() => setIsAddOpen(true)}>
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Credit
              </Button>
            )}
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" /> Add a deposit (e.g. duplicate payment) or adjust a recorded credit.
            </span>
          </div>
          {/* #4 – CSV Export */}
          {(data?.ledger?.length ?? 0) > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              onClick={() => exportToCsv(data!.ledger, bulkMeterKey)}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading credit ledger…
          </div>
        ) : (data?.ledger?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            No credit history for this meter yet. Overpayments and corrections will appear here automatically.
          </div>
        ) : (
          <>
            {/* #3 – Balance sparkline */}
            <BalanceSparkline ledger={data!.ledger} />

            {/* #5 – Event filter tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {(["all", "created", "applied", "voided"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setEventFilter(f); setPage(0); }}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    eventFilter === f
                      ? f === "all"     ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900"
                      : f === "created" ? "bg-green-600 text-white border-green-600"
                      : f === "applied" ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-red-600 text-white border-red-600"
                      : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-slate-400"
                  }`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1 opacity-70">({counts[f]})</span>
                </button>
              ))}
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/90 dark:bg-slate-800/60">
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Source Bill</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((entry) => {
                  const isVoided = voidedIds.has(entry.id);
                  const signedAmount = entry.event_type === "created" ? entry.amount : -entry.amount;
                  const aged = entry.event_type === "created" && !isVoided && isOldCredit(entry); // #8
                  const highlight = getRowHighlight(entry); // #2
                  return (
                    <TableRow
                      key={entry.id}
                      className={`cursor-pointer transition-colors ${
                        highlight || "odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 dark:odd:bg-transparent dark:even:bg-slate-900/20"
                      }`}
                      onClick={() => setDetailEntry(entry)}
                      onMouseEnter={() => setHoveredId(entry.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* #9 – Relative timestamp */}
                      <TableCell className="whitespace-nowrap text-xs" title={relativeDate(entry.created_at)}>
                        <span className="font-medium">{formatDate(entry.created_at)}</span>
                        {relativeDate(entry.created_at) && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                            <Clock className="h-2.5 w-2.5" />{relativeDate(entry.created_at)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className={EVENT_STYLES[entry.event_type] ?? ""}>
                            {entry.event_type === "created" ? "Created" : entry.event_type === "applied" ? "Applied" : "Voided"}
                            {isVoided ? " (reversed)" : ""}
                          </Badge>
                          {/* #8 – aging indicator */}
                          {aged && (
                            <span title="Credit is older than 6 months">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${entry.event_type === "created" ? "text-green-600 dark:text-green-400" : "text-slate-600 dark:text-slate-400"}`}>
                        {signedAmount > 0 ? "+" : "−"}ETB {Math.abs(signedAmount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs">{REASON_LABELS[entry.reason ?? ""] ?? entry.reason ?? "—"}</TableCell>
                      {/* #6 – source bill link */}
                      <TableCell className="text-xs">
                        {entry.source_bill_id ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onViewBill?.(entry.source_bill_id as string); }}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            title={`Open payslip for ${entry.source_bill_key ?? entry.source_bill_id}`}
                          >
                            {entry.source_bill_key ?? entry.source_bill_id.slice(0, 8)}
                          </button>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">ETB {entry.balance_after.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{entry.notes ?? "—"}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600" title="View details"
                            onClick={(e) => { e.stopPropagation(); setDetailEntry(entry); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {allowVoid && entry.event_type === "created" && !isVoided ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Void this credit"
                              onClick={(e) => { e.stopPropagation(); setVoidTarget(entry); }}>
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              count={filteredLedger.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={setRowsPerPage}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </>
        )}
      </CardContent>

      {/* Add Credit dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Credit / Deposit</DialogTitle>
            <DialogDescription>
              Record money held on this meter (e.g. a duplicated payment or a bill-correction overpayment). It is applied to future bills until consumed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credit-amount">Amount (ETB)</Label>
              <Input
                id="credit-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="duplicate_transaction">Duplicate payment</SelectItem>
                  <SelectItem value="bill_correction">Bill correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {suggestedBill ? (
              <div className="rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-amber-900 dark:text-amber-200">Overpayment detected</p>
                    <p className="text-amber-800/90 dark:text-amber-300/80">
                      {suggestedBill.billKey || suggestedBill.id.slice(0, 8)} ({suggestedBill.monthYear}) — paid ETB{" "}
                      {(suggestedBill.amountPaid ?? suggestedBill.total).toFixed(2)} against ETB {suggestedBill.total.toFixed(2)}.
                      Link this deposit to the overpaid bill?
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-amber-500/40 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                  onClick={() => setSourceBillId(suggestedBill.id)}
                >
                  Link this bill
                </Button>
              </div>
            ) : null}
            {(bills?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label>Source Bill (optional)</Label>
                <Select value={sourceBillId} onValueChange={setSourceBillId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— No bill (standalone deposit)</SelectItem>
                    {bills!.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.billKey || b.id.slice(0, 8)} · {b.monthYear} · ETB {b.total.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="credit-notes">Notes (optional)</Label>
              <Textarea
                id="credit-notes"
                placeholder="e.g. second payment for transaction ref X"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <PlusCircle className="h-4 w-4 mr-1.5" />}
              Add Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Check-In Detail Dialog ── */}
      <Dialog open={detailEntry !== null} onOpenChange={(open) => { if (!open) setDetailEntry(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              Credit / Deposit — Entry Details
            </DialogTitle>
            <DialogDescription>
              Full record for this ledger entry. All fields are read-only.
            </DialogDescription>
          </DialogHeader>

          {detailEntry && (() => {
            const isVoided = voidedIds.has(detailEntry.id);
            const signedAmount = detailEntry.event_type === "created" ? detailEntry.amount : -detailEntry.amount;
            // aged is used for #8 badge in banner below
            return (
              <div className="space-y-4">
                {/* Status banner */}
                <div className={`rounded-lg border p-3 flex items-center gap-3 ${
                  detailEntry.event_type === "created" && !isVoided
                    ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700"
                    : detailEntry.event_type === "voided"
                    ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700"
                    : "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700"
                }`}>
                  <div className="flex-1 space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={EVENT_STYLES[detailEntry.event_type] ?? ""}>
                        {detailEntry.event_type === "created" ? "Created" : detailEntry.event_type === "applied" ? "Applied" : "Voided"}
                        {isVoided ? " (reversed)" : ""}
                      </Badge>
                      {/* #8 – aging badge in detail dialog */}
                      {detailEntry.event_type === "created" && !isVoided && isOldCredit(detailEntry) && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600 rounded-full px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3" /> Credit older than 6 months
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Amount</div>
                    <span className={`text-lg font-bold tabular-nums ${
                      signedAmount > 0 ? "text-green-600 dark:text-green-400" : "text-slate-600 dark:text-slate-400"
                    }`}>
                      {signedAmount > 0 ? "+" : "−"}ETB {Math.abs(signedAmount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Grid of fields */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {/* #9 – relative date */}
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date &amp; Time</div>
                    <div className="mt-0.5 font-medium">{formatDate(detailEntry.created_at)}</div>
                    {relativeDate(detailEntry.created_at) && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                        <Clock className="h-2.5 w-2.5" /> {relativeDate(detailEntry.created_at)}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reason</div>
                    <div className="mt-0.5">{REASON_LABELS[detailEntry.reason ?? ""] ?? detailEntry.reason ?? "—"}</div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Balance After</div>
                    <div className="mt-0.5 font-semibold tabular-nums">ETB {detailEntry.balance_after.toFixed(2)}</div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created By</div>
                    <div className="mt-0.5 truncate">{detailEntry.created_by ?? "—"}</div>
                  </div>

                  {/* #6 – clickable source bill */}
                  <div className="col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source Bill</div>
                    <div className="mt-0.5">
                      {detailEntry.source_bill_id ? (
                        <button type="button"
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          onClick={() => { setDetailEntry(null); onViewBill?.(detailEntry.source_bill_id as string); }}>
                          {detailEntry.source_bill_key ?? detailEntry.source_bill_id}
                        </button>
                      ) : "—"}
                    </div>
                  </div>

                  {/* #1 – copy buttons on IDs */}
                  {detailEntry.source_payment_id && (
                    <div className="col-span-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source Payment ID</div>
                      <div className="mt-0.5 flex items-center">
                        <span className="font-mono text-xs break-all text-muted-foreground">{detailEntry.source_payment_id}</span>
                        <CopyButton value={detailEntry.source_payment_id} />
                      </div>
                    </div>
                  )}

                  {detailEntry.voided_ledger_id && (
                    <div className="col-span-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Voids Entry ID</div>
                      <div className="mt-0.5 flex items-center">
                        <span className="font-mono text-xs break-all text-muted-foreground">{detailEntry.voided_ledger_id}</span>
                        <CopyButton value={detailEntry.voided_ledger_id} />
                      </div>
                    </div>
                  )}

                  <div className="col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Entry ID</div>
                    <div className="mt-0.5 flex items-center">
                      <span className="font-mono text-xs break-all text-muted-foreground">{detailEntry.id}</span>
                      <CopyButton value={detailEntry.id} />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-muted-foreground rounded-md border bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs min-h-[48px]">
                      {detailEntry.notes || "No notes recorded."}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {allowVoid && detailEntry.event_type === "created" && !isVoided && (
                  <div className="pt-1 border-t flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { setVoidTarget(detailEntry); setDetailEntry(null); }}
                    >
                      <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Void this Credit
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailEntry(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* #7 – Void confirmation with reason + notes */}
      <AlertDialog open={voidTarget !== null} onOpenChange={(open) => { if (!open) { setVoidTarget(null); setVoidReason(""); setVoidNotes(""); } }}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive" /> Void this credit?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This reverses <span className="font-semibold">ETB {voidTarget ? voidTarget.amount.toFixed(2) : "0.00"}</span> of
              the deposit created on{" "}
              <span className="font-semibold">{voidTarget ? formatDate(voidTarget.created_at) : ""}</span>.
              If the credit has already been applied to a bill, only the unconsumed portion is reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="void-reason" className="text-xs">Void reason (optional)</Label>
              <Select value={voidReason} onValueChange={setVoidReason}>
                <SelectTrigger id="void-reason" className="h-8 text-xs">
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry_error">Entry error</SelectItem>
                  <SelectItem value="customer_request">Customer request</SelectItem>
                  <SelectItem value="reconciliation">Reconciliation adjustment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="void-notes" className="text-xs">Notes (optional)</Label>
              <Textarea
                id="void-notes"
                className="text-xs min-h-[60px]"
                placeholder="Describe why this credit is being voided…"
                value={voidNotes}
                onChange={(e) => setVoidNotes(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" disabled={voiding} onClick={(e) => { e.preventDefault(); handleVoid(); }}>
              {voiding ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Void Credit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
