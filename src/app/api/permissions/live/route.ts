import { NextRequest, NextResponse } from 'next/server';

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'aawsa-internal-secret-2026';

export async function GET(request: NextRequest) {
  const internalKey = request.headers.get('x-internal-key');
  if (internalKey !== INTERNAL_KEY) {
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
