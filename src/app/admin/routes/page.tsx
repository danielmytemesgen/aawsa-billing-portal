
"use client";

import * as React from "react";
import { PlusCircle, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { RouteTable } from "./route-table";
import { RouteFormDialog, type RouteFormValues } from "./route-form-dialog";
import {
    useRoutes,
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
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [selectedRoute, setSelectedRoute] = React.useState<Route | null>(null);
    const [routeToDelete, setRouteToDelete] = React.useState<Route | null>(null);

    const canManage = hasPermission('settings_manage') || hasPermission('meter_readings_view_all') || hasPermission('staff_view'); // Route management access for settings, readers, or staff managers

    React.useEffect(() => {
        setIsLoading(true);
        fetchRoutes().then(() => {
            setIsLoading(false);
        });
    }, []);

    const handleAddRoute = () => {
        if (!canManage) return;
        setSelectedRoute(null);
        setIsFormOpen(true);
    };

    const handleEditRoute = (route: Route) => {
        if (!canManage) return;
        setSelectedRoute(route);
        setIsFormOpen(true);
    };

    const handleDeleteRoute = (route: Route) => {
        if (!canManage) return;
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
            if (selectedRoute) {
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

    const filteredRoutes = routes.filter(route =>
        route.routeKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (route.description && route.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h1 className="text-2xl md:text-3xl font-bold">Route Management</h1>
                <div className="flex w-full flex-col sm:flex-row items-center gap-2">
                    <div className="relative w-full sm:w-auto flex-grow">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search routes..."
                            className="pl-8 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleAddRoute} className="w-full sm:w-auto flex-shrink-0 bg-blue-600 hover:bg-blue-700">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Route
                    </Button>
                </div>
            </div>

            <Card className="shadow-lg border-none bg-white/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Route List</CardTitle>
                    <CardDescription>Manage your meter reading routes and assign readers.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="mt-4 p-8 text-center text-muted-foreground animate-pulse">
                            Fetching routes...
                        </div>
                    ) : routes.length === 0 && !searchTerm ? (
                        <div className="mt-4 p-12 border-2 border-dashed rounded-xl bg-muted/30 text-center">
                            <MapPin className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700">No Routes Found</h3>
                            <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Create your first route to start organizing bulk meters and assigning readers.</p>
                            <Button onClick={handleAddRoute} variant="outline" className="mt-6 border-blue-200 text-blue-600 hover:bg-blue-50">
                                <PlusCircle className="mr-2 h-4 w-4" /> Add First Route
                            </Button>
                        </div>
                    ) : (
                        <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
                            <RouteTable
                                data={filteredRoutes}
                                onEdit={handleEditRoute}
                                onDelete={handleDeleteRoute}
                                canEdit={canManage}
                                canDelete={canManage}
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
