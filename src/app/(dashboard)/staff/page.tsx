
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
        const hasStaffManagementAccess = assignedPermissions.includes('staff_view') || assignedPermissions.includes('staff_view_all') || assignedPermissions.includes('staff_view_branch');

        if (hasStaffManagementAccess && !assignedPermissions.includes('bill_view_all')) {
          router.replace('/staff/staff-management-dashboard');
          return;
        }

        if (hasDashboardAccess) {
          router.replace('/staff/dashboard');
          return;
        }

        // If user has route permissions
        const hasRouteAccess = assignedPermissions.some((p: string) => 
          ['routes_view', 'routes_view_all', 'routes_view_branch', 'routes_view_assigned', 'routes_manage', 'routes_create', 'routes_update', 'routes_delete', 'meter_readings_create', 'meter_readings_create_bulk', 'meter_readings_create_individual', 'reader_progress_view'].includes(p)
        );
        if (hasRouteAccess) {
          router.replace('/staff/my-routes');
          return;
        }

        // If user has data entry access
        const hasDataEntryAccess = assignedPermissions.some((p: string) => 
          ['data_entry_access', 'customers_create', 'bulk_meters_create', 'data_entry_bulk_form', 'data_entry_individual_form', 'data_entry_bulk_csv', 'data_entry_individual_csv'].includes(p)
        );
        if (hasDataEntryAccess) {
          router.replace('/staff/data-entry');
          return;
        }

        // If user has reports access
        const hasReportsAccess = assignedPermissions.some((p: string) => 
          ['reports_generate_all', 'reports_generate_branch', 'report:list_of_paid_bills', 'report:list_of_sent_bills', 'bill:view_paid', 'bill:send', 'bill:view_unpaid'].includes(p)
        );
        if (hasReportsAccess) {
          router.replace('/staff/reports');
          return;
        }

        // If user has customer access
        if (assignedPermissions.includes('customers_view_all') || assignedPermissions.includes('customers_view_branch')) {
          router.replace('/staff/individual-customers');
          return;
        }

        // If user has bulk meter access
        if (assignedPermissions.includes('bulk_meters_view_all') || assignedPermissions.includes('bulk_meters_view_branch')) {
          router.replace('/staff/bulk-meters');
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
