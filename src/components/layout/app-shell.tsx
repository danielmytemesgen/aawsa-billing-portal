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
import { ChatbotWidget } from '@/components/chatbot-widget';

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
    const role = user.role.toLowerCase();
    if (role === 'admin') dashboardHref = '/admin/dashboard';
    else if (role === 'head office management') dashboardHref = '/admin/head-office-dashboard';
    else if (role === 'staff management') dashboardHref = '/admin/staff-management-dashboard';
    else dashboardHref = '/staff/dashboard';
  }

  return (
    <header className={cn(
      "sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-4 transition-all no-print",
      "bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-md sm:px-6"
    )}>
      <SidebarTrigger className="text-white hover:bg-white/20 -ml-2 h-10 w-10">
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle Menu</span>
      </SidebarTrigger>

      <div className="flex flex-1 items-center justify-between">
        <Link href={dashboardHref} className="flex items-center gap-2 text-lg font-bold truncate">
          <div className="bg-white p-1 rounded-sm shadow-sm flex items-center justify-center">
            <Image
              src="https://veiethiopia.com/photo/partner/par2.png"
              alt="AAWSA Logo"
              width={36}
              height={22}
              className="flex-shrink-0 transition-transform active:scale-95"
            />
          </div>
          <span className="truncate transition-colors text-white text-base md:text-lg">
            AAWSA Bulk Bill
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {user && <NotificationBell user={user} className="text-white hover:bg-white/10" />}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="overflow-hidden rounded-full h-9 w-9 text-white hover:bg-white/20">
                  <UserCircle className="h-6 w-6" />
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
      <Sidebar variant="sidebar" collapsible="icon" className={cn("border-r border-sidebar-border bg-sidebar text-sidebar-foreground no-print")}>
        <SidebarHeader className="p-2">
        </SidebarHeader>
        <SidebarContent>
          {sidebar}
        </SidebarContent>

      </Sidebar>
      <SidebarInset>
        <AppHeaderContent user={user} appName={appName} onLogout={handleLogout} />
        <main className="flex-1 p-4 sm:p-6 space-y-6 bg-background">
          {children}
        </main>
        <footer className="text-xs text-center text-muted-foreground p-4 no-print">
          Design and Developed by Daniel Temesgen
          &copy; {currentYear} {appName}. All rights reserved.
        </footer>
        <div className="no-print">
          <ChatbotWidget />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
