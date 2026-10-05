import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dbGetSyncJob, dbEnsureSyncJobsTable } from '@/lib/db-queries';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/billing/sync-job-status?jobId=<id>
// Returns the current state of a payment sync job for real-time progress polling.
// ─────────────────────────────────────────────────────────────────────────────

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'd52e2cc3ace3a52a189ed2607f311da6';

export async function GET(request: Request) {
    const internalKey = request.headers.get('x-internal-key');
    const isInternalAuthorized = internalKey && internalKey === INTERNAL_KEY;
    const session = await getSession();

    if (!isInternalAuthorized && (!session || !session.id)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) {
        return NextResponse.json({ error: 'jobId query parameter required' }, { status: 400 });
    }

    try {
        await dbEnsureSyncJobsTable();
        const job = await dbGetSyncJob(jobId);
        if (!job) {
            return NextResponse.json({ error: 'Sync job not found' }, { status: 404 });
        }

        // Derive human-readable progress fields for UI
        const total = job.total_meters || 0;
        const done = (job.synced_ok || 0) + (job.synced_error || 0);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        let etaSeconds: number | null = null;
        if (job.estimated_completion_at) {
            etaSeconds = Math.max(0, Math.round(
                (new Date(job.estimated_completion_at).getTime() - Date.now()) / 1000
            ));
        }

        return NextResponse.json({
            job,
            progress: {
                pct,
                done,
                total,
                remaining: Math.max(0, total - done),
                etaSeconds,
            },
        });
    } catch (err: any) {
        console.error('[sync-job-status] Error:', err);
        return NextResponse.json({ error: err?.message || 'Failed to fetch job status' }, { status: 500 });
    }
}
