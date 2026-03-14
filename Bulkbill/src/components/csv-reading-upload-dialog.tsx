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

const readingCsvHeaders = ["meter_number", "reading_value", "reading_date", "branch_id"];
const CSV_SPLIT_REGEX = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;

// Schema now validates for YYYY-MM format.
const readingCsvRowSchema = z.object({
  meter_number: z.string().min(1, { message: "meter_number is required." }),
  reading_value: z.coerce.number().min(0, { message: "reading_value must be a non-negative number." }),
  reading_date: z.string().regex(/^\d{4}-\d{2}$/, { message: "Value must be in YYYY-MM format (e.g., 2024-05)." }),
  branch_id: z.string().optional(),
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
      const requiredHeaders = ["meter_number", "reading_value", "reading_date"];
      const hasRequiredHeaders = requiredHeaders.every(rh => headerLine.includes(rh));

      if (!hasRequiredHeaders) {
         localErrors.push(`Invalid CSV headers. Expected at least: "${requiredHeaders.join(", ")}".`);
         finalizeProcessing();
         return;
      }
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(CSV_SPLIT_REGEX).map(v => v.trim().replace(/^\"|\"$/g, ''));
        const rowData = Object.fromEntries(headerLine.map((header, index) => [header, values[index]]));

        try {
          const validatedRow = readingCsvRowSchema.parse(rowData);
          const parsedMonthDate = parse(validatedRow.reading_date, 'yyyy-MM', new Date());
          const endOfMonthDate = lastDayOfMonth(parsedMonthDate);

          let meterPool = meters;
          if (validatedRow.branch_id) {
            meterPool = meters.filter(m => (m as any).branchId === validatedRow.branch_id);
          }

          const meter = meterPool.find(m => m.meterNumber === validatedRow.meter_number);

          if (!meter) {
            let errorMsg = `Row ${i + 1}: Meter number '${validatedRow.meter_number}' not found for this meter type.`;
            if (validatedRow.branch_id) {
              errorMsg += ` in branch '${validatedRow.branch_id}'`;
            }
            localErrors.push(errorMsg);
            continue;
          }
          
          let result;
          if (meterType === 'individual') {
            result = await addIndividualCustomerReading({
              individualCustomerId: meter.customerKeyNumber,
              readerStaffId: currentUser.id,
              readingDate: format(endOfMonthDate, "yyyy-MM-dd"),
              monthYear: validatedRow.reading_date,
              readingValue: validatedRow.reading_value,
              isEstimate: false,
              notes: `CSV Upload by ${currentUser.email}`,
            });
          } else { // bulk
            result = await addBulkMeterReading({
              bulkMeterId: meter.customerKeyNumber,
              readerStaffId: currentUser.id,
              readingDate: format(endOfMonthDate, "yyyy-MM-dd"),
              monthYear: validatedRow.reading_date,
              readingValue: validatedRow.reading_value,
              isEstimate: false,
              notes: `CSV Upload by ${currentUser.email}`,
            });
          }

          if (result && result.success) {
            localSuccessCount++;
          } else {
            localErrors.push(`Row ${i + 1} (${validatedRow.meter_number}): ${result.message || 'Unknown error.'}`);
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
    const csvString = readingCsvHeaders.join(',') + '\n';
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "meter_reading_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <UIDialogTitle>Upload {meterType === 'individual' ? 'Individual Customer' : 'Bulk Meter'} Readings</UIDialogTitle>
          <UIDialogDescription>
              Select a CSV file with columns: meter_number, reading_value, reading_date (in YYYY-MM format, e.g., 2024-05), and an optional branch_id.
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
