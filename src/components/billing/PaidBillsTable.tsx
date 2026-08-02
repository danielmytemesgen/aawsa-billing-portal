"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";

interface PaidBillsTableProps {
  bills: DomainBill[];
  customers?: IndividualCustomer[];
  bulkMeters?: BulkMeter[];
  branches?: Branch[];
}

export function PaidBillsTable({
  bills,
  customers = [],
  bulkMeters = [],
  branches = [],
}: PaidBillsTableProps) {
  const formatAmt = (val: any) => {
    if (val === null || val === undefined || val === "") return "0.00";
    const num = Number(val);
    return Number.isFinite(num) ? num.toFixed(2) : "0.00";
  };

  const getCustomer = (bill: any) => {
    const key = bill.individualCustomerId || bill.individual_customer_id;
    if (key) {
      return customers.find((c) => c.customerKeyNumber === key);
    }
    return null;
  };

  const getBulkMeter = (bill: any) => {
    const key = bill.CUSTOMERKEY || bill.customerKey;
    if (key) {
      return bulkMeters.find((bm) => bm.customerKeyNumber === key);
    }
    return null;
  };

  const getBillKeyDisplay = (bill: any): string => {
    return bill.BILLKEY || bill.billKey || bill.bill_number || bill.id?.slice(0, 8) || "N/A";
  };

  const getCustomerKeyDisplay = (bill: any): string => {
    return bill.individualCustomerId || bill.individual_customer_id || bill.CUSTOMERKEY || bill.customerKey || "N/A";
  };

  const getCustomerNameDisplay = (bill: any): string => {
    if (bill.CUSTOMERNAME || bill.customerName) {
      return bill.CUSTOMERNAME || bill.customerName;
    }
    const cust = getCustomer(bill);
    if (cust) return cust.name;
    const bm = getBulkMeter(bill);
    if (bm) return bm.name;
    return "N/A";
  };

  const getBranchNameDisplay = (bill: any): string => {
    if (bill.branch_name) return bill.branch_name;
    if (bill.CUSTOMERBRANCH || bill.customerBranch) return bill.CUSTOMERBRANCH || bill.customerBranch;

    let branchId = bill.branchId || bill.branch_id;
    if (!branchId) {
      const cust = getCustomer(bill);
      if (cust) branchId = cust.branchId;
      const bm = getBulkMeter(bill);
      if (bm) branchId = bm.branchId;
    }
    if (!branchId) return "Unknown";
    const found = branches.find((b) => b.id === branchId);
    return found ? found.name : "Unknown";
  };

  const getAmountDisplay = (bill: any): string => {
    const amt = bill.amount_paid ?? bill.amountPaid ?? bill.TOTALBILLAMOUNT ?? bill.totalBillAmount ?? 0;
    return formatAmt(amt);
  };

  const getPaymentDateDisplay = (bill: any): string => {
    const dateVal = bill.last_payment_date || bill.payment_date || bill.paymentDate || bill.updated_at || bill.created_at;
    if (!dateVal) return "-";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return format(d, "yyyy-MM-dd HH:mm");
    } catch {
      return String(dateVal);
    }
  };

  const getReconciliationStatusDisplay = (bill: any): string => {
    return bill.reconciliation_status_computed || bill.reconciliation_status || bill.reconciliationStatus || "Not reconciled";
  };

  const getPaymentChannelDisplay = (bill: any): string => {
    return bill.payment_channel || bill.paymentChannel || bill.payment_method || "CBE";
  };

  const getBankRefDisplay = (bill: any): string => {
    return bill.bank_ref || bill.bankRef || bill.transaction_reference || "-";
  };

  const getPhoneDisplay = (bill: any): string => {
    if (bill.phone_computed) return bill.phone_computed;
    if (bill.phone) return bill.phone;
    const cust: any = getCustomer(bill);
    if (cust?.phone || cust?.phoneNumber) return cust.phone || cust.phoneNumber;
    const bm: any = getBulkMeter(bill);
    if (bm?.phoneNumber || bm?.phone) return bm.phoneNumber || bm.phone;
    return "-";
  };

  const getRouteKeyDisplay = (bill: any): string => {
    if (bill.route_key_computed) return bill.route_key_computed;
    if (bill.route_key || bill.routeKey) return bill.route_key || bill.routeKey;
    const cust: any = getCustomer(bill);
    if (cust?.routeKey) return cust.routeKey;
    const bm: any = getBulkMeter(bill);
    if (bm?.routeKey) return bm.routeKey;
    return "-";
  };

  const getWalkOrderDisplay = (bill: any): string => {
    if (bill.walk_order_computed !== undefined && bill.walk_order_computed !== null) return String(bill.walk_order_computed);
    if (bill.walk_order !== undefined && bill.walk_order !== null) return String(bill.walk_order);
    if (bill.walkOrder !== undefined && bill.walkOrder !== null) return String(bill.walkOrder);
    const cust: any = getCustomer(bill);
    if (cust?.ordinal !== undefined && cust?.ordinal !== null) return String(cust.ordinal);
    const bm: any = getBulkMeter(bill);
    if (bm?.ordinal !== undefined && bm?.ordinal !== null) return String(bm.ordinal);
    return "-";
  };

  const getMeterKeyDisplay = (bill: any): string => {
    if (bill.meter_key_computed) return bill.meter_key_computed;
    if (bill.meter_key || bill.meterKey) return bill.meter_key || bill.meterKey;
    const cust: any = getCustomer(bill);
    if (cust?.meterKey || cust?.METER_KEY) return cust.meterKey || cust.METER_KEY;
    const bm: any = getBulkMeter(bill);
    if (bm?.meterKey || bm?.METER_KEY) return bm.meterKey || bm.METER_KEY;
    return "-";
  };

  return (
    <div className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
      <Table className="text-xs">
        <TableHeader className="bg-slate-50/80 border-b">
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Bill Key</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Customer Key</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Customer Name</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Branch</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Amount</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Payment Date</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Reconciliation Status</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Payment Channel</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Bank Ref</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Phone</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Route Key</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Walk Order</TableHead>
            <TableHead className="font-bold text-slate-700 py-3.5 px-3 uppercase tracking-wider text-[11px]">Meter Key</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.length > 0 ? (
            bills.map((bill: any) => {
              const reconStatus = getReconciliationStatusDisplay(bill);
              const isReconciled = reconStatus.toLowerCase() === "reconciled";

              return (
                <TableRow key={bill.id || bill.BILLKEY} className="hover:bg-slate-50/70 transition-colors">
                  {/* Bill Key badge button style like screenshot */}
                  <TableCell className="py-3 px-3 whitespace-nowrap">
                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold text-white bg-indigo-600 shadow-sm">
                      {getBillKeyDisplay(bill)}
                    </span>
                  </TableCell>

                  {/* Customer Key */}
                  <TableCell className="py-3 px-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                    {getCustomerKeyDisplay(bill)}
                  </TableCell>

                  {/* Customer Name */}
                  <TableCell className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                    {getCustomerNameDisplay(bill)}
                  </TableCell>

                  {/* Branch */}
                  <TableCell className="py-3 px-3 whitespace-nowrap">
                    <span className="text-indigo-600 font-medium">
                      {getBranchNameDisplay(bill)}
                    </span>
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="py-3 px-3 font-bold text-emerald-600 whitespace-nowrap">
                    {getAmountDisplay(bill)}
                  </TableCell>

                  {/* Payment Date */}
                  <TableCell className="py-3 px-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                    {getPaymentDateDisplay(bill)}
                  </TableCell>

                  {/* Reconciliation Status */}
                  <TableCell className="py-3 px-3 whitespace-nowrap">
                    <Badge
                      className={
                        isReconciled
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] px-2.5 py-0.5 rounded"
                          : "bg-amber-500 hover:bg-amber-600 text-white font-medium text-[11px] px-2.5 py-0.5 rounded"
                      }
                    >
                      {reconStatus}
                    </Badge>
                  </TableCell>

                  {/* Payment Channel */}
                  <TableCell className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                    {getPaymentChannelDisplay(bill)}
                  </TableCell>

                  {/* Bank Ref */}
                  <TableCell className="py-3 px-3 font-mono text-indigo-700 font-medium whitespace-nowrap">
                    {getBankRefDisplay(bill)}
                  </TableCell>

                  {/* Phone */}
                  <TableCell className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    {getPhoneDisplay(bill)}
                  </TableCell>

                  {/* Route Key */}
                  <TableCell className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    {getRouteKeyDisplay(bill)}
                  </TableCell>

                  {/* Walk Order */}
                  <TableCell className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    {getWalkOrderDisplay(bill)}
                  </TableCell>

                  {/* Meter Key */}
                  <TableCell className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    {getMeterKeyDisplay(bill)}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={13} className="h-24 text-center text-slate-500">
                No paid bills found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
