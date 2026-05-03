
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Search, UploadCloud, FileText, BarChart, FileSpreadsheet, Activity, ListPlus, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AddMeterReadingForm, type AddMeterReadingFormValues } from "@/components/billing/add-meter-reading-form";
import MeterReadingsTable from "@/components/billing/meter-readings-table";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import {
  addIndividualCustomerReading,
  addBulkMeterReading,
  getCustomers,
  initializeCustomers,
  getBulkMeters,
  initializeBulkMeters,
  getIndividualCustomerReadings,
  initializeIndividualCustomerReadings,
  subscribeToIndividualCustomerReadings,
  getBulkMeterReadings,
  initializeBulkMeterReadings,
  subscribeToBulkMeterReadings,
  subscribeToCustomers,
  subscribeToBulkMeters,
  getFaultCodes,
  initializeFaultCodes,
  subscribeToFaultCodes,
  getRoutes,
  fetchRoutes,
  getStaffMembers,
  initializeStaffMembers,
  getBranches,
  initializeBranches,
  initializeBills,
  getBills
} from "@/lib/data-store";
import type { FaultCodeRow } from "@/lib/actions";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { DisplayReading } from "@/lib/data-store";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import type { Route } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { format } from "date-fns";
import { CsvReadingUploadDialog } from "@/components/export/csv-reading-upload-dialog";
import { ReaderReport } from "@/app/(dashboard)/staff/dashboard/reader-report";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePagination } from "@/components/ui/table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";

interface User {
  id?: string;
  email: string;
  role: "admin" | "staff" | "reader" | "Admin" | "Staff" | "Reader" | "staff management";
  branchName?: string;
  branchId?: string;
}

export default function StaffMeterReadingsPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isIndividualCsvModalOpen, setIsIndividualCsvModalOpen] = React.useState(false);
  const [isBulkCsvModalOpen, setIsBulkCsvModalOpen] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);

  const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);
  const [filteredForAddCustomers, setFilteredForAddCustomers] = React.useState<IndividualCustomer[]>([]);
  const [filteredForAddBulkMeters, setFilteredForAddBulkMeters] = React.useState<BulkMeter[]>([]);
  const [faultCodesForForm, setFaultCodesForForm] = React.useState<FaultCodeRow[]>([]);

  const [individualReadings, setIndividualReadings] = React.useState<DisplayReading[]>([]);
  const [bulkReadings, setBulkReadings] = React.useState<DisplayReading[]>([]);
  const [allBranches, setAllBranches] = React.useState<Branch[]>([]);
  const [allRoutes, setAllRoutes] = React.useState<Route[]>([]);
  const [allStaff, setAllStaff] = React.useState<any[]>([]);
  const [allBills, setAllBills] = React.useState<any[]>([]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  const [individualPage, setIndividualPage] = React.useState(0);
  const [individualRowsPerPage, setIndividualRowsPerPage] = React.useState(10);
  const [bulkPage, setBulkPage] = React.useState(0);
  const [bulkRowsPerPage, setBulkRowsPerPage] = React.useState(10);
  const [activeTab, setActiveTab] = React.useState("individual");


  const combineAndSortReadings = React.useCallback(() => {
    let individualReadingsRaw = getIndividualCustomerReadings();
    let bulkReadingsRaw = getBulkMeterReadings();
    let customers = getCustomers();
    let bulkMeters = getBulkMeters();

    const canViewAll = hasPermission('meter_readings_view_all');
    const branchId = currentUser?.branchId;

    if (!canViewAll && branchId) {
      customers = customers.filter(c => c.branchId === branchId);
      bulkMeters = bulkMeters.filter(bm => bm.branchId === branchId);
      
      const customerKeys = new Set(customers.map(c => c.customerKeyNumber));
      const bulkKeys = new Set(bulkMeters.map(bm => bm.customerKeyNumber));

      individualReadingsRaw = individualReadingsRaw.filter(r => r.individualCustomerId && customerKeys.has(r.individualCustomerId));
      bulkReadingsRaw = bulkReadingsRaw.filter(r => r.CUSTOMERKEY && bulkKeys.has(r.CUSTOMERKEY));
    } else if (!canViewAll && !branchId) {
      // If no branch assigned, and no View All perms, show nothing
      customers = [];
      bulkMeters = [];
      individualReadingsRaw = [];
      bulkReadingsRaw = [];
    }

    const displayedIndividualReadings: DisplayReading[] = individualReadingsRaw.map(r => {
      const customer = customers.find(c => c.customerKeyNumber === r.individualCustomerId);
      return {
        id: r.id,
        meterId: r.individualCustomerId,
        meterType: 'individual' as const,
        meterIdentifier: customer ? `${customer.name} (M: ${customer.meterNumber})` : `Cust. ID: ${r.individualCustomerId}`,
        readingValue: r.readingValue,
        previousReading: r.previousReading || 0,
        readingDate: r.readingDate,
        monthYear: r.monthYear,
        notes: r.notes
      };
    }).sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());

    const displayedBulkReadings: DisplayReading[] = bulkReadingsRaw.map(r => {
      const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === r.CUSTOMERKEY);
      return {
        id: r.id,
        meterId: r.CUSTOMERKEY,
        meterType: 'bulk' as const,
        meterIdentifier: bulkMeter ? `${bulkMeter.name} (M: ${bulkMeter.meterNumber})` : `BM ID: ${r.CUSTOMERKEY}`,
        readingValue: r.readingValue,
        previousReading: r.previousReading || 0,
        readingDate: r.readingDate,
        monthYear: r.monthYear,
        notes: r.notes
      };
    }).sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());

    const filteredCustomers = customers;
    const filteredBulkMeters = bulkMeters;
    
    // NOTE: setAllCustomers / setAllBulkMeters updates won't be called here to avoid deep loops
    // but the readings map correctly to what they can view.

    setIndividualReadings(displayedIndividualReadings);
    setBulkReadings(displayedBulkReadings);
    setFaultCodesForForm(getFaultCodes());
  }, [hasPermission, currentUser]);

  React.useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        setCurrentUser(prev => {
          if (prev?.id === parsedUser.id && prev?.branchId === parsedUser.branchId) return prev;
          return parsedUser;
        });
      } catch (e) { console.error("Failed to parse user from localStorage", e); }
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    Promise.all([
      initializeCustomers(true),
      initializeBulkMeters(true),
      initializeIndividualCustomerReadings(true),
      initializeBulkMeterReadings(true),
      initializeFaultCodes(true),
      initializeBranches(true),
      fetchRoutes(true),
      hasPermission('staff_view') ? initializeStaffMembers(true) : Promise.resolve(),
      initializeBills(true),
    ]).then(() => {
      if (!isMounted) return;
      setAllCustomers(getCustomers());
      setAllBulkMeters(getBulkMeters());
      setAllBranches(getBranches());
      setAllRoutes(getRoutes());
      setAllStaff(getStaffMembers());
      setAllBills(getBills());
      combineAndSortReadings();
      setIsLoading(false);
    }).catch(error => {
      if (!isMounted) return;
      console.error("Error initializing data for meter readings page:", error);
      toast({ title: "Error Loading Data", description: "Could not load necessary data.", variant: "destructive" });
      setIsLoading(false);
    });

    const unsubCust = subscribeToCustomers((updated) => { if (isMounted) { setAllCustomers(updated); combineAndSortReadings(); } });
    const unsubBM = subscribeToBulkMeters((updated) => { if (isMounted) { setAllBulkMeters(updated); combineAndSortReadings(); } });
    const unsubIndiReadings = subscribeToIndividualCustomerReadings(() => { if (isMounted) combineAndSortReadings(); });
    const unsubBulkReadings = subscribeToBulkMeterReadings(() => { if (isMounted) combineAndSortReadings(); });
    const unsubFaultCodes = subscribeToFaultCodes(() => { if (isMounted) combineAndSortReadings(); });

    return () => {
      isMounted = false;
      unsubCust();
      unsubBM();
      unsubIndiReadings();
      unsubBulkReadings();
      unsubFaultCodes();
    };
  }, [toast, combineAndSortReadings]);

  React.useEffect(() => {
    const canViewAll = hasPermission('meter_readings_view_all');
    const branchId = currentUser?.branchId;

    if (!canViewAll && branchId) {
      setFilteredForAddCustomers(allCustomers.filter(c => c.branchId === branchId));
      setFilteredForAddBulkMeters(allBulkMeters.filter(bm => bm.branchId === branchId));
    } else if (!canViewAll && !branchId) {
      setFilteredForAddCustomers([]);
      setFilteredForAddBulkMeters([]);
    } else {
      setFilteredForAddCustomers(allCustomers);
      setFilteredForAddBulkMeters(allBulkMeters);
    }
  }, [allCustomers, allBulkMeters, currentUser, hasPermission]);

  const handleAddReadingSubmit = async (formData: AddMeterReadingFormValues) => {
    const readerId = currentUser?.id || currentUser?.email || 'N/A';
    const { entityId, meterType, reading, date, faultCode } = formData;

    setIsLoading(true);
    let result;

    try {
      if (meterType === 'individual_customer_meter') {
        result = await addIndividualCustomerReading({
          individualCustomerId: entityId,
          readerStaffId: readerId,
          readingDate: format(date, "yyyy-MM-dd"),
          monthYear: format(date, "yyyy-MM"),
          readingValue: reading,

          faultCode: faultCode === 'none' ? undefined : faultCode,
          notes: faultCode && faultCode !== 'none' ? `Fault: ${faultCode}. Reader: ${currentUser?.email || readerId}` : `Reading entered by ${currentUser?.email || readerId}`,
        });
      } else {
        result = await addBulkMeterReading({
          CUSTOMERKEY: entityId,
          readerStaffId: readerId,
          readingDate: format(date, "yyyy-MM-dd"),
          monthYear: format(date, "yyyy-MM"),
          readingValue: reading,
        });
      }

      if (result.success && result.data) {
        toast({
          title: "Meter Reading Added",
          description: `Reading for selected meter has been successfully recorded.`,
        });
        setIsModalOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Submission Failed",
          description: result.message || "Could not record meter reading.",
        });
      }
    } catch (error) {
      console.error("Error submitting meter reading:", error);
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: "An unexpected error occurred while saving the reading.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredIndividualReadings = individualReadings.filter(reading => {
    if (!searchTerm) return true;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return reading.meterIdentifier.toLowerCase().includes(lowerSearchTerm) ||
      String(reading.readingValue).includes(lowerSearchTerm) ||
      reading.readingDate.includes(lowerSearchTerm) ||
      reading.monthYear.includes(lowerSearchTerm);
  });

  const paginatedIndividualReadings = filteredIndividualReadings.slice(
    individualPage * individualRowsPerPage,
    individualPage * individualRowsPerPage + individualRowsPerPage
  );

  const filteredBulkReadings = bulkReadings.filter(reading => {
    if (!searchTerm) return true;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return reading.meterIdentifier.toLowerCase().includes(lowerSearchTerm) ||
      String(reading.readingValue).includes(lowerSearchTerm) ||
      reading.readingDate.includes(lowerSearchTerm) ||
      reading.monthYear.includes(lowerSearchTerm);
  });

  const paginatedBulkReadings = filteredBulkReadings.slice(
    bulkPage * bulkRowsPerPage,
    bulkPage * bulkRowsPerPage + bulkRowsPerPage
  );

  const currentMonthYear = format(new Date(), "yyyy-MM");
  const recentIndividualCount = individualReadings.filter(r => r.monthYear === currentMonthYear).length;
  const recentBulkCount = bulkReadings.filter(r => r.monthYear === currentMonthYear).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meter Readings Management</h1>
          <p className="text-muted-foreground mt-1 text-base">Record, view, and manage all meter readings.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search readings..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {hasPermission('meter_readings_analytics_view') && (
            <div className="flex items-center gap-2">
              <Button
                variant={activeTab === 'analytics' ? 'default' : 'default'}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setActiveTab(activeTab === 'analytics' ? 'individual' : 'analytics')}
              >
                <BarChart className="mr-2 h-4 w-4" /> Reading Analytics
              </Button>
              <Link href="/staff/reports/reading-classification" passHref>
                <Button variant="outline" className="bg-white">
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-muted-foreground" /> Reading Analytics Report
                </Button>
              </Link>
            </div>
          )}
          {hasPermission('meter_readings_create') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isLoading && (allCustomers.length === 0 && allBulkMeters.length === 0)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Reading
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Add New Reading</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsModalOpen(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Manual Entry</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsIndividualCsvModalOpen(true)}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  <span>Upload Individual (CSV)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsBulkCsvModalOpen(true)}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  <span>Upload Bulk (CSV)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="group shadow-sm hover:shadow-xl border border-emerald-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f0fbf4' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <Database className="h-48 w-48 text-emerald-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Total Readings</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Database className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-emerald-900 transition-colors">
                {recentIndividualCount + recentBulkCount}
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
               <span className="flex items-center gap-1 font-semibold text-emerald-600 whitespace-nowrap">Total recorded this month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group shadow-sm hover:shadow-xl border border-blue-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f4f7ff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <Activity className="h-48 w-48 text-blue-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Individual Readings</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-blue-900 transition-colors">
                {recentIndividualCount}
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
               <span className="flex items-center gap-1 font-semibold text-blue-600 whitespace-nowrap">Individual customer meters this month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group shadow-sm hover:shadow-xl border border-amber-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#fffbf0' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <ListPlus className="h-48 w-48 text-amber-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Bulk Readings</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <ListPlus className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-amber-900 transition-colors">
                {recentBulkCount}
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
               <span className="flex items-center gap-1 font-semibold text-amber-600 whitespace-nowrap">Bulk meters this month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 rounded-xl h-auto">
          <TabsTrigger 
            value="individual"
            className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:hover:bg-slate-200 transition-all font-semibold py-2.5 text-slate-600"
          >
            Individual Readings ({filteredIndividualReadings.length})
          </TabsTrigger>
          <TabsTrigger 
            value="bulk"
            className="rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:hover:bg-slate-200 transition-all font-semibold py-2.5 text-slate-600"
          >
            Bulk Meter Readings ({filteredBulkReadings.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="individual">
          <Card className="shadow-md border-slate-200/60 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">Individual Customer Reading List</CardTitle>
                  <CardDescription>View and manage all recorded readings for individual customers.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading && paginatedIndividualReadings.length === 0 ? (
                <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                  Loading meter readings...
                </div>
              ) : (
                <MeterReadingsTable data={paginatedIndividualReadings} />
              )}
            </CardContent>
            {filteredIndividualReadings.length > 0 && (
              <TablePagination
                count={filteredIndividualReadings.length}
                page={individualPage}
                rowsPerPage={individualRowsPerPage}
                onPageChange={setIndividualPage}
                onRowsPerPageChange={(value) => {
                  setIndividualRowsPerPage(value);
                  setIndividualPage(0);
                }}
              />
            )}
          </Card>
        </TabsContent>
        <TabsContent value="bulk">
          <Card className="shadow-md border-slate-200/60 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <ListPlus className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">Bulk Meter Reading List</CardTitle>
                  <CardDescription>View and manage all recorded readings for bulk meters.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading && paginatedBulkReadings.length === 0 ? (
                <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                  Loading meter readings...
                </div>
              ) : (
                <MeterReadingsTable data={paginatedBulkReadings} />
              )}
            </CardContent>
            {filteredBulkReadings.length > 0 && (
              <TablePagination
                count={filteredBulkReadings.length}
                page={bulkPage}
                rowsPerPage={bulkRowsPerPage}
                onPageChange={setBulkPage}
                onRowsPerPageChange={(value) => {
                  setBulkRowsPerPage(value);
                  setBulkPage(0);
                }}
              />
            )}
          </Card>
        </TabsContent>
        {hasPermission('meter_readings_analytics_view') && (
          <TabsContent value="analytics" className="space-y-4">
            <ReaderReport
              branches={allBranches}
              bulkMeters={allBulkMeters}
              customers={allCustomers}
              routes={allRoutes}
              staff={allStaff}
              individualReadings={individualReadings}
              bulkReadings={bulkReadings}
            />
          </TabsContent>
        )}
      </Tabs>

      {hasPermission('meter_readings_create') && (
        <>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <UIDialogTitle>Add New Meter Reading</UIDialogTitle>
                <UIDialogDescription>
                  Select the meter type, then the specific meter, and enter the reading details.
                </UIDialogDescription>
              </DialogHeader>
              <AddMeterReadingForm
                onSubmit={handleAddReadingSubmit}
                customers={filteredForAddCustomers}
                bulkMeters={filteredForAddBulkMeters}
                faultCodes={faultCodesForForm}
                isLoading={isLoading}
              />
            </DialogContent>
          </Dialog>

          <CsvReadingUploadDialog
            open={isIndividualCsvModalOpen}
            onOpenChange={setIsIndividualCsvModalOpen}
            meterType="individual"
            meters={filteredForAddCustomers}
            currentUser={currentUser}
          />
          <CsvReadingUploadDialog
            open={isBulkCsvModalOpen}
            onOpenChange={setIsBulkCsvModalOpen}
            meterType="bulk"
            meters={filteredForAddBulkMeters}
            currentUser={currentUser}
          />
        </>
      )}
    </div>
  );
}
