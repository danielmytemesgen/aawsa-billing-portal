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
    initializeFaultCodes
} from "@/lib/data-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, Gauge, ClipboardList, Loader2, User, ChevronRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { AddMeterReadingForm, type AddMeterReadingFormValues } from "@/components/add-meter-reading-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle as UIDialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import type { FaultCodeRow } from "@/lib/actions";

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

    const [isLoading, setIsLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [isReadingModalOpen, setIsReadingModalOpen] = React.useState(false);
    const [selectedMeter, setSelectedMeter] = React.useState<{
        type: 'bulk' | 'individual',
        id: string,
        name: string,
        meterNumber?: string,
        lastReading: number
    } | null>(null);

    const [expandedMeters, setExpandedMeters] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchRoutes(),
                initializeBulkMeters(true),
                initializeCustomers(true),
                initializeFaultCodes(true)
            ]);
            setAllCustomers(getCustomers());
            setFaultCodesForForm(getFaultCodes());
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

    const filteredBulkMeters = React.useMemo(() => {
        if (!searchTerm) return bulkMeters;
        const lowSearch = searchTerm.toLowerCase();
        return bulkMeters.filter(bm =>
            bm.name.toLowerCase().includes(lowSearch) ||
            bm.customerKeyNumber.toLowerCase().includes(lowSearch) ||
            bm.meterNumber?.toLowerCase().includes(lowSearch)
        );
    }, [bulkMeters, searchTerm]);

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
        setSelectedMeter({
            type,
            id: meter.customerKeyNumber,
            name: meter.name,
            meterNumber: meter.meterNumber,
            lastReading: meter.currentReading || 0
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
        return allCustomers.filter((c: IndividualCustomer) => c.assignedBulkMeterId === bulkMeterId);
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
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Find meter..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {filteredBulkMeters.length === 0 ? (
                    <Card className="p-12 text-center border-dashed">
                        <Gauge className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                        <CardDescription>No meters match your search in this route.</CardDescription>
                    </Card>
                ) : (
                    filteredBulkMeters.map(bm => {
                        const customers = getCustomersForBulkMeter(bm.customerKeyNumber);
                        const isExpanded = expandedMeters.has(bm.customerKeyNumber);

                        return (
                            <Card key={bm.customerKeyNumber} className="overflow-hidden border-blue-100 shadow-sm hover:border-blue-300 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-blue-50/30 gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-white rounded-md border border-blue-100 shadow-sm">
                                            <Gauge className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-lg">{bm.name}</h3>
                                                <Badge variant="outline" className="font-mono text-[10px] uppercase">Bulk</Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1"><span className="font-semibold text-xs uppercase tracking-wider opacity-60">ID:</span> {bm.customerKeyNumber}</span>
                                                <span className="flex items-center gap-1"><span className="font-semibold text-xs uppercase tracking-wider opacity-60">Meter:</span> {bm.meterNumber || "N/A"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700"
                                            onClick={() => handleReadClick(bm, 'bulk')}
                                        >
                                            <ClipboardList className="mr-2 h-4 w-4" /> Read Meter
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
                                    <CardContent className="p-0 border-t border-blue-100">
                                        <div className="divide-y divide-blue-50">
                                            {customers.map((c: IndividualCustomer) => (
                                                <div key={c.customerKeyNumber} className="flex items-center justify-between p-4 pl-12 hover:bg-blue-50/20 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-medium">{c.name}</h4>
                                                                <Badge variant="outline" className="text-[9px] h-4 bg-white">Individual</Badge>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground space-x-2">
                                                                <span>{c.customerKeyNumber}</span>
                                                                <span>•</span>
                                                                <span>{c.meterNumber || "No Meter #"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                                        onClick={() => handleReadClick(c, 'individual')}
                                                    >
                                                        Read
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })
                )}
            </div>

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
