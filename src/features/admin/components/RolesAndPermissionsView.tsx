"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";
import {
  getRoles, initializeRoles, subscribeToRoles,
  getPermissions, initializePermissions, subscribeToPermissions,
  getRolePermissions, initializeRolePermissions, subscribeToRolePermissions,
  updateRolePermissions,
  deletePermission,
  getStaffMembers, initializeStaffMembers, subscribeToStaffMembers,
} from "@/lib/data-store";
import type { DomainRole, DomainPermission, DomainRolePermission, StaffMember } from "@/lib/data-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Save, Loader2, PlusCircle, Pencil, Trash2,
  ChevronLeft, ChevronRight, Search, Users, Check, AlertCircle,
  Filter, Globe, Building2, Crown, Layers, X,
  Copy, GitCompare, AlertTriangle, Wand2, ShieldAlert, FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateRoleDialog } from "@/features/admin/components/create-role-dialog";
import { CreateEditPermissionDialog } from "@/features/admin/components/create-edit-permission-dialog";
import { CloneRoleDialog } from "@/features/admin/components/CloneRoleDialog";
import { CompareRolesDialog } from "@/features/admin/components/CompareRolesDialog";
import { RoleImpactDialog } from "@/features/admin/components/RoleImpactDialog";
import { RoleTemplateDialog } from "@/features/admin/components/RoleTemplateDialog";
import { broadcastPermissionsUpdated } from "@/lib/permissions-sync";
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
import {
  CANONICAL_CATEGORIES,
  CANONICAL_CATEGORY_MAP,
  getCanonicalCategory,
  getCategoryColor,
  MUTUALLY_EXCLUSIVE_REPORT_PAIRS,
  MASTER_BUNDLE_MAP,
  formatPermissionName,
  getPermissionDescription,
  getPermissionScope,
  type PermissionScope,
} from "@/lib/roles-permissions-utils";

export {
  CANONICAL_CATEGORIES,
  CANONICAL_CATEGORY_MAP,
  getCanonicalCategory,
  getCategoryColor,
  MUTUALLY_EXCLUSIVE_REPORT_PAIRS,
  MASTER_BUNDLE_MAP,
  formatPermissionName,
  getPermissionDescription,
  getPermissionScope,
};

interface PermissionGroup {
  [category: string]: DomainPermission[];
}

export interface RolesAndPermissionsViewProps {
  mode?: "admin" | "staff";
}

type ScopeFilterType = "all" | "city" | "branch" | "master";

export function RolesAndPermissionsView({ mode = "admin" }: RolesAndPermissionsViewProps) {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(true);
  const [roles, setRoles] = React.useState<DomainRole[]>([]);
  const [permissions, setPermissions] = React.useState<DomainPermission[]>([]);
  const [rolePermissions, setRolePermissions] = React.useState<DomainRolePermission[]>([]);

  const [selectedRoleId, setSelectedRoleId] = React.useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = React.useState<Set<number>>(new Set());
  const [initialPermissions, setInitialPermissions] = React.useState<Set<number>>(new Set());

  // Search & Filter
  const [assignmentSearchTerm, setAssignmentSearchTerm] = React.useState("");
  const [scopeFilter, setScopeFilter] = React.useState<ScopeFilterType>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [tokenSearchTerm, setTokenSearchTerm] = React.useState("");
  const [tokenCategoryFilter, setTokenCategoryFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Dialog states
  const [createRoleDialogOpen, setCreateRoleDialogOpen] = React.useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = React.useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = React.useState(false);
  const [impactDialogOpen, setImpactDialogOpen] = React.useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false);
  const [staffMembersList, setStaffMembersList] = React.useState<StaffMember[]>([]);
  const [isPermissionDialogOpen, setPermissionDialogOpen] = React.useState(false);
  const [editingPermission, setEditingPermission] = React.useState<DomainPermission | undefined>(undefined);
  const [deletingPermission, setDeletingPermission] = React.useState<DomainPermission | undefined>(undefined);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  // Unsaved changes guard
  const [pendingRoleId, setPendingRoleId] = React.useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = React.useState(false);

  const [isSaving, setIsSaving] = React.useState(false);

  // Initial Data Fetching
  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([
        initializeRoles(),
        initializePermissions(),
        initializeRolePermissions(),
        initializeStaffMembers(),
      ]);
      setRoles(getRoles());
      setPermissions(getPermissions());
      setRolePermissions(getRolePermissions());
      setStaffMembersList(getStaffMembers());
      setIsLoading(false);
    };
    fetchData();

    const unsubRoles = subscribeToRoles(setRoles);
    const unsubPerms = subscribeToPermissions(setPermissions);
    const unsubRolePerms = subscribeToRolePermissions(setRolePermissions);
    const unsubStaff = subscribeToStaffMembers(setStaffMembersList);

    return () => {
      unsubRoles();
      unsubPerms();
      unsubRolePerms();
      unsubStaff();
    };
  }, []);

  // Auto-refresh when custom data-refreshed event fires
  React.useEffect(() => {
    const handleDataRefreshed = () => {
      setRoles(getRoles());
      setPermissions(getPermissions());
      setRolePermissions(getRolePermissions());
      setStaffMembersList(getStaffMembers());
    };
    window.addEventListener('data-refreshed', handleDataRefreshed);
    return () => window.removeEventListener('data-refreshed', handleDataRefreshed);
  }, []);

  // Update selected permissions when role changes
  React.useEffect(() => {
    if (selectedRoleId) {
      const roleIdNum = parseInt(selectedRoleId, 10);
      const permissionsForRole = rolePermissions
        .filter(rp => rp.role_id === roleIdNum)
        .map(rp => rp.permission_id);
      const initialSet = new Set(permissionsForRole);
      setSelectedPermissions(initialSet);
      setInitialPermissions(initialSet);
    } else {
      setSelectedPermissions(new Set());
      setInitialPermissions(new Set());
    }
  }, [selectedRoleId, rolePermissions]);

  // Dirty state calculation
  const isDirty = React.useMemo(() => {
    if (!selectedRoleId) return false;
    if (selectedPermissions.size !== initialPermissions.size) return true;
    for (const id of selectedPermissions) {
      if (!initialPermissions.has(id)) return true;
    }
    return false;
  }, [selectedRoleId, selectedPermissions, initialPermissions]);

  // Handle switching role with unsaved changes prompt
  const handleRoleSelectChange = (newRoleId: string) => {
    if (isDirty) {
      setPendingRoleId(newRoleId);
      setShowUnsavedDialog(true);
    } else {
      setSelectedRoleId(newRoleId);
    }
  };

  const handleConfirmDiscardRoleChange = () => {
    if (pendingRoleId) {
      setSelectedRoleId(pendingRoleId);
      setPendingRoleId(null);
    }
    setShowUnsavedDialog(false);
  };

  // Active mutual exclusivity conflicts within currently selected permissions
  const activeConflicts = React.useMemo(() => {
    if (!selectedRoleId) return [];
    const conflicts: Array<{ pair: [string, string]; permA: DomainPermission; permB: DomainPermission }> = [];
    const currentPermNames = new Set(
      Array.from(selectedPermissions).map(id => permissions.find(p => p.id === id)?.name).filter(Boolean) as string[]
    );

    for (const [scopeA, scopeB] of MUTUALLY_EXCLUSIVE_REPORT_PAIRS) {
      if (currentPermNames.has(scopeA) && currentPermNames.has(scopeB)) {
        const permA = permissions.find(p => p.name === scopeA);
        const permB = permissions.find(p => p.name === scopeB);
        if (permA && permB) {
          conflicts.push({ pair: [scopeA, scopeB], permA, permB });
        }
      }
    }
    return conflicts;
  }, [selectedRoleId, selectedPermissions, permissions]);

  const handleAutoResolveConflicts = () => {
    if (activeConflicts.length === 0) return;
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      activeConflicts.forEach(c => {
        // City-wide (permA) supersedes branch-only (permB)
        newSet.delete(c.permB.id);
      });
      return newSet;
    });
    toast({
      title: "Conflicts Auto-Resolved",
      description: `Resolved ${activeConflicts.length} mutually exclusive scope collision(s) in favor of city-wide scope.`,
    });
  };

  // Diff of permissions: added & removed
  const diffAdded = React.useMemo(() => {
    return Array.from(selectedPermissions)
      .filter(id => !initialPermissions.has(id))
      .map(id => permissions.find(p => p.id === id))
      .filter((p): p is DomainPermission => Boolean(p));
  }, [selectedPermissions, initialPermissions, permissions]);

  const diffRemoved = React.useMemo(() => {
    return Array.from(initialPermissions)
      .filter(id => !selectedPermissions.has(id))
      .map(id => permissions.find(p => p.id === id))
      .filter((p): p is DomainPermission => Boolean(p));
  }, [selectedPermissions, initialPermissions, permissions]);

  // Downstream affected staff count for currently selected role
  const affectedStaffCount = React.useMemo(() => {
    if (!selectedRoleId) return 0;
    const currentRole = roles.find(r => r.id === parseInt(selectedRoleId, 10));
    if (!currentRole) return 0;
    return staffMembersList.filter(s => s.role.toLowerCase() === currentRole.role_name.toLowerCase()).length;
  }, [selectedRoleId, roles, staffMembersList]);

  // Group permissions using Canonical Category Normalization in display order
  const groupedPermissions = React.useMemo(() => {
    const orderedGroups: PermissionGroup = {};

    // Initialize canonical categories in designated logical display order
    for (const cat of CANONICAL_CATEGORIES) {
      orderedGroups[cat] = [];
    }

    // Place each permission into its appropriate category (inferred by category tag or permission name)
    permissions.forEach(permission => {
      const canonical = getCanonicalCategory(permission.category, permission.name);
      if (!orderedGroups[canonical]) {
        orderedGroups[canonical] = [];
      }
      orderedGroups[canonical].push(permission);
    });

    // Filter out unpopulated categories
    const populated: PermissionGroup = {};
    for (const [cat, perms] of Object.entries(orderedGroups)) {
      if (perms.length > 0) {
        populated[cat] = perms;
      }
    }
    return populated;
  }, [permissions]);

  // Filtered groups for the left assignment accordion based on search term & scope filter
  const filteredAssignmentGroups = React.useMemo(() => {
    const term = assignmentSearchTerm.trim().toLowerCase();

    const filtered: PermissionGroup = {};
    for (const [cat, perms] of Object.entries(groupedPermissions)) {
      // Category filter check
      if (categoryFilter !== "all" && cat !== categoryFilter) {
        continue;
      }

      const matchingPerms = perms.filter(p => {
        // Scope filter
        const scope = getPermissionScope(p.name);
        if (scopeFilter === "city" && scope !== "all") return false;
        if (scopeFilter === "branch" && scope !== "branch") return false;
        if (scopeFilter === "master" && scope !== "master") return false;

        // Search keyword filter
        if (!term) return true;
        const friendlyName = formatPermissionName(p.name).toLowerCase();
        const description = getPermissionDescription(p.name, p.description).toLowerCase();
        const rawName = p.name.toLowerCase();
        const catName = cat.toLowerCase();

        return rawName.includes(term) || friendlyName.includes(term) || description.includes(term) || catName.includes(term);
      });

      if (matchingPerms.length > 0) {
        filtered[cat] = matchingPerms;
      }
    }
    return filtered;
  }, [groupedPermissions, assignmentSearchTerm, scopeFilter, categoryFilter]);

  // Right column system tokens filtering and pagination
  const filteredTokens = React.useMemo(() => {
    const term = tokenSearchTerm.trim().toLowerCase();
    return permissions.filter(p => {
      const canonical = getCanonicalCategory(p.category, p.name);
      if (tokenCategoryFilter !== "all" && canonical !== tokenCategoryFilter) {
        return false;
      }
      if (!term) return true;
      const friendly = formatPermissionName(p.name).toLowerCase();
      const desc = getPermissionDescription(p.name, p.description).toLowerCase();
      const raw = p.name.toLowerCase();

      return raw.includes(term) || friendly.includes(term) || canonical.toLowerCase().includes(term) || desc.includes(term);
    });
  }, [permissions, tokenSearchTerm, tokenCategoryFilter]);

  const paginatedTokens = React.useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredTokens.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredTokens, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredTokens.length / rowsPerPage);

  // Permission toggle handler with bidirectional auto-flipping
  const handlePermissionToggle = (permissionId: number, checked: boolean | "indeterminate") => {
    const isChecked = checked === true;
    const toggledPerm = permissions.find(p => p.id === permissionId);
    if (!toggledPerm) return;

    setSelectedPermissions(prev => {
      const newSet = new Set(prev);

      if (isChecked) {
        newSet.add(permissionId);

        // 1. Report Scope Mutual Exclusion (16 pairs)
        for (const [scopeA, scopeB] of MUTUALLY_EXCLUSIVE_REPORT_PAIRS) {
          if (toggledPerm.name === scopeA) {
            const counterpart = permissions.find(p => p.name === scopeB);
            if (counterpart) newSet.delete(counterpart.id);
          } else if (toggledPerm.name === scopeB) {
            const counterpart = permissions.find(p => p.name === scopeA);
            if (counterpart) newSet.delete(counterpart.id);
          }
        }

        // 2. GL Audit View Tab Implication
        const GL_TAB_PERMS = [
          'report:gl_audit_view_all',
          'report:gl_audit_view_branch',
          'report:gl_audit_view_matrix',
          'report:gl_audit_view_anomaly',
        ];
        if (GL_TAB_PERMS.includes(toggledPerm.name)) {
          const baseViewPerm = permissions.find(p => p.name === 'report:gl_audit_view');
          if (baseViewPerm) newSet.add(baseViewPerm.id);
        }

        // 3. Master Bundle -> Child Auto-Selection
        if (MASTER_BUNDLE_MAP[toggledPerm.name]) {
          const childNames = MASTER_BUNDLE_MAP[toggledPerm.name];
          for (const childName of childNames) {
            const childPerm = permissions.find(p => p.name === childName);
            if (childPerm) newSet.add(childPerm.id);
          }
        }
      } else {
        newSet.delete(permissionId);

        // 1. Master Bundle Invalidation: if a sub-permission is unchecked, uncheck the master token
        for (const [masterName, childNames] of Object.entries(MASTER_BUNDLE_MAP)) {
          if (childNames.includes(toggledPerm.name)) {
            const masterPerm = permissions.find(p => p.name === masterName);
            if (masterPerm) newSet.delete(masterPerm.id);
          }
        }

        // 2. GL Audit Base View Invalidation
        if (toggledPerm.name === 'report:gl_audit_view') {
          ['report:gl_audit_view_all', 'report:gl_audit_view_branch',
           'report:gl_audit_view_matrix', 'report:gl_audit_view_anomaly'].forEach(name => {
            const p = permissions.find(x => x.name === name);
            if (p) newSet.delete(p.id);
          });
        }
      }

      return newSet;
    });
  };

  // Category Level Select All / Deselect All
  const handleToggleCategoryAll = (category: string, selectAll: boolean) => {
    const categoryPerms = groupedPermissions[category] || [];
    if (categoryPerms.length === 0) return;

    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      if (selectAll) {
        categoryPerms.forEach(p => {
          newSet.add(p.id);
          // Auto-select child permissions if master token is selected
          if (MASTER_BUNDLE_MAP[p.name]) {
            MASTER_BUNDLE_MAP[p.name].forEach(childName => {
              const child = permissions.find(cp => cp.name === childName);
              if (child) newSet.add(child.id);
            });
          }
          // GL audit view base activation
          const GL_TAB_PERMS = ['report:gl_audit_view_all', 'report:gl_audit_view_branch', 'report:gl_audit_view_matrix', 'report:gl_audit_view_anomaly'];
          if (GL_TAB_PERMS.includes(p.name)) {
            const baseView = permissions.find(bp => bp.name === 'report:gl_audit_view');
            if (baseView) newSet.add(baseView.id);
          }
        });
      } else {
        categoryPerms.forEach(p => {
          newSet.delete(p.id);
          // If unchecking, also uncheck any master permission that encompasses this
          for (const [masterName, childNames] of Object.entries(MASTER_BUNDLE_MAP)) {
            if (childNames.includes(p.name)) {
              const masterPerm = permissions.find(mp => mp.name === masterName);
              if (masterPerm) newSet.delete(masterPerm.id);
            }
          }
        });
      }
      return newSet;
    });
  };

  // Save changes to database
  const handleSaveChanges = async (reason?: string) => {
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
      toast({
        title: "Permissions Updated",
        description: `Permissions for the role "${selectedRole?.role_name}" have been saved successfully.`
      });

      setInitialPermissions(new Set(selectedPermissions));

      window.dispatchEvent(new CustomEvent('user-permissions-updated'));
      broadcastPermissionsUpdated();
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message || "An unexpected error occurred." });
    }
    setIsSaving(false);
  };

  // Open impact confirmation before committing changes
  const handleInitiateSave = () => {
    if (!selectedRoleId) {
      toast({ variant: "destructive", title: "No Role Selected", description: "Please select a role to update." });
      return;
    }
    if (!isDirty) {
      toast({ title: "No Changes Detected", description: "The permissions for this role are already up to date." });
      return;
    }
    setImpactDialogOpen(true);
  };

  // Permission Token CRUD handlers
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

  // RBAC Access Check
  const canView = hasPermission(PERMISSIONS.ROLES_VIEW) || hasPermission(PERMISSIONS.ROLES_MANAGE) || hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL);
  const canManage = hasPermission(PERMISSIONS.ROLES_MANAGE) || hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL);

  if (!canView) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Roles &amp; Permissions</h1>
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Roles &amp; Permissions</h1>
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
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Roles &amp; Permissions</h1>
            {mode === "staff" && (
              <Badge variant="outline" className="bg-slate-100 text-slate-700 text-xs font-semibold">
                Staff Portal
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Configure enterprise role privileges, operational scopes, and access handles.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompareDialogOpen(true)}
              className="shadow-sm border-slate-200 hover:bg-slate-50 text-xs sm:text-sm"
            >
              <GitCompare className="mr-2 h-4 w-4 text-primary" />
              Compare Roles
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemplateDialogOpen(true)}
              className="shadow-sm border-slate-200 hover:bg-slate-50 text-xs sm:text-sm"
            >
              <FileText className="mr-2 h-4 w-4 text-primary" />
              JSON Template
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloneDialogOpen(true)}
              className="shadow-sm border-slate-200 hover:bg-slate-50 text-xs sm:text-sm"
            >
              <Copy className="mr-2 h-4 w-4 text-primary" />
              Clone / Template
            </Button>
            <Button onClick={() => setCreateRoleDialogOpen(true)} className="shadow-sm text-xs sm:text-sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest bg-blue-100/50 px-2 py-0.5 rounded-sm inline-block mb-1">
                  Total Roles
                </p>
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
                <p className="text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/50 px-2 py-0.5 rounded-sm inline-block mb-1">
                  System Tokens
                </p>
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
                <p className="text-xs font-bold text-green-700 uppercase tracking-widest bg-green-100/50 px-2 py-0.5 rounded-sm inline-block mb-1">
                  Active Assignments
                </p>
                <p className="text-4xl font-extrabold mt-1 text-slate-900">{rolePermissions.length}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Check className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Left = Role Privileges, Right = Tokens List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Role Privileges Management */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-md border-slate-200">
            <CardHeader className="bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Manage Role Privileges</CardTitle>
                  <CardDescription>Assign specific permissions to a selected role.</CardDescription>
                </div>
                {isDirty && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1.5 animate-pulse">
                    <AlertCircle className="h-3 w-3" />
                    Unsaved Changes
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Step 1: Role Dropdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="role-select" className="text-sm font-semibold">Step 1: Choose a Role</Label>
                  {selectedRoleId && canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCloneDialogOpen(true)}
                      className="h-6 text-xs text-slate-600 hover:text-primary px-2 font-medium"
                      title="Clone this role into a new role"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Clone Role
                    </Button>
                  )}
                </div>
                <Select value={selectedRoleId} onValueChange={handleRoleSelectChange}>
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
                  {/* Step 2 Header & Assignment Search Filter */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between border-b pb-2">
                      <Label className="text-sm font-semibold">Step 2: Assign Permissions</Label>
                      <Badge variant="outline" className="bg-primary/5 text-primary text-xs font-bold px-2 py-0">
                        {selectedPermissions.size} SELECTED
                      </Badge>
                    </div>

                    {/* Active Conflicts Alert Banner */}
                    {activeConflicts.length > 0 && (
                      <div className="p-3 rounded-lg border border-red-200 bg-red-50/90 text-red-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs animate-in fade-in">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">
                              {activeConflicts.length} Conflicting Scope Permission{activeConflicts.length > 1 ? "s" : ""} Detected!
                            </p>
                            <p className="text-[11px] text-red-700 leading-tight mt-0.5">
                              Both City-Wide and Branch-Scoped privileges are selected for the same report. This will cause ambiguous policy enforcement.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleAutoResolveConflicts}
                          className="h-7 text-xs border-red-300 text-red-800 bg-white hover:bg-red-100 shrink-0 self-end sm:self-center font-semibold"
                        >
                          <Wand2 className="h-3 w-3 mr-1 text-red-600" />
                          Auto-Resolve
                        </Button>
                      </div>
                    )}

                    {/* Instant Search Bar & Category Filter */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Search by title, handle, or description..."
                          value={assignmentSearchTerm}
                          onChange={(e) => setAssignmentSearchTerm(e.target.value)}
                          className="pl-8 h-9 text-xs border-slate-200 focus-visible:ring-primary/20"
                        />
                      </div>

                      {/* Filter by Category Selector */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="h-8 text-xs bg-white border-slate-200 focus:ring-primary/20">
                              <div className="flex items-center gap-1.5 truncate">
                                <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                <span className="truncate">
                                  {categoryFilter === "all" ? "Filter by Category (All)" : categoryFilter}
                                </span>
                              </div>
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="all" className="text-xs font-semibold">
                                All Categories ({Object.keys(groupedPermissions).length})
                              </SelectItem>
                              {Object.entries(groupedPermissions).map(([cat, perms]) => (
                                <SelectItem key={cat} value={cat} className="text-xs">
                                  {cat} ({perms.length})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {categoryFilter !== "all" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setCategoryFilter("all")}
                            className="h-8 text-xs text-slate-500 hover:text-slate-900 px-2 shrink-0 flex items-center gap-1"
                            title="Clear category filter"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline text-[11px]">Clear</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Quick Scope Filter Chips */}
                    <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1 text-xs">
                      <Button
                        type="button"
                        size="sm"
                        variant={scopeFilter === "all" ? "default" : "outline"}
                        className="h-6 text-[11px] px-2 rounded-full"
                        onClick={() => setScopeFilter("all")}
                      >
                        All Scopes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={scopeFilter === "city" ? "default" : "outline"}
                        className={`h-6 text-[11px] px-2 rounded-full ${scopeFilter === "city" ? "bg-blue-600 text-white" : "text-blue-700 bg-blue-50/50 hover:bg-blue-50"}`}
                        onClick={() => setScopeFilter("city")}
                      >
                        <Globe className="mr-1 h-3 w-3" />
                        City-Wide
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={scopeFilter === "branch" ? "default" : "outline"}
                        className={`h-6 text-[11px] px-2 rounded-full ${scopeFilter === "branch" ? "bg-amber-600 text-white" : "text-amber-800 bg-amber-50/50 hover:bg-amber-50"}`}
                        onClick={() => setScopeFilter("branch")}
                      >
                        <Building2 className="mr-1 h-3 w-3" />
                        Branch Only
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={scopeFilter === "master" ? "default" : "outline"}
                        className={`h-6 text-[11px] px-2 rounded-full ${scopeFilter === "master" ? "bg-purple-600 text-white" : "text-purple-700 bg-purple-50/50 hover:bg-purple-50"}`}
                        onClick={() => setScopeFilter("master")}
                      >
                        <Crown className="mr-1 h-3 w-3" />
                        Master Bundles
                      </Button>
                    </div>
                  </div>

                  {/* Accordion List — collapsed by default, auto-opens when filters/search are active */}
                  <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    <Accordion
                      type="multiple"
                      defaultValue={[]}
                      value={assignmentSearchTerm.trim() || scopeFilter !== "all" || categoryFilter !== "all" ? Object.keys(filteredAssignmentGroups) : undefined}
                      className="w-full space-y-2"
                    >
                      {Object.entries(filteredAssignmentGroups).map(([category, perms]) => {
                        const selectedCount = perms.filter(p => selectedPermissions.has(p.id)).length;
                        const allSelected = perms.length > 0 && selectedCount === perms.length;

                        return (
                          <AccordionItem
                            key={category}
                            value={category}
                            className="border rounded-md px-3 bg-white hover:bg-slate-50/30 transition-colors shadow-2xs"
                          >
                            <AccordionTrigger className="hover:no-underline py-3 text-sm font-bold text-slate-800">
                              <div className="flex items-center justify-between w-full pr-3">
                                <div className="flex items-center gap-2">
                                  <span>{category}</span>
                                  <span className="text-xs font-normal text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {selectedCount} / {perms.length}
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs text-primary font-semibold hover:bg-primary/10 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleCategoryAll(category, !allSelected);
                                  }}
                                >
                                  {allSelected ? "Deselect All" : "Select All"}
                                </Button>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-4">
                              <div className="grid grid-cols-1 gap-2.5">
                                {perms.map(perm => {
                                  const isChecked = selectedPermissions.has(perm.id);
                                  const scope = getPermissionScope(perm.name);
                                  const friendlyTitle = formatPermissionName(perm.name);
                                  const description = getPermissionDescription(perm.name, perm.description);

                                  return (
                                    <div
                                      key={perm.id}
                                      className={`flex flex-col p-3 rounded-lg transition-colors group border ${
                                        isChecked ? 'bg-primary/5 border-primary/25 shadow-2xs' : 'hover:bg-slate-50 border-slate-100 hover:border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start space-x-3">
                                          <Checkbox
                                            id={`perm-${perm.id}`}
                                            checked={isChecked}
                                            onCheckedChange={(checked) => handlePermissionToggle(perm.id, checked as boolean)}
                                            className="h-4 w-4 mt-0.5 data-[state=checked]:bg-primary"
                                          />
                                          <div>
                                            <label
                                              htmlFor={`perm-${perm.id}`}
                                              className="text-xs font-semibold leading-snug cursor-pointer group-hover:text-primary transition-colors text-slate-900 block"
                                            >
                                              {friendlyTitle}
                                            </label>
                                            <span className="font-mono text-[11px] text-slate-400 font-normal">
                                              {perm.name}
                                            </span>
                                          </div>
                                        </div>
                                        <div>
                                          {scope === 'all' && (
                                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-semibold whitespace-nowrap">
                                              City-Wide
                                            </Badge>
                                          )}
                                          {scope === 'branch' && (
                                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 font-semibold whitespace-nowrap">
                                              Branch Only
                                            </Badge>
                                          )}
                                          {scope === 'master' && (
                                            <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-semibold whitespace-nowrap">
                                              Master
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-[11px] text-slate-600 mt-1.5 pl-7 leading-relaxed">
                                        {description}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                    {Object.keys(filteredAssignmentGroups).length === 0 && (
                      <div className="p-8 text-center text-slate-500 text-xs border border-dashed rounded-md bg-slate-50">
                        <p>No permissions found matching current search, category, or scope filters.</p>
                        {(categoryFilter !== "all" || scopeFilter !== "all" || assignmentSearchTerm.trim()) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2 text-xs h-7"
                            onClick={() => {
                              setCategoryFilter("all");
                              setScopeFilter("all");
                              setAssignmentSearchTerm("");
                            }}
                          >
                            Clear All Filters
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-xs text-muted-foreground">
                      {isDirty ? (
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Unsaved changes pending
                        </span>
                      ) : (
                        <span className="text-slate-400">All changes saved</span>
                      )}
                    </div>
                    <Button onClick={handleInitiateSave} disabled={isSaving || !canManage} className="w-full sm:w-auto shadow-sm">
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Update Role Privileges
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-slate-50/50 text-slate-400">
                  <ShieldCheck className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-xs">Individual role permissions will appear here once a role is selected.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Global System Tokens Management */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-md border-slate-200 h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50">
              <div>
                <CardTitle>System Tokens List</CardTitle>
                <CardDescription>Manage underlying permission handles used across the platform.</CardDescription>
              </div>
              {canManage && (
                <Button
                  onClick={handleOpenCreateDialog}
                  size="sm"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/5 hover:text-primary"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Token
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-6 flex-grow flex flex-col">
              {/* Token Search Bar & Category Filter */}
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="relative sm:col-span-7">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search token handle, title, or category..."
                    value={tokenSearchTerm}
                    onChange={(e) => {
                      setTokenSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 h-10 border-slate-200 focus-visible:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-5 flex items-center gap-1.5">
                  <div className="flex-1">
                    <Select
                      value={tokenCategoryFilter}
                      onValueChange={(val) => {
                        setTokenCategoryFilter(val);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 text-xs bg-white border-slate-200 focus:ring-primary/20">
                        <div className="flex items-center gap-1.5 truncate">
                          <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">
                            {tokenCategoryFilter === "all" ? "All Categories" : tokenCategoryFilter}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="all" className="text-xs font-semibold">
                          All Categories
                        </SelectItem>
                        {CANONICAL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {tokenCategoryFilter !== "all" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTokenCategoryFilter("all");
                        setCurrentPage(1);
                      }}
                      className="h-10 text-xs text-slate-500 hover:text-slate-900 px-2 shrink-0"
                      title="Clear category filter"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Tokens Table */}
              <div className="rounded-md border border-slate-200 overflow-hidden flex-grow">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead className="font-bold text-slate-800">Permission Handle &amp; Title</TableHead>
                      <TableHead className="font-bold text-slate-800">Canonical Category</TableHead>
                      <TableHead className="text-right font-bold text-slate-800">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTokens.map(permission => {
                      const canonicalCat = getCanonicalCategory(permission.category, permission.name);
                      const scope = getPermissionScope(permission.name);
                      const friendlyTitle = formatPermissionName(permission.name);
                      const description = getPermissionDescription(permission.name, permission.description);

                      return (
                        <TableRow key={permission.id} className="hover:bg-slate-50/50 group transition-colors">
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-900">{permission.name}</span>
                              {scope === 'all' && (
                                <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200 px-1 py-0">
                                  City-Wide
                                </Badge>
                              )}
                              {scope === 'branch' && (
                                <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-200 px-1 py-0">
                                  Branch Only
                                </Badge>
                              )}
                              {scope === 'master' && (
                                <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200 px-1 py-0">
                                  Master
                                </Badge>
                              )}
                            </div>
                            <div className="font-sans text-xs text-slate-700 font-medium mt-0.5">
                              {friendlyTitle}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 max-w-md line-clamp-1">
                              {description}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs font-bold px-2 py-0.5 ${getCategoryColor(canonicalCat)}`}>
                              {canonicalCat}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-100"
                                onClick={() => handleOpenEditDialog(permission)}
                                disabled={!canManage}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100"
                                onClick={() => handleOpenDeleteDialog(permission)}
                                disabled={!canManage}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {paginatedTokens.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-slate-500 text-sm">
                          No matching tokens found for &quot;{tokenSearchTerm}&quot;.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Footer */}
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

      {/* Role Creation Dialog */}
      <CreateRoleDialog open={createRoleDialogOpen} onOpenChange={setCreateRoleDialogOpen} />

      {/* Token Create/Edit Dialog */}
      <CreateEditPermissionDialog
        open={isPermissionDialogOpen}
        onOpenChange={setPermissionDialogOpen}
        permission={editingPermission}
      />

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanent Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the permission token <strong>&quot;{deletingPermission?.name}&quot;</strong>? This may break role-based access for staff members currently assigned this token.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Delete Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Guard Modal */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Unsaved Permission Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have modified permissions for the currently selected role that have not been saved. Switching roles now will discard your modifications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRoleId(null)}>Stay on Current Role</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscardRoleChange} className="bg-amber-600 hover:bg-amber-700 text-white">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Impact & Diff Review Dialog */}
      <RoleImpactDialog
        open={impactDialogOpen}
        onOpenChange={setImpactDialogOpen}
        role={roles.find(r => r.id === parseInt(selectedRoleId, 10)) || null}
        addedPermissions={diffAdded}
        removedPermissions={diffRemoved}
        affectedStaffCount={affectedStaffCount}
        conflicts={activeConflicts.map(c => ({ global: c.permA.name, branch: c.permB.name }))}
        isSaving={isSaving}
        onConfirm={async (reason) => {
          await handleSaveChanges(reason);
          setImpactDialogOpen(false);
        }}
      />

      {/* Role Cloner & Preset Archetypes Dialog */}
      <CloneRoleDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        roles={roles}
        permissions={permissions}
        rolePermissions={rolePermissions}
        currentRoleId={selectedRoleId || undefined}
        onRoleCloned={(newRoleId) => {
          setSelectedRoleId(String(newRoleId));
        }}
      />

      {/* Role Matrix & Comparison Dialog */}
      <CompareRolesDialog
        open={compareDialogOpen}
        onOpenChange={setCompareDialogOpen}
        roles={roles}
        permissions={permissions}
        rolePermissions={rolePermissions}
        defaultRoleAId={selectedRoleId || undefined}
      />

      {/* Role Templates JSON Export & Import Dialog */}
      <RoleTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        roles={roles}
        permissions={permissions}
        rolePermissions={rolePermissions}
        canManage={canManage}
      />
    </div>
  );
}
