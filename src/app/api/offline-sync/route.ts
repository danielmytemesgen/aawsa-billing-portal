import { NextResponse } from 'next/server';
import { createIndividualCustomerReadingAction, createBulkMeterReadingAction } from '@/lib/actions';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized: Active session or valid device token required' }, { status: 401 });
    }

    const body = await request.json();
    const readings = Array.isArray(body.readings) ? body.readings : [];


    const results: Array<{ id?: string | number; localId?: string | number; serverId?: string; success: boolean; message?: string }> = [];

    for (const r of readings) {
      const localId = r.localId ?? r.id;
      const rawId = r.id;
      const idempotencyKey = r.idempotencyKey || (r.payload && r.payload.idempotencyKey);

      try {
        // Check idempotency
        if (idempotencyKey) {
          const rows = await query('SELECT server_id FROM idempotency_keys WHERE idempotency_key = $1', [idempotencyKey]);
          if (rows && rows[0] && rows[0].server_id) {
            results.push({ id: rawId ?? localId, localId, serverId: rows[0].server_id, success: true });
            continue;
          }
        }

        let created: any = null;
        if (r.type === 'individual') {
          created = await createIndividualCustomerReadingAction(r.payload as any);
        } else if (r.type === 'bulk') {
          created = await createBulkMeterReadingAction(r.payload as any);
        } else {
          results.push({ id: rawId ?? localId, localId, success: false, message: 'Unknown reading type' });
          continue;
        }

        const serverId = (created as any)?.id ?? (created && (created.data || created).id) ?? null;

        // persist idempotency mapping if provided
        if (idempotencyKey) {
          try {
            await query('INSERT INTO idempotency_keys (idempotency_key, local_id, server_id) VALUES ($1, $2, $3) ON CONFLICT (idempotency_key) DO NOTHING', [idempotencyKey, String(localId), serverId]);
          } catch (e) { /* ignore mapping failures */ }
        }

        const isSuccess = !!serverId || (created && created.success !== false && !created.error);
        results.push({ 
          id: rawId ?? localId, 
          localId, 
          serverId, 
          success: isSuccess, 
          message: (created as any)?.message || undefined 
        });
      } catch (err: any) {
        results.push({ id: rawId ?? localId, localId, success: false, message: err?.message || String(err) });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

