import { NextResponse } from 'next/server';
import { dbGetAllSecurityLogs } from '@/lib/db-queries';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
        const sortBy = searchParams.get('sortBy') || 'timestamp';
        const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

        const { logs, total, lastPage } = await dbGetAllSecurityLogs(page, pageSize, sortBy, sortOrder);

        return NextResponse.json({
            logs,
            total,
            page,
            pageSize,
            lastPage,
        });
    } catch (error) {
        console.error('Error fetching security logs:', error);
        return NextResponse.json({ message: 'Error fetching security logs' }, { status: 500 });
    }
}
