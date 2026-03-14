"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter } from "@/components/ui/dialog";
import { UploadCloud, FileSpreadsheet, FileWarning, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { addIndividualCustomerReading, addBulkMeterReading } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
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

const readingCsvHeaders = [
  "ROUND_KEY", "WALK_ORDER", "INST_KEY", "INST_TYPE_CODE", "CUST_KEY", "CUST_NAME",
  "DISPLAY_ADDRESS", "BRANCH_NAME", "METER_KEY", "PREVIOUS_READING", "LAST_READING_DATE",
  "NUMBER_OF_DIALS", "METER_DIAMETER", "SHADOW_PCNT", "MIN_USAGE_QTY", "MIN_USAGE_AMOUNT",
  "CHARGE_GROUP", "USAGE_CODE", "SELL_CODE", "FREQUENCY", "SERVICE_CODE", "SHADOW_USAGE",
  "ESTIMATED_READING", "ESTIMATED_READING_LOW", "ESTIMATED_READING_HIGH", "ESTIMATED_READING_IND",
  "METER_READING", "READING_DATE", "METER_READER_CODE", "FAULT_CODE", "SERVICE_BILLED_UP_TO_DATE",
  "METER_MULTIPLY_FACTOR", "LATITUDE", "LONGITUDE", "ALTITUDE", "PHONE_NUMBER"
];
const CSV_SPLIT_REGEX = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;

// Schema now validates for YYYY-MM format.
const readingCsvRowSchema = z.object({
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
  METER_MULTIPLY_FACTOR: z.coerce.number().optional(),
  LATITUDE: z.coerce.number().optional(),
  LONGITUDE: z.coerce.number().optional(),
  ALTITUDE: z.coerce.number().optional(),
  PHONE_NUMBER: z.string().optional(),
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

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    onOpenChange(isOpen);
  };

  const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv")) {
        setCsvFile(selectedFile);
        setCsvProcessingErrors([]);
        setCsvSuccessCount(0);
      } else {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a valid .csv file." });
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

    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
      if (lines.length < 2) {
        localErrors.push("CSV must contain a header and at least one data row.");
        finalizeProcessing();
        return;
      }

      const headerLine = lines[0].split(CSV_SPLIT_REGEX).map(h => h.trim().replace(/^\"|\"$/g, ''));

      const requiredHeaders = readingCsvHeaders;

      const missingHeaders = requiredHeaders.filter(rh => !headerLine.includes(rh));

      if (missingHeaders.length > 0) {
        localErrors.push(`Invalid CSV headers. Missing: ${missingHeaders.join(", ")}`);
        finalizeProcessing();
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(CSV_SPLIT_REGEX).map(v => v.trim().replace(/^\"|\"$/g, ''));
        const rowData = Object.fromEntries(headerLine.map((header, index) => [header, values[index]]));

        try {
          let validatedRow: any;
          let parsedDate = new Date();
          let monthYearStr = "";
          let meterReadingVal = 0;
          let customerKeyVal = "";

          // Use the same schema for both
          validatedRow = readingCsvRowSchema.parse(rowData);
          customerKeyVal = validatedRow.CUST_KEY;
          meterReadingVal = validatedRow.METER_READING;

          const dateStr = validatedRow.READING_DATE;
          if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            // User requested format: 16/12/2025
            parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
            if (!isValid(parsedDate)) throw new Error("Invalid date format. Expected dd/MM/yyyy");
            monthYearStr = format(parsedDate, 'yyyy-MM');
          } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
            parsedDate = parse(dateStr, 'yyyy-MM', new Date());
            parsedDate = lastDayOfMonth(parsedDate);
            monthYearStr = dateStr;
          } else {
            parsedDate = new Date(dateStr);
            if (!isValid(parsedDate)) throw new Error("Invalid date");
            monthYearStr = format(parsedDate, 'yyyy-MM');
          }

          let meterPool = meters as any[];
          // For bulk, filter by branch if needed - though the schema doesn't strictly depend on it in rich mode as CUST_KEY is unique
          // validatedRow.BRANCH_NAME is available but finding by key is better.

          let meter = undefined;
          if (meterType === 'individual') {
            meter = meterPool.find((m: any) => m.customerKeyNumber === customerKeyVal);
            if (!meter && (validatedRow as any).METER_KEY) {
              meter = meterPool.find((m: any) => m.meterNumber === (validatedRow as any).METER_KEY);
            }
          } else {
            // Bulk
            meter = meterPool.find((m: any) => m.customerKeyNumber === customerKeyVal);
            if (!meter && (validatedRow as any).METER_KEY) {
              meter = meterPool.find((m: any) => m.meterNumber === (validatedRow as any).METER_KEY);
            }
          }

          if (!meter) {
            localErrors.push(`Row ${i + 1}: Meter '${customerKeyVal}' not found.`);
            continue;
          }

          // Helper Function safely inside the loop or logic block
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

          const commonPayload = {
            readerStaffId: currentUser.id,
            readingDate: format(parsedDate, "yyyy-MM-dd"),
            monthYear: monthYearStr,
            readingValue: meterReadingVal,



            // New mapped fields common to both now
            roundKey: validatedRow.ROUND_KEY,
            walkOrder: validatedRow.WALK_ORDER,
            instKey: validatedRow.INST_KEY,
            instTypeCode: validatedRow.INST_TYPE_CODE,
            // custKey/CUSTOMERKEY handled per type below
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
            meterMultiplyFactor: validatedRow.METER_MULTIPLY_FACTOR,
            latitude: validatedRow.LATITUDE,
            longitude: validatedRow.LONGITUDE,
            altitude: validatedRow.ALTITUDE,
            phoneNumber: validatedRow.PHONE_NUMBER,
          };

          let result;
          if (meterType === 'individual') {
            const calculatedUsage = (validatedRow.METER_READING ?? 0) - (validatedRow.PREVIOUS_READING ?? 0);

            result = await addIndividualCustomerReading({
              individualCustomerId: meter.customerKeyNumber,
              custKey: validatedRow.CUST_KEY,
              shadowUsage: calculatedUsage, // Set usage here
              ...commonPayload
            });
          } else { // bulk
            // Bulk reading supports full parity now
            result = await addBulkMeterReading({
              CUSTOMERKEY: meter.customerKeyNumber,
              custKey: validatedRow.CUST_KEY,
              shadowUsage: (validatedRow.METER_READING ?? 0) - (validatedRow.PREVIOUS_READING ?? 0),
              ...commonPayload
            });
          }

          if (result && result.success) {
            localSuccessCount++;
          } else {
            localErrors.push(`Row ${i + 1} (${customerKeyVal}): ${result?.message || 'Unknown error.'}`);
          }

        } catch (error) {
          if (error instanceof ZodError) {
            const errorMessages = error.issues.map(issue => `Row ${i + 1}, Column '${issue.path.join('.')}' : ${issue.message}`).join("; ");
            localErrors.push(errorMessages);
          } else {
            localErrors.push(`Row ${i + 1}: Unknown validation error. ${(error as Error).message}`);
          }
        }
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
    // Both types now use the rich header set
    const csvString = readingCsvHeaders.join(',') + '\n';
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
            Select a CSV file with the comprehensive list of columns matching the standard template.
            Date format: dd/MM/yyyy (e.g., 16/12/2025).
          </UIDialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
