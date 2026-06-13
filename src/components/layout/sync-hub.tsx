"use client";

import * as React from 'react';
import { 
  getPendingReadings, 
  getFailedReadings, 
  resetFailedReadings, 
  markAsSyncing, 
  markAsFailed, 
  removeSyncedReading,
  resetSingleFailedReading,
  db,
  checkActualConnectivity,
  resetFailedUploads,
  resetSingleFailedUpload
} from '@/lib/offline-db';
import { addIndividualCustomerReading, addBulkMeterReading } from '@/lib/data-store';
import { uploadReadingPhotoAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/hooks/use-current-user';
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw, 
  Calendar, 
  MapPin, 
  Trash2, 
  Camera,
  Download,
  Upload
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSidebar } from '@/components/ui/sidebar';

export function SyncHub() {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [failedCount, setFailedCount] = React.useState(0);
  const [pendingList, setPendingList] = React.useState<any[]>([]);
  const [failedList, setFailedList] = React.useState<any[]>([]);
  const [isQueueOpen, setIsQueueOpen] = React.useState(false);
  const [lastSyncResult, setLastSyncResult] = React.useState<{ success: number; failed: number } | null>(null);
  const { toast } = useToast();
  const { currentUser, isManagement } = useCurrentUser();
  const syncInProgress = React.useRef(false);

  const retryDelay = React.useRef(2000);
  const retryTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const backupInputRef = React.useRef<HTMLInputElement>(null);
  
  // Sidebar Context
  const { state: sidebarState, isMobile } = useSidebar();
  const isCollapsed = sidebarState === "collapsed" && !isMobile;

  const checkPending = React.useCallback(async () => {
    const [pending, failed, pendingUploads, failedUploads] = await Promise.all([
      getPendingReadings(),
      getFailedReadings(),
      db.uploads.where('status').equals('pending').toArray(),
      db.uploads.where('status').equals('failed').toArray()
    ]);

    // Reader isolation: only show readings belonging to current user unless user is management
    const currentUserId = currentUser?.id;

    const matchesCurrentUser = (r: any) => {
      if (!currentUserId || isManagement) return true;
      const payload = r.payload || {};
      return (
        payload.readerStaffId === currentUserId ||
        payload.reader_staff_id === currentUserId ||
        payload.readerId === currentUserId ||
        payload.reader === currentUserId ||
        r.readerStaffId === currentUserId ||
        r.reader_staff_id === currentUserId
      );
    };

    const filteredPending = pending.filter(matchesCurrentUser);
    const filteredFailed = failed.filter(matchesCurrentUser);

    // Combine metadata readings + photo uploads
    setPendingCount(filteredPending.length + pendingUploads.length);
    setFailedCount(filteredFailed.length + failedUploads.length);
    setPendingList([...filteredPending, ...pendingUploads]);
    setFailedList([...filteredFailed, ...failedUploads]);
  }, [currentUser, isManagement]);

  const runSync = React.useCallback(async () => {
    // Connection Check using active /api/health endpoint ping
    const isOnline = await checkActualConnectivity();
    if (!isOnline) {
      syncInProgress.current = false;
      return;
    }

    // Mutex: prevent concurrent sync runs
    if (syncInProgress.current) return;
    syncInProgress.current = true;

    const rawPending = await getPendingReadings();
    const pending = rawPending.filter((r: any) => {
      if (!currentUser?.id || isManagement) return true;
      const p = r.payload || {};
      return (
        p.readerStaffId === currentUser.id ||
        p.reader_staff_id === currentUser.id ||
        p.readerId === currentUser.id ||
        p.reader === currentUser.id ||
        r.readerStaffId === currentUser.id ||
        r.reader_staff_id === currentUser.id
      );
    });

    const pendingUploads = await db.uploads.where('status').equals('pending').toArray();

    if (pending.length === 0 && pendingUploads.length === 0) {
      syncInProgress.current = false;
      retryDelay.current = 2000; // Reset backoff delay
      return;
    }

    setIsSyncing(true);
    let success = 0;
    let failed = 0;
    let hasNetworkError = false;

    const totalToSync = pending.length + pendingUploads.length;

    // Dispatch starting progress event
    window.dispatchEvent(new CustomEvent('sync-progress', {
      detail: { syncing: true, success: 0, failed: 0, total: totalToSync }
    }));

    // --- PHASE 1: Sync readings metadata (small payloads, high priority) ---
    for (const reading of pending) {
      if (!reading.id) continue;
      await markAsSyncing(reading.id);

      try {
        let result;
        if (reading.type === 'individual') {
          result = await addIndividualCustomerReading(reading.payload);
        } else {
          result = await addBulkMeterReading(reading.payload);
        }

        if (result.success && result.data) {
          const serverId = result.data.id;
          if (reading.localId && serverId) {
            // Find and link the decoupled photo upload entry
            const uploadEntry = await db.uploads.where('readingLocalId').equals(reading.localId).first();
            if (uploadEntry && uploadEntry.id) {
              await db.uploads.update(uploadEntry.id, { readingId: serverId });
            }
          }
          await removeSyncedReading(reading.id);
          success++;
        } else {
          await markAsFailed(reading.id, result.message || 'Unknown error');
          failed++;
          if (result.message?.toLowerCase().includes('network') || result.message?.toLowerCase().includes('timeout') || result.message?.toLowerCase().includes('failed to fetch')) {
            hasNetworkError = true;
          }
        }
      } catch (err: any) {
        await markAsFailed(reading.id, err.message || 'Network error');
        failed++;
        hasNetworkError = true;
      }

      window.dispatchEvent(new Event('offline-queue-updated'));
      window.dispatchEvent(new CustomEvent('sync-progress', {
        detail: { syncing: true, success, failed, total: totalToSync }
      }));
    }

    // --- PHASE 2: Sync decoupled uploads (photos, larger payloads) ---
    const uploadsToSync = await db.uploads.where('status').equals('pending').toArray();
    for (const upload of uploadsToSync) {
      if (!upload.id || !upload.readingId || !upload.photoData) continue;
      await db.uploads.update(upload.id, { status: 'uploading' });

      try {
        const result = await uploadReadingPhotoAction(
          String(upload.readingId),
          upload.readingType || 'individual',
          upload.photoData
        );

        if (result && !result.error) {
          await db.uploads.delete(upload.id);
          success++;
        } else {
          const errMsg = result?.error?.message || 'Failed to upload photo';
          await db.uploads.update(upload.id, { status: 'failed', errorMessage: errMsg });
          failed++;
          if (errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('timeout')) {
            hasNetworkError = true;
          }
        }
      } catch (err: any) {
        await db.uploads.update(upload.id, { status: 'failed', errorMessage: err.message || 'Network error' });
        failed++;
        hasNetworkError = true;
      }

      window.dispatchEvent(new Event('offline-queue-updated'));
      window.dispatchEvent(new CustomEvent('sync-progress', {
        detail: { syncing: true, success, failed, total: totalToSync }
      }));
    }

    setLastSyncResult({ success, failed });
    await checkPending();
    setIsSyncing(false);
    syncInProgress.current = false;

    // Dispatch completed event
    window.dispatchEvent(new CustomEvent('sync-progress', {
      detail: { syncing: false, success, failed, total: totalToSync }
    }));

    // Notify service worker that sync completed
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLIENT_SYNC_COMPLETE', success, failed });
      }
    } catch (e) {
      console.warn('Failed to post CLIENT_SYNC_COMPLETE to service worker:', e);
    }

    if (success > 0) {
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${success} item(s).`,
      });
      retryDelay.current = 2000; // Reset backoff delay on any success
    }

    if (failed > 0) {
      toast({
        variant: "destructive",
        title: "Sync Issues",
        description: `Failed to sync ${failed} item(s). Please check your connection.`,
      });
    }

    // Smart Retry with Exponential Backoff + Random Jitter
    if (hasNetworkError && (success + failed) > 0) {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      const nextDelay = Math.min(retryDelay.current * 2, 60000);
      const jitter = Math.random() * 1500;
      retryDelay.current = nextDelay;
      
      console.log(`Scheduling offline sync retry in ${(nextDelay + jitter).toFixed(0)}ms (backoff + jitter)...`);
      retryTimeoutRef.current = setTimeout(() => {
        runSync();
      }, nextDelay + jitter);
    }
  }, [toast, checkPending]);

  const handleRetryAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryDelay.current = 2000; // Reset backoff
    await Promise.all([
      resetFailedReadings(),
      resetFailedUploads()
    ]);
    await checkPending();
    runSync();
  };

  const handleRetrySingle = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryDelay.current = 2000; // Reset backoff
    
    const isPhotoOnly = !item.type && item.photoData;
    if (isPhotoOnly) {
      await resetSingleFailedUpload(item.id);
    } else {
      await resetSingleFailedReading(item.id);
    }
    
    await checkPending();
    window.dispatchEvent(new Event('offline-queue-updated'));
    runSync();
  };

  const handleDeleteSingle = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const isPhotoOnly = !item.type && item.photoData;
    const msg = isPhotoOnly 
      ? "Are you sure you want to discard this photo from the upload queue? (The meter reading data itself was already synced)"
      : "Are you sure you want to discard this meter reading and its associated photo from the offline queue?";

    if (confirm(msg)) {
      if (isPhotoOnly) {
        await db.uploads.delete(item.id);
      } else {
        await removeSyncedReading(item.id);
        if (item.localId) {
          const linkedUpload = await db.uploads.where('readingLocalId').equals(item.localId).first();
          if (linkedUpload && linkedUpload.id) {
            await db.uploads.delete(linkedUpload.id);
          }
        }
      }
      await checkPending();
      window.dispatchEvent(new Event('offline-queue-updated'));
      toast({
        title: isPhotoOnly ? "Photo Discarded" : "Reading Discarded",
        description: "The item has been deleted from your local cache.",
      });
    }
  };

  const handleExportBackup = async () => {
    try {
      const readings = await db.readings.toArray();
      const uploads = await db.uploads.toArray();
      const backupData = {
        version: 1,
        timestamp: Date.now(),
        readings,
        uploads
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aawsa_offline_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Backup Exported",
        description: `Successfully exported ${readings.length} readings and ${uploads.length} uploads to JSON backup.`
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: err.message || "Failed to export local data backup."
      });
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backupData = JSON.parse(text);

        if (!backupData || !Array.isArray(backupData.readings) || !Array.isArray(backupData.uploads)) {
          throw new Error("Invalid backup file format. Must contain readings and uploads lists.");
        }

        let importedReadings = 0;
        let importedUploads = 0;

        for (const r of backupData.readings) {
          const exists = await db.readings.where('localId').equals(r.localId).first();
          if (!exists) {
            const toAdd = { ...r };
            delete toAdd.id;
            await db.readings.add(toAdd);
            importedReadings++;
          }
        }

        for (const u of backupData.uploads) {
          const exists = u.readingLocalId ? await db.uploads.where('readingLocalId').equals(u.readingLocalId).first() : null;
          if (!exists) {
            const toAdd = { ...u };
            delete toAdd.id;
            await db.uploads.add(toAdd);
            importedUploads++;
          }
        }

        toast({
          title: "Backup Restored",
          description: `Successfully imported ${importedReadings} readings and ${importedUploads} photo uploads.`
        });
        
        window.dispatchEvent(new Event('offline-queue-updated'));
        e.target.value = '';
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: err.message || "Failed to restore backup file."
        });
      }
    };
    reader.readAsText(file);
  };

  React.useEffect(() => {
    checkPending();

    const handleBrowserOnline = () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryDelay.current = 2000; // Reset backoff
      runSync();
    };
    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline-queue-updated', checkPending);

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC_TRIGGER') {
        runSync();
        return;
      }
      if (event.data?.type === 'BACKGROUND_SYNC_STARTED') {
        setIsSyncing(true);
        return;
      }
      if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
        const { success = 0, failed = 0 } = event.data;
        setIsSyncing(false);
        setLastSyncResult({ success, failed });
        checkPending();
        if (success > 0) {
          toast({ title: 'Background Sync', description: `Synced ${success} item(s).` });
        }
        if (failed > 0) {
          toast({ variant: 'destructive', title: 'Background Sync Issues', description: `Failed to sync ${failed} item(s).` });
        }
        return;
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    const registerBackgroundSync = async () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const rawPending = await getPendingReadings();
          const pending = rawPending.filter((r: any) => {
            if (!currentUser?.id || isManagement) return true;
            const p = r.payload || {};
            return (
              p.readerStaffId === currentUser.id ||
              p.reader_staff_id === currentUser.id ||
              p.readerId === currentUser.id ||
              p.reader === currentUser.id ||
              r.readerStaffId === currentUser.id ||
              r.reader_staff_id === currentUser.id
            );
          });
          if (pending.length > 0) {
            const reg = await navigator.serviceWorker.ready;
            if ('sync' in reg) {
              await (reg as any).sync.register('offline-readings-sync');
            }
          }
        } catch (err) {
          console.error("Failed to register background sync:", err);
        }
      }
    };
    registerBackgroundSync();

    const handleQueueUpdated = async () => {
      await checkPending();
      await registerBackgroundSync();
    };
    window.addEventListener('offline-queue-updated', handleQueueUpdated);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      runSync();
    }

    const pollInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && !syncInProgress.current) {
        getPendingReadings().then(rawPending => {
          const pending = rawPending.filter((r: any) => {
            if (!currentUser?.id || isManagement) return true;
            const p = r.payload || {};
            return (
              p.readerStaffId === currentUser.id ||
              p.reader_staff_id === currentUser.id ||
              p.readerId === currentUser.id ||
              p.reader === currentUser.id ||
              r.readerStaffId === currentUser.id ||
              r.reader_staff_id === currentUser.id
            );
          });
          if (pending.length > 0) {
            runSync();
            registerBackgroundSync();
          }
        });
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline-queue-updated', checkPending);
      window.removeEventListener('offline-queue-updated', handleQueueUpdated);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      clearInterval(pollInterval);
    };
  }, [checkPending, runSync, currentUser, isManagement]);

  if (pendingCount === 0 && failedCount === 0 && !isSyncing) return null;

  return (
    <>
      {/* ─── SIDEBAR FOOTER RENDER ─── */}
      {isCollapsed ? (
        <div className="w-full flex items-center justify-center py-2">
          <div 
            onClick={() => setIsQueueOpen(true)}
            title={`Offline Queue: ${pendingCount} pending, ${failedCount} failed`}
            className={`relative cursor-pointer w-10 h-10 flex items-center justify-center rounded-lg border bg-white hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 shadow-sm ${
              failedCount > 0 && !isSyncing ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'border-blue-200'
            }`}
          >
            {isSyncing ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            ) : failedCount > 0 ? (
              <AlertCircle className="h-5 w-5 text-amber-600 animate-pulse" />
            ) : (
              <RefreshCw className="h-5 w-5 text-blue-600" />
            )}
            
            <span className={`absolute -top-1.5 -right-1.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md border ${
              failedCount > 0 ? 'bg-amber-600 border-amber-400' : 'bg-blue-600 border-blue-400'
            }`}>
              {pendingCount + failedCount}
            </span>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => setIsQueueOpen(true)}
          className={`w-full flex flex-col gap-2 p-3 border rounded-xl shadow-sm bg-white/70 hover:bg-white hover:border-slate-350 hover:shadow transition-all cursor-pointer select-none group ${
            failedCount > 0 && !isSyncing ? 'border-amber-250 bg-amber-50/40 hover:bg-amber-50/70' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              ) : failedCount > 0 ? (
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-none">
                {isSyncing ? "Syncing..." : (failedCount > 0 ? "Sync Alerts" : "Offline Queue")}
              </span>
            </div>
            
            <span className="text-[8px] font-extrabold text-slate-400 border border-slate-200 group-hover:text-blue-600 group-hover:border-blue-300 rounded px-1.5 py-0.2 bg-slate-50 group-hover:bg-blue-50 transition-colors">
              Manage
            </span>
          </div>

          <div className="flex flex-col gap-0.5 mt-0.5">
            <span className="text-xs font-black text-slate-900 leading-tight">
              {pendingCount} Items Pending
            </span>
            {failedCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700">
                • {failedCount} sync issue(s)
              </span>
            )}
          </div>

          {!isSyncing && (pendingCount > 0 || failedCount > 0) && (
            <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
              {pendingCount > 0 && (
                <button 
                  onClick={runSync}
                  className="flex-grow py-1 hover:bg-blue-50 text-[9px] font-bold text-blue-600 border border-blue-200 hover:border-blue-300 rounded-md transition-all bg-white"
                >
                  Sync Now
                </button>
              )}
              {failedCount > 0 && (
                <button 
                  onClick={handleRetryAll}
                  className="flex-grow py-1 flex items-center justify-center gap-0.5 bg-amber-100 hover:bg-amber-200 text-[9px] font-bold text-amber-700 border border-amber-200 rounded-md transition-all"
                >
                  <RotateCcw className="h-2.5 w-2.5" /> Retry
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── QUEUE LIST DIALOG ─── */}
      <Dialog open={isQueueOpen} onOpenChange={setIsQueueOpen}>
        <DialogContent className="max-w-2xl bg-white border border-slate-200 shadow-2xl rounded-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <RefreshCw className={`h-6 w-6 ${isSyncing ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Offline Operations Queue
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-sm mt-0.5">
                  Decoupled queue sync: metadata synced first, photos uploaded in background.
                </DialogDescription>
              </div>
              {/* Export/Import Action Buttons in Header */}
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={backupInputRef} 
                  onChange={handleImportBackup} 
                  className="hidden" 
                  accept=".json" 
                />
                <button
                  onClick={handleExportBackup}
                  title="Export offline queue backup (JSON)"
                  className="p-2 border rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors shadow-sm text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="h-4 w-4" /> Backup
                </button>
                <button
                  onClick={() => backupInputRef.current?.click()}
                  title="Import offline queue from backup (JSON)"
                  className="p-2 border rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors shadow-sm text-xs font-semibold flex items-center gap-1"
                >
                  <Upload className="h-4 w-4" /> Restore
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
            {pendingList.length === 0 && failedList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-3 animate-bounce" />
                <h3 className="font-bold text-slate-850 text-lg">All Queue Synced!</h3>
                <p className="text-sm text-slate-500 max-w-sm mt-1">
                  There are no meter readings or photos pending synchronization at this time. Good job!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* ─── PENDING ITEMS ─── */}
                {pendingList.map((item) => {
                  const isPhotoOnly = !item.type && item.photoData;
                  const photoData = isPhotoOnly ? item.photoData : (item.payload?.meter_photo || item.payload?.meterPhoto);
                  const customerKey = isPhotoOnly 
                    ? `Photo for Reading: #${item.readingId || 'Linking...'}` 
                    : (item.type === 'bulk' ? item.payload.CUSTOMERKEY : item.payload.individualCustomerId);
                  const dateStr = isPhotoOnly 
                    ? new Date(item.timestamp).toLocaleDateString() 
                    : item.payload.readingDate;
                  const value = isPhotoOnly ? null : item.payload.readingValue;
                  const faultCode = isPhotoOnly ? null : item.payload.faultCode;
                  
                  return (
                    <div 
                      key={isPhotoOnly ? `upload-pending-${item.id}` : `reading-pending-${item.id}`} 
                      className="flex items-start gap-4 p-4 bg-blue-50/30 hover:bg-blue-50/60 border border-blue-100 rounded-xl transition-all relative overflow-hidden group shadow-sm"
                    >
                      <div className="flex-shrink-0">
                        {photoData ? (
                          <img 
                            src={photoData} 
                            alt="Snapshot proof" 
                            className="w-14 h-14 object-cover rounded-lg border border-slate-200 shadow-sm bg-white"
                          />
                        ) : (
                          <div className="w-14 h-14 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-lg text-blue-600">
                            <Camera className="h-6 w-6 opacity-60" />
                          </div>
                        )}
                      </div>

                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm tracking-tight break-all">
                            {customerKey}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isPhotoOnly 
                              ? 'bg-amber-50 border-amber-200 text-amber-700' 
                              : item.type === 'bulk' 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                : 'bg-sky-50 border-sky-200 text-sky-700'
                          }`}>
                            {isPhotoOnly ? 'Photo Proof' : (item.type === 'bulk' ? 'Bulk' : 'Individual')}
                          </span>
                          
                          {isPhotoOnly ? (
                            <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 flex items-center gap-1 ${
                              item.status === 'uploading' 
                                ? 'text-blue-600 bg-blue-50 border-blue-200 animate-pulse'
                                : 'text-amber-600 bg-amber-50 border-amber-200'
                            }`}>
                              {item.status === 'uploading' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                              {item.status === 'uploading' ? 'Uploading Photo...' : 'Awaiting Photo Sync'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 flex items-center gap-1 animate-pulse">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Awaiting Sync
                            </span>
                          )}
                        </div>

                        {!isPhotoOnly && (
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                              Value: {value} m³
                            </span>
                            {faultCode && faultCode !== 'none' && (
                              <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                Fault: {faultCode}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            {dateStr}
                          </span>
                          {!isPhotoOnly && item.payload.capturedCoordinates && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3 text-rose-500" />
                              {item.payload.capturedCoordinates.latitude.toFixed(5)}, {item.payload.capturedCoordinates.longitude.toFixed(5)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={(e) => handleDeleteSingle(item, e)}
                        title="Discard from queue"
                        className="self-center p-2 rounded-full hover:bg-rose-50 hover:text-rose-600 text-slate-400 opacity-60 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  );
                })}

                {/* ─── FAILED ITEMS ─── */}
                {failedList.map((item) => {
                  const isPhotoOnly = !item.type && item.photoData;
                  const photoData = isPhotoOnly ? item.photoData : (item.payload?.meter_photo || item.payload?.meterPhoto);
                  const customerKey = isPhotoOnly 
                    ? `Photo for Reading: #${item.readingId || 'Linking...'}` 
                    : (item.type === 'bulk' ? item.payload.CUSTOMERKEY : item.payload.individualCustomerId);
                  const dateStr = isPhotoOnly 
                    ? new Date(item.timestamp).toLocaleDateString() 
                    : item.payload.readingDate;
                  const value = isPhotoOnly ? null : item.payload.readingValue;
                  const faultCode = isPhotoOnly ? null : item.payload.faultCode;
                  
                  return (
                    <div 
                      key={isPhotoOnly ? `upload-failed-${item.id}` : `reading-failed-${item.id}`} 
                      className="flex flex-col gap-2 p-4 bg-amber-50/20 hover:bg-amber-50/40 border border-amber-100 rounded-xl transition-all shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          {photoData ? (
                            <img 
                              src={photoData} 
                              alt="Snapshot proof" 
                              className="w-14 h-14 object-cover rounded-lg border border-slate-200 shadow-sm bg-white"
                            />
                          ) : (
                            <div className="w-14 h-14 flex items-center justify-center bg-amber-50 border border-amber-200 rounded-lg text-amber-600">
                              <Camera className="h-6 w-6 opacity-60" />
                            </div>
                          )}
                        </div>

                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 text-sm tracking-tight break-all">
                              {customerKey}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isPhotoOnly 
                                ? 'bg-amber-50 border-amber-200 text-amber-700' 
                                : item.type === 'bulk' 
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                  : 'bg-sky-50 border-sky-200 text-sky-700'
                            }`}>
                              {isPhotoOnly ? 'Photo Proof' : (item.type === 'bulk' ? 'Bulk' : 'Individual')}
                            </span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-55/40 border border-amber-200 rounded px-1.5 py-0.5 flex items-center gap-1">
                              <AlertCircle className="h-2.5 w-2.5" /> Sync Failed
                            </span>
                          </div>

                          {!isPhotoOnly && (
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                Value: {value} m³
                              </span>
                              {faultCode && faultCode !== 'none' && (
                                <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                  Fault: {faultCode}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {dateStr}
                            </span>
                            {!isPhotoOnly && item.payload.capturedCoordinates && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-3 w-3 text-rose-500" />
                                {item.payload.capturedCoordinates.latitude.toFixed(5)}, {item.payload.capturedCoordinates.longitude.toFixed(5)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => handleRetrySingle(item, e)}
                            title="Retry Sync"
                            className="p-2 rounded-full hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <RotateCcw className="h-4.5 w-4.5" />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteSingle(item, e)}
                            title="Discard from queue"
                            className="p-2 rounded-full hover:bg-rose-50 text-rose-500 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-amber-800 bg-amber-55/40 border border-amber-100/90 rounded-lg p-2.5 leading-relaxed break-all">
                        <span className="font-bold block text-[10px] uppercase text-amber-600 tracking-wide mb-0.5">
                          Error Reason:
                        </span>
                        {item.errorMessage || "Network or database timeout. Verify that you have a stable network and retry."}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 select-none">
              Total Queue: {pendingCount + failedCount} item(s)
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsQueueOpen(false)}
                className="px-4 py-2 hover:bg-slate-200 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors bg-white shadow-sm"
              >
                Close Queue
              </button>
              {(pendingCount > 0 || failedCount > 0) && (
                <button 
                  onClick={runSync}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" /> Force Sync All
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
