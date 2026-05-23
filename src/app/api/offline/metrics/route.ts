import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const event = body.event || 'unknown';
    const details = body.details || {};

    await query('INSERT INTO offline_sync_metrics (event, details) VALUES ($1, $2)', [event, JSON.stringify(details)]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
