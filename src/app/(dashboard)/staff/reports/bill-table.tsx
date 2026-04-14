
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { cn, formatDate } from "@/lib/utils";
import { getMonthlyBillAmt } from "@/lib/billing-utils";

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
    if (bill.CUSTOMERKEY) {
      const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === bill.CUSTOMERKEY);
      return bulkMeter ? bulkMeter.name : `Bulk Meter ID: ${bill.CUSTOMERKEY}`;
    }
    return "N/A";
  };

  const getCustomerKey = (bill: DomainBill): string => {
    return bill.individualCustomerId || bill.CUSTOMERKEY || "N/A";
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
            <TableHead className="text-right">Current Bill (ETB)</TableHead>
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
                <TableCell className="text-right">{bill.PREVREAD.toFixed(2)}</TableCell>
                <TableCell className="text-right">{bill.CURRREAD.toFixed(2)}</TableCell>
                <TableCell className="text-right">{(bill.CONS ?? (bill.CURRREAD - bill.PREVREAD)).toFixed(2)}</TableCell>
                <TableCell className="text-right">{bill.differenceUsage?.toFixed(2) ?? '-'}</TableCell>
                <TableCell className="text-right font-medium">{(
                  (Number((bill as any).debit_30 || bill.debit30 || 0)) + 
                  (Number((bill as any).debit_30_60 || bill.debit30_60 || 0)) + 
                  (Number((bill as any).debit_60 || bill.debit60 || 0))
                ).toFixed(2)}</TableCell>
                <TableCell className="text-right">{getMonthlyBillAmt(bill).toFixed(2)}</TableCell>
                <TableCell className="text-right font-bold font-mono">{(() => {
                  const outstanding = (
                    (Number((bill as any).debit_30 || bill.debit30 || 0)) + 
                    (Number((bill as any).debit_30_60 || bill.debit30_60 || 0)) + 
                    (Number((bill as any).debit_60 || bill.debit60 || 0))
                  );
                  const current = getMonthlyBillAmt(bill);
                  const penalty = Number(bill.PENALTYAMT || 0);
                  
                  return (outstanding + current + penalty).toFixed(2);
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
