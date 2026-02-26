

"use client";

import * as React from "react";
import { MoreHorizontal, Edit, Trash2, User, CheckCircle, XCircle, Clock, Hourglass, Check } from "lucide-react";
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
import type { IndividualCustomer } from "./individual-customer-types";
import { cn } from "@/lib/utils";
import type { Branch } from "../branches/branch-types";

interface IndividualCustomerTableProps {
  data: IndividualCustomer[];
  onEdit: (customer: IndividualCustomer) => void;
  onDelete: (customer: IndividualCustomer) => void;
  onApprove?: (customer: IndividualCustomer) => void;
  bulkMetersList?: { customerKeyNumber: string; name: string }[];
  branches: Branch[];
  currency?: string;
  canEdit: boolean;
  canDelete: boolean;
}

export function IndividualCustomerTable({ data, onEdit, onDelete, onApprove, bulkMetersList = [], branches, currency = "ETB", canEdit, canDelete }: IndividualCustomerTableProps) {

  const getBulkMeterName = (key?: string) => {
    if (!key) return "-";
    return bulkMetersList.find(bm => bm.customerKeyNumber === key)?.name || "Unknown BM";
  };

  const getCustomerBranchName = (branchId?: string, fallbackLocation?: string) => {
    if (branchId) {
      const branch = branches.find(b => b.id === branchId);
      if (branch) return branch.name;
    }
    return fallbackLocation || "-";
  };

  const showActionsColumn = canEdit || canDelete;

  if (data.length === 0) {
    return (
      <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
        No customers match your search criteria. <User className="inline-block ml-2 h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Meter No.</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Cust. Type</TableHead>
            <TableHead>Usage (m³)</TableHead>
            <TableHead>Bill ({currency})</TableHead>
            <TableHead>Bulk Meter</TableHead>
            <TableHead>Pay Status</TableHead>
            <TableHead>Status</TableHead>
            {showActionsColumn && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((customer) => {
            const usage = (customer.currentReading ?? 0) - (customer.previousReading ?? 0);
            return (
              <TableRow key={customer.customerKeyNumber}>
                <TableCell className="font-medium">{customer.name}</TableCell>
                <TableCell>{customer.meterNumber}</TableCell>
                <TableCell>
                  {getCustomerBranchName(customer.branchId, customer.subCity)}
                </TableCell>
                <TableCell>{customer.customerType}</TableCell>
                <TableCell>{usage.toFixed(2)}</TableCell>
                <TableCell>{customer.calculatedBill.toFixed(2)}</TableCell>
                <TableCell>{getBulkMeterName(customer.assignedBulkMeterId)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      customer.paymentStatus === 'Paid' ? 'default'
                      : customer.paymentStatus === 'Unpaid' ? 'destructive'
                      : 'secondary'
                    }
                    className={cn(
                        customer.paymentStatus === 'Paid' && "bg-green-500 hover:bg-green-600",
                        customer.paymentStatus === 'Pending' && "bg-yellow-500 hover:bg-yellow-600"
                    )}
                  >
                    {customer.paymentStatus === 'Paid' ? <CheckCircle className="mr-1 h-3.5 w-3.5"/> : customer.paymentStatus === 'Unpaid' ? <XCircle className="mr-1 h-3.5 w-3.5"/> : <Clock className="mr-1 h-3.5 w-3.5"/>}
                    {customer.paymentStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                     variant={
                      customer.status === 'Active' ? 'default'
                      : customer.status === 'Pending Approval' ? 'secondary'
                      : 'destructive'
                    }
                    className={cn(
                        customer.status === 'Pending Approval' && "bg-amber-500 text-white hover:bg-amber-600"
                    )}
                  >
                    {customer.status === 'Pending Approval' ? <Hourglass className="mr-1 h-3.5 w-3.5"/> : null}
                    {customer.status === 'Rejected' ? <XCircle className="mr-1 h-3.5 w-3.5"/> : null}
                    {customer.status}
                  </Badge>
                </TableCell>
                {showActionsColumn && (
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
                        {canEdit && (
                          <DropdownMenuItem onClick={() => onEdit(customer)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {/* Approve action shown when provided by parent (approvals page) */}
                        {onApprove && (
                          <DropdownMenuItem onClick={() => onApprove(customer)}>
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                        )}
                        {canEdit && canDelete && <DropdownMenuSeparator />}
                        {canDelete && (
                          <DropdownMenuItem onClick={() => onDelete(customer)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
