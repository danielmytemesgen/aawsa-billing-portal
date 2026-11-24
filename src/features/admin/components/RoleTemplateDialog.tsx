"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, FileText, CheckCircle2, AlertTriangle, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DomainRole, DomainPermission, DomainRolePermission } from "@/lib/data-store";
import { createRole, updateRolePermissions, getRoles } from "@/lib/data-store";
import { broadcastPermissionsUpdated } from "@/lib/permissions-sync";

interface RoleTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: DomainRole[];
  permissions: DomainPermission[];
  rolePermissions: DomainRolePermission[];
  canManage: boolean;
}

interface ExportTemplatePayload {
  format: "AAWSA_ROLES_PERMISSIONS_TEMPLATE_V1";
  exportedAt: string;
  totalRoles: number;
  roles: Array<{
    name: string;
    permissions: string[];
  }>;
}

export function RoleTemplateDialog({
  open,
  onOpenChange,
  roles,
  permissions,
  rolePermissions,
  canManage,
}: RoleTemplateDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<"export" | "import">("export");
  const [importJsonText, setImportJsonText] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [isApplying, setIsApplying] = React.useState(false);
  const [importPreview, setImportPreview] = React.useState<{
    valid: boolean;
    error?: string;
    rolesToCreate: string[];
    rolesToUpdate: string[];
    totalPermissionsMapped: number;
    parsedPayload?: ExportTemplatePayload;
  } | null>(null);

  // Generate Export JSON
  const exportData: ExportTemplatePayload = React.useMemo(() => {
    const permMap = new Map<number, string>();
    permissions.forEach((p) => permMap.set(p.id, p.name));

    const rolePermMap = new Map<number, string[]>();
    roles.forEach((r) => rolePermMap.set(r.id, []));

    rolePermissions.forEach((rp) => {
      const pName = permMap.get(rp.permission_id);
      if (pName && rolePermMap.has(rp.role_id)) {
        rolePermMap.get(rp.role_id)!.push(pName);
      }
    });

    const exportedRoles = roles.map((r) => ({
      name: r.role_name,
      permissions: (rolePermMap.get(r.id) || []).sort(),
    }));

    return {
      format: "AAWSA_ROLES_PERMISSIONS_TEMPLATE_V1",
      exportedAt: new Date().toISOString(),
      totalRoles: exportedRoles.length,
      roles: exportedRoles,
    };
  }, [roles, permissions, rolePermissions]);

  const exportJsonString = React.useMemo(() => {
    return JSON.stringify(exportData, null, 2);
  }, [exportData]);

  const handleDownloadJson = () => {
    try {
      const blob = new Blob([exportJsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `aawsa-roles-template-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Export Successful",
        description: `Exported ${exportData.totalRoles} role configurations.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not generate download file.",
      });
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(exportJsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to Clipboard", description: "JSON template copied to clipboard." });
  };

  // Parse & Validate Import JSON
  const handleValidateImport = (text: string) => {
    setImportJsonText(text);
    if (!text.trim()) {
      setImportPreview(null);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      if (!parsed.roles || !Array.isArray(parsed.roles)) {
        setImportPreview({
          valid: false,
          error: "Invalid format: JSON must contain a 'roles' array.",
          rolesToCreate: [],
          rolesToUpdate: [],
          totalPermissionsMapped: 0,
        });
        return;
      }

      const existingRoleNames = new Set(roles.map((r) => r.role_name.toLowerCase()));
      const rolesToCreate: string[] = [];
      const rolesToUpdate: string[] = [];
      let totalPerms = 0;

      for (const item of parsed.roles) {
        if (!item.name || typeof item.name !== "string") continue;
        const roleName = item.name.trim();
        if (existingRoleNames.has(roleName.toLowerCase())) {
          rolesToUpdate.push(roleName);
        } else {
          rolesToCreate.push(roleName);
        }
        if (Array.isArray(item.permissions)) {
          totalPerms += item.permissions.length;
        }
      }

      setImportPreview({
        valid: true,
        rolesToCreate,
        rolesToUpdate,
        totalPermissionsMapped: totalPerms,
        parsedPayload: parsed,
      });
    } catch (e: any) {
      setImportPreview({
        valid: false,
        error: e.message || "Failed to parse JSON syntax.",
        rolesToCreate: [],
        rolesToUpdate: [],
        totalPermissionsMapped: 0,
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        handleValidateImport(content);
      }
    };
    reader.readAsText(file);
  };

  // Apply Imported Template
  const handleApplyImport = async () => {
    if (!importPreview?.valid || !importPreview.parsedPayload) return;
    setIsApplying(true);

    try {
      const permNameToId = new Map<string, number>();
      permissions.forEach((p) => permNameToId.set(p.name, p.id));

      const currentRoles = getRoles();
      const roleMap = new Map<string, DomainRole>();
      currentRoles.forEach((r) => roleMap.set(r.role_name.toLowerCase(), r));

      let createdCount = 0;
      let updatedCount = 0;

      for (const roleDef of importPreview.parsedPayload.roles) {
        if (!roleDef.name) continue;
        const trimmedName = roleDef.name.trim();
        let targetRole = roleMap.get(trimmedName.toLowerCase());

        // 1. Create role if not existing
        if (!targetRole) {
          const createRes = await createRole(trimmedName);
          if (createRes.success && createRes.data) {
            targetRole = createRes.data;
            roleMap.set(trimmedName.toLowerCase(), targetRole);
            createdCount++;
          }
        }
        // 2. Map permissions
        if (targetRole && Array.isArray(roleDef.permissions)) {
          const validPermIds: number[] = [];
          for (const pName of roleDef.permissions) {
            const id = permNameToId.get(pName);
            if (id !== undefined) validPermIds.push(id);
          }

          await updateRolePermissions(targetRole.id, validPermIds);
          updatedCount++;
        }
      }

      broadcastPermissionsUpdated();
      toast({
        title: "Import Completed",
        description: `Created ${createdCount} new role(s) and synchronized permissions for ${updatedCount} role(s).`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Import Error",
        description: err?.message || "Failed to import role template.",
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Roles & Permissions Template (JSON)
          </DialogTitle>
          <DialogDescription>
            Export current system roles and privileges as portable JSON or import predefined bundles.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2 mb-3">
            <TabsTrigger value="export" className="flex items-center gap-1.5 text-xs font-semibold">
              <Download className="h-3.5 w-3.5" />
              Export Template
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-1.5 text-xs font-semibold">
              <Upload className="h-3.5 w-3.5" />
              Import Template
            </TabsTrigger>
          </TabsList>

          {/* EXPORT TAB */}
          <TabsContent value="export" className="space-y-4 flex-1 flex flex-col mt-0">
            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <span>Roles: <strong>{exportData.totalRoles}</strong></span>
                <span>Permissions: <strong>{permissions.length}</strong></span>
                <span>Assignments: <strong>{rolePermissions.length}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={handleCopyJson} className="h-7 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5 mr-1 text-green-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button size="sm" onClick={handleDownloadJson} className="h-7 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download JSON
                </Button>
              </div>
            </div>

            <Textarea
              readOnly
              value={exportJsonString}
              className="font-mono text-xs h-72 resize-none bg-slate-900 text-slate-100 rounded-lg p-3"
            />
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-4 flex-1 flex flex-col mt-0">
            {!canManage ? (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
                You do not have administrative permission to import or modify roles.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="template-file" className="text-xs font-semibold text-slate-700">
                    Upload .json file or paste template below:
                  </Label>
                  <Input
                    id="template-file"
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="max-w-xs h-8 text-xs cursor-pointer file:cursor-pointer"
                  />
                </div>

                <Textarea
                  placeholder="Paste AAWSA roles JSON template here..."
                  value={importJsonText}
                  onChange={(e) => handleValidateImport(e.target.value)}
                  className="font-mono text-xs h-40 resize-none rounded-lg p-3"
                />

                {importPreview && (
                  <div
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      importPreview.valid
                        ? "bg-green-50 border-green-200 text-green-900"
                        : "bg-red-50 border-red-200 text-red-900"
                    }`}
                  >
                    {importPreview.valid ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Valid Role Template Detected
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                          <Badge variant="outline" className="bg-white text-green-800">
                            Roles to Create: {importPreview.rolesToCreate.length}
                          </Badge>
                          <Badge variant="outline" className="bg-white text-blue-800">
                            Roles to Synchronize: {importPreview.rolesToUpdate.length}
                          </Badge>
                          <Badge variant="outline" className="bg-white text-slate-800">
                            Permission Mappings: {importPreview.totalPermissionsMapped}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 font-medium">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <div>{importPreview.error}</div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 pt-3 border-t">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
          {activeTab === "import" && canManage && (
            <Button
              size="sm"
              disabled={!importPreview?.valid || isApplying}
              onClick={handleApplyImport}
              className="text-xs bg-primary"
            >
              {isApplying ? "Applying Template..." : "Apply Template to Portal"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
