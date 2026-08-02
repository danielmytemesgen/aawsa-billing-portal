"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, UploadCloud, Building, FileSpreadsheet, Lock, SignalLow } from "lucide-react";
import { StaffBulkMeterEntryForm } from "./staff-bulk-meter-entry-form";
import { StaffIndividualCustomerEntryForm } from "./individual-customer-data-entry-form";
import { CsvUploadSection } from "@/app/(dashboard)/admin/data-entry/csv-upload-section";
import {
  bulkMeterDataEntrySchema,
  individualCustomerDataEntrySchema,
  type BulkMeterDataEntryFormValues,
  type IndividualCustomerDataEntryFormValues
} from "@/app/(dashboard)/admin/data-entry/customer-data-entry-types";
import {
  addBulkMeter,
  addCustomer,
  initializeBulkMeters,
  initializeCustomers,
  getCustomers,
  initializeBranches,
  initializeStaffMembers,
  getBranches,
  getStaffMembers
} from "@/lib/data-store";
import { generateCustomerKeys } from "@/lib/utils";
import { batchImportBulkMetersAction, batchImportIndividualCustomersAction } from "@/lib/actions";
import { usePermissions } from "@/hooks/use-permissions";
import { useBandwidthHint } from "@/hooks/use-bandwidth-hint";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { StaffMember } from "@/app/(dashboard)/admin/staff-management/staff-types";
const bulkMeterCsvHeaders = ["name", "contractNumber", "meterSize", "NUMBER_OF_DIALS", "meterNumber", "previousReading", "currentReading", "month", "specificArea", "subCity", "woreda", "phoneNumber", "chargeGroup", "sewerageConnection", "xCoordinate", "yCoordinate", "routeKey", "branchId"];
const individualCustomerCsvHeaders = ["name", "customerKeyNumber", "instKey", "contractNumber", "customerType", "bookNumber", "ordinal", "meterSize", "NUMBER_OF_DIALS", "meterNumber", "previousReading", "currentReading", "month", "specificArea", "subCity", "woreda", "sewerageConnection", "assignedBulkMeterId", "branchId"];

/** Reusable locked card shown when user lacks a specific permission */
function LockedSection({ title, description }: { title: string; description: string }) {
  return (
    <Card className="shadow-md rounded-xl animate-in fade-in duration-300">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="p-4 bg-muted rounded-full">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-lg">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}



interface User {
  email: string;
  role: "admin" | "staff" | "reader" | "Admin" | "Staff" | "Reader" | "Staff Management" | "staff management";
  branchName?: string;
  branchId?: string;
}

export default function StaffDataEntryPage() {
  const { hasPermission } = usePermissions();
  const { isSlowConnection } = useBandwidthHint();
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);
  const [staffBranchName, setStaffBranchName] = React.useState<string>("Your Branch");
  const [staffBranchId, setStaffBranchId] = React.useState<string | null>(null);
  const [isBranchDetermined, setIsBranchDetermined] = React.useState(false);

  React.useEffect(() => {
    initializeBulkMeters();
    initializeCustomers();

    const resolveBranch = async () => {
      await Promise.all([initializeBranches(), initializeStaffMembers()]);
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser: any = JSON.parse(storedUser);
          setCurrentUser(parsedUser as StaffMember);

          let bName = parsedUser.branchName || parsedUser.branch || "";
          let bId = parsedUser.branchId || "";
          const allBranches = getBranches();

          // Fallback lookup from staff members if missing from user object
          if ((!bName || !bId) && parsedUser.email) {
            const staffMatch = getStaffMembers().find((s: StaffMember) => s.email?.toLowerCase() === parsedUser.email?.toLowerCase());
            if (staffMatch) {
              if (!bName && staffMatch.branchName) bName = staffMatch.branchName;
              if (!bId && staffMatch.branchId) bId = staffMatch.branchId;
            }
          }

          // Match by name or ID if one is missing
          if (bName && !bId) {
            const found = allBranches.find((b: any) => b.name.trim().toLowerCase() === bName.trim().toLowerCase() || b.name.trim().toLowerCase().includes(bName.trim().toLowerCase()) || bName.trim().toLowerCase().includes(b.name.trim().toLowerCase()));
            if (found) bId = found.id;
          }
          if (bId && (!bName || bName === "Your Branch" || bName === "Unknown Branch")) {
            const found = allBranches.find((b: any) => b.id === bId);
            if (found) bName = found.name;
          }

          if (bName && bName !== "Your Branch" && bName !== "Unknown Branch") {
            setStaffBranchName(bName);
            setStaffBranchId(bId || null);
            if (parsedUser.branchName !== bName || parsedUser.branchId !== bId) {
              parsedUser.branchName = bName;
              parsedUser.branchId = bId;
              localStorage.setItem("user", JSON.stringify(parsedUser));
            }
          } else if (bId) {
            const found = allBranches.find((b: any) => b.id === bId);
            if (found) {
              setStaffBranchName(found.name);
              setStaffBranchId(found.id);
            } else {
              setStaffBranchName("Unassigned Branch");
            }
          } else {
            setStaffBranchName("Unassigned Branch");
          }
        } catch (e) {
          console.error("Failed to parse user from localStorage", e);
          setStaffBranchName("Error: Branch Undefined");
        }
      } else {
        setStaffBranchName("Error: Not Logged In");
      }
      setIsBranchDetermined(true);
    };

    resolveBranch();
  }, []);




  const handleBulkMeterCsvUpload = async (data: BulkMeterDataEntryFormValues) => {
    // Auto‑generate keys if CSV omitted them
    if (!data.customerKeyNumber || !data.instKey) {
      const existing = getCustomers();
      const { customerKey, instKey } = generateCustomerKeys(existing);
      if (!data.customerKeyNumber) data.customerKeyNumber = customerKey;
      if (!data.instKey) data.instKey = instKey;
    }
    return await addBulkMeter(data);
  };

  const handleIndividualCustomerCsvUpload = async (data: IndividualCustomerDataEntryFormValues) => {
    return await addCustomer(data);
  };

  const downloadCsvTemplate = (headers: string[], fileName: string) => {
    // Build a sample data row with branchId pre-filled for this staff member
    const sampleRow = headers.map(h => {
      if (h.toLowerCase() === 'branchid') return staffBranchId ?? '';
      return '';
    });
    const csvString = headers.join(',') + '\n' + sampleRow.join(',') + '\n';
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
  };

  if (!hasPermission('data_entry_access')) {
    return (
      <Alert variant="destructive">
        <Lock className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <CardDescription>You do not have permission to perform data entry.</CardDescription>
      </Alert>
    )
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

  const canProceedWithDataEntry = staffBranchName !== "Error: Not Logged In" && staffBranchName !== "Error: Branch Undefined" && staffBranchName !== "Unassigned Branch";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Customer Data Entry ({staffBranchName})</h1>
      </div>

      {!canProceedWithDataEntry && (
        <Card className="shadow-md border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Building className="h-5 w-5" /> Branch Information Issue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {staffBranchName === "Unassigned Branch"
                ? "You are not assigned to a specific branch. Please contact an administrator."
                : "Could not determine your branch. Please ensure you are logged in correctly or contact an administrator."
              }
            </p>
          </CardContent>
        </Card>
      )}

      {canProceedWithDataEntry && (
        <Tabs defaultValue="manual-individual" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
            <TabsTrigger value="manual-individual">
              <FileText className="mr-2 h-4 w-4" /> Individual (Manual)
            </TabsTrigger>
            <TabsTrigger value="manual-bulk">
              <FileText className="mr-2 h-4 w-4" /> Bulk Meter (Manual)
            </TabsTrigger>
            <TabsTrigger value="csv-upload">
              <UploadCloud className="mr-2 h-4 w-4" /> CSV Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual-individual">
            <Card className="shadow-lg mt-4">
              {!hasPermission('data_entry_individual_form') ? (
                <LockedSection
                  title="Individual Customer Form — Access Restricted"
                  description="You do not have permission to enter individual customer data using the manual form."
                />
              ) : (
                <>
                  <CardHeader>
                    <CardTitle>Individual Customer Data Entry</CardTitle>
                    <CardDescription>
                      Manually enter data for a single individual customer.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StaffIndividualCustomerEntryForm branchName={staffBranchName} />
                  </CardContent>
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="manual-bulk">
            <Card className="shadow-lg mt-4">
              {!hasPermission('data_entry_bulk_form') ? (
                <LockedSection
                  title="Bulk Meter Form — Access Restricted"
                  description="You do not have permission to enter bulk meter data using the manual form."
                />
              ) : (
                <>
                  <CardHeader>
                    <CardTitle>Bulk Meter Data Entry</CardTitle>
                    <CardDescription>
                      Manually enter data for a single bulk meter.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StaffBulkMeterEntryForm branchName={staffBranchName} />
                  </CardContent>
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="csv-upload">
            {isSlowConnection && (
              <Alert className="mt-4 border-amber-500/50 bg-amber-50 text-amber-900">
                <SignalLow className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-900 font-semibold">Slow Network Detected</AlertTitle>
                <AlertDescription className="text-amber-800 text-xs">
                  Batch CSV uploads may take longer or fail on weak connections. For best results on 2G/3G networks, use the manual data entry forms which support automatic offline saving.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              {/* Bulk Meter CSV */}
              {!hasPermission('data_entry_bulk_csv') ? (
                <LockedSection
                  title="Bulk Meter CSV Upload — Access Restricted"
                  description="You do not have permission to upload bulk meter data via CSV."
                />
              ) : (
                <Card className="shadow-lg">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle>Bulk Meter CSV Upload</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCsvTemplate(bulkMeterCsvHeaders, 'bulk_meter_template.csv')}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Download Template
                      </Button>
                    </div>
                    <CardDescription className="mt-2">
                      Upload a CSV file to add multiple bulk meters.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CsvUploadSection
                      entryType="bulk"
                      schema={bulkMeterDataEntrySchema}
                      addRecordFunction={handleBulkMeterCsvUpload}
                      expectedHeaders={bulkMeterCsvHeaders}
                      batchUploadFunction={batchImportBulkMetersAction}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Individual Customer CSV */}
              {!hasPermission('data_entry_individual_csv') ? (
                <LockedSection
                  title="Individual Customer CSV Upload — Access Restricted"
                  description="You do not have permission to upload individual customer data via CSV."
                />
              ) : (
                <Card className="shadow-lg">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle>Individual Customer CSV Upload</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCsvTemplate(individualCustomerCsvHeaders, 'individual_customer_template.csv')}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Download Template
                      </Button>
                    </div>
                    <CardDescription className="mt-2">
                      Upload a CSV file to add multiple individual customers.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CsvUploadSection
                      entryType="individual"
                      schema={individualCustomerDataEntrySchema}
                      addRecordFunction={handleIndividualCustomerCsvUpload}
                      expectedHeaders={individualCustomerCsvHeaders}
                      batchUploadFunction={batchImportIndividualCustomersAction}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
