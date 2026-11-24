import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import {
    dbGetAllSecurityLogs,
    dbGetUserSessions,
    dbGetSessionSummary,
    dbDeleteSecurityLog,
    dbDeleteMultipleSecurityLogs,
    dbPruneSecurityLogs,
    dbGetBlockedIps,
    dbBlockIp,
    dbUnblockIp
} from '@/lib/db-queries';
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

        // Blocked / Quarantined IPs view
        if (view === 'blocked_ips') {
            const blockedIps = await dbGetBlockedIps();
            return NextResponse.json({ blockedIps });
        }

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
        const search = searchParams.get('search') || undefined;
        const severity = searchParams.get('severity') || undefined;
        const dateRange = searchParams.get('dateRange') || undefined;

        const { logs, total, lastPage, summary } = await dbGetAllSecurityLogs(
            page,
            pageSize,
            sortBy,
            sortOrder,
            filterBranchName,
            search,
            severity,
            dateRange
        );

        return NextResponse.json({
            logs,
            total,
            page,
            pageSize,
            lastPage,
            summary,
        });
    } catch (error) {
        console.error('Error fetching security logs:', error);
        return NextResponse.json({ message: 'Error fetching security logs' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || !session.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const perms: string[] = session.permissions || [];
        const isManagement = perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL);
        const hasManagePerm = isManagement || perms.includes(PERMISSIONS.SETTINGS_MANAGE);

        if (!hasManagePerm) {
            return NextResponse.json({ message: 'Forbidden: Insufficient privileges' }, { status: 403 });
        }

        const body = await request.json();
        const { ip, reason } = body;

        if (!ip) {
            return NextResponse.json({ message: 'IP address is required' }, { status: 400 });
        }

        const blockedBy = session.email || session.name || 'Security Admin';
        const blocked = await dbBlockIp(ip, reason || 'Quarantined from SIEM dashboard', blockedBy);
        return NextResponse.json({ success: true, message: `IP ${ip} has been added to the quarantine blocklist.`, blocked });
    } catch (error: any) {
        console.error('Error in security logs POST:', error);
        return NextResponse.json({ message: error?.message || 'Error processing request' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session || !session.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const perms: string[] = session.permissions || [];
        const isManagement = perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL);
        const hasManagePerm = isManagement || perms.includes(PERMISSIONS.SETTINGS_MANAGE);

        if (!hasManagePerm) {
            return NextResponse.json({ message: 'Forbidden: Insufficient privileges' }, { status: 403 });
        }

        const body = await request.json();
        const { id, ids, pruneDays, severity, unblockIp } = body;

        if (unblockIp) {
            await dbUnblockIp(unblockIp);
            return NextResponse.json({ success: true, message: `IP ${unblockIp} has been unblocked.` });
        }

        if (id) {
            await dbDeleteSecurityLog(id);
            return NextResponse.json({ success: true, message: 'Security log entry permanently deleted.' });
        }

        if (Array.isArray(ids) && ids.length > 0) {
            await dbDeleteMultipleSecurityLogs(ids);
            return NextResponse.json({ success: true, count: ids.length, message: `${ids.length} security log entries deleted.` });
        }

        if (pruneDays && typeof pruneDays === 'number') {
            const count = await dbPruneSecurityLogs(pruneDays, severity);
            return NextResponse.json({ success: true, count, message: `Pruned ${count} security log entries older than ${pruneDays} days.` });
        }

        return NextResponse.json({ message: 'Invalid deletion request parameters' }, { status: 400 });
    } catch (error: any) {
        console.error('Error deleting security log(s):', error);
        return NextResponse.json({ message: error?.message || 'Error deleting security log(s)' }, { status: 500 });
    }
}
