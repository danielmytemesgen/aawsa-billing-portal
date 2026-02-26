"use client";

import { useState, useEffect, useCallback } from 'react';
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
    RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import {
    getRecycleBinItemsAction,
    restoreFromRecycleBinAction,
    permanentlyDeleteFromRecycleBinAction
} from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';

interface RecycleBinItem {
    id: string;
    entity_type: string;
    entity_id: string;
    entity_name: string;
    deleted_at: string;
    deleted_by: string;
    deleted_by_name: string;
    original_data: any;
}

export default function RecycleBinPage() {
    const { toast } = useToast();
    const [items, setItems] = useState<RecycleBinItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await getRecycleBinItemsAction();
            if (error) throw error;
            setItems(data || []);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch items: ${e.message}` });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const handleRestore = async (id: string) => {
        setActionLoading(id);
        try {
            const { error } = await restoreFromRecycleBinAction(id);
            if (error) throw error;
            toast({ title: 'Success', description: 'Item restored successfully' });
            fetchItems();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to restore: ${e.message}` });
        } finally {
            setActionLoading(null);
        }
    };

    const handlePermanentDelete = async (id: string) => {
        setActionLoading(id);
        try {
            const { error } = await permanentlyDeleteFromRecycleBinAction(id);
            if (error) throw error;
            toast({ title: 'Success', description: 'Item permanently deleted' });
            fetchItems();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to delete: ${e.message}` });
        } finally {
            setActionLoading(null);
        }
    };

    const filteredItems = items.filter(item =>
        item.entity_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.entity_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.entity_id?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getEntityTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            'staff': 'bg-blue-100 text-blue-800 border-blue-200',
            'branch': 'bg-purple-100 text-purple-800 border-purple-200',
            'customer': 'bg-green-100 text-green-800 border-green-200',
            'bulk_meter': 'bg-orange-100 text-orange-800 border-orange-200',
            'route': 'bg-cyan-100 text-cyan-800 border-cyan-200',
        };
        return (
            <Badge variant="outline" className={colors[type] || ''}>
                {type.replace('_', ' ').toUpperCase()}
            </Badge>
        );
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Trash2 className="h-8 w-8 text-muted-foreground" />
                        Recycle Bin
                    </h1>
                    <p className="text-muted-foreground">
                        Manage soft-deleted records. You can restore them or delete them permanently.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchItems}
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 max-w-sm">
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search deleted items..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-lg border bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[120px]">Type</TableHead>
                            <TableHead>Identifier / Name</TableHead>
                            <TableHead className="w-[180px]">Deleted At</TableHead>
                            <TableHead className="w-[180px]">Deleted By</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <RefreshCw className="h-8 w-8 animate-spin" />
                                        <p>Loading recycle bin...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredItems.length > 0 ? (
                            filteredItems.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                                    <TableCell>{getEntityTypeBadge(item.entity_type)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{item.entity_name || 'Unnamed'}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{item.entity_id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {format(new Date(item.deleted_at), 'MMM d, yyyy HH:mm')}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{item.deleted_by_name || 'System'}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">{item.deleted_by}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRestore(item.id)}
                                                disabled={actionLoading !== null}
                                                className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            >
                                                <RotateCcw className={`h-4 w-4 mr-1.5 ${actionLoading === item.id ? 'animate-spin' : ''}`} />
                                                Restore
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={actionLoading !== null}
                                                        className="h-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                    >
                                                        <Trash className="h-4 w-4 mr-1.5" />
                                                        Delete Permanently
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                                            <AlertTriangle className="h-5 w-5" />
                                                            Permanent Deletion
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the
                                                            <span className="font-bold text-foreground mx-1">
                                                                {item.entity_type} ({item.entity_name})
                                                            </span>
                                                            from the system.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handlePermanentDelete(item.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Permanently Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground italic">
                                        <Trash2 className="h-12 w-12 opacity-20 mb-2" />
                                        <p>{searchQuery ? 'No items match your search' : 'Recycle bin is empty'}</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-md border border-dashed">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p>Items in the recycle bin are hidden from the rest of the application but remain in the database until permanently deleted.</p>
            </div>
        </div>
    );
}
