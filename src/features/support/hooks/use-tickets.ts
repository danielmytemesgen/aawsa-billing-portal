'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SupportTicket, TicketStatus, TicketPriority } from '../types';
import { 
  getCustomerTicketsAction, 
  getAllTicketsAction,
  updateTicketStatusAction,
  assignTicketAction 
} from '@/lib/support-actions';
import { useToast } from '@/hooks/use-toast';

export function useCustomerTickets(customerKey: string, initialStatus: string = 'all') {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const { toast } = useToast();

  const fetchTickets = useCallback(async (isSilent = false) => {
    if (!customerKey) return;
    if (!isSilent) setIsLoading(true);
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('customer') : null;
      const sessionObj = raw ? JSON.parse(raw) : null;
      const sessionId = sessionObj?.sessionId;

      const res = await getCustomerTicketsAction(customerKey, { status: statusFilter }, sessionId);
      if (!res) { if (!isSilent) setIsLoading(false); return; }
      if (res.error) {
        if (!isSilent) {
          toast({ title: 'Error', description: res.error.message, variant: 'destructive' });
        }
      } else {
        setTickets(res.data || []);
      }
    } catch {
      // Swallow polling errors silently
    }
    if (!isSilent) setIsLoading(false);
  }, [customerKey, statusFilter, toast]);

  useEffect(() => {
    fetchTickets(false);

    // Refresh every 20s if visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchTickets]);

  return {
    tickets,
    isLoading,
    statusFilter,
    setStatusFilter,
    refetch: fetchTickets,
  };
}

export function useStaffTickets(initialFilters?: {
  status?: string;
  priority?: string;
  branchId?: string;
  assignedTo?: string;
  search?: string;
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: initialFilters?.status || 'all',
    priority: initialFilters?.priority || 'all',
    branchId: initialFilters?.branchId || 'all',
    assignedTo: initialFilters?.assignedTo || '',
    search: initialFilters?.search || '',
  });
  const { toast } = useToast();

  const fetchTickets = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const res = await getAllTicketsAction(filters);
      if (!res) { if (!isSilent) setIsLoading(false); return; }
      if (res.error) {
        if (!isSilent) {
          toast({ title: 'Error', description: res.error.message, variant: 'destructive' });
        }
      } else {
        setTickets(res.data || []);
      }
    } catch {
      // Swallow polling errors silently
    }
    if (!isSilent) setIsLoading(false);
  }, [filters, toast]);

  useEffect(() => {
    fetchTickets(false);

    // Auto-refresh staff queue every 20s if visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchTickets]);

  const updateStatus = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      const res = await updateTicketStatusAction(ticketId, newStatus);
      if (!res || res.error) {
        toast({ title: 'Status update failed', description: res?.error?.message || 'Unknown error', variant: 'destructive' });
        return false;
      }
      toast({ title: 'Status updated', description: `Ticket #${res.data?.ticketNumber} is now ${newStatus}` });
      fetchTickets();
      return true;
    } catch {
      toast({ title: 'Status update failed', description: 'Unable to connect to server', variant: 'destructive' });
      return false;
    }
  };

  const assignTicket = async (ticketId: string, staffId: string) => {
    try {
      const res = await assignTicketAction(ticketId, staffId);
      if (!res || res.error) {
        toast({ title: 'Assignment failed', description: res?.error?.message || 'Unknown error', variant: 'destructive' });
        return false;
      }
      toast({ title: 'Assigned', description: `Ticket assigned to ${res.data?.assignedStaffName}` });
      fetchTickets();
      return true;
    } catch {
      toast({ title: 'Assignment failed', description: 'Unable to connect to server', variant: 'destructive' });
      return false;
    }
  };

  return {
    tickets,
    isLoading,
    filters,
    setFilters,
    updateStatus,
    assignTicket,
    refetch: fetchTickets,
  };
}
