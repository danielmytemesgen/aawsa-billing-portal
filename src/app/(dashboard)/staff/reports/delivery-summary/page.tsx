"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { useToast } from "@/hooks/use-toast";
import { getAllBranchesAction, getDeliverySummaryReportAction, getDeliverySummaryPeriodsAction } from "@/lib/actions";
import type { DeliverySummaryRow } from "@/lib/db-queries";
import { getAvailableMonthYearOptions } from "@/lib/export-utils";
import { DeliverySummaryTable } from "@/components/reports/DeliverySummaryTable";
import { Truck } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  branchId?: string;
  branchName?: string;
}

export default function StaffDeliverySummaryReportPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [latestMonth, setLatestMonth] = useState<string>("");
  const [dbMonths, setDbMonths] = useState<string[]>([]);
  const [isPeriodInitialized, setIsPeriodInitialized] = useState<boolean>(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>("");
  const [selectedChargeGroup, setSelectedChargeGroup] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  const [summaryData, setSummaryData] = useState<DeliverySummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Determine if user has global branch access
  const canSelectBranch = Boolean(
    hasPermission("*") ||
    hasPermission("admin") ||
    hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) ||
    hasPermission(PERMISSIONS.BRANCHES_VIEW)
  );

  // Month-year options (combines generator with database distinct billing periods & marks latest)
  const monthOptions = useMemo(() => {
    const base = getAvailableMonthYearOptions();
    const existingValues = new Set(base.map((o) => o.value));
    const extras: { value: string; label: string }[] = [];
    dbMonths.forEach((m) => {
      if (!existingValues.has(m) && m !== "all") {
        const [yr, mo] = m.split("-").map(Number);
        const d = new Date(yr, mo - 1, 1);
        const label = isNaN(d.getTime())
          ? m
          : format(d, "MMMM yyyy");
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

  // Initialize staff user from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentUser(parsed);
        if (parsed.branchId && !canSelectBranch) {
          setSelectedBranchId(parsed.branchId);
        }
      }
    } catch (e) {
      console.error("Error reading stored user:", e);
    }
  }, [canSelectBranch]);

  // Fetch branches and available periods on mount
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        const [branchRes, periodRes]: [any, any] = await Promise.all([
          getAllBranchesAction(),
          getDeliverySummaryPeriodsAction(),
        ]);
        if (!isMounted) return;

        const rawBranches = (branchRes?.data || branchRes?.branches || []) as any[];
        if (rawBranches.length > 0) {
          setBranches(rawBranches.map((b: any) => ({ id: b.id, name: b.name })));
        }
        if (periodRes?.success && periodRes.latestMonth) {
          setLatestMonth(periodRes.latestMonth);
          setSelectedMonthYear(periodRes.latestMonth);
          if (periodRes.availableMonths) {
            setDbMonths(periodRes.availableMonths);
          }
        } else {
          const fallback = format(new Date(), "yyyy-MM");
          setLatestMonth(fallback);
          setSelectedMonthYear(fallback);
        }
        setIsPeriodInitialized(true);
      } catch (err) {
        console.error("Failed to load initial delivery summary setup:", err);
        if (!isMounted) return;
        const fallback = format(new Date(), "yyyy-MM");
        setLatestMonth(fallback);
        setSelectedMonthYear(fallback);
        setIsPeriodInitialized(true);
      }
    };

    fetchInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch delivery summary data
  const fetchData = useCallback(async () => {
    if (!isPeriodInitialized) return;
    setIsLoading(true);
    try {
      const effectiveBranchId = canSelectBranch
        ? (selectedBranchId === "all" ? undefined : selectedBranchId)
        : (currentUser?.branchId || selectedBranchId);

      const res = await getDeliverySummaryReportAction({
        branchId: effectiveBranchId,
        monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
        chargeGroup: selectedChargeGroup === "all" ? undefined : selectedChargeGroup,
        searchTerm: debouncedSearch || undefined,
      });

      if (res.success && res.summary) {
        setSummaryData(res.summary);
      } else {
        setSummaryData([]);
        if (res.error) {
          toast({
            title: "Data Fetch Notice",
            description: res.error,
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch delivery summary report:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load delivery summary report",
        variant: "destructive",
      });
      setSummaryData([]);
    } finally {
      setIsLoading(false);
    }
  }, [isPeriodInitialized, canSelectBranch, selectedBranchId, currentUser, selectedMonthYear, selectedChargeGroup, debouncedSearch, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700">
              <Truck className="h-5 w-5" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Delivery Summary Report
            </h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Standard delivery breakdown categorizing current month charges and overdue balances.
            {!canSelectBranch && currentUser?.branchName && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-1">
                (Branch: {currentUser.branchName})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Main Delivery Table Component */}
      <DeliverySummaryTable
        data={summaryData}
        isLoading={isLoading}
        selectedMonthYear={selectedMonthYear}
        onMonthYearChange={setSelectedMonthYear}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        selectedChargeGroup={selectedChargeGroup}
        onChargeGroupChange={setSelectedChargeGroup}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onRefresh={fetchData}
        branches={branches}
        monthOptions={monthOptions}
        canSelectBranch={canSelectBranch}
        latestMonth={latestMonth}
      />
    </div>
  );
}
