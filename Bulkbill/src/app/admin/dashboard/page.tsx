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
  getBranches, subscribeToBranches, initializeBranches
} from "@/lib/data-store";
import type { BulkMeter } from '../bulk-meters/bulk-meter-types';
import type { IndividualCustomer } from '../individual-customers/individual-customer-types';
import type { Branch } from '../branches/branch-types';
import { format } from 'date-fns';

const chartConfig = {
  paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  unpaid: { label: "Unpaid", color: "hsl(var(--chart-3))" },
  waterUsage: { label: "Water Usage (m³)", color: "hsl(var(--chart-1))" },
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

  // State for toggling views
  const [branchPerformanceView, setBranchPerformanceView] = React.useState<'chart' | 'table'>('chart');
  const [waterUsageView, setWaterUsageView] = React.useState<'chart' | 'table'>('chart');

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const processDashboardData = React.useCallback(() => {
    const currentBranches = getBranches();
    const currentBulkMeters = getBulkMeters();
    const currentCustomers = getCustomers();
    const currentMonthYear = format(new Date(), 'yyyy-MM');

    // 1. Total Bills Status (from BULK meters only for the current month)
    const currentMonthBMs = currentBulkMeters.filter(bm => bm.month === currentMonthYear);
    const paidBMs = currentMonthBMs.filter(bm => bm.paymentStatus === 'Paid').length;
    const unpaidBMs = currentMonthBMs.filter(bm => bm.paymentStatus === 'Unpaid').length;
    
    setDynamicTotalBills(paidBMs + unpaidBMs);
    setDynamicPaidBills(paidBMs);
    setDynamicUnpaidBills(unpaidBMs);
    setBillsPaymentStatusData([
      { name: 'Paid', value: paidBMs, fill: 'hsl(var(--chart-1))' },
      { name: 'Unpaid', value: unpaidBMs, fill: 'hsl(var(--chart-3))' },
    ]);

    // 2. Customer and Meter Counts (Overall totals)
    setDynamicTotalCustomerCount(currentCustomers.length);
    setDynamicTotalBulkMeterCount(currentBulkMeters.length);

    // 3. Branch Performance Data (Bulk Meters ONLY, for the current month)
    const performanceMap = new Map<string, { branchName: string, paid: number, unpaid: number }>();
    const displayableBranches = currentBranches.filter(branch => branch.name.toLowerCase() !== 'head office');

    displayableBranches.forEach(branch => {
      performanceMap.set(branch.id, { branchName: branch.name, paid: 0, unpaid: 0 });
    });

    currentMonthBMs.forEach(bm => {
      if (bm.branchId && performanceMap.has(bm.branchId)) {
        const entry = performanceMap.get(bm.branchId)!;
        if (bm.paymentStatus === 'Paid') entry.paid++;
        else if (bm.paymentStatus === 'Unpaid') entry.unpaid++;
        performanceMap.set(bm.branchId, entry);
      }
    });

    setDynamicBranchPerformanceData(Array.from(performanceMap.values()).map(p => ({ branch: p.branchName.replace(/ Branch$/i, ""), paid: p.paid, unpaid: p.unpaid })));


    // 4. Water Usage Trend Data from Bulk Meters AND Individual Customers (historical)
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
    setDynamicWaterUsageTrendData(trendData);

  }, []);


  React.useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        await Promise.all([
          initializeBranches(),
          initializeBulkMeters(),
          initializeCustomers(),
        ]);
        if (isMounted) processDashboardData();
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
    
    return () => {
      isMounted = false;
      unsubBranches();
      unsubBulkMeters();
      unsubCustomers();
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
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bulk Meter Bills Status (This Month)</CardTitle>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dynamicTotalBills.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{dynamicPaidBills} Paid / {dynamicUnpaidBills} Unpaid</p>
            <div className="h-[120px] mt-4">
              {isClient && billsPaymentStatusData.some(d => d.value > 0) ? (
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <ResponsiveContainer>
                    <PieChartRecharts>
                      <Pie data={billsPaymentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} label>
                        {billsPaymentStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                      </Pie>
                      <Tooltip content={<ChartTooltipContent hideLabel />} />
                      <Legend content={<ChartLegendContent />} />
                    </PieChartRecharts>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No bill data for this month.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Individual Customers</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dynamicTotalCustomerCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total active individual accounts</p>
            <div className="h-[120px] mt-4 flex items-center justify-center">
                <Users className="h-16 w-16 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

         <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bulk Meters</CardTitle>
            <Gauge className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dynamicTotalBulkMeterCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total registered bulk meters</p>
            <div className="h-[120px] mt-4 flex items-center justify-center">
                <Gauge className="h-16 w-16 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>Navigate quickly to key management areas.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/admin/bulk-meters" passHref>
                <Button variant="outline" className="w-full justify-start p-4 h-auto quick-access-btn">
                 <Gauge className="mr-3 h-6 w-6" />
                    <div>
                        <p className="font-semibold text-base">View Bulk Meters</p>
                        <p className="text-xs text-muted-foreground">Manage all bulk water meters.</p>
                    </div>
                    <ArrowRight className="ml-auto h-5 w-5" />
                </Button>
            </Link>
             <Link href="/admin/individual-customers" passHref>
                <Button variant="outline" className="w-full justify-start p-4 h-auto quick-access-btn">
                    <Users className="mr-3 h-6 w-6" />
                    <div>
                        <p className="font-semibold text-base">View Individual Customers</p>
                        <p className="text-xs text-muted-foreground">Manage all individual customer accounts.</p>
                    </div>
                    <ArrowRight className="ml-auto h-5 w-5" />
                </Button>
            </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Branch Performance (Bulk Meters - This Month)</CardTitle>
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
                {isClient && dynamicBranchPerformanceData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <ResponsiveContainer>
                      <BarChart data={dynamicBranchPerformanceData}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="branch" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend content={<ChartLegendContent />} />
                        <Bar dataKey="paid" fill="var(--color-paid)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="unpaid" fill="var(--color-unpaid)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground">
                    No branch performance data available for chart.
                  </div>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                {dynamicBranchPerformanceData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Unpaid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dynamicBranchPerformanceData.map((item) => (
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
              <CardTitle>Overall Water Usage Trend</CardTitle>
              <CardDescription>Monthly water consumption across all meters.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setWaterUsageView(prev => prev === 'chart' ? 'table' : 'chart')}>
              {waterUsageView === 'chart' ? <TableIcon className="mr-2 h-4 w-4" /> : <BarChartIcon className="mr-2 h-4 w-4" />}
              View {waterUsageView === 'chart' ? 'Table' : 'Chart'}
            </Button>
          </CardHeader>
          <CardContent>
            {waterUsageView === 'chart' ? (
               <div className="h-[300px]">
                 {isClient && dynamicWaterUsageTrendData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <ResponsiveContainer>
                      <LineChart data={dynamicWaterUsageTrendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
                {dynamicWaterUsageTrendData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Water Usage (m³)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dynamicWaterUsageTrendData.map((item) => (
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