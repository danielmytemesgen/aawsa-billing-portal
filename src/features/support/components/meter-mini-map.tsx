'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';

const DynamicInnerMap = dynamic(() => import('./meter-mini-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-gray-200 bg-gray-50 h-44 w-full flex flex-col items-center justify-center p-4 gap-2">
      <MapPin className="h-6 w-6 text-blue-500 animate-bounce" />
      <Skeleton className="h-3 w-36" />
      <span className="text-[11px] text-gray-500">Loading GIS Meter Location...</span>
    </div>
  ),
});

export interface MeterMiniMapProps {
  latitude?: number | null;
  longitude?: number | null;
  customerName?: string;
  customerKey: string;
  meterKey?: string;
  specificArea?: string;
  isPhysicalIssue?: boolean;
  issueTitle?: string;
}

export function MeterMiniMap(props: MeterMiniMapProps) {
  // If coordinates are missing or invalid
  if (
    props.latitude == null ||
    props.longitude == null ||
    isNaN(props.latitude) ||
    isNaN(props.longitude)
  ) {
    return (
      <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-blue-900 text-xs">
        <div className="flex items-center gap-1.5 font-semibold">
          <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span>Physical Meter Coordinates</span>
        </div>
        <p className="text-[11px] text-gray-600 mt-1">
          GPS coordinates not registered for meter {props.meterKey || props.customerKey}. Dispatch crew can verify location upon site arrival.
        </p>
      </div>
    );
  }

  return (
    <DynamicInnerMap
      latitude={props.latitude}
      longitude={props.longitude}
      customerName={props.customerName}
      customerKey={props.customerKey}
      meterKey={props.meterKey}
      specificArea={props.specificArea}
      isPhysicalIssue={props.isPhysicalIssue}
      issueTitle={props.issueTitle}
    />
  );
}
