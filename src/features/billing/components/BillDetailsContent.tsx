
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BillWorkflowMap } from '@/features/maps/components/BillWorkflowMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    getBillByIdAction,
    submitBillAction,
    approveBillAction,
    rejectBillAction,
    postBillAction,
    getBillWorkflowLogsAction,
    getCustomerByIdAction,
    getBulkMeterByIdAction,
    calculateBillAction,
    updateBillAction,
    getBranchByIdAction,
    correctBillAction,
    getBillCorrectionDetailsAction,
    getBillsByCustomerKeyAction,
    getAssignedCustomerReadingsAction,
    getExactPeriodReadingsAction,
    updateBulkAndAssignedReadingsAction,
    recalculateBulkBillAction,
    getAssignedCustomersForBulkMeterAction,
    getUnassignedIndividualCustomersAction,
    assignCustomerToBulkMeterAction,
    unassignCustomerFromBulkMeterAction,
    logSecurityEventAction,
} from '@/lib/actions';
import { generateSingleBillPdfAction } from '@/lib/pdf-actions';
import { initializeTariffs, getTariff } from '@/lib/data-store';

import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/constants/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Printer, ArrowLeft, Loader2, Save, X, Edit2, CheckCircle2, RotateCcw, Clock, AlertCircle, FileDown, Upload, Users, UserPlus, UserMinus, Search, ChevronLeft, ChevronRight, ArrowRightLeft, ExternalLink, ShieldCheck, Scale, Info, Check, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TablePagination } from '@/components/ui/table-pagination';


import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getMonthlyBillAmt } from '@/lib/billing-utils';

// Mock types
type Bill = {
    id: string;
    individual_customer_id?: string | null;
    CUSTOMERKEY?: string | null;
    TOTALBILLAMOUNT: number;
    THISMONTHBILLAMT?: number;
    OUTSTANDINGAMT?: number;
    debit_30?: number;
    debit30?: number;
    debit_30_60?: number;
    debit30_60?: number;
    debit_60?: number;
    debit60?: number;
    status: string;
    created_at: string;
    month_year: string;
    CURRREAD: number;
    PREVREAD: number;
    CONS: number;
    base_water_charge?: number;
    maintenance_fee?: number;
    sanitation_fee?: number;
    sewerage_charge?: number;
    meter_rent?: number;
    vat_amount?: number;
    difference_usage?: number;
    balance_carried_forward?: number;
    payment_status?: string;
    [key: string]: any;
};

interface BillDetailsPageProps {
    basePath?: string;
}

// Sub-component for the printable bill layout
const PrintableBill = ({ bill, relatedData, reconstructedAging }: {
    bill: Bill,
    relatedData: any,
    reconstructedAging: { d30: number, d30_60: number, d60: number, penalty?: number, outstanding?: number, totalPayable?: number } | null
}) => {
    const [currentDateTime, setCurrentDateTime] = React.useState(new Date().toLocaleString('en-US'));

    React.useEffect(() => {
        setCurrentDateTime(new Date().toLocaleString('en-US'));
    }, []);

    const d30 = reconstructedAging ? reconstructedAging.d30 : Number(bill.debit30 || bill.debit_30 || 0);
    const d30_60 = reconstructedAging ? reconstructedAging.d30_60 : Number(bill.debit30_60 || bill.debit_30_60 || 0);
    const d60 = reconstructedAging ? reconstructedAging.d60 : Number(bill.debit60 || bill.debit_60 || 0);
    const penalty = reconstructedAging && reconstructedAging.penalty !== undefined ? reconstructedAging.penalty : Number(bill.PENALTYAMT || 0);
    const outstanding = reconstructedAging && reconstructedAging.outstanding !== undefined
        ? reconstructedAging.outstanding
        : (bill.OUTSTANDINGAMT !== undefined && bill.OUTSTANDINGAMT !== null && bill.OUTSTANDINGAMT !== 0)
            ? Number(bill.OUTSTANDINGAMT)
            : (d30 + d30_60 + d60);
    const current = getMonthlyBillAmt(bill);
    const total = reconstructedAging && reconstructedAging.totalPayable !== undefined ? reconstructedAging.totalPayable : outstanding + current + penalty;

    return (
        <div className="printable-bill-card-wrapper border-none shadow-none bg-transparent w-full flex flex-col items-start">
            <div className="non-printable flex flex-row items-center justify-between max-w-4xl w-full mx-auto bg-white/80 backdrop-blur-sm sticky top-0 z-50 rounded-b-xl border shadow-sm p-4 mb-6">
                <h3 className="font-bold text-lg">Pay Slip Preview</h3>
                <div className="flex gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 shadow-lg"
                        onClick={() => {
                            const event = new CustomEvent('export-pdf-click');
                            window.dispatchEvent(event);
                        }}
                    >
                        <FileDown className="mr-2 h-4 w-4" /> Export PDF
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="bg-white shadow-lg"
                        onClick={() => window.print()}
                    >
                        <Printer className="mr-2 h-4 w-4" /> Print now
                    </Button>
                </div>
            </div>

            <div className="printable-bill-card">
                <div className="print-header">
                    <div className="print-header-top">
                        <span>{currentDateTime}</span>
                        <span>AAWSA Bulk Meter Billing Portal</span>
                    </div>
                    <div className="print-header-main flex flex-col items-start text-left">
                        <h1 className="font-bold tracking-wider uppercase text-sm">ADDIS ABABA WATER AND SEWERAGE AUTHORITY</h1>
                        <hr className="my-1 w-full border-black" />
                        <div className="flex flex-row items-center justify-start gap-2 pt-0.5">
                            <img src="https://veiethiopia.com/photo/partner/par2.png" alt="AAWSA Logo" className="h-4 w-auto flex-shrink-0" />
                            <h2 className="font-semibold text-xs text-blue-900">AAWSA INVOICE</h2>
                        </div>
                    </div>
                </div>

                <div className="print-body">
                    <div className="print-section">
                        <div className="print-banner">CUSTOMER INFORMATION</div>
                        <table className="print-table">
                            <tbody>
                                <tr><td>Customer name:</td><td>{relatedData?.name || 'N/A'}</td></tr>
                                <tr><td>Customer key number:</td><td>{bill.CUSTOMERKEY || bill.individual_customer_id}</td></tr>
                                <tr><td>Contract No:</td><td>{relatedData?.contractNumber || 'N/A'}</td></tr>
                                <tr><td>Branch:</td><td>{relatedData?.branch?.name || relatedData?.branch_id || 'N/A'}</td></tr>
                                <tr><td>Location:</td><td>{relatedData?.subCity || 'N/A'}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="print-section">
                        <div className="print-banner">READING INFORMATION</div>
                        {(() => {
                            const isBulkMeter = Boolean(bill.CUSTOMERKEY);
                            const bulkUsageVal = Number(bill.CONS ?? (Number(bill.CURRREAD || 0) - Number(bill.PREVREAD || 0)));
                            const diffUsageVal = Number(bill.difference_usage ?? bill.differenceUsage ?? 0);
                            const totalIndivUsageVal = Number(
                                bill.snapshot_data?.totalIndividualUsage ??
                                bill.snapshot_data?.total_individual_usage ??
                                Math.max(0, bulkUsageVal - diffUsageVal)
                            );
                            return (
                                <table className="print-table">
                                    <tbody>
                                        <tr><td>Category:</td><td>{relatedData?.chargeGroup || relatedData?.customerType || 'Domestic'}</td></tr>
                                        <tr><td>Sewerage Connection:</td><td>{relatedData?.sewerageConnection || 'No'}</td></tr>
                                        <tr><td>Previous and current reading:</td><td>{Number(bill.PREVREAD || 0).toFixed(2)} / {Number(bill.CURRREAD || 0).toFixed(2)} m³</td></tr>
                                        {isBulkMeter ? (
                                            <>
                                                <tr><td>Bulk usage:</td><td>{bulkUsageVal.toFixed(2)} m³</td></tr>
                                                <tr><td>Total Individual Usage:</td><td>{totalIndivUsageVal.toFixed(2)} m³</td></tr>
                                                <tr><td>Difference usage:</td><td>{diffUsageVal.toFixed(2)} m³</td></tr>
                                            </>
                                        ) : (
                                            <tr><td>Consumption usage:</td><td>{Number(bill.CONS || 0).toFixed(2)} m³</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>

                    <div className="print-section">
                        <div className="print-banner">CHARGES BREAKDOWN</div>
                        <table className="print-table">
                            <tbody>
                                <tr><td>Base Water Charge:</td><td>ETB {Number(bill.base_water_charge || 0).toFixed(2)}</td></tr>
                                <tr><td>Maintenance Fee:</td><td>ETB {Number(bill.maintenance_fee || 0).toFixed(2)}</td></tr>
                                <tr><td>Sanitation Fee:</td><td>ETB {Number(bill.sanitation_fee || 0).toFixed(2)}</td></tr>
                                <tr><td>Meter Rent:</td><td>ETB {Number(bill.meter_rent || 0).toFixed(2)}</td></tr>
                                <tr><td>Sewerage Fee:</td><td>ETB {Number(bill.sewerage_charge || 0).toFixed(2)}</td></tr>
                                <tr><td>VAT (15%):</td><td>ETB {Number(bill.vat_amount || 0).toFixed(2)}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="print-section">
                        <div className="print-banner">Total Amount Payable:</div>
                        <table className="print-table">
                            <tbody>
                                <tr className="print-table-total"><td>Current Bill (ETB)</td><td>ETB {Math.max(0, current).toFixed(2)}</td></tr>
                                <tr><td>Penalty (ETB):</td><td>ETB {penalty.toFixed(2)}</td></tr>
                                <tr><td>Outstanding (ETB):</td><td>ETB {outstanding.toFixed(2)}</td></tr>
                                <tr className="print-table-total" style={{ fontSize: '12pt' }}>
                                    <td>Total Amount Payable:</td>
                                    <td>ETB {total.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-end mt-4">
                        <div className="space-y-1">
                            <div className="text-sm">Paid/Unpaid: {bill.payment_status || 'Unpaid'}</div>
                            <div className="text-sm">Month: {bill.month_year}</div>
                        </div>
                        <div className="print-status-box">
                            {bill.payment_status || 'Unpaid'}
                        </div>
                    </div>

                    <div className="print-signature-section grid grid-cols-3 gap-4 mt-6">
                        <div className="print-signature-item border-t border-black pt-1 flex flex-col">
                            <span className="text-[10px] uppercase font-bold">Prepared by</span>
                            <span className="h-6"></span>
                        </div>
                        <div className="print-signature-item border-t border-black pt-1 flex flex-col">
                            <span className="text-[10px] uppercase font-bold">Checked by</span>
                            <span className="h-6"></span>
                        </div>
                        <div className="print-signature-item border-t border-black pt-1 flex flex-col">
                            <span className="text-[10px] uppercase font-bold">Approved by</span>
                            <span className="h-6"></span>
                        </div>
                    </div>
                </div>

                <div className="text-[8px] text-center pt-4 italic text-gray-500">
                    This is a computer generated bill. No signature required for validation.
                </div>
            </div>
        </div>
    );
};


// Reusable content component
export function BillDetailsContent({ basePath = '/staff/bill-management' }: { basePath?: string }) {
    const params = useParams();
    const router = useRouter();
    const idRaw = params?.id;
    const id = Array.isArray(idRaw) ? idRaw[0] : (idRaw as string);
    const { hasPermission } = usePermissions();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const isPrintMode = searchParams?.get('print') === 'true';

    const [bill, setBill] = useState<Bill | null>(null);
    const [relatedData, setRelatedData] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [reconstructedAging, setReconstructedAging] = useState<{ d30: number, d30_60: number, d60: number, penalty?: number, outstanding?: number, totalPayable?: number } | null>(null);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editValues, setEditValues] = useState<{ current: number, previous: number }>({ current: 0, previous: 0 });
    const [calculatedPreview, setCalculatedPreview] = useState<{ usage: number, amount: number } | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Assigned sub-meter readings state (for bulk bills)
    type AssignedReadingRow = {
        customerKeyNumber: string;
        name: string;
        previous: number;
        current: number;
        billId?: string | null;
        billStatus?: string | null;
        hasExactRecord?: boolean;
        readingDate?: string | null;
    };
    const [assignedReadings, setAssignedReadings] = useState<AssignedReadingRow[]>([]);
    const [assignedReadingEdits, setAssignedReadingEdits] = useState<Record<string, { previous: number; current: number }>>({});
    const [isLoadingAssigned, setIsLoadingAssigned] = useState(false);

    // Reject / Correct reason dialog state
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; action: 'reject' | 'correct' }>({ open: false, action: 'reject' });
    const [rejectReason, setRejectReason] = useState('');

    // Correction details and verification state
    const [correctionDetails, setCorrectionDetails] = useState<any | null>(null);
    const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
    const [integrityCheckResult, setIntegrityCheckResult] = useState<{ checked: boolean; isMatch?: boolean; message?: string } | null>(null);
    const [showCorrectionBreakdown, setShowCorrectionBreakdown] = useState(true);

    // Manage Assigned Customers dialog state
    const [manageCustomersOpen, setManageCustomersOpen] = useState(false);
    const [assignedCustomers, setAssignedCustomers] = useState<any[]>([]);
    const [assignedTotal, setAssignedTotal] = useState(0);
    const [unassignedCustomers, setUnassignedCustomers] = useState<any[]>([]);
    const [unassignedTotal, setUnassignedTotal] = useState(0);
    const [customerSearch, setCustomerSearch] = useState('');
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);
    const [customerActionLoading, setCustomerActionLoading] = useState<string | null>(null);
    const [manageReasonOpen, setManageReasonOpen] = useState(false);
    const [manageReasonText, setManageReasonText] = useState('');
    const [assignedPage, setAssignedPage] = useState(1);
    const [assignedRowsPerPage, setAssignedRowsPerPage] = useState(5);
    const [unassignedPage, setUnassignedPage] = useState(1);
    const [unassignedRowsPerPage, setUnassignedRowsPerPage] = useState(5);

    // ── Server-side pagination fetch helpers ──
    const fetchAssignedPage = useCallback(async (page: number, limit: number = assignedRowsPerPage) => {
        if (!bill?.CUSTOMERKEY) return;
        setIsLoadingCustomers(true);
        try {
            const res = await getAssignedCustomersForBulkMeterAction(bill.CUSTOMERKEY, page, limit);
            if (res.data) {
                if (res.data.rows.length === 0 && page > 1 && res.data.total > 0) {
                    return fetchAssignedPage(page - 1, limit);
                }
                setAssignedCustomers(res.data.rows);
                setAssignedTotal(res.data.total);
                setAssignedPage(page);
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to load assigned customers.', variant: 'destructive' });
        } finally {
            setIsLoadingCustomers(false);
        }
    }, [bill?.CUSTOMERKEY, assignedRowsPerPage]);

    const fetchUnassignedPage = useCallback(async (page: number, search: string, limit: number = unassignedRowsPerPage) => {
        if (!bill?.CUSTOMERKEY) return;
        setIsLoadingUnassigned(true);
        try {
            const res = await getUnassignedIndividualCustomersAction(search, page, limit);
            if (res.data) {
                setUnassignedCustomers(res.data.rows);
                setUnassignedTotal(res.data.total);
                setUnassignedPage(page);
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to load unassigned customers.', variant: 'destructive' });
        } finally {
            setIsLoadingUnassigned(false);
        }
    }, [bill?.CUSTOMERKEY, unassignedRowsPerPage]);

    const [isExporting, setIsExporting] = useState(false);

    // Auto-print logic

    useEffect(() => {
        if (isPrintMode && !loading && bill) {
            const timer = setTimeout(() => {
                window.print();
            }, 1500); // Slightly longer delay to ensure full render
            return () => clearTimeout(timer);
        }
    }, [isPrintMode, loading, bill]);

    useEffect(() => {
        if (id) loadData();

        const handlePdfExportClick = () => handleExportPdf();
        window.addEventListener('export-pdf-click', handlePdfExportClick);
        return () => window.removeEventListener('export-pdf-click', handlePdfExportClick);
    }, [id]);

    async function handleExportPdf() {
        if (!id || isExporting) return;
        setIsExporting(true);
        toast({ title: "Generating PDF...", description: "Please wait while we prepare your file." });

        try {
            const res = await generateSingleBillPdfAction(id);
            if (res.success && res.pdfBase64) {
                const byteCharacters = atob(res.pdfBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `Bill_${bill?.CUSTOMERKEY || bill?.individual_customer_id || 'unnamed'}_${bill?.month_year || 'bill'}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                toast({ title: "Success", description: "PDF exported successfully." });
            } else {
                toast({ title: "Export Failed", description: res.error || "Failed to generate PDF.", variant: "destructive" });
            }
        } catch (error: any) {
            console.error("PDF Export failed", error);
            toast({ title: "Error", description: "An unexpected error occurred during export.", variant: "destructive" });
        } finally {
            setIsExporting(false);
        }
    }


    async function loadData() {
        try {
            const billRes = await getBillByIdAction(id);
            if (billRes.data) {
                const b = billRes.data as Bill;
                setBill(b);
                setEditValues({
                    current: Number(b.CURRREAD || 0),
                    previous: Number(b.PREVREAD || 0)
                });

                let customerType = "Non-domestic";
                if (b.individual_customer_id) {
                    const custRes = await getCustomerByIdAction(b.individual_customer_id);
                    if (custRes.data) {
                        setRelatedData({ type: 'individual', ...custRes.data });
                        customerType = custRes.data.customerType || custRes.data.customer_type || "Domestic";
                    } else {
                        setRelatedData({
                            type: 'individual',
                            customerKeyNumber: b.individual_customer_id,
                            customerType: 'Domestic',
                            meterSize: 0.5,
                            sewerageConnection: 'No',
                        });
                        customerType = "Domestic";
                    }
                } else if (b.CUSTOMERKEY) {
                    const bulkRes = await getBulkMeterByIdAction(b.CUSTOMERKEY);
                    if (bulkRes.data) {
                        const bulkData = bulkRes.data;
                        if (bulkData.branch_id) {
                            const branchRes = await getBranchByIdAction(bulkData.branch_id);
                            if (branchRes.data) bulkData.branch = branchRes.data;
                        }
                        setRelatedData({ type: 'bulk', ...bulkData });
                        customerType = bulkData.chargeGroup || bulkData.charge_group || "Non-domestic";
                    } else {
                        const snap = b.snapshot_data || {};
                        setRelatedData({
                            type: 'bulk',
                            customerKeyNumber: b.CUSTOMERKEY,
                            charge_group: snap.chargeGroup || 'Non-domestic',
                            chargeGroup: snap.chargeGroup || 'Non-domestic',
                            sewerage_connection: snap.sewerageConnection || 'No',
                            sewerageConnection: snap.sewerageConnection || 'No',
                            meterSize: 0.5,
                            branch_id: b.branch_id,
                        });
                        customerType = snap.chargeGroup || "Non-domestic";
                    }
                }

                await initializeTariffs(true);

                const logsRes = await getBillWorkflowLogsAction(id);
                if (logsRes.data) setLogs(logsRes.data);

                try {
                    const corrRes = await getBillCorrectionDetailsAction(id);
                    if (corrRes?.data?.isCorrection) {
                        setCorrectionDetails(corrRes.data);
                    } else {
                        setCorrectionDetails(null);
                    }
                } catch (e) {
                    console.warn("Failed to load bill correction details", e);
                }

                // Reconstruct Aging
                const customerKey = b.CUSTOMERKEY || b.individual_customer_id;
                if (customerKey) {
                    const historyRes = await getBillsByCustomerKeyAction(customerKey);
                    if (historyRes.data) {
                        const history = historyRes.data as any[];
                        
                        // Process from OLDEST to NEWEST
                        const historyOldestFirst = [...history].sort((x, y) => {
                            const dateA = new Date(x.billPeriodEndDate || x.created_at || 0).getTime();
                            const dateB = new Date(y.billPeriodEndDate || y.created_at || 0).getTime();
                            if (dateA !== dateB) return dateA - dateB;
                            const cA = x.created_at ? new Date(x.created_at).getTime() : 0;
                            const cB = y.created_at ? new Date(y.created_at).getTime() : 0;
                            return cA - cB;
                        });

                        let carriedForwardUnpaid = 0;
                        let d30_bucket = 0;
                        let d30_60_bucket = 0;
                        let d60_bucket = 0;
                        let billIndexCounter = 0;

                        for (const h of historyOldestFirst) {
                            const isVoided = h.status === 'Deleted' || h.status === 'Void';
                            
                            const billMonth = h.month_year || format(new Date(h.created_at || Date.now()), 'yyyy-MM');
                            const activeTariff = getTariff(customerType as any, billMonth);

                            const threshold = activeTariff?.penalty_month_threshold ?? 3;
                            const bankRate = Number(activeTariff?.bank_lending_rate ?? 0.15);
                            const tieredRates = Array.isArray(activeTariff?.penalty_tiered_rates) ? activeTariff.penalty_tiered_rates : [];

                            const arrearsSum = carriedForwardUnpaid;

                            let penalty = 0;
                            let maxAge = 0;

                            if (d60_bucket > 0.01) maxAge = 3;
                            else if (d30_60_bucket > 0.01) maxAge = 2;
                            else if (d30_bucket > 0.01) maxAge = 1;

                            const totalMissedCycles = billIndexCounter;
                            maxAge = Math.max(maxAge, totalMissedCycles);

                            const legacyDebt = Math.max(0, arrearsSum - (d30_bucket + d30_60_bucket + d60_bucket));
                            if (legacyDebt > 0.01) maxAge = Math.max(maxAge, 3);

                            if (maxAge >= threshold) {
                                const applicableTier = [...tieredRates].sort((a: any, b: any) => b.month - a.month).find((t: any) => maxAge >= t.month);
                                const totalRate = bankRate + Number(applicableTier?.rate || 0);
                                penalty = arrearsSum * totalRate;
                            }

                            const currentMonthlyCharge = isVoided ? 0 : getMonthlyBillAmt(h);
                            const totalD60AndLegacy = d60_bucket + legacyDebt;

                            const derivedOutstanding = d30_bucket + d30_60_bucket + totalD60AndLegacy + penalty;
                            const derivedTotalPayable = isVoided ? 0 : derivedOutstanding + currentMonthlyCharge;

                            if (h.id === b.id) {
                                // Save reconstructed aging buckets and details for this bill
                                setReconstructedAging({
                                    d30: d30_bucket,
                                    d30_60: d30_60_bucket,
                                    d60: totalD60AndLegacy,
                                    penalty,
                                    outstanding: derivedOutstanding,
                                    totalPayable: derivedTotalPayable
                                });
                                break;
                            }

                            const amtPaid = isVoided ? 0 : Number(h.amountPaid || h.amount_paid || h.AMOUNTPAID || 0);
                            const debtForNextMonth = d30_bucket + d30_60_bucket + totalD60AndLegacy + currentMonthlyCharge + penalty;
                            carriedForwardUnpaid = Math.max(0, debtForNextMonth - amtPaid);

                            let remainingPayment = amtPaid;

                            const paidAgainstOldest = Math.min(remainingPayment, totalD60AndLegacy);
                            const remaining_d60_plus_legacy = Math.max(0, totalD60AndLegacy - paidAgainstOldest);
                            remainingPayment -= paidAgainstOldest;

                            const paidAgainstPenalty = Math.min(remainingPayment, penalty);
                            remainingPayment -= paidAgainstPenalty;

                            const paidAgainstD30_60 = Math.min(remainingPayment, d30_60_bucket);
                            const remaining_d30_60 = Math.max(0, d30_60_bucket - paidAgainstD30_60);
                            remainingPayment -= paidAgainstD30_60;

                            const paidAgainstD30 = Math.min(remainingPayment, d30_bucket);
                            const remaining_d30 = Math.max(0, d30_bucket - paidAgainstD30);
                            remainingPayment -= paidAgainstD30;

                            const paidAgainstCurrent = Math.min(remainingPayment, currentMonthlyCharge);
                            const remaining_current = Math.max(0, currentMonthlyCharge - paidAgainstCurrent);

                            d60_bucket = remaining_d60_plus_legacy + remaining_d30_60;
                            d30_60_bucket = remaining_d30;
                            d30_bucket = remaining_current;

                            if (carriedForwardUnpaid > 0.01) {
                                billIndexCounter++;
                            } else {
                                billIndexCounter = 0;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load bill", error);
        } finally {
            setLoading(false);
        }
    }

    const handleDownloadAssignmentTemplate = async () => {
        if (!bill?.CUSTOMERKEY) return;
        try {
            toast({ title: 'Preparing Template...', description: 'Fetching assigned customers for template.' });
            const res = await getAssignedCustomersForBulkMeterAction(bill.CUSTOMERKEY, 1, Math.max(assignedTotal, 10000));
            const allCustomers = res.data?.rows || assignedCustomers;

            const headers = 'Customer Key,Action';
            const sampleRows = [
                '# Action should be ADD or REMOVE',
                ...allCustomers.map((c: any) => `"${c.customerKeyNumber}",REMOVE`)
            ];
            const csvContent = [headers, ...sampleRows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `assignment_template_${bill.CUSTOMERKEY}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: 'Template Downloaded', description: `Downloaded template with ${allCustomers.length} assigned customer(s).` });
        } catch (error) {
            console.error('Failed to download template', error);
            toast({ title: 'Download Failed', description: 'Could not fetch assigned customers.', variant: 'destructive' });
        }
    };

    const handleUploadAssignmentCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoadingCustomers(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                if (!text) return;

                const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
                if (lines.length < 2) {
                    toast({ variant: "destructive", title: "CSV Error", description: "File must contain a header row and at least one data row." });
                    return;
                }

                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
                const keyIdx = headers.findIndex(h => ['customer key', 'customerkey', 'customer_key', 'cust_key', 'id', 'customerkeynumber'].includes(h));
                const actionIdx = headers.findIndex(h => ['action', 'operation', 'type'].includes(h));

                if (keyIdx === -1 || actionIdx === -1) {
                    toast({
                        variant: "destructive",
                        title: "Invalid Headers",
                        description: "CSV must contain 'Customer Key' and 'Action' columns."
                    });
                    return;
                }

                let addedCount = 0;
                let removedCount = 0;
                let errorCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].startsWith('#')) continue;
                    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    const key = cols[keyIdx];
                    const actionStr = cols[actionIdx]?.toUpperCase();

                    if (!key) continue;

                    if (actionStr === 'ADD' || actionStr === 'ASSIGN') {
                        if (bill?.CUSTOMERKEY) {
                            const res = await assignCustomerToBulkMeterAction(key, bill.CUSTOMERKEY);
                            if (res.success) addedCount++;
                            else errorCount++;
                        }
                    } else if (actionStr === 'REMOVE' || actionStr === 'UNASSIGN' || actionStr === 'DELETE') {
                        const res = await unassignCustomerFromBulkMeterAction(key);
                        if (res.success) removedCount++;
                        else errorCount++;
                    }
                }

                toast({
                    title: "CSV Processed",
                    description: `Successfully added ${addedCount}, removed ${removedCount} customers. Errors: ${errorCount}`
                });

                if (bill?.CUSTOMERKEY) {
                    await recalculateBulkBillAction(bill.CUSTOMERKEY, bill.month_year);
                    await Promise.all([
                        fetchAssignedPage(1),
                        fetchUnassignedPage(1, ''),
                    ]);
                    setCustomerSearch('');
                    await loadData();
                }
            } catch (err) {
                console.error("CSV Assignment Import Error", err);
                toast({ variant: "destructive", title: "Error", description: "Failed to parse and apply CSV assignment." });
            } finally {
                setIsLoadingCustomers(false);
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleFileUploadAssignedReadings = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                if (!text) return;

                const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
                if (lines.length < 2) {
                    toast({ variant: "destructive", title: "CSV Error", description: "File must contain a header row and at least one data row." });
                    return;
                }

                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

                const keyIdx = headers.findIndex(h => ['customerkey', 'customer key', 'customer', 'cust_key', 'customerkeynumber', 'meterkey', 'meter', 'id'].includes(h));
                const prevIdx = headers.findIndex(h => ['previousreading', 'previous reading', 'prevreading', 'prev reading', 'prevread', 'prev_read', 'previous'].includes(h));
                const currIdx = headers.findIndex(h => ['currentreading', 'current reading', 'currreading', 'curr reading', 'currread', 'curr_read', 'reading', 'readingvalue', 'current'].includes(h));

                if (keyIdx === -1 || (currIdx === -1 && prevIdx === -1)) {
                    toast({
                        variant: "destructive",
                        title: "Invalid Headers",
                        description: "CSV must contain columns: 'Customer Key' and ('Current Reading' or 'Previous Reading')."
                    });
                    return;
                }

                let updatedCount = 0;
                const newEdits = { ...assignedReadingEdits };

                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    const key = cols[keyIdx];
                    if (!key) continue;

                    const matched = assignedReadings.find(r =>
                        r.customerKeyNumber.toLowerCase() === key.toLowerCase() ||
                        r.customerKeyNumber.replace(/\D/g, '') === key.replace(/\D/g, '')
                    );
                    if (matched) {
                        const targetKey = matched.customerKeyNumber;
                        const existing = newEdits[targetKey] || { previous: matched.previous, current: matched.current };

                        const newPrev = prevIdx !== -1 && cols[prevIdx] !== '' ? parseFloat(cols[prevIdx]) : existing.previous;
                        const newCurr = currIdx !== -1 && cols[currIdx] !== '' ? parseFloat(cols[currIdx]) : existing.current;

                        newEdits[targetKey] = {
                            previous: isNaN(newPrev) ? existing.previous : newPrev,
                            current: isNaN(newCurr) ? existing.current : newCurr,
                        };
                        updatedCount++;
                    }
                }

                setAssignedReadingEdits(newEdits);
                toast({
                    title: "CSV Uploaded",
                    description: `Successfully loaded ${updatedCount} sub-meter reading(s) from CSV.`
                });
            } catch (err) {
                console.error("CSV Parse Error", err);
                toast({ variant: "destructive", title: "Error", description: "Failed to parse CSV file." });
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleDownloadTemplate = () => {
        const rows = assignedReadings.map(row => {
            const edits = assignedReadingEdits[row.customerKeyNumber] ?? { previous: row.previous, current: row.current };
            return [
                `"${row.customerKeyNumber}"`,
                `"${row.name}"`,
                edits.previous,
                edits.current
            ].join(',');
        });
        const csvContent = [
            'Customer Key,Customer Name,Previous Reading,Current Reading',
            ...rows
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `readings_template_${bill?.CUSTOMERKEY ?? 'bulk'}_${bill?.month_year ?? ''}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Template Downloaded', description: `${assignedReadings.length} customers exported. Edit values then re-upload via "Upload CSV".` });
    };

    const handleEditChange = (field: 'current' | 'previous', value: string) => {
        setEditValues(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handleAssignedReadingChange = (key: string, field: 'current' | 'previous', value: string) => {
        setAssignedReadingEdits(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: parseFloat(value) || 0 }
        }));
    };

    // Load assigned customer readings whenever editing starts on a bulk bill
    useEffect(() => {
        if (!isEditing || !bill || !bill.CUSTOMERKEY) return;
        let cancelled = false;
        setIsLoadingAssigned(true);
        getAssignedCustomerReadingsAction(bill.CUSTOMERKEY, bill.month_year).then(res => {
            if (cancelled) return;
            if (res.data && Array.isArray(res.data)) {
                setAssignedReadings(res.data);
                const initEdits: Record<string, { previous: number; current: number }> = {};
                for (const row of res.data as any[]) {
                    initEdits[row.customerKeyNumber] = { previous: row.previous, current: row.current };
                }
                setAssignedReadingEdits(initEdits);

                // If exact bulk reading was recorded for this period, sync it into editValues
                const br = (res.data as any).bulkReading;
                if (br && typeof br.current === 'number' && typeof br.previous === 'number') {
                    setEditValues({
                        current: br.current,
                        previous: br.previous
                    });
                }
            }
        }).catch(console.error).finally(() => {
            if (!cancelled) setIsLoadingAssigned(false);
        });
        return () => { cancelled = true; };
    }, [isEditing, bill?.id]);

    // For standalone individual bills, fetch exact reading recorded for that period
    useEffect(() => {
        if (!isEditing || !bill || !bill.individual_customer_id) return;
        let cancelled = false;
        getExactPeriodReadingsAction({
            customerKey: bill.individual_customer_id,
            isBulk: false,
            monthYear: bill.month_year
        }).then(res => {
            if (cancelled) return;
            const ir = res.data?.individualReading;
            if (ir && typeof ir.currentReading === 'number' && typeof ir.previousReading === 'number') {
                setEditValues({
                    current: ir.currentReading,
                    previous: ir.previousReading
                });
            }
        }).catch(console.error);
        return () => { cancelled = true; };
    }, [isEditing, bill?.id]);

    // Auto-open edit mode when landing on a correction draft
    useEffect(() => {
        if (!bill) return;
        const isCorr = typeof bill.notes === 'string' && bill.notes.includes('Correction of');
        if (isCorr && (bill.status === 'Draft' || bill.status === 'Rework') && !isEditing) {
            setIsEditing(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bill?.id]);

    const [isFetchingPeriodReadings, setIsFetchingPeriodReadings] = useState(false);

    const handleFetchExactPeriodReadings = async () => {
        if (!bill) return;
        setIsFetchingPeriodReadings(true);
        try {
            const isBulk = !!bill.CUSTOMERKEY;
            const key = bill.CUSTOMERKEY || bill.individual_customer_id;
            if (!key) return;

            const res = await getExactPeriodReadingsAction({
                customerKey: key,
                isBulk,
                monthYear: bill.month_year
            });

            if (res.error) {
                toast({ title: "Fetch Failed", description: res.error.message || "Could not retrieve period readings.", variant: "destructive" });
                return;
            }

            if (isBulk && res.data) {
                const br = res.data.bulkReading;
                if (br) {
                    setEditValues({
                        current: br.currentReading,
                        previous: br.previousReading
                    });
                }
                if (res.data.assignedCustomers && res.data.assignedCustomers.length > 0) {
                    setAssignedReadings(res.data.assignedCustomers);
                    const initEdits: Record<string, { previous: number; current: number }> = {};
                    for (const row of res.data.assignedCustomers as any[]) {
                        initEdits[row.customerKeyNumber] = { previous: row.previous, current: row.current };
                    }
                    setAssignedReadingEdits(initEdits);
                }
                toast({
                    title: "Exact Readings Loaded",
                    description: `Loaded exact meter readings for period ${bill.month_year} (Bulk: ${br?.previousReading} -> ${br?.currentReading}, plus ${res.data.assignedCustomers?.length || 0} sub-meters).`
                });
            } else if (!isBulk && res.data?.individualReading) {
                const ir = res.data.individualReading;
                setEditValues({
                    current: ir.currentReading,
                    previous: ir.previousReading
                });
                toast({
                    title: "Exact Reading Loaded",
                    description: `Loaded exact meter reading for period ${bill.month_year}: Prev = ${ir.previousReading} m³, Curr = ${ir.currentReading} m³.`
                });
            }
        } catch (err: any) {
            console.error("Fetch period readings error", err);
            toast({ title: "Error", description: err.message || "Failed to load period readings.", variant: "destructive" });
        } finally {
            setIsFetchingPeriodReadings(false);
        }
    };

    const handleCheckReadingsIntegrity = async () => {
        if (!bill) return;
        setIsCheckingIntegrity(true);
        try {
            const isBulk = !!bill.CUSTOMERKEY;
            const key = bill.CUSTOMERKEY || bill.individual_customer_id;
            if (!key) return;

            const res = await getExactPeriodReadingsAction({
                customerKey: key,
                isBulk,
                monthYear: bill.month_year
            });

            if (res.error) {
                setIntegrityCheckResult({
                    checked: true,
                    isMatch: false,
                    message: res.error.message || "Failed to query meter readings database."
                });
                return;
            }

            if (isBulk && res.data) {
                const br = res.data.bulkReading;
                const targetCurr = isEditing ? editValues.current : Number(bill.CURRREAD || 0);
                const targetPrev = isEditing ? editValues.previous : Number(bill.PREVREAD || 0);
                const recordedCurr = Number(br?.currentReading ?? 0);
                const recordedPrev = Number(br?.previousReading ?? 0);

                const isMatch = (Math.abs(targetCurr - recordedCurr) < 0.01) && (Math.abs(targetPrev - recordedPrev) < 0.01);
                setIntegrityCheckResult({
                    checked: true,
                    isMatch,
                    message: isMatch
                        ? `Physical readings match: Prev: ${recordedPrev.toFixed(2)} m³, Curr: ${recordedCurr.toFixed(2)} m³ (${res.data.assignedCustomers?.length || 0} sub-meters registered).`
                        : `Discrepancy detected: Database has Prev: ${recordedPrev.toFixed(2)} m³, Curr: ${recordedCurr.toFixed(2)} m³; Bill has Prev: ${targetPrev.toFixed(2)} m³, Curr: ${targetCurr.toFixed(2)} m³.`
                });
            } else if (!isBulk && res.data?.individualReading) {
                const ir = res.data.individualReading;
                const targetCurr = isEditing ? editValues.current : Number(bill.CURRREAD || 0);
                const targetPrev = isEditing ? editValues.previous : Number(bill.PREVREAD || 0);
                const recordedCurr = Number(ir.currentReading ?? 0);
                const recordedPrev = Number(ir.previousReading ?? 0);

                const isMatch = (Math.abs(targetCurr - recordedCurr) < 0.01) && (Math.abs(targetPrev - recordedPrev) < 0.01);
                setIntegrityCheckResult({
                    checked: true,
                    isMatch,
                    message: isMatch
                        ? `Meter dial record matches bill: Prev: ${recordedPrev.toFixed(2)} m³, Curr: ${recordedCurr.toFixed(2)} m³.`
                        : `Discrepancy detected: Database dial is Prev: ${recordedPrev.toFixed(2)} m³, Curr: ${recordedCurr.toFixed(2)} m³; Bill has Prev: ${targetPrev.toFixed(2)} m³, Curr: ${targetCurr.toFixed(2)} m³.`
                });
            } else {
                setIntegrityCheckResult({
                    checked: true,
                    isMatch: true,
                    message: `Verified: No conflicting meter reading records found for period ${bill.month_year}.`
                });
            }
        } catch (err: any) {
            setIntegrityCheckResult({
                checked: true,
                isMatch: false,
                message: err.message || "Error running readings integrity check."
            });
        } finally {
            setIsCheckingIntegrity(false);
        }
    };

    const handleRecalculate = async () => {
        if (!bill) return;
        setIsCalculating(true);
        try {
            const usage = editValues.current - editValues.previous;
            const isBulk = !!bill.CUSTOMERKEY;
            const snap = bill.snapshot_data || {};
            const typeParam = (relatedData?.charge_group || relatedData?.chargeGroup || relatedData?.customerType || snap.chargeGroup || (isBulk ? 'Non-domestic' : 'Domestic')) as any;
            const sizeParam = Number(relatedData?.meterSize || 0.5);
            const sewerage = (relatedData?.sewerageConnection || relatedData?.sewerage_connection || snap.sewerageConnection || 'No') as any;
            const month = bill.month_year || '2026-08';

            let effectiveUsage = usage;
            if (isBulk) {
                const totalIndiv = Object.values(assignedReadingEdits).reduce(
                    (sum, r) => sum + (r.current - r.previous), 0
                );
                effectiveUsage = usage - totalIndiv;
            }

            const calcRes = await calculateBillAction(
                Math.max(0, effectiveUsage),
                typeParam,
                sewerage,
                sizeParam,
                month
            );

            if (calcRes.data) {
                setCalculatedPreview({ usage: calcRes.data.effectiveUsage, amount: calcRes.data.totalBill });
                toast({ title: "Preview Updated", description: `Recalculated Bill Amount: ETB ${Number(calcRes.data.totalBill).toFixed(2)}` });
            } else if (calcRes.error) {
                toast({ title: "Preview Failed", description: calcRes.error.message || "Failed to calculate preview.", variant: "destructive" });
            }
        } catch (error: any) {
            console.error("Preview error", error);
            toast({ title: "Calculation Error", description: error?.message || "Failed to calculate preview.", variant: "destructive" });
        } finally {
            setIsCalculating(false);
        }
    };

    const handleSave = async () => {
        if (!bill) return;
        setLoading(true);
        const isCorrectionDraft = typeof bill.notes === 'string' && bill.notes.includes('Correction of');
        try {
            const isBulk = !!(bill.CUSTOMERKEY);
            const usage = editValues.current - editValues.previous;

            if (isBulk) {
                const assignedUpdates = Object.entries(assignedReadingEdits).map(([key, vals]) => ({
                    customerKeyNumber: key,
                    currRead: vals.current,
                    prevRead: vals.previous,
                }));
                const res = await updateBulkAndAssignedReadingsAction({
                    bulkBillId: bill.id,
                    bulkCurrRead: editValues.current,
                    bulkPrevRead: editValues.previous,
                    assignedUpdates,
                });
                if (res?.error) {
                    toast({ title: "Save Failed", description: res.error.message || "An error occurred.", variant: "destructive" });
                } else {
                    toast({
                        title: isCorrectionDraft ? "Correction Rebilled" : "Saved",
                        description: isCorrectionDraft
                            ? "Bill recalculated with corrected readings and marked Unpaid."
                            : "Bulk meter readings updated and rebilled successfully.",
                    });
                    await loadData();
                    setIsEditing(false);
                    setCalculatedPreview(null);
                    setAssignedReadings([]);
                    setAssignedReadingEdits({});
                }
            } else {
                const snap = bill.snapshot_data || {};
                const typeParam = (relatedData?.charge_group || relatedData?.customerType || snap.chargeGroup || 'Domestic') as any;
                const sizeParam = Number(relatedData?.meterSize || 0.5);
                const sewerage = (relatedData?.sewerageConnection || relatedData?.sewerage_connection || snap.sewerageConnection || 'No') as any;
                const month = bill.month_year;

                const calcRes = await calculateBillAction(Math.max(0, usage), typeParam, sewerage, sizeParam, month);

                if (calcRes.data) {
                    const currentOutstanding = Number(bill.OUTSTANDINGAMT || bill.balance_carried_forward || 0);
                    await updateBillAction(bill.id, {
                        CURRREAD: editValues.current,
                        PREVREAD: editValues.previous,
                        CONS: Math.max(0, usage),
                        difference_usage: calcRes.data.effectiveUsage,
                        THISMONTHBILLAMT: calcRes.data.totalBill,
                        TOTALBILLAMOUNT: calcRes.data.totalBill + currentOutstanding,
                        base_water_charge: calcRes.data.baseWaterCharge,
                        sewerage_charge: calcRes.data.sewerageCharge,
                        meter_rent: calcRes.data.meterRent,
                        maintenance_fee: calcRes.data.maintenanceFee,
                        sanitation_fee: calcRes.data.sanitationFee,
                        vat_amount: calcRes.data.vatAmount,
                        // Always mark Unpaid after rebilling so the corrected amount is collectable
                        payment_status: 'Unpaid',
                    });
                    toast({
                        title: isCorrectionDraft ? "Correction Rebilled" : "Saved",
                        description: isCorrectionDraft
                            ? "Bill recalculated with corrected readings and marked Unpaid."
                            : "Bill readings updated and recalculated successfully.",
                    });
                    await loadData();
                    setIsEditing(false);
                    setCalculatedPreview(null);
                }
            }
        } catch (error: any) {
            console.error("Save error", error);
            toast({ title: "Error", description: error?.message || "Failed to save changes.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };


    const handleAction = async (action: 'submit' | 'approve' | 'reject' | 'post' | 'correct') => {
        if (!bill) return;

        // Reject and correct need a reason — open the dialog instead of prompt()
        if (action === 'reject' || action === 'correct') {
            setRejectReason('');
            setRejectDialog({ open: true, action });
            return;
        }

        setLoading(true);
        try {
            let res: any;
            if (action === 'submit') res = await submitBillAction(bill.id);
            if (action === 'approve') res = await approveBillAction(bill.id);
            if (action === 'post') res = await postBillAction(bill.id);

            if (res?.error) {
                toast({ title: "Action Failed", description: res.error.message || "An unexpected error occurred.", variant: "destructive" });
            } else {
                toast({ title: "Success", description: `Bill ${action}ed successfully.` });
                await loadData();
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to perform action.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleRejectConfirm = async () => {
        if (!bill || !rejectReason.trim()) return;
        setRejectDialog({ open: false, action: 'reject' });
        setLoading(true);
        try {
            let res: any;
            if (rejectDialog.action === 'reject') res = await rejectBillAction(bill.id, rejectReason);
            if (rejectDialog.action === 'correct') res = await correctBillAction(bill.id, rejectReason);

            if (res?.error) {
                toast({ title: "Action Failed", description: res.error.message || "An unexpected error occurred.", variant: "destructive" });
            } else {
                if (rejectDialog.action === 'correct' && res?.data?.replacementBillId) {
                    toast({
                        title: "Correction Initiated",
                        description: `Original bill reversed. Redirecting to draft for correction...`,
                    });
                    // Navigate to the new replacement draft bill
                    setTimeout(() => router.push(`${basePath}/${res.data.replacementBillId}`), 1500);
                } else {
                    toast({ title: "Success", description: `Bill ${rejectDialog.action}ed successfully.` });
                    await loadData();
                }
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to perform action.", variant: "destructive" });
        } finally {
            setLoading(false);
            setRejectReason('');
        }
    };

    if (loading && !bill) return <div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin" /> Loading...</div>;
    if (!bill) return <div className="p-8">Bill not found.</div>;

    // Special return for Print Mode
    if (isPrintMode) {
        return <PrintableBill bill={bill} relatedData={relatedData} reconstructedAging={reconstructedAging} />;
    }

    const checkBillPermission = (...permissions: string[]) => {
        if (hasPermission('bill:manage_all')) return true;
        return permissions.some(p => hasPermission(p));
    };

    const canEdit = (bill.status === 'Draft' || bill.status === 'Rework') &&
      (hasPermission(PERMISSIONS.BULK_METERS_EDIT_READINGS_VIEW) ||
       hasPermission(PERMISSIONS.BULK_METERS_EDIT_READINGS) ||
       hasPermission(PERMISSIONS.METER_READINGS_EDIT_RECALCULATE_VIEW) ||
       hasPermission(PERMISSIONS.METER_READINGS_EDIT_RECALCULATE));

    // Phase 4: Detect correction draft — notes is set by correctBillAction
    const isCorrectionDraft = typeof bill.notes === 'string' && bill.notes.includes('Correction of');
    // Extract the original bill number from notes like "Correction of BILL-123. Reason: …"
    const originalBillRef = isCorrectionDraft
        ? (bill.notes?.match(/Correction of ([^.]+)/)?.[1] ?? null)
        : null;

    return (
        <div className="p-6 space-y-6 container mx-auto max-w-6xl no-print">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.push(basePath)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Invoice Details</h1>
                        <p className="text-sm text-gray-500">ID: {bill.id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportPdf} disabled={isExporting || loading}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        Export PDF
                    </Button>
                    <Button variant="outline" onClick={() => router.push(`${basePath}/${bill.id}?print=true`)}>
                        <Printer className="mr-2 h-4 w-4" /> Print Bill
                    </Button>
                </div>

            </div>

            {/* Workflow Map */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Workflow Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                    <BillWorkflowMap currentStatus={bill.status} history={logs} />
                </CardContent>
            </Card>

            {/* Detailed Bill Correction Inspection & Audit Section */}
            {correctionDetails && correctionDetails.isCorrection && (
                <Card className="border-2 border-orange-200 shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border-b border-orange-200/80 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-orange-100 text-orange-700 border border-orange-200 shadow-sm">
                                    <RotateCcw className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <CardTitle className="text-lg font-bold text-orange-950">
                                            Bill Correction Audit & Inspection
                                        </CardTitle>
                                        <Badge variant="outline" className={cn(
                                            "text-xs font-semibold px-2.5 py-0.5",
                                            correctionDetails.role === 'original'
                                                ? "bg-red-50 text-red-700 border-red-200"
                                                : "bg-orange-50 text-orange-700 border-orange-200"
                                        )}>
                                            {correctionDetails.role === 'original' ? 'Original Bill (Reversed)' : 'Replacement Draft / Bill'}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-orange-800/80 mt-0.5">
                                        Audited amendment record linking finalized posted invoice to replacement bill.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCheckReadingsIntegrity}
                                    disabled={isCheckingIntegrity}
                                    className="h-8 text-xs bg-white border-orange-300 text-orange-900 hover:bg-orange-50 shadow-sm"
                                >
                                    {isCheckingIntegrity ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-orange-700" />}
                                    Verify Dial Integrity
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowCorrectionBreakdown(v => !v)}
                                    className="h-8 text-xs text-orange-800 hover:text-orange-950 hover:bg-orange-100/50"
                                >
                                    {showCorrectionBreakdown ? 'Hide Details' : 'Show Details'}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {/* Bilateral Link & Reason Notice */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200/70 space-y-2">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-800 flex items-center gap-1.5">
                                    <ArrowRightLeft className="h-3.5 w-3.5 text-orange-600" />
                                    Paired Bill Connection
                                </div>
                                {correctionDetails.role === 'replacement' ? (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                        <div>
                                            <p className="text-xs text-gray-600">Reversed Original Bill:</p>
                                            <p className="text-sm font-bold text-gray-900">
                                                {correctionDetails.originalBill?.bill_number || originalBillRef || 'Previous Posted Bill'}
                                            </p>
                                        </div>
                                        {correctionDetails.originalBill?.id && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-xs bg-white border-orange-300 text-orange-900 hover:bg-orange-100 font-semibold shrink-0"
                                                onClick={() => router.push(`${basePath}/${correctionDetails.originalBill.id}`)}
                                            >
                                                <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-orange-700" />
                                                View Reversed Bill
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                        <div>
                                            <p className="text-xs text-gray-600">Replacement Correction Bill:</p>
                                            <p className="text-sm font-bold text-gray-900">
                                                {correctionDetails.replacementBill?.bill_number || 'CORR Draft'}
                                            </p>
                                        </div>
                                        {correctionDetails.replacementBill?.id && (
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white font-semibold shrink-0"
                                                onClick={() => router.push(`${basePath}/${correctionDetails.replacementBill.id}`)}
                                            >
                                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                                View Replacement Bill
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                    <Info className="h-3.5 w-3.5 text-gray-400" />
                                    Reason & Audit Trail
                                </div>
                                <div className="pt-1">
                                    <p className="text-xs text-gray-800 italic font-medium">
                                        &quot;{correctionDetails.reason}&quot;
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-2">
                                        Logged by <span className="font-semibold text-gray-600">{correctionDetails.operator}</span>
                                        {correctionDetails.timestamp && ` • ${format(new Date(correctionDetails.timestamp), 'PPp')}`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Integrity Check Result Banner */}
                        {integrityCheckResult && (
                            <div className={cn(
                                "p-3.5 rounded-xl border text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-300",
                                integrityCheckResult.isMatch
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                    : "bg-red-50 border-red-200 text-red-900"
                            )}>
                                {integrityCheckResult.isMatch ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <span className="font-bold">{integrityCheckResult.isMatch ? 'Meter Reading Verification Passed: ' : 'Meter Reading Alert: '}</span>
                                    <span>{integrityCheckResult.message}</span>
                                </div>
                            </div>
                        )}

                        {/* Side-by-Side Comparison Matrix */}
                        {showCorrectionBreakdown && correctionDetails.readingsDelta && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        <Scale className="h-4 w-4 text-orange-600" />
                                        Side-by-Side Comparative Audit Matrix
                                    </h4>
                                    <span className="text-xs text-gray-400">Values in m³ and ETB</span>
                                </div>

                                <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                                            <tr>
                                                <th className="py-2.5 px-3 text-left font-semibold">Audit Parameter</th>
                                                <th className="py-2.5 px-3 text-right font-semibold">Original Bill ({correctionDetails.originalBill?.bill_number || 'Pre-correction'})</th>
                                                <th className="py-2.5 px-3 text-right font-semibold">Corrected Bill ({correctionDetails.replacementBill?.bill_number || 'Post-correction'})</th>
                                                <th className="py-2.5 px-3 text-right font-semibold">Variance (Δ)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            <tr className="bg-gray-50/40">
                                                <td colSpan={4} className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider text-gray-500">
                                                    Meter Reading Comparison
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 text-gray-700 font-medium">Previous Reading</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-600">{correctionDetails.readingsDelta.prevRead.original.toFixed(2)} m³</td>
                                                <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">{correctionDetails.readingsDelta.prevRead.corrected.toFixed(2)} m³</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-500">{correctionDetails.readingsDelta.prevRead.delta === 0 ? '—' : `${correctionDetails.readingsDelta.prevRead.delta > 0 ? '+' : ''}${correctionDetails.readingsDelta.prevRead.delta.toFixed(2)} m³`}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 text-gray-700 font-medium">Current Reading</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-600">{correctionDetails.readingsDelta.currRead.original.toFixed(2)} m³</td>
                                                <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">{correctionDetails.readingsDelta.currRead.corrected.toFixed(2)} m³</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-500">{correctionDetails.readingsDelta.currRead.delta === 0 ? '—' : `${correctionDetails.readingsDelta.currRead.delta > 0 ? '+' : ''}${correctionDetails.readingsDelta.currRead.delta.toFixed(2)} m³`}</td>
                                            </tr>
                                            <tr className="bg-amber-50/30 font-semibold">
                                                <td className="py-2 px-3 text-amber-950">Billed Usage / Consumption</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-700">{correctionDetails.readingsDelta.usage.original.toFixed(2)} m³</td>
                                                <td className="py-2 px-3 text-right font-mono text-amber-900">{correctionDetails.readingsDelta.usage.corrected.toFixed(2)} m³</td>
                                                <td className={cn(
                                                    "py-2 px-3 text-right font-mono",
                                                    correctionDetails.readingsDelta.usage.delta < 0 ? "text-emerald-600" :
                                                    correctionDetails.readingsDelta.usage.delta > 0 ? "text-red-600" : "text-gray-500"
                                                )}>
                                                    {correctionDetails.readingsDelta.usage.delta === 0 ? '0.00 m³' : `${correctionDetails.readingsDelta.usage.delta > 0 ? '+' : ''}${correctionDetails.readingsDelta.usage.delta.toFixed(2)} m³`}
                                                </td>
                                            </tr>

                                            <tr className="bg-gray-50/40">
                                                <td colSpan={4} className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider text-gray-500">
                                                    Financial Charges Comparison
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 text-gray-700">Base Water Charge</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-600">ETB {correctionDetails.financialsDelta.baseWaterCharge.original.toFixed(2)}</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-900">ETB {correctionDetails.financialsDelta.baseWaterCharge.corrected.toFixed(2)}</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-500">
                                                    {correctionDetails.financialsDelta.baseWaterCharge.delta === 0 ? '—' : `${correctionDetails.financialsDelta.baseWaterCharge.delta > 0 ? '+' : ''}${correctionDetails.financialsDelta.baseWaterCharge.delta.toFixed(2)}`}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 text-gray-700">Sewerage Charge</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-600">ETB {correctionDetails.financialsDelta.sewerageCharge.original.toFixed(2)}</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-900">ETB {correctionDetails.financialsDelta.sewerageCharge.corrected.toFixed(2)}</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-500">
                                                    {correctionDetails.financialsDelta.sewerageCharge.delta === 0 ? '—' : `${correctionDetails.financialsDelta.sewerageCharge.delta > 0 ? '+' : ''}${correctionDetails.financialsDelta.sewerageCharge.delta.toFixed(2)}`}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 text-gray-700">Service / Maintenance / Meter Fees</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-600">
                                                    ETB {(correctionDetails.financialsDelta.meterRent.original + correctionDetails.financialsDelta.maintenanceFee.original + correctionDetails.financialsDelta.sanitationFee.original).toFixed(2)}
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-900">
                                                    ETB {(correctionDetails.financialsDelta.meterRent.corrected + correctionDetails.financialsDelta.maintenanceFee.corrected + correctionDetails.financialsDelta.sanitationFee.corrected).toFixed(2)}
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-500">—</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 text-gray-700">VAT Amount</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-600">ETB {correctionDetails.financialsDelta.vatAmount.original.toFixed(2)}</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-900">ETB {correctionDetails.financialsDelta.vatAmount.corrected.toFixed(2)}</td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-500">
                                                    {correctionDetails.financialsDelta.vatAmount.delta === 0 ? '—' : `${correctionDetails.financialsDelta.vatAmount.delta > 0 ? '+' : ''}${correctionDetails.financialsDelta.vatAmount.delta.toFixed(2)}`}
                                                </td>
                                            </tr>
                                            <tr className="bg-blue-50/40 font-bold">
                                                <td className="py-2.5 px-3 text-blue-950">Current Monthly Bill Amount</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-blue-900">ETB {correctionDetails.financialsDelta.thisMonthBillAmt.original.toFixed(2)}</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-blue-900">ETB {correctionDetails.financialsDelta.thisMonthBillAmt.corrected.toFixed(2)}</td>
                                                <td className={cn(
                                                    "py-2.5 px-3 text-right font-mono",
                                                    correctionDetails.financialsDelta.thisMonthBillAmt.delta < 0 ? "text-emerald-700" :
                                                    correctionDetails.financialsDelta.thisMonthBillAmt.delta > 0 ? "text-amber-700" : "text-gray-500"
                                                )}>
                                                    {correctionDetails.financialsDelta.thisMonthBillAmt.delta === 0 ? 'ETB 0.00' : `${correctionDetails.financialsDelta.thisMonthBillAmt.delta > 0 ? '+' : ''}ETB ${correctionDetails.financialsDelta.thisMonthBillAmt.delta.toFixed(2)}`}
                                                </td>
                                            </tr>
                                            <tr className="font-bold border-t border-gray-200 bg-gray-50/60">
                                                <td className="py-2.5 px-3 text-gray-950">Total Payable (with Outstanding)</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-gray-700">ETB {correctionDetails.financialsDelta.totalBillAmount.original.toFixed(2)}</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-gray-900">ETB {correctionDetails.financialsDelta.totalBillAmount.corrected.toFixed(2)}</td>
                                                <td className={cn(
                                                    "py-2.5 px-3 text-right font-mono",
                                                    correctionDetails.financialsDelta.totalBillAmount.delta < 0 ? "text-emerald-700" :
                                                    correctionDetails.financialsDelta.totalBillAmount.delta > 0 ? "text-red-700" : "text-gray-500"
                                                )}>
                                                    {correctionDetails.financialsDelta.totalBillAmount.delta === 0 ? 'ETB 0.00' : `${correctionDetails.financialsDelta.totalBillAmount.delta > 0 ? '+' : ''}ETB ${correctionDetails.financialsDelta.totalBillAmount.delta.toFixed(2)}`}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Financial Impact Banner */}
                                {correctionDetails.financialImpact && (
                                    <div className={cn(
                                        "p-4 rounded-xl border flex items-start gap-3",
                                        correctionDetails.financialImpact.impactType === 'credit'
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                                            : correctionDetails.financialImpact.impactType === 'debit'
                                                ? "bg-amber-50 border-amber-200 text-amber-950"
                                                : "bg-blue-50 border-blue-200 text-blue-950"
                                    )}>
                                        <div className={cn(
                                            "p-2 rounded-lg text-white shrink-0 mt-0.5",
                                            correctionDetails.financialImpact.impactType === 'credit' ? "bg-emerald-600" :
                                            correctionDetails.financialImpact.impactType === 'debit' ? "bg-amber-600" : "bg-blue-600"
                                        )}>
                                            {correctionDetails.financialImpact.impactType === 'credit' ? (
                                                <TrendingDown className="h-4 w-4" />
                                            ) : (
                                                <TrendingUp className="h-4 w-4" />
                                            )}
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-sm">
                                                Financial Impact: {correctionDetails.financialImpact.summary}
                                            </h5>
                                            <p className="text-xs opacity-90 mt-0.5">
                                                {correctionDetails.financialImpact.impactType === 'credit'
                                                    ? 'The original invoice was overbilled. The customer balance has been automatically credited and reconciled in aging calculation.'
                                                    : correctionDetails.financialImpact.impactType === 'debit'
                                                        ? 'The corrected readings produce a higher charge. The customer will be billed for the difference upon posting.'
                                                        : 'Meter readings were corrected without altering the total charge.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Action Required Banner for Correction Draft in Edit Mode */}
            {isCorrectionDraft && canEdit && isEditing && (
                <div className="flex items-start gap-4 rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-5 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 ring-2 ring-orange-200">
                        <RotateCcw className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-orange-900 text-base">Correction Draft — Readings Edit Mode</h3>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                                Unpaid
                            </span>
                        </div>
                        <p className="mt-1.5 text-sm text-orange-700 leading-relaxed">
                            Adjust the meter readings below and click{' '}
                            <strong className="font-semibold">&quot;Save &amp; Rebill&quot;</strong>{' '}
                            to recalculate with the corrected values and mark this bill as{' '}
                            <span className="font-semibold">Unpaid</span>.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Main Bill Information */}
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center bg-gray-50/50">
                            <CardTitle className="text-lg">Billing Details</CardTitle>
                            {/* Phase 6: Hide manual Edit button for correction drafts (auto-opened) */}
                            {canEdit && !isEditing && !isCorrectionDraft && (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    <Edit2 className="mr-2 h-3 w-3" /> Edit Readings
                                </Button>
                            )}
                            {/* Correction draft badge in card header */}
                            {isCorrectionDraft && isEditing && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                                    <RotateCcw className="h-3 w-3" /> Correction Mode
                                </span>
                            )}
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <DetailItem label="Customer Key / Meter" value={bill.CUSTOMERKEY || bill.individual_customer_id} />
                                <DetailItem label="Status" value={
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        bill.status === 'Posted' ? 'bg-green-100 text-green-800' :
                                        bill.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                                        bill.status === 'Reversed' ? 'bg-red-100 text-red-800 border border-red-200 font-semibold' :
                                        bill.status === 'Rework' ? 'bg-orange-100 text-orange-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                        {bill.status}
                                    </span>
                                } />

                                {isEditing ? (
                                    <div className="col-span-2 bg-amber-50 p-4 rounded-lg border border-amber-100 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <h4 className="font-semibold text-amber-900 flex items-center gap-2">
                                                <Edit2 className="h-4 w-4" /> Edit Readings & Recalculate
                                            </h4>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={handleFetchExactPeriodReadings}
                                                disabled={isFetchingPeriodReadings}
                                                className="h-8 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100 shadow-sm"
                                                title={`Fetch exact meter readings recorded for period ${bill.month_year}`}
                                            >
                                                {isFetchingPeriodReadings ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-amber-700" />}
                                                Get Exact Period Readings ({bill.month_year})
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-600">Previous Reading</label>
                                                <Input type="number" value={editValues.previous} onChange={(e) => handleEditChange('previous', e.target.value)} className="h-9" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-600">Current Reading</label>
                                                <Input type="number" value={editValues.current} onChange={(e) => handleEditChange('current', e.target.value)} className="h-9" />
                                            </div>
                                        </div>

                                        {/* Sub-meter readings table for bulk bills */}
                                        {bill.CUSTOMERKEY && (
                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-2">
                                                        Assigned Individual Customer Readings
                                                        {isLoadingAssigned && <span className="text-amber-600 font-normal normal-case">(loading…)</span>}
                                                    </h5>
                                                    <label className="cursor-pointer">
                                                        <input type="file" accept=".csv,.txt" onChange={handleFileUploadAssignedReadings} className="hidden" />
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 transition-colors shadow-sm">
                                                            <Upload className="h-3.5 w-3.5 text-amber-700" /> Upload CSV
                                                        </span>
                                                    </label>
                                                </div>
                                                {!isLoadingAssigned && assignedReadings.length === 0 && (
                                                    <p className="text-xs text-amber-700 italic">No assigned individual customers found for this bulk meter.</p>
                                                )}
                                                {assignedReadings.length > 0 && (
                                                    <div className="rounded border border-amber-200 overflow-hidden text-xs">
                                                        <table className="w-full">
                                                            <thead className="bg-amber-100 text-amber-900">
                                                                <tr>
                                                                    <th className="px-2 py-1.5 text-left font-semibold">Customer</th>
                                                                    <th className="px-2 py-1.5 text-right font-semibold">Prev. Reading</th>
                                                                    <th className="px-2 py-1.5 text-right font-semibold">Curr. Reading</th>
                                                                    <th className="px-2 py-1.5 text-right font-semibold">Usage (m³)</th>
                                                                    <th className="px-2 py-1.5 text-center font-semibold">Bill Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-amber-100">
                                                                {assignedReadings.map((row) => {
                                                                    const edits = assignedReadingEdits[row.customerKeyNumber] ?? { previous: row.previous, current: row.current };
                                                                    const usage = edits.current - edits.previous;
                                                                    return (
                                                                        <tr key={row.customerKeyNumber} className="hover:bg-amber-50">
                                                                            <td className="px-2 py-1.5">
                                                                                <div className="font-medium text-gray-800 flex items-center gap-1">
                                                                                    {row.name}
                                                                                    {row.hasExactRecord && (
                                                                                        <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded" title="Exact reading recorded for this period">
                                                                                            Exact
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-gray-400 text-[10px]">{row.customerKeyNumber}</div>
                                                                            </td>
                                                                            <td className="px-2 py-1.5 text-right">
                                                                                <input
                                                                                    type="number"
                                                                                    value={edits.previous}
                                                                                    onChange={(e) => handleAssignedReadingChange(row.customerKeyNumber, 'previous', e.target.value)}
                                                                                    className="w-20 border border-amber-300 rounded px-1 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-1.5 text-right">
                                                                                <input
                                                                                    type="number"
                                                                                    value={edits.current}
                                                                                    onChange={(e) => handleAssignedReadingChange(row.customerKeyNumber, 'current', e.target.value)}
                                                                                    className="w-20 border border-amber-300 rounded px-1 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                                                                                />
                                                                            </td>
                                                                            <td className={`px-2 py-1.5 text-right font-mono font-semibold ${usage < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                                                                {usage.toFixed(2)}
                                                                            </td>
                                                                            <td className="px-2 py-1.5 text-center">
                                                                                {row.billStatus ? (
                                                                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                                                                        row.billStatus === 'Posted' ? 'bg-green-100 text-green-700' :
                                                                                        row.billStatus === 'Draft' ? 'bg-gray-100 text-gray-600' :
                                                                                        row.billStatus === 'Approved' ? 'bg-blue-100 text-blue-700' :
                                                                                        'bg-orange-100 text-orange-700'
                                                                                    }`}>{row.billStatus}</span>
                                                                                ) : (
                                                                                    <span className="text-gray-400 text-[10px] italic">No bill</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                            <tfoot className="bg-amber-50 border-t border-amber-200">
                                                                <tr>
                                                                    <td colSpan={3} className="px-2 py-1.5 text-right text-amber-800 font-semibold">Total Sub-meter Usage:</td>
                                                                    <td className="px-2 py-1.5 text-right font-mono font-bold text-amber-900">
                                                                        {Object.values(assignedReadingEdits).reduce((sum, r) => sum + (r.current - r.previous), 0).toFixed(2)} m³
                                                                    </td>
                                                                    <td className="px-2 py-1.5 text-left text-[10px] text-amber-700 italic">
                                                                        Bulk diff = {(editValues.current - editValues.previous - Object.values(assignedReadingEdits).reduce((s, r) => s + (r.current - r.previous), 0)).toFixed(2)} m³
                                                                    </td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {calculatedPreview && (
                                            <div className="bg-white p-3 rounded border border-amber-200 text-sm">
                                                <div className="flex justify-between border-b pb-1 mb-1">
                                                    <span>Consumption:</span>
                                                    <span className="font-bold">{Number(calculatedPreview.usage).toFixed(2)} m³</span>
                                                </div>
                                                <div className="flex justify-between text-blue-700">
                                                    <span>New Amount:</span>
                                                    <span className="font-bold font-mono">ETB {Number(calculatedPreview.amount).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center pt-2">
                                            <div>
                                                {bill.CUSTOMERKEY && assignedReadings.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleDownloadTemplate}
                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded border border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors shadow-sm"
                                                    >
                                                        <FileDown className="h-4 w-4 text-emerald-600" /> Download Template
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setCalculatedPreview(null); setAssignedReadings([]); setAssignedReadingEdits({}); }}>
                                                    <X className="mr-2 h-4 w-4" /> Cancel
                                                </Button>
                                                <Button size="sm" variant="secondary" onClick={handleRecalculate} disabled={isCalculating}>
                                                    {isCalculating ? "Calculating..." : "Check Preview"}
                                                </Button>
                                                {/* Phase 7: Amber 'Save & Rebill' for correction drafts */}
                                                <Button
                                                    size="sm"
                                                    onClick={handleSave}
                                                    disabled={loading}
                                                    className={isCorrectionDraft
                                                        ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500 shadow-sm"
                                                        : ""}
                                                    title={isCorrectionDraft
                                                        ? "Saves corrected readings, recalculates the bill amount, and marks status as Unpaid."
                                                        : "Save reading changes"}
                                                >
                                                    <Save className="mr-2 h-4 w-4" />
                                                    {isCorrectionDraft ? "Save & Rebill" : "Save Changes"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {(() => {
                                            const d30 = reconstructedAging ? reconstructedAging.d30 : Number(bill.debit30 || bill.debit_30 || 0);
                                            const d30_60 = reconstructedAging ? reconstructedAging.d30_60 : Number(bill.debit30_60 || bill.debit_30_60 || 0);
                                            const d60 = reconstructedAging ? reconstructedAging.d60 : Number(bill.debit60 || bill.debit_60 || 0);
                                            const outstanding = reconstructedAging && reconstructedAging.outstanding !== undefined
                                                ? reconstructedAging.outstanding
                                                : (bill.OUTSTANDINGAMT !== undefined && bill.OUTSTANDINGAMT !== null && bill.OUTSTANDINGAMT !== 0)
                                                    ? Number(bill.OUTSTANDINGAMT)
                                                    : (d30 + d30_60 + d60);
                                            const penalty = reconstructedAging && reconstructedAging.penalty !== undefined ? reconstructedAging.penalty : Number(bill.PENALTYAMT || 0);
                                            const current = getMonthlyBillAmt(bill);
                                            const total = reconstructedAging && reconstructedAging.totalPayable !== undefined ? reconstructedAging.totalPayable : outstanding + current + penalty;

                                            return (
                                                <>
                                                    <DetailItem label="Previous Reading" value={`${bill.PREVREAD} m³`} />
                                                    <DetailItem label="Current Reading" value={`${bill.CURRREAD} m³`} />
                                                    <DetailItem label="Billed Usage" value={`${bill.CONS} m³`} bold />
                                                    <DetailItem label="Current Bill" value={`ETB ${Math.max(0, current).toFixed(2)}`} bold color="text-blue-700" />
                                                    <DetailItem label="Outstanding Balance" value={
                                                        <div className="space-y-1">
                                                            <div>ETB {outstanding.toFixed(2)}</div>
                                                            {(reconstructedAging || d30 > 0 || d30_60 > 0 || d60 > 0) && (
                                                                <div className="text-[10px] text-gray-500 font-normal">
                                                                    <div>30 days: ETB {(reconstructedAging?.d30 ?? d30).toFixed(2)}</div>
                                                                    <div>60 days: ETB {(reconstructedAging?.d30_60 ?? d30_60).toFixed(2)}</div>
                                                                    <div>&gt;60 days: ETB {(reconstructedAging?.d60 ?? d60).toFixed(2)}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    } />
                                                    <DetailItem label="Penalty (ETB)" value={`ETB ${penalty.toFixed(2)}`} color="text-red-600" />
                                                    <DetailItem label="Total Payable" value={`ETB ${total.toFixed(2)}`} bold color="text-red-700" size="text-base" />
                                                </>
                                            );
                                        })()}
                                    </>
                                )}

                                <DetailItem label="Bill Period" value={bill.month_year} />
                                <DetailItem label="Date Billed" value={format(new Date(bill.created_at), 'PPP')} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activity History / Amendment Trail */}
                    <Card className="shadow-sm border-gray-100">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Amendment Trail & History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="relative pl-8 border-l-2 border-gray-100 space-y-8 pb-4">
                                {logs.map((log) => {
                                    const isRework = log.to_status === 'Rework' || log.to_status === 'Rejected';
                                    const isPosted = log.to_status === 'Posted';
                                    const isApproved = log.to_status === 'Approved';
                                    const isCorrection = log.reason?.toLowerCase().includes('correction') || log.from_status === 'Posted';

                                    return (
                                        <div key={log.id} className="relative group">
                                            <div className={cn(
                                                "absolute -left-[41px] top-0 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm transition-transform group-hover:scale-110",
                                                isRework ? "bg-red-500" :
                                                    isPosted ? "bg-green-600" :
                                                        isApproved ? "bg-blue-600" :
                                                            isCorrection ? "bg-orange-500" : "bg-gray-400"
                                            )}>
                                                {isRework ? <AlertCircle className="h-3 w-3 text-white" /> :
                                                    isPosted ? <CheckCircle2 className="h-3 w-3 text-white" /> :
                                                        isApproved ? <CheckCircle2 className="h-3 w-3 text-white" /> :
                                                            isCorrection ? <RotateCcw className="h-3 w-3 text-white" /> :
                                                                <Clock className="h-3 w-3 text-white" />}
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-start mb-1">
                                                    <div>
                                                        <span className="font-bold text-sm text-gray-900">{log.from_status}</span>
                                                        <span className="text-gray-400 mx-2">&rarr;</span>
                                                        <span className={cn(
                                                            "font-bold text-sm",
                                                            isRework ? "text-red-600" :
                                                                isPosted ? "text-green-600" :
                                                                    isApproved ? "text-blue-600" :
                                                                        isCorrection ? "text-orange-600" : "text-gray-900"
                                                        )}>{log.to_status}</span>
                                                    </div>
                                                    <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                        {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                                                    </span>
                                                </div>
                                                {log.reason && (
                                                    <div className={cn(
                                                        "text-sm p-3 rounded-md mt-2 border",
                                                        isRework ? "bg-red-50 border-red-100 text-red-800" :
                                                            isCorrection ? "bg-orange-50 border-orange-100 text-orange-800" :
                                                                "bg-gray-50 border-gray-100 text-gray-700"
                                                    )}>
                                                        <p className="italic font-medium leading-relaxed">&quot;{log.reason}&quot;</p>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mt-2">
                                                    <div className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 border border-gray-200 uppercase">
                                                        {log.changed_by?.substring(0, 1) || 'U'}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                        Modified by {log.changed_by || 'System'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {logs.length === 0 && (
                                    <div className="text-center py-6 text-gray-400 italic text-sm">
                                        No amendment history recorded for this bill.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Actions */}
                <div className="space-y-6">
                    <Card className="border-blue-100 shadow-sm">
                        <CardHeader className="bg-blue-50/30">
                            <CardTitle className="text-lg">Action Center</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="flex flex-col gap-3">
                                {(bill.status === 'Draft' || bill.status === 'Rework') && checkBillPermission('bill:submit', 'bill:create') && (
                                    <Button onClick={() => handleAction('submit')} className="w-full" size="lg" disabled={loading || isEditing}>
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> Submit for Approval
                                    </Button>
                                )}

                                {(bill.status === 'Draft' || bill.status === 'Rework') && !checkBillPermission('bill:submit', 'bill:create') && (
                                    <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                                        You do not have permission to submit this bill.
                                    </div>
                                )}

                                {bill.status === 'Pending' && checkBillPermission('bill:approve') && (
                                    <>
                                        <Button onClick={() => handleAction('approve')} className="w-full bg-green-600 hover:bg-green-700" size="lg" disabled={loading}>
                                            Approve Invoice
                                        </Button>
                                        {checkBillPermission('bill:rework') && (
                                            <Button onClick={() => handleAction('reject')} variant="destructive" className="w-full" disabled={loading}>
                                                Reject & Request Rework
                                            </Button>
                                        )}
                                    </>
                                )}

                                {bill.status === 'Approved' && checkBillPermission('bill:send', 'bill:post') && (
                                    <Button onClick={() => handleAction('post')} className="w-full bg-blue-700 hover:bg-blue-800" size="lg" disabled={loading}>
                                        Post & Finalize Bill
                                    </Button>
                                )}

                                {bill.status === 'Posted' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg border border-green-200 text-sm font-medium">
                                            <CheckCircle2 className="h-5 w-5" />
                                            Bill is Finalized (Posted)
                                        </div>
                                        {checkBillPermission('bill:correct') && (
                                            <Button variant="secondary" className="w-full bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" onClick={() => handleAction('correct')}>
                                                <RotateCcw className="mr-2 h-4 w-4" /> Correct Bill
                                            </Button>
                                        )}
                                        {/* Manage Assigned Individual Customers — only for bulk meter bills */}
                                        {bill.CUSTOMERKEY && (
                                            <Button
                                                variant="outline"
                                                className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                                                onClick={() => {
                                                    setManageReasonText('');
                                                    setManageReasonOpen(true);
                                                }}
                                            >
                                                <Users className="mr-2 h-4 w-4" /> Manage Assigned Customers
                                            </Button>
                                        )}
                                        <Button variant="outline" className="w-full" onClick={() => router.push(`/staff/bill-management/${bill.id}?print=true`)}>
                                            <Printer className="mr-2 h-4 w-4" /> Print Copy
                                        </Button>
                                    </div>
                                )}

                                {bill.status === 'Reversed' && (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-2 text-red-700 bg-red-50 p-3.5 rounded-lg border border-red-200 text-xs font-medium">
                                            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-bold text-sm text-red-800">Bill Reversed (Voided)</div>
                                                <div className="text-red-700 mt-1 leading-relaxed">
                                                    This bill was reversed during a formal bill correction. Aging balances have been adjusted and this invoice is superseded.
                                                </div>
                                            </div>
                                        </div>
                                        {correctionDetails?.replacementBill?.id && (
                                            <Button
                                                variant="default"
                                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm"
                                                onClick={() => router.push(`${basePath}/${correctionDetails.replacementBill.id}`)}
                                            >
                                                <RotateCcw className="mr-2 h-4 w-4" /> Go to Replacement Bill ({correctionDetails.replacementBill.bill_number || 'CORR'})
                                            </Button>
                                        )}
                                        <Button variant="outline" className="w-full" onClick={() => router.push(`${basePath}/${bill.id}?print=true`)}>
                                            <Printer className="mr-2 h-4 w-4" /> Print Voided Copy
                                        </Button>
                                    </div>
                                )}

                                {bill.status === 'Pending' && !checkBillPermission('bill:approve') && (
                                    <div className="text-center p-4 bg-gray-50 border rounded-lg italic text-gray-500 text-sm">
                                        Awaiting manager review...
                                    </div>
                                )}

                                {bill.status === 'Approved' && !checkBillPermission('bill:send', 'bill:post') && (
                                    <div className="text-center p-4 bg-gray-50 border rounded-lg italic text-gray-500 text-sm">
                                        Bill approved. Awaiting posting by authorized staff...
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Reject / Correct Reason Dialog */}
            <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>
                            {rejectDialog.action === 'reject' ? 'Reject & Request Rework' : 'Correct Bill'}
                        </DialogTitle>
                        <DialogDescription>
                            {rejectDialog.action === 'reject'
                                ? 'Provide a reason so the staff member knows what to fix.'
                                : 'Provide a reason for the correction. This will be logged in the amendment trail.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Textarea
                            placeholder="Enter reason..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="min-h-[100px]"
                            autoFocus
                        />
                        {rejectReason.trim().length === 0 && (
                            <p className="text-xs text-red-500 mt-1">Reason is required.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
                        <Button
                            variant={rejectDialog.action === 'reject' ? 'destructive' : 'default'}
                            onClick={handleRejectConfirm}
                            disabled={!rejectReason.trim()}
                        >
                            {rejectDialog.action === 'reject' ? 'Reject & Return' : 'Confirm Correction'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manage Assigned Customers Reason Dialog */}
            <Dialog open={manageReasonOpen} onOpenChange={setManageReasonOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            Reason Required
                        </DialogTitle>
                        <DialogDescription>
                            Please provide a reason for managing the assigned customers of bulk meter{' '}
                            <span className="font-semibold text-gray-800">{bill?.CUSTOMERKEY}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Textarea
                            placeholder="Enter reason (required)..."
                            value={manageReasonText}
                            onChange={(e) => setManageReasonText(e.target.value)}
                            className="min-h-[100px]"
                            autoFocus
                        />
                        {manageReasonText.trim().length === 0 && (
                            <p className="text-xs text-red-500 mt-1">Reason is required.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setManageReasonOpen(false)}>Cancel</Button>
                        <Button
                            disabled={!manageReasonText.trim()}
                            onClick={async () => {
                                setManageReasonOpen(false);
                                setManageCustomersOpen(true);
                                setIsLoadingCustomers(true);
                                setCustomerSearch('');
                                try {
                                    // Log the management event with reason to audit logs
                                    await logSecurityEventAction({
                                        event: 'Manage Bulk Customer Assignments Started',
                                        customerKeyNumber: bill?.CUSTOMERKEY || undefined,
                                        details: { reason: manageReasonText }
                                    });

                                    setAssignedPage(1);
                                    setUnassignedPage(1);
                                    await Promise.all([
                                        fetchAssignedPage(1, assignedRowsPerPage),
                                        fetchUnassignedPage(1, '', unassignedRowsPerPage),
                                    ]);
                                } catch (e) {
                                    toast({ title: 'Error', description: 'Failed to load customers.', variant: 'destructive' });
                                } finally {
                                    setIsLoadingCustomers(false);
                                }
                            }}
                        >
                            Proceed
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manage Assigned Individual Customers Dialog */}
            <Dialog open={manageCustomersOpen} onOpenChange={setManageCustomersOpen}>
                <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            Manage Assigned Customers
                        </DialogTitle>
                        <DialogDescription>
                            Add or remove individual customers assigned to bulk meter{' '}
                            <span className="font-semibold text-gray-800">{bill?.CUSTOMERKEY}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    {isLoadingCustomers ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            <span className="ml-2 text-sm text-gray-500">Loading customers...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 overflow-hidden flex-1">

                            {/* ── Currently Assigned ── */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-700">Currently Assigned</p>
                                        <Badge variant="secondary">{assignedTotal}</Badge>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-[11px] px-2 text-blue-700 border-blue-200 hover:bg-blue-50/50"
                                            onClick={handleDownloadAssignmentTemplate}
                                        >
                                            <FileDown className="h-3.5 w-3.5 mr-1 text-blue-600" /> Template
                                        </Button>
                                        <label className="cursor-pointer">
                                            <input type="file" accept=".csv" onChange={handleUploadAssignmentCsv} className="hidden" />
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold h-7 px-2 rounded border border-blue-300 bg-white text-blue-900 hover:bg-blue-50 transition-colors shadow-sm cursor-pointer">
                                                <Upload className="h-3.5 w-3.5 text-blue-700" /> Upload CSV
                                            </span>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <ScrollArea className="h-44 rounded-md border bg-gray-50/30 overflow-auto">
                                        <div className="w-full">
                                            <table className="w-full text-xs">
                                                <thead className="bg-gray-100/80 text-gray-700 sticky top-0 border-b z-10">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-semibold">Customer Key</th>
                                                        <th className="px-3 py-2 text-left font-semibold">Name</th>
                                                        <th className="px-3 py-2 text-center font-semibold">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {isLoadingCustomers ? (
                                                        <tr>
                                                            <td colSpan={3} className="text-center py-8">
                                                                <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                                                            </td>
                                                        </tr>
                                                    ) : assignedCustomers.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={3} className="text-center text-sm text-gray-400 py-8 italic">
                                                                No customers assigned yet.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        assignedCustomers.map((c) => (
                                                            <tr key={c.customerKeyNumber} className="hover:bg-gray-50/50 transition-colors">
                                                                <td className="px-3 py-2 font-mono text-gray-500">{c.customerKeyNumber}</td>
                                                                <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[200px]">{c.name}</td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                                                                        disabled={customerActionLoading === c.customerKeyNumber}
                                                                        onClick={async () => {
                                                                            setCustomerActionLoading(c.customerKeyNumber);
                                                                            try {
                                                                                const res = await unassignCustomerFromBulkMeterAction(c.customerKeyNumber);
                                                                                if (res.success) {
                                                                                    if (bill?.CUSTOMERKEY) {
                                                                                        await recalculateBulkBillAction(bill.CUSTOMERKEY, bill.month_year);
                                                                                    }
                                                                                    toast({ title: 'Removed', description: `${c.name} unassigned from this meter.` });
                                                                                    await Promise.all([
                                                                                        fetchAssignedPage(assignedPage),
                                                                                        fetchUnassignedPage(unassignedPage, customerSearch),
                                                                                    ]);
                                                                                    await loadData();
                                                                                } else {
                                                                                    toast({ title: 'Error', description: res.error || 'Failed to remove.', variant: 'destructive' });
                                                                                }
                                                                            } catch {
                                                                                toast({ title: 'Error', description: 'Unexpected error.', variant: 'destructive' });
                                                                            } finally {
                                                                                setCustomerActionLoading(null);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {customerActionLoading === c.customerKeyNumber
                                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            : <UserMinus className="h-3.5 w-3.5" />
                                                                        }
                                                                        <span className="ml-1 text-[11px]">Remove</span>
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </ScrollArea>
                                    {assignedTotal > 0 && (
                                        <TablePagination
                                            count={assignedTotal}
                                            page={assignedPage - 1}
                                            rowsPerPage={assignedRowsPerPage}
                                            rowsPerPageOptions={[5, 10, 25, 50]}
                                            onPageChange={(newPage) => fetchAssignedPage(newPage + 1, assignedRowsPerPage)}
                                            onRowsPerPageChange={(newLimit) => {
                                                setAssignedRowsPerPage(newLimit);
                                                fetchAssignedPage(1, newLimit);
                                            }}
                                            className="p-1 text-xs justify-between border-t-0 mt-1 space-x-2"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* ── Add Unassigned Customers ── */}
                            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
                                <p className="text-sm font-semibold text-gray-700">Add Customer</p>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search by name or key..."
                                        value={customerSearch}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setCustomerSearch(value);
                                            // Debounce server fetch by 300ms
                                            const timer = setTimeout(() => {
                                                fetchUnassignedPage(1, value);
                                            }, 300);
                                            return () => clearTimeout(timer);
                                        }}
                                        className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <ScrollArea className="flex-1 min-h-[140px] max-h-48 rounded-md border bg-gray-50/30 overflow-auto">
                                        <div className="w-full">
                                            <table className="w-full text-xs">
                                                <thead className="bg-gray-100/80 text-gray-700 sticky top-0 border-b z-10">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-semibold">Customer Key</th>
                                                        <th className="px-3 py-2 text-left font-semibold">Name</th>
                                                        <th className="px-3 py-2 text-center font-semibold">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {isLoadingUnassigned ? (
                                                        <tr>
                                                            <td colSpan={3} className="text-center py-8">
                                                                <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                                                            </td>
                                                        </tr>
                                                    ) : unassignedCustomers.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={3} className="text-center text-sm text-gray-400 py-8 italic">
                                                                No unassigned customers found.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        unassignedCustomers.map((c) => (
                                                            <tr key={c.customerKeyNumber} className="hover:bg-gray-50/50 transition-colors">
                                                                <td className="px-3 py-2 font-mono text-gray-500">{c.customerKeyNumber}</td>
                                                                <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[200px]">{c.name}</td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="text-green-600 hover:text-green-800 hover:bg-green-50 h-7 px-2"
                                                                        disabled={customerActionLoading === c.customerKeyNumber}
                                                                        onClick={async () => {
                                                                            if (!bill?.CUSTOMERKEY) return;
                                                                            setCustomerActionLoading(c.customerKeyNumber);
                                                                            try {
                                                                                const res = await assignCustomerToBulkMeterAction(c.customerKeyNumber, bill.CUSTOMERKEY);
                                                                                if (res.success) {
                                                                                    await recalculateBulkBillAction(bill.CUSTOMERKEY, bill.month_year);
                                                                                    toast({ title: 'Assigned', description: `${c.name} assigned to this meter.` });
                                                                                    await Promise.all([
                                                                                        fetchAssignedPage(assignedPage),
                                                                                        fetchUnassignedPage(unassignedPage, customerSearch),
                                                                                    ]);
                                                                                    await loadData();
                                                                                } else {
                                                                                    toast({ title: 'Error', description: res.error || 'Failed to assign.', variant: 'destructive' });
                                                                                }
                                                                            } catch {
                                                                                toast({ title: 'Error', description: 'Unexpected error.', variant: 'destructive' });
                                                                            } finally {
                                                                                setCustomerActionLoading(null);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {customerActionLoading === c.customerKeyNumber
                                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            : <UserPlus className="h-3.5 w-3.5" />
                                                                        }
                                                                        <span className="ml-1 text-[11px]">Add</span>
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </ScrollArea>
                                    {unassignedTotal > 0 && (
                                        <TablePagination
                                            count={unassignedTotal}
                                            page={unassignedPage - 1}
                                            rowsPerPage={unassignedRowsPerPage}
                                            rowsPerPageOptions={[5, 10, 25, 50]}
                                            onPageChange={(newPage) => fetchUnassignedPage(newPage + 1, customerSearch, unassignedRowsPerPage)}
                                            onRowsPerPageChange={(newLimit) => {
                                                setUnassignedRowsPerPage(newLimit);
                                                fetchUnassignedPage(1, customerSearch, newLimit);
                                            }}
                                            className="p-1 text-xs justify-between border-t-0 mt-1 space-x-2"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-2">
                        <Button variant="outline" onClick={() => setManageCustomersOpen(false)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DetailItem({ label, value, bold = false, color = "text-gray-900", size = "text-sm" }: { label: string, value: any, bold?: boolean, color?: string, size?: string }) {
    return (
        <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-tight">{label}</span>
            <div className={`${size} ${bold ? 'font-bold' : ''} ${color}`}>{value}</div>
        </div>
    );
}

export default function BillDetailsPage() {
    return <BillDetailsContent basePath="/staff/bill-management" />;
}