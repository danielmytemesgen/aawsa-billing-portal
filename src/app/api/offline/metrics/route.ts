import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Authentication check - user must be authenticated
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const event = body.event || 'unknown';
    const details = body.details || {};

    await query('INSERT INTO offline_sync_metrics (event, details) VALUES ($1, $2)', [event, JSON.stringify(details)]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
