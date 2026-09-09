"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Search, UploadCloud, FileText, BarChart, FileSpreadsheet, Activity, ListPlus, Database, FileDown } from "lucide-react";
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
  initializeBranches
} from "@/lib/data-store";
import {
  getPaginatedIndividualReadingsAction,
  getPaginatedBulkReadingsAction,
  getReadingPeriodDetailsAction,
} from "@/lib/actions";
import type { FaultCodeRow, DisplayReading } from "@/lib/action-types";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import type { Route } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { useDataRefresh } from "@/lib/data-refresh-context";
import { format } from "date-fns";
import { CsvReadingUploadDialog } from "@/features/export/components/csv-reading-upload-dialog";
import { ReaderReport } from "@/app/(dashboard)/staff/dashboard/reader-report";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePagination } from "@/components/ui/table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";

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
  const { isRefreshing, refresh: triggerRefresh } = useDataRefresh();
  const [localLastUpdated, setLocalLastUpdated] = React.useState<string>('');

  const hasGlobalReadingView = 
    hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL) ||
    hasPermission(PERMISSIONS.METER_READINGS_VIEW_BRANCH) ||
    hasPermission('meter_readings_view_all') ||
    hasPermission('meter_readings_view_branch') ||
    hasPermission('*') ||
    hasPermission('all');

  const canViewIndividualReadings = hasGlobalReadingView || hasPermission(PERMISSIONS.METER_READINGS_VIEW_INDIVIDUAL);
  const canViewBulkReadings = hasGlobalReadingView || hasPermission(PERMISSIONS.METER_READINGS_VIEW_BULK);

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

  const [isLoading, setIsLoading] = React.useState(true);
  const [isTableLoading, setIsTableLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  const [selectedMonthYear, setSelectedMonthYear] = React.useState<string>(format(new Date(), "yyyy-MM"));
  const [individualPage, setIndividualPage] = React.useState(0);
  const [individualRowsPerPage, setIndividualRowsPerPage] = React.useState(10);
  const [individualTotalCount, setIndividualTotalCount] = React.useState(0);

  const [bulkPage, setBulkPage] = React.useState(0);
  const [bulkRowsPerPage, setBulkRowsPerPage] = React.useState(10);
  const [bulkTotalCount, setBulkTotalCount] = React.useState(0);

  const [monthIndividualCount, setMonthIndividualCount] = React.useState(0);
  const [monthBulkCount, setMonthBulkCount] = React.useState(0);

  const [activeTab, setActiveTab] = React.useState("individual");

  React.useEffect(() => {
    if (!canViewIndividualReadings && canViewBulkReadings) {
      setActiveTab("bulk");
    } else if (canViewIndividualReadings) {
      setActiveTab("individual");
    }
  }, [canViewIndividualReadings, canViewBulkReadings]);

  // Debounce search term by 350ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setIndividualPage(0);
      setBulkPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch month totals for stat cards
  const fetchMonthTotals = React.useCallback(async (targetMonth: string) => {
    try {
      const [indRes, bulkRes] = await Promise.all([
        getPaginatedIndividualReadingsAction({ page: 1, pageSize: 1, monthYear: targetMonth }),
        getPaginatedBulkReadingsAction({ page: 1, pageSize: 1, monthYear: targetMonth }),
      ]);
      if (indRes?.data) {
        setMonthIndividualCount(indRes.data.totalCount);
        if (!debouncedSearch) {
          setIndividualTotalCount(indRes.data.totalCount);
        }
      }
      if (bulkRes?.data) {
        setMonthBulkCount(bulkRes.data.totalCount);
        if (!debouncedSearch) {
          setBulkTotalCount(bulkRes.data.totalCount);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch month totals", e);
    }
  }, [debouncedSearch]);

  // Main paginated fetch
  const fetchReadings = React.useCallback(async () => {
    setIsTableLoading(true);
    try {
      if (activeTab === 'individual') {
        const res = await getPaginatedIndividualReadingsAction({
          page: individualPage + 1,
          pageSize: individualRowsPerPage,
          searchTerm: debouncedSearch || undefined,
          monthYear: selectedMonthYear || undefined,
        });
        if (res?.data) {
          setIndividualReadings(res.data.rows);
          setIndividualTotalCount(res.data.totalCount);
        }
      } else if (activeTab === 'bulk') {
        const res = await getPaginatedBulkReadingsAction({
          page: bulkPage + 1,
          pageSize: bulkRowsPerPage,
          searchTerm: debouncedSearch || undefined,
          monthYear: selectedMonthYear || undefined,
        });
        if (res?.data) {
          setBulkReadings(res.data.rows);
          setBulkTotalCount(res.data.totalCount);
        }
      }
    } catch (err) {
      console.error("Failed to load paginated readings", err);
    } finally {
      setIsTableLoading(false);
    }
  }, [activeTab, individualPage, individualRowsPerPage, bulkPage, bulkRowsPerPage, debouncedSearch, selectedMonthYear]);

  React.useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  React.useEffect(() => {
    fetchMonthTotals(selectedMonthYear);
  }, [selectedMonthYear, fetchMonthTotals]);

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
      initializeCustomers(true),
      initializeBulkMeters(true),
      initializeFaultCodes(true),
      initializeBranches(true),
      fetchRoutes(),
      hasPermission('staff_view') ? initializeStaffMembers(true) : Promise.resolve(),
    ]).then(() => {
      if (!isMounted) return;
      setAllCustomers(getCustomers());
      setAllBulkMeters(getBulkMeters());
      setAllBranches(getBranches());
      setAllRoutes(getRoutes());
      setAllStaff(getStaffMembers());
      setFaultCodesForForm(getFaultCodes());

      getReadingPeriodDetailsAction().then(details => {
        if (details && isMounted && details.startDate) {
          setSelectedMonthYear(details.startDate.slice(0, 7));
        }
      }).catch(e => console.warn("Failed to load period details", e));

      setIsLoading(false);
    }).catch(error => {
      if (!isMounted) return;
      console.error("Error initializing data for meter readings page:", error);
      toast({ title: "Error Loading Data", description: "Could not load necessary data.", variant: "destructive" });
      setIsLoading(false);
    });

    const unsubCust = subscribeToCustomers((updated) => { if (isMounted) setAllCustomers(updated); });
    const unsubBM = subscribeToBulkMeters((updated) => { if (isMounted) setAllBulkMeters(updated); });
    const unsubFaultCodes = subscribeToFaultCodes(() => { if (isMounted) setFaultCodesForForm(getFaultCodes()); });

    const handleDataRefreshed = () => {
      if (isMounted) {
        fetchReadings();
        fetchMonthTotals(selectedMonthYear);
        setLocalLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    };
    window.addEventListener('data-refreshed', handleDataRefreshed);

    return () => {
      isMounted = false;
      window.removeEventListener('data-refreshed', handleDataRefreshed);
      unsubCust();
      unsubBM();
      unsubFaultCodes();
    };
  }, [toast, fetchReadings, fetchMonthTotals, selectedMonthYear, hasPermission]);

  React.useEffect(() => {
    const canViewAll = 
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL) ||
      hasPermission('meter_readings_view_all') ||
      hasPermission('meter_readings:view_all') ||
      hasPermission('*') ||
      hasPermission('all');
    const branchId = currentUser?.branchId;

    if (!canViewAll && branchId) {
      setFilteredForAddCustomers(allCustomers.filter(c => c.branchId === branchId));
      setFilteredForAddBulkMeters(allBulkMeters.filter(bm => bm.branchId === branchId));
    } else {
      setFilteredForAddCustomers(allCustomers);
      setFilteredForAddBulkMeters(allBulkMeters);
    }
  }, [allCustomers, allBulkMeters, currentUser, hasPermission]);

  const handleAddReadingSubmit = async (formData: AddMeterReadingFormValues) => {
    const readerId = currentUser?.id;
    const { entityId, meterType, reading, date, faultCode, capturedCoordinates, meterPhoto } = formData;
    const activeFaultCode = faultCode === 'none' ? undefined : faultCode;

    setIsLoading(true);
    let result;

    try {
      if (meterType === 'individual_customer_meter') {
        const customer = allCustomers.find(c => c.customerKeyNumber === entityId);
        const prevReading = customer?.currentReading ?? 0;
        const finalReading = activeFaultCode ? prevReading : reading;

        result = await addIndividualCustomerReading({
          individualCustomerId: entityId,
          readerStaffId: readerId,
          readingDate: format(date, "yyyy-MM-dd"),
          monthYear: format(date, "yyyy-MM"),
          readingValue: finalReading,
          previousReading: prevReading,
          faultCode: activeFaultCode,
          notes: activeFaultCode
            ? `Fault: ${activeFaultCode}. Reading forced to previous (${prevReading}) — usage 0 m³. Reader: ${currentUser?.email || readerId}`
            : `Reading entered by ${currentUser?.email || readerId}`,
          capturedCoordinates: capturedCoordinates,
          meter_photo: meterPhoto,
        });
      } else {
        const bulkMeter = allBulkMeters.find(bm => bm.customerKeyNumber === entityId);
        const prevReading = bulkMeter?.currentReading ?? 0;
        const finalReading = activeFaultCode ? prevReading : reading;

        result = await addBulkMeterReading({
          CUSTOMERKEY: entityId,
          readerStaffId: readerId,
          readingDate: format(date, "yyyy-MM-dd"),
          monthYear: format(date, "yyyy-MM"),
          readingValue: finalReading,
          previousReading: prevReading,
          faultCode: activeFaultCode,
          notes: activeFaultCode
            ? `Fault: ${activeFaultCode}. Reading forced to previous (${prevReading}) — usage 0 m³. Reader: ${currentUser?.email || readerId}`
            : `Reading entered by ${currentUser?.email || readerId}`,
          capturedCoordinates: capturedCoordinates,
          meter_photo: meterPhoto,
        });
      }

      if (result.success && result.data) {
        toast({
          title: "Meter Reading Added",
          description: `Reading for selected meter has been successfully recorded.`,
        });
        setIsModalOpen(false);
        fetchReadings();
        fetchMonthTotals(selectedMonthYear);
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

  // CSV export helper
  const exportReadingsToCSV = React.useCallback((data: DisplayReading[], filename: string) => {
    if (data.length === 0) return;
    const headers = ['Meter Identifier', 'Type', 'Reading Value', 'Previous Reading', 'Consumption (m³)', 'Reading Date', 'Month/Year', 'Notes', 'Fault Code'];
    const rows = data.map(r => [
      `"${(r.meterIdentifier || '').replace(/"/g, '""')}"`,
      r.meterType === 'bulk' ? 'Bulk' : 'Individual',
      r.readingValue ?? '',
      r.previousReading ?? '',
      ((r.readingValue ?? 0) - (r.previousReading ?? 0)).toFixed(2),
      r.readingDate ?? '',
      r.monthYear ?? '',
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      r.faultCode || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleExportCsv = async (type: 'individual' | 'bulk') => {
    try {
      toast({ title: "Exporting readings...", description: "Preparing CSV export..." });
      const action = type === 'individual' ? getPaginatedIndividualReadingsAction : getPaginatedBulkReadingsAction;
      const res = await action({
        page: 1,
        pageSize: 50000,
        monthYear: selectedMonthYear || undefined,
        searchTerm: debouncedSearch || undefined,
      });
      if (res?.data?.rows && res.data.rows.length > 0) {
        exportReadingsToCSV(res.data.rows, `${type}-readings-${selectedMonthYear}.csv`);
        toast({ title: "Export Complete", description: `Exported ${res.data.rows.length} records.` });
      } else {
        toast({ title: "No Readings", description: "No records found matching the export criteria." });
      }
    } catch (e) {
      console.error("Export error", e);
      toast({ title: "Export Failed", description: "Could not export readings to CSV.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">Meter Readings Management</h1>
            <button
              onClick={() => triggerRefresh()}
              title="Refresh data now"
              className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <Activity className={`h-2.5 w-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : localLastUpdated ? `Updated ${localLastUpdated}` : 'Live Data'}
            </button>
          </div>
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
          {(hasPermission(PERMISSIONS.METER_READINGS_CREATE) || 
            hasPermission(PERMISSIONS.METER_READINGS_CREATE_BULK) || 
            hasPermission(PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL) || 
            hasPermission(PERMISSIONS.METER_READINGS_ADD_MANUAL) || 
            hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL) || 
            hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_BULK)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isLoading && (allCustomers.length === 0 && allBulkMeters.length === 0)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Reading
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Add New Reading</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(hasPermission(PERMISSIONS.METER_READINGS_ADD_MANUAL) || 
                  hasPermission(PERMISSIONS.METER_READINGS_CREATE) ||
                  hasPermission(PERMISSIONS.METER_READINGS_CREATE_BULK) ||
                  hasPermission(PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL)) && (
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(canViewIndividualReadings && canViewBulkReadings) && (
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
                  {monthIndividualCount + monthBulkCount}
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
                 <span className="flex items-center gap-1 font-semibold text-emerald-600 whitespace-nowrap">Total recorded this month</span>
              </div>
            </CardContent>
          </Card>
        )}

      {canViewIndividualReadings && (
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
                  {monthIndividualCount}
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
                 <span className="flex items-center gap-1 font-semibold text-blue-600 whitespace-nowrap">Individual customer meters this month</span>
              </div>
            </CardContent>
          </Card>
        )}

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
                {monthBulkCount}
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
               <span className="flex items-center gap-1 font-semibold text-amber-600 whitespace-nowrap">Bulk meters this month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full p-1 bg-slate-100 rounded-xl h-auto ${canViewIndividualReadings && canViewBulkReadings ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canViewIndividualReadings && (
            <TabsTrigger 
              value="individual"
              className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:hover:bg-slate-200 transition-all font-semibold py-2.5 text-slate-600"
            >
              Individual Readings ({individualTotalCount})
            </TabsTrigger>
          )}
          {canViewBulkReadings && (
            <TabsTrigger 
              value="bulk"
              className="rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:hover:bg-slate-200 transition-all font-semibold py-2.5 text-slate-600"
            >
              Bulk Meter Readings ({bulkTotalCount})
            </TabsTrigger>
          )}
        </TabsList>
        {canViewIndividualReadings && (
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
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 gap-1.5"
                  disabled={individualTotalCount === 0}
                  onClick={() => handleExportCsv('individual')}
                >
                  <FileDown className="h-4 w-4" />
                  Export CSV ({individualTotalCount})
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {isTableLoading && individualReadings.length === 0 ? (
                  <div className="mt-4 p-8 border rounded-md bg-muted/50 text-center text-muted-foreground">
                    Loading meter readings...
                  </div>
                ) : (
                  <MeterReadingsTable data={individualReadings} />
                )}
              </CardContent>
              {individualTotalCount > 0 && (
                <TablePagination
                  count={individualTotalCount}
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
        )}
        {canViewBulkReadings && (
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
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 gap-1.5"
                  disabled={bulkTotalCount === 0}
                  onClick={() => handleExportCsv('bulk')}
                >
                  <FileDown className="h-4 w-4" />
                  Export CSV ({bulkTotalCount})
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {isTableLoading && bulkReadings.length === 0 ? (
                  <div className="mt-4 p-8 border rounded-md bg-muted/50 text-center text-muted-foreground">
                    Loading meter readings...
                  </div>
                ) : (
                  <MeterReadingsTable data={bulkReadings} />
                )}
              </CardContent>
              {bulkTotalCount > 0 && (
                <TablePagination
                  count={bulkTotalCount}
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
        )}
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

      {(hasPermission(PERMISSIONS.METER_READINGS_CREATE) ||
        hasPermission(PERMISSIONS.METER_READINGS_CREATE_BULK) ||
        hasPermission(PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL) ||
        hasPermission(PERMISSIONS.METER_READINGS_ADD_MANUAL)) && (
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
