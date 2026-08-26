"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { useRouter, usePathname } from 'next/navigation';
import { SidebarNav, type NavItemGroup, type NavItem } from "@/components/layout/sidebar-nav";
import { AppShell } from "@/components/layout/app-shell";
import { PermissionsContext, type PermissionsContextType } from '@/hooks/use-permissions';
import { getLatestPermissionsAction } from "@/lib/actions";
import { PERMISSIONS } from '@/lib/constants/auth';
import { subscribePermissionsSync } from '@/lib/permissions-sync';
import { useToast } from '@/hooks/use-toast';
import { getRoutePermissionRule } from '@/lib/route-permissions';

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
    const isWildcard = permissions.has('*') || permissions.has('all');

    const hasPermission = (p: string) => isWildcard || permissions.has(p);
    const hasAny = (...pList: string[]) => isWildcard || pList.some(p => permissions.has(p));

    const isGlobalManager = hasAny(PERMISSIONS.DASHBOARD_VIEW_ALL, PERMISSIONS.STAFF_VIEW_ALL, PERMISSIONS.BILL_VIEW_ALL, PERMISSIONS.SETTINGS_MANAGE);
    const isAdmin = isGlobalManager;

    const navItems: NavItemGroup[] = [];

    // 1. Purely permission-based Dashboard link
    let dashboardHref = isGlobalManager ? "/admin/dashboard" : "/staff/dashboard";
    if (hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL) && !hasPermission(PERMISSIONS.STAFF_VIEW)) {
        dashboardHref = '/admin/head-office-dashboard';
    } else if (hasPermission(PERMISSIONS.STAFF_VIEW) && !hasPermission(PERMISSIONS.BILL_VIEW_ALL)) {
        dashboardHref = isGlobalManager ? '/admin/staff-management-dashboard' : '/staff/staff-management-dashboard';
    }

    if (hasAny(PERMISSIONS.DASHBOARD_VIEW_ALL, PERMISSIONS.DASHBOARD_VIEW_BRANCH, PERMISSIONS.ROUTES_VIEW_ASSIGNED, PERMISSIONS.METER_READINGS_CREATE)) {
        navItems.push({
            items: [{ title: "Dashboard", href: dashboardHref, iconName: "LayoutDashboard" }]
        });
    }

    // 2. Field Reading & Route Operations (specifically for assigned readers)
    const canViewAssignedRoutes = hasPermission(PERMISSIONS.ROUTES_VIEW_ASSIGNED);
    const canRecordReadings = hasAny(PERMISSIONS.METER_READINGS_CREATE, PERMISSIONS.METER_READINGS_CREATE_BULK, PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL);
    const canViewReadings = hasAny(PERMISSIONS.METER_READINGS_VIEW_ALL, PERMISSIONS.METER_READINGS_VIEW_BRANCH);
    const canViewProgress = hasPermission(PERMISSIONS.READER_PROGRESS_VIEW);

    const routeOpsItems: NavItem[] = [];
    if (canViewAssignedRoutes) {
        routeOpsItems.push({ title: "My Routes", href: "/staff/my-routes", iconName: "MapPin" });
    }
    if (canRecordReadings || canViewReadings) {
        routeOpsItems.push({ 
            title: "Meter Readings", 
            href: isAdmin ? "/admin/meter-readings" : "/staff/meter-readings", 
            iconName: "ClipboardList" 
        });
    }
    if (canViewProgress) {
        routeOpsItems.push({ title: "Reader Monitoring", href: "/staff/reader-progress", iconName: "Activity" });
    }

    if (routeOpsItems.length > 0) {
        navItems.push({ 
            title: "Field Operations", 
            items: routeOpsItems 
        });
    }

    // 3. Management (Branches, Staff, Approvals, Roles, Tariffs, Route Admin, Knowledge Base, Bill Management, Fault Codes)
    const managementItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.BRANCHES_VIEW)) managementItems.push({ title: "Branch Management", href: isAdmin ? "/admin/branches" : "/staff/branches", iconName: "Building" });
    if (hasPermission(PERMISSIONS.STAFF_VIEW) || hasPermission(PERMISSIONS.STAFF_VIEW_ALL) || hasPermission(PERMISSIONS.STAFF_VIEW_BRANCH)) managementItems.push({ title: "Staff Management", href: isAdmin ? "/admin/staff-management" : "/staff/staff-management", iconName: "UserCog" });
    if (hasPermission(PERMISSIONS.CUSTOMERS_APPROVE) || hasPermission(PERMISSIONS.BULK_METERS_APPROVE) || hasPermission(PERMISSIONS.BILL_APPROVE)) managementItems.push({ title: "Approvals", href: isAdmin ? "/admin/approvals" : "/staff/approvals", iconName: "UserCheck" });
    if (hasPermission(PERMISSIONS.ROLES_VIEW) || hasPermission(PERMISSIONS.ROLES_MANAGE)) managementItems.push({ title: "Roles & Permissions", href: isAdmin ? "/admin/roles-and-permissions" : "/staff/roles-and-permissions", iconName: "ShieldCheck" });
    if (hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW) || hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW_ALL)) managementItems.push({ title: "Notifications", href: isAdmin ? "/admin/notifications" : "/staff/notifications", iconName: "Bell" });
    if (hasPermission(PERMISSIONS.TARIFFS_VIEW) || hasPermission(PERMISSIONS.TARIFFS_MANAGE)) managementItems.push({ title: "Tariff Management", href: isAdmin ? "/admin/tariffs" : "/staff/tariffs", iconName: "LibraryBig" });
    
    const canManageRoutes = hasPermission(PERMISSIONS.ROUTES_VIEW_ALL)
        || hasPermission(PERMISSIONS.ROUTES_MANAGE)
        || hasPermission(PERMISSIONS.ROUTES_VIEW)
        || hasPermission(PERMISSIONS.ROUTES_VIEW_BRANCH)
        || hasPermission(PERMISSIONS.ROUTES_CREATE)
        || hasPermission(PERMISSIONS.ROUTES_UPDATE)
        || hasPermission(PERMISSIONS.ROUTES_DELETE);

    if (canManageRoutes) {
        managementItems.push({ title: "Route Management", href: "/admin/routes", iconName: "Map" });
    }
    if (hasPermission(PERMISSIONS.KNOWLEDGE_BASE_MANAGE) || hasPermission(PERMISSIONS.KNOWLEDGE_BASE_VIEW)) {
        managementItems.push({ title: "Knowledge Base", href: isAdmin ? "/admin/knowledge-base" : "/staff/knowledge-base", iconName: "BookText" });
    }
    if (hasPermission(PERMISSIONS.BILL_VIEW_DRAFTS) || hasPermission(PERMISSIONS.BILL_APPROVE) || hasPermission(PERMISSIONS.BILL_CREATE) || hasPermission(PERMISSIONS.BILL_VIEW_ALL) || hasPermission(PERMISSIONS.BILL_VIEW_BRANCH)) {
        managementItems.push({ title: "Bill Management", href: isAdmin ? "/admin/bill-management" : "/staff/bill-management", iconName: "FileText" });
    }

    const canViewFaultCodes = hasPermission(PERMISSIONS.SETTINGS_MANAGE)
        || hasPermission(PERMISSIONS.BILL_VIEW_ALL)
        || hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL)
        || hasPermission(PERMISSIONS.FAULT_CODES_VIEW)
        || hasPermission(PERMISSIONS.FAULT_CODES_MANAGE);

    // BN-6 fix: Remove isAdmin gate — any role with fault code permissions should see this nav item
    if (canViewFaultCodes) {
        managementItems.push({ title: "Fault Codes", href: isAdmin ? "/admin/fault-codes" : "/staff/fault-codes", iconName: "AlertOctagon" });
    }

    if (managementItems.length > 0) {
        navItems.push({ title: "Management", items: managementItems });
    }

    // 4. Customer & Metering
    const customerMeteringItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.BULK_METERS_VIEW_ALL) || hasPermission(PERMISSIONS.BULK_METERS_VIEW_BRANCH)) {
        customerMeteringItems.push({ 
            title: "Bulk Meters", 
            href: isAdmin ? "/admin/bulk-meters" : "/staff/bulk-meters", 
            iconName: "Gauge" 
        });
    }
    if (hasPermission(PERMISSIONS.CUSTOMERS_VIEW_ALL) || hasPermission(PERMISSIONS.CUSTOMERS_VIEW_BRANCH)) {
        customerMeteringItems.push({ 
            title: "Individual Customers", 
            href: isAdmin ? "/admin/individual-customers" : "/staff/individual-customers", 
            iconName: "Users" 
        });
    }

    if (customerMeteringItems.length > 0) {
        navItems.push({ title: "Customer & Metering", items: customerMeteringItems });
    }

    // 5. Data & Reports
    const dataReportsItems: NavItem[] = [];
    const canAccessDataEntry = hasPermission(PERMISSIONS.DATA_ENTRY_ACCESS) 
        || hasPermission(PERMISSIONS.CUSTOMERS_CREATE) 
        || hasPermission(PERMISSIONS.BULK_METERS_CREATE)
        || hasPermission(PERMISSIONS.DATA_ENTRY_BULK_FORM)
        || hasPermission(PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM)
        || hasPermission(PERMISSIONS.DATA_ENTRY_BULK_CSV)
        || hasPermission(PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV);
    if (canAccessDataEntry) {
        dataReportsItems.push({ 
            title: "Data Entry", 
            href: isAdmin ? "/admin/data-entry" : "/staff/data-entry", 
            iconName: "FileText" 
        });
    }

    const canAccessGeneralReports = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) 
        || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
        || hasPermission(PERMISSIONS.ROUTES_VIEW_ASSIGNED)
        || hasPermission(PERMISSIONS.METER_READINGS_ANALYTICS_VIEW);

    if (canAccessGeneralReports) {
        dataReportsItems.push({ title: "Reports", href: isAdmin ? "/admin/reports" : "/staff/reports", iconName: "BarChart2" });
    }

    const canViewPaidBillsReport = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) 
        || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
        || hasPermission(PERMISSIONS.REPORT_LIST_OF_PAID_BILLS)
        || hasPermission(PERMISSIONS.REPORT_BRANCH_LIST_OF_PAID_BILLS)
        || hasPermission(PERMISSIONS.BILL_VIEW_PAID)
        || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

    if (canViewPaidBillsReport) {
        dataReportsItems.push({ title: "List Of Paid Bills", href: isAdmin ? "/admin/reports/paid-bills" : "/staff/reports/paid-bills", iconName: "CheckCircle2" });
    }

    const canViewSentBillsReport = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) 
        || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
        || hasPermission(PERMISSIONS.REPORT_LIST_OF_SENT_BILLS)
        || hasPermission(PERMISSIONS.REPORT_BRANCH_LIST_OF_SENT_BILLS)
        || hasPermission(PERMISSIONS.BILL_SEND)
        || hasPermission(PERMISSIONS.BILL_POST)
        || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

    if (canViewSentBillsReport) {
        dataReportsItems.push({ title: "List Of Sent Bills", href: isAdmin ? "/admin/reports/sent-bills" : "/staff/reports/sent-bills", iconName: "Send" });
    }

    const canViewUnsettledBillsReport = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) 
        || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
        || hasPermission(PERMISSIONS.BILL_VIEW_UNPAID)
        || hasPermission(PERMISSIONS.BILL_VIEW_OVERDUE)
        || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

    if (canViewUnsettledBillsReport) {
        dataReportsItems.push({ title: "List of Unsettled Bills", href: isAdmin ? "/admin/reports/unsettled-bills" : "/staff/reports/unsettled-bills", iconName: "FileClock" });
    }

    if (dataReportsItems.length > 0) {
        navItems.push({ title: "Data & Reports", items: dataReportsItems });
    }

    // 6. System Settings
    const settingsItems: NavItem[] = [];
    if (hasPermission(PERMISSIONS.SETTINGS_VIEW) || hasPermission(PERMISSIONS.SETTINGS_MANAGE)) {
        settingsItems.push({ title: "Settings", href: isAdmin ? "/admin/settings" : "/staff/settings", iconName: "Settings" });
    }
    if (hasPermission(PERMISSIONS.SETTINGS_VIEW) || hasPermission(PERMISSIONS.SETTINGS_MANAGE) || hasPermission(PERMISSIONS.PROMOTIONS_MANAGE) || hasPermission(PERMISSIONS.PROMOTIONS_VIEW)) {
        settingsItems.push({ title: "Promotions", href: isAdmin ? "/admin/settings/promotions" : "/staff/settings/promotions", iconName: "Megaphone" });
    }
    if (hasPermission(PERMISSIONS.SETTINGS_MANAGE)) {
        settingsItems.push({ title: "Security Logs", href: "/admin/security-logs", iconName: "Shield" });
        settingsItems.push({ title: "Recycle Bin", href: "/admin/recycle-bin", iconName: "Trash2" });
        settingsItems.push({ title: "System Maintenance", href: "/admin/maintenance", iconName: "Activity" });
    }

    if (settingsItems.length > 0) {
        navItems.push({ title: "System", items: settingsItems });
    }

    return navItems;
};


interface AdminLayoutClientProps {
    children: React.ReactNode;
    user: UserProfile | null;
}


export default function AdminLayoutClient({ children, user: initialUser }: AdminLayoutClientProps) {
    const [user, setUser] = React.useState<UserProfile | null>(initialUser);
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();

    const refreshPermissions = React.useCallback(async () => {
        try {
            const result = await getLatestPermissionsAction();
            if (result.data && !result.error) {
                const latestPermissions = Array.isArray(result.data) ? result.data : String(result.data).split(',');
                setUser(prev => {
                    if (!prev) return null;
                    const prevPerms = prev.permissions || [];
                    const isChanged = prevPerms.length !== latestPermissions.length ||
                        latestPermissions.some((p: string) => !prevPerms.includes(p)) ||
                        prevPerms.some((p: string) => !latestPermissions.includes(p));
                    if (!isChanged) return prev;

                    // BN-5 fix: Detect if user lost access to current route
                    const currentPath = window.location.pathname;
                    const rule = getRoutePermissionRule(currentPath, latestPermissions);
                    let lostAccess = false;
                    if (rule) {
                        const hasPerm = (p: string) => latestPermissions.includes('*') || latestPermissions.includes('all') || latestPermissions.includes(p);
                        if (rule.requiredPermissions && !rule.requiredPermissions.every(p => hasPerm(p))) {
                            lostAccess = true;
                        } else if (rule.anyOf && !rule.anyOf.some(p => hasPerm(p))) {
                            lostAccess = true;
                        }
                    }

                    if (lostAccess) {
                        // Notify and redirect after a short delay to allow state to settle
                        setTimeout(() => {
                            toast({
                                variant: 'destructive',
                                title: 'Access Revoked',
                                description: 'Your permissions were updated. You have been redirected to your dashboard.',
                            });
                            const isGlobal = latestPermissions.includes('*') || latestPermissions.includes('all') || latestPermissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL);
                            router.replace(isGlobal ? '/admin/dashboard' : '/staff/dashboard');
                        }, 300);
                    } else if (prevPerms.length !== latestPermissions.length) {
                        // Permissions changed but user still has access — silent notification
                        setTimeout(() => {
                            toast({
                                title: 'Permissions Updated',
                                description: 'Your access permissions have been refreshed.',
                            });
                        }, 300);
                    }

                    const updatedUser = { ...prev, permissions: latestPermissions };
                    localStorage.setItem("user", JSON.stringify(updatedUser));
                    try {
                        window.dispatchEvent(new CustomEvent('user-permissions-updated', { detail: latestPermissions }));
                        window.dispatchEvent(new Event('storage'));
                    } catch (_) {}
                    return updatedUser;
                });
            }
        } catch (err) {
            console.warn("Permission sync background check skipped:", err);
        }
    }, [router, toast]);

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
            // Real-time live check on mount
            await refreshPermissions();
        };

        fetchUser();

        const handlePermissionsUpdate = () => {
            refreshPermissions();
        };

        // Real-time background sync interval (checks every 20s for permission alterations)
        const intervalId = setInterval(() => {
            refreshPermissions();
        }, 20_000);

        // Immediate sync on tab refocus
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshPermissions();
            }
        };

        const unsubscribeSync = subscribePermissionsSync(handlePermissionsUpdate);
        window.addEventListener('user-permissions-updated', handlePermissionsUpdate);
        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handlePermissionsUpdate);

        return () => {
            clearInterval(intervalId);
            unsubscribeSync();
            window.removeEventListener('user-permissions-updated', handlePermissionsUpdate);
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handlePermissionsUpdate);
        };
    }, [refreshPermissions]);

    const navItems = buildSidebarNavItems(user);

    const permissionsValue: PermissionsContextType = React.useMemo(() => {
        const permSet = new Set(user?.permissions || []);
        const isWildcard = permSet.has('*') || permSet.has('all');
        return {
            permissions: permSet,
            hasPermission: (permission: string) => {
                if (!user) return false;
                return isWildcard || permSet.has(permission);
            },
            hasAnyPermission: (...pList: string[]) => {
                if (!user) return false;
                return isWildcard || pList.some(p => permSet.has(p));
            },
            hasAllPermissions: (...pList: string[]) => {
                if (!user) return false;
                return isWildcard || pList.every(p => permSet.has(p));
            },
            refreshPermissions
        };
    }, [user, refreshPermissions]);

    return (
        <PermissionsContext.Provider value={permissionsValue}>
            <AppShell user={user} userRole="admin" sidebar={<SidebarNav items={navItems} />} >
                {children}
            </AppShell>
        </PermissionsContext.Provider>
    );
}