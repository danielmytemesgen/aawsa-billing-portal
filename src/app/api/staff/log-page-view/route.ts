import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth';
import { dbLogStaffPageView } from '@/lib/db-queries';

/**
 * Fire-and-forget page-view tracker for staff/admin sessions.
 *
 * Auth is done INSIDE the route: middleware.ts / proxy.ts short-circuit all
 * /api/ paths before any session check, so there is no middleware gate. The
 * client sends nothing sensitive — sessionId is read from the httpOnly JWT
 * cookie via getSession().
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.sessionId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { path, label } = body;

        if (!path || !label) {
            return NextResponse.json(
                { error: 'path and label are required' },
                { status: 400 }
            );
        }

        await dbLogStaffPageView(session.sessionId, String(path), String(label));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error logging staff page view:', error);
        return NextResponse.json(
            { error: 'Failed to log page view' },
            { status: 500 }
        );
    }
}
