'use client';

import React from 'react';
import { Caller360Console } from '@/features/call-center/components/Caller360Console';
import { Headphones } from 'lucide-react';

export default function AdminCallCenterPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider">
            <Headphones className="h-4 w-4" />
            <span>AAWSA Customer Care Operations</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-1">Call Center Caller 360° Console</h1>
          <p className="text-sm text-gray-500">
            Real-time customer account lookup, billing and consumption verification, and on-call interaction logging.
          </p>
        </div>
      </div>

      <Caller360Console isAdmin={true} />
    </div>
  );
}
