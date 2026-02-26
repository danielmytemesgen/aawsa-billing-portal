"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Users,
    MapPin,
    ThumbsUp,
    RotateCcw,
    TrendingUp,
    Activity,
    BarChart3,
    PieChart as PieChartIcon,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Calendar,
    LayoutDashboard,
    AlertTriangle
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Bar,
    CartesianGrid,
    Cell,
    AreaChart,
    Area,
    PieChart,
    Pie
} from 'recharts';
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import type { BulkMeter, Route } from "@/app/admin/bulk-meters/bulk-meter-types";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { Branch } from "@/app/admin/branches/branch-types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getFaultCodeLabel, getFaultCodeColor } from "@/lib/fault-codes";

interface ReaderReportProps {
    branches: Branch[];
    bulkMeters: BulkMeter[];
    customers: IndividualCustomer[];
    routes: Route[];
    staff: any[];
    individualReadings: any[];
    bulkReadings: any[];
}

const chartConfig = {
    value: { label: "Value", color: "hsl(var(--chart-1))" },
    count: { label: "Count", color: "hsl(var(--chart-2))" },
    collected: { label: "Collected", color: "#10b981" },
    pending: { label: "Pending", color: "#f59e0b" },
    gps: { label: "GPS Encoded", color: "#3b82f6" },
} satisfies import("@/components/ui/chart").ChartConfig;

export function ReaderReport({ branches, bulkMeters, customers, routes, staff, individualReadings, bulkReadings }: ReaderReportProps) {
    const currentMonthYear = format(new Date(), 'yyyy-MM');
    const monthName = format(new Date(), 'MMMM');
    const currentYear = format(new Date(), 'yyyy');

    const stats = React.useMemo(() => {
        const totalCustomers = bulkMeters.length;

        // GPS Encoded: Meters with coordinates
        const gpsEncoded = bulkMeters.filter(bm => bm.xCoordinate && bm.yCoordinate).length +
            customers.filter(c => (c as any).latitude && (c as any).longitude).length;

        // Collected vs Pending (This Month)
        const thisMonthBMs = bulkMeters.filter(bm => bm.month === currentMonthYear);
        const thisMonthCustomers = customers.filter(c => c.month === currentMonthYear);

        const collectedCount = thisMonthBMs.filter(bm => bm.paymentStatus === 'Paid').length +
            thisMonthCustomers.filter(c => c.paymentStatus === 'Paid').length;

        const pendingCount = thisMonthBMs.filter(bm => bm.paymentStatus === 'Unpaid').length +
            thisMonthCustomers.filter(c => c.paymentStatus === 'Unpaid').length;

        // Charts: Customer Data Status (Modernized for Pie/Bar)
        const dataStatus = [
            { name: 'Collected', value: collectedCount, color: '#10b981', fill: '#10b981' },
            { name: 'Pending', value: pendingCount, color: '#f59e0b', fill: '#f59e0b' },
            { name: 'GPS Encoded', value: gpsEncoded, color: '#3b82f6', fill: '#3b82f6' },
        ];

        // Charts: Reading Type Ratio (Real categorizations from readings)
        const allReadings = [...individualReadings, ...bulkReadings];

        const zeroReadings = allReadings.filter(r => {
            const usage = (Number(r.readingValue) || 0) - (Number(r.previousReading) || 0);
            return usage === 0 && !r.FAULT_CODE;
        }).length;

        const faultReadings = allReadings.filter(r => r.FAULT_CODE && r.FAULT_CODE !== '').length;

        const increaseReadings = allReadings.filter(r => {
            const usage = (Number(r.readingValue) || 0) - (Number(r.previousReading) || 0);
            return usage > 0 && !r.FAULT_CODE;
        }).length;

        const decreaseReadings = allReadings.filter(r => {
            const usage = (Number(r.readingValue) || 0) - (Number(r.previousReading) || 0);
            return usage < 0 && !r.FAULT_CODE;
        }).length;

        const readingTypes = [
            { category: 'Zero', count: zeroReadings, color: '#94a3b8' },
            { category: 'Fault', count: faultReadings, color: '#ef4444' },
            { category: 'Increase', count: increaseReadings, color: '#10b981' },
            { category: 'Decrease', count: decreaseReadings, color: '#f59e0b' },
        ];

        // Fault Code Breakdown
        const faultCodeBreakdown: { code: string; label: string; count: number; color: string; percentage: number }[] = [];
        const faultReadingsWithCode = allReadings.filter(r => r.FAULT_CODE && r.FAULT_CODE !== '');

        const faultCodeCounts = new Map<string, number>();
        faultReadingsWithCode.forEach(r => {
            const code = r.FAULT_CODE || 'UNKNOWN';
            faultCodeCounts.set(code, (faultCodeCounts.get(code) || 0) + 1);
        });

        faultCodeCounts.forEach((count, code) => {
            faultCodeBreakdown.push({
                code,
                label: getFaultCodeLabel(code),
                count,
                color: getFaultCodeColor(code),
                percentage: faultReadings > 0 ? (count / faultReadings) * 100 : 0
            });
        });

        // Sort by count descending
        faultCodeBreakdown.sort((a, b) => b.count - a.count);

        // Consumption Trend Calculation (Last 6 Months)
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = subMonths(new Date(), i);
            return format(date, 'yyyy-MM');
        }).reverse();

        const trendData = last6Months.map(month => {
            let usage = 0;
            allReadings.forEach(r => {
                const dateStr = r.readingDate || r.createdAt;
                if (!dateStr) return;
                const rMonth = typeof dateStr === 'string' ? dateStr.substring(0, 7) : format(new Date(dateStr), 'yyyy-MM');
                if (rMonth === month) {
                    usage += (Number(r.readingValue) || 0) - (Number(r.previousReading) || 0);
                }
            });
            return {
                month: format(new Date(month + "-01"), 'MMM'),
                consumption: usage > 0 ? usage : 0
            };
        });

        const currentMonthUsage = trendData[trendData.length - 1].consumption;
        const previousMonthUsage = trendData[trendData.length - 2]?.consumption || 0;
        const trendPercentage = previousMonthUsage > 0
            ? ((currentMonthUsage - previousMonthUsage) / previousMonthUsage) * 100
            : 0;

        const formattedUsage = currentMonthUsage > 1000000
            ? `${(currentMonthUsage / 1000000).toFixed(1)}M`
            : currentMonthUsage > 1000
                ? `${(currentMonthUsage / 1000).toFixed(1)}K`
                : currentMonthUsage.toFixed(0);

        // Branch Detail Table Data
        const branchDetails = branches.filter(b => b.name.toLowerCase() !== 'head office').map(branch => {
            const bCustomers = customers.filter(c => c.branchId === branch.id);
            const bBulkMeters = bulkMeters.filter(bm => bm.branchId === branch.id);
            const bThisMonthBMs = bBulkMeters.filter(bm => bm.month === currentMonthYear);
            const bThisMonthCusts = bCustomers.filter(c => c.branchId === branch.id && c.month === currentMonthYear);

            const branchReaders = staff.filter(s => s.branchId === branch.id && s.role.toLowerCase() === 'reader').length;
            const branchRoutes = routes.filter(r => r.branchId === branch.id).length;

            const collected = bThisMonthBMs.filter(bm => bm.paymentStatus === 'Paid').length +
                bThisMonthCusts.filter(c => c.paymentStatus === 'Paid').length;
            const pending = bThisMonthBMs.filter(bm => bm.paymentStatus === 'Unpaid').length +
                bThisMonthCusts.filter(c => c.paymentStatus === 'Unpaid').length;
            const total = bCustomers.length + bBulkMeters.length;
            const performance = total > 0 ? Math.round((collected / total) * 100) : 0;

            return {
                id: branch.id,
                name: branch.name.replace(/ Branch$/i, ""),
                total,
                collected,
                pending,
                readers: branchReaders,
                routes: branchRoutes,
                performance
            };
        });

        return {
            totalCustomers,
            gpsEncoded,
            collectedCount,
            pendingCount,
            dataStatus,
            readingTypes,
            faultCodeBreakdown,
            branchDetails,
            currentMonthUsage,
            formattedUsage,
            trendData,
            trendPercentage
        };
    }, [branches, bulkMeters, customers, routes, staff, currentMonthYear, individualReadings, bulkReadings]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Top Stats Cards - Modernized */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="relative overflow-hidden group border-none shadow-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white transition-all hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Users size={80} />
                    </div>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Users className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-bold">{stats.totalCustomers.toLocaleString()}</h3>
                            <div className="text-blue-100 text-sm font-medium">Total Bulk Meters</div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-blue-100">
                            <Activity className="h-3 w-3 mr-1" />
                            <span>System Wide Reach</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden group border-none shadow-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white transition-all hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <MapPin size={80} />
                    </div>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <MapPin className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-bold">{stats.gpsEncoded.toLocaleString()}</h3>
                            <div className="text-emerald-100 text-sm font-medium">GPS Mapped Meters</div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-emerald-100">
                            <div className="flex -space-x-1">
                                <div className="h-3 w-3 rounded-full bg-white/40 border border-emerald-500" />
                                <div className="h-3 w-3 rounded-full bg-white/60 border border-emerald-500" />
                                <div className="h-3 w-3 rounded-full bg-white/80 border border-emerald-500" />
                            </div>
                            <span className="ml-2">Spatial Coverage Data</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden group border-none shadow-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white transition-all hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <ThumbsUp size={80} />
                    </div>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <ThumbsUp className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-bold">{stats.collectedCount.toLocaleString()}</h3>
                            <div className="text-indigo-100 text-sm font-medium">Collected</div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-indigo-100">
                            <Badge variant="outline" className="text-[10px] h-4 border-white/30 text-white bg-white/10">
                                This Month
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden group border-none shadow-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white transition-all hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <RotateCcw size={80} />
                    </div>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <RotateCcw className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-bold">{stats.pendingCount.toLocaleString()}</h3>
                            <div className="text-amber-100 text-sm font-medium">Pending</div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-amber-100">
                            <Activity className="h-3 w-3 mr-1" />
                            <span>Action Required</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Customer Data Status - Modern Pie Chart */}
                <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <PieChartIcon className="h-5 w-5 text-blue-500" />
                                Data Distribution
                            </CardTitle>
                        </div>
                        <CardDescription>Overall status of customer entries</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ChartContainer config={chartConfig} className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.dataStatus}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {stats.dataStatus.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltipContent />} />
                                        <Legend verticalAlign="bottom" height={36} content={<ChartLegendContent />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </div>
                        <div className="mt-6 grid grid-cols-1 gap-3">
                            {stats.dataStatus.map((item) => (
                                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-sm font-medium text-gray-700">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-900">{item.value.toLocaleString()}</span>
                                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                                            {stats.totalCustomers > 0 ? ((item.value / stats.totalCustomers) * 100).toFixed(1) : 0}%
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Reading Type Ratio - Enhanced Bar Chart */}
                <Card className="lg:col-span-2 border-none shadow-lg bg-white/50 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-indigo-500" />
                                Reading Analytics
                            </CardTitle>
                        </div>
                        <CardDescription>Analysis of meter reading results for {monthName} {currentYear}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] pt-8">
                            <ChartContainer config={chartConfig} className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.readingTypes} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                        <XAxis
                                            dataKey="category"
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fontSize: 12, fontWeight: 500 }}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }}
                                            content={<ChartTooltipContent />}
                                        />
                                        <Bar
                                            dataKey="count"
                                            radius={[8, 8, 0, 0]}
                                            barSize={60}
                                        >
                                            {stats.readingTypes.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </div>
                        <div className="mt-4 flex flex-wrap justify-center gap-6">
                            {stats.readingTypes.map(rt => (
                                <div key={rt.category} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: rt.color }} />
                                    <span className="text-sm font-semibold text-gray-700">{rt.category}</span>
                                    <span className="text-sm text-gray-500">({rt.count})</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Fault Code Breakdown - New Card */}
                {stats.faultCodeBreakdown.length > 0 && (
                    <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                Fault Code Breakdown
                            </CardTitle>
                            <CardDescription>Detailed analysis of fault readings for {monthName} {currentYear}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {stats.faultCodeBreakdown.map((fault) => (
                                    <div key={fault.code} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fault.color }} />
                                            <div>
                                                <span className="text-sm font-bold text-gray-900">{fault.label}</span>
                                                <span className="text-xs text-gray-500 ml-2">({fault.code})</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-gray-900">{fault.count}</span>
                                            <Badge variant="secondary" className="text-[10px] py-0 px-2 h-5">
                                                {fault.percentage.toFixed(1)}%
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Consumption Per Month - Enhanced Area Chart */}
                <Card className="lg:col-span-1 border-none shadow-lg bg-gradient-to-b from-blue-50 to-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            Consumption Trend
                        </CardTitle>
                        <CardDescription>Historical water usage (m³)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mt-4 flex flex-col items-center">
                            <div className="text-center mb-6">
                                <div className="text-4xl font-black text-blue-900">{stats.formattedUsage}</div>
                                <div className="text-sm font-medium text-blue-600 uppercase tracking-widest">{monthName} Total</div>
                                <div className={cn(
                                    "mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                                    stats.trendPercentage > 0 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                                )}>
                                    {stats.trendPercentage > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                                    {Math.abs(stats.trendPercentage).toFixed(1)}% vs Last Month
                                </div>
                            </div>

                            <div className="h-[200px] w-full">
                                <ChartContainer config={chartConfig} className="w-full h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats.trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Tooltip content={<ChartTooltipContent />} />
                                            <Area
                                                type="monotone"
                                                dataKey="consumption"
                                                stroke="#2563eb"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorUsage)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </div>
                            <div className="w-full flex justify-between px-2 mt-4">
                                {stats.trendData.map((d, i) => (
                                    <span key={i} className="text-[10px] font-bold text-gray-400 uppercase">{d.month}</span>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Branch Details - Styled Table */}
                <Card className="lg:col-span-2 border-none shadow-lg overflow-hidden">
                    <CardHeader className="bg-gray-50/50 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold">Branch Performance Matrix</CardTitle>
                            <div className="flex gap-2">
                                <Badge variant="secondary" className="font-bold bg-blue-100 text-blue-700 border-none">
                                    {branches.length - 1} Branches
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-gray-100/50">
                                <TableRow>
                                    <TableHead className="text-xs font-bold text-gray-600">BRANCH</TableHead>
                                    <TableHead className="text-xs font-bold text-gray-600 text-center">CUSTOMERS</TableHead>
                                    <TableHead className="text-xs font-bold text-emerald-600 text-center">COLLECTED</TableHead>
                                    <TableHead className="text-xs font-bold text-amber-600 text-center">PENDING</TableHead>
                                    <TableHead className="text-xs font-bold text-gray-600 text-center">READERS</TableHead>
                                    <TableHead className="text-xs font-bold text-gray-600 text-center">ROUTES</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.branchDetails.map((branch) => (
                                    <TableRow key={branch.id} className="hover:bg-blue-50/30 transition-colors border-b">
                                        <TableCell className="py-4">
                                            <span className="font-bold text-gray-900">{branch.name}</span>
                                        </TableCell>
                                        <TableCell className="text-center font-semibold text-gray-700">{branch.total}</TableCell>
                                        <TableCell className="text-center">
                                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                                                {branch.collected}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                                                {branch.pending}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-gray-500">{branch.readers}</TableCell>
                                        <TableCell className="text-center font-medium text-gray-500">{branch.routes}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
