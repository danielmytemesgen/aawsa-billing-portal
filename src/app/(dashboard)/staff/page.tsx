
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

// This page acts as a role-aware redirector to the correct staff dashboard.
export default function StaffRedirectPage() { 
  const router = useRouter();

  useEffect(() => {
    // Check user role and redirect to the appropriate dashboard.
    try {
      const userString = localStorage.getItem("user");
      if (userString) {
        const user = JSON.parse(userString);
        const role = (user.role || '').toLowerCase();
        const assignedPermissions = Array.isArray(user.permissions) ? user.permissions : [];
        const hasDashboardAccess = assignedPermissions.includes('dashboard_view_all') || assignedPermissions.includes('dashboard_view_branch');

        if (role === 'staff management') {
          router.replace('/staff/staff-management-dashboard');
          return;
        }

        if (hasDashboardAccess) {
          router.replace('/staff/dashboard');
          return;
        }
      }
    } catch (e) {
      // ignore parse errors
    }
    router.replace('/staff/dashboard');
  }, [router]);

  // Render a simple loading state while redirecting.
  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
    </div>
  );
}
