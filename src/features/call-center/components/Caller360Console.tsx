"use client";

import * as React from "react";
import {
  Search,
  User,
  Users,
  CheckCircle2,
  Clock,
  Send,
  History,
  Droplets,
  DollarSign,
  FileText,
  Loader2,
  Pencil,
  Save,
  X,
  Gauge,
  Receipt,
  Ticket,
  RefreshCw,
  Info,
  AlertCircle,
  AlertTriangle,
  Phone,
  MapPin,
  Building2,
  Headphones,
  Calendar,
  CheckCircle,
  XCircle,
  Menu,
  Eye,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
  Smartphone,
  Smile,
  Meh,
  Frown,
  Flame,
  Activity,
  Layers,
  ChevronDown,
  Printer,
} from "lucide-react";
import { BillExplainerModal } from "./BillExplainerModal";
import { ConsumptionTrendChart } from "./ConsumptionTrendChart";
import { QuickTicketModal } from "./QuickTicketModal";
import { SmsTemplatesModal } from "./SmsTemplatesModal";
import { CustomerInvoicesModal } from "./CustomerInvoicesModal";
import { InvoicePreviewDialog } from "@/components/billing/InvoicePreviewDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import {
  searchCallerAccountAction,
  logCustomerCallAction,
  verifyLiveCallerPaymentAction,
  createCallCenterTicketAction,
  updateCallerCustomerPhoneAction,
} from "@/lib/actions";
import { getMonthlyBillAmt } from "@/lib/billing-utils";
import { getTariff, initializeTariffs } from "@/lib/data-store";
import { format } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Caller360ConsoleProps {
  isAdmin?: boolean;
}

/* ─── Small reusable sub-components ─────────────────────────────────────── */

function InfoField({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-0.5 group">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
        {copyable && value && (
          <button
            type="button"
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition"
            title={`Copy ${label}`}
          >
            {copied ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
          </button>
        )}
      </div>
      <span className={cn("text-sm font-semibold text-gray-900 break-all", mono && "font-mono")}>
        {value ?? <span className="text-gray-300 font-normal">—</span>}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status || "").toLowerCase();
  if (s === "active") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold">Active</Badge>;
  if (s === "paid") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold">Paid</Badge>;
  if (s.includes("pending")) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-semibold">{status}</Badge>;
  if (s === "unpaid") return <Badge className="bg-red-100 text-red-800 border-red-200 font-semibold">Unpaid</Badge>;
  if (s === "suspended" || s === "inactive") return <Badge className="bg-red-100 text-red-800 border-red-200 font-semibold">{status}</Badge>;
  if (s === "open") return <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-semibold">Open</Badge>;
  if (s === "resolved") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold">Resolved</Badge>;
  if (s === "closed") return <Badge className="bg-gray-100 text-gray-700 border-gray-200 font-semibold">Closed</Badge>;
  if (s === "in progress") return <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-semibold">In Progress</Badge>;
  if (s.includes("resolved_on_call")) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold">Resolved On-Call</Badge>;
  if (s.includes("ticket_created")) return <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-semibold">Escalated</Badge>;
  if (s.includes("callback")) return <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-semibold">Callback Scheduled</Badge>;
  if (s.includes("pending")) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-semibold">Pending</Badge>;
  return <Badge variant="outline" className="font-semibold">{status || "—"}</Badge>;
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function Caller360Console({ isAdmin = false }: Caller360ConsoleProps) {
  const { toast } = useToast();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const basePath = isAdmin ? "/admin" : "/staff";

  // Permission checks (pure dynamic RBAC)
  const canUpdatePhone = hasAnyPermission(
    PERMISSIONS.CALLCENTER_ACCESS,
    PERMISSIONS.STAFF_UPDATE,
  );
  const canLogCall = hasPermission(PERMISSIONS.CALLCENTER_LOG_CALL);
  const canSendSms = hasPermission(PERMISSIONS.CALLCENTER_DISPATCH_SMS);
  const canCreateTicket = hasAnyPermission(
    PERMISSIONS.SUPPORT_CREATE,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.CALLCENTER_LOG_CALL,
  );

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [summaryData, setSummaryData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState("bills");
  const [isAssocDialogOpen, setIsAssocDialogOpen] = React.useState(false);
  const [assocSearchTerm, setAssocSearchTerm] = React.useState("");
  const [assocPage, setAssocPage] = React.useState(0);
  const [assocRowsPerPage, setAssocRowsPerPage] = React.useState(10);
  const [assocPeriodFilter, setAssocPeriodFilter] = React.useState("all");

  // Call form
  const [callType, setCallType] = React.useState("inbound");
  const [category, setCategory] = React.useState("billing_dispute");
  const [resolutionStatus, setResolutionStatus] = React.useState("resolved_on_call");
  const [notes, setNotes] = React.useState("");
  const [isLoggingCall, setIsLoggingCall] = React.useState(false);

  // Phone update
  const [isEditingPhone, setIsEditingPhone] = React.useState(false);
  const [newPhone, setNewPhone] = React.useState("");
  const [phoneUpdateNotes, setPhoneUpdateNotes] = React.useState("");
  const [isSavingPhone, setIsSavingPhone] = React.useState(false);

  // Modals & Power Tools State
  const [selectedBillForExplainer, setSelectedBillForExplainer] = React.useState<{ bill: any; recon: any } | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = React.useState(false);
  const [isQuickTicketOpen, setIsQuickTicketOpen] = React.useState(false);
  const [isSmsTemplatesOpen, setIsSmsTemplatesOpen] = React.useState(false);
  const [selectedSmsTemplateId, setSelectedSmsTemplateId] = React.useState<string>("bill_notice");
  const [isInvoicesModalOpen, setIsInvoicesModalOpen] = React.useState(false);
  const [selectedBillForInvoicePreview, setSelectedBillForInvoicePreview] = React.useState<any | null>(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = React.useState(false);

  // Live payment check state
  const [isVerifyingPayment, setIsVerifyingPayment] = React.useState(false);
  const [livePaymentResult, setLivePaymentResult] = React.useState<{
    checked: boolean;
    found: boolean;
    payment?: any;
  } | null>(null);

  // Active Tariff for authoritative debt aging, penalties, and threshold calculations
  const [activeTariff, setActiveTariff] = React.useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    initializeTariffs()
      .then(() => {
        if (!isMounted) return;
        const rawType = summaryData?.customer?.customerType || (summaryData?.customer as any)?.chargeGroup || "Non-domestic";
        const validTypes = ["Domestic", "Non-domestic", "rental Non domestic", "rental domestic"];
        const chargeGroup = (validTypes.includes(rawType)
          ? rawType
          : summaryData?.customer?.type === "Individual Customer"
            ? "Domestic"
            : "Non-domestic") as any;
        const t = getTariff(chargeGroup, format(new Date(), "yyyy-MM"));
        setActiveTariff(t || null);
      })
      .catch((err) => {
        console.error("Failed to load tariffs in Caller360Console", err);
      });
    return () => {
      isMounted = false;
    };
  }, [summaryData?.customer?.customerType, (summaryData?.customer as any)?.chargeGroup, summaryData?.customer?.type]);

  // Caller sentiment state
  const [callerSentiment, setCallerSentiment] = React.useState<string>("neutral");

  // Search input ref for keyboard shortcut
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  // Timer
  const [callDuration, setCallDuration] = React.useState(0);
  const [isTimerRunning, setIsTimerRunning] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning]);

  // Global power-user keyboard shortcuts: / or Ctrl+K (search), Alt+T (timer), Alt+S (save), Alt+1..5 (tabs)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((e.key === "/" && !isInput) || (e.ctrlKey && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setIsTimerRunning((prev) => !prev);
        return;
      }

      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!summaryData?.customer) {
          toast({ variant: "destructive", title: "No Customer Loaded", description: "Search for a customer before saving a call log." });
          return;
        }
        handleLogCall();
        return;
      }

      if (e.altKey && ["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        const tabMap: Record<string, string> = {
          "1": "bills",
          "2": "readings",
          "3": "associated",
          "4": "tickets",
          "5": "prior",
        };
        setActiveTab(tabMap[e.key]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const formatTimer = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  /* ── Handlers ─────────────────────────────────────────────────────────── */

  const inspectCustomer = async (key: string) => {
    if (!key) return;
    setSearchTerm(key);
    setIsSearching(true);
    try {
      const res = await searchCallerAccountAction(key);
      if (res && res.customer) {
        setSummaryData(res);
        setActiveTab("bills");
        setAssocPage(0);
        setAssocSearchTerm("");
        setAssocPeriodFilter("all");
        setIsTimerRunning(true);
        toast({ title: "Account Switched", description: `Loaded 360° console for ${res.customer.name} (${key}).` });
      } else {
        toast({ title: "Account Not Found", description: `No records found for key "${key}".` });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Search Error", description: err?.message || "Failed to switch customer." });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchTerm.trim();
    if (!q) {
      toast({ variant: "destructive", title: "Search Required", description: "Enter a phone number, customer key, meter serial, contract number, or name." });
      return;
    }
    setIsSearching(true);
    try {
      const res = await searchCallerAccountAction(q);
      if (res) {
        setSummaryData(res);
        setActiveTab("bills");
        setAssocPage(0);
        setAssocSearchTerm("");
        setAssocPeriodFilter("all");
        if (res.customer) {
          setIsTimerRunning(true);
        } else {
          toast({ title: "No Account Found", description: "No matching customer account. You can still log the inquiry." });
        }
      } else {
        setSummaryData(null);
        toast({ title: "No Record Found", description: `No records matching "${q}".` });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Search Error", description: err?.message || "Failed to search." });
    } finally {
      setIsSearching(false);
    }
  };

  const handleLogCall = async () => {
    if (!category) {
      toast({ variant: "destructive", title: "Category Required", description: "Select an inquiry category." });
      return;
    }
    setIsLoggingCall(true);
    try {
      const callerPhone = summaryData?.customer?.phone || searchTerm.trim() || "Unknown";
      const callerName = summaryData?.customer?.name || "Caller";
      const customerKey = summaryData?.customer?.customerKey || null;
      const branchName = summaryData?.customer?.branchName || null;
      await logCustomerCallAction({
        caller_phone: callerPhone,
        caller_name: callerName,
        customer_key_number: customerKey,
        branch_name: branchName,
        call_type: callType,
        category,
        duration_seconds: callDuration,
        resolution_status: resolutionStatus,
        notes,
        sentiment: callerSentiment,
      });
      toast({ title: "✓ Call Logged", description: `Interaction saved — duration ${formatTimer(callDuration)}.` });
      setIsTimerRunning(false);
      setCallDuration(0);
      setNotes("");
      setCallerSentiment("neutral");
      if (customerKey) {
        const fresh = await searchCallerAccountAction(customerKey);
        if (fresh) setSummaryData(fresh);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Log Failed", description: err?.message || "Could not save call." });
    } finally {
      setIsLoggingCall(false);
    }
  };

  const handleVerifyLivePayment = async () => {
    const customerKey = summaryData?.customer?.customerKey;
    if (!customerKey) return;
    setIsVerifyingPayment(true);
    try {
      const res = await verifyLiveCallerPaymentAction(customerKey);
      if (res && res.found && res.latestPayment) {
        setLivePaymentResult({ checked: true, found: true, payment: res.latestPayment });
        toast({
          title: "Payment Confirmed!",
          description: `Found recent payment of ${Number(res.latestPayment.amount_paid).toLocaleString()} ETB via ${res.latestPayment.payment_method || "Mobile Banking"}.`,
        });
        const fresh = await searchCallerAccountAction(customerKey);
        if (fresh) setSummaryData(fresh);
      } else {
        setLivePaymentResult({ checked: true, found: false });
        toast({
          title: "No Recent Payments Found",
          description: "No mobile banking or branch payment records detected in past 72 hours.",
        });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Verification Error", description: err?.message || "Failed to check payments." });
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const handleRefresh = async () => {
    const key = summaryData?.customer?.customerKey || searchTerm.trim();
    if (!key) return;
    setIsSearching(true);
    try {
      const res = await searchCallerAccountAction(key);
      if (res) {
        setSummaryData(res);
        toast({ title: "Data Refreshed", description: "Billing history and account information updated." });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Refresh Error", description: err?.message || "Failed to refresh." });
    } finally {
      setIsSearching(false);
    }
  };

  const openSmsPreview = (templateId: string = "bill_notice") => {
    setSelectedSmsTemplateId(templateId);
    setIsSmsTemplatesOpen(true);
  };

  const handleUpdatePhone = async () => {
    if (!newPhone.trim()) {
      toast({ variant: "destructive", title: "Invalid Phone", description: "Enter a valid phone number." });
      return;
    }
    const customerKey = summaryData?.customer?.customerKey;
    if (!customerKey) return;
    setIsSavingPhone(true);
    try {
      const res = await updateCallerCustomerPhoneAction({ customerKey, newPhone: newPhone.trim(), notes: phoneUpdateNotes.trim() });
      if (res?.success) {
        toast({ title: "Phone Updated", description: `Updated to ${newPhone.trim()} for ${res.customerName}.` });
        setIsEditingPhone(false);
        setPhoneUpdateNotes("");
        const fresh = await searchCallerAccountAction(customerKey);
        if (fresh) setSummaryData(fresh);
      } else throw new Error("Update failed");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err?.message || "Could not update phone." });
    } finally {
      setIsSavingPhone(false);
    }
  };

  const clearSearch = () => {
    setSummaryData(null);
    setSearchTerm("");
    setIsTimerRunning(false);
    setCallDuration(0);
    setIsEditingPhone(false);
  };

  const insertQuickNote = (snippet: string) =>
    setNotes((p) => p ? `${p} · ${snippet}` : snippet);

  /* ── Derived state ────────────────────────────────────────────────────── */

  const customer = summaryData?.customer;
  const recentBills = summaryData?.recentBills || [];
  const recentReadings = summaryData?.recentReadings || [];
  const associatedCustomers = summaryData?.associatedCustomers || [];
  const parentBulkMeter = summaryData?.parentBulkMeter || null;
  const tickets = summaryData?.tickets || [];
  const priorCalls = summaryData?.priorCalls || [];

  // Reconstruct aging map from oldest to newest matching portal standard formula identical to Bulk Meter Details
  const reconstructedHistoryMap = React.useMemo(() => {
    if (!recentBills || !recentBills.length) return new Map<string, any>();
    const results = new Map<string, any>();
    let carriedForwardUnpaid = 0; // The core debt base (Arrears from previous month)

    // Process from OLDEST to NEWEST
    const historyOldestFirst = [...recentBills].sort((a, b) => {
      const getBillDate = (x: any) => {
        if (x.bill_period_end_date) return new Date(x.bill_period_end_date).getTime();
        if (x.billPeriodEndDate) return new Date(x.billPeriodEndDate).getTime();
        if (x.bill_period_start_date) return new Date(x.bill_period_start_date).getTime();
        if (x.month_year) return new Date(`${x.month_year}-01`).getTime();
        if (x.monthYear) return new Date(`${x.monthYear}-01`).getTime();
        if (x.created_at) return new Date(x.created_at).getTime();
        if (x.createdAt) return new Date(x.createdAt).getTime();
        return 0;
      };
      const diff = getBillDate(a) - getBillDate(b);
      if (diff !== 0) return diff;
      const cA = a.created_at || a.createdAt ? new Date(a.created_at || a.createdAt).getTime() : 0;
      const cB = b.created_at || b.createdAt ? new Date(b.created_at || b.createdAt).getTime() : 0;
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

      const threshold = activeTariff?.penalty_month_threshold ?? 3;
      const bankRate = Number(activeTariff?.bank_lending_rate ?? 0.15);
      const tieredRates = Array.isArray(activeTariff?.penalty_tiered_rates) ? activeTariff.penalty_tiered_rates : [];

      // 1. Current Arrears Base (everything unpaid from row before)
      const arrearsSum = carriedForwardUnpaid;

      // 2. Penalty Calculation
      // Determine the "max age" of the debt to pick a tiered rate
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

      const isPenaltyEnabled = activeTariff?.penalty_enabled !== false;
      if (isPenaltyEnabled && maxAge >= threshold) {
        const applicableTier = [...tieredRates].sort((a, b) => b.month - a.month).find((t: any) => maxAge >= t.month);
        const totalRate = bankRate + Number(applicableTier?.rate || 0);
        penalty = arrearsSum * totalRate;
      } else {
        penalty = 0;
      }

      // 3. Current Month Monthly Part (0 if voided)
      const normalizedBill = {
        ...bill,
        THISMONTHBILLAMT: bill.THISMONTHBILLAMT ?? bill.this_month_bill_amt ?? bill.thisMonthBillAmt,
        TOTALBILLAMOUNT: bill.TOTALBILLAMOUNT ?? bill.total_bill_amount ?? bill.totalBillAmount,
        OUTSTANDINGAMT: bill.OUTSTANDINGAMT ?? bill.outstanding_amt ?? bill.outstandingAmt,
        PENALTYAMT: bill.PENALTYAMT ?? bill.penalty_amt ?? bill.penaltyAmt,
      };
      const currentMonthlyCharge = isVoided ? 0 : getMonthlyBillAmt(normalizedBill);

      // 4. Totals & Dynamic Reconstruction for THIS row
      const totalD60AndLegacy = d60_bucket + legacyDebt;

      // Reconstruct exactly from buckets as per business rule
      const derivedOutstanding = d30_bucket + d30_60_bucket + totalD60AndLegacy + penalty;
      const totalPayable = isVoided ? 0 : derivedOutstanding + currentMonthlyCharge;

      // 5. Calculate Carried Forward UNPAID for the NEXT Month
      const amtPaid = isVoided ? 0 : Number(bill.amountPaid || bill.amount_paid || 0);
      const billUnpaid = Math.max(0, totalPayable - amtPaid);
      const derivedPaymentStatus = bill.paymentStatus === 'Paid' || bill.payment_status === 'Paid' || billUnpaid <= 0.01 ? 'Paid' : 'Unpaid';

      // Save results for this row under all possible identifier keys
      const reconData = {
        d30: d30_bucket,
        d30_60: d30_60_bucket,
        d60: totalD60AndLegacy,
        penalty,
        outstanding: derivedOutstanding,
        currentMonthly: currentMonthlyCharge,
        totalPayable,
        paymentStatus: derivedPaymentStatus,
      };

      if (bill.id) results.set(bill.id, reconData);
      if (bill.bill_key) results.set(bill.bill_key, reconData);
      if (bill.BILLKEY) results.set(bill.BILLKEY, reconData);
      if (bill.month_year) results.set(bill.month_year, reconData);
      if (bill.monthYear) results.set(bill.monthYear, reconData);

      // The business rule: previous Penalty must be carried forward and included in the arrears,
      // which will naturally cascade down into Debit_60 as legacy debt since it doesn't fit the newer buckets.
      const debtForNextMonth = d30_bucket + d30_60_bucket + totalD60AndLegacy + currentMonthlyCharge + penalty;
      carriedForwardUnpaid = Math.max(0, debtForNextMonth - amtPaid);

      // 6. Update Aging Buckets for the NEXT cycle (payments cover oldest debt first)
      let remainingPayment = amtPaid;

      // Deduct from d60 and legacy
      const paidAgainstOldest = Math.min(remainingPayment, totalD60AndLegacy);
      const remaining_d60_plus_legacy = Math.max(0, totalD60AndLegacy - paidAgainstOldest);
      remainingPayment -= paidAgainstOldest;

      // Deduct from penalty
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
  }, [recentBills, activeTariff]);

  const handleOpenInvoicePreview = (bill: any) => {
    setSelectedBillForInvoicePreview(bill);
    setIsInvoicePreviewOpen(true);
  };

  const invoiceMeterData = React.useMemo(() => {
    if (!customer) return null;
    return {
      customerKeyNumber: customer.customerKey,
      name: customer.name,
      contractNumber: customer.contractNumber,
      meterNumber: customer.meterNumber,
      meterKey: customer.meterNumber,
      meterSize: customer.meterSize ? Number(customer.meterSize) : null,
      specificArea: customer.specificArea,
      subCity: customer.subCity,
      woreda: customer.woreda,
      phoneNumber: customer.phone,
      chargeGroup: customer.customerType,
      sewerageConnection: customer.sewerageConnection,
      branchName: customer.branchName,
    };
  }, [customer]);

  const invoiceBillData = React.useMemo(() => {
    if (!selectedBillForInvoicePreview || !customer) return null;
    const b = selectedBillForInvoicePreview;
    const rowKey = b.id || b.bill_key || b.BILLKEY || b.month_year;
    const recon = reconstructedHistoryMap.get(rowKey);

    return {
      ...b,
      CUSTOMERKEY: customer.customerKey,
      BILLKEY: b.bill_key || b.BILLKEY || b.id || "INV-001",
      monthYear: b.month_year || b.MONTHYEAR || b.month || "Current",
      PREVREAD: Number(b.prev_read ?? b.prevRead ?? b.PREVREAD ?? 0),
      CURRREAD: Number(b.curr_read ?? b.currRead ?? b.CURRREAD ?? 0),
      CONS: Number(b.cons ?? b.CONS ?? 0),
      differenceUsage: Number(b.difference_usage ?? b.differenceUsage ?? 0),
      THISMONTHBILLAMT: recon ? recon.currentMonthly : Number(b.this_month_bill_amt ?? b.THISMONTHBILLAMT ?? b.total_bill_amount ?? 0),
      TOTALBILLAMOUNT: recon ? recon.totalPayable : Number(b.total_bill_amount ?? b.TOTALBILLAMOUNT ?? 0),
      OUTSTANDINGAMT: recon ? recon.outstanding : Number(b.outstanding ?? 0),
      PENALTYAMT: recon ? recon.penalty : Number(b.penalty_amt ?? b.PENALTYAMT ?? 0),
      dueDate: b.due_date || b.dueDate,
      paymentStatus: recon ? recon.paymentStatus : b.payment_status || b.paymentStatus || "Unpaid",
    };
  }, [selectedBillForInvoicePreview, customer, reconstructedHistoryMap]);

  // Account payment reliability badge based on history
  const accountHealth = React.useMemo(() => {
    if (!summaryData?.customer) return null;
    const unpaidCount = recentBills.filter((b: any) => {
      const recon = reconstructedHistoryMap.get(b.id || b.bill_key || b.month_year);
      const status = recon ? recon.paymentStatus : b.payment_status || "Unpaid";
      return (status || "").toLowerCase().includes("unpaid");
    }).length;

    if (unpaidCount === 0) {
      return { label: "Prompt Payer", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
    if (unpaidCount <= 2) {
      return { label: "Occasional Delay", color: "bg-amber-100 text-amber-800 border-amber-200" };
    }
    return { label: "Chronic Arrears", color: "bg-red-100 text-red-800 border-red-200" };
  }, [summaryData?.customer, recentBills, reconstructedHistoryMap]);

  // Proactive check for high bulk meter difference water loss (> 15%)
  const bulkDifferenceWaterAlert = React.useMemo(() => {
    if (!summaryData?.customer || summaryData?.customer?.type !== "Bulk Meter" || recentBills.length === 0) return null;
    const latestBill = recentBills[0];
    const prev = Number(latestBill.prev_read ?? latestBill.prevRead ?? 0);
    const curr = Number(latestBill.curr_read ?? latestBill.currRead ?? 0);
    const usage = Number(latestBill.cons ?? Math.max(0, curr - prev));
    const diff = Number(latestBill.difference_usage ?? latestBill.differenceUsage ?? 0);
    if (usage > 0 && diff > 0) {
      const ratio = (diff / usage) * 100;
      if (ratio >= 15) {
        return {
          ratio: ratio.toFixed(1),
          diffM3: diff.toFixed(1),
        };
      }
    }
    return null;
  }, [summaryData?.customer, recentBills]);

  // Distinct billing periods present on associated customers
  const availableAssocPeriods = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of associatedCustomers) {
      if (c.month && c.month !== '—' && c.month !== 'N/A') {
        set.add(c.month);
      }
    }
    return Array.from(set).sort().reverse();
  }, [associatedCustomers]);

  // Filtered associated customers for in-page search and period dropdown
  const filteredAssociatedCustomers = React.useMemo(() => {
    let list = associatedCustomers;
    if (assocPeriodFilter && assocPeriodFilter !== "all") {
      list = list.filter((c: any) => c.month === assocPeriodFilter);
    }
    if (assocSearchTerm.trim()) {
      const q = assocSearchTerm.toLowerCase();
      list = list.filter((c: any) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.customer_key && c.customer_key.toLowerCase().includes(q)) ||
        (c.meter_number && c.meter_number.toLowerCase().includes(q)) ||
        (c.contract_number && c.contract_number.toLowerCase().includes(q)) ||
        (c.phone_number && c.phone_number.includes(q))
      );
    }
    return list;
  }, [associatedCustomers, assocPeriodFilter, assocSearchTerm]);

  // Paginated associated customers for current page
  const paginatedAssociatedCustomers = React.useMemo(() => {
    const start = assocPage * assocRowsPerPage;
    return filteredAssociatedCustomers.slice(start, start + assocRowsPerPage);
  }, [filteredAssociatedCustomers, assocPage, assocRowsPerPage]);

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">

      {/* ── Search Toolbar (matches portal standard) ─────────────────── */}
      <Card className="border border-gray-200 shadow-xs">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search by Name, Customer Key, Contract No., Meter Serial, or Phone... (Press '/' or Ctrl+K)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm bg-white border-gray-200"
              />
            </div>
            <Button
              type="submit"
              disabled={isSearching}
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search Customer
            </Button>
            {summaryData && (
              <Button
                type="button"
                variant="outline"
                onClick={clearSearch}
                className="h-10 px-3 gap-1.5 text-gray-600 border-gray-200"
              >
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ── No result warning ─────────────────────────────────────────── */}
      {summaryData && !customer && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">No Account Found</AlertTitle>
          <AlertDescription className="text-amber-700 text-xs">
            No registered customer matches your search. You can still log this inquiry below.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Main two-column layout (only when customer found) ────────── */}
      {customer ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

          {/* LEFT COLUMN ─ Customer profile + tabbed history */}
          <div className="xl:col-span-8 space-y-5">

            {/* ── Customer Profile Card ─────────────────────────── */}
            <Card className="border border-gray-200 shadow-xs">
              <CardHeader className="p-4 pb-3 border-b bg-gray-50/50 flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <User className="h-4 w-4 text-blue-600 shrink-0" />
                  <CardTitle className="text-base font-bold text-gray-900">{customer.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">{customer.type}</Badge>
                  <StatusBadge status={customer.status} />
                  <StatusBadge status={customer.paymentStatus} />
                  {accountHealth && (
                    <Badge variant="outline" className={cn("text-xs font-semibold", accountHealth.color)}>
                      {accountHealth.label}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRefresh}
                  className="h-8 gap-1.5 text-gray-500 hover:text-blue-600 cursor-pointer"
                  title="Refresh customer data"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isSearching && "animate-spin text-blue-600")} />
                  <span className="text-xs hidden sm:inline">Refresh</span>
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                {/* Proactive bulk meter water loss alert */}
                {bulkDifferenceWaterAlert && (
                  <div className="mb-4 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Bulk Meter Line Loss Alert:</strong> Difference consumption ({bulkDifferenceWaterAlert.diffM3} m³) is <strong>{bulkDifferenceWaterAlert.ratio}%</strong> of master meter usage. High compound loss or unmetered flow detected.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                  <InfoField label="Customer Key" value={customer.customerKey} mono copyable />

                  {/* Phone — editable if permission granted */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-gray-500">Phone Number</span>
                      {canUpdatePhone && !isEditingPhone && (
                        <button
                          onClick={() => { setIsEditingPhone(true); setNewPhone(customer.phone || ""); }}
                          className="text-blue-500 hover:text-blue-700 transition"
                          title="Update phone number"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {isEditingPhone ? (
                      <div className="space-y-2 mt-1">
                        <Input
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="+2519..."
                          className="h-8 text-sm font-mono border-gray-300"
                          autoFocus
                        />
                        <Input
                          value={phoneUpdateNotes}
                          onChange={(e) => setPhoneUpdateNotes(e.target.value)}
                          placeholder="Reason (e.g. customer requested)..."
                          className="h-8 text-xs border-gray-300"
                        />
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={handleUpdatePhone}
                            disabled={isSavingPhone}
                            className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            {isSavingPhone ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setIsEditingPhone(false); setPhoneUpdateNotes(""); }}
                            className="h-7 text-xs px-2"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold font-mono text-gray-900">
                        {customer.phone || <span className="text-gray-300 font-normal">—</span>}
                      </span>
                    )}
                  </div>

                  <InfoField label="Contract No." value={customer.contractNumber} mono copyable />
                  <InfoField label="Meter Serial" value={customer.meterNumber} mono copyable />
                  <InfoField label="Meter Size" value={customer.meterSize ? `${customer.meterSize}" dia.` : undefined} />
                  <InfoField label="Branch" value={customer.branchName} />
                  <InfoField label="Sub-City" value={customer.subCity} />
                  <InfoField label="Woreda" value={customer.woreda} />
                  <InfoField label="Specific Area" value={customer.specificArea} />
                  <InfoField label="Customer Type" value={customer.customerType} />
                  <InfoField label="Route Key" value={customer.routeKey} mono />
                  <InfoField label="Sewerage" value={customer.sewerageConnection} />
                  {customer.email && <InfoField label="Email" value={customer.email} />}
                  {associatedCustomers.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium text-gray-500">Connected Sub-Meters</span>
                      <button
                        type="button"
                        onClick={() => setActiveTab("associated")}
                        className="text-left text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {associatedCustomers.length} Customers
                      </button>
                    </div>
                  )}
                  {parentBulkMeter && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium text-gray-500">Parent Bulk Meter</span>
                      <button
                        type="button"
                        onClick={() => inspectCustomer(parentBulkMeter.customer_key)}
                        className="text-left text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline truncate"
                        title={parentBulkMeter.name}
                      >
                        {parentBulkMeter.name} ({parentBulkMeter.customer_key})
                      </button>
                    </div>
                  )}
                </div>

                {/* Outstanding balance strip */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-blue-600" /> Outstanding Balance
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black text-gray-900 font-mono">
                        {Number(customer.outstandingBill || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-sm font-semibold text-gray-500 ml-1">ETB</span>
                      </p>
                      <button
                        type="button"
                        aria-label="Copy outstanding balance"
                        onClick={() => {
                          navigator.clipboard.writeText(String(customer.outstandingBill || 0));
                          toast({ title: "Copied Amount", description: "Copied balance to clipboard." });
                        }}
                        className="text-gray-400 hover:text-blue-600 text-xs"
                        title="Copy balance"
                      >
                        <Copy className="h-3 w-3 inline" />
                      </button>
                    </div>

                    {recentBills[0] && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Latest: <strong className="text-gray-800">{recentBills[0].month_year || "Recent"}</strong>
                        {" · "}
                        <span className="capitalize font-semibold text-blue-700">
                          {recentBills[0].status || recentBills[0].payment_status || "Issued"}
                        </span>
                      </p>
                    )}

                    {/* Live payment result feedback */}
                    {livePaymentResult && (
                      <div className="mt-1.5 text-xs">
                        {livePaymentResult.found ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle className="h-3 w-3" />
                            Verified: Paid {Number(livePaymentResult.payment.amount_paid).toLocaleString()} ETB via {livePaymentResult.payment.payment_method || "Mobile"} ({format(new Date(livePaymentResult.payment.payment_date), "MMM d, h:mm a")})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-500 font-normal bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                            <Info className="h-3 w-3" /> No payments in past 72h
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 w-full lg:w-auto">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Verify Live Payment Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleVerifyLivePayment}
                        disabled={isVerifyingPayment}
                        className="h-8 text-xs font-semibold text-emerald-700 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 gap-1.5"
                        title="Check recent mobile banking or counter payments in last 72 hours"
                      >
                        {isVerifyingPayment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        Verify Live Payment
                      </Button>

                      {/* 1-Click Explain Current Bill */}
                      {recentBills[0] && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const b = recentBills[0];
                            const recon = reconstructedHistoryMap.get(b.id || b.bill_key || b.month_year);
                            setSelectedBillForExplainer({ bill: b, recon });
                            setIsExplainerOpen(true);
                          }}
                          className="h-8 text-xs font-semibold text-blue-700 border-blue-200 bg-blue-50/60 hover:bg-blue-100 gap-1.5"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                          Explain Bill
                        </Button>
                      )}

                      {/* 1-Click Field Investigation / Support Ticket (guarded by permission) */}
                      {canCreateTicket && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsQuickTicketOpen(true)}
                          className="h-8 text-xs font-semibold text-indigo-700 border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 gap-1.5"
                        >
                          <Ticket className="h-3.5 w-3.5 text-indigo-600" />
                          New Field Ticket
                        </Button>
                      )}

                      {/* View & Copy SMS Action with Template Selector (guarded by permission) */}
                      {canSendSms && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-blue-200 text-blue-700 bg-blue-50/70 hover:bg-blue-100 hover:text-blue-900 gap-1.5 font-semibold"
                              title="Preview and customize SMS templates before copying"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                              View & Copy SMS <ChevronDown className="h-3 w-3 opacity-70" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel className="text-xs">Preview & Customize Before Copy</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openSmsPreview("bill_notice")} className="text-xs cursor-pointer">
                              <Receipt className="mr-2 h-3.5 w-3.5 text-blue-600" /> View: Bill & Due Notice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSmsPreview("telebirr_guide")} className="text-xs cursor-pointer">
                              <Smartphone className="mr-2 h-3.5 w-3.5 text-emerald-600" /> View: Telebirr / CBE Guide
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSmsPreview("bill_breakdown")} className="text-xs cursor-pointer">
                              <FileText className="mr-2 h-3.5 w-3.5 text-purple-600" /> View: Line-Item Breakdown
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSmsPreview("portal_link")} className="text-xs cursor-pointer">
                              <FileText className="mr-2 h-3.5 w-3.5 text-indigo-600" /> View: Self-Service Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSmsPreview("disconnection_warning")} className="text-xs cursor-pointer">
                              <AlertTriangle className="mr-2 h-3.5 w-3.5 text-amber-600" /> View: Overdue Warning
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openSmsPreview("bill_notice")} className="text-xs cursor-pointer font-semibold text-blue-700">
                              <Eye className="mr-2 h-3.5 w-3.5 text-blue-600" /> Open Full SMS Console...
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsInvoicesModalOpen(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      title="View all customer invoices in this console"
                    >
                      <FileText className="h-3 w-3" /> View All Invoices ({recentBills.length}) →
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Visual Consumption Trend Micro-Chart ─────────────────── */}
            <ConsumptionTrendChart bills={recentBills} />

            {/* ── Tabbed History ───────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-2">
                <TabsList className="h-9 bg-gray-100 p-0.5">
                  <TabsTrigger value="bills" className="h-8 text-xs gap-1.5 px-3">
                    <Receipt className="h-3.5 w-3.5" /> Bills
                    {recentBills.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{recentBills.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="readings" className="h-8 text-xs gap-1.5 px-3">
                    <Gauge className="h-3.5 w-3.5" /> Readings
                    {recentReadings.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{recentReadings.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="associated" className="h-8 text-xs gap-1.5 px-3">
                    <Users className="h-3.5 w-3.5" /> Associated Customers
                    {associatedCustomers.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{associatedCustomers.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="tickets" className="h-8 text-xs gap-1.5 px-3">
                    <Ticket className="h-3.5 w-3.5" /> Tickets
                    {tickets.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{tickets.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="prior" className="h-8 text-xs gap-1.5 px-3">
                    <History className="h-3.5 w-3.5" /> Call Log
                    {priorCalls.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{priorCalls.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Bills Tab */}
              <TabsContent value="bills">
                <Card className="border border-gray-200 shadow-xs">
                  <CardHeader className="p-3 pb-2 border-b bg-gray-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                          <Receipt className="h-4 w-4 text-blue-600" />
                          Billing History
                          <span className="text-gray-400 font-normal text-xs">({recentBills.length} records)</span>
                        </CardTitle>
                        <p className="text-xs text-gray-400 mt-0.5">Historical bills generated for this meter.</p>
                      </div>
                      {/* Button to view associated individual customers - switches tab in-page, stays in console */}
                      {customer && customer.type === "Bulk Meter" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveTab("associated");
                          }}
                          className="h-8 text-xs font-semibold text-blue-700 bg-blue-50/70 border-blue-200 hover:bg-blue-100 hover:text-blue-900 gap-1.5 shrink-0"
                        >
                          <Users className="h-3.5 w-3.5 text-blue-600" />
                          See Associated Individual Customers {associatedCustomers.length > 0 ? `(${associatedCustomers.length})` : ""} →
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 whitespace-nowrap">Month</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 whitespace-nowrap">Date Billed</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 text-right whitespace-nowrap">Prev. Read</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 text-right whitespace-nowrap">Curr. Read</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 whitespace-nowrap">Usage (m³)</TableHead>
                          <TableHead className="text-xs font-bold text-orange-600 py-2.5 text-right whitespace-nowrap">Diff. Usage</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 text-right whitespace-nowrap">Debit_30</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 text-right whitespace-nowrap">Debit_30_60</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 text-right whitespace-nowrap">Debit_60</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 text-right whitespace-nowrap">Penalty</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 text-right whitespace-nowrap">Outstanding</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 text-right whitespace-nowrap">Current Bill</TableHead>
                          <TableHead className="text-xs font-bold text-gray-900 py-2.5 text-right whitespace-nowrap">Total Payable</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 whitespace-nowrap">Status</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5 text-right whitespace-nowrap">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentBills.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={15} className="h-24 text-center text-sm text-gray-400">
                              <Info className="h-4 w-4 inline mr-1" />No billing records found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          recentBills.map((b: any, idx: number) => {
                            const rowKey = b.id || b.bill_key || b.BILLKEY || b.month_year || idx;
                            const recon = reconstructedHistoryMap.get(rowKey);
                            const monthYear = b.month_year || b.MONTHYEAR || b.month || `Bill ${idx + 1}`;
                            const dateBilled = b.bill_period_start_date || b.bill_period_end_date || b.created_at || null;
                            const billKey = b.bill_key || b.BILLKEY || null;
                            const prevRead = Number(b.prev_read ?? b.PREVREAD ?? b.prevRead ?? 0);
                            const currRead = Number(b.curr_read ?? b.CURRREAD ?? b.currRead ?? 0);
                            const usage = Number(b.cons ?? b.CONS ?? (currRead - prevRead));
                            const diffUsage = Number(b.difference_usage ?? b.differenceUsage ?? 0);

                            // Dynamically reconstructed aging matching portal standard
                            const debit30 = recon ? recon.d30 : Number(b.debit_30 ?? b.debit30 ?? 0);
                            const debit3060 = recon ? recon.d30_60 : Number(b.debit_30_60 ?? b.debit30_60 ?? 0);
                            const debit60 = recon ? recon.d60 : Number(b.debit_60 ?? b.debit60 ?? 0);
                            const penalty = recon ? recon.penalty : Number(b.penalty_amt ?? b.PENALTYAMT ?? 0);
                            const outstanding = recon ? recon.outstanding : Number(b.outstanding_amt ?? b.OUTSTANDINGAMT ?? (debit30 + debit3060 + debit60));
                            const currentBill = recon ? recon.currentMonthly : Number(b.this_month_bill_amt ?? b.THISMONTHBILLAMT ?? b.total_bill_amount ?? b.TOTALBILLAMOUNT ?? 0);
                            const totalAmt = recon ? recon.totalPayable : Number(b.total_bill_amount ?? b.TOTALBILLAMOUNT ?? (outstanding + currentBill));
                            const payStatus = recon ? recon.paymentStatus : (b.payment_status || b.status || "Unpaid");
                            const isUnpaid = (payStatus || "").toLowerCase() === "unpaid" || (payStatus || "").toLowerCase().includes("unpaid");

                            const fmtNum = (n: number) =>
                              n > 0.01 ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-gray-300">—</span>;

                            return (
                              <TableRow key={rowKey} className="hover:bg-blue-50/20 align-top">
                                {/* Month */}
                                <TableCell className="font-semibold text-gray-900 text-sm py-2.5 whitespace-nowrap">
                                  <div>{monthYear}</div>
                                  {billKey && (
                                    <div className="text-[10px] font-mono text-gray-400 mt-0.5">{billKey}</div>
                                  )}
                                </TableCell>
                                {/* Date Billed */}
                                <TableCell className="font-mono text-gray-600 text-xs py-2.5 whitespace-nowrap">
                                  {dateBilled ? (() => { try { return format(new Date(dateBilled), "MMM d, yyyy"); } catch { return dateBilled; } })() : "—"}
                                </TableCell>
                                {/* Prev Read */}
                                <TableCell className="font-mono text-gray-700 text-sm py-2.5 text-right whitespace-nowrap">
                                  {prevRead.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                                {/* Curr Read */}
                                <TableCell className="font-mono text-gray-700 text-sm py-2.5 text-right whitespace-nowrap">
                                  {currRead.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                                {/* Usage */}
                                <TableCell className="font-mono text-gray-800 font-semibold text-sm py-2.5 whitespace-nowrap">
                                  {usage.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                                {/* Diff Usage — orange if non-zero (matches screenshot) */}
                                <TableCell className={cn("font-mono font-bold text-sm py-2.5 text-right whitespace-nowrap", diffUsage !== 0 ? "text-orange-600" : "text-gray-300")}>
                                  {diffUsage !== 0 ? diffUsage.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                                </TableCell>
                                {/* Debit_30 */}
                                <TableCell className="font-mono text-gray-700 text-sm py-2.5 text-right whitespace-nowrap">{fmtNum(debit30)}</TableCell>
                                {/* Debit_30_60 */}
                                <TableCell className="font-mono text-gray-700 text-sm py-2.5 text-right whitespace-nowrap">{fmtNum(debit3060)}</TableCell>
                                {/* Debit_60 */}
                                <TableCell className="font-mono text-gray-700 text-sm py-2.5 text-right whitespace-nowrap">{fmtNum(debit60)}</TableCell>
                                {/* Penalty */}
                                <TableCell className={cn("font-mono text-sm py-2.5 text-right whitespace-nowrap", penalty > 0 ? "text-amber-700 font-semibold" : "text-gray-300")}>
                                  {penalty > 0 ? penalty.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                                </TableCell>
                                {/* Outstanding */}
                                <TableCell className={cn("font-mono font-bold text-sm py-2.5 text-right whitespace-nowrap", outstanding > 0 ? "text-blue-700" : "text-gray-300")}>
                                  {outstanding > 0 ? outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                                </TableCell>
                                {/* Current Bill */}
                                <TableCell className="font-mono text-gray-800 text-sm py-2.5 text-right whitespace-nowrap">
                                  {fmtNum(currentBill)}
                                </TableCell>
                                {/* Total Payable */}
                                <TableCell className={cn("font-mono font-bold text-sm py-2.5 text-right whitespace-nowrap", isUnpaid ? "text-blue-700 font-extrabold" : "text-gray-800")}>
                                  {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                                {/* Status */}
                                <TableCell className="py-2.5 whitespace-nowrap">
                                  <StatusBadge status={payStatus} />
                                </TableCell>
                                {/* Action: 1-click explain & invoice preview */}
                                <TableCell className="py-2.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenInvoicePreview(b)}
                                      className="h-7 text-[11px] px-2 text-gray-700 bg-white hover:bg-gray-50 border-gray-200 gap-1 font-semibold cursor-pointer"
                                      title="Preview Official Digital Invoice Document"
                                    >
                                      <Printer className="h-3 w-3 text-gray-500" /> Invoice
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedBillForExplainer({ bill: b, recon });
                                        setIsExplainerOpen(true);
                                      }}
                                      className="h-7 text-[11px] px-2 text-blue-700 bg-blue-50/70 hover:bg-blue-100 hover:text-blue-900 border-blue-200 gap-1 font-semibold cursor-pointer"
                                      title="Open Spoken Breakdown & Talking Script"
                                    >
                                      <Sparkles className="h-3 w-3 text-blue-600" /> Explain
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Legend matching screenshot */}
                  {recentBills.length > 0 && (
                    <div className="px-4 py-2 border-t bg-gray-50/40 text-[10px] text-gray-400 italic">
                      📝 Note: Debit_30 = bill 1 month old &nbsp;|&nbsp; Debit_30_60 = bill 2 months old &nbsp;|&nbsp; Debit_60 = bill 3+ months old &nbsp;|&nbsp; Penalty applies to bills 3+ months old only &nbsp;|&nbsp; Outstanding = all unpaid debt + current penalty
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Associated Individual Customers Tab */}
              <TabsContent value="associated">
                <Card className="border border-gray-200 shadow-xs">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between space-y-0 pb-4 gap-3 border-b bg-gray-50/50">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Associated Individual Customers
                      </CardTitle>
                      <CardDescription className="text-xs text-gray-500">
                        List of individual customers connected to this bulk meter ({associatedCustomers.length} found).
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Billing Period Filter */}
                      {availableAssocPeriods.length > 0 && (
                        <div className="flex items-center gap-1.5 border border-gray-200 rounded-md px-2 py-1 bg-white shadow-xs">
                          <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <Select
                            value={assocPeriodFilter}
                            onValueChange={(val) => {
                              setAssocPeriodFilter(val);
                              setAssocPage(0);
                            }}
                          >
                            <SelectTrigger className="w-[140px] h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 p-0 pl-1">
                              <SelectValue placeholder="All Periods" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Periods</SelectItem>
                              {availableAssocPeriods.map((p) => (
                                <SelectItem key={p} value={p}>
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {/* Search Filter */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          placeholder="Filter customers..."
                          value={assocSearchTerm}
                          onChange={(e) => {
                            setAssocSearchTerm(e.target.value);
                            setAssocPage(0);
                          }}
                          className="pl-8 h-8 text-xs w-[160px] sm:w-[200px] bg-white border-gray-200"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {associatedCustomers.length === 0 ? (
                      <div className="text-center text-gray-400 py-8 italic text-sm">
                        <Info className="h-4 w-4 inline mr-1 text-gray-400" />
                        {customer.type === "Bulk Meter"
                          ? "No individual customers are currently associated with this bulk meter."
                          : "This customer does not have sub-meter connections."}
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50 hover:bg-gray-50 border-b">
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Customer Name</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Cust. Key</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Meter No.</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Month</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Prev. Reading</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Curr. Reading</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Usage (m³)</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Bill (ETB)</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 text-center whitespace-nowrap">Pay Status</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 text-center whitespace-nowrap">Status</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedAssociatedCustomers.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={11} className="h-24 text-center text-sm text-gray-400">
                                    No customers match your filter.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                paginatedAssociatedCustomers.map((ic: any, idx: number) => {
                                  const isPaid = (ic.payment_status || "").toLowerCase() === "paid";
                                  const isUnpaid = (ic.payment_status || "").toLowerCase() === "unpaid";
                                  const isActive = (ic.status || "").toLowerCase() === "active";
                                  const prevRead = Number(ic.previous_reading || 0);
                                  const currRead = Number(ic.current_reading || 0);
                                  const usage = Number(ic.usage || Math.max(0, currRead - prevRead));
                                  const billAmt = Number(ic.calculated_bill || 0);

                                  return (
                                    <TableRow key={ic.customer_key || idx} className="hover:bg-blue-50/20">
                                      <TableCell className="font-medium text-xs text-gray-900 py-2.5 whitespace-nowrap">
                                        {ic.name}
                                      </TableCell>
                                      <TableCell className="font-mono text-xs text-gray-500 py-2.5 whitespace-nowrap">
                                        {ic.customer_key}
                                      </TableCell>
                                      <TableCell className="font-mono text-xs text-gray-700 py-2.5 whitespace-nowrap">
                                        {ic.meter_number || "—"}
                                      </TableCell>
                                      <TableCell className="py-2.5 whitespace-nowrap">
                                        <Badge variant="outline" className="font-normal text-xs">
                                          {ic.month || "N/A"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="font-mono text-xs text-gray-700 text-right py-2.5 whitespace-nowrap">
                                        {prevRead.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="font-mono text-xs text-gray-700 text-right py-2.5 whitespace-nowrap">
                                        {currRead.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="font-mono text-xs text-gray-800 font-semibold text-right py-2.5 whitespace-nowrap">
                                        {usage.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="font-mono text-xs text-gray-800 text-right py-2.5 whitespace-nowrap">
                                        {billAmt.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="text-center py-2.5 whitespace-nowrap">
                                        <Badge
                                          variant={isPaid ? "default" : isUnpaid ? "destructive" : "secondary"}
                                          className={cn(
                                            "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                                            isPaid && "bg-green-500 hover:bg-green-600 text-white",
                                            isUnpaid && "bg-red-500 hover:bg-red-600 text-white"
                                          )}
                                        >
                                          {isPaid ? <CheckCircle className="mr-1 h-3 w-3 inline" /> : <XCircle className="mr-1 h-3 w-3 inline" />}
                                          {ic.payment_status || "Unpaid"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center py-2.5 whitespace-nowrap">
                                        <Badge
                                          variant={isActive ? "default" : "destructive"}
                                          className={cn(
                                            "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                                            isActive && "bg-blue-600 hover:bg-blue-700 text-white"
                                          )}
                                        >
                                          {ic.status || "Active"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right py-2.5 whitespace-nowrap">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-7 w-7 p-0 text-gray-500 hover:text-gray-900">
                                              <span className="sr-only">Open menu</span>
                                              <Menu className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                                            <DropdownMenuItem
                                              onClick={() => inspectCustomer(ic.customer_key)}
                                              className="text-xs cursor-pointer text-blue-600 focus:text-blue-700 font-medium"
                                            >
                                              <Search className="mr-2 h-3.5 w-3.5" />
                                              Inspect in 360° Console
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </CardContent>
                  {filteredAssociatedCustomers.length > 0 && (
                    <TablePagination
                      count={filteredAssociatedCustomers.length}
                      page={assocPage}
                      rowsPerPage={assocRowsPerPage}
                      onPageChange={setAssocPage}
                      onRowsPerPageChange={(value) => {
                        setAssocRowsPerPage(value);
                        setAssocPage(0);
                      }}
                      rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    />
                  )}
                </Card>
              </TabsContent>

              {/* Readings Tab */}
              <TabsContent value="readings">
                <Card className="border border-gray-200 shadow-xs">
                  <CardHeader className="p-3 pb-2 border-b bg-gray-50/50">
                    <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <Droplets className="h-4 w-4 text-blue-600" />
                      Meter Reading History
                      <span className="text-gray-400 font-normal text-xs">({recentReadings.length} records)</span>
                    </CardTitle>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Reading Date</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Previous (m³)</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Current (m³)</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Consumption (m³)</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Branch</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Fault Code</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentReadings.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-sm text-gray-400">
                              <Info className="h-4 w-4 inline mr-1" />No meter reading records found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          recentReadings.map((r: any, idx: number) => {
                            const prevRead = Number(r.previous_reading ?? r.previousReading ?? r.PREVIOUS_READING ?? 0);
                            const currRead = Number(r.current_reading ?? r.currentReading ?? r.METER_READING ?? 0);
                            const cons = Number(r.consumption ?? (currRead - prevRead));
                            const rdDate = r.reading_date ?? r.readingDate ?? r.READING_DATE ?? null;
                            const branch = r.branch_name ?? r.BRANCH_NAME ?? r.cust_name ?? "—";
                            return (
                              <TableRow key={r.id || idx} className="hover:bg-blue-50/20">
                                <TableCell className="font-mono text-gray-700 text-sm py-2.5">
                                  {rdDate ? (() => { try { return format(new Date(rdDate), "yyyy-MM-dd"); } catch { return rdDate; } })() : "—"}
                                </TableCell>
                                <TableCell className="font-mono text-gray-600 text-sm py-2.5">{prevRead.toLocaleString()}</TableCell>
                                <TableCell className="font-mono font-bold text-gray-900 text-sm py-2.5">{currRead.toLocaleString()}</TableCell>
                                <TableCell className={cn("font-mono font-bold text-sm py-2.5", cons < 0 ? "text-red-600" : "text-blue-700")}>
                                  {cons.toLocaleString()} m³
                                </TableCell>
                                <TableCell className="text-gray-600 text-xs py-2.5">{branch}</TableCell>
                                <TableCell className="py-2.5">
                                  {r.fault_code
                                    ? <Badge className="bg-red-100 text-red-700 border-red-200 font-semibold text-xs">{r.fault_code}</Badge>
                                    : <span className="text-gray-300 text-xs">None</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              {/* Tickets Tab */}
              <TabsContent value="tickets">
                <Card className="border border-gray-200 shadow-xs">
                  <CardHeader className="p-3 pb-2 border-b bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <Ticket className="h-4 w-4 text-blue-600" />
                        Support Tickets
                        <span className="text-gray-400 font-normal text-xs">({tickets.length})</span>
                      </CardTitle>
                      <Link href={`${basePath}/support`} className="text-xs text-blue-600 hover:underline font-semibold">
                        Open Help Desk →
                      </Link>
                    </div>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    {tickets.length === 0 ? (
                      <div className="h-24 flex items-center justify-center text-sm text-gray-400">
                        <Info className="h-4 w-4 mr-1" />No support tickets on record.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Ticket #</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Subject</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Category</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Priority</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Status</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Opened</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Resolved</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tickets.map((t: any, idx: number) => (
                            <TableRow key={t.id || idx} className="hover:bg-blue-50/20">
                              <TableCell className="font-mono font-bold text-gray-900 text-sm py-2.5">
                                #{t.ticket_number || idx + 1}
                              </TableCell>
                              <TableCell className="text-gray-800 text-xs py-2.5 max-w-[160px] truncate">
                                {t.subject || "Support Request"}
                              </TableCell>
                              <TableCell className="text-gray-600 text-xs py-2.5">
                                {t.category_name || t.category || "—"}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <StatusBadge status={t.priority} />
                              </TableCell>
                              <TableCell className="py-2.5"><StatusBadge status={t.status} /></TableCell>
                              <TableCell className="text-gray-500 font-mono text-xs py-2.5">
                                {t.created_at ? (() => { try { return format(new Date(t.created_at), "yyyy-MM-dd"); } catch { return t.created_at; } })() : "—"}
                              </TableCell>
                              <TableCell className="text-gray-500 font-mono text-xs py-2.5">
                                {t.resolved_at ? (() => { try { return format(new Date(t.resolved_at), "yyyy-MM-dd"); } catch { return t.resolved_at; } })() : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* Prior Calls Tab */}
              <TabsContent value="prior">
                <Card className="border border-gray-200 shadow-xs">
                  <CardHeader className="p-3 pb-2 border-b bg-gray-50/50">
                    <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <History className="h-4 w-4 text-gray-500" />
                      Prior Call Interactions
                      <span className="text-gray-400 font-normal text-xs">({priorCalls.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    {priorCalls.length === 0 ? (
                      <div className="h-24 flex items-center justify-center text-sm text-gray-400">
                        <Info className="h-4 w-4 mr-1" />No prior call logs for this customer.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Date & Time</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Inquiry Reason</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Type</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Duration</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Outcome</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-700 py-2.5">Agent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {priorCalls.map((call: any, cIdx: number) => (
                            <TableRow key={call.id || cIdx} className="hover:bg-blue-50/20">
                              <TableCell className="font-mono text-gray-600 text-xs py-2.5">
                                {call.created_at ? (() => { try { return format(new Date(call.created_at), "yyyy-MM-dd HH:mm"); } catch { return call.created_at; } })() : "—"}
                              </TableCell>
                              <TableCell className="text-gray-800 text-xs py-2.5 capitalize">
                                {(call.category || "").replace(/_/g, " ")}
                              </TableCell>
                              <TableCell className="text-gray-600 text-xs py-2.5 capitalize">{call.call_type || "inbound"}</TableCell>
                              <TableCell className="font-mono text-gray-700 text-xs py-2.5">{call.duration_seconds || 0}s</TableCell>
                              <TableCell className="py-2.5">
                                <StatusBadge status={(call.resolution_status || "").replace(/_/g, " ")} />
                              </TableCell>
                              <TableCell className="text-gray-500 text-xs py-2.5 max-w-[120px] truncate">
                                {call.agent_email || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT COLUMN ─ Call interaction panel */}
          <div className="xl:col-span-4 space-y-4">

            {/* Call Timer */}
            <Card className="border border-gray-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Call Timer</p>
                    <p className="font-mono text-2xl font-black text-gray-900 leading-none">{formatTimer(callDuration)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={isTimerRunning ? "outline" : "default"}
                    onClick={() => setIsTimerRunning((p) => !p)}
                    className={cn("h-8 text-xs font-semibold gap-1", isTimerRunning ? "border-amber-300 text-amber-700 hover:bg-amber-50" : "bg-emerald-600 hover:bg-emerald-700 text-white")}
                  >
                    {isTimerRunning ? "⏸ Pause" : "▶ Start"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setIsTimerRunning(false); setCallDuration(0); }}
                    className="h-8 text-xs text-gray-500 hover:text-red-600"
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Log Interaction */}
            {canLogCall && (
              <Card className="border border-gray-200 shadow-xs">
                <CardHeader className="p-4 pb-3 border-b bg-gray-50/50">
                  <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Log Customer Interaction
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    Record the reason and resolution before completing this call.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {/* Call Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Call Direction</Label>
                    <Select value={callType} onValueChange={setCallType}>
                      <SelectTrigger className="h-9 text-xs border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inbound" className="text-xs">📞 Inbound Hotline</SelectItem>
                        <SelectItem value="outbound" className="text-xs">📲 Outbound Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Inquiry Reason <span className="text-red-500">*</span></Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-9 text-xs border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="billing_dispute" className="text-xs">Billing Dispute / High Bill</SelectItem>
                        <SelectItem value="payment_inquiry" className="text-xs">Payment & Uncredited</SelectItem>
                        <SelectItem value="reading_check" className="text-xs">Meter Reading Verification</SelectItem>
                        <SelectItem value="leak_report" className="text-xs">Water Leak / Burst Pipe</SelectItem>
                        <SelectItem value="water_interruption" className="text-xs">Supply Interruption</SelectItem>
                        <SelectItem value="phone_update" className="text-xs">Phone Number Update</SelectItem>
                        <SelectItem value="general" className="text-xs">General Information</SelectItem>
                        <SelectItem value="new_connection" className="text-xs">New Connection Inquiry</SelectItem>
                        <SelectItem value="meter_complaint" className="text-xs">Meter Complaint / Fault</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Caller Sentiment */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Caller Sentiment</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: "satisfied", label: "Satisfied", icon: Smile, color: "text-emerald-700 border-emerald-300 bg-emerald-50/60" },
                        { id: "neutral", label: "Neutral", icon: Meh, color: "text-blue-700 border-blue-300 bg-blue-50/60" },
                        { id: "frustrated", label: "Frustrated", icon: Frown, color: "text-amber-700 border-amber-300 bg-amber-50/60" },
                        { id: "escalated", label: "Escalated", icon: Flame, color: "text-red-700 border-red-300 bg-red-50/60" },
                      ].map((s) => {
                        const Icon = s.icon;
                        const isSelected = callerSentiment === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setCallerSentiment(s.id)}
                            className={cn(
                              "flex flex-col items-center justify-center p-1.5 rounded-md border text-[11px] font-semibold transition gap-0.5",
                              isSelected ? cn(s.color, "ring-2 ring-blue-500 shadow-xs") : "border-gray-200 bg-gray-50/60 text-gray-600 hover:bg-gray-100"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resolution */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Call Outcome</Label>
                    <Select value={resolutionStatus} onValueChange={setResolutionStatus}>
                      <SelectTrigger className="h-9 text-xs border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resolved_on_call" className="text-xs font-semibold text-emerald-700">✓ Resolved On-Call</SelectItem>
                        <SelectItem value="ticket_created" className="text-xs font-semibold text-blue-700">↳ Escalated to Branch Ticket</SelectItem>
                        <SelectItem value="pending_investigation" className="text-xs font-semibold text-amber-700">⏱ Pending Investigation</SelectItem>
                        <SelectItem value="callback_scheduled" className="text-xs font-semibold text-purple-700">📅 Callback Scheduled</SelectItem>
                        <SelectItem value="no_answer" className="text-xs font-semibold text-gray-600">✗ No Answer / Dropped</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quick chips */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Quick Notes:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        ["Tariff explained", "Explained progressive tariff calculation to customer"],
                        ["Telebirr confirmed", "Confirmed payment processed via Telebirr"],
                        ["Re-reading requested", "Requested meter inspector re-reading"],
                        ["Phone updated", "Phone number updated per customer request"],
                        ["Bill SMS sent", "Resent latest bill details via SMS"],
                      ].map(([label, snippet]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => insertQuickNote(snippet)}
                          className="text-[11px] px-2 py-0.5 rounded border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-800 text-gray-700 transition"
                        >
                          + {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes textarea */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Interaction Notes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Describe the customer inquiry, action taken, and resolution..."
                      className="text-xs resize-none border-gray-200 min-h-[80px]"
                      rows={4}
                    />
                  </div>

                  <Button
                    onClick={handleLogCall}
                    disabled={isLoggingCall}
                    className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm gap-2"
                  >
                    {isLoggingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save Interaction Log
                  </Button>

                  {/* Keyboard hotkeys guide */}
                  <div className="pt-2 text-[10px] text-gray-400 text-center flex flex-wrap items-center justify-center gap-1.5 border-t">
                    <span>⌨️ Shortcuts:</span>
                    <kbd className="px-1 py-0.5 bg-gray-100 border rounded font-mono text-[9px]">/ or Ctrl+K</kbd> Search
                    <kbd className="px-1 py-0.5 bg-gray-100 border rounded font-mono text-[9px]">Alt+T</kbd> Timer
                    <kbd className="px-1 py-0.5 bg-gray-100 border rounded font-mono text-[9px]">Alt+S</kbd> Save
                    <kbd className="px-1 py-0.5 bg-gray-100 border rounded font-mono text-[9px]">Alt+1..5</kbd> Tabs
                  </div>
                </CardContent>
              </Card>
            )}

            {/* View-only note when no log permission */}
            {!canLogCall && (
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 text-sm">View Access Only</AlertTitle>
                <AlertDescription className="text-blue-700 text-xs">
                  You have read-only access to customer information. Contact your supervisor for call logging permissions.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      ) : (
        /* ── Empty state before first search ──────────────────────── */
        !summaryData && (
          <Card className="border border-gray-200 shadow-xs">
            <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Headphones className="h-7 w-7 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Customer Lookup Console</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm">
                  Enter a customer name, key, contract number, meter serial, or phone number above to look up the full account profile.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {["Customer Key", "Contract No.", "Meter Serial", "Phone Number", "Customer Name"].map((hint) => (
                  <Badge key={hint} variant="outline" className="text-xs text-gray-500 border-gray-200">{hint}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      )}
      {/* ── In-Page Dialog for Associated Individual Customers (no page navigation) ── */}
      <Dialog open={isAssocDialogOpen} onOpenChange={setIsAssocDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-gray-50/70">
            <div className="flex items-center justify-between gap-2 pr-6">
              <div>
                <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Associated Individual Customers
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {associatedCustomers.length} accounts
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  Individual sub-meters connected to {customer?.name} ({customer?.customerKey}). Click &quot;Inspect in 360°&quot; to load that customer directly in this console.
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {availableAssocPeriods.length > 0 && (
                <div className="flex items-center gap-1.5 border border-gray-200 rounded-md px-2 py-1 bg-white shadow-xs">
                  <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <Select
                    value={assocPeriodFilter}
                    onValueChange={(val) => {
                      setAssocPeriodFilter(val);
                      setAssocPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[140px] h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 p-0 pl-1">
                      <SelectValue placeholder="All Periods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Periods</SelectItem>
                      {availableAssocPeriods.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Filter by customer name, key, meter serial, contract no, or phone..."
                  value={assocSearchTerm}
                  onChange={(e) => {
                    setAssocSearchTerm(e.target.value);
                    setAssocPage(0);
                  }}
                  className="pl-8 h-8 text-xs bg-white"
                />
              </div>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 p-0">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 z-10 shadow-xs">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Customer Name</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Cust. Key</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Meter No.</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Month</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Prev. Reading</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Curr. Reading</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Usage (m³)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Bill (ETB)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-center whitespace-nowrap">Pay Status</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-center whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssociatedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center text-sm text-gray-400">
                      <Info className="h-4 w-4 inline mr-1" />
                      {associatedCustomers.length === 0
                        ? "No individual customers are connected under this bulk meter."
                        : "No customers matching your filter."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAssociatedCustomers.map((ic: any, idx: number) => {
                    const isPaid = (ic.payment_status || "").toLowerCase() === "paid";
                    const isUnpaid = (ic.payment_status || "").toLowerCase() === "unpaid";
                    const isActive = (ic.status || "").toLowerCase() === "active";
                    const prevRead = Number(ic.previous_reading || 0);
                    const currRead = Number(ic.current_reading || 0);
                    const usage = Number(ic.usage || Math.max(0, currRead - prevRead));
                    const billAmt = Number(ic.calculated_bill || 0);

                    return (
                      <TableRow key={ic.customer_key || idx} className="hover:bg-blue-50/30">
                        <TableCell className="font-medium text-xs text-gray-900 py-2.5 whitespace-nowrap">
                          {ic.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-500 py-2.5 whitespace-nowrap">
                          {ic.customer_key}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-700 py-2.5 whitespace-nowrap">
                          {ic.meter_number || "—"}
                        </TableCell>
                        <TableCell className="py-2.5 whitespace-nowrap">
                          <Badge variant="outline" className="font-normal text-xs">
                            {ic.month || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-700 text-right py-2.5 whitespace-nowrap">
                          {prevRead.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-700 text-right py-2.5 whitespace-nowrap">
                          {currRead.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-800 font-semibold text-right py-2.5 whitespace-nowrap">
                          {usage.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-800 text-right py-2.5 whitespace-nowrap">
                          {billAmt.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center py-2.5 whitespace-nowrap">
                          <Badge
                            variant={isPaid ? "default" : isUnpaid ? "destructive" : "secondary"}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                              isPaid && "bg-green-500 hover:bg-green-600 text-white",
                              isUnpaid && "bg-red-500 hover:bg-red-600 text-white"
                            )}
                          >
                            {isPaid ? <CheckCircle className="mr-1 h-3 w-3 inline" /> : <XCircle className="mr-1 h-3 w-3 inline" />}
                            {ic.payment_status || "Unpaid"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-2.5 whitespace-nowrap">
                          <Badge
                            variant={isActive ? "default" : "destructive"}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                              isActive && "bg-blue-600 hover:bg-blue-700 text-white"
                            )}
                          >
                            {ic.status || "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-2.5 whitespace-nowrap">
                          <Button
                            size="sm"
                            onClick={() => {
                              setIsAssocDialogOpen(false);
                              inspectCustomer(ic.customer_key);
                            }}
                            className="h-7 text-[11px] px-2.5 bg-blue-600 hover:bg-blue-700 text-white gap-1 font-semibold"
                          >
                            <Search className="h-3 w-3" /> Inspect in 360°
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredAssociatedCustomers.length > 0 && (
            <TablePagination
              count={filteredAssociatedCustomers.length}
              page={assocPage}
              rowsPerPage={assocRowsPerPage}
              onPageChange={setAssocPage}
              onRowsPerPageChange={(value) => {
                setAssocRowsPerPage(value);
                setAssocPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Bill Explainer Modal ── */}
      <BillExplainerModal
        open={isExplainerOpen}
        onOpenChange={setIsExplainerOpen}
        bill={selectedBillForExplainer?.bill || null}
        customer={customer}
        reconstructedData={selectedBillForExplainer?.recon || null}
      />

      {/* ── SMS Templates Modal (View Before Copy) ── */}
      <SmsTemplatesModal
        open={isSmsTemplatesOpen}
        onOpenChange={setIsSmsTemplatesOpen}
        customer={customer}
        latestBill={recentBills[0] || null}
        reconstructedData={recentBills[0] ? reconstructedHistoryMap.get(recentBills[0].id || recentBills[0].bill_key || recentBills[0].month_year) : null}
        initialTemplateId={selectedSmsTemplateId}
        onTemplateCopied={(templateTitle) => {
          setNotes((p) => p ? `${p}\n[Copied SMS template '${templateTitle}' for caller]` : `[Copied SMS template '${templateTitle}' for caller]`);
        }}
      />

      {/* ── Quick Ticket Modal ── */}
      <QuickTicketModal
        open={isQuickTicketOpen}
        onOpenChange={setIsQuickTicketOpen}
        customer={customer}
        onTicketCreated={(ticket) => {
          setActiveTab("tickets");
          if (ticket?.ticket_number) {
            setNotes((p) => p ? `${p}\n[Ticket #${ticket.ticket_number} created: ${ticket.subject || "Dispatched"}]` : `[Ticket #${ticket.ticket_number} created: ${ticket.subject || "Dispatched"}]`);
          }
          if (customer?.customerKey) {
            searchCallerAccountAction(customer.customerKey).then((fresh) => {
              if (fresh) setSummaryData(fresh);
            });
          }
        }}
      />

      {/* ── Customer Invoices Modal (In-Console Archive, No Navigation) ── */}
      {customer && (
        <CustomerInvoicesModal
          open={isInvoicesModalOpen}
          onOpenChange={setIsInvoicesModalOpen}
          customer={customer}
          bills={recentBills}
          reconstructedHistoryMap={reconstructedHistoryMap}
          onPreviewInvoice={(b) => handleOpenInvoicePreview(b)}
          onExplainBill={(b, recon) => {
            setSelectedBillForExplainer({ bill: b, recon });
            setIsExplainerOpen(true);
          }}
        />
      )}

      {/* ── Official Invoice Preview & Print Dialog (In-Console) ── */}
      {invoiceMeterData && invoiceBillData && (
        <InvoicePreviewDialog
          open={isInvoicePreviewOpen}
          onOpenChange={setIsInvoicePreviewOpen}
          meter={invoiceMeterData}
          bill={invoiceBillData}
          branchName={customer?.branchName}
        />
      )}
    </div>
  );
}
