'use client';

import React from 'react';
import { SupportDashboard } from '@/features/support/components/support-dashboard';
import { LifeBuoy } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/constants/auth';

export default function StaffSupportPage() {
  const { hasPermission } = usePermissions();
  const isGlobal = hasPermission(PERMISSIONS.SUPPORT_VIEW_ALL) ||
    hasPermission('support:view_all') ||
    hasPermission(PERMISSIONS.SUPPORT_MANAGE) ||
    hasPermission('*') ||
    hasPermission('admin');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider">
            <LifeBuoy className="h-4 w-4" />
            <span>Branch Customer Care Queue</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-1">Customer Service & Support</h1>
          <p className="text-sm text-gray-500">
            View branch support requests, resolve customer inquiries, and respond to water service tickets.
          </p>
        </div>
      </div>

      <SupportDashboard isGlobalAdmin={isGlobal} basePath="/staff/support" />
    </div>
  );
}
