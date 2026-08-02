"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, FileText, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { getCustomerBillsAction, getCustomerAccountAction } from "@/lib/actions";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useCustomerActivityLogger } from "@/lib/customer-activity-logger";
import { getMonthlyBillAmt } from "@/lib/billing-utils";
import { motion, AnimatePresence } from "framer-motion";


interface Bill {
    id: string;
    month_year: string;
    TOTALBILLAMOUNT: number;
    total_amount_due?: number;
    payment_status: string;
    due_date: string;
    created_at: string;
    bill_period_start_date?: string;
    bill_period_end_date?: string;
    CONS?: number;
    usage_m3?: number;
    PENALTYAMT?: number;
    THISMONTHBILLAMT?: number;
    OUTSTANDINGAMT?: number;
    debit_30?: number;
    debit_30_60?: number;
    debit_60?: number;
}

interface CustomerAccount {
    name: string;
    customerKeyNumber: string;
    meterNumber: string;
    currentReading: number;
    previousReading: number;
    status: string;
}

export default function CustomerDashboardPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [bills, setBills] = useState<Bill[]>([]);
    const [account, setAccount] = useState<CustomerAccount | null>(null);
    const [currentBill, setCurrentBill] = useState<Bill | null>(null);
    const [stats, setStats] = useState({
        totalBills: 0,
        paidBills: 0,
        outstandingAmount: 0,
    });

    // Log page view
    useCustomerActivityLogger('Dashboard');

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const customerData = localStorage.getItem("customer");
            if (!customerData) return;

            const customer = JSON.parse(customerData);
            const customerKeyNumber = customer.customerKeyNumber;
            const customerType = customer.customerType || "individual";
            const sessionId = customer.sessionId;

            // Load bills based on customer type
            if (customerType === "bulk") {
                const { getBulkMeterBillsAction, getBulkMeterAccountAction } = await import("@/lib/actions");

                const { data: billsData } = await getBulkMeterBillsAction(customerKeyNumber, true, sessionId);
                if (billsData) {
                    const processedBills = (billsData as any[]).map((b: any) => ({
                        ...b,
                        month_year: b.month_year || (b.created_at ? format(new Date(b.created_at), "MMM yyyy") : "N/A"),
                        TOTALBILLAMOUNT: Number(b.TOTALBILLAMOUNT ?? 0),
                        CONS: Number(b.CONS ?? 0)
                    }));
                    setBills(processedBills);

                    const unpaidBill = processedBills.find((b: any) => b.payment_status !== "Paid");
                    setCurrentBill(unpaidBill || null);

                    const totalBills = processedBills.length;
                    const paidBills = processedBills.filter((b: any) => b.payment_status === "Paid").length;
                    const outstandingAmount = processedBills
                        .filter((b: any) => b.payment_status !== "Paid")
                        .reduce((sum: number, b: any) => {
                            const outstanding = Number(b.OUTSTANDINGAMT ?? (Number(b.debit_30 || 0) + Number(b.debit_30_60 || 0) + Number(b.debit_60 || 0)));
                            const current = getMonthlyBillAmt(b);
                            const penalty = Number(b.PENALTYAMT || 0);
                            return sum + outstanding + penalty + current;
                        }, 0);

                    setStats({ totalBills, paidBills, outstandingAmount });
                }

                // Load bulk meter account info
                const { data: accountData } = await getBulkMeterAccountAction(customerKeyNumber, sessionId);
                if (accountData) {
                    setAccount(accountData as any);
                }
            } else {
                // Individual customer
                const { data: billsData } = await getCustomerBillsAction(customerKeyNumber, true, sessionId);
                if (billsData) {
                    const processedBills = (billsData as any[]).map((b: any) => ({
                        ...b,
                        month_year: b.month_year || (b.created_at ? format(new Date(b.created_at), "MMM yyyy") : "N/A"),
                        TOTALBILLAMOUNT: Number(b.TOTALBILLAMOUNT ?? 0),
                        CONS: Number(b.CONS ?? 0)
                    }));
                    setBills(processedBills);

                    const unpaidBill = processedBills.find((b: any) => b.payment_status !== "Paid");
                    setCurrentBill(unpaidBill || null);

                    const totalBills = processedBills.length;
                    const paidBills = processedBills.filter((b: any) => b.payment_status === "Paid").length;
                    const outstandingAmount = processedBills
                        .filter((b: any) => b.payment_status !== "Paid")
                        .reduce((sum: number, b: any) => {
                            const outstanding = Number(b.OUTSTANDINGAMT ?? (Number(b.debit_30 || 0) + Number(b.debit_30_60 || 0) + Number(b.debit_60 || 0)));
                            const current = getMonthlyBillAmt(b);
                            const penalty = Number(b.PENALTYAMT || 0);
                            return sum + outstanding + penalty + current;
                        }, 0);

                    setStats({ totalBills, paidBills, outstandingAmount });
                }

                // Load individual customer account info
                const { data: accountData } = await getCustomerAccountAction(customerKeyNumber, sessionId);
                if (accountData) {
                    setAccount(accountData as any);
                }
            }
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="h-10 w-1/4 bg-slate-200 rounded-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-40 bg-slate-100 rounded-3xl"></div>
                    <div className="h-40 bg-slate-100 rounded-3xl"></div>
                    <div className="h-40 bg-slate-100 rounded-3xl"></div>
                </div>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="status-pulse">
                            <span className="status-pulse-dot bg-green-500"></span>
                            <span className="status-pulse-inner bg-green-500"></span>
                        </div>
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">Live Updates</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        Welcome back, {account?.name ? account.name.split(' ')[0] : 'Customer'}!
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Here&apos;s what&apos;s happening with your water account today.</p>
                </div>
            </div>


            {/* Current Bill Alert */}
            {currentBill && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 shadow-lg shadow-amber-100 dark:shadow-none rounded-3xl overflow-hidden">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                                <div className="p-2 bg-amber-100 dark:bg-amber-800/30 rounded-xl">
                                    <AlertCircle className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-lg font-bold">Pending Payment</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div>
                                    <p className="text-amber-900 dark:text-amber-100 font-bold text-lg">
                                        Your bill for {currentBill.month_year} is ready and due on {currentBill.due_date ? format(new Date(currentBill.due_date), "MMM dd, yyyy") : "N/A"}.
                                    </p>
                                    <p className="text-amber-700 dark:text-amber-300 text-sm mt-1 font-medium">
                                        Consumption Recorded: <span className="font-bold">{currentBill.CONS || 0} m³</span>
                                    </p>
                                </div>
                                <div className="text-left md:text-right">
                                    <p className="text-xs text-amber-700 dark:text-amber-400 uppercase font-black tracking-widest mb-1">Total Amount Due</p>
                                    <p className="text-4xl font-black text-amber-900 dark:text-amber-100 tracking-tighter">
                                        ETB {(
                                            Number(currentBill.PENALTYAMT || 0) +
                                            Number(currentBill.OUTSTANDINGAMT ?? (Number(currentBill.debit_30 || 0) + Number(currentBill.debit_30_60 || 0) + Number(currentBill.debit_60 || 0))) +
                                            getMonthlyBillAmt(currentBill)
                                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}


            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="refined-card border-l-4 border-l-blue-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Bills</CardTitle>
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalBills}</div>
                            <p className="text-xs text-slate-500 mt-1">Total records found</p>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="refined-card border-l-4 border-l-emerald-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Settled Bills</CardTitle>
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.paidBills}</div>
                            <p className="text-xs text-slate-500 mt-1">Successfully paid</p>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="refined-card border-l-4 border-l-rose-500 shadow-rose-100 dark:shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Outstanding</CardTitle>
                            <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                                <DollarSign className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-rose-600">ETB {stats.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <p className="text-xs text-slate-500 mt-1">Pending payment</p>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>


            {/* Main Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Insights Column */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Usage Insight Card */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                        <Card className="refined-card bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-none shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <div className="h-6 w-1 bg-blue-600 rounded-full" />
                                    Monthly Insight
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {bills.length >= 2 ? (() => {
                                    const latestUsage = Number(bills[0].CONS || bills[0].usage_m3 || 0);
                                    const prevUsage = Number(bills[1].CONS || bills[1].usage_m3 || 0);
                                    const diff = latestUsage - prevUsage;
                                    const isIncrease = diff > 0;
                                    return (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white">
                                                        {isIncrease ? '+' : ''}{Math.abs(diff).toFixed(1)}
                                                    </span>
                                                    <span className="text-2xl font-bold text-slate-400">m³</span>
                                                </div>
                                                <div className={`p-4 rounded-2xl ${isIncrease ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'}`}>
                                                    {isIncrease ? <AlertCircle className="h-8 w-8" /> : <CheckCircle className="h-8 w-8" />}
                                                </div>
                                            </div>
                                            <p className={`text-base font-semibold leading-relaxed ${isIncrease ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {isIncrease
                                                    ? `Your consumption went up by ${diff.toFixed(1)} m³ this month. Check for leaks to save on your next bill.`
                                                    : `Excellent! You saved ${Math.abs(diff).toFixed(1)} m³ compared to last month. Keep up the efficiency.`}
                                            </p>
                                        </div>
                                    );
                                })() : (
                                    <p className="text-slate-400 font-bold py-8 text-center">Collecting more data for insights...</p>
                                )}
                                <Button variant="secondary" className="w-full mt-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-blue-600 dark:text-blue-400" onClick={() => (window.location.href = '/customer/readings')}>
                                    Explore Full History
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>



                    {/* Recent Bills List */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <Card className="refined-card">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-bold">Recent Bills</CardTitle>
                                    <CardDescription>Your latest billing records</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" className="text-blue-600 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => (window.location.href = '/customer/bills')}>
                                    View All Records
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {bills.length === 0 ? (
                                    <p className="text-center py-8 text-slate-400 font-medium">No recent bills found</p>
                                ) : (
                                    <div className="space-y-3">
                                        {bills.slice(0, 5).map((bill, index) => (
                                            <motion.div 
                                                key={bill.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.4 + (index * 0.1) }}
                                                className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-white">{bill.month_year}</p>
                                                        <p className="text-xs text-slate-500">Issued: {bill.created_at ? format(new Date(bill.created_at), "MMM d, yyyy") : 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-900 dark:text-white">ETB {(Number(bill.PENALTYAMT || 0) + Number(bill.OUTSTANDINGAMT ?? (Number(bill.debit_30 || 0) + Number(bill.debit_30_60 || 0) + Number(bill.debit_60 || 0))) + getMonthlyBillAmt(bill)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                    <Badge 
                                                        className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${bill.payment_status === "Paid" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"} text-white border-none`}
                                                    >
                                                        {bill.payment_status}
                                                    </Badge>

                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                </div>

                <div className="lg:col-span-4 space-y-8">
                    {/* Bill Breakdown Pie */}
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                        <Card className="refined-card">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Charge Distribution</CardTitle>
                                <CardDescription>Latest billing cycle breakdown</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px] p-4">
                                {!bills[0] ? (
                                    <div className="h-full flex items-center justify-center text-slate-400 font-bold">No data available</div>
                                ) : (() => {
                                    const bill = bills[0] as any;
                                    const data = [
                                        { name: 'Water', value: Number(bill.base_water_charge || 0), color: '#3b82f6' },
                                        { name: 'Sewerage', value: Number(bill.sewerage_charge || 0), color: '#10b981' },
                                        { name: 'Sanitation', value: Number(bill.sanitation_fee || 0), color: '#f59e0b' },
                                        { name: 'Maintenance', value: Number(bill.maintenance_fee || 0), color: '#8b5cf6' },
                                        { name: 'Meter Rent', value: Number(bill.meter_rent || 0), color: '#64748b' },
                                        { name: 'Penalty', value: Number(bill.PENALTYAMT || 0), color: '#ef4444' },
                                    ].filter(item => item.value > 0);

                                    return (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={data} 
                                                    cx="50%" 
                                                    cy="50%" 
                                                    innerRadius={65} 
                                                    outerRadius={90} 
                                                    paddingAngle={8} 
                                                    dataKey="value" 
                                                    stroke="none"
                                                >
                                                    {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ 
                                                        borderRadius: '1rem', 
                                                        border: 'none', 
                                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                        padding: '12px'
                                                    }}
                                                    itemStyle={{ fontWeight: 800, fontSize: '0.875rem' }}
                                                />
                                                <Legend 
                                                    verticalAlign="bottom" 
                                                    align="center" 
                                                    iconType="circle" 
                                                    wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px' }} 
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Consumption History Chart */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                        <Card className="refined-card">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Usage Trends</CardTitle>
                                <CardDescription>Consumption over 6 months</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[250px] pt-4">
                                {bills.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-400 font-bold">No data available</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={[...bills].reverse().slice(-6).map(b => ({ month: b.month_year, usage: Number(b.CONS || b.usage_m3 || 0) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="dashboardBarGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 scale-105 transition-transform">
                                                                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">{payload[0].payload.month}</p>
                                                                <p className="text-xl font-black">{payload[0].value} <span className="text-xs text-blue-400 uppercase">m³</span></p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="usage" fill="url(#dashboardBarGradient)" radius={[10, 10, 0, 0]} barSize={24} stroke="#3b82f6" strokeWidth={1} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

            </div>
        </motion.div>
    );

}

