"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SidebarNav, type NavItemGroup, type NavItem } from "@/components/layout/sidebar-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionsContext, type PermissionsContextType } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { getLatestPermissionsAction } from "@/lib/actions";
import { PERMISSIONS } from '@/lib/constants/auth';import { subscribePermissionsSync } from '@/lib/permissions-sync';

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
    if (!user) return [];

    const permissions = new Set(user.permissions || []);
    const hasPermission = (p: string) => permissions.has(p);
    const userRoleLower = (user.role || '').toLowerCase();

    const navItems: NavItemGroup[] = [];

    // Route Staff Management to their dedicated dashboard
    const dashboardHref = userRoleLower === 'staff management'
        ? '/staff/staff-management-dashboard'
        : '/staff/dashboard';

    // Always show dashboard
    navItems.push({
        items: [{ title: "Dashboard", href: dashboardHref, iconName: "LayoutDashboard" }]
    });

    // For users with assigned routes, show My Routes
    if (hasPermission(PERMISSIONS.ROUTES_VIEW_ASSIGNED)) {
        navItems.push({
            items: [{ title: "My Routes", href: "/staff/my-routes", iconName: "MapPin" }]
        });
    }

    const managementItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.BRANCHES_VIEW)) managementItems.push({ title: "Branch Management", href: "/staff/branches", iconName: "Building" });
    if (hasPermission(PERMISSIONS.STAFF_VIEW)) managementItems.push({ title: "Staff Management", href: "/staff/staff-management", iconName: "UserCog" });
    if (hasPermission(PERMISSIONS.CUSTOMERS_APPROVE)) managementItems.push({ title: "Approvals", href: "/staff/approvals", iconName: "UserCheck" });
    if (hasPermission(PERMISSIONS.ROLES_VIEW)) managementItems.push({ title: "Roles & Permissions", href: "/staff/roles-and-permissions", iconName: "ShieldCheck" });
    if (hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW)) managementItems.push({ title: "Notifications", href: "/staff/notifications", iconName: "Bell" });
    if (hasPermission(PERMISSIONS.TARIFFS_VIEW)) managementItems.push({ title: "Tariff Management", href: "/staff/tariffs", iconName: "LibraryBig" });
    if (hasPermission(PERMISSIONS.KNOWLEDGE_BASE_MANAGE)) managementItems.push({ title: "Knowledge Base", href: "/staff/knowledge-base", iconName: "BookText" });
    if (hasPermission(PERMISSIONS.BILL_VIEW_DRAFTS) || hasPermission(PERMISSIONS.BILL_APPROVE) || hasPermission(PERMISSIONS.BILL_CREATE)) {
        managementItems.push({ title: "Bill Management", href: "/staff/bill-management", iconName: "FileText" });
    }

    if (managementItems.length > 0) {
        navItems.push({ title: "Management", items: managementItems });
    }

    const customerMeteringItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.BULK_METERS_VIEW_BRANCH) || hasPermission(PERMISSIONS.BULK_METERS_VIEW_ALL)) customerMeteringItems.push({ title: "Bulk Meters", href: "/staff/bulk-meters", iconName: "Gauge" });
    if (hasPermission(PERMISSIONS.CUSTOMERS_VIEW_BRANCH) || hasPermission(PERMISSIONS.CUSTOMERS_VIEW_ALL)) customerMeteringItems.push({ title: "Individual Customers", href: "/staff/individual-customers", iconName: "Users" });

    if (customerMeteringItems.length > 0) {
        navItems.push({ title: "Customer & Metering", items: customerMeteringItems });
    }

    const dataReportsItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.DATA_ENTRY_ACCESS)) dataReportsItems.push({ title: "Data Entry", href: "/staff/data-entry", iconName: "FileText" });
    if (hasPermission(PERMISSIONS.METER_READINGS_VIEW_BRANCH) || hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL)) {
        dataReportsItems.push({ title: "Meter Readings", href: "/staff/meter-readings", iconName: "ClipboardList" });
        if (hasPermission(PERMISSIONS.ROUTES_VIEW_ASSIGNED)) {
            dataReportsItems.push({ title: "Reading Analytics", href: "/staff/reports/reading-classification", iconName: "TrendingUp" });
        }
    }
    if (hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH) || hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)) {
        dataReportsItems.push({ title: "Reports", href: "/staff/reports", iconName: "BarChart2" });
        dataReportsItems.push({ title: "List Of Paid Bills", href: "/staff/reports/paid-bills", iconName: "CheckCircle2" });
        dataReportsItems.push({ title: "List Of Sent Bills", href: "/staff/reports/sent-bills", iconName: "Send" });
        dataReportsItems.push({ title: "List of Unsettled Bills", href: "/staff/reports/unsettled-bills", iconName: "FileClock" });
    }

    if (dataReportsItems.length > 0) {
        navItems.push({ title: "Data & Reports", items: dataReportsItems });
    }

    if (hasPermission(PERMISSIONS.SETTINGS_VIEW)) {
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
            // Permissions will refresh on next navigation or reload

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

        const unsubscribeSync = subscribePermissionsSync(handlePermissionsUpdate);
        window.addEventListener('user-permissions-updated', handlePermissionsUpdate);
        return () => {
            unsubscribeSync();
            window.removeEventListener('user-permissions-updated', handlePermissionsUpdate);
        };
    }, [router]);

    const refreshPermissions = React.useCallback(async () => {
        // Skip the network call when offline — permissions are already cached in localStorage
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            console.info('StaffLayout: offline – skipping permission refresh');
            return;
        }
        try {
            const result = await getLatestPermissionsAction();
            if (result.data && !result.error) {
                const latestPermissions = Array.isArray(result.data) ? result.data : String(result.data).split(',');
                setUser(prev => {
                    if (!prev) return null;
                    const updatedUser = { ...prev, permissions: latestPermissions };
                    localStorage.setItem("user", JSON.stringify(updatedUser));
                    return updatedUser;
                });
            }
        } catch (e) {
            console.warn('StaffLayout: failed to refresh permissions (offline?)', e);
        }
    }, []);

    const navItems = buildStaffSidebarNavItems(user);

    const permissionsValue: PermissionsContextType = React.useMemo(() => ({
        permissions: new Set(user?.permissions || []),
        hasPermission: (permission: string) => {
            if (!user) return false;
            return user.permissions?.includes(permission) || false;
        },
        refreshPermissions
    }), [user, refreshPermissions]);

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
