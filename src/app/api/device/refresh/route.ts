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

    // Fetch active device tokens with token_hash and token_salt
    const allDevices = await query(
      'SELECT id, user_id, revoked_at, token_salt, token_hash FROM device_tokens WHERE revoked_at IS NULL'
    );
    let device: any = null;
    for (const d of allDevices) {
      try {
        const h = crypto.createHmac('sha256', env.SESSION_SECRET);
        h.update(rawToken + (d.token_salt || ''));
        const digest = h.digest('hex');
        if (digest === d.token_hash) { device = d; break; }
      } catch (e) { }
    }

    if (!device) return NextResponse.json({ success: false, message: 'invalid token' }, { status: 401 });
    if (device.revoked_at) return NextResponse.json({ success: false, message: 'token revoked' }, { status: 401 });

    // Verify associated staff member is still active
    const staffRows = await query(
      `SELECT sm.id, sm.email, sm.name, sm.branch_id, sm.status,
              COALESCE(r.role_name, sm.role) as role_name,
              COALESCE(ARRAY_AGG(p.name) FILTER (WHERE p.name IS NOT NULL), ARRAY[]::text[]) as permissions
       FROM staff_members sm
       LEFT JOIN roles r ON sm.role_id = r.id
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE sm.id = $1
       GROUP BY sm.id, r.role_name`,
      [device.user_id]
    );

    const staffUser = staffRows && staffRows[0];
    if (!staffUser || staffUser.status !== 'Active') {
      return NextResponse.json({ success: false, message: 'User account is inactive or not found' }, { status: 401 });
    }

    // issue short-lived access token (2h) with user context
    const key = new TextEncoder().encode(env.SESSION_SECRET);
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const jwt = await new SignJWT({
      sub: staffUser.id,
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role_name,
      branchId: staffUser.branch_id,
      permissions: staffUser.permissions || [],
      deviceId: device.id,
      type: 'device',
      expires,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(key);

    // update last_used_at and record metric
    await query('UPDATE device_tokens SET last_used_at = now() WHERE id = $1', [device.id]);
    try {
      await query(
        'INSERT INTO offline_sync_metrics (event, details) VALUES ($1, $2)',
        ['device.refresh', JSON.stringify({ deviceId: device.id, userId: device.user_id })]
      );
    } catch (e) {}

    return NextResponse.json({
      success: true,
      accessToken: jwt,
      user: {
        id: staffUser.id,
        email: staffUser.email,
        name: staffUser.name,
        role: staffUser.role_name,
        branchId: staffUser.branch_id,
        permissions: staffUser.permissions || [],
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}

