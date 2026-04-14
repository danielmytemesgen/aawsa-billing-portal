"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Droplets, Edit, Trash2, Menu, User, CheckCircle, XCircle, FileEdit, RefreshCcw, Gauge, Users as UsersIcon, DollarSign, TrendingUp, Clock, MinusCircle, PlusCircle as PlusCircleIcon, Printer, History, AlertTriangle, ListCollapse, Eye, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  getBulkMeters, getCustomers, updateBulkMeter as updateBulkMeterInStore, deleteBulkMeter as deleteBulkMeterFromStore,
  updateCustomer as updateCustomerInStore, deleteCustomer as deleteCustomerFromStore, subscribeToBulkMeters, subscribeToCustomers,
  initializeBulkMeters, initializeCustomers, getBranches, initializeBranches, subscribeToBranches,
  getBulkMeterReadings, initializeBulkMeterReadings, subscribeToBulkMeterReadings,
  addBill, addBulkMeterReading, removeBill, getBulkMeterByCustomerKey, updateExistingBill,
  subscribeToTariffs, initializeTariffs
} from "@/lib/data-store";
import { getBills, initializeBills, subscribeToBills } from "@/lib/data-store";
import type { BulkMeter } from "../bulk-meter-types";
import type { IndividualCustomer, IndividualCustomerStatus } from "../../individual-customers/individual-customer-types";
import type { Branch } from "../../branches/branch-types";
import type { DomainBulkMeterReading, DomainBill } from "@/lib/data-store";
import { type CustomerType, type SewerageConnection, type PaymentStatus, type BillCalculationResult } from "@/lib/billing-calculations";
import { calculateBillAction } from "@/lib/actions";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "../bulk-meter-form-dialog";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "../../individual-customers/individual-customer-form-dialog";
import { AddReadingDialog } from "@/components/billing/add-reading-dialog";
import { cn } from "@/lib/utils";
import { format, parseISO, lastDayOfMonth } from "date-fns";
import { getBillingPeriodStartDate, getBillingPeriodEndDate, calculateDueDate } from "@/lib/billing-config";
import { calculateDebtAging, getMonthlyBillAmt } from "@/lib/billing-utils";

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


const initialMemoizedDetails = {
  bmPreviousReading: 0, bmCurrentReading: 0, bulkUsage: 0,
  totalBulkBillForPeriod: 0, totalPayable: 0, differenceUsage: 0,
  differenceBill: 0, differenceBillBreakdown: {} as BillCalculationResult,
  displayBranchName: "N/A", displayCardLocation: "N/A",
  isMinOfThreeApplied: false,
  rawDifference: 0,
  ruleOfThreeActive: false,
  billCardDetails: {
    prevReading: 0, currReading: 0, usage: 0, baseWaterCharge: 0,
    maintenanceFee: 0, sanitationFee: 0, sewerageCharge: 0, meterRent: 0,
    vatAmount: 0, totalDifferenceBill: 0, differenceUsage: 0,
    penaltyAmt: 0,
    outstandingBill: 0, totalPayable: 0, paymentStatus: 'Unpaid' as PaymentStatus,
    month: 'N/A',
    snapshot_data: null as any,
  },
  totalIndividualUsage: 0,
  snapshot_data: null as any,
};

export default function BulkMeterDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const bulkMeterKey = params?.id ? String(params.id) : "";

  const [bulkMeter, setBulkMeter] = useState<BulkMeter | null>(null);
  const [associatedCustomers, setAssociatedCustomers] = useState<IndividualCustomer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [meterReadingHistory, setMeterReadingHistory] = useState<DomainBulkMeterReading[]>([]);
  const [billingHistory, setBillingHistory] = useState<DomainBill[]>([]);
  const [billForPrintView, setBillForPrintView] = React.useState<DomainBill | null>(null);
  const [currentDateTime, setCurrentDateTime] = React.useState('');

  const [isBulkMeterFormOpen, setIsBulkMeterFormOpen] = React.useState(false);
  const [isBulkMeterDeleteDialogOpen, setIsBulkMeterDeleteDialogOpen] = React.useState(false);

  const [activeTariff, setActiveTariff] = useState<any>(null);

  const [isCustomerFormOpen, setIsCustomerFormOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<IndividualCustomer | null>(null);
  const [customerToDelete, setCustomerToDelete] = React.useState<IndividualCustomer | null>(null);
  const [isCustomerDeleteDialogOpen, setIsCustomerDeleteDialogOpen] = React.useState(false);
  const [isAddReadingOpen, setIsAddReadingOpen] = React.useState(false);

  const [isBillDeleteDialogOpen, setIsBillDeleteDialogOpen] = React.useState(false);
  const [billToDelete, setBillToDelete] = React.useState<DomainBill | null>(null);

  const [isUpdateStatusDialogOpen, setIsUpdateStatusDialogOpen] = React.useState(false);
  const [billToUpdate, setBillToUpdate] = React.useState<DomainBill | null>(null);

  const [showSlip, setShowSlip] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);

  // Pagination states
  const [readingHistoryPage, setReadingHistoryPage] = React.useState(0);
  const [readingHistoryRowsPerPage, setReadingHistoryRowsPerPage] = React.useState(5);
  const [billingHistoryPage, setBillingHistoryPage] = React.useState(0);
  const [billingHistoryRowsPerPage, setBillingHistoryRowsPerPage] = React.useState(10);
  const [customerPage, setCustomerPage] = React.useState(0);
  const [customerRowsPerPage, setCustomerRowsPerPage] = React.useState(10);

  // Tariff version counter — increments when tariffs change so memoized details re-calculate
  const [tariffVersion, setTariffVersion] = React.useState(0);

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
    currentBillForPrintView: DomainBill | null
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
      printBillId: currentBillForPrintView?.id
    });

    if (lastCalculationInputs.current === currentInputs) {
      return;
    }
    lastCalculationInputs.current = currentInputs;

    const { data: billResult1 } = await calculateBillAction(Math.max(0, bulkUsage), effectiveBulkMeterCustomerType, effectiveBulkMeterSewerageConnection, currentBulkMeter.meterSize, billingMonth);
    const { totalBill: totalBulkBillForPeriod } = billResult1 || { totalBill: 0 };

    const outStandingBillValue = currentBulkMeter.outStandingbill ?? 0;

    const totalIndividualUsage = currentAssociatedCustomers.reduce((sum, cust) => sum + ((cust.currentReading ?? 0) - (cust.previousReading ?? 0)), 0);

    const rawDifference = bulkUsage - totalIndividualUsage;

    // Check if Rule of 3 is active for this tariff
    const { getTariff } = await import('@/lib/data-store');
    const activeTariffForRuleCheck = await getTariff(effectiveBulkMeterCustomerType, billingMonth);
    const ruleOfThreeActive = activeTariffForRuleCheck?.use_rule_of_three !== false;

    // When Rule of 3 is ON and difference is negative, bill as 3m³ instead of blocking
    const effectiveConsForDiff = (ruleOfThreeActive && rawDifference < 0) ? 3 : rawDifference;

    const { data: differenceFullOrNull } = await calculateBillAction(
      effectiveConsForDiff,
      effectiveBulkMeterCustomerType,
      effectiveBulkMeterSewerageConnection,
      currentBulkMeter.meterSize,
      billingMonth
    );
    const differenceFull = differenceFullOrNull || { totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0, sanitationFee: 0, sewerageCharge: 0, meterRent: 0, vatAmount: 0, additionalFeesCharge: 0, effectiveUsage: effectiveConsForDiff } as BillCalculationResult;
    const differenceBill = differenceFull.totalBill;
    const differenceBillBreakdown = differenceFull;
    const differenceUsage = differenceFull.effectiveUsage;
    const isMinOfThreeApplied = differenceUsage !== rawDifference;

    const totalPayable = differenceBill + outStandingBillValue;
    const paymentStatus: PaymentStatus = totalPayable > 0.01 ? 'Unpaid' : 'Paid';

    const displayBranchName = currentBulkMeter.branchId ? (currentBranches.find(b => b.id === currentBulkMeter.branchId)?.name ?? currentBulkMeter.location ?? "N/A") : (currentBulkMeter.location ?? "N/A");

    const billToRender = currentBillForPrintView;

    let finalBillCardDetails;

    if (billToRender) {
      // Dynamic Outstanding Reconstruction for the selected bill
      const billIndex = currentBillingHistory.findIndex(b => b.id === billToRender.id);
      const getUnpaidIncrement = (b: any) => {
        if (b.paymentStatus === 'Paid') return 0;
        const monthlyPortion = (b.THISMONTHBILLAMT !== null && b.THISMONTHBILLAMT !== undefined)
          ? Number(b.THISMONTHBILLAMT)
          : (Number(b.TOTALBILLAMOUNT) - Number(b.OUTSTANDINGAMT ?? 0) - Number(b.PENALTYAMT ?? 0));
        
        const penaltyPortion = Number(b.PENALTYAMT || 0);
        const totalThisMonth = monthlyPortion + penaltyPortion;
        
        const paidTowardsThisMonth = Math.max(0, Number(b.amountPaid || 0) - Number(b.OUTSTANDINGAMT ?? 0));
        return Math.max(0, totalThisMonth - paidTowardsThisMonth);
      };

      let reconstructedOutstanding = 0;

      if (billToRender.OUTSTANDINGAMT !== null && billToRender.OUTSTANDINGAMT !== undefined) {
        reconstructedOutstanding = Number(billToRender.OUTSTANDINGAMT);
      } else if (billIndex !== -1 && billIndex < currentBillingHistory.length - 1) {
        for (let j = billIndex + 1; j < currentBillingHistory.length; j++) {
          reconstructedOutstanding += getUnpaidIncrement(currentBillingHistory[j]);
        }
        const oldestIndex = currentBillingHistory.length - 1;
        reconstructedOutstanding += currentBillingHistory[oldestIndex].balanceCarriedForward ?? 0;
      } else if (billIndex === currentBillingHistory.length - 1) {
        reconstructedOutstanding = billToRender.balanceCarriedForward ?? 0;
      }

      const snapshot = billToRender.snapshot_data;
      const chargeGroupToUse = snapshot?.chargeGroup || currentBulkMeter.chargeGroup || "Non-domestic";
      const sewerageToUse = snapshot?.sewerageConnection || currentBulkMeter.sewerageConnection || "No";

      const { data: historicalBillDetailsOrNull } = await calculateBillAction(
        billToRender.differenceUsage ?? 0,
        chargeGroupToUse as CustomerType,
        sewerageToUse as SewerageConnection,
        currentBulkMeter.meterSize,
        billToRender.monthYear
      );
      const historicalBillDetails = historicalBillDetailsOrNull || { totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0, sanitationFee: 0, sewerageCharge: 0, meterRent: 0, vatAmount: 0, additionalFeesCharge: 0, effectiveUsage: billToRender.differenceUsage ?? 0 } as BillCalculationResult;

      finalBillCardDetails = {
        prevReading: billToRender.PREVREAD,
        currReading: billToRender.CURRREAD,
        usage: billToRender.CONS ?? 0,
        baseWaterCharge: historicalBillDetails.baseWaterCharge,
        maintenanceFee: historicalBillDetails.maintenanceFee,
        sanitationFee: historicalBillDetails.sanitationFee,
        sewerageCharge: historicalBillDetails.sewerageCharge,
        meterRent: historicalBillDetails.meterRent,
        vatAmount: historicalBillDetails.vatAmount,
        totalDifferenceBill: getMonthlyBillAmt(billToRender),
        differenceUsage: billToRender.differenceUsage ?? 0,
        penaltyAmt: Number(billToRender.PENALTYAMT || 0),
        outstandingBill: billToRender.OUTSTANDINGAMT ?? reconstructedOutstanding,
        totalPayable: (billToRender.OUTSTANDINGAMT ?? reconstructedOutstanding) + getMonthlyBillAmt(billToRender) + Number(billToRender.PENALTYAMT || 0),
        paymentStatus: (billToRender.paymentStatus as PaymentStatus) || 'Unpaid',
        month: billToRender.monthYear,
        snapshot_data: snapshot,
      };
    } else {
      // Use the bulk meter's current balance as the source of truth for the live dashboard
      const currentReconstructedOutstanding = Number(currentBulkMeter.outStandingbill || 0);

      // Calculate potential live penalty using the shared utility (same logic as server)
      const { getTariff } = await import('@/lib/data-store');
      const activeTariff = await getTariff(effectiveBulkMeterCustomerType, billingMonth);

      const { penaltyAmt: livePenaltyAmt } = calculateDebtAging(
        currentReconstructedOutstanding,
        currentBillingHistory,
        activeTariff ?? undefined,
        billingMonth
      );

      finalBillCardDetails = {
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
        month: currentBulkMeter.month || 'N/A'
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
      initializeBulkMeters(true), initializeCustomers(true), initializeBranches(true), initializeBulkMeterReadings(true), initializeBills(true), initializeTariffs(true)
    ]).then(async () => {
      if (!isMounted) return;

      // Fetch live data for this specific meter to ensure Outstanding Bill is fresh
      const { syncBulkMeterLive } = await import("@/lib/data-store");
      await syncBulkMeterLive(bulkMeterKey);

      const currentGlobalMeters = getBulkMeters();
      const currentGlobalCustomers = getCustomers();
      const currentGlobalBranches = getBranches();
      setBranches(currentGlobalBranches);

      const foundBM = currentGlobalMeters.find(bm => bm.customerKeyNumber === bulkMeterKey);

      if (foundBM) {
        setBulkMeter(foundBM);
        setAssociatedCustomers(currentGlobalCustomers.filter(c => c.assignedBulkMeterId === bulkMeterKey));
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
          setBillingHistory(getBills().filter(b => b.CUSTOMERKEY === foundBM.customerKeyNumber).sort((a, b) => {
            const dateA = new Date(a.billPeriodEndDate || 0).getTime();
            const dateB = new Date(b.billPeriodEndDate || 0).getTime();
            if (dateB !== dateA) {
              return dateB - dateA;
            }
            const creationA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const creationB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
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
        setAssociatedCustomers(currentGlobalCustomers.filter(c => c.assignedBulkMeterId === bulkMeterKey));
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

          setBillingHistory(getBills().filter(b => b.CUSTOMERKEY === foundBM.customerKeyNumber).sort((a, b) => {
            const dateA = new Date(a.billPeriodEndDate || 0).getTime();
            const dateB = new Date(b.billPeriodEndDate || 0).getTime();
            if (dateB !== dateA) {
              return dateB - dateA;
            }
            const creationA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const creationB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return creationB - creationA;
          }));
      } else if (bulkMeter) {
        toast({ title: "Bulk Meter Update", description: "The bulk meter being viewed may have been deleted or is no longer accessible.", variant: "destructive" });
        setBulkMeter(null);
      }
    };

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
      unsubBM();
      unsubCust();
      unsubBranches();
      unsubMeterReadings();
      unsubBills();
      unsubTariffs();
    };
  }, [bulkMeterKey, router, toast]);

  // Poll tariffs every 15 seconds to detect Rule of 3 toggle changes from settings page
  useEffect(() => {
    const interval = setInterval(async () => {
      await initializeTariffs(true); // force re-fetch from server
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    calculateMemoizedDetails(bulkMeter, associatedCustomers, branches, billingHistory, billForPrintView);
  }, [bulkMeter, associatedCustomers, branches, billingHistory, billForPrintView, calculateMemoizedDetails, tariffVersion]);

  // GLOBAL BILLING HISTORY RECONSTRUCTION (incremental from oldest to newest)
  const reconstructedHistoryMap = React.useMemo(() => {
    if (!billingHistory.length || !activeTariff) return new Map();

    const results = new Map();
    let carriedForwardUnpaid = 0; // The core debt base (Arrears from previous month)

    // Process from OLDEST to NEWEST
    const historyOldestFirst = [...billingHistory].sort((a, b) => {
      const dateA = new Date(a.billPeriodEndDate || 0).getTime();
      const dateB = new Date(b.billPeriodEndDate || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cA - cB;
    });

    // Tracking aging buckets (unpaid monthly charges)
    let d30_bucket = 0;
    let d30_60_bucket = 0;
    let d60_bucket = 0;
    let billIndexCounter = 0;

    for (const bill of historyOldestFirst) {
      // SKIP or VOID records that are marked as Deleted or Void
      const isVoided = bill.status === 'Deleted' || bill.status === 'Void';

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

      if (maxAge >= threshold) {
          const applicableTier = [...tieredRates].sort((a, b) => b.month - a.month).find(t => maxAge >= t.month);
          const totalRate = bankRate + Number(applicableTier?.rate || 0);
          penalty = arrearsSum * totalRate;
      }
      
      // 3. Current Month Monthly Part (0 if voided)
      const currentMonthlyCharge = isVoided ? 0 : getMonthlyBillAmt(bill);
      
      // 4. Totals
      const outstandingWithPenalty = arrearsSum + penalty;
      const totalPayable = outstandingWithPenalty + Math.max(0, currentMonthlyCharge);

      // Save results
      results.set(bill.id, {
        d30: d30_bucket,
        d30_60: d30_60_bucket,
        d60: d60_bucket + legacyDebt,
        penalty,
        outstanding: outstandingWithPenalty,
        currentMonthly: currentMonthlyCharge,
        totalPayable
      });

      // 5. Update Carried Forward for nextrow
      // If voided, we assume no payment was possible/recorded against THIS specific record
      const amtPaid = isVoided ? 0 : Number(bill.amountPaid || 0);
      carriedForwardUnpaid = Math.max(0, totalPayable - amtPaid);

      // 6. Update Aging Buckets for next cycle
      let remainingPayment = amtPaid;
      
      const totalD60AndLegacy = d60_bucket + legacyDebt;
      const paidAgainstOldest = Math.min(remainingPayment, totalD60AndLegacy);
      const remaining_d60_plus_legacy = Math.max(0, totalD60AndLegacy - paidAgainstOldest);
      remainingPayment -= paidAgainstOldest;

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
  }, [billingHistory, activeTariff]);

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

  const handleEditBulkMeter = () => setIsBulkMeterFormOpen(true);
  const handleDeleteBulkMeter = () => setIsBulkMeterDeleteDialogOpen(true);
  const confirmDeleteBulkMeter = async () => {
    if (bulkMeter) {
      await deleteBulkMeterFromStore(bulkMeter.customerKeyNumber);
      toast({ title: "Bulk Meter Deleted", description: `${bulkMeter.name} has been removed.` });
      router.push("/admin/bulk-meters");
    }
    setIsBulkMeterDeleteDialogOpen(false);
  };

  const handleSubmitBulkMeterForm = async (data: BulkMeterFormValues) => {
    if (bulkMeter) {
      await updateBulkMeterInStore(bulkMeter.customerKeyNumber, data);
      toast({ title: "Bulk Meter Updated", description: `${data.name} has been updated.` });
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
    setSelectedCustomer(customer);
    setIsCustomerFormOpen(true);
  };
  const handleDeleteCustomer = (customer: IndividualCustomer) => {
    setCustomerToDelete(customer);
    setIsCustomerDeleteDialogOpen(true);
  };
  const confirmDeleteCustomer = async () => {
    if (customerToDelete) {
      await deleteCustomerFromStore(customerToDelete.customerKeyNumber);
      toast({ title: "Customer Deleted", description: `${customerToDelete.name} has been removed.` });
    }
    setCustomerToDelete(null);
    setIsCustomerDeleteDialogOpen(false);
  };

  const handleSubmitCustomerForm = async (data: IndividualCustomerFormValues) => {
    if (selectedCustomer) {
      const updatedCustomerData: Partial<Omit<IndividualCustomer, 'customerKeyNumber'>> = {
        ...data, ordinal: Number(data.ordinal), meterSize: Number(data.meterSize),
        previousReading: Number(data.previousReading), currentReading: Number(data.currentReading),
        status: data.status as IndividualCustomerStatus, paymentStatus: data.paymentStatus as PaymentStatus,
        customerType: data.customerType as CustomerType, sewerageConnection: data.sewerageConnection as SewerageConnection,
        assignedBulkMeterId: data.assignedBulkMeterId || undefined,
      };
      await updateCustomerInStore(selectedCustomer.customerKeyNumber, updatedCustomerData);
      toast({ title: "Customer Updated", description: `${data.name} has been updated.` });
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
          TOTALBILLAMOUNT: recon.totalPayable
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
            TOTALBILLAMOUNT: recon.totalPayable
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
      await removeBill(billToDelete.id);
      toast({ title: "Billing Record Deleted", description: `The bill for ${billToDelete.monthYear} has been removed.` });
      setBillToDelete(null);
    }
    setIsBillDeleteDialogOpen(false);
  };

  const handleUpdateBillStatus = (bill: DomainBill) => {
    setBillToUpdate(bill);
    setIsUpdateStatusDialogOpen(true);
  };

  const confirmUpdateBillStatus = async () => {
    if (billToUpdate && bulkMeter) {
      const newStatus = billToUpdate.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid';
      const result = await updateExistingBill(billToUpdate.id, { paymentStatus: newStatus });
      if (result.success) {
        toast({ title: "Payment Status Updated", description: `The bill for ${billToUpdate.monthYear} has been marked as ${newStatus}.` });

        // Update the bulk meter's payment status
        await updateBulkMeterInStore(bulkMeter.customerKeyNumber, { paymentStatus: newStatus });

      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.message });
      }
      setBillToUpdate(null);
    }
    setIsUpdateStatusDialogOpen(false);
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
                    <Image src="https://veiethiopia.com/photo/partner/par2.png" alt="AAWSA Logo" width={22} height={14} className="flex-shrink-0" />
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
                      <tr><td>Number of Assigned Individual Customers:</td><td>{snapshot_data?.individualCustomerCount || associatedCustomers.length}</td></tr>
                      <tr><td>Previous and current reading:</td><td>{billCardDetails.prevReading.toFixed(2)} / {billCardDetails.currReading.toFixed(2)} m³</td></tr>
                      <tr><td>Bulk usage:</td><td>{billCardDetails.usage.toFixed(2)} m³</td></tr>
                      <tr><td>Total Individual Usage:</td><td>{(snapshot_data?.totalIndividualUsage ?? totalIndividualUsage).toFixed(2)} m³</td></tr>
                      <tr><td>Difference usage:</td><td>{billCardDetails.differenceUsage.toFixed(2)} m³</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="print-section">
                  <div className="print-banner">CHARGES BREAKDOWN</div>
                  <table className="print-table">
                    <tbody>
                      <tr>
                        <td>Base Water Charge (Rate/m³):</td>
                        <td>ETB {billCardDetails.baseWaterCharge.toFixed(2)}</td>
                      </tr>
                      <tr><td>Maintenance Fee:</td><td>ETB {billCardDetails.maintenanceFee.toFixed(2)}</td></tr>
                      <tr><td>Sanitation Fee:</td><td>ETB {billCardDetails.sanitationFee.toFixed(2)}</td></tr>
                      <tr><td>Meter Rent:</td><td>ETB {billCardDetails.meterRent.toFixed(2)}</td></tr>
                      <tr><td>Sewerage Fee:</td><td>ETB {billCardDetails.sewerageCharge.toFixed(2)}</td></tr>
                      <tr><td>VAT (15%):</td><td>ETB {billCardDetails.vatAmount.toFixed(2)}</td></tr>
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
                      <tr className="print-table-total"><td>Current Bill (ETB)</td><td>ETB {billCardDetails.totalDifferenceBill.toFixed(2)}</td></tr>
                      <tr><td>Penalty (ETB):</td><td>ETB {billCardDetails.penaltyAmt.toFixed(2)}</td></tr>
                      <tr><td>Outstanding (ETB):</td><td>ETB {billCardDetails.outstandingBill.toFixed(2)}</td></tr>
                      <tr className="print-table-total" style={{ fontSize: '10pt' }}>
                        <td>Total Amount Payable:</td>
                        <td>ETB {billCardDetails.totalPayable.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-end mt-1 px-1">
                  <div className="space-y-0 text-[9px] font-medium">
                    <div>Paid/Unpaid: {billCardDetails.paymentStatus}</div>
                    <div>Month: {billCardDetails.month}</div>
                  </div>
                  <div className="print-status-box scale-[0.6] origin-bottom-right">
                    {billCardDetails.paymentStatus}
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
                    <DropdownMenuItem onClick={handleDeleteBulkMeter} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete Bulk Meter</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Difference Billing Calculation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {/* ⚠️ Negative Consumption Warning — shown when sub-meter total exceeds bulk meter reading AND Rule of 3 is OFF */}
                {rawDifference < 0 && !ruleOfThreeActive && (
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
                {rawDifference < 0 && ruleOfThreeActive && (
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
                  rawDifference < 0 && !ruleOfThreeActive
                    ? "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400"
                    : isMinOfThreeApplied || (rawDifference < 0 && ruleOfThreeActive)
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                      : "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                )}>
                  <span>Difference Usage</span>
                  <div className="text-right">
                    <div>{rawDifference < 0 && !ruleOfThreeActive ? rawDifference.toFixed(2) : differenceUsage?.toFixed(2)} m³</div>
                    {rawDifference < 0 && ruleOfThreeActive && (
                      <div className="text-xs font-normal opacity-70">actual: {rawDifference.toFixed(2)} m³ → billed as 3.00 m³</div>
                    )}
                    {isMinOfThreeApplied && rawDifference >= 0 && (
                      <div className="text-xs font-normal opacity-70">actual: {rawDifference.toFixed(2)} m³</div>
                    )}
                  </div>
                </div>
                {/* Fee breakdown rows */}
                <div className="space-y-1 pt-1">
                  {[
                    { label: 'Base Water Charge', value: differenceBillBreakdown?.baseWaterCharge },
                    { label: 'Maintenance Fee', value: differenceBillBreakdown?.maintenanceFee },
                    { label: 'Sanitation Fee', value: differenceBillBreakdown?.sanitationFee },
                    { label: 'Sewerage Fee', value: differenceBillBreakdown?.sewerageCharge },
                    { label: 'Meter Rent', value: differenceBillBreakdown?.meterRent },
                    { label: 'VAT (15%)', value: differenceBillBreakdown?.vatAmount },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-0.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">ETB {(value ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                  {differenceBillBreakdown?.additionalFeesCharge && differenceBillBreakdown.additionalFeesCharge > 0 && (
                    <div className="mt-1 pt-1 border-t border-dashed">
                      <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Additional Fees</p>
                      {differenceBillBreakdown?.additionalFeesBreakdown?.map((fee, idx) => (
                        <div key={idx} className="flex items-center justify-between py-0.5 pl-2">
                          <span className="text-muted-foreground">{fee.name}</span>
                          <span className="font-medium tabular-nums">ETB {fee.charge.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-0.5 pl-2 font-semibold">
                        <span>Total Additional</span>
                        <span className="tabular-nums">ETB {differenceBillBreakdown.additionalFeesCharge.toFixed(2)}</span>
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
                  <div className="flex items-center justify-between py-0.5 text-destructive">
                    <span className="font-medium">Penalty</span>
                    <span className="font-semibold tabular-nums">ETB {billCardDetails.penaltyAmt.toFixed(2)}</span>
                  </div>
                  <div className={cn("flex items-center justify-between py-0.5", billCardDetails.outstandingBill > 0 ? "text-destructive" : "text-muted-foreground")}>
                    <span className="font-medium">Outstanding</span>
                    <span className="font-semibold tabular-nums">ETB {billCardDetails.outstandingBill.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-primary/10 border border-primary/30 mt-1">
                    <span className="font-bold text-primary">Total Amount Payable</span>
                    <span className="font-bold text-primary tabular-nums text-base">ETB {billCardDetails.totalPayable.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg non-printable">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Reading History</CardTitle>
                  <CardDescription>Historical readings logged for this meter.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsAddReadingOpen(true)}>
                  <PlusCircleIcon className="mr-2 h-4 w-4" /> Add Reading
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
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
                          const recon = reconstructedHistoryMap.get(bill.id);
                          const usageForBill = bill.CONS ?? (bill.CURRREAD - bill.PREVREAD);
                          const displayUsage = !isNaN(usageForBill) ? usageForBill.toFixed(2) : "N/A";
                          const diffUsageValue = Number(bill.differenceUsage ?? 0);
                          const displayDiffUsage = !isNaN(diffUsageValue) ? diffUsageValue.toFixed(2) : 'N/A';

                          if (!recon) return null;

                          const fmt = (val: number) => val > 0.01 ? val.toFixed(2) : '—';

                          return (
                            <TableRow key={bill.id + bill.monthYear}>
                              <TableCell>{bill.monthYear}</TableCell>
                              <TableCell>{formatDateForDisplay(bill.billPeriodEndDate)}</TableCell>
                              <TableCell className="text-right">{bill.PREVREAD.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{bill.CURRREAD.toFixed(2)}</TableCell>
                              <TableCell>{displayUsage}</TableCell>
                              <TableCell className={cn("text-right", diffUsageValue < 0 ? "text-amber-600" : "text-green-600")}>{displayDiffUsage}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{fmt(recon.d30)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{fmt(recon.d30_60)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{fmt(recon.d60)}</TableCell>
                              <TableCell className="text-right text-destructive font-medium">{fmt(recon.penalty)}</TableCell>
                              <TableCell className="text-right font-medium">{recon.outstanding.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-medium">{Math.max(0, recon.currentMonthly).toFixed(2)}</TableCell>
                              <TableCell className={cn("text-right font-bold text-primary")}>{recon.totalPayable.toFixed(2)}</TableCell>
                              <TableCell><Badge variant={bill.paymentStatus === 'Paid' ? 'default' : 'destructive'}>{bill.paymentStatus}</Badge></TableCell>
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
                                    <DropdownMenuItem onClick={() => handlePrintSlip(bill)}><Printer className="mr-2 h-4 w-4" />Print/Export Bill</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleUpdateBillStatus(bill)}><FileEdit className="mr-2 h-4 w-4" />Edit Status</DropdownMenuItem>
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
                      const recon = reconstructedHistoryMap.get(bill.id);
                      if (!recon) return null;

                      const fmt = (val: number) => val > 0.01 ? val.toFixed(2) : '—';

                      return (
                        <Card key={bill.id} className="border shadow-sm overflow-hidden bg-slate-50/30">
                          <div className="px-4 py-2 bg-slate-100/50 border-b flex justify-between items-center">
                            <span className="font-bold text-sm">{bill.monthYear}</span>
                            <Badge variant={bill.paymentStatus === 'Paid' ? 'default' : 'destructive'} className="text-[10px] h-4.5 px-1">{bill.paymentStatus}</Badge>
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
                              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => handlePrintSlip(bill)}><Printer className="h-3 w-3 mr-1" />Print</Button>
                              <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => handleUpdateBillStatus(bill)}><RefreshCcw className="h-3 w-3 mr-1" />Status</Button>
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
            <CardHeader><CardTitle className="flex items-center gap-2"><UsersIcon className="h-5 w-5 text-primary" />Associated Individual Customers</CardTitle><CardDescription>List of individual customers connected to this bulk meter ({associatedCustomers.length} found).</CardDescription></CardHeader>
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
                          <TableHead>Meter No.</TableHead>
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
                          const usage = customer.currentReading - customer.previousReading;
                          return (
                            <TableRow key={customer.customerKeyNumber}>
                              <TableCell className="font-medium">{customer.name}</TableCell>
                              <TableCell>{customer.meterNumber}</TableCell>
                              <TableCell>{customer.previousReading.toFixed(2)}</TableCell>
                              <TableCell>{customer.currentReading.toFixed(2)}</TableCell>
                              <TableCell>{usage.toFixed(2)}</TableCell>
                              <TableCell>{customer.calculatedBill.toFixed(2)}</TableCell>
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
                                    <DropdownMenuItem onClick={() => handleEditCustomer(customer)}><FileEdit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteCustomer(customer)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
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
                      const usage = customer.currentReading - customer.previousReading;
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
                                    <DropdownMenuItem onClick={() => handleEditCustomer(customer)}><FileEdit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteCustomer(customer)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-y-2 text-xs">
                              <div><span className="text-muted-foreground uppercase font-semibold">Meter No:</span> {customer.meterNumber}</div>
                              <div>
                                <span className="text-muted-foreground uppercase font-semibold">Pay Status:</span>
                                <Badge variant={customer.paymentStatus === 'Paid' ? 'default' : 'destructive'} className="ml-1 text-[10px] h-4">
                                  {customer.paymentStatus}
                                </Badge>
                              </div>
                              <div><span className="text-muted-foreground uppercase font-semibold">Usage:</span> {usage.toFixed(2)} m³</div>
                              <div><span className="text-muted-foreground uppercase font-semibold">Bill:</span> ETB {customer.calculatedBill.toFixed(2)}</div>
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

      {currentBulkMeter && (<BulkMeterFormDialog open={isBulkMeterFormOpen} onOpenChange={setIsBulkMeterFormOpen} onSubmit={handleSubmitBulkMeterForm} defaultValues={currentBulkMeter} />)}
      {currentBulkMeter && (<AddReadingDialog open={isAddReadingOpen} onOpenChange={setIsAddReadingOpen} onSubmit={handleAddNewReading} meter={currentBulkMeter} />)}
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

      <AlertDialog open={isUpdateStatusDialogOpen} onOpenChange={setIsUpdateStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark the bill for {billToUpdate?.monthYear} as {billToUpdate?.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid'}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBillToUpdate(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUpdateBillStatus}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}