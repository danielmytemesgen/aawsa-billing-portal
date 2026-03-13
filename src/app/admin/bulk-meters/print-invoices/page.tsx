'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAllBranchesAction } from "@/lib/actions";

export default function PrintInvoicesPage() {
  const router = useRouter();
  const [invoiceData, setInvoiceData] = React.useState<{ meter: any; bill: any }[]>([]);
  const [branchMap, setBranchMap] = React.useState<Record<string, string>>({});
  const [currentDateTime, setCurrentDateTime] = React.useState('');
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const loadData = async () => {
      const dataStr = sessionStorage.getItem('batchInvoiceData');
      if (!dataStr) {
        router.push('/admin/bulk-meters');
        return;
      }

      const data = JSON.parse(dataStr);
      setInvoiceData(data);

      // Load branches via server action (live DB)
      const branchRes = await getAllBranchesAction();
      if (branchRes && Array.isArray(branchRes)) {
        const map: Record<string, string> = {};
        branchRes.forEach((b: any) => { if (b.id) map[b.id] = b.name; });
        setBranchMap(map);
      }

      setCurrentDateTime(new Date().toLocaleString('en-US'));
      setIsReady(true);

      setTimeout(() => { window.print(); }, 600);
    };

    loadData();
  }, [router]);

  const getBranchName = (branchId?: string, fallback?: string) => {
    if (branchId && branchMap[branchId]) return branchMap[branchId];
    return fallback || "N/A";
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparing invoices for printing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="print-container">
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; background: white !important; }
          .print-container { width: 100%; padding: 0; }
          .invoice-page { 
            page-break-after: always; 
            page-break-inside: avoid;
            margin: 0 !important;
            border: none !important;
            min-height: 297mm;
            padding: 2.5rem !important;
          }
          .invoice-page:last-child { page-break-after: auto; }
          @page { margin: 1cm; size: A4 portrait; }
        }
        .invoice-page { 
          background: white; 
          padding: 2.5rem; 
          margin-bottom: 2rem; 
          border: 1px solid #e5e7eb;
          max-width: 800px;
          margin-left: auto;
          margin-right: auto;
          position: relative;
          overflow: hidden;
        }
        /* Bulk Watermark */
        .invoice-page::before {
          content: "OFFICIAL INVOICE";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 80pt;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.03);
          pointer-events: none;
          white-space: nowrap;
          z-index: 0;
        }
      `}</style>

      {invoiceData.map(({ meter, bill }) => {
        const currentBill = Number(bill.THISMONTHBILLAMT ?? bill.TOTALBILLAMOUNT ?? 0);
        const outstanding = Number(bill.OUTSTANDINGAMT ?? bill.balanceCarriedForward ?? 0);
        const totalPayable = Number(bill.TOTALBILLAMOUNT ?? currentBill + outstanding);

        return (
          <div key={meter.customerKeyNumber} className="invoice-page printable-bill-card">
            <div className="print-header">
              <div className="print-header-top">
                <span>Invoice generated on: {currentDateTime}</span>
                <span className="font-bold">INVOICE #{meter.customerKeyNumber}-{bill.monthYear}</span>
              </div>

              <div className="print-header-main flex flex-col items-center px-2 text-center">
                <h1 className="uppercase tracking-tighter">ADDIS ABABA WATER AND SEWERAGE AUTHORITY</h1>
                <div className="flex flex-row items-center justify-center gap-4 mt-2">
                  <Image src="https://veiethiopia.com/photo/partner/par2.png" alt="AAWSA Logo" width={50} height={30} className="flex-shrink-0" />
                  <h2 className="border-l-2 border-slate-300 pl-4">AAWSA INVOICE</h2>
                </div>
              </div>
            </div>

            <div className="print-body">
              <div className="print-section">
                <div className="print-banner">Bulk Meter Information</div>
                <table className="print-table">
                  <tbody>
                    <tr><td>Account Name</td><td>{meter.name}</td></tr>
                    <tr><td>Customer Key</td><td>{meter.customerKeyNumber}</td></tr>
                    <tr><td>Contract Number</td><td>{meter.contractNumber ?? 'N/A'}</td></tr>
                    <tr><td>Operational Branch</td><td>{getBranchName(meter.branchId, meter.subCity)}</td></tr>
                    <tr><td>Location (Sub-City)</td><td>{meter.subCity}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="print-section">
                <div className="print-banner">Reading & Consumption</div>
                <table className="print-table">
                  <tbody>
                    <tr><td>Meter Category</td><td>{meter.chargeGroup}</td></tr>
                    <tr><td>Sewerage Connection</td><td>{meter.sewerageConnection}</td></tr>
                    <tr><td>Billing Period</td><td>{bill.monthYear}</td></tr>
                    <tr><td>Reading Range</td><td>{Number(bill.PREVREAD).toFixed(2)} - {Number(bill.CURRREAD).toFixed(2)} m³</td></tr>
                    <tr><td>Main Meter Usage</td><td>{Number(bill.CONS ?? 0).toFixed(2)} m³</td></tr>
                    <tr><td>Sub-Meter Total Usage</td><td>{(Number(bill.CONS ?? 0) - Number(bill.differenceUsage ?? 0)).toFixed(2)} m³</td></tr>
                    <tr className="font-bold"><td>Billable Difference</td><td>{Number(bill.differenceUsage ?? 0).toFixed(2)} m³</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="print-section">
                <div className="print-banner">Charges Breakdown</div>
                <table className="print-table">
                  <tbody>
                    <tr>
                      <td>Base Water Charge (Standard Rate)</td>
                      <td>ETB {Number(bill.base_water_charge ?? 0).toFixed(2)}</td>
                    </tr>
                    <tr><td>Maintenance Service Fee</td><td>ETB {Number(bill.maintenanceFee ?? 0).toFixed(2)}</td></tr>
                    <tr><td>Sanitation Service Fee</td><td>ETB {Number(bill.sanitationFee ?? 0).toFixed(2)}</td></tr>
                    <tr><td>Meter Rental Fee</td><td>ETB {Number(bill.meterRent ?? 0).toFixed(2)}</td></tr>
                    <tr><td>Sewerage Disposal Fee</td><td>ETB {Number(bill.sewerageCharge ?? 0).toFixed(2)}</td></tr>
                    <tr><td>Value Added Tax (15%)</td><td>ETB {Number(bill.vatAmount ?? 0).toFixed(2)}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="print-section pt-4 border-t-2 border-slate-200">
                <div className="print-banner">Payment Summary</div>
                <table className="print-table">
                  <tbody>
                    <tr><td>Current Period Bill</td><td>ETB {currentBill.toFixed(2)}</td></tr>
                    <tr><td>Accrued Penalty</td><td>ETB {Number(bill.PENALTYAMT || 0).toFixed(2)}</td></tr>
                    <tr><td>Outstanding Balance</td><td>ETB {outstanding.toFixed(2)}</td></tr>
                    <tr className="print-table-total">
                      <td className="uppercase tracking-wider">Total Amount Payable</td>
                      <td>ETB {totalPayable.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center mt-12 bg-slate-50 p-6 rounded-lg border border-slate-100">
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">Billing Cycle</div>
                  <div className="text-lg font-bold text-slate-900">{bill.monthYear}</div>
                </div>
                <div className="print-status-box">
                  {bill.paymentStatus ?? 'Unpaid'}
                </div>
              </div>

              <div className="print-signature-section">
                <div className="print-signature-item">
                  <div className="print-signature-line"></div>
                  <span className="print-signature-label">Prepared by</span>
                </div>
                <div className="print-signature-item">
                  <div className="print-signature-line"></div>
                  <span className="print-signature-label">Checked by</span>
                </div>
                <div className="print-signature-item">
                  <div className="print-signature-line"></div>
                  <span className="print-signature-label">Approved by</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
