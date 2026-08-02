
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    FileText,
    Clock,
    CheckCircle2,
    Send,
    Lock,
    ArrowRight,
    GitBranch,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface TaskBill {
    id: string;
    bill_number?: string;
    individual_customer_id?: string;
    CUSTOMERKEY?: string;
    TOTALBILLAMOUNT: number;
    status: string;
    created_at: string;
    branch_name?: string;
}

interface BillTaskBoardProps {
    myDrafts: TaskBill[];
    pendingApprovals: TaskBill[];
    reworkItems: TaskBill[];
    approvedBills: TaskBill[];
    postedCount?: number;
    role?: string;
    basePath?: string;
    showApprovals?: boolean;
    showReadyToPost?: boolean;
    onSubmitAll?: () => Promise<void>;
    onApproveAll?: () => Promise<void>;
    onPostAll?: () => Promise<void>;
}

const PAGE_SIZE = 5;

export function BillTaskBoard({
    myDrafts,
    pendingApprovals,
    reworkItems,
    approvedBills,
    postedCount = 0,
    basePath = '/staff/bill-management',
    showApprovals = false,
    showReadyToPost = false,
    onSubmitAll,
    onApproveAll,
    onPostAll,
}: BillTaskBoardProps) {

    const myTasks = [
        ...reworkItems.map(b => ({ ...b, cardType: 'rework' as const })),
        ...myDrafts.map(b => ({ ...b, cardType: 'draft' as const }))
    ];

    const totalDrafts = myTasks.length;
    const totalPending = pendingApprovals.length;
    const totalApproved = approvedBills.length;

    const stages = [
        { label: 'Draft / Rework', count: totalDrafts, icon: <FileText className="h-3.5 w-3.5" />, color: 'blue' },
        { label: 'Pending Approval', count: totalPending, icon: <Clock className="h-3.5 w-3.5" />, color: 'amber' },
        { label: 'Approved', count: totalApproved, icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'green' },
        { label: 'Posted', count: postedCount, icon: <Send className="h-3.5 w-3.5" />, color: 'indigo' },
    ];

    const stageColorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-600' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-500' },
        green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-600' },
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-600' },
    };

    return (
        <div className="space-y-4">
            {/* Workflow Progress Bar */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Billing Pipeline Status</p>
                <div className="flex items-center gap-1">
                    {stages.map((stage, idx) => {
                        const colors = stageColorMap[stage.color];
                        return (
                            <React.Fragment key={stage.label}>
                                <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border ${colors.bg} ${colors.border}`}>
                                    <div className={`p-1 rounded-md ${colors.badge} text-white flex-shrink-0`}>
                                        {stage.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-semibold text-gray-500 truncate">{stage.label}</p>
                                        <p className={`text-base font-extrabold ${colors.text} leading-none`}>{stage.count}</p>
                                    </div>
                                </div>
                                {idx < stages.length - 1 && (
                                    <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* My Tasks Column */}
                <TaskColumn
                    title="My Tasks"
                    items={myTasks}
                    color="blue"
                    basePath={basePath}
                    isLocked={false}
                    emptyIcon={<FileText className="h-8 w-8 text-blue-200" />}
                    emptyMessage="No drafts or rework items"
                    emptyHint="Create a new bill to get started."
                    renderItem={(item) => (
                        <TaskCard
                            key={item.id}
                            bill={item}
                            type={item.cardType}
                            basePath={basePath}
                        />
                    )}
                    bulkActionLabel="Submit All for Approval"
                    bulkActionClassName="bg-blue-600 hover:bg-blue-700 text-white"
                    onBulkAction={onSubmitAll}
                />

                {/* Pending Approvals Column */}
                <TaskColumn
                    title="Awaiting Approval"
                    items={showApprovals ? pendingApprovals : []}
                    color="amber"
                    basePath={basePath}
                    isLocked={!showApprovals}
                    emptyIcon={<Clock className="h-8 w-8 text-amber-200" />}
                    emptyMessage="No bills awaiting approval"
                    emptyHint="Bills submitted for review will appear here."
                    renderItem={(item) => (
                        <TaskCard
                            key={item.id}
                            bill={item}
                            type="approval"
                            basePath={basePath}
                        />
                    )}
                    bulkActionLabel="Approve All Invoices"
                    bulkActionClassName="bg-amber-500 hover:bg-amber-600 text-white"
                    onBulkAction={showApprovals ? onApproveAll : undefined}
                />

                {/* Ready to Post Column */}
                <TaskColumn
                    title="Ready to Post"
                    items={showReadyToPost ? approvedBills : []}
                    color="green"
                    basePath={basePath}
                    isLocked={!showReadyToPost}
                    emptyIcon={<CheckCircle2 className="h-8 w-8 text-green-200" />}
                    emptyMessage="No bills ready to post"
                    emptyHint="Approved bills will appear here for final posting."
                    renderItem={(item) => (
                        <TaskCard
                            key={item.id}
                            bill={item}
                            type="approved"
                            basePath={basePath}
                        />
                    )}
                    bulkActionLabel="Post & Finalize All Bills"
                    bulkActionClassName="bg-green-600 hover:bg-green-700 text-white"
                    onBulkAction={showReadyToPost ? onPostAll : undefined}
                />
            </div>
        </div>
    );
}

interface TaskColumnProps {
    title: string;
    items: any[];
    color: string;
    basePath: string;
    isLocked: boolean;
    emptyIcon: React.ReactNode;
    emptyMessage: string;
    emptyHint: string;
    renderItem: (item: any) => React.ReactNode;
    bulkActionLabel?: string;
    bulkActionClassName?: string;
    onBulkAction?: () => Promise<void>;
}

const columnColorMap: Record<string, { bg: string; border: string; header: string; badge: string }> = {
    blue: {
        bg: 'bg-blue-50/70',
        border: 'border-blue-100',
        header: 'text-blue-900',
        badge: 'bg-blue-600',
    },
    amber: {
        bg: 'bg-amber-50/70',
        border: 'border-amber-100',
        header: 'text-amber-900',
        badge: 'bg-amber-500',
    },
    green: {
        bg: 'bg-green-50/70',
        border: 'border-green-100',
        header: 'text-green-900',
        badge: 'bg-green-600',
    },
};

function TaskColumn({
    title,
    items,
    color,
    renderItem,
    isLocked,
    emptyIcon,
    emptyMessage,
    emptyHint,
    bulkActionLabel,
    bulkActionClassName,
    onBulkAction,
}: TaskColumnProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    const totalPages = Math.ceil(items.length / PAGE_SIZE);

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const visibleItems = items.slice(startIndex, startIndex + PAGE_SIZE);

    const colors = columnColorMap[color] ?? columnColorMap['blue'];

    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [items.length, totalPages, currentPage]);

    const handleBulkAction = async () => {
        if (!onBulkAction) return;
        setIsBulkLoading(true);
        try {
            await onBulkAction();
        } finally {
            setIsBulkLoading(false);
        }
    };

    return (
        <div className={`relative ${colors.bg} p-4 rounded-xl border ${colors.border} flex flex-col min-h-[450px] ${isLocked ? 'opacity-60' : ''}`}>
            {/* Lock overlay */}
            {isLocked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/40 backdrop-blur-[1px] z-10 gap-2">
                    <div className="p-2 bg-gray-100 rounded-full">
                        <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-xs font-semibold text-gray-500">No access to this column</p>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className={`font-bold text-sm ${colors.header} flex items-center gap-2 uppercase tracking-tight`}>
                    {title}
                    <span className={`${colors.badge} text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm`}>
                        {items.length}
                    </span>
                </h3>

                {totalPages > 1 && (
                    <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded-md border shadow-sm">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-gray-100"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <span className="text-[10px] text-gray-500 font-bold min-w-[24px] text-center">
                            {currentPage} / {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-gray-100"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-3 w-3" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Items */}
            <div className="flex flex-col gap-2.5 flex-1">
                {visibleItems.map(renderItem)}

                {/* Empty State */}
                {items.length === 0 && !isLocked && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-70">
                        {emptyIcon}
                        <p className="text-xs font-semibold text-gray-600 text-center">{emptyMessage}</p>
                        <p className="text-[10px] text-gray-400 text-center px-4">{emptyHint}</p>
                    </div>
                )}
            </div>

            {/* Bulk Action Button — always shown when action is available, disabled when list is empty */}
            {bulkActionLabel && onBulkAction && !isLocked && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                    <Button
                        className={`w-full h-9 text-[12px] font-bold shadow-sm ${items.length > 0 ? bulkActionClassName : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                        onClick={handleBulkAction}
                        disabled={isBulkLoading || items.length === 0}
                    >
                        {isBulkLoading ? (
                            <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                Processing...
                            </>
                        ) : items.length === 0 ? (
                            `${bulkActionLabel} (0)`
                        ) : (
                            `${bulkActionLabel} (${items.length})`
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}

function TaskCard({ bill, type, basePath }: { bill: TaskBill, type: 'draft' | 'rework' | 'approval' | 'approved', basePath: string }) {
    const isRework = type === 'rework';
    const isApproved = type === 'approved';
    const isDraft = type === 'draft';

    const borderColor = isRework
        ? 'border-l-red-500'
        : isApproved
            ? 'border-l-green-500'
            : isDraft
                ? 'border-l-blue-400'
                : 'border-l-amber-400';

    const buttonLabel = type === 'approval'
        ? 'Review Bill'
        : type === 'rework'
            ? 'Edit & Resubmit'
            : type === 'approved'
                ? 'Post Bill'
                : 'Edit Draft';

    const buttonClass = isApproved
        ? 'bg-green-600 hover:bg-green-700 border-green-600 text-white'
        : type === 'approval'
            ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white'
            : isRework
                ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                : '';

    return (
        <div className={`bg-white p-3 rounded-lg border shadow-sm transition-all hover:shadow-md border-gray-100 border-l-4 ${borderColor}`}>
            <div className="flex justify-between items-start mb-1.5">
                <span className="font-bold text-xs text-gray-900 truncate">
                    {bill.CUSTOMERKEY || bill.individual_customer_id}
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase flex-shrink-0 ml-1">
                    {formatDate(bill.created_at)}
                </span>
            </div>

            {/* Branch badge */}
            {bill.branch_name && (
                <div className="flex items-center gap-1 mb-1.5">
                    <GitBranch className="h-2.5 w-2.5 text-gray-400" />
                    <span className="text-[10px] text-gray-500 font-medium truncate">{bill.branch_name}</span>
                </div>
            )}

            <div className="text-[11px] text-gray-600 mb-3 font-semibold">
                Amount: <span className="text-gray-900 font-bold text-xs">ETB {Number(bill.TOTALBILLAMOUNT || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <Link href={`${basePath}/${bill.id}`} passHref>
                <Button
                    size="sm"
                    variant={type === 'approval' || type === 'approved' ? 'default' : 'outline'}
                    className={`w-full h-8 text-[11px] font-bold shadow-sm ${buttonClass}`}
                >
                    {buttonLabel}
                </Button>
            </Link>
        </div>
    );
}
