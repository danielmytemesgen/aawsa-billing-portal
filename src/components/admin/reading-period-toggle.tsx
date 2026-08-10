"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getReadingPeriodDetailsAction, updateReadingPeriodStatusAction, updateReadingPeriodDetailsAction, ReadingPeriodStatus } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Lock as LockIcon, Unlock, Calendar, Clock, Save, CheckCircle2 } from "lucide-react";

export function ReadingPeriodToggle() {
    const [status, setStatus] = React.useState<ReadingPeriodStatus>('Open');
    const [startDate, setStartDate] = React.useState<string>('');
    const [endDate, setEndDate] = React.useState<string>('');
    const [isLoading, setIsLoading] = React.useState(true);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchDetails = async () => {
            try {
                const details = await getReadingPeriodDetailsAction();
                if (details) {
                    setStatus(details.status || 'Open');
                    setStartDate(details.startDate || '');
                    setEndDate(details.endDate || '');
                }
            } catch (error) {
                console.error("Failed to fetch reading period details:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, []);

    const handleSave = async () => {
        setIsUpdating(true);
        try {
            if (typeof updateReadingPeriodStatusAction === 'function') {
                await updateReadingPeriodStatusAction(status, startDate, endDate);
            } else if (typeof updateReadingPeriodDetailsAction === 'function') {
                await updateReadingPeriodDetailsAction({ status, startDate, endDate });
            } else {
                const { updateReadingPeriodStatusAction: dynamicAction } = await import('@/lib/actions');
                await dynamicAction(status, startDate, endDate);
            }
            toast({
                title: "Reading Period Updated",
                description: `Status updated to "${status}". Start date: ${startDate || 'N/A'}, End date: ${endDate || 'N/A'}.`,
                variant: "default"
            });
        } catch (error: any) {
            toast({
                title: "Update Failed",
                description: error.message || "Failed to update reading period details.",
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

    const getStatusCardBg = () => {
        if (status === 'Open') return 'bg-emerald-50/50 border-emerald-200';
        if (status === 'Ready for New Reading') return 'bg-amber-50/50 border-amber-200';
        return 'bg-red-50/50 border-red-200';
    };

    const getStatusBadge = () => {
        if (status === 'Open') {
            return (
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 px-3 py-1 text-xs">
                    <Unlock className="h-3.5 w-3.5" />
                    Open
                </Badge>
            );
        }
        if (status === 'Ready for New Reading') {
            return (
                <Badge variant="secondary" className="bg-amber-500 text-white hover:bg-amber-600 gap-1.5 px-3 py-1 text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    Ready for New Reading
                </Badge>
            );
        }
        return (
            <Badge variant="destructive" className="gap-1.5 px-3 py-1 text-xs">
                <LockIcon className="h-3.5 w-3.5" />
                Closed
            </Badge>
        );
    };

    return (
        <Card className={`border shadow-lg overflow-hidden transition-all ${getStatusCardBg()}`}>
            <CardHeader className="pb-3 border-b bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {status === 'Open' ? (
                            <Unlock className="h-5 w-5 text-emerald-600" />
                        ) : status === 'Ready for New Reading' ? (
                            <Clock className="h-5 w-5 text-amber-600" />
                        ) : (
                            <LockIcon className="h-5 w-5 text-red-600" />
                        )}
                        <CardTitle className="text-lg font-bold">Meter Reading Period Control</CardTitle>
                    </div>
                    {getStatusBadge()}
                </div>
                <CardDescription>
                    Configure the current meter reading period status, start date, and end date saved in system settings.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
                {/* Period Status Selection */}
                <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="reading-status-select" className="text-base font-bold text-slate-900 dark:text-slate-100">
                                Reading Period Status
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                {status === 'Open' && "Readers can currently access assigned routes and submit meter readings."}
                                {status === 'Closed' && "Field reading is locked. Readers cannot submit new readings."}
                                {status === 'Ready for New Reading' && "Period is prepared and ready for upcoming meter reading cycle."}
                            </p>
                        </div>
                        <Select value={status} onValueChange={(val) => setStatus(val as ReadingPeriodStatus)}>
                            <SelectTrigger id="reading-status-select" className="w-full sm:w-[220px] bg-white dark:bg-slate-800">
                                <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Open">🟢 Open (Active)</SelectItem>
                                <SelectItem value="Ready for New Reading">🟡 Ready for New Reading</SelectItem>
                                <SelectItem value="Closed">🔴 Closed (Locked)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Dates Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                        <Label htmlFor="reading-start-date" className="flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-200">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            Reading Start Date (Auto-Recurring)
                        </Label>
                        <Input
                            id="reading-start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-white dark:bg-slate-800"
                        />
                        <p className="text-xs text-muted-foreground">Start date of reading cycle (Day {startDate ? parseInt(startDate.slice(8, 10)) : 1} of every month).</p>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                        <Label htmlFor="reading-end-date" className="flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-200">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            Reading End Date (Auto-Recurring)
                        </Label>
                        <Input
                            id="reading-end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-white dark:bg-slate-800"
                        />
                        <p className="text-xs text-muted-foreground">End date of reading cycle (Day {endDate ? parseInt(endDate.slice(8, 10)) : 20} of every month).</p>
                    </div>
                </div>

                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-md flex gap-2.5 text-blue-900 dark:text-blue-200 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                        <strong>Auto-Recurring Monthly Schedule:</strong> Dates automatically calculate every month (e.g. Day {startDate ? parseInt(startDate.slice(8, 10)) : 1} to Day {endDate ? parseInt(endDate.slice(8, 10)) : 20}). You do not need to manually re-enter dates each month unless you want to change the schedule.
                    </span>
                </div>

                {/* Notice alerts */}
                {status === 'Closed' && (
                    <div className="p-3 bg-red-100/60 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md flex gap-3 text-red-900 dark:text-red-200 text-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                        <p>
                            <strong>Notice:</strong> Locking the period hides assigned routes from field readers' mobile applications.
                        </p>
                    </div>
                )}

                {status === 'Ready for New Reading' && (
                    <div className="p-3 bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md flex gap-3 text-amber-900 dark:text-amber-200 text-sm">
                        <Clock className="h-5 w-5 shrink-0 text-amber-600" />
                        <p>
                            <strong>Ready State:</strong> Reading cycle parameters are set and ready for launch.
                        </p>
                    </div>
                )}

                {/* Save Button Action */}
                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={isUpdating} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isUpdating ? 'Saving Changes...' : 'Save Reading Period Settings'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
