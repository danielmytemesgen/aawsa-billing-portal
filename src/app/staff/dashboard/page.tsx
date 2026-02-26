
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart as BarChartIcon, PieChart as PieChartIcon, Gauge, Users, ArrowRight, FileText, TrendingUp, AlertCircle, Table as TableIcon, UserCheck, Calendar, RotateCcw, LayoutDashboard } from 'lucide-react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
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
import { getAllBranchesAction } from "@/lib/actions";
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
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { Branch } from "@/app/admin/branches/branch-types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ReaderReport } from "./reader-report";

interface User {
  email: string;
  role: "admin" | "staff" | "reader" | "Admin" | "Staff" | "Reader" | "Head Office Management" | "Staff Management";
  branchName?: string;
  branchId?: string;
}

const chartConfig = {
  paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  unpaid: { label: "Unpaid", color: "hsl(var(--chart-3))" },
  waterUsage: { label: "Water Usage (m³)", color: "hsl(var(--chart-1))" },
} satisfies import("@/components/ui/chart").ChartConfig;

export default function StaffDashboardPage() {
  const [authStatus, setAuthStatus] = React.useState<'loading' | 'unauthorized' | 'authorized'>('loading');
  const [staffBranchName, setStaffBranchName] = React.useState<string | null>(null);
  const [staffBranchId, setStaffBranchId] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);

  const [allBranches, setAllBranches] = React.useState<Branch[]>([]);
  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);
  const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
  const [allIndividualReadings, setAllIndividualReadings] = React.useState<any[]>([]);
  const [allBulkReadings, setAllBulkReadings] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // State for toggling views
  const [branchPerformanceView, setBranchPerformanceView] = React.useState<'chart' | 'table'>('chart');
  const [waterUsageView, setWaterUsageView] = React.useState<'chart' | 'table'>('chart');


  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Auth check
  React.useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const parsedUser: User = JSON.parse(userString);
        // Accept staff role and attempt to resolve missing branchId from branchName if necessary.
        if (parsedUser.role && ["staff", "reader"].includes(parsedUser.role.toLowerCase())) {
          const hasValidBranchName = parsedUser.branchName && parsedUser.branchName !== 'Unknown Branch';
          // If branchId is present and branchName looks valid, authorize immediately
          if (parsedUser.branchId && hasValidBranchName) {
            setStaffBranchName(parsedUser.branchName ?? null);
            setStaffBranchId(parsedUser.branchId ?? null);
            setAuthStatus('authorized');
          } else if (hasValidBranchName) {
            // Try to resolve branchId from known branches
            (async () => {
              try {
                const res = await getAllBranchesAction();
                const branches = res.data || [];
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
                  // persist resolved branchId so subsequent loads won't need to re-resolve
                  try { localStorage.setItem('user', JSON.stringify(parsedUser)); } catch (e) { /* ignore */ }
                  setStaffBranchName(parsedUser.branchName ?? null);
                  setStaffBranchId(parsedUser.branchId ?? null);
                  setAuthStatus('authorized');
                } else {
                  setAuthStatus('unauthorized');
                }
              } catch (e) {
                console.error('Failed to resolve branch during auth check:', e);
                setAuthStatus('unauthorized');
              }
            })();
          } else if (parsedUser.branchId) {
            // branchId present but branchName missing - try to fill branchName for display
            (async () => {
              try {
                const res = await getAllBranchesAction();
                const branches = res.data || [];
                const branch = branches.find((b: any) => String(b.id) === String(parsedUser.branchId));
                if (branch) {
                  parsedUser.branchName = branch.name;
                  try { localStorage.setItem('user', JSON.stringify(parsedUser)); } catch (e) { /* ignore */ }
                  setStaffBranchName(parsedUser.branchName ?? null);
                  setStaffBranchId(parsedUser.branchId ?? null);
                  setAuthStatus('authorized');
                } else {
                  setAuthStatus('unauthorized');
                }
              } catch (e) {
                console.error('Failed to fetch branches during auth check:', e);
                setAuthStatus('unauthorized');
              }
            })();
          } else {
            setAuthStatus('unauthorized');
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
    if (authStatus !== 'authorized') return;
    setIsLoading(true);
    try {
      await Promise.all([
        initializeBranches(true),
        initializeBulkMeters(true),
        initializeCustomers(true),
        initializeIndividualCustomerReadings(true),
        initializeBulkMeterReadings(true),
        fetchRoutes(true),
        initializeStaffMembers(true)
      ]);

      setAllBranches(getBranches());
      setAllBulkMeters(getBulkMeters());
      setAllCustomers(getCustomers());
      setAllIndividualReadings(getIndividualCustomerReadings());
      setAllBulkReadings(getBulkMeterReadings());
      setAllRoutes(getRoutes());
      setAllStaff(getStaffMembers());
    } catch (err) {
      console.error("Failed to fetch live dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    initializeData();
  }, [authStatus]);

  // Derived state with useMemo
  const processedStats = React.useMemo(() => {
    if (authStatus !== 'authorized' || !staffBranchId) {
      return { totalBulkMeters: 0, totalCustomers: 0, totalBills: 0, paidBills: 0, unpaidBills: 0, billsData: [], branchPerformanceData: [], waterUsageTrendData: [], topDelinquentAccounts: [], paidPercentage: "0%", pendingApprovals: 0 };
    }

    const currentMonthYear = format(new Date(), 'yyyy-MM');

    const branchBMs = allBulkMeters.filter(bm => bm.branchId === staffBranchId);
    const branchBMKeys = new Set(branchBMs.map(bm => bm.customerKeyNumber));
    const branchCustomers = allCustomers.filter(customer =>
      customer.branchId === staffBranchId ||
      (customer.assignedBulkMeterId && branchBMKeys.has(customer.assignedBulkMeterId))
    );

    // Get total active customers in the branch
    const activeCustomersInBranch = branchCustomers.filter(c => c.status === 'Active');

    // Filter for current month data for the cards
    const currentMonthBMs = branchBMs.filter(bm => bm.month === currentMonthYear);
    const currentMonthCustomers = branchCustomers.filter(c => c.month === currentMonthYear && c.status === 'Active');

    const pendingCustomers = branchCustomers.filter(c => c.status === 'Pending Approval').length;
    const pendingBulkMeters = branchBMs.filter(bm => bm.status === 'Pending Approval').length;
    const totalPendingApprovals = pendingCustomers + pendingBulkMeters;


    // Calculation for the "Bills Status" card (Total Outstanding vs Paid for the branch)
    const paidCount = branchBMs.filter(bm => bm.paymentStatus === 'Paid').length;
    const unpaidCount = branchBMs.filter(bm => bm.paymentStatus === 'Unpaid').length;
    const totalBillsCount = paidCount + unpaidCount;
    const billsData = [
      { name: 'Paid', value: paidCount, fill: '#10b981' },
      { name: 'Unpaid', value: unpaidCount, fill: '#ef4444' },
    ];

    // Calculation for "Payment Collection Rate" card (Bulk Meters ONLY, THIS MONTH for the branch)
    const currentMonthBMsForRate = branchBMs.filter(bm => bm.month === currentMonthYear);
    const paidBMsCount = currentMonthBMsForRate.filter(bm => bm.paymentStatus === 'Paid').length;
    const totalBMsCount = currentMonthBMsForRate.length;
    const paidPercentage = totalBMsCount > 0 ? `${((paidBMsCount / totalBMsCount) * 100).toFixed(0)}%` : "0%";

    // --- Data for Branch Performance Chart (ALL branches, Bulk Meters ONLY, THIS MONTH) ---
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
    const branchPerformanceData = Array.from(performanceMap.values()).map(p => ({ branch: p.branchName.replace(/ Branch$/i, ""), paid: p.paid, unpaid: p.unpaid }));

    // --- Data for Water Usage Trend Chart (filtered by staff manager's branch, historical) ---
    const usageMap = new Map<string, number>();
    branchBMs.forEach(bm => {
      if (bm.month) {
        const usage = (bm.currentReading ?? 0) - (bm.previousReading ?? 0);
        if (typeof usage === 'number' && !isNaN(usage)) {
          const currentMonthUsage = usageMap.get(bm.month) || 0;
          usageMap.set(bm.month, currentMonthUsage + usage);
        }
      }
    });
    branchCustomers.forEach(c => {
      if (c.month && c.status === 'Active') {
        const usage = (c.currentReading ?? 0) - (c.previousReading ?? 0);
        if (typeof usage === 'number' && !isNaN(usage)) {
          const currentMonthUsage = usageMap.get(c.month) || 0;
          usageMap.set(c.month, currentMonthUsage + usage);
        }
      }
    });
    const waterUsageTrendData = Array.from(usageMap.entries())
      .map(([month, usage]) => ({ month, usage }))
      .sort((a, b) => new Date(a.month + "-01").getTime() - new Date(b.month + "-01").getTime());

    // --- Data for Top Delinquent Accounts (filtered by staff branch, top 5) ---
    const delinquentBulk = branchBMs
      .filter(bm => bm.paymentStatus === 'Unpaid')
      .map(bm => ({
        name: bm.name,
        balance: bm.outStandingbill || 0,
        type: 'Bulk'
      }));

    const delinquentIndividual = branchCustomers
      .filter(c => c.paymentStatus === 'Unpaid' && c.status === 'Active')
      .map(c => ({
        name: c.name,
        balance: c.calculatedBill || 0,
        type: 'Individual'
      }));

    const topDelinquentAccounts = [...delinquentBulk, ...delinquentIndividual]
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);


    return {
      totalBulkMeters: branchBMs.length,
      totalCustomers: activeCustomersInBranch.length,
      totalBills: totalBillsCount,
      paidBills: paidCount,
      unpaidBills: unpaidCount,
      billsData,
      branchPerformanceData,
      waterUsageTrendData,
      topDelinquentAccounts,
      paidPercentage,
      pendingApprovals: totalPendingApprovals,
    };
  }, [authStatus, staffBranchId, allBulkMeters, allCustomers, allBranches]);


  const currentUserRole = React.useMemo(() => {
    const userString = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
    if (userString) {
      try {
        return JSON.parse(userString).role?.toLowerCase();
      } catch (e) {
        return null;
      }
    }
    return null;
  }, []);

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

  // Render Reader Report for Readers
  if (currentUserRole === 'reader') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm">
              Reader Dashboard
            </h1>
            <div className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {staffBranchName} Branch
              </Badge>
              <span className="text-xs">•</span>
              <span className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(), 'MMMM d, yyyy')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="shadow-sm bg-white hover:bg-gray-50" onClick={initializeData}>
              <RotateCcw className="h-4 w-4 mr-2 text-blue-500" />
              Refresh Data
            </Button>
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
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Staff Dashboard
          </h1>
          <div className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {staffBranchName} Branch
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xl border-none bg-white/50 backdrop-blur-sm hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bills Status</CardTitle>
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{processedStats.totalBills.toLocaleString()} Bills</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-emerald-600">{processedStats.paidBills} Paid</span>
              <span className="text-xs text-gray-300">/</span>
              <span className="text-xs font-bold text-amber-600">{processedStats.unpaidBills} Unpaid</span>
            </div>
            <div className="h-[120px] mt-4">
              {isClient && (
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={processedStats.billsData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={50}
                        paddingAngle={4}
                      >
                        {processedStats.billsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltipContent hideLabel />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-white/50 backdrop-blur-sm hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Customers</CardTitle>
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{processedStats.totalCustomers.toLocaleString()}</div>
            <p className="text-xs font-medium text-muted-foreground mt-1">Total active subscribers</p>
            <div className="h-[120px] mt-4 flex items-center justify-center">
              <div className="relative">
                <Users className="h-20 w-20 text-emerald-500 opacity-10 animate-pulse" />
                <Users className="h-16 w-16 text-emerald-600 absolute top-2 left-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-white/50 backdrop-blur-sm hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bulk Meters</CardTitle>
            <div className="p-1.5 bg-indigo-100 rounded-lg">
              <Gauge className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{processedStats.totalBulkMeters.toLocaleString()}</div>
            <p className="text-xs font-medium text-muted-foreground mt-1">High-capacity connections</p>
            <div className="h-[120px] mt-4 flex items-center justify-center">
              <div className="relative">
                <Gauge className="h-20 w-20 text-indigo-500 opacity-10 animate-pulse" />
                <Gauge className="h-16 w-16 text-indigo-600 absolute top-2 left-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-white/50 backdrop-blur-sm hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collection Rate</CardTitle>
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{processedStats.paidPercentage}</div>
            <p className="text-xs font-medium text-muted-foreground mt-1">Target Achievement</p>
            <div className="h-[120px] mt-4 flex items-center justify-center">
              <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-1000"
                  style={{ width: processedStats.paidPercentage }}
                />
              </div>
            </div>
          </CardContent>
        </Card>


      </div>

      <Card className="shadow-xl border-none overflow-hidden group">
        <CardHeader className="bg-gray-50/50 border-b">
          <CardTitle className="text-lg font-bold">Quick Access Gateways</CardTitle>
          <CardDescription>Direct paths to core branch management operations.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6">
          <Button asChild variant="outline" className="w-full justify-start p-6 h-auto border-2 hover:border-blue-500 hover:bg-blue-50/50 transition-all group/btn">
            <Link href="/staff/bulk-meters">
              <div className="p-3 bg-blue-100 rounded-xl group-hover/btn:bg-blue-600 group-hover/btn:text-white transition-colors">
                <Gauge className="h-7 w-7" />
              </div>
              <div className="ml-4">
                <div className="font-bold text-lg">Bulk Meters Registry</div>
                <div className="text-sm text-muted-foreground font-medium">Analyze and manage large-scale distribution points.</div>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-gray-300 group-hover/btn:text-blue-600 transition-colors" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start p-6 h-auto border-2 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group/btn">
            <Link href="/staff/individual-customers">
              <div className="p-3 bg-emerald-100 rounded-xl group-hover/btn:bg-emerald-600 group-hover/btn:text-white transition-colors">
                <Users className="h-7 w-7" />
              </div>
              <div className="ml-4">
                <div className="font-bold text-lg">Customer Portfolio</div>
                <div className="text-sm text-muted-foreground font-medium">Subscriber profiles and billing history management.</div>
              </div>
              <ArrowRight className="ml-auto h-6 w-6 text-gray-300 group-hover/btn:text-emerald-600 transition-colors" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="shadow-xl border-none bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-blue-600" />
                Branch Performance
              </CardTitle>
              <CardDescription>Comparative payment analysis for bulk meters</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="font-bold shadow-sm" onClick={() => setBranchPerformanceView(prev => prev === 'chart' ? 'table' : 'chart')}>
              {branchPerformanceView === 'chart' ? <TableIcon className="mr-2 h-4 w-4" /> : <BarChartIcon className="mr-2 h-4 w-4" />}
              {branchPerformanceView === 'chart' ? 'Table View' : 'Graph View'}
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {branchPerformanceView === 'chart' ? (
              <div className="h-[320px]">
                {isClient && processedStats.branchPerformanceData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <ResponsiveContainer>
                      <BarChart data={processedStats.branchPerformanceData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="branch" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 600 }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="paid" fill="#10b981" radius={[6, 6, 0, 0]} barSize={25} />
                        <Bar dataKey="unpaid" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
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
                      {processedStats.branchPerformanceData.map((item) => (
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

        <Card className="shadow-xl border-none bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                Consumption Trend
              </CardTitle>
              <CardDescription>Historical water usage trajectory</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="font-bold shadow-sm" onClick={() => setWaterUsageView(prev => prev === 'chart' ? 'table' : 'chart')}>
              {waterUsageView === 'chart' ? <TableIcon className="mr-2 h-4 w-4" /> : <BarChartIcon className="mr-2 h-4 w-4" />}
              {waterUsageView === 'chart' ? 'Table View' : 'Graph View'}
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {waterUsageView === 'chart' ? (
              <div className="h-[320px]">
                {isClient && processedStats.waterUsageTrendData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <ResponsiveContainer>
                      <LineChart data={processedStats.waterUsageTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600 }} />
                        <YAxis tickFormatter={(value) => `${value.toLocaleString()}`} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="usage" name="Consumption" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
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
                      {processedStats.waterUsageTrendData.map((item) => (
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
        <Card className="shadow-xl border-none bg-white/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-rose-50 border-b border-rose-100">
            <CardTitle className="text-lg font-bold text-rose-900 flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-rose-600" />
              Top Delinquent Accounts
            </CardTitle>
            <CardDescription className="text-rose-700/70 italic">Highest outstanding balances needing attention.</CardDescription>
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
                {processedStats.topDelinquentAccounts.length > 0 ? (
                  processedStats.topDelinquentAccounts.map((account, idx) => (
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
    </div>
  );
}
