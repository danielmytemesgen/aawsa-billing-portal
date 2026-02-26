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
import { Plus, MoreHorizontal, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";
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
    }, [data, searchQuery]);

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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Fault Codes</h1>
                    <p className="text-muted-foreground">Manage error codes and status flags for meter readings.</p>
                </div>
                {canManage && (
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Add Fault Code
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Fault Code List</CardTitle>
                    <CardDescription>
                        List of all registered fault codes in the system.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by code, description, or category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-md"
                        />
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No results found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredData.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                <Badge variant="outline" className="font-mono">{item.code}</Badge>
                                            </TableCell>
                                            <TableCell>{item.description || <span className="text-muted-foreground italic">No description</span>}</TableCell>
                                            <TableCell>{item.category || "-"}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(item)} disabled={!canManage}>
                                                            <Pencil className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleDeleteClick(item.id)}
                                                            disabled={!canManage}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">
                        Total Records: {filteredData.length}
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
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
