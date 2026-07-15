
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Search, UploadCloud, FileText, BarChart, FileSpreadsheet, Download, Activity, CheckCircle, ListPlus, Database, AlertCircle, XCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AddMeterReadingForm, type AddMeterReadingFormValues } from "@/features/billing/components/add-meter-reading-form";
import MeterReadingsTable from "@/features/billing/components/meter-readings-table";
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
import type { FaultCodeRow } from "@/lib/action-types";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { DisplayReading } from "@/lib/data-store";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import type { Route } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { format } from "date-fns";
import { CsvReadingUploadDialog } from "@/features/export/components/csv-reading-upload-dialog";
import { ReaderReport } from "@/app/(dashboard)/staff/dashboard/reader-report";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePagination } from "@/components/ui/table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PERMISSIONS } from "@/lib/constants/auth";
import { DatReadingExportDialog } from "@/features/export/components/dat-reading-export-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { ReadingPeriodToggle } from "@/features/admin/components/reading-period-toggle";

interface User {
  id?: string;
  email: string;
  role: "admin" | "staff";
  branchName?: string;
}

export default function AdminMeterReadingsPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isIndividualCsvModalOpen, setIsIndividualCsvModalOpen] = React.useState(false);
  const [isBulkCsvModalOpen, setIsBulkCsvModalOpen] = React.useState(false);
  const [isDatExportModalOpen, setIsDatExportModalOpen] = React.useState(false);
  const [exportType, setExportType] = React.useState<'individual' | 'bulk'>('individual');
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);

  const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);
  const [faultCodesForForm, setFaultCodesForForm] = React.useState<FaultCodeRow[]>([]);
  const [anomalies, setAnomalies] = React.useState<{
    key: string;
    name: string;
    type: 'Bulk' | 'Individual';
    reason: string;
    severity: 'high' | 'medium';
    usage: number;
  }[]>([]);

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
    const individualReadingsRaw = getIndividualCustomerReadings();
    const bulkReadingsRaw = getBulkMeterReadings();
    const customers = getCustomers();
    const bulkMeters = getBulkMeters();

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
        notes: r.notes,
        faultCode: r.faultCode
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
        notes: r.notes,
        faultCode: r.faultCode
      };
    }).sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());

    setIndividualReadings(displayedIndividualReadings);
    setBulkReadings(displayedBulkReadings);
    setFaultCodesForForm(getFaultCodes());
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        if (isMounted) setCurrentUser(parsedUser);
      } catch (e) { console.error("Failed to parse user from localStorage", e); }
    }

    setIsLoading(true);
    Promise.all([
      initializeCustomers(),
      initializeBulkMeters(),
      initializeIndividualCustomerReadings(),
      initializeBulkMeterReadings(),
      initializeFaultCodes(),
      initializeBranches(),
      fetchRoutes(),
      initializeStaffMembers(),
      initializeBills(),
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
    const nextAnomalies = [] as {
      key: string;
      name: string;
      type: 'Bulk' | 'Individual';
      reason: string;
      severity: 'high' | 'medium';
      usage: number;
    }[];

    for (const m of allBulkMeters) {
      if (m.status !== 'Active') continue;
      const usage = (m.currentReading ?? 0) - (m.previousReading ?? 0);
      if (usage === 0 && m.previousReading != null && m.currentReading != null) {
        nextAnomalies.push({
          key: m.customerKeyNumber,
          name: m.name || m.customerKeyNumber,
          type: 'Bulk',
          reason: 'Zero consumption — possible stuck/broken meter',
          severity: 'medium',
          usage: 0,
        });
      } else if (usage > 2000) {
        nextAnomalies.push({
          key: m.customerKeyNumber,
          name: m.name || m.customerKeyNumber,
          type: 'Bulk',
          reason: `Extreme spike: ${usage.toFixed(0)} m³`,
          severity: 'high',
          usage,
        });
      }
    }

    for (const c of allCustomers) {
      if (c.status !== 'Active') continue;
      const usage = (c.currentReading ?? 0) - (c.previousReading ?? 0);
      if (usage === 0 && c.previousReading != null && c.currentReading != null) {
        nextAnomalies.push({
          key: c.customerKeyNumber,
          name: c.name || c.customerKeyNumber,
          type: 'Individual',
          reason: 'Zero consumption — possible stuck/broken meter',
          severity: 'medium',
          usage: 0,
        });
      } else if (usage > 200) {
        nextAnomalies.push({
          key: c.customerKeyNumber,
          name: c.name || c.customerKeyNumber,
          type: 'Individual',
          reason: `Extreme spike: ${usage.toFixed(0)} m³`,
          severity: 'high',
          usage,
        });
      }
    }

    nextAnomalies.sort((a, b) => (a.severity === 'high' ? -1 : 1));
    setAnomalies(nextAnomalies.slice(0, 5));
  }, [allBulkMeters, allCustomers]);

  const handleAddReadingSubmit = async (formData: AddMeterReadingFormValues) => {
    const readerId = currentUser?.id;
    const { entityId, meterType, reading, date, faultCode, capturedCoordinates } = formData;

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
          notes: faultCode && faultCode !== 'none' ? `Fault: ${faultCode}. Reader: ${currentUser?.email || 'Admin'}` : `Reading entered by ${currentUser?.email || 'Admin'}`,
          capturedCoordinates
        });
      } else {
        result = await addBulkMeterReading({
          CUSTOMERKEY: entityId,
          readerStaffId: readerId,
          readingDate: format(date, "yyyy-MM-dd"),
          monthYear: format(date, "yyyy-MM"),
          readingValue: reading,
          capturedCoordinates
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
          {anomalies.length > 0 && (
            <div
              className="mt-4 relative overflow-hidden rounded-3xl border border-rose-200/70 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(255,248,248,0.97) 0%, rgba(255,241,241,0.95) 100%)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-rose-200/30 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-amber-200/20 blur-2xl pointer-events-none" />
              <div className="relative z-10 px-5 pt-5 pb-4">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="h-9 w-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-rose-900 uppercase tracking-wide">⚠ Consumption Anomalies Detected</p>
                    <p className="text-xs text-rose-500">{anomalies.length} meter{anomalies.length > 1 ? 's require' : ' requires'} attention</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {anomalies.map((a) => (
                    <div
                      key={a.key}
                      className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 border ${
                        a.severity === 'high'
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        a.severity === 'high' ? 'bg-rose-100' : 'bg-amber-100'
                      }`}>
                        {a.severity === 'high'
                          ? <XCircle className="h-3.5 w-3.5 text-rose-600" />
                          : <AlertCircle className="h-3.5 w-3.5 text-amber-600" />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{a.name}</p>
                        <p className="text-xs text-slate-500">{a.type} meter</p>
                        <p className="text-xs text-slate-600">{a.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
              <Link href="/admin/reports/reading-classification" passHref>
                <Button variant="outline" className="bg-white">
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-muted-foreground" /> Reading Analytics Report
                </Button>
              </Link>
            </div>
          )}
          {(hasPermission(PERMISSIONS.METER_READINGS_CREATE) || hasPermission(PERMISSIONS.METER_READINGS_ADD_MANUAL) || hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL) || hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_BULK)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isLoading && (allCustomers.length === 0 && allBulkMeters.length === 0)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Reading
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Add New Reading</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(hasPermission(PERMISSIONS.METER_READINGS_ADD_MANUAL) || hasPermission(PERMISSIONS.METER_READINGS_CREATE)) && (
                  <DropdownMenuItem onSelect={() => setIsModalOpen(true)}>
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Manual Entry</span>
                  </DropdownMenuItem>
                )}
                {hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL) && (
                  <DropdownMenuItem onSelect={() => setIsIndividualCsvModalOpen(true)}>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    <span>Upload Individual (CSV)</span>
                  </DropdownMenuItem>
                )}
                {hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_BULK) && (
                  <DropdownMenuItem onSelect={() => setIsBulkCsvModalOpen(true)}>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    <span>Upload Bulk (CSV)</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {(hasPermission(PERMISSIONS.METER_READINGS_CREATE) || hasPermission(PERMISSIONS.METER_READINGS_ADD_MANUAL) || hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL) || hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_BULK)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isLoading && (allCustomers.length === 0 && allBulkMeters.length === 0)}>
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export Data</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { setExportType('individual'); setIsDatExportModalOpen(true); }}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Export Individual (.DAT)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { setExportType('bulk'); setIsDatExportModalOpen(true); }}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Export Bulk (.DAT)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="w-full">
        <ReadingPeriodToggle />
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
            <DialogContent className="w-[95vw] max-w-[480px] max-h-[90vh] overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              <DialogHeader>
                <UIDialogTitle>Add New Meter Reading</UIDialogTitle>
                <UIDialogDescription>
                  Select the meter type, then the specific meter, and enter the reading details.
                </UIDialogDescription>
              </DialogHeader>
              <AddMeterReadingForm
                onSubmit={handleAddReadingSubmit}
                customers={allCustomers}
                bulkMeters={allBulkMeters}
                faultCodes={faultCodesForForm}
                isLoading={isLoading}
              />
            </DialogContent>
          </Dialog>

          <CsvReadingUploadDialog
            open={isIndividualCsvModalOpen}
            onOpenChange={setIsIndividualCsvModalOpen}
            meterType="individual"
            meters={allCustomers}
            currentUser={currentUser}
          />
          <CsvReadingUploadDialog
            open={isBulkCsvModalOpen}
            onOpenChange={setIsBulkCsvModalOpen}
            meterType="bulk"
            meters={allBulkMeters}
            currentUser={currentUser}
          />

          <DatReadingExportDialog
            open={isDatExportModalOpen}
            onOpenChange={setIsDatExportModalOpen}
            customers={allCustomers}
            bulkMeters={allBulkMeters}
            branches={allBranches}
            initialType={exportType}
          />
        </>
      )}
    </div>
  );
}

