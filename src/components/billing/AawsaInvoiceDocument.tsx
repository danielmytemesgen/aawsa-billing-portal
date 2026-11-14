'use client';

import * as React from "react";
import Image from "next/image";
import { getPenaltyValue } from "@/lib/billing-utils";

export interface AawsaInvoiceDocumentProps {
  meter: {
    customerKeyNumber?: string;
    name?: string;
    contractNumber?: string | null;
    meterNumber?: string | null;
    meterKey?: string | null;
    meterSize?: number | null;
    specificArea?: string | null;
    subCity?: string | null;
    woreda?: string | null;
    phoneNumber?: string | null;
    chargeGroup?: string | null;
    sewerageConnection?: string | null;
    branchId?: string | null;
    location?: string | null;
  };
  bill: {
    id?: string;
    CUSTOMERKEY?: string;
    BILLKEY?: string | null;
    monthYear?: string;
    PREVREAD?: number | null;
    CURRREAD?: number | null;
    CONS?: number | null;
    differenceUsage?: number | null;
    difference_usage?: number | null;
    snapshot_data?: any;
    baseWaterCharge?: number | null;
    base_water_charge?: number | null;
    maintenanceFee?: number | null;
    maintenance_fee?: number | null;
    sanitationFee?: number | null;
    sanitation_fee?: number | null;
    sewerageCharge?: number | null;
    sewerage_charge?: number | null;
    meterRent?: number | null;
    meter_rent?: number | null;
    vatAmount?: number | null;
    vat_amount?: number | null;
    THISMONTHBILLAMT?: number | null;
    TOTALBILLAMOUNT?: number | null;
    OUTSTANDINGAMT?: number | null;
    PENALTYAMT?: number | null;
    penaltyEnabled?: boolean;
    dueDate?: string | null;
    paymentStatus?: string | null;
    payment_status?: string | null;
  };
  branchName?: string;
  currentDateTime?: string;
  penaltyEnabled?: boolean;
}

export function AawsaInvoiceDocument({
  meter,
  bill,
  branchName,
  currentDateTime = new Date().toLocaleString('en-US'),
  penaltyEnabled = true,
}: AawsaInvoiceDocumentProps) {
  const isPenEnabled = bill.penaltyEnabled !== undefined ? bill.penaltyEnabled : penaltyEnabled;
  const penalty = getPenaltyValue(Number(bill.PENALTYAMT || 0), isPenEnabled);
  const outstanding = Number(bill.OUTSTANDINGAMT || 0);
  const arrears = Math.max(0, outstanding - penalty);
  const current = Math.max(0, Number(bill.THISMONTHBILLAMT ?? bill.TOTALBILLAMOUNT ?? 0));
  const totalPayable = outstanding + current;

  const paymentStatus = (bill.paymentStatus || bill.payment_status || 'Unpaid').trim();
  const isPaid = paymentStatus.toLowerCase() === 'paid';

  const bulkUsageVal = Number(bill.CONS ?? (Number(bill.CURRREAD ?? 0) - Number(bill.PREVREAD ?? 0)));
  const diffUsageVal = Number(bill.differenceUsage ?? bill.difference_usage ?? 0);
  const totalIndivUsageVal = Number(
    bill.snapshot_data?.totalIndividualUsage ??
    bill.snapshot_data?.total_individual_usage ??
    Math.max(0, bulkUsageVal - diffUsageVal)
  );

  const baseWater = Number(bill.base_water_charge ?? bill.baseWaterCharge ?? 0);
  const maintFee = Number(bill.maintenance_fee ?? bill.maintenanceFee ?? 0);
  const sanitFee = Number(bill.sanitation_fee ?? bill.sanitationFee ?? 0);
  const meterRentVal = Number(bill.meter_rent ?? bill.meterRent ?? 0);
  const sewFee = Number(bill.sewerage_charge ?? bill.sewerageCharge ?? 0);
  const vatVal = Number(bill.vat_amount ?? bill.vatAmount ?? 0);

  return (
    <div className="printable-bill-card">
      {/* Header */}
      <div className="print-header">
        <div className="print-header-top">
          <span>{currentDateTime}</span>
          <span>{meter.customerKeyNumber ? `Ref: ${meter.customerKeyNumber}` : ''}</span>
        </div>
        <div className="print-header-main flex flex-col items-start text-left">
          <h1 className="font-bold tracking-wider uppercase">
            ADDIS ABABA WATER AND SEWERAGE AUTHORITY
          </h1>
          <hr className="my-2 w-full" />
          <div className="flex flex-row items-center justify-center gap-2 pt-1">
            <Image
              src="https://veiethiopia.com/photo/partner/par2.png"
              alt="AAWSA Logo"
              width={30}
              height={18}
              className="flex-shrink-0"
            />
            <h2 className="font-semibold">AAWSA INVOICE</h2>
          </div>
        </div>
      </div>

      <div className="print-body">
        {/* Section 1: Bulk Information */}
        <div className="print-section">
          <div className="print-banner">BULK INFORMATION</div>
          <table className="print-table">
            <tbody>
              <tr>
                <td>Bulk meter name:</td>
                <td>{meter.name || 'N/A'}</td>
              </tr>
              <tr>
                <td>Customer key number:</td>
                <td>{meter.customerKeyNumber || 'N/A'}</td>
              </tr>
              <tr>
                <td>Contract No:</td>
                <td>{meter.contractNumber ?? 'N/A'}</td>
              </tr>
              <tr>
                <td>Meter Number:</td>
                <td>{meter.meterKey || meter.meterNumber || 'N/A'}</td>
              </tr>
              <tr>
                <td>Branch:</td>
                <td>{branchName || meter.subCity || 'N/A'}</td>
              </tr>
              <tr>
                <td>Sub-City:</td>
                <td>{meter.subCity || 'N/A'}</td>
              </tr>
              <tr>
                <td>Woreda:</td>
                <td>{meter.woreda || 'N/A'}</td>
              </tr>
              <tr>
                <td>Specific Area:</td>
                <td>{meter.specificArea || 'N/A'}</td>
              </tr>
              <tr>
                <td>Phone Number:</td>
                <td>{meter.phoneNumber ?? 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Reading Information */}
        <div className="print-section">
          <div className="print-banner">READING INFORMATION</div>
          <table className="print-table">
            <tbody>
              <tr>
                <td>Bulk Meter Category:</td>
                <td>{meter.chargeGroup || 'Non-domestic'}</td>
              </tr>
              <tr>
                <td>Sewerage Connection:</td>
                <td>{meter.sewerageConnection || 'No'}</td>
              </tr>
              <tr>
                <td>Bill Month:</td>
                <td>{bill.monthYear || 'N/A'}</td>
              </tr>
              <tr>
                <td>Previous and current reading:</td>
                <td>
                  {Number(bill.PREVREAD ?? 0).toFixed(2)} / {Number(bill.CURRREAD ?? 0).toFixed(2)} m³
                </td>
              </tr>
              <tr>
                <td>Bulk usage:</td>
                <td>{bulkUsageVal.toFixed(2)} m³</td>
              </tr>
              <tr>
                <td>Total Individual Usage:</td>
                <td>{totalIndivUsageVal.toFixed(2)} m³</td>
              </tr>
              <tr>
                <td>Difference usage:</td>
                <td>{diffUsageVal.toFixed(2)} m³</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Charges Breakdown */}
        <div className="print-section">
          <div className="print-banner">CHARGES BREAKDOWN</div>
          <table className="print-table">
            <tbody>
              <tr>
                <td>Base Water Charge (Rate/m³):</td>
                <td>ETB {baseWater.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Maintenance Fee:</td>
                <td>ETB {maintFee.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Sanitation Fee:</td>
                <td>ETB {sanitFee.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Meter Rent:</td>
                <td>ETB {meterRentVal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Sewerage Fee:</td>
                <td>ETB {sewFee.toFixed(2)}</td>
              </tr>
              <tr>
                <td>VAT (15%):</td>
                <td>ETB {vatVal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 4: Total Amount Payable */}
        <div className="print-section">
          <div className="print-banner">Total Amount Payable:</div>
          <table className="print-table">
            <tbody>
              <tr className="print-table-total">
                <td>Current Monthly Bill:</td>
                <td>ETB {current.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Penalty:</td>
                <td>ETB {penalty.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Debt Carried Forward (Arrears):</td>
                <td>ETB {arrears.toFixed(2)}</td>
              </tr>
              <tr className="print-table-total" style={{ fontSize: '14pt' }}>
                <td>Total Amount Payable:</td>
                <td>ETB {totalPayable.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer info & Stamp */}
        <div className="flex justify-between items-end mt-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold">
              Payment Status:{" "}
              <span className={isPaid ? "text-emerald-700" : "text-rose-700"}>
                {paymentStatus}
              </span>
            </div>
            <div className="text-sm">Month: {bill.monthYear || 'N/A'}</div>
            {bill.BILLKEY && <div className="text-xs text-muted-foreground">Key: {bill.BILLKEY}</div>}
            <div className="text-[10px] text-gray-500 pt-1">
              Present bill key at any CBE, AWASH, Telebirr branch to pay.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`print-status-box ${
                isPaid ? "border-emerald-600 text-emerald-700 bg-emerald-50" : ""
              }`}
            >
              {isPaid ? "PAID" : "UNPAID"}
            </div>
          </div>
        </div>

        {/* Signatures */}
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
}
