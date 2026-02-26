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
import { SecurityLog } from '@/types/supabase';
import { format } from 'date-fns';

interface SecurityLogsResponse {
    logs: SecurityLog[];
    total: number;
    page: number;
    pageSize: number;
    lastPage: number;
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

    useEffect(() => {
        const page = parseInt(searchParams.get('page') || '1', 10);
        const size = parseInt(searchParams.get('pageSize') || '10', 10);
        const sort = searchParams.get('sortBy') || 'created_at';
        const order = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

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

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', newPage.toString());
        router.push(`/admin/security-logs?${params.toString()}`);
    };

    const handlePageSizeChange = (newSize: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('pageSize', newSize.toString());
        params.set('page', '1'); // Reset to first page when page size changes
        router.push(`/admin/security-logs?${params.toString()}`);
    };

    const handleSort = (column: string) => {
        const params = new URLSearchParams(searchParams.toString());
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

    if (loading) return <div className="p-4">Loading security logs...</div>;
    if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Security Log Entries</h1>
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
                            <TableHead className="cursor-pointer" onClick={() => handleSort('ip_address')}>
                                IP Address {getSortIndicator('ip_address')}
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('branch_name')}>
                                Branch Name {getSortIndicator('branch_name')}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length > 0 ? (
                            logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                                    <TableCell>{log.event}</TableCell>
                                    <TableCell>{log.staff_email || 'N/A'}</TableCell>
                                    <TableCell>{log.ip_address || 'N/A'}</TableCell>
                                    <TableCell>{log.branch_name || 'N/A'}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No security logs found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <TablePagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={totalLogs}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                lastPage={lastPage}
            />
        </div>
    );
}