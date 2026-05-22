"use client";

import * as React from 'react';
import { 
  getPendingReadings, 
  getFailedReadings, 
  resetFailedReadings, 
  markAsSyncing, 
  markAsFailed, 
  removeSyncedReading,
  resetSingleFailedReading
} from '@/lib/offline-db';
import { addIndividualCustomerReading, addBulkMeterReading } from '@/lib/data-store';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw, 
  Calendar, 
  MapPin, 
  Trash2, 
  Camera
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
  const syncInProgress = React.useRef(false);

  const retryDelay = React.useRef(2000);
  const retryTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Sidebar Context
  const { state: sidebarState, isMobile } = useSidebar();
  const isCollapsed = sidebarState === "collapsed" && !isMobile;

  const checkPending = React.useCallback(async () => {
    const [pending, failed] = await Promise.all([
      getPendingReadings(),
      getFailedReadings()
    ]);
    setPendingCount(pending.length);
    setFailedCount(failed.length);
    setPendingList(pending);
    setFailedList(failed);
  }, []);

  const runSync = React.useCallback(async () => {
    // Connection Check
    if (typeof navigator !== 'undefined') {
      if (!navigator.onLine) {
        syncInProgress.current = false;
        return;
      }
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) {
        console.warn("Connection is too slow (2g). Delaying automatic sync.");
        return;
      }
    }

    // Mutex: prevent concurrent sync runs
    if (syncInProgress.current) return;
    syncInProgress.current = true;

    const pending = await getPendingReadings();
    if (pending.length === 0) {
      syncInProgress.current = false;
      retryDelay.current = 2000; // Reset backoff delay
      return;
    }

    setIsSyncing(true);
    let success = 0;
    let failed = 0;
    let hasNetworkError = false;

    // Dispatch starting progress event
    window.dispatchEvent(new CustomEvent('sync-progress', {
      detail: { syncing: true, success: 0, failed: 0, total: pending.length }
    }));

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

        if (result.success) {
          await removeSyncedReading(reading.id);
          success++;
        } else {
          await markAsFailed(reading.id, result.message || 'Unknown error');
          failed++;
          // Check if message looks like network or timeout error to trigger backoff
          if (result.message?.toLowerCase().includes('network') || result.message?.toLowerCase().includes('timeout') || result.message?.toLowerCase().includes('failed to fetch')) {
            hasNetworkError = true;
          }
        }
      } catch (err: any) {
        await markAsFailed(reading.id, err.message || 'Network error');
        failed++;
        hasNetworkError = true;
      }

      // Update badge and lists after each item
      window.dispatchEvent(new Event('offline-queue-updated'));
      window.dispatchEvent(new CustomEvent('sync-progress', {
        detail: { syncing: true, success, failed, total: pending.length }
      }));
    }

    setLastSyncResult({ success, failed });
    await checkPending();
    setIsSyncing(false);
    syncInProgress.current = false;

    // Dispatch completed event
    window.dispatchEvent(new CustomEvent('sync-progress', {
      detail: { syncing: false, success, failed, total: pending.length }
    }));

    // Notify service worker (so other clients can be informed) that client sync completed
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
        description: `Successfully synced ${success} reading(s).`,
      });
      retryDelay.current = 2000; // Reset backoff delay on any success
    }

    if (failed > 0) {
      toast({
        variant: "destructive",
        title: "Sync Issues",
        description: `Failed to sync ${failed} reading(s). Please check your connection.`,
      });
    }

    // Schedule retry with exponential backoff if a network issue occurred
    if (hasNetworkError && pending.length > 0) {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      console.log(`Scheduling offline sync retry in ${retryDelay.current}ms (backoff)...`);
      retryTimeoutRef.current = setTimeout(() => {
        runSync();
      }, retryDelay.current);
      // Double the backoff up to 1 minute
      retryDelay.current = Math.min(retryDelay.current * 2, 60000);
    }
  }, [toast, checkPending]);

  const handleRetryAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryDelay.current = 2000; // Reset backoff
    await resetFailedReadings();
    await checkPending();
    runSync();
  };

  const handleRetrySingle = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryDelay.current = 2000; // Reset backoff
    await resetSingleFailedReading(id);
    await checkPending();
    window.dispatchEvent(new Event('offline-queue-updated'));
    runSync();
  };

  const handleDeleteSingle = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to discard this meter reading from the offline queue? This reading will be permanently deleted from local cache.")) {
      await removeSyncedReading(id);
      await checkPending();
      window.dispatchEvent(new Event('offline-queue-updated'));
      toast({
        title: "Reading Discarded",
        description: "The meter reading has been deleted from your local cache.",
      });
    }
  };

  React.useEffect(() => {
    checkPending();

    // ── Browser / PWA online event ───────────────────────────────────────────
    const handleBrowserOnline = () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryDelay.current = 2000; // Reset backoff
      runSync();
    };
    window.addEventListener('online', handleBrowserOnline);

    // Listen for queue-updated events to refresh badge count
    window.addEventListener('offline-queue-updated', checkPending);

      // Listen for Service Worker messages (e.g. background sync triggers)
      const handleSWMessage = (event: MessageEvent) => {
        if (event.data?.type === 'BACKGROUND_SYNC_TRIGGER') {
          runSync();
          return;
        }
        if (event.data?.type === 'BACKGROUND_SYNC_STARTED') {
          // SW reports background sync started
          setIsSyncing(true);
          return;
        }
        if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
          // SW reports completed sync (may originate from other clients)
          const { success = 0, failed = 0 } = event.data;
          setIsSyncing(false);
          setLastSyncResult({ success, failed });
          checkPending();
          if (success > 0) {
            toast({ title: 'Background Sync', description: `Synced ${success} reading(s).` });
          }
          if (failed > 0) {
            toast({ variant: 'destructive', title: 'Background Sync Issues', description: `Failed to sync ${failed} reading(s).` });
          }
          return;
        }
      };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    // Register sync tag if there are pending readings
    const registerBackgroundSync = async () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const pending = await getPendingReadings();
          if (pending.length > 0) {
            const reg = await navigator.serviceWorker.ready;
            if ('sync' in reg) {
              await (reg as any).sync.register('offline-readings-sync');
            }
          }
        } catch (err) {
          console.error("Failed to register background sync:", err);
        }
      };
    };
    registerBackgroundSync();

    // When the offline queue updates, re-register background sync (helps ensure tag is present)
    const handleQueueUpdated = async () => {
      await checkPending();
      await registerBackgroundSync();
    };
    window.addEventListener('offline-queue-updated', handleQueueUpdated);

    // Attempt sync on initial mount if already connected
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      runSync();
    }

    // Periodic sync polling: check every 30s if there are pending items and we are online
    const pollInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && !syncInProgress.current) {
        getPendingReadings().then(pending => {
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
  }, [checkPending, runSync]);

  if (pendingCount === 0 && failedCount === 0 && !isSyncing) return null;

  return (
    <>
      {/* ─── SIDEBAR FOOTER RENDER ─── */}
      {isCollapsed ? (
        /* Collapsed Sidebar Compact Circle Indicator */
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
            
            {/* Counter Badge Dot */}
            <span className={`absolute -top-1.5 -right-1.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md border ${
              failedCount > 0 ? 'bg-amber-600 border-amber-400' : 'bg-blue-600 border-blue-400'
            }`}>
              {pendingCount + failedCount}
            </span>
          </div>
        </div>
      ) : (
        /* Expanded Sidebar Panel Widget */
        <div 
          onClick={() => setIsQueueOpen(true)}
          className={`w-full flex flex-col gap-2 p-3 border rounded-xl shadow-sm bg-white/70 hover:bg-white hover:border-slate-350 hover:shadow transition-all cursor-pointer select-none group ${
            failedCount > 0 && !isSyncing ? 'border-amber-250 bg-amber-50/40 hover:bg-amber-50/70' : 'border-slate-200'
          }`}
        >
          {/* Header Row */}
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

          {/* Counts Info */}
          <div className="flex flex-col gap-0.5 mt-0.5">
            <span className="text-xs font-black text-slate-900 leading-tight">
              {pendingCount} Readings Pending
            </span>
            {failedCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700">
                • {failedCount} sync issue(s)
              </span>
            )}
          </div>

          {/* Inline Action Buttons inside Sidebar */}
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
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Offline Meter Readings Queue
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-sm mt-0.5">
                  Securely stored locally. These will synchronize to the server when connection is restored.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
            {pendingList.length === 0 && failedList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-3 animate-bounce" />
                <h3 className="font-bold text-slate-850 text-lg">All Cache Synced!</h3>
                <p className="text-sm text-slate-500 max-w-sm mt-1">
                  There are no meter readings pending synchronization at this time. Good job!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* ─── PENDING ITEMS ─── */}
                {pendingList.map((item) => {
                  const photoData = item.payload.meter_photo || item.payload.meterPhoto;
                  const customerKey = item.type === 'bulk' ? item.payload.CUSTOMERKEY : item.payload.individualCustomerId;
                  const dateStr = item.payload.readingDate;
                  const value = item.payload.readingValue;
                  const faultCode = item.payload.faultCode;
                  
                  return (
                    <div 
                      key={item.id} 
                      className="flex items-start gap-4 p-4 bg-blue-50/30 hover:bg-blue-50/60 border border-blue-100 rounded-xl transition-all relative overflow-hidden group shadow-sm"
                    >
                      <div className="flex-shrink-0">
                        {photoData ? (
                          <img 
                            src={photoData} 
                            alt="Meter Snapshot" 
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
                            item.type === 'bulk' 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                              : 'bg-sky-50 border-sky-200 text-sky-700'
                          }`}>
                            {item.type === 'bulk' ? 'Bulk' : 'Individual'}
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 flex items-center gap-1 animate-pulse">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Awaiting Sync
                          </span>
                        </div>

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

                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            {dateStr}
                          </span>
                          {item.payload.capturedCoordinates && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3 text-rose-500" />
                              {item.payload.capturedCoordinates.latitude.toFixed(5)}, {item.payload.capturedCoordinates.longitude.toFixed(5)}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.id && (
                        <button 
                          onClick={(e) => handleDeleteSingle(item.id!, e)}
                          title="Discard reading"
                          className="self-center p-2 rounded-full hover:bg-rose-50 hover:text-rose-600 text-slate-400 opacity-60 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* ─── FAILED ITEMS ─── */}
                {failedList.map((item) => {
                  const photoData = item.payload.meter_photo || item.payload.meterPhoto;
                  const customerKey = item.type === 'bulk' ? item.payload.CUSTOMERKEY : item.payload.individualCustomerId;
                  const dateStr = item.payload.readingDate;
                  const value = item.payload.readingValue;
                  const faultCode = item.payload.faultCode;
                  
                  return (
                    <div 
                      key={item.id} 
                      className="flex flex-col gap-2 p-4 bg-amber-50/20 hover:bg-amber-50/40 border border-amber-100 rounded-xl transition-all shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          {photoData ? (
                            <img 
                              src={photoData} 
                              alt="Meter Snapshot" 
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
                              item.type === 'bulk' 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                : 'bg-sky-50 border-sky-200 text-sky-700'
                            }`}>
                              {item.type === 'bulk' ? 'Bulk' : 'Individual'}
                            </span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-55/40 border border-amber-200 rounded px-1.5 py-0.5 flex items-center gap-1">
                              <AlertCircle className="h-2.5 w-2.5" /> Sync Failed
                            </span>
                          </div>

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

                          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {dateStr}
                            </span>
                            {item.payload.capturedCoordinates && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-3 w-3 text-rose-500" />
                                {item.payload.capturedCoordinates.latitude.toFixed(5)}, {item.payload.capturedCoordinates.longitude.toFixed(5)}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.id && (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => handleRetrySingle(item.id!, e)}
                              title="Retry Sync"
                              className="p-2 rounded-full hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              <RotateCcw className="h-4.5 w-4.5" />
                            </button>
                            <button 
                              onClick={(e) => handleDeleteSingle(item.id!, e)}
                              title="Discard Reading"
                              className="p-2 rounded-full hover:bg-rose-50 text-rose-500 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          </div>
                        )}
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
