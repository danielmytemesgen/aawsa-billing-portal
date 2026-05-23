import { NextResponse } from 'next/server';
import { createIndividualCustomerReadingAction, createBulkMeterReadingAction } from '@/lib/actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const readings = Array.isArray(body.readings) ? body.readings : [];

    const results: Array<{ id?: number | string; success: boolean; message?: string }> = [];

    for (const r of readings) {
      try {
        if (r.type === 'individual') {
          const res = await createIndividualCustomerReadingAction(r.payload as any);
          // Server action may return created record or error object — normalize
          results.push({ id: (res as any)?.id ?? r.id, success: !!res, message: (res as any)?.message ?? undefined });
        } else if (r.type === 'bulk') {
          const res = await createBulkMeterReadingAction(r.payload as any);
          results.push({ id: (res as any)?.id ?? r.id, success: !!res, message: (res as any)?.message ?? undefined });
        } else {
          results.push({ id: r.id, success: false, message: 'Unknown reading type' });
        }
      } catch (err: any) {
        results.push({ id: r.id, success: false, message: err?.message || String(err) });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
