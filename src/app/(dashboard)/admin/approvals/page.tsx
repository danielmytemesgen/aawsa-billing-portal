
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  getCustomers,
  subscribeToCustomers,
  initializeCustomers,
  approveCustomer,
  rejectCustomer,
  getBulkMeters,
  subscribeToBulkMeters,
  initializeBulkMeters,
  approveBulkMeter,
  rejectBulkMeter,
  getBranches,
  initializeBranches,
  subscribeToBranches,
  updateCustomer,
  updateBulkMeter,
  addNotification,
} from "@/lib/data-store";
import type { IndividualCustomer } from "../individual-customers/individual-customer-types";
import type { BulkMeter } from "../bulk-meters/bulk-meter-types";
import type { StaffMember } from "../staff-management/staff-types";
import type { Branch } from "../branches/branch-types";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { getEffectiveBranchId } from "@/lib/branch-permissions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Check,
  Lock,
  ShieldCheck,
  UserCheck,
  FileEdit,
  CheckCircle,
  Loader2,
  Search,
  Building2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "../individual-customers/individual-customer-form-dialog";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "../bulk-meters/bulk-meter-form-dialog";
import { IndividualCustomerTable } from "../individual-customers/individual-customer-table";
import { BulkMeterTable } from "../bulk-meters/bulk-meter-table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/ui/table-pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const AMENDMENT_REASONS = [
  "🏷️ Meter Key Mismatch",
  "🏷️ GPS / Location Error",
  "🏷️ Missing Document",
  "🏷️ Wrong Tariff Category",
  "🏷️ Duplicate Record",
  "🏷️ Customer Info Incomplete",
  "🏷️ Other",
] as const;

/** Approve items in parallel, capped at concurrency of 5 at a time */
async function batchApprove<T>(
  items: T[],
  approveFn: (item: T) => Promise<{ success: boolean; message?: string }>,
  onProgress?: (done: number, total: number) => void
): Promise<{ successCount: number; failCount: number }> {
  const CHUNK = 5;
  let successCount = 0;
  let failCount = 0;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const results = await Promise.allSettled(chunk.map(approveFn));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.success) successCount++;
      else failCount++;
    }
    onProgress?.(Math.min(i + CHUNK, items.length), items.length);
  }
  return { successCount, failCount };
}

export default function ApprovalsPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);
  const [customers, setCustomers] = React.useState<IndividualCustomer[]>([]);
  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Action state
  const [actionType, setActionType] = React.useState<"approve" | "reject" | null>(null);
  const [selectedEntity, setSelectedEntity] = React.useState<IndividualCustomer | BulkMeter | null>(null);
  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const [amendmentStep, setAmendmentStep] = React.useState<"review" | "amend">("review");
  const [selectedReason, setSelectedReason] = React.useState<string>(AMENDMENT_REASONS[0]);
  const [amendmentNote, setAmendmentNote] = React.useState("");

  const getFullAmendmentReason = () => {
    const r = (selectedReason || "").trim();
    const n = amendmentNote.trim();
    if (r && n) return `${r} - ${n}`;
    return r || n || "Amendment requested";
  };
    
  // Edit dialogs
  const [isCustomerFormOpen, setIsCustomerFormOpen] = React.useState(false);
  const [customerToEdit, setCustomerToEdit] = React.useState<IndividualCustomer | null>(null);
  const [isBulkFormOpen, setIsBulkFormOpen] = React.useState(false);
  const [bulkMeterToEdit, setBulkMeterToEdit] = React.useState<BulkMeter | null>(null);

  // Pagination
  const [customerPage, setCustomerPage] = React.useState(0);
  const [customerRowsPerPage, setCustomerRowsPerPage] = React.useState(10);
  const [bulkMeterPage, setBulkMeterPage] = React.useState(0);
  const [bulkMeterRowsPerPage, setBulkMeterRowsPerPage] = React.useState(10);

  // Bulk approval
  const [isBulkCustomerDialogOpen, setIsBulkCustomerDialogOpen] = React.useState(false);
  const [isBulkMeterDialogOpen, setIsBulkMeterDialogOpen] = React.useState(false);
  const [isProcessingBulk, setIsProcessingBulk] = React.useState(false);
  const [bulkProgress, setBulkProgress] = React.useState({ done: 0, total: 0 });
  // "review" = main step (approve / request amendment); "amend" = reason picker step
  const [bulkCustomerAmendStep, setBulkCustomerAmendStep] = React.useState<"review" | "amend">("review");
  const [bulkMeterAmendStep, setBulkMeterAmendStep] = React.useState<"review" | "amend">("review");

  // Search & Branch Filter
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [bulkMeterSearch, setBulkMeterSearch] = React.useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = React.useState<string>("all");

  // Computed branch scope (uses permission system, not role name string matching)
  const effectiveCustomerBranchId = React.useMemo(
    () => getEffectiveBranchId(hasPermission, "customers", currentUser?.branchId),
    [hasPermission, currentUser]
  );
  const effectiveBulkMeterBranchId = React.useMemo(
    () => getEffectiveBranchId(hasPermission, "bulk_meters", currentUser?.branchId),
    [hasPermission, currentUser]
  );

  // Is this user a head-office / admin who can see all branches?
  const isGlobalApprover = effectiveCustomerBranchId === undefined && effectiveBulkMeterBranchId === undefined;

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      await Promise.all([
        initializeCustomers(true, {
          status: "Pending Approval",
          branchId: effectiveCustomerBranchId,
        }),
        initializeBulkMeters(true, {
          status: "Pending Approval",
          branchId: effectiveBulkMeterBranchId,
        }),
        initializeBranches(),
      ]);
      setCustomers(getCustomers().filter((c) => c.status === "Pending Approval"));
      setBulkMeters(getBulkMeters().filter((bm) => bm.status === "Pending Approval"));
      setBranches(getBranches());
    } catch (err) {
      console.error("Failed to load pending approvals:", err);
      setLoadError("Failed to load pending approvals. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [effectiveCustomerBranchId, effectiveBulkMeterBranchId]);

  React.useEffect(() => {
    const userJson = localStorage.getItem("user");
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }
  }, []);

  React.useEffect(() => {
    if (currentUser !== undefined) {
      loadData();
    }
  }, [loadData, currentUser]);

  React.useEffect(() => {
    const unsubscribeCustomers = subscribeToCustomers((all) => {
      setCustomers(all.filter((c) => c.status === "Pending Approval"));
    });
    const unsubscribeBulkMeters = subscribeToBulkMeters((all) => {
      setAllBulkMeters(all);
      setBulkMeters(all.filter((bm) => bm.status === "Pending Approval"));
    });
    const unsubscribeBranches = subscribeToBranches(setBranches);
    return () => {
      unsubscribeCustomers();
      unsubscribeBulkMeters();
      unsubscribeBranches();
    };
  }, []);

  React.useEffect(() => {
    const handleDataRefreshed = () => {
      setCustomers(getCustomers().filter((c) => c.status === "Pending Approval"));
      setBulkMeters(getBulkMeters().filter((bm) => bm.status === "Pending Approval"));
      setBranches(getBranches());
    };
    window.addEventListener("data-refreshed", handleDataRefreshed);
    return () => window.removeEventListener("data-refreshed", handleDataRefreshed);
  }, []);

  // Filtered & searched pending lists with branch isolation
  const pendingCustomers = React.useMemo(() => {
    let list = customers.filter((c) => c.status === "Pending Approval");

    // Layer 2: client-side branch filter using permission system
    if (effectiveCustomerBranchId) {
      list = list.filter(
        (c) => c.branchId === effectiveCustomerBranchId
      );
    }

    // Head-office optional branch filter
    if (isGlobalApprover && selectedBranchFilter !== "all") {
      list = list.filter((c) => c.branchId === selectedBranchFilter);
    }

    // Search
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.customerKeyNumber?.toLowerCase().includes(q) ||
          c.contractNumber?.toLowerCase().includes(q) ||
          c.phoneNumber?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [customers, effectiveCustomerBranchId, isGlobalApprover, selectedBranchFilter, customerSearch]);

  const pendingBulkMeters = React.useMemo(() => {
    let list = bulkMeters.filter((bm) => bm.status === "Pending Approval");

    // Layer 2: client-side branch filter using permission system
    if (effectiveBulkMeterBranchId) {
      list = list.filter(
        (bm) => bm.branchId === effectiveBulkMeterBranchId
      );
    }

    // Head-office optional branch filter
    if (isGlobalApprover && selectedBranchFilter !== "all") {
      list = list.filter((bm) => bm.branchId === selectedBranchFilter);
    }

    // Search
    if (bulkMeterSearch.trim()) {
      const q = bulkMeterSearch.toLowerCase();
      list = list.filter(
        (bm) =>
          bm.name?.toLowerCase().includes(q) ||
          bm.customerKeyNumber?.toLowerCase().includes(q) ||
          bm.contractNumber?.toLowerCase().includes(q) ||
          bm.phoneNumber?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [bulkMeters, effectiveBulkMeterBranchId, isGlobalApprover, selectedBranchFilter, bulkMeterSearch]);

  const paginatedCustomers = React.useMemo(
    () => pendingCustomers.slice(customerPage * customerRowsPerPage, customerPage * customerRowsPerPage + customerRowsPerPage),
    [pendingCustomers, customerPage, customerRowsPerPage]
  );

  const paginatedBulkMeters = React.useMemo(
    () => pendingBulkMeters.slice(bulkMeterPage * bulkMeterRowsPerPage, bulkMeterPage * bulkMeterRowsPerPage + bulkMeterRowsPerPage),
    [pendingBulkMeters, bulkMeterPage, bulkMeterRowsPerPage]
  );

  // --- Action Handlers ---

  const handleApproveClick = (entity: IndividualCustomer | BulkMeter) => {
    setSelectedEntity(entity);
    setActionType("approve");
    setAmendmentStep("review");
    setSelectedReason(AMENDMENT_REASONS[0]);
    setAmendmentNote("");
  };

  const handleRejectClick = (entity: IndividualCustomer | BulkMeter) => {
    setSelectedEntity(entity);
    setActionType("reject");
    setAmendmentStep("amend");
    setSelectedReason(AMENDMENT_REASONS[0]);
    setAmendmentNote("");
  };

  const handleOpenEditCustomer = (customer: IndividualCustomer) => {
    setCustomerToEdit(customer);
    setIsCustomerFormOpen(true);
  };

  const handleOpenEditBulkMeter = (bm: BulkMeter) => {
    setBulkMeterToEdit(bm);
    setIsBulkFormOpen(true);
  };

  /** Layer 3: Verify branch authorization before executing approval/rejection */
  const verifyBranchAuthorization = (entity: IndividualCustomer | BulkMeter, domain: "customers" | "bulk_meters"): boolean => {
    const effectiveBranchId = domain === "customers" ? effectiveCustomerBranchId : effectiveBulkMeterBranchId;
    if (!effectiveBranchId) return true; // Global approver — no restriction
    const entityBranchId = (entity as any).branchId;
    if (!entityBranchId || entityBranchId !== effectiveBranchId) {
      toast({
        variant: "destructive",
        title: "Branch Authorization Failed",
        description: "You can only approve or reject records belonging to your assigned branch.",
      });
      return false;
    }
    return true;
  };

  const confirmAction = async (action: "approve" | "reject", reason?: string) => {
    if (!selectedEntity || !currentUser || isActionLoading) return;

    const isCustomer = "customerType" in selectedEntity;
    const domain = isCustomer ? "customers" : "bulk_meters";

    // Layer 3: Branch authorization check
    if (!verifyBranchAuthorization(selectedEntity, domain)) {
      setSelectedEntity(null);
      setActionType(null);
      return;
    }

    setActionType(action);
    setIsActionLoading(true);
    try {
      const entityKey = "customerKeyNumber" in selectedEntity ? selectedEntity.customerKeyNumber : "";
      let result;

      if (action === "approve") {
        result = isCustomer
          ? await approveCustomer(entityKey, currentUser.id)
          : await approveBulkMeter(entityKey, currentUser.id);

        // Submitter notification
        addNotification({
          title: "Registration Approved",
          message: `Registration for "${selectedEntity.name}" (${entityKey}) was approved and is now active.`,
          senderName: currentUser.name || "System Approver",
          targetBranchId: (selectedEntity as any).branchId || null,
        }).catch(() => {});
      } else {
        result = isCustomer
          ? await rejectCustomer(entityKey, currentUser.id, reason)
          : await rejectBulkMeter(entityKey, currentUser.id, reason);

        // Submitter amendment alert
        addNotification({
          title: "Amendment Required",
          message: `Registration for "${selectedEntity.name}" requires corrections: ${reason || "Please review and revise details."}`,
          senderName: currentUser.name || "System Approver",
          targetBranchId: (selectedEntity as any).branchId || null,
        }).catch(() => {});
      }

      if (result.success) {
        toast({
          title: `${isCustomer ? "Customer" : "Bulk Meter"} ${action === "approve" ? "Approved" : "Sent for Amendment"}`,
          description: `${selectedEntity.name} has been ${action === "approve" ? "activated" : "marked for correction with feedback"}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Action Failed",
          description: result.message || "An unexpected error occurred.",
        });
      }
    } finally {
      setIsActionLoading(false);
      setSelectedEntity(null);
      setActionType(null);
    }
  };

  const handleBulkApproveCustomers = async () => {
    if (pendingCustomers.length === 0 || !currentUser) return;
    setIsProcessingBulk(true);
    setBulkProgress({ done: 0, total: pendingCustomers.length });

    const { successCount, failCount } = await batchApprove(
      pendingCustomers,
      (c) => approveCustomer(c.customerKeyNumber, currentUser.id),
      (done, total) => setBulkProgress({ done, total })
    );

    toast({
      title: "Bulk Approval Complete",
      description: `Approved ${successCount} customers.${failCount > 0 ? ` ${failCount} failed.` : ""}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
    setIsProcessingBulk(false);
    setIsBulkCustomerDialogOpen(false);
    setBulkProgress({ done: 0, total: 0 });
  };

  const handleBulkApproveBulkMeters = async () => {
    if (pendingBulkMeters.length === 0 || !currentUser) return;
    setIsProcessingBulk(true);
    setBulkProgress({ done: 0, total: pendingBulkMeters.length });

    const { successCount, failCount } = await batchApprove(
      pendingBulkMeters,
      (bm) => approveBulkMeter(bm.customerKeyNumber, currentUser.id),
      (done, total) => setBulkProgress({ done, total })
    );

    toast({
      title: "Bulk Approval Complete",
      description: `Approved ${successCount} bulk meters.${failCount > 0 ? ` ${failCount} failed.` : ""}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
    setIsProcessingBulk(false);
    setIsBulkMeterDialogOpen(false);
    setBulkProgress({ done: 0, total: 0 });
  };

  const handleSubmitCustomerEdit = async (values: IndividualCustomerFormValues) => {
    if (!customerToEdit) return;
    try {
      const result = await updateCustomer(customerToEdit.customerKeyNumber, values as any);
      if (result.success) {
        toast({ title: "Customer Updated", description: `${values.name} has been updated.` });
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.message || "Could not update customer." });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Update Failed", description: "An unexpected error occurred." });
    } finally {
      setIsCustomerFormOpen(false);
      setCustomerToEdit(null);
    }
  };

  const handleSubmitBulkMeterEdit = async (values: BulkMeterFormValues) => {
    if (!bulkMeterToEdit) return;
    try {
      const result = await updateBulkMeter(bulkMeterToEdit.customerKeyNumber, values as any);
      if (result.success) {
        toast({ title: "Bulk Meter Updated", description: `${values.name} has been updated.` });
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.message || "Could not update bulk meter." });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Update Failed", description: "An unexpected error occurred." });
    } finally {
      setIsBulkFormOpen(false);
      setBulkMeterToEdit(null);
    }
  };


  const handleBulkAmendCustomers = async (reason?: string) => {
    if (pendingCustomers.length === 0 || !currentUser) return;
    setIsProcessingBulk(true);
    setBulkProgress({ done: 0, total: pendingCustomers.length });

    const { successCount, failCount } = await batchApprove(
      pendingCustomers,
      (c) => rejectCustomer(c.customerKeyNumber, currentUser.id, reason),
      (done, total) => setBulkProgress({ done, total })
    );

    addNotification({
      title: "Bulk Amendment Requested",
      message: `${successCount} customer registrations were sent back for amendment: ${reason || "General review requested."}`,
      senderName: currentUser.name || "System Approver",
      targetBranchId: currentUser.branchId || null,
    }).catch(() => {});

    toast({
      title: "Amendment Requested",
      description: `Sent ${successCount} customers back for amendment.${failCount > 0 ? ` ${failCount} failed.` : ""}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
    await loadData();
    setIsProcessingBulk(false);
    setIsBulkCustomerDialogOpen(false);
    setBulkProgress({ done: 0, total: 0 });
  };

  const handleBulkAmendBulkMeters = async (reason?: string) => {
    if (pendingBulkMeters.length === 0 || !currentUser) return;
    setIsProcessingBulk(true);
    setBulkProgress({ done: 0, total: pendingBulkMeters.length });

    const { successCount, failCount } = await batchApprove(
      pendingBulkMeters,
      (bm) => rejectBulkMeter(bm.customerKeyNumber, currentUser.id, reason),
      (done, total) => setBulkProgress({ done, total })
    );

    addNotification({
      title: "Bulk Amendment Requested",
      message: `${successCount} bulk meter registrations were sent back for amendment: ${reason || "General review requested."}`,
      senderName: currentUser.name || "System Approver",
      targetBranchId: currentUser.branchId || null,
    }).catch(() => {});

    toast({
      title: "Amendment Requested",
      description: `Sent ${successCount} bulk meters back for amendment.${failCount > 0 ? ` ${failCount} failed.` : ""}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
    await loadData();
    setIsProcessingBulk(false);
    setIsBulkMeterDialogOpen(false);
    setBulkProgress({ done: 0, total: 0 });
  };
  // --- Permission Checks ---
  const hasApprovalPermission =
    hasPermission(PERMISSIONS.CUSTOMERS_APPROVE) ||
    hasPermission(PERMISSIONS.BULK_METERS_APPROVE) ||
    hasPermission(PERMISSIONS.BILL_APPROVE);

  const canApproveCustomers = hasPermission(PERMISSIONS.CUSTOMERS_APPROVE);
  const canApproveBulkMeters = hasPermission(PERMISSIONS.BULK_METERS_APPROVE);

  if (!hasApprovalPermission) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Approvals</h1>
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to approve or reject records.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const dialogTitle = "Review Record";
  const dialogDescription = `Choose an action for the record of "${selectedEntity?.name}".
Approve to make it active and billable, or Request Amendment to send it back for corrections.`;

  // Find branch name helper
  const getBranchLabel = (branchId?: string) => {
    if (!branchId) return null;
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Approvals</h1>
            <p className="text-muted-foreground">Review and approve or request amendments for new registrations.</p>
          </div>
        </div>

        {/* Branch scope badge */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {isGlobalApprover ? (
            <Badge variant="secondary" className="text-xs">Head Office — All Branches</Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-primary text-primary">
              Branch: {getBranchLabel(currentUser?.branchId) ?? currentUser?.branchId ?? "Assigned Branch"}
            </Badge>
          )}
        </div>
      </div>

      {/* Head-office branch filter */}
      {isGlobalApprover && branches.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-dashed">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Filter by branch:</span>
          <Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}>
            <SelectTrigger className="w-56 h-8 text-sm">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBranchFilter !== "all" && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedBranchFilter("all")}>
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to Load Approvals</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            {loadError}
            <Button variant="outline" size="sm" onClick={loadData} className="ml-2 h-7 gap-1">
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* --- Pending Individual Customers --- */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Pending Individual Customers</CardTitle>
            <CardDescription>
              Customers awaiting approval to become active.
              {pendingCustomers.length > 0 && (
                <span className="ml-2 font-semibold text-foreground">{pendingCustomers.length} pending</span>
              )}
            </CardDescription>
          </div>
          {pendingCustomers.length > 0 && canApproveCustomers && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
              onClick={() => setIsBulkCustomerDialogOpen(true)}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve All {pendingCustomers.length}
            </Button>
          )}
        </CardHeader>

        {/* Customer search bar */}
        {!isLoading && !loadError && (
          <div className="px-6 pb-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, key, contract, phone…"
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setCustomerPage(0); }}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>
        )}

        <CardContent>
          {isLoading ? (
            <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading pending customers…
            </div>
          ) : loadError ? null : pendingCustomers.length === 0 ? (
            <div className="mt-4 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">All Clear!</h3>
              <p className="text-muted-foreground mt-1">
                {customerSearch ? "No results match your search." : "No pending customer approvals at this time."}
              </p>
            </div>
          ) : (
            <IndividualCustomerTable
              data={paginatedCustomers}
              branches={branches}
              onEdit={handleOpenEditCustomer}
              onApprove={handleApproveClick}
              onDelete={handleRejectClick}
              canEdit={hasPermission(PERMISSIONS.CUSTOMERS_UPDATE) || canApproveCustomers}
              canDelete={canApproveCustomers}
            />
          )}
        </CardContent>
        {pendingCustomers.length > 0 && (
          <TablePagination
            count={pendingCustomers.length}
            page={customerPage}
            onPageChange={setCustomerPage}
            rowsPerPage={customerRowsPerPage}
            onRowsPerPageChange={(v) => { setCustomerRowsPerPage(v); setCustomerPage(0); }}
          />
        )}
      </Card>

      {/* --- Pending Bulk Meters --- */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Pending Bulk Meters</CardTitle>
            <CardDescription>
              Bulk meters awaiting approval.
              {pendingBulkMeters.length > 0 && (
                <span className="ml-2 font-semibold text-foreground">{pendingBulkMeters.length} pending</span>
              )}
            </CardDescription>
          </div>
          {pendingBulkMeters.length > 0 && canApproveBulkMeters && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
              onClick={() => setIsBulkMeterDialogOpen(true)}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve All {pendingBulkMeters.length}
            </Button>
          )}
        </CardHeader>

        {/* Bulk meter search bar */}
        {!isLoading && !loadError && (
          <div className="px-6 pb-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, key, contract, phone…"
                value={bulkMeterSearch}
                onChange={(e) => { setBulkMeterSearch(e.target.value); setBulkMeterPage(0); }}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>
        )}

        <CardContent>
          {isLoading ? (
            <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading pending bulk meters…
            </div>
          ) : loadError ? null : pendingBulkMeters.length === 0 ? (
            <div className="mt-4 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">All Clear!</h3>
              <p className="text-muted-foreground mt-1">
                {bulkMeterSearch ? "No results match your search." : "No pending bulk meter approvals at this time."}
              </p>
            </div>
          ) : (
            <BulkMeterTable
              data={paginatedBulkMeters}
              branches={branches}
              onEdit={handleOpenEditBulkMeter}
              onApprove={handleApproveClick}
              onDelete={handleRejectClick}
              canEdit={hasPermission(PERMISSIONS.BULK_METERS_UPDATE) || canApproveBulkMeters}
              canDelete={canApproveBulkMeters}
            />
          )}
        </CardContent>
        {pendingBulkMeters.length > 0 && (
          <TablePagination
            count={pendingBulkMeters.length}
            page={bulkMeterPage}
            onPageChange={setBulkMeterPage}
            rowsPerPage={bulkMeterRowsPerPage}
            onRowsPerPageChange={(v) => { setBulkMeterRowsPerPage(v); setBulkMeterPage(0); }}
          />
        )}
      </Card>

      {/* Single action confirm dialog */}
      <AlertDialog open={!!selectedEntity} onOpenChange={(open) => { if (!open && !isActionLoading) { setSelectedEntity(null); setAmendmentStep("review"); setSelectedReason(AMENDMENT_REASONS[0]); setAmendmentNote(""); } }}>
        <AlertDialogContent className="w-full max-w-xl sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-7 overflow-hidden">
          <AlertDialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">{dialogTitle}</AlertDialogTitle>
                <p className="text-xs text-muted-foreground">Verification &amp; Decision</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words">
              {dialogDescription}
            </div>

            {/* Step 2 — amendment reason picker */}
            {amendmentStep === "amend" && (
              <div className="space-y-2.5 pt-1 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Amendment reason
                </p>
                <Select value={selectedReason} onValueChange={setSelectedReason} disabled={isActionLoading}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Choose a reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    {AMENDMENT_REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Additional detail (optional)…"
                  value={amendmentNote}
                  onChange={(e) => setAmendmentNote(e.target.value)}
                  className="h-9 text-xs rounded-xl border-amber-200 dark:border-amber-800"
                  disabled={isActionLoading}
                />
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3">
            {amendmentStep === "amend" ? (
              <>
                <Button variant="ghost" size="sm" disabled={isActionLoading} onClick={() => setAmendmentStep("review")} className="sm:mr-auto rounded-xl text-muted-foreground">
                  ← Back
                </Button>
                <AlertDialogCancel disabled={isActionLoading} onClick={() => { setSelectedEntity(null); setAmendmentStep("review"); }} className="rounded-xl">
                  Cancel
                </AlertDialogCancel>
                <Button
                  onClick={() => confirmAction("reject", getFullAmendmentReason())}
                  disabled={isActionLoading || !selectedReason}
                  variant="outline"
                  className="rounded-xl border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 hover:border-amber-400 shrink-0"
                >
                  {isActionLoading && actionType === "reject" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileEdit className="mr-2 h-4 w-4" />}
                  Confirm Amendment
                </Button>
              </>
            ) : (
              <>
                <AlertDialogCancel disabled={isActionLoading} onClick={() => setSelectedEntity(null)} className="sm:mr-auto rounded-xl">
                  Cancel
                </AlertDialogCancel>
                <Button
                  onClick={() => { setAmendmentStep("amend"); }}
                  disabled={isActionLoading}
                  variant="outline"
                  className="rounded-xl border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 hover:border-amber-400 shrink-0"
                >
                  <FileEdit className="mr-2 h-4 w-4" />
                  Request Amendment
                </Button>
                <Button
                  onClick={() => confirmAction("approve")}
                  disabled={isActionLoading}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"
                >
                  {isActionLoading && actionType === "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Approve
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Customer Approval Dialog */}
      <AlertDialog open={isBulkCustomerDialogOpen} onOpenChange={(open) => { if (!open) { setIsBulkCustomerDialogOpen(false); setBulkCustomerAmendStep("review"); setSelectedReason(AMENDMENT_REASONS[0]); setAmendmentNote(""); } }}>
        <AlertDialogContent className="w-full max-w-xl sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-7 overflow-hidden">
          <AlertDialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Review All Customers</AlertDialogTitle>
                <p className="text-xs text-muted-foreground">Bulk Batch Decision</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words">
              Choose an action for all <span className="font-semibold text-slate-900 dark:text-slate-100">{pendingCustomers.length} pending individual customers</span>. Approve to activate them, or Request Amendment to send them all back for corrections.
              {isProcessingBulk && bulkProgress.total > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-700 flex items-center gap-2 text-xs font-semibold text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing {bulkProgress.done} of {bulkProgress.total}…
                </div>
              )}
            </div>

            {/* Step 2 — amendment reason picker */}
            {bulkCustomerAmendStep === "amend" && (
              <div className="space-y-2.5 pt-1 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Amendment reason
                </p>
                <Select value={selectedReason} onValueChange={setSelectedReason} disabled={isProcessingBulk}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Choose a reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    {AMENDMENT_REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Additional detail (optional)…"
                  value={amendmentNote}
                  onChange={(e) => setAmendmentNote(e.target.value)}
                  className="h-9 text-xs rounded-xl border-amber-200 dark:border-amber-800"
                  disabled={isProcessingBulk}
                />
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3">
            {bulkCustomerAmendStep === "amend" ? (
              <>
                <Button variant="ghost" size="sm" disabled={isProcessingBulk} onClick={() => setBulkCustomerAmendStep("review")} className="sm:mr-auto rounded-xl text-muted-foreground">
                  ← Back
                </Button>
                <AlertDialogCancel disabled={isProcessingBulk} className="rounded-xl">Cancel</AlertDialogCancel>
                <Button
                  onClick={() => handleBulkAmendCustomers(getFullAmendmentReason())}
                  disabled={isProcessingBulk || !selectedReason}
                  variant="outline"
                  className="rounded-xl border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 hover:border-amber-400 shrink-0"
                >
                  {isProcessingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileEdit className="mr-2 h-4 w-4" />}
                  Confirm Amendment
                </Button>
              </>
            ) : (
              <>
                <AlertDialogCancel disabled={isProcessingBulk} className="sm:mr-auto rounded-xl">Cancel</AlertDialogCancel>
                <Button
                  onClick={() => { setBulkCustomerAmendStep("amend"); }}
                  disabled={isProcessingBulk}
                  variant="outline"
                  className="rounded-xl border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 hover:border-amber-400 shrink-0"
                >
                  {isProcessingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileEdit className="mr-2 h-4 w-4" />}
                  Request Amendment
                </Button>
                <Button onClick={handleBulkApproveCustomers} disabled={isProcessingBulk} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0">
                  {isProcessingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  {isProcessingBulk ? `Processing ${bulkProgress.done}/${bulkProgress.total}…` : `Approve All (${pendingCustomers.length})`}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Meter Approval Dialog */}
      <AlertDialog open={isBulkMeterDialogOpen} onOpenChange={(open) => { if (!open) { setIsBulkMeterDialogOpen(false); setBulkMeterAmendStep("review"); setSelectedReason(AMENDMENT_REASONS[0]); setAmendmentNote(""); } }}>
        <AlertDialogContent className="w-full max-w-xl sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-7 overflow-hidden">
          <AlertDialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Review All Bulk Meters</AlertDialogTitle>
                <p className="text-xs text-muted-foreground">Bulk Batch Decision</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words">
              Choose an action for all <span className="font-semibold text-slate-900 dark:text-slate-100">{pendingBulkMeters.length} pending bulk meters</span>. Approve to activate them, or Request Amendment to send them all back for corrections.
              {isProcessingBulk && bulkProgress.total > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-700 flex items-center gap-2 text-xs font-semibold text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing {bulkProgress.done} of {bulkProgress.total}…
                </div>
              )}
            </div>

            {/* Step 2 — amendment reason picker */}
            {bulkMeterAmendStep === "amend" && (
              <div className="space-y-2.5 pt-1 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Amendment reason
                </p>
                <Select value={selectedReason} onValueChange={setSelectedReason} disabled={isProcessingBulk}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Choose a reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    {AMENDMENT_REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Additional detail (optional)…"
                  value={amendmentNote}
                  onChange={(e) => setAmendmentNote(e.target.value)}
                  className="h-9 text-xs rounded-xl border-amber-200 dark:border-amber-800"
                  disabled={isProcessingBulk}
                />
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3">
            {bulkMeterAmendStep === "amend" ? (
              <>
                <Button variant="ghost" size="sm" disabled={isProcessingBulk} onClick={() => setBulkMeterAmendStep("review")} className="sm:mr-auto rounded-xl text-muted-foreground">
                  ← Back
                </Button>
                <AlertDialogCancel disabled={isProcessingBulk} className="rounded-xl">Cancel</AlertDialogCancel>
                <Button
                  onClick={() => handleBulkAmendBulkMeters(getFullAmendmentReason())}
                  disabled={isProcessingBulk || !selectedReason}
                  variant="outline"
                  className="rounded-xl border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 hover:border-amber-400 shrink-0"
                >
                  {isProcessingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileEdit className="mr-2 h-4 w-4" />}
                  Confirm Amendment
                </Button>
              </>
            ) : (
              <>
                <AlertDialogCancel disabled={isProcessingBulk} className="sm:mr-auto rounded-xl">Cancel</AlertDialogCancel>
                <Button
                  onClick={() => { setBulkMeterAmendStep("amend"); }}
                  disabled={isProcessingBulk}
                  variant="outline"
                  className="rounded-xl border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 hover:border-amber-400 shrink-0"
                >
                  {isProcessingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileEdit className="mr-2 h-4 w-4" />}
                  Request Amendment
                </Button>
                <Button onClick={handleBulkApproveBulkMeters} disabled={isProcessingBulk} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0">
                  {isProcessingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  {isProcessingBulk ? `Processing ${bulkProgress.done}/${bulkProgress.total}…` : `Approve All (${pendingBulkMeters.length})`}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialogs — full branch-scoped active bulk meters for the dropdown */}
      <IndividualCustomerFormDialog
        open={isCustomerFormOpen}
        onOpenChange={setIsCustomerFormOpen}
        onSubmit={handleSubmitCustomerEdit}
        defaultValues={customerToEdit}
        bulkMeters={allBulkMeters
          .filter((bm) => bm.status === "Active")
          .map((bm) => ({
            customerKeyNumber: bm.customerKeyNumber,
            name: bm.name,
            contractNumber: bm.contractNumber,
            meterNumber: bm.meterNumber,
          }))}
      />

      <BulkMeterFormDialog
        open={isBulkFormOpen}
        onOpenChange={setIsBulkFormOpen}
        onSubmit={handleSubmitBulkMeterEdit}
        defaultValues={bulkMeterToEdit}
      />
    </div>
  );
}
