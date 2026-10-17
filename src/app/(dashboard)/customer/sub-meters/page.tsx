"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Users,
    Search,
    Calendar,
    Droplets,
    FileSpreadsheet,
    Eye,
    TrendingUp,
    CheckCircle2,
    Clock,
    RefreshCw,
    Gauge,
    AlertCircle,
    Copy,
    Check,
    Scale
} from "lucide-react";
import { DifferenceApportionmentDialog } from "@/components/billing/DifferenceApportionmentDialog";
import {
    getBulkCustomerSubmetersAction,
    getBulkCustomerAvailablePeriodsAction,
    getAssignedCustomerReadingsAction,
    getBulkCustomerSubmeterHistoryAction
} from "@/lib/actions";
import { useCustomerActivityLogger } from "@/lib/customer-activity-logger";
import { format, parse } from "date-fns";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";

interface SubmeterCustomer {
    customerKeyNumber: string;
    name: string;
    METER_KEY?: string;
    meterSize?: number | string;
    customerType?: string;
    sewerageConnection?: string;
    previousReading?: number | string;
    currentReading?: number | string;
    status: string;
    phone_number?: string;
    email?: string;
}

interface PeriodReadingInfo {
    customerKeyNumber: string;
    name: string;
    previous: number;
    current: number;
    usage: number;
    hasExactRecord: boolean;
    readingDate?: string | null;
    billId?: string | null;
    billStatus?: string | null;
    paymentStatus?: string | null;
    billAmount?: number | null;
}

interface SubmeterHistoryRecord {
    id: string;
    readingDate?: string | null;
    prevReading: number;
    currReading: number;
    usage: number;
    billId?: string | null;
    monthYear?: string | null;
    billAmount?: number | null;
    totalBillAmount?: number | null;
    paymentStatus?: string | null;
    billStatus?: string | null;
}

export default function CustomerSubMetersPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [customerType, setCustomerType] = useState<string>("bulk");
    const [bulkKey, setBulkKey] = useState<string>("");
    const [sessionId, setSessionId] = useState<string>("");

    const [submeters, setSubmeters] = useState<SubmeterCustomer[]>([]);
    const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("");

    const [periodReadings, setPeriodReadings] = useState<Record<string, PeriodReadingInfo>>({});
    const [isLoadingReadings, setIsLoadingReadings] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // History dialog
    const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<SubmeterCustomer | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [customerHistory, setCustomerHistory] = useState<SubmeterHistoryRecord[]>([]);

    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [isApportionmentDialogOpen, setIsApportionmentDialogOpen] = useState(false);

    useCustomerActivityLogger("Sub-Meters & Readings");

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setIsLoading(true);
            const customerData = localStorage.getItem("customer");
            if (!customerData) return;

            const customer = JSON.parse(customerData);
            const type = customer.customerType || "individual";
            setCustomerType(type);
            setBulkKey(customer.customerKeyNumber || "");
            setSessionId(customer.sessionId || "");

            if (type !== "bulk") {
                setIsLoading(false);
                return;
            }

            const currentBulkKey = customer.customerKeyNumber;
            const currentSessionId = customer.sessionId;

            // Fetch submeters and available periods in parallel
            const [submetersRes, periodsRes] = await Promise.all([
                getBulkCustomerSubmetersAction(currentBulkKey, currentSessionId),
                getBulkCustomerAvailablePeriodsAction(currentBulkKey, currentSessionId)
            ]);

            const customersList = (submetersRes?.data || []) as SubmeterCustomer[];
            setSubmeters(customersList);

            const periods = (periodsRes?.data || []) as string[];
            setAvailablePeriods(periods);

            const initialPeriod = periods.length > 0 ? periods[0] : "";
            setSelectedPeriod(initialPeriod);

            if (initialPeriod && customersList.length > 0) {
                await loadPeriodReadings(currentBulkKey, initialPeriod, currentSessionId);
            }
        } catch (error) {
            console.error("Failed to load bulk sub-meters data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadPeriodReadings = async (bKey: string, period: string, sessId?: string) => {
        if (!bKey || !period) return;
        setIsLoadingReadings(true);
        try {
            const { data } = await getAssignedCustomerReadingsAction(bKey, period, undefined, sessId || sessionId);
            if (data && Array.isArray(data)) {
                const readingMap: Record<string, PeriodReadingInfo> = {};
                for (const item of data) {
                    if (item.customerKeyNumber) {
                        readingMap[item.customerKeyNumber] = {
                            customerKeyNumber: item.customerKeyNumber,
                            name: item.name,
                            previous: Number(item.previous ?? 0),
                            current: Number(item.current ?? 0),
                            usage: Number(item.usage ?? 0),
                            hasExactRecord: Boolean(item.hasExactRecord),
                            readingDate: item.readingDate,
                            billId: item.billId,
                            billStatus: item.billStatus,
                            paymentStatus: item.paymentStatus,
                            billAmount: item.billAmount != null ? Number(item.billAmount) : null,
                        };
                    }
                }
                setPeriodReadings(readingMap);
            }
        } catch (err) {
            console.error("Failed to fetch period readings:", err);
        } finally {
            setIsLoadingReadings(false);
        }
    };

    const handlePeriodChange = (newPeriod: string) => {
        setSelectedPeriod(newPeriod);
        loadPeriodReadings(bulkKey, newPeriod, sessionId);
    };

    const openCustomerHistory = async (customer: SubmeterCustomer) => {
        setSelectedCustomerForHistory(customer);
        setHistoryLoading(true);
        setCustomerHistory([]);
        try {
            const { data } = await getBulkCustomerSubmeterHistoryAction(bulkKey, customer.customerKeyNumber, sessionId);
            if (data && data.history) {
                setCustomerHistory(data.history as SubmeterHistoryRecord[]);
            }
        } catch (err) {
            console.error("Failed to load customer reading history:", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleCopy = (key: string) => {
        navigator.clipboard.writeText(key);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const formatPeriodLabel = (period: string) => {
        if (!period) return "All Periods";
        try {
            const parsed = parse(period, "yyyy-MM", new Date());
            return format(parsed, "MMMM yyyy");
        } catch {
            return period;
        }
    };

    // Filtered submeters
    const filteredSubmeters = useMemo(() => {
        return submeters.filter(cust => {
            const matchesSearch =
                !searchQuery ||
                cust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                cust.customerKeyNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (cust.METER_KEY && cust.METER_KEY.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus =
                statusFilter === "all" ||
                cust.status.toLowerCase() === statusFilter.toLowerCase();

            return matchesSearch && matchesStatus;
        });
    }, [submeters, searchQuery, statusFilter]);

    // Summary calculations
    const summaryStats = useMemo(() => {
        const totalCustomers = submeters.length;
        let totalPeriodUsage = 0;
        let exactReadingsCount = 0;
        let billedCount = 0;

        for (const cust of submeters) {
            const pInfo = periodReadings[cust.customerKeyNumber];
            if (pInfo) {
                totalPeriodUsage += Math.max(0, pInfo.usage);
                if (pInfo.hasExactRecord) exactReadingsCount++;
                if (pInfo.billId) billedCount++;
            }
        }

        return {
            totalCustomers,
            totalPeriodUsage,
            exactReadingsCount,
            billedCount
        };
    }, [submeters, periodReadings]);

    const handleExportExcel = () => {
        if (filteredSubmeters.length === 0) return;

        const rows = filteredSubmeters.map(cust => {
            const p = periodReadings[cust.customerKeyNumber];
            return {
                "Customer Key": cust.customerKeyNumber,
                "Customer Name": cust.name,
                "Meter Number": cust.METER_KEY || "N/A",
                "Meter Size": cust.meterSize || '0.5"',
                "Customer Type": cust.customerType || "Domestic",
                "Billing Period": selectedPeriod || "Current",
                "Previous Reading": p ? p.previous : cust.previousReading ?? "N/A",
                "Current Reading": p ? p.current : cust.currentReading ?? "N/A",
                "Usage (m³)": p ? p.usage : "N/A",
                "Reading Date": p?.readingDate ? format(new Date(p.readingDate), "yyyy-MM-dd") : "N/A",
                "Bill Amount (ETB)": p?.billAmount != null ? p.billAmount : "N/A",
                "Payment Status": p?.paymentStatus || "N/A",
                "Account Status": cust.status
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sub-Meters");
        XLSX.writeFile(workbook, `SubMeters_${bulkKey}_${selectedPeriod || "export"}.xlsx`);
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-28 bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="h-24 bg-white rounded-xl"></div>
                    <div className="h-24 bg-white rounded-xl"></div>
                    <div className="h-24 bg-white rounded-xl"></div>
                    <div className="h-24 bg-white rounded-xl"></div>
                </div>
                <div className="h-96 bg-white rounded-xl"></div>
            </div>
        );
    }

    if (customerType !== "bulk") {
        return (
            <Card className="border-blue-100 shadow-sm max-w-2xl mx-auto my-12 text-center p-8">
                <CardHeader>
                    <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <Users className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl font-bold text-gray-900">Individual Customer Account</CardTitle>
                    <CardDescription className="text-gray-500 mt-2">
                        Sub-meter tracking is dedicated to Bulk Meter accounts with associated individual housing units.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => (window.location.href = "/customer/dashboard")}>
                        Go to Dashboard
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 rounded-2xl text-white shadow-md">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-100 text-xs font-medium mb-2 backdrop-blur-xs">
                        <Gauge className="h-3.5 w-3.5 text-blue-300" />
                        <span>Bulk Meter: {bulkKey}</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black">Associated Sub-Meters & Readings</h1>
                    <p className="text-blue-100 text-sm mt-1 max-w-2xl">
                        Monitor individual customer meters attached to your bulk supply, audit period readings, and review historical water consumption across each billing cycle.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        onClick={() => setIsApportionmentDialogOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-lg h-11 px-5"
                    >
                        <Scale className="h-4 w-4" />
                        <span>Difference Distribution</span>
                    </Button>
                    <Button
                        onClick={handleExportExcel}
                        className="bg-white hover:bg-blue-50 text-blue-900 font-bold gap-2 shadow-lg h-11 px-5"
                    >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                        <span>Export Excel</span>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => loadPeriodReadings(bulkKey, selectedPeriod, sessionId)}
                        disabled={isLoadingReadings}
                        className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2 h-11"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoadingReadings ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </Button>
                </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-blue-100 bg-white shadow-xs">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sub-Meters Count</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{summaryStats.totalCustomers}</h3>
                            <p className="text-xs text-blue-600 font-medium mt-1">Associated units</p>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Users className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-indigo-100 bg-white shadow-xs">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Period Usage</p>
                            <h3 className="text-2xl font-bold text-indigo-700 mt-1">
                                {isLoadingReadings ? "..." : `${summaryStats.totalPeriodUsage.toLocaleString()} m³`}
                            </h3>
                            <p className="text-xs text-indigo-600 font-medium mt-1">
                                {formatPeriodLabel(selectedPeriod)}
                            </p>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Droplets className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-emerald-100 bg-white shadow-xs">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Exact Records</p>
                            <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                                {isLoadingReadings ? "..." : `${summaryStats.exactReadingsCount} / ${summaryStats.totalCustomers}`}
                            </h3>
                            <p className="text-xs text-emerald-700 font-medium mt-1">Cycle readings logged</p>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-amber-100 bg-white shadow-xs">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Billed Units</p>
                            <h3 className="text-2xl font-bold text-amber-600 mt-1">
                                {isLoadingReadings ? "..." : `${summaryStats.billedCount} / ${summaryStats.totalCustomers}`}
                            </h3>
                            <p className="text-xs text-amber-700 font-medium mt-1">Bills issued this cycle</p>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Clock className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter and Table Card */}
            <Card className="border-gray-200 bg-white shadow-sm overflow-hidden">
                <CardHeader className="border-b bg-gray-50/50 p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            <CardTitle className="text-lg font-bold text-gray-900">
                                Sub-Meter Reading Directory
                            </CardTitle>
                            <Badge variant="outline" className="ml-2 font-mono bg-white">
                                {filteredSubmeters.length} records
                            </Badge>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Period Filter */}
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <span className="text-xs font-semibold text-gray-600 uppercase">Period:</span>
                                <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                                    <SelectTrigger className="w-48 bg-white h-9 text-sm font-medium">
                                        <SelectValue placeholder="Select billing period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availablePeriods.map(period => (
                                            <SelectItem key={period} value={period}>
                                                {formatPeriodLabel(period)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Search */}
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    type="text"
                                    placeholder="Search key, name, meter..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 bg-white text-sm"
                                />
                            </div>

                            {/* Status Filter */}
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-32 bg-white h-9 text-sm">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead className="font-bold text-gray-700">Customer Key</TableHead>
                                    <TableHead className="font-bold text-gray-700">Customer Name</TableHead>
                                    <TableHead className="font-bold text-gray-700">Meter #</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-right">Prev. Read</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-right">Curr. Read</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-right">Usage (m³)</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-center">Reading Date</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-right">Bill Amt</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-center">Payment</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-center">History</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSubmeters.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Users className="h-8 w-8 text-gray-400" />
                                                <p className="font-medium">No associated sub-meters found</p>
                                                <p className="text-xs text-gray-400">
                                                    {searchQuery ? "Try refining your search term" : "No individual customers assigned to this bulk meter"}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSubmeters.map((cust) => {
                                        const p = periodReadings[cust.customerKeyNumber];
                                        const prevVal = p ? p.previous : Number(cust.previousReading ?? 0);
                                        const currVal = p ? p.current : Number(cust.currentReading ?? 0);
                                        const usageVal = p ? p.usage : (currVal - prevVal);

                                        return (
                                            <TableRow key={cust.customerKeyNumber} className="hover:bg-blue-50/40 transition-colors">
                                                <TableCell className="font-mono text-xs font-semibold">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-blue-900">{cust.customerKeyNumber}</span>
                                                        <button
                                                            onClick={() => handleCopy(cust.customerKeyNumber)}
                                                            className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded"
                                                            title="Copy customer key"
                                                        >
                                                            {copiedKey === cust.customerKeyNumber ? (
                                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                            ) : (
                                                                <Copy className="h-3.5 w-3.5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="font-medium text-sm text-gray-900 max-w-xs truncate">
                                                    {cust.name}
                                                </TableCell>

                                                <TableCell className="text-xs text-gray-600">
                                                    <div>{cust.METER_KEY || "N/A"}</div>
                                                    <span className="text-[10px] text-gray-400 font-mono">
                                                        {cust.meterSize ? `${cust.meterSize}"` : '0.5"'} • {cust.customerType || "Domestic"}
                                                    </span>
                                                </TableCell>

                                                <TableCell className="text-right font-mono text-sm text-gray-600">
                                                    {isLoadingReadings ? (
                                                        <span className="inline-block h-4 w-12 bg-gray-200 animate-pulse rounded"></span>
                                                    ) : (
                                                        prevVal.toLocaleString()
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-right font-mono text-sm font-semibold text-gray-900">
                                                    {isLoadingReadings ? (
                                                        <span className="inline-block h-4 w-12 bg-gray-200 animate-pulse rounded"></span>
                                                    ) : (
                                                        currVal.toLocaleString()
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-right font-mono text-sm font-bold">
                                                    {isLoadingReadings ? (
                                                        <span className="inline-block h-4 w-10 bg-gray-200 animate-pulse rounded"></span>
                                                    ) : (
                                                        <Badge
                                                            variant="secondary"
                                                            className={
                                                                usageVal > 0
                                                                    ? "bg-blue-50 text-blue-700 border-blue-200 font-bold"
                                                                    : "bg-gray-100 text-gray-500 font-medium"
                                                            }
                                                        >
                                                            {usageVal.toLocaleString()} m³
                                                        </Badge>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-center text-xs text-gray-500">
                                                    {p?.readingDate ? format(new Date(p.readingDate), "MMM dd, yyyy") : (
                                                        <span className="text-gray-400 italic">Latest</span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-right font-mono text-xs font-semibold">
                                                    {p?.billAmount != null ? (
                                                        <span className="text-gray-900">ETB {p.billAmount.toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">—</span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-center">
                                                    {p?.paymentStatus ? (
                                                        <Badge
                                                            className={
                                                                p.paymentStatus.toLowerCase() === "paid"
                                                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                                    : "bg-amber-100 text-amber-800 border-amber-200"
                                                            }
                                                        >
                                                            {p.paymentStatus}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">—</span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openCustomerHistory(cust)}
                                                        className="h-8 px-2.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-medium text-xs gap-1"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        <span>History</span>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Individual Customer Historical Readings Dialog */}
            <Dialog
                open={Boolean(selectedCustomerForHistory)}
                onOpenChange={(open) => !open && setSelectedCustomerForHistory(null)}
            >
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
                            <Droplets className="h-5 w-5 text-blue-600" />
                            <span>Reading History for {selectedCustomerForHistory?.name}</span>
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500">
                            Customer Key: <span className="font-mono font-semibold text-gray-800">{selectedCustomerForHistory?.customerKeyNumber}</span> •
                            Meter: <span className="font-mono text-gray-800">{selectedCustomerForHistory?.METER_KEY || "N/A"}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {historyLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                            <p className="text-sm text-gray-500 font-medium">Loading reading history records...</p>
                        </div>
                    ) : customerHistory.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="font-medium">No historical period readings found for this customer.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 mt-2">
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-gray-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs uppercase">Period</TableHead>
                                            <TableHead className="font-bold text-xs uppercase">Reading Date</TableHead>
                                            <TableHead className="font-bold text-xs uppercase text-right">Prev Read</TableHead>
                                            <TableHead className="font-bold text-xs uppercase text-right">Curr Read</TableHead>
                                            <TableHead className="font-bold text-xs uppercase text-right">Usage (m³)</TableHead>
                                            <TableHead className="font-bold text-xs uppercase text-right">Bill Amount</TableHead>
                                            <TableHead className="font-bold text-xs uppercase text-center">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customerHistory.map((rec, idx) => (
                                            <TableRow key={rec.id || idx} className="hover:bg-slate-50">
                                                <TableCell className="font-semibold text-xs font-mono">
                                                    {rec.monthYear || (rec.readingDate ? format(new Date(rec.readingDate), "yyyy-MM") : "N/A")}
                                                </TableCell>
                                                <TableCell className="text-xs text-gray-500">
                                                    {rec.readingDate ? format(new Date(rec.readingDate), "PP") : "—"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-gray-600">
                                                    {Number(rec.prevReading || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-gray-900">
                                                    {Number(rec.currReading || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs">
                                                    <Badge variant="outline" className="font-bold bg-blue-50/50 text-blue-700 border-blue-200">
                                                        {Number(rec.usage || 0).toLocaleString()} m³
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-semibold">
                                                    {rec.totalBillAmount != null || rec.billAmount != null ? (
                                                        <span>ETB {Number(rec.totalBillAmount ?? rec.billAmount).toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {rec.paymentStatus ? (
                                                        <Badge
                                                            className={
                                                                rec.paymentStatus.toLowerCase() === "paid"
                                                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]"
                                                                    : "bg-amber-100 text-amber-800 border-amber-200 text-[10px]"
                                                            }
                                                        >
                                                            {rec.paymentStatus}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">—</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {bulkKey && (
                <DifferenceApportionmentDialog
                    open={isApportionmentDialogOpen}
                    onOpenChange={setIsApportionmentDialogOpen}
                    bulkMeterKey={bulkKey}
                    initialMonthYear={selectedPeriod}
                    availablePeriods={availablePeriods}
                    isCustomerPortal={true}
                    customerSessionId={sessionId}
                />
            )}
        </div>
    );
}
