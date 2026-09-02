"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Edit,
  Trash2,
  User,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Key,
  Phone,
  Layers,
  MapPin,
  Hash,
  Activity,
  CreditCard,
  Building2,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { IndividualCustomer } from "./individual-customer-types";
import { cn } from "@/lib/utils";
import type { Branch } from "../branches/branch-types";

interface IndividualCustomerTableProps {
  data: IndividualCustomer[];
  onEdit: (customer: IndividualCustomer) => void;
  onDelete: (customer: IndividualCustomer) => void;
  onViewDetails?: (customer: IndividualCustomer) => void;
  onApprove?: (customer: IndividualCustomer) => void;
  onReject?: (customer: IndividualCustomer) => void;
  bulkMetersList?: { customerKeyNumber: string; name: string }[];
  branches: Branch[];
  currency?: string;
  canEdit: boolean;
  canDelete: boolean;
  canApprove?: boolean;
  isAdmin?: boolean;
}

export function IndividualCustomerTable({
  data,
  onEdit,
  onDelete,
  onViewDetails,
  onApprove,
  onReject,
  bulkMetersList = [],
  branches,
  currency = "ETB",
  canEdit,
  canDelete,
  canApprove = false,
  isAdmin = true,
}: IndividualCustomerTableProps) {
  const getCustomerBranchName = (branchId?: string, fallbackLocation?: string) => {
    if (branchId) {
      const branch = branches.find((b) => b.id === branchId);
      if (branch) return branch.name;
    }
    return fallbackLocation || "-";
  };

  const getBulkMeterHref = (bmKey: string) => {
    return isAdmin ? `/admin/bulk-meters/${bmKey}` : `/staff/bulk-meters/${bmKey}`;
  };

  if (data.length === 0) {
    return (
      <div className="mt-4 p-6 border border-dashed rounded-xl bg-slate-50/50 text-center text-slate-500">
        <User className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="font-semibold text-slate-700">No individual customers match your filters.</p>
        <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms or clearing the status/branch filters.</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b">
            <TableRow className="hover:bg-transparent">
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
                  <Hash className="h-4 w-4 text-amber-500" />
                  METER_KEY
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-sky-500" />
                  Branch
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-500" />
                  Usage (m³)
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Calculated Bill
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-500" />
                  Bulk Meter
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Status
                </div>
              </TableHead>
              <TableHead className="text-right pr-6 font-bold text-slate-800">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((customer) => {
              const rawUsage = (customer.currentReading ?? 0) - (customer.previousReading ?? 0);
              const isMinApplied = customer.isMinOfThreeApplied || (rawUsage < 3 && rawUsage >= 0);
              const effectiveUsage = customer.effectiveUsage ?? (isMinApplied ? 3 : Math.max(0, rawUsage));

              return (
                <TableRow
                  key={customer.customerKeyNumber}
                  className="group transition-colors border-b last:border-0 hover:bg-slate-50/70"
                >
                  {/* Account Name */}
                  <TableCell className="py-4">
                    <div className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                      {customer.name}
                    </div>
                    {customer.phoneNumber && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {customer.phoneNumber}
                      </div>
                    )}
                  </TableCell>

                  {/* Customer Key */}
                  <TableCell className="py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-sm">
                      <Key className="h-3 w-3 text-indigo-500" />
                      {customer.customerKeyNumber}
                    </span>
                  </TableCell>

                  {/* Meter Key */}
                  <TableCell className="py-4 font-mono text-xs">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-sm">
                      {customer.meterNumber}
                    </span>
                  </TableCell>

                  {/* Branch & Route */}
                  <TableCell className="py-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-xs bg-sky-50 text-sky-800 border border-sky-200/80">
                      <MapPin className="h-3 w-3 text-sky-500" />
                      {getCustomerBranchName(customer.branchId, customer.subCity)}
                    </div>
                    {customer.routeKey && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Route: {customer.routeKey}
                      </div>
                    )}
                  </TableCell>

                  {/* Usage */}
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-sm">
                        {effectiveUsage.toFixed(2)}{" "}
                        <span className="text-[10px] text-slate-400 font-normal">m³</span>
                      </span>
                      {isMinApplied && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 w-fit mt-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> Min 3m³ (Raw: {rawUsage.toFixed(1)})
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Bill */}
                  <TableCell className="py-4">
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {customer.calculatedBill?.toFixed(2) || "0.00"}{" "}
                      <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                    </span>
                    <div className="mt-0.5">
                      {customer.paymentStatus === "Paid" ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-300">
                          Paid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-rose-50 text-rose-700 border-rose-200">
                          Unpaid
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Bulk Meter Assignment */}
                  <TableCell className="py-4">
                    {customer.assignedBulkMeterId ? (
                      <Link
                        href={getBulkMeterHref(customer.assignedBulkMeterId)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 transition-colors"
                        title="Click to view parent bulk meter"
                      >
                        <Layers className="h-3 w-3 text-purple-500" />
                        {customer.assignedBulkMeterId}
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Unassigned</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-4">
                    {customer.status === "Active" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm shadow-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        Active
                      </span>
                    )}
                    {customer.status === "Pending Approval" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500 text-white shadow-sm shadow-blue-200">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                    {customer.status === "Rejected" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-sm shadow-rose-200">
                        Rejected
                      </span>
                    )}
                    {customer.status === "Inactive" && (
                      <Badge variant="outline" className="text-xs text-slate-500 bg-slate-50">
                        Inactive
                      </Badge>
                    )}
                    {customer.status === "Suspended" && (
                      <Badge variant="outline" className="text-xs text-orange-600 bg-orange-50 border-orange-200">
                        Suspended
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right pr-6 py-4">
                    <div className="flex justify-end gap-1.5">
                      {/* View Details Sheet */}
                      {onViewDetails && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 bg-blue-50/80 hover:bg-blue-600 hover:text-white border border-blue-200/80 transition-all rounded-lg shadow-sm"
                          onClick={() => onViewDetails(customer)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Approval triggers */}
                      {customer.status === "Pending Approval" && canApprove && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 bg-emerald-50/80 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 transition-all rounded-lg shadow-sm"
                            onClick={() => onApprove?.(customer)}
                            title="Approve"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-600 bg-rose-50/80 hover:bg-rose-600 hover:text-white border border-rose-200/80 transition-all rounded-lg shadow-sm"
                            onClick={() => onReject?.(customer)}
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      {/* Edit */}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-amber-600 bg-amber-50/80 hover:bg-amber-500 hover:text-white border border-amber-200/80 transition-all rounded-lg shadow-sm"
                          onClick={() => onEdit(customer)}
                          title="Edit Customer"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Delete */}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600 bg-rose-50/80 hover:bg-rose-600 hover:text-white border border-rose-200/80 transition-all rounded-lg shadow-sm"
                          onClick={() => onDelete(customer)}
                          title="Delete Customer"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
        {data.map((customer) => {
          const rawUsage = (customer.currentReading ?? 0) - (customer.previousReading ?? 0);
          const isMinApplied = customer.isMinOfThreeApplied || (rawUsage < 3 && rawUsage >= 0);
          const effectiveUsage = customer.effectiveUsage ?? (isMinApplied ? 3 : Math.max(0, rawUsage));

          return (
            <Card key={customer.customerKeyNumber} className="overflow-hidden border border-slate-200 shadow-sm rounded-xl">
              <CardHeader className="p-4 bg-slate-50/70 flex flex-row items-center justify-between border-b">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 truncate max-w-[200px]">
                    {customer.name}
                  </CardTitle>
                  <CardDescription className="text-[11px] font-mono text-indigo-600 font-semibold">
                    Key: {customer.customerKeyNumber}
                  </CardDescription>
                </div>
                <Badge
                  variant={customer.status === "Active" ? "default" : "secondary"}
                  className="text-[10px] px-2 py-0.5 font-semibold"
                >
                  {customer.status}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase font-semibold text-[10px] block">Meter Number</span>
                    <span className="font-mono font-bold text-slate-700">{customer.meterNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-semibold text-[10px] block">Branch</span>
                    <span className="font-medium text-slate-700">{getCustomerBranchName(customer.branchId, customer.subCity)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-semibold text-[10px] block">Usage</span>
                    <span className="font-bold text-slate-800">{effectiveUsage.toFixed(2)} m³</span>
                    {isMinApplied && <span className="text-[9px] text-amber-600 block">Min 3m³ applied</span>}
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-semibold text-[10px] block">Calculated Bill</span>
                    <span className="font-mono font-bold text-emerald-700">{currency} {customer.calculatedBill?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="col-span-2 border-t pt-1.5 mt-0.5 flex justify-between items-center">
                    <span className="text-slate-400 uppercase font-semibold text-[10px]">Bulk Meter:</span>
                    {customer.assignedBulkMeterId ? (
                      <Link
                        href={getBulkMeterHref(customer.assignedBulkMeterId)}
                        className="font-mono text-xs text-purple-700 font-semibold hover:underline"
                      >
                        {customer.assignedBulkMeterId}
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-xs italic">None</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  {onViewDetails && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-1 text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-600 hover:text-white font-semibold"
                      onClick={() => onViewDetails(customer)}
                    >
                      <Eye className="mr-1.5 h-3 w-3" /> View
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-1 text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-500 hover:text-white font-semibold"
                      onClick={() => onEdit(customer)}
                    >
                      <Edit className="mr-1.5 h-3 w-3" /> Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white font-semibold"
                      onClick={() => onDelete(customer)}
                    >
                      <Trash2 className="h-3 w-3" />
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
