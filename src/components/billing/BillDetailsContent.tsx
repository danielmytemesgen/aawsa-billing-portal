
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BillWorkflowMap } from '@/components/maps/BillWorkflowMap';
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
    getBillsByCustomerKeyAction
} from '@/lib/actions';
import { generateSingleBillPdfAction } from '@/lib/pdf-actions';
import { initializeTariffs, getTariff } from '@/lib/data-store';

import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Printer, ArrowLeft, Loader2, Save, X, Edit2, CheckCircle2, RotateCcw, Clock, AlertCircle, FileDown } from 'lucide-react';

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
                        <table className="print-table">
                            <tbody>
                                <tr><td>Category:</td><td>{relatedData?.chargeGroup || relatedData?.customerType || 'Domestic'}</td></tr>
                                <tr><td>Sewerage Connection:</td><td>{relatedData?.sewerageConnection || 'No'}</td></tr>
                                <tr><td>Previous and current reading:</td><td>{Number(bill.PREVREAD).toFixed(2)} / {Number(bill.CURRREAD).toFixed(2)} m³</td></tr>
                                <tr><td>Consumption usage:</td><td>{Number(bill.CONS).toFixed(2)} m³</td></tr>
                            </tbody>
                        </table>
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
                                {Number(bill.difference_usage || 0) > 0 && (
                                    <tr><td className="font-semibold italic">Difference usage:</td><td>{Number(bill.difference_usage || 0).toFixed(2)} m³</td></tr>
                                )}
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

    // Reject / Correct reason dialog state
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; action: 'reject' | 'correct' }>({ open: false, action: 'reject' });
    const [rejectReason, setRejectReason] = useState('');

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
                    }
                }

                await initializeTariffs(true);

                const logsRes = await getBillWorkflowLogsAction(id);
                if (logsRes.data) setLogs(logsRes.data);

                // Reconstruct Aging using tariff-aware FIFO from oldest to newest
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

    const handleEditChange = (field: 'current' | 'previous', value: string) => {
        setEditValues(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handleRecalculate = async () => {
        if (!relatedData) return;
        setIsCalculating(true);
        try {
            const usage = editValues.current - editValues.previous;
            const typeParam = relatedData.type === 'bulk' ? relatedData.charge_group : relatedData.customerType;
            const sizeParam = relatedData.meterSize;
            const sewerage = relatedData.sewerageConnection || relatedData.sewerage_connection;
            const month = bill?.month_year || '2025-01';

            const calcRes = await calculateBillAction(
                Math.max(0, usage),
                typeParam,
                sewerage,
                sizeParam,
                month
            );

            if (calcRes.data) {
                setCalculatedPreview({ usage: calcRes.data.effectiveUsage, amount: calcRes.data.totalBill });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsCalculating(false);
        }
    };

    const handleSave = async () => {
        if (!bill || !relatedData) return;
        setLoading(true);
        try {
            const usage = editValues.current - editValues.previous;
            const typeParam = relatedData.type === 'bulk' ? relatedData.charge_group : relatedData.customerType;
            const sizeParam = relatedData.meterSize;
            const sewerage = relatedData.sewerageConnection || relatedData.sewerage_connection;
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
                });
                await loadData();
                setIsEditing(false);
                setCalculatedPreview(null);
            }
        } catch (error) {
            console.error(error);
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

    const canEdit = (bill.status === 'Draft' || bill.status === 'Rework') && checkBillPermission('bill:create', 'bill:update');

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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Main Bill Information */}
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center bg-gray-50/50">
                            <CardTitle className="text-lg">Billing Details</CardTitle>
                            {canEdit && !isEditing && (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    <Edit2 className="mr-2 h-3 w-3" /> Edit Readings
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <DetailItem label="Customer Key / Meter" value={bill.CUSTOMERKEY || bill.individual_customer_id} />
                                <DetailItem label="Status" value={
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bill.status === 'Posted' ? 'bg-green-100 text-green-800' :
                                        bill.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                        {bill.status}
                                    </span>
                                } />

                                {isEditing ? (
                                    <div className="col-span-2 bg-amber-50 p-4 rounded-lg border border-amber-100 space-y-4">
                                        <h4 className="font-semibold text-amber-900 flex items-center gap-2">
                                            <Edit2 className="h-4 w-4" /> Edit Readings & Recalculate
                                        </h4>
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
                                        <div className="flex gap-2 justify-end pt-2">
                                            <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setCalculatedPreview(null); }}>
                                                <X className="mr-2 h-4 w-4" /> Cancel
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={handleRecalculate} disabled={isCalculating}>
                                                {isCalculating ? "Calculating..." : "Check Preview"}
                                            </Button>
                                            <Button size="sm" onClick={handleSave} disabled={loading}>
                                                <Save className="mr-2 h-4 w-4" /> Save Changes
                                            </Button>
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
                                        <Button variant="outline" className="w-full" onClick={() => router.push(`/staff/bill-management/${bill.id}?print=true`)}>
                                            <Printer className="mr-2 h-4 w-4" /> Print Copy
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