"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";
import { 
    getRoles, initializeRoles, subscribeToRoles,
    getPermissions, initializePermissions, subscribeToPermissions,
    getRolePermissions, initializeRolePermissions, subscribeToRolePermissions,
    updateRolePermissions,
    deletePermission,
    refetchUserPermissions
} from "@/lib/data-store";
import type { DomainRole, DomainPermission, DomainRolePermission } from "@/lib/data-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Save, Loader2, PlusCircle, Pencil, Trash2 } from "lucide-react";
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
  const { toast } = useToast();
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

  const handlePermissionToggle = (permissionId: number, checked: boolean) => {
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      if (checked) {
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
      toast({ title: "Permissions Updated", description: `Permissions for the role "${selectedRole?.role_name}" have been saved.` });
      await refetchUserPermissions();
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
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl md:text-3xl font-bold">Roles & Permissions</h1>
            <Button onClick={() => setCreateRoleDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Role
            </Button>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Manage Role Privileges</CardTitle>
                <CardDescription>Select a role to view and edit its assigned permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="role-select">Select a Role</Label>
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                        <SelectTrigger id="role-select" className="w-full md:w-[300px]">
                            <SelectValue placeholder="Choose a role to manage..." />
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map(role => (
                                <SelectItem key={role.id} value={String(role.id)}>{role.role_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                {selectedRoleId && (
                    <div className="border rounded-lg p-4 space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Permissions for {roles.find(r => r.id.toString() === selectedRoleId)?.role_name}
                        </h3>
                        <Accordion type="multiple" defaultValue={Object.keys(groupedPermissions)} className="w-full">
                            {Object.entries(groupedPermissions).map(([category, perms]) => (
                                <AccordionItem key={category} value={category}>
                                    <AccordionTrigger>{category}</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {perms.map(perm => (
                                                <div key={perm.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`perm-${perm.id}`}
                                                        checked={selectedPermissions.has(perm.id)}
                                                        onCheckedChange={(checked) => handlePermissionToggle(perm.id, checked as boolean)}
                                                    />
                                                    <label
                                                        htmlFor={`perm-${perm.id}`}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                    >
                                                        {perm.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleSaveChanges} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Manage Permissions</CardTitle>
                    <CardDescription>Create, edit, and delete system-wide permissions.</CardDescription>
                </div>
                <Button onClick={handleOpenCreateDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Permission
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Permission Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {permissions.map(permission => (
                            <TableRow key={permission.id}>
                                <TableCell>{permission.name}</TableCell>
                                <TableCell>{permission.category}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(permission)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(permission)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <CreateRoleDialog open={createRoleDialogOpen} onOpenChange={setCreateRoleDialogOpen} />
        <CreateEditPermissionDialog 
            open={isPermissionDialogOpen} 
            onOpenChange={setPermissionDialogOpen} 
            permission={editingPermission} 
        />
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the permission "{deletingPermission?.name}".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
