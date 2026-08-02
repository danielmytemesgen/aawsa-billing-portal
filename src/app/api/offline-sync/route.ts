import { NextResponse } from 'next/server';
import { createIndividualCustomerReadingAction, createBulkMeterReadingAction } from '@/lib/actions';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const readings = Array.isArray(body.readings) ? body.readings : [];

    const results: Array<{ localId?: string | number; serverId?: string; success: boolean; message?: string }> = [];

    for (const r of readings) {
      const localId = r.localId ?? r.id;
      const idempotencyKey = r.idempotencyKey || (r.payload && r.payload.idempotencyKey);

      try {
        // Check idempotency
        if (idempotencyKey) {
          const rows = await query('SELECT server_id FROM idempotency_keys WHERE idempotency_key = $1', [idempotencyKey]);
          if (rows && rows[0] && rows[0].server_id) {
            results.push({ localId, serverId: rows[0].server_id, success: true });
            continue;
          }
        }

        let created: any = null;
        if (r.type === 'individual') {
          created = await createIndividualCustomerReadingAction(r.payload as any);
        } else if (r.type === 'bulk') {
          created = await createBulkMeterReadingAction(r.payload as any);
        } else {
          results.push({ localId, success: false, message: 'Unknown reading type' });
          continue;
        }

        const serverId = (created as any)?.id ?? (created && (created.data || created).id) ?? null;

        // persist idempotency mapping if provided
        if (idempotencyKey) {
          try {
            await query('INSERT INTO idempotency_keys (idempotency_key, local_id, server_id) VALUES ($1, $2, $3) ON CONFLICT (idempotency_key) DO NOTHING', [idempotencyKey, String(localId), serverId]);
          } catch (e) { /* ignore mapping failures */ }
        }

        results.push({ localId, serverId, success: !!serverId, message: (created as any)?.message || undefined });
      } catch (err: any) {
        results.push({ localId, success: false, message: err?.message || String(err) });
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7788/ingest/11f0b13b-2903-4f1e-876b-3b02fed3705a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7b1771'},body:JSON.stringify({sessionId:'7b1771',runId:'pre-fix',hypothesisId:'A',location:'offline-sync/route.ts:results',message:'Offline sync API results',data:{inputCount:readings.length,results:results.map(r=>({localId:r.localId,success:r.success,serverId:r.serverId,message:r.message}))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
