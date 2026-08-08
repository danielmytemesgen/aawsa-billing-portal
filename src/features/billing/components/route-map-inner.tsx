"use client";

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import 'leaflet-defaulticon-compatibility';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Zap } from 'lucide-react';
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import { 
  type Coordinates, 
  calculateDistance, 
  calculateBearing, 
  getCardinalDirection, 
  getDirectionsUrl,
  playProximityArrivalAlert 
} from "@/lib/geo-utils";
import { MapPin, Navigation, Compass, ExternalLink } from 'lucide-react';

interface RouteMapInnerProps {
  bulkMeters: BulkMeter[];
  getCustomersForBulkMeter: (id: string) => IndividualCustomer[];
  isMeterRead: (id: string, type: 'bulk' | 'individual') => boolean;
  onReadClick: (meter: any, type: 'bulk' | 'individual') => void;
  userLocation?: Coordinates | null;
  pathHistory?: Coordinates[];
  canReadBulk?: boolean;
}

import L from 'leaflet';

/** Helper component to smoothly re-center the map when activeTarget changes without re-mounting MapContainer */
function ChangeMapView({ center }: { center: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

/** Custom Leaflet divIcons for Green (Read), Amber (Unread), and Selected status */
const createCustomMarkerIcon = (status: 'read' | 'unread' | 'active') => {
  if (status === 'read') {
    return L.divIcon({
      className: 'custom-meter-marker',
      html: `
        <div style="
          background-color: #10b981;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(16,185,129,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
        ">✓</div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  if (status === 'active') {
    return L.divIcon({
      className: 'custom-meter-marker-active',
      html: `
        <div style="
          background-color: #2563eb;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 16px rgba(37,99,235,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 16px;
          animation: pulse 1.5s infinite;
        ">📍</div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  }

  // Unread / Pending status (Amber with pulse ring)
  return L.divIcon({
    className: 'custom-meter-marker-unread',
    html: `
      <div style="
        background-color: #f59e0b;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(245,158,11,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
      ">⚡</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

export default function RouteMapInner({ 
  bulkMeters, 
  getCustomersForBulkMeter, 
  isMeterRead, 
  onReadClick,
  userLocation,
  pathHistory = [],
  canReadBulk = true
}: RouteMapInnerProps) {
  const [activeTarget, setActiveTarget] = React.useState<BulkMeter | null>(null);
  const [deviceHeading, setDeviceHeading] = React.useState<number | null>(null);
  const announcedMetersRef = React.useRef<Set<string>>(new Set());

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

  // Device orientation listener for dynamic compass heading
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null) {
        // webkitCompassHeading for iOS, alpha for Android
        const heading = (e as any).webkitCompassHeading ?? (360 - e.alpha);
        setDeviceHeading(heading);
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  // Compute nearest unread meter to reader's location
  const nearestUnreadInfo = React.useMemo(() => {
    if (!userLocation) return null;

    const unreadMeters = markers.filter(bm => !isMeterRead(bm.customerKeyNumber, 'bulk'));
    if (unreadMeters.length === 0) return null;

    let closest: BulkMeter | null = null;
    let minDistance = Infinity;

    for (const bm of unreadMeters) {
      if (!bm.xCoordinate || !bm.yCoordinate) continue;
      const dist = calculateDistance(userLocation, { latitude: bm.yCoordinate, longitude: bm.xCoordinate });
      if (dist < minDistance) {
        minDistance = dist;
        closest = bm;
      }
    }

    if (!closest || !closest.xCoordinate || !closest.yCoordinate) return null;

    const targetCoords = { latitude: closest.yCoordinate, longitude: closest.xCoordinate };
    const bearing = calculateBearing(userLocation, targetCoords);
    const cardinal = getCardinalDirection(bearing);
    const formattedDist = minDistance < 1000 ? `${Math.round(minDistance)}m` : `${(minDistance / 1000).toFixed(1)}km`;

    return {
      meter: closest,
      distance: minDistance,
      formattedDist,
      bearing,
      cardinal
    };
  }, [userLocation, markers, isMeterRead]);

  // Audio Proximity Arrival Voice Prompt (15m threshold)
  React.useEffect(() => {
    if (!userLocation) return;

    const activeOrNearest = activeTarget || nearestUnreadInfo?.meter;
    if (!activeOrNearest || !activeOrNearest.xCoordinate || !activeOrNearest.yCoordinate) return;

    const dist = calculateDistance(userLocation, { latitude: activeOrNearest.yCoordinate, longitude: activeOrNearest.xCoordinate });
    const key = activeOrNearest.customerKeyNumber;

    if (dist <= 15 && !announcedMetersRef.current.has(key)) {
      announcedMetersRef.current.add(key);
      playProximityArrivalAlert(activeOrNearest.name);
    }
  }, [userLocation, activeTarget, nearestUnreadInfo]);

  // Calculate center based on active target or first meter
  const center: [number, number] = activeTarget && activeTarget.yCoordinate && activeTarget.xCoordinate
    ? [activeTarget.yCoordinate, activeTarget.xCoordinate]
    : [markers[0].yCoordinate!, markers[0].xCoordinate!];



  // Compute directional info for active target
  const activeNavInfo = React.useMemo(() => {
    if (!userLocation || !activeTarget || !activeTarget.xCoordinate || !activeTarget.yCoordinate) return null;
    const targetCoords = { latitude: activeTarget.yCoordinate, longitude: activeTarget.xCoordinate };
    const dist = calculateDistance(userLocation, targetCoords);
    const bearing = calculateBearing(userLocation, targetCoords);

    // Adjust arrow rotation if device heading is available
    const relativeBearing = deviceHeading !== null ? (bearing - deviceHeading + 360) % 360 : bearing;
    const cardinal = getCardinalDirection(relativeBearing);
    const directionsUrl = getDirectionsUrl(targetCoords, userLocation);
    const formattedDist = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;

    return {
      dist,
      formattedDist,
      bearing,
      cardinal,
      directionsUrl
    };
  }, [userLocation, activeTarget, deviceHeading]);

  return (
    <div className="h-[600px] w-full rounded-xl overflow-hidden border border-blue-100 shadow-sm relative z-0">
      {/* ─── One-Tap "Next Nearest Unread Meter" Quick Button ─── */}
      {nearestUnreadInfo && (
        <button
          onClick={() => setActiveTarget(nearestUnreadInfo.meter)}
          className="absolute top-3 right-3 z-[1000] bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-full shadow-lg border border-amber-400 flex items-center gap-1.5 transition-all"
          title="Jump to closest pending unread bulk meter"
        >
          <Zap className="h-4 w-4 fill-current animate-bounce" />
          <span>Next Unread: {nearestUnreadInfo.meter.name} ({nearestUnreadInfo.formattedDist} {nearestUnreadInfo.cardinal.arrow})</span>
        </button>
      )}

      {/* ─── Active Floating Directional Banner ─── */}
      {activeTarget && activeNavInfo && (
        <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 text-white backdrop-blur-md px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 max-w-[70vw]">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-md">
            {activeNavInfo.cardinal.arrow}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-100 truncate">
              {activeTarget.name}
            </p>
            <p className="text-[11px] text-blue-300 font-medium">
              Heading {activeNavInfo.cardinal.label} • <span className="font-bold text-white">{activeNavInfo.formattedDist} away</span>
            </p>
          </div>
          <a
            href={activeNavInfo.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-full shadow transition-all flex items-center gap-1 shrink-0"
          >
            <ExternalLink className="h-3 w-3" /> Navigate
          </a>
        </div>
      )}

      <MapContainer center={center} zoom={15} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <ChangeMapView center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User Location Marker */}
        {userLocation && (
          <Marker 
            position={[userLocation.latitude, userLocation.longitude]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 14px rgba(59,130,246,0.7); animation: pulse 2s infinite;"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })}
          >
            <Popup>
              <div className="text-center font-bold text-blue-600">You are here</div>
            </Popup>
          </Marker>
        )}

        {/* Path History Trail */}
        {pathHistory.length > 1 && (
          <Polyline 
            positions={pathHistory.map(c => [c.latitude, c.longitude])}
            pathOptions={{ 
              color: '#3b82f6', 
              weight: 3, 
              dashArray: '8, 8', 
              opacity: 0.5,
              lineJoin: 'round'
            }} 
          />
        )}

        {/* Dynamic Navigation Line connecting user location to active meter */}
        {userLocation && activeTarget && activeTarget.yCoordinate && activeTarget.xCoordinate && (
          <Polyline 
            positions={[
              [userLocation.latitude, userLocation.longitude],
              [activeTarget.yCoordinate, activeTarget.xCoordinate]
            ]}
            pathOptions={{ 
              color: '#10b981', 
              weight: 4, 
              dashArray: '6, 6', 
              opacity: 0.9,
              lineCap: 'round'
            }} 
          />
        )}
        
        {markers.map((bm) => {
          const customers = getCustomersForBulkMeter(bm.customerKeyNumber);
          const isBulkRead = isMeterRead(bm.customerKeyNumber, 'bulk');
          const isActive = activeTarget?.customerKeyNumber === bm.customerKeyNumber;

          // Color-coded marker status: active (blue), read (green), unread (amber)
          const markerIcon = createCustomMarkerIcon(isActive ? 'active' : isBulkRead ? 'read' : 'unread');

          // Calculate directional bearing & distance to this specific marker
          const targetCoords = (bm.xCoordinate && bm.yCoordinate) ? { latitude: bm.yCoordinate, longitude: bm.xCoordinate } : null;
          const navInfo = (userLocation && targetCoords) ? {
            dist: calculateDistance(userLocation, targetCoords),
            bearing: calculateBearing(userLocation, targetCoords),
            cardinal: getCardinalDirection(calculateBearing(userLocation, targetCoords)),
            directionsUrl: getDirectionsUrl(targetCoords, userLocation)
          } : null;

          return (
            <Marker 
              key={bm.customerKeyNumber} 
              position={[bm.yCoordinate!, bm.xCoordinate!]}
              icon={markerIcon}
              eventHandlers={{
                click: () => setActiveTarget(bm)
              }}
            >
              <Popup className="w-68" autoPan={false}>
                <div className="space-y-3 p-1">
                  <div>
                    <h3 className="font-bold text-sm leading-tight mb-1">{bm.name}</h3>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[9px] h-4">Bulk</Badge>
                      {isBulkRead ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm h-4 px-1.5 rounded-sm text-[9px] flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Read
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 shadow-sm h-4 px-1.5 rounded-sm text-[9px] flex items-center gap-0.5">
                          ⚡ Pending Read
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-500 font-mono">ID: {bm.customerKeyNumber}</div>
                  
                  {/* Direction Guidance Indicator */}
                  {navInfo && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                          <span className="text-sm">{navInfo.cardinal.arrow}</span> {navInfo.cardinal.label}
                        </span>
                        <span className="text-[11px] font-black text-blue-700 font-mono">
                          {navInfo.dist < 1000 ? `${Math.round(navInfo.dist)}m` : `${(navInfo.dist/1000).toFixed(1)}km`}
                        </span>
                      </div>
                      
                      <a
                        href={navInfo.directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center justify-center gap-1.5 w-full py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded transition-all shadow-sm"
                      >
                        <ExternalLink className="h-3 w-3" /> Turn-by-Turn Directions
                      </a>
                    </div>
                  )}

                  <div className="pt-2 border-t flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      className="w-full text-xs h-8 font-bold" 
                      variant={isBulkRead ? "outline" : "default"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReadClick(bm, 'bulk');
                      }}
                      disabled={!canReadBulk}
                      title={!canReadBulk ? 'Permission required: Meter Readings Create Bulk' : undefined}
                    >
                      {!canReadBulk ? "🔒 Locked" : isBulkRead ? "Update Reading" : "Read Bulk Meter"}
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
