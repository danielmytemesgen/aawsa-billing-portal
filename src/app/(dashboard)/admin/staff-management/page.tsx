
"use client";

import * as React from "react";
import { PlusCircle, UserCog, Search, Users, Activity, UserMinus, Clock, ShieldCheck } from "lucide-react";
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
  initializeStaffMembers,
  useBranches,
  useRoles
} from "@/lib/data-store";
import { usePermissions } from "@/hooks/use-permissions";
import { logSecurityEventAction } from "@/lib/actions";
import Link from "next/link";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [selectedBranch, setSelectedBranch] = React.useState("all");
  const [selectedRole, setSelectedRole] = React.useState("all");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const branches = useBranches();
  const roles = useRoles();

  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }

    setIsLoading(true);
    initializeStaffMembers(true).then(() => {
      setStaffMembers(getStaffMembers());
      setIsLoading(false);
    });

    const unsubscribe = subscribeToStaffMembers((updatedStaff) => {
      setStaffMembers(updatedStaff);
    });
    return () => unsubscribe();
  }, []);

  const userBranchId = currentUser?.branchId;
  const isHeadOffice = !userBranchId || currentUser?.role?.toLowerCase().includes("head office") || hasPermission('staff_view_all');

  const handleAddStaff = () => {
    if (!hasPermission('staff_create')) return;
    setSelectedStaff(isHeadOffice ? null : { branchId: userBranchId } as any);
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
        logSecurityEventAction(`Staff member ${staffToDelete.name} (${staffToDelete.email}) deleted by ${currentUser?.email}.`);
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
      if (selectedStaff && (selectedStaff as StaffMember).email) {
        if (!hasPermission('staff_update')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to update staff.' }); return; }
        const result = await updateStaffMemberInStore(selectedStaff.email, data);
        if (result.success) {
          logSecurityEventAction(`Staff member ${data.name} (${data.email}) updated by ${currentUser?.email}.`);
          toast({ title: "Staff Updated", description: `${data.name} has been updated.` });
        } else {
          toast({ variant: "destructive", title: "Update Failed", description: result.message });
        }
      } else {
        if (!hasPermission('staff_create')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to create staff.' }); return; }
        const result = await addStaffMemberToStore(data as StaffMember);
        if (result.success) {
          logSecurityEventAction(`Staff member ${data.name} (${data.email}) added by ${currentUser?.email}.`);
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

  const filteredStaff = staffMembers.filter(staff => {
    const matchesSearch = staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          staff.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          staff.role.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBranch = selectedBranch === "all" || staff.branchId === selectedBranch;
    const matchesRole = selectedRole === "all" || staff.role === selectedRole;

    return matchesSearch && matchesBranch && matchesRole;
  });

  // Reset to first page when filters change
  React.useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedBranch, selectedRole]);

  // Pagination
  const totalCount = filteredStaff.length;
  const paginatedStaff = filteredStaff.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Summary stats
  const totalStaff = staffMembers.length;
  const activeStaff = staffMembers.filter(s => s.status === 'Active').length;
  const inactiveStaff = staffMembers.filter(s => s.status === 'Inactive').length;
  const onLeaveStaff = staffMembers.filter(s => s.status === 'On Leave').length;

  if (!hasPermission('staff_view') && !hasPermission('staff_view_all') && !hasPermission('staff_view_branch')) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Staff Management Access</h1>
        <Card className="bg-red-50 border-red-100 shadow-sm">
           <CardHeader>
              <CardTitle className="text-red-800">Access Denied</CardTitle>
              <CardDescription className="text-red-600">You do not have the required permissions (staff_view, staff_view_all or staff_view_branch) to view this page. Please contact your administrator.</CardDescription>
           </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground mt-1 text-base">Manage staff accounts, roles, and branch assignments.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {hasPermission('staff_create') && (
            <Button onClick={handleAddStaff} className="flex-shrink-0 shadow-sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Staff
            </Button>
          )}
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 shadow-sm transition-all hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest bg-indigo-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">Total Staff</p>
                <p className="text-4xl font-extrabold text-slate-900">{totalStaff}</p>
              </div>
              <div className="h-14 w-14 bg-indigo-100/80 rounded-2xl flex items-center justify-center text-indigo-600 rotate-3 transition-transform hover:rotate-6">
                <Users className="h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 shadow-sm transition-all hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">Active</p>
                <p className="text-4xl font-extrabold text-emerald-700">{activeStaff}</p>
              </div>
              <div className="h-14 w-14 bg-emerald-100/80 rounded-2xl flex items-center justify-center text-emerald-600 -rotate-3 transition-transform hover:-rotate-6">
                <Activity className="h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 shadow-sm transition-all hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest bg-amber-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">Inactive</p>
                <p className="text-4xl font-extrabold text-amber-700">{inactiveStaff}</p>
              </div>
              <div className="h-14 w-14 bg-amber-100/80 rounded-2xl flex items-center justify-center text-amber-600 rotate-3 transition-transform hover:-rotate-3">
                <UserMinus className="h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-100 shadow-sm transition-all hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-sky-700 uppercase tracking-widest bg-sky-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">On Leave</p>
                <p className="text-4xl font-extrabold text-sky-700">{onLeaveStaff}</p>
              </div>
              <div className="h-14 w-14 bg-sky-100/80 rounded-2xl flex items-center justify-center text-sky-600 -rotate-3 transition-transform hover:rotate-3">
                <Clock className="h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff List Card */}
      <Card className="shadow-md border-slate-200/60 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Staff Directory</CardTitle>
              <CardDescription>View and manage all staff accounts across branches.</CardDescription>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search by name, email..."
                className="pl-9 bg-white border-slate-200 focus-visible:ring-indigo-500 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full sm:w-40 h-10 bg-white border-slate-200 rounded-xl">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full sm:w-40 h-10 bg-white border-slate-200 rounded-xl">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {Array.from(new Set(roles.map(r => r.role_name))).map((roleName) => (
                  <SelectItem key={roleName} value={roleName}>
                    {roleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center h-[400px]">
              <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground animate-pulse">Loading staff members...</p>
            </div>
          ) : staffMembers.length === 0 && !searchTerm ? (
            <div className="p-16 flex flex-col items-center justify-center text-center h-[400px]">
              <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                <UserCog className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800">No Staff Members Found</h3>
              <p className="text-slate-500 mt-2 max-w-sm">There are no staff members registered yet. Click &quot;Add New Staff&quot; to get started.</p>
              {hasPermission('staff_create') && (
                <Button onClick={handleAddStaff} variant="outline" className="mt-6 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add First Staff Member
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[300px]">
              <StaffTable
                data={paginatedStaff}
                onEdit={handleEditStaff}
                onDelete={handleDeleteStaff}
                canEdit={hasPermission('staff_update')}
                canDelete={hasPermission('staff_delete')}
              />
            </div>
          )}
        </CardContent>
        {totalCount > 0 && (
          <TablePagination
            count={totalCount}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(value) => {
              setRowsPerPage(value);
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
          />
        )}
      </Card>

      {/* Logging & Monitoring Card */}
      <Card className="shadow-md border-slate-200/60">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Logging & Monitoring</CardTitle>
              <CardDescription>Security event tracking and audit logs.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Log Security Events: Log all failed logins, password resets, and permission changes.</li>
            <li>Monitor Logs: Regularly check logs for suspicious activity with tools like Sentry or LogRocket.</li>
          </ul>
          <Link href="/admin/security-logs" className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium">
            View Security Logs →
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
