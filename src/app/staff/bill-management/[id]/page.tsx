
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BillWorkflowMap } from '@/components/BillWorkflowMap';
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
    correctBillAction
} from '@/lib/actions';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Printer, ArrowLeft, Loader2, Save, X, Edit2, CheckCircle2, RotateCcw } from 'lucide-react';

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
const PrintableBill = ({ bill, relatedData }: { bill: Bill, relatedData: any }) => {
    const now = new Date();
    const formattedDate = format(now, 'M/d/yyyy, h:mm:ss a');

    return (
        <div className="printable-bill bg-white p-8 text-black min-h-screen">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: portrait; margin: 1cm; }
                    body { background: white !important; }
                    .no-print { display: none !important; }
                }
            `}} />

            <div className="border-[2px] border-black p-6 space-y-4 font-serif">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-black pb-2 text-[10px]">
                    <span>{formattedDate}</span>
                    <span className="font-bold">AAWSA Bulk Meter Billing Portal</span>
                </div>

                <div className="text-center space-y-1 py-4">
                    <h1 className="text-xl font-bold uppercase tracking-wide">Addis Ababa Water and Sewerage Authority</h1>
                    <div className="flex justify-center items-center gap-4 py-2">
                        <img
                            src="https://veiethiopia.com/photo/partner/par2.png"
                            alt="AAWSA Logo"
                            className="h-12 w-auto object-contain"
                        />
                        <span className="text-lg font-bold uppercase">Bill calculating Portal</span>
                    </div>
                </div>

                <div className="space-y-4 text-sm">
                    {/* Customer Info */}
                    <div className="grid grid-cols-2 gap-y-2">
                        <span className="font-bold">Bulk meter name:</span> <span className="text-right">{relatedData?.name || 'N/A'}</span>
                        <span className="font-bold">Customer key number:</span> <span className="text-right">{bill.bulk_meter_id || bill.individual_customer_id}</span>
                        <span className="font-bold">Contract No:</span> <span className="text-right">{relatedData?.contractNumber || 'N/A'}</span>
                        <span className="font-bold">Branch:</span> <span className="text-right">{relatedData?.branch?.name || relatedData?.branch_id || 'N/A'}</span>
                        <span className="font-bold">Sub-City:</span> <span className="text-right">{relatedData?.subCity || 'N/A'}</span>
                    </div>

                    <div className="border-t border-black pt-4 grid grid-cols-2 gap-y-2">
                        <span className="font-bold">Bulk Meter Category:</span> <span className="text-right">{relatedData?.charge_group || 'Domestic'}</span>
                        <span className="font-bold">Sewerage Connection:</span> <span className="text-right">{relatedData?.sewerage_connection || 'No'}</span>
                        <span className="font-bold">Number of Assigned Individual Customers:</span> <span className="text-right">0</span>
                        <span className="font-bold">Previous / Current reading:</span> <span className="text-right">{Number(bill.PREVREAD).toFixed(2)} / {Number(bill.CURRREAD).toFixed(2)} m³</span>
                        <span className="font-bold">Billing usage:</span> <span className="text-right">{Number(bill.CONS).toFixed(2)} m³</span>
                        <span className="font-bold">Total Individual Usage:</span> <span className="text-right">0.00 m³</span>
                    </div>

                    <div className="border-t border-black pt-4 grid grid-cols-2 gap-y-2">
                        <span className="font-bold">Base Water Charge:</span> <span className="text-right">ETB {Number(bill.base_water_charge || 0).toFixed(2)}</span>
                        <span className="font-bold">Maintenance Fee:</span> <span className="text-right">ETB {Number(bill.maintenance_fee || 0).toFixed(2)}</span>
                        <span className="font-bold">Sanitation Fee:</span> <span className="text-right">ETB {Number(bill.sanitation_fee || 0).toFixed(2)}</span>
                        <span className="font-bold">Sewerage Fee:</span> <span className="text-right">ETB {Number(bill.sewerage_charge || 0).toFixed(2)}</span>
                        <span className="font-bold">Meter Rent:</span> <span className="text-right">ETB {Number(bill.meter_rent || 0).toFixed(2)}</span>
                        <span className="font-bold">VAT (15%):</span> <span className="text-right">ETB {Number(bill.vat_amount || 0).toFixed(2)}</span>
                        <span className="font-bold font-italic">Difference usage:</span> <span className="text-right font-medium">{Number(bill.difference_usage || 0).toFixed(2)} m³</span>
                    </div>

                    <div className="border-t border-black pt-4 grid grid-cols-2 gap-y-4 pb-4">
                        <span className="font-bold">Current Month Bill:</span> <span className="text-right font-medium">ETB {Number(bill.THISMONTHBILLAMT || bill.TOTALBILLAMOUNT || 0).toFixed(2)}</span>
                        <span className="font-bold">Outstanding Bill (Previous Balance):</span> <span className="text-right">ETB {Number(bill.OUTSTANDINGAMT || bill.balance_carried_forward || 0).toFixed(2)}</span>

                        {(Number(bill.debit_30 || bill.debit30 || 0) > 0 || Number(bill.debit_30_60 || bill.debit30_60 || 0) > 0 || Number(bill.debit_60 || bill.debit60 || 0) > 0) && (
                            <div className="col-span-2 pl-4 text-[10px] space-y-1 text-gray-600 italic">
                                <div className="flex justify-between"><span>- DEBIT_30:</span> <span>ETB {Number(bill.debit_30 || bill.debit30 || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between"><span>- DEBIT_30_60:</span> <span>ETB {Number(bill.debit_30_60 || bill.debit30_60 || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between"><span>- DEBIT_&gt;60:</span> <span>ETB {Number(bill.debit_60 || bill.debit60 || 0).toFixed(2)}</span></div>
                            </div>
                        )}

                        <div className="col-span-2 border-y-[2px] border-black py-2 flex justify-between items-center px-1">
                            <span className="text-lg font-bold uppercase">Total Amount Payable:</span>
                            <span className="text-xl font-bold">ETB {Number(bill.TOTALBILLAMOUNT || (Number(bill.THISMONTHBILLAMT || 0) + Number(bill.OUTSTANDINGAMT || bill.balance_carried_forward || 0))).toFixed(2)}</span>
                        </div>

                        <span className="font-bold">Payment Status:</span> <span className="text-right uppercase">{bill.payment_status || 'Unpaid'}</span>
                        <span className="font-bold">Billing Month:</span> <span className="text-right uppercase">{bill.month_year}</span>
                    </div>
                </div>

                {/* Footer / Signatures */}
                <div className="pt-8 grid grid-cols-3 gap-8">
                    <div className="space-y-8">
                        <div>
                            <div className="font-bold text-xs mb-8 italic">Prepared by</div>
                            <div className="border-b border-black w-full"></div>
                        </div>
                    </div>
                    <div className="space-y-8">
                        <div>
                            <div className="font-bold text-xs mb-8 italic">Checked by</div>
                            <div className="border-b border-black w-full"></div>
                        </div>
                    </div>
                    <div className="space-y-8">
                        <div>
                            <div className="font-bold text-xs mb-8 italic">Approved by</div>
                            <div className="border-b border-black w-full"></div>
                        </div>
                    </div>
                </div>

                <div className="text-[9px] text-center pt-8 italic text-gray-500">
                    This is a computer generated bill. No signature required for validation.
                </div>
            </div>
        </div>
    );
};

export default function BillDetailsPage({ basePath = '/staff/bill-management' }: BillDetailsPageProps) {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const { hasPermission } = usePermissions();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const isPrintMode = searchParams?.get('print') === 'true';

    const [bill, setBill] = useState<Bill | null>(null);
    const [relatedData, setRelatedData] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editValues, setEditValues] = useState<{ current: number, previous: number }>({ current: 0, previous: 0 });
    const [calculatedPreview, setCalculatedPreview] = useState<{ usage: number, amount: number } | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

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

        if (id) loadData();
    }, [id]);

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

                if (b.individual_customer_id) {
                    const custRes = await getCustomerByIdAction(b.individual_customer_id);
                    if (custRes.data) setRelatedData({ type: 'individual', ...custRes.data });
                } else if (b.CUSTOMERKEY) {
                    const bulkRes = await getBulkMeterByIdAction(b.CUSTOMERKEY);
                    if (bulkRes.data) {
                        const bulkData = bulkRes.data;
                        if (bulkData.branch_id) {
                            const branchRes = await getBranchByIdAction(bulkData.branch_id);
                            if (branchRes.data) bulkData.branch = branchRes.data;
                        }
                        setRelatedData({ type: 'bulk', ...bulkData });
                    }
                }

                const logsRes = await getBillWorkflowLogsAction(id);
                if (logsRes.data) setLogs(logsRes.data);
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
                setCalculatedPreview({ usage: Math.max(0, usage), amount: calcRes.data.totalAmount });
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
                    CONS: calcRes.data.usage,
                    THISMONTHBILLAMT: calcRes.data.totalAmount,
                    TOTALBILLAMOUNT: calcRes.data.totalAmount + currentOutstanding,
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
        setLoading(true);
        try {
            let res: any;
            if (action === 'submit') res = await submitBillAction(bill.id);
            if (action === 'approve') res = await approveBillAction(bill.id);
            if (action === 'reject') res = await rejectBillAction(bill.id, 'Returned for rework');
            if (action === 'post') res = await postBillAction(bill.id);
            if (action === 'correct') {
                const reason = prompt("Enter reason for correction:");
                if (reason === null) {
                    setLoading(false);
                    return;
                }
                res = await correctBillAction(bill.id, reason);
            }

            if (res?.error) {
                toast({
                    title: "Action Failed",
                    description: res.error.message || "An unexpected error occurred.",
                    variant: "destructive"
                });
            } else {
                toast({
                    title: "Success",
                    description: `Bill ${action}ed successfully.`,
                });
                await loadData();
            }
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Error",
                description: error.message || "Failed to perform action.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading && !bill) return <div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin" /> Loading...</div>;
    if (!bill) return <div className="p-8">Bill not found.</div>;

    // Special return for Print Mode
    if (isPrintMode) {
        return <PrintableBill bill={bill} relatedData={relatedData} />;
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
                    <Button variant="outline" onClick={() => router.push(`/staff/bill-management/${bill.id}?print=true`)}>
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
                                        <DetailItem label="Previous Reading" value={`${bill.PREVREAD} m³`} />
                                        <DetailItem label="Current Reading" value={`${bill.CURRREAD} m³`} />
                                        <DetailItem label="Billed Usage" value={`${bill.CONS} m³`} bold />
                                        <DetailItem label="Current Bill" value={`ETB ${Number(bill.THISMONTHBILLAMT || bill.TOTALBILLAMOUNT || 0).toFixed(2)}`} bold color="text-blue-700" />
                                        <DetailItem label="Outstanding Balance" value={
                                            <div className="space-y-1">
                                                <div>ETB {Number(bill.OUTSTANDINGAMT || bill.balance_carried_forward || 0).toFixed(2)}</div>
                                                {(Number(bill.debit_30 || bill.debit30 || 0) > 0 || Number(bill.debit_30_60 || bill.debit30_60 || 0) > 0 || Number(bill.debit_60 || bill.debit60 || 0) > 0) && (
                                                    <div className="text-[10px] text-gray-500 font-normal">
                                                        <div>30 days: ETB {Number(bill.debit_30 || bill.debit30 || 0).toFixed(2)}</div>
                                                        <div>60 days: ETB {Number(bill.debit_30_60 || bill.debit30_60 || 0).toFixed(2)}</div>
                                                        <div>&gt;60 days: ETB {Number(bill.debit_60 || bill.debit60 || 0).toFixed(2)}</div>
                                                    </div>
                                                )}
                                            </div>
                                        } />
                                        <DetailItem label="Total Payable" value={`ETB ${Number(bill.TOTALBILLAMOUNT || (Number(bill.THISMONTHBILLAMT || 0) + Number(bill.OUTSTANDINGAMT || bill.balance_carried_forward || 0))).toFixed(2)}`} bold color="text-red-700" size="text-base" />
                                    </>
                                )}

                                <DetailItem label="Bill Period" value={bill.month_year} />
                                <DetailItem label="Date Billed" value={format(new Date(bill.created_at), 'PPP')} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activity History */}
                    <Card>
                        <CardHeader className="bg-gray-50/50">
                            <CardTitle className="text-lg">Activity History</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="relative pl-6 border-l-2 border-gray-100 space-y-8">
                                {logs.map((log) => (
                                    <div key={log.id} className="relative">
                                        <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white"></div>
                                        <div>
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold text-sm">{log.from_status} &rarr; {log.to_status}</span>
                                                <span className="text-xs text-gray-500">{format(new Date(log.created_at), 'MMM dd, HH:mm')}</span>
                                            </div>
                                            {log.reason && <p className="text-sm text-red-600 mt-1 italic">"{log.reason}"</p>}
                                            <p className="text-xs text-gray-400 mt-1 uppercase tracking-tight">By User: {log.changed_by}</p>
                                        </div>
                                    </div>
                                ))}
                                {logs.length === 0 && <p className="text-sm text-gray-500">No activity history for this bill.</p>}
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
