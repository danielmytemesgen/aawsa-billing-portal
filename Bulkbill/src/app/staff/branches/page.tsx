"use client";

import * as React from "react";
import { PlusCircle, Building, Search, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Branch } from "@/app/admin/branches/branch-types";
import { BranchFormDialog, type BranchFormValues } from "@/app/admin/branches/branch-form-dialog";
import { BranchTable } from "@/app/admin/branches/branch-table";
import {
    getBranches,
    addBranch as addBranchToStore,
    updateBranch as updateBranchInStore,
    deleteBranch as deleteBranchFromStore,
    subscribeToBranches,
    initializeBranches
} from "@/lib/data-store";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";

export default function StaffBranchesPage() {
    const { hasPermission } = usePermissions();
    const { toast } = useToast();
    const [branches, setBranches] = React.useState<Branch[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [selectedBranch, setSelectedBranch] = React.useState<Branch | null>(null);
    const [branchToDelete, setBranchToDelete] = React.useState<Branch | null>(null);

    const canCreate = hasPermission('branches_create');
    const canUpdate = hasPermission('branches_update');
    const canDelete = hasPermission('branches_delete');
    const canView = hasPermission('branches_view');

    React.useEffect(() => {
        setIsLoading(true);
        initializeBranches().then(() => {
            setBranches(getBranches());
            setIsLoading(false);
        });

        const unsubscribe = subscribeToBranches((updatedBranches) => {
            setBranches(updatedBranches);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleAddBranch = () => {
        if (!canCreate) return;
        setSelectedBranch(null);
        setIsFormOpen(true);
    };

    const handleEditBranch = (branch: Branch) => {
        if (!canUpdate) return;
        setSelectedBranch(branch);
        setIsFormOpen(true);
    };

    const handleDeleteBranch = (branch: Branch) => {
        if (!canDelete) return;
        setBranchToDelete(branch);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (branchToDelete) {
            await deleteBranchFromStore(branchToDelete.id);
            toast({ title: "Branch Deleted", description: `${branchToDelete.name} has been removed.` });
            setBranchToDelete(null);
        }
        setIsDeleteDialogOpen(false);
    };

    const handleSubmitBranch = async (data: BranchFormValues) => {
        try {
            if (selectedBranch) {
                if (!canUpdate) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to update branches.' }); return; }
                await updateBranchInStore(selectedBranch.id, data);
                toast({ title: "Branch Updated", description: `${data.name} has been updated.` });
            } else {
                if (!canCreate) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to create branches.' }); return; }
                await addBranchToStore(data);
                toast({ title: "Branch Added", description: `${data.name} has been added.` });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save branch.' });
        }
        setIsFormOpen(false);
        setSelectedBranch(null);
    };

    const filteredBranches = branches.filter(branch =>
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (branch.contactPerson && branch.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (!canView) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl md:text-3xl font-bold">Branch Management</h1>
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <CardDescription>You do not have permission to view this page.</CardDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h1 className="text-2xl md:text-3xl font-bold">Branch Management</h1>
                <div className="flex w-full flex-col sm:flex-row items-center gap-2">
                    <div className="relative w-full sm:w-auto flex-grow">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search branches..."
                            className="pl-8 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {canCreate && (
                        <Button onClick={handleAddBranch} className="w-full sm:w-auto flex-shrink-0">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New
                        </Button>
                    )}
                </div>
            </div>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Branch List</CardTitle>
                    <CardDescription>Manage AAWSA branches and their details.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                            Loading branches...
                        </div>
                    ) : branches.length === 0 && !searchTerm ? (
                        <div className="mt-4 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
                            <Building className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-semibold">No Branches Found</h3>
                            <p className="text-muted-foreground mt-1">Click "Add New" to get started.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <BranchTable
                                data={filteredBranches}
                                onEdit={handleEditBranch}
                                onDelete={handleDeleteBranch}
                                canEdit={canUpdate}
                                canDelete={canDelete}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {(canCreate || canUpdate) && (
                <BranchFormDialog
                    open={isFormOpen}
                    onOpenChange={setIsFormOpen}
                    onSubmit={handleSubmitBranch}
                    defaultValues={selectedBranch}
                />
            )}

            {canDelete && (
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the branch {branchToDelete?.name}.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setBranchToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
}
