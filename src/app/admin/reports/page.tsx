
"use client";

import * as React from "react";
import Link from "next/link";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from '@/lib/xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Info, AlertCircle, Lock, Archive, Trash2, Filter, Check, ChevronsUpDown, Eye, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  getCustomers,
  getBulkMeters,
  initializeCustomers,
  initializeBulkMeters,
  getBills,
  initializeBills,
  getMeterReadings,
  initializeIndividualCustomerReadings,
  initializeBulkMeterReadings,
  getPayments,
  initializePayments,
  getStaffMembers,
  initializeStaffMembers,
  getBranches,
  initializeBranches,
  removeBill,
  getTariffs,
} from "@/lib/data-store";
import type { IndividualCustomer } from "../individual-customers/individual-customer-types";
import type { BulkMeter } from "../bulk-meters/bulk-meter-types";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import type { StaffMember } from "../staff-management/staff-types";
import type { Branch } from "../branches/branch-types";
import type { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { usePermissions } from "@/hooks/use-permissions";
import { DatePicker } from "@/components/ui/date-picker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { DomainBill, DomainPayment } from "@/lib/data-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ReportDataView } from './report-data-view';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { calculateBillAction, syncAllBillsAgingDebtAction } from "@/lib/actions";
import { RefreshCw, Zap } from "lucide-react";
import { type CustomerType, type SewerageConnection, customerTypes } from "@/lib/billing-calculations";
import { ReportAIAssistant } from "./report-ai-assistant";


// Top-level type guards for meter reading unions (used by multiple reports)
const isBulkReading = (r: any): r is { meterType: string; CUSTOMERKEY?: string } => {
  return r && typeof r === 'object' && 'meterType' in r && r.meterType === 'bulk_meter';
};

const isIndividualReading = (r: any): r is { meterType: string; individualCustomerId?: string } => {
  return r && typeof r === 'object' && 'meterType' in r && r.meterType === 'individual_customer_meter';
};


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
}




const availableReports: ReportType[] = [
  {
    id: "customer-data-export",
    name: "Customer Data Export (XLSX)",
    description: "Download a comprehensive list of all individual customers with their details.",
    headers: [
      "Customer Key", "Name", "Contract Number", "Customer Type", "Book Number", "Ordinal",
      "Meter Size", "Meter Number", "Previous Reading", "Current Reading", "Month", "Specific Area",
      "SubCity", "Woreda", "Sewerage Connection", "Assigned Bulk Meter ID", "Status", "Payment Status", "Calculated Bill",
      "Assigned Branch Name", "Created At", "Updated At"
    ],
    getData: (filters) => {
      const { branchId, startDate, endDate } = filters;
      const customers = getCustomers();
      const branches = getBranches();

      let filteredData = customers;

      if (branchId) {
        filteredData = filteredData.filter(c => c.branchId === branchId);
      }
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        filteredData = filteredData.filter(c => {
          if (!c.created_at) return false;
          try {
            const customerDate = new Date(c.created_at).getTime();
            return customerDate >= start && customerDate <= end;
          } catch { return false; }
        });
      }

      const dataWithBranchName = filteredData.map(customer => {
        const branch = customer.branchId ? branches.find(b => b.id === customer.branchId) : null;
        return {
          "Customer Key": customer.customerKeyNumber,
          "Name": customer.name,
          "Contract Number": customer.contractNumber,
          "Customer Type": customer.customerType,
          "Book Number": customer.bookNumber,
          "Ordinal": customer.ordinal,
          "Meter Size": customer.meterSize,
          "Meter Number": customer.meterNumber,
          "Previous Reading": customer.previousReading,
          "Current Reading": customer.currentReading,
          "Month": customer.month,
          "Specific Area": customer.specificArea,
          "SubCity": customer.subCity,
          "Woreda": customer.woreda,
          "Sewerage Connection": customer.sewerageConnection,
          "Assigned Bulk Meter ID": customer.assignedBulkMeterId || "N/A",
          "Status": customer.status,
          "Payment Status": customer.paymentStatus,
          "Calculated Bill": customer.calculatedBill,
          "Assigned Branch Name": branch ? branch.name : "N/A",
          "Created At": customer.created_at,
          "Updated At": customer.updated_at,
        };
      });

      return dataWithBranchName;
    },
  },
  {
    id: "bulk-meter-data-export",
    name: "Bulk Meter Data Export (XLSX)",
    description: "Download a comprehensive list of all bulk meters, including their details and readings.",
    headers: [
      "Customer Key", "Name", "Contract Number", "Meter Size", "Meter Number",
      "Previous Reading", "Current Reading", "Month", "Specific Area", "SubCity", "Woreda", "Status",
      "Payment Status", "Charge Group", "Sewerage Connection", "Assigned Branch Name", "Number of Assigned Individual Customers",
      "Bulk Usage", "Total Individual Usage", "Total Bulk Bill", "Difference Usage", "Difference Bill"
    ],
    getData: async (filters) => {
      const { branchId } = filters;
      const bulkMeters = getBulkMeters();
      const branches = getBranches();
      const customers = getCustomers();

      let filteredData = bulkMeters;

      if (branchId) {
        filteredData = filteredData.filter(bm => bm.branchId === branchId);
      }

      const dataWithBranchName = await Promise.all(filteredData.map(async (bm) => {
        const branch = bm.branchId ? branches.find(b => b.id === bm.branchId) : null;

        const associatedCustomers = customers.filter(c => c.assignedBulkMeterId === bm.customerKeyNumber);
        const totalIndividualUsage = associatedCustomers.reduce((sum, cust) => {
          const usage = (cust.currentReading ?? 0) - (cust.previousReading ?? 0);
          return sum + usage;
        }, 0);

        const bulkUsage = bm.bulkUsage ?? 0;
        const differenceUsage = bulkUsage < totalIndividualUsage ? 3 : bulkUsage - totalIndividualUsage;

        const billingMonth = new Date().toISOString().slice(0, 7);
        let differenceBill = 0;
        if (bm.chargeGroup) {
          const { data: differenceBillResult } = await calculateBillAction(
            differenceUsage,
            bm.chargeGroup as CustomerType,
            bm.sewerageConnection as SewerageConnection,
            bm.meterSize,
            billingMonth
          );
          differenceBill = differenceBillResult?.totalBill ?? 0;
        } else {
          console.warn(`Bulk meter ${bm.customerKeyNumber} is missing a chargeGroup. Bill calculation skipped.`);
        }

        return {
          "Customer Key": bm.customerKeyNumber,
          "Name": bm.name,
          "Contract Number": bm.contractNumber,
          "Meter Size": bm.meterSize,
          "Meter Number": bm.meterNumber,
          "Previous Reading": bm.previousReading,
          "Current Reading": bm.currentReading,
          "Month": bm.month,
          "Specific Area": bm.specificArea,
          "SubCity": bm.subCity,
          "Woreda": bm.woreda,
          "Status": bm.status,
          "Payment Status": bm.paymentStatus,
          "Charge Group": bm.chargeGroup,
          "Sewerage Connection": bm.sewerageConnection,
          "Assigned Branch Name": branch ? branch.name : "N/A",
          "Number of Assigned Individual Customers": associatedCustomers.length,
          "Total Individual Usage": totalIndividualUsage,
          "Bulk Usage": bulkUsage,
          "Difference Usage": differenceUsage,
          "Difference Bill": differenceBill,
        };
      }));

      return dataWithBranchName;
    },
  },
  {
    id: "billing-summary",
    name: "Billing Summary Report (XLSX)",
    description: "Summary of all generated bills, including amounts and payment statuses.",
    headers: [
      "Bill ID", "Bill Key", "Customer Key", "Customer Name", "Customer TIN", "Branch", "Period Start", "Period End",
      "Month/Year", "Previous Reading", "Current Reading", "Consumption", "Reason",
      "Base Water Charge", "Sewerage Charge", "Maintenance Fee", "Sanitation Fee",
      "Meter Rent", "Current Bill", "Penalty", "Total Bill", "Amount Paid", "Outstanding", "Due Date",
      "Status", "Bill Number", "DR Account", "CR Account", "Notes", "Created At", "Updated At"
    ],
    getData: (filters) => {
      const { branchId, startDate, endDate } = filters;
      let billsList = getBills();

      if (branchId) {
        const bulkMetersInBranch = getBulkMeters().filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber);
        const customersInBranch = getCustomers().filter(c => c.branchId === branchId).map(c => c.customerKeyNumber);
        billsList = billsList.filter(b =>
          (b.CUSTOMERKEY && bulkMetersInBranch.includes(b.CUSTOMERKEY)) ||
          (b.individualCustomerId && customersInBranch.includes(b.individualCustomerId))
        );
      }
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        billsList = billsList.filter(b => {
          try {
            const billDate = new Date(b.billPeriodEndDate).getTime();
            return billDate >= start && billDate <= end;
          } catch { return false; }
        });
      }

      // Map CUSTOMERKEY and calculate dynamic values
      const billsByMeter: Record<string, DomainBill[]> = {};
      const allBills = getBills();

      return billsList.map(b => {
        let billKey = b.BILLKEY;
        if (!billKey) {
          const idHex = (b.id || "").replace(/-/g, '').substring(0, 8);
          const idNumeric = parseInt(idHex, 16);
          billKey = isNaN(idNumeric) ? "BBPT-0000000000" : `BBPT-${String(idNumeric).padStart(10, '0')}`;
        }

        const customerKey = b.CUSTOMERKEY || (b as any).individualCustomerId;

        // Reconstruct Outstanding if needed
        let reconstructedOutstanding = 0;
        if (customerKey) {
          if (!billsByMeter[customerKey]) {
            billsByMeter[customerKey] = allBills
              .filter(ob => (ob.CUSTOMERKEY === customerKey || (ob as any).individualCustomerId === customerKey))
              .sort((m1, m2) => new Date(m2.billPeriodEndDate).getTime() - new Date(m1.billPeriodEndDate).getTime());
          }

          const meterHistory = billsByMeter[customerKey];
          const fullIndex = meterHistory.findIndex(mh => mh.id === b.id);

          const getUnpaidAmount = (billRow: any) => {
            if (billRow.paymentStatus === 'Paid') return 0;
            return Number(billRow.TOTALBILLAMOUNT) - Number(billRow.amountPaid || 0);
          };

          if (fullIndex !== -1 && fullIndex < meterHistory.length - 1) {
            for (let j = fullIndex + 1; j < meterHistory.length; j++) {
              reconstructedOutstanding += getUnpaidAmount(meterHistory[j]);
            }
          }

          // Add initial balance from oldest bill
          if (meterHistory.length > 0) {
            reconstructedOutstanding += meterHistory[meterHistory.length - 1].balanceCarriedForward ?? 0;
          }
        }

        const currentBill = b.TOTALBILLAMOUNT;
        const outstanding = reconstructedOutstanding || b.balanceCarriedForward || 0;

        return {
          "Bill ID": b.id,
          "Bill Key": billKey,
          "Customer Key": customerKey,
          "Customer Name": b.CUSTOMERNAME,
          "Customer TIN": b.CUSTOMERTIN,
          "Branch": b.CUSTOMERBRANCH,
          "Period Start": b.billPeriodStartDate,
          "Period End": b.billPeriodEndDate,
          "Month/Year": b.monthYear,
          "Previous Reading": b.PREVREAD,
          "Current Reading": b.CURRREAD,
          "Consumption": b.CONS,
          "Reason": b.REASON,
          "Base Water Charge": b.baseWaterCharge,
          "Sewerage Charge": b.sewerageCharge,
          "Maintenance Fee": b.maintenanceFee,
          "Sanitation Fee": b.sanitationFee,
          "Meter Rent": b.meterRent,
          "Current Bill": currentBill,
          "Penalty": b.PENALTYAMT,
          "Total Bill": currentBill + outstanding,
          "Amount Paid": b.amountPaid,
          "Outstanding": outstanding,
          "Due Date": b.dueDate,
          "Status": b.paymentStatus,
          "Bill Number": b.billNumber,
          "DR Account": b.DRACCTNO,
          "CR Account": b.CRACCTNO,
          "Notes": b.notes,
          "Created At": b.createdAt,
          "Updated At": b.updatedAt,
        };
      });
    },
  },
  {
    id: "list-of-paid-bills",
    name: "List Of Paid Bills (XLSX)",
    description: "A filtered list showing only the bills that have been marked as 'Paid'.",
    headers: [
      "Bill ID", "Individual Customer ID", "Customer Key", "Period Start", "Period End",
      "Month/Year", "Previous Reading", "Current Reading", "Consumption",
      "Base Water Charge", "Sewerage Charge", "Maintenance Fee", "Sanitation Fee",
      "Meter Rent", "Total Bill Amount", "Amount Paid", "Outstanding Amount", "Due Date",
      "Status", "Bill Number", "Notes", "Created At", "Updated At"
    ],
    getData: (filters) => {
      const { branchId, startDate, endDate } = filters;
      let bills = getBills().filter(b => b.paymentStatus === 'Paid');

      if (branchId) {
        const bulkMetersInBranch = getBulkMeters().filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber);
        const customersInBranch = getCustomers().filter(c => c.branchId === branchId).map(c => c.customerKeyNumber);
        bills = bills.filter(b =>
          (b.CUSTOMERKEY && bulkMetersInBranch.includes(b.CUSTOMERKEY)) ||
          (b.individualCustomerId && customersInBranch.includes(b.individualCustomerId))
        );
      }
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        bills = bills.filter(b => {
          try {
            const billDate = new Date(b.billPeriodEndDate).getTime();
            return billDate >= start && billDate <= end;
          } catch { return false; }
        });
      }
      return bills.map(b => ({
        "Bill ID": b.id,
        "Individual Customer ID": b.individualCustomerId || "N/A",
        "Customer Key": b.CUSTOMERKEY || "N/A",
        "Period Start": b.billPeriodStartDate,
        "Period End": b.billPeriodEndDate,
        "Month/Year": b.monthYear,
        "Previous Reading": b.PREVREAD,
        "Current Reading": b.CURRREAD,
        "Consumption": b.CONS,
        "Base Water Charge": b.baseWaterCharge,
        "Sewerage Charge": b.sewerageCharge,
        "Maintenance Fee": b.maintenanceFee,
        "Sanitation Fee": b.sanitationFee,
        "Meter Rent": b.meterRent,
        "Total Bill Amount": b.TOTALBILLAMOUNT,
        "Amount Paid": b.amountPaid,
        "Outstanding Amount": b.OUTSTANDINGAMT,
        "Due Date": b.dueDate,
        "Status": b.paymentStatus,
        "Bill Number": b.billNumber,
        "Notes": b.notes,
        "Created At": b.createdAt,
        "Updated At": b.updatedAt,
      }));
    },
  },
  {
    id: "list-of-sent-bills",
    name: "List Of Sent Bills (XLSX)",
    description: "A comprehensive list of all bills that have been generated, regardless of payment status.",
    headers: [
      "Bill ID", "Individual Customer ID", "Customer Key", "Period Start", "Period End",
      "Month/Year", "Previous Reading", "Current Reading", "Consumption",
      "Base Water Charge", "Sewerage Charge", "Maintenance Fee", "Sanitation Fee",
      "Meter Rent", "Total Bill Amount", "Amount Paid", "Outstanding Amount", "Due Date",
      "Status", "Bill Number", "Notes", "Created At", "Updated At"
    ],
    getData: (filters) => {
      const { branchId, startDate, endDate } = filters;
      let bills = getBills();

      if (branchId) {
        const bulkMetersInBranch = getBulkMeters().filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber);
        const customersInBranch = getCustomers().filter(c => c.branchId === branchId).map(c => c.customerKeyNumber);
        bills = bills.filter(b =>
          (b.CUSTOMERKEY && bulkMetersInBranch.includes(b.CUSTOMERKEY)) ||
          (b.individualCustomerId && customersInBranch.includes(b.individualCustomerId))
        );
      }
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        bills = bills.filter(b => {
          try {
            const billDate = new Date(b.billPeriodEndDate).getTime();
            return billDate >= start && billDate <= end;
          } catch { return false; }
        });
      }
      return bills.map(b => ({
        "Bill ID": b.id,
        "Individual Customer ID": b.individualCustomerId || "N/A",
        "Customer Key": b.CUSTOMERKEY || "N/A",
        "Period Start": b.billPeriodStartDate,
        "Period End": b.billPeriodEndDate,
        "Month/Year": b.monthYear,
        "Previous Reading": b.PREVREAD,
        "Current Reading": b.CURRREAD,
        "Consumption": b.CONS,
        "Base Water Charge": b.baseWaterCharge,
        "Sewerage Charge": b.sewerageCharge,
        "Maintenance Fee": b.maintenanceFee,
        "Sanitation Fee": b.sanitationFee,
        "Meter Rent": b.meterRent,
        "Total Bill Amount": b.TOTALBILLAMOUNT,
        "Amount Paid": b.amountPaid,
        "Outstanding Amount": b.OUTSTANDINGAMT,
        "Due Date": b.dueDate,
        "Status": b.paymentStatus,
        "Bill Number": b.billNumber,
        "Notes": b.notes,
        "Created At": b.createdAt,
        "Updated At": b.updatedAt,
      }));
    },
  },
  {
    id: "water-usage",
    name: "Water Usage Report (XLSX)",
    description: "Detailed water consumption report from all meter readings.",
    headers: [
      "Reading ID", "Meter Type", "Customer ID", "Bulk Meter ID", "Staff ID",
      "Reading Date", "Month/Year", "Reading Value", "Is Estimate", "Notes",
      "Created At", "Updated At"
    ],
    getData: (filters) => {
      const { branchId, startDate, endDate } = filters;
      let readings = getMeterReadings();

      if (branchId) {
        const bulkMetersInBranch = getBulkMeters().filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber);
        const customersInBranch = getCustomers().filter(c => c.branchId === branchId).map(c => c.customerKeyNumber);
        readings = readings.filter(r =>
          (isBulkReading(r) && r.CUSTOMERKEY && bulkMetersInBranch.includes(r.CUSTOMERKEY)) ||
          (isIndividualReading(r) && r.individualCustomerId && customersInBranch.includes(r.individualCustomerId))
        );
      }
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        readings = readings.filter(r => {
          try {
            const readingDate = new Date(r.readingDate).getTime();
            return readingDate >= start && readingDate <= end;
          } catch { return false; }
        });
      }
      return readings.map(r => {
        const isBulk = isBulkReading(r);
        return {
          "Reading ID": r.id,
          "Meter Type": isBulk ? "Bulk" : "Individual",
          "Customer ID": (!isBulk && (r as any).individualCustomerId) || "N/A",
          "Bulk Meter ID": (isBulk && (r as any).CUSTOMERKEY) || "N/A",
          "Staff ID": r.readerStaffId || "N/A",
          "Reading Date": r.readingDate,
          "Month/Year": r.monthYear,
          "Reading Value": r.readingValue,
          "Is Estimate": (r as any).isEstimate ? "Yes" : "No",
          "Notes": r.notes || "",
          "Created At": r.createdAt,
          "Updated At": r.updatedAt,
        };
      });
    },
  },
  {
    id: "payment-history",
    name: "Payment History Report (XLSX)",
    description: "Detailed log of all payments received.",
    headers: [
      "Payment ID", "Bill ID", "Customer ID", "Payment Date", "Amount Paid",
      "Payment Method", "Reference", "Processed By", "Notes",
      "Created At", "Updated At"
    ],
    getData: (filters) => {
      const { branchId, startDate, endDate } = filters;
      let payments = getPayments();

      if (branchId) {
        const customersInBranch = getCustomers().filter(c => c.branchId === branchId).map(c => c.customerKeyNumber);
        payments = payments.filter(p => p.individualCustomerId && customersInBranch.includes(p.individualCustomerId));
      }
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        payments = payments.filter(p => {
          try {
            const paymentDate = new Date(p.paymentDate).getTime();
            return paymentDate >= start && paymentDate <= end;
          } catch { return false; }
        });
      }
      return payments.map(p => ({
        "Payment ID": p.id,
        "Bill ID": p.billId,
        "Customer ID": p.individualCustomerId || "N/A",
        "Payment Date": p.paymentDate,
        "Amount Paid": p.amountPaid,
        "Payment Method": p.paymentMethod,
        "Reference": p.transactionReference || "N/A",
        "Processed By": p.processedByStaffId || "N/A",
        "Notes": p.notes || "",
        "Created At": p.createdAt,
        "Updated At": p.updatedAt,
      }));
    },
  },
  {
    id: "meter-reading-accuracy",
    name: "Meter Reading Accuracy Report (XLSX)",
    description: "Detailed export of meter readings with reader information for accuracy analysis.",
    headers: [
      "Reading ID", "Meter Identifier", "Meter Type", "Reading Date", "Month/Year",
      "Reading Value", "Is Estimate", "Reader Name", "Reader Staff ID", "Notes"
    ],
    getData: (filters) => {
      const { branchId, startDate, endDate } = filters;
      const readings = getMeterReadings();
      const customers = getCustomers();
      const bulkMeters = getBulkMeters();
      const staffList = getStaffMembers();

      // use top-level isBulkReading / isIndividualReading

      let filteredReadings = readings;

      if (branchId) {
        const bulkMetersInBranch = bulkMeters.filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber);
        const customersInBranch = customers.filter(c => c.branchId === branchId).map(c => c.customerKeyNumber);
        filteredReadings = filteredReadings.filter(r =>
          (isBulkReading(r) && r.CUSTOMERKEY && bulkMetersInBranch.includes(r.CUSTOMERKEY)) ||
          (isIndividualReading(r) && r.individualCustomerId && customersInBranch.includes(r.individualCustomerId))
        );
      }
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        filteredReadings = filteredReadings.filter(r => {
          try {
            const readingDate = new Date(r.readingDate).getTime();
            return readingDate >= start && readingDate <= end;
          } catch { return false; }
        });
      }

      const dataWithNames = filteredReadings.map(r => {
        let meterIdentifier = "N/A";
        if (isIndividualReading(r) && r.individualCustomerId) {
          const cust = customers.find(c => c.customerKeyNumber === r.individualCustomerId);
          meterIdentifier = cust ? `${cust.name} (M: ${cust.meterNumber || 'N/A'})` : `Cust ID: ${r.individualCustomerId}`;
        } else if (isBulkReading(r) && r.CUSTOMERKEY) {
          const bm = bulkMeters.find(b => b.customerKeyNumber === r.CUSTOMERKEY);
          meterIdentifier = bm ? `${bm.name} (M: ${bm.meterNumber || 'N/A'})` : `BM ID: ${r.CUSTOMERKEY}`;
        }

        const reader = r.readerStaffId ? staffList.find(s => s.id === r.readerStaffId) : null;
        const readerName = reader ? reader.name : (r.readerStaffId ? `Staff ID: ${r.readerStaffId}` : "N/A");

        return {
          "Reading ID": r.id,
          "Meter Identifier": meterIdentifier,
          "Meter Type": isIndividualReading(r) ? 'Individual' : (isBulkReading(r) ? 'Bulk' : 'Unknown'),
          "Reading Date": r.readingDate,
          "Month/Year": r.monthYear,
          "Reading Value": r.readingValue,
          "Is Estimate": 'isEstimate' in r && r.isEstimate ? "Yes" : "No",
          "Reader Name": readerName,
          "Reader Staff ID": r.readerStaffId || "N/A",
          "Notes": r.notes || "",
        };
      });
      return dataWithNames;
    },
  },
  {
    id: "tariffs-data-export",
    name: "Tariffs Data Export (XLSX)",
    description: "Download a comprehensive list of all tariffs.",
    headers: [
      "Customer Type", "Year", "Tiers", "Maintenance %", "Sanitation %",
      "Sewerage Tiers", "Meter Rent Prices", "VAT Rate", "Domestic VAT Threshold"
    ],
    getData: (filters) => {
      const tariffs = getTariffs();
      return tariffs.map(t => ({
        "Customer Type": t.customer_type,
        "Year": t.year,
        "Tiers": JSON.stringify(t.tiers),
        "Maintenance %": t.maintenance_percentage,
        "Sanitation %": t.sanitation_percentage,
        "Sewerage Tiers": JSON.stringify(t.sewerage_tiers),
        "Meter Rent Prices": JSON.stringify(t.meter_rent_prices),
        "VAT Rate": t.vat_rate,
        "Domestic VAT Threshold": t.domestic_vat_threshold_m3,
      }));
    },
  },
  {
    id: "staff-data-export",
    name: "Staff Data Export (XLSX)",
    description: "Download a comprehensive list of all staff members.",
    headers: [
      "Staff ID", "Name", "Email", "Branch Name", "Status", "Phone", "Hire Date", "Role"
    ],
    getData: (filters) => {
      const staff = getStaffMembers();
      return staff.map(s => ({
        "Staff ID": s.id,
        "Name": s.name,
        "Email": s.email,
        "Branch Name": s.branchName,
        "Status": s.status,
        "Phone": s.phone,
        "Hire Date": s.hireDate,
        "Role": s.role,
      }));
    },
  },
  {
    id: "gl-finance-monthly",
    name: "GL Finance Monthly Report (XLSX)",
    description: "Monthly summary of billing components. Includes outstanding previous bills. Bulk meters are listed individually.",
    headers: [
      "Period", "Customer Key", "Charge Group", "Base Water Charge", "Sewerage Charge", "Maintenance Fee",
      "Sanitation Fee", "Meter Rent", "Additional Fees", "Penalty Amount", "VAT Amount", "Total Excl VAT", "Total Incl VAT", "Total Amount"
    ],
    getData: (filters: ReportFilters) => {
      const { branchId, startDate, endDate, chargeGroup: filterChargeGroup } = filters;
      const allBills = getBills();
      const allCustomers = getCustomers();
      const allBulkMeters = getBulkMeters();

      const branchBulkMeterKeys = new Set(allBulkMeters.filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber));

      // Helper: extract charge components from a bill
      const extractCharges = (bill: DomainBill) => ({
        base: Number(bill.baseWaterCharge) || 0,
        sewerage: Number(bill.sewerageCharge) || 0,
        maint: Number(bill.maintenanceFee) || 0,
        sanit: Number(bill.sanitationFee) || 0,
        rent: Number(bill.meterRent) || 0,
        add: Number(bill.additionalFeesCharge) || 0,
        penalty: Number(bill.PENALTYAMT) || 0,
        vat: Number(bill.vatAmount) || 0,
        total: Number(bill.TOTALBILLAMOUNT) || 0,
      });

      const addCharges = (row: any, c: ReturnType<typeof extractCharges>) => {
        row["Base Water Charge"] += c.base;
        row["Sewerage Charge"] += c.sewerage;
        row["Maintenance Fee"] += c.maint;
        row["Sanitation Fee"] += c.sanit;
        row["Meter Rent"] += c.rent;
        row["Additional Fees"] += c.add;
        row["Penalty Amount"] += c.penalty;
        row["VAT Amount"] += c.vat;
        row["Total Incl VAT"] += c.total;
        row["Total Amount"] += c.total;
        row["Total Excl VAT"] += (c.total - c.vat);
      };

      // Step 1: Apply branch filter to ALL bills (for outstanding lookup)
      let branchFilteredAllBills = allBills;
      if (branchId) {
        branchFilteredAllBills = branchFilteredAllBills.filter(bill => {
          if (bill.CUSTOMERKEY) return branchBulkMeterKeys.has(bill.CUSTOMERKEY);
          if (bill.individualCustomerId) {
            const customer = allCustomers.find(c => c.customerKeyNumber === bill.individualCustomerId);
            return customer && (customer.branchId === branchId || (customer.assignedBulkMeterId && branchBulkMeterKeys.has(customer.assignedBulkMeterId)));
          }
          return false;
        });
      }

      // Step 2: Apply date filter to get bills in the selected period
      let periodBills = branchFilteredAllBills;
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        periodBills = periodBills.filter(b => {
          const billDate = new Date(b.billPeriodEndDate).getTime();
          return billDate >= start && billDate <= end;
        });
      }

      // Step 3: Build a lookup of all outstanding (unpaid) bills outside the period, grouped by customer key
      const periodBillIds = new Set(periodBills.map(b => b.id));
      const outstandingByKey: Record<string, DomainBill[]> = {};
      branchFilteredAllBills.forEach(bill => {
        if (periodBillIds.has(bill.id)) return; // skip current period bills
        if (bill.paymentStatus === 'Paid') return; // only unpaid
        const key = bill.CUSTOMERKEY || bill.individualCustomerId || '';
        if (!key) return;
        if (!outstandingByKey[key]) outstandingByKey[key] = [];
        outstandingByKey[key].push(bill);
      });

      const aggregated: Record<string, any> = {};

      periodBills.forEach(bill => {
        const period = bill.monthYear; // Typically YYYY-MM
        let chargeGroup = "Unknown";
        let customerKey = "";

        if (bill.individualCustomerId) {
          const cust = allCustomers.find(c => c.customerKeyNumber === bill.individualCustomerId);
          chargeGroup = cust?.customerType || "Unknown";
          customerKey = "";
        } else if (bill.CUSTOMERKEY) {
          const bm = allBulkMeters.find(b => b.customerKeyNumber === bill.CUSTOMERKEY);
          chargeGroup = bm?.chargeGroup || "Unknown";
          customerKey = bill.CUSTOMERKEY;
        }

        // Bulk meters: individual row per customer key. Individual customers: aggregated by charge group.
        const rowKey = customerKey ? `${period}-BM-${customerKey}` : `${period}-IND-${chargeGroup}`;
        const lookupKey = customerKey || bill.individualCustomerId || '';

        if (!aggregated[rowKey]) {
          aggregated[rowKey] = {
            "Period": period,
            "Customer Key": customerKey || "",
            "Charge Group": chargeGroup,
            "Base Water Charge": 0,
            "Sewerage Charge": 0,
            "Maintenance Fee": 0,
            "Sanitation Fee": 0,
            "Meter Rent": 0,
            "Additional Fees": 0,
            "Penalty Amount": 0,
            "VAT Amount": 0,
            "Total Excl VAT": 0,
            "Total Incl VAT": 0,
            "Total Amount": 0,
            _outstandingAdded: new Set<string>(), // track which keys had outstanding added
          };
        }

        // Add current period bill charges
        addCharges(aggregated[rowKey], extractCharges(bill));

        // Add outstanding previous bills (only once per unique customer key per row)
        if (lookupKey && !aggregated[rowKey]._outstandingAdded.has(lookupKey)) {
          aggregated[rowKey]._outstandingAdded.add(lookupKey);
          const outstandingBills = outstandingByKey[lookupKey] || [];
          outstandingBills.forEach(ob => addCharges(aggregated[rowKey], extractCharges(ob)));
        }
      });

      let resultRows = Object.values(aggregated).map(row => {
        const { _outstandingAdded, ...rest } = row;
        return rest;
      });

      if (filterChargeGroup && filterChargeGroup !== "all") {
        resultRows = resultRows.filter(row => row["Charge Group"] === filterChargeGroup);
      }

      return resultRows.map(row => {
        const result: any = { ...row };
        Object.keys(result).forEach(k => {
          if (typeof result[k] === 'number') {
            result[k] = parseFloat(result[k].toFixed(2));
          }
        });
        return result;
      }).sort((a, b) => b.Period.localeCompare(a.Period));
    },
  },
  {
    id: "gl-finance-yearly",
    name: "GL Finance Yearly Report (XLSX)",
    description: "Yearly summary of billing components. Includes outstanding previous bills. Bulk meters are listed individually.",
    headers: [
      "Period", "Customer Key", "Charge Group", "Base Water Charge", "Sewerage Charge", "Maintenance Fee",
      "Sanitation Fee", "Meter Rent", "Additional Fees", "Penalty Amount", "VAT Amount", "Total Excl VAT", "Total Incl VAT", "Total Amount"
    ],
    getData: (filters: ReportFilters) => {
      const { branchId, startDate, endDate, chargeGroup: filterChargeGroup } = filters;
      const allBills = getBills();
      const allCustomers = getCustomers();
      const allBulkMeters = getBulkMeters();

      const branchBulkMeterKeys = new Set(allBulkMeters.filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber));

      const extractCharges = (bill: DomainBill) => ({
        base: Number(bill.baseWaterCharge) || 0,
        sewerage: Number(bill.sewerageCharge) || 0,
        maint: Number(bill.maintenanceFee) || 0,
        sanit: Number(bill.sanitationFee) || 0,
        rent: Number(bill.meterRent) || 0,
        add: Number(bill.additionalFeesCharge) || 0,
        penalty: Number(bill.PENALTYAMT) || 0,
        vat: Number(bill.vatAmount) || 0,
        total: Number(bill.TOTALBILLAMOUNT) || 0,
      });

      const addCharges = (row: any, c: ReturnType<typeof extractCharges>) => {
        row["Base Water Charge"] += c.base;
        row["Sewerage Charge"] += c.sewerage;
        row["Maintenance Fee"] += c.maint;
        row["Sanitation Fee"] += c.sanit;
        row["Meter Rent"] += c.rent;
        row["Additional Fees"] += c.add;
        row["Penalty Amount"] += c.penalty;
        row["VAT Amount"] += c.vat;
        row["Total Incl VAT"] += c.total;
        row["Total Amount"] += c.total;
        row["Total Excl VAT"] += (c.total - c.vat);
      };

      // Step 1: Apply branch filter to ALL bills
      let branchFilteredAllBills = allBills;
      if (branchId) {
        branchFilteredAllBills = branchFilteredAllBills.filter(bill => {
          if (bill.CUSTOMERKEY) return branchBulkMeterKeys.has(bill.CUSTOMERKEY);
          if (bill.individualCustomerId) {
            const customer = allCustomers.find(c => c.customerKeyNumber === bill.individualCustomerId);
            return customer && (customer.branchId === branchId || (customer.assignedBulkMeterId && branchBulkMeterKeys.has(customer.assignedBulkMeterId)));
          }
          return false;
        });
      }

      // Step 2: Apply date filter to get bills in the selected period
      let periodBills = branchFilteredAllBills;
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        periodBills = periodBills.filter(b => {
          const billDate = new Date(b.billPeriodEndDate).getTime();
          return billDate >= start && billDate <= end;
        });
      }

      // Step 3: Build outstanding lookup — unpaid bills outside the selected period
      const periodBillIds = new Set(periodBills.map(b => b.id));
      const outstandingByKey: Record<string, DomainBill[]> = {};
      branchFilteredAllBills.forEach(bill => {
        if (periodBillIds.has(bill.id)) return;
        if (bill.paymentStatus === 'Paid') return;
        const key = bill.CUSTOMERKEY || bill.individualCustomerId || '';
        if (!key) return;
        if (!outstandingByKey[key]) outstandingByKey[key] = [];
        outstandingByKey[key].push(bill);
      });

      const aggregated: Record<string, any> = {};

      periodBills.forEach(bill => {
        const period = bill.monthYear.substring(0, 4); // YYYY
        let chargeGroup = "Unknown";
        let customerKey = "";

        if (bill.individualCustomerId) {
          const cust = allCustomers.find(c => c.customerKeyNumber === bill.individualCustomerId);
          chargeGroup = cust?.customerType || "Unknown";
          customerKey = "";
        } else if (bill.CUSTOMERKEY) {
          const bm = allBulkMeters.find(b => b.customerKeyNumber === bill.CUSTOMERKEY);
          chargeGroup = bm?.chargeGroup || "Unknown";
          customerKey = bill.CUSTOMERKEY;
        }

        const rowKey = customerKey ? `${period}-BM-${customerKey}` : `${period}-IND-${chargeGroup}`;
        const lookupKey = customerKey || bill.individualCustomerId || '';

        if (!aggregated[rowKey]) {
          aggregated[rowKey] = {
            "Period": period,
            "Customer Key": customerKey || "",
            "Charge Group": chargeGroup,
            "Base Water Charge": 0,
            "Sewerage Charge": 0,
            "Maintenance Fee": 0,
            "Sanitation Fee": 0,
            "Meter Rent": 0,
            "Additional Fees": 0,
            "Penalty Amount": 0,
            "VAT Amount": 0,
            "Total Excl VAT": 0,
            "Total Incl VAT": 0,
            "Total Amount": 0,
            _outstandingAdded: new Set<string>(),
          };
        }

        addCharges(aggregated[rowKey], extractCharges(bill));

        if (lookupKey && !aggregated[rowKey]._outstandingAdded.has(lookupKey)) {
          aggregated[rowKey]._outstandingAdded.add(lookupKey);
          const outstandingBills = outstandingByKey[lookupKey] || [];
          outstandingBills.forEach(ob => addCharges(aggregated[rowKey], extractCharges(ob)));
        }
      });

      let resultRows = Object.values(aggregated).map(row => {
        const { _outstandingAdded, ...rest } = row;
        return rest;
      });

      if (filterChargeGroup && filterChargeGroup !== "all") {
        resultRows = resultRows.filter(row => row["Charge Group"] === filterChargeGroup);
      }

      return resultRows.map(row => {
        const result: any = { ...row };
        Object.keys(result).forEach(k => {
          if (typeof result[k] === 'number') {
            result[k] = parseFloat(result[k].toFixed(2));
          }
        });
        return result;
      }).sort((a, b) => b.Period.localeCompare(a.Period));
    },
  },
  {
    id: "monthly-bill-export-csv",
    name: "Monthly Bill Export (CSV)",
    description: "Export monthly bills in CSV format for external payment system integration.",
    headers: [
      "BILLKEY", "CUSTOMERKEY", "CUSTOMERNAME", "CUSTOMERTIN", "CUSTOMERBRANCH", "REASON",
      "CURRREAD", "PREVREAD", "CONS", "TOTALBILLAMOUNT", "THISMONTHBILLAMT",
      "OUTSTANDINGAMT", "PENALTYAMT", "VAT_AMOUNT", "DRACCTNO", "CRACCTNO"
    ],
    getData: (filters) => {
      const { branchId, startDate, endDate } = filters;
      let bills = getBills();
      const customers = getCustomers();
      const bulkMeters = getBulkMeters();
      const branches = getBranches();

      if (branchId) {
        const bulkMetersInBranch = bulkMeters.filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber);
        const customersInBranch = customers.filter(c => c.branchId === branchId).map(c => c.customerKeyNumber);
        bills = bills.filter(b =>
          (b.CUSTOMERKEY && bulkMetersInBranch.includes(b.CUSTOMERKEY)) ||
          (b.individualCustomerId && customersInBranch.includes(b.individualCustomerId))
        );
      }
      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        bills = bills.filter(b => {
          try {
            const billDate = new Date(b.billPeriodEndDate).getTime();
            return billDate >= start && billDate <= end;
          } catch { return false; }
        });
      }

      const billsByMeter: Record<string, DomainBill[]> = {};
      const allBills = getBills();

      return bills.map(bill => {
        let customerName = "N/A";
        let customerTin = "N/A";
        let customerBranch = "N/A";

        const customerKey = bill.CUSTOMERKEY || bill.individualCustomerId;

        if (bill.individualCustomerId) {
          const cust = customers.find(c => c.customerKeyNumber === bill.individualCustomerId);
          if (cust) {
            customerName = cust.name;
            customerTin = cust.contractNumber || "N/A"; // Assuming contract number if TIN not explicit
            const branch = branches.find(b => b.id === cust.branchId);
            customerBranch = branch ? branch.name : "N/A";
          }
        } else if (bill.CUSTOMERKEY) {
          const bm = bulkMeters.find(b => b.customerKeyNumber === bill.CUSTOMERKEY);
          if (bm) {
            customerName = bm.name;
            customerTin = bm.contractNumber || "N/A";
            const branch = branches.find(b => b.id === bm.branchId);
            customerBranch = branch ? branch.name : "N/A";
          }
        }

        // Reconstruct Outstanding
        let reconstructedOutstanding = 0;
        if (customerKey) {
          if (!billsByMeter[customerKey]) {
            billsByMeter[customerKey] = allBills
              .filter(ob => (ob.CUSTOMERKEY === customerKey || (ob as any).individualCustomerId === customerKey))
              .sort((m1, m2) => new Date(m2.billPeriodEndDate).getTime() - new Date(m1.billPeriodEndDate).getTime());
          }

          const meterHistory = billsByMeter[customerKey];
          const fullIndex = meterHistory.findIndex(mh => mh.id === bill.id);

          const getUnpaidAmount = (billRow: any) => {
            if (billRow.paymentStatus === 'Paid') return 0;
            return Number(billRow.TOTALBILLAMOUNT) - Number(billRow.amountPaid || 0);
          };

          if (fullIndex !== -1 && fullIndex < meterHistory.length - 1) {
            for (let j = fullIndex + 1; j < meterHistory.length; j++) {
              reconstructedOutstanding += getUnpaidAmount(meterHistory[j]);
            }
          }

          if (meterHistory.length > 0) {
            reconstructedOutstanding += meterHistory[meterHistory.length - 1].balanceCarriedForward ?? 0;
          }
        }

        // Generate BILLKEY explicitly for CSV export if missing, or use existing
        let billKeyFormatted = bill.BILLKEY;
        if (!billKeyFormatted) {
          const idHex = (bill.id || "").replace(/-/g, '').substring(0, 8);
          const idNumeric = parseInt(idHex, 16);
          billKeyFormatted = isNaN(idNumeric) ? "BBPT-0000000000" : `BBPT-${String(idNumeric).padStart(10, '0')}`;
        }

        // Format REASON (monthYear) to M/D/YYYY (e.g., 2025-12 -> 12/1/2025)
        let reasonFormatted = bill.monthYear;
        if (bill.monthYear && bill.monthYear.includes('-')) {
          const [year, month] = bill.monthYear.split('-');
          reasonFormatted = `${parseInt(month)}/1/${year}`;
        }

        const currentBill = bill.TOTALBILLAMOUNT;
        const outstanding = reconstructedOutstanding || bill.balanceCarriedForward || 0;

        return {
          "BILLKEY": billKeyFormatted,
          "CUSTOMERKEY": customerKey,
          "CUSTOMERNAME": customerName,
          "CUSTOMERTIN": bill.CUSTOMERTIN || customerTin,
          "CUSTOMERBRANCH": bill.CUSTOMERBRANCH || customerBranch,
          "REASON": reasonFormatted,
          "CURRREAD": bill.CURRREAD,
          "PREVREAD": bill.PREVREAD,
          "CONS": bill.CONS || 0,
          "TOTALBILLAMOUNT": currentBill + outstanding,
          "THISMONTHBILLAMT": currentBill,
          "OUTSTANDINGAMT": outstanding,
          "PENALTYAMT": bill.PENALTYAMT || 0,
          "VAT_AMOUNT": bill.vatAmount || 0,
          "DRACCTNO": bill.DRACCTNO || "",
          "CRACCTNO": bill.CRACCTNO || ""
        };
      });
    },
  },
];

export default function AdminReportsPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [selectedReportId, setSelectedReportId] = React.useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = React.useState<string>("all");
  const [selectedChargeGroup, setSelectedChargeGroup] = React.useState<string>("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(true);
  const [user, setUser] = React.useState<StaffMember | null>(null);

  const [archiveCutoffDate, setArchiveCutoffDate] = React.useState<Date | undefined>();
  const [archivableBills, setArchivableBills] = React.useState<DomainBill[]>([]);
  const [isArchiveDeleteConfirmationOpen, setIsArchiveDeleteConfirmationOpen] = React.useState(false);

  const [reportData, setReportData] = React.useState<any[] | null>(null);

  const [selectedColumns, setSelectedColumns] = React.useState<Set<string>>(new Set());
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = React.useState(false);


  const canSelectAllBranches = hasPermission('reports_generate_all');
  const isLockedToBranch = !canSelectAllBranches && hasPermission('reports_generate_branch');
  const selectedReport = availableReports.find(report => report.id === selectedReportId);

  React.useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await initializeCustomers(true);
      await initializeBulkMeters(true);
      await initializeBills(true);
      await initializeIndividualCustomerReadings(true);
      await initializeBulkMeterReadings(true);
      await initializePayments(true);
      await initializeStaffMembers();
      await initializeBranches();
      setBranches(getBranches());

      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser) as StaffMember;
        setUser(parsedUser);
        if (isLockedToBranch && parsedUser.branchId) {
          setSelectedBranch(parsedUser.branchId);
        }
      }
      setIsLoading(false);
    };
    initializeData();
  }, [isLockedToBranch]);

  React.useEffect(() => {
    setSelectedColumns(new Set(selectedReport?.headers || []));
  }, [selectedReport]);

  const getFilteredData = React.useCallback(async () => {
    if (!selectedReport?.getData) {
      return [];
    }

    let data = await selectedReport.getData({
      branchId: selectedBranch === 'all' ? undefined : selectedBranch,
      startDate: dateRange?.from,
      endDate: dateRange?.to,
      chargeGroup: selectedChargeGroup,
    });

    return data;
  }, [selectedReport, selectedBranch, dateRange, selectedChargeGroup]);

  const handleGenerateReport = async () => {
    if (!selectedReport) return;

    if (!selectedReport.getData || !selectedReport.headers) {
      toast({ variant: "destructive", title: "Report Not Implemented" });
      return;
    }

    setIsGenerating(true);
    try {
      const data = await getFilteredData();
      if (!data || data.length === 0) {
        toast({ title: "No Data", description: "No data found for the selected filters." });
        return;
      }

      const finalHeaders = Array.from(selectedColumns);

      let blob: Blob;
      let extension: string;

      if (selectedReport.id === 'monthly-bill-export-csv') {
        blob = arrayToCsvBlob(data, finalHeaders);
        extension = 'csv';
      } else {
        blob = arrayToXlsxBlob(data, finalHeaders);
        extension = 'xlsx';
      }

      const fileName = `${selectedReport.id}_${new Date().toISOString().split('T')[0]}.${extension}`;
      downloadFile(blob, fileName);
      toast({ title: "Report Generated", description: `${selectedReport.name} has been downloaded.` });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({ variant: "destructive", title: "Error Generating Report" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewReport = async () => {
    if (!selectedReport) return;

    setReportData(null);

    if (!selectedReport.getData || !selectedReport.headers) {
      toast({ variant: "destructive", title: "Report Not Implemented" });
      return;
    }

    const data = await getFilteredData();
    if (!data || data.length === 0) {
      toast({ title: "No Data", description: `No data found for ${selectedReport.name} with the selected filters.` });
      return;
    }

    setReportData(data);
  };

  const handleGenerateArchiveFile = () => {
    if (!archiveCutoffDate) {
      toast({ variant: "destructive", title: "Date Required", description: "Please select a cutoff date for the archive." });
      return;
    }

    const billsToArchive = getBills().filter(b => new Date(b.billPeriodEndDate) < archiveCutoffDate);

    if (billsToArchive.length === 0) {
      toast({ title: "No Data", description: `No bills found before the selected date to archive.` });
      setArchivableBills([]);
      return;
    }

    setArchivableBills(billsToArchive);

    const archiveHeaders = Object.keys(billsToArchive[0]);
    const xlsxBlob = arrayToXlsxBlob(billsToArchive, archiveHeaders);
    const fileName = `archive_bills_before_${archiveCutoffDate.toISOString().split('T')[0]}.xlsx`;
    downloadFile(xlsxBlob, fileName);

    toast({ title: "Archive File Generated", description: `${billsToArchive.length} bill records have been exported.` });
  };

  const handleConfirmArchiveDeletion = async () => {
    if (archivableBills.length === 0) return;

    setIsGenerating(true);
    const billIdsToDelete = archivableBills.map(b => b.id);
    let successCount = 0;

    for (const billId of billIdsToDelete) {
      const result = await removeBill(billId);
      if (result.success) {
        successCount++;
      } else {
        toast({ variant: "destructive", title: "Deletion Error", description: `Could not delete bill ID ${billId}. Aborting.` });
        break;
      }
    }

    toast({ title: "Archive Complete", description: `Successfully deleted ${successCount} out of ${billIdsToDelete.length} archived records from the database.` });

    setIsGenerating(false);
    setArchivableBills([]);
    setArchiveCutoffDate(undefined);
    setIsArchiveDeleteConfirmationOpen(false);
  };


  if (!hasPermission('reports_generate_all') && !hasPermission('reports_generate_branch')) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Generate Reports</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <UIAlertDescription>You do not have permission to generate reports.</UIAlertDescription>
        </Alert>
      </div>
    );
  }

  //...

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Generate Reports</h1>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Overall Difference Usage Trend</CardTitle>
              <CardDescription>Shows the trend of difference usage by branch.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/admin/reports/overall-difference-usage-trend">
            <Button>View Report</Button>
          </Link>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
//...
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-lg font-medium">Interactive AI Assistant</AccordionTrigger>
          <AccordionContent>
            <ReportAIAssistant />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Manual Report Generation</CardTitle>
          <CardDescription>Select a report type and apply filters to generate and download.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="report-type">Select Report Type</Label>
            <Select value={selectedReportId || undefined} onValueChange={(value) => {
              setSelectedReportId(value);
              setReportData(null);
            }}>
              <SelectTrigger id="report-type" className="w-full md:w-[400px]">
                <SelectValue placeholder="Choose a report..." />
              </SelectTrigger>
              <SelectContent>
                {availableReports.map((report, idx) => {
                  const safeReportId = report.id && String(report.id).trim() !== '' ? String(report.id) : `report-fallback-${idx}`;
                  if (!report.id || String(report.id).trim() === '') {
                    console.warn('availableReports contains a report with empty id, using fallback id:', report);
                  }
                  return (
                    <SelectItem key={safeReportId} value={safeReportId} disabled={!report.getData}>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        {report.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedReport && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>{selectedReport.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
                {selectedReport.getData ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                      <div className="space-y-2">
                        <Label htmlFor="branch-filter">Filter by Branch</Label>
                        <Select
                          value={selectedBranch || undefined}
                          onValueChange={setSelectedBranch}
                          disabled={isLoading || !canSelectAllBranches}
                        >
                          <SelectTrigger id="branch-filter" className={!canSelectAllBranches ? 'cursor-not-allowed' : ''}>
                            {isLockedToBranch && <Lock className="mr-2 h-4 w-4" />}
                            <SelectValue placeholder="Select a branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {canSelectAllBranches && <SelectItem value="all">All Branches</SelectItem>}
                            {branches
                              .filter(b => b && b.id && String(b.id).trim() !== '')
                              .map((branch) => (
                                <SelectItem key={String(branch.id)} value={String(branch.id)}>{branch.name}</SelectItem>
                              ))}
                            {branches.filter(b => !b || !b.id || String(b.id).trim() === '').length > 0 && (
                              <SelectItem value="__invalid_branch__" disabled>Invalid branch entry</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="charge-group-filter">Filter by Charge Group</Label>
                        <Select
                          value={selectedChargeGroup}
                          onValueChange={setSelectedChargeGroup}
                        >
                          <SelectTrigger id="charge-group-filter">
                            <SelectValue placeholder="Select a charge group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Charge Groups</SelectItem>
                            {customerTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date-range-filter">Filter by Date</Label>
                        <DateRangePicker
                          date={dateRange}
                          onDateChange={setDateRange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Select Columns</Label>
                        <Popover open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isColumnSelectorOpen}
                              className="w-full justify-between"
                              disabled={!selectedReport.headers}
                            >
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
                                  {selectedReport.headers?.map((header) => (
                                    <CommandItem
                                      key={header}
                                      value={header}
                                      onSelect={() => {
                                        setSelectedColumns(prev => {
                                          const newSet = new Set(prev);
                                          if (newSet.has(header)) {
                                            newSet.delete(header);
                                          } else {
                                            newSet.add(header);
                                          }
                                          return newSet;
                                        });
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedColumns.has(header) ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-700 dark:text-blue-300">Coming Soon</AlertTitle>
                    <UIAlertDescription className="text-blue-600 dark:text-blue-400">
                      This report is currently under development and will be available in a future update.
                    </UIAlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {selectedReport && selectedReport.getData && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleViewReport} disabled={isGenerating || !selectedReportId}>
                <Eye className="mr-2 h-4 w-4" />
                View Report
              </Button>
              <Button onClick={handleGenerateReport} disabled={isGenerating || !selectedReportId}>
                <Download className="mr-2 h-4 w-4" />
                {isGenerating ? "Generating..." : `Generate & Download ${selectedReport.name.replace(" (XLSX)", "")}`}
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
            <CardTitle>Report Preview: {selectedReport?.name.replace(" (XLSX)", "")}</CardTitle>
            <CardDescription>Displaying {reportData.length} row(s) with {selectedColumns.size} column(s).</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportDataView data={reportData} headers={Array.from(selectedColumns)} />
          </CardContent>
        </Card>
      )}

      {/* Data Archiving Section */}
      <Card className="shadow-lg border-amber-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Archive className="h-6 w-6 text-amber-600" /> Data Archiving</CardTitle>
          <CardDescription>Free up database storage by archiving old records. This is a two-step process: first export the data, then confirm deletion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>1. Export Bill Records Before Date</Label>
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <DatePicker date={archiveCutoffDate} setDate={setArchiveCutoffDate} />
              <Button onClick={handleGenerateArchiveFile} disabled={isGenerating || !archiveCutoffDate}>
                <Download className="mr-2 h-4 w-4" /> Export Archive File
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This will generate and download an XLSX file of all bill records before the selected date.
            </p>
          </div>

          {archivableBills.length > 0 && (
            <div className="space-y-2 p-4 border-l-4 border-destructive rounded-r-md bg-destructive/10">
              <Label className="text-destructive">2. Confirm Deletion of Archived Records</Label>
              <p className="text-sm text-destructive/80">
                You have exported {archivableBills.length} records. Please ensure you have securely saved the downloaded file. This action is irreversible.
              </p>
              <Button variant="destructive" onClick={() => setIsArchiveDeleteConfirmationOpen(true)} disabled={isGenerating}>
                <Trash2 className="mr-2 h-4 w-4" /> Permanently Delete {archivableBills.length} Records
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isArchiveDeleteConfirmationOpen} onOpenChange={setIsArchiveDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. You are about to permanently delete {archivableBills.length} bill records from the database. Have you downloaded and verified the archive file?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchiveDeletion} className="bg-destructive hover:bg-destructive/90">Yes, Delete Records</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Database Synchronization Section */}
      <Card className="shadow-lg border-blue-500/50 mt-6 mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-blue-600" /> Database Synchronization
          </CardTitle>
          <CardDescription>
            Recalculate and synchronize aging debt buckets (`debit_30`, `debit_30_60`, `debit_60`) and total payable mappings for all historical bills.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-900/10">
            <Zap className="h-5 w-5 text-blue-600" />
            <AlertTitle>Synchronization Recommendation</AlertTitle>
            <UIAlertDescription>
              Run this synchronization once after updating the billing logic to ensure all existing records correctly reflect the new aging debt calculation and total payable mappings. This process may take a moment depending on the number of records.
            </UIAlertDescription>
          </Alert>

          <Button
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isGenerating}
            onClick={async () => {
              const { toast } = require("@/hooks/use-toast");
              try {
                const result = await syncAllBillsAgingDebtAction();
                if (result.data?.success) {
                  // FORCE REFRESH AFTER SYNC
                  await initializeBills(true);
                  await initializeBulkMeters(true);

                  toast({
                    title: "Synchronization Complete",
                    description: `Successfully synchronized ${result.data.updatedCount} bill records. Data has been refreshed.`,
                    variant: "default",
                  });
                } else {
                  const errorMsg = result.error?.message || result.error || "Unknown error during sync";
                  throw new Error(errorMsg);
                }
              } catch (error: any) {
                toast({
                  title: "Synchronization Failed",
                  description: error.message || "An error occurred while synchronizing data.",
                  variant: "destructive",
                });
              }
            }}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isGenerating && "animate-spin")} />
            Synchronize All Bills
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
