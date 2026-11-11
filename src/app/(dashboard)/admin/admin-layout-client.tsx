"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { useRouter, usePathname } from 'next/navigation';
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { AppShell } from "@/components/layout/app-shell";
import { PermissionsContext, type PermissionsContextType } from '@/hooks/use-permissions';
import { getLatestPermissionsAction } from "@/lib/actions";
import { PERMISSIONS } from '@/lib/constants/auth';
import { subscribePermissionsSync } from '@/lib/permissions-sync';
import { useToast } from '@/hooks/use-toast';
import { getRoutePermissionRule } from '@/lib/route-permissions';
import { PenaltyEngineBanner } from '@/components/penalty-engine-banner';
import { buildSidebarNavItems, type UserProfile } from '@/lib/nav-builder';

export { buildSidebarNavItems, type UserProfile };

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
        const hasBillManageAll = permSet.has('bill:manage_all');
        return {
            permissions: permSet,
            hasPermission: (permission: string) => {
                if (!user) return false;
                if (isWildcard) return true;
                if (hasBillManageAll && (permission.startsWith('bill:') || permission === 'billing:close_cycle')) return true;
                return permSet.has(permission);
            },
            hasAnyPermission: (...pList: string[]) => {
                if (!user) return false;
                if (isWildcard) return true;
                if (hasBillManageAll && pList.some(p => p.startsWith('bill:') || p === 'billing:close_cycle')) return true;
                return pList.some(p => permSet.has(p));
            },
            hasAllPermissions: (...pList: string[]) => {
                if (!user) return false;
                if (isWildcard) return true;
                return pList.every(p => {
                    if (hasBillManageAll && (p.startsWith('bill:') || p === 'billing:close_cycle')) return true;
                    return permSet.has(p);
                });
            },
            refreshPermissions
        };
    }, [user, refreshPermissions]);

    return (
        <PermissionsContext.Provider value={permissionsValue}>
            <AppShell user={user} userRole="admin" sidebar={<SidebarNav items={navItems} />} >
                <PenaltyEngineBanner />
                {children}
            </AppShell>
        </PermissionsContext.Provider>
    );
}