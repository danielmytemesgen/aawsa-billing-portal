'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TicketMessage, SupportTicket, AddMessageInput } from '../types';
import { getTicketDetailAction, addMessageAction } from '@/lib/support-actions';
import { useToast } from '@/hooks/use-toast';

export function useTicketMessages(ticketId: string) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const fetchDetails = useCallback(async (isSilent = false) => {
    if (!ticketId) return;
    if (!isSilent) setIsLoading(true);
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('customer') : null;
      const sessionObj = raw ? JSON.parse(raw) : null;
      const sessionId = sessionObj?.sessionId;

      const res = await getTicketDetailAction(ticketId, sessionId);
      // Guard: server actions can return undefined if serialization/session fails
      if (!res) {
        if (!isSilent) setIsLoading(false);
        return;
      }
      if (res.error) {
        if (!isSilent) {
          toast({
            title: 'Error loading conversation',
            description: res.error.message,
            variant: 'destructive',
          });
        }
      } else if (res.data) {
        setTicket(res.data.ticket);
        setMessages(res.data.messages);
      }
    } catch (e) {
      // Swallow background polling errors silently
      if (!isSilent) {
        toast({
          title: 'Error loading conversation',
          description: 'Unable to connect to the server. Please refresh.',
          variant: 'destructive',
        });
      }
    }
    if (!isSilent) setIsLoading(false);
  }, [ticketId, toast]);

  useEffect(() => {
    fetchDetails(false);

    // Live polling: refresh message thread every 5 seconds when visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDetails(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchDetails]);

  const sendMessage = async (input: {
    message: string;
    isInternalNote?: boolean;
    attachments?: Array<{ fileUrl: string; fileName: string; fileSize?: number; fileType?: string }>;
    senderType?: 'customer' | 'staff' | 'system';
    senderId?: string;
    senderName?: string;
  }) => {
    if (!ticketId) return false;
    setIsSending(true);
    const raw = typeof window !== 'undefined' ? localStorage.getItem('customer') : null;
    const sessionObj = raw ? JSON.parse(raw) : null;
    const sessionId = sessionObj?.sessionId;

    const res = await addMessageAction({
      ticketId,
      message: input.message,
      isInternalNote: input.isInternalNote ?? false,
      attachments: input.attachments ?? [],
      senderType: input.senderType ?? 'customer',
      senderId: input.senderId,
      senderName: input.senderName,
    }, sessionId);
    setIsSending(false);

    if (res.error) {
      toast({
        title: 'Failed to send message',
        description: res.error.message,
        variant: 'destructive',
      });
      return false;
    }

    if (res.data) {
      setMessages((prev) => [...prev, res.data!]);
    }
    return true;
  };

  return {
    ticket,
    messages,
    isLoading,
    isSending,
    sendMessage,
    refetch: fetchDetails,
  };
}
