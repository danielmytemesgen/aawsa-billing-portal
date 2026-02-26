"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { SecurityLog } from '@/types/db';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, LogOut, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogDetails } from '@/components/audit-log-details';

interface SecurityLogsResponse {
    logs: SecurityLog[];
    total: number;
    page: number;
    pageSize: number;
    lastPage: number;
}

interface CustomerSession {
    id: string;
    customer_key_number: string;
    customer_type: string;
    ip_address: string;
    device_name: string;
    location: string;
    is_revoked: boolean;
    pages_viewed: string[];
    last_active_at: string;
    created_at: string;
}

export default function SecurityLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [lastPage, setLastPage] = useState(1);
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [sessions, setSessions] = useState<CustomerSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    useEffect(() => {
        const page = parseInt(searchParams?.get('page') || '1', 10);
        const size = parseInt(searchParams?.get('pageSize') || '10', 10);
        const sort = searchParams?.get('sortBy') || 'created_at';
        const order = (searchParams?.get('sortOrder') as 'asc' | 'desc') || 'desc';

        setCurrentPage(page);
        setPageSize(size);
        setSortBy(sort);
        setSortOrder(order);

        fetchSecurityLogs(page, size, sort, order);
    }, [searchParams]);

    const fetchSecurityLogs = async (page: number, pageSize: number, sortBy: string, sortOrder: 'asc' | 'desc') => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `/admin/security-logs/api?page=${page}&pageSize=${pageSize}&sortBy=${sortBy}&sortOrder=${sortOrder}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: SecurityLogsResponse = await response.json();
            setLogs(data.logs);
            setTotalLogs(data.total);
            setLastPage(data.lastPage);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomerSessions = async () => {
        setSessionsLoading(true);
        try {
            const { getActiveCustomerSessionsAction } = await import('@/lib/actions');
            const { data } = await getActiveCustomerSessionsAction();
            setSessions(data || []);
        } catch (e) {
            console.error('Failed to fetch sessions', e);
        } finally {
            setSessionsLoading(false);
        }
    };

    const handleKickOut = async (sessionId: string) => {
        try {
            const { revokeCustomerSessionAction } = await import('@/lib/actions');
            await revokeCustomerSessionAction(sessionId);
            fetchCustomerSessions(); // Refresh the list
        } catch (e) {
            console.error('Failed to revoke session', e);
        }
    };

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('page', newPage.toString());
        router.push(`/admin/security-logs?${params.toString()}`);
    };

    const handlePageSizeChange = (newSize: number) => {
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('pageSize', newSize.toString());
        params.set('page', '1'); // Reset to first page when page size changes
        router.push(`/admin/security-logs?${params.toString()}`);
    };

    const handleSort = (column: string) => {
        const params = new URLSearchParams(searchParams?.toString() || '');
        let newSortOrder: 'asc' | 'desc' = 'asc';
        if (sortBy === column) {
            newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        }
        params.set('sortBy', column);
        params.set('sortOrder', newSortOrder);
        router.push(`/admin/security-logs?${params.toString()}`);
    };

    const getSortIndicator = (column: string) => {
        if (sortBy === column) {
            return sortOrder === 'asc' ? ' 🔼' : ' 🔽';
        }
        return '';
    };

    const downloadCsv = (csvContent: string, filename: string) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const escapeCsvField = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    };

    const exportSecurityLogs = async () => {
        try {
            // Fetch all logs (not just current page) for full export
            const response = await fetch(
                `/admin/security-logs/api?page=1&pageSize=10000&sortBy=${sortBy}&sortOrder=${sortOrder}`
            );
            if (!response.ok) throw new Error('Failed to fetch logs');
            const data: SecurityLogsResponse = await response.json();
            const allLogs = data.logs;

            const headers = ['Timestamp', 'Event Type', 'Staff Email', 'Customer Key', 'IP Address', 'Branch Name', 'Severity', 'Details'];
            const rows = allLogs.map(log => [
                format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
                log.event || '',
                log.staff_email || '',
                (log as any).customer_key_number || '',
                log.ip_address || '',
                log.branch_name || '',
                log.severity || 'Info',
                log.details ? JSON.stringify(log.details) : '',
            ].map(v => escapeCsvField(String(v))));

            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            downloadCsv(csv, `security_logs_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`);
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    const exportCustomerSessions = () => {
        const headers = ['Customer Key', 'Type', 'IP Address', 'Device', 'Location', 'Pages Viewed', 'Last Active', 'Created At'];
        const rows = sessions.map(s => [
            s.customer_key_number || '',
            s.customer_type || '',
            s.ip_address || '',
            s.device_name || '',
            s.location || '',
            (s.pages_viewed || []).join('; '),
            format(new Date(s.last_active_at), 'yyyy-MM-dd HH:mm:ss'),
            format(new Date(s.created_at), 'yyyy-MM-dd HH:mm:ss'),
        ].map(v => escapeCsvField(String(v))));

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadCsv(csv, `customer_sessions_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`);
    };

    if (loading) return <div className="p-4">Loading security logs...</div>;
    if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Security Log Entries</h1>

            <Tabs defaultValue="logs" className="w-full">
                <TabsList>
                    <TabsTrigger value="logs">Security Logs</TabsTrigger>
                    <TabsTrigger value="sessions" onClick={() => fetchCustomerSessions()}>
                        Customer Sessions
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="logs">
                    <div className="flex justify-end mb-3">
                        <Button variant="outline" size="sm" onClick={exportSecurityLogs} className="gap-2">
                            <Download className="h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('created_at')}>
                                        Timestamp {getSortIndicator('created_at')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('event')}>
                                        Event Type {getSortIndicator('event')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('staff_email')}>
                                        Staff Email {getSortIndicator('staff_email')}
                                    </TableHead>
                                    <TableHead>Customer Key</TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('ip_address')}>
                                        IP Address {getSortIndicator('ip_address')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('branch_name')}>
                                        Branch Name {getSortIndicator('branch_name')}
                                    </TableHead>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length > 0 ? (
                                    logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                                            <TableCell>{log.event}</TableCell>
                                            <TableCell>{log.staff_email || 'N/A'}</TableCell>
                                            <TableCell>{(log as any).customer_key_number || 'N/A'}</TableCell>
                                            <TableCell>{log.ip_address || 'N/A'}</TableCell>
                                            <TableCell>{log.branch_name || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Badge variant={log.severity === 'Critical' ? 'destructive' : log.severity === 'Warning' ? 'secondary' : 'default'} className={log.severity === 'Warning' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}>
                                                    {log.severity || 'Info'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4 mr-1" /> View</Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                                        <DialogHeader className="sr-only">
                                                            <DialogTitle>Audit Log Details</DialogTitle>
                                                            <DialogDescription>
                                                                Detailed comparison of changes for security event: {log.event}
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <AuditLogDetails log={log} />
                                                        <div className="flex justify-end pt-4 border-t mt-6">
                                                            <DialogTrigger asChild>
                                                                <Button variant="outline" className="bg-muted px-8">Close</Button>
                                                            </DialogTrigger>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            No security logs found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <TablePagination
                        page={currentPage - 1} // Convert 1-based to 0-based
                        rowsPerPage={pageSize}
                        count={totalLogs}
                        onPageChange={(p) => handlePageChange(p + 1)} // Convert 0-based back to 1-based
                        onRowsPerPageChange={handlePageSizeChange}
                    />
                </TabsContent>

                <TabsContent value="sessions">
                    <div className="flex justify-end mb-3">
                        <Button variant="outline" size="sm" onClick={exportCustomerSessions} disabled={sessions.length === 0} className="gap-2">
                            <Download className="h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer Key</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Device</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Pages Viewed</TableHead>
                                    <TableHead>Last Active</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessionsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            Loading sessions...
                                        </TableCell>
                                    </TableRow>
                                ) : sessions.length > 0 ? (
                                    sessions.map((session) => {
                                        const pagesViewed = session.pages_viewed || [];

                                        return (
                                            <TableRow key={session.id}>
                                                <TableCell>{session.customer_key_number}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {session.customer_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{session.ip_address}</TableCell>
                                                <TableCell>{session.device_name}</TableCell>
                                                <TableCell>{session.location}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {pagesViewed.length > 0 ? (
                                                            pagesViewed.map((page, idx) => (
                                                                <Badge key={idx} variant="secondary" className="text-xs">
                                                                    {page}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">No pages viewed yet</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{format(new Date(session.last_active_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleKickOut(session.id)}
                                                    >
                                                        <LogOut className="h-4 w-4 mr-1" /> Kick Out
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            No active customer sessions found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}