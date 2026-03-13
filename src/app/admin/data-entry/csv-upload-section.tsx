
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
            const errorMessages = error.issues.map(issue => `Row ${i + 1}, Column '${issue.path.join('.')}': ${issue.message}`).join("; ");
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
        toast({ title: "Upload Successful", description: `${localSuccessCount} records were successfully imported and are pending approval.` });
      } else if (localErrors.length > 0 && localSuccessCount > 0) {
        toast({ title: "Partial Success", description: `Imported ${localSuccessCount} records (pending approval), but ${localErrors.length} rows had errors.` });
      } else if (localErrors.length > 0) {
        toast({ variant: "destructive", title: "Upload Failed", description: "The CSV file contained errors and no records were imported." });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* File Drop/Selection Zone */}
      <div 
        className={`relative group border-2 border-dashed rounded-3xl p-10 transition-all duration-300 text-center
          ${file ? 'border-primary/50 bg-primary/5' : 'border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-900/30'}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const droppedFile = e.dataTransfer.files?.[0];
          if (droppedFile) {
            if (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv")) {
              setFile(droppedFile);
            } else {
              toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a valid .csv file." });
            }
          }
        }}
      >
        <input 
          ref={fileInputRef} 
          type="file" 
          accept=".csv" 
          onChange={handleFileChange} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className={`p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110 
            ${file ? 'bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
            <UploadCloud className="h-8 w-8" />
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">
              {file ? file.name : "Choose CSV File"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {file ? `${(file.size / 1024).toFixed(2)} KB • Ready to process` : "Drag and drop or click to browse files"}
            </p>
          </div>

          {file && !isProcessing && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="mt-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                resetState();
              }}
            >
              Clear Selection
            </Button>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button 
          onClick={processCsvFile} 
          disabled={!file || isProcessing} 
          className="w-full md:w-auto px-10 py-6 rounded-2xl shadow-xl hover:shadow-primary/20 transition-all duration-300 font-bold text-lg"
        >
          {isProcessing ? (
            <>
              <div className="mr-3 h-5 w-5 border-2 border-slate-200 border-t-white rounded-full animate-spin" />
              Processing... {Math.round(processingProgress)}%
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-5 w-5" />
              Upload & Process for Approval
            </>
          )}
        </Button>
      </div>

      {/* Progress & Results */}
      {(isProcessing || successCount > 0 || processingErrors.length > 0) && (
        <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-500">
                <span>Overall Progress</span>
                <span>{Math.round(processingProgress)}%</span>
              </div>
              <Progress 
                value={processingProgress} 
                className="h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800" 
              />
            </div>
          )}

          {successCount > 0 && (
            <Alert variant="default" className="rounded-2xl border-green-100 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900/20 backdrop-blur-sm">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-800 dark:text-green-300 font-bold">Import Successful</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-400">
                Successfully processed and recorded <span className="font-bold">{successCount}</span> records.
              </AlertDescription>
            </Alert>
          )}

          {processingErrors.length > 0 && (
            <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/5 backdrop-blur-sm">
              <FileWarning className="h-5 w-5 text-destructive" />
              <AlertTitle className="font-bold">Errors Encountered ({processingErrors.length})</AlertTitle>
              <AlertDescription>
                <ScrollArea className="mt-3 h-[180px] w-full rounded-xl border border-destructive/10 p-4 bg-white/50 dark:bg-slate-900/50">
                  <ul className="space-y-2">
                    {processingErrors.map((error, index) => (
                      <li key={index} className="text-xs flex gap-2 text-destructive/80 leading-relaxed">
                        <span className="font-bold opacity-50 flex-shrink-0">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

