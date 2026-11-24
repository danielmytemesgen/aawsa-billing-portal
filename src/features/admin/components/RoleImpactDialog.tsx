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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DomainRole, DomainPermission } from "@/lib/data-store";
import { formatPermissionName } from "@/lib/roles-permissions-utils";
import { AlertCircle, Plus, Minus, Users, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

export interface RoleImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: DomainRole | null;
  addedPermissions: DomainPermission[];
  removedPermissions: DomainPermission[];
  affectedStaffCount: number;
  conflicts: Array<{ global: string; branch: string }>;
  isSaving: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

export function RoleImpactDialog({
  open,
  onOpenChange,
  role,
  addedPermissions,
  removedPermissions,
  affectedStaffCount,
  conflicts,
  isSaving,
  onConfirm,
}: RoleImpactDialogProps) {
  const [auditReason, setAuditReason] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setAuditReason("");
    }
  }, [open]);

  const handleConfirm = async () => {
    await onConfirm(auditReason.trim() || "Administrative privilege adjustment");
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col rounded-xl shadow-2xl border-slate-200 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-slate-50/60 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Review Privilege Changes</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Confirm privilege modifications and review downstream staff impact for <span className="font-semibold text-slate-800">"{role.role_name}"</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="overflow-y-auto flex-grow p-5 space-y-4 max-h-[460px]">
          {/* Affected Staff Callout */}
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Currently assigned to <strong>{affectedStaffCount} staff member{affectedStaffCount === 1 ? "" : "s"}</strong>.
              </span>
            </div>
            <Badge variant="outline" className="bg-white border-blue-300 text-blue-700 text-[10px] font-bold">
              Immediate Effect
            </Badge>
          </div>

          {/* Conflict Warning (if any) */}
          {conflicts.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Mutual Exclusivity Conflict Detected ({conflicts.length})</span>
              </div>
              <p className="text-[11px] text-amber-700">
                This role contains both City-Wide and Branch-Only permissions for the same report. City-Wide automatically supersedes Branch-Only.
              </p>
            </div>
          )}

          {/* Added Permissions (+X) */}
          {addedPermissions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span className="flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  Granting Permissions ({addedPermissions.length})
                </span>
              </div>
              <div className="border border-emerald-200 rounded-lg p-2.5 bg-emerald-50/30 max-h-[140px] overflow-y-auto space-y-1.5">
                {addedPermissions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{formatPermissionName(p.name)}</span>
                    <span className="text-[10px] font-mono text-slate-400">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Removed Permissions (-Y) */}
          {removedPermissions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                <span className="flex items-center gap-1">
                  <Minus className="w-3.5 h-3.5 text-rose-600" />
                  Revoking Permissions ({removedPermissions.length})
                </span>
              </div>
              <div className="border border-rose-200 rounded-lg p-2.5 bg-rose-50/30 max-h-[140px] overflow-y-auto space-y-1.5">
                {removedPermissions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{formatPermissionName(p.name)}</span>
                    <span className="text-[10px] font-mono text-slate-400">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Reason Input */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold text-slate-700">
              Reason for Privilege Modification <span className="text-slate-400 font-normal">(optional audit note)</span>
            </Label>
            <Input
              placeholder="e.g., Annual access review, cashier promotion, audit compliance"
              value={auditReason}
              onChange={(e) => setAuditReason(e.target.value)}
              className="h-8 text-xs border-slate-200"
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-slate-50 flex items-center justify-between gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="text-xs"
          >
            Cancel &amp; Keep Editing
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isSaving}
            className="text-xs bg-primary text-white shadow-sm font-semibold"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Applying Changes...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Confirm &amp; Apply Privileges
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
