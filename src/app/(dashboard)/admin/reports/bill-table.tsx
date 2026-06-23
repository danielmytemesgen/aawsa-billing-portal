
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
import { getMonthlyBillAmt } from "@/lib/billing-utils";

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

  const getBillField = <T,>(bill: DomainBill, keys: Array<keyof DomainBill | string>): T | undefined => {
    for (const key of keys) {
      const value = (bill as any)[key];
      if (value !== undefined && value !== null) {
        return value as T;
      }
    }
    return undefined;
  };

  const parseNumber = (value: unknown): number | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const normalizeNumber = parseNumber;

  const getPaymentStatus = (bill: DomainBill): string => {
    return getBillField<string>(bill, ['paymentStatus', 'payment_status']) || 'Unpaid';
  };

  return (
    <div className="rounded-3xl border border-slate-200/60 shadow-md bg-white overflow-hidden mt-6">
      <Table>
        <TableHeader className="bg-slate-50/50 border-b">
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-bold text-slate-700 py-5 pl-6">Customer/Meter Name</TableHead>
            <TableHead className="font-bold text-slate-700 py-5">Customer Key</TableHead>
            <TableHead className="font-bold text-slate-700 py-5">Branch</TableHead>
            <TableHead className="font-bold text-slate-700 py-5">Month</TableHead>
            <TableHead className="text-right font-bold text-slate-700 py-5">Prev Reading</TableHead>
            <TableHead className="text-right font-bold text-slate-700 py-5">Curr Reading</TableHead>
            <TableHead className="text-right font-bold text-slate-700 py-5">Usage (m³)</TableHead>
            <TableHead className="text-right font-bold text-slate-700 py-5">Diff. Usage</TableHead>
            <TableHead className="text-right font-bold text-slate-700 py-5 px-4 bg-muted/20">DEBIT_30</TableHead>
            <TableHead className="text-right font-bold text-slate-700 py-5 px-4 bg-muted/20">DEBIT_30_60</TableHead>
            <TableHead className="text-right font-bold text-slate-700 py-5 px-4 bg-muted/20">DEBIT_60</TableHead>
            <TableHead className="text-right font-bold text-slate-700 py-5">Outstanding (ETB)</TableHead>
            <TableHead className="text-right font-bold text-slate-700 py-5">Current Bill (ETB)</TableHead>
            <TableHead className="text-right font-bold text-red-600 py-5">Penalty (ETB)</TableHead>
            <TableHead className="text-right font-bold text-indigo-700 py-5 pr-6">Total Due (ETB)</TableHead>
            <TableHead className="font-bold text-slate-700 py-5">Due Date</TableHead>
            <TableHead className="font-bold text-slate-700 py-5">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.length > 0 ? (
            bills.map((bill) => (
              <TableRow key={bill.id} className="hover:bg-slate-50/80 transition-colors group">
                <TableCell className="font-bold text-slate-900 py-4 pl-6">{getIdentifier(bill)}</TableCell>
                <TableCell className="text-slate-600 py-4">{getCustomerKey(bill)}</TableCell>
                <TableCell className="text-slate-600 py-4">
                  <div className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold w-fit border border-blue-100">
                    {getBranchName(bill)}
                  </div>
                </TableCell>
                {(() => {
                  const monthValue = getBillField<string>(bill, ['monthYear', 'month_year']);
                  const prevReadValue = parseNumber(getBillField<number>(bill, ['PREVREAD', 'prevRead', 'prevread']));
                  const currReadValue = parseNumber(getBillField<number>(bill, ['CURRREAD', 'currRead', 'currread']));
                  const rawUsage = parseNumber(getBillField<number>(bill, ['CONS', 'cons']));
                  const usageValue = rawUsage !== undefined ? rawUsage : (prevReadValue !== undefined && currReadValue !== undefined ? currReadValue - prevReadValue : undefined);
                  const diffUsageValue = parseNumber(getBillField<number>(bill, ['differenceUsage', 'difference_usage']));

                  return (
                    <>
                      <TableCell className="text-slate-600 py-4 italic">{monthValue || '-'}</TableCell>
                      <TableCell className="text-right text-slate-600 py-4">{prevReadValue !== undefined ? prevReadValue.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right text-slate-900 font-medium py-4">{currReadValue !== undefined ? currReadValue.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right py-4">
                        <div className={cn(
                          "font-bold",
                          (usageValue ?? 0) > 0 ? "text-emerald-600" : "text-slate-400"
                        )}>
                          {usageValue !== undefined ? usageValue.toFixed(2) : '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4 font-bold text-amber-600">
                        {diffUsageValue !== undefined ? diffUsageValue.toFixed(2) : '-'}
                      </TableCell>
                    </>
                  );
                })()}
                {(() => {
                  const debit30 = normalizeNumber(bill.debit30 ?? (bill as any).debit_30) ?? 0;
                  const debit30_60 = normalizeNumber(bill.debit30_60 ?? (bill as any).debit_30_60) ?? 0;
                  const debit60 = normalizeNumber(bill.debit60 ?? (bill as any).debit_60) ?? 0;

                  return (
                    <>
                      <TableCell className="text-right py-4 px-4 bg-muted/10 font-mono text-xs">{debit30 > 0 ? debit30.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right py-4 px-4 bg-muted/10 font-mono text-xs">{debit30_60 > 0 ? debit30_60.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right py-4 px-4 bg-muted/10 font-mono text-xs">{debit60 > 0 ? debit60.toFixed(2) : '-'}</TableCell>
                    </>
                  );
                })()}
                <TableCell className="text-right font-medium text-slate-900 py-4">{(() => {
                  const outstanding = normalizeNumber(bill.OUTSTANDINGAMT) ?? (
                    (normalizeNumber((bill as any).debit_30 ?? bill.debit30) ?? 0) + 
                    (normalizeNumber((bill as any).debit_30_60 ?? bill.debit30_60) ?? 0) + 
                    (normalizeNumber((bill as any).debit_60 ?? bill.debit60) ?? 0)
                  );
                  return outstanding.toFixed(2);
                })()}</TableCell>
                <TableCell className="text-right text-slate-600 py-4">{getMonthlyBillAmt(bill).toFixed(2)}</TableCell>
                <TableCell className="text-right text-red-500 font-bold py-4">{normalizeNumber(bill.PENALTYAMT)?.toFixed(2) ?? '-'}</TableCell>
                <TableCell className="text-right font-black font-mono text-indigo-700 bg-indigo-50/30 py-4 pr-6">{(() => {
                  const outstanding = normalizeNumber(bill.OUTSTANDINGAMT) ?? (
                    (normalizeNumber((bill as any).debit_30 ?? bill.debit30) ?? 0) + 
                    (normalizeNumber((bill as any).debit_30_60 ?? bill.debit30_60) ?? 0) + 
                    (normalizeNumber((bill as any).debit_60 ?? bill.debit60) ?? 0)
                  );
                  const current = getMonthlyBillAmt(bill);
                  const penalty = normalizeNumber(bill.PENALTYAMT) ?? 0;
                  const totalDue = normalizeNumber((bill as any).totalAmountDue ?? bill.TOTALBILLAMOUNT) ?? (outstanding + current + penalty);

                  return totalDue.toFixed(2);
                })()}</TableCell>
                <TableCell className="text-slate-600 py-4 whitespace-nowrap">{formatDate(bill.dueDate)}</TableCell>
                <TableCell className="py-4">
                  <Badge className={cn(
                    "rounded-xl px-3 py-1 font-bold text-white shadow-sm border-none whitespace-nowrap",
                    getPaymentStatus(bill) === 'Paid'
                      ? "bg-emerald-500 hover:bg-emerald-600"
                      : "bg-red-500 hover:bg-red-600"
                  )}>
                    {getPaymentStatus(bill) === 'Paid' ? 'Paid' : 'Unpaid'}
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
