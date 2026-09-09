import { NextResponse } from 'next/server';
import { 
  createIndividualCustomerReadingAction, 
  createBulkMeterReadingAction,
  batchCreateIndividualCustomerReadingsAction,
  batchCreateBulkMeterReadingsAction
} from '@/lib/actions';
import { query, withTransaction } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized: Active session or valid device token required' }, { status: 401 });
    }

    const body = await request.json();
    const readings = Array.isArray(body.readings) ? body.readings : [];
    if (readings.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const results: Array<{ id?: string | number; localId?: string | number; serverId?: string; success: boolean; message?: string }> = [];

    // 1. Batch Idempotency Pre-check
    const idempotencyMap = new Map<string, string>();
    const allIdempotencyKeys = readings
      .map((r: any) => r.idempotencyKey || (r.payload && r.payload.idempotencyKey))
      .filter(Boolean);

    if (allIdempotencyKeys.length > 0) {
      try {
        const existingRows: any = await query(
          'SELECT idempotency_key, server_id FROM idempotency_keys WHERE idempotency_key = ANY($1)',
          [allIdempotencyKeys]
        );
        for (const row of existingRows) {
          if (row.idempotency_key && row.server_id) {
            idempotencyMap.set(row.idempotency_key, row.server_id);
          }
        }
      } catch (e) {
        console.warn('Idempotency pre-check query warning:', e);
      }
    }

    const remainingReadings: any[] = [];
    for (const r of readings) {
      const localId = r.localId ?? r.id;
      const rawId = r.id;
      const key = r.idempotencyKey || (r.payload && r.payload.idempotencyKey);

      if (key && idempotencyMap.has(key)) {
        results.push({
          id: rawId ?? localId,
          localId,
          serverId: idempotencyMap.get(key),
          success: true,
          message: 'Resolved via idempotency cache'
        });
      } else {
        remainingReadings.push(r);
      }
    }

    // 2. Process Remaining Readings
    const newIdempotencyEntries: Array<{ key: string; localId: string; serverId: string }> = [];

    // Separate into individual & bulk batches for items without photos/spatial, or process with single action
    for (const r of remainingReadings) {
      const localId = r.localId ?? r.id;
      const rawId = r.id;
      const idempotencyKey = r.idempotencyKey || (r.payload && r.payload.idempotencyKey);

      try {
        let created: any = null;
        const payload = r.payload || {};
        const spatialData = payload.capturedCoordinates || payload.spatialData;
        const meterPhoto = payload.meterPhoto || payload.meter_photo || payload.photoData;

        if (r.type === 'individual') {
          created = await createIndividualCustomerReadingAction(payload, spatialData, meterPhoto);
        } else if (r.type === 'bulk') {
          created = await createBulkMeterReadingAction(payload, spatialData, meterPhoto);
        } else {
          results.push({ id: rawId ?? localId, localId, success: false, message: 'Unknown reading type' });
          continue;
        }

        const serverId = (created as any)?.id ?? (created && (created.data || created).id) ?? null;
        const isSuccess = !!serverId || (created && created.success !== false && !created.error);

        if (isSuccess && idempotencyKey && serverId) {
          newIdempotencyEntries.push({ key: idempotencyKey, localId: String(localId), serverId: String(serverId) });
        }

        results.push({ 
          id: rawId ?? localId, 
          localId, 
          serverId: serverId ? String(serverId) : undefined, 
          success: isSuccess, 
          message: (created as any)?.message || undefined 
        });
      } catch (err: any) {
        results.push({ id: rawId ?? localId, localId, success: false, message: err?.message || String(err) });
      }
    }

    // 3. Batch insert new idempotency records
    if (newIdempotencyEntries.length > 0) {
      try {
        const placeholders = newIdempotencyEntries.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');
        const params: any[] = [];
        for (const entry of newIdempotencyEntries) {
          params.push(entry.key, entry.localId, entry.serverId);
        }
        await query(
          `INSERT INTO idempotency_keys (idempotency_key, local_id, server_id) VALUES ${placeholders} ON CONFLICT (idempotency_key) DO NOTHING`,
          params
        );
      } catch (e) {
        console.warn('Batch idempotency insert warning:', e);
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

