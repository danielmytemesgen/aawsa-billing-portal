'use client';

import React, { useState, useEffect } from 'react';
import type { SupportMonthlyReportData } from '../types';
import { getSupportReportAction } from '@/lib/support-actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Star, 
  Building2, 
  TrendingUp,
  RefreshCw,
  Award
} from 'lucide-react';

interface SupportReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string;
}

export function SupportReportDialog({ isOpen, onClose, branchId }: SupportReportDialogProps) {
  const currentMonthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [reportData, setReportData] = useState<SupportMonthlyReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Generate last 6 months for the selector
  const monthOptions = React.useMemo(() => {
    const options: Array<{ label: string; value: string }> = [
      { label: 'All Time (Aggregated)', value: 'all' }
    ];
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${year}-${month}`;
      const monthName = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      options.push({ label: monthName, value: val });
      d.setMonth(d.getMonth() - 1);
    }
    return options;
  }, []);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await getSupportReportAction(selectedMonth, branchId);
      if (res.data) {
        setReportData(res.data);
      }
    } catch (e) {
      console.error('Failed to load support report:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReport();
    }
  }, [isOpen, selectedMonth, branchId]);

  // Export to Excel / CSV
  const handleExportCsv = () => {
    if (!reportData) return;

    const lines: string[] = [];

    // Title & Metadata
    lines.push(`"ADDIS ABABA WATER AND SEWERAGE AUTHORITY (AAWSA)"`);
    lines.push(`"MONTHLY BRANCH SLA & CSAT PERFORMANCE REPORT"`);
    lines.push(`"Reporting Period: ${selectedMonth === 'all' ? 'All Time' : selectedMonth}"`);
    lines.push(`"Generated At: ${new Date(reportData.generatedAt).toLocaleString()}"`);
    lines.push(`""`);

    // Executive Summary
    lines.push(`"EXECUTIVE KPI SUMMARY"`);
    lines.push(`"Total Tickets Opened","Total Resolved","Resolution Rate (%)","SLA Breach Rate (%)","Average Resolution Time (Hours)","Average CSAT Score (1-5)","Total CSAT Reviews"`);
    lines.push(`"${reportData.totalTickets}","${reportData.totalResolved}","${reportData.overallResolutionRate}%","${reportData.overallSlaBreachPercent}%","${reportData.overallAvgResolutionHours}h","${reportData.overallAvgCsat} / 5.0","${reportData.totalFeedbackCount}"`);
    lines.push(`""`);

    // Branch Breakdown
    lines.push(`"BRANCH OFFICE PERFORMANCE BREAKDOWN"`);
    lines.push(`"Branch Name","Total Tickets","Open","In Progress","Resolved","SLA Breached Count","SLA Breach Rate (%)","Avg Resolution Time (Hours)","Avg CSAT Rating"`);

    for (const b of reportData.branchBreakdown) {
      lines.push(
        `"${b.branchName}","${b.totalTickets}","${b.openTickets}","${b.inProgressTickets}","${b.resolvedTickets}","${b.slaBreachedCount}","${b.slaBreachPercent}%","${b.avgResolutionHours}","${b.avgCsatRating}"`
      );
    }
    lines.push(`""`);

    // CSAT Rating Distribution
    lines.push(`"CSAT SATISFACTION RATING DISTRIBUTION"`);
    lines.push(`"Rating Stars","Response Count","Percentage"`);
    for (const c of reportData.csatDistribution) {
      lines.push(`"${c.rating} Stars","${c.count}","${c.percentage}%"`);
    }

    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AAWSA_Support_SLA_CSAT_Report_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header Actions Bar (hidden in print) */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-700" />
            <div>
              <DialogTitle className="text-base font-bold text-gray-900">
                Monthly Branch SLA & CSAT Report
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Governance analytics, resolution times, SLA breach rates, and citizen satisfaction ratings.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[190px] h-8 text-xs bg-white">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!reportData || isLoading}
              className="h-8 gap-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
            >
              <Download className="h-3.5 w-3.5 text-emerald-700" />
              <span>Export Excel / CSV</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!reportData || isLoading}
              className="h-8 gap-1.5 text-xs font-semibold bg-white"
            >
              <Printer className="h-3.5 w-3.5 text-gray-600" />
              <span>Print / PDF</span>
            </Button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-6 space-y-6 bg-white print:p-8">
          {/* Formal AAWSA Letterhead */}
          <div className="border-b-2 border-blue-900 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-lg shadow-sm">
                💧
              </div>
              <div>
                <h1 className="text-lg font-black text-blue-950 uppercase tracking-tight">
                  Addis Ababa Water and Sewerage Authority
                </h1>
                <p className="text-xs text-gray-600 font-medium">
                  Customer Experience, Field Operations & Support SLA Governance Report
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-gray-500">
              <div className="font-semibold text-gray-900">
                Period: {selectedMonth === 'all' ? 'All Records' : selectedMonth}
              </div>
              <div>Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
            </div>
          </div>

          {isLoading || !reportData ? (
            <div className="space-y-4 py-8">
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <>
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100">
                  <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Total Tickets</div>
                  <div className="text-2xl font-black text-blue-950 mt-1">{reportData.totalTickets}</div>
                  <div className="text-[11px] text-blue-800 mt-0.5">
                    {reportData.totalResolved} Resolved ({reportData.overallResolutionRate}%)
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-100">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Avg Resolution Time</div>
                  <div className="text-2xl font-black text-emerald-950 mt-1">{reportData.overallAvgResolutionHours}h</div>
                  <div className="text-[11px] text-emerald-800 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Mean resolution duration
                  </div>
                </div>

                <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-100">
                  <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">SLA Breach Rate</div>
                  <div className="text-2xl font-black text-rose-950 mt-1">{reportData.overallSlaBreachPercent}%</div>
                  <div className="text-[11px] text-rose-800 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Overdue beyond SLA limit
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-100">
                  <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Citizen CSAT Rating</div>
                  <div className="text-2xl font-black text-amber-950 mt-1 flex items-center gap-1">
                    {reportData.overallAvgCsat}
                    <Star className="h-5 w-5 fill-amber-500 text-amber-500 inline" />
                  </div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    Based on {reportData.totalFeedbackCount} surveys
                  </div>
                </div>
              </div>

              {/* Branch SLA Performance Table */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Branch Office SLA Compliance & Resolution Rates
                </h3>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-700">
                        <th className="p-2.5">Branch Office</th>
                        <th className="p-2.5 text-center">Total</th>
                        <th className="p-2.5 text-center">Open</th>
                        <th className="p-2.5 text-center">In Progress</th>
                        <th className="p-2.5 text-center">Resolved</th>
                        <th className="p-2.5 text-center">SLA Breaches</th>
                        <th className="p-2.5 text-center">SLA Breach %</th>
                        <th className="p-2.5 text-center">Avg Resolution</th>
                        <th className="p-2.5 text-center">Avg CSAT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.branchBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-6 text-center text-gray-400">
                            No ticket data recorded for this reporting period.
                          </td>
                        </tr>
                      ) : (
                        reportData.branchBreakdown.map((b, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30">
                            <td className="p-2.5 font-semibold text-gray-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                              {b.branchName}
                            </td>
                            <td className="p-2.5 text-center font-bold text-gray-900">{b.totalTickets}</td>
                            <td className="p-2.5 text-center text-blue-700">{b.openTickets}</td>
                            <td className="p-2.5 text-center text-amber-700">{b.inProgressTickets}</td>
                            <td className="p-2.5 text-center font-medium text-emerald-700">{b.resolvedTickets}</td>
                            <td className="p-2.5 text-center text-rose-700 font-medium">{b.slaBreachedCount}</td>
                            <td className="p-2.5 text-center">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  b.slaBreachPercent > 25
                                    ? 'bg-red-50 text-red-700 border-red-300 font-bold'
                                    : b.slaBreachPercent > 10
                                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                                    : 'bg-green-50 text-green-700 border-green-300'
                                }`}
                              >
                                {b.slaBreachPercent}%
                              </Badge>
                            </td>
                            <td className="p-2.5 text-center font-mono text-gray-700">{b.avgResolutionHours}h</td>
                            <td className="p-2.5 text-center">
                              {b.avgCsatRating > 0 ? (
                                <span className="inline-flex items-center gap-0.5 font-bold text-amber-700">
                                  {b.avgCsatRating}
                                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: CSAT Rating Distribution */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-500" />
                  Citizen Satisfaction (CSAT) Distribution
                </h3>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {reportData.csatDistribution.map((item) => (
                    <div key={item.rating} className="bg-white p-3 rounded-lg border border-gray-100 shadow-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-gray-800 flex items-center gap-0.5">
                          {item.rating} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">
                          {item.percentage}%
                        </Badge>
                      </div>
                      <div className="text-base font-black text-gray-900">
                        {item.count} <span className="text-[10px] font-normal text-gray-500">ratings</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-amber-400 h-1.5 rounded-full"
                          style={{ width: `${Math.max(item.percentage, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formal Footer for PDF / Print */}
              <div className="pt-6 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
                <div>
                  AAWSA Customer Support Bureau • Internal Governance & Performance Audit
                </div>
                <div>
                  Official Copy • Page 1 of 1
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
