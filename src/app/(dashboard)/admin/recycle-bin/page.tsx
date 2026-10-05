"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Trash2,
    RotateCcw,
    Trash,
    AlertTriangle,
    Search,
    RefreshCw,
    Filter,
    X,
    Calendar,
    Building2,
    Layers,
    CheckSquare,
    Loader2
} from 'lucide-react';
import { format, isToday, isYesterday, subDays, startOfMonth } from 'date-fns';
import {
    getRecycleBinItemsAction,
    restoreFromRecycleBinAction,
    permanentlyDeleteFromRecycleBinAction,
    restoreFromRecycleBinBulkAction,
    permanentlyDeleteFromRecycleBinBulkAction,
    getBranchesLookupAction
} from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
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
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface RecycleBinItem {
    id: string;
    entity_type: string;
    entity_id: string;
    entity_name: string;
    deleted_at: string;
    deleted_by: string;
    deleted_by_name: string;
    original_data: any;
    branch_id?: string;
    branch_name?: string;
}

interface Branch {
    id: string;
    name: string;
}

export default function RecycleBinPage() {
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const [items, setItems] = useState<RecycleBinItem[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedType, setSelectedType] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [customDate, setCustomDate] = useState('');

    // Selection state for batch operations
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Action execution state
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkRestoring, setIsBulkRestoring] = useState(false);

    // Dialog state for batch operations
    const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = useState(false);
    const [isBatchRestoreDialogOpen, setIsBatchRestoreDialogOpen] = useState(false);
    const [singleItemToDelete, setSingleItemToDelete] = useState<RecycleBinItem | null>(null);

    // Load branches
    useEffect(() => {
        getBranchesLookupAction()
            .then((res) => {
                if (res.data) setBranches(res.data);
            })
            .catch(console.error);
    }, []);

    // Create branch lookup map (UUID -> Name)
    const branchesMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const b of branches) {
            map.set(b.id, b.name);
        }
        return map;
    }, [branches]);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await getRecycleBinItemsAction();
            if (error) throw error;
            setItems(data || []);
            // Clear selection on refresh
            setSelectedIds(new Set());
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch items: ${e.message}` });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (hasPermission('settings_manage')) {
            fetchItems();
        }
    }, [fetchItems, hasPermission]);

    // Auto-refresh when DataRefreshProvider signals new data
    useEffect(() => {
        const handleDataRefreshed = () => {
            if (hasPermission('settings_manage')) {
                fetchItems();
            }
        };
        window.addEventListener('data-refreshed', handleDataRefreshed);
        return () => window.removeEventListener('data-refreshed', handleDataRefreshed);
    }, [fetchItems, hasPermission]);

    // Helper to resolve an item's branch ID and Name
    const getItemBranch = useCallback((item: RecycleBinItem): { id?: string; name?: string } => {
        const orig = item.original_data || {};
        const rawBranchName = orig.CUSTOMERBRANCH || orig.branch_name || orig.CUSTOMER_BRANCH;
        const rawBranchId = orig.branch_id || orig.branchId || item.branch_id;

        if (rawBranchId && branchesMap.has(rawBranchId)) {
            return { id: rawBranchId, name: branchesMap.get(rawBranchId) };
        }
        if (rawBranchName) {
            for (const [id, name] of branchesMap.entries()) {
                if (name.toLowerCase() === String(rawBranchName).toLowerCase()) {
                    return { id, name };
                }
            }
            return { name: rawBranchName };
        }
        if (rawBranchId) {
            return { id: rawBranchId };
        }
        return {};
    }, [branchesMap]);

    // Available entity types present in the loaded items
    const availableTypes = useMemo(() => {
        const types = new Set<string>();
        for (const item of items) {
            if (item.entity_type) types.add(item.entity_type);
        }
        return Array.from(types).sort();
    }, [items]);

    // Filter items based on active criteria
    const filteredItems = useMemo(() => {
        const selectedBranchObj = branches.find((b) => b.id === selectedBranch);
        const selectedBranchName = selectedBranchObj?.name;

        return items.filter((item) => {
            // 1. Text Search Query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchesSearch =
                    item.entity_name?.toLowerCase().includes(query) ||
                    item.entity_type?.toLowerCase().includes(query) ||
                    item.entity_id?.toLowerCase().includes(query) ||
                    item.deleted_by_name?.toLowerCase().includes(query);
                if (!matchesSearch) return false;
            }

            // 2. Branch Filter
            if (selectedBranch !== 'all') {
                const itemBranch = getItemBranch(item);
                const matchesBranch =
                    itemBranch.id === selectedBranch ||
                    (selectedBranchName && itemBranch.name?.toLowerCase() === selectedBranchName.toLowerCase());
                if (!matchesBranch) return false;
            }

            // 3. Entity Type Filter
            if (selectedType !== 'all') {
                if (item.entity_type !== selectedType) return false;
            }

            // 4. Date Filter
            if (dateFilter !== 'all') {
                const itemDate = new Date(item.deleted_at);
                if (isNaN(itemDate.getTime())) return true;

                if (dateFilter === 'today') {
                    if (!isToday(itemDate)) return false;
                } else if (dateFilter === 'yesterday') {
                    if (!isYesterday(itemDate)) return false;
                } else if (dateFilter === 'last_7_days') {
                    const sevenDaysAgo = subDays(new Date(), 7);
                    if (itemDate < sevenDaysAgo) return false;
                } else if (dateFilter === 'this_month') {
                    const startMonth = startOfMonth(new Date());
                    if (itemDate < startMonth) return false;
                } else if (dateFilter === 'specific_date' && customDate) {
                    const itemFormatted = format(itemDate, 'yyyy-MM-dd');
                    if (itemFormatted !== customDate) return false;
                }
            }

            return true;
        });
    }, [items, searchQuery, selectedBranch, selectedType, dateFilter, customDate, branches, getItemBranch]);

    const activeFiltersCount = (searchQuery ? 1 : 0) +
        (selectedBranch !== 'all' ? 1 : 0) +
        (selectedType !== 'all' ? 1 : 0) +
        (dateFilter !== 'all' ? 1 : 0);

    const handleResetFilters = () => {
        setSearchQuery('');
        setSelectedBranch('all');
        setSelectedType('all');
        setDateFilter('all');
        setCustomDate('');
    };

    // Selection Handlers
    const isAllFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));
    const isSomeFilteredSelected = filteredItems.some((item) => selectedIds.has(item.id)) && !isAllFilteredSelected;

    const handleSelectAllToggle = () => {
        if (isAllFilteredSelected) {
            // Deselect all filtered
            setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const item of filteredItems) {
                    next.delete(item.id);
                }
                return next;
            });
        } else {
            // Select all filtered
            setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const item of filteredItems) {
                    next.add(item.id);
                }
                return next;
            });
        }
    };

    const handleToggleItem = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Single item restore
    const handleRestoreSingle = async (id: string) => {
        setActionLoading(id);
        try {
            const { error } = await restoreFromRecycleBinAction(id);
            if (error) throw error;
            toast({ title: 'Success', description: 'Item restored successfully.' });
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            fetchItems();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to restore: ${e.message}` });
        } finally {
            setActionLoading(null);
        }
    };

    // Single item permanent delete
    const handlePermanentDeleteSingle = async (id: string) => {
        setActionLoading(id);
        try {
            const { error } = await permanentlyDeleteFromRecycleBinAction(id);
            if (error) throw error;
            toast({ title: 'Success', description: 'Item permanently deleted.' });
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setSingleItemToDelete(null);
            fetchItems();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to delete: ${e.message}` });
        } finally {
            setActionLoading(null);
        }
    };

    // Bulk permanent delete
    const handleConfirmBatchDelete = async () => {
        const idsToDelete = Array.from(selectedIds);
        if (idsToDelete.length === 0) return;

        setIsBulkDeleting(true);
        try {
            const res = await permanentlyDeleteFromRecycleBinBulkAction(idsToDelete);
            if (res.error) throw new Error(res.error.message);

            toast({
                title: 'Permanent Deletion Complete',
                description: `Successfully permanently deleted ${res.data?.deletedCount || idsToDelete.length} records.`,
            });
            setSelectedIds(new Set());
            setIsBatchDeleteDialogOpen(false);
            fetchItems();
        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: 'Bulk Deletion Failed',
                description: err.message || 'Failed to delete selected items.',
            });
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Bulk restore
    const handleConfirmBatchRestore = async () => {
        const idsToRestore = Array.from(selectedIds);
        if (idsToRestore.length === 0) return;

        setIsBulkRestoring(true);
        try {
            const res = await restoreFromRecycleBinBulkAction(idsToRestore);
            if (res.error) throw new Error(res.error.message);

            toast({
                title: 'Batch Restore Complete',
                description: `Successfully restored ${res.data?.restoredCount || idsToRestore.length} records.`,
            });
            setSelectedIds(new Set());
            setIsBatchRestoreDialogOpen(false);
            fetchItems();
        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: 'Bulk Restore Failed',
                description: err.message || 'Failed to restore selected items.',
            });
        } finally {
            setIsBulkRestoring(false);
        }
    };

    // Quick select all filtered
    const handleSelectAllFiltered = () => {
        const next = new Set(selectedIds);
        for (const item of filteredItems) {
            next.add(item.id);
        }
        setSelectedIds(next);
    };

    if (!hasPermission('settings_manage')) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <UIAlertDescription>
                        You do not have permission to access the Recycle Bin.
                    </UIAlertDescription>
                </Alert>
            </div>
        );
    }

    const getEntityTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            staff: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
            branch: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
            customer: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
            bulk_meter: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
            route: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
            bill: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
            payment: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
            reading_individual: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
            reading_bulk: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
        };
        return (
            <Badge variant="outline" className={`font-mono text-[10px] tracking-wider font-semibold ${colors[type] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                {type.replace('_', ' ').toUpperCase()}
            </Badge>
        );
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
                        <Trash2 className="h-8 w-8 text-primary" />
                        Recycle Bin
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage soft-deleted records. Filter by branch, date, or type to restore them or permanently delete them in batch.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchItems}
                        disabled={loading}
                        className="gap-2 shadow-sm"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                        <Filter className="h-4 w-4 text-primary" />
                        <span>Filter Recycle Bin Records</span>
                        {activeFiltersCount > 0 && (
                            <Badge variant="secondary" className="text-xs h-5 px-1.5 font-bold">
                                {activeFiltersCount} active
                            </Badge>
                        )}
                    </div>
                    {activeFiltersCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetFilters}
                            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                            <X className="h-3.5 w-3.5" />
                            Reset Filters
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. Search Query */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, ID, or user..."
                            className="pl-8 h-9 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* 2. Branch Filter */}
                    <div>
                        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger className="h-9 text-sm">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground mr-1.5 shrink-0" />
                                <SelectValue placeholder="Branch: All Branches" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Branches</SelectItem>
                                {branches.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 3. Entity Type Filter */}
                    <div>
                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger className="h-9 text-sm">
                                <Layers className="h-3.5 w-3.5 text-muted-foreground mr-1.5 shrink-0" />
                                <SelectValue placeholder="Type: All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {availableTypes.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {t.replace('_', ' ').toUpperCase()}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 4. Date Filter */}
                    <div>
                        <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger className="h-9 text-sm">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground mr-1.5 shrink-0" />
                                <SelectValue placeholder="Date: All Time" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="yesterday">Yesterday</SelectItem>
                                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                                <SelectItem value="this_month">This Month</SelectItem>
                                <SelectItem value="specific_date">Specific Date...</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Specific Date input if selected */}
                {dateFilter === 'specific_date' && (
                    <div className="flex items-center gap-3 pt-1">
                        <span className="text-xs font-medium text-muted-foreground">Select Date:</span>
                        <Input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="h-8 max-w-[200px] text-xs"
                        />
                    </div>
                )}
            </div>

            {/* Active Batch Action Bar */}
            {selectedIds.size > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2.5">
                        <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-semibold text-blue-950 dark:text-blue-100">
                            {selectedIds.size} of {filteredItems.length} record{selectedIds.size === 1 ? '' : 's'} selected
                        </span>
                        {selectedIds.size < filteredItems.length && (
                            <Button
                                variant="link"
                                size="sm"
                                onClick={handleSelectAllFiltered}
                                className="h-auto p-0 text-xs text-blue-600 dark:text-blue-400 font-medium underline"
                            >
                                Select all {filteredItems.length} filtered
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedIds(new Set())}
                            className="h-8 text-xs text-gray-600 dark:text-gray-300"
                        >
                            Deselect All
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsBatchRestoreDialogOpen(true)}
                            disabled={isBulkRestoring || isBulkDeleting}
                            className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/50 gap-1.5"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore Selected ({selectedIds.size})
                        </Button>

                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setIsBatchDeleteDialogOpen(true)}
                            disabled={isBulkRestoring || isBulkDeleting}
                            className="h-8 text-xs gap-1.5 shadow-sm"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Permanently ({selectedIds.size})
                        </Button>
                    </div>
                </div>
            )}

            {/* Quick Bulk Delete Shortcut when filters are active and no items explicitly checked */}
            {selectedIds.size === 0 && activeFiltersCount > 0 && filteredItems.length > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900 border rounded-lg p-2.5 px-3">
                    <span>
                        Found <b>{filteredItems.length}</b> record{filteredItems.length === 1 ? '' : 's'} matching current filters.
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllFiltered}
                        className="h-7 text-xs border-dashed gap-1 text-primary hover:text-primary"
                    >
                        <CheckSquare className="h-3.5 w-3.5" />
                        Select All Filtered ({filteredItems.length})
                    </Button>
                </div>
            )}

            {/* Main Table */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[45px] text-center">
                                <Checkbox
                                    checked={isAllFilteredSelected ? true : isSomeFilteredSelected ? "indeterminate" : false}
                                    onCheckedChange={handleSelectAllToggle}
                                    aria-label="Select all"
                                    disabled={filteredItems.length === 0}
                                />
                            </TableHead>
                            <TableHead className="w-[120px]">Type</TableHead>
                            <TableHead>Identifier / Name</TableHead>
                            <TableHead className="w-[150px]">Branch</TableHead>
                            <TableHead className="w-[170px]">Deleted At</TableHead>
                            <TableHead className="w-[170px]">Deleted By</TableHead>
                            <TableHead className="text-right w-[200px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm font-medium">Loading recycle bin records...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredItems.length > 0 ? (
                            filteredItems.map((item) => {
                                const isSelected = selectedIds.has(item.id);
                                const itemBranch = getItemBranch(item);

                                return (
                                    <TableRow
                                        key={item.id}
                                        className={`hover:bg-muted/40 transition-colors ${isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
                                    >
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => handleToggleItem(item.id)}
                                                aria-label={`Select ${item.entity_name}`}
                                            />
                                        </TableCell>

                                        <TableCell>
                                            {getEntityTypeBadge(item.entity_type)}
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-foreground text-sm">
                                                    {item.entity_name || 'Unnamed Record'}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[320px]">
                                                    {item.entity_id}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            {itemBranch.name ? (
                                                <Badge variant="outline" className="bg-muted/60 text-xs font-normal">
                                                    {itemBranch.name}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell className="text-muted-foreground text-xs">
                                            {format(new Date(item.deleted_at), 'MMM d, yyyy HH:mm')}
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-foreground">
                                                    {item.deleted_by_name || 'System Administrator'}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                                                    {item.deleted_by}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRestoreSingle(item.id)}
                                                    disabled={actionLoading !== null || isBulkDeleting || isBulkRestoring}
                                                    className="h-8 px-2.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs"
                                                >
                                                    <RotateCcw className={`h-3.5 w-3.5 mr-1 ${actionLoading === item.id ? 'animate-spin' : ''}`} />
                                                    Restore
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSingleItemToDelete(item)}
                                                    disabled={actionLoading !== null || isBulkDeleting || isBulkRestoring}
                                                    className="h-8 px-2.5 text-destructive hover:text-destructive/90 hover:bg-destructive/10 text-xs"
                                                >
                                                    <Trash className="h-3.5 w-3.5 mr-1" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground italic">
                                        <Trash2 className="h-12 w-12 opacity-20 mb-1" />
                                        <p className="text-sm font-medium">
                                            {activeFiltersCount > 0
                                                ? 'No deleted items match the selected filters'
                                                : 'Recycle bin is empty'}
                                        </p>
                                        {activeFiltersCount > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleResetFilters}
                                                className="mt-2 text-xs"
                                            >
                                                Clear Filters
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Informational footer note */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-dashed">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <p>
                    Items in the recycle bin are soft-deleted and kept safe for recovery. Permanent deletion completely removes all underlying records, associated logs, and files from the database.
                </p>
            </div>

            {/* Modal: Single Item Permanent Delete Confirmation */}
            <AlertDialog open={!!singleItemToDelete} onOpenChange={(open) => !open && setSingleItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Permanent Deletion
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the{' '}
                            <span className="font-bold text-foreground">
                                {singleItemToDelete?.entity_type} ({singleItemToDelete?.entity_name})
                            </span>{' '}
                            from the system and database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => singleItemToDelete && handlePermanentDeleteSingle(singleItemToDelete.id)}
                            disabled={actionLoading !== null}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {actionLoading === singleItemToDelete?.id ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                    Deleting...
                                </>
                            ) : (
                                'Permanently Delete'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal: Batch Permanent Delete Confirmation */}
            <AlertDialog open={isBatchDeleteDialogOpen} onOpenChange={setIsBatchDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Batch Permanent Deletion
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                Are you sure you want to permanently delete{' '}
                                <span className="font-bold text-foreground">{selectedIds.size}</span> selected item
                                {selectedIds.size === 1 ? '' : 's'}?
                            </p>
                            <p className="text-xs text-destructive font-medium bg-red-50 dark:bg-red-950/40 p-2.5 rounded border border-red-200 dark:border-red-900">
                                ⚠️ This action is irreversible. All selected records, payments, and workflow logs will be completely purged from the database.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmBatchDelete}
                            disabled={isBulkDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isBulkDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                    Permanently Deleting...
                                </>
                            ) : (
                                `Permanently Delete (${selectedIds.size})`
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal: Batch Restore Confirmation */}
            <AlertDialog open={isBatchRestoreDialogOpen} onOpenChange={setIsBatchRestoreDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-blue-600">
                            <RotateCcw className="h-5 w-5" />
                            Batch Restore
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to restore{' '}
                            <span className="font-bold text-foreground">{selectedIds.size}</span> selected record
                            {selectedIds.size === 1 ? '' : 's'} back to active status? Customer balances will be adjusted accordingly.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isBulkRestoring}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmBatchRestore}
                            disabled={isBulkRestoring}
                            className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                            {isBulkRestoring ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                    Restoring...
                                </>
                            ) : (
                                `Restore (${selectedIds.size})`
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
