"use server";

import { dbGetBillsForPdfBatch, dbCreatePdfJob, dbUpdatePdfJob, dbGetActivePdfJobs, dbDeletePdfJob, dbGetBillForPdf } from "./db-queries";
import { processBatchPdfGeneration } from "./pdf-generator.server";
import path from "path";
import fs from "fs";

import { checkPermission } from "./actions";
import { getSession } from "./auth";
import { PERMISSIONS } from "./constants/auth";

export async function startBatchPdfGenerationAction(monthYear: string, branchId?: string | null) {
  try {
    const session = await checkPermission(PERMISSIONS.BILL_VIEW_ALL);
    
    const bills = await dbGetBillsForPdfBatch(monthYear, branchId);
    if (bills.length === 0) return { success: false, error: "No bills found for the selected period/branch." };

    const uniqueKey = `${branchId || 'all'}_${monthYear}_${Date.now()}`;
    const jobId = await dbCreatePdfJob({
      branch_id: branchId || null,
      month_year: monthYear,
      total_bills: bills.length,
      unique_key: uniqueKey
    });

    if (!jobId) return { success: false, error: "Failed to create PDF generation job." };

    const runGeneration = async () => {
      try {
        await dbUpdatePdfJob(jobId, { status: 'processing' });
        
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'pdf_batches', jobId);
        const filePaths = await processBatchPdfGeneration(jobId, bills, uploadsDir);
        
        await dbUpdatePdfJob(jobId, { 
          status: 'completed', 
          file_paths: filePaths,
          generated_bills: bills.length 
        });
      } catch (err: any) {
        console.error("Batch PDF generation error:", err);
        await dbUpdatePdfJob(jobId, { status: 'failed', error_message: err.message });
      }
    };

    runGeneration();
    return { success: true, jobId, message: "Batch PDF generation started in background." };

  } catch (error: any) {
    console.error("Error starting batch PDF generation:", error);
    return { success: false, error: error.message };
  }
}

export async function getActivePdfJobsAction() {
  try {
    await checkPermission(PERMISSIONS.BILL_VIEW_ALL);
    const jobs = await dbGetActivePdfJobs();
    return { success: true, jobs };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deletePdfJobAction(jobId: string) {
  try {
    await checkPermission(PERMISSIONS.BILL_DELETE);
    const success = await dbDeletePdfJob(jobId);
    return { success: true, message: "Job deleted successfully." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function generateSingleBillPdfAction(billId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const { checkPermission, logSecurityEventAction } = await import("./actions");
    const { dbGetStaffPermissions } = await import("./db-queries");
    const { PERMISSIONS } = await import("./constants/auth");
    const perms = await dbGetStaffPermissions(session.id);

    if (!perms.includes(PERMISSIONS.BILL_VIEW_ALL) && !perms.includes(PERMISSIONS.BILL_VIEW_BRANCH)) {
      throw new Error('Forbidden: Missing bill view permission.');
    }

    const bill = await dbGetBillForPdf(billId);
    if (!bill) return { success: false, error: "Bill not found." };

    const { jsPDF } = await import("jspdf");
    const { drawBillOnPdf } = await import("./pdf-generator.server");
    
    const doc = new jsPDF();
    drawBillOnPdf(doc, bill);
    
    const pdfBase64 = doc.output('datauristring').split(',')[1];

    await logSecurityEventAction({
      event: 'Generate Single Bill PDF',
      details: { billId }
    });

    return { success: true, pdfBase64 };

  } catch (error: any) {
    console.error("Single PDF generation error:", error);
    return { success: false, error: error.message };
  }
}

