"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, AlertTriangle, Info, DollarSign, Bell, FileDown, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";

const APP_NAME_KEY = "aawsa-app-name";
const CURRENCY_KEY = "aawsa-default-currency";
const DARK_MODE_KEY = "aawsa-dark-mode-default";
const BILLING_CYCLE_DAY_KEY = "aawsa-billing-cycle-day";
const ENABLE_OVERDUE_REMINDERS_KEY = "aawsa-enable-overdue-reminders";

// Keys for new settings
const NOTIFY_NEW_BILL_KEY = "aawsa-notify-new-bill";
const NOTIFY_OVERDUE_KEY = "aawsa-notify-overdue";
const EXPORT_FORMAT_KEY = "aawsa-export-format";
const EXPORT_PREFIX_KEY = "aawsa-export-prefix";


const billingCycleDays = Array.from({ length: 28 }, (_, i) => (i + 1).toString());

export default function StaffSettingsPage() {
    const { hasPermission } = usePermissions();
    const { toast } = useToast();

    // State for existing settings
    const [appName, setAppName] = React.useState("AAWSA Billing Portal");
    const [defaultCurrency, setDefaultCurrency] = React.useState("ETB");
    const [enableDarkMode, setEnableDarkMode] = React.useState(false);
    const [billingCycleDay, setBillingCycleDay] = React.useState("1");
    const [enableOverdueReminders, setEnableOverdueReminders] = React.useState(false);

    // State for new settings
    const [notifyOnNewBill, setNotifyOnNewBill] = React.useState(true);
    const [notifyOnOverdue, setNotifyOnOverdue] = React.useState(true);
    const [exportFormat, setExportFormat] = React.useState("xlsx");
    const [exportPrefix, setExportPrefix] = React.useState("aawsa_export");

    const [isMounted, setIsMounted] = React.useState(false);
    const canUpdateSettings = hasPermission('settings_update');

    React.useEffect(() => {
        setIsMounted(true);
        // Load existing settings
        const storedAppName = localStorage.getItem(APP_NAME_KEY);
        const storedCurrency = localStorage.getItem(CURRENCY_KEY);
        const storedDarkMode = localStorage.getItem(DARK_MODE_KEY);
        const storedBillingCycleDay = localStorage.getItem(BILLING_CYCLE_DAY_KEY);
        const storedEnableOverdueReminders = localStorage.getItem(ENABLE_OVERDUE_REMINDERS_KEY);

        if (storedAppName) setAppName(storedAppName);
        if (storedCurrency) setDefaultCurrency(storedCurrency);
        if (storedDarkMode) setEnableDarkMode(storedDarkMode === "true");
        if (storedBillingCycleDay) setBillingCycleDay(storedBillingCycleDay);
        if (storedEnableOverdueReminders) setEnableOverdueReminders(storedEnableOverdueReminders === "true");

        // Load new settings
        const storedNotifyNewBill = localStorage.getItem(NOTIFY_NEW_BILL_KEY);
        const storedNotifyOverdue = localStorage.getItem(NOTIFY_OVERDUE_KEY);
        const storedExportFormat = localStorage.getItem(EXPORT_FORMAT_KEY);
        const storedExportPrefix = localStorage.getItem(EXPORT_PREFIX_KEY);

        if (storedNotifyNewBill !== null) setNotifyOnNewBill(storedNotifyNewBill === 'true');
        if (storedNotifyOverdue !== null) setNotifyOnOverdue(storedNotifyOverdue === 'true');
        if (storedExportFormat) setExportFormat(storedExportFormat);
        if (storedExportPrefix) setExportPrefix(storedExportPrefix);

        if (typeof document !== 'undefined') {
            if (storedDarkMode === "true") {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, []);

    const handleSaveSettings = () => {
        if (!canUpdateSettings) {
            toast({
                variant: "destructive",
                title: "Permission Denied",
                description: "You do not have permission to update settings.",
            });
            return;
        }
        // Save existing settings
        localStorage.setItem(APP_NAME_KEY, appName);
        localStorage.setItem(CURRENCY_KEY, defaultCurrency);
        localStorage.setItem(DARK_MODE_KEY, String(enableDarkMode));
        localStorage.setItem(BILLING_CYCLE_DAY_KEY, billingCycleDay);
        localStorage.setItem(ENABLE_OVERDUE_REMINDERS_KEY, String(enableOverdueReminders));

        // Save new settings
        localStorage.setItem(NOTIFY_NEW_BILL_KEY, String(notifyOnNewBill));
        localStorage.setItem(NOTIFY_OVERDUE_KEY, String(notifyOnOverdue));
        localStorage.setItem(EXPORT_FORMAT_KEY, exportFormat);
        localStorage.setItem(EXPORT_PREFIX_KEY, exportPrefix);

        toast({
            title: "Settings Saved",
            description: "Your application settings have been updated.",
        });

        if (typeof document !== 'undefined') {
            document.title = appName;
            if (enableDarkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    };

    if (!isMounted) {
        return null;
    }

    if (!hasPermission('settings_view')) {
        return (
            <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <CardDescription>You do not have the required permissions to view this page.</CardDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold">Application Settings</h1>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Configure application-wide settings and preferences.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="app-name">Application Name</Label>
                        <Input
                            id="app-name"
                            value={appName}
                            onChange={(e) => setAppName(e.target.value)}
                            disabled={!canUpdateSettings}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="currency">Default Currency</Label>
                        <Input
                            id="currency"
                            value={defaultCurrency}
                            onChange={(e) => setDefaultCurrency(e.target.value)}
                            disabled={!canUpdateSettings}
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="dark-mode"
                            checked={enableDarkMode}
                            onCheckedChange={(checked) => setEnableDarkMode(checked as boolean)}
                            disabled={!canUpdateSettings}
                        />
                        <Label htmlFor="dark-mode" className="font-medium">
                            Enable Dark Mode by Default
                        </Label>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Billing Settings</CardTitle>
                    <CardDescription>Manage billing cycle, tariff rates, and reminder configurations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="billing-cycle-day">Billing Cycle Day</Label>
                        <Select value={billingCycleDay} onValueChange={setBillingCycleDay} disabled={!canUpdateSettings}>
                            <SelectTrigger id="billing-cycle-day" className="w-full md:w-[200px]">
                                <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                            <SelectContent>
                                {billingCycleDays.map(day => (
                                    <SelectItem key={day} value={day}>Day {day}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            The day of the month when new bills are generated.
                        </p>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="overdue-reminders"
                            checked={enableOverdueReminders}
                            onCheckedChange={(checked) => setEnableOverdueReminders(checked as boolean)}
                            disabled={!canUpdateSettings}
                        />
                        <Label htmlFor="overdue-reminders" className="font-medium">
                            Enable Automatic Overdue Reminders
                        </Label>
                    </div>

                    <div className="p-4 border rounded-md bg-muted/20">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">Current Tariff Information</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                            Tariff rates and structure are managed in the <span className="font-semibold">Tariff Management</span> section. This is a read-only view.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notification Preferences</CardTitle>
                    <CardDescription>Configure when and how to send notifications.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="notify-new-bill"
                            checked={notifyOnNewBill}
                            onCheckedChange={(checked) => setNotifyOnNewBill(checked as boolean)}
                            disabled={!canUpdateSettings}
                        />
                        <Label htmlFor="notify-new-bill" className="font-normal">
                            Send email notification when a new bill is generated.
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="notify-overdue"
                            checked={notifyOnOverdue}
                            onCheckedChange={(checked) => setNotifyOnOverdue(checked as boolean)}
                            disabled={!canUpdateSettings}
                        />
                        <Label htmlFor="notify-overdue" className="font-normal">
                            Send email notification for overdue payments.
                        </Label>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileDown className="h-5 w-5" /> Data Export Configurations</CardTitle>
                    <CardDescription>Set default options for data exports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="export-format">Default Export Format</Label>
                        <Select value={exportFormat} onValueChange={setExportFormat} disabled={!canUpdateSettings}>
                            <SelectTrigger id="export-format" className="w-full md:w-[200px]">
                                <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                                <SelectItem value="csv">CSV (.csv)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="export-prefix">Default Export Filename Prefix</Label>
                        <Input
                            id="export-prefix"
                            value={exportPrefix}
                            onChange={(e) => setExportPrefix(e.target.value)}
                            className="w-full md:w-[300px]"
                            disabled={!canUpdateSettings}
                        />
                    </div>
                </CardContent>
            </Card>


            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        <CardTitle className="text-amber-700 dark:text-amber-300">Advanced Settings (Coming Soon)</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                        Late fee policies will be available here in future updates.
                    </p>
                </CardContent>
            </Card>

            {canUpdateSettings && (
                <div className="flex justify-end">
                    <Button onClick={handleSaveSettings}>
                        <Save className="mr-2 h-4 w-4" /> Save All Settings
                    </Button>
                </div>
            )}
        </div>
    );
}
