import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // last 7 days counts by event
    const rows = await query(`SELECT event, COUNT(*) as cnt FROM offline_sync_metrics WHERE created_at > now() - interval '7 days' GROUP BY event ORDER BY cnt DESC`);
    return NextResponse.json({ success: true, rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
