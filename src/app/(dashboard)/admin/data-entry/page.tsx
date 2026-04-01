"use client";

import * as React from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, UploadCloud, Info, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkMeterDataEntryForm } from "./bulk-meter-data-entry-form";
import { IndividualCustomerDataEntryForm } from "./individual-customer-data-entry-form";
import { CsvUploadSection } from "./csv-upload-section";
import {
  bulkMeterDataEntrySchema,
  baseBulkMeterDataSchema,
  individualCustomerDataEntrySchema,
  baseIndividualCustomerDataSchema,
  type BulkMeterDataEntryFormValues,
  type IndividualCustomerDataEntryFormValues
} from "./customer-data-entry-types";
import { addBulkMeter, addCustomer, initializeBulkMeters, initializeCustomers, getBulkMeters, getCustomers } from "@/lib/data-store";
import { generateBulkMeterKeys, generateCustomerKeys } from "@/lib/utils";
import type { BulkMeter, BulkMeterStatus } from "../bulk-meters/bulk-meter-types";
import type { IndividualCustomer, IndividualCustomerStatus } from "../individual-customers/individual-customer-types";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import type { StaffMember } from "../staff-management/staff-types";

const bulkMeterCsvHeaders = ["name", "contractNumber", "meterSize", "NUMBER_OF_DIALS", "meterNumber", "previousReading", "currentReading", "month", "specificArea", "subCity", "woreda", "phoneNumber", "chargeGroup", "sewerageConnection", "xCoordinate", "yCoordinate", "zCoordinate", "branchId", "routeKey", "ordinal"];
const individualCustomerCsvHeaders = ["name", "contractNumber", "customerType", "bookNumber", "ordinal", "meterSize", "NUMBER_OF_DIALS", "meterNumber", "previousReading", "currentReading", "month", "specificArea", "subCity", "woreda", "sewerageConnection", "assignedBulkMeterId", "branchId", "xCoordinate", "yCoordinate", "zCoordinate"];

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


export default function AdminDataEntryPage() {
  const { hasPermission } = usePermissions();
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);

  React.useEffect(() => {
    initializeBulkMeters(true);
    initializeCustomers(true);
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }
  }, []);

  const handleBulkMeterCsvUpload = async (data: BulkMeterDataEntryFormValues) => {
    if (!currentUser) return { success: false, message: "User not authenticated" };
    
    // Generate keys if missing
    let finalData = { ...data };
    if (!data.customerKeyNumber || !data.instKey) {
      const existingMeters = getBulkMeters();
      const generated = generateBulkMeterKeys(existingMeters);
      finalData.customerKeyNumber = data.customerKeyNumber || generated.customerKey;
      finalData.instKey = data.instKey || generated.instKey;
    }

    // Admins can upload directly as 'Active', others are 'Pending Approval'
    const status: BulkMeterStatus = 'Active';
    const bulkMeterDataWithStatus = { ...finalData, status } as any;
    return await addBulkMeter(bulkMeterDataWithStatus);
  };

  const handleIndividualCustomerCsvUpload = async (data: IndividualCustomerDataEntryFormValues) => {
    if (!currentUser) return { success: false, message: "User not authenticated" };
    
    // Generate keys if missing
    let finalData = { ...data };
    if (!data.customerKeyNumber || !data.instKey) {
      const existingCustomers = getCustomers();
      const generated = generateCustomerKeys(existingCustomers);
      finalData.customerKeyNumber = data.customerKeyNumber || generated.customerKey;
      finalData.instKey = data.instKey || generated.instKey;
    }

    // Admins can upload directly as 'Active', others are 'Pending Approval'
    const status: IndividualCustomerStatus = 'Active';
    const customerDataForStore = {
      ...finalData,
      status,
      paymentStatus: 'Unpaid', // Default payment status
    } as Omit<IndividualCustomer, 'created_at' | 'updated_at' | 'calculatedBill' | 'approved_by' | 'approved_at'>;
    return await addCustomer(customerDataForStore);
  };

  const downloadCsvTemplate = (headers: string[], fileName: string) => {
    const csvString = headers.join(',') + '\n';
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

  return (
    <div className="space-y-6 relative min-h-[calc(100vh-100px)]">
      {/* Background Decorative Element */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[0%] left-[-5%] w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] pointer-events-none z-0" />

      <div className="flex items-center justify-between relative z-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-400 dark:to-white bg-clip-text text-transparent">
            Customer Data Entry
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Manage and record system data with precision.</p>
        </div>
      </div>

      <Tabs defaultValue="manual-individual" className="w-full relative z-10">
        <TabsList className="flex items-center p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md border rounded-2xl h-auto w-fit">
          <TabsTrigger 
            value="manual-individual" 
            className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all duration-300"
          >
            <FileText className="mr-2 h-4 w-4 text-primary" /> 
            <span className="font-semibold">Individual (Manual)</span>
          </TabsTrigger>
          <TabsTrigger 
            value="manual-bulk" 
            className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all duration-300"
          >
            <FileText className="mr-2 h-4 w-4 text-primary" /> 
            <span className="font-semibold">Bulk Meter (Manual)</span>
          </TabsTrigger>
          <TabsTrigger 
            value="csv-upload" 
            className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all duration-300"
          >
            <UploadCloud className="mr-2 h-4 w-4 text-primary" /> 
            <span className="font-semibold">CSV Upload</span>
          </TabsTrigger>
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
              <IndividualCustomerDataEntryForm />
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
              <BulkMeterDataEntryForm />
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
                    onClick={() => downloadCsvTemplate(bulkMeterCsvHeaders, 'bulk_meter_template.csv')}
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
                    onClick={() => downloadCsvTemplate(individualCustomerCsvHeaders, 'individual_customer_template.csv')}
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
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
