
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Gauge,
  Users,
  ArrowRight,
  FileText,
  TrendingUp,
  AlertCircle,
  Table as TableIcon,
  UserCheck,
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
  Activity
} from 'lucide-react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  PieChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Pie,
  Cell,
  Bar,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { getBulkMeters, subscribeToBulkMeters, initializeBulkMeters, getCustomers, subscribeToCustomers, initializeCustomers, getBranches, initializeBranches, subscribeToBranches } from "@/lib/data-store";
import { getBranchesLookupAction, getDashboardMetricsAction } from "@/lib/actions";
import { format } from 'date-fns';
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS } from "@/lib/constants/auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDataRefresh } from "@/lib/data-refresh-context";
import { getGreeting, getGreetingEmoji, getEthiopianDateString } from "@/lib/date-clock-utils";
import { checkActualConnectivity } from "@/lib/offline-db";

interface User {
  email: string;
  role: "admin" | "staff" | "Admin" | "Staff" | "Head Office Management" | "Staff Management";
  branchName?: string;
  branchId?: string;
  permissions?: string[];
}

const chartConfig = {
  paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  unpaid: { label: "Unpaid", color: "hsl(var(--chart-3))" },
  waterUsage: { label: "Water Usage (m³)", color: "hsl(var(--chart-1))" },
} satisfies import("@/components/ui/chart").ChartConfig;

export default function StaffManagementDashboardPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const { currentUser } = useCurrentUser();
  const { isRefreshing, refresh: triggerRefresh } = useDataRefresh();

  const [authStatus, setAuthStatus] = React.useState<'loading' | 'unauthorized' | 'authorized'>('loading');
  const [staffBranchName, setStaffBranchName] = React.useState<string | null>(null);
  const [staffBranchId, setStaffBranchId] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);

  const [liveTime, setLiveTime] = React.useState<string>('');
  const [liveDate, setLiveDate] = React.useState<string>('');
  const [liveEthiopianDate, setLiveEthiopianDate] = React.useState<string>('');
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [isSyncing, setIsSyncing] = React.useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = React.useState<string>('');
  const [localLastUpdated, setLocalLastUpdated] = React.useState<string>('');

  const [allBranches, setAllBranches] = React.useState<Branch[]>([]);
  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);
  const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dashboardMetrics, setDashboardMetrics] = React.useState<any>(null);

  // State for toggling views
  const [branchPerformanceView, setBranchPerformanceView] = React.useState<'chart' | 'table'>('chart');
  const [waterUsageView, setWaterUsageView] = React.useState<'chart' | 'table'>('chart');

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

  // Auth check
  React.useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const performAuthCheck = async () => {
      const userString = localStorage.getItem("user");
      if (userString) {
        try {
          const parsedUser: User = JSON.parse(userString);
          const roleLower = parsedUser.role?.toLowerCase();
          const assignedPermissions = Array.isArray(parsedUser.permissions) ? parsedUser.permissions : [];
          const hasDashboardAccess = assignedPermissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL) || assignedPermissions.includes(PERMISSIONS.DASHBOARD_VIEW_BRANCH);

          if ((roleLower && (roleLower.includes('management') || roleLower.includes('manager'))) || hasDashboardAccess) {
            const hasValidBranchName = parsedUser.branchName && parsedUser.branchName !== 'Unknown Branch';
            if (parsedUser.branchId && hasValidBranchName) {
              if (isMounted) {
                setStaffBranchName(parsedUser.branchName ?? null);
                setStaffBranchId(parsedUser.branchId ?? null);
                setAuthStatus('authorized');
              }
            } else if (hasValidBranchName) {
              // Try to resolve branchId from known branches
              try {
                let branches: any[] = [];
                const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
                
                if (isOffline) {
                  try {
                    const cached = localStorage.getItem('cached_branches_lookup');
                    if (cached) branches = JSON.parse(cached);
                  } catch (e) { /* ignore */ }
                } else {
                  try {
                    const res = await getBranchesLookupAction();
                    branches = res.data || [];
                    if (res.data) {
                      localStorage.setItem('cached_branches_lookup', JSON.stringify(res.data));
                    }
                  } catch (e) {
                    console.warn("Branch lookup failed, trying cache", e);
                    try {
                      const cached = localStorage.getItem('cached_branches_lookup');
                      if (cached) branches = JSON.parse(cached);
                    } catch (err) { /* ignore */ }
                  }
                }

                const target = parsedUser.branchName || '';
                let branch = branches.find((b: any) => b.name === target);
                if (!branch) branch = branches.find((b: any) => (b.name || '').toLowerCase() === target.toLowerCase());
                if (branch && isMounted) {
                  parsedUser.branchId = branch.id;
                  try { localStorage.setItem('user', JSON.stringify(parsedUser)); } catch (e) { /* ignore */ }
                  setStaffBranchName(parsedUser.branchName ?? null);
                  setStaffBranchId(branch.id ?? null);
                  setAuthStatus('authorized');
                } else if (isMounted) {
                  if (isOffline) {
                    setStaffBranchName(parsedUser.branchName ?? null);
                    setStaffBranchId(parsedUser.branchId ?? null);
                    setAuthStatus('authorized');
                  } else {
                    setAuthStatus('unauthorized');
                  }
                }
              } catch (e) {
                if (isMounted) {
                  if (typeof window !== 'undefined' && !window.navigator.onLine) {
                    setStaffBranchName(parsedUser.branchName ?? null);
                    setStaffBranchId(parsedUser.branchId ?? null);
                    setAuthStatus('authorized');
                  } else {
                    setAuthStatus('unauthorized');
                  }
                }
              }
            } else if (parsedUser.branchId) {
              // branchId present but branchName missing — resolve from API
              try {
                let branches: any[] = [];
                const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
                
                if (isOffline) {
                  try {
                    const cached = localStorage.getItem('cached_branches_lookup');
                    if (cached) branches = JSON.parse(cached);
                  } catch (e) { /* ignore */ }
                } else {
                  try {
                    const res = await getBranchesLookupAction();
                    branches = res.data || [];
                    if (res.data) {
                      localStorage.setItem('cached_branches_lookup', JSON.stringify(res.data));
                    }
                  } catch (e) {
                    console.warn("Branch lookup failed, trying cache", e);
                    try {
                      const cached = localStorage.getItem('cached_branches_lookup');
                      if (cached) branches = JSON.parse(cached);
                    } catch (err) { /* ignore */ }
                  }
                }

                const branch = branches.find((b: any) => String(b.id) === String(parsedUser.branchId));
                if (branch && isMounted) {
                  parsedUser.branchName = branch.name;
                  try { localStorage.setItem('user', JSON.stringify(parsedUser)); } catch (e) { /* ignore */ }
                  setStaffBranchName(parsedUser.branchName ?? null);
                  setStaffBranchId(parsedUser.branchId ?? null);
                  setAuthStatus('authorized');
                } else if (isMounted) {
                  if (isOffline) {
                    setStaffBranchName(parsedUser.branchName ?? 'Offline Branch');
                    setStaffBranchId(parsedUser.branchId ?? null);
                    setAuthStatus('authorized');
                  } else {
                    setAuthStatus('unauthorized');
                  }
                }
              } catch (e) {
                if (isMounted) {
                  if (typeof window !== 'undefined' && !window.navigator.onLine) {
                    setStaffBranchName(parsedUser.branchName ?? 'Offline Branch');
                    setStaffBranchId(parsedUser.branchId ?? null);
                    setAuthStatus('authorized');
                  } else {
                    setAuthStatus('unauthorized');
                  }
                }
              }
            } else {
              if (isMounted) setAuthStatus('unauthorized');
            }
          } else {
            if (isMounted) setAuthStatus('unauthorized');
          }
        } catch (e) {
          if (isMounted) setAuthStatus('unauthorized');
        }
      } else {
        if (isMounted) setAuthStatus('unauthorized');
      }
    };

    // Start auth check with 8 second timeout
    performAuthCheck();
    timeoutId = setTimeout(() => {
      if (isMounted && authStatus === 'loading') {
        console.warn("Auth check timed out, setting to authorized with current user data");
        const userString = localStorage.getItem("user");
        if (userString) {
          try {
            const parsedUser: User = JSON.parse(userString);
            if (parsedUser.branchId) {
              setStaffBranchName(parsedUser.branchName ?? 'Offline Branch');
              setStaffBranchId(parsedUser.branchId);
              setAuthStatus('authorized');
              return;
            }
          } catch (e) { /* ignore */ }
        }
        setAuthStatus('unauthorized');
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [authStatus]);

  // Data loading, dependent on auth
  React.useEffect(() => {
    if (authStatus !== 'authorized') {
      if (authStatus !== 'loading') setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const initializeAndSubscribe = async () => {
      try {
        // 1. Fetch server-side metrics first for instant display
        const { data: metrics, error: metricsError } = await getDashboardMetricsAction();

        // Detect expired server session: localStorage still has user, but cookie is gone.
        const isAuthErr = (e: any) => /user not authenticated|unauthorized|forbidden/i.test(
          e?.message || e?.name || String(e)
        );
        if (metricsError && isAuthErr(metricsError)) {
          if (isMounted) {
            localStorage.removeItem('user');
            router.push('/');
          }
          return;
        }

        if (isMounted && metrics) {
          setDashboardMetrics(metrics);
        }
        if (isMounted) setIsLoading(false);

        // 2. Background data-store init for branch-scoped KPI cards
        Promise.all([initializeBranches(), initializeBulkMeters(), initializeCustomers()])
          .then(() => {
            if (isMounted) {
              setAllBranches(getBranches());
              setAllBulkMeters(getBulkMeters());
              setAllCustomers(getCustomers());
            }
          })
          .catch((err) => console.error("Background data-store init failed:", err));
      } catch (err) {
        console.error("Failed to initialize dashboard data:", err);
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAndSubscribe();

    const unSubBranches = subscribeToBranches((data) => isMounted && setAllBranches(data));
    const unSubBulkMeters = subscribeToBulkMeters((data) => isMounted && setAllBulkMeters(data));
    const unSubCustomers = subscribeToCustomers((data) => isMounted && setAllCustomers(data));

    return () => {
      isMounted = false;
      unSubBranches();
      unSubBulkMeters();
      unSubCustomers();
    };
  }, [authStatus]);

  // Derived state with useMemo
  const processedStats = React.useMemo(() => {
    const defaultMonth = format(new Date(), 'yyyy-MM');
    if (authStatus !== 'authorized' || !staffBranchId) {
      return { 
        totalBulkMeters: 0, 
        totalCustomers: 0, 
        totalBills: 0, 
        paidBills: 0, 
        unpaidBills: 0, 
        billsData: [], 
        revenueEfficiency: { billed: 0, collected: 0, efficiency: 0 },
        readingProgress: { total: 0, read: 0, percentage: 0 },
        todayActivity: { bills: 0, readings: 0, customers: 0 },
        topDelinquentAccounts: [],
        branchPerformanceData: [], 
        waterUsageTrendData: [], 
        paidPercentage: "0%", 
        currentMonthYear: defaultMonth 
      };
    }

    const currentMonthYear = dashboardMetrics?.latestMonth || format(new Date(), 'yyyy-MM');

    // ── Branch-scoped KPI cards (local data-store, branch-filtered) ────────────
    const branchBMs = allBulkMeters.filter(bm => bm.branchId === staffBranchId);
    const branchBMKeys = new Set(branchBMs.map(bm => bm.customerKeyNumber));
    const branchCustomers = allCustomers.filter(customer =>
      customer.branchId === staffBranchId ||
      (customer.assignedBulkMeterId && branchBMKeys.has(customer.assignedBulkMeterId))
    );

    // ── Bill counts — prefer server-side metrics (all bills, accurate) ──────────
    const metrics = dashboardMetrics;
    const billStatusCounts = metrics?.billStatuses ?? [];
    const serverPaid = metrics ? (Number(billStatusCounts.find((s: any) => s.status === 'Paid')?.count) || 0) : 0;
    const serverUnpaid = metrics ? (Number(billStatusCounts.find((s: any) => s.status === 'Unpaid')?.count) || 0) : 0;
    const serverTotalBills = serverPaid + serverUnpaid;

    // Local fallback if server metrics not yet loaded
    const currentMonthBMs = branchBMs.filter(bm => bm.month === currentMonthYear);
    const currentMonthCustomers = branchCustomers.filter(c => c.month === currentMonthYear && c.status === 'Active');
    const localPaid = currentMonthBMs.filter(bm => bm.paymentStatus === 'Paid').length
      + currentMonthCustomers.filter(c => c.paymentStatus === 'Paid').length;
    const localUnpaid = currentMonthBMs.filter(bm => bm.paymentStatus === 'Unpaid').length
      + currentMonthCustomers.filter(c => c.paymentStatus === 'Unpaid' || c.paymentStatus === 'Pending').length;

    const paidCount = metrics ? serverPaid : localPaid;
    const unpaidCount = metrics ? serverUnpaid : localUnpaid;
    const totalBillsCount = metrics ? serverTotalBills : (localPaid + localUnpaid);
    const billsData = [
      { name: 'Paid', value: paidCount, fill: 'hsl(var(--chart-1))' },
      { name: 'Unpaid', value: unpaidCount, fill: 'hsl(var(--chart-3))' },
    ];
    const paidPercentage = totalBillsCount > 0 ? `${((paidCount / totalBillsCount) * 100).toFixed(0)}%` : "0%";

    // ── Branch Performance — prefer server-side metrics ──────────────────────────
    const serverBranchPerf = metrics?.branchPerformance?.map((item: any) => ({
      branch: (item.branch_name || item.branch || '').replace(/ Branch$/i, ''),
      paid: Number(item.paid || 0),
      unpaid: Number(item.unpaid || 0),
    })) ?? null;

    // Local fallback for branch performance
    const performanceMap = new Map<string, { branchName: string, paid: number, unpaid: number }>();
    const displayableBranches = allBranches.filter(b => b.name.toLowerCase() !== 'head office');
    displayableBranches.forEach(branch => {
      performanceMap.set(branch.id, { branchName: branch.name, paid: 0, unpaid: 0 });
    });
    allBulkMeters.filter(bm => bm.month === currentMonthYear).forEach(bm => {
      if (bm.branchId && performanceMap.has(bm.branchId)) {
        const entry = performanceMap.get(bm.branchId)!;
        if (bm.paymentStatus === 'Paid') entry.paid++;
        else if (bm.paymentStatus === 'Unpaid') entry.unpaid++;
        performanceMap.set(bm.branchId, entry);
      }
    });
    const localBranchPerf = Array.from(performanceMap.values()).map(p => ({ branch: p.branchName.replace(/ Branch$/i, ''), paid: p.paid, unpaid: p.unpaid }));
    const branchPerformanceData = serverBranchPerf ?? localBranchPerf;

    // ── Water Usage Trend — prefer server-side metrics ──────────────────────────
    const serverUsageTrend = metrics?.usageTrend?.map((item: any) => ({
      month: item.month,
      usage: Number(item.usage || 0),
    }))?.sort((a: any, b: any) => new Date(a.month + '-01').getTime() - new Date(b.month + '-01').getTime()) ?? null;

    // Local fallback for water usage trend
    const usageMap = new Map<string, number>();
    branchBMs.forEach(bm => {
      if (bm.month) {
        const usage = bm.currentReading - bm.previousReading;
        if (typeof usage === 'number' && !isNaN(usage)) {
          usageMap.set(bm.month, (usageMap.get(bm.month) || 0) + usage);
        }
      }
    });
    branchCustomers.forEach(c => {
      if (c.month) {
        const usage = c.currentReading - c.previousReading;
        if (typeof usage === 'number' && !isNaN(usage)) {
          usageMap.set(c.month, (usageMap.get(c.month) || 0) + usage);
        }
      }
    });
    const localUsageTrend = Array.from(usageMap.entries())
      .map(([month, usage]) => ({ month, usage }))
      .sort((a, b) => new Date(a.month + '-01').getTime() - new Date(b.month + '-01').getTime());
    const waterUsageTrendData = serverUsageTrend ?? localUsageTrend;

    const revenueEfficiency = {
      billed: Number(metrics?.revenue?.totalBilled || 0),
      collected: Number(metrics?.revenue?.totalCollected || 0),
      efficiency: Number(metrics?.revenue?.efficiency || 0),
    };

    const readingProgress = {
      total: Number(metrics?.readings?.totalCustomers || (branchBMs.length + branchCustomers.length)),
      read: Number(metrics?.readings?.completedReadings || 0),
      percentage: Number(metrics?.readings?.progress || 0),
    };

    const todayActivity = {
      bills: Number(metrics?.todayActivity?.bills || 0),
      readings: Number(metrics?.todayActivity?.readings || 0),
      customers: Number(metrics?.todayActivity?.customers || 0),
    };

    const topDelinquentAccounts = metrics?.delinquent?.combined?.map((bill: any) => ({
      name: bill.name || 'Unknown Account',
      balance: Number(bill.outstanding || 0),
      type: bill.type || 'Bulk'
    })) ?? [];

    return {
      totalBulkMeters: branchBMs.length,
      totalCustomers: branchCustomers.length,
      totalBills: totalBillsCount,
      paidBills: paidCount,
      unpaidBills: unpaidCount,
      billsData,
      revenueEfficiency,
      readingProgress,
      todayActivity,
      topDelinquentAccounts,
      branchPerformanceData,
      waterUsageTrendData,
      paidPercentage,
      currentMonthYear,
    };
  }, [authStatus, staffBranchId, allBulkMeters, allCustomers, allBranches, dashboardMetrics]);


  if (isLoading || authStatus === 'loading') {
    return <div className="p-4 text-center">Loading dashboard data...</div>;
  }

  if (authStatus === 'unauthorized') {
    return (
      <div className="flex items-center justify-center pt-20">
        <Card className="w-full max-w-lg border-red-200 shadow-lg bg-red-50/50 dark:bg-destructive/10">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-destructive text-xl">Access Denied</CardTitle>
            <CardDescription className="text-destructive/80 px-4">
              Your user profile is not correctly configured for a Staff Management role or branch. Please contact an administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header: Greeting + Live Clock ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold">Staff Management Dashboard</h1>
            {staffBranchName && (
              <Badge variant="secondary" className="bg-blue-600 text-white font-bold px-2.5 py-0.5 border-none shadow-sm text-xs">
                {staffBranchName} Branch
              </Badge>
            )}
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
              onClick={() => triggerRefresh()}
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
              {currentUser?.name ? currentUser.name.split(" ")[0] : "Manager"}
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
          { label: 'Staff Management', icon: Users, href: '/staff/staff-management', color: 'bg-rose-500 hover:bg-rose-600', perm: hasPermission('staff_view_branch') || hasPermission('staff_view_all') || hasPermission('staff_view') },
          { label: 'Data Entry', icon: DatabaseZap, href: '/staff/data-entry', color: 'bg-blue-500 hover:bg-blue-600', perm: hasPermission('customers_create') || hasPermission('bulk_meters_create') },
          { label: 'Bill Management', icon: FileText, href: '/staff/bill-management', color: 'bg-violet-500 hover:bg-violet-600', perm: hasPermission('bill_view_branch') || hasPermission('bill_view_all') || hasPermission('billing_view') },
          { label: 'Reports', icon: BarChartIcon, href: '/staff/reports', color: 'bg-emerald-500 hover:bg-emerald-600', perm: hasPermission('reports_view_branch') || hasPermission('reports_view_all') },
          { label: 'Meter Readings', icon: Gauge, href: '/staff/meter-readings', color: 'bg-amber-500 hover:bg-amber-600', perm: hasPermission('meter_readings_view_branch') || hasPermission('meter_readings_view_all') || hasPermission('meter_readings_create') },
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
          { label: "Bills Today", value: processedStats.todayActivity.bills, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: "Readings Today", value: processedStats.todayActivity.readings, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: "Customers Added", value: processedStats.todayActivity.customers, icon: UserPlus, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
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
        {/* Bills Status Card */}
        <Card className="group shadow-sm hover:shadow-xl border border-blue-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f4f7ff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <FileText className="h-48 w-48 text-blue-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Bills ({processedStats.currentMonthYear})</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-blue-900 transition-colors">{processedStats.totalBills.toLocaleString()}</div>
              <div className="text-lg font-bold text-slate-500 mb-1">Bills</div>
            </div>
            <p className="text-sm text-slate-600 font-semibold mt-2">
              <span className="text-emerald-600">{processedStats.paidBills} Paid</span> <span className="mx-2 text-slate-300">|</span> <span className="text-rose-500">{processedStats.unpaidBills} Unpaid</span>
            </p>
            <div className="h-[100px] mt-6 relative flex items-center justify-center">
              {isClient && processedStats.totalBills > 0 ? (
                <ChartContainer config={chartConfig} className="w-full h-full">
                    <PieChart>
                      <Pie data={processedStats.billsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={45} paddingAngle={4} stroke="none">
                        {processedStats.billsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} className="drop-shadow-sm hover:opacity-80 transition-opacity" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltipContent hideLabel />} />
                    </PieChart>
                </ChartContainer>
              ) : (
                <div className="text-sm font-semibold text-blue-600/80 italic w-full text-center mt-6">No bill data for this cycle</div>
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
                {processedStats.revenueEfficiency.efficiency.toFixed(1)}<span className="text-3xl text-amber-500/50">%</span>
              </div>
              {/* KPI Target Badge */}
              {processedStats.revenueEfficiency.billed > 0 && (
                <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                  processedStats.revenueEfficiency.efficiency >= 80
                    ? 'bg-emerald-100 text-emerald-700'
                    : processedStats.revenueEfficiency.efficiency >= 50
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  <Target className="h-3 w-3" />
                  {processedStats.revenueEfficiency.efficiency >= 80 ? '✅ On Target'
                    : processedStats.revenueEfficiency.efficiency >= 50 ? '⚠️ Below Target'
                    : '🚨 Critical'}
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600 font-semibold mb-4">Collection Efficiency <span className="text-xs text-slate-400 font-normal">(target: 80%)</span></p>

            <div className="flex justify-between items-center mb-4 pt-1">
              <div>
                <p className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Total Billed</p>
                <p className="text-base font-black text-slate-800"><span className="text-xs text-slate-400 mr-1">ETB</span>{processedStats.revenueEfficiency.billed.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Collected</p>
                <p className="text-base font-black text-emerald-700"><span className="text-xs text-slate-400 mr-1">ETB</span>{processedStats.revenueEfficiency.collected.toLocaleString()}</p>
              </div>
            </div>

            {/* Sparkline progress bar */}
            {isClient && processedStats.revenueEfficiency.billed > 0 ? (
              <div className="space-y-1.5">
                <div className="w-full bg-amber-900/5 rounded-full h-2.5 overflow-hidden flex shadow-inner">
                  <div className="bg-gradient-to-r from-amber-300 to-amber-500 h-full transition-all duration-1000 ease-out rounded-full" style={{ width: `${processedStats.revenueEfficiency.efficiency}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                  <span>0%</span>
                  <span className="text-amber-600 font-bold">{processedStats.revenueEfficiency.efficiency.toFixed(1)}% collected</span>
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
              {processedStats.readingProgress.percentage.toFixed(1)}<span className="text-3xl text-cyan-500/50">%</span>
            </div>
            <p className="text-sm text-slate-600 font-semibold mb-8">
              <span className="text-cyan-600 font-bold">{processedStats.readingProgress.read}</span> of <span className="text-slate-500">{processedStats.readingProgress.total}</span> meters read
            </p>
            
            <div className="mt-4 pt-2">
              <div className="w-full bg-cyan-900/5 rounded-full h-3 overflow-hidden shadow-inner relative mb-3">
                <div
                  className="bg-cyan-500 h-full relative overflow-hidden transition-all duration-1000 ease-out"
                  style={{ width: `${processedStats.readingProgress.percentage}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_1s_linear_infinite]" />
                </div>
              </div>
              <div className="text-[10px] text-cyan-700 font-bold uppercase tracking-widest italic flex items-center justify-center gap-2">
                {processedStats.readingProgress.percentage === 100 ? (
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
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Customers in {staffBranchName}</CardTitle>
            <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-12 flex flex-col justify-between relative z-10">
            <div>
              <div className="text-5xl lg:text-7xl font-black text-slate-800 tracking-tight mb-2 group-hover:text-emerald-900 transition-colors">{processedStats.totalCustomers.toLocaleString()}</div>
              <p className="text-base text-slate-600 font-semibold">Total active accounts in branch</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Bulk Meters */}
        <Card className="group shadow-sm hover:shadow-xl border border-purple-100/80 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#faf5ff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 pointer-events-none -mb-8 -mr-8 group-hover:scale-110">
            <Gauge className="h-64 w-64 text-purple-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Bulk Meters in {staffBranchName}</CardTitle>
            <div className="h-10 w-10 shrink-0 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Gauge className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-12 flex flex-col justify-between relative z-10">
            <div>
              <div className="text-5xl lg:text-7xl font-black text-slate-800 tracking-tight mb-2 group-hover:text-purple-900 transition-colors">{processedStats.totalBulkMeters.toLocaleString()}</div>
              <p className="text-base text-slate-600 font-semibold">Total registered bulk meters in branch</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Overdue Bills Alert Card ── */}
      {processedStats.topDelinquentAccounts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase font-bold text-red-400 tracking-wider">Overdue Accounts</p>
              <p className="text-3xl font-black text-red-700">{processedStats.topDelinquentAccounts.length}</p>
              <p className="text-xs text-red-500 font-semibold">With outstanding balances</p>
            </div>
            <Link href="/staff/bill-management" passHref>
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
                ETB {processedStats.topDelinquentAccounts[0]?.balance.toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600 font-semibold truncate max-w-[160px]">{processedStats.topDelinquentAccounts[0]?.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Access ── */}
      <Card className="bg-slate-50 border-slate-100 shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="text-slate-900 font-bold">Quick Access</CardTitle>
          <CardDescription className="text-slate-600/70">Navigate quickly to key management areas for your branch.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/staff/bulk-meters" passHref>
            <Button variant="outline" className="w-full justify-start p-6 h-auto quick-access-btn bg-white hover:bg-slate-100 border-slate-200 transition-all duration-300 hover:shadow-md group rounded-2xl">
              <Gauge className="mr-4 h-8 w-8 text-blue-500 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-bold text-slate-900 text-lg">View Bulk Meters</p>
                <p className="text-sm text-slate-500">Manage bulk water meters in your branch.</p>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </Button>
          </Link>
          <Link href="/staff/individual-customers" passHref>
            <Button variant="outline" className="w-full justify-start p-6 h-auto quick-access-btn bg-white hover:bg-slate-100 border-slate-200 transition-all duration-300 hover:shadow-md group rounded-2xl">
              <Users className="mr-4 h-8 w-8 text-emerald-500 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-bold text-slate-900 text-lg">View Individual Customers</p>
                <p className="text-sm text-slate-500">Manage individual customer accounts in your branch.</p>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Branch Performance (Bulk Meters - {processedStats.currentMonthYear})</CardTitle>
              <CardDescription>Paid vs. Unpaid status for bulk meters across branches.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setBranchPerformanceView(prev => prev === 'chart' ? 'table' : 'chart')}>
              {branchPerformanceView === 'chart' ? <TableIcon className="mr-2 h-4 w-4" /> : <BarChartIcon className="mr-2 h-4 w-4" />}
              View {branchPerformanceView === 'chart' ? 'Table' : 'Chart'}
            </Button>
          </CardHeader>
          <CardContent>
            {branchPerformanceView === 'chart' ? (
              <div className="h-[300px]">
                {isClient && processedStats.branchPerformanceData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                      <BarChart data={processedStats.branchPerformanceData}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="branch" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="paid" stackId="a" fill="var(--color-paid)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="unpaid" stackId="a" fill="var(--color-unpaid)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground">
                    No branch performance data available.
                  </div>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                {processedStats.branchPerformanceData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Unpaid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedStats.branchPerformanceData.map((item: { branch: string; paid: number; unpaid: number }) => (
                        <TableRow key={item.branch}>
                          <TableCell className="font-medium">{item.branch}</TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400">{item.paid}</TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">{item.unpaid}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground">
                    No branch performance data available.
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Water Usage Trend ({staffBranchName})</CardTitle>
              <CardDescription>Monthly water consumption for your branch.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setWaterUsageView(prev => prev === 'chart' ? 'table' : 'chart')}>
              {waterUsageView === 'chart' ? <TableIcon className="mr-2 h-4 w-4" /> : <BarChartIcon className="mr-2 h-4 w-4" />}
              View {waterUsageView === 'chart' ? 'Table' : 'Chart'}
            </Button>
          </CardHeader>
          <CardContent>
            {waterUsageView === 'chart' ? (
              <div className="h-[300px]">
                {isClient && processedStats.waterUsageTrendData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                      <LineChart data={processedStats.waterUsageTrendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(value) => `${value.toLocaleString()}`} tick={{ fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line type="monotone" dataKey="usage" name="Water Usage" stroke="var(--color-waterUsage)" />
                      </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground">
                    No water usage data available for chart.
                  </div>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                {processedStats.waterUsageTrendData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Water Usage (m³)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedStats.waterUsageTrendData.map((item: { month: string; usage: number }) => (
                        <TableRow key={item.month}>
                          <TableCell className="font-medium">{item.month}</TableCell>
                          <TableCell className="text-right">{item.usage.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground">
                    No water usage data available.
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
