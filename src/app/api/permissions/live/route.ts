import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/permissions/live?staffId=<uuid>
 *
 * Internal endpoint: returns the live permission set for a staff member.
 * Requires the INTERNAL_API_KEY header (x-internal-key).
 *
 * Security: No hardcoded fallback — if INTERNAL_API_KEY is not configured
 * the server returns 500 to prevent accidental open access.
 */
export async function GET(request: NextRequest) {
  // Strict: require env var — no hardcoded fallback secret
  const INTERNAL_KEY = process.env.INTERNAL_API_KEY;
  if (!INTERNAL_KEY) {
    console.error('[permissions/live] INTERNAL_API_KEY is not configured. Rejecting request.');
    return NextResponse.json(
      { error: 'Server misconfiguration: INTERNAL_API_KEY is not set' },
      { status: 500 }
    );
  }

  const internalKey = request.headers.get('x-internal-key');
  if (!internalKey || internalKey !== INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const staffId = request.nextUrl.searchParams.get('staffId');
  if (!staffId) {
    return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
  }

  try {
    const { dbGetStaffPermissions } = await import('@/lib/db-queries');
    const permissions: string[] = await dbGetStaffPermissions(staffId);
    return NextResponse.json({ permissions }, { status: 200 });
  } catch (err) {
    console.error('[permissions/live] Failed to fetch live permissions:', err);
    return NextResponse.json({ permissions: [] }, { status: 200 });
  }
}
