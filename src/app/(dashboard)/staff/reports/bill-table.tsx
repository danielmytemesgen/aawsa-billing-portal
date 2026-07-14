
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { cn, formatDate } from "@/lib/utils";
import { formatNumber } from '@/lib/format';
import { getMonthlyBillAmt } from "@/lib/billing-utils";

interface BillTableProps {
  bills: DomainBill[];
  customers: IndividualCustomer[];
  bulkMeters: BulkMeter[];
  branches?: Branch[];
  showDebitColumns?: boolean;
}

export function BillTable({ bills, customers, bulkMeters, branches = [], showDebitColumns = true }: BillTableProps) {
  const formatNumber = (v: any) => {
    if (v === null || v === undefined || v === '') return '-';
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '-';
  };
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
    if (!branchId) return 'N/A';
    const b = branches.find(x => x.id === branchId);
    return b ? b.name : 'Unknown';
  };

  const getPaymentStatus = (bill: DomainBill): string => {
    return bill.paymentStatus || (bill as any).payment_status || 'Unpaid';
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
    if (value === undefined || value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const normalizeNumber = parseNumber;



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
            {showDebitColumns && (
              <>
                <TableHead className="text-right">DEBIT_30</TableHead>
                <TableHead className="text-right">DEBIT_30_60</TableHead>
                <TableHead className="text-right">DEBIT_60</TableHead>
              </>
            )}
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
                {(() => {
                  const monthValue = getBillField<string>(bill, ['monthYear', 'month_year']);
                  const prevReadValue = parseNumber(getBillField<number>(bill, ['PREVREAD', 'prevRead', 'prevread']));
                  const currReadValue = parseNumber(getBillField<number>(bill, ['CURRREAD', 'currRead', 'currread']));
                  const rawUsage = parseNumber(getBillField<number>(bill, ['CONS', 'cons']));
                  const usageValue = rawUsage !== undefined ? rawUsage : (prevReadValue !== undefined && currReadValue !== undefined ? currReadValue - prevReadValue : undefined);
                  const diffUsageValue = parseNumber(getBillField<number>(bill, ['differenceUsage', 'difference_usage']));

                  return (
                    <>
                      <TableCell>{monthValue ?? '-'}</TableCell>
                      <TableCell className="text-right">{prevReadValue !== undefined ? formatNumber(prevReadValue) : '-'}</TableCell>
                      <TableCell className="text-right">{currReadValue !== undefined ? formatNumber(currReadValue) : '-'}</TableCell>
                      <TableCell className="text-right">{usageValue !== undefined ? formatNumber(usageValue) : '-'}</TableCell>
                      <TableCell className="text-right">{diffUsageValue !== undefined ? formatNumber(diffUsageValue) : '-'}</TableCell>
                    </>
                  );
                })()}
                {showDebitColumns && (() => {
                  const debit30 = Number((bill as any).debit_30 || bill.debit30 || 0);
                  const debit30_60 = Number((bill as any).debit_30_60 || bill.debit30_60 || 0);
                  const debit60 = Number((bill as any).debit_60 || bill.debit60 || 0);
                  return (
                    <>
                      <TableCell className="text-right">{formatNumber(debit30)}</TableCell>
                      <TableCell className="text-right">{formatNumber(debit30_60)}</TableCell>
                      <TableCell className="text-right">{formatNumber(debit60)}</TableCell>
                    </>
                  );
                })()}

                <TableCell className="text-right font-medium">{formatNumber(
                  normalizeNumber(bill.OUTSTANDINGAMT) ?? (
                    (normalizeNumber((bill as any).debit_30 ?? bill.debit30) ?? 0) +
                    (normalizeNumber((bill as any).debit_30_60 ?? bill.debit30_60) ?? 0) +
                    (normalizeNumber((bill as any).debit_60 ?? bill.debit60) ?? 0)
                  )
                )}</TableCell>
                <TableCell className="text-right">{formatNumber(getMonthlyBillAmt(bill))}</TableCell>
                <TableCell className="text-right text-red-500">{formatNumber(normalizeNumber(bill.PENALTYAMT))}</TableCell>
                <TableCell className="text-right font-bold font-mono">{(() => {
                  const outstanding = normalizeNumber(bill.OUTSTANDINGAMT) ?? (
                    (normalizeNumber((bill as any).debit_30 ?? bill.debit30) ?? 0) +
                    (normalizeNumber((bill as any).debit_30_60 ?? bill.debit30_60) ?? 0) +
                    (normalizeNumber((bill as any).debit_60 ?? bill.debit60) ?? 0)
                  );
                  const current = getMonthlyBillAmt(bill);
                  const penalty = normalizeNumber(bill.PENALTYAMT) ?? 0;
                  const total = normalizeNumber((bill as any).totalAmountDue ?? bill.TOTALBILLAMOUNT) ?? (outstanding + current + penalty);
                  return formatNumber(total);
                })()}</TableCell>
                <TableCell>{(() => {
                  const due = getBillField<string | Date>(bill, ['dueDate', 'due_date', 'duedate', 'DUE_DATE']);
                  const formatted = formatDate(due as any);
                  return formatted || '-';
                })()}</TableCell>
                <TableCell>
                  <Badge variant={getPaymentStatus(bill) === 'Paid' ? 'default' : 'destructive'} className={cn(getPaymentStatus(bill) === 'Paid' && "bg-green-500 hover:bg-green-600")}>
                    {getPaymentStatus(bill) === 'Paid' ? 'Paid' : 'Unpaid'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={17} className="h-24 text-center">
                No bills found for the selected criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
