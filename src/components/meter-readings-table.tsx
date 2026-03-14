
"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DisplayReading } from "@/lib/data-store";
import { format, parseISO } from "date-fns";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { ReadingDetailsDialog, type ReadingData } from "@/components/reading-details-dialog";

interface MeterReadingsTableProps {
  data: DisplayReading[];
}

const MeterReadingsTable: React.FC<MeterReadingsTableProps> = ({ data }) => {
  const [selectedReading, setSelectedReading] = React.useState<ReadingData | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);

  const handleViewDetails = (reading: DisplayReading) => {
    const mappedData: ReadingData = {
        id: reading.id,
        meterIdentifier: reading.meterIdentifier,
        meterId: reading.meterId || "N/A",
        meterType: reading.meterType === 'bulk' ? 'Bulk' : 'Individual',
        previousReading: reading.previousReading,
        currentReading: reading.readingValue,
        usage: reading.readingValue - reading.previousReading,
        readingDate: reading.readingDate,
        monthYear: reading.monthYear,
        notes: reading.notes || undefined,
        // readerName and branchName aren't in DisplayReading but are optional in ReadingData
    };
    setSelectedReading(mappedData);
    setIsDetailsOpen(true);
  };

  return (
    <div className="mt-2 text-primary">
      {/* Reading Details Dialog */}
      <ReadingDetailsDialog 
        open={isDetailsOpen} 
        onOpenChange={setIsDetailsOpen} 
        reading={selectedReading} 
      />

      {/* Desktop Table */}
      <div className="hidden md:block rounded-md border text-sm overflow-hidden bg-white/50 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead className="font-bold">Meter Identifier</TableHead>
              <TableHead className="font-bold">Type</TableHead>
              <TableHead className="text-right font-bold">Reading Value</TableHead>
              <TableHead className="font-bold">Reading Date</TableHead>
              <TableHead className="font-bold">Month/Year</TableHead>
              <TableHead className="font-bold">Notes</TableHead>
              <TableHead className="text-right font-bold w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((reading) => (
                <TableRow key={reading.id} className="group hover:bg-white/80 transition-colors">
                  <TableCell className="font-bold text-gray-900">{reading.meterIdentifier}</TableCell>
                  <TableCell>
                    <Badge variant={reading.meterType === 'bulk' ? "secondary" : "default"} className="font-bold text-[10px] h-5">
                      {reading.meterType === 'individual' ? 'Individual' : 'Bulk'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-black text-gray-700">{typeof reading.readingValue === 'number' ? reading.readingValue.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</TableCell>
                  <TableCell className="font-medium text-gray-600">{formatDate(reading.readingDate)}</TableCell>
                  <TableCell className="font-medium text-gray-600">{reading.monthYear}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-xs italic">{reading.notes || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-all"
                      onClick={() => handleViewDetails(reading)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground font-medium italic">
                  No meter readings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {data.length > 0 ? (
          data.map((reading) => (
            <div key={reading.id} className="border rounded-xl p-4 bg-white/50 backdrop-blur-sm shadow-sm space-y-4 hover:border-blue-200 transition-all border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start">
                <div>
                    <div className="font-black text-sm text-gray-900 leading-tight pr-2">{reading.meterIdentifier}</div>
                    <Badge variant={reading.meterType === 'bulk' ? "secondary" : "default"} className="text-[9px] h-4.5 px-1.5 mt-1 font-bold uppercase tracking-wider">
                      {reading.meterType === 'individual' ? 'Indiv' : 'Bulk'}
                    </Badge>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 bg-gray-50 text-blue-600 rounded-full shrink-0"
                    onClick={() => handleViewDetails(reading)}
                >
                    <Eye className="h-5 w-5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[11px]">
                <div className="flex flex-col">
                    <span className="text-muted-foreground uppercase font-black text-[9px] tracking-widest mb-0.5">Value</span> 
                    <span className="font-bold text-gray-800">{typeof reading.readingValue === 'number' ? reading.readingValue.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'} m³</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-muted-foreground uppercase font-black text-[9px] tracking-widest mb-0.5">Date</span> 
                    <span className="font-bold text-gray-800">{formatDate(reading.readingDate)}</span>
                </div>
                <div className="col-span-2 flex flex-col">
                    <span className="text-muted-foreground uppercase font-black text-[9px] tracking-widest mb-0.5">Period</span> 
                    <span className="font-bold text-gray-800">{reading.monthYear}</span>
                </div>
                {reading.notes && (
                    <div className="col-span-2 bg-gray-50 p-2 rounded-md border border-gray-100 italic text-[10px] text-gray-600 line-clamp-2">
                        "{reading.notes}"
                    </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="h-24 flex items-center justify-center border border-dashed rounded-xl text-sm text-muted-foreground italic bg-gray-50/50">
            No meter readings found.
          </div>
        )}
      </div>

      {data.length > 10 && (
        <div className="mt-4 text-center text-xs text-muted-foreground font-medium italic">
          Showing {data.length} records. Scroll or use pagination below for more.
        </div>
      )}
    </div>
  );
};

export default MeterReadingsTable;
