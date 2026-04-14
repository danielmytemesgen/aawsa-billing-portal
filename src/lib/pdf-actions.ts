"use server";

import { dbGetBillsForPdfBatch, dbCreatePdfJob, dbUpdatePdfJob, dbGetActivePdfJobs, dbDeletePdfJob, dbGetBillForPdf } from "./db-queries";
import { processBatchPdfGeneration } from "./pdf-generator.server";
import path from "path";
import fs from "fs";

export async function startBatchPdfGenerationAction(monthYear: string, branchId?: string | null) {
  try {
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

    // In a real production environment, this should be a truly background process 
    // or handled via a queue like BullMQ. For this local server setup, we 
    // run it "async" without awaiting the full process to return to the UI quickly.
    
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

    // Kick off background process
    runGeneration();

    return { success: true, jobId, message: "Batch PDF generation started in background." };

  } catch (error: any) {
    console.error("Error starting batch PDF generation:", error);
    return { success: false, error: error.message };
  }
}

export async function getActivePdfJobsAction() {
  try {
    const jobs = await dbGetActivePdfJobs();
    return { success: true, jobs };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deletePdfJobAction(jobId: string) {
  try {
    const success = await dbDeletePdfJob(jobId);
    return { success: true, message: "Job deleted successfully." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function generateSingleBillPdfAction(billId: string) {
  try {
    const bill = await dbGetBillForPdf(billId);
    if (!bill) return { success: false, error: "Bill not found." };

    const { jsPDF } = await import("jspdf");
    const { drawBillOnPdf } = await import("./pdf-generator.server");
    
    const doc = new jsPDF();
    drawBillOnPdf(doc, bill);
    
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    return { success: true, pdfBase64 };

  } catch (error: any) {
    console.error("Single PDF generation error:", error);
    return { success: false, error: error.message };
  }
}

