import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Public: returns only { status, timestamp } — safe for load balancer probes.
 * Internal (x-internal-key header): also returns memory stats, uptime, and DB latency.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let dbStatus = 'disconnected';
  let latencyMs = -1;

  // Determine if this is an internal monitoring call
  const INTERNAL_KEY = process.env.INTERNAL_API_KEY;
  const internalKey = request.headers.get('x-internal-key');
  const isInternal = !!(INTERNAL_KEY && internalKey && internalKey === INTERNAL_KEY);

  try {
    const res: any = await query('SELECT 1 as ping');
    if (res && res.length > 0) {
      dbStatus = 'connected';
      latencyMs = Date.now() - startTime;
    }
  } catch (err: any) {
    // Even on DB error, only expose detail to internal callers
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        ...(isInternal
          ? {
              database: {
                status: 'error',
                error: err?.message || 'Database ping failed',
              },
            }
          : { database: { status: 'error' } }),
      },
      { status: 503 }
    );
  }

  const memory = process.memoryUsage();

  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      // Sensitive details only exposed to internal monitoring callers
      ...(isInternal
        ? {
            uptimeSeconds: Math.floor(process.uptime()),
            database: {
              status: dbStatus,
              latencyMs,
            },
            memory: {
              rssMb: Math.round(memory.rss / (1024 * 1024)),
              heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
              heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
            },
          }
        : { database: { status: dbStatus } }),
    },
    { status: 200 }
  );
}
