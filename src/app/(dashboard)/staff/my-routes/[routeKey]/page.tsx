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
    fetchRoutes as dbFetchRoutes
} from "@/lib/data-store";
import { getReadingPeriodStatusAction } from "@/lib/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, Gauge, ClipboardList, Loader2, User, ChevronRight, ChevronDown, CheckCircle2, Map as MapIcon, List } from "lucide-react";
import Link from "next/link";
import { AddMeterReadingForm, type AddMeterReadingFormValues } from "@/components/billing/add-meter-reading-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle as UIDialogTitle } from "@/components/ui/dialog";
import { RouteMap } from "@/components/billing/route-map";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { FaultCodeRow } from "@/lib/actions";
import { type Coordinates, calculateDistance } from "@/lib/geo-utils";
import { MapPin } from "lucide-react";

export default function RouteDetailsPage() {
    const params = useParams();
    const routeKey = params?.routeKey as string;
    const router = useRouter();
    const { toast } = useToast();
    const { currentUser } = useCurrentUser();

    const routes = useRoutes();
    const allBulkMeters = useBulkMeters();
    const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
    const [faultCodesForForm, setFaultCodesForForm] = React.useState<FaultCodeRow[]>([]);
    const [bulkReadings, setBulkReadings] = React.useState<any[]>([]);
    const [individualReadings, setIndividualReadings] = React.useState<any[]>([]);

    const [isLoading, setIsLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [viewMode, setViewMode] = React.useState<'list' | 'map'>('list');
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
    const [pathHistory, setPathHistory] = React.useState<Coordinates[]>([]);
    const [readingPeriodStatus, setReadingPeriodStatus] = React.useState<'Open' | 'Closed'>('Open');

    React.useEffect(() => {
        if (!navigator.geolocation) return;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const newCoords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                setUserLocation(newCoords);
                
                // Update path history if the user has moved more than 5 meters
                setPathHistory(prev => {
                    if (prev.length === 0) return [newCoords];
                    const lastCoord = prev[prev.length - 1];
                    const dist = calculateDistance(lastCoord, newCoords);
                    if (dist > 5) { // 5 meters threshold to avoid GPS noise jitter
                        return [...prev, newCoords];
                    }
                    return prev;
                });
            },
            (error) => {
                console.error("Geolocation error:", error);
            },
            { enableHighAccuracy: true, maximumAge: 10000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchRoutes(),
                initializeBulkMeters(true),
                initializeCustomers(true),
                initializeFaultCodes(true),
                initializeBulkMeterReadings(true),
                initializeIndividualCustomerReadings(true)
            ]);
            setAllCustomers(getCustomers());
            setFaultCodesForForm(getFaultCodes());
            setBulkReadings(getBulkMeterReadings());
            setIndividualReadings(getIndividualCustomerReadings());
            setIsLoading(false);
        };
        load();
    }, []);

    const route = React.useMemo(() =>
        routes.find(r => r.routeKey === routeKey),
        [routes, routeKey]);

    const bulkMeters = React.useMemo(() => {
        return allBulkMeters.filter(bm => bm.routeKey === routeKey);
    }, [allBulkMeters, routeKey]);

    const currentMonth = React.useMemo(() => format(new Date(), 'yyyy-MM'), []);

    const isMeterRead = React.useCallback((meterId: string, type: 'bulk' | 'individual') => {
        if (type === 'bulk') {
            return bulkReadings.some(r => r.CUSTOMERKEY === meterId && r.monthYear === currentMonth);
        } else {
            return individualReadings.some(r => r.individualCustomerId === meterId && r.monthYear === currentMonth);
        }
    }, [bulkReadings, individualReadings, currentMonth]);

    const filteredBulkMeters = React.useMemo(() => {
        let result = bulkMeters;
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(bm =>
                bm.name.toLowerCase().includes(lowSearch) ||
                bm.customerKeyNumber.toLowerCase().includes(lowSearch) ||
                bm.meterNumber?.toLowerCase().includes(lowSearch)
            );
        }
        
        return [...result].sort((a, b) => {
            const aRead = isMeterRead(a.customerKeyNumber, 'bulk') ? 1 : 0;
            const bRead = isMeterRead(b.customerKeyNumber, 'bulk') ? 1 : 0;
            return aRead - bRead;
        });
    }, [bulkMeters, searchTerm, isMeterRead]);

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
        if (readingPeriodStatus === 'Closed') {
            toast({
                title: "Access Denied",
                description: "Reading period is currently closed.",
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

        setIsLoading(true);
        try {
            let result;
            if (values.meterType === 'bulk_meter') {
                result = await addBulkMeterReading({
                    CUSTOMERKEY: values.entityId,
                    readerStaffId: currentUser.id,
                    readingValue: values.reading,
                    readingDate: format(values.date, "yyyy-MM-dd"),
                    monthYear: format(values.date, "yyyy-MM"),
                    faultCode: values.faultCode === 'none' ? undefined : values.faultCode,
                    notes: values.faultCode && values.faultCode !== 'none' ? `Fault: ${values.faultCode}. Reader: ${currentUser.email}` : `Reading by reader: ${currentUser.email}`
                });
            } else {
                result = await addIndividualCustomerReading({
                    individualCustomerId: values.entityId,
                    readerStaffId: currentUser.id,
                    readingValue: values.reading,
                    readingDate: format(values.date, "yyyy-MM-dd"),
                    monthYear: format(values.date, "yyyy-MM"),
                    faultCode: values.faultCode === 'none' ? undefined : values.faultCode,
                    notes: values.faultCode && values.faultCode !== 'none' ? `Fault: ${values.faultCode}. Reader: ${currentUser.email}` : `Reading by reader: ${currentUser.email}`
                });
            }

            if (result.success) {
                toast({ title: "Success", description: "Meter reading updated successfully." });
                setIsReadingModalOpen(false);
                setSelectedMeter(null);
                // Refresh data
                setAllCustomers(getCustomers());
                setBulkReadings(getBulkMeterReadings());
                setIndividualReadings(getIndividualCustomerReadings());
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to submit reading." });
        } finally {
            setIsLoading(false);
        }
    };

    const getCustomersForBulkMeter = (bulkMeterId: string) => {
        return allCustomers.filter((c: IndividualCustomer) => c.assignedBulkMeterId === bulkMeterId).sort((a, b) => {
            const aRead = isMeterRead(a.customerKeyNumber, 'individual') ? 1 : 0;
            const bRead = isMeterRead(b.customerKeyNumber, 'individual') ? 1 : 0;
            return aRead - bRead;
        });
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
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-muted-foreground">Loading route details...</p>
            </div>
        );
    }

    if (!route) {
        return (
            <div className="p-12 text-center">
                <p className="text-xl font-semibold">Route not found.</p>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/staff/my-routes">Back to My Routes</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/staff/my-routes">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">Route: {route.routeKey}</h1>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <p className="text-muted-foreground">{route.description || "Reading assignment"}</p>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Find meter..."
                                className="pl-8 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center bg-slate-100 p-1 rounded-md self-start sm:self-auto shrink-0">
                            <Button 
                                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className="h-8 px-3"
                                onClick={() => setViewMode('list')}
                            >
                                <List className="h-4 w-4 mr-1.5" /> List
                            </Button>
                            <Button 
                                variant={viewMode === 'map' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className="h-8 px-3"
                                onClick={() => setViewMode('map')}
                            >
                                <MapIcon className="h-4 w-4 mr-1.5" /> Map
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
                    />
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {filteredBulkMeters.length === 0 ? (
                        <div className="p-12 text-center border-dashed border-2 rounded-lg">
                            <Gauge className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                            <p>No meters match your search in this route.</p>
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
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-lg">{bm.name}</h3>
                                                <Badge variant="outline" className="font-mono text-[10px] uppercase">Bulk</Badge>
                                                {isMeterRead(bm.customerKeyNumber, 'bulk') && (
                                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none shadow-sm flex items-center gap-1 h-5 px-1.5 rounded-sm">
                                                        <CheckCircle2 className="h-3 w-3" /> Read
                                                    </Badge>
                                                )}
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
                                            className="text-xs font-bold bg-blue-600 hover:bg-blue-700 shadow-md transition-all rounded-full h-8 px-4"
                                            onClick={() => handleReadClick(bm, 'bulk')}
                                            disabled={readingPeriodStatus === 'Closed'}
                                        >
                                            {readingPeriodStatus === 'Closed' ? 'Locked' : (isMeterRead(bm.customerKeyNumber, 'bulk') ? 'Update' : 'Read Meter')}
                                        </Button>
                                        {customers.length > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleExpand(bm.customerKeyNumber)}
                                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
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
                                                        className="text-[10px] h-7 px-3 bg-blue-600 hover:bg-blue-700 font-bold rounded-full shadow-sm"
                                                        onClick={() => handleReadClick(c, 'individual')}
                                                        disabled={readingPeriodStatus === 'Closed'}
                                                    >
                                                        {readingPeriodStatus === 'Closed' ? 'Locked' : (isMeterRead(c.customerKeyNumber, 'individual') ? 'Update' : 'Read')}
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
                <DialogContent className="sm:max-w-[480px]">
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
                                isLoading={isLoading}
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
