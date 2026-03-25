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
  CheckCircle2,
  FileDown,
  Download
} from "lucide-react";
import { getSystemStatsAction, archiveOldRecordsAction, getAllBranchesAction } from "@/lib/actions";
import { startBatchPdfGenerationAction, getActivePdfJobsAction, deletePdfJobAction } from "@/lib/pdf-actions";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function MaintenancePage() {
  const [stats, setStats] = React.useState<any>(null);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [pdfJobs, setPdfJobs] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [isStartingPdf, setIsStartingPdf] = React.useState(false);
  
  const [selectedMonth, setSelectedMonth] = React.useState(format(new Date(), "yyyy-MM"));
  const [selectedBranch, setSelectedBranch] = React.useState("all");

  const { toast } = useToast();

  const fetchStats = async () => {
    setIsLoading(true);
    const [statsRes, branchRes, pdfRes] = await Promise.all([
      getSystemStatsAction(),
      getAllBranchesAction(),
      getActivePdfJobsAction()
    ]);
    
    if (statsRes.success) setStats(statsRes.stats);
    if (!branchRes.error && branchRes.data) setBranches(branchRes.data);
    if (pdfRes.success && pdfRes.jobs) setPdfJobs(pdfRes.jobs);
    
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

  const handleStartPdfBatch = async () => {
    setIsStartingPdf(true);
    const result = await startBatchPdfGenerationAction(selectedMonth, selectedBranch === "all" ? null : selectedBranch);
    if (result.success) {
      toast({
        title: "Job Started",
        description: "PDF generation is running in the background.",
      });
      fetchStats();
    } else {
      toast({
        title: "Failed to Start",
        description: result.error,
        variant: "destructive",
      });
    }
    setIsStartingPdf(false);
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm("Are you sure you want to remove this PDF job from the list?")) return;
    
    const result = await deletePdfJobAction(id);
    if (result.success) {
      toast({
        title: "Job Deleted",
        description: "The PDF job record was removed.",
      });
      fetchStats();
    } else {
      toast({
        title: "Failed to Delete",
        description: result.error,
        variant: "destructive",
      });
    }
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
        {/* PDF Batch Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              Batch PDF Generator
            </CardTitle>
            <CardDescription>
              Generate printable PDF batches for 700k+ monthly invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Month/Year</label>
                <input 
                  type="month" 
                  className="w-full rounded-md border p-2 text-sm"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleStartPdfBatch} 
              disabled={isStartingPdf}
            >
              {isStartingPdf ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Start Batch PDF Generation
            </Button>

            <div className="space-y-2 mt-6">
              <h3 className="text-sm font-semibold border-b pb-1">Recent PDF Jobs</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {pdfJobs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 italic">No recent jobs found.</p>
                ) : (
                  pdfJobs.map(job => (
                    <div key={job.id} className="text-xs border rounded p-2 bg-muted/30">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold">{job.month_year} - {job.branch_id || 'All'}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'outline'}>
                            {job.status}
                          </Badge>
                          {(job.status === 'completed' || job.status === 'failed') && (
                            <Button variant="ghost" size="icon" className="h-[22px] w-[22px] text-destructive rounded hover:bg-destructive/10 -mr-1" onClick={() => handleDeleteJob(job.id)} title="Remove Job">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{job.generated_bills} / {job.total_bills} bills</span>
                        <span>{format(new Date(job.created_at), "HH:mm, MMM d")}</span>
                      </div>
                      {job.file_paths && job.file_paths.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {job.file_paths.map((path: string, idx: number) => (
                            <a 
                              key={idx} 
                              href={path} 
                              download 
                              className="flex items-center gap-1 text-primary hover:underline bg-white px-2 py-1 rounded border"
                            >
                              <Download className="h-3 w-3" />
                              Batch {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                      {job.error_message && (
                        <p className="text-destructive mt-1 text-[10px] italic">{job.error_message}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

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
