"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { subscribePermissionsSync } from "@/lib/permissions-sync";
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
  Building2,
  Lock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getGLSummaryReportAction,
  getGLAuditAnomaliesAction,
  getAvailableGLPeriodsAction,
  getAvailableGLYearsAction,
  getGLUserPermissionsAction,
  type GLSummaryRow,
  type GLComponentMatrixRow,
  type GLAllBranchMonthlyRow,
  type GLKPIs,
  type GLAnomalyItem,
} from "@/lib/gl-audit-actions";
import { getAllBranchesAction } from "@/lib/actions";
import { GLKPICards } from "@/components/reports/gl/GLKPICards";
import { GLSummaryTable } from "@/components/reports/gl/GLSummaryTable";
import { GLAllBranchMonthlyTable } from "@/components/reports/gl/GLAllBranchMonthlyTable";
import { GLComponentMatrixTable } from "@/components/reports/gl/GLComponentMatrixTable";
import { GLAnomalyInspector } from "@/components/reports/gl/GLAnomalyInspector";
import { GLBillDrillDownDrawer } from "@/components/reports/gl/GLBillDrillDownDrawer";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from "@/lib/xlsx";
import { getAvailableMonthYearOptions } from "@/lib/export-utils";

export default function GLReportsAuditPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [periodType, setPeriodType] = useState<"monthly" | "yearly">("monthly");
  const [latestMonth, setLatestMonth] = useState<string>("");
  const [dbMonths, setDbMonths] = useState<string[]>([]);
  const [isPeriodInitialized, setIsPeriodInitialized] = useState<boolean>(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [years, setYears] = useState<string[]>([]);
  const [selectedChargeGroup, setSelectedChargeGroup] = useState<string>("all");
  const [selectedGlCode, setSelectedGlCode] = useState<string>("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("Paid and Reconciled");
  const [activeTab, setActiveTab] = useState<string>("summary");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // ── Permission capabilities from server ───────────────────────────────────
  const [glPerms, setGlPerms] = useState<{
    canAccess: boolean;
    isAdmin: boolean;
    canViewSummary: boolean;
    canViewAllBranches: boolean;
    lockedBranchId: string | null;
    branchName?: string | null;
    canViewMonthly: boolean;
    canViewYearly: boolean;
    canExport: boolean;
    canViewMatrix: boolean;
    canViewAnomalies: boolean;
    canViewAnomalyTab: boolean;
    canDrillDown: boolean;
  }>({
    canAccess: false,
    isAdmin: false,
    canViewSummary: false,
    canViewAllBranches: false,
    lockedBranchId: null,
    branchName: null,
    canViewMonthly: false,
    canViewYearly: false,
    canExport: false,
    canViewMatrix: false,
    canViewAnomalies: false,
    canViewAnomalyTab: false,
    canDrillDown: false,
  });
  const [isPermsLoaded, setIsPermsLoaded] = useState<boolean>(false);

  // Data states
  const [kpis, setKpis] = useState<GLKPIs>({
    totalGrossBilled: 0,
    totalNetRevenue: 0,
    totalVat: 0,
    totalPaidAmount: 0,
    totalUnpaidAmount: 0,
    totalOutstandingCarryover: 0,
    paidCount: 0,
    unpaidCount: 0,
    totalAuditedBills: 0,
    totalCleanBills: 0,
    totalAnomalies: 0,
    glCodeBreakdown: {},
  });
  const [summaryRows, setSummaryRows] = useState<GLSummaryRow[]>([]);
  const [allBranchMonthlyRows, setAllBranchMonthlyRows] = useState<GLAllBranchMonthlyRow[]>([]);
  const [matrixRows, setMatrixRows] = useState<GLComponentMatrixRow[]>([]);
  const [anomalies, setAnomalies] = useState<GLAnomalyItem[]>([]);

  // Drawer state
  const [inspectRow, setInspectRow] = useState<GLSummaryRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Month-year options (combines generator with database distinct billing periods)
  const monthOptions = React.useMemo(() => {
    const baseOptions = getAvailableMonthYearOptions();
    const existingValues = new Set(baseOptions.map((o) => o.value));
    const extras = dbMonths
      .filter((m) => !existingValues.has(m) && m !== "all")
      .map((m) => {
        const [yr, mo] = m.split("-").map(Number);
        const d = new Date(yr, mo - 1, 1);
        const label = isNaN(d.getTime())
          ? m
          : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        return { value: m, label };
      });
    return [...baseOptions, ...extras];
  }, [dbMonths]);

  // Centralized permission evaluator for mount & live reactive updates
  const refreshGLCapabilities = useCallback(async () => {
    try {
      const permsRes = await getGLUserPermissionsAction();
      if (permsRes?.data) {
        const p = permsRes.data;
        setGlPerms(p);

        // Dynamic flipping of branch filter based on updated role permissions
        if (p.lockedBranchId) {
          setSelectedBranchId(p.lockedBranchId);
        } else if (!p.canViewAllBranches) {
          setSelectedBranchId((prev) => (prev === "all" ? "" : prev));
        }

        // Dynamically adjust activeTab based on available tabs
        const allowedTabs: string[] = [];
        if (p.canViewSummary) allowedTabs.push("summary");
        if (p.canViewAllBranches) allowedTabs.push("all-branch-monthly");
        if (p.canViewMatrix) allowedTabs.push("matrix");
        if (p.canViewAnomalyTab) allowedTabs.push("anomalies");

        setActiveTab((prev) => (allowedTabs.includes(prev) ? prev : (allowedTabs[0] || "summary")));

        // Adjust periodType if user lacks yearly
        if (p.canViewYearly && !p.canViewMonthly) {
          setPeriodType("yearly");
        } else if (!p.canViewYearly) {
          setPeriodType("monthly");
        }
      }
      setIsPermsLoaded(true);
    } catch (err) {
      console.error("Failed to refresh GL permissions:", err);
      setIsPermsLoaded(true);
    }
  }, []);

  // Fetch permissions + branches + periods on mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getGLUserPermissionsAction(),
      getAllBranchesAction(),
      getAvailableGLPeriodsAction(),
    ])
      .then(([permsRes, branchRes, periodRes]: [any, any, any]) => {
        if (!isMounted) return;
        if (permsRes?.data) {
          const p = permsRes.data;
          setGlPerms(p);
          if (p.lockedBranchId) {
            setSelectedBranchId(p.lockedBranchId);
          }
          const allowedTabs: string[] = [];
          if (p.canViewSummary) allowedTabs.push("summary");
          if (p.canViewAllBranches) allowedTabs.push("all-branch-monthly");
          if (p.canViewMatrix) allowedTabs.push("matrix");
          if (p.canViewAnomalyTab) allowedTabs.push("anomalies");
          setActiveTab((prev) => (allowedTabs.includes(prev) ? prev : (allowedTabs[0] || "summary")));

          if (p.canViewYearly && !p.canViewMonthly) {
            setPeriodType("yearly");
          } else if (!p.canViewYearly) {
            setPeriodType("monthly");
          }
        }
        setIsPermsLoaded(true);
        if (branchRes?.data) setBranches(branchRes.data);
        if (periodRes?.years) setYears(periodRes.years);
        if (periodRes?.availableMonths) setDbMonths(periodRes.availableMonths);
        if (periodRes?.latestMonth) {
          setLatestMonth(periodRes.latestMonth);
          setSelectedMonthYear(periodRes.latestMonth);
        } else {
          setSelectedMonthYear("all");
        }
        setIsPeriodInitialized(true);
      })
      .catch((err) => {
        console.error("Failed to load initial GL setup:", err);
        setIsPermsLoaded(true);
        setIsPeriodInitialized(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time listener: dynamic UI flips when role permissions are assigned / unassigned
  useEffect(() => {
    const handlePermissionsUpdated = () => {
      refreshGLCapabilities();
    };

    window.addEventListener("user-permissions-updated", handlePermissionsUpdated);
    window.addEventListener("storage", handlePermissionsUpdated);
    window.addEventListener("visibilitychange", handlePermissionsUpdated);
    window.addEventListener("focus", handlePermissionsUpdated);
    const unsubscribeSync = subscribePermissionsSync(handlePermissionsUpdated);

    return () => {
      window.removeEventListener("user-permissions-updated", handlePermissionsUpdated);
      window.removeEventListener("storage", handlePermissionsUpdated);
      window.removeEventListener("visibilitychange", handlePermissionsUpdated);
      window.removeEventListener("focus", handlePermissionsUpdated);
      unsubscribeSync();
    };
  }, [refreshGLCapabilities]);

  // Main data loader
  const loadGLData = useCallback(async () => {
    if (!isPeriodInitialized || !isPermsLoaded) return;
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
        glPerms.canViewAnomalyTab
          ? getGLAuditAnomaliesAction({
              branchId: selectedBranchId !== "all" ? selectedBranchId : undefined,
              periodType,
              monthYear: periodType === "monthly" && selectedMonthYear !== "all" ? selectedMonthYear : undefined,
              year: periodType === "yearly" && selectedYear !== "all" ? selectedYear : undefined,
              paymentStatus: selectedPaymentStatus !== "all" ? selectedPaymentStatus : undefined,
            })
          : Promise.resolve({ success: true, anomalies: [] }),
      ]);

      if (summaryRes.success && summaryRes.kpis) {
        setKpis(summaryRes.kpis);
        setSummaryRows(summaryRes.summaryRows || []);
        setAllBranchMonthlyRows(summaryRes.allBranchMonthlyRows || []);
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
  }, [
    isPeriodInitialized,
    isPermsLoaded,
    selectedBranchId,
    periodType,
    selectedMonthYear,
    selectedYear,
    selectedChargeGroup,
    selectedGlCode,
    selectedPaymentStatus,
    glPerms.canViewSummary,
    glPerms.canViewAllBranches,
    glPerms.canViewMatrix,
    glPerms.canViewAnomalyTab,
    glPerms.canViewMonthly,
    glPerms.canViewYearly,
    toast,
  ]);

  useEffect(() => {
    if (isPeriodInitialized && isPermsLoaded) {
      loadGLData();
    }
  }, [isPeriodInitialized, isPermsLoaded, loadGLData]);

  // Handle drill-down (only if permitted)
  const handleInspectRow = (row: GLSummaryRow) => {
    if (!glPerms.canDrillDown) {
      toast({
        title: "Access Restricted",
        description: "You do not have permission to drill down into individual bills.",
        variant: "destructive",
      });
      return;
    }
    setInspectRow(row);
    setIsDrawerOpen(true);
  };

  // Export XLSX
  const handleExportXLSX = () => {
    if (!glPerms.canExport) {
      toast({ title: "Access Restricted", description: "You do not have permission to export GL reports.", variant: "destructive" });
      return;
    }

    if (activeTab === "all-branch-monthly") {
      if (allBranchMonthlyRows.length === 0) {
        toast({ title: "No Data", description: "No records to export." });
        return;
      }
      setIsExporting(true);
      try {
        const exportSummary = allBranchMonthlyRows.map((r) => ({
          "COUNT":        r.count,
          "BRANCH":       r.branch,
          "GL_CODE":      r.glCode,
          "TOTAL_AMOUNT": r.totalAmount,
          "VAT_AMOUNT":   r.vatAmount,
          "WITH_OUT_VAT": r.withoutVat,
          "PERIOD":       r.period,
        }));
        const headers = ["COUNT", "BRANCH", "GL_CODE", "TOTAL_AMOUNT", "VAT_AMOUNT", "WITH_OUT_VAT", "PERIOD"];
        const periodLabel = periodType === 'yearly'
          ? (selectedYear !== 'all' ? `Year_${selectedYear}` : 'All_Years')
          : (selectedMonthYear !== 'all' ? selectedMonthYear : 'All_Months');
        const blob = arrayToXlsxBlob(exportSummary, headers, 'All Branch Monthly GL');
        const filename = `AAWSA_All_Branch_Monthly_GL_Report_${periodLabel}_${new Date().toISOString().split("T")[0]}.xlsx`;
        downloadFile(blob, filename);
        toast({ title: "Export Complete", description: `${exportSummary.length} All Branch Monthly GL rows downloaded.` });
      } catch (err: any) {
        toast({ title: "Export Error", description: err.message, variant: "destructive" });
      } finally {
        setIsExporting(false);
      }
      return;
    }

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
        "Current Bill (ETB)":   r.currentAmount ?? 0,
        "Arrears Carried (ETB)": r.arrearsAmount ?? 0,
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
    if (!glPerms.canExport) {
      toast({ title: "Access Restricted", description: "You do not have permission to export GL reports.", variant: "destructive" });
      return;
    }

    if (activeTab === "all-branch-monthly") {
      if (allBranchMonthlyRows.length === 0) return;
      try {
        const exportSummary = allBranchMonthlyRows.map((r) => ({
          "COUNT":        r.count,
          "BRANCH":       r.branch,
          "GL_CODE":      r.glCode,
          "TOTAL_AMOUNT": r.totalAmount,
          "VAT_AMOUNT":   r.vatAmount,
          "WITH_OUT_VAT": r.withoutVat,
          "PERIOD":       r.period,
        }));
        const periodLabel = periodType === 'yearly'
          ? (selectedYear !== 'all' ? `year_${selectedYear}` : 'all_years')
          : (selectedMonthYear !== 'all' ? selectedMonthYear : 'all_months');
        const blob = arrayToCsvBlob(exportSummary, ["COUNT", "BRANCH", "GL_CODE", "TOTAL_AMOUNT", "VAT_AMOUNT", "WITH_OUT_VAT", "PERIOD"]);
        downloadFile(blob, `all_branch_monthly_gl_report_${periodLabel}_${new Date().toISOString().split("T")[0]}.csv`);
        toast({ title: "CSV Downloaded", description: `${exportSummary.length} All Branch Monthly GL rows exported.` });
      } catch (err: any) {
        toast({ title: "Export Error", description: err.message, variant: "destructive" });
      }
      return;
    }

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
        "COUNT":           r.count       ?? 0,
        "CURRENT_BILL":    r.currentAmount ?? 0,
        "ARREARS_CARRIED": r.arrearsAmount ?? 0,
        "WITHOUT_VAT":     r.withoutVat  ?? 0,
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

  // Show clean spinner while verifying permissions to prevent any UI flashing
  if (!isPermsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold text-slate-500">Checking GL permissions...</p>
        </div>
      </div>
    );
  }

  // Reactive Access Control Gate: Flip UI if user lacks view permission
  if (isPermsLoaded && !glPerms.canAccess) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-12 px-4 no-print">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Access Restricted</h1>
            <p className="text-sm text-slate-500 font-medium">GL Financial &amp; Audit Report</p>
          </div>
        </div>
        <Card className="border-red-200/80 shadow-lg bg-gradient-to-br from-red-50/60 via-white to-white rounded-3xl overflow-hidden">
          <CardHeader className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-300 font-bold px-2.5 py-0.5">
                Permission Required
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">
              You do not have permission to view the General Ledger Financial &amp; Audit Report.
            </CardTitle>
            <CardDescription className="text-slate-600 mt-2 text-sm leading-relaxed">
              Access to this ledger module requires an assigned <strong>View GL Financial &amp; Audit Report</strong> permission, 
              or branch-specific view access granted by a system administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 sm:px-8 flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="rounded-xl border-slate-300 text-xs font-semibold h-9 px-4"
            >
              Go Back
            </Button>
            <Button
              onClick={() => router.push('/staff/dashboard')}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-9 px-4 shadow-sm"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-indigo-200 text-sm max-w-2xl leading-relaxed">
                Official General Ledger accounting summary, revenue reconciliation by branch and charge group, with bill-level audit drill-down and anomaly verification.
              </p>
              {periodType === "monthly" && selectedMonthYear === latestMonth && latestMonth && (
                <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40 text-[11px] font-bold px-2 py-0.5">
                  ● Defaulting to Latest Month ({latestMonth})
                </Badge>
              )}
            </div>
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
            {/* Print: available to everyone who can view the page */}
            <Button
              onClick={handlePrint}
              variant="ghost"
              size="sm"
              className="rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white hover:text-white text-xs font-semibold h-9 shadow-sm"
              title="Print or Save PDF report"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print PDF
            </Button>
            {/* CSV export — only if canExport */}
            {glPerms.canExport && (
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
            )}
            {/* XLSX export — only if canExport */}
            {glPerms.canExport && (
              <Button
                onClick={handleExportXLSX}
                size="sm"
                disabled={isExporting}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md font-bold text-xs h-9"
                title="Download full multi-sheet audit Excel workbook"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export XLSX
              </Button>
            )}
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

            {/* Monthly vs Yearly Period Toggle — strictly show only assigned buttons */}
            {(glPerms.canViewMonthly || glPerms.canViewYearly) && (
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/60 shadow-inner">
                {glPerms.canViewMonthly && (
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
                )}
                {/* Yearly toggle only shown if user has yearly permission */}
                {glPerms.canViewYearly && (
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
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Branch Filter — locked for branch-scoped users */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Branch</label>
              {glPerms.canViewAllBranches ? (
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
              ) : (
                <div className="h-9 px-3 rounded-xl border border-amber-200 bg-amber-50/70 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-amber-800 truncate">
                    {glPerms.branchName || "Your Branch Only"}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-white text-amber-700 border-amber-200 font-bold px-1.5 py-0 ml-auto">
                    Restricted
                  </Badge>
                </div>
              )}
            </div>

            {/* Period Filter (Monthly vs Yearly) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-600 block">
                  {periodType === "yearly" ? "Fiscal / Calendar Year" : "Billing Period (Month)"}
                </label>
                {periodType === "monthly" && latestMonth && (
                  <button
                    type="button"
                    onClick={() => setSelectedMonthYear(latestMonth)}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all flex items-center gap-1 ${
                      selectedMonthYear === latestMonth
                        ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                        : "text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                    }`}
                    title="Default to latest month data"
                  >
                    <span>Latest:</span>
                    <span className="font-mono">{latestMonth}</span>
                  </button>
                )}
              </div>
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
                <Select value={selectedMonthYear || "all"} onValueChange={setSelectedMonthYear}>
                  <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs">
                    <SelectValue placeholder="Select Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Available Periods (Consolidated)</SelectItem>
                    {monthOptions
                      .filter((opt) => opt.value !== "all")
                      .map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span>{opt.label}</span>
                            {opt.value === latestMonth && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 px-1 py-0 font-bold ml-2"
                              >
                                Latest
                              </Badge>
                            )}
                          </div>
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
              <div className="h-9 px-3 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-800">Paid and Reconciled</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-white text-emerald-700 border-emerald-200 font-bold px-1.5 py-0">
                  GL Recognized
                </Badge>
              </div>
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
            {/* Tab 1: GL Code Summary — gated by canViewSummary */}
            {glPerms.canViewSummary && (
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
            )}
            {/* All Branch Monthly GL tab — only accessible with view_all permission */}
            {glPerms.canViewAllBranches && (
              <TabsTrigger
                value="all-branch-monthly"
                className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"
              >
                <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                <span>All Branch Monthly GL</span>
                <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0 bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {allBranchMonthlyRows.length}
                </Badge>
              </TabsTrigger>
            )}
            {/* Component Breakdown Matrix tab — gated by canViewMatrix permission */}
            {glPerms.canViewMatrix && (
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
            )}
            {/* Anomaly Inspector tab — gated by canViewAnomalyTab (report:gl_audit_view_anomaly) */}
            {glPerms.canViewAnomalyTab && (
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
            )}
          </TabsList>

          <span className="text-xs text-slate-500 font-medium">
            💡 Click any GL summary row to view the contributing individual bills
          </span>
        </div>

        {/* Tab 1: GL Code Summary — gated by canViewSummary */}
        {glPerms.canViewSummary && (
          <TabsContent value="summary" className="space-y-4 pt-1">
            <GLSummaryTable
              rows={summaryRows}
              onInspectRow={handleInspectRow}
              isLoading={isLoading}
            />
          </TabsContent>
        )}

        {/* Tab 2: All Branch Monthly GL Report — gated by canViewAllBranches */}
        {glPerms.canViewAllBranches && (
          <TabsContent value="all-branch-monthly" className="space-y-4 pt-1">
            <GLAllBranchMonthlyTable
              rows={allBranchMonthlyRows}
              isLoading={isLoading}
              canExport={glPerms.canExport}
            />
          </TabsContent>
        )}

        {/* Tab 3: Component Breakdown Matrix — gated by canViewMatrix */}
        {glPerms.canViewMatrix && (
          <TabsContent value="matrix" className="space-y-4 pt-1">
            <GLComponentMatrixTable
              rows={matrixRows}
              isLoading={isLoading}
            />
          </TabsContent>
        )}

        {/* Tab 4: Audit & Anomaly Inspector — gated by canViewAnomalyTab */}
        {glPerms.canViewAnomalyTab && (
          <TabsContent value="anomalies" className="space-y-4 pt-1">
            <GLAnomalyInspector
              anomalies={anomalies}
              isLoading={isLoading}
              onRefresh={loadGLData}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Audit Drill-Down Drawer — only if canDrillDown ── */}
      {glPerms.canDrillDown && (
        <GLBillDrillDownDrawer
          selectedRow={inspectRow}
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        />
      )}
    </div>
  );
}
