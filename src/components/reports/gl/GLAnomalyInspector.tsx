"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNumber } from "@/lib/format";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import type { GLAnomalyItem } from "@/lib/gl-audit-actions";

interface GLAnomalyInspectorProps {
  anomalies: GLAnomalyItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function GLAnomalyInspector({
  anomalies,
  isLoading,
  onRefresh,
}: GLAnomalyInspectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");

  const countsByType = useMemo(() => {
    const map: Record<string, number> = {
      MATH_SUM_MISMATCH: 0,
      MISSING_DR_CR: 0,
      UNMAPPED_CHARGE_GROUP: 0,
      NEGATIVE_CHARGE: 0,
    };
    anomalies.forEach((a) => {
      if (map[a.anomalyType] !== undefined) map[a.anomalyType]++;
    });
    return map;
  }, [anomalies]);

  const filtered = useMemo(() => {
    return anomalies.filter((item) => {
      if (selectedType !== "all" && item.anomalyType !== selectedType) return false;
      if (selectedSeverity !== "all" && item.severity !== selectedSeverity) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          item.billKey.toLowerCase().includes(q) ||
          item.customerKey.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.branchName.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [anomalies, selectedType, selectedSeverity, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Overview Cards by Anomaly Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Arithmetic Mismatches */}
        <div
          onClick={() => setSelectedType(selectedType === "MATH_SUM_MISMATCH" ? "all" : "MATH_SUM_MISMATCH")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-sm ${selectedType === "MATH_SUM_MISMATCH" ? "border-red-500 bg-red-50/50 ring-2 ring-red-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Sum Mismatches</span>
            <span className="h-6 w-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
              {countsByType.MATH_SUM_MISMATCH}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Components don't equal monthly bill
          </p>
        </div>

        {/* Missing DR / CR Accounts */}
        <div
          onClick={() => setSelectedType(selectedType === "MISSING_DR_CR" ? "all" : "MISSING_DR_CR")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-sm ${selectedType === "MISSING_DR_CR" ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Missing DR / CR</span>
            <span className="h-6 w-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
              {countsByType.MISSING_DR_CR}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Empty debit or credit GL accounts
          </p>
        </div>

        {/* Unmapped Charge Group */}
        <div
          onClick={() => setSelectedType(selectedType === "UNMAPPED_CHARGE_GROUP" ? "all" : "UNMAPPED_CHARGE_GROUP")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-sm ${selectedType === "UNMAPPED_CHARGE_GROUP" ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Unmapped Category</span>
            <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
              {countsByType.UNMAPPED_CHARGE_GROUP}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Charge group was empty or unknown
          </p>
        </div>

        {/* Negative Charges */}
        <div
          onClick={() => setSelectedType(selectedType === "NEGATIVE_CHARGE" ? "all" : "NEGATIVE_CHARGE")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-sm ${selectedType === "NEGATIVE_CHARGE" ? "border-purple-500 bg-purple-50/50 ring-2 ring-purple-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Negative Balances</span>
            <span className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
              {countsByType.NEGATIVE_CHARGE}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Negative charge balances detected
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search anomaly by bill key, customer name, issue..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 rounded-xl border-slate-200 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={selectedSeverity === "all" ? "default" : "outline"}
            onClick={() => setSelectedSeverity("all")}
            className="h-8 text-xs rounded-lg"
          >
            All Severities
          </Button>
          <Button
            size="sm"
            variant={selectedSeverity === "High" ? "destructive" : "outline"}
            onClick={() => setSelectedSeverity(selectedSeverity === "High" ? "all" : "High")}
            className="h-8 text-xs rounded-lg"
          >
            High Severity
          </Button>
          <Button
            size="sm"
            variant={selectedSeverity === "Warning" ? "secondary" : "outline"}
            onClick={() => setSelectedSeverity(selectedSeverity === "Warning" ? "all" : "Warning")}
            className="h-8 text-xs rounded-lg"
          >
            Warnings
          </Button>
        </div>
      </div>

      {/* Anomaly List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">
            Scanning General Ledger for discrepancies...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 bg-white">
            <ShieldCheck className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">
              Zero GL Discrepancies Detected!
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              All line item charges balance to the monthly bill, chart of accounts are populated, and charge groups are valid.
            </p>
          </div>
        ) : (
          filtered.map((item, index) => (
            <div
              key={`${item.billId}-${index}`}
              className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div
                className={`absolute top-0 left-0 w-1.5 h-full ${item.severity === "High" ? "bg-red-500" : "bg-amber-400"}`}
              />

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3 pl-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={item.severity === "High" ? "destructive" : "secondary"}
                      className={`text-[10px] font-bold uppercase tracking-wider ${item.severity === "High" ? "bg-red-600 text-white" : "bg-amber-100 text-amber-800 border-amber-200"}`}
                    >
                      {item.severity} SEVERITY
                    </Badge>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {item.billKey}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-600 font-medium">
                      {item.customerName} ({item.customerKey})
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-mono font-medium text-slate-500">
                      {item.branchName} ({item.branchCode})
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-1.5">
                    {item.description}
                  </h4>
                </div>

                {item.difference > 0 && (
                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Variance Amount
                    </span>
                    <span className="font-mono font-black text-sm text-red-600">
                      {formatNumber(item.difference)} ETB
                    </span>
                  </div>
                )}
              </div>

              {/* Expected vs Actual */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/70 rounded-xl p-3 mb-3 border border-slate-100 text-xs pl-4">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-0.5">
                    Expected Accounting Values
                  </span>
                  <span className="font-medium text-slate-700">
                    {item.expected}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-0.5">
                    Actual Value Recorded on Bill
                  </span>
                  <span className="font-medium text-red-700 font-mono">
                    {item.actual}
                  </span>
                </div>
              </div>

              {/* Remediation Advice */}
              <div className="flex items-center justify-between gap-3 text-xs pl-2">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span className="font-medium">Recommended Action:</span>
                  <span className="text-slate-500">{item.recommendation}</span>
                </div>

                <a
                  href={`/admin/reports/corrected-bills`}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold shrink-0"
                >
                  <span>Resolve in Corrections</span>
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
