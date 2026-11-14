
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowRight,
  AlertCircle,
  PieChart as PieChartIcon,
  Users,
  Gauge,
  BarChart as BarChartIcon,
  Table as TableIcon,
  FileText,
  TrendingUp,
  Clock,
  Bell,
  DatabaseZap,
  UserPlus,
  Wifi,
  WifiOff,
  RefreshCw,
  Target,
  CheckCircle2,
  XCircle,
  Activity,
  Download,
  FileSpreadsheet,
  ImageIcon,
  ChevronDown,
} from 'lucide-react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { arrayToCsvBlob, arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import {
  Tooltip,
  Legend,
  PieChart as PieChartRecharts,
  Pie,
  Cell,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  LineChart,
  Line,
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDashboardMetricsAction } from "@/lib/actions";
import { format } from 'date-fns';
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDataRefresh } from "@/lib/data-refresh-context";
import { getGreeting, getGreetingEmoji, getEthiopianDateString } from "@/lib/date-clock-utils";
import { checkActualConnectivity } from "@/lib/offline-db";

const chartConfig = {
  paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  unpaid: { label: "Unpaid", color: "hsl(var(--chart-3))" },
  waterUsage: { label: "Water Usage (m³)", color: "hsl(var(--chart-1))" },
  billed: { label: "Billed Amount", color: "hsl(var(--chart-2))" },
  collected: { label: "Collected Amount", color: "hsl(var(--chart-1))" },
} satisfies import("@/components/ui/chart").ChartConfig;

export default function HeadOfficeDashboardPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  const { hasPermission } = usePermissions();
  const { currentUser } = useCurrentUser();
  const { isRefreshing, refresh: triggerRefresh } = useDataRefresh();
  const router = useRouter();

  const [liveTime, setLiveTime] = React.useState<string>('');
  const [liveDate, setLiveDate] = React.useState<string>('');
  const [liveEthiopianDate, setLiveEthiopianDate] = React.useState<string>('');
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [isSyncing, setIsSyncing] = React.useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = React.useState<string>('');
  const [localLastUpdated, setLocalLastUpdated] = React.useState<string>('');

  // State for dynamic data
  const [selectedMonth, setSelectedMonth] = React.useState<string>(format(new Date(), 'yyyy-MM'));
  const [dynamicTotalBills, setDynamicTotalBills] = React.useState(0);
  const [dynamicPaidBills, setDynamicPaidBills] = React.useState(0);
  const [dynamicUnpaidBills, setDynamicUnpaidBills] = React.useState(0);
  const [billsPaymentStatusData, setBillsPaymentStatusData] = React.useState<{ name: string; value: number; fill: string; }[]>([]);

  const [dynamicTotalCustomerCount, setDynamicTotalCustomerCount] = React.useState(0);
  const [dynamicTotalBulkMeterCount, setDynamicTotalBulkMeterCount] = React.useState(0);

  const [dynamicBranchPerformanceData, setDynamicBranchPerformanceData] = React.useState<{
    branch: string;
    paid: number;
    unpaid: number;
    totalAmountSent?: number;
    outstandingAmount?: number;
    currentBillAmount?: number;
  }[]>([]);
  const [dynamicWaterUsageTrendData, setDynamicWaterUsageTrendData] = React.useState<{ month: string; usage: number }[]>([]);

  // Revenue and Progress State
  const [revenueEfficiency, setRevenueEfficiency] = React.useState({ billed: 0, collected: 0, efficiency: 0, unpaidAmount: 0, unpaidCount: 0, paidCount: 0 });
  const [readingProgress, setReadingProgress] = React.useState({ total: 0, read: 0, percentage: 0 });
  const [topDelinquentCustomers, setTopDelinquentCustomers] = React.useState<{ name: string; balance: number; type: string }[]>([]);
  const [totalOverdueAccountsCount, setTotalOverdueAccountsCount] = React.useState<number>(0);
  const [todayActivity, setTodayActivity] = React.useState({ bills: 0, readings: 0, customers: 0 });
  const [pendingApprovalsCount, setPendingApprovalsCount] = React.useState(0);

  // State for toggling views
    const [branchPerformanceSeries, setBranchPerformanceSeries] = React.useState({
    totalAmountSent: true,
    outstandingAmount: true,
    currentBillAmount: true,
  });
  const [branchPerformanceView, setBranchPerformanceView] = React.useState<'chart' | 'table'>('chart');
  const [waterUsageView, setWaterUsageView] = React.useState<'chart' | 'table'>('chart');
  const { toast } = useToast();
  const branchChartContainerRef = React.useRef<HTMLDivElement>(null);

  const downloadChartAsPng = React.useCallback(() => {
    try {
      const container = branchChartContainerRef.current;
      if (!container) return;
      const svg = container.querySelector("svg");
      if (!svg) {
        toast({
          title: "Chart Not Ready",
          description: "Could not find chart to export.",
          variant: "destructive",
        });
        return;
      }

      const bbox = svg.getBoundingClientRect();
      const width = bbox.width || 800;
      const height = bbox.height || 360;

      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clonedSvg.setAttribute("width", String(width));
      clonedSvg.setAttribute("height", String(height));

      const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgRect.setAttribute("width", "100%");
      bgRect.setAttribute("height", "100%");
      bgRect.setAttribute("fill", "#ffffff");
      clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = "text { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; }";
      clonedSvg.insertBefore(style, clonedSvg.firstChild);

      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(clonedSvg);
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              downloadFile(blob, `Branch_Performance_Chart_${selectedMonth}.png`);
              toast({
                title: "Chart Downloaded",
                description: "Saved Branch Performance chart as PNG image.",
              });
            }
            URL.revokeObjectURL(blobUrl);
          }, "image/png");
        } else {
          URL.revokeObjectURL(blobUrl);
        }
      };
      img.onerror = () => {
        downloadFile(svgBlob, `Branch_Performance_Chart_${selectedMonth}.svg`);
        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
    } catch (err) {
      console.error("Failed to export chart:", err);
      toast({
        title: "Export Error",
        description: "Failed to export chart image.",
        variant: "destructive",
      });
    }
  }, [selectedMonth, toast]);

  const downloadBranchDataCsv = React.useCallback(() => {
    if (dynamicBranchPerformanceData.length === 0) {
      toast({
        title: "No Data",
        description: "No branch performance data to export.",
        variant: "destructive",
      });
      return;
    }

    const headers: string[] = ["Branch"];
    if (branchPerformanceSeries.totalAmountSent) headers.push("Total Amount Sent (ETB)");
    if (branchPerformanceSeries.outstandingAmount) headers.push("Outstanding Amount (ETB)");
    if (branchPerformanceSeries.currentBillAmount) headers.push("Current Bill Amount (ETB)");
    headers.push("Paid Bills", "Unpaid Bills", "Total Bills", "Collection Rate (%)");

    const data = dynamicBranchPerformanceData.map(item => {
      const row: Record<string, any> = { "Branch": item.branch };
      if (branchPerformanceSeries.totalAmountSent) {
        row["Total Amount Sent (ETB)"] = (item.totalAmountSent ?? 0).toFixed(2);
      }
      if (branchPerformanceSeries.outstandingAmount) {
        row["Outstanding Amount (ETB)"] = (item.outstandingAmount ?? 0).toFixed(2);
      }
      if (branchPerformanceSeries.currentBillAmount) {
        row["Current Bill Amount (ETB)"] = (item.currentBillAmount ?? 0).toFixed(2);
      }
      row["Paid Bills"] = item.paid;
      row["Unpaid Bills"] = item.unpaid;
      row["Total Bills"] = item.paid + item.unpaid;
      row["Collection Rate (%)"] = item.paid + item.unpaid > 0
        ? `${Math.round((item.paid / (item.paid + item.unpaid)) * 100)}%`
        : "0%";
      return row;
    });

    const blob = arrayToCsvBlob(data, headers);
    downloadFile(blob, `Branch_Performance_${selectedMonth}.csv`);
    toast({
      title: "CSV Export Complete",
      description: `Exported ${data.length} branch record(s) to CSV.`,
    });
  }, [dynamicBranchPerformanceData, branchPerformanceSeries, selectedMonth, toast]);

  const downloadBranchDataXlsx = React.useCallback(() => {
    if (dynamicBranchPerformanceData.length === 0) {
      toast({
        title: "No Data",
        description: "No branch performance data to export.",
        variant: "destructive",
      });
      return;
    }

    const headers: string[] = ["Branch"];
    if (branchPerformanceSeries.totalAmountSent) headers.push("Total Amount Sent (ETB)");
    if (branchPerformanceSeries.outstandingAmount) headers.push("Outstanding Amount (ETB)");
    if (branchPerformanceSeries.currentBillAmount) headers.push("Current Bill Amount (ETB)");
    headers.push("Paid Bills", "Unpaid Bills", "Total Bills", "Collection Rate (%)");

    const data = dynamicBranchPerformanceData.map(item => {
      const row: Record<string, any> = { "Branch": item.branch };
      if (branchPerformanceSeries.totalAmountSent) {
        row["Total Amount Sent (ETB)"] = Number((item.totalAmountSent ?? 0).toFixed(2));
      }
      if (branchPerformanceSeries.outstandingAmount) {
        row["Outstanding Amount (ETB)"] = Number((item.outstandingAmount ?? 0).toFixed(2));
      }
      if (branchPerformanceSeries.currentBillAmount) {
        row["Current Bill Amount (ETB)"] = Number((item.currentBillAmount ?? 0).toFixed(2));
      }
      row["Paid Bills"] = item.paid;
      row["Unpaid Bills"] = item.unpaid;
      row["Total Bills"] = item.paid + item.unpaid;
      row["Collection Rate (%)"] = item.paid + item.unpaid > 0
        ? `${Math.round((item.paid / (item.paid + item.unpaid)) * 100)}%`
        : "0%";
      return row;
    });

    const blob = arrayToXlsxBlob(data, headers, "Branch Performance");
    downloadFile(blob, `Branch_Performance_${selectedMonth}.xlsx`);
    toast({
      title: "Excel Export Complete",
      description: `Exported ${data.length} branch record(s) to Excel.`,
    });
  }, [dynamicBranchPerformanceData, branchPerformanceSeries, selectedMonth, toast]);

  React.useEffect(() => {
    setIsClient(true);

    const updateClock = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLiveDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
      setLiveEthiopianDate(getEthiopianDateString(now));
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const pingInterval = setInterval(() => {
      checkActualConnectivity().then(online => setIsOnline(online));
    }, 15000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(pingInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const processDashboardData = React.useCallback(async () => {
    const { data: metrics, error: metricsError } = await getDashboardMetricsAction();

    // Detect expired server session: localStorage still has user but cookie is gone.
    const isAuthErr = (e: any) => /user not authenticated|unauthorized|forbidden/i.test(
      e?.message || e?.name || String(e)
    );
    if (metricsError && isAuthErr(metricsError)) {
      localStorage.removeItem('user');
      router.push('/');
      return;
    }

    if (metricsError) {
      console.error("Head Office Dashboard: Failed to fetch live metrics:", metricsError);
    }

    if (metrics) {
      // Update selected month if server returns a different "latest" month
      if (metrics.latestMonth) {
        setSelectedMonth(metrics.latestMonth);
      }

      // 1. Bill Statuses
      const paid = metrics.billStatuses.find((s: any) => s.status === 'Paid')?.count || 0;
      const unpaid = metrics.billStatuses.find((s: any) => s.status === 'Unpaid')?.count || 0;
      const totalBills = metrics.billStatuses.reduce((acc: number, s: any) => acc + parseInt(s.count), 0);

      setDynamicTotalBills(totalBills);
      setDynamicPaidBills(parseInt(paid));
      setDynamicUnpaidBills(parseInt(unpaid));
      setBillsPaymentStatusData([
        { name: 'Paid', value: parseInt(paid), fill: 'hsl(var(--chart-1))' },
        { name: 'Unpaid', value: parseInt(unpaid), fill: 'hsl(var(--chart-3))' },
      ]);

      // 2. Counts
      setDynamicTotalCustomerCount(metrics.counts.individualCustomers);
      setDynamicTotalBulkMeterCount(metrics.counts.bulkMeters);

      // 3. Revenue
      setRevenueEfficiency({
        billed: metrics.revenue.totalBilled,
        collected: metrics.revenue.totalCollected,
        efficiency: metrics.revenue.efficiency,
        unpaidAmount: metrics.revenue.totalUnpaid ?? 0,
        unpaidCount: metrics.revenue.unpaidCount ?? 0,
        paidCount: metrics.revenue.paidCount ?? 0
      });

      // 4. Progress
      setReadingProgress({
        total: metrics.readings.totalCustomers,
        read: metrics.readings.completedReadings,
        percentage: metrics.readings.progress
      });

      // 5. Delinquent
      if (metrics.delinquent) {
        if (typeof metrics.delinquent.totalCount === 'number') {
          setTotalOverdueAccountsCount(metrics.delinquent.totalCount);
        }
        if (metrics.delinquent.combined) {
          const delinquent = metrics.delinquent.combined.map((m: any) => ({
            name: m.name,
            balance: Number(m.outstanding),
            type: m.type
          }));
          setTopDelinquentCustomers(delinquent);
        }
      }

      // 6. Branch Performance (Server Side)
      if (metrics.branchPerformance) {
        setDynamicBranchPerformanceData(metrics.branchPerformance);
      }

      // 7. Usage Trend (Server Side)
      if (metrics.usageTrend) {
        setDynamicWaterUsageTrendData(metrics.usageTrend);
      }
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        await processDashboardData();
      } catch (err) {
        console.error("Error initializing head office dashboard data:", err);
        if (isMounted) setError("Failed to load dashboard data. Please try again later.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [processDashboardData]);

  if (!hasPermission('dashboard_view_all')) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <UIAlertDescription>
            You do not have permission to view the Head Office Dashboard.
          </UIAlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4 text-center">Loading dashboard data...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <UIAlertDescription>{error}</UIAlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header: Greeting + Live Clock ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold">Head Office Dashboard</h1>
            {/* ── Connection Status Pill ── */}
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isSyncing ? (
                  <><RefreshCw className="h-2.5 w-2.5 animate-spin" /> Syncing…</>
                ) : (
                  <><Wifi className="h-2.5 w-2.5" /> Online{lastSyncTime ? ` · ${lastSyncTime}` : ''}</>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <WifiOff className="h-2.5 w-2.5" /> Offline
              </span>
            )}
            {/* ── Live Data Badge ── */}
            <button
              onClick={() => {
                triggerRefresh();
                processDashboardData();
              }}
              title="Refresh data now"
              className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : localLastUpdated ? `Updated ${localLastUpdated}` : 'Live Data'}
            </button>
          </div>
          <p className="text-base md:text-lg text-muted-foreground">
            {getGreetingEmoji()} {getGreeting()},{" "}
            <span className="font-semibold text-foreground">
              {currentUser?.name ? currentUser.name.split(" ")[0] : "Admin"}
            </span>{" "}
            👋
          </p>
        </div>
        {/* Live Clock */}
        <div className="flex flex-col items-start sm:items-end gap-0.5 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm min-w-[200px]">
          <div className="flex items-center gap-2 text-slate-800">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xl font-black tracking-tight tabular-nums">
              {liveTime || '--:--:--'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">{liveDate || '...'}</p>
          {liveEthiopianDate && (
            <span className="text-[11px] font-bold text-blue-600/90 mt-0.5 select-none">
              {liveEthiopianDate}
            </span>
          )}
        </div>
      </div>

      {/* ── Quick Actions Bar ── */}
      <div className="flex flex-wrap gap-2.5">
        {[
          { label: 'Data Entry', icon: DatabaseZap, href: '/admin/data-entry', color: 'bg-blue-500 hover:bg-blue-600', perm: hasPermission('customers_create') || hasPermission('bulk_meters_create') },
          { label: 'Bill Management', icon: FileText, href: '/admin/bill-management', color: 'bg-violet-500 hover:bg-violet-600', perm: hasPermission('bill_view_branch') || hasPermission('bill_view_all') || hasPermission('billing_view') },
          { label: 'Reports', icon: BarChartIcon, href: '/admin/reports', color: 'bg-emerald-500 hover:bg-emerald-600', perm: hasPermission('reports_view_branch') || hasPermission('reports_view_all') },
          { label: 'Staff', icon: Users, href: '/admin/staff-management', color: 'bg-rose-500 hover:bg-rose-600', perm: hasPermission('staff_view_branch') || hasPermission('staff_view_all') || hasPermission('staff_view') },
          { label: 'Meter Readings', icon: Gauge, href: '/admin/meter-readings', color: 'bg-amber-500 hover:bg-amber-600', perm: hasPermission('meter_readings_view_branch') || hasPermission('meter_readings_view_all') || hasPermission('meter_readings_create') },
        ].filter(item => item.perm).map(({ label, icon: Icon, href, color }) => (
          <Link key={label} href={href} passHref>
            <Button
              size="sm"
              className={`${color} text-white font-semibold rounded-full px-4 py-2 h-auto shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-1.5`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          </Link>
        ))}
      </div>

      {/* ── Today's Activity Summary ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Bills Today", value: todayActivity.bills, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: "Readings Today", value: todayActivity.readings, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: "Customers Added", value: todayActivity.customers, icon: UserPlus, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`flex items-center gap-3 ${bg} border ${border} rounded-2xl px-4 py-3 shadow-sm`}>
            <div className={`h-8 w-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div>
              <p className={`text-xl font-black ${color}`}>{value}</p>
              <p className="text-[11px] text-slate-500 font-semibold leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Top 3-Column KPI Grid ── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Bills Status */}
        <Card className="group shadow-sm hover:shadow-xl border border-blue-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f4f7ff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <FileText className="h-48 w-48 text-blue-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Bills Status ({selectedMonth})</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-blue-900 transition-colors">{dynamicTotalBills.toLocaleString()}</div>
              <div className="text-lg font-bold text-slate-500 mb-1">Bills</div>
            </div>
            <p className="text-sm text-slate-600 font-semibold mt-2">
              <span className="text-emerald-600">{dynamicPaidBills} Paid</span> <span className="mx-2 text-slate-300">|</span> <span className="text-rose-500">{dynamicUnpaidBills} Unpaid</span>
            </p>
            <div className="h-[100px] mt-6 relative flex items-center justify-center">
              {isClient && billsPaymentStatusData.some(d => d.value > 0) ? (
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <PieChartRecharts>
                    <Pie
                      data={billsPaymentStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {billsPaymentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} className="drop-shadow-sm hover:opacity-80 transition-opacity" />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent hideLabel />} />
                  </PieChartRecharts>
                </ChartContainer>
              ) : (
                <div className="text-sm font-semibold text-blue-600/80 italic w-full text-center mt-6">No bill data for this month</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Collection Efficiency */}
        <Card className="group shadow-sm hover:shadow-xl border border-amber-100/60 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#fffbf0' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <BarChartIcon className="h-48 w-48 text-amber-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Revenue Collection</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <BarChartIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-start justify-between mt-2 mb-1">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-amber-900 transition-colors">
                {revenueEfficiency.efficiency.toFixed(1)}<span className="text-3xl text-amber-500/50">%</span>
              </div>
              {/* KPI Target Badge */}
              {revenueEfficiency.billed > 0 && (
                <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                  revenueEfficiency.efficiency >= 80
                    ? 'bg-emerald-100 text-emerald-700'
                    : revenueEfficiency.efficiency >= 50
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  <Target className="h-3 w-3" />
                  {revenueEfficiency.efficiency >= 80 ? '✅ On Target'
                    : revenueEfficiency.efficiency >= 50 ? '⚠️ Below Target'
                    : '🚨 Critical'}
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600 font-semibold mb-4">Collection Efficiency <span className="text-xs text-slate-400 font-normal">(target: 80%)</span></p>

            <div className="flex justify-between items-start mb-4 pt-1">
              <div>
                <p className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Total Billed</p>
                <p className="text-base font-black text-slate-800">
                  <span className="text-xs text-slate-400 mr-1">ETB</span>
                  {revenueEfficiency.billed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {revenueEfficiency.unpaidCount > 0 ? (
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                      {revenueEfficiency.unpaidCount} Unpaid
                    </span>
                    <span className="text-[11px] font-semibold text-rose-600">
                      ETB {revenueEfficiency.unpaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] font-semibold text-emerald-600 mt-1">All bills settled</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Collected</p>
                <p className="text-base font-black text-emerald-700">
                  <span className="text-xs text-slate-400 mr-1">ETB</span>
                  {revenueEfficiency.collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="mt-1 flex items-center justify-end gap-1.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    {revenueEfficiency.paidCount || 0} Paid
                  </span>
                </div>
              </div>
            </div>

            {/* Sparkline progress bar */}
            {isClient && revenueEfficiency.billed > 0 ? (
              <div className="space-y-1.5">
                <div className="w-full bg-amber-900/5 rounded-full h-2.5 overflow-hidden flex shadow-inner">
                  <div className="bg-gradient-to-r from-amber-300 to-amber-500 h-full transition-all duration-1000 ease-out rounded-full" style={{ width: `${revenueEfficiency.efficiency}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                  <span>0%</span>
                  <span className="text-amber-600 font-bold">{revenueEfficiency.efficiency.toFixed(1)}% collected</span>
                  <span>100%</span>
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-amber-600/60 italic w-full text-center mt-2">No revenue data.</div>
            )}
          </CardContent>
        </Card>

        {/* Meter Reading Progress */}
        <Card className="group shadow-sm hover:shadow-xl border border-cyan-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f0fbff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <Gauge className="h-48 w-48 text-cyan-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Reading Progress</CardTitle>
            <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600">
              <Gauge className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="mt-2 text-4xl lg:text-5xl font-black tracking-tight text-slate-800 mb-1 group-hover:text-cyan-900 transition-colors">
              {readingProgress.percentage.toFixed(1)}<span className="text-3xl text-cyan-500/50">%</span>
            </div>
            <p className="text-sm text-slate-600 font-semibold mb-8">
              <span className="text-cyan-600 font-bold">{readingProgress.read}</span> of <span className="text-slate-500">{readingProgress.total}</span> bulk meters read
            </p>
            
            <div className="mt-4 pt-2">
              <div className="w-full bg-cyan-900/5 rounded-full h-3 overflow-hidden shadow-inner relative mb-3">
                <div
                  className="bg-cyan-500 h-full relative overflow-hidden transition-all duration-1000 ease-out"
                  style={{ width: `${readingProgress.percentage}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_1s_linear_infinite]" />
                </div>
              </div>
              <div className="text-[10px] text-cyan-700 font-bold uppercase tracking-widest italic flex items-center justify-center gap-2">
                {readingProgress.percentage === 100 ? (
                  <><div className="h-2 w-2 rounded-full bg-emerald-500" /> Sync Complete</>
                ) : (
                  <><div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" /> Syncing in Progress...</>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Middle 2-Column Grid ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Total Customers */}
        <Card className="group shadow-sm hover:shadow-xl border border-emerald-100/80 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f0fbf4' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 pointer-events-none -mb-8 -mr-8 group-hover:scale-110">
            <Users className="h-64 w-64 text-emerald-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Total Individual Customers</CardTitle>
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-12 flex flex-col justify-between relative z-10">
            <div>
              <div className="text-5xl lg:text-7xl font-black text-slate-800 tracking-tight mb-2 group-hover:text-emerald-900 transition-colors">{dynamicTotalCustomerCount.toLocaleString()}</div>
              <p className="text-base text-slate-600 font-semibold">Total active individual accounts</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Bulk Meters */}
        <Card className="group shadow-sm hover:shadow-xl border border-purple-100/80 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#faf5ff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 pointer-events-none -mb-8 -mr-8 group-hover:scale-110">
            <Gauge className="h-64 w-64 text-purple-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Total Bulk Meters</CardTitle>
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Gauge className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-12 flex flex-col justify-between relative z-10">
            <div>
              <div className="text-5xl lg:text-7xl font-black text-slate-800 tracking-tight mb-2 group-hover:text-purple-900 transition-colors">{dynamicTotalBulkMeterCount.toLocaleString()}</div>
              <p className="text-base text-slate-600 font-semibold">Total registered bulk meters</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Overdue Bills Alert Card ── */}
      {(totalOverdueAccountsCount > 0 || topDelinquentCustomers.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase font-bold text-red-400 tracking-wider">Overdue Accounts</p>
              <p className="text-3xl font-black text-red-700">{(totalOverdueAccountsCount || topDelinquentCustomers.length).toLocaleString()}</p>
              <p className="text-xs text-red-500 font-semibold">With outstanding balances</p>
            </div>
            <Link href="/admin/bill-management" passHref>
              <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-100 rounded-xl font-bold">
                View <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Highest Outstanding</p>
              <p className="text-xl font-black text-emerald-800">
                ETB {topDelinquentCustomers[0]?.balance.toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600 font-semibold truncate max-w-[160px]">{topDelinquentCustomers[0]?.name}</p>
            </div>
          </div>
        </div>
      )}

      <Card className="bg-slate-50 border-slate-100 shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="text-slate-900 font-bold">Quick Access</CardTitle>
          <CardDescription className="text-slate-600/70">Navigate quickly to key management areas.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/admin/bulk-meters" passHref>
            <Button variant="outline" className="w-full justify-start p-6 h-auto quick-access-btn bg-white hover:bg-slate-100 border-slate-200 transition-all duration-300 hover:shadow-md group rounded-2xl">
              <Gauge className="mr-4 h-8 w-8 text-blue-500 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-bold text-slate-900 text-lg">View Bulk Meters</p>
                <p className="text-sm text-slate-500">Manage all bulk water meters.</p>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </Button>
          </Link>
          <Link href="/admin/individual-customers" passHref>
            <Button variant="outline" className="w-full justify-start p-6 h-auto quick-access-btn bg-white hover:bg-slate-100 border-slate-200 transition-all duration-300 hover:shadow-md group rounded-2xl">
              <Users className="mr-4 h-8 w-8 text-emerald-500 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-bold text-slate-900 text-lg">View Individual Customers</p>
                <p className="text-sm text-slate-500">Manage all individual customer accounts.</p>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Branch Performance */}
        <Card className="lg:col-span-2 shadow-md border-gray-100 overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50/50 border-b pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">Branch Performance (Bulk Meters - {selectedMonth})</CardTitle>
              <CardDescription>Total amount sent, outstanding amount, and current bill amount across branches.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 sm:h-9 px-2.5 bg-white border border-slate-200 shadow-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 gap-1.5 rounded-lg"
                    title="Download Branch Performance"
                  >
                    <Download className="h-3.5 w-3.5 text-purple-600" />
                    <span className="text-xs font-semibold">Download</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-lg border-slate-200">
                  <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Chart Download
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={downloadChartAsPng} className="cursor-pointer gap-2.5 rounded-lg text-xs py-2">
                    <ImageIcon className="h-4 w-4 text-purple-600" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">Chart Image (.png)</span>
                      <span className="text-[10px] text-slate-400">High-resolution graphic</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Table / Data Download
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={downloadBranchDataXlsx} className="cursor-pointer gap-2.5 rounded-lg text-xs py-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">Excel Spreadsheet (.xlsx)</span>
                      <span className="text-[10px] text-slate-400">All visible branch metrics</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadBranchDataCsv} className="cursor-pointer gap-2.5 rounded-lg text-xs py-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">CSV Spreadsheet (.csv)</span>
                      <span className="text-[10px] text-slate-400">Comma-separated data</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="secondary" size="sm" onClick={() => setBranchPerformanceView(prev => prev === 'chart' ? 'table' : 'chart')} className="bg-white shadow-xs border h-8 sm:h-9 px-3 rounded-lg text-xs font-semibold">
                {branchPerformanceView === 'chart' ? <TableIcon className="mr-1.5 h-4 w-4" /> : <BarChartIcon className="mr-1.5 h-4 w-4" />}
                View {branchPerformanceView === 'chart' ? 'Table' : 'Chart'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {branchPerformanceView === 'chart' ? (
              <div className="space-y-3">
                {/* ── Top Legend Banner with Interactive On/Off Toggle ── */}
                <div className="flex items-center gap-2 sm:gap-3 pt-1 pl-1 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 mr-0.5">
                    Toggle Metrics:
                  </span>

                  {/* Total Amount Sent */}
                  <button
                    type="button"
                    onClick={() => setBranchPerformanceSeries(prev => ({ ...prev, totalAmountSent: !prev.totalAmountSent }))}
                    title={branchPerformanceSeries.totalAmountSent ? "Click to turn off Total Amount Sent" : "Click to turn on Total Amount Sent"}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer select-none",
                      branchPerformanceSeries.totalAmountSent
                        ? "bg-white border-[#55B7C2]/60 text-slate-800 shadow-xs hover:border-[#55B7C2] hover:bg-[#55B7C2]/5"
                        : "bg-slate-50/80 border-slate-200 text-slate-400 opacity-60 hover:opacity-85 hover:bg-slate-100"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block w-5 h-2.5 rounded-xs border transition-all",
                        branchPerformanceSeries.totalAmountSent
                          ? "bg-[#55B7C2] border-[#44a2ad]"
                          : "bg-slate-300 border-slate-400"
                      )}
                    />
                    <span className={cn("transition-colors", branchPerformanceSeries.totalAmountSent ? "font-semibold text-slate-800" : "line-through text-slate-400")}>
                      Total Amount Sent
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors",
                        branchPerformanceSeries.totalAmountSent
                          ? "bg-[#55B7C2]/15 text-[#1b7681]"
                          : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {branchPerformanceSeries.totalAmountSent ? "ON" : "OFF"}
                    </span>
                  </button>

                  {/* Outstanding Amount */}
                  <button
                    type="button"
                    onClick={() => setBranchPerformanceSeries(prev => ({ ...prev, outstandingAmount: !prev.outstandingAmount }))}
                    title={branchPerformanceSeries.outstandingAmount ? "Click to turn off Outstanding Amount" : "Click to turn on Outstanding Amount"}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer select-none",
                      branchPerformanceSeries.outstandingAmount
                        ? "bg-white border-[#5E5E5E]/60 text-slate-800 shadow-xs hover:border-[#5E5E5E] hover:bg-[#5E5E5E]/5"
                        : "bg-slate-50/80 border-slate-200 text-slate-400 opacity-60 hover:opacity-85 hover:bg-slate-100"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block w-5 h-2.5 rounded-xs border transition-all",
                        branchPerformanceSeries.outstandingAmount
                          ? "bg-[#5E5E5E] border-[#474747]"
                          : "bg-slate-300 border-slate-400"
                      )}
                    />
                    <span className={cn("transition-colors", branchPerformanceSeries.outstandingAmount ? "font-semibold text-slate-800" : "line-through text-slate-400")}>
                      Outstanding Amount
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors",
                        branchPerformanceSeries.outstandingAmount
                          ? "bg-[#5E5E5E]/15 text-[#333333]"
                          : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {branchPerformanceSeries.outstandingAmount ? "ON" : "OFF"}
                    </span>
                  </button>

                  {/* Current Bill amount */}
                  <button
                    type="button"
                    onClick={() => setBranchPerformanceSeries(prev => ({ ...prev, currentBillAmount: !prev.currentBillAmount }))}
                    title={branchPerformanceSeries.currentBillAmount ? "Click to turn off Current Bill amount" : "Click to turn on Current Bill amount"}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer select-none",
                      branchPerformanceSeries.currentBillAmount
                        ? "bg-white border-[#E11D48]/60 text-slate-800 shadow-xs hover:border-[#E11D48] hover:bg-[#E11D48]/5"
                        : "bg-slate-50/80 border-slate-200 text-slate-400 opacity-60 hover:opacity-85 hover:bg-slate-100"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block w-5 h-2.5 rounded-xs border transition-all",
                        branchPerformanceSeries.currentBillAmount
                          ? "bg-[#E11D48] border-[#b81438]"
                          : "bg-slate-300 border-slate-400"
                      )}
                    />
                    <span className={cn("transition-colors", branchPerformanceSeries.currentBillAmount ? "font-semibold text-slate-800" : "line-through text-slate-400")}>
                      Current Bill amount
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors",
                        branchPerformanceSeries.currentBillAmount
                          ? "bg-[#E11D48]/15 text-[#9f1239]"
                          : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {branchPerformanceSeries.currentBillAmount ? "ON" : "OFF"}
                    </span>
                  </button>

                  {/* Quick Reset All ON Button */}
                  {(!branchPerformanceSeries.totalAmountSent || !branchPerformanceSeries.outstandingAmount || !branchPerformanceSeries.currentBillAmount) && (
                    <button
                      type="button"
                      onClick={() => setBranchPerformanceSeries({ totalAmountSent: true, outstandingAmount: true, currentBillAmount: true })}
                      className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 underline underline-offset-2 ml-1 cursor-pointer transition-colors"
                    >
                      Reset All ON
                    </button>
                  )}
                </div>

                <div ref={branchChartContainerRef} className="h-[320px]">
                  {isClient && dynamicBranchPerformanceData.length > 0 ? (
                    !branchPerformanceSeries.totalAmountSent && !branchPerformanceSeries.outstandingAmount && !branchPerformanceSeries.currentBillAmount ? (
                      <div className="flex flex-col h-[320px] items-center justify-center text-xs text-muted-foreground gap-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <p className="font-semibold text-slate-700">All metrics are currently turned OFF.</p>
                        <p className="text-[11px] text-slate-500">Click any metric above to display it on the chart.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBranchPerformanceSeries({ totalAmountSent: true, outstandingAmount: true, currentBillAmount: true })}
                          className="mt-1 text-xs h-8 bg-white border-slate-200 hover:bg-slate-100"
                        >
                          Show All Metrics
                        </Button>
                      </div>
                    ) : (
                      <ChartContainer config={chartConfig} className="w-full h-full">
                        <BarChart data={dynamicBranchPerformanceData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="branch"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fontWeight: 500 }}
                            angle={-15}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fontWeight: 500 }}
                            tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`}
                          />
                          <Tooltip
                            content={<ChartTooltipContent />}
                            formatter={(value: any, name: any) => [
                              `ETB ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                              name === "totalAmountSent" ? "Total Amount Sent"
                                : name === "outstandingAmount" ? "Outstanding Amount"
                                : name === "currentBillAmount" ? "Current Bill amount"
                                : name
                            ]}
                          />
                          {branchPerformanceSeries.totalAmountSent && (
                            <Bar dataKey="totalAmountSent" fill="#55B7C2" radius={[4, 4, 0, 0]} name="Total Amount Sent" />
                          )}
                          {branchPerformanceSeries.outstandingAmount && (
                            <Bar dataKey="outstandingAmount" fill="#5E5E5E" radius={[4, 4, 0, 0]} name="Outstanding Amount" />
                          )}
                          {branchPerformanceSeries.currentBillAmount && (
                            <Bar dataKey="currentBillAmount" fill="#E11D48" radius={[4, 4, 0, 0]} name="Current Bill amount" />
                          )}
                        </BarChart>
                      </ChartContainer>
                    )
                  ) : (
                    <div className="flex h-[320px] items-center justify-center text-xs text-muted-foreground italic">
                      No branch performance data available for chart.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[340px] rounded-md border">
                {dynamicBranchPerformanceData.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-bold">Branch</TableHead>
                        {branchPerformanceSeries.totalAmountSent && (
                          <TableHead className="text-right font-bold text-[#55B7C2]">Total Amount Sent (ETB)</TableHead>
                        )}
                        {branchPerformanceSeries.outstandingAmount && (
                          <TableHead className="text-right font-bold text-slate-700">Outstanding Amount (ETB)</TableHead>
                        )}
                        {branchPerformanceSeries.currentBillAmount && (
                          <TableHead className="text-right font-bold text-[#E11D48]">Current Bill Amount (ETB)</TableHead>
                        )}
                        <TableHead className="text-right font-bold text-emerald-600">Paid Bills</TableHead>
                        <TableHead className="text-right font-bold text-red-600">Unpaid Bills</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dynamicBranchPerformanceData.map((item) => (
                        <TableRow key={item.branch} className="hover:bg-gray-50/50">
                          <TableCell className="font-medium text-gray-900">{item.branch}</TableCell>
                          {branchPerformanceSeries.totalAmountSent && (
                            <TableCell className="text-right font-bold text-[#2A9D8F]">
                              {(item.totalAmountSent ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          )}
                          {branchPerformanceSeries.outstandingAmount && (
                            <TableCell className="text-right font-bold text-slate-700">
                              {(item.outstandingAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          )}
                          {branchPerformanceSeries.currentBillAmount && (
                            <TableCell className="text-right font-bold text-[#E11D48]">
                              {(item.currentBillAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          )}
                          <TableCell className="text-right text-emerald-600 font-semibold">{item.paid}</TableCell>
                          <TableCell className="text-right text-red-600 font-semibold">{item.unpaid}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-[340px] items-center justify-center text-xs text-muted-foreground italic">
                    No branch performance data available.
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Top Delinquent Accounts */}
        <Card className="shadow-md border-gray-100 overflow-hidden">
          <CardHeader className="bg-rose-50 border-b border-rose-100">
            <CardTitle className="text-lg font-bold text-rose-900 flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-rose-600" />
              Highest outstanding balances needing attention.
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-rose-100/30">
                <TableRow>
                  <TableHead className="text-rose-900 font-bold pl-4">Account</TableHead>
                  <TableHead className="text-right text-rose-900 font-bold pr-4">Balance (Birr)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topDelinquentCustomers.length > 0 ? (
                  topDelinquentCustomers.map((customer, idx) => (
                    <TableRow key={idx} className="hover:bg-rose-50 transition-colors">
                      <TableCell className="font-medium pl-4 py-3">
                        <p className="text-sm font-bold text-gray-900">{customer.name}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-black">{customer.type} Meter</p>
                      </TableCell>
                      <TableCell className="text-right pr-4 font-black text-rose-700">
                        {customer.balance.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center text-xs text-gray-500 italic">
                      All accounts are currently in good standing.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {topDelinquentCustomers.length > 0 && (
              <div className="p-4 bg-gray-50 border-t">
                <Link href="/admin/bill-management" passHref>
                  <Button variant="ghost" size="sm" className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold uppercase tracking-tighter">
                    Follow up with all delinquent accounts <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overall Water Usage Trend */}
      <Card className="shadow-md border-gray-100 overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50/50 border-b pb-4">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900">Overall Water Usage Trend</CardTitle>
            <CardDescription>Monthly water consumption across all meters.</CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setWaterUsageView(prev => prev === 'chart' ? 'table' : 'chart')} className="bg-white shadow-sm border">
            {waterUsageView === 'chart' ? <TableIcon className="mr-2 h-4 w-4" /> : <BarChartIcon className="mr-2 h-4 w-4" />}
            View {waterUsageView === 'chart' ? 'Table' : 'Chart'}
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          {waterUsageView === 'chart' ? (
            <div className="h-[300px]">
              {isClient && dynamicWaterUsageTrendData.length > 0 ? (
                <ChartContainer config={chartConfig} className="w-full h-full">
                    <LineChart data={dynamicWaterUsageTrendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(value) => `${value.toLocaleString()}`} tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line type="monotone" dataKey="usage" name="Water Usage (m³)" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground italic">
                  No water usage data available for chart.
                </div>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[300px] rounded-md border">
              {dynamicWaterUsageTrendData.length > 0 ? (
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="font-bold">Month</TableHead>
                      <TableHead className="text-right font-bold">Water Usage (m³)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dynamicWaterUsageTrendData.map((item) => (
                      <TableRow key={item.month} className="hover:bg-gray-50/50">
                        <TableCell className="font-medium text-gray-900">{item.month}</TableCell>
                        <TableCell className="text-right font-bold text-blue-700">{item.usage.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground italic">
                  No water usage data available.
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
