"use client";

import * as React from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { 
  useRoutes, 
  useBulkMeters, 
  fetchRoutes, 
  initializeBulkMeters,
  initializeCustomers,
  initializeBulkMeterReadings,
  initializeIndividualCustomerReadings,
  getBulkMeters,
  getCustomers,
  getBulkMeterReadings,
  getIndividualCustomerReadings
} from "@/lib/data-store";
import { getReadingPeriodDetailsAction } from "@/lib/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, ArrowRight, Loader2, AlertCircle, CheckCircle2, Clock, Activity, BarChart3, Gauge } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { MobileReaderIntro } from "./mobile-reader-intro";
import { format } from "date-fns";

export default function MyRoutesPage() {
    const { currentUser } = useCurrentUser();
    const { hasPermission } = usePermissions();
    const routes = useRoutes();
    const allBulkMeters = useBulkMeters();
    const [isLoading, setIsLoading] = React.useState(true);
    const [bulkReadings, setBulkReadings] = React.useState<any[]>([]);
    const [indReadings, setIndReadings] = React.useState<any[]>([]);
    const [allCustomers, setAllCustomers] = React.useState<any[]>([]);

    const [periodStartDate, setPeriodStartDate] = React.useState<string>('');
    const [periodEndDate, setPeriodEndDate] = React.useState<string>('');

    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchRoutes(),
                initializeBulkMeters(),
                initializeCustomers(),
                initializeBulkMeterReadings(),
                initializeIndividualCustomerReadings(),
                getReadingPeriodDetailsAction().then(details => {
                    if (details) {
                        setPeriodStartDate(details.startDate || '');
                        setPeriodEndDate(details.endDate || '');
                    }
                }).catch(e => console.warn("Failed to fetch period details for routes", e))
            ]);
            setBulkReadings(getBulkMeterReadings());
            setIndReadings(getIndividualCustomerReadings());
            setAllCustomers(getCustomers());
            setIsLoading(false);
        };
        load();
    }, []);

    const canViewAllRoutes = 
        hasPermission('routes_view_all') || 
        hasPermission('*') || 
        hasPermission('all');

    const canViewBranchRoutes =
        hasPermission('routes_view_branch') ||
        hasPermission('routes_manage');

    const isSupervisor = 
        canViewAllRoutes || 
        canViewBranchRoutes ||
        hasPermission('reader_progress_view') ||
        hasPermission('staff_view_all') || 
        hasPermission('dashboard_view_all');

    const canViewRoutes = 
        canViewAllRoutes ||
        canViewBranchRoutes ||
        hasPermission('routes_view_assigned') ||
        hasPermission('meter_readings_create_bulk') ||
        hasPermission('meter_readings_create_individual') ||
        hasPermission('meter_readings_create');

    const myRoutes = React.useMemo(() => {
        if (canViewAllRoutes) return routes;
        // Branch-level supervisors: see all routes in their branch
        if (canViewBranchRoutes) {
            if (!currentUser?.branchId) return routes;
            return routes.filter(r => r.branchId === currentUser.branchId);
        }
        // Field readers: only see routes assigned to them
        if (!currentUser?.id) return [];
        const userIdRaw = currentUser.id.toLowerCase();
        return routes.filter(r => r.readerId?.toLowerCase() === userIdRaw);
    }, [routes, currentUser, canViewAllRoutes, canViewBranchRoutes]);

    const currentMonthYear = format(new Date(), 'yyyy-MM');

    // Calculate progress statistics per route
    const getRouteStats = (routeKey: string) => {
        const routeBulkMeters = allBulkMeters.filter(bm => bm.routeKey === routeKey);
        const routeBulkKeys = new Set(routeBulkMeters.map(bm => bm.customerKeyNumber));
        const routeCustomers = allCustomers.filter(c => c.assignedBulkMeterId && routeBulkKeys.has(c.assignedBulkMeterId));

        const isRead = (r: any) => {
            const rDateStr = r.readingDate || r.READING_DATE || r.created_at || r.createdAt;
            if (periodStartDate) {
                if (!rDateStr) return r.monthYear === currentMonthYear;
                const formattedRDate = typeof rDateStr === 'string' ? rDateStr.slice(0, 10) : format(new Date(rDateStr), 'yyyy-MM-dd');
                if (periodEndDate) return formattedRDate >= periodStartDate && formattedRDate <= periodEndDate;
                return formattedRDate >= periodStartDate;
            }
            return r.monthYear === currentMonthYear;
        };

        const bulkReadCount = bulkReadings.filter(r => r.CUSTOMERKEY && routeBulkKeys.has(r.CUSTOMERKEY) && isRead(r)).length;
        const indCustomerKeys = new Set(routeCustomers.map(c => c.customerKeyNumber));
        const indReadCount = indReadings.filter(r => r.individualCustomerId && indCustomerKeys.has(r.individualCustomerId) && isRead(r)).length;

        const totalMeters = routeBulkMeters.length + routeCustomers.length;
        const totalRead = bulkReadCount + indReadCount;
        const progressPercentage = totalMeters > 0 ? Math.round((totalRead / totalMeters) * 100) : 0;

        return {
            bulkMeterCount: routeBulkMeters.length,
            customerCount: routeCustomers.length,
            totalMeters,
            totalRead,
            pendingRead: totalMeters - totalRead,
            progressPercentage
        };
    };

    if (!canViewRoutes) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <UIAlertDescription>
                        You do not have permission to view assigned routes.
                    </UIAlertDescription>
                </Alert>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-muted-foreground">Loading your assigned routes & reading progress...</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <MobileReaderIntro userName={currentUser?.name} />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                        <MapPin className="h-7 w-7 text-blue-600" />
                        My Assigned Routes
                    </h1>
                    <p className="text-muted-foreground">Track completion progress and record meter readings for your routes.</p>
                </div>
                {isSupervisor && (
                    <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold gap-2">
                        <Link href="/staff/reader-progress">
                            <Activity className="h-4 w-4 text-blue-600" />
                            Live Reader Supervisor Monitoring
                        </Link>
                    </Button>
                )}
            </div>

            {myRoutes.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-2 bg-muted/20">
                    <MapPin className="mx-auto h-16 w-16 text-muted-foreground opacity-20 mb-4" />
                    <CardTitle className="text-xl">No Routes Assigned</CardTitle>
                    <CardDescription className="max-w-xs mx-auto">
                        You haven&apos;t been assigned to any meter reading routes yet. Please contact your branch manager.
                    </CardDescription>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {myRoutes.map(route => {
                        const stats = getRouteStats(route.routeKey);
                        const isCompleted = stats.totalMeters > 0 && stats.progressPercentage === 100;

                        return (
                            <Card key={route.routeKey} className="overflow-hidden hover:shadow-lg transition-all border-l-4 border-l-blue-500 flex flex-col justify-between">
                                <CardHeader className="bg-muted/30 pb-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="font-mono bg-white text-blue-600 border-blue-200">
                                            {route.routeKey}
                                        </Badge>
                                        {isCompleted ? (
                                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 font-bold">
                                                <CheckCircle2 className="h-3 w-3" /> Completed
                                            </Badge>
                                        ) : stats.totalRead > 0 ? (
                                            <Badge className="bg-blue-100 text-blue-800 border-blue-300 flex items-center gap-1 font-bold">
                                                <Clock className="h-3 w-3" /> {stats.progressPercentage}% Read
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                                Not Started
                                            </Badge>
                                        )}
                                    </div>
                                    <CardTitle className="text-xl">{route.description || "Reading Route"}</CardTitle>
                                    <CardDescription className="line-clamp-1">{route.routeKey}</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
                                    {/* Progress Bar Component */}
                                    <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div className="flex justify-between text-xs font-bold text-slate-700">
                                            <span>Reading Completion</span>
                                            <span className={stats.progressPercentage === 100 ? "text-emerald-600 font-extrabold" : "text-blue-600"}>
                                                {stats.totalRead}/{stats.totalMeters} Meters ({stats.progressPercentage}%)
                                            </span>
                                        </div>
                                        <Progress value={stats.progressPercentage} className="h-2.5 bg-slate-200" />
                                        <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                                            <span>{stats.bulkMeterCount} Bulk Meters</span>
                                            <span>{stats.customerCount} Ind. Customers</span>
                                        </div>
                                    </div>

                                    <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 font-bold gap-2">
                                        <Link href={`/staff/my-routes/${route.routeKey}`}>
                                            Start / Continue Reading
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
