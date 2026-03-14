
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
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
                  let debit30 = 0;
                  let debit60 = 0;
                  let debit90 = 0;

                  if (allBills) {
                    const customerKey = bill.individualCustomerId || bill.CUSTOMERKEY;
                    if (customerKey) {
                      // Filter and sort history for this customer (Newest First)
                      const customerHistory = allBills.filter(b => (b.individualCustomerId === customerKey || b.CUSTOMERKEY === customerKey))
                        .sort((a, b) => new Date(b.billPeriodEndDate).getTime() - new Date(a.billPeriodEndDate).getTime());

                      const fullIndex = customerHistory.findIndex(b => b.id === bill.id);
                      if (fullIndex !== -1) {
                        let remainingOutstanding = bill.balanceCarriedForward ?? 0;

                        // 1. DEBIT_30: From immediate previous bill (index + 1)
                        if (remainingOutstanding > 0.01) {
                          const prev1 = customerHistory[fullIndex + 1];
                          if (prev1) {
                            const attributable = prev1.TOTALBILLAMOUNT;
                            const amount = Math.min(remainingOutstanding, attributable);
                            debit30 = amount;
                            remainingOutstanding -= amount;
                          } else {
                            debit90 += remainingOutstanding;
                            remainingOutstanding = 0;
                          }
                        }

                        // 2. DEBIT_30_60: From 2nd previous bill (index + 2)
                        if (remainingOutstanding > 0.01) {
                          const prev2 = customerHistory[fullIndex + 2];
                          if (prev2) {
                            const attributable = prev2.TOTALBILLAMOUNT;
                            const amount = Math.min(remainingOutstanding, attributable);
                            debit60 = amount;
                            remainingOutstanding -= amount;
                          } else {
                            debit90 += remainingOutstanding;
                            remainingOutstanding = 0;
                          }
                        }

                        // 3. DEBIT_>60: Remainder
                        if (remainingOutstanding > 0.01) {
                          debit90 += remainingOutstanding;
                        }
                      }
                    }
                  } else {
                    // Fallback if allBills not provided? or just show '-'?
                    // User might expect something. But without history we can't guess.
                    // We can default everything to DEBIT_60/Outstanding if we wanted, 
                    // but cleaner to show '-' to indicate "calculation unavailable".
                    // The user prompt implies they want it, so I will ensure I pass allBills in the next steps.
                  }

                  return (
                    <>
                      <TableCell className="text-right">{debit30 > 0 ? debit30.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right">{debit60 > 0 ? debit60.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right">{debit90 > 0 ? debit90.toFixed(2) : '-'}</TableCell>
                    </>
                  );
                })()}
                <TableCell className="text-right">{typeof bill.balanceCarriedForward === 'number' ? bill.balanceCarriedForward.toFixed(2) : '0.00'}</TableCell>
                <TableCell className="text-right font-mono">{(() => {
                  const billAmount = typeof bill.TOTALBILLAMOUNT === 'number' ? bill.TOTALBILLAMOUNT : 0;
                  const outstanding = typeof bill.balanceCarriedForward === 'number' ? bill.balanceCarriedForward : 0;
                  return (billAmount + outstanding).toFixed(2);
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
