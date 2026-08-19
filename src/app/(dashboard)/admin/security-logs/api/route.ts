import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { dbGetAllSecurityLogs, dbGetUserSessions, dbGetSessionSummary } from '@/lib/db-queries';
import { getSession } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session || !session.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const perms: string[] = session.permissions || [];
        const isManagement = perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL);
        const hasPerm = isManagement || perms.includes(PERMISSIONS.SETTINGS_VIEW);

        if (!hasPerm) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
        const view = searchParams.get('view') || 'logs';

        // Branch isolation: If not management, filter by branch_name.
        const filterBranchName = isManagement ? undefined : session.branchName;

        // Session monitoring views require the manage permission (the page and
        // sidebar already gate on SETTINGS_MANAGE — keep the API consistent).
        if (view === 'sessions' || view === 'summary') {
            if (!perms.includes(PERMISSIONS.SETTINGS_MANAGE)) {
                return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
            }

            if (view === 'summary') {
                const summary = await dbGetSessionSummary(filterBranchName);
                return NextResponse.json({ summary });
            }

            const type = (searchParams.get('type') || undefined) as 'staff' | 'customer' | undefined;
            const status = searchParams.get('status') || undefined;
            const branch = searchParams.get('branch') || undefined;
            const search = searchParams.get('search') || undefined;

            const { sessions, total, lastPage } = await dbGetUserSessions({
                page,
                pageSize,
                type,
                status,
                branchName: filterBranchName,
                branch,
                search,
            });

            return NextResponse.json({
                sessions,
                total,
                page,
                pageSize,
                lastPage,
            });
        }

        const sortBy = searchParams.get('sortBy') || 'created_at';
        const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

        const { logs, total, lastPage } = await dbGetAllSecurityLogs(page, pageSize, sortBy, sortOrder, filterBranchName);

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
