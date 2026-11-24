"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, History, ArrowRight, UserCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { StaffMember } from "./staff-types";
import { getStaffRoleAuditTrailAction } from "@/lib/actions";

interface StaffRoleHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember | null;
}

export function StaffRoleHistoryDialog({
  open,
  onOpenChange,
  staff,
}: StaffRoleHistoryDialogProps) {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !staff?.email) {
      setLogs([]);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    getStaffRoleAuditTrailAction(staff.email)
      .then((res: any) => {
        if (!isCurrent) return;
        const trail = Array.isArray(res) ? res : res?.data || [];
        setLogs(trail);
      })
      .catch((err) => {
        console.warn("Failed to load staff role audit trail:", err);
        if (isCurrent) setLogs([]);
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [open, staff?.email]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Staff Role & Access History
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Audited timeline of role transitions and credential updates for {staff?.name} ({staff?.email})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Staff Summary Card */}
        {staff && (
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-900">{staff.name}</p>
              <p className="text-slate-500">{staff.email} · {staff.branchName || "All Branches"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Current Role:</span>
              <Badge variant="outline" className="capitalize font-bold bg-blue-50 text-blue-700 border-blue-200">
                {staff.role}
              </Badge>
            </div>
          </div>
        )}

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-2 min-h-[220px]">
          {loading ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Loading audit trail history...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2 text-center p-4 border border-dashed rounded-lg">
              <ShieldCheck className="h-8 w-8 text-slate-300" />
              <p className="text-xs font-medium text-slate-600">No Historical Role Reassignments</p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                This staff member is currently on their initial assigned role ({staff?.role}). Future privilege changes will be recorded here automatically.
              </p>
            </div>
          ) : (
            <div className="relative border-l border-slate-200 ml-4 pl-4 space-y-4">
              {logs.map((log, index) => {
                const details = typeof log.details === "string" ? JSON.parse(log.details || "{}") : log.details || {};
                const sev = (log.severity || "info").toLowerCase();
                const dotColor = sev === "critical" ? "bg-red-500" : sev === "warning" ? "bg-amber-500" : "bg-blue-500";

                return (
                  <div key={log.id || index} className="relative group">
                    {/* Timeline Node Dot */}
                    <span className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white shadow-xs ${dotColor}`} />

                    <div className="bg-white p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-shadow shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-slate-900">{log.event}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {format(new Date(log.created_at), "yyyy-MM-dd HH:mm")}
                        </span>
                      </div>

                      {/* Role transition info */}
                      {(details.old_role || details.new_role) && (
                        <div className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-slate-50 border border-slate-100">
                          <span className="text-slate-500 font-medium">Transition:</span>
                          <span className="line-through text-slate-400">{details.old_role || "Previous"}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="font-bold text-slate-800">{details.new_role || "New Role"}</span>
                        </div>
                      )}

                      {/* Actor & Metadata */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="h-3 w-3 text-slate-400" />
                          By: <strong className="text-slate-700">{details.changed_by || log.staff_email || "System Admin"}</strong>
                        </span>
                        {log.ip_address && log.ip_address !== "unknown" && (
                          <span className="font-mono text-[10px] text-slate-400">IP: {log.ip_address}</span>
                        )}
                        {details.reason && (
                          <span className="italic text-slate-600">Note: &ldquo;{details.reason}&rdquo;</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close Audit Trail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
