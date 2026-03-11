
'use client';

import React, { useEffect, useState } from 'react';
import { BillTaskBoard } from '@/components/BillTaskBoard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    getAllBillsAction,
    deleteBillAction,
    submitBillAction,
    approveBillAction,
    postBillAction,
    getAllBranchesAction
} from '@/lib/actions';
import { usePermissions } from '@/hooks/use-permissions';
import { cn, formatDate } from '@/lib/utils';
import { format, subDays, isBefore } from 'date-fns';
import {
    Loader2,
    Filter,
    Search,
    Download,
    TrendingUp,
    AlertCircle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Clock,
    DollarSign,
    PieChart,
    MoreVertical,
    Trash2,
    Eye,
    Printer
} from 'lucide-react';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { BillingCycleDialog } from './billing-cycle-dialog';

interface BillManagementPageProps {
    basePath?: string;
}

export default function BillManagementPage({ basePath = '/staff/bill-management' }: BillManagementPageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCycleDialogOpen, setIsCycleDialogOpen] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [branchFilter, setBranchFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [paidCurrentPage, setPaidCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Bulk Action Confirmation states
    const [pendingBulkAction, setPendingBulkAction] = useState<{
        type: 'submit' | 'approve' | 'post';
        title: string;
        description: string;
        action: () => Promise<void>;
    } | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await getAllBillsAction();
            if (res.data) {
                setBills(res.data);

                // Default to most recent month if no filter is active
                if (monthFilter === 'all' && res.data.length > 0) {
                    const months = Array.from(new Set(res.data.map((b: any) => b.month_year)))
                        .filter(Boolean)
                        .sort()
                        .reverse();
                    if (months.length > 0) {
                        setMonthFilter(months[0] as string);
                    }
                }
            }

            const branchRes = await getAllBranchesAction();
            if (branchRes.data) setBranches(branchRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this bill record?")) return;
        try {
            const res = await deleteBillAction(id);
            if (res.data) {
                toast({ title: "Deleted", description: "Bill record removed successfully." });
                await loadData();
            } else {
                toast({ title: "Error", description: res.error?.message || "Failed to delete", variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Filtered data for stats & dashboard (respects Search, Branch, Month)
    const filteredForStats = bills.filter(b => {
        const matchesSearch = (b.CUSTOMERKEY || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (b.individual_customer_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBranch = branchFilter === 'all' || b.branch_id === branchFilter;
        const matchesMonth = monthFilter === 'all' || b.month_year === monthFilter;
        return matchesSearch && matchesBranch && matchesMonth;
    });

    const myDrafts = filteredForStats.filter(b => b.status === 'Draft' || !b.status);
    const pendingApprovals = filteredForStats.filter(b => b.status === 'Pending');
    const approvedBills = filteredForStats.filter(b => b.status === 'Approved');
    const reworkItems = filteredForStats.filter(b => b.status === 'Rework');
    const postedBills = filteredForStats.filter(b => b.status === 'Posted');

    const canViewDrafts = hasPermission('bill:view_drafts') || hasPermission('bill:manage_all');
    const canViewPending = hasPermission('bill:view_pending') || hasPermission('bill:approve') || hasPermission('bill:manage_all');
    const canViewRework = hasPermission('bill:rework') || hasPermission('bill:manage_all');
    const canViewApproved = hasPermission('bill:view_approved') || hasPermission('bill:send') || hasPermission('bill:post') || hasPermission('bill:approve') || hasPermission('bill:manage_all');
    const canViewPaid = hasPermission('bill:view_paid') || hasPermission('bill:manage_all');
    const canViewUnpaid = hasPermission('bill:view_awaiting_payment') || hasPermission('bill:view_overdue') || hasPermission('bill:manage_all');

    const canAccessPage = canViewDrafts || canViewPending || canViewRework || canViewApproved || canViewPaid || canViewUnpaid;

    const handleSubmitAll = async () => {
        const drafts = [...myDrafts, ...reworkItems];
        if (drafts.length === 0) return;

        setPendingBulkAction({
            type: 'submit',
            title: 'Submit All for Approval',
            description: `Are you sure you want to submit ${drafts.length} bills for approval?`,
            action: async () => {
                await Promise.allSettled(drafts.map(b => submitBillAction(b.id)));
                toast({ title: 'All Submitted', description: `${drafts.length} bill(s) submitted for approval.` });
                await loadData();
            }
        });
    };

    const handleApproveAll = async () => {
        if (pendingApprovals.length === 0) return;

        setPendingBulkAction({
            type: 'approve',
            title: 'Approve All Invoices',
            description: `Are you sure you want to approve ${pendingApprovals.length} invoices? This action cannot be easily undone.`,
            action: async () => {
                await Promise.allSettled(pendingApprovals.map(b => approveBillAction(b.id)));
                toast({ title: 'All Approved', description: `${pendingApprovals.length} invoice(s) approved.` });
                await loadData();
            }
        });
    };

    const handlePostAll = async () => {
        if (approvedBills.length === 0) return;

        setPendingBulkAction({
            type: 'post',
            title: 'Post & Finalize All Bills',
            description: `Are you sure you want to post and finalize ${approvedBills.length} bills? This will officially record them and make them active for collection.`,
            action: async () => {
                await Promise.allSettled(approvedBills.map(b => postBillAction(b.id)));
                toast({ title: 'All Posted', description: `${approvedBills.length} bill(s) posted and finalized.` });
                await loadData();
            }
        });
    };

    if (loading && bills.length === 0) return <div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin h-5 w-5" /> Loading dashboard...</div>;

    if (!canAccessPage) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <UIAlertDescription>
                        You do not have permission to access the Bill Management page.
                    </UIAlertDescription>
                </Alert>
            </div>
        );
    }

    // Stats Calculations based on filtered data
    const getBillTotalPayable = (b: any) => {
        const arrears = (Number(b.debit_30 || b.debit30 || 0)) +
            (Number(b.debit_30_60 || b.debit30_60 || 0)) +
            (Number(b.debit_60 || b.debit60 || 0));
        return (Number(b.TOTALBILLAMOUNT) || 0) + arrears;
    };

    const totalOutstandingUnpaid = filteredForStats
        .filter(b => b.payment_status === 'Unpaid')
        .reduce((sum, b) => sum + getBillTotalPayable(b), 0);

    const totalPaidAmount = filteredForStats
        .filter(b => b.payment_status === 'Paid')
        .reduce((sum, b) => sum + getBillTotalPayable(b), 0);

    const totalInView = totalPaidAmount + totalOutstandingUnpaid;
    const collectionEfficiency = totalInView > 0 ? (totalPaidAmount / totalInView) * 100 : 0;

    const draftTotalAmount = filteredForStats
        .filter(b => b.status === 'Draft' || b.status === 'Rework')
        .reduce((sum, b) => sum + getBillTotalPayable(b), 0);
    const pendingTotalAmount = filteredForStats
        .filter(b => b.status === 'Pending')
        .reduce((sum, b) => sum + getBillTotalPayable(b), 0);

    const myDraftsCount = filteredForStats.filter(b => b.status === 'Draft' || !b.status).length;
    const reworkItemsCount = filteredForStats.filter(b => b.status === 'Rework').length;
    const pendingApprovalsCount = filteredForStats.filter(b => b.status === 'Pending').length;

    // Aging Calculations based on filtered data
    const now = new Date();
    const filteredOverdueList = filteredForStats.filter(b => b.payment_status === 'Unpaid' && b.due_date && isBefore(new Date(b.due_date), now));

    const aging = {
        zeroToThirty: filteredOverdueList
            .filter(b => b.due_date && isBefore(subDays(now, 30), new Date(b.due_date)))
            .reduce((sum, b) => sum + getBillTotalPayable(b), 0),
        thirtyToSixty: filteredOverdueList
            .filter(b => b.due_date && isBefore(subDays(now, 60), new Date(b.due_date)) && !isBefore(new Date(b.due_date), subDays(now, 30)))
            .reduce((sum, b) => sum + getBillTotalPayable(b), 0),
        sixtyPlus: filteredOverdueList
            .filter(b => b.due_date && isBefore(new Date(b.due_date), subDays(now, 60)))
            .reduce((sum, b) => sum + getBillTotalPayable(b), 0)
    };

    // Filtered Outstanding List (Main Table)
    const filteredOutstanding = filteredForStats
        .filter(b => (b.status === 'Posted' || b.status === 'Approved') && b.payment_status === 'Unpaid')
        .filter(b => {
            const isBillOverdue = b.due_date && isBefore(new Date(b.due_date), now);
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'overdue' && isBillOverdue) ||
                (statusFilter === 'unpaid' && !isBillOverdue);
            return matchesStatus;
        });

    // Filtered Paid List (Second Table)
    const filteredPaid = filteredForStats
        .filter(b => b.payment_status === 'Paid');

    // Pagination for Outstanding
    const totalPages = Math.ceil(filteredOutstanding.length / itemsPerPage);
    const paginatedOutstanding = filteredOutstanding.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Pagination for Paid
    const paidTotalPages = Math.ceil(filteredPaid.length / itemsPerPage);
    const paginatedPaid = filteredPaid.slice(
        (paidCurrentPage - 1) * itemsPerPage,
        paidCurrentPage * itemsPerPage
    );

    const handleExportCSV = () => {
        const headers = ['Bill ID', 'Customer Key', 'Month', 'Date Billed', 'Due Date', 'Status', 'Total Payable'];
        const rows = filteredOutstanding.map(b => {
            const isBillOverdue = b.due_date && isBefore(new Date(b.due_date), now);
            return [
                b.id,
                b.CUSTOMERKEY || b.individual_customer_id || 'N/A',
                b.month_year,
                formatDate(b.created_at),
                formatDate(b.due_date),
                isBillOverdue ? 'Overdue' : 'Unpaid',
                Number(b.TOTALBILLAMOUNT).toFixed(2)
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `outstanding_bills_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const role = hasPermission('bill:approve') ? 'manager' : 'staff';

    return (
        <div className="p-6 space-y-8 w-full animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bill Management</h1>
                    <p className="text-muted-foreground mt-1">Review, approve and track billing workflow across branches.</p>
                </div>
                <div className="flex items-center gap-2">
                    {hasPermission('billing:close_cycle') && (
                        <Button className="h-10 bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => setIsCycleDialogOpen(true)}>
                            Start New Billing Cycle
                        </Button>
                    )}
                    {hasPermission('bill:create') && (
                        <Link href="/staff/bill-management/create">
                            <Button className="h-10">Create New Bill</Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Summary Statistics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                    title="Drafts & Rework"
                    value={`ETB ${draftTotalAmount.toLocaleString()}`}
                    count={myDrafts.length + reworkItems.length}
                    icon={<Clock className="h-5 w-5 text-blue-500" />}
                    color="blue"
                />
                <StatsCard
                    title="Pending Approval"
                    value={`ETB ${pendingTotalAmount.toLocaleString()}`}
                    count={pendingApprovals.length}
                    icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
                    color="amber"
                />
                <StatsCard
                    title="Total Outstanding"
                    value={`ETB ${totalOutstandingUnpaid.toLocaleString()}`}
                    count={filteredOutstanding.length}
                    icon={<DollarSign className="h-5 w-5 text-red-500" />}
                    color="red"
                />
                <Card className="shadow-sm border-gray-100 overflow-hidden">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Collection Efficiency</p>
                                <h3 className="text-2xl font-bold text-gray-900">{collectionEfficiency.toFixed(1)}%</h3>
                            </div>
                            <div className="p-2.5 bg-green-50 rounded-xl">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                        <Progress value={collectionEfficiency} className="h-1.5 mt-4 bg-gray-100" />
                    </CardContent>
                </Card>
            </div>

            {/* Kanban Columns */}
            <BillTaskBoard
                myDrafts={myDrafts}
                pendingApprovals={pendingApprovals}
                reworkItems={reworkItems}
                approvedBills={approvedBills}
                role={role}
                basePath={basePath}
                showApprovals={canViewPending}
                showReadyToPost={canViewApproved}
                onSubmitAll={canViewDrafts ? handleSubmitAll : undefined}
                onApproveAll={hasPermission('bill:approve') ? handleApproveAll : undefined}
                onPostAll={(hasPermission('bill:post') || hasPermission('bill:send')) ? handlePostAll : undefined}
            />

            {/* Aging Summary & Quick Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 shadow-sm border-gray-100">
                    <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
                            <PieChart className="h-4 w-4" /> Overdue Aging (ETB)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4">
                        <AgingBar label="0-30 Days" value={aging.zeroToThirty} total={totalOutstandingUnpaid} color="bg-amber-400" />
                        <AgingBar label="31-60 Days" value={aging.thirtyToSixty} total={totalOutstandingUnpaid} color="bg-orange-500" />
                        <AgingBar label="60+ Days" value={aging.sixtyPlus} total={totalOutstandingUnpaid} color="bg-red-600" />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 shadow-sm border-gray-100">
                    <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
                            <Filter className="h-4 w-4" /> Search & Smart Filters
                        </CardTitle>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportCSV}>
                            <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by ID or Meter Key..."
                                className="pl-10 h-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="unpaid">Unpaid (Current)</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={branchFilter} onValueChange={setBranchFilter}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Branch" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Branches</SelectItem>
                                {branches.map(b => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={monthFilter} onValueChange={(val) => setMonthFilter(val)}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Month Period" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Months</SelectItem>
                                {Array.from(new Set(bills.map(b => b.month_year))).sort().reverse().map(m => (
                                    <SelectItem key={m as string} value={m as string}>{m as string}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>
            </div>


            <Card className="shadow-sm border-gray-100 overflow-hidden">
                <CardHeader className="bg-gray-50/50 flex flex-row items-center justify-between border-b border-gray-100 py-3 px-5">
                    <CardTitle className="text-base font-bold text-gray-700">Outstanding Bills Table</CardTitle>
                    <div className="text-xs text-muted-foreground font-medium">
                        Showing {filteredOutstanding.length === 0 ? 0 : Math.min(filteredOutstanding.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredOutstanding.length, currentPage * itemsPerPage)} of {filteredOutstanding.length} records
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <BillTable
                        bills={paginatedOutstanding}
                        onDelete={handleDelete}
                        router={router}
                    />

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-50 bg-gray-50/30">
                            <div className="text-sm text-gray-500 font-medium">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {filteredOutstanding.length === 0 && (
                        <div className="p-12 text-center">
                            <div className="inline-flex p-4 rounded-full bg-gray-50 mb-4">
                                <Search className="h-8 w-8 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">No matching bills found</h3>
                            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Paid Bills Table */}
            <Card className="shadow-sm border-gray-100 overflow-hidden">
                <CardHeader className="bg-blue-50/30 flex flex-row items-center justify-between border-b border-gray-100 py-3 px-5">
                    <CardTitle className="text-base font-bold text-blue-800 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Paid Bills Table
                    </CardTitle>
                    <div className="text-xs text-blue-600 font-medium">
                        Showing {filteredPaid.length === 0 ? 0 : Math.min(filteredPaid.length, (paidCurrentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredPaid.length, paidCurrentPage * itemsPerPage)} of {filteredPaid.length} records
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <BillTable
                        bills={paginatedPaid}
                        onDelete={handleDelete}
                        router={router}
                    />

                    {/* Pagination Controls for Paid */}
                    {paidTotalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-50 bg-gray-50/30">
                            <div className="text-sm text-gray-500 font-medium">
                                Page {paidCurrentPage} of {paidTotalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setPaidCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={paidCurrentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setPaidCurrentPage(p => Math.min(paidTotalPages, p + 1))}
                                    disabled={paidCurrentPage === paidTotalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {filteredPaid.length === 0 && (
                        <div className="p-12 text-center">
                            <div className="inline-flex p-4 rounded-full bg-gray-50 mb-4">
                                <CheckCircle2 className="h-8 w-8 text-gray-200" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">No paid bills found</h3>
                            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <BillingCycleDialog
                open={isCycleDialogOpen}
                onOpenChange={setIsCycleDialogOpen}
                onComplete={() => loadData()}
            />

            {/* Bulk Action Confirmation Dialog */}
            <AlertDialog open={!!pendingBulkAction} onOpenChange={(open) => !open && setPendingBulkAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{pendingBulkAction?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingBulkAction?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                if (pendingBulkAction) {
                                    await pendingBulkAction.action();
                                    setPendingBulkAction(null);
                                }
                            }}
                            className={pendingBulkAction?.type === 'post' ? 'bg-blue-700 hover:bg-blue-800' :
                                pendingBulkAction?.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                            Confirm Action
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Sub-components
function BillTable({ bills, onDelete, router }: { bills: any[], onDelete: (id: string) => void, router: any }) {
    if (bills.length === 0) return null;

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-gray-50/50">
                        <TableHead className="w-[100px]">ID / Meter</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead>Date Billed</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Prev. Reading</TableHead>
                        <TableHead className="text-right">Curr. Reading</TableHead>
                        <TableHead className="text-right">Usage (m³)</TableHead>
                        <TableHead className="text-right">Diff. Usage (m³)</TableHead>
                        <TableHead className="text-right text-[10px]">DEBIT_30</TableHead>
                        <TableHead className="text-right text-[10px]">DEBIT_30_60</TableHead>
                        <TableHead className="text-right text-[10px]">DEBIT_&gt;60</TableHead>
                        <TableHead className="text-right">Outstanding (ETB)</TableHead>
                        <TableHead className="text-right">Current Bill (ETB)</TableHead>
                        <TableHead className="text-right">Total Payable (ETB)</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {bills.map((bill) => {
                        const now = new Date();
                        const isOverdue = bill.payment_status === 'Unpaid' && bill.due_date && isBefore(new Date(bill.due_date), now);
                        const currentOutstanding = (Number(bill.debit_30 || bill.debit30 || 0)) +
                            (Number(bill.debit_30_60 || bill.debit30_60 || 0)) +
                            (Number(bill.debit_60 || bill.debit60 || 0));
                        const totalPayable = (Number(bill.TOTALBILLAMOUNT) || 0) + currentOutstanding;

                        return (
                            <TableRow key={bill.id}>
                                <TableCell className="font-medium text-xs">
                                    <Link href={`/staff/bill-management/${bill.id}`} className="text-blue-600 hover:underline">
                                        {bill.CUSTOMERKEY || bill.individual_customer_id}
                                    </Link>
                                </TableCell>
                                <TableCell className="text-xs">{bill.month_year}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                    {formatDate(bill.created_at)}
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                    {formatDate(bill.due_date)}
                                </TableCell>
                                <TableCell className="text-right text-xs">{Number(bill.PREVREAD || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-xs">{Number(bill.CURRREAD || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-xs">{Number(bill.CONS || 0).toFixed(2)}</TableCell>
                                <TableCell className={cn("text-right text-xs font-medium", (Number(bill.difference_usage) > Number(bill.CONS)) ? "text-green-600" : "")}>
                                    {Number(bill.difference_usage || bill.CONS || 0).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right text-[10px] text-gray-500">{Number(bill.debit_30 || bill.debit30 || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-[10px] text-gray-500">{Number(bill.debit_30_60 || bill.debit30_60 || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-[10px] text-gray-500">{Number(bill.debit_60 || bill.debit60 || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-xs">{currentOutstanding.toFixed(2)}</TableCell>
                                <TableCell className="text-right text-xs">{Number(bill.TOTALBILLAMOUNT || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-xs font-bold whitespace-nowrap">
                                    {totalPayable.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge
                                        variant={bill.payment_status === 'Paid' ? 'default' : isOverdue ? 'destructive' : 'outline'}
                                        className={cn(
                                            "text-[10px] px-2 py-0 h-5",
                                            bill.payment_status === 'Paid' ? "bg-blue-500 hover:bg-blue-600" :
                                                !isOverdue && "bg-amber-100 text-amber-800 border-amber-200"
                                        )}
                                    >
                                        {bill.payment_status === 'Paid' ? 'Paid' : isOverdue ? 'Overdue' : 'Unpaid'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                            <DropdownMenuItem onClick={() => router.push(`/staff/bill-management/${bill.id}`)}>
                                                <Eye className="mr-2 h-4 w-4" /> View Details
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => router.push(`/staff/bill-management/${bill.id}?print=true`)}>
                                                <Printer className="mr-2 h-4 w-4" /> Print/Export Bill
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-600"
                                                onClick={() => onDelete(bill.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

function StatsCard({ title, value, count, icon, color }: { title: string, value: string, count: number, icon: React.ReactNode, color: string }) {
    const bgColors: Record<string, string> = {
        blue: 'bg-blue-50',
        amber: 'bg-amber-50',
        red: 'bg-red-50',
        green: 'bg-green-50'
    };

    return (
        <Card className="shadow-sm border-gray-100 overflow-hidden">
            <CardContent className="p-5">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
                        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
                        <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-widest">{count} Records</p>
                    </div>
                    <div className={`p-2.5 ${bgColors[color]} rounded-xl`}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AgingBar({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-600">{label}</span>
                <span className="text-gray-900 font-mono">ETB {value.toLocaleString()}</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
