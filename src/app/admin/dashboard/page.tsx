"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowRight,
  AlertCircle,
  Users,
  Gauge,
  BarChart as BarChartIcon,
  Table as TableIcon,
  FileText
} from 'lucide-react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import {
  ResponsiveContainer,
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
  getBills, subscribeToBills, initializeBills,
  getIndividualCustomerReadings, subscribeToIndividualCustomerReadings, initializeIndividualCustomerReadings,
  getBulkMeterReadings, subscribeToBulkMeterReadings, initializeBulkMeterReadings
} from "@/lib/data-store";
import type { BulkMeter } from '../bulk-meters/bulk-meter-types';
import type { IndividualCustomer } from '../individual-customers/individual-customer-types';
import type { Branch } from '../branches/branch-types';
import { DomainBill } from "@/lib/data-store";
import { getDashboardMetricsAction } from "@/lib/actions";
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const chartConfig = {
  Paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  Unpaid: { label: "Unpaid", color: "hsl(var(--chart-3))" },
  waterUsage: { label: "Water Usage (m³)", color: "hsl(var(--chart-1))" },
  billed: { label: "Billed Amount", color: "hsl(var(--chart-2))" },
  collected: { label: "Collected Amount", color: "hsl(var(--chart-1))" },
} satisfies import("@/components/ui/chart").ChartConfig;


export default function AdminDashboardPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);

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

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const [selectedMonth, setSelectedMonth] = React.useState<string>(format(new Date(), 'yyyy-MM'));

  const processDashboardData = React.useCallback(async () => {
    const { data: metrics, error: metricsError } = await getDashboardMetricsAction();

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

        // Background initialization of data-store for detailed views (charts)
        await Promise.all([
          initializeBranches(true),
          initializeBulkMeters(true),
          initializeCustomers(true),
          initializeBills(true),
          initializeIndividualCustomerReadings(true),
          initializeBulkMeterReadings(true)
        ]);

        if (isMounted) await processDashboardData();
      } catch (err) {
        console.error("Error initializing dashboard data:", err);
        if (isMounted) setError("Failed to load dashboard data. Please try again later.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    const unsubBranches = subscribeToBranches(() => { if (isMounted) processDashboardData(); });
    const unsubBulkMeters = subscribeToBulkMeters(() => { if (isMounted) processDashboardData(); });
    const unsubCustomers = subscribeToCustomers(() => { if (isMounted) processDashboardData(); });
    const unsubBills = subscribeToBills(() => { if (isMounted) processDashboardData(); });
    const unsubIndReadings = subscribeToIndividualCustomerReadings(() => { if (isMounted) processDashboardData(); });
    const unsubBulkReadings = subscribeToBulkMeterReadings(() => { if (isMounted) processDashboardData(); });

    return () => {
      isMounted = false;
      unsubBranches();
      unsubBulkMeters();
      unsubCustomers();
      unsubBills();
      unsubIndReadings();
      unsubBulkReadings();
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
      <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Row 1: Key Performance Indicators */}
        <Card className="bg-blue-50 border-blue-100 shadow-sm border-t-4 border-t-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-blue-900 uppercase tracking-tight">Bills Status ({selectedMonth})</CardTitle>
            <FileText className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-700">{dynamicTotalBills.toLocaleString()} Bills</div>
            <p className="text-xs text-blue-600/70 font-medium">{dynamicPaidBills} Paid / {dynamicUnpaidBills} Unpaid</p>
            <div className="h-[150px] mt-4">
              {isClient && billsPaymentStatusData.some(d => d.value > 0) ? (
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <ResponsiveContainer>
                    <PieChartRecharts>
                      <Pie
                        data={billsPaymentStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                      >
                        {billsPaymentStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                      </Pie>
                      <Tooltip content={<ChartTooltipContent hideLabel />} />
                      <Legend
                        content={<ChartLegendContent className="text-sm font-bold gap-6" />}
                        verticalAlign="bottom"
                        height={40}
                      />
                    </PieChartRecharts>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-blue-600/50 italic bg-white/40 rounded-lg">No bill data for this month.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 shadow-sm border-t-4 border-t-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-amber-900 uppercase tracking-tight">Revenue Collection efficiency</CardTitle>
            <BarChartIcon className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-700 mb-1">{revenueEfficiency.efficiency.toFixed(1)}%</div>
            <p className="text-xs text-amber-600/70 font-medium mb-4">Collection Efficiency</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white/60 p-2 rounded border border-amber-100">
                <p className="text-[10px] uppercase font-bold text-slate-500">Total Billed</p>
                <p className="text-sm font-bold text-amber-900">ETB {revenueEfficiency.billed.toLocaleString()}</p>
              </div>
              <div className="bg-white/60 p-2 rounded border border-emerald-100">
                <p className="text-[10px] uppercase font-bold text-slate-500">Collected</p>
                <p className="text-sm font-bold text-emerald-700">ETB {revenueEfficiency.collected.toLocaleString()}</p>
              </div>
            </div>

            <div className="h-[100px]">
              {isClient && revenueEfficiency.billed > 0 ? (
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <ResponsiveContainer>
                    <BarChart data={[
                      { name: 'Billed', value: revenueEfficiency.billed, fill: 'hsl(var(--chart-2))' }, // Keeping chart-2/amber for consistency
                      { name: 'Collected', value: revenueEfficiency.collected, fill: 'hsl(var(--chart-1))' } // Keeping chart-1/emerald
                    ]} layout="vertical" margin={{ left: 0, right: 30 }} barCategoryGap={2}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10, fill: '#78350f', fontWeight: 'bold' }} interval={0} />
                      <Tooltip
                        content={<ChartTooltipContent />}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fontSize: 10, fill: '#78350f', formatter: (val: number) => val.toLocaleString() }} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-amber-600/50 italic bg-white/40 rounded-lg">No revenue data available.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-cyan-50 border-cyan-100 shadow-sm border-t-4 border-t-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-cyan-900 uppercase tracking-tight">Meter Reading Progress</CardTitle>
            <Gauge className="h-5 w-5 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-cyan-700">{readingProgress.percentage.toFixed(1)}%</div>
            <p className="text-xs text-cyan-600/70 font-medium">{readingProgress.read} of {readingProgress.total} meters read</p>
            <div className="h-[120px] mt-4 flex flex-col items-center justify-center space-y-4">
              <div className="w-full bg-cyan-200/50 rounded-full h-4 overflow-hidden border border-cyan-300">
                <div
                  className="bg-cyan-600 h-full transition-all duration-1000 ease-out"
                  style={{ width: `${readingProgress.percentage}%` }}
                />
              </div>
              <p className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest italic animate-pulse">
                {readingProgress.percentage === 100 ? "Sync Complete" : "Syncing in Progress..."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Restore Original Row 1 Meters Stats */}
        <Card className="bg-emerald-50 border-emerald-100 shadow-sm border-t-4 border-t-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-emerald-900 uppercase tracking-tight">Total Individual Customers</CardTitle>
            <Users className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-700">{dynamicTotalCustomerCount.toLocaleString()}</div>
            <p className="text-xs text-emerald-600/70 font-medium">Total active individual accounts</p>
            <div className="h-[120px] mt-4 flex items-center justify-center bg-white/40 rounded-lg">
              <Users className="h-16 w-16 text-emerald-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50 border-indigo-100 shadow-sm border-t-4 border-t-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-indigo-900 uppercase tracking-tight">Total Bulk Meters</CardTitle>
            <Gauge className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-indigo-700">{dynamicTotalBulkMeterCount.toLocaleString()}</div>
            <p className="text-xs text-indigo-600/70 font-medium">Total registered bulk meters</p>
            <div className="h-[120px] mt-4 flex items-center justify-center bg-white/40 rounded-lg">
              <Gauge className="h-16 w-16 text-indigo-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

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
          <CardContent className="pt-6">
            {branchPerformanceView === 'chart' ? (
              <div className="h-[300px]">
                {isClient && dynamicBranchPerformanceData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <ResponsiveContainer>
                      <BarChart data={dynamicBranchPerformanceData}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="branch" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 500 }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 500 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend content={<ChartLegendContent />} />
                        <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} name="Paid" />
                        <Bar dataKey="unpaid" fill="#ef4444" radius={[4, 4, 0, 0]} name="Unpaid" />
                      </BarChart>
                    </ResponsiveContainer>
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
              Top Delinquent Accounts
            </CardTitle>
            <CardDescription className="text-rose-700/70">Highest outstanding balances needing attention.</CardDescription>
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
                  <ResponsiveContainer>
                    <LineChart data={dynamicWaterUsageTrendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(value) => `${value.toLocaleString()}`} tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line type="monotone" dataKey="usage" name="Water Usage (m³)" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
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