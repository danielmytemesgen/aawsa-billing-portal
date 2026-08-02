"use client";

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function RealtimeNotificationListener() {
  const { toast } = useToast();

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      eventSource = new EventSource('/api/notifications/stream');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.title && data.message) {
            toast({
              title: data.title,
              description: data.message,
              variant: data.type === 'error' ? 'destructive' : 'default',
            });
          }
        } catch (err) {
          console.error("Failed to parse SSE notification:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE connection interrupted, reconnecting in 5 seconds...", err);
        if (eventSource) {
          eventSource.close();
        }
        reconnectTimeout = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [toast]);

  return null;
}
