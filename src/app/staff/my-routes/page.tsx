"use client";

import * as React from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRoutes, useBulkMeters, fetchRoutes, initializeBulkMeters } from "@/lib/data-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

export default function MyRoutesPage() {
    const { currentUser } = useCurrentUser();
    const routes = useRoutes();
    const allBulkMeters = useBulkMeters();
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchRoutes(true),
                initializeBulkMeters(true)
            ]);
            setIsLoading(false);
        };
        load();
    }, []);

    const myRoutes = React.useMemo(() => {
        if (!currentUser?.id) return [];
        const userIdRaw = currentUser.id.toLowerCase();
        return routes.filter(r => r.readerId?.toLowerCase() === userIdRaw);
    }, [routes, currentUser]);

    const getMeterCount = (routeKey: string) => {
        return allBulkMeters.filter(bm => bm.routeKey === routeKey).length;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-muted-foreground">Loading your assigned routes...</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">My Assigned Routes</h1>
                    <p className="text-muted-foreground">Manage readings for your assigned meter reading routes.</p>
                </div>
            </div>

            {myRoutes.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-2 bg-muted/20">
                    <MapPin className="mx-auto h-16 w-16 text-muted-foreground opacity-20 mb-4" />
                    <CardTitle className="text-xl">No Routes Assigned</CardTitle>
                    <CardDescription className="max-w-xs mx-auto">
                        You haven't been assigned to any meter reading routes yet. Please contact your branch manager.
                    </CardDescription>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {myRoutes.map(route => (
                        <Card key={route.routeKey} className="overflow-hidden hover:shadow-lg transition-all border-l-4 border-l-blue-500">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="outline" className="font-mono bg-white text-blue-600 border-blue-200">
                                        {route.routeKey}
                                    </Badge>
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">
                                        {getMeterCount(route.routeKey)} Bulk Meters
                                    </Badge>
                                </div>
                                <CardTitle className="text-xl">{route.description || "Reading Route"}</CardTitle>
                                <CardDescription className="line-clamp-1">{route.routeKey}</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                                    <Link href={`/staff/my-routes/${route.routeKey}`}>
                                        Open Route <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
