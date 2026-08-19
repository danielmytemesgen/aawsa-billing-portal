
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
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
  Calendar,
  RotateCcw,
  LayoutDashboard,
  CreditCard,
  Activity,
  Lock as LockIcon,
  BarChart3,
  AlertTriangle,
  XCircle,
  Clock,
  Bell,
  DatabaseZap,
  UserPlus,
  Wifi,
  WifiOff,
  RefreshCw,
  Target,
  CheckCircle2
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
import { getBranchesLookupAction, getReadingPeriodStatusAction, getReadingPeriodDetailsAction, getDashboardMetricsAction, type ReadingPeriodDetails } from "@/lib/actions";
import { useDataRefresh } from "@/lib/data-refresh-context";
import { isReaderStaff } from "@/lib/meter-reading-permissions";
import {
  initializeBranches,
  initializeBulkMeters,
  initializeCustomers,
  initializeIndividualCustomerReadings,
  initializeBulkMeterReadings,
  initializeStaffMembers,
  fetchRoutes,
  getBranches,
  getBulkMeters,
  getCustomers,
  getIndividualCustomerReadings,
  getBulkMeterReadings,
  getRoutes,
  getStaffMembers
} from "@/lib/data-store";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PERMISSIONS } from "@/lib/constants/auth";
import { getEffectiveBranchId } from "@/lib/branch-permissions";
import { ReaderReport } from "./reader-report";
import { getMonthlyBillAmt } from "@/lib/billing-utils";
import { getGreeting, getGreetingEmoji, getEthiopianDateString } from "@/lib/date-clock-utils";
import { checkActualConnectivity } from "@/lib/offline-db";

interface User {
  email: string;
  role: "admin" | "staff" | "reader" | "Admin" | "Staff" | "Reader" | "Head Office Management" | "Staff Management";
  branchName?: string;
  branchId?: string;
  permissions?: string[];
}

const chartConfig = {
  paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  unpaid: { label: "Unpaid", color: "hsl(var(--chart-3))" },
  waterUsage: { label: "Water Usage (m³)", color: "hsl(var(--chart-1))" },
} satisfies import("@/components/ui/chart").ChartConfig;

interface AnomalyRecord {
  key: string;
  name: string;
  type: 'Bulk' | 'Individual';
  reason: string;
  severity: 'high' | 'medium';
  usage: number;
}

export default function StaffDashboardPage() {
  const { hasPermission } = usePermissions();
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const [authStatus, setAuthStatus] = React.useState<'loading' | 'unauthorized' | 'authorized'>('loading');
  const [staffBranchName, setStaffBranchName] = React.useState<string | null>(null);
  const [staffBranchId, setStaffBranchId] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  const { isRefreshing, refresh: triggerRefresh } = useDataRefresh();
  const [localLastUpdated, setLocalLastUpdated] = React.useState<string>('');

  const [liveTime, setLiveTime] = React.useState<string>('');
  const [liveDate, setLiveDate] = React.useState<string>('');
  const [liveEthiopianDate, setLiveEthiopianDate] = React.useState<string>('');
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [isSyncing, setIsSyncing] = React.useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = React.useState<string>('');

  const [allBranches, setAllBranches] = React.useState<Branch[]>([]);
  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);
  const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
  const [allIndividualReadings, setAllIndividualReadings] = React.useState<any[]>([]);
  const [allBulkReadings, setAllBulkReadings] = React.useState<any[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = React.useState<any>(null);
  const [readingPeriodStatus, setReadingPeriodStatus] = React.useState<'Open' | 'Closed' | 'Ready for New Reading'>('Open');
  const [periodDetails, setPeriodDetails] = React.useState<ReadingPeriodDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

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
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const parsedUser: User = JSON.parse(userString);
        const role = (parsedUser.role || '').toLowerCase();
        const assignedPermissions = Array.isArray(parsedUser.permissions) ? parsedUser.permissions : [];
        const hasDashboardAccess = assignedPermissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL) || assignedPermissions.includes(PERMISSIONS.DASHBOARD_VIEW_BRANCH);

        const isFieldReader = 
          assignedPermissions.includes('meter_readings_create_bulk') || 
          assignedPermissions.includes('meter_readings_create_individual') || 
          assignedPermissions.includes('meter_readings_create') || 
          assignedPermissions.includes('routes_view_assigned');

        // Allow any role that has dashboard access or meter reading field permissions
        if (hasDashboardAccess || isFieldReader) {
          const hasValidBranchName = parsedUser.branchName && parsedUser.branchName !== 'Unknown Branch';

          if (parsedUser.branchId && hasValidBranchName) {
            setStaffBranchName(parsedUser.branchName ?? null);
            setStaffBranchId(parsedUser.branchId ?? null);
            setAuthStatus('authorized');
          } else if (hasValidBranchName) {
            (async () => {
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
                    console.warn("Offline fetch during branch resolution failed, trying cache", e);
                    try {
                      const cached = localStorage.getItem('cached_branches_lookup');
                      if (cached) branches = JSON.parse(cached);
                    } catch (err) { /* ignore */ }
                  }
                }

                const target = parsedUser.branchName || '';
                let branch = branches.find((b: any) => b.name === target);
                if (!branch) {
                  const targetLower = target.toLowerCase();
                  branch = branches.find((b: any) => (b.name || '').toLowerCase() === targetLower);
                }
                if (!branch) {
                  branch = branches.find((b: any) => String(b.id) === String(target));
                }

                if (branch) {
                  parsedUser.branchId = branch.id;
                  try { localStorage.setItem('user', JSON.stringify(parsedUser)); } catch (e) { /* ignore */ }
                  setStaffBranchName(parsedUser.branchName ?? null);
                  setStaffBranchId(parsedUser.branchId ?? null);
                  setAuthStatus('authorized');
                } else {
                  if (isOffline) {
                    setStaffBranchName(parsedUser.branchName ?? null);
                    setStaffBranchId(parsedUser.branchId ?? null);
                    setAuthStatus('authorized');
                  } else {
                    setAuthStatus('unauthorized');
                  }
                }
              } catch (e) {
                console.error('Failed to resolve branch during auth check:', e);
                if (typeof window !== 'undefined' && !window.navigator.onLine) {
                  setStaffBranchName(parsedUser.branchName ?? null);
                  setStaffBranchId(parsedUser.branchId ?? null);
                  setAuthStatus('authorized');
                } else {
                  setAuthStatus('unauthorized');
                }
              }
            })();
          } else if (parsedUser.branchId) {
            (async () => {
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
                    console.warn("Offline fetch during branch resolution failed, trying cache", e);
                    try {
                      const cached = localStorage.getItem('cached_branches_lookup');
                      if (cached) branches = JSON.parse(cached);
                    } catch (err) { /* ignore */ }
                  }
                }

                const branch = branches.find((b: any) => String(b.id) === String(parsedUser.branchId));
                if (branch) {
                  parsedUser.branchName = branch.name;
                  try { localStorage.setItem('user', JSON.stringify(parsedUser)); } catch (e) { /* ignore */ }
                  setStaffBranchName(parsedUser.branchName ?? null);
                  setStaffBranchId(parsedUser.branchId ?? null);
                  setAuthStatus('authorized');
                } else {
                  if (isOffline) {
                    setStaffBranchName(parsedUser.branchName ?? 'Offline Branch');
                    setStaffBranchId(parsedUser.branchId ?? null);
                    setAuthStatus('authorized');
                  } else {
                    setAuthStatus('unauthorized');
                  }
                }
              } catch (e) {
                console.error('Failed to fetch branches during auth check:', e);
                if (typeof window !== 'undefined' && !window.navigator.onLine) {
                  setStaffBranchName(parsedUser.branchName ?? 'Offline Branch');
                  setStaffBranchId(parsedUser.branchId ?? null);
                  setAuthStatus('authorized');
                } else {
                  setAuthStatus('unauthorized');
                }
              }
            })();
          } else {
            setStaffBranchName(parsedUser.branchName ?? null);
            setStaffBranchId(parsedUser.branchId ?? null);
            setAuthStatus('authorized');
          }
        } else {
          setAuthStatus('unauthorized');
        }
      } catch (e) {
        setAuthStatus('unauthorized');
      }
    } else {
      setAuthStatus('unauthorized');
    }
  }, []);

  const [allRoutes, setAllRoutes] = React.useState<any[]>([]);
  const [allStaff, setAllStaff] = React.useState<any[]>([]);

  const initializeData = async () => {
    if (authStatus !== 'authorized') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // 1. Fetch dashboard metrics first for instant display
      await fetchDashboardMetrics();
      setIsLoading(false);

      // 2. Fetch reading period status & details (non-blocking)
      const fetchPeriodStatus = async () => {
        const isOfflineStatus = typeof window !== 'undefined' && !window.navigator.onLine;
        if (isOfflineStatus) {
          const cached = localStorage.getItem('cached_period_status');
          const cachedStart = localStorage.getItem('cached_period_start_date');
          const cachedEnd = localStorage.getItem('cached_period_end_date');
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          let offlineStatus: any = 'Closed';
          if (cachedStart && cachedEnd) {
            if (todayStr >= cachedStart && todayStr <= cachedEnd) {
              offlineStatus = 'Open';
            } else if (todayStr < cachedStart) {
              offlineStatus = 'Ready for New Reading';
            } else {
              offlineStatus = 'Closed';
            }
          } else if (cached) {
            offlineStatus = cached as any;
          }
          setReadingPeriodStatus(offlineStatus);
        } else {
          try {
            const details = await getReadingPeriodDetailsAction();
            if (details) {
              setPeriodDetails(details);
              setReadingPeriodStatus(details.status);
              localStorage.setItem('cached_period_status', details.status);
              if (details.startDate) localStorage.setItem('cached_period_start_date', details.startDate);
              if (details.endDate) localStorage.setItem('cached_period_end_date', details.endDate);
            }
          } catch (err) {
            console.warn("Offline: failed to fetch reading period details, calculating from cache", err);
            const cached = localStorage.getItem('cached_period_status');
            setReadingPeriodStatus((cached as any) || 'Closed');
          }
        }
      };
      fetchPeriodStatus();

      // 3. Background pre-warming of cache
      const initTasks: Promise<any>[] = [
        initializeBulkMeters(true),
        initializeCustomers(true),
      ];

      // Guard bills data
      if (hasPermission('bill_view_all') || 
          hasPermission('bill_view_branch') || 
          hasPermission('billing_view')) {
        // Dashboard metrics are computed on the server; avoid fetching full bill lists for initial page load.
      }

      // Guard reading-related data
      if (hasPermission('meter_readings_view_all') || 
          hasPermission('meter_readings_view_branch') || 
          hasPermission('meter_readings_create')) {
        initTasks.push(initializeIndividualCustomerReadings(true));
        initTasks.push(initializeBulkMeterReadings(true));
      }

      // Guard route data
      if (hasPermission('routes_view_all') || 
          hasPermission('routes_view_assigned') || 
          hasPermission('meter_readings_analytics_view')) {
        initTasks.push(fetchRoutes());
      }

      // Only fetch staff members if user has permission
      if (hasPermission('staff_view')) {
        initTasks.push(initializeStaffMembers());
      }

      const branchResultPromise = (async () => {
        const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
        if (isOffline) {
          try {
            const cached = localStorage.getItem('cached_branches_lookup');
            if (cached) return { data: JSON.parse(cached) };
          } catch (e) {
            console.warn("Failed to load cached branches lookup:", e);
          }
          return { data: [] };
        }
        try {
          const res = await getBranchesLookupAction();
          if (res && res.data) {
            try {
              localStorage.setItem('cached_branches_lookup', JSON.stringify(res.data));
            } catch (e) {
              console.warn("Failed to cache branches lookup:", e);
            }
          }
          return res;
        } catch (e) {
          console.warn("Offline: failed to fetch branches lookup", e);
          try {
            const cached = localStorage.getItem('cached_branches_lookup');
            if (cached) return { data: JSON.parse(cached) };
          } catch (err) { /* ignore */ }
          return { data: [] };
        }
      })();

      Promise.all([
        Promise.all(initTasks),
        branchResultPromise,
      ]).then(([, branchResult]) => {
        if (branchResult && branchResult.data) {
          setAllBranches(branchResult.data as any[]);
        }
        setAllBulkMeters(getBulkMeters());
        setAllCustomers(getCustomers());
        setAllIndividualReadings(getIndividualCustomerReadings());
        setAllBulkReadings(getBulkMeterReadings());
        setAllRoutes(getRoutes());
        setAllStaff(getStaffMembers());
      }).catch((err) => {
        console.error("Background data-store pre-warming failed:", err);
      });

    } catch (err) {
      console.error("Failed to fetch live dashboard metrics:", err);
      setIsLoading(false);
    }
  };

  const fetchDashboardMetrics = async () => {
    try {
      const { data: metrics, error } = await getDashboardMetricsAction();

      // Detect expired server session: localStorage still has user but cookie is gone.
      const isAuthErr = (e: any) => /user not authenticated|unauthorized/i.test(
        e?.message || e?.name || String(e)
      );
      const isForbiddenError = (e: any) => /forbidden/i.test(
        e?.message || e?.name || String(e)
      );

      if (error && isAuthErr(error)) {
        localStorage.removeItem('user');
        router.push('/');
        return;
      }

      if (error && isForbiddenError(error)) {
        console.warn('Dashboard metrics unavailable for this reader role; continuing without metrics.');
        return;
      }

      if (metrics) {
        setDashboardMetrics(metrics);
      } else if (error) {
        console.warn('Dashboard metrics fetch error:', error);
      }
    } catch (err) {
      console.warn('Failed to load dashboard metrics:', err);
    }
  };

  React.useEffect(() => {
    initializeData();
  }, [authStatus]);

  // ── Listen for background refresh events from DataRefreshProvider ──────────
  React.useEffect(() => {
    const handleDataRefreshed = () => {
      if (authStatus === 'authorized') {
        fetchDashboardMetrics();
        // Update local stores from refreshed data-store
        setAllBulkMeters(getBulkMeters());
        setAllCustomers(getCustomers());
        setAllIndividualReadings(getIndividualCustomerReadings());
        setAllBulkReadings(getBulkMeterReadings());
        setLocalLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    };
    window.addEventListener('data-refreshed', handleDataRefreshed);
    return () => window.removeEventListener('data-refreshed', handleDataRefreshed);
  }, [authStatus]);

  const currentMonthYear = format(new Date(), 'yyyy-MM');

  // Derived state with useMemo
  const processedStats = React.useMemo(() => {
    const defaultMonth = format(new Date(), 'yyyy-MM');
    if (authStatus !== 'authorized') {
      return { 
        selectedMonth: defaultMonth,
        totalBulkMeters: 0, 
        totalCustomers: 0, 
        totalBills: 0, 
        paidBills: 0, 
        unpaidBills: 0, 
        billsPaymentStatusData: [], 
        revenueEfficiency: { billed: 0, collected: 0, efficiency: 0 },
        readingProgress: { total: 0, read: 0, percentage: 0 },
        todayActivity: { bills: 0, readings: 0, customers: 0 },
        branchPerformanceData: [], 
        waterUsageTrendData: [], 
        topDelinquentAccounts: [], 
        paidPercentage: "0%", 
        pendingApprovals: 0 
      };
    }

    const currentMonthYear = dashboardMetrics?.latestMonth || format(new Date(), 'yyyy-MM');

    // Determine effective branch: undefined = all branches (view_all perm), string = own branch only
    const effectiveBranchId = getEffectiveBranchId(hasPermission, 'dashboard', staffBranchId);

    const branchBMs = effectiveBranchId
      ? allBulkMeters.filter(bm => bm.branchId === effectiveBranchId)
      : allBulkMeters;
    const branchBMKeys = new Set(branchBMs.map(bm => bm.customerKeyNumber));
    const branchCustomers = effectiveBranchId
      ? allCustomers.filter(customer =>
          customer.branchId === effectiveBranchId ||
          (customer.assignedBulkMeterId && branchBMKeys.has(customer.assignedBulkMeterId))
        )
      : allCustomers;

    // Get total active customers in the branch
    const activeCustomersInBranch = branchCustomers.filter(c => c.status === 'Active');

    // Filter for current month data for the cards
    const currentMonthBMs = branchBMs.filter(bm => bm.month === currentMonthYear);
    const currentMonthCustomers = branchCustomers.filter(c => c.month === currentMonthYear && c.status === 'Active');

    const pendingCustomers = branchCustomers.filter(c => c.status === 'Pending Approval').length;
    const pendingBulkMeters = branchBMs.filter(bm => bm.status === 'Pending Approval').length;
    const totalPendingApprovals = pendingCustomers + pendingBulkMeters;

    // Use the server-side dashboard metrics when available for bill counts and performance summaries.
    const metrics = dashboardMetrics;
    const billStatusCounts = metrics?.billStatuses ?? [];
    const paidCount = billStatusCounts.find((m: any) => m.status === 'Paid')?.count || 0;
    const unpaidCount = billStatusCounts.find((m: any) => m.status === 'Unpaid')?.count || 0;
    const totalBillsCount = paidCount + unpaidCount;
    const billsPaymentStatusData = metrics ? [
      { name: 'Paid', value: paidCount, fill: '#10b981' },
      { name: 'Unpaid', value: unpaidCount, fill: '#ef4444' },
    ] : [
      { name: 'Paid', value: paidCount, fill: '#10b981' },
      { name: 'Unpaid', value: unpaidCount, fill: '#ef4444' },
    ];

    // --- Data for Branch Performance Chart (ALL branches, Bulk Meters ONLY, THIS MONTH) ---
    const branchPerformanceData = metrics?.branchPerformance?.map((item: any) => ({
      branch: (item.branch_name || item.branch || '').replace(/ Branch$/i, ""),
      paid: Number(item.paid || 0),
      unpaid: Number(item.unpaid || 0)
    })) ?? [];

    const waterUsageTrendData = metrics?.usageTrend?.map((item: any) => ({
      month: item.month,
      usage: Number(item.usage || 0)
    }))?.sort((a: any, b: any) => new Date(`${a.month}-01`).getTime() - new Date(`${b.month}-01`).getTime()) ?? [];

    const topDelinquentAccounts = metrics?.delinquent?.combined?.map((bill: any) => ({
      name: bill.name || 'Unknown Account',
      balance: Number(bill.outstanding || 0),
      type: bill.type || 'Bulk'
    })) ?? [];

    const paidPercentageValue = metrics?.revenue?.efficiency;
    const paidPercentage = typeof paidPercentageValue === 'number' ? `${paidPercentageValue.toFixed(0)}%` : "0%";

    return {
      selectedMonth: currentMonthYear,
      totalBulkMeters: metrics?.counts ? (metrics.counts.bulkMeters ?? 0) : branchBMs.length,
      totalCustomers: metrics?.counts ? (metrics.counts.individualCustomers ?? 0) : activeCustomersInBranch.length,
      totalBills: totalBillsCount,
      paidBills: paidCount,
      unpaidBills: unpaidCount,
      billsPaymentStatusData,
      revenueEfficiency: {
        billed: Number(metrics?.revenue?.totalBilled || 0),
        collected: Number(metrics?.revenue?.totalCollected || 0),
        efficiency: Number(metrics?.revenue?.efficiency || 0),
      },
      readingProgress: {
        total: Number(metrics?.readings?.totalCustomers || (branchBMs.length + branchCustomers.length)),
        read: Number(metrics?.readings?.completedReadings || 0),
        percentage: Number(metrics?.readings?.progress || 0),
      },
      todayActivity: {
        bills: Number(metrics?.todayActivity?.bills || 0),
        readings: Number(metrics?.todayActivity?.readings || 0),
        customers: Number(metrics?.todayActivity?.customers || 0),
      },
      branchPerformanceData,
      waterUsageTrendData,
      topDelinquentAccounts,
      paidPercentage,
      pendingApprovals: totalPendingApprovals,
    };
  }, [authStatus, staffBranchId, allBulkMeters, allCustomers, allBranches, dashboardMetrics]);


  const isReaderUser = React.useMemo(() => {
    const userString = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
    if (userString) {
      try {
        const u = JSON.parse(userString);
        return isReaderStaff(u);
      } catch (e) {
        return false;
      }
    }
    return false;
  }, []);

  const currentUserId = React.useMemo(() => {
    const userString = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
    if (userString) {
      try {
        return JSON.parse(userString).id?.toLowerCase();
      } catch (e) {
        return null;
      }
    }
    return null;
  }, []);

  const myRouteKeys = React.useMemo(() => {
    if (!currentUserId || !isReaderUser) return new Set<string>();
    const myRoutes = allRoutes.filter(r => r.readerId?.toLowerCase() === currentUserId);
    return new Set(myRoutes.map(r => r.routeKey));
  }, [allRoutes, currentUserId, isReaderUser]);

  const readerAnomalies = React.useMemo(() => {
    if (!isReaderUser || myRouteKeys.size === 0) return [];
    
    const anomalies: AnomalyRecord[] = [];
    
    // Check bulk meters
    for (const m of allBulkMeters) {
      if (m.status !== 'Active') continue;
      if (!m.routeKey || !myRouteKeys.has(m.routeKey)) continue;

      const usage = (m.currentReading ?? 0) - (m.previousReading ?? 0);
      if (usage === 0 && m.previousReading != null && m.currentReading != null) {
        anomalies.push({
          key: m.customerKeyNumber,
          name: m.name || m.customerKeyNumber,
          type: 'Bulk',
          reason: 'Zero consumption — possible stuck/broken meter',
          severity: 'medium',
          usage: 0,
        });
      } else if (usage > 2000) {
        anomalies.push({
          key: m.customerKeyNumber,
          name: m.name || m.customerKeyNumber,
          type: 'Bulk',
          reason: `Extreme spike: ${usage.toFixed(0)} m³`,
          severity: 'high',
          usage,
        });
      }
    }

    // Check individual customers
    for (const c of allCustomers) {
      if (c.status !== 'Active') continue;
      if (!c.routeKey || !myRouteKeys.has(c.routeKey)) continue;

      const usage = (c.currentReading ?? 0) - (c.previousReading ?? 0);
      if (usage === 0 && c.previousReading != null && c.currentReading != null) {
        anomalies.push({
          key: c.customerKeyNumber,
          name: c.name || c.customerKeyNumber,
          type: 'Individual',
          reason: 'Zero consumption — possible stuck/broken meter',
          severity: 'medium',
          usage: 0,
        });
      } else if (usage > 200) {
        anomalies.push({
          key: c.customerKeyNumber,
          name: c.name || c.customerKeyNumber,
          type: 'Individual',
          reason: `Extreme spike: ${usage.toFixed(0)} m³`,
          severity: 'high',
          usage,
        });
      }
    }

    return anomalies.sort((a, b) => (a.severity === 'high' ? -1 : 1)).slice(0, 5);
  }, [allBulkMeters, allCustomers, myRouteKeys, isReaderUser]);

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
              Your user profile is not correctly configured for a staff role or branch. Please contact an administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isDedicatedReader = 
    (hasPermission('meter_readings_create_bulk') || hasPermission('meter_readings_create_individual') || hasPermission('meter_readings_create')) &&
    !hasPermission('dashboard_view_all') &&
    !hasPermission('staff_view_all') &&
    !hasPermission('bill:manage_all');

  // Render Reader Dashboard for users who strictly have field reader capabilities without managerial view_all perms
  if (isDedicatedReader) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {readingPeriodStatus === 'Closed' && (
          <Alert variant="destructive" className="border-2 border-red-500 bg-red-50 shadow-lg">
            <LockIcon className="h-5 w-5 text-red-600" />
            <AlertTitle className="text-red-900 font-black text-lg">READING PERIOD CLOSED</AlertTitle>
            <UIAlertDescription className="text-red-800 font-bold">
              The meter reading period is currently closed globally. You cannot access routes or submit readings at this time.
            </UIAlertDescription>
          </Alert>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 drop-shadow-sm">
              Reader Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-blue-600 text-white font-bold px-3 py-1 border-none shadow-md">
                {staffBranchName} Branch
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => triggerRefresh()}
              title="Refresh data now"
              className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : localLastUpdated ? `Updated ${localLastUpdated}` : 'Live Data'}
            </button>
          </div>
        </div>

        {/* ── Water Consumption Anomaly Alert Box (Assigned Routes) ── */}
        {readerAnomalies.length > 0 && (
          <div className="rounded-3xl border border-rose-200/80 bg-gradient-to-r from-rose-50/90 via-amber-50/50 to-orange-50/60 p-5 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-rose-900 uppercase tracking-wide">⚠ Consumption Anomalies Detected (My Assigned Routes)</p>
                    <p className="text-xs text-rose-500">{readerAnomalies.length} meter{readerAnomalies.length > 1 ? 's require' : ' requires'} attention</p>
                  </div>
                </div>
                {periodDetails?.startDate && (
                  <div className="flex items-center gap-1.5 bg-rose-100/90 text-rose-900 px-3 py-1 rounded-xl text-xs font-bold border border-rose-200 shadow-sm">
                    <Calendar className="h-3.5 w-3.5 text-rose-600" />
                    <span>Current Cycle: {periodDetails.startDate} – {periodDetails.endDate}</span>
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {readerAnomalies.map((a) => (
                  <div
                    key={a.key}
                    className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 border ${
                      a.severity === 'high'
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      a.severity === 'high' ? 'bg-rose-100' : 'bg-amber-100'
                    }`}>
                      {a.severity === 'high'
                        ? <XCircle className="h-3.5 w-3.5 text-rose-600" />
                        : <AlertCircle className="h-3.5 w-3.5 text-amber-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{a.name}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${
                        a.severity === 'high' ? 'text-rose-500' : 'text-amber-500'
                      }`}>{a.type} Meter</p>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">{a.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <ReaderReport
          branches={allBranches}
          bulkMeters={allBulkMeters}
          customers={allCustomers}
          routes={allRoutes}
          staff={allStaff}
          individualReadings={allIndividualReadings}
          bulkReadings={allBulkReadings}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header: Greeting + Live Clock ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold">Staff Dashboard</h1>
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
              {currentUser?.name ? currentUser.name.split(" ")[0] : "Staff"}
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
      {processedStats.pendingApprovals > 0 && hasPermission('approvals_view') && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {processedStats.pendingApprovals} Approval{processedStats.pendingApprovals !== 1 ? 's' : ''} Pending
              </p>
              <p className="text-xs text-amber-700">Items are waiting for your review and approval.</p>
            </div>
          </div>
          <Link href="/staff/approvals" passHref>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm flex-shrink-0">
              Review <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* ── Quick Actions Bar ── */}
      <div className="flex flex-wrap gap-2.5">
        {[
          { label: 'Data Entry', icon: DatabaseZap, href: '/staff/data-entry', color: 'bg-blue-500 hover:bg-blue-600', perm: hasPermission('customers_create') || hasPermission('bulk_meters_create') },
          { label: 'Bill Management', icon: FileText, href: '/staff/bill-management', color: 'bg-violet-500 hover:bg-violet-600', perm: hasPermission('bill_view_branch') || hasPermission('bill_view_all') || hasPermission('billing_view') },
          { label: 'Reports', icon: BarChartIcon, href: '/staff/reports', color: 'bg-emerald-500 hover:bg-emerald-600', perm: hasPermission('reports_view_branch') || hasPermission('reports_view_all') },
          { label: 'Staff', icon: Users, href: '/staff/staff-management', color: 'bg-rose-500 hover:bg-rose-600', perm: hasPermission('staff_view_branch') || hasPermission('staff_view_all') || hasPermission('staff_view') },
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
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Bills Status ({processedStats.selectedMonth})</CardTitle>
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
              {isClient && processedStats.billsPaymentStatusData.some(d => d.value > 0) ? (
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <PieChart>
                    <Pie
                      data={processedStats.billsPaymentStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {processedStats.billsPaymentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} className="drop-shadow-sm hover:opacity-80 transition-opacity" />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent hideLabel />} />
                  </PieChart>
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
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Total Individual Customers</CardTitle>
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-12 flex flex-col justify-between relative z-10">
            <div>
              <div className="text-5xl lg:text-7xl font-black text-slate-800 tracking-tight mb-2 group-hover:text-emerald-900 transition-colors">{processedStats.totalCustomers.toLocaleString()}</div>
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
              <div className="text-5xl lg:text-7xl font-black text-slate-800 tracking-tight mb-2 group-hover:text-purple-900 transition-colors">{processedStats.totalBulkMeters.toLocaleString()}</div>
              <p className="text-base text-slate-600 font-semibold">Total registered bulk meters</p>
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
          <CardDescription className="text-slate-600/70">Navigate quickly to key management areas.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/staff/bill-management" passHref>
            <Button variant="outline" className="w-full justify-start p-6 h-auto quick-access-btn bg-white hover:bg-slate-100 border-slate-200 transition-all duration-300 hover:shadow-md group rounded-2xl">
              <CreditCard className="mr-4 h-8 w-8 text-blue-500 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="font-bold text-slate-900 text-lg">Billing Hub</p>
                <p className="text-sm text-slate-500">Manage customer bills.</p>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </Button>
          </Link>
          <Link href="/staff/meter-readings" passHref>
            <Button variant="outline" className="w-full justify-start p-6 h-auto quick-access-btn bg-white hover:bg-slate-100 border-slate-200 transition-all duration-300 hover:shadow-md group rounded-2xl">
              <Activity className="mr-4 h-8 w-8 text-emerald-500 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="font-bold text-slate-900 text-lg">Readings Hub</p>
                <p className="text-sm text-slate-500">Record utility consumption.</p>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </Button>
          </Link>
          <Link href="/staff/reports" passHref>
            <Button variant="outline" className="w-full justify-start p-6 h-auto quick-access-btn bg-white hover:bg-slate-100 border-slate-200 transition-all duration-300 hover:shadow-md group rounded-2xl">
              <TrendingUp className="mr-4 h-8 w-8 text-indigo-500 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="font-bold text-slate-900 text-lg">Branch Intel</p>
                <p className="text-sm text-slate-500">View performance metrics.</p>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="shadow-2xl border-none bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 bg-slate-50/50">
            <div>
              <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-900">
                <LayoutDashboard className="h-5 w-5 text-blue-600" />
                Branch Performance
              </CardTitle>
              <CardDescription className="text-slate-500 font-bold">Comparative payment analysis for bulk meters</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="font-black shadow-md border-slate-200 bg-white hover:bg-slate-50" onClick={() => setBranchPerformanceView(prev => prev === 'chart' ? 'table' : 'chart')}>
              {branchPerformanceView === 'chart' ? <TableIcon className="mr-2 h-4 w-4 text-blue-600" /> : <BarChartIcon className="mr-2 h-4 w-4 text-blue-600" />}
              {branchPerformanceView === 'chart' ? 'Switch to Table' : 'Switch to Graph'}
            </Button>
          </CardHeader>
          <CardContent className="pt-8">
            {branchPerformanceView === 'chart' ? (
              <div className="h-[320px]">
                {isClient && processedStats.branchPerformanceData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                      <BarChart data={processedStats.branchPerformanceData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="branch" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 600 }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="paid" fill="#10b981" radius={[6, 6, 0, 0]} barSize={25} />
                        <Bar dataKey="unpaid" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={25} />
                      </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-medium text-muted-foreground">
                    Analytics playground waiting for data...
                  </div>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[320px] rounded-lg border overflow-hidden">
                {processedStats.branchPerformanceData.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-bold">Branch</TableHead>
                        <TableHead className="text-right font-bold text-emerald-600">Paid</TableHead>
                        <TableHead className="text-right font-bold text-red-600">Unpaid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedStats.branchPerformanceData.map((item: any) => (
                        <TableRow key={item.branch} className="hover:bg-gray-50/50">
                          <TableCell className="font-bold">{item.branch}</TableCell>
                          <TableCell className="text-right font-black text-emerald-600">{item.paid}</TableCell>
                          <TableCell className="text-right font-black text-red-600">{item.unpaid}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-medium text-muted-foreground">
                    Data grid processing...
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-slate-100 bg-white rounded-3xl overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 bg-slate-50/50 px-6 py-4">
            <div>
              <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-900">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                Consumption Trend
              </CardTitle>
              <CardDescription className="text-slate-500 font-bold">Historical water usage trajectory</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="font-black shadow-md border-slate-200 bg-white hover:bg-slate-50" onClick={() => setWaterUsageView(prev => prev === 'chart' ? 'table' : 'chart')}>
              {waterUsageView === 'chart' ? <TableIcon className="mr-2 h-4 w-4 text-indigo-600" /> : <BarChartIcon className="mr-2 h-4 w-4 text-indigo-600" />}
              {waterUsageView === 'chart' ? 'Switch to Table' : 'Switch to Graph'}
            </Button>
          </CardHeader>
          <CardContent className="pt-8 px-6">
            {waterUsageView === 'chart' ? (
              <div className="h-[320px]">
                {isClient && processedStats.waterUsageTrendData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                      <LineChart data={processedStats.waterUsageTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600 }} />
                        <YAxis tickFormatter={(value) => `${value.toLocaleString()}`} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="usage" name="Consumption" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-medium text-muted-foreground">
                    Trend markers awaiting data ingestion...
                  </div>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[320px] rounded-lg border overflow-hidden">
                {processedStats.waterUsageTrendData.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-bold">Month</TableHead>
                        <TableHead className="text-right font-bold text-indigo-600">Usage (m³)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedStats.waterUsageTrendData.map((item: any) => (
                        <TableRow key={item.month} className="hover:bg-gray-50/50">
                          <TableCell className="font-bold text-gray-900">{item.month}</TableCell>
                          <TableCell className="text-right font-black text-indigo-600">{item.usage.toFixed(2).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-medium text-muted-foreground">
                    Data matrix in queue...
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Top Delinquent Accounts Card (Mirrored from Admin) */}
        <Card className="shadow-xl border-none bg-white overflow-hidden ring-1 ring-rose-200 rounded-3xl">
          <CardHeader className="bg-gradient-to-r from-rose-500 to-rose-600 border-b border-rose-400 p-6">
            <CardTitle className="text-xl font-black text-white flex items-center shadow-sm">
              <AlertCircle className="mr-3 h-6 w-6 text-rose-100" />
              Priority Collections
            </CardTitle>
            <CardDescription className="text-rose-100 font-bold mt-1 opacity-90">Outstanding balances needing attention</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-rose-50">
                <TableRow className="border-rose-100">
                  <TableHead className="text-rose-900 font-black uppercase tracking-widest text-[10px] pl-6 py-4">Account Holder</TableHead>
                  <TableHead className="text-right text-rose-900 font-black uppercase tracking-widest text-[10px] pr-6 py-4">Balance (Birr)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedStats.topDelinquentAccounts.length > 0 ? (
                  processedStats.topDelinquentAccounts.map((account: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-rose-50/50 transition-colors">
                      <TableCell className="font-medium pl-4 py-3">
                        <p className="text-sm font-bold text-gray-900">{account.name}</p>
                        <Badge variant="outline" className="text-[9px] h-4 bg-white/50 font-black tracking-tighter uppercase px-1">
                          {account.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4 font-black text-rose-700">
                        {account.balance.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-32 text-center text-xs text-muted-foreground italic">
                      Zero high-priority delinquent accounts! Excellent collection work.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {processedStats.topDelinquentAccounts.length > 0 && (
              <div className="p-4 bg-gray-50/50 border-t">
                <Link href="/staff/bill-management" passHref>
                  <Button variant="ghost" size="sm" className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold uppercase tracking-tighter gap-2">
                    Follow up with all delinquent accounts <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {hasPermission('meter_readings_analytics_view') && (
        <div className="pt-8 border-t border-slate-200 mt-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Reading Analytics</h2>
              <p className="text-sm text-slate-500 font-bold">Comprehensive analysis of field meter reading operations.</p>
            </div>
          </div>
          
          <ReaderReport
            branches={allBranches}
            bulkMeters={allBulkMeters}
            customers={allCustomers}
            routes={allRoutes}
            staff={allStaff}
            individualReadings={allIndividualReadings}
            bulkReadings={allBulkReadings}
          />
        </div>
      )}
    </div>
  );
}
