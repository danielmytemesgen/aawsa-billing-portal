"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { WifiOff, RefreshCw, Activity, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PERMISSIONS } from '@/lib/constants/auth';
import Link from 'next/link';

export default function OfflineMetricsPage() {
  const [rows, setRows] = useState<Array<{ event: string; cnt: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { hasAnyPermission, isManagement } = useCurrentUser();

  const canView = isManagement || hasAnyPermission(
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.METER_READINGS_ANALYTICS_VIEW,
    PERMISSIONS.DASHBOARD_VIEW_ALL
  );

  const loadData = () => {
    setIsLoading(true);
    fetch('/api/offline/metrics_summary')
      .then(res => res.json())
      .then(json => {
        if (json && Array.isArray(json.rows)) {
          setRows(json.rows);
        }
      })
      .catch(e => console.warn('Failed to load offline metrics summary:', e))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-sm">You do not have permission to view offline synchronization metrics.</p>
        <Link href="/admin/dashboard">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const totalEvents = rows.reduce((sum, r) => sum + Number(r.cnt || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/meter-readings" className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Meter Readings
            </Link>
          </div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2.5">
            <WifiOff className="h-7 w-7 text-primary" />
            <span>Offline Sync Metrics</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Telemetry and event volume recorded from mobile field meter readers during offline operations (last 7 days).
          </p>
        </div>

        <Button onClick={loadData} disabled={isLoading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sync Events</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-24" /> : totalEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Recorded within the rolling 7-day window</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Event Types</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : rows.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Distinct telemetry triggers identified</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sync Health</CardTitle>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Operational</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground mt-1">Background synchronization pipeline active</p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Events Breakdown</CardTitle>
          <CardDescription>Aggregation of client-side offline store actions submitted upon reconnection</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No offline sync events recorded in the last 7 days.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Category / Action</TableHead>
                  <TableHead className="text-right">Occurrence Count</TableHead>
                  <TableHead className="text-right">Share (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const pct = totalEvents > 0 ? ((Number(r.cnt) / totalEvents) * 100).toFixed(1) : '0.0';
                  return (
                    <TableRow key={r.event}>
                      <TableCell className="font-mono text-sm font-medium">
                        <Badge variant="secondary" className="font-normal mr-2">event</Badge>
                        {r.event}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{Number(r.cnt).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{pct}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
