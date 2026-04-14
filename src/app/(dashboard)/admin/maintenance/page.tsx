"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Database, 
  History, 
  Cpu, 
  Trash2, 
  AlertTriangle,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import { getSystemStatsAction, archiveOldRecordsAction } from "@/lib/actions";
import { DiscrepancyAudit } from "@/components/maintenance/discrepancy-audit";

import { useToast } from "@/hooks/use-toast";

export default function MaintenancePage() {
  const [stats, setStats] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isArchiving, setIsArchiving] = React.useState(false);

  const { toast } = useToast();

  const fetchStats = async () => {
    setIsLoading(true);
    const statsRes = await getSystemStatsAction();
    if (statsRes.success) setStats(statsRes.stats);
    setIsLoading(false);
  };

  React.useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to archive records older than 36 months? This will move them to history tables.")) return;
    
    setIsArchiving(true);
    const result: any = await archiveOldRecordsAction(36);
    if (result.success) {
      toast({
        title: "Archival Complete",
        description: `Successfully moved ${result.billsMoved} bills and ${result.paymentsMoved} payments to history.`,
      });
      fetchStats();
    } else {
      toast({
        title: "Archival Failed",
        description: result.error || "Unknown error",
        variant: "destructive",
      });
    }
    setIsArchiving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health & Maintenance</h1>
          <p className="text-muted-foreground">Monitor system performance and manage large-scale data archival.</p>
        </div>
        <Button onClick={fetchStats} disabled={isLoading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      </div>

      {/* Discrepancy Audit Tool */}
      <DiscrepancyAudit />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bills</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_bills?.toLocaleString() || "0"}</div>
            <p className="text-xs text-muted-foreground">Rows in active operational table</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Archived Bills</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.historic_bills?.toLocaleString() || "0"}</div>
            <p className="text-xs text-muted-foreground">Rows in long-term history table</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
            <Cpu className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_workers || "0"}</div>
            <p className="text-xs text-muted-foreground">PM2 cluster instances processing jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System status</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Healthy</div>
            <p className="text-xs text-muted-foreground">All clusters operational</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Archival Management */}
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-orange-600" />
              Data Archival Control
            </CardTitle>
            <CardDescription>
              Move records older than 36 months to history tables to keep the system fast.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-orange-100 p-3 text-sm text-orange-800 flex gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <strong>Recommendation:</strong> Archive data when active bills exceed 10 million rows to maintain sub-second query speeds.
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-sm">Archival Threshold</p>
                <p className="text-xs text-muted-foreground text-orange-700">Records older than 3 years (36 months)</p>
              </div>
              <Button 
                onClick={handleArchive} 
                disabled={isArchiving || (stats?.active_bills === 0)}
                variant="destructive"
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isArchiving ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Run Archival Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Job Queue Monitor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Billing Job Queue
            </CardTitle>
            <CardDescription>
              Real-time background processing status for 700k+ monthly bills.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current Queue Load</span>
                <Badge variant={stats?.active_jobs > 100 ? "destructive" : "default"}>
                  {stats?.active_jobs || 0} active chunks
                </Badge>
              </div>
              <Progress value={Math.min((stats?.active_jobs || 0) / 10, 100)} className="h-2" />
            </div>

            <div className="flex items-center gap-4 text-sm border rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Workers: {stats?.active_workers || 0} online</span>
              </div>
              <div className="border-l pl-4 flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                <span>Status: In-Memory Sync OK</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
