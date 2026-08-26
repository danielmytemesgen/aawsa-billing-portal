
import * as React from "react";
import * as XLSX from 'xlsx';
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, FileWarning, UploadCloud, Copy, Download, Search, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface CsvUploadSectionProps {
  entryType: "bulk" | "individual";
  schema: z.ZodTypeAny;
  addRecordFunction: (data: any) => Promise<{ success: boolean; message?: string; error?: any; data?: any; } | void>;
  expectedHeaders: string[];
  /** Optional: if provided, all validated rows are sent in one call instead of N individual calls. */
  batchUploadFunction?: (rows: any[]) => Promise<{ success: boolean; inserted?: number; errors?: string[] }>;
}

// Regex to handle commas inside quoted fields
const CSV_SPLIT_REGEX = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;

// Header Alias Map for flexible user-friendly CSV ingestion
const HEADER_ALIAS_MAP: Record<string, string> = {
  // NUMBER_OF_DIALS
  numberofdials: "NUMBER_OF_DIALS",
  number_of_dials: "NUMBER_OF_DIALS",
  dials: "NUMBER_OF_DIALS",
  numdials: "NUMBER_OF_DIALS",
  // meterNumber / METER_KEY
  meternumber: "meterNumber",
  meter_number: "meterNumber",
  meterkey: "meterNumber",
  meter_key: "meterNumber",
  // customerKeyNumber
  customerkeynumber: "customerKeyNumber",
  customer_key_number: "customerKeyNumber",
  customerkey: "customerKeyNumber",
  customer_key: "customerKeyNumber",
  // instKey
  instkey: "instKey",
  inst_key: "instKey",
  // contractNumber
  contractnumber: "contractNumber",
  contract_number: "contractNumber",
  contractno: "contractNumber",
  contract_no: "contractNumber",
  // customertype
  customertype: "customerType",
  customer_type: "customerType",
  // previousReading
  previousreading: "previousReading",
  previous_reading: "previousReading",
  prevreading: "previousReading",
  prev_reading: "previousReading",
  // currentReading
  currentreading: "currentReading",
  current_reading: "currentReading",
  currreading: "currentReading",
  curr_reading: "currentReading",
  // specificArea
  specificarea: "specificArea",
  specific_area: "specificArea",
  area: "specificArea",
  // subCity
  subcity: "subCity",
  sub_city: "subCity",
  // phoneNumber
  phonenumber: "phoneNumber",
  phone_number: "phoneNumber",
  phone: "phoneNumber",
  mobile: "phoneNumber",
  // chargeGroup
  chargegroup: "chargeGroup",
  charge_group: "chargeGroup",
  // sewerageConnection
  sewerageconnection: "sewerageConnection",
  sewerage_connection: "sewerageConnection",
  sewerage: "sewerageConnection",
  // assignedBulkMeterId
  assignedbulkmeterid: "assignedBulkMeterId",
  assigned_bulk_meter_id: "assignedBulkMeterId",
  bulkmeterid: "assignedBulkMeterId",
  bulk_meter_id: "assignedBulkMeterId",
  bulkmeterkey: "assignedBulkMeterId",
  // branchId
  branchid: "branchId",
  branch_id: "branchId",
  branch: "branchId",
  // coordinates
  xcoordinate: "xCoordinate",
  x_coordinate: "xCoordinate",
  latitude: "xCoordinate",
  lat: "xCoordinate",
  x: "xCoordinate",
  ycoordinate: "yCoordinate",
  y_coordinate: "yCoordinate",
  longitude: "yCoordinate",
  long: "yCoordinate",
  lng: "yCoordinate",
  y: "yCoordinate",
  zcoordinate: "zCoordinate",
  z_coordinate: "zCoordinate",
  altitude: "zCoordinate",
  alt: "zCoordinate",
  z: "zCoordinate",
  // routeKey
  routekey: "routeKey",
  route_key: "routeKey",
  route: "routeKey",
};

export function CsvUploadSection({ schema, addRecordFunction, expectedHeaders, batchUploadFunction }: CsvUploadSectionProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [previewRowCount, setPreviewRowCount] = React.useState<number | null>(null);
  const [missingHeaderWarnings, setMissingHeaderWarnings] = React.useState<string[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingProgress, setProcessingProgress] = React.useState(0);
  const [processingErrors, setProcessingErrors] = React.useState<string[]>([]);
  const [successCount, setSuccessCount] = React.useState(0);
  const [copiedErrors, setCopiedErrors] = React.useState(false);
  const [errorSearch, setErrorSearch] = React.useState("");

  const resetState = () => {
    setFile(null);
    setIsDragOver(false);
    setPreviewRowCount(null);
    setMissingHeaderWarnings([]);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingErrors([]);
    setSuccessCount(0);
    setErrorSearch("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const normalizeHeaderKey = (h: string) => h.trim().replace(/^\uFEFF/, '').replace(/[\s_-]+/g, '').toLowerCase();

  const parseAndPreviewFile = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string || '').replace(/\uFEFF/g, '');
      const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(l => l !== '' && !l.startsWith('#'));
      const rowCount = Math.max(0, lines.length - 1);
      setPreviewRowCount(rowCount);

      if (lines.length > 0) {
        const csvHeaders = lines[0].split(CSV_SPLIT_REGEX).map(h => h.trim().replace(/^"|"$/g, ''));
        const matchedHeaders = new Set<string>();

        csvHeaders.forEach(h => {
          const norm = normalizeHeaderKey(h);
          const alias = HEADER_ALIAS_MAP[norm] || expectedHeaders.find(eh => normalizeHeaderKey(eh) === norm);
          if (alias) {
            matchedHeaders.add(alias);
          }
        });

        // Check required headers that aren't optional in schemas
        const missing = expectedHeaders.filter(h => {
          // branchId, customerKeyNumber, instKey, xCoordinate, yCoordinate, zCoordinate, routeKey are optional
          const optionalSet = new Set(["branchId", "customerKeyNumber", "instKey", "xCoordinate", "yCoordinate", "zCoordinate", "routeKey", "ordinal", "faultCode"]);
          if (optionalSet.has(h)) return false;
          return !matchedHeaders.has(h);
        });

        setMissingHeaderWarnings(missing);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProcessingErrors([]);
    setSuccessCount(0);
    setIsProcessing(false);
    setPreviewRowCount(null);
    setMissingHeaderWarnings([]);

    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast({ variant: "destructive", title: "File Too Large", description: "CSV file must be under 50MB." });
        return;
      }
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
        parseAndPreviewFile(selectedFile);
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
      const text = (e.target?.result as string || '').replace(/\uFEFF/g, '');
      const rawLines = text.split(/\r\n|\n/);
      const lines = rawLines
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith('#'));

      if (lines.length < 2) {
        localErrors.push("CSV file must contain a header row and at least one data row.");
        setProcessingErrors(localErrors);
        setIsProcessing(false);
        return;
      }

      const headerLine = lines[0].split(CSV_SPLIT_REGEX).map(h => h.trim().replace(/^"|"$/g, ''));
      const headerIndexMap: Record<string, number> = {};

      headerLine.forEach((rawHeader, idx) => {
        const norm = normalizeHeaderKey(rawHeader);
        const canonical = HEADER_ALIAS_MAP[norm] || expectedHeaders.find(eh => normalizeHeaderKey(eh) === norm) || rawHeader;
        headerIndexMap[canonical] = idx;
      });

      const totalRows = lines.length - 1;

      // ─────────────────────────────────────────────────────────────────
      // PHASE 1: Asynchronous client-side row validation & normalization
      // ─────────────────────────────────────────────────────────────────
      const validatedRows: any[] = [];
      const validationChunkSize = 250;

      for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
        const values = lines[rowIndex].split(CSV_SPLIT_REGEX).map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: Record<string, any> = {};

        expectedHeaders.forEach((expectedHeader) => {
          const indexInCSV = headerIndexMap[expectedHeader];
          const rawVal = indexInCSV !== undefined && indexInCSV !== -1 ? values[indexInCSV] : undefined;
          
          if (rawVal === "" || rawVal === undefined || rawVal === "null" || rawVal === "undefined") {
            rowData[expectedHeader] = undefined;
          } else {
            rowData[expectedHeader] = rawVal;
          }
        });

        // Numeric fields normalization
        ["previousReading", "currentReading", "meterSize", "NUMBER_OF_DIALS", "ordinal"].forEach(k => {
          if (rowData[k] !== undefined && rowData[k] !== null && typeof rowData[k] === 'string') {
            const num = parseFloat(rowData[k]);
            if (!isNaN(num)) rowData[k] = num;
          }
        });

        // Coordinate normalization
        if (rowData.xCoordinate !== undefined && typeof rowData.xCoordinate === 'string') {
          const n = parseFloat(rowData.xCoordinate);
          rowData.xCoordinate = isNaN(n) ? undefined : n;
        }
        if (rowData.yCoordinate !== undefined && typeof rowData.yCoordinate === 'string') {
          const n = parseFloat(rowData.yCoordinate);
          rowData.yCoordinate = isNaN(n) ? undefined : n;
        }
        if (rowData.zCoordinate !== undefined && typeof rowData.zCoordinate === 'string') {
          const n = parseFloat(rowData.zCoordinate);
          rowData.zCoordinate = isNaN(n) ? undefined : n;
        }

        try {
          const validatedData = schema.parse(rowData);
          validatedRows.push(validatedData);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorMessages = error.issues.map(issue => `Row ${rowIndex + 1}, Field '${issue.path.join('.')}': ${issue.message}`).join("; ");
            localErrors.push(errorMessages);
          } else {
            localErrors.push(`Row ${rowIndex + 1}: Validation failed. ${(error as Error).message}`);
          }
        }

        if (rowIndex % validationChunkSize === 0) {
          setProcessingProgress(Math.round((rowIndex / totalRows) * 20));
          await new Promise((res) => setTimeout(res, 0));
        }
      }

      setProcessingProgress(20);

      // ─────────────────────────────────────────────────────────────────
      // PHASE 2: Chunked Server Processing (500 records per HTTP batch)
      // ─────────────────────────────────────────────────────────────────
      if (validatedRows.length > 0) {
        if (batchUploadFunction) {
          const CHUNK_SIZE = 500;
          const totalChunks = Math.ceil(validatedRows.length / CHUNK_SIZE);

          for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
            const startIdx = chunkIdx * CHUNK_SIZE;
            const chunkRows = validatedRows.slice(startIdx, startIdx + CHUNK_SIZE);

            try {
              const result = await batchUploadFunction(chunkRows);
              if (result?.success) {
                localSuccessCount += result.inserted ?? chunkRows.length;
                if (result.errors && result.errors.length > 0) {
                  localErrors.push(...result.errors);
                }
              } else {
                const details = result?.errors?.length
                  ? result.errors.join('; ')
                  : (result as any)?.error?.message || JSON.stringify(result);
                localErrors.push(`Batch ${chunkIdx + 1}/${totalChunks} failed: ${details}`);
              }
            } catch (err: any) {
              let message = 'Unknown error occurred';
              if (err?.message) {
                message = err.message;
              } else if (err?.error?.message) {
                message = err.error.message;
              } else if (typeof err === 'string') {
                message = err;
              } else if (err?.digest) {
                message = `Server error (digest: ${err.digest}). Check server logs.`;
              }
              localErrors.push(`Batch ${chunkIdx + 1}/${totalChunks} error: ${message}`);
            }

            const currentProgress = 20 + Math.round(((chunkIdx + 1) / totalChunks) * 80);
            setProcessingProgress(currentProgress);
            setSuccessCount(localSuccessCount);
            setProcessingErrors([...localErrors]);

            await new Promise((res) => setTimeout(res, 0));
          }
        } else {
          const concurrencyLimit = 15;
          for (let i = 0; i < validatedRows.length; i += concurrencyLimit) {
            const chunk = validatedRows.slice(i, i + concurrencyLimit);
            await Promise.all(chunk.map(async (validatedData, chunkIdx) => {
              const rowIndex = i + chunkIdx;
              try {
                const result = await addRecordFunction(validatedData);
                if (result && result.success) {
                  localSuccessCount++;
                } else {
                  localErrors.push(`Row ${rowIndex + 2}: ${result?.message || 'An unknown error occurred.'}`);
                }
              } catch (error) {
                localErrors.push(`Row ${rowIndex + 2}: An unexpected error occurred. ${(error as Error).message}`);
              }
            }));
            setProcessingProgress(20 + Math.round(((i + chunk.length) / validatedRows.length) * 80));
            setSuccessCount(localSuccessCount);
          }
        }
      }

      setProcessingProgress(100);
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

  const copyErrorsToClipboard = () => {
    if (processingErrors.length === 0) return;
    const text = processingErrors.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedErrors(true);
    setTimeout(() => setCopiedErrors(false), 2000);
    toast({ title: "Errors Copied", description: "Error details copied to clipboard." });
  };

  const downloadErrorLog = () => {
    if (processingErrors.length === 0) return;
    const text = `AAWSA Billing Portal - CSV Import Error Log\nGenerated: ${new Date().toISOString()}\nTotal Errors: ${processingErrors.length}\n\n` + processingErrors.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `import_errors_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const filteredErrors = processingErrors.filter(err =>
    !errorSearch ? true : err.toLowerCase().includes(errorSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* File Drop/Selection Zone */}
      <div 
        className={`relative group border-2 border-dashed rounded-3xl p-10 transition-all duration-300 text-center
          ${
            isDragOver
              ? 'border-primary bg-primary/10 scale-[1.01] shadow-lg shadow-primary/20'
              : file
                ? 'border-primary/50 bg-primary/5'
                : 'border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-900/30'
          }`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          setPreviewRowCount(null);
          setMissingHeaderWarnings([]);
          const droppedFile = e.dataTransfer.files?.[0];
          if (droppedFile) {
            if (droppedFile.size > 50 * 1024 * 1024) {
              toast({ variant: "destructive", title: "File Too Large", description: "CSV file must be under 50MB." });
              return;
            }
            if (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv")) {
              setFile(droppedFile);
              parseAndPreviewFile(droppedFile);
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
              {file ? file.name : (isDragOver ? "Drop your file here!" : "Choose CSV File")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {file
                ? `${(file.size / 1024).toFixed(2)} KB${previewRowCount !== null ? ` • ${previewRowCount} data row${previewRowCount !== 1 ? 's' : ''} detected` : ''} • Ready to process`
                : (isDragOver ? "Release to upload" : "Drag and drop or click to browse files")}
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

      {/* Missing headers warning */}
      {missingHeaderWarnings.length > 0 && file && !isProcessing && (
        <Alert className="rounded-2xl border-amber-200 bg-amber-50/80 dark:bg-amber-900/10 dark:border-amber-800/30">
          <FileWarning className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300 font-bold">Required Columns Missing</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
            The following required columns were not recognized in your CSV header:
            <ul className="mt-1 list-disc list-inside">
              {missingHeaderWarnings.map((h, i) => (
                <li key={i} className="font-mono text-xs font-bold">{h}</li>
              ))}
            </ul>
            <p className="mt-1.5">Download the official Template above to ensure columns match.</p>
          </AlertDescription>
        </Alert>
      )}

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
                Successfully processed and recorded <span className="font-bold">{successCount}</span> records for approval.
              </AlertDescription>
            </Alert>
          )}

          {processingErrors.length > 0 && (
            <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/5 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-destructive/10">
                <div className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-destructive" />
                  <AlertTitle className="font-bold text-destructive">
                    Errors Encountered ({processingErrors.length})
                  </AlertTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyErrorsToClipboard}
                    className="h-8 rounded-xl text-xs gap-1 border-destructive/20 hover:bg-destructive/10"
                  >
                    {copiedErrors ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedErrors ? "Copied" : "Copy Errors"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadErrorLog}
                    className="h-8 rounded-xl text-xs gap-1 border-destructive/20 hover:bg-destructive/10"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Log
                  </Button>
                </div>
              </div>

              <AlertDescription className="pt-3">
                {processingErrors.length > 5 && (
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter error lines..."
                      value={errorSearch}
                      onChange={(e) => setErrorSearch(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-xl bg-white/60 dark:bg-slate-900/60"
                    />
                  </div>
                )}
                <ScrollArea className="h-[200px] w-full rounded-xl border border-destructive/10 p-4 bg-white/50 dark:bg-slate-900/50">
                  <ul className="space-y-2">
                    {filteredErrors.map((error, index) => (
                      <li key={index} className="text-xs flex gap-2 text-destructive/80 leading-relaxed font-mono">
                        <span className="font-bold opacity-50 flex-shrink-0">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                    {filteredErrors.length === 0 && (
                      <li className="text-xs text-muted-foreground">No errors matched your filter.</li>
                    )}
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


