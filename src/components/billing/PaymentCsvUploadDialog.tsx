"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileCheck,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { updatePaymentsFromCsvAction } from "@/lib/actions";

export interface PaymentCsvUploadDialogProps {
  /** Increment to open the dialog. Initial value should be 0. */
  openTrigger: number;
}

// Canonical header alias dictionary for intelligent column detection
const ALIAS_MAP: Record<string, string[]> = {
  billKey: [
    "billkey", "billno", "billnumber", "billid", "bill", "billkeynumber",
    "invoiceno", "invoicenumber", "invoice", "billnum", "billcode"
  ],
  customerKey: [
    "customerkey", "customerkeynumber", "custkey", "customerid", "custid",
    "account", "accountnumber", "accountno", "customerno", "customernumber",
    "contractnumber", "contractno", "contract", "customer", "custno", "customercode"
  ],
  customerName: [
    "customername", "custname", "name", "clientname", "accountname",
    "fullname", "payername", "payer", "subscriber"
  ],
  branch: [
    "branch", "branchname", "customerbranch", "subcity", "zone", "location"
  ],
  amount: [
    "amount", "amountpaid", "paidamount", "paymentamount", "totalpaid",
    "total", "billamount", "totalbillamount", "netamount", "payment", "paid"
  ],
  paymentDate: [
    "paymentdate", "date", "paydate", "txndate", "transactiondate",
    "paiddate", "datetime", "time", "timestamp"
  ],
  reconciliationStatus: [
    "reconciliationstatus", "reconstatus", "reconciliation", "reconciled", "status"
  ],
  paymentChannel: [
    "paymentchannel", "paymentmethod", "channel", "method", "bank",
    "paymentsystem", "gateway", "type", "mode"
  ],
  bankRef: [
    "bankref", "bankreference", "transactionref", "transactionreference",
    "txnref", "referencenumber", "reference", "refno", "ref", "ftno",
    "transactionid", "txnid", "receipt", "receiptno", "receiptnumber"
  ],
  phone: [
    "phone", "phonenumber", "mobile", "cell", "telephone", "contact"
  ],
  routeKey: [
    "routekey", "route", "routecode"
  ],
  walkOrder: [
    "walkorder", "ordinal", "order"
  ],
  meterKey: [
    "meterkey", "meternumber", "meterno", "meterid", "meter", "metercode"
  ]
};

function normalizeHeaderKey(str: string): string {
  return String(str || "")
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseAmountValue(val: any): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  if (typeof val === "number") return isNaN(val) ? undefined : val;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? undefined : num;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PaymentCsvUploadDialog({ openTrigger }: PaymentCsvUploadDialogProps) {
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [parsedRows, setParsedRows] = React.useState<any[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
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
    setIsParsing(false);
    setIsDragging(false);
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

  const parseMatrixData = (matrix: any[][], fileName: string) => {
    if (!matrix || matrix.length < 2) {
      setErrors(["The selected file must contain a header row and at least one data row."]);
      setParsedRows([]);
      return;
    }

    const rawHeaders = matrix[0] || [];
    const headerIndexMap: Record<string, number> = {};

    rawHeaders.forEach((col: any, idx: number) => {
      const norm = normalizeHeaderKey(String(col || ""));
      if (!norm) return;
      for (const [canonical, aliases] of Object.entries(ALIAS_MAP)) {
        if (headerIndexMap[canonical] === undefined && aliases.includes(norm)) {
          headerIndexMap[canonical] = idx;
          break;
        }
      }
    });

    const rows: any[] = [];
    const parseErrors: string[] = [];

    for (let i = 1; i < matrix.length; i++) {
      const cells = matrix[i];
      if (!cells || cells.length === 0 || cells.every((c: any) => String(c ?? "").trim() === "")) {
        continue; // skip blank rows
      }

      const getCell = (canonical: string): string => {
        const idx = headerIndexMap[canonical];
        if (idx !== undefined && idx >= 0 && idx < cells.length) {
          return String(cells[idx] ?? "").trim();
        }
        return "";
      };

      const billKey = getCell("billKey");
      const customerKey = getCell("customerKey");
      const meterKey = getCell("meterKey");

      if (!billKey && !customerKey && !meterKey) {
        parseErrors.push(`Row ${i}: Missing Bill Key, Customer Key, and Meter Key.`);
        continue;
      }

      rows.push({
        billKey: billKey || undefined,
        customerKey: customerKey || undefined,
        customerName: getCell("customerName") || undefined,
        branch: getCell("branch") || undefined,
        amount: parseAmountValue(getCell("amount")),
        paymentDate: getCell("paymentDate") || undefined,
        reconciliationStatus: getCell("reconciliationStatus") || "Not reconciled",
        paymentChannel: getCell("paymentChannel") || "Bank Transfer",
        bankRef: getCell("bankRef") || undefined,
        phone: getCell("phone") || undefined,
        routeKey: getCell("routeKey") || undefined,
        walkOrder: getCell("walkOrder") || undefined,
        meterKey: meterKey || undefined,
      });
    }

    setErrors(parseErrors);
    setParsedRows(rows);

    if (rows.length > 0) {
      toast({
        title: "File Loaded Successfully",
        description: `Ready to update ${rows.length} payment record(s) from "${fileName}".`,
      });
    } else if (parseErrors.length > 0) {
      toast({
        variant: "destructive",
        title: "Column Header Mismatch",
        description: "Could not detect required columns (Bill Key or Customer Key). Please check headers or download template.",
      });
    }
  };

  const parseCsvText = (text: string, fileName: string) => {
    // Strip UTF-8 BOM, zero-width chars, normalize newlines
    const cleanText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rawLines = cleanText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#"));

    if (rawLines.length < 2) {
      setErrors(["The CSV file must contain a header row and at least one data row."]);
      setParsedRows([]);
      return;
    }

    // Auto-detect delimiter: check first line for comma, semicolon, or tab
    const firstLine = rawLines[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;

    let delimiter = ",";
    if (semicolons > commas && semicolons > tabs) delimiter = ";";
    else if (tabs > commas && tabs > semicolons) delimiter = "\t";

    const splitRow = (line: string, delim: string): string[] => {
      if (delim === "\t") {
        return line.split("\t").map((c) => c.replace(/^"|"$/g, "").trim());
      }
      const regex = new RegExp(`${delim === ";" ? ";" : ","}(?=(?:[^"]*"[^"]*")*[^"]*$)`);
      return line.split(regex).map((c) => c.replace(/^"|"$/g, "").trim());
    };

    const matrix = rawLines.map((line) => splitRow(line, delimiter));
    parseMatrixData(matrix, fileName);
  };

  const processSelectedFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExts = ["csv", "txt", "xlsx", "xls"];

    if (!ext || !validExts.includes(ext)) {
      toast({
        variant: "destructive",
        title: "Invalid File Format",
        description: "Please select a .csv, .xlsx, .xls, or .txt file.",
      });
      return;
    }

    setCsvFile(file);
    setSuccessCount(null);
    setErrors([]);
    setIsParsing(true);

    try {
      if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("Excel file contains no worksheets.");
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        parseMatrixData(sheetData, file.name);
      } else {
        const text = await file.text();
        parseCsvText(text, file.name);
      }
    } catch (err: any) {
      console.error("File parse error", err);
      setErrors([`Failed to parse file: ${err.message || "Unknown error"}`]);
      setParsedRows([]);
    } finally {
      setIsParsing(false);
      // Reset input value so re-selecting the same file triggers onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  const handleSubmit = async () => {
    if (parsedRows.length === 0) {
      toast({
        variant: "destructive",
        title: "No Valid Data",
        description: "Please select a valid CSV or Excel file with data rows.",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await updatePaymentsFromCsvAction(parsedRows);

      if (res && res.success) {
        const count = res.updatedCount || 0;
        setSuccessCount(count);

        if (res.errors && res.errors.length > 0) {
          setErrors(res.errors.map((e: any) => `Row ${e.row}: ${e.error}`));
        } else {
          setErrors([]);
        }

        if (count > 0) {
          toast({
            title: "Payments Updated Successfully",
            description: `Successfully updated ${count} payment record(s).`,
          });

          // Dispatch event so any listening page can refresh immediately
          window.dispatchEvent(
            new CustomEvent("payment-csv-upload-success", {
              detail: { updatedCount: count },
            })
          );

          // Auto-close dialog after 1.5s
          setTimeout(() => {
            setOpen(false);
            resetState();
            window.location.reload();
          }, 1500);
        } else {
          toast({
            title: "CSV Processed",
            description: "No new payment records were updated. Check validation messages below.",
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: "Failed to update payments from file.",
        });
        if (res?.errors) {
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
              <DialogTitle className="text-xl font-bold">Update Payment with CSV / Excel Upload</DialogTitle>
              <DialogDescription>
                Upload payment reconciliation records from CBE, Telebirr, or external payment files.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 flex-1 overflow-y-auto">
          {/* Header Requirements Note */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Supported Headers & Formats:</span>
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
              <span className="font-semibold text-slate-800">Required:</span> Bill Key (or Customer Key), Amount, Payment Date, Payment Channel, Bank Ref
              <br />
              <span className="font-semibold text-amber-700">Optional:</span> Branch, Customer Name, Phone, Route Key, Meter Key
            </p>
          </div>

          {/* Hidden native input */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.txt,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Drag & Drop / File Input Box */}
          {!csvFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-indigo-600 bg-indigo-100/70 scale-[1.01] shadow-inner"
                  : "border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/70"
              }`}
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3 transition-transform group-hover:scale-110">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {isDragging ? "Drop your file here to upload" : "Click to browse or drag & drop file"}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Supports <span className="font-medium text-slate-700">CSV, Excel (.xlsx, .xls)</span>, and text files. Comma, semicolon, and tab delimiters are auto-detected.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 font-medium text-xs gap-1.5 shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <FolderOpen className="h-3.5 w-3.5" /> Choose File from Computer
                </Button>
              </div>
            </div>
          ) : (
            /* Selected File Summary Card */
            <div className="border border-indigo-200 bg-indigo-50/30 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{csvFile.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span>{formatFileSize(csvFile.size)}</span>
                    <span>•</span>
                    {isParsing ? (
                      <span className="flex items-center gap-1 text-indigo-600 font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" /> Parsing records...
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px]">
                        ✓ {parsedRows.length} valid row(s) detected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs font-semibold rounded-lg gap-1.5 border-slate-200 hover:bg-slate-100"
                >
                  <RefreshCw className="h-3 w-3" /> Change File
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={resetState}
                  className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

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
                <span className="text-slate-400 font-normal">Previewing first 5 rows</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto text-xs bg-white shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 border-b text-[11px] text-slate-600 font-semibold">
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
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2 font-mono text-slate-800">{row.billKey || "-"}</td>
                        <td className="p-2 font-mono text-slate-800">{row.customerKey || "-"}</td>
                        <td className="p-2 font-semibold text-emerald-600">
                          {row.amount !== undefined ? Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                        </td>
                        <td className="p-2 text-slate-600">{row.paymentDate || "-"}</td>
                        <td className="p-2 text-slate-600">{row.reconciliationStatus || "Not reconciled"}</td>
                        <td className="p-2 text-slate-600">{row.paymentChannel || "Bank Transfer"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 5 && (
                  <div className="p-2 text-center text-slate-500 font-medium text-[11px] bg-slate-50 border-t">
                    ...and {parsedRows.length - 5} more record(s) ready to be applied
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
            disabled={isProcessing || parsedRows.length === 0 || isParsing}
            className={`font-semibold rounded-xl gap-2 transition-all ${
              parsedRows.length > 0
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processing Payments...
              </>
            ) : isParsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reading File...
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
