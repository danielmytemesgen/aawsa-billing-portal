import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/billing/job-status?jobId=<id>
// Returns the current state of a billing job for progress polling.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId query parameter required' }, { status: 400 });
  }

  const rows: any[] = await query('SELECT * FROM billing_jobs WHERE id = $1', [jobId]);
  if (!rows[0]) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Permission check: User must have either bill:manage_all or billing:close_cycle permission
  // or must have created the job themselves.
  const hasViewAllPerm = session.permissions?.some((p: string) => 
    p === 'bill:manage_all' || p === 'billing:close_cycle'
  );
  const createdByThisUser = rows[0].created_by === session.id;
  
  if (!hasViewAllPerm && !createdByThisUser) {
    return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
  }

  return NextResponse.json({ job: rows[0] });
}
