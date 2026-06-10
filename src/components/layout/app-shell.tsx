'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  Menu,
  UserCircle,
  Sun,
  WifiOff,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useIdleTimeout } from '@/hooks/use-idle-timeout';
import { NotificationBell } from './notification-bell';
import { PERMISSIONS } from '@/lib/constants/auth';
import { SupportChatbot } from './support-chatbot';
import { PwaRegistry } from '@/components/layout/pwa-registry';
import { SyncHub } from './sync-hub';

import { useNetworkStatus } from '@/hooks/use-network-status';
import { logoutAction } from '@/lib/auth-actions';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  roleId?: number;
  permissions?: string[];
  branchName?: string;
  branchId?: string;
  name?: string;
}

interface AppHeaderContentProps {
  user: UserProfile | null;
  appName?: string;
  onLogout: () => void;
}

function AppHeaderContent({ user, appName = "AAWSA Billing Portal", onLogout }: AppHeaderContentProps) {
  const { isMobile, state: sidebarState } = useSidebar();
  const { pendingCount } = useNetworkStatus();

  let dashboardHref = "/";
  if (user) {
    const role = user.role.toLowerCase().trim();
    const permissions = user.permissions || [];
    const isAdminArea = permissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL);

    if (isAdminArea) {
      dashboardHref = '/admin/dashboard';
    } else {
      dashboardHref = '/staff/dashboard';
    }
  }

  const toggleOutdoorMode = () => {
    document.documentElement.classList.toggle('theme-outdoor');
  };

  return (
    <header className={cn(
      "sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b px-3 sm:px-4 transition-all no-print",
      "bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-md sm:px-6"
    )}>
      <SidebarTrigger className="text-white hover:bg-white/20 -ml-1 h-10 w-10 flex-shrink-0">
        <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
        <span className="sr-only">Toggle Menu</span>
      </SidebarTrigger>

      <div className="flex flex-1 items-center justify-between min-w-0">
        <Link href={dashboardHref} className="flex items-center gap-2 font-bold min-w-0">
          <div className="bg-white p-1 rounded-sm shadow-sm flex items-center justify-center flex-shrink-0">
            <Image
              src="https://veiethiopia.com/photo/partner/par2.png"
              alt="AAWSA Logo"
              width={32}
              height={20}
              className="flex-shrink-0 transition-transform active:scale-95"
            />
          </div>
          <span className="truncate text-white text-sm sm:text-base md:text-lg hidden xs:block">
            AAWSA Bulk Bill
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleOutdoorMode}
            className="overflow-hidden rounded-full h-9 w-9 text-white hover:bg-white/20 flex-shrink-0"
            title="Toggle Outdoor Legibility Mode"
          >
            <Sun className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
          {user && <NotificationBell user={user} className="text-white hover:bg-white/10" />}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative overflow-visible rounded-full h-9 w-9 text-white hover:bg-white/20 flex-shrink-0">
                  <UserCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm ring-1 ring-white animate-bounce">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none truncate">{user.name || user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Role: {user.role}
                </DropdownMenuLabel>
                {user.branchName && (
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal -mt-2">
                    Branch: {user.branchName}
                  </DropdownMenuLabel>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell({ user, userRole, sidebar, children }: { user: UserProfile | null, userRole: 'admin' | 'staff', children: React.ReactNode, sidebar?: React.ReactNode }) {
  const router = useRouter();
  const [appName, setAppName] = React.useState("AAWSA Billing Portal");
  const currentYear = new Date().getFullYear();
  const { isOnline, wasOffline, pendingCount } = useNetworkStatus();
  const [syncProgress, setSyncProgress] = React.useState<{ syncing: boolean; success: number; failed: number; total: number } | null>(null);

  const handleLogout = React.useCallback(async () => {
    // 1. Clear all client-side session data immediately
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem("user");
      window.localStorage.removeItem("session_expires_at");
      window.localStorage.removeItem("last-read-timestamp");
    }
    // 2. Clear IndexedDB cached session (client-side, works offline)
    try {
      const { clearSessionToken } = await import('@/lib/offline-db');
      await clearSessionToken();
    } catch (_e) { /* ignore – IndexedDB may not be available */ }

    // 3. Attempt server-side cookie clear (may fail if offline — that's OK)
    try {
      await logoutAction();
    } catch (e) {
      console.warn("Server logout action failed (offline?). Proceeding with client-side logout.", e);
    }

    // 4. Always redirect to login page regardless of server action outcome
    router.push("/");
  }, [router]);

  useIdleTimeout(handleLogout);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const storedAppName = window.localStorage.getItem("aawsa-app-name");
    if (storedAppName) {
      setAppName(storedAppName);
      document.title = storedAppName;
    }

    const storedDarkMode = window.localStorage.getItem("aawsa-dark-mode-default");
    document.documentElement.classList.toggle('dark', storedDarkMode === "true");

  }, []);

  React.useEffect(() => {
    const handleSyncProgress = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSyncProgress(detail);
    };

    window.addEventListener('sync-progress', handleSyncProgress);
    return () => {
      window.removeEventListener('sync-progress', handleSyncProgress);
    };
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <PwaRegistry />
      <Sidebar variant="sidebar" collapsible={true} className={cn("border-r border-sidebar-border bg-sidebar text-sidebar-foreground no-print")}>
        <SidebarHeader className="p-2" />
        <SidebarContent className="overflow-y-auto">
          {sidebar}
        </SidebarContent>
        {user && (
          <SidebarFooter className="p-2 border-t border-sidebar-border bg-sidebar">
            <SyncHub />
          </SidebarFooter>
        )}
      </Sidebar>
      <SidebarInset className="min-w-0 flex flex-col">
        <AppHeaderContent user={user} appName={appName} onLogout={handleLogout} />
        {/* Network and Sync Status Banners */}
        <div className="no-print">
          {syncProgress?.syncing ? (
            <div className="bg-blue-600 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300 animate-pulse shadow-inner">
              <RefreshCw className="h-4 w-4 animate-spin flex-shrink-0" />
              <span>Syncing offline readings: {syncProgress.success + syncProgress.failed} / {syncProgress.total}...</span>
            </div>
          ) : !isOnline ? (
            <div className="bg-amber-600 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300 shadow-inner">
              <WifiOff className="h-4 w-4 animate-pulse flex-shrink-0" />
              <span>You are currently working offline. {pendingCount > 0 ? `${pendingCount} reading(s) queued for sync.` : 'Your changes will be saved locally.'}</span>
            </div>
          ) : (wasOffline || (syncProgress && !syncProgress.syncing && syncProgress.success > 0)) ? (
            <div className="bg-emerald-600 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300 shadow-inner">
              <CheckCircle2 className="h-4 w-4 animate-bounce flex-shrink-0" />
              <span>Connectivity restored! Offline readings synchronized successfully.</span>
            </div>
          ) : null}
        </div>
        <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 bg-background overflow-x-hidden">
          {children}
        </main>
        <footer className="text-xs text-center text-muted-foreground p-3 sm:p-4 no-print">
          Design and Developed by Daniel Temesgen &copy; {currentYear} {appName}. All rights reserved.
        </footer>
        <SupportChatbot />
      </SidebarInset>
    </SidebarProvider>
  );
}
