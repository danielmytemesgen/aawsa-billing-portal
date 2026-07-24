"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { updatePaymentsFromCsvAction } from "@/lib/actions";

/**
 * PaymentCsvUploadDialog
 *
 * Props are fully serializable (no function props) so this component can be
 * used as a "use client" entry file without triggering the Next.js warning.
 *
 * - openTrigger: Increment this number from the parent to open the dialog.
 * - On success the dialog refreshes the page via router.refresh() and closes itself.
 */
export interface PaymentCsvUploadDialogProps {
  /** Increment to open the dialog. Initial value should be 0. */
  openTrigger: number;
}

export function PaymentCsvUploadDialog({ openTrigger }: PaymentCsvUploadDialogProps) {
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [parsedRows, setParsedRows] = React.useState<any[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [successCount, setSuccessCount] = React.useState<number | null>(null);

  // Open when parent increments the trigger
  React.useEffect(() => {
    if (openTrigger > 0) {
      resetState();
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrigger]);

  const resetState = () => {
    setCsvFile(null);
    setParsedRows([]);
    setErrors([]);
    setSuccessCount(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    setOpen(newOpen);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Bill Key",
      "Customer Key",
      "Customer Name",
      "Branch",
      "Amount",
      "Payment Date",
      "Reconciliation Status",
      "Payment Channel",
      "Bank Ref",
      "Phone",
      "Route Key",
      "Walk Order",
      "Meter Key",
    ].join(",");

    const sampleRow = [
      "BBPT-1670278004",
      "BM-55997177",
      "A.A.H.A N/A",
      "Megenagna",
      "325.17",
      "2026-07-23 09:47",
      "Not reconciled",
      "CBE",
      "FT26204C06R4",
      "-",
      "-",
      "-",
      "-",
    ].join(",");

    const csvContent = [headers, sampleRow].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "payment_update_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Sample payment update template downloaded successfully.",
    });
  };

  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setErrors(["The uploaded file is empty."]);
          return;
        }

        const lines = text
          .split(/\r\n|\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length < 2) {
          setErrors(["CSV must contain a header row and at least one data row."]);
          return;
        }

        // CSV line regex splitter supporting quoted values
        const splitRegex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;

        const rawHeaders = lines[0].split(splitRegex).map((h) => h.replace(/^"|"$/g, "").trim());

        // Header mapping helper
        const findHeaderIndex = (aliases: string[]) => {
          return rawHeaders.findIndex((h) =>
            aliases.some((alias) => h.toLowerCase() === alias.toLowerCase())
          );
        };

        const idxBillKey = findHeaderIndex(["Bill Key", "BILL KEY", "BillKey", "bill_key"]);
        const idxCustKey = findHeaderIndex(["Customer Key", "CUSTOMER KEY", "CustomerKey", "customer_key", "CUST_KEY"]);
        const idxCustName = findHeaderIndex(["Customer Name", "CUSTOMER NAME", "CustomerName", "customer_name", "CUST_NAME"]);
        const idxBranch = findHeaderIndex(["Branch", "BRANCH", "Branch Name", "BRANCH_NAME"]);
        const idxAmount = findHeaderIndex(["Amount", "AMOUNT", "Amount Paid", "AMOUNT_PAID"]);
        const idxPaymentDate = findHeaderIndex(["Payment Date", "PAYMENT DATE", "PaymentDate", "payment_date", "Date"]);
        const idxReconStatus = findHeaderIndex(["Reconciliation Status", "RECONCILIATION STATUS", "ReconciliationStatus", "reconciliation_status"]);
        const idxChannel = findHeaderIndex(["Payment Channel", "PAYMENT CHANNEL", "PaymentChannel", "payment_channel", "Payment Method"]);
        const idxBankRef = findHeaderIndex(["Bank Ref", "BANK REF", "BankRef", "bank_ref", "Transaction Ref"]);
        const idxPhone = findHeaderIndex(["Phone", "PHONE", "Phone Number", "PHONE_NUMBER"]);
        const idxRouteKey = findHeaderIndex(["Route Key", "ROUTE KEY", "RouteKey", "route_key"]);
        const idxWalkOrder = findHeaderIndex(["Walk Order", "WALK ORDER", "WalkOrder", "walk_order", "ordinal"]);
        const idxMeterKey = findHeaderIndex(["Meter Key", "METER KEY", "MeterKey", "meter_key"]);

        const rows: any[] = [];
        const parseErrors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(splitRegex).map((c) => c.replace(/^"|"$/g, "").trim());
          const getVal = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx] : "");

          const billKey = getVal(idxBillKey);
          const customerKey = getVal(idxCustKey);

          if (!billKey && !customerKey) {
            parseErrors.push(`Row ${i}: Missing both Bill Key and Customer Key.`);
            continue;
          }

          rows.push({
            billKey,
            customerKey,
            customerName: getVal(idxCustName),
            branch: getVal(idxBranch),
            amount: getVal(idxAmount) ? Number(getVal(idxAmount)) : undefined,
            paymentDate: getVal(idxPaymentDate),
            reconciliationStatus: getVal(idxReconStatus),
            paymentChannel: getVal(idxChannel),
            bankRef: getVal(idxBankRef),
            phone: getVal(idxPhone),
            routeKey: getVal(idxRouteKey),
            walkOrder: getVal(idxWalkOrder),
            meterKey: getVal(idxMeterKey),
          });
        }

        setErrors(parseErrors);
        setParsedRows(rows);
      } catch (err: any) {
        console.error("CSV parse error", err);
        setErrors(["Failed to parse CSV file format."]);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast({
        variant: "destructive",
        title: "Invalid File Format",
        description: "Please select a .csv file.",
      });
      return;
    }

    setCsvFile(file);
    setSuccessCount(null);
    parseCsvFile(file);
  };

  const handleSubmit = async () => {
    if (parsedRows.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "Please select a valid CSV file with data rows.",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await updatePaymentsFromCsvAction(parsedRows);

      if (res.success || (res.updatedCount && res.updatedCount > 0)) {
        setSuccessCount(res.updatedCount || 0);
        toast({
          title: "Payments Updated Successfully",
          description: `Successfully updated ${res.updatedCount || 0} payment record(s).`,
        });

        if (res.errors && res.errors.length > 0) {
          setErrors(res.errors.map((e: any) => `Row ${e.row}: ${e.error}`));
        } else {
          setErrors([]);
        }

        // Dispatch a custom event so any listening page can re-fetch its data immediately
        window.dispatchEvent(new CustomEvent("payment-csv-upload-success", {
          detail: { updatedCount: res.updatedCount || 0 }
        }));

        // Auto-close dialog after 1.5s so user sees the refreshed list.
        // Force a page reload so the report page re-reads the fresh server state
        // instead of continuing to render a stale client snapshot.
        setTimeout(() => {
          setOpen(false);
          resetState();
          window.location.reload();
        }, 1500);
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: "Failed to update payments from CSV.",
        });
        if (res.errors) {
          setErrors(res.errors.map((e: any) => `Row ${e.row}: ${e.error}`));
        }
      }
    } catch (err: any) {
      console.error("Upload error", err);
      toast({
        variant: "destructive",
        title: "Server Error",
        description: err.message || "An unexpected error occurred during processing.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Update Payment with CSV Upload</DialogTitle>
              <DialogDescription>
                Upload payment reconciliation records from external payment systems.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 flex-1 overflow-y-auto">
          {/* Header Requirements Note */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">CSV Headers Specification:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-3.5 w-3.5" /> Download Template
              </Button>
            </div>
            <p className="text-slate-600 font-mono text-[11px] bg-white p-2 rounded border border-slate-200 overflow-x-auto">
              <span className="font-semibold text-slate-800">Required:</span> Bill Key, Customer Key, Customer Name, Branch, Amount, Payment Date, Reconciliation Status, Payment Channel, Bank Ref
              <br />
              <span className="font-semibold text-amber-700">Optional:</span> Phone, Route Key, Walk Order, Meter Key
            </p>
          </div>

          {/* Drag & Drop / File Input Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-2xl p-6 text-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            <UploadCloud className="h-10 w-10 text-indigo-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">
              {csvFile ? csvFile.name : "Click to browse and upload CSV file"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports CSV files formatted with standard comma delimiters.
            </p>
          </div>

          {/* Success Summary */}
          {successCount !== null && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 flex items-center gap-3 text-xs">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold">Successfully updated {successCount} payment(s)!</p>
                <p className="text-emerald-700 mt-0.5">The paid bills list has been refreshed.</p>
              </div>
            </div>
          )}

          {/* Errors List */}
          {errors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-xs space-y-1.5 max-h-40 overflow-y-auto">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertCircle className="h-4 w-4 text-rose-600" /> Validation Messages / Errors:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Parsed Rows Ready for Upload ({parsedRows.length})</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto text-xs bg-white">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 border-b text-[11px] text-slate-600">
                    <tr>
                      <th className="p-2">Bill Key</th>
                      <th className="p-2">Customer Key</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Channel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-mono">{row.billKey || "-"}</td>
                        <td className="p-2 font-mono">{row.customerKey || "-"}</td>
                        <td className="p-2 font-semibold text-emerald-600">{row.amount ?? "-"}</td>
                        <td className="p-2">{row.paymentDate || "-"}</td>
                        <td className="p-2">{row.reconciliationStatus || "Not reconciled"}</td>
                        <td className="p-2">{row.paymentChannel || "CBE"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 5 && (
                  <div className="p-2 text-center text-slate-400 text-[11px] bg-slate-50 border-t">
                    ...and {parsedRows.length - 5} more row(s)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing || parsedRows.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processing Payments...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" /> Apply Payment Updates ({parsedRows.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentCsvUploadDialog;
