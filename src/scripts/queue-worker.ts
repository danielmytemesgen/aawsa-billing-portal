import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables for the detached script
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function processJob(job: any) {
  console.log(`[Queue] Processing Job ID: ${job.id} | Type: ${job.job_type}`);
  
  try {
    // Implement your heavy job logic here based on job.job_type
    if (job.job_type === 'GENERATE_MONTHLY_REPORT') {
      console.log(`[Queue] Generating massive report for payload:`, job.payload);
      // Simulate heavy lifting (e.g. 5 seconds of work)
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log(`[Queue] Report generation complete.`);
    } else {
      console.log(`[Queue] Unknown job type: ${job.job_type}`);
    }

    // Mark as completed
    await pool.query(
      `UPDATE background_jobs SET status = 'COMPLETED', finished_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [job.id]
    );
    console.log(`[Queue] Job ${job.id} COMPLETED.`);
    
  } catch (err: any) {
    console.error(`[Queue] Job ${job.id} FAILED:`, err);
    // Mark as failed
    await pool.query(
      `UPDATE background_jobs SET status = 'FAILED', error = $1, finished_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [err.message || 'Unknown error', job.id]
    );
  }
}

async function pollQueue() {
  try {
    // 1. Fetch the oldest pending job and instantly lock it (FOR UPDATE SKIP LOCKED)
    // This allows multiple queue-workers to run simultaneously without picking the same job
    const res = await pool.query(`
      UPDATE background_jobs
      SET status = 'PROCESSING', started_at = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT id FROM background_jobs
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *;
    `);

    if (res.rows.length > 0) {
      const job = res.rows[0];
      await processJob(job);
      // If we found a job, immediately poll again to burn through the backlog
      setTimeout(pollQueue, 100);
    } else {
      // If no jobs, idle for 5 seconds
      setTimeout(pollQueue, 5000);
    }
  } catch (err) {
    console.error('[Queue] Polling error:', err);
    setTimeout(pollQueue, 5000);
  }
}

console.log('[Queue] Background Queue Worker started. Waiting for jobs...');
pollQueue();
