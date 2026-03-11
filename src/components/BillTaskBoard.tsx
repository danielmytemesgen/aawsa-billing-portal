
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface TaskBill {
    id: string;
    bill_number?: string;
    individual_customer_id?: string;
    CUSTOMERKEY?: string;
    TOTALBILLAMOUNT: number;
    status: string;
    created_at: string;
}

interface BillTaskBoardProps {
    myDrafts: TaskBill[];
    pendingApprovals: TaskBill[];
    reworkItems: TaskBill[];
    approvedBills: TaskBill[];
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

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* My Tasks Column */}
            <TaskColumn
                title="My Tasks"
                items={myTasks}
                color="blue"
                basePath={basePath}
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
            {showApprovals && (
                <TaskColumn
                    title="Awaiting Approval"
                    items={pendingApprovals}
                    color="amber"
                    basePath={basePath}
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
                    onBulkAction={onApproveAll}
                />
            )}

            {/* Ready to Post Column */}
            {showReadyToPost && (
                <TaskColumn
                    title="Ready to Post"
                    items={approvedBills}
                    color="green"
                    basePath={basePath}
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
                    onBulkAction={onPostAll}
                />
            )}
        </div>
    );
}

interface TaskColumnProps {
    title: string;
    items: any[];
    color: string;
    basePath: string;
    renderItem: (item: any) => React.ReactNode;
    bulkActionLabel?: string;
    bulkActionClassName?: string;
    onBulkAction?: () => Promise<void>;
}

function TaskColumn({ title, items, color, renderItem, bulkActionLabel, bulkActionClassName, onBulkAction }: TaskColumnProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    const totalPages = Math.ceil(items.length / PAGE_SIZE);

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const visibleItems = items.slice(startIndex, startIndex + PAGE_SIZE);

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
        <div className={`bg-${color}-50 p-4 rounded-lg border border-${color}-100 flex flex-col h-full min-h-[450px]`}>
            <div className="flex justify-between items-center mb-4">
                <h3 className={`font-bold text-sm text-${color}-900 flex items-center gap-2 uppercase tracking-tight`}>
                    {title}
                    <span className="bg-white text-gray-700 px-2 py-0.5 rounded-full text-[10px] border shadow-sm font-bold">
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

            <div className="flex flex-col gap-2.5 flex-1">
                {visibleItems.map(renderItem)}
                {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 opacity-60">
                        <p className="text-xs text-gray-500 font-medium">No pending tasks</p>
                    </div>
                )}
            </div>

            {/* Bulk Action Button — only shown when items exist */}
            {bulkActionLabel && onBulkAction && items.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                    <Button
                        className={`w-full h-9 text-[12px] font-bold shadow-sm ${bulkActionClassName}`}
                        onClick={handleBulkAction}
                        disabled={isBulkLoading}
                    >
                        {isBulkLoading ? (
                            <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            bulkActionLabel
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

    return (
        <div className={`bg-white p-3 rounded-lg border shadow-sm transition-all hover:shadow-md border-gray-100 ${isRework ? 'border-l-4 border-l-red-500' :
            isApproved ? 'border-l-4 border-l-green-500' :
                isDraft ? 'border-l-4 border-l-blue-400' : 'border-l-4 border-l-amber-400'
            }`}>
            <div className="flex justify-between items-start mb-1.5">
                <span className="font-bold text-xs text-gray-900 truncate">
                    {bill.CUSTOMERKEY || bill.individual_customer_id}
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase">
                    {formatDate(bill.created_at)}
                </span>
            </div>

            <div className="text-[11px] text-gray-600 mb-3 font-semibold">
                Amount: <span className="text-gray-900 font-bold text-xs">ETB {Number(bill.TOTALBILLAMOUNT || 0).toFixed(2)}</span>
            </div>

            <Link href={`${basePath}/${bill.id}`} passHref>
                <Button
                    size="sm"
                    variant={type === 'approval' || type === 'approved' ? 'default' : 'outline'}
                    className={`w-full h-8 text-[11px] font-bold shadow-sm ${isApproved ? 'bg-green-600 hover:bg-green-700 border-green-600' :
                        type === 'approval' ? 'bg-amber-500 hover:bg-amber-600 border-amber-500' : ''
                        }`}
                >
                    {type === 'approval' ? 'Review Bill' :
                        type === 'rework' ? 'Fix Reading' :
                            type === 'approved' ? 'Post Bill' : 'Edit Draft'}
                </Button>
            </Link>
        </div>
    );
}
