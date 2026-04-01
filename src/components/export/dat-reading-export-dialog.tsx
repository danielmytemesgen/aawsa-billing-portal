"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parse } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import JSZip from "jszip";

interface DatReadingExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: IndividualCustomer[];
  bulkMeters: BulkMeter[];
  branches: Branch[];
  initialType?: 'individual' | 'bulk';
}

// Order adjusted to match the MRT system requirement as seen in the screenshot
const readingHeaders = [
  "READ_PROC_ID", "ROUND_KEY", "WALK_ORDER", "INST_KEY", "INST_TYPE_CODE", "CUST_KEY", "CUST_NAME", "DISPLAY_ADDRESS", "BRANCH_NAME", "METER_KEY", "PREVIOUS_READING", "LAST_READING_DATE",
  "NUMBER_OF_DIALS", "METER_DIAMETER", "SHADOW_PCNT", "MIN_USAGE_QTY", "MIN_USAGE_AMOUNT",
  "CHARGE_GROUP", "USAGE_CODE", "SELL_CODE", "FREQUENCY", "SERVICE_CODE", "SHADOW_USAGE",
  "ESTIMATED_READING", "ESTIMATED_READING_LOW", "ESTIMATED_READING_HIGH", "ESTIMATED_READING_IND",
  "METER_READING", "READING_DATE", "METER_READER_CODE", "FAULT_CODE", "SERVICE_BILLED_UP_TO_DATE",
  "METER_MULTIPLY_FACTOR"
];

export function DatReadingExportDialog({ open, onOpenChange, customers, bulkMeters, branches, initialType = 'individual' }: DatReadingExportDialogProps) {
  const { toast } = useToast();
  const [meterType, setMeterType] = React.useState<'individual' | 'bulk'>(initialType);
  const [selectedMonth, setSelectedMonth] = React.useState<string>(format(new Date(), "yyyy-MM"));
  const [selectedRoute, setSelectedRoute] = React.useState<string>("all");
  const [isExporting, setIsExporting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMeterType(initialType || 'individual');
      setSelectedRoute("all");
    }
  }, [open, initialType]);

  const availableGroups = React.useMemo(() => {
    if (meterType === 'bulk') {
      const uniqueRoutes = Array.from(new Set(bulkMeters.filter(m => m.month === selectedMonth).map(m => m.routeKey).filter(Boolean)));
      return uniqueRoutes.map(rk => ({ value: rk, label: `Route: ${rk}` }));
    } else {
      const uniqueBooks = Array.from(new Set(customers.filter(c => c.month === selectedMonth).map(c => c.bookNumber).filter(Boolean)));
      return uniqueBooks.map(bn => ({ value: bn, label: `Book: ${bn}` }));
    }
  }, [meterType, selectedMonth, bulkMeters, customers]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const baseData = meterType === 'individual' ? customers : bulkMeters;
      const filteredData = baseData.filter(m => m.month === selectedMonth);

      if (filteredData.length === 0) {
        toast({
          variant: "destructive",
          title: "No Data Found",
          description: `No meters found for ${meterType} in ${selectedMonth}.`
        });
        setIsExporting(false);
        return;
      }

      const branchMap = new Map<string, string>(branches.map(b => [b.id, b.name]));

      const generateCSVContent = (data: any[]) => {
        const readProcId = Math.floor(10000000 + Math.random() * 90000000).toString();
        const rows = data.map(m => {
          const chargeGroupValue = (m as any).chargeGroup || (m as any).customerType || "";
          
          const baseDate = parse(selectedMonth, "yyyy-MM", new Date());
          const formattedBilledDate = format(baseDate, "01/MM/yyyy");
          const lastReadingDate = m.month ? format(parse(m.month, "yyyy-MM", new Date()), "01/MM/yyyy") : "";

          const rowData: Record<string, any> = {
            READ_PROC_ID: readProcId,
            ROUND_KEY: (m as any).routeKey || (m as any).bookNumber || "",
            WALK_ORDER: (m as any).ordinal !== undefined && (m as any).ordinal !== null ? String((m as any).ordinal) : "",
            INST_KEY: m.instKey || "",
            INST_TYPE_CODE: chargeGroupValue,
            CUST_KEY: m.customerKeyNumber,
            CUST_NAME: m.name,
            DISPLAY_ADDRESS: m.specificArea || "",
            BRANCH_NAME: branchMap.get((m as any).branchId || "") || "",
            METER_KEY: m.meterNumber || (m as any).meterKey || "",
            PREVIOUS_READING: m.currentReading ?? m.previousReading ?? 0,
            LAST_READING_DATE: lastReadingDate,
            NUMBER_OF_DIALS: (m as any).NUMBER_OF_DIALS || (m as any).numberOfDials || 5, // Default to 5 if missing
            METER_DIAMETER: m.meterSize !== undefined && m.meterSize !== null ? m.meterSize : 0,
            SHADOW_PCNT: (m as any).shadowPcnt || 0,
            MIN_USAGE_QTY: (m as any).minUsageQty || 0,
            MIN_USAGE_AMOUNT: (m as any).minUsageAmount || 0,
            CHARGE_GROUP: chargeGroupValue,
            USAGE_CODE: (m as any).usageCode || "WATER",
            SELL_CODE: (m as any).sellCode || "DEFSEL",
            FREQUENCY: (m as any).frequency || "M1",
            SERVICE_CODE: (m as any).serviceCode || "METERENT",
            SHADOW_USAGE: (m as any).shadowUsage || 0,
            ESTIMATED_READING: 0,
            ESTIMATED_READING_LOW: 0,
            ESTIMATED_READING_HIGH: 0,
            ESTIMATED_READING_IND: "",
            METER_READING: "", // For MRT filling
            READING_DATE: "", // For MRT filling
            METER_READER_CODE: (m as any).meterReaderCode || "DEFRDR",
            FAULT_CODE: "",
            SERVICE_BILLED_UP_TO_DATE: formattedBilledDate,
            METER_MULTIPLY_FACTOR: (m as any).meterMultiplyFactor || 1
          };


          return readingHeaders.map(header => {
            const val = (rowData as any)[header];
            return val === undefined || val === null ? "" : String(val).replace(/,/g, ' ');
          }).join(",");
        });

        return rows.join("\n"); // NO HEADER ROW
      };

      const downloadFile = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      if (selectedRoute === "all") {
        const grouped: Record<string, any[]> = {};
        filteredData.forEach(m => {
          const groupKey = (m as any).routeKey || (m as any).bookNumber || "Unassigned";
          if (!grouped[groupKey]) grouped[groupKey] = [];
          grouped[groupKey].push(m);
        });

        const zip = new JSZip();
        const dateStr = format(new Date(), "ddMMyyyy");
        
        Object.entries(grouped).forEach(([group, data]) => {
          const csvContent = generateCSVContent(data);
          zip.file(`${group}_${dateStr}.DAT`, csvContent);
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadFile(zipBlob, `mrt_export_all_${dateStr}.zip`);

        toast({
          title: "Batch Export Complete",
          description: `Generated a ZIP file containing ${Object.keys(grouped).length} MRT files.`
        });
      } else {
        const routeData = filteredData.filter(m =>
          ((m as any).routeKey || (m as any).bookNumber) === selectedRoute
        );
        const dateStr = format(new Date(), "ddMMyyyy");
        const csvContent = generateCSVContent(routeData);
        const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8;' });
        
        downloadFile(blob, `${selectedRoute}_${dateStr}.DAT`);
        
        toast({
          title: "Export Successful",
          description: `Exported data for ${selectedRoute}.`
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred during file generation."
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>MRT System Data Export (.DAT)</DialogTitle>
          <DialogDescription>
            Generate headerless .DAT files for the external MRT system. Files are named per route with the current date.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="m-type">Data Category</Label>
            <Select value={meterType} onValueChange={(v: any) => { setMeterType(v); setSelectedRoute("all"); }}>
              <SelectTrigger id="m-type">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual Billing (by Book)</SelectItem>
                <SelectItem value="bulk">Bulk Metering (by Route)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="m-month">Baseline Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="m-month">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(1); // Set to 1st of month to avoid date overflow (e.g., Mar 31 -> Feb 28)
                  d.setMonth(d.getMonth() - i);
                  const val = format(d, "yyyy-MM");
                  const label = format(d, "MMMM yyyy");
                  return <SelectItem key={val} value={val}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="m-route">Route / Book Selection</Label>
            <Select value={selectedRoute} onValueChange={setSelectedRoute}>
              <SelectTrigger id="m-route">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Available (Grouped into ZIP)</SelectItem>
                {availableGroups.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exporting..." : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {selectedRoute === "all" ? "Export All Routes" : "Export Selection"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
