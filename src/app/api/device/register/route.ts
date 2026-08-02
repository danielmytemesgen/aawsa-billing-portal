import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const deviceName = (body && body.name) ? String(body.name).slice(0, 255) : 'Unnamed device';

    // Generate raw token and store hash
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenSalt = crypto.randomBytes(16).toString('hex');
    const hmac = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'fallback-secret');
    hmac.update(rawToken + tokenSalt);
    const tokenHash = hmac.digest('hex');

    // Persist device token HMAC and salt in DB and return the row id
    const rows = await query(
      'INSERT INTO device_tokens (user_id, token_hash, token_salt, device_name) VALUES ($1, $2, $3, $4) RETURNING id',
      [session.id, tokenHash, tokenSalt, deviceName]
    );

    const inserted = rows && rows[0];
    const deviceId = inserted ? inserted.id : null;

    // audit metric
    try { await query('INSERT INTO offline_sync_metrics (event, details) VALUES ($1, $2)', ['device.register', JSON.stringify({ userId: session.id, deviceId })]); } catch (e) { }

    return NextResponse.json({ success: true, token: rawToken, deviceId });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
