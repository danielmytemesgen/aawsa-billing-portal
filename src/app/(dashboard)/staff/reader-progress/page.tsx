"use client";

import * as React from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { getEffectiveBranchId } from "@/lib/branch-permissions";
import { 
  getStaffMembers, 
  getRoutes, 
  getBulkMeters, 
  getCustomers, 
  getBulkMeterReadings, 
  getIndividualCustomerReadings,
  initializeStaffMembers,
  fetchRoutes,
  initializeBulkMeters,
  initializeCustomers,
  initializeBulkMeterReadings,
  initializeIndividualCustomerReadings,
  subscribeToIndividualCustomerReadings,
  subscribeToBulkMeterReadings,
  subscribeToCustomers,
  subscribeToBulkMeters,
  subscribeToStaffMembers,
  subscribeToRoutes,
} from "@/lib/data-store";
import { useDataRefresh } from "@/lib/data-refresh-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Activity, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Loader2, 
  MapPin, 
  Gauge, 
  TrendingUp, 
  ArrowLeft,
  Calendar
} from "lucide-react";
import Link from "next/link";
import { PERMISSIONS } from "@/lib/constants/auth";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

export default function ReaderSupervisorMonitoringPage() {
  const { hasPermission } = usePermissions();
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  const [staffList, setStaffList] = React.useState<any[]>([]);
  const [routesList, setRoutesList] = React.useState<any[]>([]);
  const [bulkMetersList, setBulkMetersList] = React.useState<any[]>([]);
  const [customersList, setCustomersList] = React.useState<any[]>([]);
  const [bulkReadings, setBulkReadings] = React.useState<any[]>([]);
  const [indReadings, setIndReadings] = React.useState<any[]>([]);
  const [staffBranchId, setStaffBranchId] = React.useState<string | null>(null);
  const { isRefreshing, refresh: triggerRefresh } = useDataRefresh();
  const [localLastUpdated, setLocalLastUpdated] = React.useState<string>('');

  React.useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        setStaffBranchId(parsed.branchId || null);
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
  }, []);

  const effectiveBranchId = getEffectiveBranchId(hasPermission, 'staff', staffBranchId);

  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        initializeStaffMembers(),
        fetchRoutes(),
        initializeBulkMeters(),
        initializeCustomers(),
        initializeBulkMeterReadings(),
        initializeIndividualCustomerReadings()
      ]);
      setStaffList(getStaffMembers());
      setRoutesList(getRoutes());
      setBulkMetersList(getBulkMeters());
      setCustomersList(getCustomers());
      setBulkReadings(getBulkMeterReadings());
      setIndReadings(getIndividualCustomerReadings());
      setIsLoading(false);
    };
      loadData();

      // ── Real-time updates & listener ───────────────────────────────────────
      const handleDataRefreshed = () => {
        loadData();
        setLocalLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      };
      window.addEventListener('data-refreshed', handleDataRefreshed);

      const unsubInd = subscribeToIndividualCustomerReadings(() => setIndReadings(getIndividualCustomerReadings()));
      const unsubBulk = subscribeToBulkMeterReadings(() => setBulkReadings(getBulkMeterReadings()));
      const unsubCust = subscribeToCustomers((updated) => setCustomersList(updated));
      const unsubBM = subscribeToBulkMeters((updated) => setBulkMetersList(updated));
      const unsubStaff = subscribeToStaffMembers((updated) => setStaffList(updated));
      const unsubRoutes = subscribeToRoutes((updated) => setRoutesList(updated));

      return () => {
        window.removeEventListener('data-refreshed', handleDataRefreshed);
        unsubInd();
        unsubBulk();
        unsubCust();
        unsubBM();
        unsubStaff();
        unsubRoutes();
      };
  }, []);

  const currentMonthYear = format(new Date(), 'yyyy-MM');

  // Compute reader progress records
  const readerProgressData = React.useMemo(() => {
    // Filter staff members based on effective branch permission
    let relevantStaff = staffList;
    if (effectiveBranchId) {
      relevantStaff = relevantStaff.filter(s => s.branchId === effectiveBranchId);
    }

    // Filter staff members who have reading tasks assigned or are Readers
    return relevantStaff.map(staff => {
      const staffIdRaw = (staff.id || staff.email || '').toLowerCase();
      const assignedRoutes = routesList.filter(r => r.readerId?.toLowerCase() === staffIdRaw);
      const routeKeys = new Set(assignedRoutes.map(r => r.routeKey));

      const assignedBulkMeters = bulkMetersList.filter(bm => bm.routeKey && routeKeys.has(bm.routeKey));
      const bulkKeys = new Set(assignedBulkMeters.map(bm => bm.customerKeyNumber));
      const assignedCustomers = customersList.filter(c => c.assignedBulkMeterId && bulkKeys.has(c.assignedBulkMeterId));

      const staffBulkReadings = bulkReadings.filter(r => r.CUSTOMERKEY && bulkKeys.has(r.CUSTOMERKEY) && r.monthYear === currentMonthYear);
      const indKeys = new Set(assignedCustomers.map(c => c.customerKeyNumber));
      const staffIndReadings = indReadings.filter(r => r.individualCustomerId && indKeys.has(r.individualCustomerId) && r.monthYear === currentMonthYear);

      const totalAssigned = assignedBulkMeters.length + assignedCustomers.length;
      const totalCompleted = staffBulkReadings.length + staffIndReadings.length;
      const completionPercentage = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

      // Determine latest activity timestamp
      const allTimestamps = [
        ...staffBulkReadings.map(r => new Date(r.READING_DATE || r.date || 0).getTime()),
        ...staffIndReadings.map(r => new Date(r.READING_DATE || r.date || 0).getTime())
      ].filter(t => t > 0);

      const latestActivityTimestamp = allTimestamps.length > 0 ? Math.max(...allTimestamps) : null;

      let status: 'Completed' | 'Active Reading' | 'Not Started' = 'Not Started';
      if (totalAssigned > 0 && completionPercentage === 100) {
        status = 'Completed';
      } else if (totalCompleted > 0) {
        status = 'Active Reading';
      }

      return {
        id: staff.id,
        name: staff.name || staff.email || 'Field Reader',
        email: staff.email,
        branchName: staff.branchName || 'Assigned Branch',
        assignedRouteCount: assignedRoutes.length,
        routeKeys: Array.from(routeKeys),
        bulkMeterCount: assignedBulkMeters.length,
        customerCount: assignedCustomers.length,
        totalAssigned,
        totalCompleted,
        pendingCount: totalAssigned - totalCompleted,
        completionPercentage,
        latestActivityTimestamp,
        status
      };
    }).filter(r => r.totalAssigned > 0 || r.assignedRouteCount > 0);
  }, [staffList, routesList, bulkMetersList, customersList, bulkReadings, indReadings, effectiveBranchId, currentMonthYear]);

  const filteredReaders = React.useMemo(() => {
    if (!searchTerm.trim()) return readerProgressData;
    const term = searchTerm.toLowerCase();
    return readerProgressData.filter(r => 
      r.name.toLowerCase().includes(term) || 
      r.email.toLowerCase().includes(term) ||
      r.routeKeys.some(rk => rk.toLowerCase().includes(term))
    );
  }, [readerProgressData, searchTerm]);

  // High-level KPI summary
  const summaryKPIs = React.useMemo(() => {
    const totalReaders = readerProgressData.length;
    const activeReaders = readerProgressData.filter(r => r.status === 'Active Reading').length;
    const completedReaders = readerProgressData.filter(r => r.status === 'Completed').length;

    const aggregateAssigned = readerProgressData.reduce((sum, r) => sum + r.totalAssigned, 0);
    const aggregateCompleted = readerProgressData.reduce((sum, r) => sum + r.totalCompleted, 0);
    const overallPercentage = aggregateAssigned > 0 ? Math.round((aggregateCompleted / aggregateAssigned) * 100) : 0;

    return {
      totalReaders,
      activeReaders,
      completedReaders,
      aggregateAssigned,
      aggregateCompleted,
      overallPercentage
    };
  }, [readerProgressData]);

  const canAccessReaderProgress = 
    hasPermission(PERMISSIONS.READER_PROGRESS_VIEW) ||
    hasPermission('reader_progress_view') ||
    hasPermission(PERMISSIONS.ROUTES_MANAGE) ||
    hasPermission('routes_manage') ||
    hasPermission(PERMISSIONS.ROUTES_VIEW_ALL) ||
    hasPermission('routes_view_all') ||
    hasPermission(PERMISSIONS.ROUTES_VIEW_BRANCH) ||
    hasPermission('routes_view_branch') ||
    hasPermission(PERMISSIONS.STAFF_VIEW_ALL) ||
    hasPermission('staff_view_all') ||
    hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL) ||
    hasPermission('*') ||
    hasPermission('all');

  if (!canAccessReaderProgress) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <UIAlertDescription>
            You do not have permission to view the Reader Supervisor Monitoring Dashboard. Required permission: Reader Progress View.
          </UIAlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-muted-foreground">Loading Reader Supervisor Monitoring Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 text-muted-foreground gap-1">
            <Link href="/staff/my-routes">
              <ArrowLeft className="h-4 w-4" />
              Back to Routes
            </Link>
          </Button>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7 text-blue-600" />
              Live Reader Supervisor Monitoring
            </h1>
            <button
              onClick={() => triggerRefresh()}
              title="Refresh data now"
              className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <Clock className={`h-2.5 w-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : localLastUpdated ? `Updated ${localLastUpdated}` : 'Live Data'}
            </button>
          </div>
          <p className="text-muted-foreground">Track real-time reading progress and field completion rates for your branch.</p>
        </div>
        <Badge variant="outline" className="self-start sm:self-auto bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 text-sm font-semibold flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-blue-600" />
          Period: {currentMonthYear}
        </Badge>
      </div>

      {/* High-Level KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold text-slate-500">Total Field Readers</CardDescription>
            <CardTitle className="text-2xl font-black">{summaryKPIs.totalReaders}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <span className="text-emerald-600 font-bold">{summaryKPIs.activeReaders} active</span> • {summaryKPIs.completedReaders} completed
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold text-slate-500">Readings Completed Today</CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-600">{summaryKPIs.aggregateCompleted}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            out of {summaryKPIs.aggregateAssigned} total assigned meters
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold text-slate-500">Pending Readings</CardDescription>
            <CardTitle className="text-2xl font-black text-amber-600">{summaryKPIs.aggregateAssigned - summaryKPIs.aggregateCompleted}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            meters remaining in active routes
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold text-slate-500">Overall Branch Completion</CardDescription>
            <CardTitle className="text-2xl font-black text-indigo-600">{summaryKPIs.overallPercentage}%</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <Progress value={summaryKPIs.overallPercentage} className="h-2 bg-slate-100" />
          </CardContent>
        </Card>
      </div>

      {/* Reader Progress Table */}
      <Card className="shadow-md">
        <CardHeader className="border-b bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Field Reader Progress Monitor</CardTitle>
              <CardDescription>Real-time task completion and route status per reader.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reader name or route..."
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredReaders.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="mx-auto h-12 w-12 opacity-20 mb-3" />
              <p className="font-semibold">No active field readers found.</p>
              <p className="text-xs mt-1">Make sure meter routes are assigned to readers in route management.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-100/70">
                <TableRow>
                  <TableHead className="font-bold">Field Reader</TableHead>
                  <TableHead className="font-bold">Assigned Routes</TableHead>
                  <TableHead className="font-bold text-center">Assigned Meters</TableHead>
                  <TableHead className="font-bold">Completion Progress</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReaders.map((reader) => (
                  <TableRow key={reader.id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell className="font-semibold">
                      <div>
                        <div className="text-slate-900 font-bold">{reader.name}</div>
                        <div className="text-xs text-muted-foreground">{reader.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {reader.routeKeys.map(rk => (
                          <Badge key={rk} variant="outline" className="font-mono text-[10px] bg-white text-blue-700 border-blue-200">
                            {rk}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      <span className="font-bold text-slate-800">{reader.totalAssigned}</span>
                      <span className="text-muted-foreground text-[10px] block">({reader.bulkMeterCount} Bulk, {reader.customerCount} Ind.)</span>
                    </TableCell>
                    <TableCell className="w-56">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span>{reader.totalCompleted}/{reader.totalAssigned} Read</span>
                          <span className={reader.completionPercentage === 100 ? "text-emerald-600 font-extrabold" : "text-blue-600"}>
                            {reader.completionPercentage}%
                          </span>
                        </div>
                        <Progress value={reader.completionPercentage} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      {reader.status === 'Completed' ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold flex items-center gap-1 w-max">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </Badge>
                      ) : reader.status === 'Active Reading' ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-bold flex items-center gap-1 w-max">
                          <Activity className="h-3 w-3 text-blue-600 animate-pulse" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium">
                          Not Started
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {reader.latestActivityTimestamp ? (
                        format(new Date(reader.latestActivityTimestamp), 'MMM dd, HH:mm')
                      ) : (
                        <span className="italic opacity-60">No entries yet</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
