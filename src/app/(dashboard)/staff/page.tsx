
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

// This page now acts only as a redirector to the staff dashboard.
export default function StaffRedirectPage() { 
  const router = useRouter();

  useEffect(() => {
    // Immediately redirect to the actual dashboard page.
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
