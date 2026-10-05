#!/usr/bin/env ts-node
/**
 * AAWSA Bulk Meter Payment Sync Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * High-volume background worker supporting 100,000+ bulk meters with:
 *   - Cursor-based chunked processing (OFFSET/LIMIT) with checkpoint/resume
 *   - Smart filtering: unpaidOnly (default true), branchId, monthYear
 *   - Adaptive concurrency (default 20 parallel calls to AAWSA port 5001)
 *   - Circuit breaker: auto-abort after 5 consecutive timeouts
 *   - ETA calculation and live progress reporting to aawsa_sync_jobs table
 *   - Graceful cancel support via SIGINT/SIGTERM or DB cancel flag
 *
 * Usage:
 *   npx ts-node src/scripts/bulk-sync-worker.ts [options]
 *
 * Options:
 *   --unpaid-only          Only sync meters with active unpaid bills (default: true)
 *   --all                  Override: sync all meters regardless of payment status
 *   --branch <branchId>    Only sync meters in this branch (UUID)
 *   --month <YYYY-MM>      Target a specific billing cycle (e.g. 2026-09)
 *   --concurrency <N>      Parallel calls to AAWSA endpoint (default: 20, max: 30)
 *   --chunk-size <N>       Meters per DB query batch (default: 500)
 *   --dry-run              Query endpoint but do NOT update database
 *   --resume <jobId>       Resume a previously interrupted job by ID
 *
 * Examples:
 *   npx ts-node src/scripts/bulk-sync-worker.ts --unpaid-only
 *   npx ts-node src/scripts/bulk-sync-worker.ts --branch "a1b2-c3d4-..." --month 2026-09
 *   npx ts-node src/scripts/bulk-sync-worker.ts --all --concurrency 15 --chunk-size 1000
 *   npx ts-node src/scripts/bulk-sync-worker.ts --resume "job-uuid-here"
 */

import { config } from 'dotenv';
import * as path from 'path';

// Load env from project root
config({ path: path.resolve(__dirname, '../../.env.production') });
config({ path: path.resolve(__dirname, '../../.env.local') });
config({ path: path.resolve(__dirname, '../../.env') });

import {
    dbEnsureSyncJobsTable,
    dbCreateSyncJob,
    dbGetSyncJob,
    dbUpdateSyncJob,
    dbUpdateSyncJobProgress,
    dbCancelSyncJob,
    dbGetBulkMetersSyncChunk,
    dbCountBulkMetersForSync,
    dbSyncCustomerPaymentAndReading,
    type SyncJobFilters,
} from '../lib/db-queries';
import { checkAawsaPaidStatus } from '../lib/aawsa-uploader-client';

// ─── CLI Argument Parsing ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (flag: string) => args.includes(flag);

const unpaidOnly = !hasFlag('--all');
const branchId = getArg('--branch') || null;
const monthYear = getArg('--month') || null;
const concurrency = Math.min(Math.max(Number(getArg('--concurrency') || 20), 1), 30);
const chunkSize = Math.min(Math.max(Number(getArg('--chunk-size') || 500), 50), 2000);
const dryRun = hasFlag('--dry-run');
const resumeJobId = getArg('--resume') || null;

const CIRCUIT_BREAKER_THRESHOLD = 5;
const TIMEOUT_PATTERNS = ['timed out', 'ECONNREFUSED', 'ENOTFOUND', 'Could not reach AAWSA endpoint', 'fetch failed'];

function isTimeoutError(msg?: string): boolean {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return TIMEOUT_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

function calcEta(processedSoFar: number, total: number, elapsedMs: number): Date | null {
    if (processedSoFar === 0 || elapsedMs === 0) return null;
    const rate = processedSoFar / elapsedMs; // meters per ms
    const remaining = total - processedSoFar;
    const msRemaining = remaining / rate;
    return new Date(Date.now() + msRemaining);
}

function formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
let shutdown = false;
process.on('SIGINT', () => { console.log('\n[Worker] SIGINT received, stopping after current chunk...'); shutdown = true; });
process.on('SIGTERM', () => { console.log('\n[Worker] SIGTERM received, stopping after current chunk...'); shutdown = true; });

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(' AAWSA Bulk Meter Payment Sync Worker');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Mode       : ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE SYNC'}`);
    console.log(`Scope      : ${unpaidOnly ? 'Unpaid bills only' : 'All bulk meters'}`);
    console.log(`Branch     : ${branchId || 'All branches'}`);
    console.log(`Month      : ${monthYear || 'Any/current'}`);
    console.log(`Concurrency: ${concurrency} parallel calls`);
    console.log(`Chunk Size : ${chunkSize} meters/batch`);
    console.log(`Resume Job : ${resumeJobId || 'None (new job)'}`);
    console.log('───────────────────────────────────────────────────────────');

    await dbEnsureSyncJobsTable();

    const filters: SyncJobFilters = { branchId, unpaidOnly, monthYear };

    // ─── Resume existing job or count fresh ─────────────────────────────────
    let jobId: string;
    let startOffset = 0;
    let totalMeters = 0;
    let syncedOk = 0;
    let syncedError = 0;

    if (resumeJobId) {
        const existingJob = await dbGetSyncJob(resumeJobId);
        if (!existingJob) {
            console.error(`[Worker] Job ${resumeJobId} not found.`);
            process.exit(1);
        }
        if (existingJob.status === 'done') {
            console.log(`[Worker] Job ${resumeJobId} is already complete (${existingJob.synced_ok} OK, ${existingJob.synced_error} errors).`);
            process.exit(0);
        }
        jobId = existingJob.id;
        startOffset = existingJob.current_offset || 0;
        totalMeters = existingJob.total_meters;
        syncedOk = existingJob.synced_ok;
        syncedError = existingJob.synced_error;
        // Reset status to running
        await dbUpdateSyncJob(jobId, { status: 'running', error: null });
        console.log(`[Worker] Resuming job ${jobId} from offset ${startOffset} / ${totalMeters} meters`);
    } else {
        totalMeters = await dbCountBulkMetersForSync(filters);
        if (totalMeters === 0) {
            console.log('[Worker] No meters match the sync filters. Nothing to do.');
            process.exit(0);
        }
        const job = await dbCreateSyncJob({ jobType: 'batch_bulk_highvolume', triggeredBy: 'cli_worker', totalMeters, chunkSize, filters });
        jobId = job.id;
        console.log(`[Worker] Created job ${jobId} — ${totalMeters.toLocaleString()} meters to sync`);
    }

    // ─── Main Processing Loop ────────────────────────────────────────────────
    let offset = startOffset;
    let consecutiveTimeouts = 0;
    let circuitOpen = false;
    let wasCancelled = false;
    const startedAt = Date.now();

    while (offset < totalMeters && !shutdown && !circuitOpen) {
        // Check DB cancel flag
        const jobState = await dbGetSyncJob(jobId);
        if (jobState?.status === 'cancelled') {
            console.log('[Worker] Job was cancelled via UI/API. Stopping.');
            wasCancelled = true;
            break;
        }

        const chunk = await dbGetBulkMetersSyncChunk(offset, chunkSize, filters);
        if (!chunk || chunk.length === 0) break;

        const elapsed = Date.now() - startedAt;
        const processedSoFar = syncedOk + syncedError;
        const eta = calcEta(processedSoFar, totalMeters - startOffset, elapsed);
        const pct = totalMeters > 0 ? Math.round(((offset) / totalMeters) * 100) : 0;
        const rate = elapsed > 0 ? Math.round((processedSoFar / elapsed) * 1000) : 0;

        console.log(
            `[Worker] Processing offset ${offset.toLocaleString()} / ${totalMeters.toLocaleString()} (${pct}%) ` +
            `| ✅ ${syncedOk} ❌ ${syncedError} ` +
            `| ${rate} m/s ` +
            `| ETA: ${eta ? formatDuration(eta.getTime() - Date.now()) : '...'}`
        );

        // Process chunk with concurrency
        for (let i = 0; i < chunk.length; i += concurrency) {
            if (shutdown || circuitOpen) break;
            const batch = chunk.slice(i, i + concurrency);

            const batchResults = await Promise.allSettled(
                batch.map(async (meter) => {
                    const ep = await checkAawsaPaidStatus({
                        customerKey: meter.customerKeyNumber,
                        contractNo: meter.contractNumber || undefined,
                        networkMode: (process.env.AAWSA_NETWORK_MODE as any) || 'auto',
                        batchMode: true,
                    });
                    if (!ep.success) throw new Error(ep.error || 'Endpoint error');
                    if (!dryRun) {
                        await dbSyncCustomerPaymentAndReading({
                            customerKey: meter.customerKeyNumber,
                            contractNo: meter.contractNumber || undefined,
                            customerName: ep.customerName,
                            branch: ep.branch,
                            billKey: ep.billKey,
                            paymentStatus: ep.paymentStatus,
                            billedPeriod: ep.billedPeriod,
                            amountPaid: ep.amountPaid ?? ep.totalBillAmount,
                            paymentDate: ep.paymentDate,
                            paymentChannel: ep.paymentChannel,
                            bankRef: ep.bankRef || ep.billKey,
                            reconciliationStatus: 'Reconciled',
                            syncSource: 'AAWSA_BULK_WORKER_CLI',
                        });
                    }
                    return { ok: true, key: meter.customerKeyNumber };
                })
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    syncedOk++;
                    consecutiveTimeouts = 0;
                } else {
                    syncedError++;
                    const errMsg = (result as PromiseRejectedResult).reason?.message || '';
                    if (isTimeoutError(errMsg)) {
                        consecutiveTimeouts++;
                        if (consecutiveTimeouts >= CIRCUIT_BREAKER_THRESHOLD) {
                            circuitOpen = true;
                            console.error(`[Worker] ⚡ Circuit breaker tripped after ${consecutiveTimeouts} consecutive timeouts. AAWSA endpoint unreachable. Stopping.`);
                        }
                    } else {
                        consecutiveTimeouts = 0;
                    }
                }
            }
        }

        offset += chunk.length;

        // Save checkpoint progress after every chunk
        const etaDate = calcEta(syncedOk + syncedError, totalMeters - startOffset, Date.now() - startedAt);
        await dbUpdateSyncJobProgress(jobId, syncedOk, syncedError, offset, etaDate);
    }

    // ─── Finalize Job ────────────────────────────────────────────────────────
    const totalElapsed = Date.now() - startedAt;
    const finalStatus: 'done' | 'partial' | 'error' | 'cancelled' = wasCancelled ? 'cancelled'
        : circuitOpen ? 'error'
        : shutdown ? 'partial'
        : offset >= totalMeters ? 'done'
        : 'partial';

    await dbUpdateSyncJob(jobId, {
        status: finalStatus,
        syncedOk,
        syncedError,
        summary: {
            totalMeters,
            syncedOk,
            syncedError,
            finalOffset: offset,
            dryRun,
            elapsedMs: totalElapsed,
            elapsedFormatted: formatDuration(totalElapsed),
            circuitBroken: circuitOpen,
            stoppedBySignal: shutdown,
            cancelled: wasCancelled,
        },
        error: wasCancelled ? 'Job cancelled by user or API request.' : circuitOpen ? 'Circuit breaker tripped — AAWSA endpoint became unreachable mid-sync.' : null,
    });

    console.log('───────────────────────────────────────────────────────────');
    console.log(`[Worker] COMPLETE — Status: ${finalStatus.toUpperCase()}`);
    console.log(`[Worker] ✅ Synced OK : ${syncedOk.toLocaleString()}`);
    console.log(`[Worker] ❌ Errors    : ${syncedError.toLocaleString()}`);
    console.log(`[Worker] ⏱ Duration  : ${formatDuration(totalElapsed)}`);
    console.log(`[Worker] Job ID      : ${jobId}`);
    if (finalStatus === 'partial') {
        console.log(`[Worker] 💡 Resume with: npx ts-node src/scripts/bulk-sync-worker.ts --resume ${jobId}`);
    }
    console.log('═══════════════════════════════════════════════════════════');

    process.exit(finalStatus === 'done' || finalStatus === 'partial' ? 0 : 1);
}

main().catch((err) => {
    console.error('[Worker] Fatal error:', err);
    process.exit(1);
});
