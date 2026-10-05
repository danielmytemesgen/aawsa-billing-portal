"use client";

import * as React from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { CardDescription } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { ReadingAnalyticsReportView } from "@/features/billing/components/reading-analytics-report-view";

export default function StaffReadingClassificationPage() {
    const { hasPermission } = usePermissions();
    const [staffBranchId, setStaffBranchId] = React.useState<string | null>(null);

    React.useEffect(() => {
        const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        if (userStr) {
            try {
                const userObj = JSON.parse(userStr);
                if (userObj.branchId) {
                    setStaffBranchId(userObj.branchId);
                }
            } catch (e) {
                console.error("Error parsing user from localStorage", e);
            }
        }
    }, []);

    const canView = hasPermission('meter_readings_analytics_view') || 
                    hasPermission('reports_generate_all') || 
                    hasPermission('reports_generate_branch') || 
                    hasPermission('meter_readings_view_all') ||
                    hasPermission('meter_readings_view_branch');

    if (!canView) {
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
            <ReadingAnalyticsReportView 
                isAdmin={false} 
                staffBranchId={staffBranchId} 
                isEmbedded={false} 
            />
        </div>
    );
}
