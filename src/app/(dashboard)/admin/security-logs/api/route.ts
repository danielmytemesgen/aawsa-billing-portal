import { NextResponse } from 'next/server';
import { dbGetAllSecurityLogs } from '@/lib/db-queries';
import { getSession } from '@/lib/auth';
import { isManagementRole, PERMISSIONS } from '@/lib/constants/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session || !session.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const role = session.role?.toLowerCase()?.trim();
        const perms: string[] = session.permissions || [];
        const isManagement = perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL) || isManagementRole(role);
        const hasPerm = isManagement || perms.includes('settings_view');

        if (!hasPerm) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
        const sortBy = searchParams.get('sortBy') || 'created_at';
        const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

        // Branch isolation: If not management, filter by branch_name
        const filterBranchName = isManagement ? undefined : session.branchName;

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
