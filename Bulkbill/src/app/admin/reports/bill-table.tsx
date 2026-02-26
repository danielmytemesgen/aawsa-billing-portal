
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Branch } from "../branches/branch-types";

interface BillTableProps {
  bills: DomainBill[];
  customers: IndividualCustomer[];
  bulkMeters: BulkMeter[];
  branches: Branch[];
}

export function BillTable({ bills, customers, bulkMeters, branches }: BillTableProps) {
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
  
  const getBranchName = (bill: DomainBill): string => {
    let branchId: string | undefined;
    if (bill.individualCustomerId) {
      const customer = customers.find(c => c.customerKeyNumber === bill.individualCustomerId);
      branchId = customer?.branchId;
    } else if (bill.bulkMeterId) {
      const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === bill.bulkMeterId);
      branchId = bulkMeter?.branchId;
    }

    if (!branchId) return "N/A";
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : "Unknown";
  };

  const formatDate = (value: string | Date | number | null | undefined) => {
    if (!value) return '-';
    try {
      let d: Date;
      if (typeof value === 'string') {
        if (isNaN(Date.parse(value))) return String(value);
        d = parseISO(value);
      } else if (typeof value === 'number') {
        d = new Date(value);
      } else if (value instanceof Date) {
        d = value;
      } else {
        d = parseISO(String(value));
      }
      return format(d, 'PP');
    } catch (e) {
      try { return String(value); } catch { return '-'; }
    }
  };

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer/Meter Name</TableHead>
            <TableHead>Customer Key</TableHead>
            <TableHead>Branch</TableHead>
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
                <TableCell>{getBranchName(bill)}</TableCell>
                <TableCell>{bill.monthYear}</TableCell>
        <TableCell className="text-right">{typeof bill.previousReadingValue === 'number' ? bill.previousReadingValue.toFixed(2) : '-'}</TableCell>
        <TableCell className="text-right">{typeof bill.currentReadingValue === 'number' ? bill.currentReadingValue.toFixed(2) : '-'}</TableCell>
        <TableCell className="text-right">{(() => {
          const usage = typeof bill.usageM3 === 'number' ? bill.usageM3 : (typeof bill.currentReadingValue === 'number' && typeof bill.previousReadingValue === 'number' ? bill.currentReadingValue - bill.previousReadingValue : null);
          return usage !== null ? usage.toFixed(2) : '-';
        })()}</TableCell>
        <TableCell className="text-right">{typeof bill.differenceUsage === 'number' ? bill.differenceUsage.toFixed(2) : '-'}</TableCell>
        <TableCell className="text-right">{typeof bill.balanceCarriedForward === 'number' ? bill.balanceCarriedForward.toFixed(2) : '0.00'}</TableCell>
        <TableCell className="text-right font-mono">{(() => {
          const total = (typeof bill.totalAmountDue === 'number' ? bill.totalAmountDue : 0) + (typeof bill.balanceCarriedForward === 'number' ? bill.balanceCarriedForward : 0);
          return total.toFixed(2);
        })()}</TableCell>
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
              <TableCell colSpan={12} className="h-24 text-center">
                No bills found for the selected criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
