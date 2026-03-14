"use client"

import * as React from "react";
import TariffManagementPage from '@/app/admin/tariffs/page';
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function StaffTariffsPage() {
    const { hasPermission } = usePermissions();

    if (!hasPermission('tariffs_view')) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <UIAlertDescription>
                        You do not have the required permissions to view this page.
                    </UIAlertDescription>
                </Alert>
            </div>
        );
    }

    return <TariffManagementPage />;
}
