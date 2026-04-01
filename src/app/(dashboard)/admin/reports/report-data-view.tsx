
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import { cn, formatDate } from "@/lib/utils";

interface ReportDataViewProps {
  data: any[];
  headers: string[];
}

export function ReportDataView({ data, headers }: ReportDataViewProps) {

  const formatValue = (value: any, headerName: string): React.ReactNode => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-slate-300">N/A</span>;
    }
    
    // Type-based formatting
    if (value instanceof Date) {
      return <span className="font-medium text-slate-700">{formatDate(value)}</span>;
    }
    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? "default" : "secondary"} className={cn("text-[10px] uppercase font-black", value ? "bg-emerald-500" : "bg-slate-200")}>
          {value ? "Yes" : "No"}
        </Badge>
      );
    }

    // Header-based formatting heuristics
    const lowerHeader = headerName.toLowerCase();
    
    // Date/Time strings
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return <span className="text-slate-600 italic">{formatDate(value)}</span>;
    }

    // Numbers (Currency, Readings, etc.)
    if (typeof value === 'number') {
      if (lowerHeader.includes('amount') || lowerHeader.includes('debit') || lowerHeader.includes('etb') || lowerHeader.includes('penalty')) {
        return <span className="font-mono font-bold text-indigo-700">{value.toFixed(2)}</span>;
      }
      if (lowerHeader.includes('reading') || lowerHeader.includes('cons') || lowerHeader.includes('usage')) {
        return <span className="font-mono font-medium text-slate-900">{value.toFixed(2)}</span>;
      }
      return <span className="font-mono text-slate-600">{value}</span>;
    }

    if (typeof value === 'object') {
      return <pre className="text-[10px] text-slate-400 max-h-20 overflow-hidden">{JSON.stringify(value, null, 2)}</pre>;
    }

    return <span className="text-slate-800">{String(value)}</span>;
  };

  return (
    <ScrollArea className="h-[600px] w-full border border-slate-200/60 rounded-2xl shadow-inner bg-slate-50/30">
      <div className="relative">
        <Table>
          <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
            <TableRow className="hover:bg-transparent border-b">
              {headers.map((header) => (
                <TableHead key={header} className="font-black text-[11px] uppercase tracking-wider text-slate-500 py-4 px-4 whitespace-nowrap bg-white">
                  {header.replace(/_/g, ' ')}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {data.length > 0 ? (
              data.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  {headers.map((header) => (
                    <TableCell key={`${rowIndex}-${header}`} className="text-[13px] py-3 px-4 whitespace-nowrap border-r border-slate-50 last:border-r-0">
                      {formatValue(row[header], header)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={headers.length} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <p className="text-sm font-medium">No results found for this preview.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
