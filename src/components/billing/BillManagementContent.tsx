
'use client';

import React, { useEffect, useState } from 'react';
import { BillTaskBoard } from '@/components/billing/BillTaskBoard';
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
import { getMonthlyBillAmt } from '@/lib/billing-utils';
import {
    Loader2,
    Filter,
    Search,
    Download,
    TrendingUp,
    AlertCircle,
    Calendar,
    RotateCcw,
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
import { Label } from "@/components/ui/label";
import { BillingCycleDialog } from '@/app/(dashboard)/staff/bill-management/billing-cycle-dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { DatePicker } from '@/components/ui/date-picker';
import { parse } from 'date-fns';



interface BillManagementContentProps {
    basePath: string;
}

export function BillManagementContent({ basePath }: BillManagementContentProps) {
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
    const [currentPage, setCurrentPage] = useState(0);
    const [paidCurrentPage, setPaidCurrentPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [paidItemsPerPage, setPaidItemsPerPage] = useState(10);


    // Bulk Action Confirmation states
    const [pendingBulkAction, setPendingBulkAction] = useState<{
        type: 'submit' | 'approve' | 'post';
        title: string;
        description: string;
        action: () => Promise<void>;
    } | null>(null);

    const latestMonth = React.useMemo(() => {
        const months = Array.from(new Set(bills.map(b => b.month_year)))
            .filter(Boolean)
            .sort()
            .reverse();
        return months[0] as string;
    }, [bills]);

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

    // Generate the Reconstructed History Map for all bills
    // so the table can display the aging buckets accurately
    const reconstructedHistoryMap = React.useMemo(() => {
        const results = new Map();
        const billsByCustomer = new Map<string, any[]>();

        for (const b of bills) {
            const key = b.CUSTOMERKEY || b.individual_customer_id;
            if (key) {
                if (!billsByCustomer.has(key)) billsByCustomer.set(key, []);
                billsByCustomer.get(key)!.push(b);
            }
        }

        for (const [key, customerBills] of billsByCustomer.entries()) {
            const historyOldestFirst = [...customerBills].sort((a, b) => {
                const dateA = new Date(a.billPeriodEndDate || a.created_at || 0).getTime();
                const dateB = new Date(b.billPeriodEndDate || b.created_at || 0).getTime();
                if (dateA !== dateB) return dateA - dateB;
                const cA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const cB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return cA - cB;
            });

            let carriedForwardUnpaidPrincipal = 0;
            let d30_bucket_principal = 0;
            let d30_60_bucket_principal = 0;
            let d60_bucket_principal = 0;
            let lastBillUnpaidPenalty = 0;

            for (const bill of historyOldestFirst) {
                const currentPenalty = Number(bill.PENALTYAMT || 0);
                const currentMonthlyPrincipal = getMonthlyBillAmt(bill);
                const isVoided = bill.status === 'Deleted' || bill.status === 'Void';

                const legacyPrincipal = Math.max(0, carriedForwardUnpaidPrincipal - (d30_bucket_principal + d30_60_bucket_principal + d60_bucket_principal));
                const totalD60Principal = d60_bucket_principal + legacyPrincipal;

                // Reconstruct buckets as per user rule: Debit_60 = Principals 3+ mo + Recent Penalty
                const displayD60 = totalD60Principal + lastBillUnpaidPenalty;
                const derivedOutstanding = d30_bucket_principal + d30_60_bucket_principal + displayD60;
                const derivedTotalPayable = isVoided ? 0 : derivedOutstanding + currentMonthlyPrincipal + currentPenalty;

                results.set(bill.id, {
                    d30: d30_bucket_principal,
                    d30_60: d30_60_bucket_principal,
                    d60: displayD60,
                    penalty: currentPenalty,
                    outstanding: derivedOutstanding + currentPenalty, // Total arrears including current penalty
                    currentMonthly: currentMonthlyPrincipal,
                    totalPayable: derivedTotalPayable
                });

                const amtPaid = isVoided ? 0 : Number(bill.amountPaid || bill.amount_paid || bill.AMOUNTPAID || 0);
                
                // Calculate unpaid portions for next cycle
                const unpaidPrincipalThisMonth = Math.max(0, currentMonthlyPrincipal - Math.max(0, amtPaid - (d30_bucket_principal + d30_60_bucket_principal + totalD60Principal + lastBillUnpaidPenalty)));
                // Simplified payment logic: assume payment covers Arrears (Oldest First) then Current Principal then Current Penalty
                let remainingPayment = amtPaid;

                // 1. Pay against Oldest Arrears (Principal D60 then Last Penalty)
                const paidAgainstD60 = Math.min(remainingPayment, totalD60Principal);
                const remD60 = totalD60Principal - paidAgainstD60;
                remainingPayment -= paidAgainstD60;

                const paidAgainstLastPenalty = Math.min(remainingPayment, lastBillUnpaidPenalty);
                const remLastPenalty = lastBillUnpaidPenalty - paidAgainstLastPenalty;
                remainingPayment -= paidAgainstLastPenalty;

                // 2. Pay against D30_60
                const paidAgainstD30_60 = Math.min(remainingPayment, d30_60_bucket_principal);
                const remD30_60 = d30_60_bucket_principal - paidAgainstD30_60;
                remainingPayment -= paidAgainstD30_60;

                // 3. Pay against D30
                const paidAgainstD30 = Math.min(remainingPayment, d30_bucket_principal);
                const remD30 = d30_bucket_principal - paidAgainstD30;
                remainingPayment -= paidAgainstD30;

                // 4. Pay against Current Principal
                const paidAgainstCurrent = Math.min(remainingPayment, currentMonthlyPrincipal);
                const remCurrent = currentMonthlyPrincipal - paidAgainstCurrent;
                remainingPayment -= paidAgainstCurrent;

                // 5. Update the "All Historical Unpaid Penalties" for the next month's reconstruction
                const paidAgainstCurrentPenalty = Math.min(remainingPayment, currentPenalty);
                const unpaidCurrentPenalty = currentPenalty - paidAgainstCurrentPenalty;

                // Sum all unpaid penalties (older remaining + current unpaid)
                lastBillUnpaidPenalty = remLastPenalty + unpaidCurrentPenalty;

                // Update buckets for next month (Chronological shift)
                d60_bucket_principal = remD60 + remD30_60;
                d30_60_bucket_principal = remD30;
                d30_bucket_principal = remCurrent;
                carriedForwardUnpaidPrincipal = d60_bucket_principal + d30_60_bucket_principal + d30_bucket_principal;
            }
        }
        return results;
    }, [bills]);

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
    // Per business rules: Outstanding = all unpaid debt + current penalty
    // Total Payable = Outstanding + Current Bill
    const getBillTotalPayable = (b: any) => {
        const recon = reconstructedHistoryMap.get(b.id);
        if (recon) {
            return recon.outstanding + Math.max(0, recon.currentMonthly);
        }

        const d30 = Number(b.debit30 || b.debit_30 || 0);
        const d30_60 = Number(b.debit30_60 || b.debit_30_60 || 0);
        const d60 = Number(b.debit60 || b.debit_60 || 0);
        const totalUnpaidDebt = Number(b.OUTSTANDINGAMT ?? (d30 + d30_60 + d60));
        const penalty = Number(b.PENALTYAMT || 0);
        // Outstanding = all unpaid debt + current penalty
        const outstanding = totalUnpaidDebt + penalty;
        const current = getMonthlyBillAmt(b);
        // Total Payable = Outstanding + Current Bill
        return outstanding + current;
    };

    const now = new Date();

    // Aging Calculations based on unique customers in the filtered set
    // This avoids double-counting arrears if multiple bills for the same customer are in view (e.g. 'All Months' filter)
    const unpaidUniqueCustomers = Array.from(
        filteredForStats.filter(b => b.payment_status === 'Unpaid').reduce((map: Map<string, any>, b: any) => {
            const key = b.CUSTOMERKEY || b.individual_customer_id;
            if (!map.has(key) || new Date(b.created_at) > new Date(map.get(key).created_at)) {
                map.set(key, b);
            }
            return map;
        }, new Map<string, any>()).values()
    );

    const totalOutstandingUnpaid = unpaidUniqueCustomers.reduce((sum: number, b: any) => sum + getBillTotalPayable(b), 0);


    const totalPaidAmount = filteredForStats
        .filter(b => b.payment_status === 'Paid')
        .reduce((sum: number, b: any) => sum + getBillTotalPayable(b), 0);

    const totalInView = totalPaidAmount + totalOutstandingUnpaid;
    const collectionEfficiency = totalInView > 0 ? (totalPaidAmount / totalInView) * 100 : 0;

    const draftTotalAmount = filteredForStats
        .filter(b => b.status === 'Draft' || b.status === 'Rework')
        .reduce((sum: number, b: any) => sum + getBillTotalPayable(b), 0);
    const pendingTotalAmount = filteredForStats
        .filter(b => b.status === 'Pending')
        .reduce((sum: number, b: any) => sum + getBillTotalPayable(b), 0);
    const postedBillsCount = filteredForStats.filter(b => b.status === 'Posted').length;

    const myDraftsCount = filteredForStats.filter(b => b.status === 'Draft' || !b.status).length;
    const reworkItemsCount = filteredForStats.filter(b => b.status === 'Rework').length;
    const pendingApprovalsCount = filteredForStats.filter(b => b.status === 'Pending').length;

    const aging = unpaidUniqueCustomers.reduce((acc: any, b: any) => {
        const recon = reconstructedHistoryMap.get(b.id);
        if (recon) {
            acc.zeroToThirty += Number(recon.d30 || 0);
            acc.thirtyToSixty += Number(recon.d30_60 || 0);
            acc.sixtyPlus += Number(recon.d60 || 0);
        } else {
            const d30 = Number(b.debit30 || b.debit_30 || 0);
            const d30_60 = Number(b.debit30_60 || b.debit_30_60 || 0);
            const d60 = Number(b.debit60 || b.debit_60 || 0);
            acc.zeroToThirty += d30;
            acc.thirtyToSixty += d30_60;
            acc.sixtyPlus += d60;
        }
        return acc;
    }, { zeroToThirty: 0, thirtyToSixty: 0, sixtyPlus: 0 });

    const totalAgingDebt = aging.zeroToThirty + aging.thirtyToSixty + aging.sixtyPlus;


    // Filtered Outstanding List (Main Table) - Restricted to Recent Month or Selected Month
    const filteredOutstanding = filteredForStats
        .filter(b => b.status === 'Posted' && b.payment_status === 'Unpaid')
        .filter(b => monthFilter !== 'all' || b.month_year === latestMonth)
        .filter(b => {
            const isBillOverdue = b.due_date && isBefore(new Date(b.due_date), now);
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'overdue' && isBillOverdue) ||
                (statusFilter === 'unpaid' && !isBillOverdue);
            return matchesStatus;
        });

    // Filtered Paid List (Second Table) - Restricted to Recent Month or Selected Month
    const filteredPaid = filteredForStats
        .filter(b => b.status === 'Posted' && b.payment_status === 'Paid')
        .filter(b => monthFilter !== 'all' || b.month_year === latestMonth);

    const paginatedOutstanding = filteredOutstanding.slice(
        currentPage * itemsPerPage,
        (currentPage + 1) * itemsPerPage
    );

    const paginatedPaid = filteredPaid.slice(
        paidCurrentPage * paidItemsPerPage,
        (paidCurrentPage + 1) * paidItemsPerPage
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

                </div>
            </div>

            {/* Summary Statistics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                    title="Drafts & Rework"
                    value={`ETB ${draftTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    count={myDrafts.length + reworkItems.length}
                    icon={<Clock className="h-5 w-5 text-blue-500" />}
                    color="blue"
                />
                <StatsCard
                    title="Pending Approval"
                    value={`ETB ${pendingTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    count={pendingApprovals.length}
                    icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
                    color="amber"
                />
                <StatsCard
                    title="Total Outstanding"
                    value={`ETB ${totalOutstandingUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                postedCount={postedBillsCount}
                role={role}
                basePath={basePath}
                showApprovals={canViewPending}
                showReadyToPost={canViewApproved}
                onSubmitAll={canViewDrafts ? handleSubmitAll : undefined}
                onApproveAll={canViewPending ? handleApproveAll : undefined}
                onPostAll={canViewApproved ? handlePostAll : undefined}
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
                        <AgingBar label="Debit 30 (1 Mo)" value={aging.zeroToThirty} total={totalAgingDebt} color="bg-amber-400" />
                        <AgingBar label="Debit 30-60 (2 Mo)" value={aging.thirtyToSixty} total={totalAgingDebt} color="bg-orange-500" />
                        <AgingBar label="Debit 60+ (3+ Mo)" value={aging.sixtyPlus} total={totalAgingDebt} color="bg-red-600" />
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
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[10px] font-bold uppercase text-gray-400 ml-1">Filter by Month</Label>
                            <div className="flex items-center gap-2">
                                <DatePicker
                                    date={monthFilter === 'all' ? undefined : parse(monthFilter, 'yyyy-MM', new Date())}
                                    onSelect={(date) => {
                                        if (date) {
                                            setMonthFilter(format(date, 'yyyy-MM'));
                                        } else {
                                            setMonthFilter('all');
                                        }
                                    }}
                                    placeholder="Select Month"
                                />
                                {monthFilter !== 'all' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-10 px-2 text-gray-400 hover:text-gray-600"
                                        onClick={() => setMonthFilter('all')}
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>


            <Card className="shadow-sm border-gray-100 overflow-hidden">
                <CardHeader className="bg-gray-50/50 flex flex-row items-center justify-between border-b border-gray-100 py-3 px-5">
                    <CardTitle className="text-base font-bold text-gray-700">Outstanding Bills Table</CardTitle>
                    <div className="text-xs text-muted-foreground font-medium">
                        Showing {filteredOutstanding.length === 0 ? 0 : (currentPage * itemsPerPage + 1)}-{Math.min(filteredOutstanding.length, (currentPage + 1) * itemsPerPage)} of {filteredOutstanding.length} records
                    </div>

                </CardHeader>
                <CardContent className="p-0">
                    <BillTable
                        bills={paginatedOutstanding}
                        onDelete={handleDelete}
                        router={router}
                        basePath={basePath}
                        canDelete={hasPermission('bill:delete') || hasPermission('bill:manage_all')}
                        reconstructedHistoryMap={reconstructedHistoryMap}
                    />

                    {/* Pagination Controls */}
                    <TablePagination
                        count={filteredOutstanding.length}
                        page={currentPage}
                        rowsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onRowsPerPageChange={(val) => {
                            setItemsPerPage(val);
                            setCurrentPage(0);
                        }}
                    />


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
                        Showing {filteredPaid.length === 0 ? 0 : (paidCurrentPage * paidItemsPerPage + 1)}-{Math.min(filteredPaid.length, (paidCurrentPage + 1) * paidItemsPerPage)} of {filteredPaid.length} records
                    </div>

                </CardHeader>
                <CardContent className="p-0">
                    <BillTable
                        bills={paginatedPaid}
                        onDelete={handleDelete}
                        router={router}
                        basePath={basePath}
                        canDelete={hasPermission('bill:delete') || hasPermission('bill:manage_all')}
                        reconstructedHistoryMap={reconstructedHistoryMap}
                    />

                    {/* Pagination Controls for Paid */}
                    <TablePagination
                        count={filteredPaid.length}
                        page={paidCurrentPage}
                        rowsPerPage={paidItemsPerPage}
                        onPageChange={setPaidCurrentPage}
                        onRowsPerPageChange={(val) => {
                            setPaidItemsPerPage(val);
                            setPaidCurrentPage(0);
                        }}
                    />


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
function BillTable({ bills, onDelete, router, basePath, canDelete = false, reconstructedHistoryMap }: { bills: any[], onDelete: (id: string) => void, router: any, basePath: string, canDelete?: boolean, reconstructedHistoryMap?: Map<string, any> }) {
    if (bills.length === 0) return null;

    return (
        <>
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
                            <TableHead className="text-right text-[10px]">Debit_30</TableHead>
                            <TableHead className="text-right text-[10px]">Debit_30_60</TableHead>
                            <TableHead className="text-right text-[10px]">Debit_60</TableHead>
                            <TableHead className="text-right">Penalty</TableHead>
                            <TableHead className="text-right">Outstanding</TableHead>
                            <TableHead className="text-right">Current Bill</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Total Payable</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {bills.map((bill) => {
                            const now = new Date();
                            const isOverdue = bill.payment_status === 'Unpaid' && bill.due_date && isBefore(new Date(bill.due_date), now);
                            const recon = reconstructedHistoryMap?.get(bill.id);

                            const d30 = recon ? recon.d30 : Number(bill.debit_30 || bill.debit30 || 0);
                            const d30_60 = recon ? recon.d30_60 : Number(bill.debit_30_60 || bill.debit30_60 || 0);
                            const d60 = recon ? recon.d60 : Number(bill.debit_60 || bill.debit60 || 0);
                            const penaltyAmt = recon ? recon.penalty : Number(bill.PENALTYAMT || 0);

                            const currentOutstanding = recon ? recon.outstanding : Number(bill.OUTSTANDINGAMT ?? (d30 + d30_60 + d60)) + penaltyAmt;
                            const currentBillAmt = recon ? Math.max(0, recon.currentMonthly) : getMonthlyBillAmt(bill);
                            const totalPayable = currentOutstanding + currentBillAmt;


                            return (
                                <TableRow key={bill.id}>
                                    <TableCell className="font-medium text-xs">
                                        <Link href={`${basePath}/${bill.id}`} className="text-blue-600 hover:underline">
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
                                    <TableCell className="text-right text-[10px] text-gray-500">{Number(d30).toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-[10px] text-gray-500">{Number(d30_60).toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-[10px] text-gray-500">{Number(d60).toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-xs text-destructive font-medium">{Number(penaltyAmt).toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-xs">{currentOutstanding.toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-xs">{currentBillAmt.toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-xs font-bold whitespace-nowrap text-primary">
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
                                                <DropdownMenuItem onClick={() => router.push(`${basePath}/${bill.id}`)}>
                                                    <Eye className="mr-2 h-4 w-4" /> View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => router.push(`${basePath}/${bill.id}?print=true`)}>
                                                    <Printer className="mr-2 h-4 w-4" /> Print/Export Bill
                                                </DropdownMenuItem>
                                                {canDelete && (
                                                    <DropdownMenuItem
                                                        className="text-red-600 focus:text-red-600"
                                                        onClick={() => onDelete(bill.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="mx-4 mb-3 mt-1 p-2 rounded-md bg-muted/30 border border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground italic">
                <span className="font-semibold not-italic text-foreground/70">📝 Note: </span>
                Debit_30 = bill 1 month old  |  Debit_30_60 = bill 2 months old  |  Debit_60 = bill 3+ months old  |  Penalty applies to bills 3+ months old only  |  Outstanding = all unpaid debt + current penalty
            </div>
        </>
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
