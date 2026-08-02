"use client";

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'; // Re-uses images from ~leaflet package
import 'leaflet-defaulticon-compatibility';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ClipboardList } from 'lucide-react';
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import { type Coordinates, calculateDistance } from "@/lib/geo-utils";
import { MapPin, Navigation } from 'lucide-react';

interface RouteMapInnerProps {
  bulkMeters: BulkMeter[];
  getCustomersForBulkMeter: (id: string) => IndividualCustomer[];
  isMeterRead: (id: string, type: 'bulk' | 'individual') => boolean;
  onReadClick: (meter: any, type: 'bulk' | 'individual') => void;
  userLocation?: Coordinates | null;
  pathHistory?: Coordinates[];
}

import L from 'leaflet';

export default function RouteMapInner({ 
  bulkMeters, 
  getCustomersForBulkMeter, 
  isMeterRead, 
  onReadClick,
  userLocation,
  pathHistory = []
}: RouteMapInnerProps) {
  // Filter meters that have coordinates
  const markers = bulkMeters.filter(bm => bm.xCoordinate && bm.yCoordinate);

  if (markers.length === 0) {
    return (
      <div className="h-[500px] w-full bg-slate-100 flex items-center justify-center rounded-lg border border-dashed border-slate-300">
        <p className="text-slate-500 font-medium text-center max-w-sm">
          No meters on this route have GPS coordinates recorded. <br/> Switch to list view to capture them.
        </p>
      </div>
    );
  }

  // Calculate center based on the first meter
  const center: [number, number] = [markers[0].yCoordinate!, markers[0].xCoordinate!];

  React.useEffect(() => {
    return () => {
      // Force clear the leaflet ID from the DOM element during Strict Mode / HMR unmounts
      const container = document.getElementById('route-map');
      if (container) {
        (container as any)._leaflet_id = null;
      }
    };
  }, []);

  return (
    <div className="h-[600px] w-full rounded-xl overflow-hidden border border-blue-100 shadow-sm relative z-0">
      <MapContainer id="route-map" center={center} zoom={15} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <Marker 
            position={[userLocation.latitude, userLocation.longitude]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
          >
            <Popup>
              <div className="text-center font-bold text-blue-600">You are here</div>
            </Popup>
          </Marker>
        )}

        {pathHistory.length > 1 && (
          <Polyline 
            positions={pathHistory.map(c => [c.latitude, c.longitude])}
            pathOptions={{ 
              color: '#3b82f6', 
              weight: 4, 
              dashArray: '10, 10', 
              opacity: 0.6,
              lineJoin: 'round'
            }} 
          />
        )}
        
        {markers.map((bm) => {
          const customers = getCustomersForBulkMeter(bm.customerKeyNumber);
          const hasUnreadIndividuals = customers.some(c => !isMeterRead(c.customerKeyNumber, 'individual'));
          const isBulkRead = isMeterRead(bm.customerKeyNumber, 'bulk');
          const fullyCompleted = isBulkRead && !hasUnreadIndividuals;

          return (
            <Marker key={bm.customerKeyNumber} position={[bm.yCoordinate!, bm.xCoordinate!]}>
              <Popup className="w-64" autoPan={false}>
                <div className="space-y-3 p-1">
                  <div>
                    <h3 className="font-bold text-sm leading-tight mb-1">{bm.name}</h3>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[9px] h-4">Bulk</Badge>
                      {fullyCompleted && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-none shadow-sm h-4 px-1 rounded-sm text-[9px] flex items-center gap-0.5">
                          <CheckCircle2 className="h-2 w-2" /> Done
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-500 font-mono">ID: {bm.customerKeyNumber}</div>
                  
                  {userLocation && bm.xCoordinate && bm.yCoordinate && (
                    <div className="flex items-center gap-1.5 text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded text-[11px] w-fit">
                      <Navigation className="h-3 w-3" />
                      {(() => {
                        const dist = calculateDistance(userLocation, { latitude: bm.yCoordinate, longitude: bm.xCoordinate });
                        return dist < 1000 ? `${Math.round(dist)}m away` : `${(dist/1000).toFixed(1)}km away`;
                      })()}
                    </div>
                  )}

                  <div className="pt-2 border-t flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      className="w-full text-xs h-7" 
                      variant={isBulkRead ? "outline" : "default"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReadClick(bm, 'bulk');
                      }}
                    >
                      {isBulkRead ? "Update Reading" : "Read Bulk Meter"}
                    </Button>
                    
                    {customers.length > 0 && (
                      <div className="text-xs text-center mt-1 pt-1 border-t text-slate-500">
                        {customers.length} Individual Meters ({customers.filter(c => isMeterRead(c.customerKeyNumber, 'individual')).length} Read)
                        <br/>
                        <span className="text-[10px] italic">Switch to list view to read individuals</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
