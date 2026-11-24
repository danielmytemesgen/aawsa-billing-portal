'use client';

import React from 'react';
import { CallHistoryTable } from '@/features/call-center/components/CallHistoryTable';
import { History } from 'lucide-react';

export default function AdminCallLogsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider">
            <History className="h-4 w-4" />
            <span>Call Center Records</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-1">Call Logs &amp; Audit Trail</h1>
          <p className="text-sm text-gray-500">
            Historical telephone interactions, resolution outcomes, and agent notes recorded across authority operations.
          </p>
        </div>
      </div>

      <CallHistoryTable />
    </div>
  );
}
