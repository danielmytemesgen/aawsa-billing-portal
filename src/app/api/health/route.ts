import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'disconnected';
  let latencyMs = -1;

  try {
    const res: any = await query('SELECT 1 as ping');
    if (res && res.length > 0) {
      dbStatus = 'connected';
      latencyMs = Date.now() - startTime;
    }
  } catch (err: any) {
    dbStatus = 'error';
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          status: 'error',
          error: err?.message || 'Database ping failed',
        },
      },
      { status: 503 }
    );
  }

  const memory = process.memoryUsage();

  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
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
    },
    { status: 200 }
  );
}
