
"use client";

import * as React from "react";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from "@/lib/xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, AlertCircle, Eye, Check, ChevronsUpDown, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ReportDataView } from "@/app/(dashboard)/admin/reports/report-data-view";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { customerTypes } from "@/lib/billing-calculations";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { getAllCustomersAction, getAllBulkMetersAction, getAllBillsAction, getAllIndividualCustomerReadingsAction, getAllBulkMeterReadingsAction, getAllPaymentsAction, getAllStaffMembersAction, getAllBranchesAction, getAllTariffsAction } from "@/lib/actions";

interface User {
  email: string;
  role: string;
  branchName?: string;
  branchId?: string;
}

interface ReportFilters {
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
  chargeGroup?: string;
}

interface ReportType {
  id: string;
  name: string;
  description: string;
  headers?: string[];
  getData?: (filters: ReportFilters) => any[] | Promise<any[]>;
  requiredPermission?: typeof PERMISSIONS[keyof typeof PERMISSIONS];
}

const mapCustomer = (c: any) => {
  if (!c) return c;
  return { ...c, branchId: c.branch_id || c.branchId, customerType: c.customerType || c.customer_type, meterNumber: c.METER_KEY || c.meterNumber, createdAt: c.created_at || c.createdAt, updatedAt: c.updated_at || c.updatedAt };
};

const mapBulkMeter = (bm: any) => {
  if (!bm) return bm;
  return { ...bm, branchId: bm.branch_id || bm.branchId, chargeGroup: bm.charge_group || bm.chargeGroup, sewerageConnection: bm.sewerage_connection || bm.sewerageConnection, meterNumber: bm.METER_KEY || bm.meterNumber, createdAt: bm.created_at || bm.createdAt, updatedAt: bm.updated_at || bm.updatedAt, bulkUsage: bm.bulk_usage !== undefined ? bm.bulk_usage : bm.bulkUsage, differenceUsage: bm.difference_usage !== undefined ? bm.difference_usage : bm.differenceUsage, differenceBill: bm.difference_bill !== undefined ? bm.difference_bill : bm.differenceBill, totalBulkBill: bm.total_bulk_bill !== undefined ? bm.total_bulk_bill : bm.totalBulkBill };
};
const availableStaffReports: ReportType[] = [
  {
    id: "customer-data-export",
    name: "Customer Data Export (XLSX)",
    description: "Download a comprehensive list of individual customers with their details.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Customer Key","Name","Contract Number","Customer Type","Book Number","Ordinal","Meter Size","Meter Number","Previous Reading","Current Reading","Month","Specific Area","SubCity","Woreda","Sewerage Connection","Assigned Bulk Meter ID","Status","Payment Status","Calculated Bill","Assigned Branch Name","Created At","Updated At"],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      const [rawCustomers, branches] = await Promise.all([getAllCustomersAction().then(r => (r?.data as any[] ?? []).map(mapCustomer)), getAllBranchesAction().then(r => r?.data as any[] ?? [])]);
      let filteredData = rawCustomers;
      if (branchId) filteredData = filteredData.filter((c:any) => c.branchId === branchId);
      if (chargeGroup && chargeGroup !== "all") filteredData = filteredData.filter((c:any) => c.customerType === chargeGroup);
      if (startDate && endDate) { const s = startDate.getTime(), e = endDate.getTime(); filteredData = filteredData.filter((c:any) => { if (!c.createdAt) return false; try { const t = new Date(c.createdAt).getTime(); return t >= s && t <= e; } catch { return false; } }); }
      return filteredData.map((customer:any) => {
        const branch = customer.branchId ? branches.find((b:any) => b.id === customer.branchId) : null;
        return { "Customer Key": customer.customerKeyNumber, "Name": customer.name, "Contract Number": customer.contractNumber, "Customer Type": customer.customerType, "Book Number": customer.bookNumber, "Ordinal": customer.ordinal, "Meter Size": customer.meterSize, "Meter Number": customer.meterNumber, "Previous Reading": customer.previousReading, "Current Reading": customer.currentReading, "Month": customer.month, "Specific Area": customer.specificArea, "SubCity": customer.subCity, "Woreda": customer.woreda, "Sewerage Connection": customer.sewerageConnection, "Assigned Bulk Meter ID": customer.assignedBulkMeterId || "N/A", "Status": customer.status, "Payment Status": customer.paymentStatus, "Calculated Bill": customer.calculatedBill, "Assigned Branch Name": branch ? (branch as any).name : "N/A", "Created At": customer.createdAt, "Updated At": customer.updatedAt };
      });
    },
  },
  {
    id: "bulk-meter-data-export",
    name: "Bulk Meter Data Export (XLSX)",
    description: "Download a comprehensive list of all bulk meters, including their details and readings.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Customer Key","Name","Contract Number","Meter Size","Meter Number","Previous Reading","Current Reading","Month","Specific Area","SubCity","Woreda","Status","Payment Status","Charge Group","Sewerage Connection","Assigned Branch Name","Number of Assigned Individual Customers","Bulk Usage","Total Individual Usage","Total Bulk Bill","Difference Usage","Difference Bill"],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      const [bulkMeters, branches, customers] = await Promise.all([getAllBulkMetersAction().then(r => (r?.data as any[] ?? []).map(mapBulkMeter)), getAllBranchesAction().then(r => r?.data as any[] ?? []), getAllCustomersAction().then(r => (r?.data as any[] ?? []).map(mapCustomer))]);
      let filteredData = bulkMeters;
      if (branchId) filteredData = filteredData.filter((bm:any) => bm.branchId === branchId);
      if (chargeGroup && chargeGroup !== "all") filteredData = filteredData.filter((bm:any) => bm.chargeGroup === chargeGroup);
      if (startDate && endDate) { const s = startDate.getTime(), e = endDate.getTime(); filteredData = filteredData.filter((bm:any) => { if (!bm.createdAt) return false; try { const t = new Date(bm.createdAt).getTime(); return t >= s && t <= e; } catch { return false; } }); }
      return filteredData.map((bm:any) => {
        const branch = bm.branchId ? branches.find((b:any) => b.id === bm.branchId) : null;
        const assoc = customers.filter((c:any) => c.assignedBulkMeterId === bm.customerKeyNumber);
        const totalIndUsage = assoc.reduce((sum:number, c:any) => sum + ((c.currentReading ?? 0) - (c.previousReading ?? 0)), 0);
        const bulkUsage = bm.bulkUsage ?? 0;
        const differenceUsage = bm.differenceUsage ?? (bulkUsage < totalIndUsage ? 3 : bulkUsage - totalIndUsage);
        const differenceBill = bm.differenceBill ?? 0;
        return { "Customer Key": bm.customerKeyNumber, "Name": bm.name, "Contract Number": bm.contractNumber, "Meter Size": bm.meterSize, "Meter Number": bm.meterNumber, "Previous Reading": bm.previousReading, "Current Reading": bm.currentReading, "Month": bm.month, "Specific Area": bm.specificArea, "SubCity": bm.subCity, "Woreda": bm.woreda, "Status": bm.status, "Payment Status": bm.paymentStatus, "Charge Group": bm.chargeGroup, "Sewerage Connection": bm.sewerageConnection, "Assigned Branch Name": branch ? (branch as any).name : "N/A", "Number of Assigned Individual Customers": assoc.length, "Total Individual Usage": totalIndUsage, "Bulk Usage": bulkUsage, "Difference Usage": differenceUsage, "Difference Bill": differenceBill };
      });
    },
  },
  {
    id: "billing-summary",
    name: "Billing Summary Report (XLSX)",
    description: "Summary of all generated bills, including amounts and payment statuses.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Bill ID","Bill Key","Customer Key","Customer Name","Customer TIN","Branch","Period Start","Period End","Month/Year","Previous Reading","Current Reading","Consumption","Reason","Base Water Charge","Sewerage Charge","Maintenance Fee","Sanitation Fee","Meter Rent","Current Bill","Penalty","Total Bill","Amount Paid","Outstanding","Due Date","Status","Bill Number","DR Account","CR Account","Notes","Created At","Updated At"],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      const [billsRes, bulkMetersRes, customersRes, branchesRes] = await Promise.all([getAllBillsAction(), getAllBulkMetersAction(), getAllCustomersAction(), getAllBranchesAction()]);
      const allBills: any[] = billsRes?.data ?? [];
      const bulkMeters: any[] = (bulkMetersRes?.data ?? []).map(mapBulkMeter);
      const customers: any[] = (customersRes?.data ?? []).map(mapCustomer);
      const branches: any[] = branchesRes?.data ?? [];
      const branchMap = new Map(branches.map((br: any) => [br.id, br.name]));
      const bmMap = new Map(bulkMeters.map((bm: any) => [bm.customerKeyNumber, bm]));
      const custMap = new Map(customers.map((c: any) => [c.customerKeyNumber, c]));
      let billsList = allBills;
      if (branchId) { const bmSet = new Set(bulkMeters.filter((bm:any)=>bm.branchId===branchId).map((bm:any)=>bm.customerKeyNumber)); const custSet = new Set(customers.filter((c:any)=>c.branchId===branchId).map((c:any)=>c.customerKeyNumber)); billsList = billsList.filter((b:any) => (b.CUSTOMERKEY && bmSet.has(b.CUSTOMERKEY)) || (b.individual_customer_id && custSet.has(b.individual_customer_id))); }
      if (chargeGroup && chargeGroup !== "all") { billsList = billsList.filter((b:any) => { if (b.CUSTOMERKEY) return (bmMap.get(b.CUSTOMERKEY) as any)?.chargeGroup === chargeGroup; if (b.individual_customer_id) return (custMap.get(b.individual_customer_id) as any)?.customerType === chargeGroup; return false; }); }
      if (startDate && endDate) { const s=startDate.getTime(), e=endDate.getTime(); billsList = billsList.filter((b:any) => { try { return new Date(b.bill_period_end_date).getTime() >= s && new Date(b.bill_period_end_date).getTime() <= e; } catch { return false; } }); }
      return billsList.map((b: any) => {
        const customerKey = b.CUSTOMERKEY || b.individual_customer_id || "";
        let customerName = b.CUSTOMERNAME || "", customerTin = b.CUSTOMERTIN || "", branchName = (branchMap.get(b.CUSTOMERBRANCH) as string) || b.CUSTOMERBRANCH || "N/A";
        if (b.CUSTOMERKEY) { const bm = bmMap.get(b.CUSTOMERKEY) as any; if (bm) { if (!customerName) customerName = bm.name || ""; if (!customerTin) customerTin = bm.contractNumber || ""; if (branchName === "N/A") branchName = (branchMap.get(bm.branchId) as string) || "N/A"; } }
        else if (b.individual_customer_id) { const cust = custMap.get(b.individual_customer_id) as any; if (cust) { if (!customerName) customerName = cust.name || ""; if (!customerTin) customerTin = cust.contractNumber || ""; if (branchName === "N/A") branchName = (branchMap.get(cust.branchId) as string) || "N/A"; } }
        let billKey = b.BILLKEY || ""; if (!billKey) { const h = (b.id||"").replace(/-/g,"").substring(0,8); const n = parseInt(h,16); billKey = isNaN(n) ? "BBPT-0000000000" : `BBPT-${String(n).padStart(10,"0")}`; }
        const currentBill = parseFloat(Number(b.THISMONTHBILLAMT||b.base_water_charge||0).toFixed(2)), outstanding = parseFloat(Number(b.OUTSTANDINGAMT||0).toFixed(2)), penalty = parseFloat(Number(b.PENALTYAMT||0).toFixed(2)), totalBill = parseFloat(Number(b.TOTALBILLAMOUNT||(currentBill+outstanding+penalty)).toFixed(2)), amountPaid = parseFloat(Number(b.amount_paid||0).toFixed(2));
        let reason = b.REASON || ""; if (!reason && b.month_year) { const pts = b.month_year.split("-"); reason = pts.length === 2 ? `${parseInt(pts[1])}/1/${pts[0]}` : b.month_year; }
        return { "Bill ID": b.id, "Bill Key": billKey, "Customer Key": customerKey, "Customer Name": customerName, "Customer TIN": customerTin, "Branch": branchName, "Period Start": b.bill_period_start_date||"", "Period End": b.bill_period_end_date||"", "Month/Year": b.month_year||"", "Previous Reading": b.PREVREAD!=null?Number(b.PREVREAD):"", "Current Reading": b.CURRREAD!=null?Number(b.CURRREAD):"", "Consumption": b.CONS!=null?Number(b.CONS):"", "Reason": reason, "Base Water Charge": parseFloat(Number(b.base_water_charge||0).toFixed(2)), "Sewerage Charge": parseFloat(Number(b.sewerage_charge||0).toFixed(2)), "Maintenance Fee": parseFloat(Number(b.maintenance_fee||0).toFixed(2)), "Sanitation Fee": parseFloat(Number(b.sanitation_fee||0).toFixed(2)), "Meter Rent": parseFloat(Number(b.meter_rent||0).toFixed(2)), "Current Bill": currentBill, "Penalty": penalty, "Total Bill": totalBill, "Amount Paid": amountPaid, "Outstanding": outstanding, "Due Date": b.due_date||"", "Status": b.payment_status||b.status||"", "Bill Number": b.bill_number||"", "DR Account": b.DRACCTNO||"", "CR Account": b.CRACCTNO||"", "Notes": b.notes||"", "Created At": b.created_at||"", "Updated At": b.updated_at||"" };
      });
    },
  },
  {
    id: "list-of-paid-bills",
    name: "List Of Paid Bills (XLSX)",
    description: "A filtered list showing only the bills marked as Paid.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Bill ID","Individual Customer ID","Customer Key","Period Start","Period End","Month/Year","Previous Reading","Current Reading","Consumption","Base Water Charge","Sewerage Charge","Maintenance Fee","Sanitation Fee","Meter Rent","Total Bill Amount","Amount Paid","Outstanding Amount","Due Date","Status","Bill Number","Notes","Created At","Updated At"],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      const [billsRes, bulkMetersRes, customersRes] = await Promise.all([getAllBillsAction(), getAllBulkMetersAction(), getAllCustomersAction()]);
      const bulkMeters = (bulkMetersRes?.data as any[] ?? []).map(mapBulkMeter);
      const customers = (customersRes?.data as any[] ?? []).map(mapCustomer);
      let bills = (billsRes?.data as any[] ?? []).filter((b:any) => b.payment_status === "Paid");
      if (branchId) { const bmSet = new Set(bulkMeters.filter((bm:any)=>bm.branchId===branchId).map((bm:any)=>bm.customerKeyNumber)); const custSet = new Set(customers.filter((c:any)=>c.branchId===branchId).map((c:any)=>c.customerKeyNumber)); bills = bills.filter((b:any) => (b.CUSTOMERKEY && bmSet.has(b.CUSTOMERKEY)) || (b.individual_customer_id && custSet.has(b.individual_customer_id))); }
      if (chargeGroup && chargeGroup !== "all") { const bmMap = new Map(bulkMeters.map((bm:any)=>[bm.customerKeyNumber,bm])); const custMap = new Map(customers.map((c:any)=>[c.customerKeyNumber,c])); bills = bills.filter((b:any) => { if (b.CUSTOMERKEY) return (bmMap.get(b.CUSTOMERKEY) as any)?.chargeGroup === chargeGroup; if (b.individual_customer_id) return (custMap.get(b.individual_customer_id) as any)?.customerType === chargeGroup; return false; }); }
      if (startDate && endDate) { const s=startDate.getTime(),e=endDate.getTime(); bills = bills.filter((b:any) => { try { return new Date(b.bill_period_end_date).getTime() >= s && new Date(b.bill_period_end_date).getTime() <= e; } catch { return false; } }); }
      return bills.map((b:any) => ({ "Bill ID": b.id, "Individual Customer ID": b.individual_customer_id||"N/A", "Customer Key": b.CUSTOMERKEY||"N/A", "Period Start": b.bill_period_start_date||"", "Period End": b.bill_period_end_date||"", "Month/Year": b.month_year||"", "Previous Reading": b.PREVREAD!=null?Number(b.PREVREAD):"", "Current Reading": b.CURRREAD!=null?Number(b.CURRREAD):"", "Consumption": b.CONS!=null?Number(b.CONS):"", "Base Water Charge": parseFloat(Number(b.base_water_charge||0).toFixed(2)), "Sewerage Charge": parseFloat(Number(b.sewerage_charge||0).toFixed(2)), "Maintenance Fee": parseFloat(Number(b.maintenance_fee||0).toFixed(2)), "Sanitation Fee": parseFloat(Number(b.sanitation_fee||0).toFixed(2)), "Meter Rent": parseFloat(Number(b.meter_rent||0).toFixed(2)), "Total Bill Amount": parseFloat(Number(b.TOTALBILLAMOUNT||0).toFixed(2)), "Amount Paid": parseFloat(Number(b.amount_paid||0).toFixed(2)), "Outstanding Amount": parseFloat(Number(b.OUTSTANDINGAMT||0).toFixed(2)), "Due Date": b.due_date||"", "Status": b.payment_status||"", "Bill Number": b.bill_number||"", "Notes": b.notes||"", "Created At": b.created_at||"", "Updated At": b.updated_at||"" }));
    },
  },
  {
    id: "list-of-sent-bills",
    name: "List Of Sent Bills (XLSX)",
    description: "A comprehensive list of all generated bills regardless of payment status.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Bill ID","Individual Customer ID","Customer Key","Period Start","Period End","Month/Year","Previous Reading","Current Reading","Consumption","Base Water Charge","Sewerage Charge","Maintenance Fee","Sanitation Fee","Meter Rent","Total Bill Amount","Amount Paid","Outstanding Amount","Due Date","Status","Bill Number","Notes","Created At","Updated At"],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      const [billsRes, bulkMetersRes, customersRes] = await Promise.all([getAllBillsAction(), getAllBulkMetersAction(), getAllCustomersAction()]);
      const bulkMeters = (bulkMetersRes?.data as any[] ?? []).map(mapBulkMeter);
      const customers = (customersRes?.data as any[] ?? []).map(mapCustomer);
      let bills: any[] = billsRes?.data ?? [];
      if (branchId) { const bmSet = new Set(bulkMeters.filter((bm:any)=>bm.branchId===branchId).map((bm:any)=>bm.customerKeyNumber)); const custSet = new Set(customers.filter((c:any)=>c.branchId===branchId).map((c:any)=>c.customerKeyNumber)); bills = bills.filter((b:any) => (b.CUSTOMERKEY && bmSet.has(b.CUSTOMERKEY)) || (b.individual_customer_id && custSet.has(b.individual_customer_id))); }
      if (chargeGroup && chargeGroup !== "all") { const bmMap = new Map(bulkMeters.map((bm:any)=>[bm.customerKeyNumber,bm])); const custMap = new Map(customers.map((c:any)=>[c.customerKeyNumber,c])); bills = bills.filter((b:any) => { if (b.CUSTOMERKEY) return (bmMap.get(b.CUSTOMERKEY) as any)?.chargeGroup === chargeGroup; if (b.individual_customer_id) return (custMap.get(b.individual_customer_id) as any)?.customerType === chargeGroup; return false; }); }
      if (startDate && endDate) { const s=startDate.getTime(),e=endDate.getTime(); bills = bills.filter((b:any) => { try { return new Date(b.bill_period_end_date).getTime() >= s && new Date(b.bill_period_end_date).getTime() <= e; } catch { return false; } }); }
      return bills.map((b:any) => ({ "Bill ID": b.id, "Individual Customer ID": b.individual_customer_id||"N/A", "Customer Key": b.CUSTOMERKEY||"N/A", "Period Start": b.bill_period_start_date||"", "Period End": b.bill_period_end_date||"", "Month/Year": b.month_year||"", "Previous Reading": b.PREVREAD!=null?Number(b.PREVREAD):"", "Current Reading": b.CURRREAD!=null?Number(b.CURRREAD):"", "Consumption": b.CONS!=null?Number(b.CONS):"", "Base Water Charge": parseFloat(Number(b.base_water_charge||0).toFixed(2)), "Sewerage Charge": parseFloat(Number(b.sewerage_charge||0).toFixed(2)), "Maintenance Fee": parseFloat(Number(b.maintenance_fee||0).toFixed(2)), "Sanitation Fee": parseFloat(Number(b.sanitation_fee||0).toFixed(2)), "Meter Rent": parseFloat(Number(b.meter_rent||0).toFixed(2)), "Total Bill Amount": parseFloat(Number(b.TOTALBILLAMOUNT||0).toFixed(2)), "Amount Paid": parseFloat(Number(b.amount_paid||0).toFixed(2)), "Outstanding Amount": parseFloat(Number(b.OUTSTANDINGAMT||0).toFixed(2)), "Due Date": b.due_date||"", "Status": b.payment_status||"", "Bill Number": b.bill_number||"", "Notes": b.notes||"", "Created At": b.created_at||"", "Updated At": b.updated_at||"" }));
    },
  },
  {
    id: "water-usage",
    name: "Water Usage Report (XLSX)",
    description: "Detailed water consumption report from all meter readings.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Reading ID","Meter Type","Customer ID","Bulk Meter ID","Staff ID","Reading Date","Month/Year","Reading Value","Is Estimate","Notes","Created At","Updated At"],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      const [indRes, bulkRes, bmRes, custRes] = await Promise.all([getAllIndividualCustomerReadingsAction(), getAllBulkMeterReadingsAction(), getAllBulkMetersAction(), getAllCustomersAction()]);
      const indReadings = ((indRes?.data as any[] ?? [])).map((r:any) => ({ ...r, _t: "individual" }));
      const bulkReadings = ((bulkRes?.data as any[] ?? [])).map((r:any) => ({ ...r, _t: "bulk" }));
      const bulkMeters = (bmRes?.data as any[] ?? []).map(mapBulkMeter);
      const customers = (custRes?.data as any[] ?? []).map(mapCustomer);
      const bmMap = new Map(bulkMeters.map((bm:any) => [bm.customerKeyNumber, bm]));
      const custMap = new Map(customers.map((c:any) => [c.customerKeyNumber, c]));
      let readings: any[] = [...indReadings, ...bulkReadings];
      if (branchId) { const bmSet = new Set(bulkMeters.filter((bm:any)=>bm.branchId===branchId).map((bm:any)=>bm.customerKeyNumber)); const custSet = new Set(customers.filter((c:any)=>c.branchId===branchId).map((c:any)=>c.customerKeyNumber)); readings = readings.filter((r:any) => (r._t==="bulk" && r.CUST_KEY && bmSet.has(r.CUST_KEY)) || (r._t==="individual" && r.CUST_KEY && custSet.has(r.CUST_KEY))); }
      if (chargeGroup && chargeGroup !== "all") { readings = readings.filter((r:any) => r._t==="bulk" ? (bmMap.get(r.CUST_KEY) as any)?.chargeGroup===chargeGroup : (custMap.get(r.CUST_KEY) as any)?.customerType===chargeGroup); }
      if (startDate && endDate) { const s=startDate.getTime(),e=endDate.getTime(); readings=readings.filter((r:any)=>{ try{return new Date(r.READING_DATE).getTime()>=s&&new Date(r.READING_DATE).getTime()<=e;}catch{return false;} }); }
      return readings.map((r:any) => { const isBulk=r._t==="bulk"; return { "Reading ID": r.id, "Meter Type": isBulk?"Bulk":"Individual", "Customer ID": !isBulk?(r.CUST_KEY||"N/A"):"N/A", "Bulk Meter ID": isBulk?(r.CUST_KEY||"N/A"):"N/A", "Staff ID": r.created_by||r.METER_READER_CODE||"N/A", "Reading Date": r.READING_DATE||"", "Month/Year": r.READING_DATE?new Date(r.READING_DATE).toISOString().substring(0,7):"", "Reading Value": r.METER_READING!=null?Number(r.METER_READING):"", "Is Estimate": r.ESTIMATED_READING_IND==="Y"||r.is_estimate?"Yes":"No", "Notes": r.notes||"", "Created At": r.created_at||"", "Updated At": r.updated_at||"" }; });
    },
  },
  {
    id: "payment-history",
    name: "Payment History Report (XLSX)",
    description: "Detailed log of all payments received.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Payment ID","Bill ID","Customer ID","Payment Date","Amount Paid","Payment Method","Reference","Processed By","Notes","Created At","Updated At"],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      let payments = ((await getAllPaymentsAction())?.data as any[] ?? []);
      const customers = ((await getAllCustomersAction())?.data as any[] ?? []).map(mapCustomer);
      const custMap = new Map(customers.map((c:any)=>[c.customerKeyNumber,c]));
      if (branchId) { const custSet = new Set(customers.filter((c:any)=>c.branchId===branchId).map((c:any)=>c.customerKeyNumber)); payments=payments.filter((p:any)=>p.individualCustomerId&&custSet.has(p.individualCustomerId)); }
      if (chargeGroup && chargeGroup!=="all") { payments=payments.filter((p:any)=>(custMap.get(p.individualCustomerId) as any)?.customerType===chargeGroup); }
      if (startDate && endDate) { const s=startDate.getTime(),e=endDate.getTime(); payments=payments.filter((p:any)=>{try{return new Date(p.paymentDate).getTime()>=s&&new Date(p.paymentDate).getTime()<=e;}catch{return false;}}); }
      return payments.map((p:any) => ({ "Payment ID": p.id, "Bill ID": p.billId, "Customer ID": p.individualCustomerId||"N/A", "Payment Date": p.paymentDate, "Amount Paid": p.amountPaid, "Payment Method": p.paymentMethod, "Reference": p.transactionReference||"N/A", "Processed By": p.processedByStaffId||"N/A", "Notes": p.notes||"", "Created At": p.createdAt, "Updated At": p.updatedAt }));
    },
  },
  {
    id: "meter-reading-accuracy",
    name: "Meter Reading Accuracy Report (XLSX)",
    description: "Detailed export of meter readings with reader information for accuracy analysis.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Reading ID","Meter Identifier","Meter Type","Reading Date","Month/Year","Reading Value","Is Estimate","Reader Name","Reader Staff ID","Notes"],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      const [indRes, bulkRes, bmRes, custRes, staffRes] = await Promise.all([getAllIndividualCustomerReadingsAction(), getAllBulkMeterReadingsAction(), getAllBulkMetersAction(), getAllCustomersAction(), getAllStaffMembersAction()]);
      const indReadings = ((indRes?.data as any[] ?? [])).map((r:any) => ({ ...r, _t: "individual" }));
      const bulkReadings = ((bulkRes?.data as any[] ?? [])).map((r:any) => ({ ...r, _t: "bulk" }));
      const bulkMeters = (bmRes?.data as any[] ?? []).map(mapBulkMeter);
      const customers = (custRes?.data as any[] ?? []).map(mapCustomer);
      const staffList = staffRes?.data as any[] ?? [];
      const bmMap = new Map(bulkMeters.map((bm:any)=>[bm.customerKeyNumber,bm]));
      const custMap = new Map(customers.map((c:any)=>[c.customerKeyNumber,c]));
      const staffMap = new Map(staffList.map((s:any)=>[s.id,s.name]));
      let readings: any[] = [...indReadings,...bulkReadings];
      if (branchId) { const bmSet=new Set(bulkMeters.filter((bm:any)=>bm.branchId===branchId).map((bm:any)=>bm.customerKeyNumber)); const custSet=new Set(customers.filter((c:any)=>c.branchId===branchId).map((c:any)=>c.customerKeyNumber)); readings=readings.filter((r:any)=>(r._t==="bulk"&&r.CUST_KEY&&bmSet.has(r.CUST_KEY))||(r._t==="individual"&&r.CUST_KEY&&custSet.has(r.CUST_KEY))); }
      if (chargeGroup && chargeGroup!=="all") { readings=readings.filter((r:any)=>r._t==="bulk"?(bmMap.get(r.CUST_KEY) as any)?.chargeGroup===chargeGroup:(custMap.get(r.CUST_KEY) as any)?.customerType===chargeGroup); }
      if (startDate && endDate) { const s=startDate.getTime(),e=endDate.getTime(); readings=readings.filter((r:any)=>{try{return new Date(r.READING_DATE).getTime()>=s&&new Date(r.READING_DATE).getTime()<=e;}catch{return false;}}); }
      return readings.map((r:any) => {
        let meterIdentifier = "N/A";
        if (r._t==="individual"&&r.CUST_KEY){const cust=custMap.get(r.CUST_KEY) as any;meterIdentifier=cust?(cust.name+" (M: "+(cust.meterNumber||"N/A")+")"):("Cust ID: "+r.CUST_KEY);}
        else if (r._t==="bulk"&&r.CUST_KEY){const bm=bmMap.get(r.CUST_KEY) as any;meterIdentifier=bm?(bm.name+" (M: "+(bm.meterNumber||"N/A")+")"):("BM ID: "+r.CUST_KEY);}
        const staffId=r.created_by||r.METER_READER_CODE||"";
        return { "Reading ID": r.id, "Meter Identifier": meterIdentifier, "Meter Type": r._t==="bulk"?"Bulk":"Individual", "Reading Date": r.READING_DATE||"", "Month/Year": r.READING_DATE?new Date(r.READING_DATE).toISOString().substring(0,7):"", "Reading Value": r.METER_READING!=null?Number(r.METER_READING):"", "Is Estimate": r.ESTIMATED_READING_IND==="Y"||r.is_estimate?"Yes":"No", "Reader Name": staffMap.get(staffId)||(staffId?("Staff ID: "+staffId):"N/A"), "Reader Staff ID": staffId||"N/A", "Notes": r.notes||"" };
      });
    },
  },
  {
    id: "tariffs-data-export",
    name: "Tariffs Data Export (XLSX)",
    description: "Download a comprehensive list of all tariffs.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Customer Type","Year","Tiers","Maintenance %","Sanitation %","Sewerage Tiers","Meter Rent Prices","VAT Rate","Domestic VAT Threshold"],
    getData: async (filters) => {
      const { chargeGroup } = filters;
      let tariffs = ((await getAllTariffsAction())?.data as any[] ?? []);
      if (chargeGroup && chargeGroup !== "all") tariffs = tariffs.filter((t:any) => t.customer_type === chargeGroup);
      return tariffs.map((t:any) => ({ "Customer Type": t.customer_type, "Year": t.year, "Tiers": JSON.stringify(t.tiers), "Maintenance %": t.maintenance_percentage, "Sanitation %": t.sanitation_percentage, "Sewerage Tiers": JSON.stringify(t.sewerage_tiers), "Meter Rent Prices": JSON.stringify(t.meter_rent_prices), "VAT Rate": t.vat_rate, "Domestic VAT Threshold": t.domestic_vat_threshold_m3 }));
    },
  },
  {
    id: "staff-data-export",
    name: "Staff Data Export (XLSX)",
    description: "Download a comprehensive list of all staff members.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["Staff ID","Name","Email","Branch Name","Status","Phone","Hire Date","Role"],
    getData: async (filters) => {
      const { branchId, startDate, endDate } = filters;
      let staff = ((await getAllStaffMembersAction())?.data as any[] ?? []);
      if (branchId) staff = staff.filter((s:any) => s.branchId === branchId);
      if (startDate && endDate) { const s=startDate.getTime(),e=endDate.getTime(); staff=staff.filter((s:any)=>{if(!s.hireDate)return false;try{const t=new Date(s.hireDate).getTime();return t>=s&&t<=e;}catch{return false;}}); }
      return staff.map((s:any) => ({ "Staff ID": s.id, "Name": s.name, "Email": s.email, "Branch Name": s.branchName, "Status": s.status, "Phone": s.phone, "Hire Date": s.hireDate, "Role": s.role }));
    },
  },
  {
    id: "monthly-bill-export-csv",
    name: "Monthly Bill Export (CSV)",
    description: "Export monthly bills in CSV format for external payment system integration.",
    requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,
    headers: ["BILLKEY","CUSTOMERKEY","CUSTOMERNAME","CUSTOMERTIN","CUSTOMERBRANCH","REASON","CURRREAD","PREVREAD","CONS","TOTALBILLAMOUNT","THISMONTHBILLAMT","OUTSTANDINGAMT","PENALTYAMT","VAT_AMOUNT","DRACCTNO","CRACCTNO"],
    getData: async (filters) => {
      const { branchId, startDate, endDate } = filters;
      const [billsRes, customersRes, bulkMetersRes, branchesRes] = await Promise.all([getAllBillsAction(), getAllCustomersAction(), getAllBulkMetersAction(), getAllBranchesAction()]);
      const allBills: any[] = billsRes?.data ?? [];
      const customers: any[] = (customersRes?.data ?? []).map(mapCustomer);
      const bulkMeters: any[] = (bulkMetersRes?.data ?? []).map(mapBulkMeter);
      const branches: any[] = branchesRes?.data ?? [];
      let bills = allBills;
      if (branchId) { const bmSet=new Set(bulkMeters.filter((bm:any)=>bm.branchId===branchId).map((bm:any)=>bm.customerKeyNumber)); const custSet=new Set(customers.filter((c:any)=>c.branchId===branchId).map((c:any)=>c.customerKeyNumber)); bills=bills.filter((b:any)=>(b.CUSTOMERKEY&&bmSet.has(b.CUSTOMERKEY))||(b.individualCustomerId&&custSet.has(b.individualCustomerId))); }
      if (startDate && endDate) { const s=startDate.getTime(),e=endDate.getTime(); bills=bills.filter((b:any)=>{try{return new Date(b.billPeriodEndDate).getTime()>=s&&new Date(b.billPeriodEndDate).getTime()<=e;}catch{return false;}}); }
      const branchMap = new Map(branches.map((br:any)=>[br.id,br.name]));
      return bills.map((bill:any) => {
        let customerName=bill.CUSTOMERNAME||"N/A", customerBranch="N/A";
        const customerKey=bill.CUSTOMERKEY||bill.individualCustomerId;
        if (bill.individualCustomerId){const cust=customers.find((c:any)=>c.customerKeyNumber===bill.individualCustomerId);if(cust){if(!customerName||customerName==="N/A")customerName=cust.name;customerBranch=(branchMap.get(cust.branchId) as string)||"N/A";}}
        else if(bill.CUSTOMERKEY){const bm=bulkMeters.find((b:any)=>b.customerKeyNumber===bill.CUSTOMERKEY);if(bm){if(!customerName||customerName==="N/A")customerName=bm.name;customerBranch=(branchMap.get(bm.branchId) as string)||"N/A";}}
        const thisM=Number(bill.THISMONTHBILLAMT||bill.baseWaterCharge||0),out=Number(bill.OUTSTANDINGAMT||0),pen=Number(bill.PENALTYAMT||0),total=Number(bill.TOTALBILLAMOUNT||(thisM+out+pen));
        let bk=bill.BILLKEY;if(!bk){const h=(bill.id||"").replace(/-/g,"").substring(0,8);const n=parseInt(h,16);bk=isNaN(n)?"BBPT-0000000000":`BBPT-${String(n).padStart(10,"0")}`;}
        const pmr=(v?: string)=>{if(!v||!v.includes("-"))return "";const[yr,mo]=v.split("-");if(!yr||!mo)return "";const d=new Date(Date.UTC(Number(yr),Number(mo)-1,1));return `${d.toLocaleString("en-US",{month:"short"})}-${yr}`;};
        const reasonFormatted=pmr(bill.monthYear||bill.month_year||bill.REASON)||(bill.monthYear||bill.month_year||bill.REASON||"");
        const branchFromBill=(branchMap.get(bill.CUSTOMERBRANCH) as string)||bill.CUSTOMERBRANCH;
        return { "BILLKEY": bk, "CUSTOMERKEY": customerKey, "CUSTOMERNAME": customerName, "CUSTOMERTIN": "", "CUSTOMERBRANCH": branchFromBill||customerBranch, "REASON": reasonFormatted, "CURRREAD": bill.CURRREAD, "PREVREAD": bill.PREVREAD, "CONS": bill.CONS||0, "TOTALBILLAMOUNT": parseFloat(total.toFixed(2)), "THISMONTHBILLAMT": parseFloat(thisM.toFixed(2)), "OUTSTANDINGAMT": parseFloat(out.toFixed(2)), "PENALTYAMT": parseFloat(pen.toFixed(2)), "VAT_AMOUNT": parseFloat(Number(bill.vat_amount??bill.vatAmount??0).toFixed(2)), "DRACCTNO": bill.DRACCTNO||"", "CRACCTNO": bill.CRACCTNO||"" };
      });
    },
  },
];

export default function StaffReportsPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canGenerateAllReports = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL);
  const canGenerateBranchReports = hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH);
  const canAccessReport = React.useCallback((report: ReportType) => {
    const requiredPermission = report.requiredPermission ?? PERMISSIONS.REPORTS_GENERATE_BRANCH;
    return hasPermission(requiredPermission) || canGenerateAllReports;
  }, [hasPermission, canGenerateAllReports]);
  const accessibleReports = React.useMemo(() => availableStaffReports.filter(canAccessReport), [canAccessReport]);

  const [selectedReportId, setSelectedReportId] = React.useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [staffBranchName, setStaffBranchName] = React.useState<string | undefined>(undefined);
  const [staffBranchId, setStaffBranchId] = React.useState<string | undefined>(undefined);
  const [allBranches, setAllBranches] = React.useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = React.useState<string>("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [selectedColumns, setSelectedColumns] = React.useState<Set<string>>(new Set());
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = React.useState(false);
  const [reportData, setReportData] = React.useState<any[] | null>(null);
  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [selectedYear, setSelectedYear] = React.useState<string>("all");
  const [selectedMonth, setSelectedMonth] = React.useState<string>("all");
  const [selectedChargeGroup, setSelectedChargeGroup] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(true);

  const selectedReport = accessibleReports.find(r => r.id === selectedReportId);
  const effectiveBranchId = canGenerateAllReports
    ? (selectedBranch === "all" ? undefined : selectedBranch)
    : staffBranchId;

  const years = React.useMemo(() => {
    const s = new Set(bulkMeters.map(bm => bm.month.split("-")[0]));
    return Array.from(s).sort().reverse();
  }, [bulkMeters]);

  const chartData = React.useMemo(() => {
    let bms = bulkMeters;
    if (effectiveBranchId) bms = bms.filter(bm => bm.branchId === effectiveBranchId);
    if (selectedYear !== "all") bms = bms.filter(bm => bm.month.startsWith(selectedYear));
    if (selectedMonth !== "all") bms = bms.filter(bm => bm.month.split("-")[1] === selectedMonth);
    const monthly: { [k: string]: { name: string; differenceUsage: number } } = {};
    bms.forEach(bm => { if (bm.differenceUsage) { if (!monthly[bm.month]) monthly[bm.month] = { name: bm.month, differenceUsage: 0 }; monthly[bm.month].differenceUsage += bm.differenceUsage; } });
    return Object.values(monthly).sort((a, b) => a.name.localeCompare(b.name));
  }, [bulkMeters, effectiveBranchId, selectedYear, selectedMonth]);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const rawBms = ((await getAllBulkMetersAction())?.data as any[] ?? []);
      setBulkMeters(rawBms.map(mapBulkMeter));
      if (canGenerateAllReports) {
        const branchRes = ((await getAllBranchesAction())?.data as any[] ?? []);
        setAllBranches(branchRes);
      }
      setIsLoading(false);
    };
    fetchData();
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const u: User = JSON.parse(storedUser);
        if (u.branchId && u.branchName) { setStaffBranchName(u.branchName); setStaffBranchId(u.branchId); }
      } catch (e) { console.error("Failed to parse user", e); }
    }
  }, [canGenerateAllReports]);

  React.useEffect(() => { setSelectedColumns(new Set(selectedReport?.headers || [])); }, [selectedReport]);

  const getFilteredData = React.useCallback(async () => {
    if (!selectedReport?.getData) return [];
    if (!canGenerateAllReports && !canGenerateBranchReports) return [];
    return await selectedReport.getData({ branchId: effectiveBranchId, startDate: dateRange?.from, endDate: dateRange?.to, chargeGroup: selectedChargeGroup });
  }, [selectedReport, effectiveBranchId, dateRange, selectedChargeGroup, canGenerateAllReports, canGenerateBranchReports]);

  const handleGenerateReport = () => {
    if (!selectedReport) return;
    if (!selectedReport.getData || !selectedReport.headers) { toast({ variant: "destructive", title: "Report Not Implemented", description: `${selectedReport.name} is not available for download yet.` }); return; }
    if (!canGenerateAllReports && !staffBranchId) { toast({ variant: "destructive", title: "Branch Information Missing", description: "Cannot generate branch-specific report without branch information." }); return; }
    setIsGenerating(true);
    const generate = async () => {
      try {
        const data = await getFilteredData();
        if (!data || data.length === 0) { toast({ title: "No Data", description: `No data available to generate ${selectedReport.name}.` }); setIsGenerating(false); return; }
        const finalHeaders = Array.from(selectedColumns);
        const isCsv = selectedReport.id === "monthly-bill-export-csv";
        const blob = isCsv ? arrayToCsvBlob(data, finalHeaders) : arrayToXlsxBlob(data, finalHeaders);
        const ext = isCsv ? "csv" : "xlsx";
        const fileName = `${selectedReport.id}_${new Date().toISOString().split("T")[0]}.${ext}`;
        downloadFile(blob, fileName);
        toast({ title: "Report Generated", description: `${selectedReport.name} downloaded as ${fileName}.` });
      } catch (error) {
        console.error("Error generating report:", error);
        toast({ variant: "destructive", title: "Error Generating Report", description: "An unexpected error occurred." });
      } finally { setIsGenerating(false); }
    };
    generate();
  };

  const handleViewReport = () => {
    if (!selectedReport) return;
    if (!canGenerateAllReports && !canGenerateBranchReports) { toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to generate reports." }); return; }
    if (!selectedReport.getData || !selectedReport.headers) { toast({ variant: "destructive", title: "Report Not Implemented" }); return; }
    const fetchViewData = async () => { const data = await getFilteredData(); if (!data || data.length === 0) { toast({ title: "No Data", description: `No data found for ${selectedReport.name} with the selected filters.` }); return; } setReportData(data); };
    fetchViewData();
  };

  if (!canGenerateAllReports && !canGenerateBranchReports) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Reports &amp; Analytics</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <UIAlertDescription>You do not have permission to generate reports.</UIAlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">
          Reports &amp; Analytics {!canGenerateAllReports && staffBranchName ? `(${staffBranchName})` : ""}
        </h1>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Overall Difference Usage Trend</CardTitle>
                <CardDescription>Shows the trend of difference usage{canGenerateAllReports ? " across all branches" : " for your branch"}.</CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full md:w-[120px]"><SelectValue placeholder="Select Year" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Years</SelectItem>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-[120px]"><SelectValue placeholder="Select Month" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Months</SelectItem>{[...Array(12)].map((_,i) => <SelectItem key={i+1} value={String(i+1).padStart(2,"0")}>{new Date(0,i).toLocaleString("default",{month:"long"})}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading chart data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: "Usage (m\u00B3)", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="differenceUsage" fill="#8884d8" name="Difference Usage (m\u00B3)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Report Generation</CardTitle>
          <CardDescription>Select a report type and apply filters to generate and download.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="report-type">Select Report Type</Label>
            <Select value={selectedReportId} onValueChange={(v) => { setSelectedReportId(v); setReportData(null); }}>
              <SelectTrigger id="report-type" className="w-full md:w-[400px]"><SelectValue placeholder="Choose a report..." /></SelectTrigger>
              <SelectContent>{accessibleReports.map(r => (<SelectItem key={r.id} value={r.id} disabled={!r.getData}><div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-muted-foreground" />{r.name}</div></SelectItem>))}</SelectContent>
            </Select>
          </div>

          {selectedReport && (
            <Card className="bg-muted/50">
              <CardHeader><CardTitle>{selectedReport.name}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
                {selectedReport.getData ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>Filter by Branch</Label>
                        {canGenerateAllReports ? (
                          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Branches</SelectItem>{allBranches.map((b:any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : (
                          <div className="p-2 border rounded-md text-sm text-muted-foreground bg-background">{staffBranchName || "N/A"}</div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="charge-group-filter">Filter by Charge Group</Label>
                        <Select value={selectedChargeGroup} onValueChange={setSelectedChargeGroup}>
                          <SelectTrigger id="charge-group-filter"><SelectValue placeholder="Select a charge group" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All Charge Groups</SelectItem>{customerTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date-range-filter">Filter by Date</Label>
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                      </div>
                      <div className="space-y-2">
                        <Label>Select Columns</Label>
                        <Popover open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={isColumnSelectorOpen} className="w-full justify-between" disabled={!selectedReport.headers}>
                              {selectedColumns.size} of {selectedReport.headers?.length} selected
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search columns..." />
                              <CommandEmpty>No column found.</CommandEmpty>
                              <CommandList>
                                <CommandGroup>
                                  {selectedReport.headers?.map(h => (
                                    <CommandItem key={h} value={h} onSelect={() => { setSelectedColumns(prev => { const s = new Set(prev); s.has(h) ? s.delete(h) : s.add(h); return s; }); }}>
                                      <Check className={cn("mr-2 h-4 w-4", selectedColumns.has(h) ? "opacity-100" : "opacity-0")} />
                                      {h.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert variant="default" className="mt-4 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-700 dark:text-blue-300">Coming Soon</AlertTitle>
                    <UIAlertDescription className="text-blue-600 dark:text-blue-400">This report is currently under development.</UIAlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {selectedReport && selectedReport.getData && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleViewReport} disabled={isGenerating || !selectedReportId || (!canGenerateAllReports && !staffBranchId)}>
                <Eye className="mr-2 h-4 w-4" />
                View Report
              </Button>
              <Button onClick={handleGenerateReport} disabled={isGenerating || !selectedReportId || (!canGenerateAllReports && !staffBranchId)}>
                <Download className="mr-2 h-4 w-4" />
                {isGenerating ? "Generating..." : `Generate & Download ${selectedReport.name.includes("CSV") ? "CSV" : "XLSX"}`}
              </Button>
            </div>
          )}

          {!selectedReportId && (
            <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
              Please select a report type to see details and generate.
            </div>
          )}
        </CardContent>
      </Card>

      {reportData && selectedColumns.size > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Report Preview: {selectedReport?.name.replace(" (XLSX)","").replace(" (CSV)","")}</CardTitle>
            <CardDescription>Displaying {reportData.length} row(s) with {selectedColumns.size} column(s).</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportDataView data={reportData} headers={Array.from(selectedColumns)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
