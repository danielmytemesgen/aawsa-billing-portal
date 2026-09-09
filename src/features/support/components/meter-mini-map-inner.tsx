'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  ExternalLink, 
  Copy, 
  Check, 
  Navigation,
  AlertTriangle 
} from 'lucide-react';

interface MeterMiniMapInnerProps {
  latitude: number;
  longitude: number;
  customerName?: string;
  customerKey: string;
  meterKey?: string;
  specificArea?: string;
  isPhysicalIssue?: boolean;
  issueTitle?: string;
}

export default function MeterMiniMapInner({
  latitude,
  longitude,
  customerName,
  customerKey,
  meterKey,
  specificArea,
  isPhysicalIssue = false,
  issueTitle
}: MeterMiniMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [copied, setCopied] = useState(false);

  // Validate coordinates
  const isValidCoord = 
    typeof latitude === 'number' && 
    typeof longitude === 'number' && 
    !isNaN(latitude) && 
    !isNaN(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180;

  useEffect(() => {
    if (!mapContainerRef.current || !isValidCoord) return;

    if (!mapRef.current) {
      try {
        const map = L.map(mapContainerRef.current, {
          center: [latitude, longitude],
          zoom: 16,
          zoomControl: true,
          attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        // Custom pulsing SVG marker icon
        const iconHtml = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
            <div style="
              position: absolute;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background-color: ${isPhysicalIssue ? 'rgba(239, 68, 68, 0.35)' : 'rgba(37, 99, 235, 0.3)'};
              animation: pulse 2s infinite ease-out;
            "></div>
            <div style="
              position: relative;
              width: 22px;
              height: 22px;
              border-radius: 50%;
              background: ${isPhysicalIssue ? '#dc2626' : '#2563eb'};
              border: 2px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 11px;
            ">
              💧
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'meter-location-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18]
        });

        const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);

        const popupContent = `
          <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4; min-width: 170px;">
            <div style="font-weight: 700; color: #1e3a8a; margin-bottom: 2px;">
              ${meterKey ? `Meter: ${meterKey}` : 'Meter Location'}
            </div>
            <div style="color: #4b5563; font-size: 10px;">Cust: ${customerName || customerKey}</div>
            ${specificArea ? `<div style="color: #6b7280; font-size: 10px;">${specificArea}</div>` : ''}
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e5e7eb; font-family: monospace; font-size: 10px; color: #374151;">
              GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        mapRef.current = map;
        markerRef.current = marker;

        // Force resize recalculation in case container expanded
        setTimeout(() => {
          map.invalidateSize();
        }, 150);
      } catch (err) {
        console.error('Leaflet mini map error:', err);
      }
    } else {
      mapRef.current.setView([latitude, longitude], 16);
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      }
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, isValidCoord, isPhysicalIssue, customerName, customerKey, meterKey, specificArea]);

  const handleCopyCoords = () => {
    if (!isValidCoord) return;
    const coordStr = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    navigator.clipboard.writeText(coordStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  if (!isValidCoord) {
    return (
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
        <div className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          <span>Meter GPS Coordinates Missing</span>
        </div>
        <p className="text-[11px] text-amber-700 mt-1">
          Exact latitude/longitude is not yet recorded for meter {meterKey || customerKey}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Physical Issue Emergency Notice */}
      {isPhysicalIssue && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-md text-[11px] font-semibold text-red-700 animate-pulse">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span>Physical Dispatch Site: {issueTitle || 'Physical Issue Reported'}</span>
        </div>
      )}

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border border-gray-200 shadow-xs h-44 w-full bg-slate-100 z-0">
        <div ref={mapContainerRef} className="h-full w-full" />
        
        {/* Map Header Overlay */}
        <div className="absolute top-2 left-2 z-[400] bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded shadow-xs text-[10px] font-semibold text-gray-800 flex items-center gap-1">
          <MapPin className="h-3 w-3 text-blue-600" />
          <span>GIS Physical Meter Location</span>
        </div>
      </div>

      {/* Coordinate & Navigation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px]">
        <div className="font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-[10px]">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCoords}
            className="h-6 px-2 text-[10px] gap-1 bg-white"
            title="Copy coordinates to clipboard"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-gray-500" />}
            <span>{copied ? 'Copied' : 'Copy GPS'}</span>
          </Button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 h-6 px-2 text-[10px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors shadow-xs"
            title="Open in Google Maps for turn-by-turn navigation"
          >
            <Navigation className="h-3 w-3" />
            <span>Open Maps</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
}
