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
    else if (role === 'staff') dashboardHref = '/staff/dashboard';
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {isMobile ? (
        <SidebarTrigger className="sm:hidden -ml-2">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </SidebarTrigger>
      ) : (
        <SidebarTrigger className={cn(sidebarState === "expanded" && "group-data-[collapsible=icon]:hidden")}/>
      )}

      <div className="flex flex-1 items-center justify-between">
        <Link href={dashboardHref} className="flex items-center gap-2 text-lg font-semibold">
          <Image
            src="https://veiethiopia.com/photo/partner/par2.png"
            alt="AAWSA Logo"
            width={48}
            height={30}
            className="flex-shrink-0" 
          />
          <span className="hidden sm:inline-block">{appName}</span>
        </Link>
        <div className="flex items-center gap-4">
          {user && <NotificationBell user={user} />}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="overflow-hidden rounded-full h-8 w-8">
                  <UserCircle className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="truncate max-w-[200px]">{user.name || user.email}</DropdownMenuLabel>
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal -mt-2">
                  Role: {user.role}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
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
