"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { SidebarNav, type NavItemGroup, type NavItem } from "@/components/layout/sidebar-nav";
import { AppShell } from "@/components/layout/app-shell";
import { PermissionsContext, type PermissionsContextType } from '@/hooks/use-permissions';
import { getLatestPermissionsAction } from "@/lib/actions";


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
    if (hasPermission('dashboard_view_all') && !hasPermission('staff_view')) dashboardHref = '/admin/head-office-dashboard'; // Simple heuristic for HO
    if (hasPermission('staff_view') && !hasPermission('bill:manage_all')) dashboardHref = '/admin/staff-management-dashboard'; // Simple heuristic for Staff Mgmt
    // Note: Ideally, these should be explicit permissions or based on the role stored in session, 
    // but here we align with the goal of moving away from hard-coded role strings where possible.
    // Given the role is still in the user object, we can use it for specific page routing if needed,
    // but the visibility should be perm-based.
    if (userRoleLower === 'head office management') dashboardHref = '/admin/head-office-dashboard';
    if (userRoleLower === 'staff management') dashboardHref = '/admin/staff-management-dashboard';

    if (hasPermission('dashboard_view_all') || hasPermission('dashboard_view_branch')) {
        navItems.push({
            items: [{ title: "Dashboard", href: dashboardHref, iconName: "LayoutDashboard" }]
        });
    }

    const managementItems: NavItem[] = [];
    if (hasPermission('branches_view')) managementItems.push({ title: "Branch Management", href: "/admin/branches", iconName: "Building" });
    if (hasPermission('staff_view')) managementItems.push({ title: "Staff Management", href: "/admin/staff-management", iconName: "UserCog" });
    if (hasPermission('customers_approve')) managementItems.push({ title: "Approvals", href: "/admin/approvals", iconName: "UserCheck" });
    if (hasPermission('permissions_view')) managementItems.push({ title: "Roles & Permissions", href: "/admin/roles-and-permissions", iconName: "ShieldCheck" });
    if (hasPermission('notifications_view')) managementItems.push({ title: "Notifications", href: "/admin/notifications", iconName: "Bell" });
    if (hasPermission('tariffs_view')) managementItems.push({ title: "Tariff Management", href: "/admin/tariffs", iconName: "LibraryBig" });
    if (hasPermission('settings_manage') || hasPermission('meter_readings_view_all') || hasPermission('staff_view')) {
        managementItems.push({ title: "Route Management", href: "/admin/routes", iconName: "Map" });
    }
    if (hasPermission('knowledge_base_manage')) managementItems.push({ title: "Knowledge Base", href: "/admin/knowledge-base", iconName: "BookText" });
    if (hasPermission('bill:view_drafts') || hasPermission('bill:approve') || hasPermission('bill:create') || hasPermission('bill:manage_all')) {
        managementItems.push({ title: "Bill Management", href: "/admin/bill-management", iconName: "FileText" });
    }

    if (managementItems.length > 0) {
        managementItems.push({ title: "Fault Codes", href: "/admin/fault-codes", iconName: "AlertOctagon" });
        navItems.push({ title: "Management", items: managementItems });
    }

    const customerMeteringItems: NavItem[] = [];
    if (hasPermission('bulk_meters_view_all') || hasPermission('bulk_meters_view_branch')) customerMeteringItems.push({ title: "Bulk Meters", href: "/admin/bulk-meters", iconName: "Gauge" });
    if (hasPermission('customers_view_all') || hasPermission('customers_view_branch')) customerMeteringItems.push({ title: "Individual Customers", href: "/admin/individual-customers", iconName: "Users" });

    if (customerMeteringItems.length > 0) {
        navItems.push({ title: "Customer & Metering", items: customerMeteringItems });
    }

    const dataReportsItems: NavItem[] = [];
    if (hasPermission('data_entry_access')) dataReportsItems.push({ title: "Data Entry", href: "/admin/data-entry", iconName: "FileText" });
    if (hasPermission('meter_readings_view_all') || hasPermission('meter_readings_view_branch')) dataReportsItems.push({ title: "Meter Readings", href: "/admin/meter-readings", iconName: "ClipboardList" });
    if (hasPermission('reports_generate_all') || hasPermission('reports_generate_branch')) {
        dataReportsItems.push({ title: "Reports", href: "/admin/reports", iconName: "BarChart2" });
        dataReportsItems.push({ title: "List Of Paid Bills", href: "/admin/reports/paid-bills", iconName: "CheckCircle2" });
        dataReportsItems.push({ title: "List Of Sent Bills", href: "/admin/reports/sent-bills", iconName: "Send" });
        dataReportsItems.push({ title: "List of Unsettled Bills", href: "/admin/reports/unsettled-bills", iconName: "FileClock" });
    }

    if (dataReportsItems.length > 0) {
        navItems.push({ title: "Data & Reports", items: dataReportsItems });
    }

    const settingsItems: NavItem[] = [];
    if (hasPermission('settings_view')) settingsItems.push({ title: "Settings", href: "/admin/settings", iconName: "Settings" });
    // Add Security Logs for all users with settings access
    settingsItems.push({ title: "Security Logs", href: "/admin/security-logs", iconName: "Shield" });
    settingsItems.push({ title: "Recycle Bin", href: "/admin/recycle-bin", iconName: "Trash2" });

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