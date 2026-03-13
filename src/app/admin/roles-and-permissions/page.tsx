"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";
import {
  getRoles, initializeRoles, subscribeToRoles,
  getPermissions, initializePermissions, subscribeToPermissions,
  getRolePermissions, initializeRolePermissions, subscribeToRolePermissions,
  updateRolePermissions,
  deletePermission,

} from "@/lib/data-store";
import type { DomainRole, DomainPermission, DomainRolePermission } from "@/lib/data-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Save, Loader2, PlusCircle, Pencil, Trash2, ChevronLeft, ChevronRight, Search, Users, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateRoleDialog } from "@/components/create-role-dialog";
import { CreateEditPermissionDialog } from "@/components/create-edit-permission-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

interface PermissionGroup {
  [category: string]: DomainPermission[];
}

export default function RolesAndPermissionsPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  if (!hasPermission('permissions_view')) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Roles & Permissions</h1>
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <UIAlertDescription>
            You do not have the required permissions to view this page.
          </UIAlertDescription>
        </Alert>
      </div>
    );
  }
  const [isLoading, setIsLoading] = React.useState(true);

  const [roles, setRoles] = React.useState<DomainRole[]>([]);
  const [permissions, setPermissions] = React.useState<DomainPermission[]>([]);
  const [rolePermissions, setRolePermissions] = React.useState<DomainRolePermission[]>([]);

  const [selectedRoleId, setSelectedRoleId] = React.useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = React.useState<Set<number>>(new Set());
  const [createRoleDialogOpen, setCreateRoleDialogOpen] = React.useState(false);
  const [isPermissionDialogOpen, setPermissionDialogOpen] = React.useState(false);
  const [editingPermission, setEditingPermission] = React.useState<DomainPermission | undefined>(undefined);
  const [deletingPermission, setDeletingPermission] = React.useState<DomainPermission | undefined>(undefined);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const [isSaving, setIsSaving] = React.useState(false);
  const [permissionSearchTerm, setPermissionSearchTerm] = React.useState("");

  // Pagination for Manage Permissions
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([
        initializeRoles(),
        initializePermissions(),
        initializeRolePermissions()
      ]);
      setRoles(getRoles());
      setPermissions(getPermissions());
      setRolePermissions(getRolePermissions());
      setIsLoading(false);
    };
    fetchData();

    const unsubRoles = subscribeToRoles(setRoles);
    const unsubPerms = subscribeToPermissions(setPermissions);
    const unsubRolePerms = subscribeToRolePermissions(setRolePermissions);

    return () => {
      unsubRoles();
      unsubPerms();
      unsubRolePerms();
    };
  }, []);

  React.useEffect(() => {
    if (selectedRoleId) {
      const roleIdNum = parseInt(selectedRoleId, 10);
      const permissionsForRole = rolePermissions
        .filter(rp => rp.role_id === roleIdNum)
        .map(rp => rp.permission_id);
      setSelectedPermissions(new Set(permissionsForRole));
    } else {
      setSelectedPermissions(new Set());
    }
  }, [selectedRoleId, rolePermissions]);

  const handlePermissionToggle = (permissionId: number, checked: boolean | "indeterminate") => {
    const isChecked = checked === true;
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(permissionId);
      } else {
        newSet.delete(permissionId);
      }
      return newSet;
    });
  };

  const handleSaveChanges = async () => {
    if (!selectedRoleId) {
      toast({ variant: "destructive", title: "No Role Selected", description: "Please select a role to update." });
      return;
    }

    setIsSaving(true);
    const roleIdNum = parseInt(selectedRoleId, 10);
    const permissionIds = Array.from(selectedPermissions);

    const result = await updateRolePermissions(roleIdNum, permissionIds);

    if (result.success) {
      const selectedRole = roles.find(r => r.id === roleIdNum);
      toast({ title: "Permissions Updated", description: `Permissions for the role "${selectedRole?.role_name}" have been saved successfully.` });

      // Dispatch event to notify layout (and other components) to refresh permissions
      window.dispatchEvent(new CustomEvent('user-permissions-updated'));
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message || "An unexpected error occurred." });
    }
    setIsSaving(false);
  };

  const handleOpenCreateDialog = () => {
    setEditingPermission(undefined);
    setPermissionDialogOpen(true);
  };

  const handleOpenEditDialog = (permission: DomainPermission) => {
    setEditingPermission(permission);
    setPermissionDialogOpen(true);
  };

  const handleOpenDeleteDialog = (permission: DomainPermission) => {
    setDeletingPermission(permission);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPermission) return;

    const result = await deletePermission(deletingPermission.id);

    if (result.success) {
      toast({ title: "Permission Deleted", description: `The permission "${deletingPermission.name}" has been deleted.` });
    } else {
      toast({ variant: "destructive", title: "Delete Failed", description: result.message || "An unexpected error occurred." });
    }

    setDeleteDialogOpen(false);
    setDeletingPermission(undefined);
  };

  const groupedPermissions = React.useMemo(() => {
    return permissions.reduce((acc, permission) => {
      const category = permission.category || "General";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(permission);
      return acc;
    }, {} as PermissionGroup);
  }, [permissions]);

  const totalPages = Math.ceil(permissions.length / rowsPerPage);
  
  const filteredPermissions = React.useMemo(() => {
    return permissions.filter(p => 
      p.name.toLowerCase().includes(permissionSearchTerm.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(permissionSearchTerm.toLowerCase()))
    );
  }, [permissions, permissionSearchTerm]);

  const paginatedPermissions = React.useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredPermissions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredPermissions, currentPage, rowsPerPage]);

  const formatPermissionName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const getCategoryColor = (category: string) => {
    const cats: { [key: string]: string } = {
      'Branch Management': 'bg-blue-100 text-blue-700 border-blue-200',
      'Staff Management': 'bg-purple-100 text-purple-700 border-purple-200',
      'Billing': 'bg-green-100 text-green-700 border-green-200',
      'Individual Customers': 'bg-amber-100 text-amber-700 border-amber-200',
      'Bulk Meters': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'Systems': 'bg-slate-100 text-slate-700 border-slate-200',
      'General': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return cats[category] || cats['General'];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Roles & Permissions</h1>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1">Configure system access levels and individual permission tokens.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateRoleDialogOpen(true)} className="shadow-sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest bg-blue-100/50 px-2 py-0.5 rounded-sm inline-block mb-1">Total Roles</p>
                <p className="text-4xl font-extrabold mt-1 text-slate-900">{roles.length}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/50 px-2 py-0.5 rounded-sm inline-block mb-1">System Tokens</p>
                <p className="text-4xl font-extrabold mt-1 text-slate-900">{permissions.length}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-widest bg-green-100/50 px-2 py-0.5 rounded-sm inline-block mb-1">Active Assignments</p>
                <p className="text-4xl font-extrabold mt-1 text-slate-900">{rolePermissions.length}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Check className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Role Privileges Management */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-md border-slate-200">
            <CardHeader className="bg-slate-50/50">
              <CardTitle>Manage Role Privileges</CardTitle>
              <CardDescription>Assign specific permissions to a selected role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-3">
                <Label htmlFor="role-select" className="text-sm font-semibold">Step 1: Choose a Role</Label>
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger id="role-select" className="w-full bg-white border-slate-200 focus:ring-primary/20">
                    <SelectValue placeholder="Select a role to manage..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={String(role.id)}>{role.role_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRoleId ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <Label className="text-sm font-semibold">Step 2: Assign Permissions</Label>
                    <Badge variant="outline" className="bg-primary/5 text-primary text-xs font-bold px-2 py-0">
                      {selectedPermissions.size} SELECTED
                    </Badge>
                  </div>
                  
                  <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    <Accordion type="multiple" defaultValue={Object.keys(groupedPermissions)} className="w-full space-y-2">
                      {Object.entries(groupedPermissions).map(([category, perms]) => (
                        <AccordionItem key={category} value={category} className="border rounded-md px-3 bg-white hover:bg-slate-50/30 transition-colors">
                          <AccordionTrigger className="hover:no-underline py-3 text-base font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span>{category}</span>
                              <span className="text-xs font-normal text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                {perms.filter(p => selectedPermissions.has(p.id)).length} / {perms.length}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-4">
                            <div className="grid grid-cols-1 gap-3">
                              {perms.map(perm => (
                                <div key={perm.id} className="flex items-center space-x-3 p-2 rounded hover:bg-slate-100/50 transition-colors group">
                                  <Checkbox
                                    id={`perm-${perm.id}`}
                                    checked={selectedPermissions.has(perm.id)}
                                    onCheckedChange={(checked) => handlePermissionToggle(perm.id, checked as boolean)}
                                    className="h-5 w-5 data-[state=checked]:bg-primary"
                                  />
                                  <label
                                    htmlFor={`perm-${perm.id}`}
                                    className="text-sm font-medium leading-none cursor-pointer group-hover:text-primary transition-colors text-slate-700"
                                  >
                                    {formatPermissionName(perm.name)}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full sm:w-auto">
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Update Role Privileges
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-slate-50/50 text-slate-400">
                  <ShieldCheck className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-xs">Individual role permissions will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Global Permissions Management */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-md border-slate-200 h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50">
              <div>
                <CardTitle>System Tokens List</CardTitle>
                <CardDescription>Manage all underlying permission handles used by the system.</CardDescription>
              </div>
              <Button onClick={handleOpenCreateDialog} size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/5 hover:text-primary">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Token
              </Button>
            </CardHeader>
            <CardContent className="pt-6 flex-grow flex flex-col">
              <div className="mb-4 relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search token or category..."
                  value={permissionSearchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setPermissionSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-10 border-slate-200 focus-visible:ring-primary/20"
                />
              </div>

              <div className="rounded-md border border-slate-200 overflow-hidden flex-grow">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead className="font-bold text-slate-800">Permission Handle</TableHead>
                      <TableHead className="font-bold text-slate-800">Category Tag</TableHead>
                      <TableHead className="text-right font-bold text-slate-800">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPermissions.map(permission => (
                      <TableRow key={permission.id} className="hover:bg-slate-50/50 group transition-colors">
                        <TableCell className="py-4">
                          <div className="font-mono text-sm font-semibold text-slate-900">
                            {permission.name}
                          </div>
                          <div className="font-sans text-xs text-slate-600 font-medium mt-1">
                            {formatPermissionName(permission.name)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs font-bold px-2 py-0.5 ${getCategoryColor(permission.category || "General")}`}>
                            {permission.category || "General"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-100" onClick={() => handleOpenEditDialog(permission)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100" onClick={() => handleOpenDeleteDialog(permission)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedPermissions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-slate-500 text-sm">
                          No matching tokens found for "{permissionSearchTerm}".
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-6 mt-auto">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-slate-500">Rows</p>
                  <Select
                    value={`${rowsPerPage}`}
                    onValueChange={(value) => {
                      setRowsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px] text-xs">
                      <SelectValue placeholder={rowsPerPage} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[10, 20, 50].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`} className="text-xs">
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-4">
                  <p className="text-xs font-medium text-slate-500">
                    Page {currentPage} of {totalPages === 0 ? 1 : totalPages}
                  </p>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || totalPages === 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateRoleDialog open={createRoleDialogOpen} onOpenChange={setCreateRoleDialogOpen} />
      <CreateEditPermissionDialog
        open={isPermissionDialogOpen}
        onOpenChange={setPermissionDialogOpen}
        permission={editingPermission}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanent Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the permission token <strong>"{deletingPermission?.name}"</strong>? This may break role-based access for staff members currently assigned this token.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Delete Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
