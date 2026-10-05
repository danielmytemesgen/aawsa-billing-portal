import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { batchSyncAllBulkMetersAction } from '@/lib/actions';
import {
    dbGetLatestSyncJob,
    dbEnsureSyncJobsTable,
    dbTryAcquireSyncLock,
    dbReleaseSyncLock,
    dbCreateSyncJob,
    dbCountBulkMetersForSync,
    type SyncJobFilters,
} from '@/lib/db-queries';

export const dynamic = 'force-dynamic';
// Allow up to 5 minutes for the batch job to complete
export const maxDuration = 300;

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'd52e2cc3ace3a52a189ed2607f311da6';

// Module-level timestamp tracker for local process reporting
let syncInProgress = false;
let syncStartedAt: Date | null = null;

export async function POST(request: Request) {
    try {
        const internalKey = request.headers.get('x-internal-key');
        const session = await getSession();

        const isInternalAuthorized = internalKey && internalKey === INTERNAL_KEY;
        const isStaffAuthorized = session && session.id;

        if (!isInternalAuthorized && !isStaffAuthorized) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized. Valid staff session or x-internal-key header required.' },
                { status: 401 }
            );
        }

        // Distributed cluster-safe lock via database state
        const lockCheck = await dbTryAcquireSyncLock(5);
        if (!lockCheck.acquired) {
            return NextResponse.json(
                {
                    success: false,
                    busy: true,
                    message: 'A batch sync job is already in progress across cluster workers.',
                    startedAt: lockCheck.runningJob?.started_at || syncStartedAt || new Date(),
                    jobId: lockCheck.runningJob?.id || null,
                },
                { status: 409 }
            );
        }

        // Set process-level state
        syncInProgress = true;
        syncStartedAt = new Date();

        const body = await request.json().catch(() => ({}));
        const {
            concurrency = 20,
            dryRun = false,
            chunkSize = 500,
            // New filter fields for high-volume scoped sync
            unpaidOnly = false,
            branchId = null,
            monthYear = null,
        } = body;

        const triggeredBy = isInternalAuthorized ? 'cron' : (session?.id || 'manual');

        const filters: SyncJobFilters = {
            unpaidOnly: Boolean(unpaidOnly),
            branchId: branchId || null,
            monthYear: monthYear || null,
        };

        try {
            const result = await batchSyncAllBulkMetersAction({
                concurrency: Math.min(Math.max(Number(concurrency) || 20, 1), 30),
                chunkSize: Math.min(Math.max(Number(chunkSize) || 500, 50), 2000),
                dryRun: Boolean(dryRun),
                triggeredBy,
                skipPermissionCheck: Boolean(isInternalAuthorized),
                filters,
            });

            return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } finally {
            syncInProgress = false;
            syncStartedAt = null;
            await dbReleaseSyncLock();
        }
    } catch (error: any) {
        console.error('[POST /api/billing/batch-sync-bulk-meters]', error);
        syncInProgress = false;
        syncStartedAt = null;
        await dbReleaseSyncLock();
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/billing/batch-sync-bulk-meters
 * Returns the latest sync job status (for polling).
 */
export async function GET(request: Request) {
    try {
        const internalKey = request.headers.get('x-internal-key');
        const session = await getSession();

        if (!internalKey && !session?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await dbEnsureSyncJobsTable();
        const latest = await dbGetLatestSyncJob();

        const total = latest?.total_meters || 0;
        const done = (latest?.synced_ok || 0) + (latest?.synced_error || 0);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return NextResponse.json({
            success: true,
            job: latest,
            busy: Boolean(latest?.status === 'running' || syncInProgress),
            progress: { pct, done, total, remaining: Math.max(0, total - done) },
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
