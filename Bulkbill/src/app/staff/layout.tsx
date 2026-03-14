"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SidebarNav, type NavItemGroup, type NavItem } from "@/components/layout/sidebar-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionsContext, type PermissionsContextType } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { refetchUserPermissions } from "@/lib/data-store";

interface UserProfile {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
    branchName?: string;
    branchId?: string;
    name?: string;
}

const buildStaffSidebarNavItems = (user: UserProfile | null): NavItemGroup[] => {
    console.log("Building sidebar for user:", user);
    if (!user) return [];

    const permissions = new Set(user.permissions || []);
    const hasPermission = (p: string) => permissions.has(p);

    const navItems: NavItemGroup[] = [];

    // Always show dashboard
    navItems.push({
        items: [{ title: "Dashboard", href: "/staff/dashboard", iconName: "LayoutDashboard" }]
    });

    const managementItems: NavItem[] = [];
    if (hasPermission('branches_view')) managementItems.push({ title: "Branch Management", href: "/staff/branches", iconName: "Building" });
    if (hasPermission('staff_view')) managementItems.push({ title: "Staff Management", href: "/staff/staff-management", iconName: "UserCog" });
    if (hasPermission('customers_approve')) managementItems.push({ title: "Approvals", href: "/staff/approvals", iconName: "UserCheck" });
    if (hasPermission('permissions_view')) managementItems.push({ title: "Roles & Permissions", href: "/staff/roles-and-permissions", iconName: "ShieldCheck" });
    if (hasPermission('notifications_view')) managementItems.push({ title: "Notifications", href: "/staff/notifications", iconName: "Bell" });
    if (hasPermission('tariffs_view')) managementItems.push({ title: "Tariff Management", href: "/staff/tariffs", iconName: "LibraryBig" });
    if (hasPermission('knowledge_base_manage')) managementItems.push({ title: "Knowledge Base", href: "/staff/knowledge-base", iconName: "BookText" });

    if (managementItems.length > 0) {
        navItems.push({ title: "Management", items: managementItems });
    }

    const customerMeteringItems: NavItem[] = [];
    if (hasPermission('bulk_meters_view_branch') || hasPermission('bulk_meters_view_all')) customerMeteringItems.push({ title: "Bulk Meters", href: "/staff/bulk-meters", iconName: "Gauge" });
    if (hasPermission('customers_view_branch') || hasPermission('customers_view_all')) customerMeteringItems.push({ title: "Individual Customers", href: "/staff/individual-customers", iconName: "Users" });

    if (customerMeteringItems.length > 0) {
        navItems.push({ title: "Customer & Metering", items: customerMeteringItems });
    }

    const dataReportsItems: NavItem[] = [];
    if (hasPermission('data_entry_access')) dataReportsItems.push({ title: "Data Entry", href: "/staff/data-entry", iconName: "FileText" });
    if (hasPermission('meter_readings_view_branch') || hasPermission('meter_readings_view_all')) dataReportsItems.push({ title: "Meter Readings", href: "/staff/meter-readings", iconName: "ClipboardList" });
    if (hasPermission('reports_generate_branch') || hasPermission('reports_generate_all')) {
        dataReportsItems.push({ title: "Reports", href: "/staff/reports", iconName: "BarChart2" });
        dataReportsItems.push({ title: "List Of Paid Bills", href: "/staff/reports/paid-bills", iconName: "CheckCircle2" });
        dataReportsItems.push({ title: "List Of Sent Bills", href: "/staff/reports/sent-bills", iconName: "Send" });
        dataReportsItems.push({ title: "List of Unsettled Bills", href: "/staff/reports/unsettled-bills", iconName: "FileClock" });
    }

    if (dataReportsItems.length > 0) {
        navItems.push({ title: "Data & Reports", items: dataReportsItems });
    }

    if (hasPermission('settings_view')) {
        navItems.push({
            items: [{ title: "Settings", href: "/staff/settings", iconName: "Settings" }]
        });
    }

    return navItems;
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = React.useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const router = useRouter();

    React.useEffect(() => {
        const fetchUser = async () => {
            await refetchUserPermissions();
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                } catch (e) {
                    console.error("Failed to parse user from localStorage", e);
                    router.replace("/");
                }
            } else {
                router.replace("/");
            }
            setIsLoading(false);
        };

        fetchUser();

        const handlePermissionsUpdate = () => {
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                } catch (e) {
                    console.error("Failed to parse user from localStorage", e);
                }
            }
        };

        window.addEventListener('user-permissions-updated', handlePermissionsUpdate);
        return () => window.removeEventListener('user-permissions-updated', handlePermissionsUpdate);
    }, [router]);

    const navItems = buildStaffSidebarNavItems(user);

    const permissionsValue: PermissionsContextType = React.useMemo(() => ({
        permissions: new Set(user?.permissions || []),
        hasPermission: (permission: string) => {
            return user?.permissions?.includes(permission) || false;
        }
    }), [user]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Skeleton className="h-16 w-16" />
            </div>
        );
    }

    if (!user) {
        return null;
    }

    // Ensure user passed to AppShell is a plain object (strip prototypes)
    const safeUser = user ? JSON.parse(JSON.stringify(user)) : null;
    return (
        <PermissionsContext.Provider value={permissionsValue}>
            <AppShell user={safeUser} userRole="staff" sidebar={<SidebarNav items={navItems} />} >
                {children}
            </AppShell>
        </PermissionsContext.Provider>
    );
}
