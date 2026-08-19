import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { env } from '@/lib/env';
import { dbIsStaffSessionActive } from '@/lib/db-queries';

const INTERNAL_KEY_HEADER = 'x-internal-key';

/**
 * Internal endpoint used by middleware/proxy (Edge runtime, no pg access) to
 * learn whether a staff session was kicked out. The sessionId comes from the
 * JWT payload, and the row state is the source of truth.
 *
 * Access is gated by a shared-secret header (`x-internal-key`, matching
 * INTERNAL_API_KEY) so only trusted callers (middleware/proxy) can probe it.
 * The endpoint fails CLOSED on a missing/wrong key (probes get 401), but
 * fails OPEN on DB errors so a broken status endpoint never locks everyone out.
 */
export async function GET(request: NextRequest) {
    try {
        const provided = request.headers.get(INTERNAL_KEY_HEADER);
        if (!provided || provided !== env.INTERNAL_API_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sessionId = request.nextUrl.searchParams.get('sessionId');
        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        const active = await dbIsStaffSessionActive(sessionId);
        return NextResponse.json({ revoked: !active });
    } catch (error) {
        console.error('Error checking session revocation status:', error);
        return NextResponse.json({ revoked: false });
    }
}
