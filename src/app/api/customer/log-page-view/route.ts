import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { logCustomerPageViewAction } from '@/lib/actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, pageName, path, label } = body;

        if (!sessionId || !pageName) {
            return NextResponse.json(
                { error: 'sessionId and pageName are required' },
                { status: 400 }
            );
        }

        // pageName is the human-readable label; path (the actual route) is
        // optional and falls back to pageName for legacy callers.
        await logCustomerPageViewAction(sessionId, label || pageName, path || pageName);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error logging page view:', error);
        return NextResponse.json(
            { error: 'Failed to log page view' },
            { status: 500 }
        );
    }
}
