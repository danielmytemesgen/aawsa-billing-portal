"use client";

import * as React from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, UploadCloud, Building, FileSpreadsheet, AlertCircle, ChevronDown, Lock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StaffBulkMeterEntryForm } from "./staff-bulk-meter-entry-form";
import { StaffIndividualCustomerEntryForm } from "./individual-customer-data-entry-form";
import { CsvUploadSection } from "@/app/(dashboard)/admin/data-entry/csv-upload-section";
import {
  bulkMeterDataEntrySchema,
  baseBulkMeterDataSchema,
  individualCustomerDataEntrySchema,
  baseIndividualCustomerDataSchema,
  type BulkMeterDataEntryFormValues,
  type IndividualCustomerDataEntryFormValues
} from "@/app/(dashboard)/admin/data-entry/customer-data-entry-types";
import {
  addBulkMeter,
  addCustomer,
  initializeBulkMeters,
  initializeCustomers,
  initializeBranches,
  getBranches,
  getBulkMeters,
  getCustomers,
  subscribeToBranches
} from "@/lib/data-store";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { generateBulkMeterKeys, generateCustomerKeys } from "@/lib/utils";
import { batchImportBulkMetersAction, batchImportIndividualCustomersAction } from "@/lib/actions";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import type { StaffMember } from "@/app/(dashboard)/admin/staff-management/staff-types";

const bulkMeterCsvHeaders = ["name", "contractNumber", "meterSize", "NUMBER_OF_DIALS", "meterNumber", "previousReading", "currentReading", "month", "specificArea", "subCity", "woreda", "phoneNumber", "chargeGroup", "sewerageConnection", "xCoordinate", "yCoordinate", "zCoordinate", "routeKey", "ordinal", "branchId"];
const individualCustomerCsvHeaders = ["name", "customerKeyNumber", "instKey", "contractNumber", "customerType", "bookNumber", "ordinal", "meterSize", "NUMBER_OF_DIALS", "meterNumber", "previousReading", "currentReading", "month", "specificArea", "subCity", "woreda", "sewerageConnection", "assignedBulkMeterId", "branchId", "xCoordinate", "yCoordinate", "zCoordinate"];

// Schema for CSV upload that allows auto-generated fields to be optional
const bulkMeterCsvSchema = baseBulkMeterDataSchema.extend({
  customerKeyNumber: z.string().optional(),
  instKey: z.string().optional(),
}).refine((data: any) => {
  if (data.currentReading !== undefined && data.previousReading !== undefined) {
    return data.currentReading >= data.previousReading;
  }
  return true;
}, {
  message: "Current Reading must be greater than or equal to Previous Reading.",
  path: ["currentReading"],
});

const individualCustomerCsvSchema = baseIndividualCustomerDataSchema.extend({
  customerKeyNumber: z.string().optional(),
  instKey: z.string().optional(),
}).refine((data: any) => {
  if (data.currentReading !== undefined && data.previousReading !== undefined) {
    return data.currentReading >= data.previousReading;
  }
  return true;
}, {
  message: "Current Reading must be greater than or equal to Previous Reading.",
  path: ["currentReading"],
});

export default function StaffDataEntryPage() {
  const { hasPermission } = usePermissions();
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);
  const [allBranches, setAllBranches] = React.useState<Branch[]>([]);
  const [staffBranchName, setStaffBranchName] = React.useState<string>("Your Branch");
  const [staffBranchId, setStaffBranchId] = React.useState<string | null>(null);
  const [isBranchDetermined, setIsBranchDetermined] = React.useState(false);

  // Dialog state for template download
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false);
  const [pendingTemplate, setPendingTemplate] = React.useState<{ headers: string[]; fileName: string } | null>(null);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("");

  React.useEffect(() => {
    initializeBulkMeters();
    initializeCustomers();

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser: any = JSON.parse(storedUser);
        setCurrentUser(parsedUser);

        const bName = parsedUser.branchName || parsedUser.branch || parsedUser.branch_name || parsedUser.assignedBranch || parsedUser.subCity;
        const bId = parsedUser.branchId || parsedUser.branch_id;

        if (bName && bName !== "Your Branch") {
          setStaffBranchName(bName);
        }
        if (bId) {
          setStaffBranchId(bId);
          setSelectedBranchId(bId);
        }

        initializeBranches().then(() => {
          const branches = getBranches();
          setAllBranches(branches);
          const targetName = bName || staffBranchName;
          if (targetName && targetName !== "Your Branch") {
            const found = branches.find(b => {
              const bLower = b.name.trim().toLowerCase();
              const tLower = targetName.trim().toLowerCase();
              return bLower === tLower || bLower.includes(tLower) || tLower.includes(bLower);
            });
            if (found) {
              setStaffBranchName(found.name);
              setStaffBranchId(found.id);
              setSelectedBranchId(found.id);
            }
          }
        });
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
        setStaffBranchName("Error: Branch Undefined");
      }
    } else {
      setStaffBranchName("Error: Not Logged In");
    }
    setIsBranchDetermined(true);

    const unsubBranches = subscribeToBranches((updated) => setAllBranches(updated));
    return () => { unsubBranches(); };
  }, []);

  const handleBulkMeterCsvUpload = async (data: BulkMeterDataEntryFormValues) => {
    if (!currentUser) return { success: false, message: "User not authenticated" };
    
    // Auto-generate keys if CSV omitted them
    const finalData = { ...data };
    if (!finalData.customerKeyNumber || !finalData.instKey) {
      const existingMeters = getBulkMeters();
      const generated = generateBulkMeterKeys(existingMeters);
      finalData.customerKeyNumber = finalData.customerKeyNumber || generated.customerKey;
      finalData.instKey = finalData.instKey || generated.instKey;
    }
    if (!finalData.branchId && staffBranchId) {
      finalData.branchId = staffBranchId;
    }
    return await addBulkMeter(finalData);
  };

  const handleIndividualCustomerCsvUpload = async (data: IndividualCustomerDataEntryFormValues) => {
    if (!currentUser) return { success: false, message: "User not authenticated" };
    
    const finalData = { ...data };
    if (!finalData.customerKeyNumber || !finalData.instKey) {
      const existingCustomers = getCustomers();
      const generated = generateCustomerKeys(existingCustomers);
      finalData.customerKeyNumber = finalData.customerKeyNumber || generated.customerKey;
      finalData.instKey = finalData.instKey || generated.instKey;
    }
    if (!finalData.branchId && staffBranchId) {
      finalData.branchId = staffBranchId;
    }
    return await addCustomer(finalData);
  };

  const openTemplateDialog = (headers: string[], fileName: string) => {
    setPendingTemplate({ headers, fileName });
    if (!selectedBranchId && staffBranchId) {
      setSelectedBranchId(staffBranchId);
    }
    setTemplateDialogOpen(true);
  };

  const downloadCsvTemplate = () => {
    if (!pendingTemplate) return;
    const { headers, fileName } = pendingTemplate;

    const sampleRow = headers.map(h => {
      if (h.toLowerCase() === 'branchid') return selectedBranchId || staffBranchId || '';
      return '';
    });

    const branchRefComments = allBranches.length > 0
      ? allBranches.map(b => `# Branch: "${b.name}" -> ID: ${b.id}`).join('\n') + '\n'
      : '';

    const csvString =
      '# CSV DATA ENTRY TEMPLATE\n' +
      '# Fill in row data below the header. The branchId column has been pre-filled with your selected branch.\n' +
      '# Branch Reference List:\n' +
      branchRefComments +
      headers.join(',') + '\n' +
      sampleRow.join(',') + '\n';

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    setTemplateDialogOpen(false);
  };

  const canIndividualManual = hasPermission('data_entry_access') || hasPermission('customers_create') || hasPermission('data_entry_individual_form');
  const canBulkManual = hasPermission('data_entry_access') || hasPermission('bulk_meters_create') || hasPermission('data_entry_bulk_form');
  const canCsvUpload = hasPermission('data_entry_access') || hasPermission('customers_create') || hasPermission('bulk_meters_create') || hasPermission('data_entry_bulk_csv') || hasPermission('data_entry_individual_csv');
  const canAccessDataEntry = canIndividualManual || canBulkManual || canCsvUpload;

  if (!canAccessDataEntry) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Customer Data Entry</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <CardDescription>You do not have permission to access the data entry page.</CardDescription>
        </Alert>
      </div>
    );
  }

  if (!isBranchDetermined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Customer Data Entry (Loading branch info...)</h1>
        <Card className="shadow-md border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Building className="h-5 w-5 animate-spin" /> Loading Branch Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please wait while we determine your assigned branch.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const defaultTab = canIndividualManual ? "manual-individual" : (canBulkManual ? "manual-bulk" : "csv-upload");

  return (
    <div className="space-y-6 relative min-h-[calc(100vh-100px)]">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[0%] left-[-5%] w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] pointer-events-none z-0" />

      <div className="flex items-center justify-between relative z-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-400 dark:to-white bg-clip-text text-transparent">
            Customer Data Entry {staffBranchName && staffBranchName !== "Your Branch" ? `(${staffBranchName})` : ''}
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Manage and record system data with precision.</p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full relative z-10">
        <TabsList className="grid w-full max-w-xl grid-cols-3 p-1.5 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/50 h-auto">
          {canIndividualManual && (
            <TabsTrigger 
              value="manual-individual" 
              className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all duration-300"
            >
              <FileText className="mr-2 h-4 w-4 text-primary" /> 
              <span className="font-semibold">Individual (Manual)</span>
            </TabsTrigger>
          )}
          {canBulkManual && (
            <TabsTrigger 
              value="manual-bulk" 
              className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all duration-300"
            >
              <FileText className="mr-2 h-4 w-4 text-primary" /> 
              <span className="font-semibold">Bulk Meter (Manual)</span>
            </TabsTrigger>
          )}
          {canCsvUpload && (
            <TabsTrigger 
              value="csv-upload" 
              className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all duration-300"
            >
              <UploadCloud className="mr-2 h-4 w-4 text-primary" /> 
              <span className="font-semibold">CSV Upload</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="manual-individual" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
          <Card className="form-card-premium rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Individual Customer Data Entry</CardTitle>
                  <CardDescription className="text-sm font-medium">
                    Manually enter data for a single individual customer. Designed for quick, one-off entries.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <StaffIndividualCustomerEntryForm branchName={staffBranchName} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual-bulk" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
          <Card className="form-card-premium rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Bulk Meter Data Entry</CardTitle>
                  <CardDescription className="text-sm font-medium">
                    Manually enter data for a single bulk meter.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <StaffBulkMeterEntryForm branchName={staffBranchName} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv-upload" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Card className="form-card-premium rounded-3xl">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <UploadCloud className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Bulk Meter CSV Upload</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-primary/20 hover:border-primary transition-all duration-300"
                    onClick={() => openTemplateDialog(bulkMeterCsvHeaders, 'bulk_meter_template.csv')}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Template
                  </Button>
                </div>
                <CardDescription className="pt-4 font-medium leading-relaxed">
                  Upload multiple bulk meters at once. Ensure the CSV file structure, headers, and column order match the template exactly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CsvUploadSection 
                  entryType="bulk"
                  schema={bulkMeterCsvSchema}
                  addRecordFunction={handleBulkMeterCsvUpload}
                  expectedHeaders={bulkMeterCsvHeaders}
                  batchUploadFunction={batchImportBulkMetersAction}
                />
              </CardContent>
            </Card>

            <Card className="form-card-premium rounded-3xl">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <UploadCloud className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Individual Customer CSV Upload</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-primary/20 hover:border-primary transition-all duration-300"
                    onClick={() => openTemplateDialog(individualCustomerCsvHeaders, 'individual_customer_template.csv')}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Template
                  </Button>
                </div>
                <CardDescription className="pt-4 font-medium leading-relaxed">
                  Upload multiple individual customers. Ensure the <code className="bg-primary/5 px-1 rounded text-primary text-xs">customerKeyNumber</code> is unique and <code className="bg-primary/5 px-1 rounded text-primary text-xs">assignedBulkMeterId</code> exists.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CsvUploadSection
                  entryType="individual"
                  schema={individualCustomerCsvSchema}
                  addRecordFunction={handleIndividualCustomerCsvUpload}
                  expectedHeaders={individualCustomerCsvHeaders}
                  batchUploadFunction={batchImportIndividualCustomersAction}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Branch Picker Dialog for CSV Template Download */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Select Branch for Template</DialogTitle>
            <DialogDescription>
              Choose a branch to pre-fill the <code className="bg-primary/10 px-1 rounded text-primary text-xs">branchId</code> column.
              The template will also include all branch IDs as reference comments.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Select a branch..." />
              </SelectTrigger>
              <SelectContent>
                {allBranches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    <span className="font-medium">{branch.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{branch.id.slice(0, 8)}…</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBranchId && (
              <p className="mt-2 text-xs text-muted-foreground font-mono break-all">
                Full ID: {selectedBranchId}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={downloadCsvTemplate}
              disabled={!selectedBranchId}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
