
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface BillTableProps {
  bills: DomainBill[];
  customers: IndividualCustomer[];
  bulkMeters: BulkMeter[];
}

export function BillTable({ bills, customers, bulkMeters }: BillTableProps) {
  const getIdentifier = (bill: DomainBill): string => {
    if (bill.individualCustomerId) {
      const customer = customers.find(c => c.customerKeyNumber === bill.individualCustomerId);
      return customer ? customer.name : `Customer ID: ${bill.individualCustomerId}`;
    }
    if (bill.bulkMeterId) {
      const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === bill.bulkMeterId);
      return bulkMeter ? bulkMeter.name : `Bulk Meter ID: ${bill.bulkMeterId}`;
    }
    return "N/A";
  };

  const getCustomerKey = (bill: DomainBill): string => {
    return bill.individualCustomerId || bill.bulkMeterId || "N/A";
  };
  
  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "";
    let d: Date;
    if (typeof date === "string") {
      try {
        d = parseISO(date);
      } catch {
        return date;
      }
    } else if (date instanceof Date) {
      d = date;
    } else {
      return "";
    }
    return format(d, "PP"); // e.g., Sep 21, 2023
  };

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer/Meter Name</TableHead>
            <TableHead>Customer Key</TableHead>
            <TableHead>Month</TableHead>
            <TableHead className="text-right">Prev Reading</TableHead>
            <TableHead className="text-right">Curr Reading</TableHead>
            <TableHead className="text-right">Usage (m³)</TableHead>
            <TableHead className="text-right">Diff. Usage</TableHead>
            <TableHead className="text-right">Outstanding (ETB)</TableHead>
            <TableHead className="text-right">Total Due (ETB)</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.length > 0 ? (
            bills.map((bill) => (
              <TableRow key={bill.id}>
                <TableCell className="font-medium">{getIdentifier(bill)}</TableCell>
                <TableCell>{getCustomerKey(bill)}</TableCell>
                <TableCell>{bill.monthYear}</TableCell>
                <TableCell className="text-right">{bill.previousReadingValue.toFixed(2)}</TableCell>
                <TableCell className="text-right">{bill.currentReadingValue.toFixed(2)}</TableCell>
                <TableCell className="text-right">{(bill.usageM3 ?? (bill.currentReadingValue - bill.previousReadingValue)).toFixed(2)}</TableCell>
                <TableCell className="text-right">{bill.differenceUsage?.toFixed(2) ?? '-'}</TableCell>
                <TableCell className="text-right">{(bill.balanceCarriedForward ?? 0).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">{((bill.totalAmountDue ?? 0) + (bill.balanceCarriedForward ?? 0)).toFixed(2)}</TableCell>
                <TableCell>{formatDate(bill.dueDate)}</TableCell>
                <TableCell>
                   <Badge variant={bill.paymentStatus === 'Paid' ? 'default' : 'destructive'} className={cn(bill.paymentStatus === 'Paid' && "bg-green-500 hover:bg-green-600")}>
                    {bill.paymentStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={11} className="h-24 text-center">
                No bills found for the selected criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
