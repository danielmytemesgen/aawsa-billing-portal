"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Eye, FileSpreadsheet, Loader2, CreditCard, Smartphone, Hash, Copy, Check } from "lucide-react";
import { getCustomerBillsAction } from "@/lib/actions";
import { format } from "date-fns";
import { formatDate } from "@/lib/utils";
import { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
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
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [reportType, setReportType] = useState<string>("full");
    const [isGeneratingXlsx, setIsGeneratingXlsx] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"ussd" | "app">("app");
    const [copied, setCopied] = useState(false);

    // Log page view
    useEffect(() => {
        useCustomerActivityLogger('Bills');
    }, []);

    useEffect(() => {
        loadBills();
    }, []);

    useEffect(() => {
        filterBills();
    }, [bills, filterStatus]);

    const loadBills = async () => {
        try {
            const customerData = localStorage.getItem("customer");
            if (!customerData) return;

            const customer = JSON.parse(customerData);
            const customerType = customer.customerType || "individual";

            if (customerType === "bulk") {
                const { getBulkMeterBillsAction } = await import("@/lib/actions");
                const { data: billsData } = await getBulkMeterBillsAction(customer.customerKeyNumber);
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
                const { data: billsData } = await getCustomerBillsAction(customer.customerKeyNumber);
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
        if (filterStatus === "all") {
            setFilteredBills(bills);
        } else {
            setFilteredBills(bills.filter(bill => bill.payment_status.toLowerCase() === filterStatus.toLowerCase()));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case "paid":
                return <Badge variant="default" className="bg-green-600">Paid</Badge>;
            case "unpaid":
                return <Badge variant="destructive">Unpaid</Badge>;
            case "overdue":
                return <Badge variant="destructive" className="bg-red-700">Overdue</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
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
                    "Current Bill": b.THISMONTHBILLAMT ?? b.TOTALBILLAMOUNT,
                    "Penalty": b.PENALTYAMT || 0,
                    "Outstanding": (Number(b.debit_30 || 0) + Number(b.debit_30_60 || 0) + Number(b.debit_60 || 0)),
                    "Total Amount Payable": (Number(b.PENALTYAMT || 0) + Number(b.debit_30 || 0) + Number(b.debit_30_60 || 0) + Number(b.debit_60 || 0) + Number(b.THISMONTHBILLAMT ?? b.TOTALBILLAMOUNT ?? 0)),
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Billing History</h1>
                    <p className="text-gray-600 mt-1">View all your water bills and payment history</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Bills</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="border-blue-100 bg-blue-50/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                        Generate Custom Report
                    </CardTitle>
                    <CardDescription>Export your billing and payment history with custom parameters</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Select Date Range</label>
                            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Report Type</label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Report Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="full">Full Statement (All Charges)</SelectItem>
                                    <SelectItem value="payment">Payment Summary Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-10"
                            onClick={downloadXlsxReport}
                            disabled={isGeneratingXlsx}
                        >
                            {isGeneratingXlsx ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            Generate XLSX Report
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Bills ({filteredBills.length})</CardTitle>
                    <CardDescription>
                        {filterStatus === "all" ? "All billing records" : `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} bills`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredBills.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No bills found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Billing Period</TableHead>
                                        <TableHead>Usage (m³)</TableHead>
                                        <TableHead>Current Bill (ETB)</TableHead>
                                        <TableHead>Outstanding (ETB)</TableHead>
                                        <TableHead>Total Payable (ETB)</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredBills.map((bill) => {
                                        const monthYear = bill.month_year || (
                                            bill.created_at || bill.bill_period_end_date
                                                ? format(new Date(bill.created_at || bill.bill_period_end_date!), "MMM yyyy")
                                                : "N/A"
                                        );
                                        const currentBillAmt = Number(bill.THISMONTHBILLAMT ?? bill.TOTALBILLAMOUNT ?? bill.total_amount_due ?? 0);
                                        const consumption = Number(bill.CONS ?? bill.usage_m3 ?? 0);
                                        const d30 = Number(bill.debit_30 ?? 0);
                                        const d30_60 = Number(bill.debit_30_60 ?? 0);
                                        const d60 = Number(bill.debit_60 ?? 0);
                                        const outstanding = d30 + d30_60 + d60;
                                        const penalty = Number(bill.PENALTYAMT ?? 0);
                                        const totalPayable = penalty + outstanding + currentBillAmt;

                                        return (
                                            <TableRow key={bill.id}>
                                                <TableCell className="font-medium">{monthYear}</TableCell>
                                                <TableCell>{consumption.toFixed(2)}</TableCell>
                                                <TableCell className="font-semibold">ETB {currentBillAmt.toFixed(2)}</TableCell>
                                                <TableCell className="text-amber-700">ETB {outstanding > 0 ? outstanding.toFixed(2) : '—'}</TableCell>
                                                <TableCell className="font-bold text-blue-700">ETB {totalPayable.toFixed(2)}</TableCell>
                                                <TableCell>
                                                    {formatDate(bill.due_date)}
                                                </TableCell>
                                                <TableCell>{getStatusBadge(bill.payment_status)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setSelectedBill(bill)}
                                                        className="gap-2"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        View
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedBill && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-blue-500 bg-white shadow-xl">
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 bg-white z-10 border-b gap-4 sm:gap-0 pb-4">
                            <div>
                                <CardTitle>Bill Details</CardTitle>
                                <CardDescription>{selectedBill.month_year}</CardDescription>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-2 flex-1 sm:flex-none">
                                    <Download className="h-4 w-4" />
                                    Download PDF
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedBill(null)} className="flex-1 sm:flex-none">
                                    Close
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6" ref={billRef}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-lg border-b pb-2 text-blue-700">Billing Information</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Billing Period:</span>
                                            <span className="font-medium">{selectedBill.month_year}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Usage:</span>
                                            <span className="font-medium">{Number(selectedBill.CONS ?? selectedBill.usage_m3 ?? 0).toFixed(2)} m³</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Due Date:</span>
                                            <span className="font-medium">
                                                {formatDate(selectedBill.due_date)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Status:</span>
                                            {getStatusBadge(selectedBill.payment_status)}
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100 italic">
                                            <span className="text-gray-600">Penalty (ETB):</span>
                                            <span className="font-medium text-red-600">ETB {Number(selectedBill.PENALTYAMT || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100 italic">
                                            <span className="text-gray-600">Outstanding (ETB):</span>
                                            <span className="font-medium text-amber-700">ETB {(Number(selectedBill.debit_30 || 0) + Number(selectedBill.debit_30_60 || 0) + Number(selectedBill.debit_60 || 0)).toFixed(2)}</span>
                                        </div>
                                        {(Number(selectedBill.debit_30 || 0) + Number(selectedBill.debit_30_60 || 0) + Number(selectedBill.debit_60 || 0)) > 0 && (
                                            <div className="pl-4 text-[10px] text-gray-500 space-y-1 bg-gray-50 p-2 rounded">
                                                <div className="flex justify-between"><span>Debit 30 Days:</span> <span>ETB {Number(selectedBill.debit_30 || 0).toFixed(2)}</span></div>
                                                <div className="flex justify-between"><span>Debit 30-60 Days:</span> <span>ETB {Number(selectedBill.debit_30_60 || 0).toFixed(2)}</span></div>
                                                <div className="flex justify-between"><span>&gt;60 Days:</span> <span>ETB {Number(selectedBill.debit_60 || 0).toFixed(2)}</span></div>
                                            </div>
                                        )}
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Bill ID:</span>
                                            <span className="font-mono text-xs">{selectedBill.id.slice(0, 8)}...</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="font-semibold text-lg border-b pb-2 text-blue-700">Charge Breakdown</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Base Water Charge:</span>
                                            <span className="font-medium">ETB {Number(selectedBill.base_water_charge || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Maintenance Fee:</span>
                                            <span className="font-medium">ETB {Number(selectedBill.maintenance_fee || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Sanitation Fee:</span>
                                            <span className="font-medium">ETB {Number(selectedBill.sanitation_fee || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Sewerage Charge:</span>
                                            <span className="font-medium">ETB {Number(selectedBill.sewerage_charge || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100">
                                            <span className="text-gray-600">Meter Rent:</span>
                                            <span className="font-medium">ETB {Number(selectedBill.meter_rent || 0).toFixed(2)}</span>
                                        </div>
                                        {Number(selectedBill.vat_amount || 0) > 0 && (
                                            <div className="flex justify-between py-1 border-b border-gray-100 italic">
                                                <span className="text-gray-600">VAT:</span>
                                                <span className="font-medium">ETB {Number(selectedBill.vat_amount).toFixed(2)}</span>
                                            </div>
                                        )}
                                        {Number(selectedBill.additional_fees_charge || 0) > 0 && (
                                            <div className="flex justify-between py-1 border-b border-gray-100 italic">
                                                <span className="text-gray-600">Additional Fees:</span>
                                                <span className="font-medium">ETB {Number(selectedBill.additional_fees_charge).toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between pt-3 mt-2 border-t-2 border-gray-200 font-bold text-lg bg-gray-50 p-2 rounded">
                                            <span>Total Amount Payable:</span>
                                            <span className="text-blue-600">ETB {(Number(selectedBill.PENALTYAMT || 0) + Number(selectedBill.debit_30 || 0) + Number(selectedBill.debit_30_60 || 0) + Number(selectedBill.debit_60 || 0) + Number(selectedBill.THISMONTHBILLAMT ?? selectedBill.TOTALBILLAMOUNT ?? selectedBill.total_amount_due ?? 0)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedBill.payment_status.toLowerCase() !== "paid" && (
                                <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200">
                                    <h3 className="font-bold text-lg mb-4 text-blue-800 flex items-center gap-2">
                                        <CreditCard className="h-5 w-5" />
                                        Pay Your Bill
                                    </h3>

                                    <div className="flex p-1 bg-gray-100 rounded-lg mb-6 max-w-sm">
                                        <button
                                            onClick={() => setPaymentMethod("app")}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${paymentMethod === 'app' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            <Smartphone className="h-4 w-4" />
                                            Mobile App
                                        </button>
                                        <button
                                            onClick={() => setPaymentMethod("ussd")}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${paymentMethod === 'ussd' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            <Hash className="h-4 w-4" />
                                            USSD Code
                                        </button>
                                    </div>

                                    {paymentMethod === "app" ? (
                                        <div className="space-y-4">
                                            <p className="text-sm text-gray-600 font-medium bg-blue-50 p-3 rounded-lg border border-blue-100">
                                                Select your bank below to open the mobile app and transfer the payment using your <span className="text-blue-700 font-bold">Payment Reference</span>.
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <Button
                                                    variant="outline"
                                                    className="group flex flex-col items-center justify-center h-32 border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all p-4 bg-white shadow-sm"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        window.location.href = "intent://#Intent;package=cn.tydic.ethiopay;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcn.tydic.ethiopay;end";
                                                    }}
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <div className="h-16 w-full mb-2 flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src="/images/telebirr-logo.png"
                                                                alt="Telebirr"
                                                                className="h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-500 group-hover:text-blue-700">Open Telebirr</span>
                                                    </div>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="group flex flex-col items-center justify-center h-32 border-2 border-gray-100 hover:border-purple-500 hover:bg-purple-50 transition-all p-4 bg-white shadow-sm"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        window.location.href = "intent://#Intent;package=prod.cbe.birr;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dprod.cbe.birr;end";
                                                    }}
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <div className="h-16 w-full mb-2 flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src="/images/cbe-logo.png"
                                                                alt="CBE"
                                                                className="h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-500 group-hover:text-purple-700">Open CBE Birr</span>
                                                    </div>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="group flex flex-col items-center justify-center h-32 border-2 border-gray-100 hover:border-orange-500 hover:bg-orange-50 transition-all p-4 bg-white shadow-sm"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        window.location.href = "intent://#Intent;package=com.ekenya.awashwallet;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.ekenya.awashwallet;end";
                                                    }}
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <div className="h-16 w-full mb-2 flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src="/images/awash-logo.png"
                                                                alt="Awash Bank"
                                                                className="h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-500 group-hover:text-orange-700">Open Awash Birr</span>
                                                    </div>
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <p className="text-sm text-gray-600 font-medium italic">
                                                Dial these USSD codes on your mobile to pay. Use your <span className="text-blue-700 font-bold">Payment Reference</span>.
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <Button
                                                    variant="outline"
                                                    className="group flex flex-col items-center justify-center h-32 border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all p-4 bg-white shadow-sm"
                                                    asChild
                                                >
                                                    <a href="tel:*127#">
                                                        <div className="h-16 w-full mb-2 flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src="/images/telebirr-logo.png"
                                                                alt="Telebirr"
                                                                className="h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                                            />
                                                        </div>
                                                        <span className="text-sm font-bold text-blue-700 font-mono">*127#</span>
                                                    </a>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="group flex flex-col items-center justify-center h-32 border-2 border-gray-100 hover:border-purple-500 hover:bg-purple-50 transition-all p-4 bg-white shadow-sm"
                                                    asChild
                                                >
                                                    <a href="tel:*889#">
                                                        <div className="h-16 w-full mb-2 flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src="/images/cbe-logo.png"
                                                                alt="CBE"
                                                                className="h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                                            />
                                                        </div>
                                                        <span className="text-sm font-bold text-purple-700 font-mono">*889#</span>
                                                    </a>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="group flex flex-col items-center justify-center h-32 border-2 border-gray-100 hover:border-orange-500 hover:bg-orange-50 transition-all p-4 bg-white shadow-sm"
                                                    asChild
                                                >
                                                    <a href="tel:*901#">
                                                        <div className="h-16 w-full mb-2 flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src="/images/awash-logo.png"
                                                                alt="Awash Bank"
                                                                className="h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                                            />
                                                        </div>
                                                        <span className="text-sm font-bold text-orange-700 font-mono">*901#</span>
                                                    </a>
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-6 p-4 bg-blue-900 rounded-xl border border-blue-800 shadow-inner flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-blue-800 rounded-lg">
                                                <Copy className="h-5 w-5 text-blue-200" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300 font-bold mb-0.5">Payment Reference</p>
                                                <p className="text-xl font-mono font-bold text-white tracking-wider">
                                                    {selectedBill.CUSTOMERKEY || selectedBill.id.split('-')[0].toUpperCase()}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className={`h-10 px-4 font-bold transition-all ${copied ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white hover:bg-blue-50 text-blue-900'}`}
                                            onClick={async () => {
                                                const ref = selectedBill.CUSTOMERKEY || selectedBill.id.split('-')[0].toUpperCase();

                                                try {
                                                    if (navigator.clipboard && navigator.clipboard.writeText) {
                                                        await navigator.clipboard.writeText(ref);
                                                    } else {
                                                        // Fallback for non-secure contexts or unsupported browsers
                                                        const textArea = document.createElement("textarea");
                                                        textArea.value = ref;
                                                        textArea.style.position = "fixed";
                                                        textArea.style.left = "-9999px";
                                                        textArea.style.top = "0";
                                                        document.body.appendChild(textArea);
                                                        textArea.focus();
                                                        textArea.select();
                                                        document.execCommand('copy');
                                                        document.body.removeChild(textArea);
                                                    }
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                } catch (err) {
                                                    console.error("Failed to copy reference:", err);
                                                }
                                            }}
                                        >
                                            {copied ? <><Check className="h-4 w-4 mr-2" /> Copied</> : "Copy ID"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 pt-4 border-t text-center text-xs text-gray-400">
                                <p>Thank you for your prompt payment.</p>
                                <p>Addis Ababa Water & Sewerage Authority</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
