import { format } from "date-fns";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { getMonthlyBillAmt } from "@/lib/billing-utils";
import { formatDate } from "@/lib/utils";
import { arrayToCsvBlob, arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";

export const getAvailableMonthYearOptions = (): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [
    { value: "all", label: "All Months" }
  ];
  
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = format(d, 'MMMM yyyy');
    options.push({ value, label });
  }
  return options;
};

export const getBillKey = (bill: any): string => {
  if (bill.BILLKEY && String(bill.BILLKEY).trim()) return String(bill.BILLKEY).trim();
  if (bill.billKey && String(bill.billKey).trim()) return String(bill.billKey).trim();
  if (bill.bill_key && String(bill.bill_key).trim()) return String(bill.bill_key).trim();
  if (bill.billNumber && String(bill.billNumber).trim()) return String(bill.billNumber).trim();
  const hex = (bill.id || "").replace(/-/g, "").substring(0, 8);
  const n = parseInt(hex, 16);
  return isNaN(n) ? "BBPT-0000000000" : `BBPT-${String(n).padStart(10, "0")}`;
};

export const getCustomerIdentifier = (
  bill: any,
  customers: IndividualCustomer[] = [],
  bulkMeters: BulkMeter[] = []
): string => {
  if (bill.individualCustomerId || bill.individual_customer_id) {
    const custId = bill.individualCustomerId || bill.individual_customer_id;
    const customer = customers.find(c => c.customerKeyNumber === custId);
    return customer ? customer.name : (bill.CUSTOMERNAME || bill.customerName || `Customer ID: ${custId}`);
  }
  if (bill.CUSTOMERKEY || bill.customerKey) {
    const key = bill.CUSTOMERKEY || bill.customerKey;
    const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === key);
    return bulkMeter ? bulkMeter.name : (bill.CUSTOMERNAME || bill.customerName || `Bulk Meter ID: ${key}`);
  }
  return bill.CUSTOMERNAME || bill.customerName || "N/A";
};

export const getCustomerKeyDisplay = (bill: any): string => {
  return bill.individualCustomerId || bill.individual_customer_id || bill.CUSTOMERKEY || bill.customerKey || "N/A";
};

export const getBranchNameDisplay = (
  bill: any,
  customers: IndividualCustomer[] = [],
  bulkMeters: BulkMeter[] = [],
  branches: Branch[] = []
): string => {
  if (bill.branch_name) return bill.branch_name;
  if (bill.CUSTOMERBRANCH || bill.customerBranch) return bill.CUSTOMERBRANCH || bill.customerBranch;

  let branchId = bill.branchId || bill.branch_id;
  if (!branchId) {
    const custId = bill.individualCustomerId || bill.individual_customer_id;
    if (custId) {
      const customer = customers.find(c => c.customerKeyNumber === custId);
      branchId = customer?.branchId;
    } else {
      const meterKey = bill.CUSTOMERKEY || bill.customerKey;
      if (meterKey) {
        const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === meterKey);
        branchId = bulkMeter?.branchId;
      }
    }
  }

  if (!branchId) return "N/A";
  const branch = branches.find(b => b.id === branchId);
  return branch ? branch.name : "Unknown";
};

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const exportSentBillsToCsv = (
  bills: DomainBill[],
  customers: IndividualCustomer[] = [],
  bulkMeters: BulkMeter[] = [],
  branches: Branch[] = [],
  filenamePrefix = "sent_bills_report"
) => {
  const headers = [
    "Bill Key",
    "Customer/Meter Name",
    "Customer Key",
    "Branch",
    "Month",
    "Prev Reading",
    "Curr Reading",
    "Usage (m³)",
    "Diff. Usage",
    "DEBIT_30",
    "DEBIT_30_60",
    "DEBIT_60",
    "Outstanding (ETB)",
    "Current Bill (ETB)",
    "Penalty (ETB)",
    "Total Due (ETB)",
    "Due Date",
    "Status"
  ];

  const data = bills.map((bill) => {
    const billKey = getBillKey(bill);
    const custName = getCustomerIdentifier(bill, customers, bulkMeters);
    const custKey = getCustomerKeyDisplay(bill);
    const branchName = getBranchNameDisplay(bill, customers, bulkMeters, branches);
    const monthValue = bill.monthYear || (bill as any).month_year || '-';

    const prevRead = parseNumber((bill as any).PREVREAD ?? (bill as any).prevRead ?? (bill as any).prevread);
    const currRead = parseNumber((bill as any).CURRREAD ?? (bill as any).currRead ?? (bill as any).currread);
    const rawUsage = parseNumber((bill as any).CONS ?? (bill as any).cons);
    const usage = rawUsage !== undefined ? rawUsage : (prevRead !== undefined && currRead !== undefined ? currRead - prevRead : undefined);
    const diffUsage = parseNumber((bill as any).differenceUsage ?? (bill as any).difference_usage);

    const d30 = parseNumber(bill.debit30 ?? (bill as any).debit_30) ?? 0;
    const d30_60 = parseNumber(bill.debit30_60 ?? (bill as any).debit_30_60) ?? 0;
    const d60 = parseNumber(bill.debit60 ?? (bill as any).debit_60) ?? 0;

    const outstanding = parseNumber(bill.OUTSTANDINGAMT) ?? (d30 + d30_60 + d60);
    const currentBill = getMonthlyBillAmt(bill);
    const penalty = parseNumber(bill.PENALTYAMT) ?? 0;
    const totalDue = parseNumber((bill as any).totalAmountDue ?? bill.TOTALBILLAMOUNT) ?? (outstanding + currentBill + penalty);
    const status = (bill.paymentStatus || (bill as any).payment_status || 'Unpaid') === 'Paid' ? 'Paid' : 'Unpaid';
    const dueDate = formatDate(bill.dueDate || (bill as any).due_date);

    return {
      "Bill Key": billKey,
      "Customer/Meter Name": custName,
      "Customer Key": custKey,
      "Branch": branchName,
      "Month": monthValue,
      "Prev Reading": prevRead !== undefined ? prevRead : '',
      "Curr Reading": currRead !== undefined ? currRead : '',
      "Usage (m³)": usage !== undefined ? usage : '',
      "Diff. Usage": diffUsage !== undefined ? diffUsage : '',
      "DEBIT_30": d30,
      "DEBIT_30_60": d30_60,
      "DEBIT_60": d60,
      "Outstanding (ETB)": outstanding.toFixed(2),
      "Current Bill (ETB)": currentBill.toFixed(2),
      "Penalty (ETB)": penalty.toFixed(2),
      "Total Due (ETB)": totalDue.toFixed(2),
      "Due Date": dueDate || '-',
      "Status": status
    };
  });

  const blob = arrayToCsvBlob(data, headers);
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  downloadFile(blob, `${filenamePrefix}_${dateStr}.csv`);
};

export const exportSentBillsToXlsx = (
  bills: DomainBill[],
  customers: IndividualCustomer[] = [],
  bulkMeters: BulkMeter[] = [],
  branches: Branch[] = [],
  filenamePrefix = "sent_bills_report"
) => {
  const headers = [
    "Bill Key",
    "Customer/Meter Name",
    "Customer Key",
    "Branch",
    "Month",
    "Prev Reading",
    "Curr Reading",
    "Usage (m³)",
    "Diff. Usage",
    "DEBIT_30",
    "DEBIT_30_60",
    "DEBIT_60",
    "Outstanding (ETB)",
    "Current Bill (ETB)",
    "Penalty (ETB)",
    "Total Due (ETB)",
    "Due Date",
    "Status"
  ];

  const data = bills.map((bill) => {
    const billKey = getBillKey(bill);
    const custName = getCustomerIdentifier(bill, customers, bulkMeters);
    const custKey = getCustomerKeyDisplay(bill);
    const branchName = getBranchNameDisplay(bill, customers, bulkMeters, branches);
    const monthValue = bill.monthYear || (bill as any).month_year || '-';

    const prevRead = parseNumber((bill as any).PREVREAD ?? (bill as any).prevRead ?? (bill as any).prevread);
    const currRead = parseNumber((bill as any).CURRREAD ?? (bill as any).currRead ?? (bill as any).currread);
    const rawUsage = parseNumber((bill as any).CONS ?? (bill as any).cons);
    const usage = rawUsage !== undefined ? rawUsage : (prevRead !== undefined && currRead !== undefined ? currRead - prevRead : undefined);
    const diffUsage = parseNumber((bill as any).differenceUsage ?? (bill as any).difference_usage);

    const d30 = parseNumber(bill.debit30 ?? (bill as any).debit_30) ?? 0;
    const d30_60 = parseNumber(bill.debit30_60 ?? (bill as any).debit_30_60) ?? 0;
    const d60 = parseNumber(bill.debit60 ?? (bill as any).debit_60) ?? 0;

    const outstanding = parseNumber(bill.OUTSTANDINGAMT) ?? (d30 + d30_60 + d60);
    const currentBill = getMonthlyBillAmt(bill);
    const penalty = parseNumber(bill.PENALTYAMT) ?? 0;
    const totalDue = parseNumber((bill as any).totalAmountDue ?? bill.TOTALBILLAMOUNT) ?? (outstanding + currentBill + penalty);
    const status = (bill.paymentStatus || (bill as any).payment_status || 'Unpaid') === 'Paid' ? 'Paid' : 'Unpaid';
    const dueDate = formatDate(bill.dueDate || (bill as any).due_date);

    return {
      "Bill Key": billKey,
      "Customer/Meter Name": custName,
      "Customer Key": custKey,
      "Branch": branchName,
      "Month": monthValue,
      "Prev Reading": prevRead !== undefined ? prevRead : '',
      "Curr Reading": currRead !== undefined ? currRead : '',
      "Usage (m³)": usage !== undefined ? usage : '',
      "Diff. Usage": diffUsage !== undefined ? diffUsage : '',
      "DEBIT_30": d30,
      "DEBIT_30_60": d30_60,
      "DEBIT_60": d60,
      "Outstanding (ETB)": outstanding.toFixed(2),
      "Current Bill (ETB)": currentBill.toFixed(2),
      "Penalty (ETB)": penalty.toFixed(2),
      "Total Due (ETB)": totalDue.toFixed(2),
      "Due Date": dueDate || '-',
      "Status": status
    };
  });

  const blob = arrayToXlsxBlob(data, headers);
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  downloadFile(blob, `${filenamePrefix}_${dateStr}.xlsx`);
};

export const exportPaidBillsToCsv = (
  bills: DomainBill[],
  customers: IndividualCustomer[] = [],
  bulkMeters: BulkMeter[] = [],
  branches: Branch[] = [],
  filenamePrefix = "paid_bills_report"
) => {
  const headers = [
    "Bill Key",
    "Customer Key",
    "Customer Name",
    "Branch",
    "Amount Paid (ETB)",
    "Payment Date",
    "Reconciliation Status",
    "Payment Channel",
    "Bank Ref",
    "Phone",
    "Route Key",
    "Walk Order",
    "Meter Key"
  ];

  const data = bills.map((bill: any) => {
    const billKey = getBillKey(bill);
    const custKey = getCustomerKeyDisplay(bill);
    const custName = getCustomerIdentifier(bill, customers, bulkMeters);
    const branchName = getBranchNameDisplay(bill, customers, bulkMeters, branches);

    const amt = bill.amount_paid ?? bill.amountPaid ?? bill.TOTALBILLAMOUNT ?? bill.totalBillAmount ?? 0;
    const amountPaidStr = parseNumber(amt)?.toFixed(2) || "0.00";

    const dateVal = bill.last_payment_date || bill.payment_date || bill.paymentDate || bill.updated_at || bill.created_at;
    let paymentDateStr = "-";
    if (dateVal) {
      try {
        const d = new Date(dateVal);
        paymentDateStr = isNaN(d.getTime()) ? String(dateVal) : format(d, "yyyy-MM-dd HH:mm");
      } catch {
        paymentDateStr = String(dateVal);
      }
    }

    const reconStatus = bill.reconciliation_status_computed || bill.reconciliation_status || bill.reconciliationStatus || "Not reconciled";
    const paymentChannel = bill.payment_channel || bill.paymentChannel || bill.payment_method || "CBE";
    const bankRef = bill.bank_ref || bill.bankRef || bill.transaction_reference || "-";

    const foundCust = customers.find(c => c.customerKeyNumber === custKey) as any;
    const foundBm = bulkMeters.find(bm => bm.customerKeyNumber === custKey) as any;

    const phone = bill.phone_computed || bill.phone ||
      foundCust?.phoneNumber || foundCust?.phone ||
      foundBm?.phoneNumber || foundBm?.phone || "-";

    const routeKey = bill.route_key_computed || bill.route_key || bill.routeKey ||
      foundCust?.routeKey || foundBm?.routeKey || "-";

    const walkOrderVal = bill.walk_order_computed ?? bill.walk_order ?? bill.walkOrder ??
      foundCust?.ordinal ?? foundBm?.ordinal ?? "-";

    const meterKey = bill.meter_key_computed || bill.meter_key || bill.meterKey ||
      foundCust?.meterKey || foundCust?.meterNumber ||
      foundBm?.meterKey || foundBm?.meterNumber || "-";

    return {
      "Bill Key": billKey,
      "Customer Key": custKey,
      "Customer Name": custName,
      "Branch": branchName,
      "Amount Paid (ETB)": amountPaidStr,
      "Payment Date": paymentDateStr,
      "Reconciliation Status": reconStatus,
      "Payment Channel": paymentChannel,
      "Bank Ref": bankRef,
      "Phone": phone,
      "Route Key": routeKey,
      "Walk Order": String(walkOrderVal),
      "Meter Key": meterKey
    };
  });

  const blob = arrayToCsvBlob(data, headers);
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  downloadFile(blob, `${filenamePrefix}_${dateStr}.csv`);
};

export const exportPaidBillsToXlsx = (
  bills: DomainBill[],
  customers: IndividualCustomer[] = [],
  bulkMeters: BulkMeter[] = [],
  branches: Branch[] = [],
  filenamePrefix = "paid_bills_report"
) => {
  const headers = [
    "Bill Key",
    "Customer Key",
    "Customer Name",
    "Branch",
    "Amount Paid (ETB)",
    "Payment Date",
    "Reconciliation Status",
    "Payment Channel",
    "Bank Ref",
    "Phone",
    "Route Key",
    "Walk Order",
    "Meter Key"
  ];

  const data = bills.map((bill: any) => {
    const billKey = getBillKey(bill);
    const custKey = getCustomerKeyDisplay(bill);
    const custName = getCustomerIdentifier(bill, customers, bulkMeters);
    const branchName = getBranchNameDisplay(bill, customers, bulkMeters, branches);

    const amt = bill.amount_paid ?? bill.amountPaid ?? bill.TOTALBILLAMOUNT ?? bill.totalBillAmount ?? 0;
    const amountPaidStr = parseNumber(amt)?.toFixed(2) || "0.00";

    const dateVal = bill.last_payment_date || bill.payment_date || bill.paymentDate || bill.updated_at || bill.created_at;
    let paymentDateStr = "-";
    if (dateVal) {
      try {
        const d = new Date(dateVal);
        paymentDateStr = isNaN(d.getTime()) ? String(dateVal) : format(d, "yyyy-MM-dd HH:mm");
      } catch {
        paymentDateStr = String(dateVal);
      }
    }

    const reconStatus = bill.reconciliation_status_computed || bill.reconciliation_status || bill.reconciliationStatus || "Not reconciled";
    const paymentChannel = bill.payment_channel || bill.paymentChannel || bill.payment_method || "CBE";
    const bankRef = bill.bank_ref || bill.bankRef || bill.transaction_reference || "-";

    const foundCust = customers.find(c => c.customerKeyNumber === custKey) as any;
    const foundBm = bulkMeters.find(bm => bm.customerKeyNumber === custKey) as any;

    const phone = bill.phone_computed || bill.phone ||
      foundCust?.phoneNumber || foundCust?.phone ||
      foundBm?.phoneNumber || foundBm?.phone || "-";

    const routeKey = bill.route_key_computed || bill.route_key || bill.routeKey ||
      foundCust?.routeKey || foundBm?.routeKey || "-";

    const walkOrderVal = bill.walk_order_computed ?? bill.walk_order ?? bill.walkOrder ??
      foundCust?.ordinal ?? foundBm?.ordinal ?? "-";

    const meterKey = bill.meter_key_computed || bill.meter_key || bill.meterKey ||
      foundCust?.meterKey || foundCust?.meterNumber ||
      foundBm?.meterKey || foundBm?.meterNumber || "-";

    return {
      "Bill Key": billKey,
      "Customer Key": custKey,
      "Customer Name": custName,
      "Branch": branchName,
      "Amount Paid (ETB)": amountPaidStr,
      "Payment Date": paymentDateStr,
      "Reconciliation Status": reconStatus,
      "Payment Channel": paymentChannel,
      "Bank Ref": bankRef,
      "Phone": phone,
      "Route Key": routeKey,
      "Walk Order": String(walkOrderVal),
      "Meter Key": meterKey
    };
  });

  const blob = arrayToXlsxBlob(data, headers);
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  downloadFile(blob, `${filenamePrefix}_${dateStr}.xlsx`);
};
