

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Droplets, Edit, Trash2, Menu, User, CheckCircle, XCircle, FileEdit, RefreshCcw, Gauge, Users as UsersIcon, DollarSign, TrendingUp, Clock, AlertTriangle, MinusCircle, PlusCircle as PlusCircleIcon, Printer, History, ListCollapse, Eye, MapPin } from "lucide-react";
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
  initializeBulkMeters, initializeCustomers, getBulkMeterReadings, initializeBulkMeterReadings, subscribeToBulkMeterReadings,
  addBill, addBulkMeterReading, removeBill,
  getBranches, initializeBranches, subscribeToBranches
} from "@/lib/data-store";
import { getBills, initializeBills, subscribeToBills } from "@/lib/data-store";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { IndividualCustomer, IndividualCustomerStatus } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { DomainBulkMeterReading, DomainBill } from "@/lib/data-store";
import { type CustomerType, type SewerageConnection, type PaymentStatus, type BillCalculationResult } from "@/lib/billing-calculations";
import { calculateBillAction, closeBillingCycleAction } from "@/lib/actions";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-form-dialog";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "@/app/(dashboard)/admin/individual-customers/individual-customer-form-dialog";
import { AddReadingDialog } from "@/components/billing/add-reading-dialog";
import { cn } from "@/lib/utils";
import { format, parseISO, lastDayOfMonth } from "date-fns";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { TablePagination } from "@/components/ui/table-pagination";
import { Separator } from "@/components/ui/separator";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";
import { getBillingPeriodStartDate, getBillingPeriodEndDate, calculateDueDate } from "@/lib/billing-config";
import { calculateDebtAging, getMonthlyBillAmt } from "@/lib/billing-utils";

interface UserAuth {
  id?: string;
  email: string;
  role: "admin" | "staff" | "reader";
  branchName?: string;
  branchId?: string;
}

const initialMemoizedDetails = {
  bmPreviousReading: 0, bmCurrentReading: 0, bulkUsage: 0,
  totalBulkBillForPeriod: 0, totalPayable: 0, differenceUsage: 0,
  differenceBill: 0, differenceBillBreakdown: {} as BillCalculationResult,
  displayBranchName: "N/A", displayCardLocation: "N/A",
  isMinOfThreeApplied: false,
  rawDifference: 0,
  billCardDetails: {
    prevReading: 0, currReading: 0, usage: 0, baseWaterCharge: 0,
    maintenanceFee: 0, sanitationFee: 0, sewerageCharge: 0, meterRent: 0,
    vatAmount: 0, totalDifferenceBill: 0, differenceUsage: 0,
    penaltyAmt: 0,
    outstandingBill: 0, totalPayable: 0, paymentStatus: 'Unpaid' as PaymentStatus,
    month: 'N/A',
  },
  totalIndividualUsage: 0,
};

export default function StaffBulkMeterDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const bulkMeterKey = params?.id ? String(params.id) : "";

  const [bulkMeter, setBulkMeter] = useState<BulkMeter | null>(null);
  const [associatedCustomers, setAssociatedCustomers] = useState<IndividualCustomer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [staffBranchId, setStaffBranchId] = React.useState<string | undefined>(undefined);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [meterReadingHistory, setMeterReadingHistory] = useState<DomainBulkMeterReading[]>([]);
  const [billingHistory, setBillingHistory] = useState<DomainBill[]>([]);
  const [billForPrintView, setBillForPrintView] = React.useState<DomainBill | null>(null);
  const [currentDateTime, setCurrentDateTime] = React.useState('');

  const [isBulkMeterFormOpen, setIsBulkMeterFormOpen] = React.useState(false);
  const [isBulkMeterDeleteDialogOpen, setIsBulkMeterDeleteDialogOpen] = React.useState(false);

  const [isCustomerFormOpen, setIsCustomerFormOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<IndividualCustomer | null>(null);
  const [customerToDelete, setCustomerToDelete] = React.useState<IndividualCustomer | null>(null);
  const [isCustomerDeleteDialogOpen, setIsCustomerDeleteDialogOpen] = React.useState(false);
  const [isAddReadingOpen, setIsAddReadingOpen] = React.useState(false);

  const [branchBulkMetersForCustomerForm, setBranchBulkMetersForCustomerForm] = useState<{ customerKeyNumber: string, name: string }[]>([]);

  const [isBillDeleteDialogOpen, setIsBillDeleteDialogOpen] = React.useState(false);
  const [billToDelete, setBillToDelete] = React.useState<DomainBill | null>(null);

  const [activeTariff, setActiveTariff] = useState<any>(null);

  const [showSlip, setShowSlip] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  // Pagination states
  const [readingHistoryPage, setReadingHistoryPage] = React.useState(0);
  const [readingHistoryRowsPerPage, setReadingHistoryRowsPerPage] = React.useState(5);
  const [billingHistoryPage, setBillingHistoryPage] = React.useState(0);
  const [billingHistoryRowsPerPage, setBillingHistoryRowsPerPage] = React.useState(10);
  const [customerPage, setCustomerPage] = React.useState(0);
  const [customerRowsPerPage, setCustomerRowsPerPage] = React.useState(10);

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

    // Apply minimum-of-3 rule: if difference is < 3 (including negative), bill for at least 3 m³
    let differenceUsage = rawDifference;
    let isMinOfThreeApplied = false;
    if (differenceUsage < 3) {
      differenceUsage = 3;
      isMinOfThreeApplied = true;
    }

    // Only pass sewerageUsage override when: sewerage connected AND bulk usage itself was low (0-2)
    // This preserves accurate sewerage charge for normal-range difference usage
    let sewerageUsage: number | undefined = undefined;
    if (
      effectiveBulkMeterSewerageConnection === 'Yes' &&
      isMinOfThreeApplied &&
      bulkUsage >= 0 && bulkUsage <= 2
    ) {
      sewerageUsage = bulkUsage;
    }

    const { data: differenceFullOrNull } = await calculateBillAction(differenceUsage, effectiveBulkMeterCustomerType, effectiveBulkMeterSewerageConnection, currentBulkMeter.meterSize, billingMonth, sewerageUsage);
    const differenceFull = differenceFullOrNull || { totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0, sanitationFee: 0, sewerageCharge: 0, meterRent: 0, vatAmount: 0, additionalFeesCharge: 0 } as BillCalculationResult;
    const differenceBill = differenceFull.totalBill;
    const differenceBillBreakdown = differenceFull;

    const totalPayable = differenceBill + outStandingBillValue;
    const paymentStatus: PaymentStatus = totalPayable > 0.01 ? 'Unpaid' : 'Paid';

    const displayBranchName = currentBulkMeter.branchId ? (currentBranches.find(b => b.id === currentBulkMeter.branchId)?.name ?? currentBulkMeter.subCity ?? "N/A") : (currentBulkMeter.subCity ?? "N/A");

    const billToRender = currentBillForPrintView || (currentBillingHistory.length > 0 ? currentBillingHistory[0] : null);

    let finalBillCardDetails;

    if (billToRender) {
      // Dynamic Outstanding Reconstruction for the selected bill
      const billIndex = currentBillingHistory.findIndex(b => b.id === billToRender.id);
      let reconstructedOutstanding = 0;

      const getUnpaidAmount = (b: any) => {
        if (b.paymentStatus === 'Paid') return 0;
        return Number(b.TOTALBILLAMOUNT) - Number(b.amountPaid || 0);
      };

      if (billIndex !== -1 && billIndex < currentBillingHistory.length - 1) {
        for (let j = billIndex + 1; j < currentBillingHistory.length; j++) {
          reconstructedOutstanding += getUnpaidAmount(currentBillingHistory[j]);
        }
      }

      // Add balanceCarriedForward from the oldest bill if we are at the end of the list
      if (billIndex === currentBillingHistory.length - 1) {
        reconstructedOutstanding = billToRender.balanceCarriedForward ?? 0;
      } else if (currentBillingHistory.length > 0) {
        // Also check if the oldest bill has an initial balance carried forward when it was created
        const oldestIndex = currentBillingHistory.length - 1;
        reconstructedOutstanding += currentBillingHistory[oldestIndex].balanceCarriedForward ?? 0;
      }

      const { data: historicalBillDetailsOrNull } = await calculateBillAction(billToRender.differenceUsage ?? 0, currentBulkMeter.chargeGroup as CustomerType || "Non-domestic", currentBulkMeter.sewerageConnection || "No", currentBulkMeter.meterSize, billToRender.monthYear);
      const historicalBillDetails = historicalBillDetailsOrNull || { totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0, sanitationFee: 0, sewerageCharge: 0, meterRent: 0, vatAmount: 0, additionalFeesCharge: 0 } as BillCalculationResult;

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
      };
    } else {
      // Reconstruction for current unsaved bill
      let currentReconstructedOutstanding = 0;
      const getUnpaidAmount = (b: any) => {
        if (b.paymentStatus === 'Paid') return 0;
        return Number(b.TOTALBILLAMOUNT) - Number(b.amountPaid || 0);
      };

      currentBillingHistory.forEach(b => {
        currentReconstructedOutstanding += getUnpaidAmount(b);
      });

      if (currentBillingHistory.length > 0) {
        currentReconstructedOutstanding += currentBillingHistory[currentBillingHistory.length - 1].balanceCarriedForward ?? 0;
      } else {
        currentReconstructedOutstanding = outStandingBillValue;
      }

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
      isMinOfThreeApplied, rawDifference,
      billCardDetails: finalBillCardDetails, totalIndividualUsage,
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    let localBranchId: string | undefined;

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser: UserAuth = JSON.parse(storedUser);
        // Branch-scoped if the user has a branchId assigned — no role string comparison needed
        if (parsedUser.branchId) {
          if (isMounted) setStaffBranchId(parsedUser.branchId);
          localBranchId = parsedUser.branchId;
        }
      } catch (e) { console.error("Failed to parse user from localStorage", e); }
    }


    if (!bulkMeterKey) {
      setIsLoading(false);
      setBulkMeter(null);
      toast({ title: "Invalid Bulk Meter ID", description: "The ID for the bulk meter is missing.", variant: "destructive" });
      router.push("/staff/bulk-meters");
      return;
    }

    setIsLoading(true);
    Promise.all([initializeBulkMeters(), initializeCustomers(), initializeBulkMeterReadings(), initializeBills(), initializeBranches()]).then(async () => {
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
        const isUserAuthorized = localBranchId ? foundBM.branchId === localBranchId : false;

        if (isUserAuthorized) {
          setBulkMeter(foundBM);
          setAssociatedCustomers(currentGlobalCustomers.filter(c => c.assignedBulkMeterId === bulkMeterKey));
          setIsAuthorized(true);

          const branchMeters = currentGlobalMeters.filter(bm => bm.branchId === localBranchId).map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name }));
          setBranchBulkMetersForCustomerForm(branchMeters);

          setMeterReadingHistory(getBulkMeterReadings().filter(r => r.CUSTOMERKEY === foundBM.customerKeyNumber).sort((a, b) => {
            const dateA = new Date(a.readingDate).getTime();
            const dateB = new Date(b.readingDate).getTime();
            if (dateB !== dateA) return dateB - dateA;
            const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return cB - cA;
          }));

          const { getTariff, initializeTariffs } = await import('@/lib/data-store');
          await initializeTariffs();
          const tariff = getTariff(foundBM.chargeGroup as any, format(new Date(), 'yyyy-MM'));
          setActiveTariff(tariff);

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
          setBulkMeter(null); setIsAuthorized(false);
          toast({ title: "Unauthorized", description: "You are not authorized to view this bulk meter.", variant: "destructive" });
        }
      } else {
        setBulkMeter(null);
        toast({ title: "Not Found", description: "Bulk meter not found.", variant: "destructive" });
      }
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
        const isUserAuthorized = localBranchId ? foundBM.branchId === localBranchId : false;

        if (isUserAuthorized) {
          setBulkMeter(foundBM);
          setAssociatedCustomers(currentGlobalCustomers.filter(c => c.assignedBulkMeterId === bulkMeterKey));
          setIsAuthorized(true);

          const branchMeters = currentGlobalMeters.filter(bm => bm.branchId === localBranchId).map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name }));
          setBranchBulkMetersForCustomerForm(branchMeters);

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

        } else {
          setBulkMeter(null); setIsAuthorized(false);
        }
      } else if (bulkMeter) {
        setBulkMeter(null); setIsAuthorized(false);
        toast({ title: "Bulk Meter Update", description: "The bulk meter being viewed may have been deleted or is no longer accessible.", variant: "destructive" });
      }
    };

    const unsubBM = subscribeToBulkMeters(handleStoresUpdate);
    const unsubCust = subscribeToCustomers(handleStoresUpdate);
    const unsubBranches = subscribeToBranches(handleStoresUpdate);
    const unsubMeterReadings = subscribeToBulkMeterReadings(handleStoresUpdate);
    const unsubBills = subscribeToBills(handleStoresUpdate);

    return () => { isMounted = false; unsubBM(); unsubCust(); unsubBranches(); unsubMeterReadings(); unsubBills(); };
  }, [bulkMeterKey, router, toast]);

  useEffect(() => {
    calculateMemoizedDetails(bulkMeter, associatedCustomers, branches, billingHistory, billForPrintView);
  }, [bulkMeter, associatedCustomers, branches, billingHistory, billForPrintView, calculateMemoizedDetails]);

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

      // 2. Penalty Calculation
      // Determine the \"max age\" of the debt to pick a tiered rate
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

      // Rule: if there's significant debt that doesn't fit in month buckets (legacy), treat as old
      const legacyDebt = Math.max(0, arrearsSum - (d30_bucket + d30_60_bucket + d60_bucket));
      if (legacyDebt > 0.01) maxAge = Math.max(maxAge, 3);

      if (maxAge >= threshold) {
          const applicableTier = [...tieredRates].sort((a, b) => b.month - a.month).find(t => maxAge >= t.month);
          const totalRate = bankRate + Number(applicableTier?.rate || 0);
          penalty = arrearsSum * totalRate;
      }
      
      // 3. Current Month Monthly Part (0 if voided)
      const currentMonthlyCharge = isVoided ? 0 : getMonthlyBillAmt(bill);
      
      // 4. Totals & Dynamic Reconstruction for THIS row
      const totalD60AndLegacy = d60_bucket + legacyDebt;
      
      // Reconstruct exactly from buckets as per business rule
      const derivedOutstanding = d30_bucket + d30_60_bucket + totalD60AndLegacy + penalty;
      const totalPayable = isVoided ? 0 : derivedOutstanding + currentMonthlyCharge;

      // Save results for this row (by Bill ID)
      results.set(bill.id, {
        d30: d30_bucket,
        d30_60: d30_60_bucket,
        d60: totalD60AndLegacy,
        penalty,
        outstanding: derivedOutstanding,
        currentMonthly: currentMonthlyCharge,
        totalPayable
      });

      // 5. Calculate Carried Forward UNPAID for the NEXT Month
      // If voided, we assume no payment was possible/recorded against THIS specific record
      const amtPaid = isVoided ? 0 : Number(bill.amountPaid || 0);
      
      // The business rule: previous Penalty must be carried forward and included in the arrears,
      // which will naturally cascade down into Debit_60 as legacy debt since it doesn't fit the newer buckets.
      const debtForNextMonth = d30_bucket + d30_60_bucket + totalD60AndLegacy + currentMonthlyCharge + penalty;
      carriedForwardUnpaid = Math.max(0, debtForNextMonth - amtPaid);

      // 6. Update Aging Buckets for the NEXT cycle
      // We assume payments cover oldest debt first
      let remainingPayment = amtPaid;
      
      // Deduct from d60 and legacy
      const paidAgainstOldest = Math.min(remainingPayment, totalD60AndLegacy);
      const remaining_d60_plus_legacy = Math.max(0, totalD60AndLegacy - paidAgainstOldest);
      remainingPayment -= paidAgainstOldest;

      // Note: penalty is carried forward to buckets as legacy debt next cycle.
      const paidAgainstPenalty = Math.min(remainingPayment, penalty);
      remainingPayment -= paidAgainstPenalty;

      // Deduct from d30_60
      const paidAgainstD30_60 = Math.min(remainingPayment, d30_60_bucket);
      const remaining_d30_60 = Math.max(0, d30_60_bucket - paidAgainstD30_60);
      remainingPayment -= paidAgainstD30_60;

      // Deduct from d30
      const paidAgainstD30 = Math.min(remainingPayment, d30_bucket);
      const remaining_d30 = Math.max(0, d30_bucket - paidAgainstD30);
      remainingPayment -= paidAgainstD30;

      // Deduct from current monthly
      const paidAgainstCurrent = Math.min(remainingPayment, currentMonthlyCharge);
      const remaining_current = Math.max(0, currentMonthlyCharge - paidAgainstCurrent);

      // Shift for next month's view:
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
  } = memoizedDetails;

  const handleEditBulkMeter = () => setIsBulkMeterFormOpen(true);
  const handleDeleteBulkMeter = () => setIsBulkMeterDeleteDialogOpen(true);
  const confirmDeleteBulkMeter = async () => {
    if (bulkMeter) {
      await deleteBulkMeterFromStore(bulkMeter.customerKeyNumber);
      toast({ title: "Bulk Meter Deleted", description: `${bulkMeter.name} has been removed.` });
      router.push("/staff/bulk-meters");
    }
    setIsBulkMeterDeleteDialogOpen(false);
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


  const handleSubmitBulkMeterForm = async (data: BulkMeterFormValues) => {
    if (bulkMeter) {
      await updateBulkMeterInStore(bulkMeter.customerKeyNumber, data);
      toast({ title: "Bulk Meter Updated", description: `${data.name} has been updated.` });
    }
    setIsBulkMeterFormOpen(false);
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
      setBillForPrintView(bill);
    } else {
      const recentBill = billingHistory.length > 0 ? billingHistory[0] : null;
      if (recentBill) {
        setBillForPrintView(recentBill);
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
          balanceCarriedForward: bulkMeter.outStandingbill,
          TOTALBILLAMOUNT: differenceBill,
          dueDate: 'N/A',
          paymentStatus: billCardDetails.paymentStatus,
          notes: "Current Live Pay Slip Generation (No History Available)",
        };
        setBillForPrintView(temporaryBillForPrint);
      }
    }
    return true;
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

  const handleDownloadPdf = async () => {
    if (!bulkMeter || isGeneratingPdf) return;

    const slipElement = document.getElementById('printable-bill-card-content');
    if (!slipElement) {
      toast({ title: "Error", description: "Could not find the bill slip content to download.", variant: "destructive" });
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const canvas = await html2canvas(slipElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

      const fileName = `payslip-${bulkMeter.customerKeyNumber}-${billForPrintView?.monthYear || 'current'}.pdf`;
      pdf.save(fileName);

      toast({ title: "PDF Generated", description: `Successfully downloaded ${fileName}.` });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "PDF Generation Failed", description: "An unexpected error occurred while generating the PDF.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadXlsx = () => {
    if (!bulkMeter || !billCardDetails) return;

    const headers = ['Description', 'Value'];
    const data = [
      { 'Description': 'Bulk meter name', 'Value': bulkMeter.name },
      { 'Description': 'Customer key number', 'Value': bulkMeter.customerKeyNumber },
      { 'Description': 'Contract No', 'Value': bulkMeter.contractNumber ?? 'N/A' },
      { 'Description': 'Branch', 'Value': displayBranchName ?? 'N/A' },
      { 'Description': 'Sub-City', 'Value': bulkMeter.location },
      { 'Description': 'Bulk Meter Category', 'Value': bulkMeter.chargeGroup },
      { 'Description': 'Sewerage Connection', 'Value': bulkMeter.sewerageConnection },
      { 'Description': 'Number of Assigned Individual Customers', 'Value': associatedCustomers.length },
      { 'Description': 'Previous and current reading', 'Value': `${billCardDetails.prevReading.toFixed(2)} / ${billCardDetails.currReading.toFixed(2)} m³` },
      { 'Description': 'Bulk usage', 'Value': `${billCardDetails.usage.toFixed(2)} m³` },
      { 'Description': 'Total Individual Usage', 'Value': `${totalIndividualUsage.toFixed(2)} m³` },
      { 'Description': 'Base Water Charge', 'Value': `ETB ${billCardDetails.baseWaterCharge.toFixed(2)}` },
      { 'Description': 'Maintenance Fee', 'Value': `ETB ${billCardDetails.maintenanceFee.toFixed(2)}` },
      { 'Description': 'Sanitation Fee', 'Value': `ETB ${billCardDetails.sanitationFee.toFixed(2)}` },
      { 'Description': 'Sewerage Fee', 'Value': `ETB ${billCardDetails.sewerageCharge.toFixed(2)}` },
      { 'Description': 'Meter Rent', 'Value': `ETB ${billCardDetails.meterRent.toFixed(2)}` },
      { 'Description': 'VAT (15%)', 'Value': `ETB ${billCardDetails.vatAmount.toFixed(2)}` },
      { 'Description': 'Difference usage', 'Value': `${billCardDetails.differenceUsage.toFixed(2)} m³` },
      { 'Description': 'Total Difference bill', 'Value': `ETB ${billCardDetails.totalDifferenceBill.toFixed(2)}` },
      { 'Description': 'Outstanding Bill (Previous Balance)', 'Value': `ETB ${billCardDetails.outstandingBill.toFixed(2)}` },
      { 'Description': 'Total Amount Payable', 'Value': `ETB ${billCardDetails.totalPayable.toFixed(2)}` },
      { 'Description': 'Paid/Unpaid', 'Value': billCardDetails.paymentStatus },
      { 'Description': 'Month', 'Value': billCardDetails.month },
    ];

    const blob = arrayToXlsxBlob(data, headers);
    const fileName = `payslip-${bulkMeter.customerKeyNumber}-${billForPrintView?.monthYear || 'current'}.xlsx`;
    downloadFile(blob, fileName);
    toast({ title: "XLSX Generated", description: `Successfully downloaded ${fileName}.` });
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

  React.useEffect(() => {
    if (showSlip || isPrinting) {
      setCurrentDateTime(new Date().toLocaleString('en-US'));
    }
  }, [showSlip, isPrinting]);

  if (isLoading) return <div className="p-4 text-center">Loading bulk meter details...</div>;
  if (!isAuthorized && !isLoading) {
    return (
      <div className="p-4 text-center space-y-4">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p>You are not authorized to view this bulk meter, or it does not belong to your branch.</p>
        <Button onClick={() => router.push("/staff/bulk-meters")}>Back to Bulk Meters List</Button>
      </div>
    );
  }
  if (!bulkMeter) return <div className="p-4 text-center">Bulk meter data is unavailable.</div>;

  return (
    <div className="space-y-6 p-4">
      {showSlip ? (
        <Card className="printable-bill-card-wrapper">
          <CardHeader className="non-printable flex flex-row items-center justify-between">
            <CardTitle>Pay Slip Preview</CardTitle>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isGeneratingPdf}>
                    <Printer className="mr-2 h-4 w-4" />
                    Download Report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <div className="mr-2 h-4 w-4" />}
                    Download as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadXlsx}>
                    <div className="mr-2 h-4 w-4" />
                    Download as XLSX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={() => setShowSlip(false)}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent id="printable-bill-card-content">
            <div className="printable-bill-card">
              <div className="print-header">
                <div className="print-header-top">
                  <span>Invoice generated on: {currentDateTime}</span>
                  <span className="font-bold">INVOICE #{bulkMeter.customerKeyNumber}-{billCardDetails.month}</span>
                </div>
                <div className="print-header-main flex flex-col items-center px-2 text-center">
                  <h1 className="uppercase tracking-tighter">ADDIS ABABA WATER AND SEWERAGE AUTHORITY</h1>
                  <div className="flex flex-row items-center justify-center gap-4 mt-2">
                    <Image src="https://veiethiopia.com/photo/partner/par2.png" alt="AAWSA Logo" width={50} height={30} className="flex-shrink-0" />
                    <h2 className="border-l-2 border-slate-300 pl-4">AAWSA INVOICE</h2>
                  </div>
                </div>
              </div>
              
              <div className="print-body">
                <div className="print-section">
                  <div className="print-banner">Bulk Meter Information</div>
                  <table className="print-table">
                    <tbody>
                      <tr><td>Account Name</td><td>{bulkMeter.name}</td></tr>
                      <tr><td>Customer Key</td><td>{bulkMeter.customerKeyNumber}</td></tr>
                      <tr><td>Contract Number</td><td>{bulkMeter.contractNumber ?? 'N/A'}</td></tr>
                      <tr><td>Operational Branch</td><td>{displayBranchName ?? 'N/A'}</td></tr>
                      <tr><td>Location (Sub-City)</td><td>{bulkMeter.location}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="print-section">
                  <div className="print-banner">Reading & Consumption</div>
                  <table className="print-table">
                    <tbody>
                      <tr><td>Meter Category</td><td>{bulkMeter.chargeGroup}</td></tr>
                      <tr><td>Sewerage Connection</td><td>{bulkMeter.sewerageConnection}</td></tr>
                      <tr><td>Assigned Customers</td><td>{associatedCustomers.length}</td></tr>
                      <tr><td>Reading Range</td><td>{billCardDetails.prevReading.toFixed(2)} - {billCardDetails.currReading.toFixed(2)} m³</td></tr>
                      <tr><td>Main Meter Usage</td><td>{billCardDetails.usage.toFixed(2)} m³</td></tr>
                      <tr><td>Sub-Meter Total Usage</td><td>{totalIndividualUsage.toFixed(2)} m³</td></tr>
                      <tr className="font-bold"><td>Billable Difference</td><td>{billCardDetails.differenceUsage.toFixed(2)} m³</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="print-section">
                  <div className="print-banner">Charges Breakdown</div>
                  <table className="print-table">
                    <tbody>
                      <tr>
                        <td>Base Water Charge (Standard Rate)</td>
                        <td>ETB {billCardDetails.baseWaterCharge.toFixed(2)}</td>
                      </tr>
                      <tr><td>Maintenance Service Fee</td><td>ETB {billCardDetails.maintenanceFee.toFixed(2)}</td></tr>
                      <tr><td>Sanitation Service Fee</td><td>ETB {billCardDetails.sanitationFee.toFixed(2)}</td></tr>
                      <tr><td>Meter Rental Fee</td><td>ETB {billCardDetails.meterRent.toFixed(2)}</td></tr>
                      <tr><td>Sewerage Disposal Fee</td><td>ETB {billCardDetails.sewerageCharge.toFixed(2)}</td></tr>
                      <tr><td>Value Added Tax (15%)</td><td>ETB {billCardDetails.vatAmount.toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="print-section pt-4 border-t-2 border-slate-200">
                  <div className="print-banner">Payment Summary</div>
                  <table className="print-table">
                    <tbody>
                      <tr><td>Current Period Bill</td><td>ETB {billCardDetails.totalDifferenceBill.toFixed(2)}</td></tr>
                      <tr><td>Accrued Penalty</td><td>ETB {billCardDetails.penaltyAmt.toFixed(2)}</td></tr>
                      <tr><td>Outstanding Balance</td><td>ETB {billCardDetails.outstandingBill.toFixed(2)}</td></tr>
                      <tr className="print-table-total">
                        <td className="uppercase tracking-wider">Total Amount Payable</td>
                        <td>ETB {billCardDetails.totalPayable.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mt-12 bg-slate-50 p-6 rounded-lg border border-slate-100">
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">Billing Cycle</div>
                    <div className="text-lg font-bold text-slate-900">{billCardDetails.month}</div>
                  </div>
                  <div className="print-status-box">
                    {billCardDetails.paymentStatus}
                  </div>
                </div>

                <div className="print-signature-section">
                  <div className="print-signature-item">
                    <div className="print-signature-line"></div>
                    <span className="print-signature-label">Prepared by</span>
                  </div>
                  <div className="print-signature-item">
                    <div className="print-signature-line"></div>
                    <span className="print-signature-label">Checked by</span>
                  </div>
                  <div className="print-signature-item">
                    <div className="print-signature-line"></div>
                    <span className="print-signature-label">Approved by</span>
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
                    <CardTitle className="text-xl sm:text-2xl">{bulkMeter.name}</CardTitle>
                    <CardDescription>Key: {bulkMeter.customerKeyNumber}</CardDescription>
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
                      { label: 'Sub-City', value: `${bulkMeter.location ?? 'N/A'}, ${bulkMeter.woreda ?? 'N/A'}` },
                      { label: 'Specific Area', value: bulkMeter.specificArea ?? 'N/A' },
                      { label: 'Meter No', value: bulkMeter.meterNumber ?? 'N/A' },
                      { label: 'Meter Size', value: `${bulkMeter.meterSize} inch` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50">
                        <span className="text-muted-foreground font-medium">{label}</span>
                        <span className="font-semibold text-right">{value}</span>
                      </div>
                    ))}
                    {bulkMeter.xCoordinate && bulkMeter.yCoordinate && (
                      <a href={`https://www.google.com/maps?q=${bulkMeter.yCoordinate},${bulkMeter.xCoordinate}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-primary hover:underline px-3 py-1 text-sm">
                        <MapPin className="mr-1 h-4 w-4" /> View on Map
                      </a>
                    )}
                  </div>
                  {/* Right column */}
                  <div className="space-y-2">
                    {[
                      { label: 'Contract No', value: bulkMeter.contractNumber ?? 'N/A' },
                      { label: 'Month', value: bulkMeter.month ?? 'N/A' },
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
                {/* Difference Usage highlight */}
                <div className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-md border font-semibold",
                  isMinOfThreeApplied
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                    : "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                )}>
                  <span>Difference Usage</span>
                  <div className="text-right">
                    <div>{differenceUsage?.toFixed(2)} m³</div>
                    {isMinOfThreeApplied && (
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
                            <TableCell>{format(
                              Object.prototype.toString.call(reading.readingDate) === '[object Date]'
                                ? (reading.readingDate as unknown as Date)
                                : parseISO(reading.readingDate as string),
                              "PP"
                            )}</TableCell>
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
                          <p className="text-xs font-bold text-muted-foreground uppercase">
                            {format(
                              Object.prototype.toString.call(reading.readingDate) === '[object Date]'
                                ? (reading.readingDate as unknown as Date)
                                : parseISO(reading.readingDate as string),
                              "PP"
                            )}
                          </p>
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
              {/* Mobile View: List of Cards */}
              <div className="md:hidden">
                {billingHistory.length > 0 ? paginatedBillingHistory.map((bill, _billIndex) => {
                  const usageForBill = bill.CONS ?? (bill.CURRREAD - bill.PREVREAD);
                  const displayUsage = !isNaN(usageForBill) ? usageForBill.toFixed(2) : "N/A";
                  return (
                    <div key={bill.id ?? `${bill.monthYear}-${String(bill.billPeriodEndDate)}-${_billIndex}`} className="border-b p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{bill.monthYear}</p>
                          <p className="text-sm text-muted-foreground">
                            Billed: {format(
                              Object.prototype.toString.call(bill.billPeriodEndDate) === '[object Date]'
                                ? (bill.billPeriodEndDate as unknown as Date)
                                : parseISO(bill.billPeriodEndDate as string),
                              "PP"
                            )}
                          </p>
                        </div>
                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><Menu className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuItem onClick={() => handlePrintSlip(bill)}><Printer className="mr-2 h-4 w-4" />Print/Export Bill</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => handleDeleteBillingRecord(bill)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" />Delete Record</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                        <p>Usage:</p><p className="text-right font-medium">{displayUsage} m³</p>
                        {(() => {
                          const recon = reconstructedHistoryMap.get(bill.id);
                          if (!recon) {
                            return (
                              <>
                                <p>Debit 30:</p><p className="text-right font-medium">— ETB</p>
                                <p>Debit 30-60:</p><p className="text-right font-medium">— ETB</p>
                                <p>Debit 60+:</p><p className="text-right font-medium">— ETB</p>
                                <p>Penalty:</p><p className="text-right font-medium">0.00 ETB</p>
                                <p className="font-semibold">Outstanding:</p><p className="text-right font-semibold">0.00 ETB</p>
                                <p>Current Bill:</p><p className="text-right font-medium">0.00 ETB</p>
                                <div className="col-span-2 flex justify-between border-t pt-1 mt-1 font-bold text-primary">
                                  <span>Total Payable:</span>
                                  <span>ETB 0.00</span>
                                </div>
                              </>
                            );
                          }

                          const fmt = (val: number) => val > 0.01 ? val.toFixed(2) : '—';

                          return (
                            <>
                              <p>Debit 30:</p><p className="text-right font-medium">{fmt(recon.d30)} ETB</p>
                              <p>Debit 30-60:</p><p className="text-right font-medium">{fmt(recon.d30_60)} ETB</p>
                              <p>Debit 60+:</p><p className="text-right font-medium">{fmt(recon.d60)} ETB</p>
                              <p>Penalty:</p><p className="text-right font-medium text-destructive">{fmt(recon.penalty)} ETB</p>
                              <p className="font-semibold">Outstanding:</p><p className="text-right font-semibold">{recon.outstanding.toFixed(2)} ETB</p>
                              <p>Current Bill:</p><p className="text-right font-medium">{Math.max(0, recon.currentMonthly).toFixed(2)} ETB</p>
                              <div className="col-span-2 flex justify-between border-t pt-1 mt-1 font-bold text-primary">
                                <span>Total Payable:</span>
                                <span>ETB {recon.totalPayable.toFixed(2)}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <div className="mt-2">
                        <Badge variant={bill.paymentStatus === 'Paid' ? 'default' : 'destructive'}>{bill.paymentStatus}</Badge>
                      </div>
                    </div>
                  );
                }) : <p className="text-muted-foreground text-sm text-center py-4">No billing history found.</p>}
              </div>

              {/* Legend note below desktop table */}
              <div className="hidden md:block mx-4 mb-2 mt-1 p-2 rounded-md bg-muted/30 border border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground italic">
                <span className="font-semibold not-italic text-foreground/70">📝 Note: </span>
                Debit_30 = bill 1 month old &nbsp;|&nbsp; Debit_30_60 = bill 2 months old &nbsp;|&nbsp; Debit_60 = bill 3+ months old &nbsp;|&nbsp;
                Penalty applies to bills 3+ months old only &nbsp;|&nbsp; Outstanding = all unpaid debt + current penalty
              </div>
              <div className="overflow-x-auto hidden md:block">{billingHistory.length > 0 ? (<Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Date Billed</TableHead><TableHead className="text-right">Prev. Read</TableHead><TableHead className="text-right">Curr. Read</TableHead><TableHead>Usage (m³)</TableHead><TableHead className="text-right text-orange-600 font-bold">Diff. Usage</TableHead><TableHead className="text-right">Debit_30</TableHead><TableHead className="text-right">Debit_30_60</TableHead><TableHead className="text-right">Debit_60</TableHead><TableHead className="text-right">Penalty</TableHead><TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Current Bill</TableHead><TableHead className="text-right">Total Payable</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{paginatedBillingHistory.map((bill, _billIndex) => {
                  const usageForBill = bill.CONS ?? (bill.CURRREAD - bill.PREVREAD);
                  const displayUsage = !isNaN(usageForBill) ? usageForBill.toFixed(2) : "N/A";
                  const diffUsageValue = bill.differenceUsage ?? (usageForBill - (associatedCustomers.reduce((sum, cust) => sum + ((cust.currentReading ?? 0) - (cust.previousReading ?? 0)), 0)));
                  const displayDiffUsage = !isNaN(diffUsageValue) ? diffUsageValue.toFixed(2) : 'N/A';
                  return (
                    <TableRow key={bill.id ?? `${bill.monthYear}-${String(bill.billPeriodEndDate)}-${_billIndex}`}>
                      <TableCell>{bill.monthYear}</TableCell>
                      <TableCell>{format(
                        Object.prototype.toString.call(bill.billPeriodEndDate) === '[object Date]'
                          ? (bill.billPeriodEndDate as unknown as Date)
                          : parseISO(bill.billPeriodEndDate as string),
                        "PP"
                      )}</TableCell>
                      <TableCell className="text-right">{bill.PREVREAD.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{bill.CURRREAD.toFixed(2)}</TableCell>
                      <TableCell>{displayUsage}</TableCell>
                      <TableCell className={cn("text-right", diffUsageValue < 0 ? "text-amber-600" : "text-green-600")}>{displayDiffUsage}</TableCell>

                      {(() => {
                        const recon = reconstructedHistoryMap.get(bill.id);
                        if (!recon) {
                          // Fallback if map entry not found (shouldn't happen)
                          return (
                            <>
                              <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                              <TableCell className="text-right text-destructive font-medium">—</TableCell>
                              <TableCell className="text-right">0.00</TableCell>
                              <TableCell className="text-right font-medium">0.00</TableCell>
                              <TableCell className="text-right font-bold text-red-700">0.00</TableCell>
                            </>
                          );
                        }

                        const fmt = (val: number) => val > 0.01 ? val.toFixed(2) : '—';

                        return (
                          <>
                            <TableCell className="text-right text-xs text-muted-foreground">{fmt(recon.d30)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{fmt(recon.d30_60)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{fmt(recon.d60)}</TableCell>
                            <TableCell className="text-right text-destructive font-medium">{fmt(recon.penalty)}</TableCell>
                            <TableCell className="text-right">{recon.outstanding.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">{Math.max(0, recon.currentMonthly).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-bold text-red-700">{recon.totalPayable.toFixed(2)}</TableCell>
                          </>
                        );
                      })()}
                      <TableCell><Badge variant={bill.paymentStatus === 'Paid' ? 'default' : 'destructive'}>{bill.paymentStatus}</Badge></TableCell>
                      <TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><Menu className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuItem onClick={() => handlePrintSlip(bill)}><Printer className="mr-2 h-4 w-4" />Print/Export Bill</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => handleDeleteBillingRecord(bill)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" />Delete Record</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                    </TableRow>
                  )
                })}</TableBody></Table>) : (<p className="text-muted-foreground text-sm text-center py-4 md:block hidden">No billing history found.</p>)}</div>
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
                                    <DropdownMenuItem onClick={() => handleEditCustomer(customer)}><Edit className="mr-2 h-4 w-4" />Edit Customer</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDeleteCustomer(customer)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" />Delete Customer</DropdownMenuItem>
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
                                    <DropdownMenuItem onClick={() => handleEditCustomer(customer)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
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
      )
      }

      {bulkMeter && (<BulkMeterFormDialog open={isBulkMeterFormOpen} onOpenChange={setIsBulkMeterFormOpen} onSubmit={handleSubmitBulkMeterForm} defaultValues={bulkMeter} />)}
      {bulkMeter && (<AddReadingDialog open={isAddReadingOpen} onOpenChange={setIsAddReadingOpen} onSubmit={handleAddNewReading} meter={bulkMeter} />)}
      <AlertDialog open={isBulkMeterDeleteDialogOpen} onOpenChange={setIsBulkMeterDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Bulk Meter?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {bulkMeter?.name}. Associated customers will need reassignment.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteBulkMeter}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedCustomer && (<IndividualCustomerFormDialog open={isCustomerFormOpen} onOpenChange={setIsCustomerFormOpen} onSubmit={handleSubmitCustomerForm} defaultValues={selectedCustomer} bulkMeters={branchBulkMetersForCustomerForm.map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name }))} />)}
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

    </div>
  );
}
