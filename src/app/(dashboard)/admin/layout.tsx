
"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Skeleton } from "@/components/ui/skeleton";

import { PERMISSIONS } from "@/lib/constants/auth";

// Dynamically import the client-side wrapper to prevent SSR issues with localStorage
const AdminLayoutClient = dynamic(() => import('@/app/(dashboard)/admin/admin-layout-client'), {
  loading: () => (
     <div className="flex items-center justify-center h-screen">
       <Skeleton className="h-16 w-16 rounded-full" />
     </div>
  ),
  ssr: false, // Ensure this component only renders on the client
});

interface UserProfile {
  id: string; 
  email: string;
  role: string;
  permissions?: string[];
  branchName?: string;
  branchId?: string;
  name?: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = React.useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const router = useRouter();
    const pathname = usePathname();

    React.useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            try {
                const parsedUser: UserProfile = JSON.parse(storedUser);
                const userPermissions = parsedUser.permissions || [];

                // Allow access if user has the high-level dashboard permission
                if (userPermissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL)) {
                    setUser(parsedUser);
                } else {
                    router.replace("/"); // Not authorized for this layout
                }
            } catch (e) {
                console.error("Failed to parse user from localStorage", e);
                router.replace("/");
            }
        } else {
            router.replace("/");
        }
        setIsLoading(false);
    }, [router, pathname]);

    if (isLoading) {
       return (
         <div className="flex items-center justify-center h-screen">
           <Skeleton className="h-16 w-16 rounded-full" />
         </div>
       );
    }

    if (!user) {
        return null; // Render nothing while redirecting
    }

  // Ensure we only pass plain serializable objects to the client component.
  // Defensive deep-clone removes prototypes, Sets, Dates, etc.
  const safeUser = user ? JSON.parse(JSON.stringify(user)) : null;
  return <AdminLayoutClient user={safeUser}>{children}</AdminLayoutClient>;
}
