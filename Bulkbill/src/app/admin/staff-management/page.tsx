
"use client";

import * as React from "react";
import { PlusCircle, UserCog, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { StaffMember } from "./staff-types";
import { StaffFormDialog, type StaffFormValues } from "./staff-form-dialog";
import { StaffTable } from "./staff-table";
import {
  getStaffMembers,
  addStaffMember as addStaffMemberToStore,
  updateStaffMember as updateStaffMemberInStore,
  deleteStaffMember as deleteStaffMemberFromStore,
  subscribeToStaffMembers,
  initializeStaffMembers
} from "@/lib/data-store";
import { usePermissions } from "@/hooks/use-permissions";
import { logSecurityEventAction } from "@/lib/actions";
import Link from "next/link";

export default function StaffManagementPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [staffMembers, setStaffMembers] = React.useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedStaff, setSelectedStaff] = React.useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = React.useState<StaffMember | null>(null);
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);

  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }

    setIsLoading(true);
    initializeStaffMembers().then(() => {
      setStaffMembers(getStaffMembers());
      setIsLoading(false);
    });

    const unsubscribe = subscribeToStaffMembers((updatedStaff) => {
      setStaffMembers(updatedStaff);
    });
    return () => unsubscribe();
  }, []);

  const handleAddStaff = () => {
    if (!hasPermission('staff_create')) return;
    setSelectedStaff(null);
    setIsFormOpen(true);
  };

  const handleEditStaff = (staff: StaffMember) => {
    if (!hasPermission('staff_update')) return;
    setSelectedStaff(staff);
    setIsFormOpen(true);
  };

  const handleDeleteStaff = (staff: StaffMember) => {
    if (!hasPermission('staff_delete')) return;
    setStaffToDelete(staff);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!hasPermission('staff_delete')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to delete staff.' }); setIsDeleteDialogOpen(false); return; }
    if (staffToDelete) {
      const result = await deleteStaffMemberFromStore(staffToDelete.email);
      if (result.success) {
        logSecurityEventAction(`Staff member ${staffToDelete.name} (${staffToDelete.email}) deleted by ${currentUser?.email}.`, currentUser?.email, currentUser?.branchName);
        toast({ title: "Staff Deleted", description: `${staffToDelete.name} has been removed.` });
      } else {
        toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
      }
      setStaffToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const handleSubmitStaff = async (data: StaffFormValues) => {
    try {
      if (selectedStaff) {
        if (!hasPermission('staff_update')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to update staff.' }); return; }
        const result = await updateStaffMemberInStore(selectedStaff.email, data);
        if (result.success) {
          logSecurityEventAction(`Staff member ${data.name} (${data.email}) updated by ${currentUser?.email}.`, currentUser?.email, currentUser?.branchName);
          toast({ title: "Staff Updated", description: `${data.name} has been updated.` });
        } else {
          toast({ variant: "destructive", title: "Update Failed", description: result.message });
        }
      } else {
        if (!hasPermission('staff_create')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to create staff.' }); return; }
        const result = await addStaffMemberToStore(data as StaffMember);
        if (result.success) {
          logSecurityEventAction(`Staff member ${data.name} (${data.email}) added by ${currentUser?.email}.`, currentUser?.email, currentUser?.branchName);
          toast({ title: "Staff Added", description: `${data.name} has been added.` });
        } else {

          toast({ variant: "destructive", title: "Add Failed", description: result.message });
        }
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save staff member.' });
    }
    setIsFormOpen(false);
    setSelectedStaff(null);
  };

  const filteredStaff = staffMembers.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.branchName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Staff Management</h1>
        <div className="flex w-full flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full sm:w-auto flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search staff..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {hasPermission('staff_create') && (
            <Button onClick={handleAddStaff} className="w-full sm:w-auto flex-shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Staff List</CardTitle>
          <CardDescription>Manage staff accounts and branch assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
              Loading staff members...
            </div>
          ) : staffMembers.length === 0 && !searchTerm ? (
            <div className="mt-4 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
              <UserCog className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold">No Staff Members Found</h3>
              <p className="text-muted-foreground mt-1">Click "Add New" to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <StaffTable
                data={filteredStaff}
                onEdit={handleEditStaff}
                onDelete={handleDeleteStaff}
                canEdit={hasPermission('staff_update')}
                canDelete={hasPermission('staff_delete')}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Logging and Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5">
            <li>Log Security Events: Log all failed logins, password resets, and permission changes.</li>
            <li>Monitor Logs: Regularly check logs for suspicious activity with tools like Sentry or LogRocket.</li>
          </ul>
          <Link href="/admin/security-logs" className="text-blue-500 hover:underline">
            View Security Logs
          </Link>
        </CardContent>
      </Card>

      {(hasPermission('staff_create') || hasPermission('staff_update')) && (
        <StaffFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={handleSubmitStaff}
          defaultValues={selectedStaff}
        />
      )}

      {hasPermission('staff_delete') && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the staff member {staffToDelete?.name}. This will also remove their login access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStaffToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
