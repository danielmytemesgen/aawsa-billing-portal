"use client";

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { addIndividualCustomerReading, addBulkMeterReading } from "@/lib/data-store";

export function SyncHub() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const updateStatus = () => {
    setIsOnline(navigator.onLine);
    const queue = JSON.parse(localStorage.getItem('offlineReadingsQueue') || '[]');
    setQueueCount(queue.length);
  };

  useEffect(() => {
    // Initial check
    updateStatus();

    // Event listeners
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('offline-queue-updated', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('offline-queue-updated', updateStatus);
    };
  }, []);

  const handleSync = async () => {
    if (!isOnline) {
      toast({ title: "Offline", description: "Cannot sync while offline.", variant: "destructive" });
      return;
    }

    const queue = JSON.parse(localStorage.getItem('offlineReadingsQueue') || '[]');
    if (queue.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;
    const remainingQueue = [];

    for (const item of queue) {
      try {
        let result;
        if (item.type === 'individual') {
          result = await addIndividualCustomerReading(item.payload);
        } else {
          result = await addBulkMeterReading(item.payload);
        }

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          remainingQueue.push(item);
        }
      } catch (err) {
        failCount++;
        remainingQueue.push(item);
      }
    }

    localStorage.setItem('offlineReadingsQueue', JSON.stringify(remainingQueue));
    setQueueCount(remainingQueue.length);
    setIsSyncing(false);

    if (failCount === 0) {
      toast({ title: "Sync Complete", description: `Successfully synced ${successCount} readings.` });
    } else {
      toast({ 
        title: "Sync Partially Complete", 
        description: `Synced ${successCount}. Failed ${failCount}.`, 
        variant: "destructive" 
      });
    }
  };

  if (queueCount === 0 && isOnline) return null; // Hide if nothing to do

  return (
    <div className="flex items-center gap-2 mr-2">
      {!isOnline ? (
        <Badge variant="destructive" className="flex items-center gap-1">
          <WifiOff className="h-3 w-3" /> Offline
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
          <Wifi className="h-3 w-3" /> Online
        </Badge>
      )}

      {queueCount > 0 && (
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleSync} 
          disabled={!isOnline || isSyncing}
          className="h-8 text-xs font-semibold"
        >
          <RefreshCw className={`h-3 w-3 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync ({queueCount})
        </Button>
      )}
    </div>
  );
}
