"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import {
  Coins,
  TrendingUp,
  Receipt,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Scale,
  AlertTriangle,
} from "lucide-react";
import type { GLKPIs, GLReconciliationAudit } from "@/lib/gl-audit-actions";

interface GLKPICardsProps {
  kpis: GLKPIs;
  reconciliationAudit?: GLReconciliationAudit | null;
  onOpenReconciliation?: () => void;
  isLoading?: boolean;
}

export function GLKPICards({
  kpis,
  reconciliationAudit,
  onOpenReconciliation,
  isLoading,
}: GLKPICardsProps) {
  const isClean = kpis.totalAnomalies === 0;
  const isReconciled = reconciliationAudit?.isReconciled ?? true;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* Gross Billed Total */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-indigo-50/30 overflow-hidden relative group hover:shadow-md transition-shadow">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Gross Billed GL
            </span>
            <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-sm">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {isLoading ? "—" : `${formatNumber(kpis.totalGrossBilled)} ETB`}
          </div>

          {/* Subtitle / Reconciliation Trigger */}
          {onOpenReconciliation ? (
            <button
              type="button"
              onClick={onOpenReconciliation}
              className={`flex items-center gap-1.5 mt-1 text-[11px] font-medium transition-colors text-left group/btn ${
                isReconciled
                  ? "text-emerald-700 hover:text-emerald-800"
                  : "text-amber-700 hover:text-amber-800 font-bold"
              }`}
              title="Click to inspect reconciliation audit between Paid Bills Report and GL"
            >
              {isReconciled ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold underline decoration-emerald-300 decoration-dotted">
                    {formatNumber(kpis.totalPaidAmount || 0)} Paid &amp; Reconciled
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 animate-pulse" />
                  <span className="underline decoration-amber-400">
                    Δ {formatNumber(reconciliationAudit?.varianceAmount || 0)} ETB Variance
                  </span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium">
              <span className="text-emerald-700 font-semibold">
                {formatNumber(kpis.totalPaidAmount || 0)} Paid &amp; Reconciled
              </span>
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5">Recognized revenue incl. arrears</p>
        </CardContent>
      </Card>

      {/* Net Revenue (Excl VAT) */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden relative group hover:shadow-md transition-shadow">
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Net Revenue (Excl. VAT)
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {isLoading ? "—" : `${formatNumber(kpis.totalNetRevenue)} ETB`}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Core operational billing revenues
          </p>
        </CardContent>
      </Card>

      {/* VAT Collected */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-amber-50/30 overflow-hidden relative group hover:shadow-md transition-shadow">
        <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total VAT (15%)
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-sm">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {isLoading ? "—" : `${formatNumber(kpis.totalVat)} ETB`}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Applicable tax collected for ERCA
          </p>
        </CardContent>
      </Card>

      {/* Total Audited Bills */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-blue-50/30 overflow-hidden relative group hover:shadow-md transition-shadow">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Audited Bills
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-sm">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {isLoading ? "—" : `${formatNumber(kpis.totalAuditedBills)}`}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {kpis.paidCount} paid &amp; reconciled · {kpis.totalAnomalies} flagged
          </p>
        </CardContent>
      </Card>

      {/* Audit Health */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-teal-50/30 overflow-hidden relative group hover:shadow-md transition-shadow">
        <div className={`absolute top-0 left-0 w-full h-1 ${isClean && isReconciled ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Audit Health
            </span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shadow-sm ${isClean && isReconciled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>
              {isClean && isReconciled ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isClean && isReconciled ? "default" : "destructive"}
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${isClean && isReconciled ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 text-white'}`}
            >
              {isClean && isReconciled ? "100% RECONCILED" : !isReconciled ? "VARIANCE FLAGGED" : `${kpis.totalAnomalies} ANOMALIES`}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            {isClean && isReconciled ? "No arithmetic or account mismatches" : "Action required on flagged items"}
          </p>
        </CardContent>
      </Card>

      {/* Total Arrears Carryover */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-rose-50/30 overflow-hidden relative group hover:shadow-md transition-shadow">
        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Arrears Carried
            </span>
            <div className="h-8 w-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-sm">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {isLoading ? "—" : `${formatNumber(kpis.totalOutstandingCarryover ?? 0)} ETB`}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Prior-period debt included in bills
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
