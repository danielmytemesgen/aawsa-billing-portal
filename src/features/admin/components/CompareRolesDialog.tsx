"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { DomainRole, DomainPermission, DomainRolePermission } from "@/lib/data-store";
import {
  CANONICAL_CATEGORIES,
  getCanonicalCategory,
  formatPermissionName,
  getPermissionScope,
} from "@/lib/roles-permissions-utils";
import { GitCompare, Check, Minus, Search, Shield, Filter } from "lucide-react";

export interface CompareRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: DomainRole[];
  permissions: DomainPermission[];
  rolePermissions: DomainRolePermission[];
  defaultRoleAId?: string;
}

export function CompareRolesDialog({
  open,
  onOpenChange,
  roles,
  permissions,
  rolePermissions,
  defaultRoleAId,
}: CompareRolesDialogProps) {
  const [roleAId, setRoleAId] = React.useState<string>("");
  const [roleBId, setRoleBId] = React.useState<string>("");
  const [viewFilter, setViewFilter] = React.useState<"all" | "diff" | "shared">("diff");
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    if (open) {
      if (defaultRoleAId) {
        setRoleAId(defaultRoleAId);
        const otherRole = roles.find((r) => String(r.id) !== defaultRoleAId);
        if (otherRole) setRoleBId(String(otherRole.id));
      } else if (roles.length >= 2) {
        setRoleAId(String(roles[0].id));
        setRoleBId(String(roles[1].id));
      } else if (roles.length === 1) {
        setRoleAId(String(roles[0].id));
      }
    }
  }, [open, defaultRoleAId, roles]);

  const roleA = React.useMemo(() => roles.find((r) => String(r.id) === roleAId), [roles, roleAId]);
  const roleB = React.useMemo(() => roles.find((r) => String(r.id) === roleBId), [roles, roleBId]);

  const roleAPermIds = React.useMemo(() => {
    const rId = parseInt(roleAId, 10);
    if (isNaN(rId)) return new Set<number>();
    return new Set(rolePermissions.filter((rp) => rp.role_id === rId).map((rp) => rp.permission_id));
  }, [roleAId, rolePermissions]);

  const roleBPermIds = React.useMemo(() => {
    const rId = parseInt(roleBId, 10);
    if (isNaN(rId)) return new Set<number>();
    return new Set(rolePermissions.filter((rp) => rp.role_id === rId).map((rp) => rp.permission_id));
  }, [roleBId, rolePermissions]);

  // Metric summaries
  const sharedCount = React.useMemo(() => {
    let count = 0;
    for (const id of roleAPermIds) {
      if (roleBPermIds.has(id)) count++;
    }
    return count;
  }, [roleAPermIds, roleBPermIds]);

  const onlyInACount = React.useMemo(() => {
    let count = 0;
    for (const id of roleAPermIds) {
      if (!roleBPermIds.has(id)) count++;
    }
    return count;
  }, [roleAPermIds, roleBPermIds]);

  const onlyInBCount = React.useMemo(() => {
    let count = 0;
    for (const id of roleBPermIds) {
      if (!roleAPermIds.has(id)) count++;
    }
    return count;
  }, [roleAPermIds, roleBPermIds]);

  // Group permissions for comparison
  const categorizedRows = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const groups: Record<string, Array<{ permission: DomainPermission; inA: boolean; inB: boolean }>> = {};

    for (const cat of CANONICAL_CATEGORIES) {
      groups[cat] = [];
    }

    permissions.forEach((p) => {
      const inA = roleAPermIds.has(p.id);
      const inB = roleBPermIds.has(p.id);

      // Filter by view tab
      if (viewFilter === "shared" && (!inA || !inB)) return;
      if (viewFilter === "diff" && inA === inB) return;
      if (viewFilter === "all" && !inA && !inB) return; // Hide permissions unassigned to both to reduce noise

      // Search filter
      if (term) {
        const friendly = formatPermissionName(p.name).toLowerCase();
        const raw = p.name.toLowerCase();
        if (!friendly.includes(term) && !raw.includes(term)) return;
      }

      const cat = getCanonicalCategory(p.category, p.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ permission: p, inA, inB });
    });

    const populated: Record<string, Array<{ permission: DomainPermission; inA: boolean; inB: boolean }>> = {};
    for (const [cat, items] of Object.entries(groups)) {
      if (items.length > 0) populated[cat] = items;
    }
    return populated;
  }, [permissions, roleAPermIds, roleBPermIds, viewFilter, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[85vh] flex flex-col rounded-xl shadow-2xl border-slate-200 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-slate-50/60 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Role Privilege Matrix Comparison</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Compare permission allocations between any two roles side-by-side.
              </DialogDescription>
            </div>
          </div>

          {/* Role Selectors */}
          <div className="grid grid-cols-2 gap-4 pt-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-blue-700 uppercase">Role A</span>
              <Select value={roleAId} onValueChange={setRoleAId}>
                <SelectTrigger className="h-9 text-xs bg-white border-blue-200">
                  <SelectValue placeholder="Select Role A" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                      {r.role_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase">Role B</span>
              <Select value={roleBId} onValueChange={setRoleBId}>
                <SelectTrigger className="h-9 text-xs bg-white border-emerald-200">
                  <SelectValue placeholder="Select Role B" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                      {r.role_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Stats Strip */}
        <div className="grid grid-cols-3 divide-x border-b bg-slate-50 text-center py-2.5 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px]">Unique to {roleA?.role_name || "A"}</span>
            <span className="font-bold text-blue-700 text-sm">{onlyInACount}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Shared by Both</span>
            <span className="font-bold text-slate-800 text-sm">{sharedCount}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Unique to {roleB?.role_name || "B"}</span>
            <span className="font-bold text-emerald-700 text-sm">{onlyInBCount}</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 border-b flex flex-col sm:flex-row items-center justify-between gap-2 bg-white">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search comparison..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs border-slate-200"
            />
          </div>

          <div className="flex items-center gap-1 text-xs">
            <Button
              type="button"
              size="sm"
              variant={viewFilter === "diff" ? "default" : "outline"}
              className="h-7 text-xs px-2.5"
              onClick={() => setViewFilter("diff")}
            >
              Differences ({onlyInACount + onlyInBCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewFilter === "shared" ? "default" : "outline"}
              className="h-7 text-xs px-2.5"
              onClick={() => setViewFilter("shared")}
            >
              Shared ({sharedCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewFilter === "all" ? "default" : "outline"}
              className="h-7 text-xs px-2.5"
              onClick={() => setViewFilter("all")}
            >
              All Assigned
            </Button>
          </div>
        </div>

        {/* Comparison List */}
        <div className="overflow-y-auto flex-grow p-4 space-y-4 max-h-[420px]">
          {Object.entries(categorizedRows).map(([category, items]) => (
            <div key={category} className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider px-1">
                {category} ({items.length})
              </div>
              <div className="border rounded-lg overflow-hidden divide-y bg-white">
                {items.map(({ permission, inA, inB }) => {
                  const scope = getPermissionScope(permission.name);
                  const isDifferent = inA !== inB;

                  return (
                    <div
                      key={permission.id}
                      className={`grid grid-cols-12 items-center p-2.5 text-xs transition-colors ${
                        isDifferent ? "bg-amber-50/30" : "hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="col-span-8 pr-2">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <span>{formatPermissionName(permission.name)}</span>
                          {scope === "all" && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-700">
                              City
                            </Badge>
                          )}
                          {scope === "branch" && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700">
                              Branch
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{permission.name}</span>
                      </div>

                      {/* Role A Indicator */}
                      <div className="col-span-2 text-center">
                        {inA ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-400">
                            <Minus className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      {/* Role B Indicator */}
                      <div className="col-span-2 text-center">
                        {inB ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-400">
                            <Minus className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {Object.keys(categorizedRows).length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-lg bg-slate-50">
              No matching permissions found for this comparison view.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-slate-50 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            Close Comparison
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
