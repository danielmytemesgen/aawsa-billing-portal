"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Search,
  UserPlus,
  UserMinus,
  Loader2,
  FileDown,
  Upload,
} from "lucide-react";
import {
  getAssignedCustomersForBulkMeterAction,
  getUnassignedIndividualCustomersAction,
  assignCustomerToBulkMeterAction,
  unassignCustomerFromBulkMeterAction,
} from "@/lib/actions";
import { TablePagination } from "@/components/ui/table-pagination";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";

interface ManageAssignedCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bulkMeter: BulkMeter | null;
}

export function ManageAssignedCustomersDialog({
  open,
  onOpenChange,
  bulkMeter,
}: ManageAssignedCustomersDialogProps) {
  const { toast } = useToast();

  // Assigned section state
  const [assignedCustomers, setAssignedCustomers] = useState<any[]>([]);
  const [assignedTotal, setAssignedTotal] = useState(0);
  const [assignedPage, setAssignedPage] = useState(1);
  const [assignedRowsPerPage, setAssignedRowsPerPage] = useState(5);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(false);

  // Unassigned section state
  const [unassignedCustomers, setUnassignedCustomers] = useState<any[]>([]);
  const [unassignedTotal, setUnassignedTotal] = useState(0);
  const [unassignedPage, setUnassignedPage] = useState(1);
  const [unassignedRowsPerPage, setUnassignedRowsPerPage] = useState(5);
  const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);

  // Search
  const [customerSearch, setCustomerSearch] = useState("");

  // Per-row action loading
  const [customerActionLoading, setCustomerActionLoading] = useState<string | null>(null);

  const bulkMeterKey = bulkMeter?.customerKeyNumber;

  // ── Server-side fetch helpers ──────────────────────────────────────────────

  const fetchAssignedPage = useCallback(
    async (page: number, limit: number = assignedRowsPerPage) => {
      if (!bulkMeterKey) return;
      setIsLoadingAssigned(true);
      try {
        const res = await getAssignedCustomersForBulkMeterAction(bulkMeterKey, page, limit);
        if (res.data) {
          if (res.data.rows.length === 0 && page > 1 && res.data.total > 0) {
            return fetchAssignedPage(page - 1, limit);
          }
          setAssignedCustomers(res.data.rows);
          setAssignedTotal(res.data.total);
          setAssignedPage(page);
        }
      } catch {
        toast({ title: "Error", description: "Failed to load assigned customers.", variant: "destructive" });
      } finally {
        setIsLoadingAssigned(false);
      }
    },
    [bulkMeterKey, assignedRowsPerPage]
  );

  const fetchUnassignedPage = useCallback(
    async (page: number, search: string, limit: number = unassignedRowsPerPage) => {
      setIsLoadingUnassigned(true);
      try {
        const res = await getUnassignedIndividualCustomersAction(search, page, limit);
        if (res.data) {
          setUnassignedCustomers(res.data.rows);
          setUnassignedTotal(res.data.total);
          setUnassignedPage(page);
        }
      } catch {
        toast({ title: "Error", description: "Failed to load unassigned customers.", variant: "destructive" });
      } finally {
        setIsLoadingUnassigned(false);
      }
    },
    [unassignedRowsPerPage]
  );

  // Load data when dialog opens
  useEffect(() => {
    if (open && bulkMeterKey) {
      setCustomerSearch("");
      setAssignedPage(1);
      setUnassignedPage(1);
      Promise.all([
        fetchAssignedPage(1, assignedRowsPerPage),
        fetchUnassignedPage(1, "", unassignedRowsPerPage),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bulkMeterKey]);

  // ── Search debounce ────────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUnassignedPage(1, customerSearch, unassignedRowsPerPage);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearch]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleUnassign = async (customerKey: string, customerName: string) => {
    setCustomerActionLoading(customerKey);
    try {
      const res = await unassignCustomerFromBulkMeterAction(customerKey);
      if (res.success) {
        toast({ title: "Removed", description: `${customerName} unassigned from this meter.` });
        await Promise.all([
          fetchAssignedPage(assignedPage, assignedRowsPerPage),
          fetchUnassignedPage(unassignedPage, customerSearch, unassignedRowsPerPage),
        ]);
      } else {
        toast({ title: "Error", description: (res as any).error || "Failed to remove.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Unexpected error.", variant: "destructive" });
    } finally {
      setCustomerActionLoading(null);
    }
  };

  const handleAssign = async (customerKey: string, customerName: string) => {
    if (!bulkMeterKey) return;
    setCustomerActionLoading(customerKey);
    try {
      const res = await assignCustomerToBulkMeterAction(customerKey, bulkMeterKey);
      if (res.success) {
        toast({ title: "Assigned", description: `${customerName} assigned to this meter.` });
        await Promise.all([
          fetchAssignedPage(assignedPage, assignedRowsPerPage),
          fetchUnassignedPage(unassignedPage, customerSearch, unassignedRowsPerPage),
        ]);
      } else {
        toast({ title: "Error", description: (res as any).error || "Failed to assign.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Unexpected error.", variant: "destructive" });
    } finally {
      setCustomerActionLoading(null);
    }
  };

  // ── CSV Download template ──────────────────────────────────────────────────

  const handleDownloadAssignmentTemplate = async () => {
    if (!bulkMeterKey) return;
    try {
      toast({ title: "Preparing Template...", description: "Fetching assigned customers for template." });
      const res = await getAssignedCustomersForBulkMeterAction(bulkMeterKey, 1, Math.max(assignedTotal, 10000));
      const allRows = res.data?.rows || assignedCustomers;
      const headers = "Customer Key,Action";
      const sampleRows = [
        "# Action should be ADD or REMOVE",
        ...allRows.map((c: any) => `"${c.customerKeyNumber}",REMOVE`),
      ];
      const csvContent = [headers, ...sampleRows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `assignment_template_${bulkMeterKey}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Template Downloaded", description: `Downloaded with ${allRows.length} assigned customer(s).` });
    } catch {
      toast({ title: "Download Failed", description: "Could not fetch assigned customers.", variant: "destructive" });
    }
  };

  // ── CSV Upload ─────────────────────────────────────────────────────────────

  const handleUploadAssignmentCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bulkMeterKey) return;

    setIsLoadingAssigned(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r\n|\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          toast({ variant: "destructive", title: "CSV Error", description: "File must contain a header row and at least one data row." });
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
        const keyIdx = headers.findIndex((h) =>
          ["customer key", "customerkey", "customer_key", "cust_key", "id", "customerkeynumber"].includes(h)
        );
        const actionIdx = headers.findIndex((h) => ["action", "operation", "type"].includes(h));

        if (keyIdx === -1 || actionIdx === -1) {
          toast({ variant: "destructive", title: "Invalid Headers", description: "CSV must contain 'Customer Key' and 'Action' columns." });
          return;
        }

        let addedCount = 0;
        let removedCount = 0;
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
          if (lines[i].startsWith("#")) continue;
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          const key = cols[keyIdx];
          const actionStr = cols[actionIdx]?.toUpperCase();
          if (!key) continue;

          if (actionStr === "ADD" || actionStr === "ASSIGN") {
            const res = await assignCustomerToBulkMeterAction(key, bulkMeterKey);
            if (res.success) addedCount++;
            else errorCount++;
          } else if (actionStr === "REMOVE" || actionStr === "UNASSIGN" || actionStr === "DELETE") {
            const res = await unassignCustomerFromBulkMeterAction(key);
            if (res.success) removedCount++;
            else errorCount++;
          }
        }

        toast({
          title: "CSV Processed",
          description: `Successfully added ${addedCount}, removed ${removedCount} customers. Errors: ${errorCount}`,
        });

        await Promise.all([
          fetchAssignedPage(1, assignedRowsPerPage),
          fetchUnassignedPage(1, customerSearch, unassignedRowsPerPage),
        ]);
        setCustomerSearch("");
      } catch {
        toast({ variant: "destructive", title: "Error", description: "Failed to parse and apply CSV assignment." });
      } finally {
        setIsLoadingAssigned(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  if (!bulkMeter) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Manage Assigned Customers
          </DialogTitle>
          <DialogDescription>
            Add or remove individual customers assigned to bulk meter{" "}
            <span className="font-semibold text-gray-800">{bulkMeter.customerKeyNumber}</span>
            {bulkMeter.name ? ` — ${bulkMeter.name}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {isLoadingAssigned && assignedCustomers.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">Loading customers...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden flex-1">

            {/* ── Currently Assigned ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-700">Currently Assigned</p>
                  <Badge variant="secondary">{assignedTotal}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 text-blue-700 border-blue-200 hover:bg-blue-50/50"
                    onClick={handleDownloadAssignmentTemplate}
                  >
                    <FileDown className="h-3.5 w-3.5 mr-1 text-blue-600" /> Template
                  </Button>
                  <label className="cursor-pointer">
                    <input type="file" accept=".csv" onChange={handleUploadAssignmentCsv} className="hidden" />
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold h-7 px-2 rounded border border-blue-300 bg-white text-blue-900 hover:bg-blue-50 transition-colors shadow-sm cursor-pointer">
                      <Upload className="h-3.5 w-3.5 text-blue-700" /> Upload CSV
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <ScrollArea className="h-44 rounded-md border bg-gray-50/30 overflow-auto">
                  <div className="w-full">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100/80 text-gray-700 sticky top-0 border-b z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Customer Key</th>
                          <th className="px-3 py-2 text-left font-semibold">Name</th>
                          <th className="px-3 py-2 text-center font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {isLoadingAssigned ? (
                          <tr>
                            <td colSpan={3} className="text-center py-8">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                            </td>
                          </tr>
                        ) : assignedCustomers.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center text-sm text-gray-400 py-8 italic">
                              No customers assigned yet.
                            </td>
                          </tr>
                        ) : (
                          assignedCustomers.map((c) => (
                            <tr key={c.customerKeyNumber} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-3 py-2 font-mono text-gray-500">{c.customerKeyNumber}</td>
                              <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[200px]">{c.name}</td>
                              <td className="px-3 py-2 text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                                  disabled={customerActionLoading === c.customerKeyNumber}
                                  onClick={() => handleUnassign(c.customerKeyNumber, c.name)}
                                >
                                  {customerActionLoading === c.customerKeyNumber
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <UserMinus className="h-3.5 w-3.5" />
                                  }
                                  <span className="ml-1 text-[11px]">Remove</span>
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
                {assignedTotal > 0 && (
                  <TablePagination
                    count={assignedTotal}
                    page={assignedPage - 1}
                    rowsPerPage={assignedRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    onPageChange={(newPage) => fetchAssignedPage(newPage + 1, assignedRowsPerPage)}
                    onRowsPerPageChange={(newLimit) => {
                      setAssignedRowsPerPage(newLimit);
                      fetchAssignedPage(1, newLimit);
                    }}
                    className="p-1 text-xs justify-between border-t-0 mt-1 space-x-2"
                  />
                )}
              </div>
            </div>

            {/* ── Add Unassigned Customers ── */}
            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-gray-700">Add Customer</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name or key..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ScrollArea className="flex-1 min-h-[140px] max-h-48 rounded-md border bg-gray-50/30 overflow-auto">
                  <div className="w-full">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100/80 text-gray-700 sticky top-0 border-b z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Customer Key</th>
                          <th className="px-3 py-2 text-left font-semibold">Name</th>
                          <th className="px-3 py-2 text-center font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {isLoadingUnassigned ? (
                          <tr>
                            <td colSpan={3} className="text-center py-8">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                            </td>
                          </tr>
                        ) : unassignedCustomers.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center text-sm text-gray-400 py-8 italic">
                              No unassigned customers found.
                            </td>
                          </tr>
                        ) : (
                          unassignedCustomers.map((c) => (
                            <tr key={c.customerKeyNumber} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-3 py-2 font-mono text-gray-500">{c.customerKeyNumber}</td>
                              <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[200px]">{c.name}</td>
                              <td className="px-3 py-2 text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600 hover:text-green-800 hover:bg-green-50 h-7 px-2"
                                  disabled={customerActionLoading === c.customerKeyNumber}
                                  onClick={() => handleAssign(c.customerKeyNumber, c.name)}
                                >
                                  {customerActionLoading === c.customerKeyNumber
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <UserPlus className="h-3.5 w-3.5" />
                                  }
                                  <span className="ml-1 text-[11px]">Add</span>
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
                {unassignedTotal > 0 && (
                  <TablePagination
                    count={unassignedTotal}
                    page={unassignedPage - 1}
                    rowsPerPage={unassignedRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    onPageChange={(newPage) => fetchUnassignedPage(newPage + 1, customerSearch, unassignedRowsPerPage)}
                    onRowsPerPageChange={(newLimit) => {
                      setUnassignedRowsPerPage(newLimit);
                      fetchUnassignedPage(1, customerSearch, newLimit);
                    }}
                    className="p-1 text-xs justify-between border-t-0 mt-1 space-x-2"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
