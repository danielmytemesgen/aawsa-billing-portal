
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
  Table as TableIcon
} from 'lucide-react';
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
import { getBulkMeters, subscribeToBulkMeters, initializeBulkMeters, getCustomers, subscribeToCustomers, initializeCustomers, getBranches, initializeBranches, subscribeToBranches } from "@/lib/data-store";
import { getAllBranchesAction } from "@/lib/actions";
import { format } from 'date-fns';
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";


interface User {
  email: string;
  role: "admin" | "staff" | "Admin" | "Staff" | "Head Office Management" | "Staff Management";
  branchName?: string;
  branchId?: string;
}

const chartConfig = {
  paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  unpaid: { label: "Unpaid", color: "hsl(var(--chart-3))" },
  waterUsage: { label: "Water Usage (m³)", color: "hsl(var(--chart-1))" },
} satisfies import("@/components/ui/chart").ChartConfig;

export default function StaffManagementDashboardPage() {
  const [authStatus, setAuthStatus] = React.useState<'loading' | 'unauthorized' | 'authorized'>('loading');
  const [staffBranchName, setStaffBranchName] = React.useState<string | null>(null);
  const [staffBranchId, setStaffBranchId] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);

  const [allBranches, setAllBranches] = React.useState<Branch[]>([]);
  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);
  const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
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
        const roleLower = parsedUser.role?.toLowerCase();
        if (roleLower === "staff management") {
          const hasValidBranchName = parsedUser.branchName && parsedUser.branchName !== 'Unknown Branch';
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
                if (!branch) branch = branches.find((b: any) => (b.name || '').toLowerCase() === target.toLowerCase());
                if (branch) {
                  parsedUser.branchId = branch.id;
                  try { localStorage.setItem('user', JSON.stringify(parsedUser)); } catch (e) { /* ignore */ }
                  setStaffBranchName(parsedUser.branchName ?? null);
                  setStaffBranchId(branch.id ?? null);
                  setAuthStatus('authorized');
                } else {
                  setAuthStatus('unauthorized');
                }
              } catch (e) {
                setAuthStatus('unauthorized');
              }
            })();
          } else if (parsedUser.branchId) {
            // branchId present but branchName missing — resolve from API
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
        await Promise.all([initializeBranches(true), initializeBulkMeters(true), initializeCustomers(true)]);
        if (isMounted) {
          setAllBranches(getBranches());
          setAllBulkMeters(getBulkMeters());
          setAllCustomers(getCustomers());
        }
      } catch (err) {
        console.error("Failed to initialize dashboard data:", err);
      } finally {
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
    if (authStatus !== 'authorized' || !staffBranchId) {
      return { totalBulkMeters: 0, totalCustomers: 0, totalBills: 0, paidBills: 0, unpaidBills: 0, billsData: [], branchPerformanceData: [], waterUsageTrendData: [], paidPercentage: "0%", currentMonthYear: format(new Date(), 'yyyy-MM') };
    }

    const currentMonthYear = format(new Date(), 'yyyy-MM');

    // --- Data for top cards (filtered by staff manager's branch, current month) ---
    const branchBMs = allBulkMeters.filter(bm => bm.branchId === staffBranchId);
    const branchBMKeys = new Set(branchBMs.map(bm => bm.customerKeyNumber));
    const branchCustomers = allCustomers.filter(customer =>
      customer.branchId === staffBranchId ||
      (customer.assignedBulkMeterId && branchBMKeys.has(customer.assignedBulkMeterId))
    );

    // Filter for current month for KPI cards
    const currentMonthBMs = branchBMs.filter(bm => bm.month === currentMonthYear);
    const currentMonthCustomers = branchCustomers.filter(c => c.month === currentMonthYear && c.status === 'Active');

    const paidCount = currentMonthBMs.filter(bm => bm.paymentStatus === 'Paid').length
      + currentMonthCustomers.filter(c => c.paymentStatus === 'Paid').length;
    const unpaidCount = currentMonthBMs.filter(bm => bm.paymentStatus === 'Unpaid').length
      + currentMonthCustomers.filter(c => c.paymentStatus === 'Unpaid' || c.paymentStatus === 'Pending').length;
    const totalBillsCount = paidCount + unpaidCount;
    const billsData = [
      { name: 'Paid', value: paidCount, fill: 'hsl(var(--chart-1))' },
      { name: 'Unpaid', value: unpaidCount, fill: 'hsl(var(--chart-3))' },
    ];
    const paidPercentage = totalBillsCount > 0 ? `${((paidCount / totalBillsCount) * 100).toFixed(0)}%` : "0%";

    // --- Data for Branch Performance Chart (ALL branches, current month, excluding Head Office) ---
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
        const usage = bm.currentReading - bm.previousReading;
        if (typeof usage === 'number' && !isNaN(usage)) {
          const currentMonthUsage = usageMap.get(bm.month) || 0;
          usageMap.set(bm.month, currentMonthUsage + usage);
        }
      }
    });
    branchCustomers.forEach(c => {
      if (c.month) {
        const usage = c.currentReading - c.previousReading;
        if (typeof usage === 'number' && !isNaN(usage)) {
          const currentMonthUsage = usageMap.get(c.month) || 0;
          usageMap.set(c.month, currentMonthUsage + usage);
        }
      }
    });
    const waterUsageTrendData = Array.from(usageMap.entries())
      .map(([month, usage]) => ({ month, usage }))
      .sort((a, b) => new Date(a.month + "-01").getTime() - new Date(b.month + "-01").getTime());


    return {
      totalBulkMeters: branchBMs.length,
      totalCustomers: branchCustomers.length,
      totalBills: totalBillsCount,
      paidBills: paidCount,
      unpaidBills: unpaidCount,
      billsData,
      branchPerformanceData,
      waterUsageTrendData,
      paidPercentage,
      currentMonthYear,
    };
  }, [authStatus, staffBranchId, allBulkMeters, allCustomers, allBranches]);


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
      <h1 className="text-2xl md:text-3xl font-bold">Staff Management Dashboard - {staffBranchName}</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Bills Status Card */}
        <Card className="group shadow-sm hover:shadow-xl border border-blue-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f4f7ff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <FileText className="h-48 w-48 text-blue-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Bills (Current Cycle)</CardTitle>
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
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={processedStats.billsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={45} paddingAngle={4} stroke="none">
                        {processedStats.billsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} className="drop-shadow-sm hover:opacity-80 transition-opacity" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltipContent hideLabel />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="text-sm font-semibold text-blue-600/80 italic w-full text-center mt-6">No bill data for this cycle</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customers Card */}
        <Card className="group shadow-sm hover:shadow-xl border border-emerald-100/80 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f0fbf4' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 pointer-events-none -mb-8 -mr-8 group-hover:scale-110">
            <Users className="h-64 w-64 text-emerald-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider max-w-[80%] leading-tight">Customers in <br/>{staffBranchName}</CardTitle>
            <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-12 flex flex-col justify-between h-48 relative z-10">
            <div>
              <div className="text-5xl lg:text-7xl font-black text-slate-800 tracking-tight mb-2 mt-4 group-hover:text-emerald-900 transition-colors">{processedStats.totalCustomers.toLocaleString()}</div>
              <p className="text-base text-slate-600 font-semibold">Total active accounts</p>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Meters Card */}
        <Card className="group shadow-sm hover:shadow-xl border border-purple-100/80 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#faf5ff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 pointer-events-none -mb-8 -mr-8 group-hover:scale-110">
            <Gauge className="h-64 w-64 text-purple-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider max-w-[80%] leading-tight">Bulk Meters in <br/>{staffBranchName}</CardTitle>
            <div className="h-10 w-10 shrink-0 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Gauge className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-12 flex flex-col justify-between h-48 relative z-10">
            <div>
              <div className="text-5xl lg:text-7xl font-black text-slate-800 tracking-tight mb-2 mt-4 group-hover:text-purple-900 transition-colors">{processedStats.totalBulkMeters.toLocaleString()}</div>
              <p className="text-base text-slate-600 font-semibold">Total registered bulk meters</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Quick Access</CardTitle>
          <CardDescription>Navigate quickly to key management areas for your branch.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button asChild variant="outline" className="w-full justify-start p-4 h-auto quick-access-btn">
            <Link href="/staff/bulk-meters">
              <Gauge className="mr-3 h-6 w-6" />
              <div>
                <p className="font-semibold text-base">View Bulk Meters</p>
                <p className="text-xs text-muted-foreground">Manage bulk water meters in your branch.</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start p-4 h-auto quick-access-btn">
            <Link href="/staff/individual-customers">
              <Users className="mr-3 h-6 w-6" />
              <div>
                <p className="font-semibold text-base">View Individual Customers</p>
                <p className="text-xs text-muted-foreground">Manage individual customer accounts in your branch.</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5" />
            </Link>
          </Button>
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
                    <ResponsiveContainer>
                      <BarChart data={processedStats.branchPerformanceData}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="branch" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="paid" stackId="a" fill="var(--color-paid)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="unpaid" stackId="a" fill="var(--color-unpaid)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
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
                      {processedStats.branchPerformanceData.map((item) => (
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
                    <ResponsiveContainer>
                      <LineChart data={processedStats.waterUsageTrendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(value) => `${value.toLocaleString()}`} tick={{ fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line type="monotone" dataKey="usage" name="Water Usage" stroke="var(--color-waterUsage)" />
                      </LineChart>
                    </ResponsiveContainer>
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
                      {processedStats.waterUsageTrendData.map((item) => (
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
