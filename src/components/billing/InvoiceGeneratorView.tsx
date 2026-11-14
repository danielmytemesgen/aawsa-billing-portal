'use client';

import * as React from "react";
import {
  Receipt,
  Printer,
  FileSpreadsheet,
  Download,
  Search,
  RefreshCcw,
  Eye,
  CheckCircle2,
  Clock,
  FileText,
  Users,
  CreditCard,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import {
  getDistinctBillingMonthsAction,
  getBranchesLookupAction,
  getInvoiceBillsAction,
} from "@/lib/actions";
import { initializeTariffs, getTariffs } from "@/lib/data-store";
import { getPenaltyValue, isPenaltyEnabledForPeriod } from "@/lib/billing-utils";
import { arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";
import { InvoicePreviewDialog } from "./InvoicePreviewDialog";

interface InvoiceGeneratorViewProps {
  isAdmin?: boolean;
  printRoute?: string;
}

export function InvoiceGeneratorView({
  isAdmin = false,
  printRoute = "/staff/bulk-meters/print-invoices",
}: InvoiceGeneratorViewProps) {
  const { toast } = useToast();
  const { hasPermission, hasAnyPermission } = usePermissions();

  // ── Permission flags ────────────────────────────────────────────────────
  // bill:manage_all users get all invoice permissions automatically
  const isFullAdmin = hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  const canViewInvoices      = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_VIEW);
  const canPrint             = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_PRINT);
  const canExportCSV         = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_EXPORT_CSV);
  const canExportExcel       = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_EXPORT_EXCEL);
  const canAccessBatch       = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_BATCH);
  const canAccessStatement   = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_CUSTOMER_STATEMENT);

  // Determine default tab based on what this user can access
  const defaultTab: "batch" | "customer" = canAccessBatch ? "batch" : "customer";

  // Mode: batch or customer statement
  const [activeTab, setActiveTab] = React.useState<"batch" | "customer">(defaultTab);

  // Dynamically auto-flip active tab if current tab becomes unassigned or newly assigned
  React.useEffect(() => {
    if (activeTab === "batch" && !canAccessBatch && canAccessStatement) {
      setActiveTab("customer");
    } else if (activeTab === "customer" && !canAccessStatement && canAccessBatch) {
      setActiveTab("batch");
    }
  }, [canAccessBatch, canAccessStatement, activeTab]);

  // Filters
  const [months, setMonths] = React.useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = React.useState<string>("latest");
  const [branches, setBranches] = React.useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = React.useState<string>("All");
  const [searchTerm, setSearchTerm] = React.useState<string>("");

  // Data & loading
  const [bills, setBills] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [selectedBillIds, setSelectedBillIds] = React.useState<Set<string>>(new Set());

  // Customer statement mode state
  const [customerSearchKey, setCustomerSearchKey] = React.useState<string>("");
  const [customerBills, setCustomerBills] = React.useState<any[]>([]);
  const [isCustomerLoading, setIsCustomerLoading] = React.useState<boolean>(false);
  const [selectedCustomerBillIds, setSelectedCustomerBillIds] = React.useState<Set<string>>(new Set());

  // Preview dialog state
  const [previewItem, setPreviewItem] = React.useState<{ meter: any; bill: any } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(15);

  // Load initial lookups: months, branches, tariffs
  React.useEffect(() => {
    async function loadLookups() {
      try {
        await initializeTariffs().catch(() => {});

        const [monthsRes, branchRes] = await Promise.all([
          getDistinctBillingMonthsAction(),
          getBranchesLookupAction(),
        ]);

        if (monthsRes.data && Array.isArray(monthsRes.data)) {
          setMonths(monthsRes.data.map(String));
        }

        if (branchRes.data && Array.isArray(branchRes.data)) {
          setBranches(branchRes.data.filter((b: any) => b.id && b.name));
        }
      } catch (err) {
        console.error("Failed to load invoice lookups", err);
      }
    }
    loadLookups();
  }, []);

  // Fetch bills when filters change
  const loadBills = React.useCallback(async () => {
    setIsLoading(true);
    setSelectedBillIds(new Set());
    try {
      const res = await getInvoiceBillsAction({
        monthYear: selectedMonth === "latest" ? undefined : selectedMonth,
        branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
        paymentStatus: paymentStatusFilter,
      });

      if (res.error) {
        toast({
          variant: "destructive",
          title: "Failed to Load Invoices",
          description: res.error,
        });
        setBills([]);
      } else {
        setBills(res.data || []);
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to fetch invoice records",
      });
      setBills([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedBranchId, paymentStatusFilter, toast]);

  React.useEffect(() => {
    if (activeTab === "batch") {
      loadBills();
    }
  }, [loadBills, activeTab]);

  // Handle single customer search
  const handleSearchCustomer = async (keyToSearch?: string) => {
    const key = (keyToSearch || customerSearchKey).trim();
    if (!key) {
      toast({
        title: "Customer Key Required",
        description: "Please enter a valid Customer Key Number to find bills.",
      });
      return;
    }

    setIsCustomerLoading(true);
    setSelectedCustomerBillIds(new Set());
    try {
      const res = await getInvoiceBillsAction({
        customerKey: key,
      });

      if (res.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.error,
        });
        setCustomerBills([]);
      } else {
        const found = res.data || [];
        setCustomerBills(found);
        if (found.length === 0) {
          toast({
            title: "No Invoices Found",
            description: `No billing history found for customer key "${key}".`,
          });
        } else {
          // Select all bills by default for convenient statement printing
          setSelectedCustomerBillIds(new Set(found.map((b: any) => String(b.id))));
        }
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Search Error",
        description: err.message || "Failed to search customer bills",
      });
    } finally {
      setIsCustomerLoading(false);
    }
  };

  // Branch map for quick lookup
  const branchMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach((b) => {
      map[b.id] = b.name;
    });
    return map;
  }, [branches]);

  const getBranchLabel = (branchId?: string, fallback?: string) => {
    if (branchId && branchMap[branchId]) return branchMap[branchId];
    return fallback || "N/A";
  };

  // Filter bills by search term
  const filteredBills = React.useMemo(() => {
    if (!searchTerm.trim()) return bills;
    const term = searchTerm.toLowerCase();
    return bills.filter((b) => {
      const name = (b.name || "").toLowerCase();
      const key = (b.CUSTOMERKEY || "").toLowerCase();
      const meterNo = (b.meterNumber || "").toLowerCase();
      const contract = (b.contractNumber || "").toLowerCase();
      const billKey = (b.BILLKEY || "").toLowerCase();
      return (
        name.includes(term) ||
        key.includes(term) ||
        meterNo.includes(term) ||
        contract.includes(term) ||
        billKey.includes(term)
      );
    });
  }, [bills, searchTerm]);

  // Pagination slice
  const paginatedBills = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBills.slice(start, start + pageSize);
  }, [filteredBills, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredBills.length / pageSize) || 1;

  // Selection handlers
  const isAllPageSelected =
    paginatedBills.length > 0 &&
    paginatedBills.every((b) => selectedBillIds.has(String(b.id)));

  const handleToggleSelectAllPage = () => {
    const next = new Set(selectedBillIds);
    if (isAllPageSelected) {
      paginatedBills.forEach((b) => next.delete(String(b.id)));
    } else {
      paginatedBills.forEach((b) => next.add(String(b.id)));
    }
    setSelectedBillIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(filteredBills.map((b) => String(b.id)));
    setSelectedBillIds(next);
    toast({
      title: "All Selected",
      description: `Selected all ${filteredBills.length} filtered invoices.`,
    });
  };

  const handleClearSelection = () => {
    setSelectedBillIds(new Set());
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedBillIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedBillIds(next);
  };

  // Transform row to printData shape
  const mapRowToPrintData = (row: any) => {
    const tariffs = getTariffs();
    const isPenEnabled = isPenaltyEnabledForPeriod(
      tariffs,
      row.month_year,
      row.charge_group || row.customerType
    );
    const penaltyVal = getPenaltyValue(Number(row.PENALTYAMT || 0), isPenEnabled);

    return {
      meter: {
        customerKeyNumber: row.CUSTOMERKEY,
        name: row.name,
        contractNumber: row.contractNumber,
        meterNumber: row.meterNumber,
        meterKey: row.meterNumber,
        meterSize: Number(row.meterSize ?? 0),
        specificArea: row.specificArea,
        subCity: row.subCity,
        woreda: row.woreda,
        phoneNumber: row.phoneNumber,
        chargeGroup: row.charge_group,
        sewerageConnection: row.sewerage_connection,
        branchId: row.branch_id,
        location: row.subCity,
      },
      bill: {
        id: row.id,
        CUSTOMERKEY: row.CUSTOMERKEY,
        BILLKEY: row.BILLKEY,
        monthYear: row.month_year,
        PREVREAD: Number(row.PREVREAD ?? 0),
        CURRREAD: Number(row.CURRREAD ?? 0),
        CONS: Number(row.CONS ?? 0),
        differenceUsage: Number(row.difference_usage ?? 0),
        difference_usage: Number(row.difference_usage ?? 0),
        snapshot_data: row.snapshot_data,
        baseWaterCharge: Number(row.base_water_charge ?? 0),
        base_water_charge: Number(row.base_water_charge ?? 0),
        maintenanceFee: Number(row.maintenance_fee ?? 0),
        maintenance_fee: Number(row.maintenance_fee ?? 0),
        sanitationFee: Number(row.sanitation_fee ?? 0),
        sanitation_fee: Number(row.sanitation_fee ?? 0),
        sewerageCharge: Number(row.sewerage_charge ?? 0),
        sewerage_charge: Number(row.sewerage_charge ?? 0),
        meterRent: Number(row.meter_rent ?? 0),
        meter_rent: Number(row.meter_rent ?? 0),
        vatAmount: Number(row.vat_amount ?? 0),
        vat_amount: Number(row.vat_amount ?? 0),
        THISMONTHBILLAMT: Number(row.THISMONTHBILLAMT ?? row.TOTALBILLAMOUNT ?? 0),
        TOTALBILLAMOUNT: Number(row.TOTALBILLAMOUNT ?? 0),
        OUTSTANDINGAMT: Number(row.OUTSTANDINGAMT ?? 0),
        balanceCarriedForward: Number(row.balance_carried_forward ?? 0),
        debit30: Number(row.debit_30 ?? 0),
        debit30_60: Number(row.debit_30_60 ?? 0),
        debit60: Number(row.debit_60 ?? 0),
        PENALTYAMT: penaltyVal,
        penaltyEnabled: isPenEnabled,
        dueDate: row.due_date,
        paymentStatus: row.payment_status ?? "Unpaid",
        billPeriodStartDate: row.bill_period_start_date,
        billPeriodEndDate: row.bill_period_end_date,
        notes: row.notes,
      },
    };
  };

  // Print Batch Invoices
  const handlePrintBatch = () => {
    const selectedRows = filteredBills.filter((b) => selectedBillIds.has(String(b.id)));
    if (selectedRows.length === 0) {
      toast({
        variant: "destructive",
        title: "No Invoices Selected",
        description: "Please check at least one invoice to print.",
      });
      return;
    }

    const printData = selectedRows.map(mapRowToPrintData);
    sessionStorage.setItem("batchInvoiceData", JSON.stringify(printData));
    sessionStorage.setItem("batchInvoicePenaltyEnabled", JSON.stringify(true));

    window.open(printRoute, "_blank");
    toast({
      title: "Opening Batch Print View",
      description: `Prepared ${printData.length} invoice(s) for printing.`,
    });
  };

  // Print Customer Invoices (Multi-month statement)
  const handlePrintCustomerBills = () => {
    const selectedRows = customerBills.filter((b) =>
      selectedCustomerBillIds.has(String(b.id))
    );
    if (selectedRows.length === 0) {
      toast({
        variant: "destructive",
        title: "No Invoices Selected",
        description: "Please check at least one bill cycle to print.",
      });
      return;
    }

    const printData = selectedRows.map(mapRowToPrintData);
    sessionStorage.setItem("batchInvoiceData", JSON.stringify(printData));
    sessionStorage.setItem("batchInvoicePenaltyEnabled", JSON.stringify(true));

    window.open(printRoute, "_blank");
    toast({
      title: "Opening Invoices",
      description: `Printing ${printData.length} invoice(s) for customer.`,
    });
  };

  // Preview single item
  const handlePreview = (row: any) => {
    const mapped = mapRowToPrintData(row);
    setPreviewItem(mapped);
    setIsPreviewOpen(true);
  };

  // Quick print single item
  const handleQuickPrint = (row: any) => {
    const mapped = mapRowToPrintData(row);
    sessionStorage.setItem("batchInvoiceData", JSON.stringify([mapped]));
    sessionStorage.setItem("batchInvoicePenaltyEnabled", JSON.stringify(true));
    window.open(printRoute, "_blank");
  };

  // Export to CSV
  const handleExportCSV = () => {
    const targetRows =
      selectedBillIds.size > 0
        ? filteredBills.filter((b) => selectedBillIds.has(String(b.id)))
        : filteredBills;

    if (targetRows.length === 0) {
      toast({
        variant: "destructive",
        title: "No Invoices to Export",
        description: "There are no invoices matching your current filters.",
      });
      return;
    }

    const headers = [
      "Customer Key",
      "Customer Name",
      "Meter Number",
      "Contract Number",
      "Branch",
      "Billing Month",
      "Bill Key",
      "Prev Reading (m³)",
      "Curr Reading (m³)",
      "Consumption (m³)",
      "Base Water (ETB)",
      "Maintenance (ETB)",
      "Sanitation (ETB)",
      "Meter Rent (ETB)",
      "Sewerage (ETB)",
      "VAT (ETB)",
      "Current Month (ETB)",
      "Arrears (ETB)",
      "Penalty (ETB)",
      "Total Amount Payable (ETB)",
      "Payment Status",
    ];

    const rows = targetRows.map((r) => {
      const tariffs = getTariffs();
      const isPen = isPenaltyEnabledForPeriod(
        tariffs,
        r.month_year,
        r.charge_group || r.customerType
      );
      const penalty = getPenaltyValue(Number(r.PENALTYAMT || 0), isPen);
      const outstanding = Number(r.OUTSTANDINGAMT || 0);
      const arrears = Math.max(0, outstanding - penalty);
      const current = Math.max(
        0,
        Number(r.THISMONTHBILLAMT ?? r.TOTALBILLAMOUNT ?? 0)
      );
      const totalPayable = outstanding + current;

      return [
        r.CUSTOMERKEY || "",
        r.name || "",
        r.meterNumber || "",
        r.contractNumber || "",
        getBranchLabel(r.branch_id, r.subCity),
        r.month_year || "",
        r.BILLKEY || "",
        Number(r.PREVREAD ?? 0).toFixed(2),
        Number(r.CURRREAD ?? 0).toFixed(2),
        Number(r.CONS ?? 0).toFixed(2),
        Number(r.base_water_charge ?? 0).toFixed(2),
        Number(r.maintenance_fee ?? 0).toFixed(2),
        Number(r.sanitation_fee ?? 0).toFixed(2),
        Number(r.meter_rent ?? 0).toFixed(2),
        Number(r.sewerage_charge ?? 0).toFixed(2),
        Number(r.vat_amount ?? 0).toFixed(2),
        current.toFixed(2),
        arrears.toFixed(2),
        penalty.toFixed(2),
        totalPayable.toFixed(2),
        r.payment_status || "Unpaid",
      ];
    });

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AAWSA_Invoices_${selectedMonth}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV Exported",
      description: `Exported ${targetRows.length} invoice(s) successfully.`,
    });
  };

  // Export to Excel
  const handleExportXLSX = () => {
    const targetRows =
      selectedBillIds.size > 0
        ? filteredBills.filter((b) => selectedBillIds.has(String(b.id)))
        : filteredBills;

    if (targetRows.length === 0) {
      toast({
        variant: "destructive",
        title: "No Invoices to Export",
        description: "There are no invoices matching your current filters.",
      });
      return;
    }

    const headers = [
      "Customer Key",
      "Customer Name",
      "Meter Number",
      "Contract Number",
      "Branch",
      "Billing Month",
      "Bill Key",
      "Prev Reading (m³)",
      "Curr Reading (m³)",
      "Consumption (m³)",
      "Base Water (ETB)",
      "Maintenance (ETB)",
      "Sanitation (ETB)",
      "Meter Rent (ETB)",
      "Sewerage (ETB)",
      "VAT (ETB)",
      "Current Month (ETB)",
      "Arrears (ETB)",
      "Penalty (ETB)",
      "Total Payable (ETB)",
      "Payment Status",
    ];

    const data = targetRows.map((r) => {
      const tariffs = getTariffs();
      const isPen = isPenaltyEnabledForPeriod(
        tariffs,
        r.month_year,
        r.charge_group || r.customerType
      );
      const penalty = getPenaltyValue(Number(r.PENALTYAMT || 0), isPen);
      const outstanding = Number(r.OUTSTANDINGAMT || 0);
      const arrears = Math.max(0, outstanding - penalty);
      const current = Math.max(
        0,
        Number(r.THISMONTHBILLAMT ?? r.TOTALBILLAMOUNT ?? 0)
      );
      const totalPayable = outstanding + current;

      return {
        "Customer Key": r.CUSTOMERKEY || "",
        "Customer Name": r.name || "",
        "Meter Number": r.meterNumber || "",
        "Contract Number": r.contractNumber || "",
        Branch: getBranchLabel(r.branch_id, r.subCity),
        "Billing Month": r.month_year || "",
        "Bill Key": r.BILLKEY || "",
        "Prev Reading (m³)": Number(r.PREVREAD ?? 0).toFixed(2),
        "Curr Reading (m³)": Number(r.CURRREAD ?? 0).toFixed(2),
        "Consumption (m³)": Number(r.CONS ?? 0).toFixed(2),
        "Base Water (ETB)": Number(r.base_water_charge ?? 0).toFixed(2),
        "Maintenance (ETB)": Number(r.maintenance_fee ?? 0).toFixed(2),
        "Sanitation (ETB)": Number(r.sanitation_fee ?? 0).toFixed(2),
        "Meter Rent (ETB)": Number(r.meter_rent ?? 0).toFixed(2),
        "Sewerage (ETB)": Number(r.sewerage_charge ?? 0).toFixed(2),
        "VAT (ETB)": Number(r.vat_amount ?? 0).toFixed(2),
        "Current Month (ETB)": current.toFixed(2),
        "Arrears (ETB)": arrears.toFixed(2),
        "Penalty (ETB)": penalty.toFixed(2),
        "Total Payable (ETB)": totalPayable.toFixed(2),
        "Payment Status": r.payment_status || "Unpaid",
      };
    });

    const blob = arrayToXlsxBlob(data, headers, "AAWSA Invoices");
    downloadFile(blob, `AAWSA_Invoices_${selectedMonth}_${Date.now()}.xlsx`);

    toast({
      title: "Excel Exported",
      description: `Exported ${targetRows.length} invoice(s) to Excel.`,
    });
  };

  // Stats calculation
  const stats = React.useMemo(() => {
    let totalUnpaidCount = 0;
    let totalUnpaidAmount = 0;
    let totalArrearsAmount = 0;
    let selectedPayable = 0;

    const tariffs = getTariffs();

    filteredBills.forEach((b) => {
      const isUnpaid = (b.payment_status || "Unpaid").toLowerCase() === "unpaid";
      const isPen = isPenaltyEnabledForPeriod(
        tariffs,
        b.month_year,
        b.charge_group || b.customerType
      );
      const penalty = getPenaltyValue(Number(b.PENALTYAMT || 0), isPen);
      const outstanding = Number(b.OUTSTANDINGAMT || 0);
      const arrears = Math.max(0, outstanding - penalty);
      const current = Math.max(
        0,
        Number(b.THISMONTHBILLAMT ?? b.TOTALBILLAMOUNT ?? 0)
      );
      const total = outstanding + current;

      totalArrearsAmount += arrears;

      if (isUnpaid) {
        totalUnpaidCount += 1;
        totalUnpaidAmount += total;
      }

      if (selectedBillIds.has(String(b.id))) {
        selectedPayable += total;
      }
    });

    return {
      totalCount: filteredBills.length,
      totalUnpaidCount,
      totalUnpaidAmount,
      totalArrearsAmount,
      selectedCount: selectedBillIds.size,
      selectedPayable,
    };
  }, [filteredBills, selectedBillIds]);

  // ── Access guard: user has no invoice view permission at all ──────────────
  if (!canViewInvoices) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center p-8">
        <div className="p-4 rounded-full bg-rose-100 dark:bg-rose-900/30">
          <Lock className="h-10 w-10 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Access Restricted
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          You do not have permission to access the Invoice Generator.
          Contact your administrator to request the <strong>invoice:view</strong> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Receipt className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Invoice Generator
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate, preview, batch print, and export official AAWSA billing invoices
            </p>
          </div>
        </div>

        {/* Mode switcher tabs – only show tabs the user has permission for */}
        {(canAccessBatch || canAccessStatement) && (
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as any)}
            className="w-auto"
          >
            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {canAccessBatch && (
                <TabsTrigger value="batch" className="gap-2 text-xs font-semibold">
                  <Users className="h-3.5 w-3.5" />
                  Batch Invoices
                </TabsTrigger>
              )}
              {canAccessStatement && (
                <TabsTrigger value="customer" className="gap-2 text-xs font-semibold">
                  <FileText className="h-3.5 w-3.5" />
                  Customer Statements
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Neither tab assigned fallback */}
      {!canAccessBatch && !canAccessStatement && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center bg-slate-50/50 dark:bg-slate-900/50">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <h3 className="font-semibold text-base text-slate-800 dark:text-slate-200">
            No Invoice Views Assigned
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            You have permission to view invoices, but neither the <strong>Batch Invoices</strong> nor <strong>Customer Statements</strong> view is assigned to your role. Ask an administrator to assign <code>invoice:batch</code> or <code>invoice:customer_statement</code>.
          </p>
        </div>
      )}

      {/* Mode A: Batch Invoices */}
      {activeTab === "batch" && canAccessBatch && (
        <div className="space-y-6">
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Total Invoices
                  </span>
                  <Receipt className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.totalCount}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  For period: {selectedMonth === "latest" ? "Latest Bills" : selectedMonth}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Unpaid Invoices
                  </span>
                  <Clock className="h-4 w-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-rose-600">
                  {stats.totalUnpaidCount}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  ETB {stats.totalUnpaidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Total Arrears (Debt)
                  </span>
                  <CreditCard className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-amber-600">
                  ETB {stats.totalArrearsAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Carried forward debt base
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-primary mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Selected for Printing
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary">
                  {stats.selectedCount} / {stats.totalCount}
                </div>
                <p className="text-[11px] text-primary/80 mt-1 font-medium">
                  Payable: ETB {stats.selectedPayable.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters Bar */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
            {/* Billing Month Select */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Period:
              </span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px] h-9 text-xs bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest Bill (All)</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Branch Filter (for admin or multi-branch viewer) */}
            {branches.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Branch:
                </span>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="w-[170px] h-9 text-xs bg-white dark:bg-slate-900">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Payment Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Status:
              </span>
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs bg-white dark:bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Invoices</SelectItem>
                  <SelectItem value="Unpaid">Unpaid Only</SelectItem>
                  <SelectItem value="Paid">Paid Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, key, contract, meter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-white dark:bg-slate-900"
              />
            </div>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadBills}
              disabled={isLoading}
              className="h-9 px-3 gap-1.5 text-xs shrink-0"
              title="Refresh bills"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              {canPrint && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllFiltered}
                    className="h-8 text-xs font-medium"
                  >
                    Select All ({filteredBills.length})
                  </Button>
                  {selectedBillIds.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSelection}
                      className="h-8 text-xs text-muted-foreground hover:text-slate-900"
                    >
                      Clear Selection
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">
                    <strong>{selectedBillIds.size}</strong> invoice(s) selected
                  </span>
                </>
              )}
              {!canPrint && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  View only — printing requires the <strong className="ml-1">invoice:print</strong> permission
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canExportCSV && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={filteredBills.length === 0}
                  className="h-8 text-xs gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  Export CSV
                </Button>
              )}

              {canExportExcel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportXLSX}
                  disabled={filteredBills.length === 0}
                  className="h-8 text-xs gap-1.5"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                  Export Excel
                </Button>
              )}

              {canPrint && (
                <Button
                  size="sm"
                  onClick={handlePrintBatch}
                  disabled={selectedBillIds.size === 0}
                  className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white font-semibold shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Invoices ({selectedBillIds.size})
                </Button>
              )}
            </div>
          </div>

          {/* Invoices Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-800/60 border-b">
                <TableRow>
                  <TableHead className="w-12 pl-4">
                    <Checkbox
                      checked={isAllPageSelected}
                      onCheckedChange={handleToggleSelectAllPage}
                      aria-label="Select all on this page"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Customer / Bulk Meter
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Meter & Contract
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Branch / Sub-City
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Period
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right text-slate-800 dark:text-slate-200">
                    Usage (m³)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right text-slate-800 dark:text-slate-200">
                    Current (ETB)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right text-slate-800 dark:text-slate-200">
                    Arrears (ETB)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right text-slate-800 dark:text-slate-200">
                    Total Payable
                  </TableHead>
                  <TableHead className="text-xs font-bold text-center text-slate-800 dark:text-slate-200">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right pr-4 text-slate-800 dark:text-slate-200">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCcw className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm">Loading invoices...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Receipt className="h-8 w-8 text-slate-300" />
                        <span className="text-sm font-medium">No invoices found</span>
                        <span className="text-xs text-muted-foreground">
                          Try adjusting your period, branch, or status filter.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedBills.map((row) => {
                    const rowId = String(row.id);
                    const isSelected = selectedBillIds.has(rowId);

                    const tariffs = getTariffs();
                    const isPen = isPenaltyEnabledForPeriod(
                      tariffs,
                      row.month_year,
                      row.charge_group || row.customerType
                    );
                    const penalty = getPenaltyValue(Number(row.PENALTYAMT || 0), isPen);
                    const outstanding = Number(row.OUTSTANDINGAMT || 0);
                    const arrears = Math.max(0, outstanding - penalty);
                    const current = Math.max(
                      0,
                      Number(row.THISMONTHBILLAMT ?? row.TOTALBILLAMOUNT ?? 0)
                    );
                    const totalPayable = outstanding + current;

                    const isPaid =
                      (row.payment_status || "Unpaid").toLowerCase() === "paid";

                    return (
                      <TableRow
                        key={rowId}
                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                      >
                        <TableCell className="pl-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleRow(rowId)}
                            aria-label={`Select ${row.name}`}
                          />
                        </TableCell>

                        {/* Customer Info */}
                        <TableCell className="py-3">
                          <div className="font-bold text-xs text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                            {row.name || "N/A"}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                              {row.CUSTOMERKEY}
                            </span>
                            {row.charge_group && (
                              <span className="text-[10px] text-muted-foreground">
                                • {row.charge_group}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Meter & Contract */}
                        <TableCell className="py-3 font-mono text-xs">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {row.meterNumber || "N/A"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.contractNumber || "-"}
                          </div>
                        </TableCell>

                        {/* Branch */}
                        <TableCell className="py-3 text-xs">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {getBranchLabel(row.branch_id, row.subCity)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.subCity || row.woreda || "-"}
                          </div>
                        </TableCell>

                        {/* Period & Key */}
                        <TableCell className="py-3 text-xs">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.month_year || "N/A"}
                          </div>
                          {row.BILLKEY && (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {row.BILLKEY}
                            </div>
                          )}
                        </TableCell>

                        {/* Usage */}
                        <TableCell className="py-3 text-right font-mono text-xs font-semibold">
                          {Number(row.CONS ?? 0).toFixed(2)}
                        </TableCell>

                        {/* Current */}
                        <TableCell className="py-3 text-right font-mono text-xs text-slate-800 dark:text-slate-200">
                          {current.toFixed(2)}
                        </TableCell>

                        {/* Arrears */}
                        <TableCell className="py-3 text-right font-mono text-xs text-amber-600 dark:text-amber-400 font-medium">
                          {arrears.toFixed(2)}
                        </TableCell>

                        {/* Total Payable */}
                        <TableCell className="py-3 text-right font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          ETB {totalPayable.toFixed(2)}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3 text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Unpaid
                            </span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3 text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                              onClick={() => handlePreview(row)}
                              title="Preview Invoice"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canPrint && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                onClick={() => handleQuickPrint(row)}
                                title="Quick Print Invoice"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination footer */}
            {filteredBills.length > pageSize && (
              <div className="flex items-center justify-between p-3 border-t bg-slate-50/50 text-xs text-muted-foreground">
                <div>
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredBills.length)} of{" "}
                  {filteredBills.length} invoices
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode B: Customer Statements */}
      {activeTab === "customer" && canAccessStatement && (
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Customer Account Invoice Statement
              </CardTitle>
              <CardDescription className="text-xs">
                Look up all past and present invoices for a specific bulk meter customer and print multi-cycle statements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 max-w-lg">
                <Input
                  placeholder="Enter Customer Key (e.g. BM-0001)..."
                  value={customerSearchKey}
                  onChange={(e) => setCustomerSearchKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearchCustomer();
                  }}
                  className="h-9 text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => handleSearchCustomer()}
                  disabled={isCustomerLoading}
                  className="h-9 px-4 gap-1.5 text-xs font-semibold"
                >
                  <Search className="h-3.5 w-3.5" />
                  {isCustomerLoading ? "Searching..." : "Search History"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Customer History Table */}
          {customerBills.length > 0 && (
            <div className="space-y-4">
              {/* Customer Header Info */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {customerBills[0]?.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 font-mono">
                    <span>Key: {customerBills[0]?.CUSTOMERKEY}</span>
                    <span>•</span>
                    <span>Meter: {customerBills[0]?.meterNumber || "N/A"}</span>
                    <span>•</span>
                    <span>Branch: {getBranchLabel(customerBills[0]?.branch_id, customerBills[0]?.subCity)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canPrint && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCustomerBillIds(new Set(customerBills.map((b) => String(b.id))));
                      }}
                      className="h-8 text-xs font-medium"
                    >
                      Select All ({customerBills.length})
                    </Button>
                  )}
                  {canPrint ? (
                    <Button
                      size="sm"
                      onClick={handlePrintCustomerBills}
                      disabled={selectedCustomerBillIds.size === 0}
                      className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white font-semibold"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print Selected Invoices ({selectedCustomerBillIds.size})
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Print requires <strong className="ml-1">invoice:print</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Table of Bills */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50/80 dark:bg-slate-800/60 border-b">
                    <TableRow>
                      <TableHead className="w-12 pl-4">
                        <Checkbox
                          checked={
                            customerBills.length > 0 &&
                            customerBills.every((b) =>
                              selectedCustomerBillIds.has(String(b.id))
                            )
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCustomerBillIds(
                                new Set(customerBills.map((b) => String(b.id)))
                              );
                            } else {
                              setSelectedCustomerBillIds(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="text-xs font-bold">Billing Cycle</TableHead>
                      <TableHead className="text-xs font-bold">Bill Key</TableHead>
                      <TableHead className="text-xs font-bold text-right">Readings (Prev/Curr)</TableHead>
                      <TableHead className="text-xs font-bold text-right">Consumption (m³)</TableHead>
                      <TableHead className="text-xs font-bold text-right">Current Bill</TableHead>
                      <TableHead className="text-xs font-bold text-right">Arrears</TableHead>
                      <TableHead className="text-xs font-bold text-right">Total Payable</TableHead>
                      <TableHead className="text-xs font-bold text-center">Status</TableHead>
                      <TableHead className="text-xs font-bold text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {customerBills.map((row) => {
                      const rowId = String(row.id);
                      const isSelected = selectedCustomerBillIds.has(rowId);

                      const tariffs = getTariffs();
                      const isPen = isPenaltyEnabledForPeriod(
                        tariffs,
                        row.month_year,
                        row.charge_group || row.customerType
                      );
                      const penalty = getPenaltyValue(Number(row.PENALTYAMT || 0), isPen);
                      const outstanding = Number(row.OUTSTANDINGAMT || 0);
                      const arrears = Math.max(0, outstanding - penalty);
                      const current = Math.max(
                        0,
                        Number(row.THISMONTHBILLAMT ?? row.TOTALBILLAMOUNT ?? 0)
                      );
                      const totalPayable = outstanding + current;
                      const isPaid = (row.payment_status || "Unpaid").toLowerCase() === "paid";

                      return (
                        <TableRow
                          key={rowId}
                          className={`hover:bg-slate-50/80 ${isSelected ? "bg-primary/5" : ""}`}
                        >
                          <TableCell className="pl-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => {
                                const next = new Set(selectedCustomerBillIds);
                                if (next.has(rowId)) next.delete(rowId);
                                else next.add(rowId);
                                setSelectedCustomerBillIds(next);
                              }}
                            />
                          </TableCell>
                          <TableCell className="py-3 font-semibold text-xs text-slate-900">
                            {row.month_year}
                          </TableCell>
                          <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                            {row.BILLKEY || "-"}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-xs">
                            {Number(row.PREVREAD ?? 0).toFixed(1)} / {Number(row.CURRREAD ?? 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-xs font-semibold">
                            {Number(row.CONS ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-xs">
                            ETB {current.toFixed(2)}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-xs text-amber-600">
                            ETB {arrears.toFixed(2)}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-xs font-bold">
                            ETB {totalPayable.toFixed(2)}
                          </TableCell>
                          <TableCell className="py-3 text-center">
                            {isPaid ? (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
                                Paid
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-rose-700 border-rose-300 bg-rose-50 text-[10px]">
                                Unpaid
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                                onClick={() => handlePreview(row)}
                                title="Preview Invoice"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canPrint && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => handleQuickPrint(row)}
                                  title="Print Invoice"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice Preview Dialog */}
      {previewItem && (
        <InvoicePreviewDialog
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          meter={previewItem.meter}
          bill={previewItem.bill}
          branchName={getBranchLabel(previewItem.meter.branchId, previewItem.meter.subCity)}
          printRoute={printRoute}
          canPrint={canPrint}
        />
      )}
    </div>
  );
}
