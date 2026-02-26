

"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
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
    <div className="mt-4">
      {/* Desktop Table View */}
      <div className="hidden xl:block rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>METER_KEY</TableHead>
              <TableHead>INST_KEY</TableHead>
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
                  <TableCell>{customer.instKey}</TableCell>
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
                      {customer.paymentStatus === 'Paid' ? <CheckCircle className="mr-1 h-3.5 w-3.5" /> : customer.paymentStatus === 'Unpaid' ? <XCircle className="mr-1 h-3.5 w-3.5" /> : <Clock className="mr-1 h-3.5 w-3.5" />}
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
                      {customer.status === 'Pending Approval' ? <Hourglass className="mr-1 h-3.5 w-3.5" /> : null}
                      {customer.status === 'Rejected' ? <XCircle className="mr-1 h-3.5 w-3.5" /> : null}
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

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:hidden gap-4">
        {data.map((customer) => {
          const usage = (customer.currentReading ?? 0) - (customer.previousReading ?? 0);
          return (
            <Card key={customer.customerKeyNumber} className="overflow-hidden border shadow-sm">
              <CardHeader className="p-4 bg-slate-50/50 flex flex-row items-center justify-between border-b">
                <div>
                  <CardTitle className="text-sm font-bold truncate max-w-[200px]">{customer.name}</CardTitle>
                  <CardDescription className="text-[10px]">Key: {customer.customerKeyNumber}</CardDescription>
                </div>
                <Badge variant={customer.status === 'Active' ? 'default' : 'secondary'} className="text-[10px] px-1.5">{customer.status}</Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground uppercase font-semibold">Meter:</span> {customer.meterNumber}</div>
                  <div><span className="text-muted-foreground uppercase font-semibold">Usage:</span> {usage.toFixed(2)} m³</div>
                  <div><span className="text-muted-foreground uppercase font-semibold">Type:</span> {customer.customerType}</div>
                  <div><span className="text-muted-foreground uppercase font-semibold">Bill:</span> {currency} {customer.calculatedBill.toFixed(2)}</div>
                  <div className="col-span-2 border-t pt-1 mt-1 flex justify-between">
                    <span className="text-muted-foreground uppercase font-semibold">Bulk Meter:</span>
                    <span className="font-medium">{getBulkMeterName(customer.assignedBulkMeterId)}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  {canEdit && (
                    <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => onEdit(customer)}>
                      <Edit className="mr-1.5 h-3 w-3" /> Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-white hover:bg-destructive flex-1" onClick={() => onDelete(customer)}>
                      <Trash2 className="mr-1.5 h-3 w-3" /> Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
