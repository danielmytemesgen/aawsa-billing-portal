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
        .print-header-main { text-align: center; margin-bottom: 2rem; }
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
              <span>AAWSA Bulk Meter Billing Portal</span>
            </div>

            <div className="print-header-main">
              <h1>ADDIS ABABA WATER AND SEWERAGE AUTHORITY</h1>
              <hr style={{ margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', paddingTop: '0.25rem' }}>
                <Image src="https://veiethiopia.com/photo/partner/par2.png" alt="AAWSA Logo" width={30} height={18} />
                <h2>AAWSA Bill Calculating Portal</h2>
              </div>
            </div>

            <div className="print-section">
              <div className="print-row"><span>Bulk meter name:</span> <span>{meter.name}</span></div>
              <div className="print-row"><span>Customer key number:</span> <span>{meter.customerKeyNumber}</span></div>
              <div className="print-row"><span>Contract No:</span> <span>{meter.contractNumber ?? 'N/A'}</span></div>
              <div className="print-row"><span>Meter Number:</span> <span>{meter.meterNumber ?? 'N/A'}</span></div>
              <div className="print-row"><span>Branch:</span> <span>{getBranchName(meter.branchId, meter.subCity)}</span></div>
              <div className="print-row"><span>Sub-City:</span> <span>{meter.subCity}</span></div>
              <div className="print-row"><span>Woreda:</span> <span>{meter.woreda}</span></div>
              <div className="print-row"><span>Specific Area:</span> <span>{meter.specificArea}</span></div>
              <div className="print-row"><span>Phone Number:</span> <span>{meter.phoneNumber ?? 'N/A'}</span></div>
            </div>

            <div className="print-section">
              <div className="print-row"><span>Bulk Meter Category:</span> <span>{meter.chargeGroup}</span></div>
              <div className="print-row"><span>Sewerage Connection:</span> <span>{meter.sewerageConnection}</span></div>
              <div className="print-row"><span>Bill Month:</span> <span>{bill.monthYear}</span></div>
              <div className="print-row"><span>Previous and Current Reading:</span> <span>{Number(bill.PREVREAD).toFixed(2)} / {Number(bill.CURRREAD).toFixed(2)} m³</span></div>
              <div className="print-row"><span>Bulk Usage:</span> <span>{Number(bill.CONS ?? 0).toFixed(2)} m³</span></div>
              <div className="print-row"><span>Difference Usage:</span> <span>{Number(bill.differenceUsage ?? 0).toFixed(2)} m³</span></div>
            </div>

            <div className="print-section">
              <div className="print-row"><span>Base Water Charge:</span> <span>ETB {Number(bill.baseWaterCharge ?? 0).toFixed(2)}</span></div>
              <div className="print-row"><span>Maintenance Fee:</span> <span>ETB {Number(bill.maintenanceFee ?? 0).toFixed(2)}</span></div>
              <div className="print-row"><span>Sanitation Fee:</span> <span>ETB {Number(bill.sanitationFee ?? 0).toFixed(2)}</span></div>
              <div className="print-row"><span>Sewerage Fee:</span> <span>ETB {Number(bill.sewerageCharge ?? 0).toFixed(2)}</span></div>
              <div className="print-row"><span>Meter Rent:</span> <span>ETB {Number(bill.meterRent ?? 0).toFixed(2)}</span></div>
              <div className="print-row"><span>VAT (15%):</span> <span>ETB {Number(bill.vatAmount ?? 0).toFixed(2)}</span></div>
            </div>

            <hr className="print-hr" />
            <div className="print-row"><span>Current Bill:</span> <span>ETB {currentBill.toFixed(2)}</span></div>
            <hr className="print-hr" />
            <div className="print-row"><span>Outstanding (ETB):</span> <span>ETB {outstanding.toFixed(2)}</span></div>
            <hr className="print-hr" />
            <div className="print-row" style={{ fontWeight: 'bold', fontSize: '1rem' }}>
              <span>Total Amount Payable:</span>
              <span>ETB {totalPayable.toFixed(2)}</span>
            </div>
            <hr className="print-hr" />

            <div className="print-section">
              <div className="print-row"><span>Paid/Unpaid:</span> <span>{bill.paymentStatus}</span></div>
              {bill.dueDate && <div className="print-row"><span>Due Date:</span> <span>{bill.dueDate}</span></div>}
              {bill.BILLKEY && <div className="print-row"><span>Bill Key:</span> <span>{bill.BILLKEY}</span></div>}
            </div>

            <hr className="print-hr-dashed" />

            <div className="print-signature-section">
              <div className="print-signature-item">
                <span>Prepared by</span>
                <span>.....................................</span>
              </div>
              <div className="print-signature-item">
                <span>Checked by</span>
                <span>.....................................</span>
              </div>
              <div className="print-signature-item">
                <span>Approved by</span>
                <span>.....................................</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
