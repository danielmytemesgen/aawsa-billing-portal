"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { SidebarNav, type NavItemGroup, type NavItem } from "@/components/layout/sidebar-nav";
import { AppShell } from "@/components/layout/app-shell";
import { PermissionsContext, type PermissionsContextType } from '@/hooks/use-permissions';
import { getLatestPermissionsAction } from "@/lib/actions";
import { PERMISSIONS } from '@/lib/constants/auth';


interface UserProfile {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
    branchName?: string;
    branchId?: string;
    name?: string;
}

const buildSidebarNavItems = (user: UserProfile | null): NavItemGroup[] => {
    if (!user) return [];

    const permissions = new Set(user.permissions || []);
    const userRoleLower = user.role.toLowerCase();

    const hasPermission = (p: string) => permissions.has(p);

    const navItems: NavItemGroup[] = [];

    let dashboardHref = "/admin/dashboard"; // Default
    if (hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL) && !hasPermission(PERMISSIONS.STAFF_VIEW)) dashboardHref = '/admin/head-office-dashboard';
    if (hasPermission(PERMISSIONS.STAFF_VIEW) && !hasPermission(PERMISSIONS.BILL_VIEW_ALL)) dashboardHref = '/admin/staff-management-dashboard';
    if (userRoleLower === 'head office management') dashboardHref = '/admin/head-office-dashboard';
    if (userRoleLower === 'staff management') dashboardHref = '/admin/staff-management-dashboard';

    if (hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL) || hasPermission(PERMISSIONS.DASHBOARD_VIEW_BRANCH)) {
        navItems.push({
            items: [{ title: "Dashboard", href: dashboardHref, iconName: "LayoutDashboard" }]
        });
    }

    const managementItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.BRANCHES_VIEW)) managementItems.push({ title: "Branch Management", href: "/admin/branches", iconName: "Building" });
    if (hasPermission(PERMISSIONS.STAFF_VIEW)) managementItems.push({ title: "Staff Management", href: "/admin/staff-management", iconName: "UserCog" });
    if (hasPermission(PERMISSIONS.CUSTOMERS_APPROVE)) managementItems.push({ title: "Approvals", href: "/admin/approvals", iconName: "UserCheck" });
    if (hasPermission(PERMISSIONS.ROLES_VIEW)) managementItems.push({ title: "Roles & Permissions", href: "/admin/roles-and-permissions", iconName: "ShieldCheck" });
    if (hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW)) managementItems.push({ title: "Notifications", href: "/admin/notifications", iconName: "Bell" });
    if (hasPermission(PERMISSIONS.TARIFFS_VIEW)) managementItems.push({ title: "Tariff Management", href: "/admin/tariffs", iconName: "LibraryBig" });
    if (hasPermission(PERMISSIONS.ROUTES_VIEW_ALL) || hasPermission(PERMISSIONS.ROUTES_VIEW_ASSIGNED) || hasPermission(PERMISSIONS.METER_READINGS_ANALYTICS_VIEW)) {
        managementItems.push({ title: "Route Management", href: "/admin/routes", iconName: "Map" });
    }
    if (hasPermission(PERMISSIONS.KNOWLEDGE_BASE_MANAGE)) managementItems.push({ title: "Knowledge Base", href: "/admin/knowledge-base", iconName: "BookText" });
    if (hasPermission(PERMISSIONS.BILL_VIEW_DRAFTS) || hasPermission(PERMISSIONS.BILL_APPROVE) || hasPermission(PERMISSIONS.BILL_CREATE) || hasPermission(PERMISSIONS.BILL_VIEW_ALL)) {
        managementItems.push({ title: "Bill Management", href: "/admin/bill-management", iconName: "FileText" });
    }

    const canViewFaultCodes = hasPermission(PERMISSIONS.SETTINGS_MANAGE)
        || hasPermission(PERMISSIONS.BILL_VIEW_ALL)
        || hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL);

    if (canViewFaultCodes) {
        managementItems.push({ title: "Fault Codes", href: "/admin/fault-codes", iconName: "AlertOctagon" });
    }

    if (managementItems.length > 0) {
        navItems.push({ title: "Management", items: managementItems });
    }

    const customerMeteringItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.BULK_METERS_VIEW_ALL) || hasPermission(PERMISSIONS.BULK_METERS_VIEW_BRANCH)) customerMeteringItems.push({ title: "Bulk Meters", href: "/admin/bulk-meters", iconName: "Gauge" });
    if (hasPermission(PERMISSIONS.CUSTOMERS_VIEW_ALL) || hasPermission(PERMISSIONS.CUSTOMERS_VIEW_BRANCH)) customerMeteringItems.push({ title: "Individual Customers", href: "/admin/individual-customers", iconName: "Users" });

    if (customerMeteringItems.length > 0) {
        navItems.push({ title: "Customer & Metering", items: customerMeteringItems });
    }

    const dataReportsItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.DATA_ENTRY_ACCESS)) dataReportsItems.push({ title: "Data Entry", href: "/admin/data-entry", iconName: "FileText" });
    if (hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL) || hasPermission(PERMISSIONS.METER_READINGS_VIEW_BRANCH)) dataReportsItems.push({ title: "Meter Readings", href: "/admin/meter-readings", iconName: "ClipboardList" });
    if (hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)) {
        dataReportsItems.push({ title: "Reports", href: "/admin/reports", iconName: "BarChart2" });
        dataReportsItems.push({ title: "List Of Paid Bills", href: "/admin/reports/paid-bills", iconName: "CheckCircle2" });
        dataReportsItems.push({ title: "List Of Sent Bills", href: "/admin/reports/sent-bills", iconName: "Send" });
        dataReportsItems.push({ title: "List of Unsettled Bills", href: "/admin/reports/unsettled-bills", iconName: "FileClock" });
    }

    if (dataReportsItems.length > 0) {
        navItems.push({ title: "Data & Reports", items: dataReportsItems });
    }

    const settingsItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.SETTINGS_VIEW)) settingsItems.push({ title: "Settings", href: "/admin/settings", iconName: "Settings" });
    if (hasPermission(PERMISSIONS.SETTINGS_VIEW) || hasPermission('promotions_manage')) settingsItems.push({ title: "Promotions", href: "/admin/settings/promotions", iconName: "Megaphone" });
    if (hasPermission(PERMISSIONS.SETTINGS_MANAGE)) {
        settingsItems.push({ title: "Security Logs", href: "/admin/security-logs", iconName: "Shield" });
        settingsItems.push({ title: "Recycle Bin", href: "/admin/recycle-bin", iconName: "Trash2" });
        settingsItems.push({ title: "System Maintenance", href: "/admin/maintenance", iconName: "Activity" });
    }

    if (settingsItems.length > 0) {
        navItems.push({ title: "System", items: settingsItems });
    }

    return navItems;
}


interface AdminLayoutClientProps {
    children: React.ReactNode;
    user: UserProfile | null;
}


export default function AdminLayoutClient({ children, user: initialUser }: AdminLayoutClientProps) {
    const [user, setUser] = React.useState<UserProfile | null>(initialUser);

    const refreshPermissions = React.useCallback(async () => {
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
    }, []);

    React.useEffect(() => {
        const fetchUser = async () => {
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

        fetchUser();

        const handlePermissionsUpdate = () => {
            refreshPermissions();
        };

        window.addEventListener('user-permissions-updated', handlePermissionsUpdate);
        return () => window.removeEventListener('user-permissions-updated', handlePermissionsUpdate);
    }, [refreshPermissions]);

    const navItems = buildSidebarNavItems(user);

    const permissionsValue: PermissionsContextType = React.useMemo(() => ({
        permissions: new Set(user?.permissions || []),
        hasPermission: (permission: string) => {
            if (!user) return false;
            return user.permissions?.includes(permission) || false;
        },
        refreshPermissions
    }), [user, refreshPermissions]);

    return (
        <PermissionsContext.Provider value={permissionsValue}>
            <AppShell user={user} userRole="admin" sidebar={<SidebarNav items={navItems} />} >
                {children}
            </AppShell>
        </PermissionsContext.Provider>
    );
}