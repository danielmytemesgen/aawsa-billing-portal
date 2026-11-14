'use client';

import * as React from "react";
import { Printer, Download, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { AawsaInvoiceDocument } from "./AawsaInvoiceDocument";

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meter: any;
  bill: any;
  branchName?: string;
  penaltyEnabled?: boolean;
  printRoute?: string;
  canPrint?: boolean;
}

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  meter,
  bill,
  branchName,
  penaltyEnabled = true,
  printRoute = "/staff/bulk-meters/print-invoices",
  canPrint: canPrintProp,
}: InvoicePreviewDialogProps) {
  const { hasPermission } = usePermissions();
  const isFullAdmin = hasPermission(PERMISSIONS.BILL_VIEW_ALL);
  const canPrint = canPrintProp !== undefined 
    ? canPrintProp 
    : (isFullAdmin || hasPermission(PERMISSIONS.INVOICE_PRINT));

  if (!meter || !bill) return null;

  const handlePrint = () => {
    // Store in session storage and open print page in new window
    const printData = [{ meter, bill }];
    sessionStorage.setItem('batchInvoiceData', JSON.stringify(printData));
    sessionStorage.setItem('batchInvoicePenaltyEnabled', JSON.stringify(penaltyEnabled));
    window.open(printRoute, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 bg-slate-100 dark:bg-slate-900 border shadow-2xl">
        <DialogHeader className="sticky top-0 z-10 px-6 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold">
              Invoice Preview — {meter.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Period: {bill.monthYear || 'N/A'} • Key: {meter.customerKeyNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canPrint ? (
              <Button size="sm" onClick={handlePrint} className="bg-primary hover:bg-primary/90">
                <Printer className="h-4 w-4 mr-1.5" />
                Print Invoice
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                <Lock className="h-3.5 w-3.5" />
                Print Disabled
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 flex justify-center bg-slate-200/60 dark:bg-slate-950/60 overflow-x-auto">
          <div className="shadow-2xl bg-white border rounded-sm">
            <AawsaInvoiceDocument
              meter={meter}
              bill={bill}
              branchName={branchName}
              penaltyEnabled={penaltyEnabled}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

