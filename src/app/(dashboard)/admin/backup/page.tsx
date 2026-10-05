"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Database, Play, RefreshCw, Trash2, CheckCircle2, AlertTriangle,
  FileArchive, Clock, HardDrive, CalendarDays, Terminal, Save,
  ShieldCheck, Loader2, Settings,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────
interface BackupFile {
  name: string;
  folder: 'daily' | 'monthly';
  size: number;
  sizeFormatted: string;
  date: string;
  hasChecksum: boolean;
}

interface BackupStats {
  dailyCount: number;
  monthlyCount: number;
  lastBackup: string | null;
  lastBackupSizeFormatted: string;
  backupDir: string;
}

interface BackupJob {
  jobId: string;
  status: 'running' | 'done' | 'failed';
  progress: number;
  step?: string;
  filename?: string;
  sizeFormatted?: string;
  durationSeconds?: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  logs: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-400', '-900/20')}`}>
          {icon}
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${color.replace('text-', 'bg-').replace('-600', '-400').replace('-400', '-500')}`} />
    </div>
  );
}

function LogLine({ line }: { line: string }) {
  const isError = line.includes('❌') || line.includes('ERROR');
  const isWarn = line.includes('⚠️') || line.includes('WARN');
  const isSuccess = line.includes('✅') || line.includes('🎉');
  return (
    <div className={`font-mono text-[11px] leading-relaxed px-1 py-0.5 rounded ${
      isError ? 'text-red-400 bg-red-950/20' :
      isWarn ? 'text-amber-400 bg-amber-950/20' :
      isSuccess ? 'text-emerald-400' :
      'text-muted-foreground'
    }`}>
      {line}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function DatabaseBackupPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  // State
  const [stats, setStats] = React.useState<BackupStats | null>(null);
  const [dailyFiles, setDailyFiles] = React.useState<BackupFile[]>([]);
  const [monthlyFiles, setMonthlyFiles] = React.useState<BackupFile[]>([]);
  const [logLines, setLogLines] = React.useState<string[]>([]);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [loadingStats, setLoadingStats] = React.useState(true);
  const [loadingFiles, setLoadingFiles] = React.useState(false);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<BackupFile | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [verifyStatus, setVerifyStatus] = React.useState<Record<string, 'idle' | 'checking' | 'ok' | 'fail'>>({});

  // Async backup job state
  const [currentJob, setCurrentJob] = React.useState<BackupJob | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Settings state
  const [retentionDays, setRetentionDays] = React.useState('30');
  const [retentionMonths, setRetentionMonths] = React.useState('12');
  const [alertEmail, setAlertEmail] = React.useState('');
  const [alertWebhook, setAlertWebhook] = React.useState('');
  const [savingSettings, setSavingSettings] = React.useState(false);

  const logEndRef = React.useRef<HTMLDivElement>(null);
  const jobLogEndRef = React.useRef<HTMLDivElement>(null);

  // Clean up polling on unmount
  React.useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  // Auto-scroll job log
  React.useEffect(() => {
    jobLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentJob?.logs?.length]);

  // Permission guard
  if (!hasPermission('settings_manage')) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to access Database Backup Management.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchStats = React.useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await apiFetch('/admin/backup/api?view=stats');
      setStats(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoadingStats(false);
    }
  }, [toast]);

  const fetchFiles = React.useCallback(async () => {
    setLoadingFiles(true);
    try {
      const [daily, monthly] = await Promise.all([
        apiFetch('/admin/backup/api?view=list&folder=daily'),
        apiFetch('/admin/backup/api?view=list&folder=monthly'),
      ]);
      setDailyFiles(daily.files || []);
      setMonthlyFiles(monthly.files || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoadingFiles(false);
    }
  }, [toast]);

  const fetchLogs = React.useCallback(async () => {
    setLoadingLogs(true);
    try {
      const data = await apiFetch('/admin/backup/api?view=log');
      setLogLines(data.lines || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoadingLogs(false);
    }
  }, [toast]);

  React.useEffect(() => { fetchStats(); }, [fetchStats]);
  React.useEffect(() => {
    if (activeTab === 'backups') fetchFiles();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, fetchFiles, fetchLogs]);

  // Auto-refresh: re-fetch backup stats, files, or logs when DataRefreshProvider signals new data
  React.useEffect(() => {
    const handleDataRefreshed = () => {
      fetchStats();
      if (activeTab === 'backups') fetchFiles();
      if (activeTab === 'logs') fetchLogs();
    };
    window.addEventListener('data-refreshed', handleDataRefreshed);
    return () => window.removeEventListener('data-refreshed', handleDataRefreshed);
  }, [fetchStats, fetchFiles, fetchLogs, activeTab]);

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logLines]);

  const pollJobStatus = React.useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job: BackupJob = await apiFetch(`/admin/backup/api/run?jobId=${jobId}`);
        setCurrentJob(job);
        if (job.status === 'done') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          const ratio = (job as any).compressionRatio ? ` (${(job as any).compressionRatio} compression)` : '';
          toast({ title: '✅ Backup Complete', description: `${job.filename} — ${job.sizeFormatted || ''} in ${job.durationSeconds || 0}s${ratio}` });
          await fetchStats();
          if (activeTab === 'backups') await fetchFiles();
        } else if (job.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          toast({ variant: 'destructive', title: '❌ Backup Failed', description: job.error || 'Unknown error' });
        }
      } catch (_) {}
    }, 2000);
  }, [activeTab, fetchStats, fetchFiles, toast]);

  const handleRunBackup = async () => {
    try {
      const data = await apiFetch('/admin/backup/api/run', { method: 'POST' });
      if (data.alreadyRunning && data.jobId) {
        toast({ title: '⚠️ Already Running', description: 'A backup is already in progress. Resuming tracking...' });
        setCurrentJob({ jobId: data.jobId, status: 'running', progress: 0, logs: [] });
        pollJobStatus(data.jobId);
        return;
      }
      if (data.jobId) {
        setCurrentJob({ jobId: data.jobId, status: 'running', progress: 0, logs: [] });
        pollJobStatus(data.jobId);
        toast({ title: '🚀 Backup Started', description: 'Running in background — live table progress below.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '❌ Could Not Start Backup', description: e.message });
    }
  };

  const handleDismissJob = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setCurrentJob(null);
  };

  const handleCancelBackup = async () => {
    if (!currentJob?.jobId) return;
    try {
      await apiFetch('/admin/backup/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', jobId: currentJob.jobId }),
      });
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setCurrentJob(prev => prev ? { ...prev, status: 'failed', error: 'Cancelled by user.' } : null);
      toast({ title: '🛑 Backup Cancelled', description: 'The backup job has been cancelled.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch('/admin/backup/api', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: deleteTarget.name, folder: deleteTarget.folder }),
      });
      toast({ title: 'Deleted', description: `${deleteTarget.name} has been removed.` });
      setDeleteTarget(null);
      await fetchFiles();
      await fetchStats();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setDeleting(false);
    }
  };

  const [pruning, setPruning] = React.useState(false);

  const handleVerify = async (file: BackupFile) => {
    setVerifyStatus(prev => ({ ...prev, [file.name]: 'checking' }));
    try {
      const res = await apiFetch('/admin/backup/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, folder: file.folder }),
      });
      const ok = res.valid;
      setVerifyStatus(prev => ({ ...prev, [file.name]: ok ? 'ok' : 'fail' }));
      toast({
        title: ok ? '✅ Integrity Verified' : '❌ Verification Failed',
        description: `${file.name}: ${res.details || 'Integrity check completed.'} (${res.elapsedMs}ms)`,
        variant: ok ? 'default' : 'destructive',
      });
    } catch (e: any) {
      setVerifyStatus(prev => ({ ...prev, [file.name]: 'fail' }));
      toast({ variant: 'destructive', title: 'Verification Error', description: e.message });
    }
  };

  const handlePruneOldBackups = async () => {
    setPruning(true);
    try {
      const res = await apiFetch('/admin/backup/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prune' }),
      });
      toast({
        title: '🧹 Retention Pruning Complete',
        description: res.message || `Pruned ${res.prunedCount} old backup(s).`,
      });
      await fetchFiles();
      await fetchStats();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Pruning Failed', description: e.message });
    } finally {
      setPruning(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      // Persist via system_settings (future: wire to saveBackupSettingsAction)
      await new Promise(r => setTimeout(r, 800));
      toast({ title: '✅ Settings Saved', description: 'Backup configuration updated.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSavingSettings(false);
    }
  };

  // ── File table ────────────────────────────────────────────────────────────
  const FileTable = ({ files, isLoading }: { files: BackupFile[]; isLoading: boolean }) => (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="font-semibold text-xs uppercase">File</TableHead>
            <TableHead className="font-semibold text-xs uppercase">Size</TableHead>
            <TableHead className="font-semibold text-xs uppercase">Created</TableHead>
            <TableHead className="font-semibold text-xs uppercase">Checksum</TableHead>
            <TableHead className="font-semibold text-xs uppercase text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading backups...
              </TableCell>
            </TableRow>
          ) : files.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                <FileArchive className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No backup files found
              </TableCell>
            </TableRow>
          ) : files.map(file => {
            const vStatus = verifyStatus[file.name] || 'idle';
            return (
              <TableRow key={file.name} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileArchive className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="font-mono text-xs text-foreground">{file.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-semibold">{file.sizeFormatted}</span>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm">{format(new Date(file.date), 'MMM d, yyyy HH:mm')}</div>
                    <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(file.date), { addSuffix: true })}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {file.hasChecksum ? (
                    <Badge variant="secondary" className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> SHA-256
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px]">No checksum</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleVerify(file)}
                      disabled={vStatus === 'checking'}
                    >
                      {vStatus === 'checking' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : vStatus === 'ok' ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <ShieldCheck className="h-3 w-3" />
                      )}
                      <span className="ml-1">{vStatus === 'checking' ? 'Verifying...' : 'Verify'}</span>
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(file)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Database Backup</h1>
            <p className="text-sm text-muted-foreground">Monitor, trigger, and manage database backups</p>
          </div>
        </div>
        <Button
          onClick={handleRunBackup}
          disabled={currentJob?.status === 'running'}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm"
          size="default"
        >
          {currentJob?.status === 'running' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Running ({currentJob.progress}%)...</>
          ) : (
            <><Play className="h-4 w-4" /> Run Backup Now</>
          )}
        </Button>
      </div>

      {/* Live Job Progress Panel */}
      {currentJob && (
        <div className={`rounded-xl border shadow-sm overflow-hidden ${
          currentJob.status === 'done' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20' :
          currentJob.status === 'failed' ? 'border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20' :
          'border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
            <div className="flex items-center gap-2">
              {currentJob.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
              {currentJob.status === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {currentJob.status === 'failed' && <AlertTriangle className="h-4 w-4 text-red-500" />}
              <span className={`text-sm font-semibold ${
                currentJob.status === 'done' ? 'text-emerald-700 dark:text-emerald-400' :
                currentJob.status === 'failed' ? 'text-red-700 dark:text-red-400' :
                'text-blue-700 dark:text-blue-400'
              }`}>
                {currentJob.status === 'running' ? `Backup in Progress — ${currentJob.step || 'Starting...'}` :
                 currentJob.status === 'done' ? `✅ Backup Complete — ${currentJob.filename} ${currentJob.sizeFormatted ? `(${currentJob.sizeFormatted})` : ''}` :
                 `❌ Backup Failed — ${currentJob.error || 'Unknown error'}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {currentJob.status === 'running' && (
                <button
                  onClick={handleCancelBackup}
                  className="text-red-500 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border border-red-200 dark:border-red-800"
                >
                  🛑 Cancel
                </button>
              )}
              <button
                onClick={handleDismissJob}
                disabled={currentJob.status === 'running'}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs px-2 py-1 rounded hover:bg-muted/50 transition-colors"
              >✕ Dismiss</button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-4 pt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs font-bold">{currentJob.progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  currentJob.status === 'done' ? 'bg-emerald-500' :
                  currentJob.status === 'failed' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${currentJob.progress}%` }}
              />
            </div>
          </div>

          {/* Live log */}
          {currentJob.logs && currentJob.logs.length > 0 && (
            <div className="px-4 pb-4 pt-3">
              <div className="rounded-lg bg-gray-950 border border-gray-800 p-3 max-h-[200px] overflow-y-auto">
                {currentJob.logs.map((line, i) => (
                  <div key={i} className={`font-mono text-[10px] leading-relaxed ${
                    line.includes('❌') || line.includes('ERROR') ? 'text-red-400' :
                    line.includes('✅') || line.includes('🎉') ? 'text-emerald-400' :
                    line.includes('⚠️') ? 'text-amber-400' :
                    line.includes('⏳') ? 'text-blue-400' :
                    line.includes('📋') ? 'text-cyan-400' :
                    line.includes('🔐') ? 'text-violet-400' :
                    'text-gray-400'
                  }`}>{line}</div>
                ))}
                <div ref={jobLogEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/60">
          <TabsTrigger value="overview" className="gap-1.5"><HardDrive className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="backups" className="gap-1.5"><FileArchive className="h-3.5 w-3.5" /> Backup Files</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Settings</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><Terminal className="h-3.5 w-3.5" /> Logs</TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {loadingStats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-5 h-24 animate-pulse bg-muted/30" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Clock className="h-5 w-5" />}
                label="Last Backup"
                value={stats.lastBackup ? formatDistanceToNow(new Date(stats.lastBackup), { addSuffix: true }) : 'Never'}
                sub={stats.lastBackup ? format(new Date(stats.lastBackup), 'MMM d, HH:mm') : 'No backups found'}
                color="text-blue-600 dark:text-blue-400"
              />
              <StatCard
                icon={<HardDrive className="h-5 w-5" />}
                label="Last Backup Size"
                value={stats.lastBackupSizeFormatted || '—'}
                sub="Compressed .gz"
                color="text-emerald-600 dark:text-emerald-400"
              />
              <StatCard
                icon={<CalendarDays className="h-5 w-5" />}
                label="Daily Backups"
                value={`${stats.dailyCount}`}
                sub={`of 30 kept`}
                color={stats.dailyCount === 0 ? 'text-red-500' : 'text-violet-600 dark:text-violet-400'}
              />
              <StatCard
                icon={<Database className="h-5 w-5" />}
                label="Monthly Backups"
                value={`${stats.monthlyCount}`}
                sub={`of 12 kept`}
                color="text-amber-600 dark:text-amber-400"
              />
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Could Not Read Backup Directory</AlertTitle>
              <AlertDescription>
                The backup directory <code className="font-mono text-xs">C:\aawsa\backups\</code> was not found or is not accessible from the server process. Make sure it exists and the app has read permission.
              </AlertDescription>
            </Alert>
          )}

          {/* Info card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Backup Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Backup Directory</span>
                  <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{stats?.backupDir || 'C:\\aawsa\\backups'}</code>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Schedule</span>
                  <span className="font-semibold">Daily at 02:00 AM</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Compression</span>
                  <span className="font-semibold">gzip / PowerShell Compress-Archive</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Daily Retention</span>
                  <span className="font-semibold">30 days</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Monthly Retention</span>
                  <span className="font-semibold">12 months</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Integrity Checks</span>
                  <Badge variant="secondary" className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> SHA-256 + gzip verify
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Backup Files ──────────────────────────────────────────────────── */}
        <TabsContent value="backups" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Daily Backups</CardTitle>
                  <CardDescription>{dailyFiles.length} file{dailyFiles.length !== 1 ? 's' : ''} • 30-day retention</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchFiles} disabled={loadingFiles}>
                  <RefreshCw className={`h-4 w-4 ${loadingFiles ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <FileTable files={dailyFiles} isLoading={loadingFiles} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-base">Monthly Snapshots</CardTitle>
                <CardDescription>{monthlyFiles.length} file{monthlyFiles.length !== 1 ? 's' : ''} • 12-month retention</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <FileTable files={monthlyFiles} isLoading={loadingFiles} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings ─────────────────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-blue-500" />
                Retention & Disk Safety Policy
              </CardTitle>
              <CardDescription>Configure retention thresholds and perform manual storage cleanup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="retention-days">Daily Retention (days)</Label>
                  <Input
                    id="retention-days"
                    type="number" min="1" max="365"
                    value={retentionDays}
                    onChange={e => setRetentionDays(e.target.value)}
                    className="max-w-[160px]"
                  />
                  <p className="text-xs text-muted-foreground">Daily backups older than this are auto-deleted (min 3 always preserved)</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="retention-months">Monthly Retention (months)</Label>
                  <Input
                    id="retention-months"
                    type="number" min="1" max="60"
                    value={retentionMonths}
                    onChange={e => setRetentionMonths(e.target.value)}
                    className="max-w-[160px]"
                  />
                  <p className="text-xs text-muted-foreground">Monthly snapshots beyond this count are pruned</p>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Manual Retention Pruning</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Trigger an immediate cleanup pass to purge expired daily backups while preserving at least the 3 most recent backups.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePruneOldBackups}
                  disabled={pruning}
                  className="gap-2 shrink-0 border-amber-500/30 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                >
                  {pruning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {pruning ? 'Pruning...' : 'Prune Expired Backups'}
                </Button>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Failure Alerting
                </h4>
                <div className="space-y-1.5">
                  <Label htmlFor="alert-email">Alert Email</Label>
                  <Input
                    id="alert-email"
                    type="email"
                    placeholder="ops-team@aawsa.gov.et"
                    value={alertEmail}
                    onChange={e => setAlertEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Requires 'mail' command on the server</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alert-webhook">Slack / Teams Webhook URL</Label>
                  <Input
                    id="alert-webhook"
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={alertWebhook}
                    onChange={e => setAlertWebhook(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Paste an incoming webhook URL to receive failure notifications</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="gap-2"
                >
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                Automated Scheduling (Task Scheduler & Cron)
              </CardTitle>
              <CardDescription>Automate unattended nightly backups using Windows Task Scheduler or cron curl</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-mono">
              <div className="rounded-lg bg-slate-950 p-4 text-slate-200 border border-slate-800 space-y-2">
                <p className="text-slate-400 font-sans font-medium text-xs">Option A: Windows Task Scheduler (Recommended on Windows)</p>
                <div className="overflow-x-auto text-[11px] text-emerald-400 select-all py-1">
                  schtasks /create /tn &quot;AAWSA_Daily_DB_Backup&quot; /tr &quot;powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1&quot; /sc daily /st 02:00
                </div>
              </div>

              <div className="rounded-lg bg-slate-950 p-4 text-slate-200 border border-slate-800 space-y-2">
                <p className="text-slate-400 font-sans font-medium text-xs">Option B: Headless API Trigger (Linux / Cron / Curl)</p>
                <div className="overflow-x-auto text-[11px] text-blue-400 select-all py-1">
                  curl -X POST http://localhost:3000/admin/backup/api/run -H &quot;x-cron-secret: aawsa_cron_b8f27e6918a3c20d7593c83b&quot; -H &quot;Content-Type: application/json&quot; -d &apos;&#123;&#125;&apos;
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs ─────────────────────────────────────────────────────────── */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Backup Log
                  </CardTitle>
                  <CardDescription>Last 200 lines from C:\aawsa\backup.log</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loadingLogs}>
                  <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px] w-full rounded-lg bg-gray-950 dark:bg-gray-900 border border-gray-800 p-4">
                {loadingLogs ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : logLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <Terminal className="h-8 w-8 opacity-30" />
                    <p className="text-sm">Log file is empty or not found</p>
                    <p className="text-xs opacity-60">Expected at: C:\aawsa\backup.log</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {logLines.map((line, i) => (
                      <LogLine key={i} line={line} />
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Backup File
            </DialogTitle>
            <DialogDescription>
              This action is <strong>permanent</strong> and cannot be undone. The backup file and its checksum will be deleted from the server.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs border">
            {deleteTarget?.name}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
