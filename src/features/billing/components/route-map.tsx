"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const RouteMapInner = dynamic(
  () => import('./route-map-inner'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[600px] w-full bg-slate-50 flex flex-col items-center justify-center rounded-xl border border-blue-100 shadow-sm">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading map...</p>
      </div>
    )
  }
);

export function RouteMap(props: any) {
  return <RouteMapInner {...props} />;
}
