"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { DomainFaultCode, getFaultCodes, subscribeToFaultCodes, removeFaultCode } from "@/lib/data-store";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Search, AlertTriangle, ListFilter, Hash, Tag, Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { FaultCodeDialog } from "./fault-code-dialog";
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
import { Badge } from "@/components/ui/badge";

export default function FaultCodesPage() {
    const { hasPermission } = usePermissions();
    const { toast } = useToast();
    const [data, setData] = React.useState<DomainFaultCode[]>([]);
    const [filteredData, setFilteredData] = React.useState<DomainFaultCode[]>([]);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 10;

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingFaultCode, setEditingFaultCode] = React.useState<DomainFaultCode | null>(null);

    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    React.useEffect(() => {
        const unsubscribe = subscribeToFaultCodes((updatedData) => {
            setData(updatedData);
        });
        // Initial load handled by subscriber
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!searchQuery) {
            setFilteredData(data);
        } else {
            const lowerQuery = searchQuery.toLowerCase();
            setFilteredData(data.filter(item =>
                item.code.toLowerCase().includes(lowerQuery) ||
                (item.description && item.description.toLowerCase().includes(lowerQuery)) ||
                (item.category && item.category.toLowerCase().includes(lowerQuery))
            ));
        }
        setCurrentPage(1);
    }, [data, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleCreate = () => {
        setEditingFaultCode(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (faultCode: DomainFaultCode) => {
        setEditingFaultCode(faultCode);
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (deleteId) {
            const result = await removeFaultCode(deleteId);
            if (result.success) {
                toast({
                    title: "Fault Code Deleted",
                    description: "The fault code has been removed.",
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.message || "Failed to delete fault code.",
                });
            }
            setDeleteId(null);
        }
    };

    // Assuming 'settings_view' and 'settings_update' control access for now, 
    // or add specific permissions if needed.
    const canManage = hasPermission('settings_update');

    if (!hasPermission('settings_view')) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                You do not have permission to view this page.
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Fault Codes</h1>
                    <p className="text-muted-foreground mt-1">Manage error codes and status flags for meter readings.</p>
                </div>
                {canManage && (
                    <Button onClick={handleCreate} className="shadow-sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Fault Code
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm transition-all hover:shadow-md">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest bg-blue-100/50 px-2 py-0.5 rounded-sm inline-block mb-1">Total Codes</p>
                                <p className="text-4xl font-extrabold mt-1 text-slate-900">{data.length}</p>
                            </div>
                            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                <Hash className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 shadow-sm transition-all hover:shadow-md">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest bg-indigo-100/50 px-2 py-0.5 rounded-sm inline-block mb-1">Categories</p>
                                <p className="text-4xl font-extrabold mt-1 text-slate-900">
                                    {new Set(data.map(d => d.category).filter(Boolean)).size}
                                </p>
                            </div>
                            <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                <Tag className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="bg-slate-50/50 border-b">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        <CardTitle>System Fault Codes</CardTitle>
                    </div>
                    <CardDescription>
                        Configuration of terminal error signals and reading status flags.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="mb-6 relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by code, description, or category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 border-slate-200 focus-visible:ring-primary/20 text-base"
                        />
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
                        <Table>
                            <TableHeader className="bg-slate-50/80">
                                <TableRow className="hover:bg-transparent border-b">
                                    <TableHead className="w-[120px] font-bold text-slate-800 py-4">Code Identifier</TableHead>
                                    <TableHead className="font-bold text-slate-800">Fault Description</TableHead>
                                    <TableHead className="font-bold text-slate-800">Category Tag</TableHead>
                                    <TableHead className="w-[100px] text-right font-bold text-slate-800">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-slate-500 italic">
                                            No matching fault codes found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-slate-50/50 group transition-colors border-b last:border-0">
                                            <TableCell className="py-5">
                                                <Badge variant="outline" className="font-mono text-sm px-3 py-1 bg-slate-50 text-slate-900 border-slate-200 shadow-sm group-hover:bg-white transition-colors">
                                                    {item.code}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <div className="font-semibold text-slate-900 text-sm">
                                                    {item.description || "N/A"}
                                                </div>
                                                {!item.description && <span className="text-xs text-slate-400 italic">No description provided</span>}
                                            </TableCell>
                                            <TableCell className="py-5">
                                                {item.category ? (
                                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-xs font-bold px-2.5 py-0.5">
                                                        {item.category}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right py-5">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-100 transition-all" onClick={() => handleEdit(item)} disabled={!canManage}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all text-slate-400" onClick={() => handleDeleteClick(item.id)} disabled={!canManage}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex items-center justify-between mt-6 border-t pt-4">
                        <div className="text-sm font-medium text-slate-500">
                            Showing <span className="text-slate-900 font-bold">{filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="text-slate-900 font-bold">{filteredData.length}</span> tokens
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-9 px-4 border-slate-200"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="h-9 px-4 border-slate-200"
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <FaultCodeDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                faultCode={editingFaultCode}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the fault code.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-2">
                        <AlertDialogCancel className="border-slate-200">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200 border-none transition-all">
                            Confirm Deletion
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
