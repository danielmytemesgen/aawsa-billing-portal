
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { MoreHorizontal, Edit, Trash2, Gauge, Eye, Check } from "lucide-react";
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
  branches: Branch[];
  canEdit: boolean;
  canDelete: boolean;
  selectedMeters?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export function BulkMeterTable({ data, onEdit, onDelete, onApprove, branches, canEdit, canDelete, selectedMeters, onSelectionChange }: BulkMeterTableProps) {
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
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {showSelection && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : ""}
                  />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Meter Number</TableHead>
              <TableHead>INST_KEY</TableHead>
              <TableHead>Contract Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((bulkMeter) => (
              <TableRow key={bulkMeter.customerKeyNumber} className={selectedMeters?.has(bulkMeter.customerKeyNumber) ? "bg-muted/50" : ""}>
                {showSelection && (
                  <TableCell>
                    <Checkbox
                      checked={selectedMeters?.has(bulkMeter.customerKeyNumber) || false}
                      onCheckedChange={(checked) => handleSelectRow(bulkMeter.customerKeyNumber, checked as boolean)}
                      aria-label={`Select ${bulkMeter.name}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">{bulkMeter.name}</TableCell>
                <TableCell>{getBranchName(bulkMeter.branchId, bulkMeter.subCity)}</TableCell>
                <TableCell>{bulkMeter.meterNumber}</TableCell>
                <TableCell>{bulkMeter.instKey}</TableCell>
                <TableCell>{bulkMeter.contractNumber}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      bulkMeter.status === 'Active' ? 'default'
                        : 'secondary'
                    }
                  >
                    {bulkMeter.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <Link href={`/admin/bulk-meters/${bulkMeter.customerKeyNumber}`} passHref>
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                      </Link>
                      {canEdit && (
                        <DropdownMenuItem onClick={() => onEdit(bulkMeter)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {onApprove && (
                        <DropdownMenuItem onClick={() => onApprove(bulkMeter)}>
                          <Check className="mr-2 h-4 w-4" />
                          Approve
                        </DropdownMenuItem>
                      )}
                      {(canEdit && canDelete) && <DropdownMenuSeparator />}
                      {canDelete && (
                        <DropdownMenuItem onClick={() => onDelete(bulkMeter)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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

