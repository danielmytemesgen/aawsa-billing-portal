
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

interface MeterReadingsTableProps {
  data: DisplayReading[];
}

const MeterReadingsTable: React.FC<MeterReadingsTableProps> = ({ data }) => {
  const formatDate = (value: string | Date | number | null | undefined) => {
    if (!value) return '-';
    try {
      let d: Date;
      if (typeof value === 'string') {
        d = parseISO(value);
      } else if (typeof value === 'number') {
        d = new Date(value);
      } else if (value instanceof Date) {
        d = value;
      } else {
        // Unknown type, coerce to string then try parse
        d = parseISO(String(value));
      }
      // If date-fns format throws for invalid dates, catch below
      return format(d, 'PP');
    } catch (e) {
      try {
        // Last resort: convert to string
        return String(value);
      } catch (_err) {
        return '-';
      }
    }
  };

  return (
    <div>
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

      {data.length > 10 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
            Displaying {data.length} readings. Pagination coming soon.
        </div>
      )}
    </div>
  );
};

export default MeterReadingsTable;
