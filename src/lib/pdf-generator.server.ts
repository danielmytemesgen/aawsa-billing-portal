import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import { getMonthlyBillAmt } from "./billing-utils";

/**
 * Generates a single bill on the current page of the provided jsPDF instance.
 * @param doc The jsPDF instance
 * @param bill The bill data from the database
 * @param yOffset Starting Y position in mm
 */
export const drawBillOnPdf = (doc: jsPDF, bill: any, yOffset: number = 20) => {
  const leftMargin = 15;
  const rightMargin = 195;
  const contentWidth = 180;
  const col2 = 140; // Value column
  
  // Header Style
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("ADDIS ABABA WATER AND SEWERAGE AUTHORITY", 105, yOffset, { align: 'center' });
  
  yOffset += 10;
  doc.setDrawColor(200);
  doc.line(leftMargin, yOffset, rightMargin, yOffset);
  
  yOffset += 10;
  doc.setFontSize(12);
  doc.text("AAWSA INVOICE", leftMargin + 10, yOffset);
  
  // --- Section: BULK INFORMATION ---
  yOffset += 10;
  doc.setFillColor(34, 60, 137); // Deep Blue
  doc.rect(leftMargin, yOffset, contentWidth, 8, 'F');
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.text("BULK INFORMATION", leftMargin + 5, yOffset + 5.5);
  doc.setTextColor(0);
  
  const drawRow = (label: string, value: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, leftMargin + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, rightMargin - 2, y, { align: 'right' });
    doc.setDrawColor(245);
    doc.line(leftMargin, y + 2, rightMargin, y + 2);
    return y + 6;
  };

  yOffset += 12;
  yOffset = drawRow("Bulk meter name:", bill.meter_name || bill.CUSTOMERNAME || "N/A", yOffset);
  yOffset = drawRow("Customer key number:", bill.CUSTOMERKEY || "N/A", yOffset);
  yOffset = drawRow("Contract No:", bill.contractNumber || "N/A", yOffset);
  yOffset = drawRow("Branch:", bill.branch_name || bill.CUSTOMERBRANCH || "N/A", yOffset);
  yOffset = drawRow("Sub-City:", bill.sub_city || "N/A", yOffset);

  // --- Section: READING INFORMATION ---
  yOffset += 5;
  doc.setFillColor(34, 60, 137);
  doc.rect(leftMargin, yOffset, contentWidth, 8, 'F');
  doc.setTextColor(255);
  doc.text("READING INFORMATION", leftMargin + 5, yOffset + 5.5);
  doc.setTextColor(0);

  yOffset += 12;
  yOffset = drawRow("Bulk Meter Category:", bill.charge_group || "N/A", yOffset);
  yOffset = drawRow("Sewerage Connection:", bill.sewerage_connection || "N/A", yOffset);
  yOffset = drawRow("Number of Assigned Individual Customers:", String(bill.assigned_customers_count || 0), yOffset);
  yOffset = drawRow("Previous and current reading:", `${bill.PREVREAD} / ${bill.CURRREAD} m3`, yOffset);
  yOffset = drawRow("Bulk usage:", `${bill.CONS} m3`, yOffset);
  yOffset = drawRow("Total Individual Usage:", `${bill.snapshot_data?.total_individual_usage || 0} m3`, yOffset);
  doc.setFont("helvetica", "bold");
  yOffset = drawRow("Difference usage:", `${bill.difference_usage || 0} m3`, yOffset);
  doc.setFont("helvetica", "normal");

  // --- Section: CHARGES BREAKDOWN ---
  yOffset += 5;
  doc.setFillColor(34, 60, 137);
  doc.rect(leftMargin, yOffset, contentWidth, 8, 'F');
  doc.setTextColor(255);
  doc.text("CHARGES BREAKDOWN", leftMargin + 5, yOffset + 5.5);
  doc.setTextColor(0);

  yOffset += 12;
  yOffset = drawRow("Base Water Charge (Rate/m3):", `ETB ${Number(bill.base_water_charge || 0).toFixed(2)}`, yOffset);
  yOffset = drawRow("Maintenance Fee:", `ETB ${Number(bill.maintenance_fee || 0).toFixed(2)}`, yOffset);
  yOffset = drawRow("Sanitation Fee:", `ETB ${Number(bill.sanitation_fee || 0).toFixed(2)}`, yOffset);
  yOffset = drawRow("Meter Rent:", `ETB ${Number(bill.meter_rent || 0).toFixed(2)}`, yOffset);
  yOffset = drawRow("Sewerage Fee:", `ETB ${Number(bill.sewerage_charge || 0).toFixed(2)}`, yOffset);
  yOffset = drawRow("VAT (15%):", `ETB ${Number(bill.vat_amount || 0).toFixed(2)}`, yOffset);

  // --- Section: TOTAL AMOUNT PAYABLE ---
  const outstandingVal = Number(bill.OUTSTANDINGAMT || 0) || (Number(bill.debit_30 || 0) + Number(bill.debit_30_60 || 0) + Number(bill.debit_60 || 0));
  const currentVal = getMonthlyBillAmt(bill);
  const penaltyVal = Number(bill.PENALTYAMT || 0);
  const totalPayableVal = outstandingVal + Math.max(0, currentVal) + penaltyVal;

  yOffset += 5;
  doc.setFillColor(34, 60, 137);
  doc.rect(leftMargin, yOffset, contentWidth, 8, 'F');
  doc.setTextColor(255);
  doc.text("TOTAL AMOUNT PAYABLE:", leftMargin + 5, yOffset + 5.5);
  doc.setTextColor(0);

  yOffset += 12;
  yOffset = drawRow("Current Bill (ETB):", `ETB ${Math.max(0, currentVal).toFixed(2)}`, yOffset);
  yOffset = drawRow("Penalty (ETB):", `ETB ${penaltyVal.toFixed(2)}`, yOffset);
  yOffset = drawRow("Outstanding (ETB):", `ETB ${outstandingVal.toFixed(2)}`, yOffset);
  
  yOffset += 2;
  doc.setFillColor(245, 247, 250);
  doc.rect(leftMargin, yOffset, contentWidth, 10, 'F');
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 60, 137);
  doc.text("TOTAL AMOUNT PAYABLE (ETB):", leftMargin + 5, yOffset + 6.5);
  doc.text(`ETB ${totalPayableVal.toFixed(2)}`, rightMargin - 5, yOffset + 6.5, { align: 'right' });

  // Footer / Status
  yOffset += 15;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text(`Billing Cycle: ${bill.month_year}`, leftMargin, yOffset);
  doc.text(`Status: ${bill.payment_status}`, rightMargin, yOffset, { align: 'right' });
  
  return yOffset;
};

export const processBatchPdfGeneration = async (
  jobId: string, 
  bills: any[], 
  jobDir: string,
  batchSize: number = 500
) => {
  const filePaths: string[] = [];
  const totalCount = bills.length;
  
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  for (let i = 0; i < totalCount; i += batchSize) {
    const chunk = bills.slice(i, i + batchSize);
    const doc = new jsPDF();
    
    chunk.forEach((bill, index) => {
      if (index > 0) doc.addPage();
      drawBillOnPdf(doc, bill);
    });

    const fileName = `batch_${Math.floor(i / batchSize) + 1}.pdf`;
    const filePath = path.join(jobDir, fileName);
    
    // In Node.js environment, jspdf output can be converted to Buffer
    const pdfOutput = doc.output('arraybuffer');
    fs.writeFileSync(filePath, Buffer.from(pdfOutput));
    
    // Store relative path for download
    const relativePath = filePath.split('public')[1].replace(/\\/g, '/');
    filePaths.push(relativePath);
  }

  return filePaths;
};
