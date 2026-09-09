"use client";

import * as React from "react";
import { usePermissions } from "@/hooks/use-permissions";
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
import { getReaderProgressMetricsAction } from "@/lib/actions";

export default function ReaderSupervisorMonitoringPage() {
  const { hasPermission } = usePermissions();
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [readerProgressData, setReaderProgressData] = React.useState<any[]>([]);
  const { isRefreshing, refresh: triggerRefresh } = useDataRefresh();
  const [localLastUpdated, setLocalLastUpdated] = React.useState<string>('');
  const [currentMonthYear, setCurrentMonthYear] = React.useState<string>(format(new Date(), 'yyyy-MM'));

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await getReaderProgressMetricsAction(currentMonthYear);
      const data = res?.data || (Array.isArray(res) ? res : []);
      setReaderProgressData(data);
      setLocalLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.error("Failed to load reader progress metrics:", e);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonthYear]);

  React.useEffect(() => {
    loadData();

    const handleDataRefreshed = () => {
      loadData();
    };
    window.addEventListener('data-refreshed', handleDataRefreshed);

    return () => {
      window.removeEventListener('data-refreshed', handleDataRefreshed);
    };
  }, [loadData]);

  const filteredReaders = React.useMemo(() => {
    if (!searchTerm.trim()) return readerProgressData;
    const term = searchTerm.toLowerCase();
    return readerProgressData.filter(r => 
      r.name.toLowerCase().includes(term) || 
      r.email.toLowerCase().includes(term) ||
      r.routeKeys.some((rk: string) => rk.toLowerCase().includes(term))
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
                        {reader.routeKeys.map((rk: string) => (
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
