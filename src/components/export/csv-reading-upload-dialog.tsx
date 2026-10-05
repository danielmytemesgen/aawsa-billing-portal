"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle as UIDialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UploadCloud, FileSpreadsheet, FileWarning, CheckCircle,
  AlertTriangle, X, Loader2, FileDown, File as FileIcon,
  Calendar, Layers, ShieldAlert, ChevronDown, Flame
} from "lucide-react";
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
  initializeBulkMeterReadings,
  initializeFaultCodes,
  getFaultCodes,
  subscribeToFaultCodes,
  type DomainFaultCode
} from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { format, parse, isValid, lastDayOfMonth } from "date-fns";
import { z, ZodError } from "zod";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getReadingPeriodStatusAction } from "@/lib/actions";

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
  meters?: IndividualCustomer[] | BulkMeter[];
  currentUser: User | null | undefined;
  onSuccess?: () => void;
}

const readingCsvRequiredHeaders = ["CUST_KEY", "PREVIOUS_READING", "METER_READING", "READING_DATE"];
const readingCsvOptionalHeaders = ["FAULT_CODE"];

const BATCH_SIZE = 1000;

// Canonical field dictionary with standard aliases
const HEADER_ALIASES: Record<string, string> = {
  // Customer / Meter Identifier
  cust_key: "CUST_KEY",
  custkey: "CUST_KEY",
  customerkey: "CUST_KEY",
  customer_key: "CUST_KEY",
  customer_key_number: "CUST_KEY",
  customerkeynumber: "CUST_KEY",
  account_no: "CUST_KEY",
  accountno: "CUST_KEY",
  account_number: "CUST_KEY",
  customer_id: "CUST_KEY",
  customerid: "CUST_KEY",
  meter_key: "METER_KEY",
  meterkey: "METER_KEY",
  meter_number: "METER_KEY",
  meternumber: "METER_KEY",

  // Previous Reading
  previous_reading: "PREVIOUS_READING",
  previousreading: "PREVIOUS_READING",
  prev_reading: "PREVIOUS_READING",
  prevreading: "PREVIOUS_READING",
  prev_read: "PREVIOUS_READING",
  prevread: "PREVIOUS_READING",
  previous: "PREVIOUS_READING",
  last_reading: "PREVIOUS_READING",
  prev_reading_value: "PREVIOUS_READING",

  // Current Meter Reading
  meter_reading: "METER_READING",
  meterreading: "METER_READING",
  current_reading: "METER_READING",
  currentreading: "METER_READING",
  curr_reading: "METER_READING",
  currreading: "METER_READING",
  reading: "METER_READING",
  curr_read: "METER_READING",
  currread: "METER_READING",
  reading_value: "METER_READING",
  readingvalue: "METER_READING",

  // Reading Date
  reading_date: "READING_DATE",
  readingdate: "READING_DATE",
  read_date: "READING_DATE",
  readdate: "READING_DATE",
  date: "READING_DATE",
  bill_date: "READING_DATE",

  // Fault Code
  fault_code: "FAULT_CODE",
  faultcode: "FAULT_CODE",
  fault: "FAULT_CODE",
  fault_key: "FAULT_CODE",
};

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
  PREVIOUS_READING: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().min(0, { message: "PREVIOUS_READING cannot be negative." }).optional()
  ),
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
  METER_READING: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number({ required_error: "METER_READING is required.", invalid_type_error: "METER_READING must be a valid number." }).min(0, { message: "METER_READING must be ≥ 0." })
  ),
  READING_DATE: z.string().min(1, { message: "READING_DATE is required." }),
  METER_READER_CODE: z.string().optional(),
  FAULT_CODE: z.string().optional(),
  SERVICE_BILLED_UP_TO_DATE: z.string().optional(),
  METER_MULTIPLY_FACTOR: z.coerce.number().optional(),
});

type ValidationIssue = {
  row: number;
  custKey: string;
  type: "error" | "warning" | "info";
  message: string;
};

type ValidRow = {
  rowIndex: number;
  meterKey: string;
  custName?: string;
  normalizedReadingDate: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  isSurge?: boolean;
  faultCode?: string;
  readingData: any;
  isUpdate?: boolean;
};

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  if (semiCount > commaCount && semiCount > tabCount) return ';';
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  return ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  if (delimiter === '\t') {
    return line.split('\t').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  }
  const regex = delimiter === ';'
    ? /;(?=(?:[^"]*"[^"]*")*[^"]*$)/
    : /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  return line.split(regex).map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
}

function normalizeReadingDate(dateValue: string): string {
  if (!dateValue || typeof dateValue !== 'string') return "";
  const trimmed = dateValue.trim();

  // Format 1: dd/MM/yyyy or d/M/yyyy
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format 2: yyyy-MM-dd or yyyy/MM/dd
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Format 3: yyyy-MM
  const ymMatch = trimmed.match(/^(\d{4})[\/\-](\d{2})$/);
  if (ymMatch) {
    try {
      const parsedDate = lastDayOfMonth(parse(trimmed, "yyyy-MM", new Date()));
      return isValid(parsedDate) ? format(parsedDate, "yyyy-MM-dd") : `${ymMatch[1]}-${ymMatch[2]}-28`;
    } catch {
      return `${ymMatch[1]}-${ymMatch[2]}-01`;
    }
  }

  // Fallback
  const d = new Date(trimmed);
  return isValid(d) ? format(d, "yyyy-MM-dd") : "";
}

function parseDateFull(dateStr: string | undefined): string | undefined {
  if (!dateStr?.trim()) return undefined;
  const normalized = normalizeReadingDate(dateStr);
  return normalized || undefined;
}

export function CsvReadingUploadDialog({
  open,
  onOpenChange,
  meterType,
  meters,
  currentUser,
  onSuccess
}: CsvReadingUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [overwriteExisting, setOverwriteExisting] = React.useState<boolean>(true);
  const [forceZeroOnFault, setForceZeroOnFault] = React.useState<boolean>(true);
  const [stage, setStage] = React.useState<"idle" | "validating" | "validated" | "uploading" | "done">("idle");
  const [progress, setProgress] = React.useState(0);
  const [progressLabel, setProgressLabel] = React.useState("");
  const [periodStatus, setPeriodStatus] = React.useState<string | null>(null);

  const [validRows, setValidRows] = React.useState<ValidRow[]>([]);
  const [issues, setIssues] = React.useState<ValidationIssue[]>([]);
  const [successCount, setSuccessCount] = React.useState(0);
  const [insertedCount, setInsertedCount] = React.useState(0);
  const [updatedCount, setUpdatedCount] = React.useState(0);
  const [totalRows, setTotalRows] = React.useState(0);
  const [surgeCount, setSurgeCount] = React.useState(0);
  const [liveFaultCodes, setLiveFaultCodes] = React.useState<DomainFaultCode[]>([]);

  React.useEffect(() => {
    if (open) {
      initializeFaultCodes();
      const unsub = subscribeToFaultCodes((codes) => setLiveFaultCodes(codes));
      // Pre-check reading period status
      getReadingPeriodStatusAction()
        .then(status => setPeriodStatus(status))
        .catch(() => setPeriodStatus(null));
      return () => unsub();
    }
  }, [open]);

  const errors = React.useMemo(() => issues.filter(i => i.type === "error"), [issues]);
  const warnings = React.useMemo(() => issues.filter(i => i.type === "warning" || i.type === "info"), [issues]);
  const newRowsCount = React.useMemo(() => validRows.filter(r => !r.isUpdate).length, [validRows]);
  const updateRowsCount = React.useMemo(() => validRows.filter(r => r.isUpdate).length, [validRows]);

  const resetState = () => {
    setCsvFile(null);
    setStage("idle");
    setProgress(0);
    setProgressLabel("");
    setValidRows([]);
    setIssues([]);
    setSuccessCount(0);
    setInsertedCount(0);
    setUpdatedCount(0);
    setTotalRows(0);
    setSurgeCount(0);
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const handleSelectedFile = (file: File) => {
    const ok = file.type === "text/csv" ||
      file.name.toLowerCase().endsWith(".csv") ||
      file.name.toLowerCase().endsWith(".dat") ||
      file.type === "application/vnd.ms-excel";
    if (ok) {
      setCsvFile(file);
      setStage("idle");
      setIssues([]);
      setValidRows([]);
      setSuccessCount(0);
      setInsertedCount(0);
      setUpdatedCount(0);
      setSurgeCount(0);
    } else {
      toast({ variant: "destructive", title: "Invalid File", description: "Please upload a .csv or .dat file." });
      resetState();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleSelectedFile(file);
  };

  // ── STEP 1: Validate only (no DB writes) ──────────────────────────────────
  const handleValidate = async () => {
    if (!csvFile) return;
    if (!currentUser) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to upload readings." });
      return;
    }

    setStage("validating");
    setProgress(5);
    setProgressLabel("Loading existing data & period status…");

    // Check reading period status
    try {
      const currentStatus = await getReadingPeriodStatusAction();
      setPeriodStatus(currentStatus);
      if (currentStatus !== 'Open') {
        setIssues([{
          row: 0,
          custKey: "",
          type: "error",
          message: currentStatus === 'Ready for New Reading'
            ? "Reading period is not yet open. It is currently in 'Ready for New Reading' state."
            : "Reading period is currently closed globally. Meter readings cannot be submitted."
        }]);
        setStage("validated");
        return;
      }
    } catch (e) {
      console.warn("Could not verify reading period status", e);
    }

    // Refresh data from server
    if (meterType === "individual") {
      await initializeCustomers(true);
      await initializeIndividualCustomerReadings(true);
    } else {
      await initializeBulkMeters(true);
      await initializeBulkMeterReadings(true);
    }
    await initializeFaultCodes(true);

    setProgress(20);
    setProgressLabel("Parsing CSV…");

    let rawText = await csvFile.text();
    // Strip UTF-8 BOM if present
    if (rawText.charCodeAt(0) === 0xFEFF) {
      rawText = rawText.slice(1);
    }

    const lines = rawText.split(/\r\n|\n/).filter(l => l.trim() !== "");
    if (lines.length === 0) {
      setIssues([{ row: 0, custKey: "", type: "error", message: "File is empty." }]);
      setStage("validated");
      return;
    }

    // Auto-detect delimiter from the header line
    const delimiter = detectDelimiter(lines[0]);
    const rawHeaderValues = parseCsvLine(lines[0], delimiter);

    // Normalize headers and match canonical aliases
    const normalizeKey = (h: string) => h.toLowerCase().replace(/[\s\-_]+/g, "");
    const headerMapping: Record<string, number> = {};
    const headerNameCleanSet = new Set<string>();

    rawHeaderValues.forEach((rawCol, idx) => {
      const cleanKey = normalizeKey(rawCol);
      const canonical = HEADER_ALIASES[cleanKey] || rawCol.toUpperCase().replace(/[\s\-]+/g, "_");
      headerMapping[canonical] = idx;
      headerNameCleanSet.add(canonical);
    });

    // Check required columns (support CUST_KEY or fallback METER_KEY)
    const hasIdentifier = headerNameCleanSet.has("CUST_KEY") || headerNameCleanSet.has("METER_KEY");
    const hasReading = headerNameCleanSet.has("METER_READING");
    const hasDate = headerNameCleanSet.has("READING_DATE");

    const missingColumns: string[] = [];
    if (!hasIdentifier) missingColumns.push("CUST_KEY (or METER_KEY)");
    if (!hasReading) missingColumns.push("METER_READING (or CURRENT_READING)");
    if (!hasDate) missingColumns.push("READING_DATE");

    if (missingColumns.length > 0) {
      setIssues([{
        row: 0,
        custKey: "",
        type: "error",
        message: `Missing required columns: ${missingColumns.join(", ")}. Please check column headers.`
      }]);
      setStage("validated");
      return;
    }

    // Build existing database reading lookups
    const existingReadings = meterType === "individual" ? getIndividualCustomerReadings() : getBulkMeterReadings();
    const dbSeenDateKeys = new Set<string>();
    const dbSeenMonthKeys = new Set<string>();

    for (const r of existingReadings) {
      const shared = r as any;
      const key = meterType === "individual"
        ? (shared.individualCustomerId || shared.custKey || "")
        : (shared.CUSTOMERKEY || shared.custKey || "");
      const date = normalizeReadingDate(shared.readingDate || "");
      if (key && date) {
        dbSeenDateKeys.add(`${String(key).trim().toUpperCase()}|${date}`);
        dbSeenMonthKeys.add(`${String(key).trim().toUpperCase()}|${date.slice(0, 7)}`);
      }
    }

    // Build meter lookup pool: Prioritize scoped meters prop (for staff), fallback to store
    const meterPool = (meters && meters.length > 0)
      ? (meters as any[])
      : ((meterType === "individual" ? getCustomers() : getBulkMeters()) as any[]);

    const byKey = new Map<string, any>();
    const byMeter = new Map<string, any>();
    for (const m of meterPool) {
      if (m?.customerKeyNumber) {
        byKey.set(String(m.customerKeyNumber).trim().toUpperCase(), m);
      }
      if (m?.meterNumber) {
        byMeter.set(String(m.meterNumber).trim().toUpperCase(), m);
      }
    }

    const dataRows = lines.slice(1);
    setTotalRows(dataRows.length);

    const localIssues: ValidationIssue[] = [];
    const localValid: ValidRow[] = [];
    const seenInFileDateKeys = new Set<string>();
    const seenInFileMonthKeys = new Set<string>();
    let localSurgeCount = 0;

    // Process validation in async chunks to avoid blocking the UI
    const CHUNK = 50;
    for (let i = 0; i < dataRows.length; i++) {
      if (i > 0 && i % CHUNK === 0) {
        const pct = 20 + Math.round((i / dataRows.length) * 75);
        setProgress(pct);
        setProgressLabel(`Validating row ${i} / ${dataRows.length}…`);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }

      const values = parseCsvLine(dataRows[i], delimiter);
      const rowData: Record<string, any> = {};
      Object.entries(headerMapping).forEach(([canonical, colIdx]) => {
        if (colIdx < values.length) {
          rowData[canonical] = values[colIdx];
        }
      });

      // Default CUST_KEY to METER_KEY if missing
      if (!rowData.CUST_KEY && rowData.METER_KEY) {
        rowData.CUST_KEY = rowData.METER_KEY;
      }

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

      // Case-insensitive meter lookup
      const custKeyTrimmed = String(validated.CUST_KEY ?? "").trim();
      const meterKeyTrimmed = String((validated as any).METER_KEY ?? "").trim();
      const custKeyUpper = custKeyTrimmed.toUpperCase();
      const meterKeyUpper = meterKeyTrimmed.toUpperCase();

      const meter = (custKeyUpper ? byKey.get(custKeyUpper) : undefined)
        ?? (meterKeyUpper ? byMeter.get(meterKeyUpper) : undefined)
        ?? (meterKeyUpper ? byKey.get(meterKeyUpper) : undefined)
        ?? (custKeyUpper ? byMeter.get(custKeyUpper) : undefined);

      if (!meter) {
        localIssues.push({
          row: i + 1,
          custKey: custKeyTrimmed,
          type: "error",
          message: meters && meters.length > 0
            ? `Meter '${custKeyTrimmed || meterKeyTrimmed}' not found in your assigned branch/route.`
            : `Meter '${custKeyTrimmed || meterKeyTrimmed}' not found in the system.`,
        });
        continue;
      }

      // Date validation
      const normDate = normalizeReadingDate(validated.READING_DATE);
      if (!normDate) {
        localIssues.push({
          row: i + 1,
          custKey: custKeyTrimmed,
          type: "error",
          message: `Invalid date '${validated.READING_DATE}'. Use dd/MM/yyyy or yyyy-MM-dd.`,
        });
        continue;
      }

      const rowMeterKey = String(meter.customerKeyNumber ?? meter.meterNumber ?? "").trim();
      const rowMeterKeyUpper = rowMeterKey.toUpperCase();
      const dateKey = `${rowMeterKeyUpper}|${normDate}`;
      const monthKey = `${rowMeterKeyUpper}|${normDate.slice(0, 7)}`;
      const isExistingInDb = dbSeenDateKeys.has(dateKey) || dbSeenMonthKeys.has(monthKey);
      const isDuplicateInFile = seenInFileDateKeys.has(dateKey) || seenInFileMonthKeys.has(monthKey);
      let isUpdate = false;

      // In-file duplicate check
      if (isDuplicateInFile) {
        if (!overwriteExisting) {
          localIssues.push({
            row: i + 1,
            custKey: custKeyTrimmed,
            type: "error",
            message: `Duplicate in CSV: another row already has a reading for '${rowMeterKey}' in ${normDate.slice(0, 7)}.`,
          });
          continue;
        } else {
          localIssues.push({
            row: i + 1,
            custKey: custKeyTrimmed,
            type: "warning",
            message: `Duplicate in CSV: overwriting earlier row in this file for '${rowMeterKey}' in ${normDate.slice(0, 7)}.`,
          });
          isUpdate = true;
        }
      }

      // Database duplicate check
      if (isExistingInDb) {
        if (!overwriteExisting) {
          localIssues.push({
            row: i + 1,
            custKey: custKeyTrimmed,
            type: "error",
            message: `Duplicate: reading already exists for '${rowMeterKey}' in ${normDate.slice(0, 7)}. Check "Overwrite / Update existing readings" to replace.`,
          });
          continue;
        } else {
          localIssues.push({
            row: i + 1,
            custKey: custKeyTrimmed,
            type: "info",
            message: `Existing reading for '${rowMeterKey}' in ${normDate.slice(0, 7)} will be updated to: ${validated.METER_READING}.`,
          });
          isUpdate = true;
        }
      }

      // Negative consumption check
      let curr = validated.METER_READING ?? 0;
      const prev = validated.PREVIOUS_READING ?? (meter.currentReading ?? meter.previousReading ?? 0);
      if (curr < prev) {
        localIssues.push({
          row: i + 1,
          custKey: custKeyTrimmed,
          type: "warning",
          message: `Negative consumption: current (${curr}) < previous (${prev}). Row will still be uploaded.`,
        });
      }

      // Future date warning
      if (normDate > format(new Date(), "yyyy-MM-dd")) {
        localIssues.push({
          row: i + 1,
          custKey: custKeyTrimmed,
          type: "warning",
          message: `Reading date ${normDate} is in the future.`,
        });
      }

      // Fault code validation
      let resolvedFaultCode: string | undefined = undefined;
      const rawFaultCode = validated.FAULT_CODE?.trim();
      if (rawFaultCode) {
        const availableCodes = liveFaultCodes.length > 0 ? liveFaultCodes : getFaultCodes();
        const matched = availableCodes.find(fc => fc.code.trim().toUpperCase() === rawFaultCode.toUpperCase());
        if (matched) {
          resolvedFaultCode = matched.code;
        } else {
          resolvedFaultCode = rawFaultCode.length <= 4 ? rawFaultCode.toUpperCase() : rawFaultCode;
          if (availableCodes.length > 0) {
            localIssues.push({
              row: i + 1,
              custKey: custKeyTrimmed,
              type: "warning",
              message: `Fault code '${rawFaultCode}' is not registered. It will be recorded as '${resolvedFaultCode}'.`,
            });
          }
        }

        // Fault-code rule: Previous = Current, usage = 0 m³ (if enabled)
        if (forceZeroOnFault) {
          if (curr !== prev) {
            localIssues.push({
              row: i + 1,
              custKey: custKeyTrimmed,
              type: "warning",
              message: `Fault code '${resolvedFaultCode}' detected: current reading (${curr}) aligned to previous reading (${prev}) — usage set to 0 m³.`,
            });
            curr = prev;
          }
        } else {
          localIssues.push({
            row: i + 1,
            custKey: custKeyTrimmed,
            type: "info",
            message: `Fault code '${resolvedFaultCode}' recorded: physical dial reading (${curr}) retained.`,
          });
        }
      }

      // Consumption calculation and Surge warning
      const consumption = curr - prev;
      const isSurge = consumption > 100 || (prev > 0 && consumption > prev * 2.5);
      if (isSurge && !resolvedFaultCode) {
        localSurgeCount++;
        localIssues.push({
          row: i + 1,
          custKey: custKeyTrimmed,
          type: "warning",
          message: `Surge alert: High consumption detected (${consumption.toFixed(1)} m³). Please double check meter dial.`,
        });
      }

      seenInFileDateKeys.add(dateKey);
      seenInFileMonthKeys.add(monthKey);

      const monthYearStr = normDate.slice(0, 7);

      const commonPayload = {
        readerStaffId: currentUser.id,
        readingDate: normDate,
        monthYear: monthYearStr,
        readingValue: curr,
        roundKey: validated.ROUND_KEY || meter.routeKey || meter.bookNumber,
        walkOrder: validated.WALK_ORDER || meter.ordinal,
        instKey: validated.INST_KEY || meter.instKey,
        instTypeCode: validated.INST_TYPE_CODE || meter.chargeGroup || meter.customerType,
        custName: validated.CUST_NAME || meter.name,
        displayAddress: validated.DISPLAY_ADDRESS || meter.specificArea,
        branchName: validated.BRANCH_NAME,
        meterKey: validated.METER_KEY || meter.meterNumber,
        previousReading: prev,
        lastReadingDate: parseDateFull(validated.LAST_READING_DATE),
        NUMBER_OF_DIALS: validated.NUMBER_OF_DIALS || meter.NUMBER_OF_DIALS || 5,
        meterDiameter: validated.METER_DIAMETER || meter.meterSize || 0,
        shadowPcnt: validated.SHADOW_PCNT || meter.shadowPcnt || 0,
        minUsageQty: validated.MIN_USAGE_QTY || meter.minUsageQty || 0,
        minUsageAmount: validated.MIN_USAGE_AMOUNT || meter.minUsageAmount || 0,
        chargeGroup: validated.CHARGE_GROUP || meter.chargeGroup || meter.customerType,
        usageCode: validated.USAGE_CODE || meter.usageCode || "WATER",
        sellCode: validated.SELL_CODE || meter.sellCode || "DEFSEL",
        frequency: validated.FREQUENCY || meter.frequency || "M1",
        serviceCode: validated.SERVICE_CODE || meter.serviceCode || "METERENT",
        estimatedReading: validated.ESTIMATED_READING || 0,
        estimatedReadingLow: validated.ESTIMATED_READING_LOW || 0,
        estimatedReadingHigh: validated.ESTIMATED_READING_HIGH || 0,
        estimatedReadingInd: validated.ESTIMATED_READING_IND,
        meterReaderCode: validated.METER_READER_CODE || "DEFRDR",
        faultCode: resolvedFaultCode || undefined,
        serviceBilledUpToDate: parseDateFull(validated.SERVICE_BILLED_UP_TO_DATE),
        meterMultiplyFactor: validated.METER_MULTIPLY_FACTOR || 1,
        shadowUsage: curr - prev,
      };

      const readingData = meterType === "individual"
        ? { individualCustomerId: meter.customerKeyNumber, custKey: rowMeterKey, ...commonPayload }
        : { CUSTOMERKEY: meter.customerKeyNumber, custKey: rowMeterKey, ...commonPayload };

      localValid.push({
        rowIndex: i,
        meterKey: rowMeterKey,
        custName: meter.name,
        normalizedReadingDate: normDate,
        previousReading: prev,
        currentReading: curr,
        consumption,
        isSurge,
        faultCode: resolvedFaultCode,
        readingData,
        isUpdate,
      });
    }

    setIssues(localIssues);
    setValidRows(localValid);
    setSurgeCount(localSurgeCount);
    setProgress(100);
    setProgressLabel("Validation complete");
    setStage("validated");
  };

  // ── STEP 2: Upload validated rows ─────────────────────────────────────────
  const handleUpload = async () => {
    if (validRows.length === 0) return;
    if (!currentUser) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to upload readings." });
      return;
    }
    setStage("uploading");
    setProgress(0);

    let uploaded = 0;
    let insertedTotal = 0;
    let updatedTotal = 0;
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

        if (result.success && result.data) {
          const rowResults = result.data.rowResults;
          if (rowResults) {
            rowResults.forEach((rr, idx) => {
              if (rr.success) {
                uploaded++;
              } else {
                const batchItem = batch[idx];
                uploadErrors.push({
                  row: batchItem ? batchItem.rowIndex + 1 : start + idx + 1,
                  custKey: rr.custKey || (batchItem?.meterKey ?? ""),
                  type: "error",
                  message: rr.error || "Failed to save reading.",
                });
              }
            });
          } else {
            uploaded += result.data.count ?? 0;
          }
          insertedTotal += result.data.insertedCount ?? (result.data.count ?? 0);
          updatedTotal += result.data.updatedCount ?? 0;
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
          // If the server rejected the entire batch for a global reason, stop immediately
          const isFatal = /unauthorized|forbidden|reading period|closed globally|missing permission/i.test(msg);
          if (isFatal) { setProgress(100); break; }
        }
      } catch (err) {
        const msg = (err as Error).message;
        batch.forEach(item => {
          uploadErrors.push({ row: item.rowIndex + 1, custKey: item.meterKey, type: "error", message: msg });
        });
      }

      setProgress(Math.round(((start + batch.length) / total) * 100));
    }

    // Refresh store
    if (meterType === "individual") {
      await initializeCustomers(true);
      await initializeIndividualCustomerReadings(true);
    } else {
      await initializeBulkMeters(true);
      await initializeBulkMeterReadings(true);
    }

    setSuccessCount(uploaded);
    setInsertedCount(insertedTotal);
    setUpdatedCount(updatedTotal);
    setIssues(prev => [...prev.filter(i => i.type === "warning" || i.type === "info"), ...uploadErrors]);
    setStage("done");
    setProgress(100);
    setProgressLabel("Upload complete");

    if (uploaded > 0) {
      // Trigger parent page refresh callback
      try {
        onSuccess?.();
      } catch (cbErr) {
        console.warn("onSuccess callback failed", cbErr);
      }
    }

    if (uploaded > 0 && uploadErrors.length === 0) {
      if (updatedTotal > 0) {
        toast({
          title: "Upload & Overwrite Complete",
          description: `${uploaded} readings processed (${insertedTotal} new, ${updatedTotal} updated/overridden).`
        });
      } else {
        toast({
          title: "Upload Complete",
          description: `${uploaded} readings added successfully.`
        });
      }
    } else if (uploaded > 0) {
      toast({
        title: "Partially Uploaded",
        description: `${uploaded} readings processed (${insertedTotal} new, ${updatedTotal} updated). ${uploadErrors.length} rows failed — see errors below.`
      });
    } else {
      // Surface the actual server reason to the user
      const firstServerMsg = uploadErrors[0]?.message ?? "No readings were saved.";
      let friendlyDesc = firstServerMsg;
      if (/unauthorized/i.test(firstServerMsg)) {
        friendlyDesc = "Your session has expired. Please refresh the page and log in again.";
      } else if (/reading period.*closed|closed globally/i.test(firstServerMsg)) {
        friendlyDesc = "The reading period is currently closed. Readings cannot be submitted at this time.";
      } else if (/ready for new reading/i.test(firstServerMsg)) {
        friendlyDesc = "The reading period has not yet opened. Wait until an administrator opens it.";
      } else if (/forbidden|missing permission/i.test(firstServerMsg)) {
        friendlyDesc = "You do not have permission to upload readings. Contact your administrator.";
      }
      toast({ variant: "destructive", title: "Upload Failed", description: friendlyDesc });
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

  // ── Download generic blank template ──────────────────────────────────────
  const downloadGenericTemplate = () => {
    const today = format(new Date(), "dd/MM/yyyy");
    const templateHeaders = [...readingCsvRequiredHeaders, ...readingCsvOptionalHeaders];
    const sampleRow = meterType === "individual"
      ? `CUST001,1200,1250,${today},`
      : `BM-001,45000,47500,${today},`;
    const csvString = templateHeaders.join(",") + "\n" + sampleRow + "\n";
    const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `${meterType}_reading_template.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Download pre-populated template with active meters ────────────────────
  const downloadPrePopulatedTemplate = () => {
    const today = format(new Date(), "dd/MM/yyyy");
    const templateHeaders = [...readingCsvRequiredHeaders, ...readingCsvOptionalHeaders, "CUST_NAME", "METER_KEY", "ROUND_KEY"];
    const pool = (meters && meters.length > 0)
      ? meters
      : (meterType === "individual" ? getCustomers() : getBulkMeters());

    if (!pool || pool.length === 0) {
      toast({
        title: "No Meters Found",
        description: "No active meters available to generate pre-filled template.",
        variant: "destructive"
      });
      return;
    }

    const rows = (pool as any[]).map(m => {
      const custKey = m.customerKeyNumber || "";
      const prev = m.currentReading ?? m.previousReading ?? 0;
      const name = (m.name || "").replace(/,/g, ' ');
      const meterKey = m.meterNumber || "";
      const roundKey = m.routeKey || m.bookNumber || "";
      return `"${custKey}",${prev},,${today},,"${name}","${meterKey}","${roundKey}"`;
    });

    const csvString = templateHeaders.join(",") + "\n" + rows.join("\n") + "\n";
    const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `${meterType}_prefilled_readings_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Pre-Populated Template Generated",
      description: `Created template with ${rows.length} active meters for field recording.`
    });
  };

  const isProcessing = stage === "validating" || stage === "uploading";
  const typeLabel = meterType === "individual" ? "Individual Customer" : "Bulk Meter";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[880px] max-h-[92vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <UIDialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            Upload {typeLabel} Readings
          </UIDialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 custom-scrollbar">

          {/* Reading Period Alert if closed */}
          {periodStatus && periodStatus !== 'Open' && (
            <Alert className="bg-amber-50 border-amber-300 text-amber-900">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <AlertTitle className="font-bold">Reading Period is Not Open</AlertTitle>
              <UIAlertDescription className="text-xs">
                Current status: <span className="font-bold">{periodStatus}</span>. Readings cannot be saved to the database until the period is opened by the administrator.
              </UIAlertDescription>
            </Alert>
          )}

          {/* Required columns quick reference */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-700 text-xs">Required columns:</span>
              <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">CUST_KEY</span>
              <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">PREVIOUS_READING</span>
              <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">METER_READING</span>
              <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">READING_DATE</span>
            </div>
          </div>

          {/* Options: Overwrite & Fault Code behavior */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-start sm:items-center space-x-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl px-3.5 py-2.5">
              <input
                type="checkbox"
                id="overwrite-readings-toggle"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                className="mt-0.5 sm:mt-0 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                disabled={isProcessing}
              />
              <label htmlFor="overwrite-readings-toggle" className="text-xs text-slate-700 cursor-pointer select-none leading-tight">
                <span className="font-semibold text-blue-900 block">Overwrite existing:</span>
                Replace readings recorded in the same cycle.
              </label>
            </div>

            <div className="flex items-start sm:items-center space-x-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl px-3.5 py-2.5">
              <input
                type="checkbox"
                id="force-zero-fault-toggle"
                checked={forceZeroOnFault}
                onChange={(e) => setForceZeroOnFault(e.target.checked)}
                className="mt-0.5 sm:mt-0 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                disabled={isProcessing}
              />
              <label htmlFor="force-zero-fault-toggle" className="text-xs text-slate-700 cursor-pointer select-none leading-tight">
                <span className="font-semibold text-amber-900 block">Zero usage on fault code:</span>
                Set usage to 0 m³ (Current = Previous) when fault is tagged.
              </label>
            </div>
          </div>

          {/* Drag & Drop File Picker Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => { if (!isProcessing) fileInputRef.current?.click(); }}
            className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-50/80 scale-[1.005]"
                : csvFile
                ? "border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/60"
                : "border-slate-300 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-400"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.dat,text/csv,application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center justify-center gap-2">
              {csvFile ? (
                <>
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <FileIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{csvFile.name}</p>
                    <p className="text-xs text-slate-500">{(csvFile.size / 1024).toFixed(1)} KB — Click or drag to change file</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Drag and drop your <span className="text-blue-600 font-bold">.CSV</span> or <span className="text-blue-600 font-bold">.DAT</span> file here
                    </p>
                    <p className="text-xs text-slate-500">or click to browse from your device</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleValidate}
              disabled={!csvFile || isProcessing}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-1.5"
            >
              {stage === "validating" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {stage === "validating" ? "Validating File…" : "Validate File"}
            </Button>

            {stage === "validated" && (
              <Button
                onClick={handleUpload}
                disabled={validRows.length === 0 || isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <UploadCloud className="h-4 w-4" />
                {errors.length > 0
                  ? `Upload ${validRows.length} Rows (${errors.length} skipped)`
                  : `Upload ${validRows.length} Rows`}
              </Button>
            )}

            {stage === "uploading" && (
              <Button disabled className="bg-emerald-600 text-white opacity-80 gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading Readings…
              </Button>
            )}

            {csvFile && stage !== "uploading" && (
              <Button variant="ghost" size="sm" onClick={resetState} className="text-slate-500 hover:text-slate-700 ml-auto">
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          {(stage === "validating" || stage === "uploading") && (
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>{progressLabel}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Validation / Result Stat Cards */}
          {(stage === "validated" || stage === "done") && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <StatCard label="Total Rows" value={totalRows} color="slate" />
              <StatCard label="New Readings" value={newRowsCount} color="emerald" />
              <StatCard label="Updates / Overrides" value={updateRowsCount} color="blue" />
              <StatCard label="Errors (Skipped)" value={errors.length} color="rose" />
              <StatCard label="Surge Alerts" value={surgeCount} color="amber" />
            </div>
          )}

          {/* Pre-Upload Preview Table */}
          {stage === "validated" && validRows.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <Layers className="h-4 w-4 text-slate-500" />
                  Pre-Upload Preview (First {Math.min(5, validRows.length)} of {validRows.length} Rows)
                </div>
                <span className="text-[11px] text-slate-500">Verify values before confirming upload</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Meter / Customer Key</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Prev Read</TableHead>
                      <TableHead className="text-right">Current Read</TableHead>
                      <TableHead className="text-right">Usage (m³)</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.slice(0, 5).map((r) => (
                      <TableRow key={r.rowIndex} className="text-xs">
                        <TableCell className="font-mono text-slate-400">{r.rowIndex + 1}</TableCell>
                        <TableCell className="font-bold text-slate-800">{r.meterKey}</TableCell>
                        <TableCell className="text-slate-600 truncate max-w-[140px]">{r.custName || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-slate-600">{r.previousReading.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-700">{r.currentReading.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          <span className={r.consumption < 0 ? "text-rose-600" : "text-slate-700"}>
                            {r.consumption.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500 whitespace-nowrap">{r.normalizedReadingDate}</TableCell>
                        <TableCell className="whitespace-nowrap space-x-1">
                          {r.isUpdate ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                              Overwrite
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                              New
                            </span>
                          )}
                          {r.isSurge && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                              <Flame className="h-3 w-3 text-amber-600" /> Surge
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Done Success Alert */}
          {stage === "done" && successCount > 0 && (
            <Alert className="bg-emerald-50 border-emerald-300">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <AlertTitle className="text-emerald-700 font-semibold">Upload Complete</AlertTitle>
              <UIAlertDescription className="text-emerald-600">
                {successCount} readings processed successfully ({insertedCount} new, {updatedCount} updated/overridden) out of {validRows.length} valid rows. The page tables have been synchronized.
              </UIAlertDescription>
            </Alert>
          )}

          {/* Warnings and Info messages */}
          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-200">
                <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs sm:text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  {warnings.length} Notice{warnings.length > 1 ? "s" : ""} / Warning{warnings.length > 1 ? "s" : ""} (rows will still be processed)
                </div>
              </div>
              <ScrollArea className="h-[110px]">
                <ul className="px-4 py-2 space-y-1.5 text-xs text-amber-900">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-amber-600 shrink-0">Row {w.row}</span>
                      {w.custKey && <span className="font-semibold text-slate-700 shrink-0">[{w.custKey}]</span>}
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
                <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs sm:text-sm">
                  <FileWarning className="h-4 w-4" />
                  {errors.length} Error{errors.length > 1 ? "s" : ""} (these rows will be skipped)
                </div>
                {errors.length > 5 && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-700" onClick={downloadErrorReport}>
                    <FileDown className="mr-1 h-3 w-3" /> Download Errors CSV
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[140px]">
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

        <DialogFooter className="border-t pt-3 flex-wrap items-center justify-between gap-2">
          {/* Dual Template Download Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="gap-1.5 text-xs sm:text-sm">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Download Template</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={downloadPrePopulatedTemplate} className="cursor-pointer">
                <div className="space-y-0.5">
                  <p className="font-semibold text-xs text-slate-800">Pre-Filled Active Meters (CSV)</p>
                  <p className="text-[11px] text-slate-500">Includes active meters, keys, and previous readings for route entry.</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadGenericTemplate} className="cursor-pointer">
                <div className="space-y-0.5">
                  <p className="font-semibold text-xs text-slate-800">Blank Sample Template (CSV)</p>
                  <p className="text-[11px] text-slate-500">Generic 1-row blank template with required headers.</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {stage === "done" && (
            <Button onClick={resetState} variant="outline" className="gap-1.5 text-xs sm:text-sm">
              <X className="h-4 w-4" /> Upload Another File
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "slate" | "emerald" | "rose" | "amber" | "blue" }) {
  const colorMap = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${colorMap[color]}`}>
      <div className="text-lg sm:text-xl font-black">{value}</div>
      <div className="text-[10px] sm:text-xs font-medium mt-0.5 opacity-80 truncate">{label}</div>
    </div>
  );
}
