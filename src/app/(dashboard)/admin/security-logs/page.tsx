"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Eye,
    Download,
    AlertTriangle,
    ShieldAlert,
    ShieldCheck,
    Info,
    Search,
    RotateCw,
    X,
    Users,
    Building2,
    Activity,
    Layers,
    Filter,
    Clock,
    Trash2,
    CheckSquare,
    Loader2,
    Ban,
    ShieldOff
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogDetails } from '@/features/admin/components/audit-log-details';
import { UserSessionsTab } from './user-sessions-tab';

interface SecurityLogsSummary {
    total: number;
    critical_count: number;
    warning_count: number;
    info_count: number;
    staff_count: number;
    ip_count: number;
}

interface SecurityLogsResponse {
    logs: SecurityLog[];
    total: number;
    page: number;
    pageSize: number;
    lastPage: number;
    summary?: SecurityLogsSummary;
}

export default function SecurityLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { hasPermission } = usePermissions();
    const { toast } = useToast();

    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [lastPage, setLastPage] = useState(1);
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState('all');
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Deletion states
    const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
    const [logToDelete, setLogToDelete] = useState<SecurityLog | null>(null);
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
    const [isPruneDialogOpen, setIsPruneDialogOpen] = useState(false);
    const [pruneDays, setPruneDays] = useState(30);
    const [pruneSeverity, setPruneSeverity] = useState('all');
    const [isDeleting, setIsDeleting] = useState(false);

    // IP Quarantine states
    const [blockedIps, setBlockedIps] = useState<any[]>([]);
    const [loadingBlockedIps, setLoadingBlockedIps] = useState(false);
    const [ipToBlock, setIpToBlock] = useState<{ ip: string; reason: string } | null>(null);
    const [ipToUnblock, setIpToUnblock] = useState<string | null>(null);
    const [isManualBlockOpen, setIsManualBlockOpen] = useState(false);
    const [manualIp, setManualIp] = useState('');
    const [manualReason, setManualReason] = useState('');
    const [isProcessingBlock, setIsProcessingBlock] = useState(false);
    const [blockedIpSearch, setBlockedIpSearch] = useState('');

    // Live Metrics Summary
    const [summary, setSummary] = useState<SecurityLogsSummary>({
        total: 0,
        critical_count: 0,
        warning_count: 0,
        info_count: 0,
        staff_count: 0,
        ip_count: 0,
    });

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 350);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Read URL query params on mount
    useEffect(() => {
        const page = parseInt(searchParams?.get('page') || '1', 10);
        const size = parseInt(searchParams?.get('pageSize') || '10', 10);
        const sort = searchParams?.get('sortBy') || 'created_at';
        const order = (searchParams?.get('sortOrder') as 'asc' | 'desc') || 'desc';
        const q = searchParams?.get('search') || '';
        const sev = searchParams?.get('severity') || 'all';
        const range = searchParams?.get('dateRange') || 'all';

        setCurrentPage(page);
        setPageSize(size);
        setSortBy(sort);
        setSortOrder(order);
        if (q && q !== searchTerm) setSearchTerm(q);
        if (sev) setSeverityFilter(sev);
        if (range) setDateRangeFilter(range);
    }, [searchParams]);

    const fetchSecurityLogs = useCallback(async (
        page: number,
        size: number,
        sort: string,
        order: 'asc' | 'desc',
        search: string,
        severity: string,
        dateRange: string,
        isBackground: boolean = false
    ) => {
        if (!isBackground) setLoading(true);
        setIsRefreshing(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: size.toString(),
                sortBy: sort,
                sortOrder: order,
            });
            if (search.trim()) params.set('search', search.trim());
            if (severity && severity !== 'all') params.set('severity', severity);
            if (dateRange && dateRange !== 'all') params.set('dateRange', dateRange);

            const response = await fetch(`/admin/security-logs/api?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: SecurityLogsResponse = await response.json();
            setLogs(data.logs || []);
            setTotalLogs(data.total || 0);
            setLastPage(data.lastPage || 1);
            if (data.summary) {
                setSummary(data.summary);
            }
        } catch (e: any) {
            setError(e.message || 'Failed to fetch security logs');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Main fetch trigger on filter/page/sort change
    useEffect(() => {
        fetchSecurityLogs(
            currentPage,
            pageSize,
            sortBy,
            sortOrder,
            debouncedSearch,
            severityFilter,
            dateRangeFilter
        );
    }, [currentPage, pageSize, sortBy, sortOrder, debouncedSearch, severityFilter, dateRangeFilter, fetchSecurityLogs]);

    // Live Auto-Refresh polling (every 30 seconds when enabled)
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            fetchSecurityLogs(
                currentPage,
                pageSize,
                sortBy,
                sortOrder,
                debouncedSearch,
                severityFilter,
                dateRangeFilter,
                true
            );
        }, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, currentPage, pageSize, sortBy, sortOrder, debouncedSearch, severityFilter, dateRangeFilter, fetchSecurityLogs]);

    // Auto-refresh when DataRefreshProvider signals new data
    useEffect(() => {
        const handleDataRefreshed = () => {
            fetchSecurityLogs(
                currentPage,
                pageSize,
                sortBy,
                sortOrder,
                debouncedSearch,
                severityFilter,
                dateRangeFilter,
                true
            );
        };
        window.addEventListener('data-refreshed', handleDataRefreshed);
        return () => window.removeEventListener('data-refreshed', handleDataRefreshed);
    }, [currentPage, pageSize, sortBy, sortOrder, debouncedSearch, severityFilter, dateRangeFilter, fetchSecurityLogs]);

    if (!hasPermission('settings_manage')) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <UIAlertDescription>
                        You do not have permission to access the Security Logs.
                    </UIAlertDescription>
                </Alert>
            </div>
        );
    }

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('page', newPage.toString());
        router.push(`/admin/security-logs?${params.toString()}`);
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('pageSize', newSize.toString());
        params.set('page', '1');
        router.push(`/admin/security-logs?${params.toString()}`);
    };

    const handleSort = (column: string) => {
        let newSortOrder: 'asc' | 'desc' = 'asc';
        if (sortBy === column) {
            newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        }
        setSortBy(column);
        setSortOrder(newSortOrder);
        const params = new URLSearchParams(searchParams?.toString() || '');
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

    const handleClearFilters = () => {
        setSearchTerm('');
        setDebouncedSearch('');
        setSeverityFilter('all');
        setDateRangeFilter('all');
        setCurrentPage(1);
        router.push(`/admin/security-logs?page=1&pageSize=${pageSize}`);
    };

    const hasActiveFilters = Boolean(searchTerm.trim() || severityFilter !== 'all' || dateRangeFilter !== 'all');

    // ── Checkbox Selection Handlers ─────────────────────────────────────
    const isAllOnPageSelected = logs.length > 0 && logs.every(l => selectedLogIds.has(String(l.id)));

    const toggleSelectAllOnPage = () => {
        setSelectedLogIds(prev => {
            const next = new Set(prev);
            if (isAllOnPageSelected) {
                logs.forEach(l => next.delete(String(l.id)));
            } else {
                logs.forEach(l => next.add(String(l.id)));
            }
            return next;
        });
    };

    const toggleSelectRow = (id: string) => {
        setSelectedLogIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // ── Delete Actions ──────────────────────────────────────────────────
    const handleConfirmDeleteSingle = async () => {
        if (!logToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch('/admin/security-logs/api', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: logToDelete.id }),
            });
            const data = await res.json();
            if (res.ok) {
                toast({
                    title: "Log Entry Deleted",
                    description: `Security event "${logToDelete.event}" was removed.`,
                });
                setSelectedLogIds(prev => {
                    const next = new Set(prev);
                    next.delete(String(logToDelete.id));
                    return next;
                });
                fetchSecurityLogs(currentPage, pageSize, sortBy, sortOrder, debouncedSearch, severityFilter, dateRangeFilter, true);
            } else {
                throw new Error(data.message || 'Failed to delete log');
            }
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Deletion Failed",
                description: e.message || 'An unexpected error occurred.',
            });
        } finally {
            setIsDeleting(false);
            setLogToDelete(null);
        }
    };

    const handleConfirmDeleteSelected = async () => {
        if (selectedLogIds.size === 0) return;
        setIsDeleting(true);
        try {
            const ids = Array.from(selectedLogIds);
            const res = await fetch('/admin/security-logs/api', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids }),
            });
            const data = await res.json();
            if (res.ok) {
                toast({
                    title: "Selected Logs Deleted",
                    description: `Successfully removed ${ids.length} security log entries.`,
                });
                setSelectedLogIds(new Set());
                fetchSecurityLogs(currentPage, pageSize, sortBy, sortOrder, debouncedSearch, severityFilter, dateRangeFilter, true);
            } else {
                throw new Error(data.message || 'Failed to delete selected logs');
            }
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Deletion Failed",
                description: e.message || 'An unexpected error occurred.',
            });
        } finally {
            setIsDeleting(false);
            setIsBulkDeleteDialogOpen(false);
        }
    };

    const handleConfirmPruneLogs = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch('/admin/security-logs/api', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pruneDays, severity: pruneSeverity }),
            });
            const data = await res.json();
            if (res.ok) {
                toast({
                    title: "Logs Pruned Successfully",
                    description: data.message || `Pruned logs older than ${pruneDays} days.`,
                });
                setSelectedLogIds(new Set());
                fetchSecurityLogs(1, pageSize, sortBy, sortOrder, debouncedSearch, severityFilter, dateRangeFilter, true);
            } else {
                throw new Error(data.message || 'Failed to prune logs');
            }
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Prune Failed",
                description: e.message || 'An unexpected error occurred.',
            });
        } finally {
            setIsDeleting(false);
            setIsPruneDialogOpen(false);
        }
    };

    // ── IP Quarantine Handlers ──────────────────────────────────────────
    const fetchBlockedIps = useCallback(async () => {
        setLoadingBlockedIps(true);
        try {
            const res = await fetch('/admin/security-logs/api?view=blocked_ips');
            if (res.ok) {
                const data = await res.json();
                setBlockedIps(data.blockedIps || []);
            }
        } catch (err) {
            console.warn('Failed to load quarantined IPs:', err);
        } finally {
            setLoadingBlockedIps(false);
        }
    }, []);

    useEffect(() => {
        fetchBlockedIps();
    }, [fetchBlockedIps]);

    const handleConfirmBlockIp = async () => {
        if (!ipToBlock?.ip) return;
        setIsProcessingBlock(true);
        try {
            const res = await fetch('/admin/security-logs/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: ipToBlock.ip, reason: ipToBlock.reason }),
            });
            const data = await res.json();
            if (res.ok) {
                toast({
                    title: "IP Quarantined",
                    description: `IP ${ipToBlock.ip} has been added to the quarantine blocklist.`,
                });
                fetchBlockedIps();
            } else {
                throw new Error(data.message || 'Failed to quarantine IP');
            }
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Quarantine Failed",
                description: e.message || 'Could not quarantine IP.',
            });
        } finally {
            setIsProcessingBlock(false);
            setIpToBlock(null);
        }
    };

    const handleConfirmManualBlock = async () => {
        if (!manualIp.trim()) return;
        setIsProcessingBlock(true);
        try {
            const res = await fetch('/admin/security-logs/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: manualIp.trim(), reason: manualReason.trim() || 'Manual quarantine from SIEM' }),
            });
            const data = await res.json();
            if (res.ok) {
                toast({
                    title: "IP Quarantined",
                    description: `IP ${manualIp.trim()} has been added to the quarantine blocklist.`,
                });
                setManualIp('');
                setManualReason('');
                setIsManualBlockOpen(false);
                fetchBlockedIps();
            } else {
                throw new Error(data.message || 'Failed to quarantine IP');
            }
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Quarantine Failed",
                description: e.message || 'Could not quarantine IP.',
            });
        } finally {
            setIsProcessingBlock(false);
        }
    };

    const handleConfirmUnblockIp = async () => {
        if (!ipToUnblock) return;
        setIsProcessingBlock(true);
        try {
            const res = await fetch('/admin/security-logs/api', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unblockIp: ipToUnblock }),
            });
            const data = await res.json();
            if (res.ok) {
                toast({
                    title: "Quarantine Lifted",
                    description: `IP ${ipToUnblock} has been unblocked.`,
                });
                fetchBlockedIps();
            } else {
                throw new Error(data.message || 'Failed to unblock IP');
            }
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Unblock Failed",
                description: e.message || 'Could not unblock IP.',
            });
        } finally {
            setIsProcessingBlock(false);
            setIpToUnblock(null);
        }
    };

    // ── CSV Export ──────────────────────────────────────────────────────
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
            const params = new URLSearchParams({
                page: '1',
                pageSize: '10000',
                sortBy,
                sortOrder,
            });
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
            if (severityFilter && severityFilter !== 'all') params.set('severity', severityFilter);
            if (dateRangeFilter && dateRangeFilter !== 'all') params.set('dateRange', dateRangeFilter);

            const response = await fetch(`/admin/security-logs/api?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch logs');
            const data: SecurityLogsResponse = await response.json();
            const allLogs = data.logs;

            // Customer Key excluded completely
            const headers = ['Timestamp', 'Event Type', 'Staff Email', 'IP Address', 'Branch Name', 'Severity', 'Details'];
            const rows = allLogs.map(log => [
                format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
                log.event || '',
                log.staff_email || '',
                log.ip_address || '',
                log.branch_name || '',
                log.severity || 'info',
                log.details ? JSON.stringify(log.details) : '',
            ].map(v => escapeCsvField(String(v))));

            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            downloadCsv(csv, `security_logs_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`);
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    return (
        <div className="space-y-6 pb-10">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Security Log Entries</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Enterprise audit trail, security incident tracking, and active session telemetry.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant={autoRefresh ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoRefresh(prev => !prev)}
                        className={`text-xs h-9 ${autoRefresh ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-slate-200"}`}
                        title="Toggle live telemetry auto-refresh every 30s"
                    >
                        <Activity className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? "animate-pulse" : ""}`} />
                        {autoRefresh ? "Live: 30s" : "Auto-Refresh: Off"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchSecurityLogs(currentPage, pageSize, sortBy, sortOrder, debouncedSearch, severityFilter, dateRangeFilter)}
                        disabled={isRefreshing}
                        className="text-xs h-9 border-slate-200 hover:bg-slate-50"
                        title="Refresh now"
                    >
                        <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPruneDialogOpen(true)}
                        className="text-xs h-9 gap-1.5 text-rose-700 border-rose-200 bg-rose-50/70 hover:bg-rose-100 shadow-xs"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Prune Logs
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={exportSecurityLogs}
                        className="text-xs h-9 gap-1.5 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 shadow-xs"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="logs" className="w-full space-y-6">
                <TabsList className="bg-slate-100 p-1 rounded-xl border border-slate-200 w-auto inline-flex">
                    <TabsTrigger
                        value="logs"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg text-xs font-semibold px-4 py-2 text-slate-600 transition-all"
                    >
                        <ShieldAlert className="h-3.5 w-3.5 mr-1.5 inline" />
                        Security Logs
                    </TabsTrigger>
                    <TabsTrigger
                        value="userSessions"
                        className="data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg text-xs font-semibold px-4 py-2 text-slate-600 transition-all"
                    >
                        <Users className="h-3.5 w-3.5 mr-1.5 inline" />
                        User Sessions
                    </TabsTrigger>
                    <TabsTrigger
                        value="quarantine"
                        className="data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg text-xs font-semibold px-4 py-2 text-slate-600 transition-all"
                    >
                        <Ban className="h-3.5 w-3.5 mr-1.5 inline" />
                        Quarantined IPs ({blockedIps.length})
                    </TabsTrigger>
                </TabsList>

                {/* ── SECURITY LOGS TAB ─────────────────────────────────── */}
                <TabsContent value="logs" className="space-y-6 mt-0">
                    {/* Executive SIEM KPI Metric Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                        {/* Total Events */}
                        <Card
                            onClick={() => { setSeverityFilter('all'); setCurrentPage(1); }}
                            className={`cursor-pointer transition-all hover:shadow-md border ${severityFilter === 'all' ? 'ring-2 ring-primary border-primary bg-primary/5' : 'bg-white hover:bg-slate-50/70 border-slate-200'}`}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Events</p>
                                    <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{summary.total.toLocaleString()}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                                    <Layers className="h-5 w-5" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Critical Incidents */}
                        <Card
                            onClick={() => { setSeverityFilter('critical'); setCurrentPage(1); }}
                            className={`cursor-pointer transition-all hover:shadow-md border ${severityFilter === 'critical' ? 'ring-2 ring-red-500 border-red-500 bg-red-50/80' : 'bg-white hover:bg-red-50/30 border-red-100'}`}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Critical</p>
                                    <p className="text-2xl font-extrabold text-red-600 mt-0.5">{summary.critical_count.toLocaleString()}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                                    <AlertTriangle className="h-5 w-5 animate-pulse" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Warnings */}
                        <Card
                            onClick={() => { setSeverityFilter('warning'); setCurrentPage(1); }}
                            className={`cursor-pointer transition-all hover:shadow-md border ${severityFilter === 'warning' ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/80' : 'bg-white hover:bg-amber-50/30 border-amber-100'}`}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Warnings</p>
                                    <p className="text-2xl font-extrabold text-amber-600 mt-0.5">{summary.warning_count.toLocaleString()}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                                    <ShieldAlert className="h-5 w-5" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Info Audits */}
                        <Card
                            onClick={() => { setSeverityFilter('info'); setCurrentPage(1); }}
                            className={`cursor-pointer transition-all hover:shadow-md border ${severityFilter === 'info' ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/80' : 'bg-white hover:bg-blue-50/30 border-blue-100'}`}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Info Audits</p>
                                    <p className="text-2xl font-extrabold text-blue-600 mt-0.5">{summary.info_count.toLocaleString()}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                    <Info className="h-5 w-5" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Monitored Staff / Actors */}
                        <Card className="bg-white border-slate-200 col-span-2 md:col-span-1">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Actors &amp; IPs</p>
                                    <p className="text-sm font-bold text-slate-800 mt-1">
                                        <span className="text-lg font-extrabold text-indigo-600">{summary.staff_count}</span> staff &bull; <span className="text-lg font-extrabold text-indigo-600">{summary.ip_count}</span> IPs
                                    </p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <Users className="h-5 w-5" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Advanced Filter & Search Toolbar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            {/* Free-text Search */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="Search by event type, staff email, IP address, or branch..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-9 h-9 text-xs border-slate-200 bg-slate-50/50 focus-visible:bg-white focus-visible:ring-primary/20"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Filters */}
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Severity Filter */}
                                <div className="w-36">
                                    <Select value={severityFilter} onValueChange={(val) => { setSeverityFilter(val); setCurrentPage(1); }}>
                                        <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Filter className="h-3 w-3 text-slate-400" />
                                                <span>{severityFilter === 'all' ? 'All Severities' : severityFilter.toUpperCase()}</span>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all" className="text-xs font-semibold">All Severities</SelectItem>
                                            <SelectItem value="critical" className="text-xs text-red-600 font-semibold">Critical Only</SelectItem>
                                            <SelectItem value="warning" className="text-xs text-amber-600 font-semibold">Warning Only</SelectItem>
                                            <SelectItem value="info" className="text-xs text-blue-600 font-semibold">Info Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Date Range Filter */}
                                <div className="w-36">
                                    <Select value={dateRangeFilter} onValueChange={(val) => { setDateRangeFilter(val); setCurrentPage(1); }}>
                                        <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Clock className="h-3 w-3 text-slate-400" />
                                                <span>
                                                    {dateRangeFilter === 'all' ? 'All Time' :
                                                     dateRangeFilter === 'today' ? 'Today' :
                                                     dateRangeFilter === '24h' ? 'Last 24 Hours' :
                                                     dateRangeFilter === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                                                </span>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all" className="text-xs">All Time</SelectItem>
                                            <SelectItem value="today" className="text-xs">Today</SelectItem>
                                            <SelectItem value="24h" className="text-xs">Last 24 Hours</SelectItem>
                                            <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
                                            <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {hasActiveFilters && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearFilters}
                                        className="h-9 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 font-medium"
                                    >
                                        <X className="h-3.5 w-3.5 mr-1" />
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Quick Severity Filter Chips */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto pb-0.5">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Quick Scope:</span>
                            <button
                                type="button"
                                onClick={() => { setSeverityFilter('all'); setCurrentPage(1); }}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${severityFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                All ({summary.total})
                            </button>
                            <button
                                type="button"
                                onClick={() => { setSeverityFilter('critical'); setCurrentPage(1); }}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 ${severityFilter === 'critical' ? 'bg-red-600 text-white shadow-xs' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                                Critical ({summary.critical_count})
                            </button>
                            <button
                                type="button"
                                onClick={() => { setSeverityFilter('warning'); setCurrentPage(1); }}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 ${severityFilter === 'warning' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                Warnings ({summary.warning_count})
                            </button>
                            <button
                                type="button"
                                onClick={() => { setSeverityFilter('info'); setCurrentPage(1); }}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 ${severityFilter === 'info' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                Info ({summary.info_count})
                            </button>
                        </div>
                    </div>

                    {/* Bulk Actions Banner */}
                    {selectedLogIds.size > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in shadow-2xs">
                            <div className="flex items-center gap-2 font-bold text-indigo-900">
                                <CheckSquare className="h-4 w-4 text-indigo-600" />
                                <span>{selectedLogIds.size} log entr{selectedLogIds.size > 1 ? 'ies' : 'y'} selected</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedLogIds(new Set())}
                                    className="h-7 text-xs text-slate-600 hover:text-slate-900"
                                >
                                    Deselect All
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setIsBulkDeleteDialogOpen(true)}
                                    className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-xs font-semibold"
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    Delete Selected ({selectedLogIds.size})
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Table Card */}
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {error && (
                            <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center justify-between">
                                <span>Failed to fetch security logs: {error}</span>
                                <Button size="sm" variant="outline" onClick={() => fetchSecurityLogs(currentPage, pageSize, sortBy, sortOrder, debouncedSearch, severityFilter, dateRangeFilter)} className="h-7 text-xs">
                                    Retry
                                </Button>
                            </div>
                        )}

                        <Table>
                            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                                <TableRow>
                                    <TableHead className="w-10 px-3">
                                        <Checkbox
                                            checked={isAllOnPageSelected}
                                            onCheckedChange={toggleSelectAllOnPage}
                                            aria-label="Select all on page"
                                        />
                                    </TableHead>
                                    <TableHead className="cursor-pointer font-bold text-slate-700 text-xs py-3" onClick={() => handleSort('created_at')}>
                                        Timestamp {getSortIndicator('created_at')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer font-bold text-slate-700 text-xs py-3" onClick={() => handleSort('event')}>
                                        Event Type {getSortIndicator('event')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer font-bold text-slate-700 text-xs py-3" onClick={() => handleSort('staff_email')}>
                                        Staff Member {getSortIndicator('staff_email')}
                                    </TableHead>
                                    {/* Customer Key COLUMN REMOVED COMPLETELY */}
                                    <TableHead className="cursor-pointer font-bold text-slate-700 text-xs py-3" onClick={() => handleSort('ip_address')}>
                                        IP Address {getSortIndicator('ip_address')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer font-bold text-slate-700 text-xs py-3" onClick={() => handleSort('branch_name')}>
                                        Branch Name {getSortIndicator('branch_name')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer font-bold text-slate-700 text-xs py-3" onClick={() => handleSort('severity')}>
                                        Severity {getSortIndicator('severity')}
                                    </TableHead>
                                    <TableHead className="text-right font-bold text-slate-700 text-xs py-3 pr-4">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-40 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                                                <RotateCw className="h-6 w-6 animate-spin text-primary" />
                                                <span className="text-xs font-medium">Loading security logs telemetry...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length > 0 ? (
                                    logs.map((log) => {
                                        const sev = (log.severity || 'info').toLowerCase();
                                        const isSelected = selectedLogIds.has(String(log.id));
                                        const severityRowClass =
                                            isSelected
                                                ? 'bg-indigo-50/60 border-l-4 border-l-indigo-600'
                                                : sev === 'critical'
                                                ? 'bg-red-50/40 hover:bg-red-50/70 border-l-4 border-l-red-500'
                                                : sev === 'warning'
                                                ? 'bg-amber-50/30 hover:bg-amber-50/60 border-l-4 border-l-amber-400'
                                                : 'hover:bg-slate-50/60';

                                        return (
                                            <TableRow key={log.id} className={`${severityRowClass} transition-colors border-b border-slate-100`}>
                                                {/* Checkbox */}
                                                <TableCell className="px-3">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelectRow(String(log.id))}
                                                        aria-label={`Select log ${log.id}`}
                                                    />
                                                </TableCell>

                                                {/* Timestamp */}
                                                <TableCell className="text-xs font-mono text-slate-600 whitespace-nowrap">
                                                    {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                                                </TableCell>

                                                {/* Event Type */}
                                                <TableCell className="text-xs font-semibold text-slate-900">
                                                    {log.event}
                                                </TableCell>

                                                {/* Staff Email / Actor */}
                                                <TableCell className="text-xs text-slate-700">
                                                    {log.staff_email && log.staff_email !== 'Anonymous' ? (
                                                        <span className="font-medium text-slate-800">{log.staff_email}</span>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200">
                                                            Anonymous / System
                                                        </Badge>
                                                    )}
                                                </TableCell>

                                                {/* IP Address */}
                                                <TableCell className="text-xs font-mono text-slate-600">
                                                    {log.ip_address && log.ip_address !== 'unknown' ? (
                                                        <span className="bg-slate-100/80 px-1.5 py-0.5 rounded text-[11px]">
                                                            {log.ip_address}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">unknown</span>
                                                    )}
                                                </TableCell>

                                                {/* Branch Name */}
                                                <TableCell className="text-xs text-slate-600">
                                                    {log.branch_name ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <Building2 className="h-3 w-3 text-slate-400" />
                                                            {log.branch_name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </TableCell>

                                                {/* Severity */}
                                                <TableCell>
                                                    {sev === 'critical' ? (
                                                        <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 inline-flex items-center gap-1 shadow-2xs">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                                            Critical
                                                        </Badge>
                                                    ) : sev === 'warning' ? (
                                                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 inline-flex items-center gap-1">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                                            Warning
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] uppercase font-semibold px-2 py-0.5 inline-flex items-center gap-1">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                            Info
                                                        </Badge>
                                                    )}
                                                </TableCell>

                                                {/* Action Buttons: View Details & Delete */}
                                                <TableCell className="text-right pr-4">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-xs border-slate-200 hover:bg-blue-50 hover:text-blue-700 font-medium px-2"
                                                                >
                                                                    <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
                                                                    View
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
                                                                <DialogHeader className="sr-only">
                                                                    <DialogTitle>Audit Log Details</DialogTitle>
                                                                    <DialogDescription>
                                                                        Detailed comparison of changes for security event: {log.event}
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                <AuditLogDetails log={log} />
                                                                <div className="flex items-center justify-between pt-4 border-t mt-6">
                                                                    {log.ip_address && log.ip_address !== 'unknown' && (
                                                                        <Button
                                                                            type="button"
                                                                            variant="destructive"
                                                                            size="sm"
                                                                            onClick={() => setIpToBlock({ ip: log.ip_address!, reason: `Incident: ${log.event}` })}
                                                                            className="text-xs bg-rose-600 hover:bg-rose-700"
                                                                        >
                                                                            <Ban className="h-3.5 w-3.5 mr-1.5" />
                                                                            Quarantine IP ({log.ip_address})
                                                                        </Button>
                                                                    )}
                                                                    <DialogTrigger asChild>
                                                                        <Button variant="outline" className="px-6 ml-auto">Close</Button>
                                                                    </DialogTrigger>
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>

                                                        {/* Quick Quarantine IP Button */}
                                                        {log.ip_address && log.ip_address !== 'unknown' && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setIpToBlock({ ip: log.ip_address!, reason: `Incident: ${log.event}` })}
                                                                className="h-7 w-7 p-0 text-amber-600 hover:text-rose-600 hover:bg-rose-50 border-slate-200 hover:border-rose-200 transition-colors"
                                                                title={`Quarantine IP ${log.ip_address}`}
                                                            >
                                                                <Ban className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}

                                                        {/* Individual Delete Button */}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setLogToDelete(log)}
                                                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200 hover:border-rose-200 transition-colors"
                                                            title="Delete this log entry"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-slate-500 text-xs">
                                            <div className="flex flex-col items-center justify-center space-y-1.5">
                                                <ShieldCheck className="h-8 w-8 text-slate-300" />
                                                <p className="font-medium text-slate-600">No security log entries match your criteria.</p>
                                                {hasActiveFilters && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleClearFilters}
                                                        className="text-xs text-primary underline"
                                                    >
                                                        Clear all active filters
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <div>
                            Showing <span className="font-semibold text-slate-800">{logs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
                            <span className="font-semibold text-slate-800">{Math.min(currentPage * pageSize, totalLogs)}</span> of{' '}
                            <span className="font-semibold text-slate-800">{totalLogs.toLocaleString()}</span> entries
                        </div>
                        <TablePagination
                            page={currentPage - 1}
                            rowsPerPage={pageSize}
                            count={totalLogs}
                            onPageChange={(p) => handlePageChange(p + 1)}
                            onRowsPerPageChange={handlePageSizeChange}
                        />
                    </div>
                </TabsContent>

                {/* ── USER SESSIONS TAB ─────────────────────────────────── */}
                <TabsContent value="userSessions">
                    <UserSessionsTab />
                </TabsContent>

                {/* ── QUARANTINED IPs TAB ──────────────────────────────── */}
                <TabsContent value="quarantine" className="space-y-5 mt-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Ban className="h-4 w-4 text-rose-600" />
                                IP Quarantine Blocklist
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                IPs added here are logged for reference. Integrate with your firewall/WAF to enforce actual traffic blocking.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={fetchBlockedIps}
                                disabled={loadingBlockedIps}
                                className="h-8 text-xs gap-1.5"
                            >
                                <RotateCw className={`h-3.5 w-3.5 ${loadingBlockedIps ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setIsManualBlockOpen(true)}
                                className="h-8 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
                            >
                                <Ban className="h-3.5 w-3.5" />
                                Quarantine IP
                            </Button>
                        </div>
                    </div>

                    {/* Search blocked IPs */}
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            value={blockedIpSearch}
                            onChange={(e) => setBlockedIpSearch(e.target.value)}
                            placeholder="Search quarantined IPs..."
                            className="pl-9 h-9 text-xs border-slate-200"
                        />
                    </div>

                    {loadingBlockedIps ? (
                        <div className="h-40 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : blockedIps.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-400 border border-dashed rounded-xl gap-2">
                            <ShieldCheck className="h-10 w-10 text-slate-300" />
                            <p className="font-semibold text-slate-600 text-sm">No Quarantined IPs</p>
                            <p className="text-xs text-center max-w-xs text-slate-400">
                                The blocklist is currently empty. Quarantine IPs from Security Log entries or add them manually.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-700 text-xs">IP Address</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Reason</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Blocked By</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Quarantined At</TableHead>
                                        <TableHead className="text-right font-bold text-slate-700 text-xs">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {blockedIps
                                        .filter(b => !blockedIpSearch || b.ip_address?.includes(blockedIpSearch) || b.reason?.toLowerCase().includes(blockedIpSearch.toLowerCase()))
                                        .map((blocked) => (
                                            <TableRow key={blocked.id} className="border-b border-slate-100 hover:bg-rose-50/30">
                                                <TableCell>
                                                    <span className="font-mono text-sm font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded">
                                                        {blocked.ip_address}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-700 max-w-xs">
                                                    <span className="line-clamp-2">{blocked.reason || '—'}</span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-600 font-medium">{blocked.blocked_by || '—'}</TableCell>
                                                <TableCell className="text-xs font-mono text-slate-500">
                                                    {blocked.created_at ? format(new Date(blocked.created_at), 'yyyy-MM-dd HH:mm') : '—'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setIpToUnblock(blocked.ip_address)}
                                                        className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
                                                    >
                                                        <ShieldOff className="h-3 w-3 mr-1" />
                                                        Unblock
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ── Delete Single Log Confirmation Dialog ────────────────── */}
            <AlertDialog open={!!logToDelete} onOpenChange={(open) => { if (!open) setLogToDelete(null); }}>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle className="h-5 w-5 text-rose-600" />
                            Delete Security Log Entry?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to permanently delete the log entry for{' '}
                            <strong>&quot;{logToDelete?.event}&quot;</strong> recorded at{' '}
                            <span className="font-mono text-slate-700">{logToDelete?.created_at ? format(new Date(logToDelete.created_at), 'yyyy-MM-dd HH:mm:ss') : ''}</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDeleteSingle}
                            disabled={isDeleting}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                            Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Bulk Delete Selected Logs Confirmation Dialog ─────────── */}
            <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle className="h-5 w-5 text-rose-600" />
                            Delete {selectedLogIds.size} Selected Log Entries?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to permanently delete all {selectedLogIds.size} selected security audit log entries?
                            This will permanently remove them from database records and cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDeleteSelected}
                            disabled={isDeleting}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                            Delete {selectedLogIds.size} Entries
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Prune Logs Dialog ────────────────────────────────────── */}
            <Dialog open={isPruneDialogOpen} onOpenChange={setIsPruneDialogOpen}>
                <DialogContent className="sm:max-w-[480px] rounded-xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-rose-600">
                            <Trash2 className="h-5 w-5" />
                            <DialogTitle>Prune Historical Security Logs</DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-slate-500">
                            Purge outdated security log entries to optimize storage and maintain database performance.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700">Delete Logs Older Than:</label>
                            <Select value={String(pruneDays)} onValueChange={(v) => setPruneDays(Number(v))}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7" className="text-xs">Older than 7 days</SelectItem>
                                    <SelectItem value="30" className="text-xs">Older than 30 days (Recommended)</SelectItem>
                                    <SelectItem value="60" className="text-xs">Older than 60 days</SelectItem>
                                    <SelectItem value="90" className="text-xs">Older than 90 days</SelectItem>
                                    <SelectItem value="180" className="text-xs">Older than 180 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700">Target Severity Level:</label>
                            <Select value={pruneSeverity} onValueChange={setPruneSeverity}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs">All Severities (Info, Warning, Critical)</SelectItem>
                                    <SelectItem value="info" className="text-xs">Informational Logs Only (Preserves Warnings &amp; Critical)</SelectItem>
                                    <SelectItem value="warning" className="text-xs">Warnings &amp; Lower</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold">Notice for Compliance &amp; Auditing</p>
                                <p className="text-[11px] text-amber-800 mt-0.5">
                                    Pruned logs are permanently expunged from the PostgreSQL database. Export a CSV backup first if long-term offline retention is required.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsPruneDialogOpen(false)}
                            disabled={isDeleting}
                            className="text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirmPruneLogs}
                            disabled={isDeleting}
                            className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                        >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                            Execute Log Prune
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── IP Quarantine: Block from Log Row Confirmation ────────── */}
            <AlertDialog open={!!ipToBlock} onOpenChange={(open) => { if (!open) setIpToBlock(null); }}>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
                            <Ban className="h-5 w-5" />
                            Quarantine IP Address?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Add <strong className="font-mono text-rose-800">{ipToBlock?.ip}</strong> to the SIEM quarantine blocklist?
                            <br /><br />
                            Reason: <span className="italic">{ipToBlock?.reason}</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessingBlock}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmBlockIp}
                            disabled={isProcessingBlock}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {isProcessingBlock ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                            Quarantine IP
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── IP Quarantine: Unblock Confirmation ──────────────────── */}
            <AlertDialog open={!!ipToUnblock} onOpenChange={(open) => { if (!open) setIpToUnblock(null); }}>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-green-700">
                            <ShieldOff className="h-5 w-5" />
                            Remove IP from Quarantine?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Lift the quarantine on <strong className="font-mono">{ipToUnblock}</strong>?
                            This will remove it from the blocklist. Traffic from this IP will no longer be flagged.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessingBlock}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmUnblockIp}
                            disabled={isProcessingBlock}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {isProcessingBlock ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                            Unblock IP
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Manual IP Block Dialog ────────────────────────────────── */}
            <Dialog open={isManualBlockOpen} onOpenChange={setIsManualBlockOpen}>
                <DialogContent className="sm:max-w-sm rounded-xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-rose-700">
                            <Ban className="h-5 w-5" />
                            <DialogTitle>Quarantine an IP Address</DialogTitle>
                        </div>
                        <DialogDescription className="text-xs">
                            Manually add an IP to the SIEM quarantine blocklist.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700">IP Address *</label>
                            <Input
                                value={manualIp}
                                onChange={(e) => setManualIp(e.target.value)}
                                placeholder="e.g. 192.168.1.100"
                                className="font-mono text-sm h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700">Reason (optional)</label>
                            <Input
                                value={manualReason}
                                onChange={(e) => setManualReason(e.target.value)}
                                placeholder="e.g. Brute force, known bad actor..."
                                className="text-xs h-9"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" size="sm" onClick={() => setIsManualBlockOpen(false)} className="text-xs">
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleConfirmManualBlock}
                            disabled={!manualIp.trim() || isProcessingBlock}
                            className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {isProcessingBlock ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Ban className="h-3.5 w-3.5 mr-1" />}
                            Quarantine IP
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
