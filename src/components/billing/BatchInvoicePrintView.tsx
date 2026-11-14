'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import { getBranchesLookupAction } from "@/lib/actions";
import { AawsaInvoiceDocument } from "./AawsaInvoiceDocument";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Receipt, Lock } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";

interface BatchInvoicePrintViewProps {
  fallbackRoute: string;
}

export function BatchInvoicePrintView({ fallbackRoute }: BatchInvoicePrintViewProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const isFullAdmin = hasPermission(PERMISSIONS.BILL_VIEW_ALL);
  const canPrint = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_PRINT);

  const [invoiceData, setInvoiceData] = React.useState<{ meter: any; bill: any }[]>([]);
  const [branchMap, setBranchMap] = React.useState<Record<string, string>>({});
  const [currentDateTime, setCurrentDateTime] = React.useState('');
  const [penaltyEnabled, setPenaltyEnabled] = React.useState(true);
  const [isReady, setIsReady] = React.useState(false);
  const [hasNoData, setHasNoData] = React.useState(false);

  React.useEffect(() => {
    if (!canPrint) return;

    const loadData = async () => {
      const dataStr = sessionStorage.getItem('batchInvoiceData');
      if (!dataStr) {
        setHasNoData(true);
        return;
      }

      try {
        const data = JSON.parse(dataStr);
        if (!Array.isArray(data) || data.length === 0) {
          setHasNoData(true);
          return;
        }

        setInvoiceData(data);

        const peStr = sessionStorage.getItem('batchInvoicePenaltyEnabled');
        if (peStr !== null) {
          try {
            setPenaltyEnabled(Boolean(JSON.parse(peStr)));
          } catch {
            // ignore parsing error
          }
        } else if (Array.isArray(data) && data[0]?.bill?.penaltyEnabled !== undefined) {
          setPenaltyEnabled(Boolean(data[0].bill.penaltyEnabled));
        }

        // Load branch labels via the permission-lite lookup action.
        const branchRes = await getBranchesLookupAction();
        if (branchRes && Array.isArray(branchRes.data)) {
          const map: Record<string, string> = {};
          branchRes.data.forEach((b: any) => { if (b.id) map[b.id] = b.name; });
          setBranchMap(map);
        }

        setCurrentDateTime(new Date().toLocaleString('en-US'));
        setIsReady(true);

        setTimeout(() => { window.print(); }, 600);
      } catch (err) {
        console.error("Failed to load invoice data:", err);
        setHasNoData(true);
      }
    };

    loadData();
  }, [router, fallbackRoute, canPrint]);

  const getBranchName = (branchId?: string, fallback?: string) => {
    if (branchId && branchMap[branchId]) return branchMap[branchId];
    return fallback || "N/A";
  };

  if (!canPrint) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 dark:bg-slate-900 text-center">
        <div className="max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border space-y-4">
          <div className="p-3 bg-rose-50 rounded-full w-fit mx-auto text-rose-600">
            <Lock className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold">Print Access Restricted</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You do not have permission to print invoices. Contact your administrator to request the <strong>invoice:print</strong> permission.
          </p>
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => router.push(fallbackRoute)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Return
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (hasNoData) {
    const isStaff = typeof window !== 'undefined' && window.location.pathname.startsWith('/staff');
    const invoiceGeneratorUrl = isStaff ? '/staff/invoices' : '/admin/invoices';

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 dark:bg-slate-900 text-center">
        <div className="max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border space-y-4">
          <div className="p-3 bg-amber-50 rounded-full w-fit mx-auto text-amber-600">
            <Receipt className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold">No Invoices Selected</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please use the Invoice Generator or Bulk Meters list to select customers and generate print-ready invoices.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => router.push(fallbackRoute)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
            <Button onClick={() => router.push(invoiceGeneratorUrl)}>
              <Receipt className="h-4 w-4 mr-1.5" />
              Go to Invoice Generator
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparing {invoiceData.length} invoice(s) for printing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="print-container non-printable-bg min-h-screen p-0">
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          .print-container { width: 100%; p-0 !important; margin: 0 !important; }
          .invoice-page-wrapper { page-break-after: always; page-break-inside: avoid; margin: 0 !important; padding: 0 !important; }
          .invoice-page-wrapper:last-child { page-break-after: auto; }
          .no-print { display: none !important; }
          @page { margin: 0; size: A4; }
        }
        .non-printable-bg { background-color: #f3f4f6; }
        .invoice-page-wrapper {
          padding: 2rem 0;
          display: flex;
          justify-content: flex-start;
        }
      `}</style>

      {/* Floating Action Bar (Hidden on print) */}
      <div className="no-print sticky top-4 z-50 max-w-4xl mx-auto px-4 mb-4">
        <div className="bg-slate-900/90 text-white backdrop-blur px-5 py-3 rounded-xl shadow-2xl flex items-center justify-between border border-slate-700">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold text-sm">
              Batch Invoices Ready ({invoiceData.length} page{invoiceData.length > 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-white border-slate-600 hover:bg-slate-800"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print All Invoices
            </Button>
          </div>
        </div>
      </div>

      {invoiceData.map(({ meter, bill }, index) => {
        const uniqueKey = `${meter.customerKeyNumber || 'meter'}-${bill.id || bill.BILLKEY || bill.monthYear || index}`;
        return (
          <div key={uniqueKey} className="invoice-page-wrapper">
            <AawsaInvoiceDocument
              meter={meter}
              bill={bill}
              branchName={getBranchName(meter.branchId, meter.subCity)}
              currentDateTime={currentDateTime}
              penaltyEnabled={penaltyEnabled}
            />
          </div>
        );
      })}
    </div>
  );
}
