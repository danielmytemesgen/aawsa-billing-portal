"use client";

import * as React from 'react';
import { format } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Download, Eye, LogOut, RotateCcw, Search, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserSession, SessionSummary } from '@/types/db';
import {
    formatDuration,
    pageViewLabel,
    pageViewPath,
    pageViewTime,
} from '@/lib/session-monitoring';

interface UserSessionsResponse {
    sessions: UserSession[];
    total: number;
    page: number;
    pageSize: number;
    lastPage: number;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700' },
    logout: { label: 'Logged out', className: 'bg-gray-100 text-gray-600' },
    logged_out: { label: 'Logged out', className: 'bg-gray-100 text-gray-600' },
    idle_timeout: { label: 'Idle timeout', className: 'bg-amber-100 text-amber-700' },
    expired: { label: 'Expired', className: 'bg-amber-100 text-amber-700' },
    revoked: { label: 'Revoked', className: 'bg-red-100 text-red-700' },
};

const fmt = (value: string | null | undefined): string => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : format(d, 'yyyy-MM-dd HH:mm:ss');
};

export function UserSessionsTab() {
    const { toast } = useToast();
    const [sessions, setSessions] = React.useState<UserSession[]>([]);
    const [total, setTotal] = React.useState(0);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(10);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [summary, setSummary] = React.useState<SessionSummary | null>(null);

    const [type, setType] = React.useState<string>('');
    const [status, setStatus] = React.useState<string>('');
    const [branch, setBranch] = React.useState('');
    const [searchInput, setSearchInput] = React.useState('');
    const [searchApplied, setSearchApplied] = React.useState('');

    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    view: 'sessions',
                    page: String(currentPage),
                    pageSize: String(pageSize),
                });
                if (type) params.set('type', type);
                if (status) params.set('status', status);
                if (branch) params.set('branch', branch);
                if (searchApplied) params.set('search', searchApplied);

                const [sessionsRes, summaryRes] = await Promise.all([
                    fetch(`/admin/security-logs/api?${params.toString()}`),
                    fetch('/admin/security-logs/api?view=summary'),
                ]);
                if (!sessionsRes.ok || !summaryRes.ok) {
                    throw new Error(`HTTP error: ${sessionsRes.status} / ${summaryRes.status}`);
                }
                const data: UserSessionsResponse = await sessionsRes.json();
                const summaryData: { summary: SessionSummary } = await summaryRes.json();
                if (cancelled) return;
                setSessions(data.sessions);
                setTotal(data.total);
                setSummary(summaryData.summary);
            } catch (e: any) {
                if (!cancelled) setError(e.message || 'Failed to load sessions');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [currentPage, pageSize, type, status, branch, searchApplied, refreshKey]);

    const applySearch = () => {
        setSearchApplied(searchInput.trim());
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setType('');
        setStatus('');
        setBranch('');
        setSearchInput('');
        setSearchApplied('');
        setCurrentPage(1);
    };

    const handleKickOut = async (session: UserSession) => {
        const name = session.user_type === 'staff' ? session.user_identifier : `customer ${session.user_identifier}`;
        if (!window.confirm(`Kick out ${name}? Their session will be ended immediately.`)) return;
        try {
            const { revokeUserSessionAction } = await import('@/lib/actions');
            const res: any = await revokeUserSessionAction(session.user_type, session.id);
            if (!res?.success) {
                toast({ variant: 'destructive', title: 'Kick-out failed', description: res?.error?.message || 'Could not end this session.' });
                return;
            }
            setRefreshKey(k => k + 1);
            toast({ title: 'Session ended', description: `${name} was kicked out — their next action will be blocked.` });
        } catch (e) {
            console.error('Failed to revoke session:', e);
            const msg = e instanceof Error && e.message ? e.message : 'Network error — please retry.';
            toast({ variant: 'destructive', title: 'Kick-out failed', description: msg });
        }
    };

    const handleReactivate = async (session: UserSession) => {
        const name = session.user_type === 'staff' ? session.user_identifier : `customer ${session.user_identifier}`;
        const isStaff = session.user_type === 'staff';
        if (!window.confirm(
            isStaff
                ? `Reactivate ${name}'s ended session? It will show as active again (the user may still need to sign in, since their login was cleared).`
                : `Reactivate customer ${name}'s ended session? It will show as active again.`
        )) return;
        try {
            const { reactivateUserSessionAction } = await import('@/lib/actions');
            const res: any = await reactivateUserSessionAction(session.user_type, session.id);
            if (!res?.success) {
                toast({ variant: 'destructive', title: 'Reactivation failed', description: res?.error?.message || 'Could not reactivate this session.' });
                return;
            }
            setRefreshKey(k => k + 1);
            toast({ title: 'Session reactivated', description: `${name}'s session is active again.` });
        } catch (e) {
            console.error('Failed to reactivate session:', e);
            const msg = e instanceof Error && e.message ? e.message : 'Network error — please retry.';
            toast({ variant: 'destructive', title: 'Reactivation failed', description: msg });
        }
    };

    const exportCsv = async () => {
        try {
            const params = new URLSearchParams({ view: 'sessions', page: '1', pageSize: '10000' });
            if (type) params.set('type', type);
            if (status) params.set('status', status);
            if (branch) params.set('branch', branch);
            if (searchApplied) params.set('search', searchApplied);

            const response = await fetch(`/admin/security-logs/api?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch sessions');
            const data: UserSessionsResponse = await response.json();

            const headers = ['Type', 'User', 'Role', 'Branch', 'Login Time', 'Logout Time', 'Duration', 'Status', 'Pages Viewed', 'IP Address', 'Device', 'User Agent', 'Location'];
            const escape = (v: string) =>
                v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;

            const rows = data.sessions.map(s => [
                s.user_type,
                s.user_identifier,
                s.role_name || s.customer_type || '',
                s.branch_name || '',
                fmt(s.login_time),
                fmt(s.logout_time),
                formatDuration(s.duration_seconds),
                STATUS_META[s.status]?.label || s.status,
                (s.pages_viewed || []).map(pageViewLabel).join('; '),
                s.ip_address || '',
                s.device_name || '',
                s.user_agent || '',
                s.location || '',
            ].map(v => escape(String(v))));

            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `user_sessions_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    const summaryCards = [
        { label: 'Active Now', value: String(summary?.active_count ?? '—'), cardClass: 'bg-emerald-50 border-emerald-200', valueClass: 'text-emerald-700' },
        { label: 'Logins Today', value: String(summary?.today_count ?? '—'), cardClass: 'bg-blue-50 border-blue-200', valueClass: 'text-blue-700' },
        { label: 'Avg Session Duration', value: formatDuration(summary?.avg_duration_seconds ?? null), cardClass: 'bg-amber-50 border-amber-200', valueClass: 'text-amber-700' },
        { label: 'Total Sessions', value: String(summary?.total_count ?? '—'), cardClass: 'bg-violet-50 border-violet-200', valueClass: 'text-violet-700' },
    ];

    return (
        <div>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {summaryCards.map(card => (
                    <div key={card.label} className={`rounded-lg border p-4 shadow-sm ${card.cardClass}`}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${card.valueClass}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 mb-3">
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <Select value={type} onValueChange={(v) => { setType(v === 'all' ? '' : v); setCurrentPage(1); }}>
                        <SelectTrigger className="h-9 w-36">
                            <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All types</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setCurrentPage(1); }}>
                        <SelectTrigger className="h-9 w-40">
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="logout">Logged out</SelectItem>
                            <SelectItem value="idle_timeout">Idle timeout</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="revoked">Revoked</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Branch</Label>
                    <Input
                        className="h-9 w-44"
                        placeholder="Filter by branch…"
                        value={branch}
                        onChange={(e) => { setBranch(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Search user</Label>
                    <div className="flex gap-1">
                        <Input
                            className="h-9 w-48"
                            placeholder="Email or customer key…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
                        />
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={applySearch}>
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                {(type || status || branch || searchApplied) && (
                    <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
                        Reset filters
                    </Button>
                )}
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800">
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {error && <div className="p-4 text-red-500">Error: {error}</div>}

            <div className="rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-100/90">
                        <TableRow className="odd:bg-white even:bg-slate-50/60">
                            <TableHead>User</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Login Time</TableHead>
                            <TableHead>Logout Time</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Pages Viewed</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>Device</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={11} className="h-24 text-center">
                                    Loading sessions…
                                </TableCell>
                            </TableRow>
                        ) : sessions.length > 0 ? (
                            sessions.map((session) => {
                                const pages = session.pages_viewed || [];
                                const statusMeta = STATUS_META[session.status] || { label: session.status, className: 'bg-gray-100 text-gray-600' };
                                return (
                                    <TableRow key={`${session.user_type}-${session.id}`} className="odd:bg-white even:bg-slate-50/60">
                                        <TableCell className="font-medium max-w-[220px] truncate" title={session.user_identifier}>
                                            {session.user_identifier}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={session.user_type === 'staff' ? 'default' : 'outline'}>
                                                {session.user_type === 'staff' ? 'Staff' : 'Customer'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{session.branch_name || 'N/A'}</TableCell>
                                        <TableCell>{fmt(session.login_time)}</TableCell>
                                        <TableCell>{fmt(session.logout_time)}</TableCell>
                                        <TableCell>{formatDuration(session.duration_seconds)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                                                {pages.length > 0 ? (
                                                    pages.slice(0, 3).map((page, idx) => (
                                                        <Badge key={idx} variant="secondary" className="text-xs">
                                                            {pageViewLabel(page)}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-400 text-xs">None</span>
                                                )}
                                                {pages.length > 3 && (
                                                    <span className="text-xs text-muted-foreground">+{pages.length - 3} more</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{session.ip_address || 'N/A'}</TableCell>
                                        <TableCell>{session.device_name || 'N/A'}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}>
                                                {statusMeta.label}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4 mr-1" /> View</Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                                        <DialogHeader>
                                                            <DialogTitle className="flex items-center gap-2">
                                                                <UserCircle className="h-5 w-5" />
                                                                Session details — {session.user_identifier}
                                                            </DialogTitle>
                                                            <DialogDescription>
                                                                Full session activity for this {session.user_type} session.
                                                            </DialogDescription>
                                                        </DialogHeader>

                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Type</p>
                                                                <p className="font-medium capitalize">{session.user_type}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Role / Customer Type</p>
                                                                <p className="font-medium">{session.role_name || session.customer_type || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Branch</p>
                                                                <p className="font-medium">{session.branch_name || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Login Time</p>
                                                                <p>{fmt(session.login_time)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Logout Time</p>
                                                                <p>{fmt(session.logout_time)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Duration</p>
                                                                <p>{formatDuration(session.duration_seconds)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Status</p>
                                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}>
                                                                    {statusMeta.label}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">IP Address</p>
                                                                <p>{session.ip_address || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Device</p>
                                                                <p>{session.device_name || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Location</p>
                                                                <p>{session.location || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Last Active</p>
                                                                <p>{fmt(session.last_active_at)}</p>
                                                            </div>
                                                            {session.user_agent && (
                                                                <div className="col-span-2 md:col-span-3">
                                                                    <p className="text-xs text-muted-foreground">User Agent</p>
                                                                    <p className="break-all text-xs">{session.user_agent}</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="border-t pt-3">
                                                            <p className="text-sm font-medium mb-2">Page History ({pages.length})</p>
                                                            {pages.length > 0 ? (
                                                                <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                                                                    {pages.map((page, idx) => (
                                                                        <li key={idx} className="flex items-baseline justify-between gap-3 text-sm border-b pb-1.5 last:border-0">
                                                                            <div className="min-w-0">
                                                                                <p className="font-medium truncate">{pageViewLabel(page)}</p>
                                                                                {pageViewPath(page) && (
                                                                                    <p className="text-xs text-muted-foreground truncate">{pageViewPath(page)}</p>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                                                {pageViewTime(page) ? fmt(pageViewTime(page)) : '—'}
                                                                            </span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-sm text-muted-foreground">No pages viewed.</p>
                                                            )}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                                {session.status === 'active' ? (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleKickOut(session)}
                                                    >
                                                        <LogOut className="h-4 w-4 mr-1" /> Kick Out
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleReactivate(session)}
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-1" /> Reactivate
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={11} className="h-24 text-center">
                                    No sessions found{error ? '' : '.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <TablePagination
                page={currentPage - 1} // 0-based
                rowsPerPage={pageSize}
                count={total}
                onPageChange={(p) => setCurrentPage(p + 1)}
                onRowsPerPageChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            />
        </div>
    );
}
