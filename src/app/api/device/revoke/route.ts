import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.id) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (body && body.all) {
      await query('UPDATE device_tokens SET revoked_at = now() WHERE user_id = $1', [session.id]);
      try { await query('INSERT INTO offline_sync_metrics (event, details) VALUES ($1, $2)', ['device.revoke_all', JSON.stringify({ userId: session.id })]); } catch (e) {}
      return NextResponse.json({ success: true });
    }

    const deviceId = body && body.deviceId ? String(body.deviceId) : null;
    if (!deviceId) return NextResponse.json({ success: false, message: 'deviceId required' }, { status: 400 });

    // ensure device belongs to user
    const rows = await query('SELECT id FROM device_tokens WHERE id = $1 AND user_id = $2', [deviceId, session.id]);
    if (!rows || !rows[0]) return NextResponse.json({ success: false, message: 'device not found' }, { status: 404 });

    await query('UPDATE device_tokens SET revoked_at = now() WHERE id = $1', [deviceId]);
    try { await query('INSERT INTO offline_sync_metrics (event, details) VALUES ($1, $2)', ['device.revoke', JSON.stringify({ userId: session.id, deviceId })]); } catch (e) {}
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
