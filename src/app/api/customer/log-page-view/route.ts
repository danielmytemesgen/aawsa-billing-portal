import { NextRequest, NextResponse } from 'next/server';
import { logCustomerPageViewAction } from '@/lib/actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, pageName } = body;

        if (!sessionId || !pageName) {
            return NextResponse.json(
                { error: 'sessionId and pageName are required' },
                { status: 400 }
            );
        }

        await logCustomerPageViewAction(sessionId, pageName);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error logging page view:', error);
        return NextResponse.json(
            { error: 'Failed to log page view' },
            { status: 500 }
        );
    }
}
