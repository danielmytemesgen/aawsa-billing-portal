import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dbCancelSyncJob, dbEnsureSyncJobsTable } from '@/lib/db-queries';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/cancel-sync-job
// Body: { jobId: string }
// Marks a running sync job as cancelled so the worker stops on next chunk.
// ─────────────────────────────────────────────────────────────────────────────

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'd52e2cc3ace3a52a189ed2607f311da6';

export async function POST(request: Request) {
    const internalKey = request.headers.get('x-internal-key');
    const isInternalAuthorized = internalKey && internalKey === INTERNAL_KEY;

    const session = await getSession();
    const isStaffSession = session && session.id;

    if (!isInternalAuthorized && !isStaffSession) {
        return NextResponse.json({ error: 'Unauthorized: valid staff session or x-internal-key header required' }, { status: 401 });
    }

    if (!isInternalAuthorized && session?.id) {
        const { dbGetStaffPermissions } = await import('@/lib/db-queries');
        const dbPerms = await dbGetStaffPermissions(session.id);
        const perms = new Set([...(session.permissions || []), ...dbPerms]);
        const role = String(session.role || '').toLowerCase();

        const hasPerm =
            role === 'admin' ||
            role === 'super admin' ||
            perms.has('*') ||
            perms.has('all') ||
            perms.has('admin') ||
            perms.has('bill:manage_all') ||
            perms.has('bill:post') ||
            perms.has('billing:close_cycle') ||
            perms.has('bill:close_cycle');

        if (!hasPerm) {
            return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
        }
    }

    let jobId: string;
    try {
        const body = await request.json();
        jobId = body?.jobId;
        if (!jobId) throw new Error('missing jobId');
    } catch {
        return NextResponse.json({ error: 'Request body must include jobId' }, { status: 400 });
    }

    try {
        await dbEnsureSyncJobsTable();
        await dbCancelSyncJob(jobId);
        return NextResponse.json({ success: true, message: `Job ${jobId} cancelled` });
    } catch (err: any) {
        console.error('[cancel-sync-job] Error:', err);
        return NextResponse.json({ error: err?.message || 'Failed to cancel job' }, { status: 500 });
    }
}
