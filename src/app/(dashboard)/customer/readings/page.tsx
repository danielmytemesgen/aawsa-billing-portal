"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Droplets, Calendar, BarChart3, Info, RotateCcw } from "lucide-react";
import { getCustomerReadingsAction, getBulkMeterReadingsAction } from "@/lib/actions";
import { format, parse } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCustomerActivityLogger } from "@/lib/customer-activity-logger";
import { motion } from "framer-motion";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";


interface Reading {
    id: string | number;
    // Individual customer fields
    reading_date?: string;
    reading_value?: number;
    month_year?: string;
    is_estimate?: boolean;
    // Bulk meter fields
    READING_DATE?: string;
    METER_READING?: number;
    ESTIMATED_READING_IND?: string;
    // Common fields
    notes?: string;
}

export default function ReadingHistoryPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [readings, setReadings] = useState<Reading[]>([]);
    const [filteredReadings, setFilteredReadings] = useState<Reading[]>([]);
    const [filterMonth, setFilterMonth] = useState<string>("all");
    const [customerType, setCustomerType] = useState<string>("individual");

    // Log page view
    useCustomerActivityLogger('Readings');

    useEffect(() => {
        loadReadings();
    }, []);

    useEffect(() => {
        filterReadings();
    }, [readings, filterMonth]);

    const loadReadings = async () => {
        try {
            const customerData = localStorage.getItem("customer");
            if (!customerData) return;

            const customer = JSON.parse(customerData);
            const customerKeyNumber = customer.customerKeyNumber;
            const type = customer.customerType || "individual";
            setCustomerType(type);

            const sessionId = customer.sessionId;
            if (type === "bulk") {
                const { data } = await getBulkMeterReadingsAction(customerKeyNumber, sessionId);
                if (data) setReadings(data as any);
            } else {
                const { data } = await getCustomerReadingsAction(customerKeyNumber, sessionId);
                if (data) setReadings(data as any);
            }
        } catch (error) {
            console.error("Failed to load readings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filterReadings = () => {
        if (filterMonth === "all") {
            setFilteredReadings(readings);
        } else {
            setFilteredReadings(readings.filter(r => {
                const rDate = r.reading_date || r.READING_DATE;
                if (!rDate) return false;
                return new Date(rDate).toISOString().substring(0, 7) === filterMonth;
            }));
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Reading History</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Monitor your meter readings and water consumption trends.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Filter by Month</Label>
                        <div className="flex items-center gap-2">
                            <DatePicker 
                                date={filterMonth === 'all' ? undefined : parse(filterMonth, 'yyyy-MM', new Date())}
                                onSelect={(date) => {
                                    if (date) {
                                        setFilterMonth(format(date, 'yyyy-MM'));
                                    }
                                }}
                                placeholder="Select Month"
                                className="w-full sm:w-[200px] h-11 bg-white dark:bg-slate-900 rounded-xl"
                            />
                            {filterMonth !== 'all' && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setFilterMonth('all')}
                                    className="h-11 w-11 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    title="Clear filter"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-5 sm:pt-0">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-slate-800">
                            <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Records</p>
                            <p className="font-bold text-slate-900 dark:text-white">{filteredReadings.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Consumption Trend Chart */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="refined-card overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold">Meter Reading Trend</CardTitle>
                                <CardDescription className="text-sm font-medium">Visual representation of your historical meter readings (m³)</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[350px] p-8">
                        {filteredReadings.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                                <BarChart3 className="h-12 w-12 opacity-20" />
                                <p className="font-bold">No reading data matches your filter</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[...filteredReadings].map(r => ({
                                        ...r,
                                        displayValue: r.METER_READING || r.reading_value || 0,
                                        displayMonth: r.month_year || (
                                            (r.READING_DATE || r.reading_date)
                                                ? format(new Date(r.READING_DATE || r.reading_date!), "MMM yyyy")
                                                : "N/A"
                                        )
                                    })).reverse()}
                                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                                    barSize={40}
                                >
                                    <defs>
                                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="displayMonth" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 scale-105 transition-transform">
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">{payload[0].payload.displayMonth}</p>
                                                        <p className="text-xl font-black">
                                                            {payload[0].value} <span className="text-xs text-blue-400 uppercase">m³</span>
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar 
                                        dataKey="displayValue" 
                                        fill="url(#barGradient)" 
                                        radius={[12, 12, 0, 0]}
                                        stroke="#3b82f6"
                                        strokeWidth={1}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Readings Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="refined-card overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                                <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold">Detailed Readings</CardTitle>
                                <CardDescription className="text-sm font-medium">Chronological log of all recorded meter points</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {filteredReadings.length === 0 ? (
                            <div className="text-center py-24 bg-white dark:bg-slate-900">
                                <Info className="h-12 w-12 mx-auto text-slate-200 mb-4" />
                                <p className="text-slate-400 font-bold text-lg">No matching readings</p>
                                <p className="text-slate-500 text-sm">We couldn&apos;t find any readings matching your selected month.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 dark:bg-slate-900">
                                        <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                                            <TableHead className="py-4 px-8 font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400">Month/Year</TableHead>
                                            <TableHead className="py-4 px-8 font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400">Reading Date</TableHead>
                                            <TableHead className="py-4 px-8 font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400">Reading Value</TableHead>
                                            <TableHead className="py-4 px-8 font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400">Data Type</TableHead>
                                            <TableHead className="py-4 px-8 font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400">Remarks</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredReadings.map((reading, index) => {
                                            const monthYear = reading.month_year || (
                                                (reading.READING_DATE || reading.reading_date)
                                                    ? format(new Date(reading.READING_DATE || reading.reading_date!), "MMM yyyy")
                                                    : "N/A"
                                            );
                                            const isEstimate = reading.ESTIMATED_READING_IND === 'Y' || reading.is_estimate;

                                            return (
                                                <motion.tr 
                                                    key={reading.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.2 + (index * 0.05) }}
                                                    className="group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-slate-200 dark:border-slate-800"
                                                >
                                                    <TableCell className="py-5 px-8 font-bold text-slate-900 dark:text-white">{monthYear}</TableCell>
                                                    <TableCell className="py-5 px-8 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                        {format(new Date(reading.READING_DATE || reading.reading_date!), "MMM dd, yyyy")}
                                                    </TableCell>
                                                    <TableCell className="py-5 px-8">
                                                        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
                                                            {Number(reading.METER_READING ?? reading.reading_value ?? 0).toFixed(2)}
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">m³</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-5 px-8">
                                                        {isEstimate ? (
                                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/50">
                                                                <Info className="h-3 w-3" />
                                                                Estimated
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/50">
                                                                Actual
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-5 px-8 text-slate-600 dark:text-slate-400 font-medium italic max-w-[200px] truncate">
                                                        {reading.notes || "—"}
                                                    </TableCell>
                                                </motion.tr>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}

