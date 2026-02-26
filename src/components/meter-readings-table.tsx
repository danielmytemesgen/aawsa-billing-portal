
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

interface MeterReadingsTableProps {
  data: DisplayReading[];
}

const MeterReadingsTable: React.FC<MeterReadingsTableProps> = ({ data }) => {


  return (
    <div className="mt-2">
      {/* Desktop Table */}
      <div className="hidden md:block rounded-md border text-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meter Identifier</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Reading Value</TableHead>
              <TableHead>Reading Date</TableHead>
              <TableHead>Month/Year</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((reading) => (
                <TableRow key={reading.id}>
                  <TableCell className="font-medium">{reading.meterIdentifier}</TableCell>
                  <TableCell>
                    <Badge variant={reading.meterType === 'bulk' ? "secondary" : "default"}>
                      {reading.meterType === 'individual' ? 'Individual' : 'Bulk'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{typeof reading.readingValue === 'number' ? reading.readingValue.toFixed(2) : '-'}</TableCell>
                  <TableCell>{formatDate(reading.readingDate)}</TableCell>
                  <TableCell>{reading.monthYear}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-xs">{reading.notes || "-"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
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
            <div key={reading.id} className="border rounded-lg p-4 bg-card shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div className="font-bold text-sm leading-tight pr-2">{reading.meterIdentifier}</div>
                <Badge variant={reading.meterType === 'bulk' ? "secondary" : "default"} className="text-[10px] h-5 px-1.5 shrink-0">
                  {reading.meterType === 'individual' ? 'Indiv' : 'Bulk'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground uppercase font-semibold">Value:</span> {typeof reading.readingValue === 'number' ? reading.readingValue.toFixed(2) : '-'} m³</div>
                <div><span className="text-muted-foreground uppercase font-semibold">Date:</span> {formatDate(reading.readingDate)}</div>
                <div className="col-span-2"><span className="text-muted-foreground uppercase font-semibold">Period:</span> {reading.monthYear}</div>
                {reading.notes && <div className="col-span-2 border-t pt-1 text-[10px] text-muted-foreground italic">{reading.notes}</div>}
              </div>
            </div>
          ))
        ) : (
          <div className="h-24 flex items-center justify-center border rounded-lg text-sm text-muted-foreground italic">
            No meter readings found.
          </div>
        )}
      </div>

      {data.length > 10 && (
        <div className="mt-4 text-center text-xs text-muted-foreground italic">
          Displaying {data.length} readings. Pagination available below.
        </div>
      )}
    </div>
  );
};

export default MeterReadingsTable;
