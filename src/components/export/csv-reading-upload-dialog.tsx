"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle as UIDialogTitle,
  DialogDescription as UIDialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  UploadCloud, FileSpreadsheet, FileWarning, CheckCircle,
  AlertTriangle, X, Loader2, FileDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  addIndividualCustomerReadingsBatch,
  addBulkMeterReadingsBatch,
  getIndividualCustomerReadings,
  getBulkMeterReadings,
  getCustomers,
  getBulkMeters,
  initializeCustomers,
  initializeBulkMeters,
  initializeIndividualCustomerReadings,
  initializeBulkMeterReadings
} from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { format, parse, isValid, lastDayOfMonth } from "date-fns";
import { z, ZodError } from "zod";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface User {
  id?: string;
  email: string;
  role: string;
  branchName?: string;
}

interface CsvReadingUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meterType: "individual" | "bulk";
  meters: IndividualCustomer[] | BulkMeter[];
  currentUser: User | null | undefined;
}

const readingCsvRequiredHeaders = ["CUST_KEY", "PREVIOUS_READING", "METER_READING", "READING_DATE"];

const CSV_SPLIT_REGEX = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;

const BATCH_SIZE = 100; // Increased from 25 for much better speed

const readingCsvRowSchema = z.object({
  READ_PROC_ID: z.string().optional(),
  ROUND_KEY: z.string().optional(),
  WALK_ORDER: z.coerce.number().optional(),
  INST_KEY: z.string().optional(),
  INST_TYPE_CODE: z.string().optional(),
  CUST_KEY: z.string().min(1, { message: "CUST_KEY is required." }),
  CUST_NAME: z.string().optional(),
  DISPLAY_ADDRESS: z.string().optional(),
  BRANCH_NAME: z.string().optional(),
  METER_KEY: z.string().optional(),
  PREVIOUS_READING: z.coerce.number().optional(),
  LAST_READING_DATE: z.string().optional(),
  NUMBER_OF_DIALS: z.coerce.number().optional(),
  METER_DIAMETER: z.coerce.number().optional(),
  SHADOW_PCNT: z.coerce.number().optional(),
  MIN_USAGE_QTY: z.coerce.number().optional(),
  MIN_USAGE_AMOUNT: z.coerce.number().optional(),
  CHARGE_GROUP: z.string().optional(),
  USAGE_CODE: z.string().optional(),
  SELL_CODE: z.string().optional(),
  FREQUENCY: z.string().optional(),
  SERVICE_CODE: z.string().optional(),
  SHADOW_USAGE: z.coerce.number().optional(),
  ESTIMATED_READING: z.coerce.number().optional(),
  ESTIMATED_READING_LOW: z.coerce.number().optional(),
  ESTIMATED_READING_HIGH: z.coerce.number().optional(),
  ESTIMATED_READING_IND: z.string().optional(),
  METER_READING: z.coerce.number().min(0, { message: "METER_READING must be ≥ 0." }),
  READING_DATE: z.string().min(1, { message: "READING_DATE is required." }),
  METER_READER_CODE: z.string().optional(),
  FAULT_CODE: z.string().optional(),
  SERVICE_BILLED_UP_TO_DATE: z.string().optional(),
  METER_MULTIPLY_FACTOR: z.coerce.number().optional(),
});

type ValidationIssue = {
  row: number;
  custKey: string;
  type: "error" | "warning";
  message: string;
};

type ValidRow = {
  rowIndex: number;
  meterKey: string;
  normalizedReadingDate: string;
  readingData: any;
};

function normalizeReadingDate(dateValue: string): string {
  let parsedDate: Date;
  if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    parsedDate = parse(dateValue, "dd/MM/yyyy", new Date());
  } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    parsedDate = new Date(dateValue);
  } else if (dateValue.match(/^\d{4}-\d{2}$/)) {
    parsedDate = lastDayOfMonth(parse(dateValue, "yyyy-MM", new Date()));
  } else {
    parsedDate = new Date(dateValue);
  }
  return isValid(parsedDate) ? format(parsedDate, "yyyy-MM-dd") : "";
}

function parseDateFull(dateStr: string | undefined): string | undefined {
  if (!dateStr?.trim()) return undefined;
  try {
    let d: Date;
    if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      d = parse(dateStr, "dd/MM/yyyy", new Date());
    } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      d = new Date(dateStr);
    } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
      d = new Date(dateStr + "-01");
    } else {
      d = new Date(dateStr);
    }
    return isValid(d) ? format(d, "yyyy-MM-dd") : undefined;
  } catch {
    return undefined;
  }
}

export function CsvReadingUploadDialog({
  open, onOpenChange, meterType, currentUser
}: CsvReadingUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [stage, setStage] = React.useState<"idle" | "validating" | "validated" | "uploading" | "done">("idle");
  const [progress, setProgress] = React.useState(0);
  const [progressLabel, setProgressLabel] = React.useState("");

  const [validRows, setValidRows] = React.useState<ValidRow[]>([]);
  const [issues, setIssues] = React.useState<ValidationIssue[]>([]);
  const [successCount, setSuccessCount] = React.useState(0);
  const [totalRows, setTotalRows] = React.useState(0);

  const errors = React.useMemo(() => issues.filter(i => i.type === "error"), [issues]);
  const warnings = React.useMemo(() => issues.filter(i => i.type === "warning"), [issues]);

  const resetState = () => {
    setCsvFile(null);
    setStage("idle");
    setProgress(0);
    setProgressLabel("");
    setValidRows([]);
    setIssues([]);
    setSuccessCount(0);
    setTotalRows(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".dat");
    if (ok) {
      setCsvFile(file);
      setStage("idle");
      setIssues([]);
      setValidRows([]);
      setSuccessCount(0);
    } else {
      toast({ variant: "destructive", title: "Invalid File", description: "Please upload a .csv or .dat file." });
      resetState();
    }
  };

  // ── STEP 1: Validate only (no DB writes) ──────────────────────────────────
  const handleValidate = async () => {
    if (!csvFile || !currentUser) return;
    setStage("validating");
    setProgress(5);
    setProgressLabel("Loading existing data…");

    // Refresh data from server
    if (meterType === "individual") {
      await initializeCustomers(true);
      await initializeIndividualCustomerReadings(true);
    } else {
      await initializeBulkMeters(true);
      await initializeBulkMeterReadings(true);
    }

    setProgress(20);
    setProgressLabel("Parsing CSV…");

    const text = await csvFile.text();
    const lines = text.split(/\r\n|\n/).filter(l => l.trim() !== "");
    if (lines.length === 0) {
      setIssues([{ row: 0, custKey: "", type: "error", message: "File is empty." }]);
      setStage("validated");
      return;
    }

    const firstLineValues = lines[0].split(CSV_SPLIT_REGEX).map(v => v.trim().replace(/^"|"$/g, ""));
    const headerLower = firstLineValues.map(h => h.toLowerCase());
    const missing = readingCsvRequiredHeaders.filter(req => !headerLower.includes(req.toLowerCase()));
    if (missing.length > 0) {
      setIssues([{ row: 0, custKey: "", type: "error", message: `Missing required columns: ${missing.join(", ")}` }]);
      setStage("validated");
      return;
    }

    // Build duplicate-detection sets from existing DB readings
    const existingReadings = meterType === "individual" ? getIndividualCustomerReadings() : getBulkMeterReadings();
    const seenDateKeys = new Set<string>();
    const seenMonthKeys = new Set<string>();

    for (const r of existingReadings) {
      const shared = r as any;
      const key = meterType === "individual"
        ? (shared.individualCustomerId || shared.custKey || "")
        : (shared.CUSTOMERKEY || shared.custKey || "");
      const date = normalizeReadingDate(shared.readingDate || "");
      if (key && date) {
        seenDateKeys.add(`${String(key).trim()}|${date}`);
        seenMonthKeys.add(`${String(key).trim()}|${date.slice(0, 7)}`);
      }
    }

    // Build meter lookup maps
    const meterPool = (meterType === "individual" ? getCustomers() : getBulkMeters()) as any[];
    const byKey = new Map<string, any>();
    const byMeter = new Map<string, any>();
    for (const m of meterPool) {
      if (m?.customerKeyNumber) byKey.set(String(m.customerKeyNumber).trim(), m);
      if (m?.meterNumber) byMeter.set(String(m.meterNumber).trim(), m);
    }

    const isHeaderRow = firstLineValues.some(v =>
      readingCsvRequiredHeaders.some(h => h.toLowerCase() === v.toLowerCase())
    );
    const headerMapping: Record<string, number> = {};
    if (isHeaderRow) {
      firstLineValues.forEach((val, i) => { headerMapping[val.toUpperCase()] = i; });
    } else {
      readingCsvRequiredHeaders.forEach((req, i) => { headerMapping[req] = i; });
    }
    const dataRows = isHeaderRow ? lines.slice(1) : lines;
    setTotalRows(dataRows.length);

    const localIssues: ValidationIssue[] = [];
    const localValid: ValidRow[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const values = dataRows[i].split(CSV_SPLIT_REGEX).map(v => v.trim().replace(/^"|"$/g, ""));
      const rowData = Object.fromEntries(
        Object.entries(headerMapping).map(([h, idx]) => [h, values[idx]])
      );

      let validated: z.infer<typeof readingCsvRowSchema>;
      try {
        validated = readingCsvRowSchema.parse(rowData);
      } catch (err) {
        if (err instanceof ZodError) {
          err.issues.forEach(issue => {
            localIssues.push({
              row: i + 1,
              custKey: (rowData as any).CUST_KEY || "",
              type: "error",
              message: `Column '${issue.path.join(".")}': ${issue.message}`,
            });
          });
        }
        continue;
      }

      // Meter lookup
      const custKeyTrimmed = String(validated.CUST_KEY ?? "").trim();
      const meterKeyTrimmed = String((validated as any).METER_KEY ?? "").trim();
      const meter = byKey.get(custKeyTrimmed) ?? byMeter.get(meterKeyTrimmed);
      if (!meter) {
        localIssues.push({
          row: i + 1, custKey: custKeyTrimmed, type: "error",
          message: `Meter '${custKeyTrimmed || meterKeyTrimmed}' not found in the system.`,
        });
        continue;
      }

      // Date validation
      const normDate = normalizeReadingDate(validated.READING_DATE);
      if (!normDate) {
        localIssues.push({
          row: i + 1, custKey: custKeyTrimmed, type: "error",
          message: `Invalid date '${validated.READING_DATE}'. Use dd/MM/yyyy or yyyy-MM-dd.`,
        });
        continue;
      }

      const rowMeterKey = String(meter.customerKeyNumber ?? meter.meterNumber ?? "").trim();

      // Duplicate checks against DB
      const dateKey = `${rowMeterKey}|${normDate}`;
      const monthKey = `${rowMeterKey}|${normDate.slice(0, 7)}`;

      if (seenDateKeys.has(dateKey)) {
        localIssues.push({
          row: i + 1, custKey: custKeyTrimmed, type: "error",
          message: `Duplicate: a reading already exists for '${rowMeterKey}' on ${normDate}.`,
        });
        continue;
      }
      if (seenMonthKeys.has(monthKey)) {
        localIssues.push({
          row: i + 1, custKey: custKeyTrimmed, type: "error",
          message: `Duplicate: a reading already exists for '${rowMeterKey}' in ${normDate.slice(0, 7)}.`,
        });
        continue;
      }

      // Negative consumption warning
      const curr = validated.METER_READING ?? 0;
      const prev = validated.PREVIOUS_READING ?? 0;
      if (curr < prev) {
        localIssues.push({
          row: i + 1, custKey: custKeyTrimmed, type: "warning",
          message: `Negative consumption: current (${curr}) < previous (${prev}). Row will still be uploaded.`,
        });
      }

      // Future date warning
      const readingDateObj = new Date(normDate);
      if (readingDateObj > new Date()) {
        localIssues.push({
          row: i + 1, custKey: custKeyTrimmed, type: "warning",
          message: `Reading date ${normDate} is in the future.`,
        });
      }

      // Mark as seen so in-file duplicates are caught
      seenDateKeys.add(dateKey);
      seenMonthKeys.add(monthKey);

      // Build payload
      let parsedDate: Date;
      let monthYearStr: string;
      const ds = validated.READING_DATE;
      if (ds.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        parsedDate = parse(ds, "dd/MM/yyyy", new Date());
        monthYearStr = format(parsedDate, "yyyy-MM");
      } else if (ds.match(/^\d{4}-\d{2}$/)) {
        parsedDate = lastDayOfMonth(parse(ds, "yyyy-MM", new Date()));
        monthYearStr = ds;
      } else {
        parsedDate = new Date(ds);
        monthYearStr = format(parsedDate, "yyyy-MM");
      }

      const commonPayload = {
        readerStaffId: currentUser.id,
        readingDate: format(parsedDate, "yyyy-MM-dd"),
        monthYear: monthYearStr,
        readingValue: validated.METER_READING,
        roundKey: validated.ROUND_KEY,
        walkOrder: validated.WALK_ORDER,
        instKey: validated.INST_KEY,
        instTypeCode: validated.INST_TYPE_CODE,
        custName: validated.CUST_NAME,
        displayAddress: validated.DISPLAY_ADDRESS,
        branchName: validated.BRANCH_NAME,
        meterKey: validated.METER_KEY,
        previousReading: validated.PREVIOUS_READING,
        lastReadingDate: parseDateFull(validated.LAST_READING_DATE),
        NUMBER_OF_DIALS: validated.NUMBER_OF_DIALS,
        meterDiameter: validated.METER_DIAMETER,
        shadowPcnt: validated.SHADOW_PCNT,
        minUsageQty: validated.MIN_USAGE_QTY,
        minUsageAmount: validated.MIN_USAGE_AMOUNT,
        chargeGroup: validated.CHARGE_GROUP,
        usageCode: validated.USAGE_CODE,
        sellCode: validated.SELL_CODE,
        frequency: validated.FREQUENCY,
        serviceCode: validated.SERVICE_CODE,
        estimatedReading: validated.ESTIMATED_READING,
        estimatedReadingLow: validated.ESTIMATED_READING_LOW,
        estimatedReadingHigh: validated.ESTIMATED_READING_HIGH,
        estimatedReadingInd: validated.ESTIMATED_READING_IND,
        meterReaderCode: validated.METER_READER_CODE,
        faultCode: validated.FAULT_CODE,
        serviceBilledUpToDate: parseDateFull(validated.SERVICE_BILLED_UP_TO_DATE),
        meterMultiplyFactor: validated.METER_MULTIPLY_FACTOR,
        shadowUsage: curr - prev,
      };

      const readingData = meterType === "individual"
        ? { individualCustomerId: meter.customerKeyNumber, custKey: validated.CUST_KEY, ...commonPayload }
        : { CUSTOMERKEY: meter.customerKeyNumber, custKey: validated.CUST_KEY, ...commonPayload };

      localValid.push({ rowIndex: i, meterKey: rowMeterKey, normalizedReadingDate: normDate, readingData });
    }

    setIssues(localIssues);
    setValidRows(localValid);
    setProgress(100);
    setProgressLabel("Validation complete");
    setStage("validated");
  };

  // ── STEP 2: Upload validated rows ─────────────────────────────────────────
  const handleUpload = async () => {
    if (validRows.length === 0) return;
    setStage("uploading");
    setProgress(0);

    let uploaded = 0;
    const uploadErrors: ValidationIssue[] = [];
    const total = validRows.length;

    for (let start = 0; start < total; start += BATCH_SIZE) {
      const batch = validRows.slice(start, start + BATCH_SIZE);
      const batchPayload = batch.map(item => ({ readingData: item.readingData }));

      setProgressLabel(`Uploading ${Math.min(start + BATCH_SIZE, total)} / ${total} rows…`);

      try {
        const result = meterType === "individual"
          ? await addIndividualCustomerReadingsBatch(batchPayload)
          : await addBulkMeterReadingsBatch(batchPayload);

        if (result.success && result.data?.count) {
          uploaded += result.data.count;
        } else {
          const msg = (result as any).message || "Batch failed.";
          batch.forEach(item => {
            uploadErrors.push({
              row: item.rowIndex + 1,
              custKey: item.meterKey,
              type: "error",
              message: msg,
            });
          });
        }
      } catch (err) {
        const msg = (err as Error).message;
        batch.forEach(item => {
          uploadErrors.push({ row: item.rowIndex + 1, custKey: item.meterKey, type: "error", message: msg });
        });
      }

      setProgress(Math.round(((start + batch.length) / total) * 100));
    }

    setSuccessCount(uploaded);
    setIssues(prev => [...prev.filter(i => i.type === "warning"), ...uploadErrors]);
    setStage("done");
    setProgress(100);
    setProgressLabel("Upload complete");

    if (uploaded > 0 && uploadErrors.length === 0) {
      toast({ title: "Upload Complete", description: `${uploaded} readings added successfully.` });
    } else if (uploaded > 0) {
      toast({ title: "Partially Uploaded", description: `${uploaded} readings added. ${uploadErrors.length} rows failed.` });
    } else {
      toast({ variant: "destructive", title: "Upload Failed", description: "No readings were saved. Check errors below." });
    }
  };

  // ── Download error report ─────────────────────────────────────────────────
  const downloadErrorReport = () => {
    const errorRows = issues.filter(i => i.type === "error");
    if (errorRows.length === 0) return;
    const csvContent = ["Row,CUST_KEY,Message", ...errorRows.map(e => `${e.row},"${e.custKey}","${e.message.replace(/"/g, '""')}"`)].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `upload-errors-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Download template ─────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const csvString = readingCsvRequiredHeaders.join(",") + "\n";
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `${meterType}_reading_template.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isProcessing = stage === "validating" || stage === "uploading";
  const typeLabel = meterType === "individual" ? "Individual Customer" : "Bulk Meter";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[860px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <UIDialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            Upload {typeLabel} Readings
          </UIDialogTitle>
          <UIDialogDescription>
            Upload a CSV file. Required columns: <span className="font-semibold text-foreground">{readingCsvRequiredHeaders.join(", ")}</span>.
            Date formats accepted: <span className="font-semibold text-foreground">dd/MM/yyyy</span> or <span className="font-semibold text-foreground">yyyy-MM-dd</span>.
          </UIDialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">

          {/* Required columns info */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <span className="font-semibold text-slate-700">Required columns: </span>
            {readingCsvRequiredHeaders.map(h => (
              <span key={h} className="mr-1 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{h}</span>
            ))}
          </div>

          {/* File picker */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.dat"
              onChange={handleFileChange}
              className="flex-grow"
              disabled={isProcessing}
            />
            <Button
              onClick={handleValidate}
              disabled={!csvFile || isProcessing}
              variant="outline"
              className="w-full sm:w-auto border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {stage === "validating" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {stage === "validating" ? "Validating…" : "Validate File"}
            </Button>
            {stage === "validated" && (
              <Button
                onClick={handleUpload}
                disabled={validRows.length === 0 || isProcessing}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload {validRows.length} rows
              </Button>
            )}
            {stage === "uploading" && (
              <Button disabled className="w-full sm:w-auto bg-emerald-600 text-white opacity-80">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {(stage === "validating" || stage === "uploading") && (
            <div className="space-y-1.5">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{progressLabel}</p>
            </div>
          )}

          {/* Stats row after validation */}
          {(stage === "validated" || stage === "done") && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Rows" value={totalRows} color="slate" />
              <StatCard label="Valid Rows" value={validRows.length} color="emerald" />
              <StatCard label="Errors" value={errors.length} color="rose" />
              <StatCard label="Warnings" value={warnings.length} color="amber" />
            </div>
          )}

          {/* Done success */}
          {stage === "done" && successCount > 0 && (
            <Alert className="bg-emerald-50 border-emerald-300">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <AlertTitle className="text-emerald-700">Upload Complete</AlertTitle>
              <UIAlertDescription className="text-emerald-600">
                {successCount} readings saved successfully out of {validRows.length} valid rows.
              </UIAlertDescription>
            </Alert>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-200">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {warnings.length} Warning{warnings.length > 1 ? "s" : ""} (rows will still upload)
                </div>
              </div>
              <ScrollArea className="h-[120px]">
                <ul className="px-4 py-2 space-y-1 text-xs text-amber-800">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-amber-500 shrink-0">Row {w.row}</span>
                      <span>{w.message}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-rose-200">
                <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
                  <FileWarning className="h-4 w-4" />
                  {errors.length} Error{errors.length > 1 ? "s" : ""} (these rows will be skipped)
                </div>
                {errors.length > 5 && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-700" onClick={downloadErrorReport}>
                    <FileDown className="mr-1 h-3 w-3" /> Download CSV
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[160px]">
                <ul className="px-4 py-2 space-y-1 text-xs text-rose-800">
                  {errors.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-rose-400 shrink-0">Row {e.row}</span>
                      {e.custKey && <span className="font-medium text-rose-600 shrink-0">[{e.custKey}]</span>}
                      <span>{e.message}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3 flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadTemplate} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            Download Template
          </Button>
          {stage === "done" && (
            <Button onClick={resetState} variant="outline" className="gap-1.5">
              <X className="h-4 w-4" /> Upload Another File
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "slate" | "emerald" | "rose" | "amber" }) {
  const colorMap = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-center ${colorMap[color]}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  );
}
