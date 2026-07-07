
"use client";

import * as React from "react";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from '@/lib/xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, AlertCircle, Eye, Check, ChevronsUpDown, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  getCustomers,
  getBulkMeters,
  initializeCustomers,
  initializeBulkMeters,
  getBranches,
  initializeBranches,
  getBills,
  initializeBills,
  getMeterReadings,
  initializeIndividualCustomerReadings,
  initializeBulkMeterReadings,
  getPayments,
  initializePayments,
  getStaffMembers,
  initializeStaffMembers,
  subscribeToBulkMeters,
  DomainBill,
} from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ReportDataView } from '@/app/(dashboard)/admin/reports/report-data-view';
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { customerTypes } from "@/lib/billing-calculations";
import { getMonthlyBillAmt } from "@/lib/billing-utils";
import { usePermissions } from "@/hooks/use-permissions";
import { getAllCustomersAction, getAllBulkMetersAction, getAllBillsAction, getAllIndividualCustomerReadingsAction, getAllBulkMeterReadingsAction, getAllPaymentsAction, getAllStaffMembersAction, getAllBranchesAction, getAllTariffsAction } from "@/lib/actions";

interface User {
  email: string;
  role: "admin" | "staff" | "reader" | "Admin" | "Staff" | "Reader" | "staff management";
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
}


// Top-level type guards for meter reading unions
const isBulkReading = (r: any): r is { meterType: string; CUSTOMERKEY?: string } =>
  r && typeof r === 'object' && 'meterType' in r && r.meterType === 'bulk_meter';

const isIndividualReading = (r: any): r is { meterType: string; individualCustomerId?: string } =>
  r && typeof r === 'object' && 'meterType' in r && r.meterType === 'individual_customer_meter';


const mapCustomer = (c: any) => {
  if (!c) return c;
  return {
    ...c,
    branchId: c.branch_id || c.branchId,
    customerType: c.customerType || c.customer_type,
    meterNumber: c.METER_KEY || c.meterNumber,
    createdAt: c.created_at || c.createdAt,
    updatedAt: c.updated_at || c.updatedAt,
  };
};

const mapBulkMeter = (bm: any) => {
  if (!bm) return bm;
  return {
    ...bm,
    branchId: bm.branch_id || bm.branchId,
    chargeGroup: bm.charge_group || bm.chargeGroup,
    sewerageConnection: bm.sewerage_connection || bm.sewerageConnection,
    meterNumber: bm.METER_KEY || bm.meterNumber,
    createdAt: bm.created_at || bm.createdAt,
    updatedAt: bm.updated_at || bm.updatedAt,
    bulkUsage: bm.bulk_usage !== undefined ? bm.bulk_usage : bm.bulkUsage,
    differenceUsage: bm.difference_usage !== undefined ? bm.difference_usage : bm.differenceUsage,
    differenceBill: bm.difference_bill !== undefined ? bm.difference_bill : bm.differenceBill,
    totalBulkBill: bm.total_bulk_bill !== undefined ? bm.total_bulk_bill : bm.totalBulkBill,
  };
};

const availableStaffReports: ReportType[] = [
  {
    id: "customer-data-branch-export",
    name: "My Branch Customer Data (XLSX)",
    description: "Download a list of individual customers assigned to your branch.",
    headers: [
      "Customer Key", "Name", "Contract Number", "Customer Type", "Book Number", "Ordinal",
      "Meter Size", "Meter Number", "Previous Reading", "Current Reading", "Month", "Specific Area",
      "SubCity", "Woreda", "Sewerage Connection", "Assigned Bulk Meter ID", "Status", "Payment Status", "Calculated Bill"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      if (!branchId) return [];
      const rawCustomers = ((await getAllCustomersAction())?.data as any[] ?? []);
      const rawBulkMeters = ((await getAllBulkMetersAction())?.data as any[] ?? []);

      const customers = rawCustomers.map(mapCustomer);
      const bulkMeters = rawBulkMeters.map(mapBulkMeter);

      const branchCUSTOMERKEYs = new Set(bulkMeters.filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber));

      let filteredData = customers.filter(c =>
        c.branchId === branchId ||
        (c.assignedBulkMeterId && branchCUSTOMERKEYs.has(c.assignedBulkMeterId))
      );

      if (chargeGroup && chargeGroup !== 'all') {
        filteredData = filteredData.filter(c => c.customerType === chargeGroup);
      }

      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        filteredData = filteredData.filter(c => {
          if (!c.createdAt) return false;
          try {
            const customerDate = new Date(c.createdAt).getTime();
            return customerDate >= start && customerDate <= end;
          } catch { return false; }
        });
      }
      return filteredData.map(customer => ({
        "Customer Key":          customer.customerKeyNumber,
        "Name":                  customer.name,
        "Contract Number":       customer.contractNumber,
        "Customer Type":         customer.customerType,
        "Book Number":           customer.bookNumber,
        "Ordinal":               customer.ordinal,
        "Meter Size":            customer.meterSize,
        "Meter Number":          customer.meterNumber,
        "Previous Reading":      customer.previousReading,
        "Current Reading":       customer.currentReading,
        "Month":                 customer.month,
        "Specific Area":         customer.specificArea,
        "SubCity":               customer.subCity,
        "Woreda":                customer.woreda,
        "Sewerage Connection":   customer.sewerageConnection,
        "Assigned Bulk Meter ID": customer.assignedBulkMeterId || "N/A",
        "Status":                customer.status,
        "Payment Status":        customer.paymentStatus,
        "Calculated Bill":       customer.calculatedBill,
      }));
    },
  },
  {
    id: "bulk-meter-data-branch-export",
    name: "My Branch Bulk Meter Data (XLSX)",
    description: "Download a list of bulk meters relevant to your branch.",
    headers: [
      "Customer Key", "Name", "Contract Number", "Meter Size", "Meter Number",
      "Previous Reading", "Current Reading", "Month", "Specific Area", "SubCity", "Woreda", "Status", "Payment Status"
    ],
    getData: async (filters) => {
      const { branchId, chargeGroup, startDate, endDate } = filters;
      if (!branchId) return [];
      const rawBulkMeters = ((await getAllBulkMetersAction())?.data as any[] ?? []);
      const bulkMeters = rawBulkMeters.map(mapBulkMeter);

      let filteredData = bulkMeters.filter(bm => bm.branchId === branchId);

      if (chargeGroup && chargeGroup !== 'all') {
        filteredData = filteredData.filter(bm => bm.chargeGroup === chargeGroup);
      }
      return filteredData.map(bm => ({
        "Customer Key":     bm.customerKeyNumber,
        "Name":             bm.name,
        "Contract Number":  bm.contractNumber,
        "Meter Size":       bm.meterSize,
        "Meter Number":     bm.meterNumber,
        "Previous Reading": bm.previousReading,
        "Current Reading":  bm.currentReading,
        "Month":            bm.month,
        "Specific Area":    bm.specificArea,
        "SubCity":          bm.subCity,
        "Woreda":           bm.woreda,
        "Status":           bm.status,
        "Payment Status":   bm.paymentStatus,
      }));
    },
  },
  {
    id: "billing-summary-branch",
    name: "My Branch Billing Summary (XLSX)",
    description: "Summary of generated bills for all customers and bulk meters in your branch.",
    headers: [
      "Bill ID", "Individual Customer ID", "Customer Key", "Period Start", "Period End",
      "Month/Year", "Previous Reading", "Current Reading", "Consumption",
      "Base Water Charge", "Sewerage Charge", "Maintenance Fee", "Sanitation Fee",
      "Meter Rent", "Current Bill", "Total Bill", "Amount Paid", "Outstanding", "Due Date",
      "Status", "Bill Number", "Notes", "Created At", "Updated At"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate } = filters;
      if (!branchId) return [];

      // allBills: the FULL, unfiltered bill store — used as the history pool for
      // outstanding reconstruction (matches the Admin billing-summary report exactly).
      const allBills = ((await getAllBillsAction())?.data as any[] ?? []);
      const allCustomers = ((await getAllCustomersAction())?.data as any[] ?? []).map(mapCustomer);
      const allBulkMeters = ((await getAllBulkMetersAction())?.data as any[] ?? []).map(mapBulkMeter);

      const branchBulkMeterKeys = new Set(allBulkMeters.filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber));
      let filteredBills = allBills.filter(bill => {
        if (bill.CUSTOMERKEY) return branchBulkMeterKeys.has(bill.CUSTOMERKEY);
        if (bill.individualCustomerId) {
          const customer = allCustomers.find(c => c.customerKeyNumber === bill.individualCustomerId);
          if (!customer) return false;
          return customer.branchId === branchId || (customer.assignedBulkMeterId && branchBulkMeterKeys.has(customer.assignedBulkMeterId));
        }
        return false;
      });

      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        filteredBills = filteredBills.filter(b => {
          try {
            const billDate = new Date(b.billPeriodEndDate).getTime();
            return billDate >= start && billDate <= end;
          } catch { return false; }
        });
      }

      if (filters.chargeGroup && filters.chargeGroup !== 'all') {
        filteredBills = filteredBills.filter(b => {
          let billChargeGroup = "";
          if (b.CUSTOMERKEY) {
            const bm = allBulkMeters.find(m => m.customerKeyNumber === b.CUSTOMERKEY);
            billChargeGroup = bm?.chargeGroup || "";
          } else if (b.individualCustomerId) {
            const cust = allCustomers.find(c => c.customerKeyNumber === b.individualCustomerId);
            billChargeGroup = cust?.customerType || "";
          }
          return billChargeGroup === filters.chargeGroup;
        });
      }

      // billsByMeter cache: keyed by customerKey, sorted newest-first
      const billsByMeter: Record<string, DomainBill[]> = {};

      return filteredBills.map(b => {
        const customerKey = b.CUSTOMERKEY || (b as any).individualCustomerId;
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

          if (meterHistory.length > 0) {
            reconstructedOutstanding += meterHistory[meterHistory.length - 1].balanceCarriedForward ?? 0;
          }
        }

        const currentBill = getMonthlyBillAmt(b);
        const outstanding = reconstructedOutstanding || b.balanceCarriedForward || 0;
        const penalty = Number((b as any).PENALTYAMT || 0);

        return {
          "Bill ID": b.id,
          "Individual Customer ID": (b as any).individualCustomerId || "N/A",
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
          "Current Bill": currentBill,
          "Total Bill": outstanding + currentBill + penalty,
          "Amount Paid": b.amountPaid,
          "Outstanding": outstanding,
          "Due Date": b.dueDate,
          "Status": b.paymentStatus,
          "Bill Number": b.billNumber,
          "Notes": b.notes,
          "Created At": b.createdAt,
          "Updated At": b.updatedAt,
        };
      });
    },
  },
  {
    id: "monthly-bill-export-csv",
    name: "Monthly Bill Export (CSV)",
    description: "Export monthly bills specifically for your branch in CSV format for external payment system integration.",
    headers: [
      "BILLKEY", "CUSTOMERKEY", "CUSTOMERNAME", "CUSTOMERTIN", "CUSTOMERBRANCH", "REASON",
      "CURRREAD", "PREVREAD", "CONS", "TOTALBILLAMOUNT", "THISMONTHBILLAMT",
      "OUTSTANDINGAMT", "PENALTYAMT", "VAT_AMOUNT", "DRACCTNO", "CRACCTNO"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate } = filters;
      if (!branchId) return [];
      
      const allBills = ((await getAllBillsAction())?.data as any[] ?? []);
      const allCustomers = ((await getAllCustomersAction())?.data as any[] ?? []).map(mapCustomer);
      const allBulkMeters = ((await getAllBulkMetersAction())?.data as any[] ?? []).map(mapBulkMeter);
      const branches = ((await getAllBranchesAction())?.data as any[] ?? []);

      const branchBulkMeterKeys = new Set(allBulkMeters.filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber));
      
      let filteredBills = allBills.filter(bill => {
        if (bill.CUSTOMERKEY) return branchBulkMeterKeys.has(bill.CUSTOMERKEY);
        if (bill.individualCustomerId) {
          const customer = allCustomers.find(c => c.customerKeyNumber === bill.individualCustomerId);
          return customer && (customer.branchId === branchId || (customer.assignedBulkMeterId && branchBulkMeterKeys.has(customer.assignedBulkMeterId)));
        }
        return false;
      });

      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        filteredBills = filteredBills.filter(b => {
          try {
            const billDate = new Date(b.billPeriodEndDate).getTime();
            return billDate >= start && billDate <= end;
          } catch { return false; }
        });
      }

      if (filters.chargeGroup && filters.chargeGroup !== 'all') {
        filteredBills = filteredBills.filter(b => {
          let billChargeGroup = "";
          if (b.CUSTOMERKEY) {
            const bm = allBulkMeters.find(m => m.customerKeyNumber === b.CUSTOMERKEY);
            billChargeGroup = bm?.chargeGroup || "";
          } else if (b.individualCustomerId) {
            const cust = allCustomers.find(c => c.customerKeyNumber === b.individualCustomerId);
            billChargeGroup = cust?.customerType || "";
          }
          return billChargeGroup === filters.chargeGroup;
        });
      }

      const billsByMeter: Record<string, DomainBill[]> = {};

      return filteredBills.map(bill => {
        let customerName = "N/A";
        let customerTin = "N/A";
        let customerBranch = "N/A";

        const customerKey = bill.CUSTOMERKEY || bill.individualCustomerId;

        if (bill.individualCustomerId) {
          const cust = allCustomers.find(c => c.customerKeyNumber === bill.individualCustomerId);
          if (cust) {
            customerName = cust.name;
            customerTin = cust.contractNumber || "N/A";
            const branch = branches.find(b => b.id === cust.branchId);
            customerBranch = branch ? branch.name : "N/A";
          }
        } else if (bill.CUSTOMERKEY) {
          const bm = allBulkMeters.find(b => b.customerKeyNumber === bill.CUSTOMERKEY);
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

        // Generate BILLKEY explicitly for CSV export if missing
        let billKeyFormatted = bill.BILLKEY;
        if (!billKeyFormatted) {
          const idHex = (bill.id || "").replace(/-/g, '').substring(0, 8);
          const idNumeric = parseInt(idHex, 16);
          billKeyFormatted = isNaN(idNumeric) ? "BBPT-0000000000" : `BBPT-${String(idNumeric).padStart(10, '0')}`;
        }

        const formatExportReason = (value: string | undefined, fallbackDate?: string | undefined) => {
          const parseMonthYear = (monthYear?: string) => {
            if (!monthYear || !monthYear.includes('-')) return "";
            const [year, month] = monthYear.split('-');
            if (!year || !month) return "";
            const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
            const monthName = date.toLocaleString('en-US', { month: 'short' });
            return `${monthName}-${year}`;
          };

          const first = parseMonthYear(value);
          if (first) return first;

          if (fallbackDate) {
            const date = new Date(fallbackDate);
            if (!Number.isNaN(date.getTime())) {
              const monthName = date.toLocaleString('en-US', { month: 'short' });
              return `${monthName}-${date.getUTCFullYear()}`;
            }
          }

          return "";
        };

        const reasonFormatted = formatExportReason(
          bill.monthYear || bill.month_year || bill.REASON,
          bill.billPeriodEndDate || bill.bill_period_end_date || bill.createdAt || bill.created_at
        );

        const currentBill = getMonthlyBillAmt(bill);
        const outstanding = reconstructedOutstanding || bill.balanceCarriedForward || 0;
        const penalty = Number((bill as any).PENALTYAMT || 0);

        // Resolve branch name: check bill record first, then the looked up customerBranch
        const branchNameFromBill = branches.find(b => b.id === bill.CUSTOMERBRANCH)?.name || bill.CUSTOMERBRANCH;
        const finalBranchName = branchNameFromBill || customerBranch;

        return {
          "BILLKEY": billKeyFormatted,
          "CUSTOMERKEY": customerKey,
          "CUSTOMERNAME": customerName,
          "CUSTOMERTIN": "",
          "CUSTOMERBRANCH": finalBranchName,
          "REASON": reasonFormatted,
          "CURRREAD": bill.CURRREAD,
          "PREVREAD": bill.PREVREAD,
          "CONS": bill.CONS || 0,
          "TOTALBILLAMOUNT": outstanding + Math.max(0, currentBill) + penalty,
          "THISMONTHBILLAMT": Math.max(0, currentBill),
          "OUTSTANDINGAMT": outstanding,
          "PENALTYAMT": penalty,
          "VAT_AMOUNT": bill.vatAmount || 0,
          "DRACCTNO": bill.DRACCTNO || "",
          "CRACCTNO": bill.CRACCTNO || ""
        };
      });
    },
  },
  {
    id: "gl-finance-monthly",
    name: "GL Finance Monthly Report (XLSX)",
    description: "Monthly summary of billing components grouped by charge group. Bulk meters are listed individually.",
    headers: [
      "Period", "Customer Key", "Charge Group", "Base Water Charge", "Sewerage Charge", "Maintenance Fee",
      "Sanitation Fee", "Meter Rent", "Additional Fees", "Penalty Amount", "VAT Amount", "Total Excl VAT", "Total Incl VAT", "Total Amount"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup: filterChargeGroup } = filters;
      const allBills = ((await getAllBillsAction())?.data as any[] ?? []);
      const allCustomers = ((await getAllCustomersAction())?.data as any[] ?? []).map(mapCustomer);
      const allBulkMeters = ((await getAllBulkMetersAction())?.data as any[] ?? []).map(mapBulkMeter);

      const branchBulkMeterKeys = new Set(allBulkMeters.filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber));

      // Helper: extract charge components from a bill
      const extractCharges = (bill: DomainBill) => ({
        base: Number(bill.baseWaterCharge) || 0,
        sewerage: Number(bill.sewerageCharge) || 0,
        maint: Number(bill.maintenanceFee) || 0,
        sanit: Number(bill.sanitationFee) || 0,
        rent: Number(bill.meterRent) || 0,
        add: Number(bill.additionalFeesCharge) || 0,
        penalty: Number((bill as any).PENALTYAMT) || 0,
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
    description: "Yearly summary of billing components grouped by charge group. Bulk meters are listed individually.",
    headers: [
      "Period", "Customer Key", "Charge Group", "Base Water Charge", "Sewerage Charge", "Maintenance Fee",
      "Sanitation Fee", "Meter Rent", "Additional Fees", "Penalty Amount", "VAT Amount", "Total Excl VAT", "Total Incl VAT", "Total Amount"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup: filterChargeGroup } = filters;
      const allBills = ((await getAllBillsAction())?.data as any[] ?? []);
      const allCustomers = ((await getAllCustomersAction())?.data as any[] ?? []).map(mapCustomer);
      const allBulkMeters = ((await getAllBulkMetersAction())?.data as any[] ?? []).map(mapBulkMeter);

      const branchBulkMeterKeys = new Set(allBulkMeters.filter(bm => bm.branchId === branchId).map(bm => bm.customerKeyNumber));

      // Helper: extract charge components from a bill
      const extractCharges = (bill: DomainBill) => ({
        base: Number(bill.baseWaterCharge) || 0,
        sewerage: Number(bill.sewerageCharge) || 0,
        maint: Number(bill.maintenanceFee) || 0,
        sanit: Number(bill.sanitationFee) || 0,
        rent: Number(bill.meterRent) || 0,
        add: Number(bill.additionalFeesCharge) || 0,
        penalty: Number((bill as any).PENALTYAMT) || 0,
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

        // Add current period bill charges
        addCharges(aggregated[rowKey], extractCharges(bill));

        // Add outstanding previous bills
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
    id: "list-of-paid-bills",
    name: "List Of Paid Bills (XLSX)",
    description: "A filtered list showing only the bills that have been marked as 'Paid' for your branch.",
    headers: [
      "Bill ID", "Individual Customer ID", "Customer Key", "Period Start", "Period End",
      "Month/Year", "Previous Reading", "Current Reading", "Consumption",
      "Base Water Charge", "Sewerage Charge", "Maintenance Fee", "Sanitation Fee",
      "Meter Rent", "Total Bill Amount", "Amount Paid", "Outstanding Amount", "Due Date",
      "Status", "Bill Number", "Notes", "Created At", "Updated At"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      if (!branchId) return [];
      const [billsRes, bulkMetersRes, customersRes] = await Promise.all([
        getAllBillsAction(),
        getAllBulkMetersAction(),
        getAllCustomersAction(),
      ]);
      const bulkMeters = (bulkMetersRes?.data as any[] ?? []).map(mapBulkMeter);
      const customers = (customersRes?.data as any[] ?? []).map(mapCustomer);
      const bulkMetersInBranch = new Set(bulkMeters.filter((bm: any) => bm.branchId === branchId).map((bm: any) => bm.customerKeyNumber));
      const customersInBranch = new Set(customers.filter((c: any) => c.branchId === branchId).map((c: any) => c.customerKeyNumber));
      let bills = (billsRes?.data as any[] ?? []).filter((b: any) => b.payment_status === 'Paid');
      bills = bills.filter((b: any) =>
        (b.CUSTOMERKEY && bulkMetersInBranch.has(b.CUSTOMERKEY)) ||
        (b.individual_customer_id && customersInBranch.has(b.individual_customer_id))
      );

      if (chargeGroup && chargeGroup !== 'all') {
        bills = bills.filter((b: any) => {
          let billChargeGroup = "";
          if (b.CUSTOMERKEY) {
            const bm = bulkMeters.find((m: any) => m.customerKeyNumber === b.CUSTOMERKEY);
            billChargeGroup = bm?.chargeGroup || "";
          } else if (b.individual_customer_id) {
            const cust = customers.find((c: any) => c.customerKeyNumber === b.individual_customer_id);
            billChargeGroup = cust?.customerType || "";
          }
          return billChargeGroup === chargeGroup;
        });
      }

      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        bills = bills.filter((b: any) => {
          try { return new Date(b.bill_period_end_date).getTime() >= start && new Date(b.bill_period_end_date).getTime() <= end; }
          catch { return false; }
        });
      }
      return bills.map((b: any) => ({
        "Bill ID": b.id,
        "Individual Customer ID": b.individual_customer_id || "N/A",
        "Customer Key": b.CUSTOMERKEY || "N/A",
        "Period Start": b.bill_period_start_date || "",
        "Period End": b.bill_period_end_date || "",
        "Month/Year": b.month_year || "",
        "Previous Reading": b.PREVREAD != null ? Number(b.PREVREAD) : "",
        "Current Reading": b.CURRREAD != null ? Number(b.CURRREAD) : "",
        "Consumption": b.CONS != null ? Number(b.CONS) : "",
        "Base Water Charge": parseFloat(Number(b.base_water_charge || 0).toFixed(2)),
        "Sewerage Charge": parseFloat(Number(b.sewerage_charge || 0).toFixed(2)),
        "Maintenance Fee": parseFloat(Number(b.maintenance_fee || 0).toFixed(2)),
        "Sanitation Fee": parseFloat(Number(b.sanitation_fee || 0).toFixed(2)),
        "Meter Rent": parseFloat(Number(b.meter_rent || 0).toFixed(2)),
        "Total Bill Amount": parseFloat(Number(b.TOTALBILLAMOUNT || 0).toFixed(2)),
        "Amount Paid": parseFloat(Number(b.amount_paid || 0).toFixed(2)),
        "Outstanding Amount": parseFloat(Number(b.OUTSTANDINGAMT || 0).toFixed(2)),
        "Due Date": b.due_date || "",
        "Status": b.payment_status || "",
        "Bill Number": b.bill_number || "",
        "Notes": b.notes || "",
        "Created At": b.created_at || "",
        "Updated At": b.updated_at || "",
      }));
    },
  },
  {
    id: "list-of-sent-bills",
    name: "List Of Sent Bills (XLSX)",
    description: "A comprehensive list of all generated bills for your branch, regardless of payment status.",
    headers: [
      "Bill ID", "Individual Customer ID", "Customer Key", "Period Start", "Period End",
      "Month/Year", "Previous Reading", "Current Reading", "Consumption",
      "Base Water Charge", "Sewerage Charge", "Maintenance Fee", "Sanitation Fee",
      "Meter Rent", "Total Bill Amount", "Amount Paid", "Outstanding Amount", "Due Date",
      "Status", "Bill Number", "Notes", "Created At", "Updated At"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      if (!branchId) return [];
      const [billsRes, bulkMetersRes, customersRes] = await Promise.all([
        getAllBillsAction(),
        getAllBulkMetersAction(),
        getAllCustomersAction(),
      ]);
      const bulkMeters = (bulkMetersRes?.data as any[] ?? []).map(mapBulkMeter);
      const customers = (customersRes?.data as any[] ?? []).map(mapCustomer);
      const bulkMetersInBranch = new Set(bulkMeters.filter((bm: any) => bm.branchId === branchId).map((bm: any) => bm.customerKeyNumber));
      const customersInBranch = new Set(customers.filter((c: any) => c.branchId === branchId).map((c: any) => c.customerKeyNumber));
      let bills = (billsRes?.data as any[] ?? []);
      bills = bills.filter((b: any) =>
        (b.CUSTOMERKEY && bulkMetersInBranch.has(b.CUSTOMERKEY)) ||
        (b.individual_customer_id && customersInBranch.has(b.individual_customer_id))
      );

      if (chargeGroup && chargeGroup !== 'all') {
        bills = bills.filter((b: any) => {
          let billChargeGroup = "";
          if (b.CUSTOMERKEY) {
            const bm = bulkMeters.find((m: any) => m.customerKeyNumber === b.CUSTOMERKEY);
            billChargeGroup = bm?.chargeGroup || "";
          } else if (b.individual_customer_id) {
            const cust = customers.find((c: any) => c.customerKeyNumber === b.individual_customer_id);
            billChargeGroup = cust?.customerType || "";
          }
          return billChargeGroup === chargeGroup;
        });
      }

      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        bills = bills.filter((b: any) => {
          try { return new Date(b.bill_period_end_date).getTime() >= start && new Date(b.bill_period_end_date).getTime() <= end; }
          catch { return false; }
        });
      }
      return bills.map((b: any) => ({
        "Bill ID": b.id,
        "Individual Customer ID": b.individual_customer_id || "N/A",
        "Customer Key": b.CUSTOMERKEY || "N/A",
        "Period Start": b.bill_period_start_date || "",
        "Period End": b.bill_period_end_date || "",
        "Month/Year": b.month_year || "",
        "Previous Reading": b.PREVREAD != null ? Number(b.PREVREAD) : "",
        "Current Reading": b.CURRREAD != null ? Number(b.CURRREAD) : "",
        "Consumption": b.CONS != null ? Number(b.CONS) : "",
        "Base Water Charge": parseFloat(Number(b.base_water_charge || 0).toFixed(2)),
        "Sewerage Charge": parseFloat(Number(b.sewerage_charge || 0).toFixed(2)),
        "Maintenance Fee": parseFloat(Number(b.maintenance_fee || 0).toFixed(2)),
        "Sanitation Fee": parseFloat(Number(b.sanitation_fee || 0).toFixed(2)),
        "Meter Rent": parseFloat(Number(b.meter_rent || 0).toFixed(2)),
        "Total Bill Amount": parseFloat(Number(b.TOTALBILLAMOUNT || 0).toFixed(2)),
        "Amount Paid": parseFloat(Number(b.amount_paid || 0).toFixed(2)),
        "Outstanding Amount": parseFloat(Number(b.OUTSTANDINGAMT || 0).toFixed(2)),
        "Due Date": b.due_date || "",
        "Status": b.payment_status || "",
        "Bill Number": b.bill_number || "",
        "Notes": b.notes || "",
        "Created At": b.created_at || "",
        "Updated At": b.updated_at || "",
      }));
    },
  },
  {
    id: "water-usage",
    name: "Water Usage Report (XLSX)",
    description: "Detailed water consumption report from all meter readings in your branch.",
    headers: [
      "Reading ID", "Meter Type", "Customer ID", "Bulk Meter ID", "Staff ID",
      "Reading Date", "Month/Year", "Reading Value", "Is Estimate", "Notes",
      "Created At", "Updated At"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      if (!branchId) return [];
      const [indReadingsRes, bulkReadingsRes, bulkMetersRes, customersRes] = await Promise.all([
        getAllIndividualCustomerReadingsAction(),
        getAllBulkMeterReadingsAction(),
        getAllBulkMetersAction(),
        getAllCustomersAction(),
      ]);
      const indReadings = ((indReadingsRes?.data as any[] ?? []) as any[]).map((r: any) => ({ ...r, _readingType: 'individual' }));
      const bulkReadings = ((bulkReadingsRes?.data as any[] ?? []) as any[]).map((r: any) => ({ ...r, _readingType: 'bulk' }));
      const bulkMeters = (bulkMetersRes?.data as any[] ?? []).map(mapBulkMeter);
      const customers = (customersRes?.data as any[] ?? []).map(mapCustomer);
      const bulkMetersInBranch = new Set(bulkMeters.filter((bm: any) => bm.branchId === branchId).map((bm: any) => bm.customerKeyNumber));
      const customersInBranch = new Set(customers.filter((c: any) => c.branchId === branchId).map((c: any) => c.customerKeyNumber));
      let readings: any[] = [...indReadings, ...bulkReadings];
      readings = readings.filter((r: any) =>
        (r._readingType === 'bulk' && r.CUST_KEY && bulkMetersInBranch.has(r.CUST_KEY)) ||
        (r._readingType === 'individual' && r.CUST_KEY && customersInBranch.has(r.CUST_KEY))
      );

      if (chargeGroup && chargeGroup !== 'all') {
        readings = readings.filter((r: any) => {
          let readingChargeGroup = "";
          if (r._readingType === 'bulk' && r.CUST_KEY) {
            const bm = bulkMeters.find((m: any) => m.customerKeyNumber === r.CUST_KEY);
            readingChargeGroup = bm?.chargeGroup || "";
          } else if (r._readingType === 'individual' && r.CUST_KEY) {
            const cust = customers.find((c: any) => c.customerKeyNumber === r.CUST_KEY);
            readingChargeGroup = cust?.customerType || "";
          }
          return readingChargeGroup === chargeGroup;
        });
      }

      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        readings = readings.filter((r: any) => {
          try { return new Date(r.READING_DATE).getTime() >= start && new Date(r.READING_DATE).getTime() <= end; }
          catch { return false; }
        });
      }
      return readings.map((r: any) => {
        const isBulk = r._readingType === 'bulk';
        return {
          "Reading ID": r.id,
          "Meter Type": isBulk ? "Bulk" : "Individual",
          "Customer ID": !isBulk ? (r.CUST_KEY || "N/A") : "N/A",
          "Bulk Meter ID": isBulk ? (r.CUST_KEY || "N/A") : "N/A",
          "Staff ID": r.created_by || r.METER_READER_CODE || "N/A",
          "Reading Date": r.READING_DATE || "",
          "Month/Year": r.READING_DATE ? new Date(r.READING_DATE).toISOString().substring(0, 7) : "",
          "Reading Value": r.METER_READING != null ? Number(r.METER_READING) : "",
          "Is Estimate": r.ESTIMATED_READING_IND === 'Y' || r.is_estimate ? "Yes" : "No",
          "Notes": r.notes || "",
          "Created At": r.created_at || "",
          "Updated At": r.updated_at || "",
        };
      });
    },
  },
  {
    id: "payment-history",
    name: "Payment History Report (XLSX)",
    description: "Detailed log of all payments received for your branch.",
    headers: [
      "Payment ID", "Bill ID", "Customer ID", "Payment Date", "Amount Paid",
      "Payment Method", "Reference", "Processed By", "Notes",
      "Created At", "Updated At"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      if (!branchId) return [];
      let payments = ((await getAllPaymentsAction())?.data as any[] ?? []);
      const rawCustomers = ((await getAllCustomersAction())?.data as any[] ?? []);
      const customers = rawCustomers.map(mapCustomer);

      const customersInBranch = customers.filter(c => c.branchId === branchId).map(c => c.customerKeyNumber);
      payments = payments.filter(p => p.individualCustomerId && customersInBranch.includes(p.individualCustomerId));

      if (chargeGroup && chargeGroup !== 'all') {
        payments = payments.filter(p => {
          const cust = customers.find(c => c.customerKeyNumber === p.individualCustomerId);
          return cust?.customerType === chargeGroup;
        });
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
    description: "Detailed export of meter readings with reader information for accuracy analysis (Branch).",
    headers: [
      "Reading ID", "Meter Identifier", "Meter Type", "Reading Date", "Month/Year",
      "Reading Value", "Is Estimate", "Reader Name", "Reader Staff ID", "Notes"
    ],
    getData: async (filters) => {
      const { branchId, startDate, endDate, chargeGroup } = filters;
      if (!branchId) return [];
      const [indReadingsRes, bulkReadingsRes, bulkMetersRes, customersRes, staffRes] = await Promise.all([
        getAllIndividualCustomerReadingsAction(),
        getAllBulkMeterReadingsAction(),
        getAllBulkMetersAction(),
        getAllCustomersAction(),
        getAllStaffMembersAction(),
      ]);
      const indReadings = ((indReadingsRes?.data as any[] ?? []) as any[]).map((r: any) => ({ ...r, _readingType: 'individual' }));
      const bulkReadings = ((bulkReadingsRes?.data as any[] ?? []) as any[]).map((r: any) => ({ ...r, _readingType: 'bulk' }));
      const bulkMeters = (bulkMetersRes?.data as any[] ?? []).map(mapBulkMeter);
      const customers = (customersRes?.data as any[] ?? []).map(mapCustomer);
      const staffList = (staffRes?.data as any[] ?? []);
      const bmMap = new Map(bulkMeters.map((bm: any) => [bm.customerKeyNumber, bm]));
      const custMap = new Map(customers.map((c: any) => [c.customerKeyNumber, c]));
      const staffMap = new Map(staffList.map((s: any) => [s.id, s.name]));

      const bulkMetersInBranch = new Set(bulkMeters.filter((bm: any) => bm.branchId === branchId).map((bm: any) => bm.customerKeyNumber));
      const customersInBranch = new Set(customers.filter((c: any) => c.branchId === branchId).map((c: any) => c.customerKeyNumber));
      let readings: any[] = [...indReadings, ...bulkReadings];
      readings = readings.filter((r: any) =>
        (r._readingType === 'bulk' && r.CUST_KEY && bulkMetersInBranch.has(r.CUST_KEY)) ||
        (r._readingType === 'individual' && r.CUST_KEY && customersInBranch.has(r.CUST_KEY))
      );

      if (chargeGroup && chargeGroup !== 'all') {
        readings = readings.filter((r: any) => {
          let readingChargeGroup = "";
          if (r._readingType === 'bulk' && r.CUST_KEY) {
            const bm = bulkMeters.find((m: any) => m.customerKeyNumber === r.CUST_KEY);
            readingChargeGroup = bm?.chargeGroup || "";
          } else if (r._readingType === 'individual' && r.CUST_KEY) {
            const cust = customers.find((c: any) => c.customerKeyNumber === r.CUST_KEY);
            readingChargeGroup = cust?.customerType || "";
          }
          return readingChargeGroup === chargeGroup;
        });
      }

      if (startDate && endDate) {
        const start = startDate.getTime();
        const end = endDate.getTime();
        readings = readings.filter((r: any) => {
          try { return new Date(r.READING_DATE).getTime() >= start && new Date(r.READING_DATE).getTime() <= end; }
          catch { return false; }
        });
      }

      return readings.map((r: any) => {
        let meterIdentifier = "N/A";
        if (r._readingType === 'individual' && r.CUST_KEY) {
          const cust = custMap.get(r.CUST_KEY);
          meterIdentifier = cust ? (cust.name + ' (M: ' + (cust.meterNumber || 'N/A') + ')') : ('Cust ID: ' + r.CUST_KEY);
        } else if (r._readingType === 'bulk' && r.CUST_KEY) {
          const bm = bmMap.get(r.CUST_KEY);
          meterIdentifier = bm ? (bm.name + ' (M: ' + (bm.meterNumber || 'N/A') + ')') : ('BM ID: ' + r.CUST_KEY);
        }
        const staffId = r.created_by || r.METER_READER_CODE || "";
        const readerName = staffMap.get(staffId) || (staffId ? ('Staff ID: ' + staffId) : "N/A");
        return {
          "Reading ID": r.id,
          "Meter Identifier": meterIdentifier,
          "Meter Type": r._readingType === 'bulk' ? 'Bulk' : 'Individual',
          "Reading Date": r.READING_DATE || "",
          "Month/Year": r.READING_DATE ? new Date(r.READING_DATE).toISOString().substring(0, 7) : "",
          "Reading Value": r.METER_READING != null ? Number(r.METER_READING) : "",
          "Is Estimate": r.ESTIMATED_READING_IND === 'Y' || r.is_estimate ? "Yes" : "No",
          "Reader Name": readerName,
          "Reader Staff ID": staffId || "N/A",
          "Notes": r.notes || "",
        };
      });
    },
  },
];


export default function StaffReportsPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [selectedReportId, setSelectedReportId] = React.useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [staffBranchName, setStaffBranchName] = React.useState<string | undefined>(undefined);
  const [staffBranchId, setStaffBranchId] = React.useState<string | undefined>(undefined);

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [selectedColumns, setSelectedColumns] = React.useState<Set<string>>(new Set());
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = React.useState(false);
  const [reportData, setReportData] = React.useState<any[] | null>(null);

  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [selectedYear, setSelectedYear] = React.useState<string>("all");
  const [selectedMonth, setSelectedMonth] = React.useState<string>("all");
  const [selectedChargeGroup, setSelectedChargeGroup] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(true);

  const selectedReport = availableStaffReports.find(report => report.id === selectedReportId);

  const years = React.useMemo(() => {
    const allYears = new Set(bulkMeters.map(bm => bm.month.split('-')[0]));
    return Array.from(allYears).sort().reverse();
  }, [bulkMeters]);

  const chartData = React.useMemo(() => {
    let filteredBms = bulkMeters;

    if (staffBranchId) {
      filteredBms = filteredBms.filter(bm => bm.branchId === staffBranchId);
    }

    if (selectedYear !== "all") {
      filteredBms = filteredBms.filter(bm => bm.month.startsWith(selectedYear));
    }
    if (selectedMonth !== "all") {
      filteredBms = filteredBms.filter(bm => bm.month.split('-')[1] === selectedMonth);
    }

    const monthlyUsage: { [key: string]: { name: string; differenceUsage: number } } = {};

    filteredBms.forEach(bm => {
      const month = bm.month;
      if (bm.differenceUsage) {
        if (!monthlyUsage[month]) {
          monthlyUsage[month] = { name: month, differenceUsage: 0 };
        }
        monthlyUsage[month].differenceUsage += bm.differenceUsage;
      }
    });

    return Object.values(monthlyUsage).sort((a, b) => a.name.localeCompare(b.name));
  }, [bulkMeters, staffBranchId, selectedYear, selectedMonth]);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      // Only load bulk meters for the usage chart widget (not for reports)
      const rawBms = ((await getAllBulkMetersAction())?.data as any[] ?? []);
      setBulkMeters(rawBms.map(mapBulkMeter));
      setIsLoading(false);
    };
    fetchData();

    const unsubBms = subscribeToBulkMeters(setBulkMeters);

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        // Branch-scoped if the user has a branchId assigned — no role string comparison needed
        if (parsedUser.branchId && parsedUser.branchName) {
          setStaffBranchName(parsedUser.branchName);
          setStaffBranchId(parsedUser.branchId);
        }
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
    return () => {
      unsubBms();
    }
  }, []);

  React.useEffect(() => {
    setSelectedColumns(new Set(selectedReport?.headers || []));
  }, [selectedReport]);

  const getFilteredData = React.useCallback(async () => {
    if (!selectedReport?.getData || !staffBranchId) {
      return [];
    }
    return await selectedReport.getData({
      branchId: staffBranchId,
      startDate: dateRange?.from,
      endDate: dateRange?.to,
      chargeGroup: selectedChargeGroup,
    });
  }, [selectedReport, staffBranchId, dateRange, selectedChargeGroup]);


  const handleGenerateReport = () => {
    if (!selectedReport) return;

    if (!selectedReport.getData || !selectedReport.headers) {
      toast({
        variant: "destructive",
        title: "Report Not Implemented",
        description: `${selectedReport.name} is not available for download yet.`,
      });
      return;
    }
    if (!staffBranchId) {
      toast({
        variant: "destructive",
        title: "Branch Information Missing",
        description: "Cannot generate branch-specific report without branch information.",
      });
      return;
    }

    setIsGenerating(true);

    const generate = async () => {
      try {
        const data = await getFilteredData();
        if (!data || data.length === 0) {
        toast({
          title: "No Data",
          description: `No data available to generate ${selectedReport.name}.`,
        });
        setIsGenerating(false);
        return;
      }

      const finalHeaders = Array.from(selectedColumns);
      const xlsxBlob = arrayToXlsxBlob(data, finalHeaders);
      const fileName = `${selectedReport.id}_${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadFile(xlsxBlob, fileName);

      toast({
        title: "Report Generated",
        description: `${selectedReport.name} has been downloaded as ${fileName}.`,
      });

    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        variant: "destructive",
        title: "Error Generating Report",
        description: "An unexpected error occurred while generating the report.",
      });
      } finally {
        setIsGenerating(false);
      }
    };

    generate();
  };

  const handleViewReport = () => {
    if (!selectedReport) return;

    setReportData(null);

    if (!selectedReport.getData || !selectedReport.headers) {
      toast({ variant: "destructive", title: "Report Not Implemented" });
      return;
    }

    const fetchViewData = async () => {
      const data = await getFilteredData();
      if (!data || data.length === 0) {
        toast({ title: "No Data", description: `No data found for ${selectedReport.name} with the selected filters.` });
        return;
      }
      setReportData(data);
    };

    fetchViewData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Generate Reports {staffBranchName ? `(${staffBranchName})` : ''}</h1>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Overall Difference Usage Trend</CardTitle>
                <CardDescription>Shows the trend of difference usage for your branch.</CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full md:w-[120px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-[120px]">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {[...Array(12)].map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                      {new Date(0, i).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
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
                <YAxis label={{ value: 'Usage (m³)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="differenceUsage" fill="#8884d8" name="Difference Usage (m³)" />
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
            <Select value={selectedReportId} onValueChange={(value) => {
              setSelectedReportId(value);
              setReportData(null);
            }}>
              <SelectTrigger id="report-type" className="w-full md:w-[400px]">
                <SelectValue placeholder="Choose a report..." />
              </SelectTrigger>
              <SelectContent>
                {availableStaffReports.map((report) => (
                  <SelectItem key={String(report.id)} value={String(report.id)} disabled={!report.getData}>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      {report.name}
                    </div>
                  </SelectItem>
                ))}
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
                        <Label>Filter by Branch</Label>
                        <div className="p-2 border rounded-md text-sm text-muted-foreground bg-background">
                          {staffBranchName || 'N/A'}
                        </div>
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
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-700 dark:text-blue-300">Coming Soon</AlertTitle>
                    <UIAlertDescription className="text-blue-600 dark:text-blue-400">
                      This report is currently under development.
                    </UIAlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {selectedReport && selectedReport.getData && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleViewReport} disabled={isGenerating || !selectedReportId || !staffBranchId}>
                <Eye className="mr-2 h-4 w-4" />
                View Report
              </Button>
              <Button onClick={handleGenerateReport} disabled={isGenerating || !selectedReportId || !staffBranchId}>
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

    </div>
  );
}

