
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { MoreHorizontal, Edit, Trash2, Gauge, Eye, Check, User, MapPin, Hash, CreditCard, Activity, Globe, CheckCircle2, XCircle, Key, Phone } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { BulkMeter } from "./bulk-meter-types";
import type { Branch } from "../branches/branch-types";

interface BulkMeterTableProps {
  data: BulkMeter[];
  onEdit: (bulkMeter: BulkMeter) => void;
  onDelete: (bulkMeter: BulkMeter) => void;
  onApprove?: (bulkMeter: BulkMeter) => void;
  onReject?: (bulkMeter: BulkMeter) => void;
  branches: Branch[];
  canEdit: boolean;
  canDelete: boolean;
  canApprove?: boolean;
  selectedMeters?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export function BulkMeterTable({ data, onEdit, onDelete, onApprove, onReject, branches, canEdit, canDelete, canApprove, selectedMeters, onSelectionChange }: BulkMeterTableProps) {
  if (data.length === 0) {
    return (
      <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
        No bulk meters match your search criteria. <Gauge className="inline-block ml-2 h-5 w-5" />
      </div>
    );
  }

  const getBranchName = (branchId?: string, fallbackLocation?: string) => {
    if (branchId) {
      const branch = branches.find(b => b.id === branchId);
      if (branch) return branch.name;
    }
    return fallbackLocation || "-";
  };

  const showActionsColumn = canEdit || canDelete;
  const showSelection = selectedMeters !== undefined && onSelectionChange !== undefined;

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      const allIds = new Set(data.map(m => m.customerKeyNumber));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectRow = (customerKeyNumber: string, checked: boolean) => {
    if (!onSelectionChange || !selectedMeters) return;
    const newSelection = new Set(selectedMeters);
    if (checked) {
      newSelection.add(customerKeyNumber);
    } else {
      newSelection.delete(customerKeyNumber);
    }
    onSelectionChange(newSelection);
  };

  const isAllSelected = showSelection && data.length > 0 && data.every(m => selectedMeters?.has(m.customerKeyNumber));
  const isSomeSelected = showSelection && data.some(m => selectedMeters?.has(m.customerKeyNumber)) && !isAllSelected;


  return (
    <div className="mt-4">
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b">
            <TableRow className="hover:bg-transparent">
              {showSelection && (
                <TableHead className="w-12 py-5 pl-6">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : "border-slate-300"}
                  />
                </TableHead>
              )}
              <TableHead className="py-5 font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  Account Name
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-indigo-500" />
                  Customer Key
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-500" />
                  Phone Number
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-sky-500" />
                  Branch
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-amber-500" />
                  Meter Number
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-500" />
                  INST_KEY
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-rose-500" />
                  Contract
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-500" />
                  Status
                </div>
              </TableHead>
              <TableHead className="text-right pr-6 font-bold text-slate-800">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((bulkMeter) => (
              <TableRow 
                key={bulkMeter.customerKeyNumber} 
                className={`group transition-colors border-b last:border-0 hover:bg-slate-50/70 ${selectedMeters?.has(bulkMeter.customerKeyNumber) ? "bg-blue-50/40" : ""}`}
              >
                {showSelection && (
                  <TableCell className="pl-6 py-5">
                    <Checkbox
                      checked={selectedMeters?.has(bulkMeter.customerKeyNumber) || false}
                      onCheckedChange={(checked) => handleSelectRow(bulkMeter.customerKeyNumber, checked as boolean)}
                      aria-label={`Select ${bulkMeter.name}`}
                      className="border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                  </TableCell>
                )}
                <TableCell className="py-5">
                  <div className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                    {bulkMeter.name}
                  </div>
                </TableCell>
                <TableCell className="py-5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-sm">
                    <Key className="h-3 w-3 text-indigo-500" />
                    {bulkMeter.customerKeyNumber}
                  </span>
                </TableCell>
                <TableCell className="py-5">
                  {bulkMeter.phoneNumber ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-sm">
                      <Phone className="h-3 w-3 text-emerald-500" />
                      {bulkMeter.phoneNumber}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs italic">-</span>
                  )}
                </TableCell>
                <TableCell className="py-5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-xs bg-sky-50 text-sky-800 border border-sky-200/80">
                    <MapPin className="h-3 w-3 text-sky-500" />
                    {getBranchName(bulkMeter.branchId, bulkMeter.subCity)}
                  </div>
                </TableCell>
                <TableCell className="py-5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg font-mono text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-sm">
                    {bulkMeter.meterNumber}
                  </span>
                </TableCell>
                <TableCell className="py-5 font-mono text-xs">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-purple-700 bg-purple-50 border border-purple-200/70">
                    {bulkMeter.instKey || "-"}
                  </span>
                </TableCell>
                <TableCell className="py-5 font-semibold text-slate-700 text-xs">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md font-medium text-slate-700 bg-slate-100 border border-slate-200">
                    {bulkMeter.contractNumber || "-"}
                  </span>
                </TableCell>
                <TableCell className="py-5">
                  {bulkMeter.status === 'Active' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm shadow-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      Active
                    </span>
                  )}
                  {bulkMeter.status === 'Maintenance' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm shadow-amber-200">
                      Maintenance
                    </span>
                  )}
                  {bulkMeter.status === 'Pending Approval' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500 text-white shadow-sm shadow-blue-200">
                      Pending
                    </span>
                  )}
                  {bulkMeter.status === 'Rejected' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-sm shadow-rose-200">
                      Rejected
                    </span>
                  )}
                  {!['Active', 'Maintenance', 'Pending Approval', 'Rejected'].includes(bulkMeter.status) && (
                    <Badge variant="outline" className="text-xs">{bulkMeter.status}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right pr-6 py-5">
                  <div className="flex justify-end gap-1.5 px-1">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-blue-600 bg-blue-50/80 hover:bg-blue-600 hover:text-white border border-blue-200/80 transition-all rounded-lg shadow-sm" title="View Details">
                      <Link href={`/admin/bulk-meters/${bulkMeter.customerKeyNumber}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {bulkMeter.status === 'Pending Approval' && canApprove && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 bg-emerald-50/80 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 transition-all rounded-lg shadow-sm" onClick={() => onApprove?.(bulkMeter)} title="Approve">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 bg-rose-50/80 hover:bg-rose-600 hover:text-white border border-rose-200/80 transition-all rounded-lg shadow-sm" onClick={() => onReject?.(bulkMeter)} title="Reject">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 bg-amber-50/80 hover:bg-amber-500 hover:text-white border border-amber-200/80 transition-all rounded-lg shadow-sm" onClick={() => onEdit(bulkMeter)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 bg-rose-50/80 hover:bg-rose-600 hover:text-white border border-rose-200/80 transition-all rounded-lg shadow-sm" onClick={() => onDelete(bulkMeter)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {data.map((bulkMeter) => (
          <Card key={bulkMeter.customerKeyNumber} className={`overflow-hidden border shadow-sm ${selectedMeters?.has(bulkMeter.customerKeyNumber) ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader className="p-4 bg-slate-50/50 flex flex-row items-center justify-between border-b">
              <div className="flex items-center gap-2 flex-1">
                {showSelection && (
                  <Checkbox
                    checked={selectedMeters?.has(bulkMeter.customerKeyNumber) || false}
                    onCheckedChange={(checked) => handleSelectRow(bulkMeter.customerKeyNumber, checked as boolean)}
                    aria-label={`Select ${bulkMeter.name}`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-bold truncate max-w-[200px]">{bulkMeter.name}</CardTitle>
                  <CardDescription className="text-[10px]">Key: {bulkMeter.customerKeyNumber}</CardDescription>
                </div>
              </div>
              <Badge variant={bulkMeter.status === 'Active' ? 'default' : 'secondary'} className="text-[10px] px-1.5">{bulkMeter.status}</Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground uppercase font-semibold">Key:</span> {bulkMeter.customerKeyNumber}</div>
                <div><span className="text-muted-foreground uppercase font-semibold">Phone:</span> {bulkMeter.phoneNumber || "-"}</div>
                <div><span className="text-muted-foreground uppercase font-semibold">Meter:</span> {bulkMeter.meterNumber}</div>
                <div><span className="text-muted-foreground uppercase font-semibold">Contract:</span> {bulkMeter.contractNumber}</div>
                <div className="col-span-2"><span className="text-muted-foreground uppercase font-semibold">Branch:</span> {getBranchName(bulkMeter.branchId, bulkMeter.subCity)}</div>
              </div>
              <div className="flex gap-2 pt-2 border-t overflow-x-auto">
                <Button asChild variant="outline" size="sm" className="h-8 text-xs flex-1 text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-600 hover:text-white font-semibold">
                  <Link href={`/admin/bulk-meters/${bulkMeter.customerKeyNumber}`}>
                    <Eye className="mr-1.5 h-3 w-3" /> View
                  </Link>
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm" className="h-8 text-xs flex-1 text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-500 hover:text-white font-semibold" onClick={() => onEdit(bulkMeter)}>
                    <Edit className="mr-1.5 h-3 w-3" /> Edit
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" size="sm" className="h-8 text-xs text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-600 hover:text-white font-semibold" onClick={() => onDelete(bulkMeter)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

