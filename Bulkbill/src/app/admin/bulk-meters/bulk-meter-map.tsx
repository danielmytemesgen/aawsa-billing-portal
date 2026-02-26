"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import type { BulkMeter } from "./bulk-meter-types";
import type { Branch } from "../branches/branch-types";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import L from "leaflet";

interface BulkMeterMapProps {
  bulkMeters: BulkMeter[];
  branches?: Branch[];
}

// We'll manage the Leaflet map manually to avoid react-leaflet double-initialization issues.


const BulkMeterMapComponent: React.FC<BulkMeterMapProps> = ({ bulkMeters, branches = [] }) => {
  
  const [filters, setFilters] = React.useState({
    customerKeyNumber: "",
    contractNumber: "",
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const filteredMeters = React.useMemo(() => bulkMeters.filter((meter) => {
    const hasCoordinates = meter.yCoordinate != null && meter.xCoordinate != null;
    const customerKeyMatch =
      !filters.customerKeyNumber ||
      meter.customerKeyNumber.toLowerCase().includes(filters.customerKeyNumber.toLowerCase());
    const contractNumberMatch =
      !filters.contractNumber ||
      meter.contractNumber.toLowerCase().includes(filters.contractNumber.toLowerCase());
    return hasCoordinates && customerKeyMatch && contractNumberMatch;
  }), [bulkMeters, filters]);

  const position: [number, number] = [9.03, 38.74];
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markersLayerRef = React.useRef<L.LayerGroup | null>(null);
  const [isMapReady, setIsMapReady] = React.useState(false);

  React.useEffect(() => {
    if (!mapContainerRef.current) return;
    // initialize map once
    if (!mapRef.current) {
      try {
        const map = L.map(mapContainerRef.current!, { center: position, zoom: 10 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        const layer = L.layerGroup().addTo(map);
        mapRef.current = map;
        markersLayerRef.current = layer;
        setIsMapReady(true);
      } catch (e) {
        // ignore initialization errors in strict mode double mount
      }
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
        markersLayerRef.current = null;
        setIsMapReady(false);
      }
    };
    // run only on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // clear existing markers
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    } else {
      markersLayerRef.current = L.layerGroup().addTo(map);
    }

    const markers: L.Marker[] = [];
    filteredMeters.forEach(meter => {
      const lat = Number(meter.yCoordinate);
      const lng = Number(meter.xCoordinate);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const marker = L.marker([lat, lng]);
        const branchName = meter.branchId ? (branches.find(b => b.id === meter.branchId)?.name || '') : '';
        const popupHtml = `
          <div>
            <h3 style="font-weight:bold">${String(meter.name || '')}</h3>
            <p><strong>Meter Number:</strong> ${String(meter.meterNumber || '')}</p>
            <p><strong>Status:</strong> ${String(meter.status || '')}</p>
            <p><strong>Branch:</strong> ${String(branchName)}</p>
            <p><strong>Charge Group:</strong> ${String(meter.chargeGroup || '')}</p>
            <p><strong>Meter Size:</strong> ${String(meter.meterSize ?? '')}</p>
            <p><strong>Contract No:</strong> ${String(meter.contractNumber || '')}</p>
            <p><strong>Customer Key:</strong> ${String(meter.customerKeyNumber || '')}</p>
          </div>
        `;
        marker.bindPopup(popupHtml);
        markersLayerRef.current!.addLayer(marker);
        markers.push(marker);
      }
    });

    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => (m.getLatLng())));
      if (bounds.isValid()) {
        try { map.fitBounds(bounds, { padding: [50, 50] }); } catch (e) {}
      }
    } else {
      // If no markers, reset view
      try { map.setView(position, 10); } catch (e) {}
    }
  }, [filteredMeters]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Meter Map</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Input
            placeholder="Filter by Customer Key..."
            name="customerKeyNumber"
            value={filters.customerKeyNumber}
            onChange={handleFilterChange}
          />
          <Input
            placeholder="Filter by Contract Number..."
            name="contractNumber"
            value={filters.contractNumber}
            onChange={handleFilterChange}
          />
        </div>
        <div style={{ height: "600px", width: "100%" }}>
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
          {!isMapReady && <div className="absolute inset-0 flex items-center justify-center">Loading map...</div>}
        </div>
      </CardContent>
    </Card>
  );
};

export const BulkMeterMap = React.memo(BulkMeterMapComponent);
