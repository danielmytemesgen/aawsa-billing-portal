import { NextRequest, NextResponse } from 'next/server';
import { checkAndEscalateTickets } from '@/lib/escalation';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function handleSweep(req: NextRequest) {
  // Authorization check: either via CRON_SECRET / INTERNAL_API_KEY header or staff session
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_KEY;
  const authHeader = req.headers.get('authorization');
  const cronKeyHeader = req.headers.get('x-cron-key');

  let isAuthorized = false;

  if (cronSecret && (authHeader === `Bearer ${cronSecret}` || cronKeyHeader === cronSecret)) {
    isAuthorized = true;
  } else {
    // Check if called from an authenticated staff/admin session
    try {
      const session = await getSession(req);
      if (session && session.id) {
        isAuthorized = true;
      }
    } catch {
      // Not an authenticated session
    }
  }

  // If in development mode and no secret is configured, allow for local dev testing
  if (!isAuthorized && process.env.NODE_ENV !== 'production' && !cronSecret) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid staff session or CRON_SECRET header required.' },
      { status: 401 }
    );
  }

  try {
    const result = await checkAndEscalateTickets();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
      message: `SLA escalation sweep complete: ${result.escalatedCount} ticket(s) escalated.`
    });
  } catch (error) {
    console.error('API /api/support/escalation-sweep error:', error);
    return NextResponse.json(
      { error: 'Escalation sweep failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleSweep(req);
}

export async function POST(req: NextRequest) {
  return handleSweep(req);
}
