"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getReadingPeriodStatusAction, updateReadingPeriodStatusAction } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Lock as LockIcon, Unlock } from "lucide-react";

export function ReadingPeriodToggle() {
    const [status, setStatus] = React.useState<'Open' | 'Closed'>('Open');
    const [isLoading, setIsLoading] = React.useState(true);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchStatus = async () => {
            try {
                const s = await getReadingPeriodStatusAction();
                setStatus(s as 'Open' | 'Closed');
            } catch (error) {
                console.error("Failed to fetch status:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStatus();
    }, []);

    const handleToggle = async (checked: boolean) => {
        const newStatus = checked ? 'Open' : 'Closed';
        setIsUpdating(true);
        try {
            await updateReadingPeriodStatusAction(newStatus);
            setStatus(newStatus);
            toast({
                title: `Reading Period ${newStatus}`,
                description: `The meter reading period is now ${newStatus.toLowerCase()} globally.`,
                variant: newStatus === 'Open' ? "default" : "destructive"
            });
        } catch (error: any) {
            toast({
                title: "Update Failed",
                description: error.message || "Failed to update reading period status.",
                variant: "destructive"
            });
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="border-blue-100 shadow-sm">
                <CardContent className="p-6 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={`border-none shadow-lg overflow-hidden ${status === 'Open' ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {status === 'Open' ? <Unlock className="h-5 w-5 text-emerald-600" /> : <LockIcon className="h-5 w-5 text-red-600" />}
                        <CardTitle className="text-lg">Reading Period Control</CardTitle>
                    </div>
                    <Badge variant={status === 'Open' ? "default" : "destructive"} className={status === 'Open' ? "bg-emerald-600" : ""}>
                        {status}
                    </Badge>
                </div>
                <CardDescription>
                    Globally control the ability for staff to view routes and submit readings.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="space-y-0.5">
                        <Label htmlFor="reading-status" className="text-base font-bold">
                            Period Status
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {status === 'Open' 
                                ? "Readers can currently access assigned routes and submit data." 
                                : "Field reading is currently locked. Readers cannot see routes."}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                        <Switch
                            id="reading-status"
                            checked={status === 'Open'}
                            onCheckedChange={handleToggle}
                            disabled={isUpdating}
                        />
                    </div>
                </div>
                
                {status === 'Closed' && (
                    <div className="mt-4 p-3 bg-red-100/50 border border-red-200 rounded-md flex gap-3 text-red-900 text-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <p>
                            <strong>Warning:</strong> Locking the period will immediately hide all routes from field staff mobile devices.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
