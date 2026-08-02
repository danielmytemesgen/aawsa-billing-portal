"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowRight,
  AlertCircle,
  Users,
  Gauge,
  Table as TableIcon,
  FileText,
  Activity,
  BarChart3 as BarChartIcon,
  Clock,
  Bell,
  Zap,
  ClipboardList,
  TrendingUp,
  UserPlus,
  Download,
  CheckCircle2,
  XCircle,
  Target,
  CalendarDays,
  DatabaseZap,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Building2,
  ChevronRight,
} from 'lucide-react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import {
  getBulkMeters, subscribeToBulkMeters, initializeBulkMeters,
  getCustomers, subscribeToCustomers, initializeCustomers,
  getBranches, subscribeToBranches, initializeBranches,
  initializeBills, subscribeToBills,
  getStaffMembers, getBills,
} from "@/lib/data-store";
import type { BulkMeter } from '../bulk-meters/bulk-meter-types';
import type { IndividualCustomer } from '../individual-customers/individual-customer-types';
import type { Branch } from '../branches/branch-types';
import { getDashboardMetricsAction } from "@/lib/actions";
import { checkActualConnectivity } from "@/lib/offline-db";
import { format } from 'date-fns';
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";

const chartConfig = {
  Paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  Unpaid: { label: "Unpaid", color: "hsl(var(--chart-3))" },
  waterUsage: { label: "Water Usage (m³)", color: "hsl(var(--chart-1))" },
  billed: { label: "Billed Amount", color: "hsl(var(--chart-2))" },
  collected: { label: "Collected Amount", color: "hsl(var(--chart-1))" },
} satisfies import("@/components/ui/chart").ChartConfig;


function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getGreetingEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "🌅";
  if (hour < 17) return "☀️";
  return "🌙";
}

const startDayOfEthiopian = function (year: number): number {
  const newYearDay = Math.floor(year / 100) - Math.floor(year / 400) - 4;
  // if the prev ethiopian year is a leap year, new-year occurs on 12th
  return ((year - 1) % 4 === 3) ? newYearDay + 1 : newYearDay;
};

const toEthiopian = function (year: number, month: number, date: number): [number, number, number] {
  // prevent incorrect input
  if (year === 0 || month < 1 || month > 12 || date < 1 || date > 31) {
    throw new Error("Malformed input can't be converted.");
  }

  // date between 5 and 14 of May 1582 are invalid
  if (month === 10 && date >= 5 && date <= 14 && year === 1582) {
    throw new Error('Invalid Date between 5-14 May 1582.');
  }

  // Number of days in gregorian months starting with January (index 1)
  const gregorianMonths = [0.0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Number of days in ethiopian months starting with Meskerem (index 1)
  const ethiopianMonths = [0.0, 30, 30, 30, 30, 30, 30, 30, 30, 30, 5, 30, 30, 30, 30];

  // if gregorian leap year, February has 29 days.
  if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
    gregorianMonths[2] = 29;
  }

  // September sees 8y difference
  let ethiopianYear = year - 8;

  // if ethiopian leap year pagumain has 6 days
  if (ethiopianYear % 4 === 3) {
    ethiopianMonths[10] = 6;
  }

  // Ethiopian new year in Gregorian calendar
  const newYearDay = startDayOfEthiopian(year - 8);

  // calculate number of days up to that date
  let until = 0;
  for (let i = 1; i < month; i++) {
    until += gregorianMonths[i];
  }
  until += date;

  // update tahissas (december) to match january 1st
  let tahissas = (ethiopianYear % 4) === 0 ? 26 : 25;

  // take into account the 1582 change
  if (year < 1582) {
    ethiopianMonths[1] = 0;
    ethiopianMonths[2] = tahissas;
  } else if (until <= 277 && year === 1582) {
    ethiopianMonths[1] = 0;
    ethiopianMonths[2] = tahissas;
  } else {
    tahissas = newYearDay - 3;
    ethiopianMonths[1] = tahissas;
  }

  // calculate month and date incrementally
  let m;
  let ethiopianDate = 0;
  for (m = 1; m < ethiopianMonths.length; m++) {
    if (until <= ethiopianMonths[m]) {
      ethiopianDate = (m === 1 || ethiopianMonths[m] === 0) ? until + (30 - tahissas) : until;
      break;
    } else {
      until -= ethiopianMonths[m];
    }
  }

  // if m > 10, we're already on next Ethiopian year
  if (m > 10) {
    ethiopianYear += 1;
  }

  // Ethiopian months ordered according to Gregorian
  const order = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1, 2, 3, 4];
  const ethiopianMonth = order[m];
  return [ethiopianYear, ethiopianMonth, ethiopianDate];
};

const ETHIOPIAN_MONTHS = [
  "",
  "Meskerem", // 1
  "Tekemt",    // 2
  "Hedar",     // 3
  "Tahsas",    // 4
  "Ter",       // 5
  "Yekatit",   // 6
  "Megabit",   // 7
  "Miyazia",   // 8
  "Ginbot",    // 9
  "Sene",      // 10
  "Hamle",     // 11
  "Nehase",    // 12
  "Pagume"     // 13
];

const ETHIOPIAN_MONTHS_AM = [
  "",
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜ"
];

function getEthiopianDateString(date: Date): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1; // 1-based
  const gd = date.getDate();
  try {
    const [ey, em, ed] = toEthiopian(gy, gm, gd);
    const monthAm = ETHIOPIAN_MONTHS_AM[em];
    const monthEn = ETHIOPIAN_MONTHS[em];
    return `${monthAm} ${ed}, ${ey} ዓ.ም. (${monthEn} ${ed}, ${ey} E.C.)`;
  } catch (e) {
    return "";
  }
}

function getBranchTrafficLight(paid: number, unpaid: number): { color: string; label: string; bg: string } {
  const total = paid + unpaid;
  if (total === 0) return { color: 'text-slate-400', label: 'No Data', bg: 'bg-slate-100' };
  const ratio = paid / total;
  if (ratio >= 0.7) return { color: 'text-emerald-600', label: 'On Track', bg: 'bg-emerald-50' };
  if (ratio >= 0.3) return { color: 'text-amber-600', label: 'Moderate', bg: 'bg-amber-50' };
  return { color: 'text-red-600', label: 'Needs Attention', bg: 'bg-red-50' };
}

interface AnomalyRecord {
  key: string;
  name: string;
  type: 'Bulk' | 'Individual';
  reason: string;
  severity: 'high' | 'medium';
  usage: number;
}

export default function AdminDashboardPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  const { hasPermission } = usePermissions();
  const { currentUser } = useCurrentUser();
  const router = useRouter();

  // Live clock state
  const [liveTime, setLiveTime] = React.useState<string>('');
  const [liveDate, setLiveDate] = React.useState<string>('');
  const [liveEthiopianDate, setLiveEthiopianDate] = React.useState<string>('');

  // Today's activity
  const [todayBills, setTodayBills] = React.useState(0);
  const [todayReadings, setTodayReadings] = React.useState(0);
  const [todayCustomers, setTodayCustomers] = React.useState(0);

  // Pending approvals
  const [pendingApprovalsCount, setPendingApprovalsCount] = React.useState(0);

  // Connection & Sync status
  const [isOnline, setIsOnline] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [pendingSyncCount, setPendingSyncCount] = React.useState(0);
  const [lastSyncTime, setLastSyncTime] = React.useState<string>('');

  // Branch drawer state
  const [selectedBranchKey, setSelectedBranchKey] = React.useState<string | null>(null);

  // State for dynamic data
  const [dynamicTotalBills, setDynamicTotalBills] = React.useState(0);
  const [dynamicPaidBills, setDynamicPaidBills] = React.useState(0);
  const [dynamicUnpaidBills, setDynamicUnpaidBills] = React.useState(0);
  const [billsPaymentStatusData, setBillsPaymentStatusData] = React.useState<{ name: string; value: number; fill: string; }[]>([]);

  const [dynamicTotalCustomerCount, setDynamicTotalCustomerCount] = React.useState(0);
  const [dynamicTotalBulkMeterCount, setDynamicTotalBulkMeterCount] = React.useState(0);

  const [dynamicBranchPerformanceData, setDynamicBranchPerformanceData] = React.useState<{ branch: string; paid: number; unpaid: number }[]>([]);
  const [dynamicWaterUsageTrendData, setDynamicWaterUsageTrendData] = React.useState<{ month: string; usage: number }[]>([]);

  // New Revenue and Progress State
  const [revenueEfficiency, setRevenueEfficiency] = React.useState({ billed: 0, collected: 0, efficiency: 0 });
  const [readingProgress, setReadingProgress] = React.useState({ total: 0, read: 0, percentage: 0 });
  const [topDelinquentCustomers, setTopDelinquentCustomers] = React.useState<{ name: string; balance: number; type: string }[]>([]);

  // State for toggling views
  const [branchPerformanceView, setBranchPerformanceView] = React.useState<'chart' | 'table'>('chart');
  const [waterUsageView, setWaterUsageView] = React.useState<'chart' | 'table'>('chart');

  const [selectedMonth, setSelectedMonth] = React.useState<string>(format(new Date(), 'yyyy-MM'));





  React.useEffect(() => {
    setIsClient(true);

    // Live clock
    const updateClock = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLiveDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
      setLiveEthiopianDate(getEthiopianDateString(now));
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    // Pending approvals from localStorage
    try {
      const stored = localStorage.getItem('approvals');
      if (stored) {
        const approvals = JSON.parse(stored);
        const pending = Array.isArray(approvals) ? approvals.filter((a: any) => a.status === 'Pending' || !a.status).length : 0;
        setPendingApprovalsCount(pending);
      }
    } catch (e) { /* ignore */ }

    // ── Connection & Sync monitoring ──
    // Initial connectivity check
    checkActualConnectivity().then(online => setIsOnline(online));

    // Native online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic active ping every 15s
    const pingInterval = setInterval(() => {
      checkActualConnectivity().then(online => setIsOnline(online));
    }, 15000);

    // Listen for sync events from SyncHub
    const handleSyncProgress = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setIsSyncing(detail.syncing ?? false);
        if (!detail.syncing) {
          setLastSyncTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        }
      }
    };
    const handleQueueUpdate = () => {
      // Try to read pending from Dexie-driven custom events or localStorage fallback
      try {
        const q = localStorage.getItem('_syncQueueCount');
        setPendingSyncCount(q ? parseInt(q, 10) : 0);
      } catch { /* ignore */ }
    };
    window.addEventListener('sync-progress', handleSyncProgress);
    window.addEventListener('offline-queue-updated', handleQueueUpdate);

    return () => {
      clearInterval(clockInterval);
      clearInterval(pingInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-progress', handleSyncProgress);
      window.removeEventListener('offline-queue-updated', handleQueueUpdate);
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
      console.error("Dashboard: Failed to fetch live metrics:", metricsError);
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
        efficiency: metrics.revenue.efficiency
      });

      // 4. Progress
      setReadingProgress({
        total: metrics.readings.totalCustomers,
        read: metrics.readings.completedReadings,
        percentage: metrics.readings.progress
      });

      // 5. Delinquent
      if (metrics.delinquent.combined) {
        const delinquent = metrics.delinquent.combined.map((m: any) => ({
          name: m.name,
          balance: Number(m.outstanding),
          type: m.type
        }));
        setTopDelinquentCustomers(delinquent);
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



    // Client-side initialization fallback
    if (!metrics) {
      const currentBranches = getBranches();
      const currentBulkMeters = getBulkMeters();
      const currentCustomers = getCustomers();
      const currentMonthYear = selectedMonth;

      // Branch Performance Data Fallback
      const performanceMap = new Map<string, { branchName: string, paid: number, unpaid: number }>();
      const displayableBranches = currentBranches.filter(branch => branch.name.toLowerCase() !== 'head office');
      displayableBranches.forEach(branch => {
        performanceMap.set(branch.id, { branchName: branch.name, paid: 0, unpaid: 0 });
      });
      const currentMonthBMs = currentBulkMeters.filter(bm => bm.month === currentMonthYear);
      currentMonthBMs.forEach(bm => {
        if (bm.branchId && performanceMap.has(bm.branchId)) {
          const entry = performanceMap.get(bm.branchId)!;
          if (bm.paymentStatus === 'Paid') entry.paid++;
          else if (bm.paymentStatus === 'Unpaid') entry.unpaid++;
          performanceMap.set(bm.branchId, entry);
        }
      });
      if (displayableBranches.length > 0) {
        setDynamicBranchPerformanceData(Array.from(performanceMap.values()).map(p => ({ branch: p.branchName.replace(/ Branch$/i, ""), paid: p.paid, unpaid: p.unpaid })));
      }
      // Usage Trend Fallback
      const usageMap = new Map<string, number>();
      const allMeters = [...currentBulkMeters, ...currentCustomers];
      allMeters.forEach(meter => {
        if (meter.month) {
          const usage = (meter.currentReading ?? 0) - (meter.previousReading ?? 0);
          if (typeof usage === 'number' && !isNaN(usage) && usage > 0) {
            const currentMonthUsage = usageMap.get(meter.month) || 0;
            usageMap.set(meter.month, currentMonthUsage + usage);
          }
        }
      });
      const trendData = Array.from(usageMap.entries())
        .map(([month, usage]) => ({ month, usage }))
        .sort((a, b) => new Date(`${a.month}-01`).getTime() - new Date(`${b.month}-01`).getTime());
      if (trendData.length > 0) {
        setDynamicWaterUsageTrendData(trendData);
      }
    }

  }, [selectedMonth]);


  React.useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        // Fetch aggregated metrics first for immediate display
        await processDashboardData();
        
        // Metrics loaded, we can now display the dashboard layout & charts immediately!
        if (isMounted) setIsLoading(false);

        // Pre-warm/initialize data-store for detailed views in the background (non-blocking)
        Promise.all([
          initializeBranches(),
          initializeBulkMeters(),
          initializeCustomers(),
          initializeBills()
        ]).then(async () => {
          if (isMounted) {
            await processDashboardData();

            // Today's activity — compute after store is warm
            const todayStr = new Date().toISOString().slice(0, 10);
            const meters = getBulkMeters();
            const customers = getCustomers();
            const todayBillsCount = meters.filter((m: any) => m.billDate && String(m.billDate).startsWith(todayStr)).length;
            const todayReadingsCount = [...meters, ...customers].filter((m: any) => m.readingDate && String(m.readingDate).startsWith(todayStr)).length;
            const todayCustomersCount = customers.filter((c: any) => c.createdAt && String(c.createdAt).startsWith(todayStr)).length;
            if (isMounted) {
              setTodayBills(todayBillsCount);
              setTodayReadings(todayReadingsCount);
              setTodayCustomers(todayCustomersCount);
            }
          }
        }).catch((err) => {
          console.error("Background data-store initialization failed:", err);
        });

      } catch (err) {
        console.error("Error initializing dashboard data:", err);
        if (isMounted) setError("Failed to load dashboard data. Please try again later.");
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    const unsubBranches = subscribeToBranches(() => { if (isMounted) processDashboardData(); });
    const unsubBulkMeters = subscribeToBulkMeters(() => { if (isMounted) processDashboardData(); });
    const unsubCustomers = subscribeToCustomers(() => { if (isMounted) processDashboardData(); });
    const unsubBills = subscribeToBills(() => { if (isMounted) processDashboardData(); });


    return () => {
      isMounted = false;
      unsubBranches();
      unsubBulkMeters();
      unsubCustomers();
      unsubBills();

    };
  }, [processDashboardData]);

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
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
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

      {/* ── Pending Approvals Banner ── */}
      {pendingApprovalsCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {pendingApprovalsCount} Approval{pendingApprovalsCount !== 1 ? 's' : ''} Pending
              </p>
              <p className="text-xs text-amber-700">Items are waiting for your review and approval.</p>
            </div>
          </div>
          <Link href="/admin/approvals" passHref>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm flex-shrink-0">
              Review <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* ── Quick Actions Bar ── */}
      <div className="flex flex-wrap gap-2.5">
        {[
          { label: 'Data Entry', icon: DatabaseZap, href: '/admin/data-entry', color: 'bg-blue-500 hover:bg-blue-600' },
          { label: 'Bill Management', icon: FileText, href: '/admin/bill-management', color: 'bg-violet-500 hover:bg-violet-600' },
          { label: 'Reports', icon: BarChartIcon, href: '/admin/reports', color: 'bg-emerald-500 hover:bg-emerald-600' },
          { label: 'Staff', icon: Users, href: '/admin/staff-management', color: 'bg-rose-500 hover:bg-rose-600' },
          { label: 'Meter Readings', icon: Gauge, href: '/admin/meter-readings', color: 'bg-amber-500 hover:bg-amber-600' },
        ].map(({ label, icon: Icon, href, color }) => (
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
          { label: "Bills Today", value: todayBills, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: "Readings Today", value: todayReadings, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: "Customers Added", value: todayCustomers, icon: UserPlus, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Bills Status Card */}
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
                        {billsPaymentStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} className="drop-shadow-sm hover:opacity-80 transition-opacity" />))}
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

            <div className="flex justify-between items-center mb-4 pt-1">
              <div>
                <p className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Total Billed</p>
                <p className="text-base font-black text-slate-800"><span className="text-xs text-slate-400 mr-1">ETB</span>{revenueEfficiency.billed.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Collected</p>
                <p className="text-base font-black text-emerald-700"><span className="text-xs text-slate-400 mr-1">ETB</span>{revenueEfficiency.collected.toLocaleString()}</p>
              </div>
            </div>

            {/* Sparkline mini-chart */}
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
              <span className="text-cyan-600 font-bold">{readingProgress.read}</span> of <span className="text-slate-500">{readingProgress.total}</span> meters read
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
      {topDelinquentCustomers.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase font-bold text-red-400 tracking-wider">Overdue Accounts</p>
              <p className="text-3xl font-black text-red-700">{topDelinquentCustomers.length}</p>
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

      {/* ── Navigation Cards ── */}
      <Card className="bg-slate-50 border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 font-bold">Quick Access</CardTitle>
          <CardDescription className="text-slate-600/70">Navigate quickly to key management areas.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/admin/bulk-meters" passHref>
            <Button variant="outline" className="w-full justify-start p-6 h-auto quick-access-btn bg-white hover:bg-slate-100 border-slate-200 transition-all duration-300 hover:shadow-md group">
              <Gauge className="mr-4 h-8 w-8 text-blue-500 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-bold text-slate-900 text-lg">View Bulk Meters</p>
                <p className="text-sm text-slate-500">Manage all bulk water meters.</p>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </Button>
          </Link>
          <Link href="/admin/individual-customers" passHref>
            <Button variant="outline" className="w-full justify-start p-6 h-auto quick-access-btn bg-white hover:bg-slate-100 border-slate-200 transition-all duration-300 hover:shadow-md group">
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
        <Card className="lg:col-span-2 shadow-md border-gray-100 overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50/50 border-b pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">Branch Performance (Bulk Meters - {selectedMonth})</CardTitle>
              <CardDescription>Paid vs. Unpaid status for bulk meters across branches.</CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setBranchPerformanceView(prev => prev === 'chart' ? 'table' : 'chart')} className="bg-white shadow-sm border">
              {branchPerformanceView === 'chart' ? <TableIcon className="mr-2 h-4 w-4" /> : <BarChartIcon className="mr-2 h-4 w-4" />}
              View {branchPerformanceView === 'chart' ? 'Table' : 'Chart'}
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Branch Traffic Lights – clickable Sheet triggers */}
            {dynamicBranchPerformanceData.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-100">
                {dynamicBranchPerformanceData.map((item) => {
                  const light = getBranchTrafficLight(item.paid, item.unpaid);
                  const dot = item.paid + item.unpaid === 0 ? '⚪' : (item.paid / (item.paid + item.unpaid)) >= 0.7 ? '🟢' : (item.paid / (item.paid + item.unpaid)) >= 0.3 ? '🟡' : '🔴';
                  const total = item.paid + item.unpaid;
                  const paidRatio = total > 0 ? Math.round((item.paid / total) * 100) : 0;

                  // Gather branch-level staff & meters for the drawer
                  const allBranches = getBranches();
                  const branchObj = allBranches.find(b => b.name.replace(/ Branch$/i, '') === item.branch || b.name === item.branch);
                  const branchId = branchObj?.id;

                  const allStaff = getStaffMembers();
                  const branchStaff = branchId ? allStaff.filter(s => s.branchId === branchId) : [];

                  const allCustomers = getCustomers();
                  const branchCustomers = branchId ? allCustomers.filter(c => (c as any).branchId === branchId) : [];

                  const allBulk = getBulkMeters();
                  const branchBulk = branchId ? allBulk.filter(m => (m as any).branchId === branchId) : [];

                  const allBillsList = getBills();
                  const branchBills = branchId
                    ? allBillsList.filter(b => b.CUSTOMERBRANCH && branchObj && b.CUSTOMERBRANCH.toLowerCase().includes(branchObj.name.toLowerCase()))
                    : [];
                  const outstanding = branchBills
                    .filter(b => b.paymentStatus === 'Unpaid')
                    .reduce((sum, b) => sum + (b.OUTSTANDINGAMT ?? 0), 0);

                  return (
                    <Sheet key={item.branch}>
                      <SheetTrigger asChild>
                        <button
                          className={`flex items-center gap-1.5 ${light.bg} border rounded-full px-3 py-1 cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400`}
                        >
                          <span className="text-sm">{dot}</span>
                          <span className={`text-xs font-bold ${light.color}`}>{item.branch}</span>
                          <span className="text-[10px] text-slate-400">({item.paid}/{total})</span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[380px] sm:w-[460px] overflow-y-auto">
                        <SheetHeader className="pb-4 border-b">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <SheetTitle className="text-lg font-black text-slate-900">{item.branch} Branch</SheetTitle>
                              <SheetDescription className="text-xs">{light.label} · {paidRatio}% collection rate</SheetDescription>
                            </div>
                          </div>
                        </SheetHeader>

                        <div className="mt-6 space-y-5">
                          {/* Collection Progress */}
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-2">Billing Collection</p>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-emerald-700 font-bold">{item.paid} Paid</span>
                              <span className="text-rose-600 font-bold">{item.unpaid} Unpaid</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  paidRatio >= 70 ? 'bg-emerald-500' : paidRatio >= 30 ? 'bg-amber-400' : 'bg-red-500'
                                }`}
                                style={{ width: `${paidRatio}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 text-right">{paidRatio}% of {total} meters collected</p>
                          </div>

                          {/* Outstanding Balance */}
                          {outstanding > 0 && (
                            <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                              <XCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-rose-400 font-bold uppercase tracking-wide">Outstanding Balance</p>
                                <p className="text-xl font-black text-rose-700">ETB {outstanding.toLocaleString()}</p>
                              </div>
                            </div>
                          )}

                          {/* Connections */}
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-2">Connections</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                                <p className="text-2xl font-black text-emerald-700">{branchCustomers.length}</p>
                                <p className="text-[10px] font-bold text-emerald-500 uppercase">Individual</p>
                              </div>
                              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                                <p className="text-2xl font-black text-purple-700">{branchBulk.length}</p>
                                <p className="text-[10px] font-bold text-purple-500 uppercase">Bulk Meters</p>
                              </div>
                            </div>
                          </div>

                          {/* Staff */}
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-2">Assigned Staff ({branchStaff.length})</p>
                            {branchStaff.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">No staff assigned to this branch.</p>
                            ) : (
                              <div className="space-y-2">
                                {branchStaff.slice(0, 8).map(s => (
                                  <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center">
                                        <span className="text-[10px] font-black text-blue-600">{s.name.charAt(0)}</span>
                                      </div>
                                      <p className="text-xs font-bold text-slate-800">{s.name}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      s.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                                    }`}>{s.role}</span>
                                  </div>
                                ))}
                                {branchStaff.length > 8 && (
                                  <p className="text-[10px] text-slate-400 text-center">+ {branchStaff.length - 8} more staff members</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                  );
                })}
              </div>
            )}
            {branchPerformanceView === 'chart' ? (
              <div className="h-[300px]">
                {isClient && dynamicBranchPerformanceData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                      <BarChart data={dynamicBranchPerformanceData}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="branch" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 500 }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 500 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend content={<ChartLegendContent />} />
                        <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} name="Paid" />
                        <Bar dataKey="unpaid" fill="#ef4444" radius={[4, 4, 0, 0]} name="Unpaid" />
                      </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground italic">
                    No branch performance data available for chart.
                  </div>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[300px] rounded-md border">
                {dynamicBranchPerformanceData.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-bold">Branch</TableHead>
                        <TableHead className="text-right font-bold">Paid</TableHead>
                        <TableHead className="text-right font-bold">Unpaid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dynamicBranchPerformanceData.map((item) => (
                        <TableRow key={item.branch} className="hover:bg-gray-50/50">
                          <TableCell className="font-medium text-gray-900">{item.branch}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-bold">{item.paid}</TableCell>
                          <TableCell className="text-right text-red-600 font-bold">{item.unpaid}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground italic">
                    No branch performance data available.
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Top Delinquent Customers List */}
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