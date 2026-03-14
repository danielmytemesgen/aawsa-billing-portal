"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
    getCustomers,
    subscribeToCustomers,
    initializeCustomers,
    approveCustomer,
    rejectCustomer,
    getBulkMeters,
    subscribeToBulkMeters,
    initializeBulkMeters,
    approveBulkMeter,
    rejectBulkMeter,
    getBranches,
    initializeBranches,
    subscribeToBranches
} from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import type { StaffMember } from "@/app/admin/staff-management/staff-types";
import type { Branch } from "@/app/admin/branches/branch-types";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Check, Frown, Lock, ShieldCheck, UserCheck, FileEdit } from "lucide-react";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "@/app/admin/individual-customers/individual-customer-form-dialog";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "@/app/admin/bulk-meters/bulk-meter-form-dialog";
import { IndividualCustomerTable } from "@/app/admin/individual-customers/individual-customer-table";
import { BulkMeterTable } from "@/app/admin/bulk-meters/bulk-meter-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/ui/table-pagination";

export default function StaffApprovalsPage() {
    const { hasPermission } = usePermissions();
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);
    const [customers, setCustomers] = React.useState<IndividualCustomer[]>([]);
    const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
    const [branches, setBranches] = React.useState<Branch[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const [actionType, setActionType] = React.useState<'approve' | 'reject' | null>(null);
    const [selectedEntity, setSelectedEntity] = React.useState<IndividualCustomer | BulkMeter | null>(null);

    // Edit dialogs state
    const [isCustomerFormOpen, setIsCustomerFormOpen] = React.useState(false);
    const [customerToEdit, setCustomerToEdit] = React.useState<IndividualCustomer | null>(null);

    const [isBulkFormOpen, setIsBulkFormOpen] = React.useState(false);
    const [bulkMeterToEdit, setBulkMeterToEdit] = React.useState<BulkMeter | null>(null);

    // Pagination state for customers
    const [customerPage, setCustomerPage] = React.useState(0);
    const [customerRowsPerPage, setCustomerRowsPerPage] = React.useState(10);

    // Pagination state for bulk meters
    const [bulkMeterPage, setBulkMeterPage] = React.useState(0);
    const [bulkMeterRowsPerPage, setBulkMeterRowsPerPage] = React.useState(10);


    React.useEffect(() => {
        const userJson = localStorage.getItem('user');
        if (userJson) {
            setCurrentUser(JSON.parse(userJson));
        }

        setIsLoading(true);
        Promise.all([
            initializeCustomers(),
            initializeBulkMeters(),
            initializeBranches()
        ]).then(() => {
            setCustomers(getCustomers());
            setBulkMeters(getBulkMeters());
            setBranches(getBranches());
            setIsLoading(false);
        });

        const unsubscribeCustomers = subscribeToCustomers(setCustomers);
        const unsubscribeBulkMeters = subscribeToBulkMeters(setBulkMeters);
        const unsubscribeBranches = subscribeToBranches(setBranches);

        return () => {
            unsubscribeCustomers();
            unsubscribeBulkMeters();
            unsubscribeBranches();
        };
    }, []);

    const pendingCustomers = React.useMemo(() => {
        const allPending = customers.filter(c => c.status === 'Pending Approval');
        if (currentUser?.role.toLowerCase() === 'staff management' && currentUser.branchId) {
            return allPending.filter(c => c.branchId === currentUser.branchId);
        }
        return allPending;
    }, [customers, currentUser]);

    const pendingBulkMeters = React.useMemo(() => {
        const allPending = bulkMeters.filter(bm => bm.status === 'Pending Approval');
        if (currentUser?.role.toLowerCase() === 'staff management' && currentUser.branchId) {
            return allPending.filter(bm => bm.branchId === currentUser.branchId);
        }
        return allPending;
    }, [bulkMeters, currentUser]);

    const paginatedCustomers = React.useMemo(() => {
        return pendingCustomers.slice(
            customerPage * customerRowsPerPage,
            customerPage * customerRowsPerPage + customerRowsPerPage
        );
    }, [pendingCustomers, customerPage, customerRowsPerPage]);

    const paginatedBulkMeters = React.useMemo(() => {
        return pendingBulkMeters.slice(
            bulkMeterPage * bulkMeterRowsPerPage,
            bulkMeterPage * bulkMeterRowsPerPage + bulkMeterRowsPerPage
        );
    }, [pendingBulkMeters, bulkMeterPage, bulkMeterRowsPerPage]);

    const handleApproveClick = (entity: IndividualCustomer | BulkMeter) => {
        setSelectedEntity(entity);
        setActionType('approve');
    };

    const handleRejectClick = (entity: IndividualCustomer | BulkMeter) => {
        setSelectedEntity(entity);
        setActionType('reject');
    };

    const handleOpenEditCustomer = (customer: IndividualCustomer) => {
        setCustomerToEdit(customer);
        setIsCustomerFormOpen(true);
    };

    const handleOpenEditBulkMeter = (bm: BulkMeter) => {
        setBulkMeterToEdit(bm);
        setIsBulkFormOpen(true);
    };

    // Import update functions lazily via callbacks (to avoid circular imports)
    const updateCustomer = async (key: string, data: Partial<IndividualCustomer>) => {
        const { updateCustomer: _u } = await import('@/lib/data-store');
        return _u(key, data);
    };

    const updateBulkMeter = async (key: string, data: Partial<BulkMeter>) => {
        const { updateBulkMeter: _u } = await import('@/lib/data-store');
        return _u(key, data);
    };

    const confirmAction = async () => {
        if (!selectedEntity || !actionType || !currentUser) return;

        let result;
        const entityKey = 'customerKeyNumber' in selectedEntity ? selectedEntity.customerKeyNumber : '';
        const isCustomer = 'customerType' in selectedEntity;

        if (actionType === 'approve') {
            result = isCustomer
                ? await approveCustomer(entityKey, currentUser.id)
                : await approveBulkMeter(entityKey, currentUser.id);
        } else {
            result = isCustomer
                ? await rejectCustomer(entityKey, currentUser.id)
                : await rejectBulkMeter(entityKey, currentUser.id);
        }

        if (result.success) {
            toast({
                title: `${isCustomer ? 'Customer' : 'Bulk Meter'} ${actionType === 'approve' ? 'Approved' : 'Amended'}`,
                description: `${selectedEntity.name} has been successfully ${actionType === 'approve' ? 'activated' : 'marked for amendment'}.`
            });
        } else {
            toast({
                variant: "destructive",
                title: "Action Failed",
                description: result.message || "An unexpected error occurred."
            });
        }

        // Close dialog
        setSelectedEntity(null);
        setActionType(null);
    };

    const handleSubmitCustomerEdit = async (values: IndividualCustomerFormValues) => {
        if (!customerToEdit) return;
        try {
            const result = await updateCustomer(customerToEdit.customerKeyNumber, values as any);
            if (result.success) {
                toast({ title: "Customer Updated", description: `${values.name} has been updated.` });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: result.message || 'Could not update customer.' });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Update Failed', description: 'An unexpected error occurred.' });
        } finally {
            setIsCustomerFormOpen(false);
            setCustomerToEdit(null);
        }
    };

    const handleSubmitBulkMeterEdit = async (values: BulkMeterFormValues) => {
        if (!bulkMeterToEdit) return;
        try {
            const result = await updateBulkMeter(bulkMeterToEdit.customerKeyNumber, values as any);
            if (result.success) {
                toast({ title: "Bulk Meter Updated", description: `${values.name} has been updated.` });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: result.message || 'Could not update bulk meter.' });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Update Failed', description: 'An unexpected error occurred.' });
        } finally {
            setIsBulkFormOpen(false);
            setBulkMeterToEdit(null);
        }
    };

    const hasApprovalPermission = hasPermission('customers_approve') || hasPermission('bulk_meters_approve');

    if (!hasApprovalPermission) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl md:text-3xl font-bold">Approvals</h1>
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <CardDescription>You do not have permission to approve or reject records.</CardDescription>
                </Alert>
            </div>
        );
    }

    const dialogTitle = actionType === 'approve' ? 'Approve Record' : 'Request Amendment';
    const dialogDescription = `Are you sure you want to ${actionType === 'approve' ? 'approve' : 'request an amendment for'} the record for "${selectedEntity?.name}"?
    ${actionType === 'approve' ? " This will make the record active and billable." : " This will mark the record as needing changes by the original submitter."}`;
    const dialogButtonText = actionType === 'approve' ? 'Yes, Approve' : 'Yes, Request Amendment';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <UserCheck className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Approvals</h1>
                    <p className="text-muted-foreground">Review and approve or amend new registrations.</p>
                </div>
            </div>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Pending Individual Customers</CardTitle>
                    <CardDescription>
                        The following customers have been added by staff and are awaiting your approval to become active.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                            Loading pending customers...
                        </div>
                    ) : pendingCustomers.length === 0 ? (
                        <div className="mt-4 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
                            <ShieldCheck className="mx-auto h-12 w-12 text-green-500 mb-4" />
                            <h3 className="text-lg font-semibold">All Clear!</h3>
                            <p className="text-muted-foreground mt-1">There are no pending customer approvals at this time.</p>
                        </div>
                    ) : (
                        <IndividualCustomerTable
                            data={paginatedCustomers}
                            branches={branches}
                            onEdit={handleOpenEditCustomer}
                            onApprove={handleApproveClick}
                            onDelete={handleRejectClick}
                            canEdit={hasPermission('customers_update') || hasPermission('customers_approve')}
                            canDelete={hasPermission('customers_approve')}
                        />
                    )}
                </CardContent>
                {pendingCustomers.length > 0 && (
                    <TablePagination
                        count={pendingCustomers.length}
                        page={customerPage}
                        onPageChange={setCustomerPage}
                        rowsPerPage={customerRowsPerPage}
                        onRowsPerPageChange={(value) => {
                            setCustomerRowsPerPage(value);
                            setCustomerPage(0);
                        }}
                    />
                )}
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Pending Bulk Meters</CardTitle>
                    <CardDescription>
                        The following bulk meters have been added by staff and are awaiting your approval.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                            Loading pending bulk meters...
                        </div>
                    ) : pendingBulkMeters.length === 0 ? (
                        <div className="mt-4 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
                            <ShieldCheck className="mx-auto h-12 w-12 text-green-500 mb-4" />
                            <h3 className="text-lg font-semibold">All Clear!</h3>
                            <p className="text-muted-foreground mt-1">There are no pending bulk meter approvals at this time.</p>
                        </div>
                    ) : (
                        <BulkMeterTable
                            data={paginatedBulkMeters}
                            branches={branches}
                            onEdit={handleOpenEditBulkMeter}
                            onApprove={handleApproveClick}
                            onDelete={handleRejectClick}
                            canEdit={hasPermission('bulk_meters_update') || hasPermission('bulk_meters_approve')}
                            canDelete={hasPermission('bulk_meters_approve')}
                        />
                    )}
                </CardContent>
                {pendingBulkMeters.length > 0 && (
                    <TablePagination
                        count={pendingBulkMeters.length}
                        page={bulkMeterPage}
                        onPageChange={setBulkMeterPage}
                        rowsPerPage={bulkMeterRowsPerPage}
                        onRowsPerPageChange={(value) => {
                            setBulkMeterRowsPerPage(value);
                            setBulkMeterPage(0);
                        }}
                    />
                )}
            </Card>

            <AlertDialog open={!!selectedEntity} onOpenChange={(open) => !open && setSelectedEntity(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Action: {dialogTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {dialogDescription}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedEntity(null)}>Cancel</AlertDialogCancel>
                        <Button
                            onClick={confirmAction}
                            variant={actionType === 'approve' ? 'default' : 'destructive'}
                        >
                            {actionType === 'approve' ? <Check className="mr-2 h-4 w-4" /> : <FileEdit className="mr-2 h-4 w-4" />}
                            {dialogButtonText}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit dialogs for approvers to adjust records before approval */}
            <IndividualCustomerFormDialog
                open={isCustomerFormOpen}
                onOpenChange={setIsCustomerFormOpen}
                onSubmit={handleSubmitCustomerEdit}
                defaultValues={customerToEdit}
                bulkMeters={bulkMeters ? bulkMeters.map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name })) : []}
            />

            <BulkMeterFormDialog
                open={isBulkFormOpen}
                onOpenChange={setIsBulkFormOpen}
                onSubmit={handleSubmitBulkMeterEdit}
                defaultValues={bulkMeterToEdit}
            />

        </div>
    );
}
