"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createRole, deleteRole, updateRole } from "@/lib/data-store";
import { broadcastPermissionsUpdated } from "@/lib/permissions-sync";
import type { DomainRole } from "@/lib/data-store";
import type { StaffMember } from "./staff-types";
import {
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Users,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export interface ManageRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: DomainRole[];
  staffMembers: StaffMember[];
}

export function ManageRolesDialog({
  open,
  onOpenChange,
  roles,
  staffMembers,
}: ManageRolesDialogProps) {
  const { toast } = useToast();

  // ── New Role State ──────────────────────────────────────────────
  const [newRoleName, setNewRoleName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  // ── Rename State ────────────────────────────────────────────────
  const [editingRoleId, setEditingRoleId] = React.useState<number | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [isRenaming, setIsRenaming] = React.useState(false);

  // ── Delete State ────────────────────────────────────────────────
  const [deletingRole, setDeletingRole] = React.useState<DomainRole | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Reset transient state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setNewRoleName("");
      setEditingRoleId(null);
      setEditingName("");
    }
  }, [open]);

  // Count staff members assigned to each role (by roleId or role name)
  const staffCountByRoleId = React.useMemo(() => {
    const map = new Map<number, number>();
    for (const s of staffMembers) {
      const rid = s.roleId ?? s.role_id;
      if (rid != null) {
        map.set(rid, (map.get(rid) ?? 0) + 1);
      } else {
        // Fallback: match by role name string if FK is missing
        const matched = roles.find(
          (r) => r.role_name.toLowerCase() === s.role.toLowerCase()
        );
        if (matched) map.set(matched.id, (map.get(matched.id) ?? 0) + 1);
      }
    }
    return map;
  }, [staffMembers, roles]);

  // ── Create ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    const name = newRoleName.trim();
    if (!name) return;

    if (roles.some((r) => r.role_name.toLowerCase() === name.toLowerCase())) {
      toast({
        variant: "destructive",
        title: "Duplicate Role Name",
        description: `A role named "${name}" already exists.`,
      });
      return;
    }

    setIsCreating(true);
    const result = await createRole(name);
    setIsCreating(false);

    if (result.success) {
      setNewRoleName("");
      window.dispatchEvent(new CustomEvent('user-permissions-updated'));
      broadcastPermissionsUpdated();
      toast({
        title: "Role Created",
        description: `Role "${name}" has been added to the system.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Failed to Create Role",
        description: result.message || "An unexpected error occurred.",
      });
    }
  };

  // ── Rename ──────────────────────────────────────────────────────
  const startEditing = (role: DomainRole) => {
    setEditingRoleId(role.id);
    setEditingName(role.role_name);
  };

  const cancelEditing = () => {
    setEditingRoleId(null);
    setEditingName("");
  };

  const handleRename = async (role: DomainRole) => {
    const name = editingName.trim();
    if (!name || name === role.role_name) {
      cancelEditing();
      return;
    }

    if (
      roles.some(
        (r) =>
          r.id !== role.id &&
          r.role_name.toLowerCase() === name.toLowerCase()
      )
    ) {
      toast({
        variant: "destructive",
        title: "Duplicate Role Name",
        description: `Another role named "${name}" already exists.`,
      });
      return;
    }

    setIsRenaming(true);
    const result = await updateRole(role.id, name);
    setIsRenaming(false);

    if (result.success) {
      cancelEditing();
      window.dispatchEvent(new CustomEvent('user-permissions-updated'));
      broadcastPermissionsUpdated();
      toast({
        title: "Role Renamed",
        description: `"${role.role_name}" has been renamed to "${name}".`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Rename Failed",
        description: result.message || "An unexpected error occurred.",
      });
    }
  };

  // ── Delete ──────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deletingRole) return;
    setIsDeleting(true);
    const result = await deleteRole(deletingRole.id);
    setIsDeleting(false);
    setDeletingRole(null);

    if (result.success) {
      window.dispatchEvent(new CustomEvent('user-permissions-updated'));
      broadcastPermissionsUpdated();
      toast({
        title: "Role Deleted",
        description: `Role "${deletingRole.role_name}" has been permanently removed.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: result.message || "An unexpected error occurred.",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] rounded-xl shadow-2xl border-slate-200 p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-5 border-b bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Manage Roles</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Create, rename, or delete system roles. Roles with assigned staff cannot be deleted.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex flex-col gap-0 max-h-[480px] overflow-y-auto">
            {/* Role List */}
            <div className="divide-y divide-slate-100">
              {roles.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  No roles found. Create one below.
                </div>
              ) : (
                roles.map((role) => {
                  const staffCount = staffCountByRoleId.get(role.id) ?? 0;
                  const isEditing = editingRoleId === role.id;
                  const isBlocked = staffCount > 0;

                  return (
                    <div
                      key={role.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors group"
                    >
                      {isEditing ? (
                        /* ── Rename inline edit ── */
                        <div className="flex flex-1 items-center gap-2">
                          <Input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(role);
                              if (e.key === "Escape") cancelEditing();
                            }}
                            className="h-8 text-sm border-slate-300 focus-visible:ring-primary/20 flex-1"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRename(role)}
                            disabled={isRenaming}
                            className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                          >
                            {isRenaming ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                            disabled={isRenaming}
                            className="h-7 w-7 text-slate-500 hover:bg-slate-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        /* ── Normal row ── */
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {role.role_name}
                            </p>
                          </div>

                          {/* Staff count badge */}
                          <div
                            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                              staffCount > 0
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                : "bg-slate-100 text-slate-400"
                            }`}
                            title={`${staffCount} staff assigned`}
                          >
                            <Users className="h-3 w-3" />
                            {staffCount}
                          </div>

                          {/* Actions — clearly visible on every row */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Rename */}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => startEditing(role)}
                              className="h-8 w-8 rounded-lg text-slate-700 bg-slate-100 hover:text-blue-700 hover:bg-blue-100/80 border border-slate-200/80 transition-colors"
                              title="Rename role"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            {/* Delete */}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={isBlocked}
                              onClick={() => setDeletingRole(role)}
                              className={`h-8 w-8 rounded-lg border transition-colors ${
                                isBlocked
                                  ? "text-slate-300 bg-slate-50 border-slate-200 cursor-not-allowed opacity-60"
                                  : "text-rose-600 bg-rose-50 hover:text-rose-700 hover:bg-rose-100 border-rose-200"
                              }`}
                              title={
                                isBlocked
                                  ? `Cannot delete: ${staffCount} staff member(s) still assigned`
                                  : "Delete role"
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add new role */}
            <div className="p-4 bg-slate-50/80 border-t">
              <p className="text-xs font-semibold text-slate-600 mb-2">Add New Role</p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e.g., District Supervisor"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  className="h-9 text-sm border-slate-200 bg-white flex-1 focus-visible:ring-primary/20"
                />
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating || !newRoleName.trim()}
                  className="h-9 px-4 text-sm font-semibold shadow-sm"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add Role
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingRole}
        onOpenChange={(v) => { if (!v) setDeletingRole(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Role Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the role{" "}
              <strong>&quot;{deletingRole?.role_name}&quot;</strong> and remove all its
              associated permission tokens. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
