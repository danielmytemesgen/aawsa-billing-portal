
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { format, parseISO } from "date-fns";
import { cn, formatDate } from "@/lib/utils";
import type { Branch } from "../branches/branch-types";

interface BillTableProps {
  bills: DomainBill[];
  customers: IndividualCustomer[];
  bulkMeters: BulkMeter[];
  branches: Branch[];
  allBills?: DomainBill[];
}

export function BillTable({ bills, customers, bulkMeters, branches, allBills }: BillTableProps) {
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

  const getBranchName = (bill: DomainBill): string => {
    let branchId: string | undefined;
    if (bill.individualCustomerId) {
      const customer = customers.find(c => c.customerKeyNumber === bill.individualCustomerId);
      branchId = customer?.branchId;
    } else if (bill.CUSTOMERKEY) {
      const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === bill.CUSTOMERKEY);
      branchId = bulkMeter?.branchId;
    }

    if (!branchId) return "N/A";
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : "Unknown";
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
            <TableHead className="text-right">DEBIT_30</TableHead>
            <TableHead className="text-right">DEBIT_30_60</TableHead>
            <TableHead className="text-right">DEBIT_60</TableHead>
            <TableHead className="text-right">Outstanding (ETB)</TableHead>
            <TableHead className="text-right">Current Bill (ETB)</TableHead>
            <TableHead className="text-right">Penalty (ETB)</TableHead>
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
                <TableCell className="text-right">{typeof bill.PREVREAD === 'number' ? bill.PREVREAD.toFixed(2) : '-'}</TableCell>
                <TableCell className="text-right">{typeof bill.CURRREAD === 'number' ? bill.CURRREAD.toFixed(2) : '-'}</TableCell>
                <TableCell className="text-right">{(() => {
                  const usage = typeof bill.CONS === 'number' ? bill.CONS : (typeof bill.CURRREAD === 'number' && typeof bill.PREVREAD === 'number' ? bill.CURRREAD - bill.PREVREAD : null);
                  return usage !== null ? usage.toFixed(2) : '-';
                })()}</TableCell>
                <TableCell className="text-right">{typeof bill.differenceUsage === 'number' ? bill.differenceUsage.toFixed(2) : '-'}</TableCell>
                {(() => {
                  const debit30 = bill.debit30 || (bill as any).debit_30 || 0;
                  const debit60 = bill.debit30_60 || (bill as any).debit_30_60 || 0;
                  const debit90 = bill.debit60 || (bill as any).debit_60 || 0;

                  return (
                    <>
                      <TableCell className="text-right">{debit30 > 0 ? debit30.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right">{debit60 > 0 ? debit60.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right">{debit90 > 0 ? debit90.toFixed(2) : '-'}</TableCell>
                    </>
                  );
                })()}
                <TableCell className="text-right font-medium">{(() => {
                  const outstanding = (
                    (Number((bill as any).debit_30 || bill.debit30 || 0)) + 
                    (Number((bill as any).debit_30_60 || bill.debit30_60 || 0)) + 
                    (Number((bill as any).debit_60 || bill.debit60 || 0))
                  );
                  return outstanding.toFixed(2);
                })()}</TableCell>
                <TableCell className="text-right">{(() => {
                  // Current = This Month if available, else Total - Saved Outstanding (for cumulative awareness)
                  // If OutstandingAmt is also null, result is just total.
                  const current = (bill.THISMONTHBILLAMT !== null && bill.THISMONTHBILLAMT !== undefined)
                    ? Number(bill.THISMONTHBILLAMT)
                    : (Number(bill.TOTALBILLAMOUNT || 0) - Number(bill.OUTSTANDINGAMT || 0));
                  return Math.max(0, current).toFixed(2);
                })()}</TableCell>
                <TableCell className="text-right text-destructive">{(Number(bill.PENALTYAMT || 0)).toFixed(2)}</TableCell>
                <TableCell className="text-right font-bold font-mono text-primary">{(() => {
                  const outstanding = (
                    (Number((bill as any).debit_30 || bill.debit30 || 0)) + 
                    (Number((bill as any).debit_30_60 || bill.debit30_60 || 0)) + 
                    (Number((bill as any).debit_60 || bill.debit60 || 0))
                  );
                  const current = (bill.THISMONTHBILLAMT !== null && bill.THISMONTHBILLAMT !== undefined)
                    ? Number(bill.THISMONTHBILLAMT)
                    : (Number(bill.TOTALBILLAMOUNT || 0) - Number(bill.OUTSTANDINGAMT || 0));
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
              <TableCell colSpan={15} className="h-24 text-center">
                No bills found for the selected criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
