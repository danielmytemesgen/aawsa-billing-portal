
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { MoreHorizontal, Edit, Trash2, Gauge, Eye, Check, User, MapPin, Hash, CreditCard, Activity, Globe, CheckCircle2, XCircle } from "lucide-react";
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
                  <User className="h-4 w-4 text-slate-400" />
                  Account Name
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-slate-400" />
                  Branch
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-slate-400" />
                  Meter Number
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-400" />
                  INST_KEY
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  Contract
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">Status</TableHead>
              <TableHead className="text-right pr-6 font-bold text-slate-800">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((bulkMeter) => (
              <TableRow 
                key={bulkMeter.customerKeyNumber} 
                className={`group transition-colors border-b last:border-0 hover:bg-slate-50/50 ${selectedMeters?.has(bulkMeter.customerKeyNumber) ? "bg-blue-50/40" : ""}`}
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
                  <div className="font-bold text-slate-900 text-base group-hover:text-blue-700 transition-colors">
                    {bulkMeter.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-tight uppercase">
                    KEY: {bulkMeter.customerKeyNumber}
                  </div>
                </TableCell>
                <TableCell className="py-5">
                  <div className="flex items-center gap-1.5 font-medium text-slate-600">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {getBranchName(bulkMeter.branchId, bulkMeter.subCity)}
                  </div>
                </TableCell>
                <TableCell className="py-5">
                  <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-slate-50 text-slate-700 border-slate-200">
                    {bulkMeter.meterNumber}
                  </Badge>
                </TableCell>
                <TableCell className="py-5 text-slate-600 font-medium font-mono text-xs">
                  {bulkMeter.instKey}
                </TableCell>
                <TableCell className="py-5 text-slate-600 font-bold">
                  {bulkMeter.contractNumber}
                </TableCell>
                <TableCell className="py-5">
                  <Badge
                    variant={bulkMeter.status === 'Active' ? 'default' : 'secondary'}
                    className={`px-3 py-1 font-bold text-[10px] uppercase tracking-wider ${
                      bulkMeter.status === 'Active' 
                        ? 'bg-emerald-500 hover:bg-emerald-600 shadow-sm shadow-emerald-100' 
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {bulkMeter.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-6 py-5">
                  <div className="flex justify-end gap-1 px-1">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-lg" title="View Details">
                      <Link href={`/admin/bulk-meters/${bulkMeter.customerKeyNumber}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {bulkMeter.status === 'Pending Approval' && canApprove && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all rounded-lg" onClick={() => onApprove?.(bulkMeter)} title="Approve">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-all rounded-lg" onClick={() => onReject?.(bulkMeter)} title="Reject">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all rounded-lg" onClick={() => onEdit(bulkMeter)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-lg" onClick={() => onDelete(bulkMeter)} title="Delete">
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
                <div><span className="text-muted-foreground uppercase font-semibold">Meter:</span> {bulkMeter.meterNumber}</div>
                <div><span className="text-muted-foreground uppercase font-semibold">Contract:</span> {bulkMeter.contractNumber}</div>
                <div className="col-span-2"><span className="text-muted-foreground uppercase font-semibold">Branch:</span> {getBranchName(bulkMeter.branchId, bulkMeter.subCity)}</div>
              </div>
              <div className="flex gap-2 pt-2 border-t overflow-x-auto">
                <Button asChild variant="outline" size="sm" className="h-8 text-xs flex-1">
                  <Link href={`/admin/bulk-meters/${bulkMeter.customerKeyNumber}`}>
                    <Eye className="mr-1.5 h-3 w-3" /> View
                  </Link>
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => onEdit(bulkMeter)}>
                    <Edit className="mr-1.5 h-3 w-3" /> Edit
                  </Button>
                )}
                {canDelete && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-white hover:bg-destructive" onClick={() => onDelete(bulkMeter)}>
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

