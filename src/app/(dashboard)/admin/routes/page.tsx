
"use client";

import * as React from "react";
import { PlusCircle, MapPin, Search, Users, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { RouteTable } from "./route-table";
import { RouteFormDialog, type RouteFormValues } from "./route-form-dialog";
import {
    useRoutes,
    useBulkMeters,
    createRoute,
    updateRoute,
    deleteRoute,
    fetchRoutes
} from "@/lib/data-store";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { type Route } from "../bulk-meters/bulk-meter-types";

export default function RoutesPage() {
    const { hasPermission } = usePermissions();
    const { toast } = useToast();
    const routes = useRoutes();
    const allBulkMeters = useBulkMeters();
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [selectedRoute, setSelectedRoute] = React.useState<Route | null>(null);
    const [routeToDelete, setRouteToDelete] = React.useState<Route | null>(null);
    const [user, setUser] = React.useState<any>(null);

    React.useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const userBranchId = user?.branchId;
    const isHeadOffice = !userBranchId || user?.role?.toLowerCase().includes("head office") || hasPermission('routes_view_all');

    const canView = hasPermission('routes_view') || hasPermission('routes_view_all');
    const canCreate = hasPermission('routes_create');
    const canUpdate = hasPermission('routes_update');
    const canDelete = hasPermission('routes_delete');
    const canManage = canView; // base access gating

    React.useEffect(() => {
        setIsLoading(true);
        Promise.all([
            fetchRoutes(),
            import("@/lib/data-store").then(mod => mod.initializeBulkMeters(true)),
            import("@/lib/data-store").then(mod => mod.initializeStaffMembers(true))
        ]).then(() => {
            setIsLoading(false);
        });
    }, [fetchRoutes]);

    const handleAddRoute = () => {
        if (!canCreate) return;
        // Pre-fill branch for branch managers
        setSelectedRoute(isHeadOffice ? null : { branchId: userBranchId } as any);
        setIsFormOpen(true);
    };


    const handleEditRoute = (route: Route) => {
        if (!canUpdate) return;
        setSelectedRoute(route);
        setIsFormOpen(true);
    };

    const handleDeleteRoute = (route: Route) => {
        if (!canDelete) return;
        setRouteToDelete(route);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (routeToDelete) {
            const result = await deleteRoute(routeToDelete.routeKey);
            if (result.success) {
                toast({ title: "Route Deleted", description: `Route ${routeToDelete.routeKey} has been removed.` });
            } else {
                toast({ variant: 'destructive', title: "Delete Failed", description: result.message });
            }
            setRouteToDelete(null);
        }
        setIsDeleteDialogOpen(false);
    };

    const handleSubmitRoute = async (values: RouteFormValues) => {
        try {
            if (selectedRoute && (selectedRoute as any).routeKey) {
                const result = await updateRoute(selectedRoute.routeKey, {
                    newRouteKey: values.routeKey !== selectedRoute.routeKey ? values.routeKey : undefined,
                    branchId: values.branchId || null,
                    readerId: values.readerId || null,
                    description: values.description || null,
                });
                if (result.success) {
                    toast({ title: "Route Updated", description: `Route ${selectedRoute.routeKey} has been updated.` });
                } else {
                    toast({ variant: 'destructive', title: "Update Failed", description: result.message });
                }
            } else {
                const result = await createRoute(
                    values.routeKey,
                    values.branchId || undefined,
                    values.readerId || undefined,
                    values.description || undefined
                );
                if (result.success) {
                    toast({ title: "Route Added", description: `Route ${values.routeKey} has been added.` });
                } else {
                    toast({ variant: 'destructive', title: "Add Failed", description: result.message });
                }
            }
        } catch (e) {
            toast({ variant: 'destructive', title: "Error", description: "An unexpected error occurred." });
        }
        setIsFormOpen(false);
        setSelectedRoute(null);
    };

    const filteredRoutes = routes.filter((route: Route) => {
        const matchesSearch = route.routeKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (route.description && route.description.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesBranch = isHeadOffice || route.branchId === userBranchId;
        
        return matchesSearch && matchesBranch;
    });


    if (!canManage) {
        return (
            <div className="p-6 space-y-6">
                <h1 className="text-2xl md:text-3xl font-bold">Route Management</h1>
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <CardDescription>You do not have permission to manage routes. Please contact your administrator.</CardDescription>
                </Alert>
            </div>
        );
    }

    const totalRoutes = filteredRoutes.length;
    const routesWithReaders = filteredRoutes.filter((r: Route) => !!r.readerId).length;
    const totalMetersOnRoutes = filteredRoutes.reduce((acc: number, route: Route) => {
        return acc + allBulkMeters.filter((bm: any) => bm.routeKey === route.routeKey).length;
    }, 0);

    if (!canManage) {
        return (
            <div className="p-6 space-y-6 min-h-[calc(100vh-80px)] bg-slate-50/50">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Route Management</h1>
                    <p className="text-slate-500">System infrastructure and geographic organization.</p>
                </div>
                <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900 rounded-2xl shadow-sm">
                    <Lock className="h-5 w-5" />
                    <AlertTitle className="font-bold">Access Denied</AlertTitle>
                    <CardDescription className="text-red-700/80">You do not have administrative permissions to manage routes. Please contact Head Office for access.</CardDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 min-h-[calc(100vh-80px)] bg-slate-50/30">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Route Management</h1>
                    <p className="text-slate-500 font-medium">Define geographic reading zones and assign personnel.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative w-full sm:w-[300px] group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            type="search"
                            placeholder="Search route key or description..."
                            className="pl-10 h-11 border-slate-200 bg-white shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {canCreate && (
                    <Button 
                        onClick={handleAddRoute} 
                        className="w-full sm:w-auto h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95 font-bold gap-2"
                    >
                        <PlusCircle className="h-4 w-4" /> Add New Route
                    </Button>
                    )}
                </div>
            </div>

            {/* Statistics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-none shadow-sm bg-white/80 backdrop-blur-sm rounded-2xl">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                                <MapPin className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-slate-900">{totalRoutes}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Routes</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border-none shadow-sm bg-white/80 backdrop-blur-sm rounded-2xl">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Users className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-slate-900">{routesWithReaders}</span>
                                    <span className="text-xs font-bold text-slate-400">/ {totalRoutes}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Staff Assigned</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white/80 backdrop-blur-sm rounded-2xl">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-slate-900">{totalMetersOnRoutes}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Meters Covered</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <Card className="shadow-xl shadow-slate-200/50 border-none bg-white/40 backdrop-blur-md rounded-3xl overflow-hidden">
                <CardHeader className="p-8 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold text-slate-900">Detailed View</CardTitle>
                            <CardDescription className="font-medium">Managing route permissions and geographic organization.</CardDescription>
                        </div>
                        {isHeadOffice ? (
                             <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">Global Visibility</Badge>
                        ) : (
                             <Badge className="bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">Branch Locked</Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="h-12 w-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-slate-500 font-bold animate-pulse">Synchronizing route data...</p>
                        </div>
                    ) : routes.length === 0 && !searchTerm ? (
                        <div className="py-20 flex flex-col items-center text-center">
                            <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-inner">
                                <MapPin className="h-10 w-10 text-slate-300" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Initialize Route Network</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mb-8 font-medium">Begin by defining your first geographic route key to organize bulk customer meters.</p>
                            <Button onClick={handleAddRoute} className="rounded-2xl h-12 px-8 font-bold bg-slate-900 hover:bg-black transition-all shadow-xl shadow-slate-900/10">
                                <PlusCircle className="mr-2 h-5 w-5" /> Start Infrastructure Setup
                            </Button>
                        </div>
                    ) : (
                        <div className="mt-4">
                            <RouteTable
                                data={filteredRoutes}
                                onEdit={handleEditRoute}
                                onDelete={handleDeleteRoute}
                                canEdit={canUpdate}
                                canDelete={canDelete}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <RouteFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSubmit={handleSubmitRoute}
                defaultValues={selectedRoute}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600">Delete Route?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action will permanently delete route <span className="font-bold">{routeToDelete?.routeKey}</span>.
                            Bulk meters associated with this route will be unassigned.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRouteToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
