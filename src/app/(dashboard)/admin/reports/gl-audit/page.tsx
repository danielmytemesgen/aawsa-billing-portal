"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Scale,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  FileText,
  BarChart3,
  Layers,
  Calendar,
  CalendarDays,
} from "lucide-react";
import {
  getGLSummaryReportAction,
  getGLAuditAnomaliesAction,
  getAvailableGLYearsAction,
  type GLSummaryRow,
  type GLComponentMatrixRow,
  type GLKPIs,
  type GLAnomalyItem,
} from "@/lib/gl-audit-actions";
import { getAllBranchesAction } from "@/lib/actions";
import { GLKPICards } from "@/components/reports/gl/GLKPICards";
import { GLSummaryTable } from "@/components/reports/gl/GLSummaryTable";
import { GLComponentMatrixTable } from "@/components/reports/gl/GLComponentMatrixTable";
import { GLAnomalyInspector } from "@/components/reports/gl/GLAnomalyInspector";
import { GLBillDrillDownDrawer } from "@/components/reports/gl/GLBillDrillDownDrawer";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from "@/lib/xlsx";
import { getAvailableMonthYearOptions } from "@/lib/export-utils";

export default function GLReportsAuditPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [periodType, setPeriodType] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [years, setYears] = useState<string[]>([]);
  const [selectedChargeGroup, setSelectedChargeGroup] = useState<string>("all");
  const [selectedGlCode, setSelectedGlCode] = useState<string>("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("summary");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Data states
  const [kpis, setKpis] = useState<GLKPIs>({
    totalGrossBilled: 0,
    totalNetRevenue: 0,
    totalVat: 0,
    totalPaidAmount: 0,
    totalUnpaidAmount: 0,
    paidCount: 0,
    unpaidCount: 0,
    totalAuditedBills: 0,
    totalCleanBills: 0,
    totalAnomalies: 0,
    glCodeBreakdown: {},
  });
  const [summaryRows, setSummaryRows] = useState<GLSummaryRow[]>([]);
  const [matrixRows, setMatrixRows] = useState<GLComponentMatrixRow[]>([]);
  const [anomalies, setAnomalies] = useState<GLAnomalyItem[]>([]);

  // Drawer state
  const [inspectRow, setInspectRow] = useState<GLSummaryRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Month-year options
  const monthOptions = React.useMemo(() => {
    return getAvailableMonthYearOptions();
  }, []);

  // Fetch branches and available years on mount
  useEffect(() => {
    getAllBranchesAction()
      .then((res: any) => {
        if (res?.data) setBranches(res.data);
      })
      .catch((err) => console.error("Failed to load branches:", err));

    getAvailableGLYearsAction()
      .then((res: any) => {
        if (res?.years) setYears(res.years);
      })
      .catch((err) => console.error("Failed to load available GL years:", err));
  }, []);

  // Main data loader
  const loadGLData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [summaryRes, anomaliesRes] = await Promise.all([
        getGLSummaryReportAction({
          branchId: selectedBranchId !== "all" ? selectedBranchId : undefined,
          periodType,
          monthYear: periodType === "monthly" && selectedMonthYear !== "all" ? selectedMonthYear : undefined,
          year: periodType === "yearly" && selectedYear !== "all" ? selectedYear : undefined,
          chargeGroup: selectedChargeGroup !== "all" ? selectedChargeGroup : undefined,
          glCode: selectedGlCode !== "all" ? selectedGlCode : undefined,
          paymentStatus: selectedPaymentStatus !== "all" ? selectedPaymentStatus : undefined,
        }),
        getGLAuditAnomaliesAction({
          branchId: selectedBranchId !== "all" ? selectedBranchId : undefined,
          periodType,
          monthYear: periodType === "monthly" && selectedMonthYear !== "all" ? selectedMonthYear : undefined,
          year: periodType === "yearly" && selectedYear !== "all" ? selectedYear : undefined,
          paymentStatus: selectedPaymentStatus !== "all" ? selectedPaymentStatus : undefined,
        }),
      ]);

      if (summaryRes.success && summaryRes.kpis && summaryRes.summaryRows) {
        setKpis(summaryRes.kpis);
        setSummaryRows(summaryRes.summaryRows);
        setMatrixRows(summaryRes.componentMatrixRows || []);
      } else {
        toast({
          title: "GL Data Notice",
          description: summaryRes.error || "No GL records found for this period.",
          variant: "destructive",
        });
      }

      if (anomaliesRes.success && anomaliesRes.anomalies) {
        setAnomalies(anomaliesRes.anomalies);
      }
    } catch (error: any) {
      console.error("Error loading GL report:", error);
      toast({
        title: "Load Failed",
        description: error.message || "Failed to load General Ledger data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, periodType, selectedMonthYear, selectedYear, selectedChargeGroup, selectedGlCode, selectedPaymentStatus, toast]);

  useEffect(() => {
    loadGLData();
  }, [loadGLData]);

  // Handle drill-down
  const handleInspectRow = (row: GLSummaryRow) => {
    setInspectRow(row);
    setIsDrawerOpen(true);
  };

  // Export XLSX
  const handleExportXLSX = () => {
    if (summaryRows.length === 0) {
      toast({ title: "No Data", description: "No records to export." });
      return;
    }
    setIsExporting(true);
    try {
      const exportSummary = summaryRows.map((r) => ({
        // Use rawPeriod (YYYY-MM) to prevent Excel from auto-parsing "26-Aug" as a date
        "Period":               String(r.rawPeriod  || r.period  || ""),
        "Branch Code":          String(r.branchCode || r.branch  || ""),
        "Branch Name":          String(r.branchName || ""),
        "Charge Group":         String(r.chargeGroup || ""),
        "Payment Status":       String(r.paymentStatus || ""),
        "GL Code":              String(r.glCode      || ""),
        "GL Description":       String(r.glName      || ""),
        "Bills Count":          r.count      ?? 0,
        "Net Amount (Excl VAT)": r.withoutVat ?? 0,
        "VAT Amount":           r.vatAmount  ?? 0,
        "Total Billed Amount":  r.totalAmount ?? 0,
        "Audit Status":         String(r.auditStatus || "Clean"),
        "Flagged Count":        r.anomalyCount ?? 0,
        "Clean Count":          r.cleanCount   ?? 0,
      }));

      const headers = Object.keys(exportSummary[0]);
      const sheetName = periodType === 'yearly' ? 'GL Yearly Summary' : 'GL Summary';
      const periodLabel = periodType === 'yearly'
        ? (selectedYear !== 'all' ? `Year_${selectedYear}` : 'All_Years')
        : (selectedMonthYear !== 'all' ? selectedMonthYear : 'All_Months');
      const blob = arrayToXlsxBlob(exportSummary, headers, sheetName);
      const filename = `AAWSA_GL_${periodType === 'yearly' ? 'Yearly' : 'Monthly'}_Report_${periodLabel}_${new Date().toISOString().split("T")[0]}.xlsx`;
      downloadFile(blob, filename);
      toast({ title: "Export Complete", description: `${exportSummary.length} ${periodType === 'yearly' ? 'Yearly' : 'Monthly'} GL summary rows downloaded.` });
    } catch (err: any) {
      toast({ title: "Export Error", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (summaryRows.length === 0) return;
    try {
      const exportSummary = summaryRows.map((r) => ({
        "PERIOD":        String(r.rawPeriod   || r.period  || ""),
        "BRANCH_CODE":   String(r.branchCode  || r.branch  || ""),
        "BRANCH_NAME":   String(r.branchName  || ""),
        "CHARGE_GROUP":  String(r.chargeGroup || ""),
        "PAYMENT_STATUS": String(r.paymentStatus || ""),
        "GL_CODE":       String(r.glCode      || ""),
        "GL_DESC":       String(r.glName      || ""),
        "COUNT":         r.count       ?? 0,
        "WITHOUT_VAT":   r.withoutVat  ?? 0,
        "VAT_AMOUNT":    r.vatAmount   ?? 0,
        "TOTAL_AMOUNT":  r.totalAmount ?? 0,
        "AUDIT_STATUS":  String(r.auditStatus || "Clean"),
        "FLAGGED":       r.anomalyCount ?? 0,
        "CLEAN":         r.cleanCount   ?? 0,
      }));
      const periodLabel = periodType === 'yearly'
        ? (selectedYear !== 'all' ? `year_${selectedYear}` : 'all_years')
        : (selectedMonthYear !== 'all' ? selectedMonthYear : 'all_months');
      const blob = arrayToCsvBlob(exportSummary, Object.keys(exportSummary[0]));
      downloadFile(blob, `gl_${periodType}_ledger_export_${periodLabel}_${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: "CSV Downloaded", description: `${exportSummary.length} GL rows exported.` });
    } catch (err: any) {
      toast({ title: "Export Error", description: err.message, variant: "destructive" });
    }
  };

  // Print / Save PDF
  const handlePrint = () => {
    const prevTitle = document.title;
    const periodLabel = periodType === 'yearly' ? (selectedYear !== 'all' ? `FY_${selectedYear}` : 'All_Years') : selectedMonthYear;
    document.title = `AAWSA_GL_${periodType === 'yearly' ? 'Yearly' : 'Monthly'}_Report_${periodLabel}`;
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1000);
  };

  return (
    <div className="space-y-6 pb-16 min-h-screen">
      {/* Print Stylesheet Overrides */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 10mm 10mm 10mm !important;
              }
              body, html {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                background: #ffffff !important;
                color: #0f172a !important;
                font-size: 9.5pt !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              header, nav, aside, footer, .no-print, [class*="no-print"] {
                display: none !important;
              }
              div[class*="sm:ml-"],
              div[class*="ml-"],
              div[data-sidebar="inset"],
              main,
              main > div {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
              }
              table {
                page-break-inside: avoid !important;
                width: 100% !important;
              }
            }
          `,
        }}
      />

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 p-8 text-white shadow-xl no-print">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
                <Scale className="h-5 w-5 text-indigo-300" />
              </div>
              <Badge variant="outline" className="text-xs border-indigo-300/40 text-indigo-200 font-semibold px-2.5 py-0.5">
                Financial Accounting &amp; Ledger Audit
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              GL Financial &amp; Audit Report
            </h1>
            <p className="mt-2 text-indigo-200 text-sm max-w-2xl leading-relaxed">
              Official General Ledger accounting summary, revenue reconciliation by branch and charge group, with bill-level audit drill-down and anomaly verification.
            </p>
          </div>

          {/* Action Button Bar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              onClick={loadGLData}
              variant="ghost"
              size="sm"
              disabled={isLoading}
              className="rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white hover:text-white text-xs font-semibold h-9 shadow-sm"
              title="Refresh ledger data"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              onClick={handlePrint}
              variant="ghost"
              size="sm"
              className="rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white hover:text-white text-xs font-semibold h-9 shadow-sm"
              title="Print or Save PDF report"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print PDF
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="ghost"
              size="sm"
              disabled={isExporting}
              className="rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white hover:text-white text-xs font-semibold h-9 shadow-sm"
              title="Export flat ledger CSV for ERP"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" /> CSV
            </Button>
            <Button
              onClick={handleExportXLSX}
              size="sm"
              disabled={isExporting}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md font-bold text-xs h-9"
              title="Download full multi-sheet audit Excel workbook"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export XLSX
            </Button>
          </div>
        </div>
      </div>

      {/* ── Print-Only Header ── */}
      <div className="hidden print:block pb-4 mb-6 border-b-2 border-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-600">
              Addis Ababa Water and Sewerage Authority (AAWSA)
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">
              General Ledger (GL) {periodType === "yearly" ? "Yearly Annual" : "Monthly"} Financial &amp; Audit Report
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Type: {periodType === "yearly" ? "Annual Consolidated" : "Monthly Breakdown"} · Period: {periodType === "yearly" ? (selectedYear !== "all" ? `FY ${selectedYear}` : "All Fiscal Years") : (selectedMonthYear !== "all" ? selectedMonthYear : "All Active Periods")} · Branch: {selectedBranchId !== "all" ? (branches.find(b => b.id === selectedBranchId)?.name || selectedBranchId) : "All Branches"}
            </p>
          </div>
          <div className="text-right text-xs font-mono text-slate-500">
            <div>Doc Ref: AAWSA-GL-{periodType === "yearly" ? "ANNUAL" : "MONTHLY"}</div>
            <div>Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
            <div className="font-bold text-slate-800">Confidential Financial Report</div>
          </div>
        </div>
      </div>

      {/* ── Filter Controls Card ── */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white no-print">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" />
              <span>Audit &amp; Ledger Filters</span>
            </div>

            {/* Monthly vs Yearly Period Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/60 shadow-inner">
              <button
                type="button"
                onClick={() => setPeriodType("monthly")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periodType === "monthly"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Monthly Breakdown</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriodType("yearly")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periodType === "yearly"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Yearly / Annual Report</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Branch Filter */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Branch</label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches (System-Wide)</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period Filter (Monthly vs Yearly) */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                {periodType === "yearly" ? "Fiscal / Calendar Year" : "Billing Period (Month)"}
              </label>
              {periodType === "yearly" ? (
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-medium">
                    <SelectValue placeholder="All Fiscal Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fiscal Years (Consolidated)</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        FY {y} (Full Year Annual)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedMonthYear} onValueChange={setSelectedMonthYear}>
                  <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs">
                    <SelectValue placeholder="All Periods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Available Periods</SelectItem>
                    {monthOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Charge Group Filter */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Charge Group</label>
              <Select value={selectedChargeGroup} onValueChange={setSelectedChargeGroup}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs">
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Charge Groups</SelectItem>
                  <SelectItem value="Domestic">Domestic</SelectItem>
                  <SelectItem value="Non-domestic">Non-domestic (Commercial / Gov)</SelectItem>
                  <SelectItem value="Borehole">Borehole</SelectItem>
                  <SelectItem value="Public Fountain">Public Fountain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Payment Status</label>
              <Select value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses (Consolidated)</SelectItem>
                  <SelectItem value="Paid and Reconciled">Paid and Reconciled</SelectItem>
                  <SelectItem value="Unpaid">Unpaid Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* GL Code Filter */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Specific GL Code</label>
              <Select value={selectedGlCode} onValueChange={setSelectedGlCode}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-mono">
                  <SelectValue placeholder="All GL Codes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All GL Codes</SelectItem>
                  <SelectItem value="WDGL">WDGL (Water Domestic)</SelectItem>
                  <SelectItem value="WNDGL">WNDGL (Water Non-Domestic)</SelectItem>
                  <SelectItem value="WBORGL">WBORGL (Water Borehole)</SelectItem>
                  <SelectItem value="WPFNTGL">WPFNTGL (Public Fountain)</SelectItem>
                  <SelectItem value="SEWERGL">SEWERGL (Sewerage)</SelectItem>
                  <SelectItem value="SNTGL">SNTGL (Sanitation)</SelectItem>
                  <SelectItem value="MTRRNTGL">MTRRNTGL (Meter Rent)</SelectItem>
                  <SelectItem value="MNTGL">MNTGL (Maintenance)</SelectItem>
                  <SelectItem value="FIREGL">FIREGL (Fire / Penalty)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Financial KPI Cards ── */}
      <GLKPICards kpis={kpis} isLoading={isLoading} />

      {/* ── Multi-Tab Interactive Workspace ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2 no-print">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger
              value="summary"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>GL Code Summary</span>
              <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">
                {summaryRows.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="matrix"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Component Breakdown Matrix</span>
              <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">
                {matrixRows.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="anomalies"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"
            >
              {anomalies.length === 0 ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
              )}
              <span>Audit &amp; Anomaly Inspector</span>
              <Badge
                variant={anomalies.length > 0 ? "destructive" : "secondary"}
                className="text-[10px] ml-1 px-1.5 py-0"
              >
                {anomalies.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <span className="text-xs text-slate-500 font-medium">
            💡 Click any GL summary row to view the contributing individual bills
          </span>
        </div>

        {/* Tab 1: GL Code Summary */}
        <TabsContent value="summary" className="space-y-4 pt-1">
          <GLSummaryTable
            rows={summaryRows}
            onInspectRow={handleInspectRow}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 2: Component Breakdown Matrix */}
        <TabsContent value="matrix" className="space-y-4 pt-1">
          <GLComponentMatrixTable
            rows={matrixRows}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 3: Audit & Anomaly Inspector */}
        <TabsContent value="anomalies" className="space-y-4 pt-1">
          <GLAnomalyInspector
            anomalies={anomalies}
            isLoading={isLoading}
            onRefresh={loadGLData}
          />
        </TabsContent>
      </Tabs>

      {/* ── Audit Drill-Down Drawer ── */}
      <GLBillDrillDownDrawer
        selectedRow={inspectRow}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
