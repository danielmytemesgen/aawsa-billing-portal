"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Droplets, Edit, Edit2, Trash2, Menu, User, CheckCircle, XCircle, FileEdit, RefreshCcw, RefreshCw, Gauge, Users as UsersIcon, DollarSign, TrendingUp, Clock, MinusCircle, PlusCircle as PlusCircleIcon, Printer, History, AlertTriangle, ListCollapse, Eye, MapPin, FileSpreadsheet, Calendar, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import {
  getBulkMeters, getCustomers, updateBulkMeter as updateBulkMeterInStore, deleteBulkMeter as deleteBulkMeterFromStore,
  addCustomer as addCustomerToStore, updateCustomer as updateCustomerInStore, deleteCustomer as deleteCustomerFromStore, subscribeToBulkMeters, subscribeToCustomers,
  initializeBulkMeters, initializeCustomers, getBranches, initializeBranches, subscribeToBranches,
  fetchCustomersForBulkMeter, fetchBillsForBulkMeter,
  getBulkMeterReadings, initializeBulkMeterReadings, subscribeToBulkMeterReadings,
  addBill, addBulkMeterReading, removeBill, getBulkMeterByCustomerKey, updateExistingBill,
  subscribeToTariffs, initializeTariffs, getTariff, getTariffs
} from "@/lib/data-store";
import { getBills, initializeBills, subscribeToBills } from "@/lib/data-store";
import type { BulkMeter } from "../bulk-meter-types";
import type { IndividualCustomer, IndividualCustomerStatus } from "../../individual-customers/individual-customer-types";
import type { Branch } from "../../branches/branch-types";
import type { DomainBulkMeterReading, DomainBill } from "@/lib/data-store";
import { type CustomerType, type SewerageConnection, type PaymentStatus, type BillCalculationResult, calculateBillFromTariff } from "@/lib/billing-calculations";
import { getMeterCreditAction, getAssignedCustomerReadingsAction } from "@/lib/actions";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "../bulk-meter-form-dialog";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "../../individual-customers/individual-customer-form-dialog";
import { IndividualCustomerDetailsSheet } from "@/components/customers/IndividualCustomerDetailsSheet";
import { AddReadingDialog } from "@/features/billing/components/add-reading-dialog";
import { ManageAssignedCustomersDialog } from "@/components/billing/ManageAssignedCustomersDialog";
import { EditReadingsRecalculateSection } from "@/components/billing/EditReadingsRecalculateSection";
import { BulkMeterCreditCard, type BulkMeterCreditData } from "@/components/billing/BulkMeterCreditCard";
import { SyncPaymentStatusDialog } from "@/components/billing/SyncPaymentStatusDialog";
import { EditBillStatusDialog } from "@/components/billing/EditBillStatusDialog";
import { DifferenceApportionmentDialog } from "@/components/billing/DifferenceApportionmentDialog";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, lastDayOfMonth } from "date-fns";
import { getBillingPeriodStartDate, getBillingPeriodEndDate, calculateDueDate } from "@/lib/billing-config";
import { calculateDebtAging, getMonthlyBillAmt, getPenaltyValue, isPenaltyEngineEnabled, reconstructOutstandingForBill } from "@/lib/billing-utils";
import { computeCreditForBill } from "@/lib/credit-utils";
import { arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";
import { useCardPenaltyDisplay } from "@/hooks/useCardPenaltyDisplay";

// Safely format a date value that may be a string (ISO), a Date object, a timestamp, or null/undefined.
function formatDateForDisplay(value?: string | Date | number | null) {
  if (value === undefined || value === null || value === '') return 'N/A';
  try {
    let d: Date;
    if (typeof value === 'string') {
      // parseISO will throw if invalid string
      d = parseISO(value);
    } else if (typeof value === 'number') {
      d = new Date(value);
    } else if (value instanceof Date) {
      d = value;
    } else {
      // fallback: attempt Date constructor
      d = new Date(String(value));
    }
    if (isNaN(d.getTime())) return 'N/A';
    return format(d, 'PP');
  } catch (e) {
    return 'N/A';
  }
}
import { TablePagination } from "@/components/ui/table-pagination";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export interface BillCardDetails {
  billId: string | null;
  prevReading: number;
  currReading: number;
  usage: number;
  baseWaterCharge: number;
  maintenanceFee: number;
  sanitationFee: number;
  sewerageCharge: number;
  meterRent: number;
  vatAmount: number;
  totalDifferenceBill: number;
  differenceUsage: number;
  penaltyAmt: number;
  outstandingBill: number;
  totalPayable: number;
  paymentStatus: PaymentStatus;
  month: string;
  billKey: string | null;
  additionalFeesCharge?: number | null;
  additionalFeesBreakdown?: Array<{ name: string; charge: number }> | null;
  snapshot_data?: any;
}

const initialMemoizedDetails = {
  bmPreviousReading: 0, bmCurrentReading: 0, bulkUsage: 0,
  totalBulkBillForPeriod: 0, totalPayable: 0, differenceUsage: 0,
  differenceBill: 0, differenceBillBreakdown: {} as BillCalculationResult,
  displayBranchName: "N/A", displayCardLocation: "N/A",
  isMinOfThreeApplied: false,
  rawDifference: 0,
  ruleOfThreeActive: false,
  billCardDetails: {
    billId: null,
    prevReading: 0, currReading: 0, usage: 0, baseWaterCharge: 0,
    maintenanceFee: 0, sanitationFee: 0, sewerageCharge: 0, meterRent: 0,
    vatAmount: 0, totalDifferenceBill: 0, differenceUsage: 0,
    additionalFeesCharge: 0,
    additionalFeesBreakdown: null,
    penaltyAmt: 0,
    outstandingBill: 0, totalPayable: 0, paymentStatus: 'Unpaid' as PaymentStatus,
    month: 'N/A',
    billKey: null,
    snapshot_data: null,
  } as BillCardDetails,
  totalIndividualUsage: 0,
  snapshot_data: null as any,
};

export default function BulkMeterDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canManageCustomers = hasPermission(PERMISSIONS.BULK_METERS_MANAGE_CUSTOMERS);
  const canViewCredit =
    hasPermission(PERMISSIONS.CREDIT_VIEW_ALL) ||
    hasPermission(PERMISSIONS.CREDIT_VIEW_BRANCH);
  const canAddCredit = hasPermission(PERMISSIONS.CREDIT_CREATE);
  const canVoidCredit = hasPermission(PERMISSIONS.CREDIT_VOID);
  const canEditReadings =
    hasPermission(PERMISSIONS.BULK_METERS_EDIT_READINGS_VIEW) ||
    hasPermission(PERMISSIONS.BULK_METERS_EDIT_READINGS) ||
    hasPermission(PERMISSIONS.METER_READINGS_EDIT_RECALCULATE_VIEW) ||
    hasPermission(PERMISSIONS.METER_READINGS_EDIT_RECALCULATE);
  const canEditCustomer = hasPermission(PERMISSIONS.CUSTOMERS_UPDATE);
  const canDeleteCustomer = hasPermission(PERMISSIONS.CUSTOMERS_DELETE);
  const canAddReading =
    hasPermission(PERMISSIONS.METER_READINGS_CREATE) ||
    hasPermission(PERMISSIONS.METER_READINGS_CREATE_BULK) ||
    hasPermission(PERMISSIONS.METER_READINGS_ADD_MANUAL);
  const canUpdateBillStatus =
    hasPermission(PERMISSIONS.BILL_UPDATE) ||
    hasPermission(PERMISSIONS.PAYMENTS_CREATE) ||
    hasPermission(PERMISSIONS.BILL_VIEW_ALL) ||
    hasPermission(PERMISSIONS.BILL_POST);

  // ── Admin-only role check ─────────────────────────────────────────────────
  const [currentUserRole, setCurrentUserRole] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          return (parsed.role || '').toLowerCase().trim();
        }
      } catch {}
    }
    return '';
  });
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentUserRole((parsed.role || '').toLowerCase().trim());
      }
    } catch {}
  }, []);
  const isAdmin = (
    currentUserRole === 'admin' ||
    currentUserRole === 'system administrator' ||
    currentUserRole === 'super admin' ||
    hasPermission('*') ||
    hasPermission('admin')
  );

  const idRaw = params?.id;
  const bulkMeterKey = Array.isArray(idRaw) ? idRaw[0] : (idRaw as string || "");

  const [bulkMeter, setBulkMeter] = useState<BulkMeter | null>(null);
  const [associatedCustomers, setAssociatedCustomers] = useState<IndividualCustomer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [meterReadingHistory, setMeterReadingHistory] = useState<DomainBulkMeterReading[]>([]);
  const [billingHistory, setBillingHistory] = useState<DomainBill[]>([]);
  const [billForPrintView, setBillForPrintView] = React.useState<DomainBill | null>(null);
  const [selectedBillId, setSelectedBillId] = React.useState<string | null>(null);
  const [currentDateTime, setCurrentDateTime] = React.useState('');

  const [isBulkMeterFormOpen, setIsBulkMeterFormOpen] = React.useState(false);
  const [isBulkMeterDeleteDialogOpen, setIsBulkMeterDeleteDialogOpen] = React.useState(false);

  const [activeTariff, setActiveTariff] = useState<any>(null);
  const calculationRequestId = React.useRef(0);

  const [isCustomerFormOpen, setIsCustomerFormOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<IndividualCustomer | null>(null);
  const [customerToDelete, setCustomerToDelete] = React.useState<IndividualCustomer | null>(null);
  const [isCustomerDeleteDialogOpen, setIsCustomerDeleteDialogOpen] = React.useState(false);
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = React.useState<IndividualCustomer | null>(null);
  const [isCustomerDetailsOpen, setIsCustomerDetailsOpen] = React.useState(false);
  const [isAddReadingOpen, setIsAddReadingOpen] = React.useState(false);

  const [isBillDeleteDialogOpen, setIsBillDeleteDialogOpen] = React.useState(false);
  const [billToDelete, setBillToDelete] = React.useState<DomainBill | null>(null);

  const [isUpdateStatusDialogOpen, setIsUpdateStatusDialogOpen] = React.useState(false);
  const [billToUpdate, setBillToUpdate] = React.useState<DomainBill | null>(null);

  const [showSlip, setShowSlip] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isManageCustomersOpen, setIsManageCustomersOpen] = React.useState(false);
  const [isEditReadingsOpen, setIsEditReadingsOpen] = React.useState(false);
  const [editReadingsTargetMonth, setEditReadingsTargetMonth] = React.useState<string | null>(null);

  // Pagination states
  const [readingHistoryPage, setReadingHistoryPage] = React.useState(0);
  const [readingHistoryRowsPerPage, setReadingHistoryRowsPerPage] = React.useState(5);
  const [billingHistoryPage, setBillingHistoryPage] = React.useState(0);
  const [billingHistoryRowsPerPage, setBillingHistoryRowsPerPage] = React.useState(10);
  const [customerPage, setCustomerPage] = React.useState(0);
  const [customerRowsPerPage, setCustomerRowsPerPage] = React.useState(10);

  // Selected billing period for the Associated Individual Customers section
  const [selectedCustomerPeriod, setSelectedCustomerPeriod] = React.useState<string>('');
  const [isApportionmentDialogOpen, setIsApportionmentDialogOpen] = React.useState(false);

  // Tariff version counter — increments when tariffs change so memoized details re-calculate
  const [tariffVersion, setTariffVersion] = React.useState(0);

  // Credit / deposit state (balance + ledger) for the credit card and payslip lines
  const [creditData, setCreditData] = React.useState<BulkMeterCreditData | null>(null);
  const refreshCreditData = React.useCallback(async () => {
    if (!bulkMeterKey) return;
    try {
      const res = await getMeterCreditAction(bulkMeterKey);
      if (res.data) setCreditData(res.data);
    } catch (e) {
      console.error("Failed to load credit data:", e);
    }
  }, [bulkMeterKey]);
  React.useEffect(() => {
    refreshCreditData();
  }, [refreshCreditData]);

  // Cache of period readings: monthYear -> Map<customerKeyNumber, { prevRead, currRead, usage, totalBill, found }>
  const [customerPeriodReadingsCache, setCustomerPeriodReadingsCache] = React.useState<
    Record<string, Map<string, { prevRead: number; currRead: number; usage: number; totalBill: number; found: boolean }>>
  >({});
  const [isLoadingPeriodReadings, setIsLoadingPeriodReadings] = React.useState<boolean>(false);

  // Deduplicated and sorted billing periods available for this bulk meter
  const availableCustomerPeriods = useMemo(() => {
    const periodSet = new Set<string>();
    const list: { monthYear: string; label: string }[] = [];

    const sortedBills = [...billingHistory]
      .filter(b => b.status !== 'Deleted' && b.status !== 'Reversed' && b.monthYear)
      .sort((a, b) => ((b.monthYear || '') > (a.monthYear || '') ? 1 : -1));

    for (const b of sortedBills) {
      const my = b.monthYear!;
      if (!periodSet.has(my)) {
        periodSet.add(my);
        let label = my;
        try {
          if (my.length === 7) {
            const [yr, mo] = my.split('-');
            label = format(new Date(Number(yr), Number(mo) - 1, 1), 'MMMM yyyy');
          }
        } catch { /* keep raw */ }
        list.push({ monthYear: my, label });
      }
    }

    const meterMonth = bulkMeter?.month;
    if (meterMonth && !periodSet.has(meterMonth)) {
      periodSet.add(meterMonth);
      let label = meterMonth;
      try {
        if (meterMonth.length === 7) {
          const [yr, mo] = meterMonth.split('-');
          label = format(new Date(Number(yr), Number(mo) - 1, 1), 'MMMM yyyy');
        }
      } catch { /* keep raw */ }
      list.unshift({ monthYear: meterMonth, label });
    }

    return list;
  }, [billingHistory, bulkMeter?.month]);

  // Auto-initialise selectedCustomerPeriod to the latest billing period
  React.useEffect(() => {
    if (availableCustomerPeriods.length > 0 && !selectedCustomerPeriod) {
      setSelectedCustomerPeriod(availableCustomerPeriods[0].monthYear);
    }
  }, [availableCustomerPeriods, selectedCustomerPeriod]);

  // Fetch period readings whenever selectedCustomerPeriod or associatedCustomers changes
  React.useEffect(() => {
    if (!bulkMeterKey || !selectedCustomerPeriod || associatedCustomers.length === 0) return;
    if (customerPeriodReadingsCache[selectedCustomerPeriod]) return;

    let cancelled = false;
    setIsLoadingPeriodReadings(true);

    const customerKeys = associatedCustomers.map(c => c.customerKeyNumber).filter(Boolean);

    getAssignedCustomerReadingsAction(bulkMeterKey, selectedCustomerPeriod, customerKeys)
      .then((res) => {
        if (cancelled) return;
        if (res?.data && Array.isArray(res.data)) {
          const map = new Map<string, { prevRead: number; currRead: number; usage: number; totalBill: number; found: boolean }>();
          for (const item of res.data) {
            const prev = Number(item.previous ?? 0);
            const curr = Number(item.current ?? 0);
            map.set(item.customerKeyNumber, {
              prevRead: prev,
              currRead: curr,
              usage: Number(item.usage ?? (curr - prev)),
              totalBill: Number(item.billAmount ?? 0),
              found: Boolean(item.hasExactRecord || item.billId),
            });
          }
          setCustomerPeriodReadingsCache(prev => ({
            ...prev,
            [selectedCustomerPeriod]: map,
          }));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch period readings for associated customers:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPeriodReadings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bulkMeterKey, selectedCustomerPeriod, associatedCustomers, customerPeriodReadingsCache]);

  // Map: customerKeyNumber → { prevRead, currRead, usage, totalBill, found } for selectedCustomerPeriod
  const customerPeriodReadingsMap = useMemo(() => {
    const map = new Map<string, { prevRead: number; currRead: number; usage: number; totalBill: number; found: boolean }>();
    if (!selectedCustomerPeriod || associatedCustomers.length === 0) return map;

    const cached = customerPeriodReadingsCache[selectedCustomerPeriod];
    const allBills = getBills();

    for (const customer of associatedCustomers) {
      if (cached && cached.has(customer.customerKeyNumber)) {
        map.set(customer.customerKeyNumber, cached.get(customer.customerKeyNumber)!);
        continue;
      }

      // Fallback: check client-side bills store
      const bill = allBills.find(b =>
        (b.individualCustomerId === customer.customerKeyNumber ||
          (b as any).CUSTOMERKEY === customer.customerKeyNumber) &&
        b.monthYear === selectedCustomerPeriod &&
        b.status !== 'Deleted' &&
        b.status !== 'Reversed'
      );
      if (bill) {
        const prevRead = Number(bill.PREVREAD ?? 0);
        const currRead = Number(bill.CURRREAD ?? 0);
        map.set(customer.customerKeyNumber, {
          prevRead,
          currRead,
          usage: currRead - prevRead,
          totalBill: Number(bill.TOTALBILLAMOUNT ?? 0),
          found: true,
        });
      } else {
        // Fallback: show live readings in muted style
        map.set(customer.customerKeyNumber, {
          prevRead: customer.previousReading ?? 0,
          currRead: customer.currentReading ?? 0,
          usage: (customer.currentReading ?? 0) - (customer.previousReading ?? 0),
          totalBill: customer.calculatedBill ?? 0,
          found: false,
        });
      }
    }
    return map;
  }, [associatedCustomers, selectedCustomerPeriod, customerPeriodReadingsCache, billingHistory]);

  const paginatedReadingHistory = meterReadingHistory.slice(
    readingHistoryPage * readingHistoryRowsPerPage,
    readingHistoryPage * readingHistoryRowsPerPage + readingHistoryRowsPerPage
  );

  const paginatedBillingHistory = billingHistory.slice(
    billingHistoryPage * billingHistoryRowsPerPage,
    billingHistoryPage * billingHistoryRowsPerPage + billingHistoryRowsPerPage
  );

  const paginatedCustomers = associatedCustomers.slice(
    customerPage * customerRowsPerPage,
    customerPage * customerRowsPerPage + customerRowsPerPage
  );

  const [memoizedDetails, setMemoizedDetails] = React.useState(initialMemoizedDetails);
  const lastCalculationInputs = React.useRef<string>("");

  const calculateMemoizedDetails = useCallback(async (
    currentBulkMeter: BulkMeter | null,
    currentAssociatedCustomers: IndividualCustomer[],
    currentBranches: Branch[],
    currentBillingHistory: DomainBill[],
    currentBillForPrintView: DomainBill | null,
    currentTariffVersion?: number,
    currentSelectedBillId?: string | null
  ) => {
    if (!currentBulkMeter) {
      setMemoizedDetails(initialMemoizedDetails);
      return;
    }

    const bmPreviousReading = currentBulkMeter.previousReading ?? 0;
    const bmCurrentReading = currentBulkMeter.currentReading ?? 0;
    const bulkUsage = bmCurrentReading - bmPreviousReading;

    const effectiveBulkMeterCustomerType: CustomerType = currentBulkMeter.chargeGroup as CustomerType || "Non-domestic";
    const effectiveBulkMeterSewerageConnection: SewerageConnection = currentBulkMeter.sewerageConnection || "No";
    const billingMonth = currentBulkMeter.month || format(new Date(), 'yyyy-MM');

    // Prevent infinite loop: Only calculate if inputs have changed
    const currentInputs = JSON.stringify({
      bulkUsage,
      type: effectiveBulkMeterCustomerType,
      sewerage: effectiveBulkMeterSewerageConnection,
      size: currentBulkMeter.meterSize,
      month: billingMonth,
      historyLength: currentBillingHistory.length,
      printBillId: currentBillForPrintView?.id,
      tariffVersion: currentTariffVersion ?? tariffVersion,
    });

    if (lastCalculationInputs.current === currentInputs) {
      return;
    }
    lastCalculationInputs.current = currentInputs;

    const activeTariffForRuleCheck = getTariff(effectiveBulkMeterCustomerType, billingMonth);
    const ruleOfThreeActive = activeTariffForRuleCheck?.use_rule_of_three !== false;

    const emptyBillResult: BillCalculationResult = { totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0, sanitationFee: 0, sewerageCharge: 0, meterRent: 0, vatAmount: 0, additionalFeesCharge: 0, effectiveUsage: 0 };

    const totalBulkBillForPeriod = activeTariffForRuleCheck
      ? calculateBillFromTariff(activeTariffForRuleCheck, Math.max(0, bulkUsage), currentBulkMeter.meterSize, effectiveBulkMeterSewerageConnection).totalBill
      : 0;

    const outStandingBillValue = currentBulkMeter.outStandingbill ?? 0;
    const totalIndividualUsage = currentAssociatedCustomers.reduce((sum, cust) => sum + ((cust.currentReading ?? 0) - (cust.previousReading ?? 0)), 0);
    const rawDifference = bulkUsage - totalIndividualUsage;

    let differenceUsage = rawDifference;
    let isMinOfThreeApplied = false;
    if (ruleOfThreeActive && differenceUsage < 3) {
      differenceUsage = 3;
      isMinOfThreeApplied = true;
    } else if (!ruleOfThreeActive && differenceUsage < 0) {
      differenceUsage = 0;
    }

    let sewerageUsage: number | undefined = undefined;
    if (
      effectiveBulkMeterSewerageConnection === 'Yes' &&
      isMinOfThreeApplied &&
      bulkUsage >= 0 && bulkUsage <= 2
    ) {
      sewerageUsage = bulkUsage;
    }

    const differenceFull: BillCalculationResult = activeTariffForRuleCheck
      ? calculateBillFromTariff(activeTariffForRuleCheck, Math.max(0, differenceUsage), currentBulkMeter.meterSize, effectiveBulkMeterSewerageConnection, sewerageUsage)
      : { ...emptyBillResult, effectiveUsage: Math.max(0, differenceUsage) };

    const differenceBill = differenceFull.totalBill;
    const differenceBillBreakdown = differenceFull;

    const totalPayable = differenceBill + outStandingBillValue;
    const paymentStatus: PaymentStatus = totalPayable > 0.01 ? 'Unpaid' : 'Paid';

    const displayBranchName = currentBulkMeter.branchId ? (currentBranches.find(b => b.id === currentBulkMeter.branchId)?.name ?? currentBulkMeter.location ?? "N/A") : (currentBulkMeter.location ?? "N/A");

    // Use explicitly selected bill, print view bill, or auto-select latest bill
    const selectedBill = currentSelectedBillId === 'live'
      ? null
      : (currentSelectedBillId ? currentBillingHistory.find(b => b.id === currentSelectedBillId) : null);
    const mostRecentBill = currentBillingHistory.length > 0 ? currentBillingHistory[0] : null;
    const billToRender = currentBillForPrintView ?? (currentSelectedBillId === 'live' ? null : (selectedBill ?? mostRecentBill));

    let finalBillCardDetails: any;

    if (billToRender) {
      // Dynamic Outstanding Reconstruction for the selected bill
      const billIndex = currentBillingHistory.findIndex(b => b.id === billToRender.id);
      const isPenaltyPolicyEnabled = isPenaltyEngineEnabled(getTariffs());
      const reconstructedOutstanding = reconstructOutstandingForBill(
        billToRender,
        billIndex,
        currentBillingHistory,
        isPenaltyPolicyEnabled
      );

      const snapshot = billToRender.snapshot_data;
      const chargeGroupToUse = snapshot?.chargeGroup || currentBulkMeter.chargeGroup || "Non-domestic";
      const sewerageToUse = snapshot?.sewerageConnection || currentBulkMeter.sewerageConnection || "No";

      // Calculate historical bill synchronously from cached tariff (per-bill month)
      const rawDiffFromSnapshot = (snapshot?.totalIndividualUsage !== undefined && billToRender.CONS !== null && billToRender.CONS !== undefined)
        ? Math.max(0, Number(billToRender.CONS) - Number(snapshot.totalIndividualUsage))
        : 0;
      const diffUsageForBill = Number(
        billToRender.differenceUsage !== null && billToRender.differenceUsage !== undefined
          ? billToRender.differenceUsage
          : ((billToRender as any).difference_usage !== null && (billToRender as any).difference_usage !== undefined
              ? (billToRender as any).difference_usage
              : rawDiffFromSnapshot)
      );
      const historicalTariff = getTariff(chargeGroupToUse as CustomerType, billToRender.monthYear);
      const historicalBillDetails: BillCalculationResult = historicalTariff
        ? calculateBillFromTariff(historicalTariff, diffUsageForBill, currentBulkMeter.meterSize, sewerageToUse as SewerageConnection)
        : { totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0, sanitationFee: 0, sewerageCharge: 0, meterRent: 0, vatAmount: 0, additionalFeesCharge: 0, effectiveUsage: diffUsageForBill };

      let rawPenalty = Number(billToRender.PENALTYAMT || 0);
      const effectiveOutstanding = Number(billToRender.OUTSTANDINGAMT ?? reconstructedOutstanding);
      if (rawPenalty === 0 && effectiveOutstanding > 0) {
        const olderBills = billIndex !== -1
          ? currentBillingHistory.slice(billIndex + 1)
          : currentBillingHistory.filter(b => b.id !== billToRender.id && (!billToRender.monthYear || !b.monthYear || b.monthYear < billToRender.monthYear));
        const agingRes = calculateDebtAging(
          effectiveOutstanding,
          olderBills,
          historicalTariff ?? undefined,
          billToRender.monthYear
        );
        rawPenalty = agingRes.penaltyAmt;
      }

      const penaltyVal = getPenaltyValue(
        rawPenalty,
        isPenaltyPolicyEnabled && (historicalTariff?.penalty_enabled !== false)
      );

      finalBillCardDetails = {
        billId: billToRender.id,
        prevReading: billToRender.PREVREAD,
        currReading: billToRender.CURRREAD,
        usage: billToRender.CONS ?? 0,
        baseWaterCharge: billToRender.baseWaterCharge ?? historicalBillDetails.baseWaterCharge,
        maintenanceFee: billToRender.maintenanceFee ?? historicalBillDetails.maintenanceFee,
        sanitationFee: billToRender.sanitationFee ?? historicalBillDetails.sanitationFee,
        sewerageCharge: billToRender.sewerageCharge ?? historicalBillDetails.sewerageCharge,
        meterRent: billToRender.meterRent ?? historicalBillDetails.meterRent,
        vatAmount: billToRender.vatAmount ?? historicalBillDetails.vatAmount,
        additionalFeesCharge: billToRender.additionalFeesCharge ?? historicalBillDetails.additionalFeesCharge,
        additionalFeesBreakdown: billToRender.additionalFeesBreakdown ?? historicalBillDetails.additionalFeesBreakdown,
        totalDifferenceBill: getMonthlyBillAmt(billToRender),
        differenceUsage: diffUsageForBill,
        penaltyAmt: penaltyVal,
        outstandingBill: billToRender.OUTSTANDINGAMT ?? reconstructedOutstanding,
        totalPayable: (billToRender.OUTSTANDINGAMT ?? reconstructedOutstanding) + getMonthlyBillAmt(billToRender) + penaltyVal,
        paymentStatus: (billToRender.paymentStatus as PaymentStatus) || 'Unpaid',
        month: billToRender.monthYear,
        billKey: billToRender.BILLKEY || (billToRender as any).billKey || null,
        snapshot_data: snapshot,
      };
    } else {
      // Use the bulk meter's current balance as the source of truth for the live dashboard
      const currentReconstructedOutstanding = Number(currentBulkMeter.outStandingbill || 0);

      // Calculate potential live penalty using the shared utility (same logic as server)
      // Use cached tariff synchronously — no server action needed
      const activeTariff = getTariff(effectiveBulkMeterCustomerType, billingMonth);

      const { penaltyAmt: rawLivePenaltyAmt } = calculateDebtAging(
        currentReconstructedOutstanding,
        currentBillingHistory,
        activeTariff ?? undefined,
        billingMonth
      );

      // Guard: exclude penalty from totalPayable when the global penalty engine is OFF
      const isPenaltyPolicyEnabled = isPenaltyEngineEnabled(getTariffs());
      const livePenaltyAmt = getPenaltyValue(rawLivePenaltyAmt, isPenaltyPolicyEnabled);

      finalBillCardDetails = {
        billId: null,
        prevReading: bmPreviousReading,
        currReading: bmCurrentReading,
        usage: bulkUsage,
        ...differenceBillBreakdown,
        totalDifferenceBill: differenceBill,
        differenceUsage: differenceUsage,
        penaltyAmt: Number(livePenaltyAmt.toFixed(2)),
        outstandingBill: Number(currentReconstructedOutstanding.toFixed(2)),
        totalPayable: Number((currentReconstructedOutstanding + differenceBill + livePenaltyAmt).toFixed(2)),
        paymentStatus: paymentStatus,
        month: currentBulkMeter.month || 'N/A',
        billKey: null,
      };
    }

    setMemoizedDetails({
      bmPreviousReading, bmCurrentReading, bulkUsage, totalBulkBillForPeriod,
      totalPayable, differenceUsage, differenceBill, differenceBillBreakdown,
      displayBranchName, displayCardLocation: currentBulkMeter.specificArea || "N/A",
      isMinOfThreeApplied, rawDifference, ruleOfThreeActive,
      billCardDetails: finalBillCardDetails, totalIndividualUsage,
      snapshot_data: finalBillCardDetails?.snapshot_data,
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!bulkMeterKey) {
      setIsLoading(false);
      setBulkMeter(null);
      toast({ title: "Invalid Bulk Meter Key", description: "The key for the bulk meter is missing in the URL.", variant: "destructive" });
      router.push("/admin/bulk-meters");
      return;
    }

    setIsLoading(true);

    Promise.all([
      initializeBulkMeters(true),
      initializeBranches(true),
      initializeBulkMeterReadings(true),
      initializeTariffs(true),
      fetchCustomersForBulkMeter(bulkMeterKey),
      fetchBillsForBulkMeter(bulkMeterKey),
    ]).then(async ([_, __, ___, ____, assignedCusts, meterBills]) => {
      if (!isMounted) return;

      // Fetch live data for this specific meter to ensure Outstanding Bill is fresh
      const { syncBulkMeterLive } = await import("@/lib/data-store");
      await syncBulkMeterLive(bulkMeterKey);

      const currentGlobalMeters = getBulkMeters();
      const currentGlobalBranches = getBranches();
      setBranches(currentGlobalBranches);

      const foundBM = currentGlobalMeters.find(bm => bm.customerKeyNumber === bulkMeterKey);

      if (foundBM) {
        setBulkMeter(foundBM);
        setAssociatedCustomers(assignedCusts || []);
        setMeterReadingHistory(getBulkMeterReadings().filter(r => r.CUSTOMERKEY === foundBM.customerKeyNumber).sort((a, b) => {
          const dateA = new Date(a.readingDate).getTime();
          const dateB = new Date(b.readingDate).getTime();
          if (dateB !== dateA) {
            return dateB - dateA;
          }
          const creationA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const creationB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return creationB - creationA;
        }));
        setBillingHistory((meterBills || []).sort((a: any, b: any) => {
          const dateA = new Date(a.billPeriodEndDate || a.bill_period_end_date || (a.monthYear ? `${a.monthYear}-01` : 0)).getTime();
          const dateB = new Date(b.billPeriodEndDate || b.bill_period_end_date || (b.monthYear ? `${b.monthYear}-01` : 0)).getTime();
          if (dateB !== dateA) {
            return dateB - dateA;
          }
          const creationA = a.createdAt || a.created_at ? new Date(a.createdAt || a.created_at).getTime() : 0;
          const creationB = b.createdAt || b.created_at ? new Date(b.createdAt || b.created_at).getTime() : 0;
          return creationB - creationA;
        }));
      } else {
        setBulkMeter(null);
        toast({ title: "Bulk Meter Not Found", description: "This bulk meter may not exist or has been deleted.", variant: "destructive" });
      }
      setIsLoading(false);
    }).catch(error => {
      if (!isMounted) return;
      console.error("Error initializing data for bulk meter details page:", error);
      toast({ title: "Error Loading Data", description: "Could not load necessary data. Please try again.", variant: "destructive" });
      setBulkMeter(null);
      setIsLoading(false);
    });

    const handleStoresUpdate = () => {
      if (!isMounted) return;
      const currentGlobalMeters = getBulkMeters();
      const currentGlobalCustomers = getCustomers();
      const currentGlobalBranches = getBranches();

      setBranches(currentGlobalBranches);

      const foundBM = currentGlobalMeters.find(bm => bm.customerKeyNumber === bulkMeterKey);

      if (foundBM) {
        setBulkMeter(foundBM);
        if (currentGlobalCustomers.length > 0) {
          setAssociatedCustomers(currentGlobalCustomers.filter(c => c.assignedBulkMeterId === bulkMeterKey));
        }
        setMeterReadingHistory(getBulkMeterReadings().filter(r => r.CUSTOMERKEY === foundBM.customerKeyNumber).sort((a, b) => {
          const dateA = new Date(a.readingDate).getTime();
          const dateB = new Date(b.readingDate).getTime();
          if (dateB !== dateA) return dateB - dateA;
          const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return cB - cA;
        }));

        import('@/lib/data-store').then(({ getTariff, initializeTariffs }) => {
          initializeTariffs().then(() => {
            const t = getTariff(foundBM.chargeGroup as any, format(new Date(), 'yyyy-MM'));
            setActiveTariff(t);
          });
        });

        const globalBills = getBills().filter(b => b.CUSTOMERKEY === foundBM.customerKeyNumber);
        if (globalBills.length > 0) {
          setBillingHistory(globalBills.sort((a: any, b: any) => {
            const dateA = new Date(a.billPeriodEndDate || a.bill_period_end_date || a.monthYear || 0).getTime();
            const dateB = new Date(b.billPeriodEndDate || b.bill_period_end_date || b.monthYear || 0).getTime();
            if (dateB !== dateA) {
              return dateB - dateA;
            }
            const creationA = a.createdAt || a.created_at ? new Date(a.createdAt || a.created_at).getTime() : 0;
            const creationB = b.createdAt || b.created_at ? new Date(b.createdAt || b.created_at).getTime() : 0;
            return creationB - creationA;
          }));
        }
      } else if (bulkMeter) {
        toast({ title: "Bulk Meter Update", description: "The bulk meter being viewed may have been deleted or is no longer accessible.", variant: "destructive" });
        setBulkMeter(null);
      }
    };

    const handleDataRefreshed = async () => {
      if (!isMounted) return;
      handleStoresUpdate();
      refreshCreditData();
      try {
        const { fetchCustomersForBulkMeter, fetchBillsForBulkMeter } = await import('@/lib/data-store');
        const [freshCusts, freshBills] = await Promise.all([
          fetchCustomersForBulkMeter(bulkMeterKey),
          fetchBillsForBulkMeter(bulkMeterKey),
        ]);
        if (isMounted) {
          if (freshCusts && freshCusts.length > 0) setAssociatedCustomers(freshCusts);
          if (freshBills && freshBills.length > 0) {
            setBillingHistory(freshBills.sort((a: any, b: any) => {
              const dateA = new Date(a.billPeriodEndDate || a.bill_period_end_date || a.monthYear || 0).getTime();
              const dateB = new Date(b.billPeriodEndDate || b.bill_period_end_date || b.monthYear || 0).getTime();
              if (dateB !== dateA) return dateB - dateA;
              const cA = a.createdAt || a.created_at ? new Date(a.createdAt || a.created_at).getTime() : 0;
              const cB = b.createdAt || b.created_at ? new Date(b.createdAt || b.created_at).getTime() : 0;
              return cB - cA;
            }));
          }
        }
      } catch (e) {
        console.error("Failed to re-fetch meter data on data-refreshed:", e);
      }
    };
    window.addEventListener('data-refreshed', handleDataRefreshed);

    const unsubBM = subscribeToBulkMeters(handleStoresUpdate);
    const unsubCust = subscribeToCustomers(handleStoresUpdate);
    const unsubBranches = subscribeToBranches(handleStoresUpdate);
    const unsubMeterReadings = subscribeToBulkMeterReadings(handleStoresUpdate);
    const unsubBills = subscribeToBills(handleStoresUpdate);
    const unsubTariffs = subscribeToTariffs(() => {
      // When tariffs change (e.g. Rule of 3 toggled), bump version to trigger recalculation
      setTariffVersion(v => v + 1);
    });

    return () => {
      isMounted = false;
      window.removeEventListener('data-refreshed', handleDataRefreshed);
      unsubBM();
      unsubCust();
      unsubBranches();
      unsubMeterReadings();
      unsubBills();
      unsubTariffs();
    };
  }, [bulkMeterKey, router, toast, refreshCreditData]);

  useEffect(() => {
    calculateMemoizedDetails(bulkMeter, associatedCustomers, branches, billingHistory, billForPrintView, tariffVersion, selectedBillId);
  }, [bulkMeter, associatedCustomers, branches, billingHistory, billForPrintView, calculateMemoizedDetails, tariffVersion, selectedBillId]);

  // GLOBAL BILLING HISTORY RECONSTRUCTION (incremental from oldest to newest)
  const reconstructedHistoryMap = React.useMemo(() => {
    if (!billingHistory.length || !activeTariff) return new Map();

    const results = new Map();
    let carriedForwardUnpaid = 0; // The core debt base (Arrears from previous month)

    // Process from OLDEST to NEWEST
    const historyOldestFirst = [...billingHistory].sort((a, b) => {
      const dateA = new Date(a.billPeriodEndDate || (a as any).bill_period_end_date || (a.monthYear ? `${a.monthYear}-01` : 0)).getTime();
      const dateB = new Date(b.billPeriodEndDate || (b as any).bill_period_end_date || (b.monthYear ? `${b.monthYear}-01` : 0)).getTime();
      if (dateA !== dateB) return dateA - dateB;
      const cA = a.createdAt || (a as any).created_at ? new Date(a.createdAt || (a as any).created_at).getTime() : 0;
      const cB = b.createdAt || (b as any).created_at ? new Date(b.createdAt || (b as any).created_at).getTime() : 0;
      return cA - cB;
    });

    // Tracking aging buckets (unpaid monthly charges)
    let d30_bucket = 0;
    let d30_60_bucket = 0;
    let d60_bucket = 0;
    let billIndexCounter = 0;

    // Credit-note replay state — mirrors the server engine (dbSyncAgingForCustomer in
    // src/lib/db-queries.ts): overpayments become a deposit that discounts future bills.
    // The meter's stored creditBalance + its ledger rows make the replay idempotent, so
    // this client-side copy agrees with what the DB wrote.
    const creditEnabled = true; // bulk-meter details page; bulk meters have credit support
    const creditLedger = creditData?.ledger ?? [];
    const voidedCreditIds = new Set(
      creditLedger.filter((e) => e.event_type === 'voided' && e.voided_ledger_id).map((e) => e.voided_ledger_id as string)
    );
    const createdByBill = new Map<string, { id: string; amount: number }>();
    const appliedByBill = new Map<string, { id: string; amount: number }>();
    for (const e of creditLedger) {
      if (e.event_type === 'created' && e.source_bill_id && !voidedCreditIds.has(e.id)) {
        createdByBill.set(String(e.source_bill_id), { id: e.id, amount: e.amount });
      }
      if (e.event_type === 'applied' && e.source_bill_id && !voidedCreditIds.has(e.id)) {
        appliedByBill.set(String(e.source_bill_id), { id: e.id, amount: e.amount });
      }
    }
    let creditBalance = creditData?.creditBalance ?? Number(bulkMeter?.creditBalance ?? 0);

    for (const bill of historyOldestFirst) {
      // SKIP or VOID records that are marked as Deleted or Void (matches the server, which also treats Reversed as voided)
      const isVoided = bill.status === 'Deleted' || bill.status === 'Void' || bill.status === 'Reversed';

      const threshold = activeTariff.penalty_month_threshold ?? 3;
      const bankRate = Number(activeTariff.bank_lending_rate ?? 0.15);
      const tieredRates = Array.isArray(activeTariff.penalty_tiered_rates) ? activeTariff.penalty_tiered_rates : [];

      // 1. Current Arrears Base (everything unpaid from row before)
      const arrearsSum = carriedForwardUnpaid;

      // 2. Penalty
      let penalty = 0;
      let maxAge = 0;

      // Determine maxAge based on which buckets have debt
      if (d60_bucket > 0.01) maxAge = 3;
      else if (d30_60_bucket > 0.01) maxAge = 2;
      else if (d30_bucket > 0.01) maxAge = 1;

      // Track the total number of billing cycles we've carried debt forward
      // This allows maxAge to exceed 3 for tiered penalties (Month 4, 5, etc.)
      const totalMissedCycles = billIndexCounter;
      maxAge = Math.max(maxAge, totalMissedCycles);

      // Significant debt that doesn't fit in month buckets (legacy), treat as old
      const legacyDebt = Math.max(0, arrearsSum - (d30_bucket + d30_60_bucket + d60_bucket));
      if (legacyDebt > 0.01) maxAge = Math.max(maxAge, 3);

      const isPenaltyEnabled = isPenaltyEngineEnabled(getTariffs()) && (activeTariff as any)?.penalty_enabled !== false;
      if (isPenaltyEnabled && maxAge >= threshold) {
        const applicableTier = [...tieredRates].sort((a, b) => b.month - a.month).find(t => maxAge >= t.month);
        const totalRate = bankRate + Number(applicableTier?.rate || 0);
        penalty = arrearsSum * totalRate;
      } else {
        penalty = 0;
      }

      // 3. Current Month Monthly Part (0 if voided)
      const currentMonthlyCharge = isVoided ? 0 : getMonthlyBillAmt(bill);

      // 4. Totals & Dynamic Reconstruction
      const totalD60AndLegacy = d60_bucket + legacyDebt;

      // Reconstruct exactly from buckets as per business rule (summing debit_30 + d30_60 + d60 + penalty)
      const derivedOutstanding = d30_bucket + d30_60_bucket + totalD60AndLegacy + penalty;
      const totalPayable = isVoided ? 0 : derivedOutstanding + currentMonthlyCharge;

      // 5. Update Carried Forward for nextrow
      // If voided, we assume no payment was possible/recorded against THIS specific record
      const amtPaid = isVoided ? 0 : Number(bill.amountPaid || 0);

      // The business rule: previous Penalty must be carried forward and included in the arrears,
      // which will naturally cascade down into Debit_60 as legacy debt since it doesn't fit the newer buckets.
      const debtForNextMonth = d30_bucket + d30_60_bucket + totalD60AndLegacy + currentMonthlyCharge + penalty;

      // Credit-aware carry-forward — identical math to the server's dbSyncAgingForCustomer:
      // the deposit (created rows) covers unpaid debt (applied rows) before any balance carries.
      let creditApplied = 0;
      if (creditEnabled) {
        const existingCreated = createdByBill.get(String(bill.id)) ?? null;
        const existingApplied = appliedByBill.get(String(bill.id)) ?? null;
        const creditResult = computeCreditForBill({
          debtForNextMonth,
          amtPaid,
          creditBalance,
          existingCreated,
          existingApplied,
        });
        creditBalance = creditResult.newCreditBalance;
        creditApplied = creditResult.creditApplied;
        carriedForwardUnpaid = creditResult.carriedForwardUnpaid;
      } else {
        // Legacy clamp (non-bulk customers — no credit support yet)
        carriedForwardUnpaid = Math.max(0, debtForNextMonth - amtPaid);
      }

      // Save results (paymentStatus mirrors the engine's per-bill write-back)
      const billUnpaid = Math.max(0, totalPayable - amtPaid - creditApplied);
      results.set(bill.id, {
        d30: d30_bucket,
        d30_60: d30_60_bucket,
        d60: totalD60AndLegacy,
        penalty,
        outstanding: derivedOutstanding,
        currentMonthly: currentMonthlyCharge,
        totalPayable,
        creditApplied,
        paymentStatus: billUnpaid <= 0.01 ? 'Paid' : 'Unpaid',
      });

      // 6. Update Aging Buckets for next cycle (credit counts as a payment source,
      //     so a credit-paid bill never carries phantom debt into the next cycle)
      let remainingPayment = amtPaid + creditApplied;

      const paidAgainstOldest = Math.min(remainingPayment, totalD60AndLegacy);
      const remaining_d60_plus_legacy = Math.max(0, totalD60AndLegacy - paidAgainstOldest);
      remainingPayment -= paidAgainstOldest;

      // Unpaid penalty will remain in 'carriedForwardUnpaid' and be caught by 'legacyDebt' next cycle, moving into Debit_60
      const paidAgainstPenalty = Math.min(remainingPayment, penalty);
      remainingPayment -= paidAgainstPenalty;

      const paidAgainstD30_60 = Math.min(remainingPayment, d30_60_bucket);
      const remaining_d30_60 = Math.max(0, d30_60_bucket - paidAgainstD30_60);
      remainingPayment -= paidAgainstD30_60;

      const paidAgainstD30 = Math.min(remainingPayment, d30_bucket);
      const remaining_d30 = Math.max(0, d30_bucket - paidAgainstD30);
      remainingPayment -= paidAgainstD30;

      const paidAgainstCurrent = Math.min(remainingPayment, currentMonthlyCharge);
      const remaining_current = Math.max(0, currentMonthlyCharge - paidAgainstCurrent);

      d60_bucket = remaining_d60_plus_legacy + remaining_d30_60;
      d30_60_bucket = remaining_d30;
      d30_bucket = remaining_current;

      // Increment counter for next month if we still have debt
      if (carriedForwardUnpaid > 0.01) {
        billIndexCounter++;
      } else {
        billIndexCounter = 0;
      }
    }

    return results;
  }, [billingHistory, activeTariff, creditData, bulkMeter, tariffVersion]);

  const {
    bmPreviousReading,
    bmCurrentReading,
    bulkUsage,
    totalBulkBillForPeriod,
    totalPayable,
    differenceUsage,
    differenceBill,
    differenceBillBreakdown,
    displayBranchName,
    displayCardLocation,
    billCardDetails,
    totalIndividualUsage,
    isMinOfThreeApplied,
    rawDifference,
    ruleOfThreeActive,
    snapshot_data,
  } = memoizedDetails;

  // Penalty engine state — used by the card UI to label the penalty row
  const isPenaltyOff = !isPenaltyEngineEnabled(getTariffs());

  // Count how many distinct months are carrying unpaid debt that feeds into the outstanding balance.
  // We look at the billing history relative to the currently displayed bill month:
  // any older unpaid bill contributes to the outstanding shown on the card.
  const overdueMonthsCount = useMemo(() => {
    if (!billingHistory.length) return 0;
    const displayedMonth = billCardDetails.month && billCardDetails.month !== 'N/A'
      ? billCardDetails.month
      : null;
    const unpaidOlderBills = billingHistory.filter(b => {
      if (b.paymentStatus === 'Paid') return false;
      if (b.status === 'Deleted' || b.status === 'Void' || b.status === 'Reversed') return false;
      if (!displayedMonth) return true; // no context, count all unpaid
      return b.monthYear < displayedMonth; // strictly older than the displayed month
    });
    return unpaidOlderBills.length;
  }, [billingHistory, billCardDetails.month]);

  const { displayedPenaltyAmt, displayedTotalPayable } = useCardPenaltyDisplay({
    billCardDetails,
    billingHistory,
    reconstructedHistoryMap,
    isPenaltyOff,
  });

  const handleEditBulkMeter = () => setIsBulkMeterFormOpen(true);
  const handleDeleteBulkMeter = () => setIsBulkMeterDeleteDialogOpen(true);
  const confirmDeleteBulkMeter = async () => {
    if (bulkMeter) {
      try {
        await deleteBulkMeterFromStore(bulkMeter.customerKeyNumber);
        toast({ title: "Bulk Meter Deleted", description: `${bulkMeter.name} has been removed.` });
        router.push("/admin/bulk-meters");
      } catch (err: any) {
        toast({ variant: "destructive", title: "Delete Failed", description: err.message || "Failed to delete bulk meter." });
      }
    }
    setIsBulkMeterDeleteDialogOpen(false);
  };

  const handleSubmitBulkMeterForm = async (data: BulkMeterFormValues) => {
    if (bulkMeter) {
      try {
        await updateBulkMeterInStore(bulkMeter.customerKeyNumber, data);
        toast({ title: "Bulk Meter Updated", description: `${data.name} has been updated.` });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Update Failed", description: err.message || "Failed to update bulk meter." });
      }
    }
    setIsBulkMeterFormOpen(false);
  };

  const handleAddNewReading = async (readingValue: number) => {
    if (!bulkMeter) return;

    const readingDate = new Date();

    const result = await addBulkMeterReading({
      CUSTOMERKEY: bulkMeter.customerKeyNumber,
      readingValue: readingValue,
      readingDate: format(readingDate, "yyyy-MM-dd"),
      monthYear: format(readingDate, "yyyy-MM"),
    });

    if (result.success) {
      toast({ title: "Reading Added", description: "The new meter reading has been saved." });
    } else {
      toast({ variant: "destructive", title: "Failed to Add Reading", description: result.message });
    }
  };


  const handleEditCustomer = (customer: IndividualCustomer) => {
    if (!canEditCustomer) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to update customers.' });
      return;
    }
    setSelectedCustomer(customer);
    setIsCustomerFormOpen(true);
  };
  const handleDeleteCustomer = (customer: IndividualCustomer) => {
    if (!canDeleteCustomer) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to delete customers.' });
      return;
    }
    setCustomerToDelete(customer);
    setIsCustomerDeleteDialogOpen(true);
  };
  const confirmDeleteCustomer = async () => {
    if (customerToDelete) {
      try {
        await deleteCustomerFromStore(customerToDelete.customerKeyNumber);
        toast({ title: "Customer Deleted", description: `${customerToDelete.name} has been removed.` });
        setAssociatedCustomers(prev => prev.filter(c => c.customerKeyNumber !== customerToDelete.customerKeyNumber));
      } catch (err: any) {
        toast({ variant: "destructive", title: "Delete Failed", description: err.message || "Failed to delete customer." });
      }
    }
    setCustomerToDelete(null);
    setIsCustomerDeleteDialogOpen(false);
  };

  const handleExportToXlsx = () => {
    if (!associatedCustomers || associatedCustomers.length === 0) return;

    const headers = [
      "Customer Name",
      "Customer Key Number",
      "INST KEY",
      "Contract Number",
      "Customer Type",
      "Book Number",
      "Ordinal",
      "Meter Number",
      "Meter Size (inch)",
      "Number of Dials",
      "Billing Period",
      "Previous Reading",
      "Current Reading",
      "Usage (m³)",
      "Calculated Bill (ETB)",
      "Month",
      "Specific Area",
      "Sub-City",
      "Woreda",
      "Sewerage Connection",
      "Payment Status",
      "Status",
      "Assigned Bulk Meter Name",
      "Assigned Bulk Meter Key Number",
      "Assigned Bulk Meter Number"
    ];

    const data = associatedCustomers.map(customer => {
      const periodData = customerPeriodReadingsMap.get(customer.customerKeyNumber);
      const prevRead = periodData?.prevRead ?? (customer.previousReading ?? 0);
      const currRead = periodData?.currRead ?? (customer.currentReading ?? 0);
      const usage = periodData?.usage ?? (currRead - prevRead);
      const billAmt = periodData?.totalBill ?? (customer.calculatedBill ?? 0);
      return {
        "Customer Name": customer.name,
        "Customer Key Number": customer.customerKeyNumber,
        "INST KEY": customer.instKey || "",
        "Contract Number": customer.contractNumber || "",
        "Customer Type": customer.customerType || "",
        "Book Number": customer.bookNumber || "",
        "Ordinal": customer.ordinal || "",
        "Meter Number": customer.meterNumber || "",
        "Meter Size (inch)": customer.meterSize || "",
        "Number of Dials": customer.NUMBER_OF_DIALS || "",
        "Billing Period": selectedCustomerPeriod || 'Latest',
        "Previous Reading": prevRead,
        "Current Reading": currRead,
        "Usage (m³)": usage,
        "Calculated Bill (ETB)": billAmt,
        "Month": selectedCustomerPeriod || customer.month || "",
        "Specific Area": customer.specificArea || "",
        "Sub-City": customer.subCity || "",
        "Woreda": customer.woreda || "",
        "Sewerage Connection": customer.sewerageConnection || "",
        "Payment Status": customer.paymentStatus || "",
        "Status": customer.status || "",
        "Assigned Bulk Meter Name": bulkMeter?.name || "",
        "Assigned Bulk Meter Key Number": bulkMeter?.customerKeyNumber || "",
        "Assigned Bulk Meter Number": bulkMeter?.meterNumber || ""
      };
    });

    const xlsxBlob = arrayToXlsxBlob(data, headers);
    const fileName = `Associated_Customers_${bulkMeter?.customerKeyNumber || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    downloadFile(xlsxBlob, fileName);
  };

  const handleAddCustomerToBulkMeter = () => {
    setSelectedCustomer({
      assignedBulkMeterId: bulkMeter?.customerKeyNumber,
      branchId: bulkMeter?.branchId,
      subCity: bulkMeter?.subCity,
      woreda: bulkMeter?.woreda,
    } as any);
    setIsCustomerFormOpen(true);
  };

  const handleViewCustomerDetails = (customer: IndividualCustomer) => {
    setSelectedCustomerForDetails(customer);
    setIsCustomerDetailsOpen(true);
  };

  const handleSubmitCustomerForm = async (data: IndividualCustomerFormValues) => {
    if (selectedCustomer && selectedCustomer.customerKeyNumber) {
      const updatedCustomerData: Partial<Omit<IndividualCustomer, 'customerKeyNumber'>> = {
        ...data, ordinal: Number(data.ordinal), meterSize: Number(data.meterSize),
        previousReading: Number(data.previousReading), currentReading: Number(data.currentReading),
        status: data.status as IndividualCustomerStatus, paymentStatus: data.paymentStatus as PaymentStatus,
        customerType: data.customerType as CustomerType, sewerageConnection: data.sewerageConnection as SewerageConnection,
        assignedBulkMeterId: data.assignedBulkMeterId || undefined,
      };
      await updateCustomerInStore(selectedCustomer.customerKeyNumber, updatedCustomerData);
      toast({ title: "Customer Updated", description: `${data.name} has been updated.` });
    } else {
      const result = await addCustomerToStore(data);
      if (result.success) {
        toast({ title: "Customer Added", description: `${data.name} has been added to this bulk meter.` });
      } else {
        toast({ variant: "destructive", title: "Add Failed", description: result.message || "Could not add customer." });
      }
    }
    setIsCustomerFormOpen(false); setSelectedCustomer(null);
  };

  const prepareSlipData = (bill?: DomainBill | null) => {
    if (!bulkMeter) return false;

    if (bill) {
      const recon = reconstructedHistoryMap.get(bill.id);
      if (recon) {
        setBillForPrintView({
          ...bill,
          OUTSTANDINGAMT: recon.outstanding,
          PENALTYAMT: recon.penalty,
          THISMONTHBILLAMT: recon.currentMonthly,
          TOTALBILLAMOUNT: recon.totalPayable,
          paymentStatus: recon.paymentStatus || bill.paymentStatus || (bill as any).payment_status || 'Unpaid'
        });
      } else {
        setBillForPrintView(bill);
      }
    } else {
      const recentBill = billingHistory.length > 0 ? billingHistory[0] : null;
      if (recentBill) {
        const recon = reconstructedHistoryMap.get(recentBill.id);
        if (recon) {
          setBillForPrintView({
            ...recentBill,
            OUTSTANDINGAMT: recon.outstanding,
            PENALTYAMT: recon.penalty,
            THISMONTHBILLAMT: recon.currentMonthly,
            TOTALBILLAMOUNT: recon.totalPayable,
            paymentStatus: recon.paymentStatus || recentBill.paymentStatus || (recentBill as any).payment_status || 'Unpaid'
          });
        } else {
          setBillForPrintView(recentBill);
        }
      } else {
        toast({
          title: "Generating Live Payslip",
          description: "No historical bill found. A payslip is being generated from the current meter data.",
        });
        const temporaryBillForPrint: DomainBill = {
          id: `payslip-${bulkMeter.customerKeyNumber}-${Date.now()}`,
          CUSTOMERKEY: bulkMeter.customerKeyNumber,
          monthYear: bulkMeter.month || 'N/A',
          billPeriodStartDate: bulkMeter.month ? getBillingPeriodStartDate(bulkMeter.month) : 'N/A',
          billPeriodEndDate: bulkMeter.month ? getBillingPeriodEndDate(bulkMeter.month) : 'N/A',
          PREVREAD: bmPreviousReading,
          CURRREAD: bmCurrentReading,
          CONS: bulkUsage,
          differenceUsage: differenceUsage,
          baseWaterCharge: differenceBillBreakdown.baseWaterCharge,
          maintenanceFee: differenceBillBreakdown.maintenanceFee,
          sanitationFee: differenceBillBreakdown.sanitationFee,
          sewerageCharge: differenceBillBreakdown.sewerageCharge,
          meterRent: differenceBillBreakdown.meterRent,
          balanceCarriedForward: billCardDetails.outstandingBill, // Use memoized detail
          OUTSTANDINGAMT: billCardDetails.outstandingBill,
          PENALTYAMT: billCardDetails.penaltyAmt,
          THISMONTHBILLAMT: billCardDetails.totalDifferenceBill,
          TOTALBILLAMOUNT: billCardDetails.totalPayable,
          dueDate: 'N/A',
          paymentStatus: billCardDetails.paymentStatus,
          notes: "Current Live Pay Slip Generation (No History Available)",
          snapshot_data: {
            chargeGroup: bulkMeter.chargeGroup,
            sewerageConnection: bulkMeter.sewerageConnection,
            individualCustomerCount: associatedCustomers.length,
            totalIndividualUsage: totalIndividualUsage
          } as any
        };
        setBillForPrintView(temporaryBillForPrint);
      }
    }
    return true;
  };

  const handleCloseSlip = () => {
    setShowSlip(false);
    setBillForPrintView(null);
  };

  const handleViewSlip = () => {
    if (prepareSlipData()) {
      setShowSlip(true);
    }
  };

  // Source Bill click in the Credit / Deposit ledger → open that bill's payslip directly.
  const handleOpenBillFromLedger = (billId: string) => {
    const bill = billingHistory.find((b) => b.id === billId);
    if (!bill) {
      toast({ variant: "destructive", title: "Bill Not Found", description: "This bill may have been deleted or is no longer in the current history." });
      return;
    }
    if (prepareSlipData(bill)) {
      setShowSlip(true);
    }
  };

  const handlePrintSlip = (bill?: DomainBill | null) => {
    if (prepareSlipData(bill)) {
      setShowSlip(true);
      setIsPrinting(true);
    }
  };

  React.useEffect(() => {
    if (isPrinting) {
      const timer = setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isPrinting]);


  const handleDeleteBillingRecord = (bill: DomainBill) => {
    setBillToDelete(bill);
    setIsBillDeleteDialogOpen(true);
  };

  const confirmDeleteBillingRecord = async () => {
    if (billToDelete) {
      try {
        await removeBill(billToDelete.id);
        toast({ title: "Billing Record Deleted", description: `The bill for ${billToDelete.monthYear} has been removed.` });
        setBillingHistory(prev => prev.filter(b => b.id !== billToDelete.id));
        setBillToDelete(null);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("data-refreshed"));
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Delete Failed", description: err.message || "Failed to delete billing record." });
      }
    }
    setIsBillDeleteDialogOpen(false);
  };

  const handleUpdateBillStatus = (bill: DomainBill) => {
    if (!canUpdateBillStatus) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You do not have permission to edit bill payment statuses.",
      });
      return;
    }
    setBillToUpdate(bill);
    setIsUpdateStatusDialogOpen(true);
  };

  const handleStatusUpdateSuccess = async (billId: string, newStatus: "Paid" | "Unpaid") => {
    toast({
      title: "Payment Status Updated",
      description: `Bill for ${billToUpdate?.monthYear ?? ""} has been marked as ${newStatus}. Debt aging and bulk meter totals have been recalculated.`,
    });
    // Immediately update in-memory billingHistory state so reconstructedHistoryMap updates on screen
    setBillingHistory(prev => prev.map(b => {
      if (b.id === billId) {
        return {
          ...b,
          paymentStatus: newStatus,
          amountPaid: newStatus === 'Paid' ? Number(b.TOTALBILLAMOUNT || 0) : 0,
        };
      }
      return b;
    }));
    if (bulkMeter) {
      const isLatest = billingHistory[0]?.id === billId;
      if (isLatest) {
        await updateBulkMeterInStore(bulkMeter.customerKeyNumber, { paymentStatus: newStatus });
      }
    }
    setBillToUpdate(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("data-refreshed"));
    }
  };

  React.useEffect(() => {
    if (showSlip || isPrinting) {
      setCurrentDateTime(new Date().toLocaleString('en-US'));
    }
  }, [showSlip, isPrinting]);


  if (isLoading) return <div className="p-4 text-center">Loading bulk meter details...</div>;
  if (!bulkMeter && !isLoading) return <div className="p-4 text-center">Bulk meter not found or an error occurred.</div>;
  // Narrow bulkMeter for JSX usage
  const currentBulkMeter = bulkMeter!;

  // Credit values used by the payslip: how much of THIS bill was paid by deposit,
  // and the deposit remaining after it (from the ledger's balance_after).
  const creditLedgerRows = creditData?.ledger ?? [];
  const voidedCreditIds = new Set(
    creditLedgerRows.filter((e) => e.event_type === 'voided' && e.voided_ledger_id).map((e) => e.voided_ledger_id as string)
  );
  const appliedCreditEntry = creditLedgerRows.find(
    (e) => e.event_type === 'applied' && e.source_bill_id === billForPrintView?.id && !voidedCreditIds.has(e.id)
  );
  const creditAppliedForBill = appliedCreditEntry ? appliedCreditEntry.amount : 0;
  const remainingDepositAfterBill = appliedCreditEntry ? appliedCreditEntry.balance_after : (creditData?.creditBalance ?? 0);
  const meterCreditBalance = creditData?.creditBalance ?? Number(currentBulkMeter.creditBalance ?? 0);

  return (
    <div className={cn("space-y-6", showSlip ? "p-0 bg-slate-100/30 flex flex-col items-start" : "p-4")}>
      {showSlip ? (
        <Card className="printable-bill-card-wrapper border-none shadow-none bg-transparent w-full">
          <CardHeader className="non-printable flex flex-row items-center justify-between max-w-4xl w-full mx-auto bg-white/80 backdrop-blur-sm sticky top-0 z-50 rounded-b-xl border shadow-sm">
            <CardTitle>Pay Slip Preview</CardTitle>

            <Button variant="ghost" size="icon" onClick={handleCloseSlip}>
              <XCircle className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="printable-bill-card">
              <div className="print-header">
                <div className="print-header-top">
                  <span>{currentDateTime}</span>
                  <span></span>
                </div>
                <div className="print-header-main flex flex-col items-start text-left">
                  <h1 className="font-bold tracking-wider uppercase text-sm">ADDIS ABABA WATER AND SEWERAGE AUTHORITY</h1>
                  <hr className="my-1 w-full border-black" />
                  <div className="flex flex-row items-center justify-center gap-2 pt-0.5">
                    <Image src="/images/aawsa-logo.jpg" alt="AAWSA Logo" width={22} height={14} className="flex-shrink-0" />
                    <h2 className="font-semibold text-xs">AAWSA INVOICE</h2>
                  </div>
                </div>
              </div>
              <div className="print-body">
                <div className="print-section">
                  <div className="print-banner">BULK INFORMATION</div>
                  <table className="print-table">
                    <tbody>
                      <tr><td>Bulk meter name:</td><td>{currentBulkMeter.name}</td></tr>
                      <tr><td>Customer key number:</td><td>{currentBulkMeter.customerKeyNumber}</td></tr>
                      <tr><td>Contract No:</td><td>{currentBulkMeter.contractNumber ?? 'N/A'}</td></tr>
                      <tr><td>Bill Key:</td><td className="font-mono font-bold">{billForPrintView?.BILLKEY || (billForPrintView as any)?.billKey || 'N/A'}</td></tr>
                      <tr><td>Branch:</td><td>{displayBranchName ?? 'N/A'}</td></tr>
                      <tr><td>Sub-City:</td><td>{currentBulkMeter.location}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="print-section">
                  <div className="print-banner">READING INFORMATION</div>
                  <table className="print-table">
                    <tbody>
                      <tr><td>Bulk Meter Category:</td><td>{snapshot_data?.chargeGroup || currentBulkMeter.chargeGroup}</td></tr>
                      <tr><td>Sewerage Connection:</td><td>{snapshot_data?.sewerageConnection || currentBulkMeter.sewerageConnection}</td></tr>
                      <tr><td>Number of Assigned Individual Customers:</td><td>{snapshot_data?.individualCustomerCount ?? associatedCustomers.length}</td></tr>
                      {(() => {
                        const printBulkUsage = billForPrintView
                          ? Number(billForPrintView.CONS ?? (Number(billForPrintView.CURRREAD ?? 0) - Number(billForPrintView.PREVREAD ?? 0)))
                          : Number(billCardDetails.usage ?? 0);

                        const printDiffUsage = billForPrintView
                          ? Number(billForPrintView.differenceUsage ?? (billForPrintView as any).difference_usage ?? 0)
                          : Number(billCardDetails.differenceUsage ?? 0);

                        const printTotalIndivUsage = billForPrintView
                          ? Number(
                              billForPrintView.snapshot_data?.totalIndividualUsage ??
                              (billForPrintView.snapshot_data as any)?.total_individual_usage ??
                              Math.max(0, printBulkUsage - printDiffUsage)
                            )
                          : Number(snapshot_data?.totalIndividualUsage ?? totalIndividualUsage ?? 0);

                        return (
                          <>
                            <tr><td>Previous and current reading:</td><td>{Number(billForPrintView?.PREVREAD ?? billCardDetails.prevReading).toFixed(2)} / {Number(billForPrintView?.CURRREAD ?? billCardDetails.currReading).toFixed(2)} m³</td></tr>
                            <tr><td>Bulk usage:</td><td>{printBulkUsage.toFixed(2)} m³</td></tr>
                            <tr><td>Total Individual Usage:</td><td>{printTotalIndivUsage.toFixed(2)} m³</td></tr>
                            <tr><td>Difference usage:</td><td>{printDiffUsage.toFixed(2)} m³</td></tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="print-section">
                  <div className="print-banner">CHARGES BREAKDOWN</div>
                  <table className="print-table">
                    <tbody>
                      <tr>
                        <td>Base Water Charge (Rate/m³):</td>
                        <td>ETB {(billForPrintView?.baseWaterCharge ?? billCardDetails.baseWaterCharge).toFixed(2)}</td>
                      </tr>
                      <tr><td>Maintenance Fee:</td><td>ETB {(billForPrintView?.maintenanceFee ?? billCardDetails.maintenanceFee).toFixed(2)}</td></tr>
                      <tr><td>Sanitation Fee:</td><td>ETB {(billForPrintView?.sanitationFee ?? billCardDetails.sanitationFee).toFixed(2)}</td></tr>
                      <tr><td>Meter Rent:</td><td>ETB {(billForPrintView?.meterRent ?? billCardDetails.meterRent).toFixed(2)}</td></tr>
                      <tr><td>Sewerage Fee:</td><td>ETB {(billForPrintView?.sewerageCharge ?? billCardDetails.sewerageCharge).toFixed(2)}</td></tr>
                      <tr><td>VAT (15%):</td><td>ETB {(billForPrintView?.vatAmount ?? billCardDetails.vatAmount).toFixed(2)}</td></tr>
                      {Boolean(differenceBillBreakdown?.additionalFeesCharge && differenceBillBreakdown.additionalFeesCharge > 0) ? (
                        <>
                          <tr className="border-t-2 border-dashed border-black">
                            <td className="font-semibold">Additional Fees:</td><td></td>
                          </tr>
                          {differenceBillBreakdown?.additionalFeesBreakdown?.map((fee, idx) => (
                            <tr key={idx}><td className="pl-4">{fee.name}:</td><td>ETB {fee.charge.toFixed(2)}</td></tr>
                          ))}
                          <tr><td className="font-semibold pl-4">Total Additional Fees:</td><td>ETB {differenceBillBreakdown.additionalFeesCharge.toFixed(2)}</td></tr>
                        </>
                      ) : null}
                    </tbody>
                  </table>
                </div>



                <div className="print-section">
                  <div className="print-banner">Total Amount Payable:</div>
                  <table className="print-table">
                    <tbody>
                      <tr className="print-table-total"><td>Current Bill (ETB)</td><td>ETB {(billForPrintView ? Number(billForPrintView.THISMONTHBILLAMT ?? billForPrintView.TOTALBILLAMOUNT ?? 0) : billCardDetails.totalDifferenceBill).toFixed(2)}</td></tr>
                      <tr><td>Penalty (ETB):</td><td>ETB {displayedPenaltyAmt.toFixed(2)}</td></tr>
                      <tr><td>Outstanding (ETB):</td><td>ETB {(billForPrintView ? Number(billForPrintView.OUTSTANDINGAMT || 0) : billCardDetails.outstandingBill).toFixed(2)}</td></tr>
                      {creditAppliedForBill > 0.005 && (
                        <tr>
                          <td>Credit Applied (Deposit):</td>
                          <td>−ETB {creditAppliedForBill.toFixed(2)}</td>
                        </tr>
                      )}
                      {creditAppliedForBill > 0.005 && remainingDepositAfterBill > 0.005 && (
                        <tr>
                          <td>Remaining Deposit:</td>
                          <td>ETB {remainingDepositAfterBill.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="print-table-total" style={{ fontSize: '10pt' }}>
                        <td>Total Amount Payable:</td>
                        <td>ETB {Math.max(0, displayedTotalPayable - creditAppliedForBill).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-end mt-1 px-1">
                  <div className="space-y-0 text-[9px] font-medium">
                    <div>Paid/Unpaid: {billForPrintView?.paymentStatus || (billForPrintView as any)?.payment_status || 'Unpaid'}</div>
                    <div>Month: {billForPrintView?.monthYear || (billForPrintView as any)?.month_year || billCardDetails.month}</div>
                  </div>
                  <div className="print-status-box scale-[0.6] origin-bottom-right">
                    {billForPrintView?.paymentStatus || (billForPrintView as any)?.payment_status || 'Unpaid'}
                  </div>
                </div>

                <div className="print-signature-section grid grid-cols-3 gap-8 mt-2">
                  <div className="print-signature-item border-top border-black pt-0.5 flex flex-col">
                    <span className="text-[9px] uppercase font-bold">Prepared by</span>
                    <span className="h-4"></span>
                  </div>
                  <div className="print-signature-item border-top border-black pt-0.5 flex flex-col">
                    <span className="text-[9px] uppercase font-bold">Checked by</span>
                    <span className="h-4"></span>
                  </div>
                  <div className="print-signature-item border-top border-black pt-0.5 flex flex-col">
                    <span className="text-[9px] uppercase font-bold">Approved by</span>
                    <span className="h-4"></span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="shadow-lg xl:col-span-2">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Gauge className="h-6 w-6 text-primary" />
                  <div className="flex-1">
                    <CardTitle className="text-xl sm:text-2xl">{currentBulkMeter.name}</CardTitle>
                    <CardDescription>Key: {currentBulkMeter.customerKeyNumber}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <SyncPaymentStatusDialog
                      initialCustomerKey={currentBulkMeter.customerKeyNumber}
                      triggerButton={
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
                          Sync AAWSA Payment
                        </Button>
                      }
                    />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <Menu className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleViewSlip}>
                        <Eye className="mr-2 h-4 w-4" />
                        <span>View Slip</span>
                      </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePrintSlip()}>
                      <Printer className="mr-2 h-4 w-4" />
                      <span>Print Slip</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleEditBulkMeter}>
                      <FileEdit className="mr-2 h-4 w-4" />
                      <span>Edit Bulk Meter</span>
                    </DropdownMenuItem>
                    {canManageCustomers && (
                      <DropdownMenuItem onClick={() => setIsManageCustomersOpen(true)}>
                        <UsersIcon className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-blue-600 dark:text-blue-400">Manage Assigned Customers</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleDeleteBulkMeter} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete Bulk Meter</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {/* Left column */}
                  <div className="space-y-2">
                    {[
                      { label: 'Branch', value: displayBranchName ?? 'N/A' },
                      { label: 'Sub-City', value: `${currentBulkMeter.location ?? 'N/A'}, ${currentBulkMeter.woreda ?? 'N/A'}` },
                      { label: 'Specific Area', value: currentBulkMeter.specificArea ?? 'N/A' },
                      { label: 'Meter No', value: currentBulkMeter.meterNumber ?? 'N/A' },
                      { label: 'Meter Size', value: `${currentBulkMeter.meterSize} inch` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50">
                        <span className="text-muted-foreground font-medium">{label}</span>
                        <span className="font-semibold text-right">{value}</span>
                      </div>
                    ))}
                    {currentBulkMeter.xCoordinate && currentBulkMeter.yCoordinate && (
                      <a href={`https://www.google.com/maps?q=${currentBulkMeter.yCoordinate},${currentBulkMeter.xCoordinate}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-primary hover:underline px-3 py-1 text-sm">
                        <MapPin className="mr-1 h-4 w-4" /> View on Map
                      </a>
                    )}
                  </div>
                  {/* Right column */}
                  <div className="space-y-2">
                    {[
                      { label: 'Contract No', value: currentBulkMeter.contractNumber ?? 'N/A' },
                      { label: 'Month', value: currentBulkMeter.month ?? 'N/A' },
                      { label: 'Readings (Prev/Curr)', value: `${bmPreviousReading.toFixed(2)} / ${bmCurrentReading.toFixed(2)}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50">
                        <span className="text-muted-foreground font-medium">{label}</span>
                        <span className="font-semibold text-right">{value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2 rounded-md bg-blue-500/10 border border-blue-500/30">
                      <span className="text-blue-700 dark:text-blue-400 font-medium text-sm">Bulk Usage</span>
                      <span className="font-bold text-blue-700 dark:text-blue-400">{bulkUsage.toFixed(2)} m³</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 rounded-md bg-violet-500/10 border border-violet-500/30">
                      <span className="text-violet-700 dark:text-violet-400 font-medium text-sm">Total Individual Usage</span>
                      <span className="font-bold text-violet-700 dark:text-violet-400">{totalIndividualUsage.toFixed(2)} m³</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50">
                      <span className="text-muted-foreground font-medium">Payment Status</span>
                      <Badge variant={billCardDetails.paymentStatus === 'Paid' ? 'default' : 'destructive'} className="cursor-pointer hover:opacity-80">
                        {billCardDetails.paymentStatus === 'Paid' ? <CheckCircle className="mr-1 h-3.5 w-3.5" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                        {billCardDetails.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Difference Billing Calculation
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {billCardDetails.billKey && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[11px] px-2 py-0.5 font-mono font-bold bg-muted/60 text-foreground border"
                      >
                        Key: {billCardDetails.billKey}
                      </Badge>
                    )}
                    {billingHistory.length > 0 ? (
                      <Select
                        value={selectedBillId ?? (billingHistory[0]?.id || '')}
                        onValueChange={(val) => setSelectedBillId(val === 'live' ? 'live' : val)}
                      >
                        <SelectTrigger className="h-6 text-[11px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/25 font-semibold tracking-wide shadow-none focus:ring-0">
                          <SelectValue placeholder={billCardDetails.month} />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {billingHistory.map((b) => (
                            <SelectItem key={b.id} value={b.id} className="text-xs">
                              {b.monthYear || 'Unknown month'} {b.id === billingHistory[0]?.id ? '(Latest)' : ''}
                            </SelectItem>
                          ))}
                          <SelectItem value="live" className="text-xs text-muted-foreground">
                            Live (Unsaved)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : billCardDetails.month && billCardDetails.month !== 'N/A' ? (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[11px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/25 font-semibold tracking-wide"
                      >
                        {billCardDetails.month}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <CardDescription className="text-[11px] mt-0.5">
                  {billCardDetails.billId
                    ? `Showing billed data for month: ${billCardDetails.month}`
                    : billCardDetails.month && billCardDetails.month !== 'N/A'
                      ? `Live calculation for month: ${billCardDetails.month}`
                      : 'Live calculation — no billing history yet'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {/* ⚠️ Negative Consumption Warning — shown when sub-meter total exceeds bulk meter reading AND Rule of 3 is OFF */}
                {!billCardDetails.billId && rawDifference < 0 && !ruleOfThreeActive && (
                  <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-300 space-y-2">
                    <div className="flex items-center gap-2 text-red-700 font-semibold text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>⚠️ Attention Required — Negative Consumption</span>
                    </div>
                    <p className="text-[11px] text-red-700 leading-relaxed">
                      Individual sub-meter total (<span className="font-bold">{totalIndividualUsage.toFixed(2)} m³</span>) exceeds
                      bulk meter reading (<span className="font-bold">{bulkUsage.toFixed(2)} m³</span>).
                      A bill <span className="font-bold">cannot be generated</span> until readings are corrected.
                    </p>
                    <ul className="text-[11px] text-red-600 list-disc list-inside space-y-0.5">
                      <li>Verify current &amp; previous readings for this bulk meter.</li>
                      <li>Check all assigned individual sub-meter readings for errors.</li>
                      <li>Look for data entry mistakes or meter rollovers.</li>
                      <li>Correct the readings, then re-run the billing cycle.</li>
                    </ul>
                  </div>
                )}
                {/* ℹ️ Rule of 3 applied to negative consumption */}
                {!billCardDetails.billId && rawDifference < 0 && ruleOfThreeActive && (
                  <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-300 space-y-1">
                    <div className="flex items-center gap-2 text-amber-700 font-semibold text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Rule of 3 Applied — Negative Consumption</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Individual sub-meter total (<span className="font-bold">{totalIndividualUsage.toFixed(2)} m³</span>) exceeds
                      bulk meter reading (<span className="font-bold">{bulkUsage.toFixed(2)} m³</span>).
                      The Rule of 3 (Minimum 3m³) is active — billed as <span className="font-bold">3.00 m³</span>.
                    </p>
                  </div>
                )}
                {/* Difference Usage highlight */}
                <div className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-md border font-semibold",
                  !billCardDetails.billId && rawDifference < 0 && !ruleOfThreeActive
                    ? "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400"
                    : (!billCardDetails.billId && (isMinOfThreeApplied || (rawDifference < 0 && ruleOfThreeActive)))
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                      : "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                )}>
                  <span>Difference Usage</span>
                  <div className="text-right">
                    <div>
                      {billCardDetails.billId
                        ? `${(billCardDetails.differenceUsage ?? 0).toFixed(2)} m³`
                        : `${rawDifference < 0 && !ruleOfThreeActive ? rawDifference.toFixed(2) : (differenceUsage ?? 0).toFixed(2)} m³`}
                    </div>
                    {!billCardDetails.billId && rawDifference < 0 && ruleOfThreeActive && (
                      <div className="text-xs font-normal opacity-70">actual: {rawDifference.toFixed(2)} m³ → billed as 3.00 m³</div>
                    )}
                    {!billCardDetails.billId && isMinOfThreeApplied && rawDifference >= 0 && (
                      <div className="text-xs font-normal opacity-70">actual: {rawDifference.toFixed(2)} m³</div>
                    )}
                  </div>
                </div>
                {/* Fee breakdown rows */}
                <div className="space-y-1 pt-1">
                  {[
                    { label: 'Base Water Charge', value: billCardDetails.baseWaterCharge },
                    { label: 'Maintenance Fee', value: billCardDetails.maintenanceFee },
                    { label: 'Sanitation Fee', value: billCardDetails.sanitationFee },
                    { label: 'Sewerage Fee', value: billCardDetails.sewerageCharge },
                    { label: 'Meter Rent', value: billCardDetails.meterRent },
                    { label: 'VAT (15%)', value: billCardDetails.vatAmount },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-0.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">ETB {(value ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                  {billCardDetails?.additionalFeesCharge && billCardDetails.additionalFeesCharge > 0 && (
                    <div className="mt-1 pt-1 border-t border-dashed">
                      <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Additional Fees</p>
                      {billCardDetails?.additionalFeesBreakdown?.map((fee: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-0.5 pl-2">
                          <span className="text-muted-foreground">{fee.name}</span>
                          <span className="font-medium tabular-nums">ETB {Number(fee.charge).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-0.5 pl-2 font-semibold">
                        <span>Total Additional</span>
                        <span className="tabular-nums">ETB {Number(billCardDetails.additionalFeesCharge).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Totals */}
                <div className="pt-2 mt-1 border-t space-y-1">
                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-semibold">Current Bill</span>
                    <span className="font-bold tabular-nums">ETB {billCardDetails.totalDifferenceBill.toFixed(2)}</span>
                  </div>
                  <div className={cn("flex items-center justify-between py-0.5", displayedPenaltyAmt > 0 ? "text-destructive" : "text-muted-foreground")}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Penalty</span>
                      {isPenaltyOff ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground/70 border border-muted-foreground/20 font-semibold tracking-wide">
                          Off
                        </span>
                      ) : displayedPenaltyAmt === 0 ? (
                        <span className="text-[10px] text-muted-foreground/70">(0.00 ETB)</span>
                      ) : null}
                    </div>
                    <span className="font-semibold tabular-nums">ETB {displayedPenaltyAmt.toFixed(2)}</span>
                  </div>
                  <div className={cn("py-0.5", billCardDetails.outstandingBill > 0 ? "text-destructive" : "text-muted-foreground")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">Outstanding</span>
                        {billCardDetails.outstandingBill > 0 && overdueMonthsCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/25">
                            {overdueMonthsCount} month{overdueMonthsCount !== 1 ? 's' : ''} overdue
                          </span>
                        )}
                      </div>
                      <span className="font-semibold tabular-nums">ETB {billCardDetails.outstandingBill.toFixed(2)}</span>
                    </div>
                    {billCardDetails.outstandingBill > 0 && overdueMonthsCount > 0 && (
                      <p className="text-[10px] text-destructive/70 mt-0.5 text-right">
                        Accumulated unpaid debt from {overdueMonthsCount} previous billing cycle{overdueMonthsCount !== 1 ? 's' : ''}
                      </p>
                    )}
                    {billCardDetails.outstandingBill <= 0 && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5 text-right">No carried-forward debt</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-primary/10 border border-primary/30 mt-1">
                    <span className="font-bold text-primary">Total Amount Payable</span>
                    <span className="font-bold text-primary tabular-nums text-base">ETB {displayedTotalPayable.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {canViewCredit && (
              <BulkMeterCreditCard
                bulkMeterKey={currentBulkMeter.customerKeyNumber}
                initialBalance={meterCreditBalance}
                canManage={canManageCustomers}
                canAdd={canAddCredit}
                canVoid={canVoidCredit}
                bills={billingHistory.map((b) => ({
                  id: b.id,
                  billKey: b.BILLKEY || "",
                  monthYear: b.monthYear,
                  total: Number(b.TOTALBILLAMOUNT || 0),
                }))}
                overpaidBills={billingHistory
                  .filter((b) => {
                    const paid = Number(b.amountPaid ?? 0);
                    const total = Number(b.TOTALBILLAMOUNT || 0);
                    return paid > total;
                  })
                  .sort((a, b) => (a.monthYear < b.monthYear ? 1 : a.monthYear > b.monthYear ? -1 : 0))
                  .map((b) => ({
                    id: b.id,
                    billKey: b.BILLKEY || "",
                    monthYear: b.monthYear,
                    total: Number(b.TOTALBILLAMOUNT || 0),
                    amountPaid: Number(b.amountPaid ?? 0),
                  }))}
                onViewBill={handleOpenBillFromLedger}
              />
            )}

          <Card className="shadow-lg non-printable">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Reading History</CardTitle>
                  <CardDescription>Historical readings logged for this meter.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEditReadings && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditReadingsTargetMonth(null);
                        setIsEditReadingsOpen(!isEditReadingsOpen);
                      }}
                      className={cn(
                        "border-amber-500/40 text-amber-900 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40",
                        isEditReadingsOpen && "bg-amber-100 dark:bg-amber-900/50 border-amber-500 font-bold"
                      )}
                    >
                      <Edit2 className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" /> Edit Readings & Recalculate
                    </Button>
                  )}
                  {canAddReading && (
                    <Button variant="outline" size="sm" onClick={() => setIsAddReadingOpen(true)}>
                      <PlusCircleIcon className="mr-2 h-4 w-4" /> Add Reading
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isEditReadingsOpen && currentBulkMeter && (
                <div className="p-4 border-b border-border bg-amber-50/20 dark:bg-amber-950/10">
                  <EditReadingsRecalculateSection
                    bulkMeter={currentBulkMeter}
                    latestBill={billingHistory.find(b => b.status !== 'Reversed') || billingHistory[0] || null}
                    bills={billingHistory}
                    initialSelectedMonthYear={editReadingsTargetMonth || undefined}
                    onClose={() => {
                      setIsEditReadingsOpen(false);
                      setEditReadingsTargetMonth(null);
                    }}
                    onSaveSuccess={() => {
                      initializeBulkMeters(true);
                      initializeBills(true);
                      initializeCustomers(true);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent("data-refreshed"));
                      }
                    }}
                  />
                </div>
              )}
              {meterReadingHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6 italic">No historical readings found for this meter.</p>
              ) : (
                <>
                  {/* Reading History Table - Desktop */}
                  <div className="overflow-x-auto hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Reading Value</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedReadingHistory.map(reading => (
                          <TableRow key={reading.id}>
                            <TableCell>{formatDateForDisplay(reading.readingDate)}</TableCell>
                            <TableCell className="text-right">{reading.readingValue.toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{reading.notes}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Reading History Cards - Mobile */}
                  <div className="grid grid-cols-1 gap-2 p-4 md:hidden">
                    {paginatedReadingHistory.map(reading => (
                      <div key={reading.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-muted-foreground uppercase">{formatDateForDisplay(reading.readingDate)}</p>
                          <p className="text-sm font-medium">{reading.readingValue.toFixed(2)} m³</p>
                        </div>
                        {reading.notes && <p className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{reading.notes}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
            {meterReadingHistory.length > 0 && (
              <TablePagination
                count={meterReadingHistory.length}
                page={readingHistoryPage}
                rowsPerPage={readingHistoryRowsPerPage}
                onPageChange={setReadingHistoryPage}
                onRowsPerPageChange={(value) => {
                  setReadingHistoryRowsPerPage(value);
                  setReadingHistoryPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
              />
            )}
          </Card>

          <Card className="shadow-lg non-printable">
            <CardHeader><CardTitle className="flex items-center gap-2"><ListCollapse className="h-5 w-5 text-primary" />Billing History</CardTitle><CardDescription>Historical bills generated for this meter.</CardDescription></CardHeader>
            <CardContent className="p-0">
              {billingHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6 italic">No billing history found for this meter.</p>
              ) : (
                <>
                  {/* Billing History Table - Desktop */}
                  <div className="overflow-x-auto hidden xl:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead>Date Billed</TableHead>
                          <TableHead className="text-right">Prev. Read</TableHead>
                          <TableHead className="text-right">Curr. Read</TableHead>
                          <TableHead>Usage (m³)</TableHead>
                          <TableHead className="text-right text-orange-600 font-bold">Diff. Usage</TableHead>
                          <TableHead className="text-right">Debit_30</TableHead>
                          <TableHead className="text-right">Debit_30_60</TableHead>
                          <TableHead className="text-right">Debit_60</TableHead>
                          <TableHead className="text-right">Penalty</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead className="text-right">Current Bill</TableHead>
                          <TableHead className="text-right">Total Payable</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedBillingHistory.map(bill => {
                          const prevReadNum = Number(bill.PREVREAD ?? (bill as any).prev_read ?? (bill as any).prevRead ?? 0);
                          const currReadNum = Number(bill.CURRREAD ?? (bill as any).curr_read ?? (bill as any).currRead ?? 0);
                          const usageForBill = bill.CONS !== null && bill.CONS !== undefined
                            ? Number(bill.CONS)
                            : (currReadNum - prevReadNum);
                          const displayUsage = !isNaN(usageForBill) ? usageForBill.toFixed(2) : "N/A";
                          const diffUsageValue = Number(bill.differenceUsage ?? (bill as any).difference_usage ?? 0);
                          const displayDiffUsage = !isNaN(diffUsageValue) ? diffUsageValue.toFixed(2) : '0.00';

                          const recon = reconstructedHistoryMap.get(bill.id) ?? {
                            d30: Number((bill as any).debit_30 ?? 0),
                            d30_60: Number((bill as any).debit_30_60 ?? 0),
                            d60: Number((bill as any).debit_60 ?? 0),
                            penalty: Number(bill.PENALTYAMT ?? 0),
                            outstanding: Number(bill.OUTSTANDINGAMT ?? 0),
                            currentMonthly: Number(bill.THISMONTHBILLAMT ?? 0),
                            totalPayable: Number(bill.TOTALBILLAMOUNT ?? (Number(bill.OUTSTANDINGAMT ?? 0) + Number(bill.THISMONTHBILLAMT ?? 0) + Number(bill.PENALTYAMT ?? 0))),
                            paymentStatus: bill.paymentStatus || (bill as any).payment_status || 'Unpaid',
                          };

                          const fmt = (val: number) => val > 0.01 ? val.toFixed(2) : '—';
                          const monthYearVal = bill.monthYear || (bill as any).month_year || 'N/A';
                          const dateBilledVal = bill.billPeriodEndDate || (bill as any).bill_period_end_date || (bill as any).dueDate || (bill as any).due_date || bill.createdAt || (bill as any).created_at;
                          const paymentStatusVal = recon.paymentStatus || bill.paymentStatus || (bill as any).payment_status || 'Unpaid';

                          return (
                            <TableRow key={bill.id + (bill.monthYear || (bill as any).month_year || '')}>
                              <TableCell>
                                <div className="font-semibold">{monthYearVal}</div>
                                {bill.BILLKEY && <div className="text-[10px] font-mono text-muted-foreground">{bill.BILLKEY}</div>}
                              </TableCell>
                              <TableCell>{formatDateForDisplay(dateBilledVal)}</TableCell>
                              <TableCell className="text-right">{!isNaN(prevReadNum) ? prevReadNum.toFixed(2) : "0.00"}</TableCell>
                              <TableCell className="text-right">{!isNaN(currReadNum) ? currReadNum.toFixed(2) : "0.00"}</TableCell>
                              <TableCell>{displayUsage}</TableCell>
                              <TableCell className={cn("text-right", diffUsageValue < 0 ? "text-amber-600" : "text-green-600")}>{displayDiffUsage}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{fmt(recon.d30)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{fmt(recon.d30_60)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{fmt(recon.d60)}</TableCell>
                              <TableCell className="text-right text-destructive font-medium">{fmt(recon.penalty)}</TableCell>
                              <TableCell className="text-right font-medium">{recon.outstanding.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-medium">{Math.max(0, recon.currentMonthly).toFixed(2)}</TableCell>
                              <TableCell className={cn("text-right font-bold text-primary")}>{recon.totalPayable.toFixed(2)}</TableCell>
                              <TableCell><Badge variant={paymentStatusVal === 'Paid' ? 'default' : 'destructive'}>{paymentStatusVal}</Badge></TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <span className="sr-only">Open menu</span>
                                      <Menu className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedBillId(bill.id);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}>
                                      <Eye className="mr-2 h-4 w-4 text-primary" />View in Card
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePrintSlip(bill)}><Printer className="mr-2 h-4 w-4" />Print/Export Bill</DropdownMenuItem>
                                    {canEditReadings && (
                                      <DropdownMenuItem onClick={() => {
                                        const m = bill.monthYear || (bill as any).month_year;
                                        setEditReadingsTargetMonth(m);
                                        setIsEditReadingsOpen(true);
                                        window.scrollTo({ top: 400, behavior: 'smooth' });
                                      }}>
                                        <Edit2 className="mr-2 h-4 w-4 text-amber-600" />Edit Readings & Recalculate
                                      </DropdownMenuItem>
                                    )}
                                    {canUpdateBillStatus && (
                                      <DropdownMenuItem onClick={() => handleUpdateBillStatus(bill)}><FileEdit className="mr-2 h-4 w-4" />Edit Status</DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDeleteBillingRecord(bill)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" />Delete Record</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Legend note */}
                  <div className="hidden xl:block mx-4 mb-2 mt-1 p-2 rounded-md bg-muted/30 border border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground italic">
                    <span className="font-semibold not-italic text-foreground/70">📝 Note: </span>
                    Debit_30 = bill 1 month old &nbsp;|&nbsp; Debit_30_60 = bill 2 months old &nbsp;|&nbsp; Debit_60 = bill 3+ months old &nbsp;|&nbsp;
                    Penalty applies to bills 3+ months old only &nbsp;|&nbsp; Outstanding = all unpaid debt + current penalty
                  </div>

                  {/* Billing History Cards - Mobile */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:hidden gap-4 p-4">
                    {paginatedBillingHistory.map(bill => {
                      const recon = reconstructedHistoryMap.get(bill.id) ?? {
                        d30: Number((bill as any).debit_30 ?? 0),
                        d30_60: Number((bill as any).debit_30_60 ?? 0),
                        d60: Number((bill as any).debit_60 ?? 0),
                        penalty: Number(bill.PENALTYAMT ?? 0),
                        outstanding: Number(bill.OUTSTANDINGAMT ?? 0),
                        currentMonthly: Number(bill.THISMONTHBILLAMT ?? 0),
                        totalPayable: Number(bill.TOTALBILLAMOUNT ?? (Number(bill.OUTSTANDINGAMT ?? 0) + Number(bill.THISMONTHBILLAMT ?? 0) + Number(bill.PENALTYAMT ?? 0))),
                        paymentStatus: bill.paymentStatus || (bill as any).payment_status || 'Unpaid',
                      };

                      const fmt = (val: number) => val > 0.01 ? val.toFixed(2) : '—';
                      const monthYearVal = bill.monthYear || (bill as any).month_year || 'N/A';
                      const paymentStatusVal = recon.paymentStatus || bill.paymentStatus || (bill as any).payment_status || 'Unpaid';

                      return (
                        <Card key={bill.id} className="border shadow-sm overflow-hidden bg-slate-50/30">
                          <div className="px-4 py-2 bg-slate-100/50 border-b flex justify-between items-center">
                            <div>
                              <span className="font-bold text-sm">{monthYearVal}</span>
                              {bill.BILLKEY && <span className="block text-[10px] font-mono text-muted-foreground">{bill.BILLKEY}</span>}
                            </div>
                            <Badge variant={paymentStatusVal === 'Paid' ? 'default' : 'destructive'} className="text-[10px] h-4.5 px-1">{paymentStatusVal}</Badge>
                          </div>
                          <CardContent className="p-4 space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div><span className="text-muted-foreground font-semibold uppercase">Debit 30:</span> ETB {fmt(recon.d30)}</div>
                              <div><span className="text-muted-foreground font-semibold uppercase">Debit 30-60:</span> ETB {fmt(recon.d30_60)}</div>
                              <div><span className="text-muted-foreground font-semibold uppercase">Debit 60+:</span> ETB {fmt(recon.d60)}</div>
                              <div><span className="text-muted-foreground font-semibold uppercase">Penalty:</span> ETB {fmt(recon.penalty)}</div>
                              <div><span className="font-semibold uppercase text-foreground/80">Outstanding:</span> ETB {recon.outstanding.toFixed(2)}</div>
                              <div><span className="text-muted-foreground font-semibold uppercase">Current:</span> ETB {Math.max(0, recon.currentMonthly).toFixed(2)}</div>
                              <div className="col-span-2 flex justify-between border-t pt-1 mt-1 font-bold text-primary">
                                <span>Total Payable:</span>
                                <span>ETB {recon.totalPayable.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t mt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] px-2 text-primary border-primary/30"
                                onClick={() => {
                                  setSelectedBillId(bill.id);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                              >
                                <Eye className="h-3 w-3 mr-1" />View
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => handlePrintSlip(bill)}><Printer className="h-3 w-3 mr-1" />Print</Button>
                              {canEditReadings && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] px-2 border-amber-300 text-amber-800 hover:bg-amber-50 dark:text-amber-300"
                                  onClick={() => {
                                    const m = bill.monthYear || (bill as any).month_year;
                                    setEditReadingsTargetMonth(m);
                                    setIsEditReadingsOpen(true);
                                    window.scrollTo({ top: 400, behavior: 'smooth' });
                                  }}
                                >
                                  <Edit2 className="h-3 w-3 mr-1 text-amber-600" />Edit
                                </Button>
                              )}
                              {canUpdateBillStatus && (
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => handleUpdateBillStatus(bill)}><RefreshCcw className="h-3 w-3 mr-1" />Status</Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
            {billingHistory.length > 0 && (
              <TablePagination
                count={billingHistory.length}
                page={billingHistoryPage}
                rowsPerPage={billingHistoryRowsPerPage}
                onPageChange={setBillingHistoryPage}
                onRowsPerPageChange={(value) => {
                  setBillingHistoryRowsPerPage(value);
                  setBillingHistoryPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
              />
            )}
          </Card>

          <Card className="shadow-lg non-printable">
            <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between space-y-0 pb-4 gap-3">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-primary" />
                  Associated Individual Customers
                </CardTitle>
                <CardDescription>
                  List of individual customers connected to this bulk meter ({associatedCustomers.length} found).
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Billing Period Filter */}
                {availableCustomerPeriods.length > 0 && (
                  <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1 bg-muted/30">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Select
                      value={selectedCustomerPeriod}
                      onValueChange={(val) => {
                        setSelectedCustomerPeriod(val);
                        setCustomerPage(0);
                      }}
                    >
                      <SelectTrigger className="w-[150px] h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 p-0 pl-1">
                        <SelectValue placeholder="Select period..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCustomerPeriods.map((p) => (
                          <SelectItem key={p.monthYear} value={p.monthYear}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isLoadingPeriodReadings && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-0.5" />
                    )}
                  </div>
                )}
                {canManageCustomers && (
                  <Button
                    onClick={handleAddCustomerToBulkMeter}
                    size="sm"
                    className="flex items-center gap-1.5 shadow-sm"
                  >
                    <PlusCircleIcon className="h-4 w-4" />
                    <span>Add Customer</span>
                  </Button>
                )}
                {associatedCustomers.length > 0 && (
                  <Button
                    onClick={() => setIsApportionmentDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 border-primary/30 hover:border-primary text-primary hover:bg-primary/5 shadow-sm"
                  >
                    <Scale className="h-4 w-4" />
                    <span>Apportion Difference Bill</span>
                  </Button>
                )}
                {associatedCustomers.length > 0 && (
                  <Button
                    onClick={handleExportToXlsx}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/20"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span>Export to XLSX</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {associatedCustomers.length === 0 ? (
                <div className="text-center text-muted-foreground py-4 italic">No individual customers are currently associated with this bulk meter.</div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="overflow-x-auto hidden lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer Name</TableHead>
                          <TableHead>Cust. Key</TableHead>
                          <TableHead>Meter No.</TableHead>
                          <TableHead>Month</TableHead>
                          <TableHead>Prev. Reading</TableHead>
                          <TableHead>Curr. Reading</TableHead>
                          <TableHead>Usage (m³)</TableHead>
                          <TableHead>Bill (ETB)</TableHead>
                          <TableHead>Pay Status</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedCustomers.map((customer) => {
                          const periodData = customerPeriodReadingsMap.get(customer.customerKeyNumber);
                          const prevRead = periodData?.prevRead ?? (customer.previousReading ?? 0);
                          const currRead = periodData?.currRead ?? (customer.currentReading ?? 0);
                          const usage = periodData?.usage ?? (currRead - prevRead);
                          const billAmt = periodData?.totalBill ?? (customer.calculatedBill ?? 0);
                          const hasData = periodData?.found ?? true;
                          return (
                            <TableRow key={customer.customerKeyNumber}>
                              <TableCell className="font-medium">{customer.name}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{customer.customerKeyNumber}</TableCell>
                              <TableCell>{customer.meterNumber}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-normal text-xs">
                                  {selectedCustomerPeriod || customer.month || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell className={cn(!hasData && "text-muted-foreground italic")}>
                                {prevRead.toFixed(2)}
                                {!hasData && <span className="ml-1 text-[10px] text-muted-foreground">(live)</span>}
                              </TableCell>
                              <TableCell className={cn(!hasData && "text-muted-foreground italic")}>
                                {currRead.toFixed(2)}
                                {!hasData && <span className="ml-1 text-[10px] text-muted-foreground">(live)</span>}
                              </TableCell>
                              <TableCell>{usage.toFixed(2)}</TableCell>
                              <TableCell>{billAmt.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={customer.paymentStatus === 'Paid' ? 'default' : customer.paymentStatus === 'Unpaid' ? 'destructive' : 'secondary'}
                                  className={cn(
                                    customer.paymentStatus === 'Paid' && "bg-green-500 hover:bg-green-600",
                                    customer.paymentStatus === 'Pending' && "bg-yellow-500 hover:bg-yellow-600"
                                  )}
                                >
                                  {customer.paymentStatus === 'Paid' ? <CheckCircle className="mr-1 h-3.5 w-3.5" /> : customer.paymentStatus === 'Unpaid' ? <XCircle className="mr-1 h-3.5 w-3.5" /> : <Clock className="mr-1 h-3.5 w-3.5" />}
                                  {customer.paymentStatus}
                                </Badge>
                              </TableCell>
                              <TableCell><Badge variant={customer.status === 'Active' ? 'default' : 'destructive'}>{customer.status}</Badge></TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <span className="sr-only">Open menu</span>
                                      <Menu className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handleViewCustomerDetails(customer)}><Eye className="mr-2 h-4 w-4" />View Details (Sheet)</DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link href={`/admin/individual-customers/${encodeURIComponent(customer.customerKeyNumber)}`} className="flex items-center cursor-pointer">
                                        <ExternalLink className="mr-2 h-4 w-4" />Open Full Page
                                      </Link>
                                    </DropdownMenuItem>
                                    {canEditCustomer && (
                                      <DropdownMenuItem onClick={() => handleEditCustomer(customer)}><FileEdit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                    )}
                                    {canDeleteCustomer && (
                                      <DropdownMenuItem onClick={() => handleDeleteCustomer(customer)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4 mt-2">
                    {paginatedCustomers.map((customer) => {
                      const periodData = customerPeriodReadingsMap.get(customer.customerKeyNumber);
                      const prevRead = periodData?.prevRead ?? (customer.previousReading ?? 0);
                      const currRead = periodData?.currRead ?? (customer.currentReading ?? 0);
                      const usage = periodData?.usage ?? (currRead - prevRead);
                      const billAmt = periodData?.totalBill ?? (customer.calculatedBill ?? 0);
                      const hasData = periodData?.found ?? true;
                      return (
                        <Card key={customer.customerKeyNumber} className="border shadow-sm">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="font-bold text-base truncate pr-2">{customer.name}</div>
                              <div className="flex shrink-0 gap-1">
                                <Badge variant={customer.status === 'Active' ? 'default' : 'destructive'} className="text-[10px] px-1.5 h-5">{customer.status}</Badge>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-7 w-7 p-0"><Menu className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewCustomerDetails(customer)}><Eye className="mr-2 h-4 w-4" />View Details (Sheet)</DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link href={`/admin/individual-customers/${encodeURIComponent(customer.customerKeyNumber)}`} className="flex items-center cursor-pointer">
                                        <ExternalLink className="mr-2 h-4 w-4" />Open Full Page
                                      </Link>
                                    </DropdownMenuItem>
                                    {canEditCustomer && (
                                      <DropdownMenuItem onClick={() => handleEditCustomer(customer)}><FileEdit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                    )}
                                    {canDeleteCustomer && (
                                      <DropdownMenuItem onClick={() => handleDeleteCustomer(customer)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-y-2 text-xs">
                              <div><span className="text-muted-foreground uppercase font-semibold">Cust. Key:</span> <span className="font-mono">{customer.customerKeyNumber}</span></div>
                              <div><span className="text-muted-foreground uppercase font-semibold">Meter No:</span> {customer.meterNumber}</div>
                              <div>
                                <span className="text-muted-foreground uppercase font-semibold">Month:</span>
                                <Badge variant="outline" className="ml-1 text-[10px] h-4 font-normal">
                                  {selectedCustomerPeriod || customer.month || 'N/A'}
                                </Badge>
                              </div>
                              <div>
                                <span className="text-muted-foreground uppercase font-semibold">Pay Status:</span>
                                <Badge variant={customer.paymentStatus === 'Paid' ? 'default' : 'destructive'} className="ml-1 text-[10px] h-4">
                                  {customer.paymentStatus}
                                </Badge>
                              </div>
                              <div className={cn(!hasData && "text-muted-foreground italic")}>
                                <span className="text-muted-foreground uppercase font-semibold">Prev. Read:</span> {prevRead.toFixed(2)}{!hasData && <span className="text-[10px]"> (live)</span>}
                              </div>
                              <div className={cn(!hasData && "text-muted-foreground italic")}>
                                <span className="text-muted-foreground uppercase font-semibold">Curr. Read:</span> {currRead.toFixed(2)}{!hasData && <span className="text-[10px]"> (live)</span>}
                              </div>
                              <div><span className="text-muted-foreground uppercase font-semibold">Usage:</span> {usage.toFixed(2)} m³</div>
                              <div><span className="text-muted-foreground uppercase font-semibold">Bill:</span> ETB {billAmt.toFixed(2)}</div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
            {associatedCustomers.length > 0 && (
              <TablePagination
                count={associatedCustomers.length}
                page={customerPage}
                rowsPerPage={customerRowsPerPage}
                onPageChange={setCustomerPage}
                onRowsPerPageChange={(value) => {
                  setCustomerRowsPerPage(value);
                  setCustomerPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
              />
            )}
          </Card>
        </>
      )}

      {/* Customer Details Sheet */}
      <IndividualCustomerDetailsSheet
        customer={selectedCustomerForDetails}
        open={isCustomerDetailsOpen}
        onOpenChange={setIsCustomerDetailsOpen}
        onEdit={handleEditCustomer}
        branches={branches}
        bulkMetersList={bulkMeter ? [{ customerKeyNumber: bulkMeter.customerKeyNumber, name: bulkMeter.name }] : []}
        isAdmin={true}
        canEdit={hasPermission(PERMISSIONS.CUSTOMERS_UPDATE)}
      />

      {currentBulkMeter && (<BulkMeterFormDialog open={isBulkMeterFormOpen} onOpenChange={setIsBulkMeterFormOpen} onSubmit={handleSubmitBulkMeterForm} defaultValues={currentBulkMeter} />)}
      {currentBulkMeter && (<AddReadingDialog open={isAddReadingOpen} onOpenChange={setIsAddReadingOpen} onSubmit={handleAddNewReading} meter={currentBulkMeter} />)}
      <ManageAssignedCustomersDialog open={isManageCustomersOpen} onOpenChange={setIsManageCustomersOpen} bulkMeter={bulkMeter} />
      <AlertDialog open={isBulkMeterDeleteDialogOpen} onOpenChange={setIsBulkMeterDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Bulk Meter?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {bulkMeter?.name}. Associated customers will need reassignment.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteBulkMeter}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedCustomer && (<IndividualCustomerFormDialog open={isCustomerFormOpen} onOpenChange={setIsCustomerFormOpen} onSubmit={handleSubmitCustomerForm} defaultValues={selectedCustomer} bulkMeters={[{ customerKeyNumber: currentBulkMeter.customerKeyNumber, name: currentBulkMeter.name }]} />)}
      <AlertDialog open={isCustomerDeleteDialogOpen} onOpenChange={setIsCustomerDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Customer?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {customerToDelete?.name}.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteCustomer}>Delete Customer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBillDeleteDialogOpen} onOpenChange={setIsBillDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the billing record for {billToDelete?.monthYear}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBillToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteBillingRecord} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditBillStatusDialog
        open={isUpdateStatusDialogOpen}
        onOpenChange={(open) => {
          setIsUpdateStatusDialogOpen(open);
          if (!open) setBillToUpdate(null);
        }}
        bill={billToUpdate}
        customerKey={currentBulkMeter.customerKeyNumber}
        onSuccess={handleStatusUpdateSuccess}
      />

      {currentBulkMeter && (
        <DifferenceApportionmentDialog
          open={isApportionmentDialogOpen}
          onOpenChange={setIsApportionmentDialogOpen}
          bulkMeterKey={currentBulkMeter.customerKeyNumber}
          bulkMeterName={currentBulkMeter.name}
          initialMonthYear={selectedCustomerPeriod || currentBulkMeter.month}
          availablePeriods={availableCustomerPeriods}
        />
      )}
    </div>
  );
}
