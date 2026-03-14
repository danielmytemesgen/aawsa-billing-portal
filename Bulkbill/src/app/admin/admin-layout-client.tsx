"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { SidebarNav, type NavItemGroup, type NavItem } from "@/components/layout/sidebar-nav";
import { AppShell } from "@/components/layout/app-shell";
import { PermissionsContext, type PermissionsContextType } from '@/hooks/use-permissions';
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

const buildSidebarNavItems = (user: UserProfile | null): NavItemGroup[] => {
    if (!user) return [];

    const permissions = new Set(user.permissions || []);
    const userRoleLower = user.role.toLowerCase();

    const hasPermission = (p: string) => userRoleLower === 'admin' || permissions.has(p);

    const navItems: NavItemGroup[] = [];

    let dashboardHref = "/admin/dashboard"; // Default for Admin
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
    if (hasPermission('knowledge_base_manage')) managementItems.push({ title: "Knowledge Base", href: "/admin/knowledge-base", iconName: "BookText" });

    if (managementItems.length > 0) {
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

    const securityItems: NavItem[] = [];
    if (hasPermission('security_logs_view')) securityItems.push({ title: "Security Logs", href: "/admin/security-logs", iconName: "Shield" });

    if (securityItems.length > 0) {
        navItems.push({ title: "Security", items: securityItems });
    }

    if (hasPermission('settings_view')) {
        navItems.push({
            items: [{ title: "Settings", href: "/admin/settings", iconName: "Settings" }]
        });
    }

    return navItems;
}


interface AdminLayoutClientProps {
    children: React.ReactNode;
    user: UserProfile | null;
}


export default function AdminLayoutClient({ children, user: initialUser }: AdminLayoutClientProps) {
    const [user, setUser] = React.useState<UserProfile | null>(initialUser);

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
                }
            }
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
    }, []);

    const navItems = buildSidebarNavItems(user);

    const permissionsValue: PermissionsContextType = React.useMemo(() => ({
        permissions: new Set(user?.permissions || []),
        hasPermission: (permission: string) => {
            const userRoleLower = user?.role.toLowerCase();
            return userRoleLower === 'admin' || (user?.permissions?.includes(permission) || false);
        }
    }), [user]);

    return (
        <PermissionsContext.Provider value={permissionsValue}>
            <AppShell user={user} userRole="admin" sidebar={<SidebarNav items={navItems} />} >
                {children}
            </AppShell>
        </PermissionsContext.Provider>
    );
}