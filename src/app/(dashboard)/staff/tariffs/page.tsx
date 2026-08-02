"use client"

import * as React from "react";
import TariffManagementPage from '@/app/(dashboard)/admin/tariffs/page';
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function StaffTariffsPage() {
    const { hasPermission } = usePermissions();

    if (!hasPermission(PERMISSIONS.TARIFFS_VIEW)) {
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
