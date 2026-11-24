"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createRole, updateRolePermissions } from "@/lib/data-store";
import { broadcastPermissionsUpdated } from "@/lib/permissions-sync";
import type { DomainRole, DomainPermission, DomainRolePermission } from "@/lib/data-store";
import { Copy, Sparkles, Loader2, Check, ArrowRight } from "lucide-react";

export interface CloneRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: DomainRole[];
  permissions: DomainPermission[];
  rolePermissions: DomainRolePermission[];
  currentRoleId?: string;
  onRoleCloned: (newRoleId: number) => void;
}

// Built-in AAWSA Enterprise Role Presets / Archetypes
const ROLE_PRESETS: Array<{
  name: string;
  badge: string;
  description: string;
  matchPatterns: string[];
}> = [
  {
    name: "Billing Officer",
    badge: "Billing",
    description: "Standard branch billing operations, invoice generation & payment logging.",
    matchPatterns: ["bill:", "invoice:", "payment:"],
  },
  {
    name: "Meter Reader Supervisor",
    badge: "Field Operations",
    description: "Reading validation, route management & field inspector oversight.",
    matchPatterns: ["meter_reading", "routes_", "fault_code"],
  },
  {
    name: "Branch Auditor",
    badge: "Compliance",
    description: "Read-only audit reports, branch reconciliation & security inspection.",
    matchPatterns: ["report:", "gl_audit", "audit:", "dashboard_view_branch"],
  },
  {
    name: "Customer Support Agent",
    badge: "Service",
    description: "Customer service desk, query resolution & account statement inquiries.",
    matchPatterns: ["support_", "customers_view", "invoice:view"],
  },
  {
    name: "Call Center Operator",
    badge: "Call Center",
    description: "Hotline customer inquiry, caller 360 lookup, interaction logging & SMS dispatch.",
    matchPatterns: ["callcenter:", "support:", "customers_view", "invoice:view", "meter_readings_view", "bill_view"],
  },
];

export function CloneRoleDialog({
  open,
  onOpenChange,
  roles,
  permissions,
  rolePermissions,
  currentRoleId,
  onRoleCloned,
}: CloneRoleDialogProps) {
  const { toast } = useToast();
  const [cloneMode, setCloneMode] = React.useState<"role" | "preset">("role");
  const [sourceRoleId, setSourceRoleId] = React.useState<string>(currentRoleId || (roles[0] ? String(roles[0].id) : ""));
  const [selectedPreset, setSelectedPreset] = React.useState<string>(ROLE_PRESETS[0].name);
  const [targetRoleName, setTargetRoleName] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync sourceRoleId when dialog opens or currentRoleId changes
  React.useEffect(() => {
    if (open) {
      if (currentRoleId) {
        setSourceRoleId(currentRoleId);
      } else if (roles[0]) {
        setSourceRoleId(String(roles[0].id));
      }
      setTargetRoleName("");
    }
  }, [open, currentRoleId, roles]);

  // Compute permissions to copy based on mode
  const targetPermissionIds = React.useMemo(() => {
    if (cloneMode === "role") {
      const rId = parseInt(sourceRoleId, 10);
      if (isNaN(rId)) return [];
      return rolePermissions
        .filter((rp) => rp.role_id === rId)
        .map((rp) => rp.permission_id);
    } else {
      const preset = ROLE_PRESETS.find((p) => p.name === selectedPreset);
      if (!preset) return [];
      return permissions
        .filter((p) => preset.matchPatterns.some((pattern) => p.name.includes(pattern)))
        .map((p) => p.id);
    }
  }, [cloneMode, sourceRoleId, selectedPreset, rolePermissions, permissions]);

  const sourceRoleName = React.useMemo(() => {
    const found = roles.find((r) => String(r.id) === sourceRoleId);
    return found ? found.role_name : "Selected Role";
  }, [roles, sourceRoleId]);

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = targetRoleName.trim();
    if (!trimmedName) {
      toast({
        title: "Role Name Required",
        description: "Please provide a valid name for the new role.",
        variant: "destructive",
      });
      return;
    }

    if (roles.some((r) => r.role_name.toLowerCase() === trimmedName.toLowerCase())) {
      toast({
        title: "Duplicate Role Name",
        description: `A role named "${trimmedName}" already exists. Please choose a different name.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create the new role
      const createRes = await createRole(trimmedName);
      if (!createRes.success || !createRes.data) {
        throw new Error(createRes.message || "Failed to create role");
      }

      const newRole = createRes.data;

      // 2. Assign cloned permissions
      if (targetPermissionIds.length > 0) {
        await updateRolePermissions(newRole.id, targetPermissionIds);
        window.dispatchEvent(new CustomEvent('user-permissions-updated'));
        broadcastPermissionsUpdated();
      }

      toast({
        title: "Role Successfully Cloned",
        description: `Created "${trimmedName}" with ${targetPermissionIds.length} permissions copied from ${
          cloneMode === "role" ? `"${sourceRoleName}"` : `the ${selectedPreset} archetype`
        }.`,
      });

      onRoleCloned(newRole.id);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Clone role error:", err);
      toast({
        title: "Failed to Clone Role",
        description: err?.message || "An unexpected error occurred while duplicating role.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-xl shadow-2xl border-slate-200">
        <form onSubmit={handleCloneSubmit}>
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Copy className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Clone Role / Apply Template</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Duplicate an existing role or start from a pre-configured enterprise archetype.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCloneMode("role")}
                className={`py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  cloneMode === "role" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                From Existing Role
              </button>
              <button
                type="button"
                onClick={() => setCloneMode("preset")}
                className={`py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  cloneMode === "preset" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                From Archetype Preset
              </button>
            </div>

            {/* Source Selection */}
            {cloneMode === "role" ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Source Role to Clone</Label>
                <Select value={sourceRoleId} onValueChange={setSourceRoleId}>
                  <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                    <SelectValue placeholder="Select source role..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[220px]">
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                        {r.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Choose Role Archetype</Label>
                <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1">
                  {ROLE_PRESETS.map((preset) => {
                    const isSelected = selectedPreset === preset.name;
                    return (
                      <div
                        key={preset.name}
                        onClick={() => setSelectedPreset(preset.name)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/5 border-primary shadow-xs"
                            : "hover:bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                          <Badge variant="outline" className="text-[10px] bg-white font-medium">
                            {preset.badge}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">{preset.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Target Role Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">New Role Name</Label>
              <Input
                placeholder={`e.g., Senior ${cloneMode === "role" ? sourceRoleName : selectedPreset}`}
                value={targetRoleName}
                onChange={(e) => setTargetRoleName(e.target.value)}
                className="h-9 text-xs border-slate-200"
                autoFocus
              />
            </div>

            {/* Cloned Permissions Summary Banner */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-600">Permissions to be copied:</span>
              <Badge className="bg-primary text-white font-bold text-xs">
                {targetPermissionIds.length} Permissions
              </Badge>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !targetRoleName.trim()}
              className="text-xs shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Creating &amp; Cloning...
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Clone &amp; Create Role
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
