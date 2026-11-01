"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { useToast } from "@/hooks/use-toast";
import {
  getAllBranchesAction,
  getCombinedBillingSummaryAction,
  getDeliverySummaryPeriodsAction,
} from "@/lib/actions";
import type { BillsBranchSummaryRow } from "@/lib/db-queries";
import { getAvailableMonthYearOptions } from "@/lib/export-utils";
import { BillingSummaryReportContent } from "@/components/reports/BillingSummaryReportContent";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function AdminBillingSummaryReportPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const canAccess =
    hasPermission("*") ||
    hasPermission("admin") ||
    hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) ||
    hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH) ||
    hasPermission(PERMISSIONS.REPORT_LIST_OF_PAID_BILLS) ||
    hasPermission(PERMISSIONS.REPORT_LIST_OF_SENT_BILLS) ||
    hasPermission(PERMISSIONS.REPORT_LIST_OF_UNSETTLED_BILLS) ||
    hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [latestMonth, setLatestMonth] = useState<string>("");
  const [dbMonths, setDbMonths] = useState<string[]>([]);
  const [isPeriodInitialized, setIsPeriodInitialized] = useState<boolean>(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>("all");

  const [deliveryData, setDeliveryData] = useState<BillsBranchSummaryRow[]>([]);
  const [paidData, setPaidData] = useState<BillsBranchSummaryRow[]>([]);
  const [unsettledData, setUnsettledData] = useState<BillsBranchSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Combine month options from generator & distinct database periods
  const monthOptions = useMemo(() => {
    const base = getAvailableMonthYearOptions();
    const existingValues = new Set(base.map((o) => o.value));
    const extras: { value: string; label: string }[] = [];
    dbMonths.forEach((m) => {
      if (!existingValues.has(m) && m !== "all") {
        const [yr, mo] = m.split("-").map(Number);
        const d = new Date(yr, mo - 1, 1);
        const label = isNaN(d.getTime()) ? m : format(d, "MMMM yyyy");
        extras.push({ value: m, label });
      }
    });

    const combined = [...base, ...extras];
    return combined.map((opt) => {
      if (latestMonth && opt.value === latestMonth) {
        const cleanLabel = opt.label.replace(/\s*\(Latest\)$/i, "");
        return { ...opt, label: `${cleanLabel} (Latest)` };
      }
      return opt;
    });
  }, [dbMonths, latestMonth]);

  // Load branches & available periods on mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([getAllBranchesAction(), getDeliverySummaryPeriodsAction()])
      .then(([branchRes, periodRes]: [any, any]) => {
        if (!isMounted) return;
        const rawBranches = (branchRes?.data || branchRes?.branches || []) as any[];
        if (rawBranches.length > 0) {
          setBranches(rawBranches.map((b: any) => ({ id: b.id, name: b.name })));
        }
        if (periodRes?.success && periodRes.latestMonth) {
          setLatestMonth(periodRes.latestMonth);
          if (periodRes.availableMonths) {
            setDbMonths(periodRes.availableMonths);
          }
        }
        setIsPeriodInitialized(true);
      })
      .catch((err) => {
        console.error("Failed to load initial billing summary metadata:", err);
        if (!isMounted) return;
        setIsPeriodInitialized(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch combined summary data (Delivery, Paid, Unsettled) in parallel
  const fetchData = useCallback(async () => {
    if (!isPeriodInitialized) return;
    setIsLoading(true);
    try {
      const res = await getCombinedBillingSummaryAction({
        branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
        monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
      });

      if (res.success) {
        setDeliveryData(res.delivery || []);
        setPaidData(res.paid || []);
        setUnsettledData(res.unsettled || []);
      } else {
        setDeliveryData([]);
        setPaidData([]);
        setUnsettledData([]);
        if (res.error) {
          toast({
            title: "Data Fetch Notice",
            description: res.error,
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch combined billing summary:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load billing summary report",
        variant: "destructive",
      });
      setDeliveryData([]);
      setPaidData([]);
      setUnsettledData([]);
    } finally {
      setIsLoading(false);
    }
  }, [isPeriodInitialized, selectedBranchId, selectedMonthYear, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!canAccess) {
    return (
      <div className="p-8">
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50 text-red-900">
          <Lock className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-lg font-bold">Access Denied</AlertTitle>
          <p className="mt-2 text-sm text-red-700">
            You do not have permission to view Billing Summary reports.
          </p>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <BillingSummaryReportContent
        deliveryData={deliveryData}
        paidData={paidData}
        unsettledData={unsettledData}
        isLoading={isLoading}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        selectedMonthYear={selectedMonthYear}
        onMonthYearChange={setSelectedMonthYear}
        branches={branches}
        monthOptions={monthOptions}
        canSelectBranch={true}
        onRefresh={fetchData}
      />
    </div>
  );
}

