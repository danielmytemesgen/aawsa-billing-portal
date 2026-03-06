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
          body { margin: 0; padding: 0; }
          .print-container { width: 100%; }
          .invoice-page { page-break-after: always; page-break-inside: avoid; }
          .invoice-page:last-child { page-break-after: auto; }
          @page { margin: 1cm; size: A4; }
        }
        .invoice-page { background: white; padding: 2rem; margin-bottom: 2rem; border: 1px solid #e5e7eb; }
        .print-header-top { display: flex; justify-content: space-between; font-size: 0.75rem; color: #6b7280; margin-bottom: 1rem; }
        .print-header-main { text-align: center; margin-bottom: 2rem; display: flex; flex-direction: column; align-items: center; }
        .print-header-main h1 { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem; }
        .print-header-main h2 { font-size: 1rem; font-weight: 600; }
        .print-section { margin-bottom: 1.5rem; }
        .print-row { display: flex; justify-content: space-between; padding: 0.25rem 0; font-size: 0.875rem; }
        .print-row span:first-child { font-weight: 500; }
        .print-hr { border: none; border-top: 2px solid #000; margin: 0.5rem 0; }
        .print-hr-dashed { border: none; border-top: 1px dashed #9ca3af; margin: 0.5rem 0; }
        .print-signature-section { display: flex; justify-content: space-between; margin-top: 2rem; font-size: 0.875rem; }
        .print-signature-item { display: flex; flex-direction: column; gap: 0.5rem; }
      `}</style>

      {invoiceData.map(({ meter, bill }) => {
        const currentBill = Number(bill.THISMONTHBILLAMT ?? bill.TOTALBILLAMOUNT ?? 0);
        const outstanding = Number(bill.OUTSTANDINGAMT ?? bill.balanceCarriedForward ?? 0);
        const totalPayable = Number(bill.TOTALBILLAMOUNT ?? currentBill + outstanding);

        return (
          <div key={meter.customerKeyNumber} className="invoice-page">
            <div className="print-header-top">
              <span>{currentDateTime}</span>
              <span></span>
            </div>

            <div className="print-header-main flex flex-col items-center px-2 text-center">
              <h1 className="text-xl font-bold uppercase tracking-wide">Addis Ababa Water and Sewerage Authority</h1>
              <hr className="my-2 w-full border-black" />
              <div className="flex flex-row items-center justify-center gap-2 pt-1">
                <Image src="https://veiethiopia.com/photo/partner/par2.png" alt="AAWSA Logo" width={32} height={20} className="flex-shrink-0" />
                <h2 className="font-semibold text-lg">AAWSA INVOICE</h2>
              </div>
            </div>

            <div className="print-body">
              <div className="print-section">
                <div className="print-banner">BULK INFORMATION</div>
                <table className="print-table">
                  <tbody>
                    <tr><td>Bulk meter name:</td><td>{meter.name}</td></tr>
                    <tr><td>Customer key number:</td><td>{meter.customerKeyNumber}</td></tr>
                    <tr><td>Contract No:</td><td>{meter.contractNumber ?? 'N/A'}</td></tr>
                    <tr><td>Meter Number:</td><td>{meter.meterKey || meter.meterNumber || 'N/A'}</td></tr>
                    <tr><td>Branch:</td><td>{getBranchName(meter.branchId, meter.subCity)}</td></tr>
                    <tr><td>Sub-City:</td><td>{meter.subCity}</td></tr>
                    <tr><td>Woreda:</td><td>{meter.woreda}</td></tr>
                    <tr><td>Specific Area:</td><td>{meter.specificArea}</td></tr>
                    <tr><td>Phone Number:</td><td>{meter.phoneNumber ?? 'N/A'}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="print-section">
                <div className="print-banner">READING INFORMATION</div>
                <table className="print-table">
                  <tbody>
                    <tr><td>Bulk Meter Category:</td><td>{meter.chargeGroup}</td></tr>
                    <tr><td>Sewerage Connection:</td><td>{meter.sewerageConnection}</td></tr>
                    <tr><td>Bill Month:</td><td>{bill.monthYear}</td></tr>
                    <tr><td>Previous and Current Reading:</td><td>{Number(bill.PREVREAD).toFixed(2)} / {Number(bill.CURRREAD).toFixed(2)} m³</td></tr>
                    <tr><td>Bulk Usage:</td><td>{Number(bill.CONS ?? 0).toFixed(2)} m³</td></tr>
                    <tr><td>Total Individual Usage:</td><td>{(Number(bill.CONS ?? 0) - Number(bill.differenceUsage ?? 0)).toFixed(2)} m³</td></tr>
                    <tr><td>Difference Usage:</td><td>{Number(bill.differenceUsage ?? 0).toFixed(2)} m³</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="print-section">
                <div className="print-banner">CHARGES BREAKDOWN</div>
                <table className="print-table">
                  <tbody>
                    <tr>
                      <td>Base Water Charge (Rate/m³):</td>
                      <td>ETB {Number(bill.base_water_charge ?? 0).toFixed(2)}</td>
                    </tr>
                    <tr><td>Maintenance Fee:</td><td>ETB {Number(bill.maintenanceFee ?? 0).toFixed(2)}</td></tr>
                    <tr><td>Sanitation Fee:</td><td>ETB {Number(bill.sanitationFee ?? 0).toFixed(2)}</td></tr>
                    <tr><td>Meter Rent:</td><td>ETB {Number(bill.meterRent ?? 0).toFixed(2)}</td></tr>
                    <tr><td>Sewerage Fee:</td><td>ETB {Number(bill.sewerageCharge ?? 0).toFixed(2)}</td></tr>
                    <tr><td>VAT (15%):</td><td>ETB {Number(bill.vatAmount ?? 0).toFixed(2)}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="print-section">
                <div className="print-banner">Total Amount Payable:</div>
                <table className="print-table">
                  <tbody>
                    <tr className="print-table-total"><td>Total Difference bill:</td><td>ETB {currentBill.toFixed(2)}</td></tr>
                    <tr><td>Penalty (ETB):</td><td>ETB {Number(bill.PENALTYAMT || 0).toFixed(2)}</td></tr>
                    <tr><td>Outstanding (ETB):</td><td>ETB {outstanding.toFixed(2)}</td></tr>
                    <tr className="print-table-total" style={{ fontSize: '14pt' }}>
                      <td>Total Amount Payable:</td>
                      <td>ETB {totalPayable.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>



              <div className="flex justify-between items-end mt-4">
                <div className="space-y-1">
                  <div className="text-sm">Paid/Unpaid: {bill.paymentStatus ?? 'Unpaid'}</div>
                  <div className="text-sm">Month: {bill.monthYear}</div>
                  {bill.BILLKEY && <div className="text-xs text-muted-foreground">Key: {bill.BILLKEY}</div>}
                </div>
                <div className="print-status-box">
                  {bill.paymentStatus ?? 'Unpaid'}
                </div>
              </div>

              <div className="print-signature-section grid grid-cols-3 gap-4 mt-8">
                <div className="print-signature-item border-t border-black pt-2 flex flex-col text-center">
                  <span className="text-xs uppercase font-bold">Prepared by</span>
                  <span className="h-8"></span>
                </div>
                <div className="print-signature-item border-t border-black pt-2 flex flex-col text-center">
                  <span className="text-xs uppercase font-bold">Checked by</span>
                  <span className="h-8"></span>
                </div>
                <div className="print-signature-item border-t border-black pt-2 flex flex-col text-center">
                  <span className="text-xs uppercase font-bold">Approved by</span>
                  <span className="h-8"></span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
