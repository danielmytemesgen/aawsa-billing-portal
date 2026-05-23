import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { SignJWT } from 'jose';
import { env } from '@/lib/env';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawToken = (body && body.token) ? String(body.token) : null;
    if (!rawToken) return NextResponse.json({ success: false, message: 'token required' }, { status: 400 });

    // We need to compute HMAC using stored salt. First fetch salt by scanning matching token_hash by trying HMAC with known salts.
    // Simpler approach: fetch all devices and compare HMACs (reasonable if per-user scale small). Optimize if needed.
    const allDevices = await query('SELECT id, user_id, revoked_at, token_salt FROM device_tokens');
    let device: any = null;
    for (const d of allDevices) {
      try {
        const h = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'fallback-secret');
        h.update(rawToken + (d.token_salt || ''));
        const digest = h.digest('hex');
        if (digest === d.token_hash) { device = d; break; }
      } catch (e) { }
    }
    // device found above
    if (!device) return NextResponse.json({ success: false, message: 'invalid token' }, { status: 401 });
    if (device.revoked_at) return NextResponse.json({ success: false, message: 'token revoked' }, { status: 401 });

    // issue short-lived access token (15m)
    const key = new TextEncoder().encode(env.SESSION_SECRET);
    const jwt = await new SignJWT({ sub: device.user_id, deviceId: device.id, type: 'device' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(key);

    // update last_used_at and record metric
    await query('UPDATE device_tokens SET last_used_at = now() WHERE id = $1', [device.id]);
    try { await query('INSERT INTO offline_sync_metrics (event, details) VALUES ($1, $2)', ['device.refresh', JSON.stringify({ deviceId: device.id, userId: device.user_id })]); } catch (e) {}

    return NextResponse.json({ success: true, accessToken: jwt });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
