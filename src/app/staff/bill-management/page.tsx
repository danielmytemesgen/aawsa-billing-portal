
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { getAllBillsAction, deleteBillAction } from '@/lib/actions';
import { usePermissions } from '@/hooks/use-permissions';
import { cn, formatDate } from '@/lib/utils';
import { format } from 'date-fns';
import { MoreVertical, Printer, Trash2, Eye, Loader2, RefreshCcw } from 'lucide-react';
import { BillingCycleDialog } from './billing-cycle-dialog';

interface BillManagementPageProps {
    basePath?: string;
}

export default function BillManagementPage({ basePath = '/staff/bill-management' }: BillManagementPageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const [myDrafts, setMyDrafts] = useState<any[]>([]);
    const [awaitingPaymentBills, setAwaitingPaymentBills] = useState<any[]>([]);
    const [overdueBills, setOverdueBills] = useState<any[]>([]);
    const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
    const [reworkItems, setReworkItems] = useState<any[]>([]);
    const [approvedBills, setApprovedBills] = useState<any[]>([]);
    const [postedBills, setPostedBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCycleDialogOpen, setIsCycleDialogOpen] = useState(false);

    const BillTable = ({ bills }: { bills: any[] }) => {
        if (bills.length === 0) return <p className="text-sm text-gray-400 py-4 text-center border rounded-md border-dashed">No bills to display.</p>;

        const handleDelete = async (id: string) => {
            if (!confirm("Are you sure you want to delete this bill record?")) return;
            try {
                const res = await deleteBillAction(id);
                if (res.data) {
                    toast({ title: "Deleted", description: "Bill record removed successfully." });
                    // Refresh data
                    window.location.reload();
                } else {
                    toast({ title: "Error", description: res.error?.message || "Failed to delete", variant: "destructive" });
                }
            } catch (e) {
                console.error(e);
            }
        };

        return (
            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="w-[100px]">ID / Meter</TableHead>
                            <TableHead>Month</TableHead>
                            <TableHead>Date Billed</TableHead>
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
                            const isOverdue = bill.payment_status === 'Unpaid' && new Date(bill.due_date) < new Date();
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
                                                    onClick={() => handleDelete(bill.id)}
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
    };

    useEffect(() => {
        async function loadData() {
            try {
                const billsRes = await getAllBillsAction();
                if (billsRes.data) {
                    const allBills = billsRes.data;

                    // Filter based on status and permissions
                    if (hasPermission('bill:view_drafts')) {
                        setMyDrafts(allBills.filter((b: any) => b.status === 'Draft' || !b.status));
                    }

                    if (hasPermission('bill:view_pending') || hasPermission('bill:approve')) {
                        setPendingApprovals(allBills.filter((b: any) => b.status === 'Pending'));
                    }

                    if (hasPermission('bill:rework')) {
                        setReworkItems(allBills.filter((b: any) => b.status === 'Rework'));
                    }

                    // Approved/Posted logic
                    // 'Ready to Post' are Approved bills
                    if (hasPermission('bill:view_approved') || hasPermission('bill:send') || hasPermission('bill:post') || hasPermission('bill:approve')) {
                        setApprovedBills(allBills.filter((b: any) => b.status === 'Approved'));
                    }

                    // Recent Paid Bills (usually only Posted bills can be Paid but being safe)
                    if (hasPermission('bill:view_paid')) {
                        const paid = allBills.filter((b: any) => b.payment_status === 'Paid');
                        setPostedBills(paid.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10));
                    }

                    // Posted or Approved bills that are unpaid are "Outstanding"
                    const outstanding = allBills.filter((b: any) => (b.status === 'Posted' || b.status === 'Approved') && b.payment_status === 'Unpaid');

                    if (hasPermission('bill:view_awaiting_payment')) {
                        setAwaitingPaymentBills(outstanding.filter((b: any) => !b.due_date || new Date(b.due_date) >= new Date()));
                    }

                    if (hasPermission('bill:view_overdue')) {
                        setOverdueBills(outstanding.filter((b: any) => b.due_date && new Date(b.due_date) < new Date()));
                    }
                }
            } catch (error) {
                console.error("Failed to load bills", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [hasPermission]);

    if (loading) return <div className="p-8">Loading dashboard...</div>;

    // Derived role string for the TaskBoard component based on permissions
    const role = hasPermission('bill:approve') ? 'manager' : 'staff';

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Bill Management</h1>
                    <p className="text-gray-500">Manage billing workflow, approvals, and status tracking.</p>
                </div>
                {hasPermission('billing:close_cycle') && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsCycleDialogOpen(true)}>
                            <RefreshCcw className="mr-2 h-4 w-4" /> Run Billing Cycle
                        </Button>
                        {hasPermission('bill:create') && (
                            <Link href="/staff/bill-management/create">
                                <Button>Create New Bill</Button>
                            </Link>
                        )}
                    </div>
                )}
                {!hasPermission('billing:close_cycle') && hasPermission('bill:create') && (
                    <Link href="/staff/bill-management/create">
                        <Button>Create New Bill</Button>
                    </Link>
                )}
            </div>

            <BillingCycleDialog
                open={isCycleDialogOpen}
                onOpenChange={setIsCycleDialogOpen}
                onComplete={() => window.location.reload()}
            />

            <BillTaskBoard
                myDrafts={myDrafts}
                pendingApprovals={pendingApprovals}
                reworkItems={reworkItems}
                approvedBills={approvedBills}
                role={role}
                basePath={basePath}
                showApprovals={hasPermission('bill:view_pending') || hasPermission('bill:approve')}
                showReadyToPost={hasPermission('bill:view_approved') || hasPermission('bill:send') || hasPermission('bill:post') || hasPermission('bill:approve')}
            />

            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                    {hasPermission('bill:view_awaiting_payment') && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                Outstanding Bills
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    {awaitingPaymentBills.length + overdueBills.length}
                                </Badge>
                            </h3>
                            <BillTable bills={[...overdueBills, ...awaitingPaymentBills]} />
                        </div>
                    )}

                    {hasPermission('bill:view_paid') && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                Recent Paid Bills
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    {postedBills.length}
                                </Badge>
                            </h3>
                            <BillTable bills={postedBills} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
