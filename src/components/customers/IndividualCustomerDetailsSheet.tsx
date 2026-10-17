"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Gauge,
  MapPin,
  CreditCard,
  Hash,
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
  Building2,
  Navigation,
  History,
  Loader2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { calculateBillAction, getIndividualCustomerReadingHistoryAction } from "@/lib/actions";
import type { IndividualCustomerReadingHistoryItem } from "@/lib/actions";
import type { BillCalculationResult } from "@/lib/billing-calculations";

interface IndividualCustomerDetailsSheetProps {
  customer: IndividualCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (customer: IndividualCustomer) => void;
  onApprove?: (customer: IndividualCustomer) => void;
  onReject?: (customer: IndividualCustomer) => void;
  branches?: Branch[];
  bulkMetersList?: { customerKeyNumber: string; name: string }[];
  isAdmin?: boolean;
  canEdit?: boolean;
  canApprove?: boolean;
}

export function IndividualCustomerDetailsSheet({
  customer,
  open,
  onOpenChange,
  onEdit,
  onApprove,
  onReject,
  branches = [],
  bulkMetersList = [],
  isAdmin = true,
  canEdit = false,
  canApprove = false,
}: IndividualCustomerDetailsSheetProps) {
  const [billBreakdown, setBillBreakdown] = React.useState<BillCalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [readingHistory, setReadingHistory] = React.useState<IndividualCustomerReadingHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [isFullScreen, setIsFullScreen] = React.useState(true);

  const rawUsage = customer ? (customer.currentReading ?? 0) - (customer.previousReading ?? 0) : 0;
  const isMinApplied = customer?.isMinOfThreeApplied || (rawUsage < 3 && rawUsage >= 0);
  const effectiveUsage = customer?.effectiveUsage ?? (isMinApplied ? 3 : Math.max(0, rawUsage));

  React.useEffect(() => {
    if (!customer || !open) {
      setBillBreakdown(null);
      return;
    }

    let isMounted = true;
    setIsCalculating(true);

    calculateBillAction(
      effectiveUsage,
      customer.customerType || "Domestic",
      customer.sewerageConnection || "No",
      customer.meterSize || 0.5,
      customer.month || new Date().toISOString().slice(0, 7)
    )
      .then((res) => {
        if (isMounted && res.data) {
          setBillBreakdown(res.data);
        }
      })
      .catch((err) => {
        console.error("Error calculating bill breakdown:", err);
      })
      .finally(() => {
        if (isMounted) setIsCalculating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [customer, open, effectiveUsage]);

  React.useEffect(() => {
    if (!customer?.customerKeyNumber || !open) {
      setReadingHistory([]);
      return;
    }
    let isMounted = true;
    setIsLoadingHistory(true);
    getIndividualCustomerReadingHistoryAction(customer.customerKeyNumber)
      .then((res) => {
        if (isMounted && res.data) setReadingHistory(res.data);
      })
      .catch((err) => console.error("Error loading reading history:", err))
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });
    return () => { isMounted = false; };
  }, [customer?.customerKeyNumber, open]);

  if (!customer) return null;

  const branchName = branches.find((b) => b.id === customer.branchId)?.name || customer.subCity || "-";
  const parentBulkMeter = bulkMetersList.find((bm) => bm.customerKeyNumber === customer.assignedBulkMeterId);

  const bulkMeterHref = isAdmin
    ? `/admin/bulk-meters/${customer.assignedBulkMeterId}`
    : `/staff/bulk-meters/${customer.assignedBulkMeterId}`;

  // Modular Cards
  const renderQuickMetrics = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Usage (Consumption)</span>
            <Gauge className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-800">
            {effectiveUsage.toFixed(2)}{" "}
            <span className="text-xs font-normal text-slate-400">m³</span>
          </div>
          {isMinApplied && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <AlertTriangle className="h-3 w-3" /> Min 3m³ applied (Raw: {rawUsage.toFixed(2)})
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Calculated Bill</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {customer.calculatedBill?.toFixed(2) || "0.00"}{" "}
            <span className="text-xs font-normal text-slate-400">ETB</span>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-400 font-medium">
            Billing Month: {customer.month || "-"}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderParentBulkMeterCard = () => (
    <Card className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50/60 border border-blue-200/70 rounded-xl overflow-hidden shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase tracking-wider">
              <Layers className="h-4 w-4 text-blue-600" />
              Parent Bulk Meter
            </div>
            {customer.assignedBulkMeterId ? (
              <div>
                <div className="font-bold text-slate-800 text-sm">
                  {parentBulkMeter?.name || "Assigned Bulk Meter"}
                </div>
                <div className="font-mono text-xs text-blue-700 font-semibold mt-0.5">
                  Key: {customer.assignedBulkMeterId}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">No Bulk Meter currently assigned</div>
            )}
          </div>
          {customer.assignedBulkMeterId && (
            <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-blue-200 bg-white hover:bg-blue-600 hover:text-white shadow-sm font-semibold shrink-0">
              <Link href={bulkMeterHref}>
                View Meter <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderTechSpecsCard = () => (
    <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2">
          <Activity className="h-4 w-4 text-indigo-500" />
          Technical &amp; Reading Details
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Customer Type</span>
            <span className="font-bold text-slate-800">{customer.customerType || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Meter Size</span>
            <span className="font-bold text-slate-800">{customer.meterSize ? `${customer.meterSize}"` : "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Sewerage Link</span>
            <span className="font-bold text-slate-800">{customer.sewerageConnection || "No"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Prev Reading</span>
            <span className="font-mono font-bold text-slate-700">{customer.previousReading ?? 0}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Curr Reading</span>
            <span className="font-mono font-bold text-slate-900">{customer.currentReading ?? 0}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Dials / Ordinal</span>
            <span className="font-mono font-bold text-slate-700">{customer.NUMBER_OF_DIALS || "-"} / #{customer.ordinal || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">INST_KEY</span>
            <span className="font-mono font-semibold text-purple-700">{customer.instKey || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Contract No</span>
            <span className="font-semibold text-slate-700">{customer.contractNumber || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Book Number</span>
            <span className="font-semibold text-slate-700">{customer.bookNumber || "-"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderLocationCard = () => (
    <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2">
          <MapPin className="h-4 w-4 text-emerald-500" />
          Location &amp; Routing
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Branch</span>
            <span className="font-bold text-slate-800">{branchName}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Route Key</span>
            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 inline-block mt-0.5">
              {customer.routeKey || "-"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Phone</span>
            <span className="font-mono font-semibold text-slate-700">{customer.phoneNumber || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Sub-City</span>
            <span className="font-semibold text-slate-700">{customer.subCity || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Woreda</span>
            <span className="font-semibold text-slate-700">{customer.woreda ? `Woreda ${customer.woreda}` : "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Specific Area</span>
            <span className="font-semibold text-slate-700">{customer.specificArea || "-"}</span>
          </div>
          {(customer.xCoordinate !== undefined || customer.yCoordinate !== undefined) && (
            <div className="col-span-2 sm:col-span-3 pt-1 border-t flex items-center gap-2 text-slate-600 font-mono text-[11px]">
              <Navigation className="h-3 w-3 text-blue-500" />
              <span>GPS: X: {customer.xCoordinate ?? "-"}, Y: {customer.yCoordinate ?? "-"}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderFeeBreakdownCard = () => (
    billBreakdown ? (
      <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              Bill Fee Breakdown
            </div>
            <span className="text-[11px] text-slate-400 italic">Tariff Calculated</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Base Water Charge</span>
              <span className="font-mono font-semibold">{billBreakdown.baseWaterCharge.toFixed(2)} ETB</span>
            </div>
            {billBreakdown.sewerageCharge > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Sewerage Charge</span>
                <span className="font-mono font-semibold">{billBreakdown.sewerageCharge.toFixed(2)} ETB</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Maintenance Fee</span>
              <span className="font-mono font-semibold">{billBreakdown.maintenanceFee.toFixed(2)} ETB</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Sanitation Fee</span>
              <span className="font-mono font-semibold">{billBreakdown.sanitationFee.toFixed(2)} ETB</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Meter Rent</span>
              <span className="font-mono font-semibold">{billBreakdown.meterRent.toFixed(2)} ETB</span>
            </div>
            {billBreakdown.vatAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>VAT</span>
                <span className="font-mono font-semibold">{billBreakdown.vatAmount.toFixed(2)} ETB</span>
              </div>
            )}
            <Separator className="my-1.5" />
            <div className="flex justify-between text-sm font-bold text-slate-900">
              <span>Total Calculated Charge</span>
              <span className="font-mono text-emerald-700 font-black">{billBreakdown.totalBill.toFixed(2)} ETB</span>
            </div>
          </div>
        </CardContent>
      </Card>
    ) : null
  );

  const renderReadingHistoryCard = () => (
    <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <History className="h-4 w-4 text-violet-500" />
            <span>Reading &amp; Billing History</span>
            {readingHistory.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-50 text-violet-700 font-semibold border border-violet-200/60 lowercase">
                {readingHistory.length} records
              </span>
            )}
          </div>
          {isLoadingHistory && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
              <span>Updating...</span>
            </div>
          )}
        </div>

        {isLoadingHistory && readingHistory.length === 0 ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            Loading historical readings and bills...
          </div>
        ) : readingHistory.length === 0 ? (
          <p className="text-center text-xs text-slate-400 italic py-6">No reading or billing history found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 border-b border-slate-200">
                  <TableHead className="text-[11px] font-bold text-slate-700 py-2.5">Period</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-700 py-2.5">Prev Reading</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-700 py-2.5">Curr Reading</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-700 py-2.5">Usage (m³)</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-700 py-2.5">Bill (ETB)</TableHead>
                  <TableHead className="text-center text-[11px] font-bold text-slate-700 py-2.5">Pay Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readingHistory.map((row) => (
                  <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="text-[11px] font-semibold text-slate-800 py-2.5 font-mono">
                      {row.monthYear || "-"}
                    </TableCell>
                    <TableCell className="text-right text-[11px] font-mono text-slate-600 py-2.5">
                      {row.prevRead.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-[11px] font-mono text-slate-900 font-bold py-2.5">
                      {row.currRead.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-[11px] font-mono py-2.5">
                      <span className={row.usage > 0 ? "text-blue-700 font-bold" : "text-slate-400"}>
                        {row.usage.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-[11px] font-mono py-2.5">
                      {row.billAmount != null ? (
                        <span className="text-emerald-700 font-black">{row.billAmount.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-2.5">
                      {row.paymentStatus ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.paymentStatus === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : row.paymentStatus === "Pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {row.paymentStatus}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "overflow-y-auto p-0 flex flex-col gap-0 transition-all duration-200 bg-slate-50/50",
          isFullScreen
            ? "!w-screen sm:!max-w-none !max-w-none !inset-0 !h-screen !border-none !rounded-none z-50"
            : "sm:max-w-xl w-full border-l border-slate-200"
        )}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-6 relative border-b border-slate-800 shrink-0">
          <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4", isFullScreen && "max-w-7xl mx-auto w-full")}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/30 shadow-inner">
                  <User className="h-5 w-5" />
                </span>
                <div>
                  <SheetTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {customer.name}
                  </SheetTitle>
                  <SheetDescription className="text-slate-400 text-xs flex flex-wrap items-center gap-2 font-mono mt-0.5">
                    <span>Key: <strong className="text-slate-200">{customer.customerKeyNumber}</strong></span>
                    <span>•</span>
                    <span>METER_KEY: <strong className="text-slate-200">{customer.meterNumber}</strong></span>
                    {customer.contractNumber && (
                      <>
                        <span>•</span>
                        <span>Contract: <strong className="text-slate-200">{customer.contractNumber}</strong></span>
                      </>
                    )}
                  </SheetDescription>
                </div>
              </div>
            </div>

            {/* Status Badges & Full Screen Toggle */}
            <div className="flex items-center gap-3 pr-8 sm:pr-10">
              <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5">
                {customer.status === "Active" && (
                  <Badge className="bg-emerald-500 text-white border-0 text-xs font-semibold px-2.5 py-0.5 shadow-sm">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                  </Badge>
                )}
                {customer.status === "Pending Approval" && (
                  <Badge className="bg-amber-500 text-white border-0 text-xs font-semibold px-2.5 py-0.5 shadow-sm">
                    <Clock className="h-3 w-3 mr-1" /> Pending
                  </Badge>
                )}
                {customer.status === "Rejected" && (
                  <Badge className="bg-rose-500 text-white border-0 text-xs font-semibold px-2.5 py-0.5 shadow-sm">
                    <XCircle className="h-3 w-3 mr-1" /> Rejected
                  </Badge>
                )}
                {customer.status === "Inactive" && (
                  <Badge className="bg-slate-500 text-white border-0 text-xs font-semibold px-2.5 py-0.5 shadow-sm">
                    Inactive
                  </Badge>
                )}
                {customer.paymentStatus === "Paid" ? (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 text-[10px] bg-emerald-950/30">
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-rose-400 border-rose-500/40 text-[10px] bg-rose-950/30">
                    Unpaid
                  </Badge>
                )}
              </div>

              {/* Open as Dedicated Page */}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-colors shadow-sm hidden sm:inline-flex"
                title="Open as Dedicated Page"
              >
                <Link href={`${isAdmin ? "/admin" : "/staff"}/individual-customers/${encodeURIComponent(customer.customerKeyNumber)}`}>
                  <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
                  <span>Open Page</span>
                </Link>
              </Button>

              {/* Fullscreen Toggle Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFullScreen((prev) => !prev)}
                className="h-8 gap-1.5 px-2.5 text-xs bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-colors shadow-sm hidden sm:inline-flex"
                title={isFullScreen ? "Switch to Drawer View" : "Expand to Full Screen"}
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 text-sky-400" />
                    <span>Exit Full Screen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-sky-400" />
                    <span>Full Screen</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto">
          <div className={cn("p-6 space-y-6", isFullScreen ? "max-w-7xl mx-auto py-8" : "w-full")}>
            {isFullScreen ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Main Column */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                  {renderQuickMetrics()}
                  {renderReadingHistoryCard()}
                  {renderParentBulkMeterCard()}
                </div>

                {/* Sidebar Column */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                  {renderTechSpecsCard()}
                  {renderFeeBreakdownCard()}
                  {renderLocationCard()}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {renderQuickMetrics()}
                {renderParentBulkMeterCard()}
                {renderTechSpecsCard()}
                {renderLocationCard()}
                {renderFeeBreakdownCard()}
                {renderReadingHistoryCard()}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-sm">
          <div className={cn("flex items-center justify-between gap-3", isFullScreen && "max-w-7xl mx-auto w-full")}>
            <div className="flex items-center gap-2">
              {customer.status === "Pending Approval" && canApprove && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-600 hover:text-white"
                    onClick={() => onApprove?.(customer)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs text-rose-700 bg-rose-50 border-rose-300 hover:bg-rose-600 hover:text-white"
                    onClick={() => onReject?.(customer)}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                  </Button>
                </>
              )}
              {isFullScreen && (
                <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium pl-2">
                  <Maximize2 className="h-3 w-3 text-slate-400" />
                  Full-screen details mode
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-500 hover:text-white font-medium"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit?.(customer);
                  }}
                >
                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit Customer
                </Button>
              )}
              <Button size="sm" variant="secondary" className="h-9 text-xs font-semibold px-4" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
