"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Eye, FileSpreadsheet, Loader2, CreditCard, Smartphone, Hash, Copy, Check, Info, RotateCcw } from "lucide-react";

import { getCustomerBillsAction } from "@/lib/actions";
import { format, parse } from "date-fns";
import { formatDate } from "@/lib/utils";
import { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { DateRange } from "react-day-picker";
import { getMonthlyBillAmt } from "@/lib/billing-utils";
import { useCustomerActivityLogger } from "@/lib/customer-activity-logger";
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
    base_water_charge: number;
    maintenance_fee: number;
    sanitation_fee: number;
    vat_amount?: number;
    meter_rent: number;
    sewerage_charge: number;
    additional_fees_charge?: number;
    total_bill?: number;
    previous_reading_value?: number;
    current_reading_value?: number;
    CUSTOMERKEY: string;
    debit_30?: number;
    debit_30_60?: number;
    debit_60?: number;
    balance_carried_forward?: number;
    PENALTYAMT?: number;
    THISMONTHBILLAMT?: number;
    OUTSTANDINGAMT?: number;
}

export default function CustomerBillsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [bills, setBills] = useState<Bill[]>([]);
    const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterMonth, setFilterMonth] = useState<string>("all");
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [reportType, setReportType] = useState<string>("full");
    const [isGeneratingXlsx, setIsGeneratingXlsx] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"ussd" | "app">("app");
    const [copied, setCopied] = useState(false);

    // Log page view
    useCustomerActivityLogger('Bills');

    useEffect(() => {
        loadBills();
    }, []);

    useEffect(() => {
        filterBills();
    }, [bills, filterStatus, filterMonth]);

    const loadBills = async () => {
        try {
            const customerData = localStorage.getItem("customer");
            if (!customerData) return;

            const customer = JSON.parse(customerData);
            const customerType = customer.customerType || "individual";
            const sessionId = customer.sessionId;

            if (customerType === "bulk") {
                const { getBulkMeterBillsAction } = await import("@/lib/actions");
                const { data: billsData } = await getBulkMeterBillsAction(customer.customerKeyNumber, true, sessionId);
                if (billsData) {
                    const processed = (billsData as any[]).map(b => ({
                        ...b,
                        month_year: b.month_year || (b.created_at ? format(new Date(b.created_at), "MMM yyyy") : "N/A"),
                        TOTALBILLAMOUNT: Number(b.TOTALBILLAMOUNT ?? 0),
                        CONS: Number(b.CONS ?? 0)
                    }));
                    setBills(processed);
                }
            } else {
                const { data: billsData } = await getCustomerBillsAction(customer.customerKeyNumber, true, sessionId);
                if (billsData) {
                    const processed = (billsData as any[]).map(b => ({
                        ...b,
                        month_year: b.month_year || (b.created_at ? format(new Date(b.created_at), "MMM yyyy") : "N/A"),
                        TOTALBILLAMOUNT: Number(b.TOTALBILLAMOUNT ?? 0),
                        CONS: Number(b.CONS ?? 0)
                    }));
                    setBills(processed);
                }
            }
        } catch (error) {
            console.error("Failed to load bills:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filterBills = () => {
        let result = [...bills];

        if (filterStatus !== "all") {
            result = result.filter(bill => bill.payment_status.toLowerCase() === filterStatus.toLowerCase());
        }

        if (filterMonth !== "all") {
            // Check against bill_period_end_date or month_year (YYYY-MM style)
            result = result.filter(bill => {
                const billDate = bill.bill_period_end_date 
                    ? new Date(bill.bill_period_end_date).toISOString().substring(0, 7)
                    : bill.month_year.includes('-') ? bill.month_year : null;
                
                return billDate === filterMonth;
            });
        }

        setFilteredBills(result);
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case "paid":
                return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[10px] uppercase font-black px-3 py-1 rounded-full">Paid</Badge>;
            case "unpaid":
                return <Badge className="bg-rose-500 hover:bg-rose-600 text-[10px] uppercase font-black px-3 py-1 rounded-full">Unpaid</Badge>;
            case "overdue":
                return <Badge className="bg-rose-600 hover:bg-rose-700 text-[10px] uppercase font-black px-3 py-1 rounded-full text-white">Overdue</Badge>;
            default:
                return <Badge variant="secondary" className="text-[10px] uppercase font-black px-3 py-1 rounded-full">{status}</Badge>;
        }
    };


    const billRef = useRef<HTMLDivElement>(null);

    const downloadPDF = async () => {
        if (!selectedBill || !billRef.current) return;

        try {
            const canvas = await html2canvas(billRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 1200
            });

            const imgData = canvas.toDataURL("image/png");

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const margin = 10;
            const printWidth = pdfWidth - (margin * 2);

            const imgProps = pdf.getImageProperties(imgData);
            const imgRatio = imgProps.width / imgProps.height;
            const printHeight = printWidth / imgRatio;

            pdf.addImage(imgData, "PNG", margin, margin, printWidth, printHeight);
            pdf.save(`AAWSA_Bill_${selectedBill.month_year}.pdf`);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
        }
    };

    const downloadXlsxReport = async () => {
        setIsGeneratingXlsx(true);
        try {
            let dataToExport = bills;
            if (dateRange?.from && dateRange?.to) {
                const start = dateRange.from.getTime();
                const end = dateRange.to.getTime();
                dataToExport = bills.filter(bill => {
                    const billDate = new Date(bill.created_at).getTime();
                    return billDate >= start && billDate <= end;
                });
            }

            if (dataToExport.length === 0) {
                alert("No data found for the selected date range.");
                return;
            }

            let worksheet;
            let filename = `AAWSA_Report_${format(new Date(), "yyyyMMdd")}.xlsx`;

            if (reportType === "payment") {
                const rows = dataToExport.map(b => ({
                    "Billing Period": b.month_year,
                    "Amount Due": b.TOTALBILLAMOUNT,
                    "Status": b.payment_status,
                    "Generated Date": formatDate(b.created_at)
                }));
                worksheet = XLSX.utils.json_to_sheet(rows);
                filename = `AAWSA_Payment_Summary_${format(new Date(), "yyyyMMdd")}.xlsx`;
            } else {
                const rows = dataToExport.map(b => ({
                    "Billing Period": b.month_year,
                    "Usage (m3)": b.CONS,
                    "Base Water": b.base_water_charge,
                    "Maintenance": b.maintenance_fee,
                    "Sanitation": b.sanitation_fee,
                    "Sewerage": b.sewerage_charge,
                    "Meter Rent": b.meter_rent,
                    "VAT": b.vat_amount || 0,
                    "Additional": b.additional_fees_charge || 0,
                    "Current Bill": getMonthlyBillAmt(b),
                    "Penalty": b.PENALTYAMT || 0,
                    "Outstanding": (Number(b.OUTSTANDINGAMT ?? (Number(b.debit_30 || 0) + Number(b.debit_30_60 || 0) + Number(b.debit_60 || 0)))),
                    "Total Amount Payable": (Number(b.PENALTYAMT || 0) + Number(b.OUTSTANDINGAMT ?? (Number(b.debit_30 || 0) + Number(b.debit_30_60 || 0) + Number(b.debit_60 || 0))) + getMonthlyBillAmt(b)),
                    "Status": b.payment_status,
                    "Due Date": formatDate(b.due_date)
                }));
                worksheet = XLSX.utils.json_to_sheet(rows);
            }

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
            XLSX.writeFile(workbook, filename);
        } catch (error) {
            console.error("Failed to generate XLSX:", error);
        } finally {
            setIsGeneratingXlsx(false);
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

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Billing History</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your water bills, payments, and generated reports.</p>
                </div>
                <div className="flex flex-wrap items-end gap-3 w-full sm:w-auto">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</Label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-full sm:w-[160px] h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                    <SelectValue placeholder="Status" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Bills</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Billing Month</Label>
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
                </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="refined-card bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 border-blue-100 dark:border-slate-800">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            Generate Financial Statement
                        </CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400 font-medium">Export your billing history to Excel for personal or business records.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-5 space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Date Range</label>
                                <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                            </div>
                            <div className="md:col-span-4 space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Report Version</label>
                                <Select value={reportType} onValueChange={setReportType}>
                                    <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                                        <SelectValue placeholder="Select Report Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="full">Full Statement (All Charges)</SelectItem>
                                        <SelectItem value="payment">Payment Summary Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-3">
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 shadow-lg shadow-blue-100 dark:shadow-none transition-all active:scale-[0.98]"
                                    onClick={downloadXlsxReport}
                                    disabled={isGeneratingXlsx}
                                >
                                    {isGeneratingXlsx ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Download className="h-4 w-4 mr-2" />
                                    )}
                                    Export Excel
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>


            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="refined-card overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold">Billing Records</CardTitle>
                                <CardDescription className="font-medium text-slate-500">
                                    {filterStatus === "all" ? "All billing records" : `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} bills`} found for your account
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-white dark:bg-slate-900 font-bold px-3 py-1">
                                {filteredBills.length} Records
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {filteredBills.length === 0 ? (
                            <div className="text-center py-24 bg-white dark:bg-slate-900">
                                <div className="h-20 w-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                                </div>
                                <p className="text-slate-400 font-bold text-lg">No billing records found</p>
                                <p className="text-slate-500 text-sm">Adjust your filters or check back later.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900">
                                        <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400 py-4 px-6">Billing Period</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400 py-4 px-6">Usage</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400 py-4 px-6">Current Bill</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400 py-4 px-6">Outstanding</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400 py-4 px-6">Total Payable</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400 py-4 px-6">Due Date</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400 py-4 px-6">Status</TableHead>
                                            <TableHead className="text-right py-4 px-6 font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBills.map((bill, index) => {
                                            const monthYear = bill.month_year || (
                                                bill.created_at || bill.bill_period_end_date
                                                    ? format(new Date(bill.created_at || bill.bill_period_end_date!), "MMM yyyy")
                                                    : "N/A"
                                            );
                                            const outstanding = Number(bill.OUTSTANDINGAMT ?? (Number(bill.debit_30 ?? 0) + Number(bill.debit_30_60 ?? 0) + Number(bill.debit_60 ?? 0)));
                                            const currentBillAmt = getMonthlyBillAmt(bill);
                                            const consumption = Number(bill.CONS ?? bill.usage_m3 ?? 0);
                                            const penalty = Number(bill.PENALTYAMT ?? 0);
                                            const totalPayable = penalty + outstanding + currentBillAmt;

                                            return (
                                                <motion.tr 
                                                    key={bill.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.1 + (index * 0.05) }}
                                                    className="group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-slate-200 dark:border-slate-800"
                                                >
                                                    <TableCell className="font-bold text-slate-900 dark:text-white py-4 px-6">{monthYear}</TableCell>
                                                    <TableCell className="px-6">
                                                        <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
                                                            {consumption.toFixed(2)}
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black">m³</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-900 dark:text-white px-6">ETB {currentBillAmt.toFixed(2)}</TableCell>
                                                    <TableCell className="px-6">
                                                        {outstanding > 0 ? (
                                                            <span className="font-black text-rose-500">ETB {outstanding.toFixed(2)}</span>
                                                        ) : (
                                                            <span className="text-slate-400 dark:text-slate-600">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="px-6">
                                                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg inline-block font-black border border-blue-100 dark:border-blue-900/50">
                                                            ETB {totalPayable.toFixed(2)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap px-6">
                                                        {formatDate(bill.due_date)}
                                                    </TableCell>
                                                    <TableCell className="px-6">
                                                        <div className="flex">
                                                            {getStatusBadge(bill.payment_status)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right px-6">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setSelectedBill(bill)}
                                                            className="font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 gap-2 transition-all active:scale-95"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            View Statement
                                                        </Button>
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


            <AnimatePresence>
                {selectedBill && (
                    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                        >
                            <Card className="refined-card border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10 border-b dark:border-slate-800 gap-4 sm:gap-0 p-6">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Billing Statement</p>
                                        <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">{selectedBill.month_year}</CardTitle>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={downloadPDF} 
                                            className="h-10 px-4 font-bold rounded-xl border-slate-200 dark:border-slate-800 flex-1 sm:flex-none shadow-sm active:scale-95 transition-all"
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            PDF
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => setSelectedBill(null)} 
                                            className="h-10 px-4 font-bold text-slate-500 hover:text-slate-900 rounded-xl flex-1 sm:flex-none active:scale-95 transition-all"
                                        >
                                            Close
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-8" ref={billRef}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Account Summary</h3>
                                            <div className="space-y-4 text-sm">
                                                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Usage Recorded:</span>
                                                    <span className="font-black text-slate-900 dark:text-white uppercase">
                                                        {Number(selectedBill.CONS ?? selectedBill.usage_m3 ?? 0).toFixed(2)} m³
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Statement Date:</span>
                                                    <span className="font-black text-slate-900 dark:text-white">
                                                        {selectedBill.created_at ? format(new Date(selectedBill.created_at), "MMM d, yyyy") : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Due Date:</span>
                                                    <span className="font-black text-rose-500 uppercase tracking-tight">
                                                        {formatDate(selectedBill.due_date)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Current Status:</span>
                                                    {getStatusBadge(selectedBill.payment_status)}
                                                </div>
                                                
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                                                    <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400">Arrears & Penalties</h4>
                                                    <div className="flex justify-between">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">Penalty Charge:</span>
                                                        <span className="font-black text-rose-600">ETB {Number(selectedBill.PENALTYAMT || 0).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">Outstanding:</span>
                                                        <span className="font-black text-amber-600">ETB {(Number(selectedBill.debit_30 || 0) + Number(selectedBill.debit_30_60 || 0) + Number(selectedBill.debit_60 || 0)).toFixed(2)}</span>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Charge Breakdown</h3>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/50">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Base Water:</span>
                                                    <span className="font-black text-slate-900 dark:text-white font-mono">ETB {Number(selectedBill.base_water_charge || 0).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/50">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Sewerage:</span>
                                                    <span className="font-black text-slate-900 dark:text-white font-mono">ETB {Number(selectedBill.sewerage_charge || 0).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/50">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Sanitation:</span>
                                                    <span className="font-black text-slate-900 dark:text-white font-mono">ETB {Number(selectedBill.sanitation_fee || 0).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/50">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Maintenance:</span>
                                                    <span className="font-black text-slate-900 dark:text-white font-mono">ETB {Number(selectedBill.maintenance_fee || 0).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/50">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Meter Rent:</span>
                                                    <span className="font-black text-slate-900 dark:text-white font-mono">ETB {Number(selectedBill.meter_rent || 0).toFixed(2)}</span>
                                                </div>
                                                
                                                {(() => {
                                                    const currentBillAmt = getMonthlyBillAmt(selectedBill);
                                                    const outstanding = Number(selectedBill.OUTSTANDINGAMT ?? (Number(selectedBill.debit_30 || 0) + Number(selectedBill.debit_30_60 || 0) + Number(selectedBill.debit_60 || 0)));
                                                    const penalty = Number(selectedBill.PENALTYAMT || 0);

                                                    return (
                                                        <div className="mt-8 p-6 bg-blue-600 dark:bg-blue-600 rounded-3xl shadow-xl shadow-blue-100 dark:shadow-none text-white overflow-hidden relative group">
                                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-500">
                                                                <FileText className="h-16 w-16" />
                                                            </div>
                                                            <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-80 mb-1">Total Payable</p>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-sm font-black opacity-90">ETB</span>
                                                                <span className="text-4xl font-black tracking-tighter">
                                                                    {(penalty + outstanding + currentBillAmt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {selectedBill.payment_status.toLowerCase() !== "paid" && (
                                        <div className="mt-12 pt-8 border-t-2 border-dashed border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2 mb-6">
                                                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                                    <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <h3 className="font-black text-lg text-slate-900 dark:text-white">Seamless Payment</h3>
                                            </div>

                                            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl mb-8 w-full sm:w-auto max-w-sm border border-slate-200 dark:border-slate-700">
                                                <button
                                                    onClick={() => setPaymentMethod("app")}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${paymentMethod === 'app' ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    <Smartphone className="h-4 w-4" />
                                                    APP Access
                                                </button>
                                                <button
                                                    onClick={() => setPaymentMethod("ussd")}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${paymentMethod === 'ussd' ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    <Hash className="h-4 w-4" />
                                                    USSD Dial
                                                </button>
                                            </div>

                                            {paymentMethod === "app" ? (
                                                <div className="space-y-6">
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                                        <Info className="h-5 w-5 text-blue-500" />
                                                        Select your bank to pay. Use the reference code below.
                                                    </p>
                                                    <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">
                                                        {[
                                                            { id: 'telebirr', name: 'Telebirr', logo: '/images/telebirr-logo.png', intent: "intent://#Intent;package=cn.tydic.ethiopay;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcn.tydic.ethiopay;end" },
                                                            { id: 'cbe', name: 'CBE Birr', logo: '/images/cbe-logo.png', intent: "intent://#Intent;package=prod.cbe.birr;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dprod.cbe.birr;end" },
                                                            { id: 'awash', name: 'Awash', logo: '/images/awash-logo.png', intent: "intent://#Intent;package=com.ekenya.awashwallet;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.ekenya.awashwallet;end" }
                                                        ].map((bank) => (
                                                            <Button
                                                                key={bank.id}
                                                                variant="outline"
                                                                className="group flex flex-col items-center justify-center h-28 border-2 border-slate-100 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all rounded-3xl bg-white dark:bg-slate-900 shadow-sm active:scale-95"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    window.location.href = bank.intent;
                                                                }}
                                                            >
                                                                <div className="h-12 w-full mb-2 flex items-center justify-center overflow-hidden">
                                                                    <img src={bank.logo} alt={bank.name} className="h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-blue-600">{bank.name}</span>
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-3 gap-4">
                                                    {[
                                                        { name: 'Telebirr', code: '*127#', color: 'text-blue-600', logo: '/images/telebirr-logo.png' },
                                                        { name: 'CBE Birr', code: '*889#', color: 'text-purple-600', logo: '/images/cbe-logo.png' },
                                                        { name: 'Awash', code: '*901#', color: 'text-orange-600', logo: '/images/awash-logo.png' }
                                                    ].map((bank) => (
                                                        <Button
                                                            key={bank.name}
                                                            variant="outline"
                                                            className="group flex flex-col items-center justify-center h-28 border-2 border-slate-100 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-600 rounded-3xl bg-white dark:bg-slate-900 shadow-sm transition-all active:scale-95"
                                                            asChild
                                                        >
                                                            <a href={`tel:${bank.code}`}>
                                                                <div className="h-10 w-full mb-2 flex items-center justify-center overflow-hidden">
                                                                    <img src={bank.logo} alt={bank.name} className="h-full object-contain opacity-50 group-hover:opacity-100 transition-opacity" />
                                                                </div>
                                                                <span className={`text-sm font-black font-mono ${bank.color}`}>{bank.code}</span>
                                                            </a>
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="mt-8 p-6 bg-slate-900 dark:bg-slate-800 rounded-3xl border border-slate-800 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
                                                <div className="flex items-center gap-5">
                                                    <div className="p-3 bg-slate-800 dark:bg-slate-700 rounded-2xl">
                                                        <Copy className="h-6 w-6 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black mb-1">Payment ID / Reference</p>
                                                        <p className="text-2xl font-mono font-black text-white tracking-widest leading-none">
                                                            {selectedBill.CUSTOMERKEY || selectedBill.id.split('-')[0].toUpperCase()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    className={`h-12 px-8 font-black uppercase tracking-widest transition-all rounded-2xl ${copied ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 hover:bg-blue-50'}`}
                                                    onClick={async () => {
                                                        const ref = selectedBill.CUSTOMERKEY || selectedBill.id.split('-')[0].toUpperCase();
                                                        await navigator.clipboard.writeText(ref);
                                                        setCopied(true);
                                                        setTimeout(() => setCopied(false), 2000);
                                                    }}
                                                >
                                                    {copied ? "Copied!" : "Copy Reference"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-12 pt-8 border-t dark:border-slate-800 text-center">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Official Digital Statement</p>
                                        <p className="text-xs font-bold text-slate-500">Addis Ababa Water & Sewerage Authority</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
