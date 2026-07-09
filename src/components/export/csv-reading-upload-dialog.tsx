"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter } from "@/components/ui/dialog";
import { UploadCloud, FileSpreadsheet, FileWarning, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { addIndividualCustomerReading, addBulkMeterReading, getIndividualCustomerReadings, getBulkMeterReadings } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { format, parse, isValid, lastDayOfMonth } from "date-fns";
import { z, ZodError } from "zod";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface User {
  id?: string;
  email: string;
  // Accept role as a generic string to avoid duplicate User type conflicts across the app
  role: string;
  branchName?: string;
}

interface CsvReadingUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meterType: 'individual' | 'bulk';
  meters: IndividualCustomer[] | BulkMeter[];
  currentUser: User | null | undefined;
}
const readingCsvRequiredHeaders = [
  "CUST_KEY",
  "PREVIOUS_READING",
  "METER_READING",
  "READING_DATE",
];
const readingCsvHeaders = [
  "READ_PROC_ID", "ROUND_KEY", "WALK_ORDER", "INST_KEY", "INST_TYPE_CODE", "CUST_KEY", "CUST_NAME",
  "DISPLAY_ADDRESS", "BRANCH_NAME", "METER_KEY", "PREVIOUS_READING", "LAST_READING_DATE",
  "NUMBER_OF_DIALS", "METER_DIAMETER", "SHADOW_PCNT", "MIN_USAGE_QTY", "MIN_USAGE_AMOUNT",
  "CHARGE_GROUP", "USAGE_CODE", "SELL_CODE", "FREQUENCY", "SERVICE_CODE", "SHADOW_USAGE",
  "ESTIMATED_READING", "ESTIMATED_READING_LOW", "ESTIMATED_READING_HIGH", "ESTIMATED_READING_IND",
  "METER_READING", "READING_DATE", "METER_READER_CODE", "FAULT_CODE", "SERVICE_BILLED_UP_TO_DATE",
  "METER_MULTIPLY_FACTOR"
];
const CSV_SPLIT_REGEX = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;

// Schema now validates for YYYY-MM format.
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
  METER_READING: z.coerce.number().min(0, { message: "METER_READING must be a non-negative number." }),
  READING_DATE: z.string().min(1, { message: "READING_DATE is required." }), // Accept standard Date or YYYY-MM
  METER_READER_CODE: z.string().optional(),
  FAULT_CODE: z.string().optional(),
  SERVICE_BILLED_UP_TO_DATE: z.string().optional(),
  METER_MULTIPLY_FACTOR: z.coerce.number().optional()
});


export function CsvReadingUploadDialog({ open, onOpenChange, meterType, meters, currentUser }: CsvReadingUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [isCsvProcessing, setIsCsvProcessing] = React.useState(false);
  const [csvProcessingErrors, setCsvProcessingErrors] = React.useState<string[]>([]);
  const [csvSuccessCount, setCsvSuccessCount] = React.useState(0);

  const resetState = () => {
    setCsvFile(null);
    setCsvProcessingErrors([]);
    setCsvSuccessCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const normalizeReadingDate = (dateValue: string): string => {
    let parsedDate: Date;
    if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      parsedDate = parse(dateValue, 'dd/MM/yyyy', new Date());
    } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      parsedDate = new Date(dateValue);
    } else if (dateValue.match(/^\d{4}-\d{2}$/)) {
      parsedDate = parse(dateValue, 'yyyy-MM', new Date());
      parsedDate = lastDayOfMonth(parsedDate);
    } else {
      parsedDate = new Date(dateValue);
    }

    return isValid(parsedDate) ? format(parsedDate, 'yyyy-MM-dd') : '';
  };

  const getMeterDateKey = (meterKey: string, readingDate: string): string => {
    const normalizedDate = normalizeReadingDate(readingDate);
    return meterKey?.trim() && normalizedDate ? `${meterKey.trim()}|${normalizedDate}` : '';
  };

  const duplicateReadingKeySet = new Set<string>();
  const isDuplicateReading = (meterKey: string, readingDate: string): boolean => {
    const key = getMeterDateKey(meterKey, readingDate);
    return key ? duplicateReadingKeySet.has(key) : false;
  };
  const recordDuplicateReading = (meterKey: string, readingDate: string) => {
    const key = getMeterDateKey(meterKey, readingDate);
    if (key) duplicateReadingKeySet.add(key);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    onOpenChange(isOpen);
  };

  const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const isCsv = selectedFile.type === "text/csv" || selectedFile.name.toLowerCase().endsWith(".csv");
      const isDat = selectedFile.name.toLowerCase().endsWith(".dat");
      
      if (isCsv || isDat) {
        setCsvFile(selectedFile);
        setCsvProcessingErrors([]);
        setCsvSuccessCount(0);
      } else {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a valid .csv or .dat file." });
        resetState();
      }
    }
  };

  const handleProcessCsvFile = async () => {
    if (!csvFile || !currentUser) return;

    setIsCsvProcessing(true);
    let localSuccessCount = 0;
    const localErrors: string[] = [];
    const reader = new FileReader();

    const parseDateHelper = (dateStr: string | undefined): string | undefined => {
      if (!dateStr || !dateStr.trim()) return undefined;
      try {
        let d: Date;
        if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          d = parse(dateStr, 'dd/MM/yyyy', new Date());
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          d = new Date(dateStr);
        } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
          d = new Date(dateStr + "-01");
        } else {
          d = new Date(dateStr);
        }
        if (isValid(d)) return format(d, "yyyy-MM-dd");
        return undefined;
      } catch (e) {
        return undefined;
      }
    };

    const duplicateReadingKeySet = new Set<string>();
    const getMeterDateKey = (meterKey: string, readingDate: string): string => {
      const normalizedDate = normalizeReadingDate(readingDate);
      return meterKey?.trim() && normalizedDate ? `${meterKey.trim()}|${normalizedDate}` : '';
    };
    const isDuplicateReading = (meterKey: string, readingDate: string): boolean => {
      const key = getMeterDateKey(meterKey, readingDate);
      return key ? duplicateReadingKeySet.has(key) : false;
    };
    const recordDuplicateReading = (meterKey: string, readingDate: string) => {
      const key = getMeterDateKey(meterKey, readingDate);
      if (key) duplicateReadingKeySet.add(key);
    };

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) {
          localErrors.push("File is empty.");
          finalizeProcessing();
          return;
        }

        const firstLineValues = lines[0].split(CSV_SPLIT_REGEX).map(v => v.trim().replace(/^\"|\"$/g, ''));
        const requiredHeadersLower = readingCsvRequiredHeaders.map((h: string) => h.toLowerCase());
        const headerLower = firstLineValues.map(h => h.toLowerCase());

        const missingRequiredHeaders = readingCsvRequiredHeaders.filter(req => !headerLower.includes(req.toLowerCase()));
        if (missingRequiredHeaders.length > 0) {
          localErrors.push(`Missing required CSV headers: ${missingRequiredHeaders.join(', ')}`);
          finalizeProcessing();
          return;
        }

        const existingReadings = meterType === 'individual' ? getIndividualCustomerReadings() : getBulkMeterReadings();
        for (const existingReading of existingReadings) {
          const existingMeterKey = meterType === 'individual'
            ? (existingReading.individualCustomerId || existingReading.custKey || existingReading.meterKey)
            : (existingReading.CUSTOMERKEY || existingReading.custKey || existingReading.meterKey);
          const existingDate = normalizeReadingDate(existingReading.readingDate);
          if (existingMeterKey && existingDate) {
            duplicateReadingKeySet.add(`${String(existingMeterKey).trim()}|${existingDate}`);
          }
        }

        const isHeaderRow = firstLineValues.some(v => requiredHeadersLower.includes(v.toLowerCase()));
        let dataRows = lines;
        const headerMapping: Record<string, number> = {};

        if (isHeaderRow) {
          firstLineValues.forEach((val, index) => {
            headerMapping[val.toUpperCase()] = index;
          });
          dataRows = lines.slice(1);
        } else {
          readingCsvRequiredHeaders.forEach((req: string, idx: number) => { headerMapping[req] = idx; });
        }

        const meterPool = meters as any[];
        const meterByCustomerKey = new Map<string, any>();
        const meterByMeterNumber = new Map<string, any>();

        for (const meter of meterPool) {
          if (meter?.customerKeyNumber) meterByCustomerKey.set(String(meter.customerKeyNumber).trim(), meter);
          if (meter?.meterNumber) meterByMeterNumber.set(String(meter.meterNumber).trim(), meter);
        }

        const getMeterFromLookup = (customerKey: string | undefined, meterKey: string | undefined) => {
          const customerKeyTrimmed = String(customerKey ?? '').trim();
          if (customerKeyTrimmed && meterByCustomerKey.has(customerKeyTrimmed)) {
            return meterByCustomerKey.get(customerKeyTrimmed);
          }

          const meterKeyTrimmed = String(meterKey ?? '').trim();
          if (meterKeyTrimmed && meterByMeterNumber.has(meterKeyTrimmed)) {
            return meterByMeterNumber.get(meterKeyTrimmed);
          }

          return undefined;
        };

        const processCsvRow = async (rowIndex: number) => {
          const values = dataRows[rowIndex].split(CSV_SPLIT_REGEX).map(v => v.trim().replace(/^\"|\"$/g, ''));
          const rowData = Object.fromEntries(
            Object.entries(headerMapping).map(([header, index]) => [header, values[index]])
          );

          try {
            const validatedRow = readingCsvRowSchema.parse(rowData);
            const customerKeyVal = validatedRow.CUST_KEY;
            const meterKeyVal = (validatedRow as any).METER_KEY;
            const meter = getMeterFromLookup(customerKeyVal, meterKeyVal);

            if (!meter) {
              localErrors.push(`Row ${rowIndex + 1}: Meter '${customerKeyVal || meterKeyVal || 'unknown'}' not found.`);
              return;
            }

            const normalizedReadingDate = normalizeReadingDate(validatedRow.READING_DATE);
            if (!normalizedReadingDate) {
              localErrors.push(`Row ${rowIndex + 1}: Invalid reading date format '${validatedRow.READING_DATE}'.`);
              return;
            }

            const rowMeterKey = String(meter.customerKeyNumber ?? meter.meterNumber ?? '').trim();
            if (!rowMeterKey) {
              localErrors.push(`Row ${rowIndex + 1}: Unable to determine meter key for duplicate detection.`);
              return;
            }

            if (isDuplicateReading(rowMeterKey, normalizedReadingDate)) {
              localErrors.push(`Row ${rowIndex + 1}: Duplicate reading skipped for meter '${rowMeterKey}' on ${normalizedReadingDate}.`);
              return;
            }

            let parsedDate = new Date(validatedRow.READING_DATE);
            let monthYearStr = "";
            const dateStr = validatedRow.READING_DATE;

            if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
              if (!isValid(parsedDate)) throw new Error("Invalid date format. Expected dd/MM/yyyy");
              monthYearStr = format(parsedDate, 'yyyy-MM');
            } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
              parsedDate = parse(dateStr, 'yyyy-MM', new Date());
              parsedDate = lastDayOfMonth(parsedDate);
              monthYearStr = dateStr;
            } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              parsedDate = new Date(dateStr);
              if (!isValid(parsedDate)) throw new Error("Invalid date");
              monthYearStr = format(parsedDate, 'yyyy-MM');
            } else {
              parsedDate = new Date(dateStr);
              if (!isValid(parsedDate)) throw new Error("Invalid date");
              monthYearStr = format(parsedDate, 'yyyy-MM');
            }

            const commonPayload = {
              readerStaffId: currentUser.id,
              readingDate: format(parsedDate, "yyyy-MM-dd"),
              monthYear: monthYearStr,
              readingValue: validatedRow.METER_READING,
              roundKey: validatedRow.ROUND_KEY,
              walkOrder: validatedRow.WALK_ORDER,
              instKey: validatedRow.INST_KEY,
              instTypeCode: validatedRow.INST_TYPE_CODE,
              custName: validatedRow.CUST_NAME,
              displayAddress: validatedRow.DISPLAY_ADDRESS,
              branchName: validatedRow.BRANCH_NAME,
              meterKey: validatedRow.METER_KEY,
              previousReading: validatedRow.PREVIOUS_READING,
              lastReadingDate: parseDateHelper(validatedRow.LAST_READING_DATE),
              NUMBER_OF_DIALS: validatedRow.NUMBER_OF_DIALS,
              meterDiameter: validatedRow.METER_DIAMETER,
              shadowPcnt: validatedRow.SHADOW_PCNT,
              minUsageQty: validatedRow.MIN_USAGE_QTY,
              minUsageAmount: validatedRow.MIN_USAGE_AMOUNT,
              chargeGroup: validatedRow.CHARGE_GROUP,
              usageCode: validatedRow.USAGE_CODE,
              sellCode: validatedRow.SELL_CODE,
              frequency: validatedRow.FREQUENCY,
              serviceCode: validatedRow.SERVICE_CODE,
              estimatedReading: validatedRow.ESTIMATED_READING,
              estimatedReadingLow: validatedRow.ESTIMATED_READING_LOW,
              estimatedReadingHigh: validatedRow.ESTIMATED_READING_HIGH,
              estimatedReadingInd: validatedRow.ESTIMATED_READING_IND,
              meterReaderCode: validatedRow.METER_READER_CODE,
              faultCode: validatedRow.FAULT_CODE,
              serviceBilledUpToDate: parseDateHelper(validatedRow.SERVICE_BILLED_UP_TO_DATE),
              meterMultiplyFactor: validatedRow.METER_MULTIPLY_FACTOR
            };

            let result;
            if (meterType === 'individual') {
              result = await addIndividualCustomerReading({
                individualCustomerId: meter.customerKeyNumber,
                custKey: validatedRow.CUST_KEY,
                shadowUsage: (validatedRow.METER_READING ?? 0) - (validatedRow.PREVIOUS_READING ?? 0),
                ...commonPayload
              });
            } else {
              result = await addBulkMeterReading({
                CUSTOMERKEY: meter.customerKeyNumber,
                custKey: validatedRow.CUST_KEY,
                shadowUsage: (validatedRow.METER_READING ?? 0) - (validatedRow.PREVIOUS_READING ?? 0),
                ...commonPayload
              });
            }

            if (result && result.success) {
              localSuccessCount++;
              recordDuplicateReading(rowMeterKey, normalizedReadingDate);
            } else {
              localErrors.push(`Row ${rowIndex + 1} (${customerKeyVal}): ${result?.message || 'Unknown error.'}`);
            }
          } catch (error) {
            if (error instanceof ZodError) {
              const errorMessages = error.issues.map(issue => `Row ${rowIndex + 1}, Column '${issue.path.join('.')}' : ${issue.message}`).join('; ');
              localErrors.push(errorMessages);
            } else {
              localErrors.push(`Row ${rowIndex + 1}: Unknown validation error. ${(error as Error).message}`);
            }
          }
        };

        const rowTasks: Promise<void>[] = [];
        const batchSize = 20;
        for (let i = 0; i < dataRows.length; i++) {
          rowTasks.push(processCsvRow(i));
          if (rowTasks.length >= batchSize) {
            await Promise.allSettled(rowTasks);
            rowTasks.length = 0;
          }
        }
        if (rowTasks.length > 0) {
          await Promise.allSettled(rowTasks);
        }
      } catch (error) {
        localErrors.push(`CSV processing failed: ${(error as Error).message}`);
      }

      finalizeProcessing();
    };

    reader.readAsText(csvFile);

    function finalizeProcessing() {
      setCsvSuccessCount(localSuccessCount);
      setCsvProcessingErrors(localErrors);
      setIsCsvProcessing(false);
      if (localSuccessCount > 0 && localErrors.length === 0) {
        toast({ title: "CSV Processed", description: `${localSuccessCount} readings added successfully.` });
      } else if (localSuccessCount > 0 && localErrors.length > 0) {
        toast({ title: "CSV Partially Processed", description: `${localSuccessCount} readings added. Some rows had errors.` });
      } else if (localErrors.length > 0) {
        toast({ variant: "destructive", title: "CSV Processing Failed", description: `No readings were added. Please check the errors.` });
      }
    }
  };

  const downloadCsvTemplate = () => {
    const csvString = readingCsvRequiredHeaders.join(',') + '\n';
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${meterType}_meter_reading_template.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <UIDialogTitle>Upload {meterType === 'individual' ? 'Individual Customer' : 'Bulk Meter'} Readings</UIDialogTitle>
          <UIDialogDescription>
            Upload a CSV file containing only the required fields below. Extra columns are not needed.
            Date format: dd/MM/yyyy (e.g., 16/12/2025).
          </UIDialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <div className="font-semibold">Required CSV columns</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {readingCsvRequiredHeaders.map((header) => (
                <span key={header} className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{header}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              className="flex-grow"
              disabled={isCsvProcessing}
            />
            <Button
              onClick={handleProcessCsvFile}
              disabled={!csvFile || isCsvProcessing}
              className="w-full sm:w-auto"
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {isCsvProcessing ? "Processing..." : `Upload`}
            </Button>
          </div>
          {csvSuccessCount > 0 && (
            <Alert variant="default" className="bg-green-50 dark:bg-green-900/30 border-green-300">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-700">Processing Complete</AlertTitle>
              <UIAlertDescription className="text-green-600">Successfully processed {csvSuccessCount} readings.</UIAlertDescription>
            </Alert>
          )}
          {csvProcessingErrors.length > 0 && (
            <Alert variant="destructive">
              <FileWarning className="h-5 w-5" />
              <AlertTitle>Processing Errors Found</AlertTitle>
              <UIAlertDescription>
                <ScrollArea className="mt-2 h-[150px] w-full rounded-md border p-2 bg-background">
                  <ul className="list-disc pl-5 space-y-1 text-xs">{csvProcessingErrors.map((error, index) => <li key={index}>{error}</li>)}</ul>
                </ScrollArea>
              </UIAlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={downloadCsvTemplate}><FileSpreadsheet className="mr-2 h-4 w-4" /> Download Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
