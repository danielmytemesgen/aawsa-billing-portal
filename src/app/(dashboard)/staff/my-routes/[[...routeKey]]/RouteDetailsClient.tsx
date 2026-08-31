"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
    useRoutes,
    useBulkMeters,
    getCustomers,
    initializeBulkMeters,
    fetchRoutes,
    initializeCustomers,
    addBulkMeterReading,
    addIndividualCustomerReading,
    getFaultCodes,
    initializeFaultCodes,
    getBulkMeterReadings,
    getIndividualCustomerReadings,
    initializeBulkMeterReadings,
    initializeIndividualCustomerReadings,
    fetchRoutes as dbFetchRoutes,
    subscribeToIndividualCustomerReadings,
    subscribeToBulkMeterReadings,
    subscribeToCustomers,
    subscribeToBulkMeters,
} from "@/lib/data-store";
import { useDataRefresh } from "@/lib/data-refresh-context";
import { useNetworkQuality } from "@/lib/network-quality";
import { getReadingPeriodStatusAction, getReadingPeriodDetailsAction } from "@/lib/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, Gauge, ClipboardList, Loader2, User, ChevronRight, ChevronDown, CheckCircle2, Map as MapIcon, List, Clock, Filter, AlertCircle, Download, HardDrive, Lock, WifiOff, Wifi, Signal, Sun } from "lucide-react";
import Link from "next/link";
import { AddMeterReadingForm, type AddMeterReadingFormValues } from "@/features/billing/components/add-meter-reading-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle as UIDialogTitle } from "@/components/ui/dialog";
import { RouteMap } from "@/features/billing/components/route-map";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { FaultCodeRow } from "@/lib/action-types";
import { type Coordinates, calculateDistance, triggerReadingSavedHaptic } from "@/lib/geo-utils";
import { MapPin } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { canCreateMeterReadingForType } from "@/lib/meter-reading-permissions";
import {
    getFailedReadings,
    getPendingReadings,
    cacheRoutePackage,
    getCachedHistoricalReadings
} from "@/lib/offline-db";

export default function RouteDetailsClient() {
    const params = useParams();
    const routeKeyRaw = params?.routeKey;
    const routeKey = Array.isArray(routeKeyRaw) ? routeKeyRaw[0] : (routeKeyRaw as string);
    const router = useRouter();
    const { toast } = useToast();
    const { currentUser } = useCurrentUser();
    const { hasPermission } = usePermissions();

    const routes = useRoutes();
    const allBulkMeters = useBulkMeters();
    const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
    const [faultCodesForForm, setFaultCodesForForm] = React.useState<FaultCodeRow[]>([]);
    const [bulkReadings, setBulkReadings] = React.useState<any[]>([]);
    const [individualReadings, setIndividualReadings] = React.useState<any[]>([]);
    const { isRefreshing, refresh: triggerRefresh, networkQuality, isOnline } = useDataRefresh();
    const { quality: liveQuality } = useNetworkQuality();
    // Use the most pessimistic quality between the context and live hook
    const effectiveQuality = (!isOnline || liveQuality === 'offline' || networkQuality === 'offline')
        ? 'offline'
        : (liveQuality === 'weak' || networkQuality === 'weak') ? 'weak' : 'strong';
    const [localLastUpdated, setLocalLastUpdated] = React.useState<string>('');
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [viewMode, setViewMode] = React.useState<'list' | 'map'>('list');
    const [meterStatusFilter, setMeterStatusFilter] = React.useState<'all' | 'unread' | 'read'>('all');
    const [isReadingModalOpen, setIsReadingModalOpen] = React.useState(false);
    const [selectedMeter, setSelectedMeter] = React.useState<{
        type: 'bulk' | 'individual',
        id: string,
        name: string,
        meterNumber?: string,
        lastReading: number
    } | null>(null);

    const [expandedMeters, setExpandedMeters] = React.useState<Set<string>>(new Set());
    const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null);
    const [usingCachedLocation, setUsingCachedLocation] = React.useState(false);
    const [pathHistory, setPathHistory] = React.useState<Coordinates[]>([]);
    const [periodStatus, setPeriodStatus] = React.useState<'Open' | 'Closed' | 'Ready for New Reading'>('Closed');
    const [periodStartDate, setPeriodStartDate] = React.useState<string>('');
    const [periodEndDate, setPeriodEndDate] = React.useState<string>('');
    const [pendingOfflineMeterKeys, setPendingOfflineMeterKeys] = React.useState<Set<string>>(new Set());
    const [syncProgress, setSyncProgress] = React.useState<string | null>(null);
    const [locationError, setLocationError] = React.useState<string | null>(null);
    const [offlineQueueState, setOfflineQueueState] = React.useState({ pending: 0, failed: 0 });
    const canReadBulk = React.useMemo(() => canCreateMeterReadingForType(hasPermission, 'bulk'), [hasPermission]);
    const canReadIndividual = React.useMemo(() => canCreateMeterReadingForType(hasPermission, 'individual'), [hasPermission]);
    const [nearbyOnly, setNearbyOnly] = React.useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('meter_nearby_only');
            return saved !== null ? saved === 'true' : true;
        }
        return true;
    });
    const PROXIMITY_THRESHOLD = 50; // 50 meters as requested

    const [sunlightMode, setSunlightMode] = React.useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('reader_sunlight_mode') === 'true';
        }
        return false;
    });

    const toggleSunlightMode = React.useCallback(() => {
        setSunlightMode(prev => {
            const next = !prev;
            if (typeof window !== 'undefined') localStorage.setItem('reader_sunlight_mode', String(next));
            return next;
        });
    }, []);

    // Persist nearby preference
    React.useEffect(() => {
        localStorage.setItem('meter_nearby_only', String(nearbyOnly));
    }, [nearbyOnly]);

    React.useEffect(() => {
        if (!navigator.geolocation) return;

        // Load last known location from localStorage as a fallback when offline/GPS fails
        try {
            const raw = localStorage.getItem('last_user_location');
            if (raw) {
                const parsed = JSON.parse(raw);
                // Accept cached location if it's not too old (24 hours)
                if (parsed?.coords && parsed?.t && (Date.now() - parsed.t) < 24 * 60 * 60 * 1000) {
                    setUserLocation(parsed.coords);
                    setUsingCachedLocation(true);
                }
            }
        } catch (e) {
            console.warn('Failed to parse cached location:', e);
        }

        let highAccuracyFailed = false;

        const startWatching = (highAccuracy: boolean) => {
            return navigator.geolocation.watchPosition(
                (position) => {
                    const newCoords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    setUserLocation(newCoords);
                    setUsingCachedLocation(false);
                    // Persist last known good location to localStorage for offline use
                    try {
                        localStorage.setItem('last_user_location', JSON.stringify({ coords: newCoords, t: Date.now() }));
                    } catch (e) {
                        console.warn('Unable to persist last location:', e);
                    }
                    setLocationError(null);
                    
                    setPathHistory(prev => {
                        if (prev.length === 0) return [newCoords];
                        const lastCoord = prev[prev.length - 1];
                        const dist = calculateDistance(lastCoord, newCoords);
                        if (dist > 5) return [...prev, newCoords];
                        return prev;
                    });
                },
                (error) => {
                    // Fix: Robust null/undefined check for the error object
                    if (!error) return;

                    console.warn("Geolocation attempt failed:", { 
                        code: error.code, 
                        message: error.message,
                        highAccuracy
                    });

                    // Fallback logic: If high accuracy fails while offline/indoors, try low accuracy
                    if (highAccuracy && !highAccuracyFailed && (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT)) {
                        highAccuracyFailed = true;
                        navigator.geolocation.clearWatch(watchId);
                        watchId = startWatching(false);
                        return;
                    }
                    
                    let errorMsg = "Unable to retrieve your location.";
                    if (error.code === error.PERMISSION_DENIED) {
                        errorMsg = "Location access denied. Please enable GPS in your browser settings.";
                        setLocationError("Permission denied");
                        setNearbyOnly(false); // Automatically fall back to showing all meters
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        errorMsg = "Location unavailable. Ensure you have clear sky view.";
                        setLocationError("Unavailable");
                        setNearbyOnly(false); // Automatically fall back
                    } else if (error.code === error.TIMEOUT) {
                        setLocationError("Timeout");
                        setNearbyOnly(false); // Automatically fall back
                    }

                    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
                    const shouldShowToast = error.code === error.PERMISSION_DENIED || (isOnline && error.code !== error.TIMEOUT);

                    if (shouldShowToast) {
                        toast({
                            title: "GPS Status",
                            description: errorMsg,
                            variant: error.code === error.PERMISSION_DENIED ? "destructive" : "default"
                        });
                    }
                },
                { 
                    enableHighAccuracy: highAccuracy, 
                    maximumAge: highAccuracy ? 10000 : 30000,
                    timeout: highAccuracy ? 15000 : 20000
                }
            );
        };

        let watchId = startWatching(true);
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const refreshOfflineQueueState = React.useCallback(async () => {
        try {
            const [pending, failed] = await Promise.all([getPendingReadings(), getFailedReadings()]);
            setOfflineQueueState({ pending: pending.length, failed: failed.length });
        } catch (error) {
            console.warn('Failed to refresh offline queue state', error);
        }
    }, []);

    React.useEffect(() => {
        refreshOfflineQueueState();
        const handleQueueUpdate = () => refreshOfflineQueueState();
        window.addEventListener('offline-queue-updated', handleQueueUpdate);
        return () => window.removeEventListener('offline-queue-updated', handleQueueUpdate);
    }, [refreshOfflineQueueState]);

    React.useEffect(() => {
        const initializeData = async () => {
        setIsLoading(true);
        setSyncProgress("Initializing...");
        try {
            // First, fetch route metadata and meters (Targeted)
            setSyncProgress("Loading meters...");
            
            // Period status and dates caching logic
            // Fix 6: Skip HTTP call if cached status is less than 30 minutes old.
            const PERIOD_STATUS_TTL_MS = 30 * 60 * 1000;
            const fetchPeriodStatus = async () => {
                const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
                // Check TTL cache before making an HTTP call
                if (!isOffline) {
                    const ts = parseInt(localStorage.getItem('cached_period_status_ts') || '0', 10);
                    if (ts > 0 && Date.now() - ts < PERIOD_STATUS_TTL_MS) {
                        const cached = localStorage.getItem('cached_period_status');
                        const cachedStart = localStorage.getItem('cached_period_start_date') || '';
                        const cachedEnd = localStorage.getItem('cached_period_end_date') || '';
                        if (cached) {
                            setPeriodStatus(cached as any);
                            if (cachedStart) setPeriodStartDate(cachedStart);
                            if (cachedEnd) setPeriodEndDate(cachedEnd);
                            return cached;
                        }
                    }
                }
                if (isOffline) {
                    const cached = localStorage.getItem('cached_period_status');
                    const cachedStartDay = localStorage.getItem('cached_period_start_day');
                    const cachedEndDay = localStorage.getItem('cached_period_end_day');

                    let activeStart = '';
                    let activeEnd = '';

                    // Recalculate dates from cached day numbers each time (handles month roll-over offline)
                    if (cachedStartDay && cachedEndDay) {
                        const now = new Date();
                        const yr = now.getFullYear();
                        const mo = now.getMonth();
                        const lastDay = new Date(yr, mo + 1, 0).getDate();
                        const sDay = Math.min(parseInt(cachedStartDay), lastDay);
                        const eDay = parseInt(cachedEndDay);
                        activeStart = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`;
                        if (eDay >= sDay) {
                            const eDayEffective = Math.min(eDay, lastDay);
                            activeEnd = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(eDayEffective).padStart(2, '0')}`;
                        } else {
                            const nextMo = mo + 1;
                            const nextYr = nextMo > 11 ? yr + 1 : yr;
                            const nextMoIdx = nextMo > 11 ? 0 : nextMo;
                            const lastDayNext = new Date(nextYr, nextMoIdx + 1, 0).getDate();
                            const eDayEffective = Math.min(eDay, lastDayNext);
                            activeEnd = `${nextYr}-${String(nextMoIdx + 1).padStart(2, '0')}-${String(eDayEffective).padStart(2, '0')}`;
                        }
                        setPeriodStartDate(activeStart);
                        setPeriodEndDate(activeEnd);
                        localStorage.setItem('cached_period_start_date', activeStart);
                        localStorage.setItem('cached_period_end_date', activeEnd);
                    } else {
                        activeStart = localStorage.getItem('cached_period_start_date') || '';
                        activeEnd = localStorage.getItem('cached_period_end_date') || '';
                        if (activeStart) setPeriodStartDate(activeStart);
                        if (activeEnd) setPeriodEndDate(activeEnd);
                    }

                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    let computedOfflineStatus: 'Open' | 'Closed' | 'Ready for New Reading' = 'Closed';
                    if (activeStart && activeEnd) {
                        if (todayStr >= activeStart && todayStr <= activeEnd) {
                            computedOfflineStatus = 'Open';
                        } else if (todayStr < activeStart) {
                            computedOfflineStatus = 'Ready for New Reading';
                        } else {
                            computedOfflineStatus = 'Closed';
                        }
                    } else if (cached) {
                        computedOfflineStatus = cached as any;
                    }
                    setPeriodStatus(computedOfflineStatus);
                    return computedOfflineStatus;
                }
                try {
                    const details = await getReadingPeriodDetailsAction();
                    if (details) {
                        setPeriodStatus(details.status || 'Open');
                        setPeriodStartDate(details.startDate || '');
                        setPeriodEndDate(details.endDate || '');
                        localStorage.setItem('cached_period_status', details.status);
                        localStorage.setItem('cached_period_status_ts', String(Date.now())); // TTL timestamp
                        // Cache day numbers for offline monthly recalculation
                        localStorage.setItem('cached_period_start_day', String(details.startDay || 1));
                        localStorage.setItem('cached_period_end_day', String(details.endDay || 20));
                        if (details.startDate) localStorage.setItem('cached_period_start_date', details.startDate);
                        if (details.endDate) localStorage.setItem('cached_period_end_date', details.endDate);
                        return details.status;
                    }
                } catch (e) {
                    console.warn("Failed to fetch period details, using cache if available:", e);
                    const cached = localStorage.getItem('cached_period_status');
                    if (cached) {
                        setPeriodStatus(cached as any);
                        return cached;
                    }
                }
                return 'Closed'; // Default fallback
            };

            setSyncProgress("Loading route & meter data...");
            await Promise.all([
                fetchPeriodStatus(),
                fetchRoutes(),
                initializeBulkMeters(true, { routeKey }),
                initializeFaultCodes(),
                initializeCustomers(true, { routeKey }),
                initializeBulkMeterReadings(true, { routeKey }).catch(e => console.warn('Bulk readings fetch warning:', e)),
                initializeIndividualCustomerReadings(true, { routeKey }).catch(e => console.warn('Individual readings fetch warning:', e))
            ]);

            setAllCustomers(getCustomers());
            setFaultCodesForForm(getFaultCodes());
            setBulkReadings(getBulkMeterReadings());
            setIndividualReadings(getIndividualCustomerReadings());

            // Load any pending offline readings from IndexedDB so meters that were
            // read offline (not yet synced) show the correct "Read" / "Update" state.
            try {
                const pendingOffline = await getPendingReadings();
                const offlineKeys = new Set<string>(
                    pendingOffline
                        .filter((r: { routeKey?: string | null }) => !r.routeKey || r.routeKey === routeKey)
                        .map((r: { meterKey?: string | null; payload?: any }) => {
                            const key = r.meterKey ||
                                r.payload?.CUSTOMERKEY ||
                                r.payload?.individualCustomerId ||
                                r.payload?.entityId || '';
                            return key as string;
                        })
                        .filter(Boolean)
                );
                setPendingOfflineMeterKeys(offlineKeys);
            } catch (e) {
                console.warn('Could not load pending offline readings from IndexedDB:', e);
            }

            setSyncProgress("Complete");
        } catch (error) {
            console.error("Failed to initialize route data:", error);
            toast({ 
                title: "Partial Initialization", 
                description: "Using offline cache where available.", 
                variant: "destructive" 
            });
        } finally {
            setIsLoading(false);
            setSyncProgress(null);
        }
    };
    initializeData();

    // ── Listen for data refresh events from DataRefreshProvider ─────────────
    // On any network quality: only refresh readings (lightweight) — skip re-fetching
    // routes/meters/fault-codes which rarely change in-session.
    const handleDataRefreshed = () => {
      const currentOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
      const effType = conn?.effectiveType ?? 'unknown';
      const isWeak = !currentOnline || effType === '2g' || effType === 'slow-2g' || (conn?.downlink != null && conn.downlink < 1);

      if (isWeak || !currentOnline) {
        // Lightweight update from in-memory store only — no HTTP
        setAllCustomers(getCustomers());
        setBulkReadings(getBulkMeterReadings());
        setIndividualReadings(getIndividualCustomerReadings());
      } else {
        // Online: refresh only readings (the costly part), not the full route/meter data
        Promise.all([
          initializeBulkMeterReadings(true, { routeKey }),
          initializeIndividualCustomerReadings(true, { routeKey }),
        ]).then(() => {
          setBulkReadings(getBulkMeterReadings());
          setIndividualReadings(getIndividualCustomerReadings());
        }).catch(e => console.warn('Readings refresh failed:', e));
      }
      setLocalLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    window.addEventListener('data-refreshed', handleDataRefreshed);

    // ── Subscriptions for real-time local updates ────────────────────────────
    const unsubInd = subscribeToIndividualCustomerReadings(() => setIndividualReadings(getIndividualCustomerReadings()));
    const unsubBulk = subscribeToBulkMeterReadings(() => setBulkReadings(getBulkMeterReadings()));
    const unsubCust = subscribeToCustomers((updated) => setAllCustomers(updated));
    // Fix: unsubBM was calling full initializeData() on every in-memory bulk meter update.
    // Now it only syncs the local state from the store — no HTTP calls.
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
    }, [routeKey]);

    const route = React.useMemo(() => {
        const found = routes.find(r => r.routeKey === routeKey);
        if (found) return found;
        // Fallback: check if bulk meters or customers have this routeKey
        const bm = allBulkMeters.find(b => b.routeKey === routeKey || (b as any).route_key === routeKey);
        if (bm) {
            return {
                routeKey,
                branchId: bm.branchId || (bm as any).branch_id,
                readerId: bm.readerStaffId || (bm as any).assignedReaderId,
                description: `Route ${routeKey}`
            };
        }
        const cust = allCustomers.find(c => c.routeKey === routeKey || (c as any).route_key === routeKey);
        if (cust) {
            return {
                routeKey,
                branchId: cust.branchId || (cust as any).branch_id,
                readerId: cust.readerStaffId || (cust as any).assignedReaderId,
                description: `Route ${routeKey}`
            };
        }
        return undefined;
    }, [routes, allBulkMeters, allCustomers, routeKey]);

    const canViewAllRoutes = 
        hasPermission('routes_view_all') || 
        hasPermission('*') || 
        hasPermission('all');

    const canViewBranchRoutes =
        hasPermission('routes_view_branch') ||
        hasPermission('routes_manage');

    const hasRouteAccess = React.useMemo(() => {
        if (!route) return false;
        if (canViewAllRoutes) return true;
        if (canViewBranchRoutes) {
            return !currentUser?.branchId || !route.branchId || route.branchId === currentUser.branchId;
        }
        // Reader access check: must be assigned to the route OR have assigned meters on this route OR belong to same branch
        if (!currentUser?.id) return false;
        const userIdRaw = currentUser.id.toLowerCase();
        const userBranchId = currentUser.branchId;
        const isRouteAssigned = route.readerId?.toLowerCase() === userIdRaw;
        const hasAssignedBulk = allBulkMeters.some(bm => (bm.routeKey === routeKey || (bm as any).route_key === routeKey) && (
            bm.readerStaffId?.toLowerCase() === userIdRaw || 
            (bm as any).assignedReaderId?.toLowerCase() === userIdRaw ||
            (bm as any).reader_staff_id?.toLowerCase() === userIdRaw ||
            (bm as any).assigned_reader_id?.toLowerCase() === userIdRaw
        ));
        const hasAssignedCustomer = allCustomers.some(c => (c.routeKey === routeKey || (c as any).route_key === routeKey) && (
            c.readerStaffId?.toLowerCase() === userIdRaw ||
            (c as any).assignedReaderId?.toLowerCase() === userIdRaw ||
            (c as any).reader_staff_id?.toLowerCase() === userIdRaw ||
            (c as any).assigned_reader_id?.toLowerCase() === userIdRaw
        ));
        const isBranchMatch = Boolean(userBranchId && route.branchId && (
            route.branchId === userBranchId || 
            route.branchId.toLowerCase() === userBranchId.toLowerCase()
        ));
        const isAssigned = isRouteAssigned || hasAssignedBulk || hasAssignedCustomer || isBranchMatch;
        const matchesBranch = !userBranchId || !route.branchId || route.branchId === userBranchId || route.branchId.toLowerCase() === userBranchId.toLowerCase();
        return isAssigned && matchesBranch;
    }, [route, currentUser, canViewAllRoutes, canViewBranchRoutes, allBulkMeters, allCustomers, routeKey]);

    const bulkMeters = React.useMemo(() => {
        return allBulkMeters.filter(bm => bm.routeKey === routeKey);
    }, [allBulkMeters, routeKey]);

    const currentMonth = React.useMemo(() => format(new Date(), 'yyyy-MM'), []);

    const readBulkMeterKeys = React.useMemo(() => {
        const readKeys = new Set<string>();
        for (const r of bulkReadings) {
            const id = r.CUSTOMERKEY || r.customerKeyNumber || r.CUST_KEY;
            if (!id) continue;
            const rDateStr = r.readingDate || r.READING_DATE || r.created_at || r.createdAt;
            if (periodStartDate) {
                if (!rDateStr) {
                    if (r.monthYear === periodStartDate.slice(0, 7)) readKeys.add(id);
                } else {
                    const formatted = typeof rDateStr === 'string' ? rDateStr.slice(0, 10) : format(new Date(rDateStr), 'yyyy-MM-dd');
                    if (periodEndDate ? (formatted >= periodStartDate && formatted <= periodEndDate) : formatted >= periodStartDate) {
                        readKeys.add(id);
                    }
                }
            } else if (r.monthYear === currentMonth) {
                readKeys.add(id);
            }
        }
        return readKeys;
    }, [bulkReadings, currentMonth, periodStartDate, periodEndDate]);

    const readIndividualMeterKeys = React.useMemo(() => {
        const readKeys = new Set<string>();
        for (const r of individualReadings) {
            const id = r.individualCustomerId || r.customerKeyNumber || r.CUST_KEY;
            if (!id) continue;
            const rDateStr = r.readingDate || r.READING_DATE || r.created_at || r.createdAt;
            if (periodStartDate) {
                if (!rDateStr) {
                    if (r.monthYear === periodStartDate.slice(0, 7)) readKeys.add(id);
                } else {
                    const formatted = typeof rDateStr === 'string' ? rDateStr.slice(0, 10) : format(new Date(rDateStr), 'yyyy-MM-dd');
                    if (periodEndDate ? (formatted >= periodStartDate && formatted <= periodEndDate) : formatted >= periodStartDate) {
                        readKeys.add(id);
                    }
                }
            } else if (r.monthYear === currentMonth) {
                readKeys.add(id);
            }
        }
        return readKeys;
    }, [individualReadings, currentMonth, periodStartDate, periodEndDate]);

    const isMeterRead = React.useCallback((meterId: string, type: 'bulk' | 'individual') => {
        if (pendingOfflineMeterKeys.has(meterId)) return true;
        return type === 'bulk' ? readBulkMeterKeys.has(meterId) : readIndividualMeterKeys.has(meterId);
    }, [pendingOfflineMeterKeys, readBulkMeterKeys, readIndividualMeterKeys]);

    const routeCustomers = React.useMemo(() => {
        const bulkIds = new Set(bulkMeters.map(bm => bm.customerKeyNumber));
        return allCustomers.filter(c => c.routeKey === routeKey || (c.assignedBulkMeterId && bulkIds.has(c.assignedBulkMeterId)));
    }, [allCustomers, routeKey, bulkMeters]);

    // Fix 5: Pre-compute distances for all bulk meters once per userLocation change.
    // Avoids calling calculateDistance twice per pair inside the sort comparator.
    const meterDistanceMap = React.useMemo(() => {
        const map = new Map<string, number>();
        if (!userLocation) return map;
        for (const bm of bulkMeters) {
            if (bm.xCoordinate && bm.yCoordinate) {
                map.set(bm.customerKeyNumber, calculateDistance(userLocation, { latitude: bm.yCoordinate, longitude: bm.xCoordinate }));
            }
        }
        return map;
    }, [bulkMeters, userLocation]);

    // Route-wide Bulk Meter count metrics (Read vs Unread)
    const routeStats = React.useMemo(() => {
        const totalMeters = bulkMeters.length;
        const totalRead = bulkMeters.filter(bm => isMeterRead(bm.customerKeyNumber, 'bulk')).length;
        const totalUnread = totalMeters - totalRead;
        const percentRead = totalMeters > 0 ? Math.round((totalRead / totalMeters) * 100) : 0;

        return {
            totalMeters,
            totalRead,
            totalUnread,
            percentRead
        };
    }, [bulkMeters, isMeterRead]);

    const filteredBulkMeters = React.useMemo(() => {
        let result = bulkMeters;
        
        // 1. Filter by Bulk Meter Status (All / Unread / Read)
        if (meterStatusFilter === 'unread') {
            result = result.filter(bm => !isMeterRead(bm.customerKeyNumber, 'bulk'));
        } else if (meterStatusFilter === 'read') {
            result = result.filter(bm => isMeterRead(bm.customerKeyNumber, 'bulk'));
        }

        // 2. Filter by search term
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(bm =>
                bm.name.toLowerCase().includes(lowSearch) ||
                bm.customerKeyNumber.toLowerCase().includes(lowSearch) ||
                bm.meterNumber?.toLowerCase().includes(lowSearch)
            );
        }

        // 3. Filter by proximity if requested
        if (nearbyOnly) {
            // Determine threshold: relax if using a cached location
            const threshold = usingCachedLocation ? 200 : PROXIMITY_THRESHOLD;
            if (!userLocation) {
                return []; // Return empty list while waiting for GPS or cached location
            }
            result = result.filter(bm => {
                if (!bm.xCoordinate || !bm.yCoordinate) return false;
                const dist = calculateDistance(userLocation, {
                    latitude: bm.yCoordinate,
                    longitude: bm.xCoordinate
                });
                return dist <= threshold;
            });
        }
        
        // 4. Sort by: Unread first, then Distance (pre-computed, O(1) lookup), then Read
        return [...result].sort((a, b) => {
            const aRead = isMeterRead(a.customerKeyNumber, 'bulk') ? 1 : 0;
            const bRead = isMeterRead(b.customerKeyNumber, 'bulk') ? 1 : 0;
            
            if (aRead !== bRead) return aRead - bRead;

            // Use pre-computed distance map — avoids calling calculateDistance twice per pair
            const distA = meterDistanceMap.get(a.customerKeyNumber) ?? Infinity;
            const distB = meterDistanceMap.get(b.customerKeyNumber) ?? Infinity;
            return distA - distB;
        });
    }, [bulkMeters, meterStatusFilter, searchTerm, isMeterRead, nearbyOnly, userLocation, meterDistanceMap]);

    const toggleExpand = (meterId: string) => {
        const newExpanded = new Set(expandedMeters);
        if (newExpanded.has(meterId)) {
            newExpanded.delete(meterId);
        } else {
            newExpanded.add(meterId);
        }
        setExpandedMeters(newExpanded);
    };

    const handleReadClick = (meter: any, type: 'bulk' | 'individual') => {
        if (periodStatus === 'Closed') {
            toast({
                title: "Access Denied",
                description: "Reading period is currently closed.",
                variant: "destructive"
            });
            return;
        }

        const canAccessReading = type === 'bulk' ? canReadBulk : canReadIndividual;
        if (!canAccessReading) {
            toast({
                title: "Access Denied",
                description: "You do not have permission to read this.",
                variant: "destructive"
            });
            return;
        }

        setSelectedMeter({
            type,
            id: meter.customerKeyNumber,
            name: meter.name,
            meterNumber: meter.meterNumber || meter.meterKey,
            lastReading: Number(meter.currentReading) || 0
        });
        setIsReadingModalOpen(true);
    };

    const handleReadingSubmit = async (values: AddMeterReadingFormValues) => {
        if (!currentUser?.id) {
            toast({ variant: "destructive", title: "Error", description: "User session not found." });
            return;
        }

        setIsSubmitting(true);
        try {
            const readingContext = {
                routeKey,
                meterKey: values.entityId,
                meterType: values.meterType,
                readerStaffId: currentUser.id,
            } as any;

            let result;
            const activeFaultCode = values.faultCode === 'none' ? undefined : values.faultCode;
            // Fault-code rule: if a fault code is active, force reading = previous (usage = 0 m³)
            const prevReading = selectedMeter?.lastReading ?? 0;
            const finalReading = activeFaultCode ? prevReading : values.reading;

            if (values.meterType === 'bulk_meter') {
                result = await addBulkMeterReading({
                    CUSTOMERKEY: values.entityId,
                    readerStaffId: currentUser.id,
                    readingValue: finalReading,
                    readingDate: format(values.date, "yyyy-MM-dd"),
                    monthYear: format(values.date, "yyyy-MM"),
                    faultCode: activeFaultCode,
                    notes: activeFaultCode ? `Fault: ${activeFaultCode}. Reading forced to previous (${prevReading}) — usage 0 m³. Reader: ${currentUser.email}` : `Reading by reader: ${currentUser.email}`,
                    capturedCoordinates: values.capturedCoordinates,
                    meter_photo: values.meterPhoto,
                    ...readingContext,
                } as any);
            } else {
                result = await addIndividualCustomerReading({
                    individualCustomerId: values.entityId,
                    readerStaffId: currentUser.id,
                    readingValue: finalReading,
                    readingDate: format(values.date, "yyyy-MM-dd"),
                    monthYear: format(values.date, "yyyy-MM"),
                    faultCode: activeFaultCode,
                    notes: activeFaultCode ? `Fault: ${activeFaultCode}. Reading forced to previous (${prevReading}) — usage 0 m³. Reader: ${currentUser.email}` : `Reading by reader: ${currentUser.email}`,
                    capturedCoordinates: values.capturedCoordinates,
                    meter_photo: values.meterPhoto,
                    ...readingContext,
                } as any);
            }

            if (result.success) {
                triggerReadingSavedHaptic();
                toast({ title: "Success", description: result.message || "Meter reading updated successfully." });
                setIsReadingModalOpen(false);
                setSelectedMeter(null);

                // Optimistically update the local readings state so the "Read" badge
                // flips immediately in the UI — both online and offline, before sync.
                const submittedReadingDate = format(values.date, 'yyyy-MM-dd');
                const submittedMonthYear = format(values.date, 'yyyy-MM');
                if (values.meterType === 'bulk_meter') {
                    setBulkReadings(prev => {
                        const already = prev.some(r => (r.CUSTOMERKEY === values.entityId || r.customerKeyNumber === values.entityId) && r.readingDate === submittedReadingDate);
                        if (already) return prev;
                        return [...prev, {
                            CUSTOMERKEY: values.entityId,
                            customerKeyNumber: values.entityId,
                            monthYear: submittedMonthYear,
                            readingDate: submittedReadingDate,
                            readingValue: values.reading
                        }];
                    });
                    // Also track as pending offline key so isMeterRead returns true immediately
                    setPendingOfflineMeterKeys(prev => new Set([...prev, values.entityId]));
                } else {
                    setIndividualReadings(prev => {
                        const already = prev.some(r => (r.individualCustomerId === values.entityId || r.customerKeyNumber === values.entityId) && r.readingDate === submittedReadingDate);
                        if (already) return prev;
                        return [...prev, {
                            individualCustomerId: values.entityId,
                            customerKeyNumber: values.entityId,
                            monthYear: submittedMonthYear,
                            readingDate: submittedReadingDate,
                            readingValue: values.reading
                        }];
                    });
                    setPendingOfflineMeterKeys(prev => new Set([...prev, values.entityId]));
                }

                // Fix 7: Removed redundant double state-sync merge.
                // The optimistic update above already flipped the badge immediately.
                // For online submissions the store will be updated by the subscription
                // (notifyBulkMeterReadingListeners / notifyIndividualCustomerReadingListeners)
                // triggered inside addBulkMeterReading / addIndividualCustomerReading.
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to submit reading." });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Precompute bulk meter -> individual customers lookup map for instant O(1) rendering performance
    const customersByBulkMeterMap = React.useMemo(() => {
        const map = new Map<string, IndividualCustomer[]>();
        for (const c of allCustomers) {
            if (!c.assignedBulkMeterId) continue;
            const existing = map.get(c.assignedBulkMeterId);
            if (existing) {
                existing.push(c);
            } else {
                map.set(c.assignedBulkMeterId, [c]);
            }
        }
        return map;
    }, [allCustomers]);

    const getCustomersForBulkMeter = React.useCallback((bulkMeterId: string) => {
        const list = customersByBulkMeterMap.get(bulkMeterId) || [];
        
        // Filter by meterStatusFilter if active
        let filtered = list;
        if (meterStatusFilter === 'unread') {
            filtered = list.filter(c => !isMeterRead(c.customerKeyNumber, 'individual'));
        } else if (meterStatusFilter === 'read') {
            filtered = list.filter(c => isMeterRead(c.customerKeyNumber, 'individual'));
        }

        return [...filtered].sort((a, b) => {
            const aRead = isMeterRead(a.customerKeyNumber, 'individual') ? 1 : 0;
            const bRead = isMeterRead(b.customerKeyNumber, 'individual') ? 1 : 0;
            return aRead - bRead;
        });
    }, [customersByBulkMeterMap, meterStatusFilter, isMeterRead]);

    const [isCachingOffline, setIsCachingOffline] = React.useState(false);

    const handleDownloadOfflinePackage = async () => {
        setIsCachingOffline(true);
        try {
            const allReadings = [...bulkReadings, ...individualReadings];
            const result = await cacheRoutePackage(routeKey, bulkMeters, routeCustomers, allReadings);
            toast({
                title: "⚡ Route Package Saved Offline",
                description: `Cached route ${routeKey} (${result.bulkMetersCount} bulk meters, ${result.readingsCount} historical readings) for 100% offline field reading.`,
            });
        } catch (e: any) {
            toast({
                title: "Pre-cache Error",
                description: e.message || "Failed to cache route package offline.",
                variant: "destructive"
            });
        } finally {
            setIsCachingOffline(false);
        }
    };

    const formatDistance = (meter: { xCoordinate?: number, yCoordinate?: number }) => {
        if (!userLocation || !meter.xCoordinate || !meter.yCoordinate) return null;
        const dist = calculateDistance(userLocation, { 
            latitude: meter.yCoordinate, 
            longitude: meter.xCoordinate 
        });
        
        if (dist < 1000) {
            return `${Math.round(dist)}m`;
        }
        return `${(dist / 1000).toFixed(1)}km`;
    };

    if (isLoading && !route) {
        // Skeleton card loader — gives structure even on slow connections
        return (
            <div className="p-6 space-y-5">
                {/* Network quality hint while loading */}
                {effectiveQuality !== 'strong' && (
                    <div className={`flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2.5 border ${
                        effectiveQuality === 'offline'
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                        <WifiOff className="h-4 w-4 flex-shrink-0" />
                        <span>{effectiveQuality === 'offline'
                            ? 'No connection — loading from cached data…'
                            : 'Slow connection detected — loading cached data…'}
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-slate-200 animate-pulse rounded-full" />
                    <div className="h-7 w-48 bg-slate-200 animate-pulse rounded-lg" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1,2,3].map(i => (
                        <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
                    ))}
                </div>
                <div className="h-12 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
                <div className="space-y-3">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
                    ))}
                </div>
                <p className="text-center text-xs text-slate-400">{syncProgress || 'Loading route data…'}</p>
            </div>
        );
    }

    if (!route || !hasRouteAccess) {
        return (
            <div className="p-12 text-center max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
                    <Lock className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xl font-bold text-slate-900">Access Restricted</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {!route 
                            ? "Route not found in the system." 
                            : "You only have permission to access routes assigned to you within your branch."
                        }
                    </p>
                </div>
                <Button asChild variant="outline" className="border-slate-300">
                    <Link href="/staff/my-routes">Back to My Routes</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className={cn("p-6 space-y-6", sunlightMode && "bg-white text-black [&_*]:!border-black/20")}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/staff/my-routes">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-bold">Route: {route.routeKey}</h1>
                                {/* Network quality badge */}
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
                                <button
                                    onClick={() => triggerRefresh()}
                                    title="Refresh data now"
                                    disabled={effectiveQuality === 'offline'}
                                    className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Clock className={`h-2.5 w-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    {isRefreshing ? 'Refreshing…' : localLastUpdated ? `Updated ${localLastUpdated}` : (effectiveQuality === 'offline' ? 'Cached' : 'Live Data')}
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground">{route.description || "Reading assignment"}</p>
                        </div>
                    </div>

                    {/* Sunlight Mode toggle */}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={toggleSunlightMode}
                        title={sunlightMode ? 'Disable sunlight mode' : 'Enable high-contrast sunlight mode for field reading'}
                        className={cn(
                            "font-bold text-xs shadow-sm h-9 flex items-center gap-1.5 transition-all",
                            sunlightMode
                                ? "bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <Sun className="h-3.5 w-3.5" />
                        {sunlightMode ? 'Sunlight ON' : '☀️'}
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadOfflinePackage}
                        disabled={isCachingOffline || !isOnline}
                        title={!isOnline ? 'Cannot cache while offline' : effectiveQuality === 'weak' ? 'Tap to save all route data for offline use — recommended on slow connections' : 'Pre-cache all route data for offline use'}
                        className={`font-bold text-xs shadow-sm h-9 flex items-center gap-1.5 transition-all ${
                            effectiveQuality === 'weak' && isOnline
                                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 ring-2 ring-amber-300 ring-offset-1 animate-pulse'
                                : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                        }`}
                    >
                        {isCachingOffline ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
                        {isCachingOffline ? "Caching..." : effectiveQuality === 'weak' && isOnline ? "Save Offline Now!" : "Pre-cache for Offline"}
                    </Button>
                </div>
            {/* ─── Network Quality Banner ─────────────────────────────────── */}
            {effectiveQuality === 'offline' && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
                    <WifiOff className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
                    <div>
                        <p className="font-bold">No Connection — Offline Mode</p>
                        <p className="text-xs mt-0.5 text-red-700">You are working from cached data. Readings are saved locally and will sync automatically when you reconnect.</p>
                        {offlineQueueState.pending > 0 && (
                            <p className="text-xs mt-1 font-semibold text-red-800">📤 {offlineQueueState.pending} reading{offlineQueueState.pending !== 1 ? 's' : ''} waiting to sync</p>
                        )}
                    </div>
                </div>
            )}
            {effectiveQuality === 'weak' && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" />
                    <div>
                        <p className="font-bold">Slow Connection Detected</p>
                        <p className="text-xs mt-0.5 text-amber-700">Readings are saved instantly on your device. Tap <strong>"Save Offline Now!"</strong> to download the full route package so you can read meters without any connection.</p>
                        {offlineQueueState.pending > 0 && (
                            <p className="text-xs mt-1 font-semibold text-amber-800">📤 {offlineQueueState.pending} reading{offlineQueueState.pending !== 1 ? 's' : ''} queued for sync</p>
                        )}
                    </div>
                </div>
            )}
            {/* ─── Route Reading Progress Summary Cards (Bulk Meters Only) ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Bulk Meters</p>
                            <h3 className="text-2xl font-black text-slate-900 mt-1">{routeStats.totalMeters}</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Assigned in route {route.routeKey}
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                            <Gauge className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-50/40 border-emerald-200 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Read Bulk Meters</p>
                            <h3 className="text-2xl font-black text-emerald-900 mt-1">{routeStats.totalRead}</h3>
                            <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
                                {routeStats.percentRead}% Complete
                            </p>
                        </div>
                        <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-amber-50/40 border-amber-200 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Unread Bulk Meters</p>
                            <h3 className="text-2xl font-black text-amber-900 mt-1">{routeStats.totalUnread}</h3>
                            <p className="text-[11px] font-bold text-amber-700 mt-0.5">
                                {100 - routeStats.percentRead}% Remaining
                            </p>
                        </div>
                        <div className="p-3 bg-amber-100 text-amber-700 rounded-xl border border-amber-200">
                            <Clock className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Route Overall Progress Bar ─── */}
            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">Bulk Meters Reading Completion</span>
                    <span className="text-emerald-700 font-mono">{routeStats.totalRead} of {routeStats.totalMeters} Bulk Meters Read ({routeStats.percentRead}%)</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 flex">
                    <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-500" 
                        style={{ width: `${routeStats.percentRead}%` }} 
                    />
                    <div 
                        className="h-full bg-amber-400/80 transition-all duration-500" 
                        style={{ width: `${100 - routeStats.percentRead}%` }} 
                    />
                </div>
            </div>

            {/* ─── Read / Unread Status Filter Tabs & Search Controls ─── */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/80 p-2 border border-slate-200 rounded-xl">
                {/* Status Segmented Buttons */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <Button
                        type="button"
                        variant={meterStatusFilter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setMeterStatusFilter('all')}
                        className={`h-8 px-3 text-xs font-bold ${
                            meterStatusFilter === 'all' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'
                        }`}
                    >
                        All ({routeStats.totalMeters})
                    </Button>

                    <Button
                        type="button"
                        variant={meterStatusFilter === 'unread' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setMeterStatusFilter('unread')}
                        className={`h-8 px-3 text-xs font-bold flex items-center gap-1.5 ${
                            meterStatusFilter === 'unread' 
                                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm' 
                                : 'text-amber-700 hover:bg-amber-50'
                        }`}
                    >
                        <Clock className="h-3.5 w-3.5" />
                        Unread ({routeStats.totalUnread})
                    </Button>

                    <Button
                        type="button"
                        variant={meterStatusFilter === 'read' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setMeterStatusFilter('read')}
                        className={`h-8 px-3 text-xs font-bold flex items-center gap-1.5 ${
                            meterStatusFilter === 'read' 
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' 
                                : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Read ({routeStats.totalRead})
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative w-full sm:w-60">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="find-meter-search"
                            name="find-meter-search"
                            placeholder="Find meter..."
                            className="pl-8 h-9 text-xs w-full bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm self-start sm:self-auto shrink-0">
                        <Button 
                            variant={nearbyOnly ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className={`h-7 text-xs px-2.5 ${nearbyOnly ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}`}
                            onClick={() => setNearbyOnly(!nearbyOnly)}
                        >
                            <MapPin className={`h-3.5 w-3.5 mr-1 ${nearbyOnly ? 'fill-current' : ''}`} /> Nearby
                        </Button>
                        <div className="w-px h-4 bg-slate-200 mx-1" />
                        <Button 
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-7 text-xs px-2.5"
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-3.5 w-3.5 mr-1" /> List
                        </Button>
                        <Button 
                            variant={viewMode === 'map' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-7 text-xs px-2.5"
                            onClick={() => setViewMode('map')}
                        >
                            <MapIcon className="h-3.5 w-3.5 mr-1" /> Map
                        </Button>
                    </div>
                </div>
            </div>
            </div>

            {viewMode === 'map' ? (
                <div className="mt-2 animate-in fade-in duration-300">
                    <RouteMap 
                        bulkMeters={filteredBulkMeters} 
                        getCustomersForBulkMeter={getCustomersForBulkMeter}
                        isMeterRead={isMeterRead}
                        onReadClick={handleReadClick}
                        userLocation={userLocation}
                        pathHistory={pathHistory}
                        canReadBulk={canReadBulk}
                    />
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {filteredBulkMeters.length === 0 ? (
                        <div className="p-12 text-center border-dashed border-2 rounded-lg bg-slate-50/50">
                            {nearbyOnly && !userLocation ? (
                                locationError ? (
                                    <>
                                        <MapPin className="mx-auto h-12 w-12 text-amber-500 opacity-50 mb-4" />
                                        <p className="font-medium text-amber-600">
                                            {locationError === "Permission denied" ? "Location Access Denied" : `GPS Signal Issue: ${locationError}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-2 px-6 max-w-sm mx-auto">
                                            {locationError === "Permission denied" 
                                                ? "We couldn't get your location because permission was denied. Please allow location access in your browser settings to use the nearby filter."
                                                : "We couldn't get a reliable GPS signal. Please turn off the nearby filter to see all meters."}
                                        </p>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="mt-4"
                                            onClick={() => setNearbyOnly(false)}
                                        >
                                            Turn off Nearby Filter
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Loader2 className="mx-auto h-12 w-12 text-blue-400 animate-spin mb-4" />
                                        <p className="font-medium text-blue-800">Waiting for GPS signal...</p>
                                        <p className="text-xs text-muted-foreground mt-2 px-6">
                                            Proximity filter is ON. Looking for your location to show nearby meters. 
                                            You can turn off &quot;Nearby&quot; to see all meters.
                                        </p>
                                    </>
                                )
                            ) : (
                                <>
                                    <Gauge className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                                    <p className="font-medium">{nearbyOnly ? "No meters within 50m." : "No meters match your search."}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Try disabling the filter or moving closer to the meters.</p>
                                </>
                            )}
                        </div>
                ) : (
                    filteredBulkMeters.map(bm => {
                        const customers = getCustomersForBulkMeter(bm.customerKeyNumber);
                        const isExpanded = expandedMeters.has(bm.customerKeyNumber);

                        return (
                            <div key={bm.customerKeyNumber} className="overflow-hidden border rounded-lg bg-white shadow-sm hover:border-blue-300 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-blue-50/30 gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-white rounded-md border border-blue-100 shadow-sm">
                                            <Gauge className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-lg">{bm.name}</h3>
                                                <Badge variant="outline" className="font-mono text-[10px] uppercase">Bulk</Badge>
                                                {isMeterRead(bm.customerKeyNumber, 'bulk') ? (
                                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 shadow-sm flex items-center gap-1 h-5 px-1.5 rounded-sm">
                                                        <CheckCircle2 className="h-3 w-3" /> Read
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300 shadow-sm flex items-center gap-1 h-5 px-1.5 rounded-sm">
                                                        <Clock className="h-3 w-3" /> Pending Read
                                                    </Badge>
                                                )}

                                                {/* Fix 4: Sub-customer badge uses O(1) Map lookup instead of O(N) allCustomers.filter() */}
                                                {(() => {
                                                    const rawSubs = customersByBulkMeterMap.get(bm.customerKeyNumber) || [];
                                                    if (rawSubs.length === 0) return null;
                                                    const subReadCount = rawSubs.filter((c: IndividualCustomer) => isMeterRead(c.customerKeyNumber, 'individual')).length;
                                                    return (
                                                        <Badge variant="outline" className="text-[10px] font-bold bg-white text-slate-700 border-slate-300">
                                                            {subReadCount}/{rawSubs.length} Ind. Read
                                                        </Badge>
                                                    );
                                                })()}
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1"><span className="font-semibold text-xs uppercase tracking-wider opacity-60">ID:</span> {bm.customerKeyNumber}</span>
                                                <span className="flex items-center gap-1"><span className="font-semibold text-xs uppercase tracking-wider opacity-60">Meter:</span> {bm.meterNumber || "N/A"}</span>
                                                {formatDistance(bm) && (
                                                    <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                        <MapPin className="h-3 w-3" /> {formatDistance(bm)} away
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            className={`text-xs font-bold shadow-md transition-all rounded-full h-8 px-4 ${
                                                !canReadBulk
                                                    ? 'bg-slate-200 text-slate-500 border border-slate-300 opacity-60 cursor-not-allowed'
                                                    : isMeterRead(bm.customerKeyNumber, 'bulk')
                                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                            onClick={() => handleReadClick(bm, 'bulk')}
                                            disabled={periodStatus === 'Closed' || !canReadBulk}
                                            title={!canReadBulk ? 'Permission required: Meter Readings Create Bulk' : undefined}
                                        >
                                            {!canReadBulk ? (
                                                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Locked</span>
                                            ) : periodStatus === 'Closed' ? (
                                                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Locked</span>
                                            ) : isMeterRead(bm.customerKeyNumber, 'bulk') ? (
                                                'Update'
                                            ) : (
                                                'Read Meter'
                                            )}
                                        </Button>
                                        {customers.length > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleExpand(bm.customerKeyNumber)}
                                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-bold text-xs"
                                            >
                                                {customers.length} Individual {isExpanded ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronRight className="ml-1 h-4 w-4" />}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {isExpanded && customers.length > 0 && (
                                    <div className="border-t border-blue-100">
                                        <div className="divide-y divide-blue-50">
                                            {customers.map((c: IndividualCustomer) => (
                                                <div key={c.customerKeyNumber} className="flex items-center justify-between p-4 pl-12 hover:bg-blue-50/20 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-medium">{c.name}</h4>
                                                                <Badge variant="outline" className="text-[9px] h-4 bg-white">Individual</Badge>
                                                                {isMeterRead(c.customerKeyNumber, 'individual') && (
                                                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none shadow-sm flex items-center gap-1 h-4 px-1 rounded-sm text-[9px]">
                                                                        <CheckCircle2 className="h-2.5 w-2.5" /> Read
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                                <span>{c.customerKeyNumber}</span>
                                                                <span>•</span>
                                                                <span>{c.meterNumber || "No Meter #"}</span>
                                                                {formatDistance(c) && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="text-blue-500 font-medium flex items-center gap-0.5">
                                                                            <MapPin className="h-2.5 w-2.5" /> {formatDistance(c)}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        className={`text-[10px] h-7 px-3 font-bold rounded-full shadow-sm ${
                                                            !canReadIndividual
                                                                ? 'bg-slate-200 text-slate-500 border border-slate-300 opacity-60 cursor-not-allowed'
                                                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                        }`}
                                                        onClick={() => handleReadClick(c, 'individual')}
                                                        disabled={periodStatus === 'Closed' || !canReadIndividual}
                                                        title={!canReadIndividual ? 'Permission required: Meter Readings Create Individual' : undefined}
                                                    >
                                                        {!canReadIndividual ? (
                                                            <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Locked</span>
                                                        ) : periodStatus === 'Closed' ? (
                                                            <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Locked</span>
                                                        ) : isMeterRead(c.customerKeyNumber, 'individual') ? (
                                                            'Update'
                                                        ) : (
                                                            'Read'
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            )}

            <Dialog open={isReadingModalOpen} onOpenChange={setIsReadingModalOpen}>
                <DialogContent className="w-[95vw] max-w-[480px] max-h-[90vh] overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                    <DialogHeader>
                        <UIDialogTitle>Meter Reading: {selectedMeter?.name}</UIDialogTitle>
                        <DialogDescription>
                            Enter the new reading for {selectedMeter?.type === 'bulk' ? 'bulk meter' : 'individual customer'} <span className="font-mono font-bold text-blue-600">{selectedMeter?.id}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedMeter && (
                        <div className="mt-4">
                            <AddMeterReadingForm
                                onSubmit={handleReadingSubmit}
                                customers={selectedMeter.type === 'individual' ? [allCustomers.find(c => c.customerKeyNumber === selectedMeter.id)!] : []}
                                bulkMeters={selectedMeter.type === 'bulk' ? [allBulkMeters.find(bm => bm.customerKeyNumber === selectedMeter.id)!] : []}
                                faultCodes={faultCodesForForm}
                                isLoading={isSubmitting}
                                initialLocation={userLocation}
                                sunlightMode={sunlightMode}
                                defaultValues={{
                                    meterType: selectedMeter.type === 'bulk' ? 'bulk_meter' : 'individual_customer_meter',
                                    entityId: selectedMeter.id,
                                    date: new Date()
                                }}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
