"use client";

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataRefreshProvider } from '@/lib/data-refresh-context';

const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DataRefreshProvider>
        {children}
      </DataRefreshProvider>
    </QueryClientProvider>
  );
}
