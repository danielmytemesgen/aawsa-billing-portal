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
    <div className="print-container non-printable-bg min-h-screen p-0">
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          .print-container { width: 100%; p-0 !important; margin: 0 !important; }
          .invoice-page-wrapper { page-break-after: always; page-break-inside: avoid; margin: 0 !important; padding: 0 !important; }
          .invoice-page-wrapper:last-child { page-break-after: auto; }
          @page { margin: 0; size: A4; }
        }
        .non-printable-bg { background-color: #f3f4f6; }
        .invoice-page-wrapper {
          padding: 2rem 0;
          display: flex;
          justify-content: flex-start;
        }
      `}</style>

      {invoiceData.map(({ meter, bill }) => {
        const d30 = Number(bill.debit_30 || 0);
        const d30_60 = Number(bill.debit_30_60 || 0);
        const d60 = Number(bill.debit_60 || 0);
        const outstanding = Number(bill.OUTSTANDINGAMT ?? (d30 + d30_60 + d60));
        const current = Math.max(0, Number(bill.THISMONTHBILLAMT ?? (Number(bill.TOTALBILLAMOUNT || 0) - outstanding)));
        const penalty = Number(bill.PENALTYAMT || 0);
        const totalPayable = outstanding + current + penalty;

        return (
          <div key={meter.customerKeyNumber} className="invoice-page-wrapper">
            <div className="printable-bill-card">
              <div className="print-header">
                <div className="print-header-top">
                  <span>{currentDateTime}</span>
                  <span></span>
                </div>
                <div className="print-header-main flex flex-col items-start text-left">
                  <h1 className="font-bold tracking-wider uppercase">ADDIS ABABA WATER AND SEWERAGE AUTHORITY</h1>
                  <hr className="my-2 w-full" />
                  <div className="flex flex-row items-center justify-center gap-2 pt-1">
                    <Image src="https://veiethiopia.com/photo/partner/par2.png" alt="AAWSA Logo" width={30} height={18} className="flex-shrink-0" />
                    <h2 className="font-semibold">AAWSA INVOICE</h2>
                  </div>
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
                    <tr className="print-table-total"><td>Current Bill (ETB)</td><td>ETB {current.toFixed(2)}</td></tr>
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
        </div>
        );
      })}
    </div>
  );
}
