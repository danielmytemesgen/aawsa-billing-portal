"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, FileText, CheckCircle, AlertCircle, Calendar, User, BarChart3 } from "lucide-react";
import { getCustomerBillsAction, getCustomerAccountAction } from "@/lib/actions";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useCustomerActivityLogger } from "@/lib/customer-activity-logger";

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
    useEffect(() => {
        useCustomerActivityLogger('Dashboard');
    }, []);

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

            // Load bills based on customer type
            if (customerType === "bulk") {
                const { getBulkMeterBillsAction, getBulkMeterAccountAction } = await import("@/lib/actions");

                const { data: billsData } = await getBulkMeterBillsAction(customerKeyNumber);
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
                        .reduce((sum: number, b: any) => sum + b.TOTALBILLAMOUNT, 0);

                    setStats({ totalBills, paidBills, outstandingAmount });
                }

                // Load bulk meter account info
                const { data: accountData } = await getBulkMeterAccountAction(customerKeyNumber);
                if (accountData) {
                    setAccount(accountData as any);
                }
            } else {
                // Individual customer
                const { data: billsData } = await getCustomerBillsAction(customerKeyNumber);
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
                        .reduce((sum: number, b: any) => sum + b.TOTALBILLAMOUNT, 0);

                    setStats({ totalBills, paidBills, outstandingAmount });
                }

                // Load individual customer account info
                const { data: accountData } = await getCustomerAccountAction(customerKeyNumber);
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
            <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Overview of your water account</p>
            </div>

            {/* Current Bill Alert */}
            {currentBill && (
                <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 shadow-sm overflow-hidden backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-amber-600" />
                                <CardTitle className="text-lg text-amber-900 font-bold uppercase tracking-wide">Current Bill Due</CardTitle>
                            </div>
                            <Badge variant="destructive" className="bg-amber-600 hover:bg-amber-700">Unpaid</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="p-3 bg-white/40 rounded-lg">
                                <p className="text-xs text-amber-800/70 font-bold uppercase mb-1">Billing Period</p>
                                <p className="text-lg font-bold text-amber-900">{currentBill.month_year}</p>
                            </div>
                            <div className="p-3 bg-white/40 rounded-lg">
                                <p className="text-xs text-amber-800/70 font-bold uppercase mb-1">Amount Due</p>
                                <p className="text-2xl font-black text-amber-700">ETB {Number(currentBill.TOTALBILLAMOUNT ?? currentBill.total_amount_due ?? 0).toFixed(2)}</p>
                            </div>
                            <div className="p-3 bg-white/40 rounded-lg">
                                <p className="text-xs text-amber-800/70 font-bold uppercase mb-1">Due Date</p>
                                <p className="text-lg font-bold text-amber-900">
                                    {currentBill.due_date ? format(new Date(currentBill.due_date), "MMM dd, yyyy") : "N/A"}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="bg-blue-50 border-blue-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-900">Total Bills</CardTitle>
                        <FileText className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{stats.totalBills}</div>
                        <p className="text-xs text-blue-600/70 mt-1">All time billing records</p>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-50 border-emerald-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-900">Paid Bills</CardTitle>
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-700">{stats.paidBills}</div>
                        <p className="text-xs text-emerald-600/70 mt-1">Successfully paid</p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-50 border-amber-100 shadow-sm sm:col-span-2 lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-900">Outstanding Balance</CardTitle>
                        <DollarSign className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-700">ETB {stats.outstandingAmount.toFixed(2)}</div>
                        <p className="text-xs text-amber-600/70 mt-1">Amount pending payment</p>
                    </CardContent>
                </Card>
            </div>

            {/* Account Info */}
            {account && (
                <Card className="bg-indigo-50/50 border-indigo-100 shadow-sm border-t-4 border-t-indigo-500">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-indigo-600" />
                            <CardTitle className="text-indigo-900">Account Information</CardTitle>
                        </div>
                        <CardDescription className="text-indigo-600/70">Your water meter details</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="p-3 bg-white/50 rounded-lg">
                                <p className="text-xs text-indigo-700/60 font-bold uppercase mb-1">Account Name</p>
                                <p className="font-bold text-indigo-900">{account.name}</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                                <p className="text-xs text-indigo-700/60 font-bold uppercase mb-1">Customer Key</p>
                                <p className="font-bold text-indigo-900">{account.customerKeyNumber}</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                                <p className="text-xs text-indigo-700/60 font-bold uppercase mb-1">Meter Number</p>
                                <p className="font-bold text-indigo-900">{account.meterNumber || "N/A"}</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                                <p className="text-xs text-indigo-700/60 font-bold uppercase mb-1">Status</p>
                                <Badge variant={account.status === "Active" ? "default" : "secondary"} className={account.status === "Active" ? "bg-indigo-600" : ""}>
                                    {account.status}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Smart Insights: Usage Comparison & Bill Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Usage Comparison Card */}
                <Card className="bg-slate-50 border-slate-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-900">Usage Insights</CardTitle>
                        <CardDescription className="text-slate-600/70">Comparison with previous period</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {bills.length < 2 ? (
                            <div className="h-[250px] flex flex-col items-center justify-center text-gray-500 space-y-2">
                                <AlertCircle className="h-8 w-8 opacity-20" />
                                <p>Not enough data for comparison</p>
                            </div>
                        ) : (() => {
                            const latest = bills[0];
                            const previous = bills[1];
                            const latestUsage = Number(latest.CONS ?? latest.usage_m3 ?? 0);
                            const prevUsage = Number(previous.CONS ?? previous.usage_m3 ?? 0);
                            const diff = latestUsage - prevUsage;
                            const percentChange = prevUsage !== 0 ? (diff / prevUsage) * 100 : 0;
                            const isIncrease = diff > 0;

                            return (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                        <div>
                                            <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">Trend</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className={`text-3xl font-bold ${isIncrease ? 'text-orange-600' : 'text-green-600'}`}>
                                                    {isIncrease ? '+' : ''}{percentChange.toFixed(1)}%
                                                </span>
                                                <span className="text-sm text-gray-400 font-medium">vs last month</span>
                                            </div>
                                        </div>
                                        <div className={`p-3 rounded-full ${isIncrease ? 'bg-orange-100' : 'bg-green-100'}`}>
                                            {isIncrease ? (
                                                <AlertCircle className="h-6 w-6 text-orange-600" />
                                            ) : (
                                                <CheckCircle className="h-6 w-6 text-green-600" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Quick Summary:</p>
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            {isIncrease
                                                ? `Your consumption increased by ${diff.toFixed(2)} m³ compared to ${previous.month_year}. Consider checking for leaks if this was unexpected.`
                                                : `Great! Your consumption decreased by ${Math.abs(diff).toFixed(2)} m³ compared to ${previous.month_year}. You saved approximately ETB ${(Math.abs(diff) * 10).toFixed(2)} in base charges.`}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>

                {/* Bill Breakdown Card */}
                <Card className="bg-slate-50 border-slate-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-900">Bill Breakdown</CardTitle>
                        <CardDescription className="text-slate-600/70">Latest invoice distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {!bills[0] ? (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                No bill data
                            </div>
                        ) : (() => {
                            const bill = bills[0] as any;
                            const data = [
                                { name: 'Water', value: Number(bill.base_water_charge || 0), color: '#3b82f6' },
                                { name: 'Sewerage', value: Number(bill.sewerage_charge || 0), color: '#8b5cf6' },
                                { name: 'Sanitation', value: Number(bill.sanitation_fee || 0), color: '#10b981' },
                                { name: 'Maintenance', value: Number(bill.maintenance_fee || 0), color: '#f59e0b' },
                                { name: 'Meter Rent', value: Number(bill.meter_rent || 0), color: '#64748b' },
                                { name: 'VAT', value: Number(bill.vat_amount || bill.vatAmount || 0), color: '#ef4444' },
                                { name: 'Additional', value: Number(bill.additional_fees_charge || bill.additionalFeesCharge || 0), color: '#ec4899' },
                            ].filter(item => item.value > 0);

                            if (data.length === 0) return <div className="h-full flex items-center justify-center text-gray-500">No charge breakdown available</div>;

                            return (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {data.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number) => [`ETB ${value.toFixed(2)}`, 'Amount']}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            );
                        })()}
                    </CardContent>
                </Card>
            </div>

            {/* Consumption History Chart */}
            <Card className="shadow-md border-gray-100 overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        Consumption History
                    </CardTitle>
                    <CardDescription>Water usage over time (m³)</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] pt-6">
                    {bills.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            No data available
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[...bills].reverse().slice(-6)} // Show last 6 bills in chronological order
                                margin={{
                                    top: 10,
                                    right: 30,
                                    left: 0,
                                    bottom: 0,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month_year" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number) => [`${value} m³`, 'Usage']}
                                    labelStyle={{ color: '#333' }}
                                />
                                <Bar dataKey="CONS" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Usage (m³)" />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* Recent Bills */}
            <Card className="shadow-md border-gray-100 overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Recent Bills
                    </CardTitle>
                    <CardDescription>Your latest billing history</CardDescription>
                </CardHeader>
                <CardContent>
                    {bills.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No billing history available</p>
                    ) : (
                        <div className="space-y-3">
                            {bills.slice(0, 5).map((bill) => (
                                <div key={bill.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg hover:bg-gray-50 gap-2 sm:gap-0">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="font-medium">{bill.month_year || "N/A"}</p>
                                            <p className="text-sm text-gray-600">
                                                {bill.created_at ? format(new Date(bill.created_at), "MMM dd, yyyy") : "N/A"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right w-full sm:w-auto">
                                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-0">
                                            <p className="font-semibold">ETB {Number(bill.TOTALBILLAMOUNT ?? bill.total_amount_due ?? 0).toFixed(2)}</p>
                                            <Badge variant={bill.payment_status === "Paid" ? "default" : "destructive"} className="mt-0 sm:mt-1">
                                                {bill.payment_status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
