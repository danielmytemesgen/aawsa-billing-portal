"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, MapPin, Droplets, CheckCircle, Info } from "lucide-react";

import { getCustomerAccountAction } from "@/lib/actions";
import { useCustomerActivityLogger } from "@/lib/customer-activity-logger";
import { motion } from "framer-motion";


interface CustomerAccount {
    name: string;
    customerKeyNumber: string;
    contractNumber: string;
    meterNumber: string;
    meterSize: number;
    currentReading: number;
    previousReading: number;
    month: string;
    specificArea: string;
    subCity: string;
    woreda: string;
    customerType?: string;
    charge_group?: string;
    sewerageConnection?: string;
    sewerage_connection?: string;
    status: string;
    email?: string;
    phone_number?: string;
}

export default function CustomerAccountPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [account, setAccount] = useState<CustomerAccount | null>(null);

    // Log page view
    useCustomerActivityLogger('Account');

    useEffect(() => {
        loadAccountData();
    }, []);

    const loadAccountData = async () => {
        try {
            const customerData = localStorage.getItem("customer");
            if (!customerData) return;

            const customer = JSON.parse(customerData);
            const customerType = customer.customerType || "individual";
            const sessionId = customer.sessionId;

            if (customerType === "bulk") {
                const { getBulkMeterAccountAction } = await import("@/lib/actions");
                const { data: accountData } = await getBulkMeterAccountAction(customer.customerKeyNumber, sessionId);
                if (accountData) {
                    setAccount(accountData as any);
                }
            } else {
                const { data: accountData } = await getCustomerAccountAction(customer.customerKeyNumber, sessionId);
                if (accountData) {
                    setAccount(accountData as any);
                }
            }
        } catch (error) {
            console.error("Failed to load account data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (!account) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Failed to load account information</p>
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
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Account Profile</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your personal information and meter details.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Status</p>
                        <p className="font-bold text-slate-900 dark:text-white">{account.status}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Personal Information */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2"
                >
                    <Card className="refined-card overflow-hidden h-full">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Personal Information</CardTitle>
                                    <CardDescription className="text-sm font-medium">Your identification and contact details</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Full Name</label>
                                    <p className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{account.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Customer Key</label>
                                    <p className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400">{account.customerKeyNumber}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Contract Number</label>
                                    <p className="font-bold text-lg text-slate-700 dark:text-slate-300">{account.contractNumber || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Charge Group</label>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-bold uppercase tracking-wide bg-slate-50 dark:bg-slate-800">
                                            {account.customerType || account.charge_group || "N/A"}
                                        </Badge>
                                    </div>
                                </div>
                                {account.email && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Email Address</label>
                                        <p className="font-bold text-slate-700 dark:text-slate-300">{account.email}</p>
                                    </div>
                                )}
                                {account.phone_number && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Phone Number</label>
                                        <p className="font-bold text-slate-700 dark:text-slate-300">{account.phone_number}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Location Information */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="refined-card overflow-hidden h-full border-slate-200 dark:border-slate-800">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                                    <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Location Details</CardTitle>
                                    <CardDescription className="text-sm font-medium">Service delivery point information</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Sub-City</label>
                                <p className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{account.subCity || "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Woreda</label>
                                <p className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{account.woreda || "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Specific Area</label>
                                <p className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{account.specificArea || "N/A"}</p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Meter Information */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <Card className="refined-card overflow-hidden bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-blue-900/10">
                    <CardHeader className="bg-white/50 dark:bg-slate-800/30 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none">
                                <Droplets className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold">Meter & Water Usage Information</CardTitle>
                                <CardDescription className="text-sm font-medium">Technical specifications of your utility connection</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Meter Number</label>
                                <p className="font-mono font-bold text-lg text-slate-900 dark:text-white">{account.meterNumber || "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Meter Size</label>
                                <p className="font-bold text-lg text-slate-900 dark:text-white">{account.meterSize} Inch</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Sewerage Conn.</label>
                                <p className="font-bold text-lg text-slate-900 dark:text-white truncate">{account.sewerageConnection || account.sewerage_connection || "N/A"}</p>
                            </div>
                            <div className="space-y-1 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <label className="text-[9px] uppercase font-black tracking-[0.1em] text-blue-600 dark:text-blue-400">Current Reading</label>
                                <p className="font-bold text-xl text-slate-900 dark:text-white">{Number(account.currentReading || 0).toFixed(2)} <span className="text-[10px] text-slate-500 dark:text-slate-400">m³</span></p>
                            </div>
                            <div className="space-y-1 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <label className="text-[9px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Prev. Reading</label>
                                <p className="font-bold text-xl text-slate-800 dark:text-slate-200">{Number(account.previousReading || 0).toFixed(2)} <span className="text-[10px] text-slate-500 dark:text-slate-400">m³</span></p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-500 dark:text-slate-400">Reading Month</label>
                                <p className="font-bold text-lg text-slate-900 dark:text-white">{account.month || "N/A"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Support Information */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6"
            >
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
                        <Info className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Need to update your details?</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Please visit your nearest AAWSA service center for security updates.</p>
                    </div>
                </div>
                <Button variant="outline" className="font-bold rounded-xl h-12 px-6 border-slate-200 dark:border-slate-700">
                    Find Nearest Center
                </Button>
            </motion.div>
        </motion.div>
    );
}

