
"use client";

import * as React from "react";
import * as XLSX from 'xlsx';
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, FileWarning, UploadCloud } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface CsvUploadSectionProps {
  entryType: "bulk" | "individual";
  // Accept ZodObject or ZodEffects wrapping a ZodObject to handle refined schemas
  schema: z.ZodTypeAny;
  addRecordFunction: (data: any) => Promise<{ success: boolean; message?: string; error?: any; data?: any; } | void>;
  expectedHeaders: string[];
}

// Regex to handle commas inside quoted fields
const CSV_SPLIT_REGEX = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;

export function CsvUploadSection({ schema, addRecordFunction, expectedHeaders }: CsvUploadSectionProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingProgress, setProcessingProgress] = React.useState(0);
  const [processingErrors, setProcessingErrors] = React.useState<string[]>([]);
  const [successCount, setSuccessCount] = React.useState(0);

  const resetState = () => {
    setFile(null);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingErrors([]);
    setSuccessCount(0);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Don't clear the file input element before reading event.target.files —
    // doing so loses the selection in some browsers. Only reset transient UI state
    // (errors/progress/counts) so a new selection is clean.
    setProcessingErrors([]);
    setSuccessCount(0);
    setIsProcessing(false);

    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
      } else {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a valid .csv file." });
      }
    }
  };

  const processCsvFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    const localErrors: string[] = [];
    let localSuccessCount = 0;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
      
      if (lines.length < 2) {
        localErrors.push("CSV file must contain a header row and at least one data row.");
        setProcessingErrors(localErrors);
        setIsProcessing(false);
        return;
      }
      
      const headerLine = lines[0].split(CSV_SPLIT_REGEX).map(h => h.trim().replace(/^"|"$/g, ''));
      if (headerLine.length !== expectedHeaders.length || !expectedHeaders.every((h, i) => h === headerLine[i])) {
        localErrors.push(`Invalid CSV headers. Expected: "${expectedHeaders.join(", ")}".`);
        setProcessingErrors(localErrors);
        setIsProcessing(false);
        return;
      }
      
      const totalRows = lines.length - 1;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(CSV_SPLIT_REGEX).map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData = Object.fromEntries(headerLine.map((header, index) => [header, values[index] || undefined]));
        
        try {
          const validatedData = schema.parse(rowData);
          const result = await addRecordFunction(validatedData);
          if (result && result.success) {
            localSuccessCount++;
          } else {
            localErrors.push(`Row ${i + 1}: ${result?.message || 'An unknown error occurred.'}`);
          }
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorMessages = error.issues.map(issue => `Row ${i + 1}, Column '${issue.path.join('.')}}': ${issue.message}`).join("; ");
            localErrors.push(errorMessages);
          } else {
            localErrors.push(`Row ${i + 1}: An unexpected error occurred during processing. ${(error as Error).message}`);
          }
        }
        setProcessingProgress(((i) / totalRows) * 100);
      }
      
      setSuccessCount(localSuccessCount);
      setProcessingErrors(localErrors);
      setIsProcessing(false);

      if (localErrors.length === 0 && localSuccessCount > 0) {
        toast({ title: "Upload Successful", description: `${localSuccessCount} records were successfully imported.` });
      } else if (localErrors.length > 0 && localSuccessCount > 0) {
        toast({ title: "Partial Success", description: `Imported ${localSuccessCount} records, but ${localErrors.length} rows had errors.` });
      } else if (localErrors.length > 0) {
        toast({ variant: "destructive", title: "Upload Failed", description: "The CSV file contained errors and no records were imported." });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="flex-grow"/>
        <Button onClick={processCsvFile} disabled={!file || isProcessing} className="w-full sm:w-auto">
          <UploadCloud className="mr-2 h-4 w-4" />
          {isProcessing ? `Processing... (${Math.round(processingProgress)}%)` : "Upload & Process"}
        </Button>
      </div>
      
      {isProcessing && <Progress value={processingProgress} className="w-full" />}
      
      {successCount > 0 && (
        <Alert variant="default" className="bg-green-50 dark:bg-green-900/30 border-green-300">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <AlertTitle className="text-green-700">Processing Complete</AlertTitle>
            <AlertDescription className="text-green-600">Successfully processed {successCount} record(s).</AlertDescription>
        </Alert>
      )}

      {processingErrors.length > 0 && (
        <Alert variant="destructive">
          <FileWarning className="h-5 w-5" />
          <AlertTitle>Processing Errors</AlertTitle>
          <AlertDescription>
            <ScrollArea className="mt-2 h-[150px] w-full rounded-md border p-2 bg-background">
                <ul className="list-disc pl-5 space-y-1 text-xs">
                    {processingErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                    ))}
                </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

