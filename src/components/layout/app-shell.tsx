'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  Menu,
  UserCircle,
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

  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useIdleTimeout } from '@/hooks/use-idle-timeout';
import { NotificationBell } from './notification-bell';
import { PERMISSIONS } from '@/lib/constants/auth';

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
          {user && <NotificationBell user={user} className="text-white hover:bg-white/10" />}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="overflow-hidden rounded-full h-9 w-9 text-white hover:bg-white/20 flex-shrink-0">
                  <UserCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none truncate">{user.name || user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
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

  const handleLogout = React.useCallback(async () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem("user");
      window.localStorage.removeItem("session_expires_at");
      window.localStorage.removeItem("last-read-timestamp");
    }
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

  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        variant="sidebar"
        collapsible={true}
        className={cn("border-r border-sidebar-border bg-sidebar text-sidebar-foreground no-print")}
      >
        <SidebarHeader className="p-2" />
        <SidebarContent className="overflow-y-auto">
          {sidebar}
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-w-0 flex flex-col">
        <AppHeaderContent user={user} appName={appName} onLogout={handleLogout} />
        <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 bg-background overflow-x-hidden">
          {children}
        </main>
        <footer className="text-xs text-center text-muted-foreground p-3 sm:p-4 no-print">
          Design and Developed by Daniel Temesgen
          &copy; {currentYear} {appName}. All rights reserved.
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
