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
  getIndividualCustomerReadings,
  subscribeToIndividualCustomerReadings,
  subscribeToBulkMeterReadings,
  subscribeToCustomers,
  subscribeToBulkMeters,
} from "@/lib/data-store";
import { useDataRefresh } from "@/lib/data-refresh-context";
import { useNetworkQuality } from "@/lib/network-quality";
import { getReadingPeriodDetailsAction } from "@/lib/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, ArrowRight, Loader2, AlertCircle, CheckCircle2, Clock, Activity, BarChart3, Gauge, WifiOff } from "lucide-react";
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

    const { isRefreshing, refresh: triggerRefresh, networkQuality, isOnline } = useDataRefresh();
    const { quality: liveQuality } = useNetworkQuality();
    const effectiveQuality = (!isOnline || liveQuality === 'offline' || networkQuality === 'offline')
        ? 'offline'
        : (liveQuality === 'weak' || networkQuality === 'weak') ? 'weak' : 'strong';
    const [localLastUpdated, setLocalLastUpdated] = React.useState<string>('');
    const [periodStartDate, setPeriodStartDate] = React.useState<string>('');
    const [periodEndDate, setPeriodEndDate] = React.useState<string>('');

    const PERIOD_STATUS_TTL_MS = 30 * 60 * 1000;

    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const cachedPeriodStart = localStorage.getItem('cached_period_start_date') || '';
            const cachedPeriodEnd = localStorage.getItem('cached_period_end_date') || '';
            const periodTs = parseInt(localStorage.getItem('cached_period_status_ts') || '0', 10);

            const isPeriodFresh = periodTs > 0 && (Date.now() - periodTs < PERIOD_STATUS_TTL_MS) && cachedPeriodStart;
            if (isPeriodFresh) {
                setPeriodStartDate(cachedPeriodStart);
                setPeriodEndDate(cachedPeriodEnd);
            }

            const fetchPeriod = isPeriodFresh ? Promise.resolve(null) : getReadingPeriodDetailsAction().then(details => {
                if (details) {
                    setPeriodStartDate(details.startDate || '');
                    setPeriodEndDate(details.endDate || '');
                    if (details.startDate) localStorage.setItem('cached_period_start_date', details.startDate);
                    if (details.endDate) localStorage.setItem('cached_period_end_date', details.endDate);
                    localStorage.setItem('cached_period_status_ts', String(Date.now()));
                }
            }).catch(e => console.warn("Failed to fetch period details for routes", e));

            await Promise.all([
                fetchRoutes(),
                initializeBulkMeters(),
                initializeCustomers(),
                initializeBulkMeterReadings(),
                initializeIndividualCustomerReadings(),
                fetchPeriod
            ]);
            setBulkReadings(getBulkMeterReadings());
            setIndReadings(getIndividualCustomerReadings());
            setAllCustomers(getCustomers());
            setIsLoading(false);
        };
        load();

        // ── Real-time updates & listener ─────────────────────────────────────────
        // Only refresh readings on background refresh; avoid heavy full refetches
        const handleDataRefreshed = () => {
          const currentOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
          const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
          const effType = conn?.effectiveType ?? 'unknown';
          const isWeak = !currentOnline || effType === '2g' || effType === 'slow-2g' || (conn?.downlink != null && conn.downlink < 1);
          if (!isWeak && currentOnline) {
            Promise.all([
                initializeBulkMeterReadings(true),
                initializeIndividualCustomerReadings(true)
            ]).then(() => {
                setBulkReadings(getBulkMeterReadings());
                setIndReadings(getIndividualCustomerReadings());
                setAllCustomers(getCustomers());
            }).catch(() => {});
          } else {
            setBulkReadings(getBulkMeterReadings());
            setIndReadings(getIndividualCustomerReadings());
            setAllCustomers(getCustomers());
          }
          setLocalLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        };
        window.addEventListener('data-refreshed', handleDataRefreshed);

        const unsubInd = subscribeToIndividualCustomerReadings(() => setIndReadings(getIndividualCustomerReadings()));
        const unsubBulk = subscribeToBulkMeterReadings(() => setBulkReadings(getBulkMeterReadings()));
        const unsubCust = subscribeToCustomers((updated) => setAllCustomers(updated));
        const unsubBM = subscribeToBulkMeters(() => {
            setBulkReadings(getBulkMeterReadings());
        });

        return () => {
          window.removeEventListener('data-refreshed', handleDataRefreshed);
          unsubInd();
          unsubBulk();
          unsubCust();
          unsubBM();
        };
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

    // Synthesize effective routes from routes table and any distinct route keys in bulk meters / customers
    const effectiveRoutes = React.useMemo(() => {
        const routeMap = new Map<string, any>();
        for (const r of routes) {
            if (r.routeKey) routeMap.set(r.routeKey, r);
        }
        for (const bm of allBulkMeters) {
            const rk = bm.routeKey || (bm as any).route_key;
            if (rk && !routeMap.has(rk)) {
                routeMap.set(rk, {
                    routeKey: rk,
                    branchId: bm.branchId || (bm as any).branch_id,
                    readerId: bm.readerStaffId || (bm as any).assignedReaderId || (bm as any).reader_staff_id,
                    description: `Route ${rk}`
                });
            }
        }
        for (const c of allCustomers) {
            const rk = c.routeKey || (c as any).route_key;
            if (rk && !routeMap.has(rk)) {
                routeMap.set(rk, {
                    routeKey: rk,
                    branchId: c.branchId || (c as any).branch_id,
                    readerId: c.readerStaffId || (c as any).assignedReaderId || (c as any).reader_staff_id,
                    description: `Route ${rk}`
                });
            }
        }
        return Array.from(routeMap.values());
    }, [routes, allBulkMeters, allCustomers]);

    const myRoutes = React.useMemo(() => {
        if (canViewAllRoutes) return effectiveRoutes;
        // Branch-level supervisors: see all routes in their branch
        if (canViewBranchRoutes) {
            if (!currentUser?.branchId) return effectiveRoutes;
            return effectiveRoutes.filter(r => !r.branchId || r.branchId === currentUser.branchId);
        }
        // Field readers: see assigned routes or routes containing their branch / assigned meters
        if (!currentUser?.id) return [];
        const userIdRaw = currentUser.id.toLowerCase();
        const userBranchId = currentUser.branchId;
        return effectiveRoutes.filter(r => {
            const isRouteAssigned = r.readerId?.toLowerCase() === userIdRaw;
            const hasAssignedBulk = allBulkMeters.some(bm => (bm.routeKey === r.routeKey || (bm as any).route_key === r.routeKey) && (
                bm.readerStaffId?.toLowerCase() === userIdRaw || 
                (bm as any).assignedReaderId?.toLowerCase() === userIdRaw ||
                (bm as any).reader_staff_id?.toLowerCase() === userIdRaw ||
                (bm as any).assigned_reader_id?.toLowerCase() === userIdRaw
            ));
            const hasAssignedCustomer = allCustomers.some(c => (c.routeKey === r.routeKey || (c as any).route_key === r.routeKey) && (
                c.readerStaffId?.toLowerCase() === userIdRaw ||
                (c as any).assignedReaderId?.toLowerCase() === userIdRaw ||
                (c as any).reader_staff_id?.toLowerCase() === userIdRaw ||
                (c as any).assigned_reader_id?.toLowerCase() === userIdRaw
            ));
            // Also include routes belonging to the reader's branch if the reader is the branch reader
            const isBranchMatch = Boolean(userBranchId && r.branchId && (
                r.branchId === userBranchId || 
                r.branchId.toLowerCase() === userBranchId.toLowerCase()
            ));
            
            const isAssigned = isRouteAssigned || hasAssignedBulk || hasAssignedCustomer || isBranchMatch;
            if (!isAssigned) return false;
            if (userBranchId && r.branchId && r.branchId !== userBranchId && r.branchId.toLowerCase() !== userBranchId.toLowerCase()) return false;
            return true;
        });
    }, [effectiveRoutes, currentUser, canViewAllRoutes, canViewBranchRoutes, allBulkMeters, allCustomers]);

    const currentMonthYear = React.useMemo(() => format(new Date(), 'yyyy-MM'), []);

    // Pre-group data by route to pre-compute progress statistics in O(N) rather than O(R * N)
    const routeStatsMap = React.useMemo(() => {
        const statsMap = new Map<string, {
            bulkMeterCount: number;
            customerCount: number;
            totalMeters: number;
            totalRead: number;
            pendingRead: number;
            progressPercentage: number;
        }>();

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

        // Set of read bulk meter customer keys
        const readBulkKeys = new Set<string>();
        for (const r of bulkReadings) {
            if (r.CUSTOMERKEY && isRead(r)) readBulkKeys.add(r.CUSTOMERKEY);
        }

        // Group bulk meters by route
        const bulkByRoute = new Map<string, any[]>();
        const bulkToRouteMap = new Map<string, string>();
        for (const bm of allBulkMeters) {
            const rk = bm.routeKey || (bm as any).route_key;
            if (rk) {
                if (!bulkByRoute.has(rk)) bulkByRoute.set(rk, []);
                bulkByRoute.get(rk)!.push(bm);
                if (bm.customerKeyNumber) bulkToRouteMap.set(bm.customerKeyNumber, rk);
            }
        }

        // Count customers by route
        const custCountByRoute = new Map<string, number>();
        for (const c of allCustomers) {
            const rk = c.routeKey || (c as any).route_key || (c.assignedBulkMeterId ? bulkToRouteMap.get(c.assignedBulkMeterId) : undefined);
            if (rk) {
                custCountByRoute.set(rk, (custCountByRoute.get(rk) || 0) + 1);
            }
        }

        for (const r of myRoutes) {
            const rk = r.routeKey;
            const routeBulk = bulkByRoute.get(rk) || [];
            let totalRead = 0;
            for (const bm of routeBulk) {
                if (readBulkKeys.has(bm.customerKeyNumber)) totalRead++;
            }
            const totalMeters = routeBulk.length;
            const progressPercentage = totalMeters > 0 ? Math.round((totalRead / totalMeters) * 100) : 0;
            statsMap.set(rk, {
                bulkMeterCount: totalMeters,
                customerCount: custCountByRoute.get(rk) || 0,
                totalMeters,
                totalRead,
                pendingRead: totalMeters - totalRead,
                progressPercentage
            });
        }

        return statsMap;
    }, [allBulkMeters, allCustomers, bulkReadings, myRoutes, periodStartDate, periodEndDate, currentMonthYear]);

    const getRouteStats = React.useCallback((routeKey: string) => {
        return routeStatsMap.get(routeKey) || {
            bulkMeterCount: 0,
            customerCount: 0,
            totalMeters: 0,
            totalRead: 0,
            pendingRead: 0,
            progressPercentage: 0
        };
    }, [routeStatsMap]);

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
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                            <MapPin className="h-7 w-7 text-blue-600" />
                            My Assigned Routes
                        </h1>
                        <button
                            onClick={() => triggerRefresh()}
                            title="Refresh data now"
                            disabled={effectiveQuality === 'offline'}
                            className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Clock className={`h-2.5 w-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Refreshing…' : localLastUpdated ? `Updated ${localLastUpdated}` : (effectiveQuality === 'offline' ? 'Cached' : 'Live Data')}
                        </button>
                        {effectiveQuality === 'offline' && (
                            <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                                <WifiOff className="h-2.5 w-2.5" /> Offline
                            </span>
                        )}
                        {effectiveQuality === 'weak' && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Weak Signal
                            </span>
                        )}
                    </div>
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

            {/* ─── Network Quality Banner ─────────────────────────────────── */}
            {effectiveQuality === 'offline' && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
                    <WifiOff className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
                    <div>
                        <p className="font-bold">No Connection — Offline Mode</p>
                        <p className="text-xs mt-0.5 text-red-700">Route data is loaded from your device cache. Open a route to submit readings — they will sync automatically when you reconnect.</p>
                    </div>
                </div>
            )}
            {effectiveQuality === 'weak' && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" />
                    <div>
                        <p className="font-bold">Slow Connection Detected</p>
                        <p className="text-xs mt-0.5 text-amber-700">The app is using reduced sync mode to save data. Open a route and tap <strong>"Save Offline Now!"</strong> to ensure all meter data is available offline.</p>
                    </div>
                </div>
            )}

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
                                                {stats.totalRead}/{stats.totalMeters} Bulk Meters ({stats.progressPercentage}%)
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
