"use client";

import * as React from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { CardDescription } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { ReadingAnalyticsReportView } from "@/features/billing/components/reading-analytics-report-view";

export default function ReadingClassificationPage() {
    const { hasPermission } = usePermissions();

    if (!hasPermission('meter_readings_analytics_view')) {
        return (
            <div className="space-y-6 p-4">
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <CardDescription>You do not have permission to view reading analytics reports.</CardDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            <ReadingAnalyticsReportView isAdmin={true} isEmbedded={false} />
        </div>
    );
}
