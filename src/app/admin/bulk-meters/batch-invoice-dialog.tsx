'use client';

import * as React from "react";
import { Download, Printer, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getMostRecentBillsForBulkMetersAction } from "@/lib/actions";

interface BatchInvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedMeterIds: Set<string>;
    onComplete?: () => void;
}

export function BatchInvoiceDialog({ open, onOpenChange, selectedMeterIds, onComplete }: BatchInvoiceDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [invoiceRows, setInvoiceRows] = React.useState<any[]>([]);

    React.useEffect(() => {
        if (open && selectedMeterIds.size > 0) {
            loadMostRecentBills();
        } else {
            setInvoiceRows([]);
        }
    }, [open, selectedMeterIds]);

    async function loadMostRecentBills() {
        setIsLoading(true);
        try {
            const keys = Array.from(selectedMeterIds);
            const result = await getMostRecentBillsForBulkMetersAction(keys);
            if (result.error) {
                toast({ variant: "destructive", title: "Error", description: result.error });
                setInvoiceRows([]);
            } else {
                setInvoiceRows(result.data ?? []);
            }
        } finally {
            setIsLoading(false);
        }
    }

    const metersWithBills = invoiceRows.length;
    const metersWithoutBills = selectedMeterIds.size - metersWithBills;

    const handlePrintAll = async () => {
        if (invoiceRows.length === 0) {
            toast({ variant: "destructive", title: "No Invoices Found", description: "No bills found for the selected meters." });
            return;
        }

        setIsProcessing(true);

        // Map DB rows to the shape expected by the print page
        const printData = invoiceRows.map((row: any) => ({
            meter: {
                customerKeyNumber: row.CUSTOMERKEY,
                name: row.name,
                contractNumber: row.contractNumber,
                meterNumber: row.meterNumber,
                meterSize: Number(row.meterSize ?? 0),
                specificArea: row.specificArea,
                subCity: row.subCity,
                woreda: row.woreda,
                phoneNumber: row.phoneNumber,
                chargeGroup: row.charge_group,
                sewerageConnection: row.sewerage_connection,
                branchId: row.branch_id,
                // Use subCity as fallback for location display (no location col in table)
                location: row.subCity,
            },
            bill: {
                id: row.id,
                CUSTOMERKEY: row.CUSTOMERKEY,
                BILLKEY: row.BILLKEY,
                monthYear: row.month_year,
                PREVREAD: Number(row.PREVREAD ?? 0),
                CURRREAD: Number(row.CURRREAD ?? 0),
                CONS: Number(row.CONS ?? 0),
                differenceUsage: Number(row.difference_usage ?? 0),
                baseWaterCharge: Number(row.base_water_charge ?? 0),
                maintenanceFee: Number(row.maintenance_fee ?? 0),
                sanitationFee: Number(row.sanitation_fee ?? 0),
                sewerageCharge: Number(row.sewerage_charge ?? 0),
                meterRent: Number(row.meter_rent ?? 0),
                vatAmount: Number(row.vat_amount ?? 0),
                THISMONTHBILLAMT: Number(row.THISMONTHBILLAMT ?? row.TOTALBILLAMOUNT ?? 0),
                TOTALBILLAMOUNT: Number(row.TOTALBILLAMOUNT ?? 0),
                OUTSTANDINGAMT: Number(row.OUTSTANDINGAMT ?? 0),
                balanceCarriedForward: Number(row.balance_carried_forward ?? 0),
                debit30: Number(row.debit_30 ?? 0),
                debit30_60: Number(row.debit_30_60 ?? 0),
                debit60: Number(row.debit_60 ?? 0),
                dueDate: row.due_date,
                paymentStatus: row.payment_status ?? 'Unpaid',
                billPeriodStartDate: row.bill_period_start_date,
                billPeriodEndDate: row.bill_period_end_date,
                notes: row.notes,
            }
        }));

        sessionStorage.setItem('batchInvoiceData', JSON.stringify(printData));
        window.open('/admin/bulk-meters/print-invoices', '_blank');

        toast({ title: "Opening Print View", description: `Preparing ${printData.length} invoice(s)...` });
        setIsProcessing(false);
        onComplete?.();
        onOpenChange(false);
    };

    const handleExportCSV = () => {
        if (invoiceRows.length === 0) {
            toast({ variant: "destructive", title: "No Invoices Found", description: "No bills found for the selected meters." });
            return;
        }

        const headers = [
            "Meter Name", "Customer Key", "Month", "Previous Reading", "Current Reading",
            "Usage (m³)", "Difference Usage (m³)", "DEBIT_30", "DEBIT_30_60", "DEBIT_>60",
            "Base Water Charge (ETB)", "Maintenance Fee (ETB)", "Sanitation Fee (ETB)",
            "Sewerage Charge (ETB)", "Meter Rent (ETB)", "VAT (ETB)",
            "Current Bill (ETB)", "Outstanding (ETB)", "Total Amount Payable (ETB)", "Payment Status"
        ];

        const rows = invoiceRows.map((row: any) => {
            const currentBill = Number(row.THISMONTHBILLAMT ?? row.TOTALBILLAMOUNT ?? 0);
            const outstanding = Number(row.OUTSTANDINGAMT ?? row.balance_carried_forward ?? 0);
            const totalPayable = Number(row.TOTALBILLAMOUNT ?? 0);
            return [
                row.name,
                row.CUSTOMERKEY,
                row.month_year,
                Number(row.PREVREAD ?? 0).toFixed(2),
                Number(row.CURRREAD ?? 0).toFixed(2),
                Number(row.CONS ?? 0).toFixed(2),
                Number(row.difference_usage ?? 0).toFixed(2),
                Number(row.debit_30 ?? 0).toFixed(2),
                Number(row.debit_30_60 ?? 0).toFixed(2),
                Number(row.debit_60 ?? 0).toFixed(2),
                Number(row.base_water_charge ?? 0).toFixed(2),
                Number(row.maintenance_fee ?? 0).toFixed(2),
                Number(row.sanitation_fee ?? 0).toFixed(2),
                Number(row.sewerage_charge ?? 0).toFixed(2),
                Number(row.meter_rent ?? 0).toFixed(2),
                Number(row.vat_amount ?? 0).toFixed(2),
                currentBill.toFixed(2),
                outstanding.toFixed(2),
                totalPayable.toFixed(2),
                row.payment_status ?? 'Unpaid'
            ];
        });

        const csv = [
            headers.join(','),
            ...rows.map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bulk-invoices-latest.csv`;
        a.click();
        URL.revokeObjectURL(url);

        toast({ title: "CSV Exported", description: `Exported ${invoiceRows.length} invoice(s) to CSV.` });
        onComplete?.();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Generate Bulk Invoices</DialogTitle>
                    <DialogDescription>
                        Export or print the most recent invoice for {selectedMeterIds.size} selected bulk meter{selectedMeterIds.size !== 1 ? 's' : ''}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Loading most recent bills from database...</span>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg border p-4 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Total Selected:</span>
                                    <span className="font-medium">{selectedMeterIds.size} meters</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        With Recent Invoices:
                                    </span>
                                    <span className="font-medium text-green-600">{metersWithBills}</span>
                                </div>
                                {metersWithoutBills > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <XCircle className="h-4 w-4 text-amber-600" />
                                            No Bills Found:
                                        </span>
                                        <span className="font-medium text-amber-600">{metersWithoutBills}</span>
                                    </div>
                                )}
                            </div>

                            {invoiceRows.length > 0 && (
                                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                                    <p className="font-medium">Most recent bills loaded:</p>
                                    <ul className="mt-1 space-y-0.5">
                                        {invoiceRows.map((r: any) => (
                                            <li key={r.CUSTOMERKEY} className="flex justify-between">
                                                <span>{r.name}</span>
                                                <span className="font-mono text-xs">{r.month_year}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {metersWithoutBills > 0 && (
                                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                                    <p className="font-medium">Note:</p>
                                    <p className="mt-1">
                                        {metersWithoutBills} meter{metersWithoutBills !== 1 ? 's' : ''} have no bills yet.
                                        Only meters with existing bills will be included.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                        Cancel
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            onClick={handleExportCSV}
                            disabled={isLoading || isProcessing || metersWithBills === 0}
                            className="flex-1 sm:flex-none"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button
                            onClick={handlePrintAll}
                            disabled={isLoading || isProcessing || metersWithBills === 0}
                            className="flex-1 sm:flex-none"
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                            Print All
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
