"use client";

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataRefreshProvider } from '@/lib/data-refresh-context';
import IdleTimeoutWarning from '@/components/IdleTimeoutWarning';

const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DataRefreshProvider>
        {children}
        {/* Session idle timeout: warns at 25 min, auto-logout at 30 min */}
        <IdleTimeoutWarning
          idleTimeoutMs={30 * 60 * 1000}
          warningBeforeMs={5 * 60 * 1000}
        />
      </DataRefreshProvider>
    </QueryClientProvider>
  );
}
