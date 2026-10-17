"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  User,
  ArrowLeft,
  Gauge,
  CreditCard,
  MapPin,
  Phone,
  Layers,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  Edit,
  ExternalLink,
  DollarSign,
  Activity,
  AlertTriangle,
  History,
  Loader2,
  Trash2,
  Menu,
  FileEdit,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TablePagination } from "@/components/ui/table-pagination";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import {
  fetchCustomerByKey,
  updateCustomer as updateCustomerInStore,
  deleteCustomer as deleteCustomerFromStore,
  approveCustomer as approveCustomerInStore,
  rejectCustomer as rejectCustomerInStore,
  getBranches,
  initializeBranches,
  initializeTariffs,
  getBulkMeters,
  initializeBulkMeters,
} from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import {
  getIndividualCustomerReadingHistoryAction,
  calculateBillAction,
  type IndividualCustomerReadingHistoryItem,
} from "@/lib/actions";
import type { BillCalculationResult } from "@/lib/billing-calculations";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "@/app/(dashboard)/admin/individual-customers/individual-customer-form-dialog";

export default function IndividualCustomerDetailsClient() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const isAdmin = !pathname?.startsWith("/staff");
  const basePath = isAdmin ? "/admin" : "/staff";

  // URL param can be id or array of id segments
  const rawId = params?.id;
  const customerKey = Array.isArray(rawId) ? rawId.join("/") : (rawId as string);

  const [customer, setCustomer] = useState<IndividualCustomer | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bulkMetersList, setBulkMetersList] = useState<{ customerKeyNumber: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Billing & History states
  const [billBreakdown, setBillBreakdown] = useState<BillCalculationResult | null>(null);
  const [readingHistory, setReadingHistory] = useState<IndividualCustomerReadingHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(10);

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const loadCustomerData = useCallback(async () => {
    if (!customerKey) return;
    setIsLoading(true);

    try {
      await Promise.all([
        initializeBranches(true),
        initializeBulkMeters(true),
        initializeTariffs(true),
      ]);

      const foundCustomer = await fetchCustomerByKey(customerKey);
      setBranches(getBranches());
      setBulkMetersList(
        getBulkMeters()
          .filter((bm) => bm.status === "Active")
          .map((bm) => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name }))
      );

      if (foundCustomer) {
        let userBranchId: string | undefined;
        try {
          const stored = localStorage.getItem("user");
          if (stored) {
            const u = JSON.parse(stored);
            userBranchId = u.branchId;
          }
        } catch (_) {}

        if (!isAdmin && userBranchId && foundCustomer.branchId && String(foundCustomer.branchId).trim().toLowerCase() !== String(userBranchId).trim().toLowerCase()) {
          setCustomer(null);
          toast({
            title: "Access Denied",
            description: "You are not authorized to view this customer as they belong to another branch.",
            variant: "destructive",
          });
          router.push("/staff/individual-customers");
          return;
        }

        setCustomer(foundCustomer);
      } else {
        setCustomer(null);
        toast({
          title: "Customer Not Found",
          description: `No individual customer found with key "${customerKey}".`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error loading individual customer:", err);
      toast({
        title: "Error Loading Customer",
        description: "Could not load customer details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [customerKey, toast]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Load reading history
  useEffect(() => {
    if (!customerKey) return;
    let isMounted = true;
    setIsLoadingHistory(true);

    getIndividualCustomerReadingHistoryAction(customerKey)
      .then((res) => {
        if (isMounted && res.data) {
          setReadingHistory(res.data);
        }
      })
      .catch((err) => console.error("Error fetching reading history:", err))
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [customerKey]);

  // Calculate bill breakdown
  const rawUsage = customer ? (customer.currentReading ?? 0) - (customer.previousReading ?? 0) : 0;
  const isMinApplied = customer?.isMinOfThreeApplied || (rawUsage < 3 && rawUsage >= 0);
  const effectiveUsage = customer?.effectiveUsage ?? (isMinApplied ? 3 : Math.max(0, rawUsage));

  useEffect(() => {
    if (!customer) return;
    calculateBillAction(
      effectiveUsage,
      customer.customerType || "Domestic",
      customer.sewerageConnection || "No",
      customer.meterSize || 0.5,
      customer.month || new Date().toISOString().slice(0, 7)
    )
      .then((res) => {
        if (res.data) setBillBreakdown(res.data);
      })
      .catch((err) => console.error("Error calculating bill breakdown:", err));
  }, [customer, effectiveUsage]);

  // Handlers
  const handleApprove = async () => {
    if (!customer) return;
    const res = await approveCustomerInStore(customer.customerKeyNumber, "user");
    if (res.success) {
      toast({ title: "Customer Approved", description: `${customer.name} is now Active.` });
      setCustomer((prev: IndividualCustomer | null) => (prev ? { ...prev, status: "Active" } : null));
    } else {
      toast({ title: "Approval Failed", description: res.message || "Failed to approve customer.", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!customer) return;
    const res = await rejectCustomerInStore(customer.customerKeyNumber, "user");
    if (res.success) {
      toast({ title: "Customer Rejected", description: `${customer.name} has been marked as Rejected.` });
      setCustomer((prev: IndividualCustomer | null) => (prev ? { ...prev, status: "Rejected" } : null));
    } else {
      toast({ title: "Rejection Failed", description: res.message || "Failed to reject customer.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    const res = await deleteCustomerFromStore(customer.customerKeyNumber);
    if (res.success) {
      toast({ title: "Customer Deleted", description: `${customer.name} has been removed.` });
      router.push(`${basePath}/individual-customers`);
    } else {
      toast({ title: "Delete Failed", description: res.message || "Failed to delete customer.", variant: "destructive" });
    }
    setIsDeleteDialogOpen(false);
  };

  const handleEditSubmit = async (values: IndividualCustomerFormValues) => {
    if (!customer) return;
    const res = await updateCustomerInStore(customer.customerKeyNumber, values);
    if (res.success) {
      toast({ title: "Customer Updated", description: `${values.name} has been updated successfully.` });
      setIsEditDialogOpen(false);
      loadCustomerData();
    } else {
      toast({ title: "Update Failed", description: res.message || "Could not update customer.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading individual customer details...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Individual customer not found or has been removed.</p>
        <Button variant="outline" onClick={() => router.push(`${basePath}/individual-customers`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Individual Customers
        </Button>
      </div>
    );
  }

  const branchName = branches.find((b) => b.id === customer.branchId)?.name || customer.subCity || "N/A";
  const parentBulkMeter = bulkMetersList.find((bm) => bm.customerKeyNumber === customer.assignedBulkMeterId);

  const paginatedHistory = readingHistory.slice(
    historyPage * historyRowsPerPage,
    historyPage * historyRowsPerPage + historyRowsPerPage
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`${basePath}/individual-customers`)}
            className="gap-1.5 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href={`${basePath}/dashboard`} className="hover:underline">Dashboard</Link>
              <span>/</span>
              <Link href={`${basePath}/individual-customers`} className="hover:underline">Individual Customers</Link>
              <span>/</span>
              <span className="text-foreground font-medium truncate max-w-[200px]">{customer.name}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-0.5">
              <User className="h-6 w-6 text-primary" />
              {customer.name}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {customer.status === "Pending Approval" && hasPermission("customers_approve") && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                onClick={handleApprove}
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-rose-700 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                onClick={handleReject}
              >
                <XCircle className="h-4 w-4 text-rose-600" />
                Reject
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 p-0">
                <span className="sr-only">Open menu</span>
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hasPermission("customers_update") && (
                <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                  <FileEdit className="mr-2 h-4 w-4" />
                  <span>Edit Customer</span>
                </DropdownMenuItem>
              )}
              {hasPermission("customers_delete") && (
                <DropdownMenuItem
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete Customer</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Grid — 2 columns on XL matching BulkMeterDetails */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Customer Details Card */}
        <Card className="shadow-lg xl:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-4">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-200">
                <User className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold">{customer.name}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span>Key: <strong className="text-foreground">{customer.customerKeyNumber}</strong></span>
                  <span>•</span>
                  <span>METER_KEY: <strong className="text-foreground">{customer.meterNumber}</strong></span>
                  {customer.contractNumber && (
                    <>
                      <span>•</span>
                      <span>Contract: <strong className="text-foreground">{customer.contractNumber}</strong></span>
                    </>
                  )}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {customer.status === "Active" && (
                <Badge className="bg-emerald-500 text-white border-0 text-xs font-semibold px-2.5 py-0.5">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                </Badge>
              )}
              {customer.status === "Pending Approval" && (
                <Badge className="bg-amber-500 text-white border-0 text-xs font-semibold px-2.5 py-0.5">
                  <Clock className="h-3 w-3 mr-1" /> Pending
                </Badge>
              )}
              {customer.status === "Rejected" && (
                <Badge className="bg-rose-500 text-white border-0 text-xs font-semibold px-2.5 py-0.5">
                  <XCircle className="h-3 w-3 mr-1" /> Rejected
                </Badge>
              )}
              {customer.status === "Inactive" && (
                <Badge className="bg-slate-500 text-white border-0 text-xs font-semibold px-2.5 py-0.5">
                  Inactive
                </Badge>
              )}
              {customer.paymentStatus === "Paid" ? (
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300">
                  Paid
                </Badge>
              ) : (
                <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-300">
                  Unpaid
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {/* Left Column Key-Values */}
              <div className="space-y-2">
                {[
                  { label: "Customer Type", value: customer.customerType || "Domestic" },
                  { label: "Meter Size", value: customer.meterSize ? `${customer.meterSize} inch` : "N/A" },
                  { label: "Sewerage Link", value: customer.sewerageConnection || "No" },
                  { label: "INST_KEY", value: customer.instKey || "N/A", isMono: true },
                  { label: "Book / Ordinal", value: `${customer.bookNumber || "N/A"} / #${customer.ordinal || "N/A"}` },
                  { label: "Previous Reading", value: `${Number(customer.previousReading ?? 0).toFixed(2)} m³`, isMono: true },
                  { label: "Current Reading", value: `${Number(customer.currentReading ?? 0).toFixed(2)} m³`, isMono: true },
                ].map(({ label, value, isMono }) => (
                  <div key={label} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50">
                    <span className="text-muted-foreground font-medium">{label}</span>
                    <span className={`font-semibold text-foreground ${isMono ? "font-mono" : ""}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Right Column Key-Values */}
              <div className="space-y-2">
                {[
                  { label: "Branch", value: branchName },
                  { label: "Route Key", value: customer.routeKey || "N/A", isMono: true },
                  { label: "Sub-City / Woreda", value: `${customer.subCity || "N/A"}, ${customer.woreda ? `Woreda ${customer.woreda}` : ""}` },
                  { label: "Specific Area", value: customer.specificArea || "N/A" },
                  { label: "Phone", value: customer.phoneNumber || "N/A", isMono: true },
                  { label: "Number of Dials", value: customer.NUMBER_OF_DIALS || "N/A" },
                  {
                    label: "GPS Coordinates",
                    value: (customer.xCoordinate || customer.yCoordinate) ? `X: ${customer.xCoordinate ?? "-"}, Y: ${customer.yCoordinate ?? "-"}` : "N/A",
                    isMono: true,
                  },
                ].map(({ label, value, isMono }) => (
                  <div key={label} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50">
                    <span className="text-muted-foreground font-medium">{label}</span>
                    <span className={`font-semibold text-foreground truncate max-w-[220px] ${isMono ? "font-mono" : ""}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Billing Summary & Parent Bulk Meter */}
        <div className="space-y-6">
          {/* Current Period Billing Card */}
          <Card className="shadow-lg">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Current Period Billing
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[11px]">
                  {customer.month || "Current"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">Effective Consumption</span>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100">
                    {effectiveUsage.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">m³</span>
                  </div>
                  {isMinApplied && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <AlertTriangle className="h-3 w-3" /> Min 3m³ applied
                    </div>
                  )}
                </div>
                <Gauge className="h-8 w-8 text-blue-500 opacity-80" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">Calculated Bill</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {customer.calculatedBill?.toFixed(2) || "0.00"} <span className="text-xs font-normal text-muted-foreground">ETB</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Status: {customer.paymentStatus || "Unpaid"}</span>
                </div>
                <DollarSign className="h-8 w-8 text-emerald-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          {/* Parent Bulk Meter Card */}
          <Card className="shadow-lg bg-gradient-to-br from-indigo-50/60 via-background to-background border-indigo-200/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                <Layers className="h-4 w-4 text-indigo-600" />
                Parent Bulk Meter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.assignedBulkMeterId ? (
                <>
                  <div>
                    <div className="font-bold text-foreground text-sm">
                      {parentBulkMeter?.name || "Assigned Bulk Meter"}
                    </div>
                    <div className="font-mono text-xs text-indigo-700 dark:text-indigo-400 font-semibold mt-0.5">
                      Key: {customer.assignedBulkMeterId}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full gap-1.5 h-8 text-xs font-semibold">
                    <Link href={`${basePath}/bulk-meters/${customer.assignedBulkMeterId}`}>
                      View Bulk Meter Details <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">No bulk meter currently assigned to this customer.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bill Fee Breakdown Card */}
      {billBreakdown && (
        <Card className="shadow-lg">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                Bill Fee Breakdown
              </CardTitle>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Tariff Calculated
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-muted-foreground block font-medium">Base Water</span>
                <span className="font-mono font-bold text-sm text-foreground">{billBreakdown.baseWaterCharge.toFixed(2)} ETB</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-muted-foreground block font-medium">Sewerage</span>
                <span className="font-mono font-bold text-sm text-foreground">{billBreakdown.sewerageCharge.toFixed(2)} ETB</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-muted-foreground block font-medium">Maintenance</span>
                <span className="font-mono font-bold text-sm text-foreground">{billBreakdown.maintenanceFee.toFixed(2)} ETB</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-muted-foreground block font-medium">Sanitation</span>
                <span className="font-mono font-bold text-sm text-foreground">{billBreakdown.sanitationFee.toFixed(2)} ETB</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-muted-foreground block font-medium">Meter Rent</span>
                <span className="font-mono font-bold text-sm text-foreground">{billBreakdown.meterRent.toFixed(2)} ETB</span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200">
                <span className="text-emerald-700 dark:text-emerald-400 block font-bold">Total Bill</span>
                <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">{billBreakdown.totalBill.toFixed(2)} ETB</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reading & Billing History Table Card matching Meter Reading History in BulkMeterDetails */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-violet-500" />
              Reading &amp; Billing History
            </CardTitle>
            <CardDescription>
              Complete historical record of meter readings and bills for this individual consumer.
            </CardDescription>
          </div>
          {readingHistory.length > 0 && (
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200/60 font-semibold px-2.5 py-0.5">
              {readingHistory.length} total records
            </Badge>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading history records...
            </div>
          ) : readingHistory.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
              <History className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-foreground">No reading or billing history found.</p>
              <p className="text-xs text-muted-foreground mt-1">Meter readings recorded for this customer will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold py-3 text-xs">Period</TableHead>
                      <TableHead className="text-right font-bold py-3 text-xs">Prev Reading</TableHead>
                      <TableHead className="text-right font-bold py-3 text-xs">Curr Reading</TableHead>
                      <TableHead className="text-right font-bold py-3 text-xs">Usage (m³)</TableHead>
                      <TableHead className="text-right font-bold py-3 text-xs">Bill (ETB)</TableHead>
                      <TableHead className="text-center font-bold py-3 text-xs">Pay Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedHistory.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-semibold text-xs font-mono py-3">
                          {row.monthYear || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs py-3 text-muted-foreground">
                          {row.prevRead.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs py-3 font-bold text-foreground">
                          {row.currRead.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs py-3">
                          <span className={row.usage > 0 ? "text-blue-700 dark:text-blue-400 font-bold" : "text-muted-foreground"}>
                            {row.usage.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs py-3">
                          {row.billAmount != null ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">
                              {row.billAmount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          {row.paymentStatus ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                row.paymentStatus === "Paid"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : row.paymentStatus === "Pending"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {row.paymentStatus}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {readingHistory.length > 5 && (
                <TablePagination
                  count={readingHistory.length}
                  page={historyPage}
                  rowsPerPage={historyRowsPerPage}
                  onPageChange={setHistoryPage}
                  onRowsPerPageChange={(v) => {
                    setHistoryRowsPerPage(v);
                    setHistoryPage(0);
                  }}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Customer Dialog */}
      <IndividualCustomerFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={handleEditSubmit}
        defaultValues={customer}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark individual customer <strong>{customer.name}</strong> ({customer.customerKeyNumber}) as deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
