"use client";

import * as React from "react";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Gauge,
  History,
  Download,
  Calendar,
  User,
  Building2,
  FileText,
  Clock,
  Printer,
  ShieldAlert,
  Loader2,
  HelpCircle,
  Undo2,
  Check,
  ShieldCheck,
  Tag,
  Hash,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import {
  meterChangeAction,
  getMeterChangeLogsAction,
  getMeterDetailsForChangeAction,
  voidMeterChangeAction,
  type MeterChangeRecord,
} from "@/lib/meter-change-actions";
import {
  getCustomers,
  initializeCustomers,
  getBulkMeters,
  initializeBulkMeters,
} from "@/lib/data-store";

interface MeterChangeViewProps {
  basePath?: "/admin" | "/staff";
}

const COMMON_REASONS = [
  "Physical damage / Cracked glass",
  "Meter stopped / Mechanism stuck",
  "High consumption / Suspected over-metering",
  "Leakage / Seal tampering observed",
  "Scheduled preventive maintenance",
  "Digital / Smart meter upgrade",
  "Customer complaint resolution",
  "Size upgrade / Capacity expansion",
  "Other (specified in notes)",
];

const METER_SIZE_OPTIONS = [
  { value: 0.5, label: '1/2" (15mm)' },
  { value: 0.75, label: '3/4" (20mm)' },
  { value: 1, label: '1" (25mm)' },
  { value: 1.25, label: '1 1/4" (32mm)' },
  { value: 1.5, label: '1 1/2" (40mm)' },
  { value: 2, label: '2" (50mm)' },
  { value: 2.5, label: '2 1/2" (65mm)' },
  { value: 3, label: '3" (80mm)' },
  { value: 4, label: '4" (100mm)' },
  { value: 5, label: '5" (125mm)' },
  { value: 6, label: '6" (150mm)' },
];

function MeterChangeContent({ basePath = "/admin" }: MeterChangeViewProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { hasAnyPermission } = usePermissions();

  const canCreate = hasAnyPermission(
    PERMISSIONS.METER_CHANGE_CREATE,
    PERMISSIONS.METER_CHANGE_MANAGE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.BULK_METERS_UPDATE
  );

  const canManage = hasAnyPermission(
    PERMISSIONS.METER_CHANGE_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE
  );

  const [activeTab, setActiveTab] = useState<string>("record");

  // Form State
  const [meterType, setMeterType] = useState<"individual" | "bulk">("individual");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<{
    customerKeyNumber: string;
    name: string;
    meterNumber: string;
    currentReading: number;
    previousReading: number;
    meterSize: number;
    numberOfDials: number;
    branchId: string;
    status: string;
  } | null>(null);

  const [isSearchingEntity, setIsSearchingEntity] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<
    Array<{ key: string; name: string; meter: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Meter Change Inputs
  const [oldMeterNumber, setOldMeterNumber] = useState("");
  const [oldMeterClosingReading, setOldMeterClosingReading] = useState<string>("");
  const [newMeterNumber, setNewMeterNumber] = useState("");
  const [newMeterOpeningReading, setNewMeterOpeningReading] = useState<string>("0");
  const [newMeterSize, setNewMeterSize] = useState<number>(0.5);
  const [newDialCount, setNewDialCount] = useState<number>(5);
  const [newSealNumber, setNewSealNumber] = useState<string>("");
  const [changeDate, setChangeDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_REASONS[0]);
  const [customNotes, setCustomNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Void / Rollback Modal State
  const [voidRecord, setVoidRecord] = useState<MeterChangeRecord | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  // History State
  const [historyRecords, setHistoryRecords] = useState<MeterChangeRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [selectedSlipRecord, setSelectedSlipRecord] = useState<MeterChangeRecord | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    individual: 0,
    bulk: 0,
    thisMonth: 0,
  });

  // Handle URL query parameters (?type=...&key=...)
  useEffect(() => {
    const urlType = searchParams?.get("type");
    const urlKey = searchParams?.get("key");

    if (urlType === "bulk" || urlType === "individual") {
      setMeterType(urlType);
    }
    if (urlKey) {
      setCustomerSearch(urlKey);
      handleSelectCustomerKey(urlKey, (urlType as any) || "individual");
    }
  }, [searchParams]);

  // Initial load
  useEffect(() => {
    initializeCustomers().catch(() => {});
    initializeBulkMeters().catch(() => {});
    loadHistory();
  }, []);

  // Update suggestions as user types search query
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 2) {
      setSearchSuggestions([]);
      return;
    }
    const query = customerSearch.toLowerCase().trim();
    if (meterType === "individual") {
      const customers = getCustomers();
      const filtered = customers
        .filter(
          (c) =>
            c.customerKeyNumber.toLowerCase().includes(query) ||
            (c.name && c.name.toLowerCase().includes(query)) ||
            (c.meterNumber && c.meterNumber.toLowerCase().includes(query))
        )
        .slice(0, 6)
        .map((c) => ({
          key: c.customerKeyNumber,
          name: c.name || "N/A",
          meter: c.meterNumber || "N/A",
        }));
      setSearchSuggestions(filtered);
    } else {
      const bulks = getBulkMeters();
      const filtered = bulks
        .filter(
          (b) =>
            b.customerKeyNumber.toLowerCase().includes(query) ||
            (b.name && b.name.toLowerCase().includes(query)) ||
            (b.meterNumber && b.meterNumber.toLowerCase().includes(query))
        )
        .slice(0, 6)
        .map((b) => ({
          key: b.customerKeyNumber,
          name: b.name || "N/A",
          meter: b.meterNumber || "N/A",
        }));
      setSearchSuggestions(filtered);
    }
  }, [customerSearch, meterType]);

  // Load history records from DB action
  const loadHistory = async (page = historyPage, pageSize = historyPageSize) => {
    setHistoryLoading(true);
    try {
      const params: any = {
        page,
        pageSize,
      };
      if (historySearch.trim()) params.customerKeyNumber = historySearch.trim();
      if (historyTypeFilter !== "all") params.meterType = historyTypeFilter as any;
      if (historyStatusFilter !== "all") params.status = historyStatusFilter;
      if (historyFromDate) params.from = historyFromDate;
      if (historyToDate) params.to = historyToDate;

      const res = await getMeterChangeLogsAction(params);
      if (res?.error) {
        toast({
          title: "Failed to load history",
          description: res.error.message,
          variant: "destructive",
        });
      } else if (res?.data) {
        setHistoryRecords(res.data.rows);
        setHistoryTotal(res.data.totalCount);

        const currentMonthPrefix = new Date().toISOString().slice(0, 7);
        const thisMonthCount = res.data.rows.filter(
          (r) => r.changeDate && r.changeDate.startsWith(currentMonthPrefix)
        ).length;

        setStats((prev) => ({
          ...prev,
          total: res.data.totalCount,
          thisMonth: thisMonthCount,
        }));
      }
    } catch (err: any) {
      console.error("Error loading history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Handle entity selection & fetch details
  const handleSelectCustomerKey = async (key: string, overrideType?: "individual" | "bulk") => {
    const type = overrideType || meterType;
    setCustomerSearch(key);
    setShowSuggestions(false);
    setIsSearchingEntity(true);

    try {
      const res = await getMeterDetailsForChangeAction(type, key);
      if (res?.error) {
        toast({
          title: "Lookup Failed",
          description: res.error.message,
          variant: "destructive",
        });
        setSelectedEntity(null);
      } else if (res?.data) {
        setSelectedEntity(res.data);
        setOldMeterNumber(res.data.meterNumber);
        setOldMeterClosingReading(String(res.data.currentReading));
        setNewMeterSize(res.data.meterSize || 0.5);
        setNewDialCount(res.data.numberOfDials || 5);
        toast({
          title: "Meter Found",
          description: `Loaded meter #${res.data.meterNumber} (${res.data.meterSize}") for ${res.data.name}`,
        });
      } else {
        // Resilient fallback: lookup in client-side data store
        const queryLower = key.trim().toLowerCase();
        let found: any = null;
        if (type === "bulk") {
          const bulks = getBulkMeters();
          found = bulks.find(
            (b) =>
              b.customerKeyNumber?.toLowerCase() === queryLower ||
              (b.meterNumber && b.meterNumber.toLowerCase() === queryLower)
          );
        } else {
          const custs = getCustomers();
          found = custs.find(
            (c) =>
              c.customerKeyNumber?.toLowerCase() === queryLower ||
              (c.meterNumber && c.meterNumber.toLowerCase() === queryLower)
          );
        }

        if (found) {
          const mNum = (found as any).METER_KEY || found.meterNumber || "";
          const mSize = Number(found.meterSize) || 0.5;
          const dials = Number((found as any).NUMBER_OF_DIALS || (found as any).numberOfDials) || 5;
          const entityData = {
            customerKeyNumber: found.customerKeyNumber,
            name: found.name || "N/A",
            meterNumber: mNum,
            currentReading: Number(found.currentReading || 0),
            previousReading: Number(found.previousReading || 0),
            meterSize: mSize,
            numberOfDials: dials,
            branchId: found.branchId || "",
            status: found.status || "",
          };
          setSelectedEntity(entityData);
          setOldMeterNumber(mNum);
          setOldMeterClosingReading(String(found.currentReading || 0));
          setNewMeterSize(mSize);
          setNewDialCount(dials);
          toast({
            title: "Meter Found",
            description: `Loaded meter #${mNum} (${mSize}") for ${found.name}`,
          });
        } else {
          toast({
            title: "Lookup Failed",
            description: `${type === "individual" ? "Customer" : "Bulk meter"} "${key}" not found.`,
            variant: "destructive",
          });
          setSelectedEntity(null);
        }
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to fetch meter details",
        variant: "destructive",
      });
    } finally {
      setIsSearchingEntity(false);
    }
  };

  // Calculated old meter unbilled consumption
  const oldMeterConsumption = useMemo(() => {
    if (!selectedEntity) return null;
    const closing = parseFloat(oldMeterClosingReading);
    if (isNaN(closing)) return null;
    const prev = selectedEntity.previousReading;
    return closing - prev;
  }, [selectedEntity, oldMeterClosingReading]);

  // Validation
  const validateForm = () => {
    if (!selectedEntity) {
      toast({
        title: "Validation Error",
        description: "Please search and select a customer / bulk meter first.",
        variant: "destructive",
      });
      return false;
    }
    if (!oldMeterNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "Old Meter Serial Number is required.",
        variant: "destructive",
      });
      return false;
    }
    const closing = parseFloat(oldMeterClosingReading);
    if (isNaN(closing) || closing < 0) {
      toast({
        title: "Validation Error",
        description: "Old Meter Closing Reading must be a valid non-negative number.",
        variant: "destructive",
      });
      return false;
    }
    if (!newMeterNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "New Meter Serial Number is required.",
        variant: "destructive",
      });
      return false;
    }
    if (newMeterNumber.trim().toLowerCase() === oldMeterNumber.trim().toLowerCase()) {
      toast({
        title: "Validation Error",
        description: "New meter serial number must be different from the old meter serial number.",
        variant: "destructive",
      });
      return false;
    }
    const opening = parseFloat(newMeterOpeningReading);
    if (isNaN(opening) || opening < 0) {
      toast({
        title: "Validation Error",
        description: "New Meter Opening Reading must be a non-negative number (usually 0).",
        variant: "destructive",
      });
      return false;
    }
    if (!changeDate) {
      toast({
        title: "Validation Error",
        description: "Change date is required.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Submit meter change
  const handleExecuteChange = async () => {
    if (!validateForm() || !selectedEntity) return;

    setIsSubmitting(true);
    setShowConfirmModal(false);

    try {
      const combinedNotes = customNotes.trim()
        ? `[${selectedReason}] ${customNotes.trim()}`
        : `[${selectedReason}]`;

      const payload = {
        meterType,
        customerKeyNumber: selectedEntity.customerKeyNumber,
        oldMeterNumber: oldMeterNumber.trim(),
        oldMeterClosingReading: parseFloat(oldMeterClosingReading),
        newMeterNumber: newMeterNumber.trim(),
        newMeterOpeningReading: parseFloat(newMeterOpeningReading),
        newMeterSize,
        newDialCount,
        newSealNumber: newSealNumber.trim() || undefined,
        changeDate,
        notes: combinedNotes,
      };

      const res = await meterChangeAction(payload);

      if (res?.error) {
        toast({
          title: "Meter Change Failed",
          description: res.error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Meter Replacement Successful! 🎉",
          description: `Swapped ${oldMeterNumber} ➔ ${newMeterNumber} (${newMeterSize}") for ${selectedEntity.customerKeyNumber}`,
        });

        // Invalidate data store cache
        initializeCustomers(true).catch(() => {});
        initializeBulkMeters(true).catch(() => {});

        // Reset form
        setSelectedEntity(null);
        setCustomerSearch("");
        setOldMeterNumber("");
        setOldMeterClosingReading("");
        setNewMeterNumber("");
        setNewMeterOpeningReading("0");
        setNewSealNumber("");
        setCustomNotes("");

        // Switch to history tab and refresh
        setActiveTab("history");
        loadHistory(1, historyPageSize);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supervisor Void / Rollback
  const handleVoidMeterChange = async () => {
    if (!voidRecord || !voidReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please state the reason for voiding this meter change.",
        variant: "destructive",
      });
      return;
    }

    setIsVoiding(true);
    try {
      const res = await voidMeterChangeAction(voidRecord.id, voidReason.trim());
      if (res?.error) {
        toast({
          title: "Void Failed",
          description: res.error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Meter Change Voided & Reverted",
          description: `Successfully reverted ${voidRecord.customerKeyNumber} to old meter #${voidRecord.oldMeterNumber}`,
        });

        // Invalidate cache
        initializeCustomers(true).catch(() => {});
        initializeBulkMeters(true).catch(() => {});

        setVoidRecord(null);
        setVoidReason("");
        loadHistory(historyPage, historyPageSize);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to void change record",
        variant: "destructive",
      });
    } finally {
      setIsVoiding(false);
    }
  };

  // Export history to CSV
  const handleExportCSV = () => {
    if (historyRecords.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No meter change records found with current filters.",
      });
      return;
    }

    const headers = [
      "ID",
      "Change Date",
      "Meter Type",
      "Customer Key",
      "Old Meter Serial",
      "Old Meter Size",
      "Old Meter Closing Reading (m3)",
      "Unbilled Closing Usage (m3)",
      "New Meter Serial",
      "New Meter Size",
      "New Meter Opening Reading (m3)",
      "Seal Number",
      "Status",
      "Performed By",
      "Notes",
    ];

    const rows = historyRecords.map((r) => [
      r.id,
      r.changeDate,
      r.meterType.toUpperCase(),
      `"${r.customerKeyNumber}"`,
      `"${r.oldMeterNumber}"`,
      `${r.oldMeterSize || 0.5}"`,
      r.oldMeterClosingReading,
      r.closingConsumption || 0,
      `"${r.newMeterNumber}"`,
      `${r.newMeterSize || 0.5}"`,
      r.newMeterOpeningReading,
      `"${r.newSealNumber || ""}"`,
      r.status || "Active",
      `"${r.performedByEmail || r.performedBy || ""}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `meter_change_history_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 px-2 sm:px-4 lg:px-6 py-1 w-full">
      {/* Top Banner / Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-6 sm:p-8 text-white shadow-xl">
        {/* Decorative blobs */}
        <div className="absolute right-0 top-0 -mr-10 -mt-10 h-56 w-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute right-32 bottom-0 mb-0 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: title & description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-md border border-white/20 px-3 py-1">
                Field Operations
              </Badge>
              <Badge className="bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 px-3 py-1">
                Meter Swap &amp; Audit
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <RefreshCcw className="h-7 w-7 text-emerald-200" />
              Meter Change Management
            </h1>
            <p className="text-emerald-50 text-sm sm:text-base max-w-2xl leading-relaxed">
              Record physical meter swaps, finalize closing readings, register new meter serials, size &amp; seals — with automated revenue audit logs.
            </p>
          </div>

          {/* Right: quick-stats panel */}
          <div className="flex flex-col gap-3 min-w-[220px]">
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white shadow-md border border-emerald-100 p-3 text-center flex flex-col items-center justify-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1">Total Swaps</p>
                <p className="text-3xl font-black text-slate-900 leading-none">{historyTotal}</p>
              </div>
              <div className="rounded-2xl bg-white shadow-md border border-emerald-100 p-3 text-center flex flex-col items-center justify-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1">This Month</p>
                <p className="text-3xl font-black text-slate-900 leading-none">{stats.thisMonth}</p>
              </div>
            </div>
            {/* Sync button */}
            <Button
              onClick={() => loadHistory(historyPage, historyPageSize)}
              disabled={historyLoading}
              className="w-full rounded-xl bg-white text-emerald-700 hover:bg-emerald-50 font-bold shadow-md border-0 h-10"
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${historyLoading ? "animate-spin" : ""}`} />
              {historyLoading ? "Syncing…" : "Sync History"}
            </Button>
          </div>
        </div>
      </div>


      {/* Quick Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <RefreshCcw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total Swaps
              </p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {historyTotal}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 rounded-xl">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Individual Meters
              </p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {historyRecords.filter((r) => r.meterType === "individual").length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Bulk Supply Meters
              </p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {historyRecords.filter((r) => r.meterType === "bulk").length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                This Month
              </p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {stats.thisMonth}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 max-w-md grid grid-cols-2">
          <TabsTrigger
            value="record"
            className="rounded-xl font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm flex items-center gap-2"
          >
            <Gauge className="h-4 w-4" />
            Record Meter Swap
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-xl font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            Change History ({historyTotal})
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: RECORD METER CHANGE ─── */}
        <TabsContent value="record" className="space-y-6 outline-none">
          {!canCreate ? (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 p-6 rounded-2xl text-center">
              <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300">
                Permission Required
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 max-w-md mx-auto mt-1">
                You do not have permission to execute meter changes. You can view past changes under the "Change History" tab.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab("history")}
              >
                Go to History
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Meter Type & Customer Search (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                  <CardHeader className="bg-slate-50/70 dark:bg-slate-900/50 pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Search className="h-4 w-4 text-emerald-600" />
                      1. Select Target Meter
                    </CardTitle>
                    <CardDescription>
                      Choose meter category and lookup the customer key
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    {/* Meter Type Toggle */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase">
                        Meter Type
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setMeterType("individual");
                            setSelectedEntity(null);
                            setCustomerSearch("");
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            meterType === "individual"
                              ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <User className="h-5 w-5 mb-1 text-emerald-600" />
                          <div className="text-xs font-bold">Individual</div>
                          <div className="text-[10px] text-muted-foreground">
                            Residential / Commercial
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMeterType("bulk");
                            setSelectedEntity(null);
                            setCustomerSearch("");
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            meterType === "bulk"
                              ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <Building2 className="h-5 w-5 mb-1 text-blue-600" />
                          <div className="text-xs font-bold">Bulk Supply</div>
                          <div className="text-[10px] text-muted-foreground">
                            Sub-meters / Mains
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Customer Key Lookup Input */}
                    <div className="space-y-2 relative">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase">
                        {meterType === "individual"
                          ? "Customer Key Number"
                          : "Bulk Meter Key Number"}
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            placeholder={
                              meterType === "individual"
                                ? "e.g. 100001, CUST-..."
                                : "e.g. BM-001..."
                            }
                            value={customerSearch}
                            onChange={(e) => {
                              setCustomerSearch(e.target.value);
                              setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            className="rounded-xl pr-8"
                          />
                          {isSearchingEntity && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground absolute right-2.5 top-3" />
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleSelectCustomerKey(customerSearch)}
                          disabled={!customerSearch.trim() || isSearchingEntity}
                          className="rounded-xl shrink-0"
                        >
                          Lookup
                        </Button>
                      </div>

                      {/* Autocomplete Dropdown */}
                      {showSuggestions && searchSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                          <div className="p-1.5 space-y-1">
                            {searchSuggestions.map((s) => (
                              <button
                                key={s.key}
                                type="button"
                                onClick={() => handleSelectCustomerKey(s.key)}
                                className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between group"
                              >
                                <div>
                                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600">
                                    {s.name}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    Key: {s.key} • Meter: {s.meter}
                                  </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Matched Entity Banner */}
                    {selectedEntity ? (
                      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-emerald-600 text-white font-medium text-[11px]">
                            Active Record
                          </Badge>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                            {selectedEntity.customerKeyNumber}
                          </span>
                        </div>

                        <div>
                          <div className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                            {selectedEntity.name}
                          </div>
                          <div className="text-xs text-emerald-800/80 dark:text-emerald-300">
                            Status: {selectedEntity.status || "Active"} • Branch:{" "}
                            {selectedEntity.branchId || "N/A"}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs">
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">
                              Meter Serial
                            </span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                              {selectedEntity.meterNumber || "Unassigned"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">
                              Meter Size / Dials
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {selectedEntity.meterSize || 0.5}" ({selectedEntity.numberOfDials || 5} Dials)
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">
                              Last Reading
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {selectedEntity.currentReading} m³
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">
                              Prev Reading
                            </span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {selectedEntity.previousReading} m³
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-muted-foreground space-y-1">
                        <Gauge className="h-8 w-8 mx-auto text-slate-400" />
                        <p className="text-xs font-medium">No meter selected</p>
                        <p className="text-[11px]">
                          Search by key number or customer name above
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Swap Form Fields (8 cols) */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                  <CardHeader className="bg-slate-50/70 dark:bg-slate-900/50 pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4 text-emerald-600" />
                      2. Meter Replacement Details & Specs
                    </CardTitle>
                    <CardDescription>
                      Retire the existing meter, register new hardware specifications, and set the starting index
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Two-card Comparison Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Old Meter Retirement Card */}
                      <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10 space-y-4">
                        <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 font-bold text-sm">
                          <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4" />
                            Old Meter (Retiring)
                          </div>
                          {selectedEntity && (
                            <Badge variant="outline" className="border-rose-300 text-rose-700 text-[10px]">
                              Size: {selectedEntity.meterSize || 0.5}"
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Old Meter Serial Number *
                          </Label>
                          <Input
                            value={oldMeterNumber}
                            onChange={(e) => setOldMeterNumber(e.target.value)}
                            placeholder="Current meter number"
                            className="rounded-xl font-mono"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Final / Closing Reading (m³) *
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={oldMeterClosingReading}
                            onChange={(e) => setOldMeterClosingReading(e.target.value)}
                            placeholder="Final index on removed meter"
                            className="rounded-xl font-mono text-base font-bold"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Dial index at physical removal.
                          </p>
                        </div>

                        {/* Unbilled consumption badge */}
                        {oldMeterConsumption !== null && (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 text-xs space-y-1">
                            <div className="flex items-center justify-between font-semibold">
                              <span className="text-muted-foreground">
                                Unbilled Old Meter Usage:
                              </span>
                              <span
                                className={`font-bold font-mono text-sm ${
                                  oldMeterConsumption < 0
                                    ? "text-rose-600"
                                    : "text-slate-900 dark:text-slate-100"
                                }`}
                              >
                                {oldMeterConsumption.toFixed(2)} m³
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Logged in official audit slip to ensure billing continuity.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* New Meter Installation Card */}
                      <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10 space-y-4">
                        <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            New Meter (Installing)
                          </div>
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-[10px]">
                            New Baseline
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            New Meter Serial Number *
                          </Label>
                          <Input
                            value={newMeterNumber}
                            onChange={(e) => setNewMeterNumber(e.target.value)}
                            placeholder="e.g. MTR-2024-9988"
                            className="rounded-xl font-mono"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Initial / Opening Reading (m³) *
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={newMeterOpeningReading}
                            onChange={(e) => setNewMeterOpeningReading(e.target.value)}
                            placeholder="Usually 0 for brand new meter"
                            className="rounded-xl font-mono text-base font-bold"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Baseline reading for future monthly billing cycles.
                          </p>
                        </div>

                        {/* Meter Specs (Size, Dials, Seal) */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              New Meter Size (Tariff Rent)
                            </Label>
                            <select
                              value={newMeterSize}
                              onChange={(e) => setNewMeterSize(parseFloat(e.target.value))}
                              className="w-full h-9 px-2.5 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              {METER_SIZE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              Security Seal #
                            </Label>
                            <Input
                              value={newSealNumber}
                              onChange={(e) => setNewSealNumber(e.target.value)}
                              placeholder="e.g. SL-98441"
                              className="rounded-xl text-xs h-9 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Operational Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Date of Physical Replacement *
                        </Label>
                        <Input
                          type="date"
                          value={changeDate}
                          onChange={(e) => setChangeDate(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Primary Reason for Replacement
                        </Label>
                        <select
                          value={selectedReason}
                          onChange={(e) => setSelectedReason(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {COMMON_REASONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Additional Notes */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Field Observations & Job Order Notes (Optional)
                      </Label>
                      <Textarea
                        value={customNotes}
                        onChange={(e) => setCustomNotes(e.target.value)}
                        placeholder="Additional details, technician badge #, seal condition, premises observations..."
                        rows={2}
                        className="rounded-xl resize-none"
                      />
                    </div>

                    {/* Visual Swap Preview Strip */}
                    {selectedEntity && newMeterNumber.trim() && (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300">
                            OLD
                          </Badge>
                          <span className="font-mono font-bold">{oldMeterNumber}</span>
                          <span className="text-muted-foreground">
                            (Closed @ {oldMeterClosingReading || 0} m³ | {selectedEntity.meterSize || 0.5}")
                          </span>
                        </div>

                        <ArrowRight className="h-4 w-4 text-emerald-600 hidden sm:block" />

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                            NEW
                          </Badge>
                          <span className="font-mono font-bold">{newMeterNumber}</span>
                          <span className="text-muted-foreground">
                            (Starts @ {newMeterOpeningReading || 0} m³ | {newMeterSize}")
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        size="lg"
                        onClick={() => {
                          if (validateForm()) {
                            setShowConfirmModal(true);
                          }
                        }}
                        disabled={!selectedEntity || isSubmitting}
                        className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-600/20"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Recording Replacement...
                          </>
                        ) : (
                          <>
                            <RefreshCcw className="h-5 w-5 mr-2" />
                            Execute Meter Change
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── TAB 2: CHANGE HISTORY & AUDIT LOG ─── */}
        <TabsContent value="history" className="space-y-4 outline-none">
          <Card className="border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-900/50 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <History className="h-4 w-4 text-emerald-600" />
                    Meter Change Audit History
                  </CardTitle>
                  <CardDescription>
                    Complete chronological log of physical meter replacements with rollback protection
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    className="rounded-xl border-slate-300 dark:border-slate-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Filters bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-3">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer key..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") loadHistory(1, historyPageSize);
                    }}
                    className="pl-9 rounded-xl text-xs h-9"
                  />
                </div>

                <div>
                  <select
                    value={historyTypeFilter}
                    onChange={(e) => setHistoryTypeFilter(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">All Meter Types</option>
                    <option value="individual">Individual Customer Meters</option>
                    <option value="bulk">Bulk Supply Meters</option>
                  </select>
                </div>

                <div>
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active Changes</option>
                    <option value="Voided">Voided / Reverted</option>
                  </select>
                </div>

                <div>
                  <Input
                    type="date"
                    value={historyFromDate}
                    onChange={(e) => setHistoryFromDate(e.target.value)}
                    placeholder="From Date"
                    className="rounded-xl text-xs h-9"
                  />
                </div>

                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={historyToDate}
                    onChange={(e) => setHistoryToDate(e.target.value)}
                    placeholder="To Date"
                    className="rounded-xl text-xs h-9"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => loadHistory(1, historyPageSize)}
                    className="rounded-xl h-9 px-3"
                  >
                    Filter
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <p className="text-sm">Loading meter change logs...</p>
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-2">
                  <History className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="text-base font-medium">No meter change records found</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Try adjusting your search criteria or record a new meter replacement from the "Record Meter Swap" tab.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-muted-foreground font-semibold">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer Key</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Old Meter (# & Size)</th>
                        <th className="py-3 px-4 text-right">Closing (m³)</th>
                        <th className="py-3 px-4">New Meter (# & Size)</th>
                        <th className="py-3 px-4 text-right">Opening (m³)</th>
                        <th className="py-3 px-4">Seal #</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Performed By</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {historyRecords.map((record) => (
                        <tr
                          key={record.id}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${
                            record.status === "Voided" ? "opacity-60 bg-slate-50/30 dark:bg-slate-900/20" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-mono whitespace-nowrap">
                            {record.changeDate}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {record.customerKeyNumber}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={
                                record.meterType === "individual"
                                  ? "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200"
                                  : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200"
                              }
                            >
                              {record.meterType.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-mono text-rose-600 dark:text-rose-400">
                            <div>{record.oldMeterNumber}</div>
                            <div className="text-[10px] text-muted-foreground">{record.oldMeterSize || 0.5}"</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {record.oldMeterClosingReading.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            <div>{record.newMeterNumber}</div>
                            <div className="text-[10px] text-muted-foreground">{record.newMeterSize || 0.5}"</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {record.newMeterOpeningReading.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">
                            {record.newSealNumber || "—"}
                          </td>
                          <td className="py-3 px-4">
                            {record.status === "Voided" ? (
                              <Badge variant="destructive" className="text-[10px]">
                                Voided
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                                Active
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground truncate max-w-[120px]" title={record.performedByEmail || record.performedBy}>
                            {record.performedByEmail || record.performedBy || "Staff"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedSlipRecord(record)}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-emerald-50 text-emerald-600"
                                title="View Change Slip"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>

                              {canManage && record.status !== "Voided" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setVoidRecord(record)}
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-rose-50 text-rose-600"
                                  title="Supervisor Void / Revert"
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {historyTotal > 0 && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                  <TablePagination
                    count={historyTotal}
                    page={historyPage - 1}
                    rowsPerPage={historyPageSize}
                    onPageChange={(newPage: number) => {
                      const next = newPage + 1;
                      setHistoryPage(next);
                      loadHistory(next, historyPageSize);
                    }}
                    onRowsPerPageChange={(newSize: number) => {
                      setHistoryPageSize(newSize);
                      setHistoryPage(1);
                      loadHistory(1, newSize);
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog before executing swap */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-bold">
              Confirm Meter Replacement
            </DialogTitle>
            <DialogDescription className="text-sm">
              Please double check the values before committing. This action updates the live meter serial, meter size, and baseline readings for billing.
            </DialogDescription>
          </DialogHeader>

          {selectedEntity && (
            <div className="space-y-3 py-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Account:</span>
                  <span className="font-bold">{selectedEntity.customerKeyNumber} ({selectedEntity.name})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meter Category:</span>
                  <span className="capitalize font-semibold">{meterType}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span className="text-rose-600 font-semibold">Retiring Meter:</span>
                  <span className="font-mono font-bold">{oldMeterNumber} (Closed @ {oldMeterClosingReading} m³ | {selectedEntity.meterSize || 0.5}")</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-600 font-semibold">New Installed Meter:</span>
                  <span className="font-mono font-bold">{newMeterNumber} (Starts @ {newMeterOpeningReading} m³ | {newMeterSize}")</span>
                </div>
                {newSealNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Seal Number:</span>
                    <span className="font-mono font-semibold">{newSealNumber}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span className="text-muted-foreground">Replacement Date:</span>
                  <span className="font-mono">{changeDate}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleExecuteChange}
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isSubmitting ? "Executing..." : "Confirm & Execute Swap"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supervisor Void / Rollback Dialog */}
      <Dialog open={!!voidRecord} onOpenChange={(open) => !open && setVoidRecord(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <div className="h-12 w-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mb-3">
              <Undo2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-rose-700 dark:text-rose-400">
              Rollback / Void Meter Change
            </DialogTitle>
            <DialogDescription className="text-xs">
              This supervisor action will restore the previous meter number and readings for account <strong>{voidRecord?.customerKeyNumber}</strong>.
            </DialogDescription>
          </DialogHeader>

          {voidRecord && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-bold">{voidRecord.customerKeyNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revert To Meter:</span>
                  <span className="font-mono font-bold text-rose-700">{voidRecord.oldMeterNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revert To Reading:</span>
                  <span className="font-mono font-bold">{voidRecord.oldMeterClosingReading} m³</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reason for Rollback / Void *
                </Label>
                <Textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="State why this change is being cancelled (e.g. data entry error, meter was not swapped)..."
                  rows={3}
                  className="rounded-xl resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVoidRecord(null)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleVoidMeterChange}
              disabled={isVoiding || !voidReason.trim()}
              className="rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isVoiding ? "Reverting..." : "Confirm Rollback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meter Change Slip / Certificate Modal */}
      <Dialog
        open={!!selectedSlipRecord}
        onOpenChange={(open) => !open && setSelectedSlipRecord(null)}
      >
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  Certificate of Meter Replacement
                </DialogTitle>
                <DialogDescription className="text-xs">
                  AAWSA Field Operation Audit Record #{selectedSlipRecord?.id.slice(0, 8)}
                </DialogDescription>
              </div>
              <Badge className={selectedSlipRecord?.status === "Voided" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}>
                {selectedSlipRecord?.status === "Voided" ? "VOIDED" : "AUDITED"}
              </Badge>
            </div>
          </DialogHeader>

          {selectedSlipRecord && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                    Account Key
                  </span>
                  <span className="font-mono font-bold text-sm">
                    {selectedSlipRecord.customerKeyNumber}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                    Meter Category
                  </span>
                  <Badge variant="outline" className="capitalize text-xs">
                    {selectedSlipRecord.meterType}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                    Date Executed
                  </span>
                  <span className="font-mono font-medium">
                    {selectedSlipRecord.changeDate}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                    Field Technician / Staff
                  </span>
                  <span className="truncate block font-medium">
                    {selectedSlipRecord.performedByEmail || selectedSlipRecord.performedBy || "Authorized Staff"}
                  </span>
                </div>
              </div>

              {/* Side-by-side meter details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-rose-700">
                    Retiring Meter
                  </div>
                  <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                    {selectedSlipRecord.oldMeterNumber}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Size: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedSlipRecord.oldMeterSize || 0.5}"</span>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Closing Dial: <span className="font-bold text-slate-800 dark:text-slate-200">{selectedSlipRecord.oldMeterClosingReading} m³</span>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Unbilled Delta: <span className="font-bold text-rose-700">{selectedSlipRecord.closingConsumption || 0} m³</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">
                    Installed Meter
                  </div>
                  <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                    {selectedSlipRecord.newMeterNumber}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Size: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedSlipRecord.newMeterSize || 0.5}"</span> ({selectedSlipRecord.newDialCount || 5} Dials)
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Opening Dial: <span className="font-bold text-slate-800 dark:text-slate-200">{selectedSlipRecord.newMeterOpeningReading} m³</span>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Seal #: <span className="font-mono font-semibold text-emerald-700">{selectedSlipRecord.newSealNumber || "N/A"}</span>
                  </div>
                </div>
              </div>

              {selectedSlipRecord.notes && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Reason & Field Observations
                  </span>
                  <p className="text-slate-700 dark:text-slate-300">
                    {selectedSlipRecord.notes}
                  </p>
                </div>
              )}

              {/* Signature Blocks for Official Print Out */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Field Technician Signature
                  </span>
                  <div className="h-10 border-b border-dashed border-slate-400" />
                  <span className="text-[10px] text-muted-foreground">Date: _______________</span>
                </div>
                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Customer / Premise Acknowledgment
                  </span>
                  <div className="h-10 border-b border-dashed border-slate-400" />
                  <span className="text-[10px] text-muted-foreground">Date: _______________</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-3">
            <span className="text-[10px] text-muted-foreground">
              AAWSA Bulk Billing Operational Audit
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="rounded-xl text-xs"
              >
                <Printer className="h-3.5 w-3.5 mr-1" />
                Print Certificate
              </Button>
              <Button
                size="sm"
                onClick={() => setSelectedSlipRecord(null)}
                className="rounded-xl text-xs bg-slate-900 text-white"
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MeterChangeView(props: MeterChangeViewProps) {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm">Loading Meter Change Management...</p>
      </div>
    }>
      <MeterChangeContent {...props} />
    </Suspense>
  );
}

export default MeterChangeView;
