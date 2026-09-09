'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { SupportTicket, TicketStatus, TicketPriority } from '../types';
import { calculateSlaStatus } from '@/lib/escalation-utils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Search, 
  MessageSquare, 
  AlertCircle, 
  Clock, 
  ArrowUpRight, 
  ChevronRight,
  Filter,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/constants/auth';

interface TicketListProps {
  tickets: SupportTicket[];
  isLoading?: boolean;
  basePath: string; // e.g. '/customer/support' or '/admin/support' or '/staff/support'
  showCustomerCol?: boolean;
  showBranchCol?: boolean;
  showAssigneeCol?: boolean;
  onNewTicketHref?: string;
}

export function TicketList({
  tickets,
  isLoading = false,
  basePath,
  showCustomerCol = false,
  showBranchCol = false,
  showAssigneeCol = false,
  onNewTicketHref,
}: TicketListProps) {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const isCustomerPortal = basePath.startsWith('/customer');
  const canCreateTicket = isCustomerPortal || (
    hasAnyPermission(PERMISSIONS.SUPPORT_CREATE, PERMISSIONS.SUPPORT_MANAGE) ||
    hasPermission('support:create') ||
    hasPermission('support:manage')
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = 
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(ticket.ticketNumber).includes(searchTerm) ||
      (ticket.customerKey && ticket.customerKey.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ticket.customerName && ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ticket.assignedStaffName && ticket.assignedStaffName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesAssignee = 
      assigneeFilter === 'all' || 
      (assigneeFilter === 'unassigned' ? !ticket.assignedTo : !!ticket.assignedTo);

    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
  });

  const getPriorityBadge = (p: TicketPriority) => {
    switch (p) {
      case 'Urgent':
        return <Badge className="bg-red-600 hover:bg-red-700 text-white font-semibold">Urgent</Badge>;
      case 'High':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">High</Badge>;
      case 'Medium':
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-gray-500 hover:bg-gray-600 text-white font-semibold">Low</Badge>;
      default:
        return <Badge variant="outline">{p}</Badge>;
    }
  };

  const getStatusBadge = (s: TicketStatus) => {
    switch (s) {
      case 'Open':
        return <Badge className="bg-blue-500 text-white">Open</Badge>;
      case 'In Progress':
        return <Badge className="bg-amber-500 text-white">In Progress</Badge>;
      case 'Pending Customer':
        return <Badge className="bg-purple-500 text-white">Pending Customer</Badge>;
      case 'Resolved':
        return <Badge className="bg-emerald-600 text-white">Resolved</Badge>;
      case 'Closed':
        return <Badge className="bg-slate-600 text-white">Closed</Badge>;
      default:
        return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tickets, subject, #ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-gray-50 border-gray-200 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-gray-50">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Pending Customer">Pending Customer</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-gray-50">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>

          {showAssigneeCol && (
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[130px] h-9 text-xs bg-gray-50">
                <SelectValue placeholder="Assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignment</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          )}

          {onNewTicketHref && canCreateTicket && (
            <Link href={onNewTicketHref}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-9 shadow-xs">
                <Plus className="h-4 w-4" />
                <span>New Ticket</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Ticket Table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-[80px] font-bold text-gray-700">Ticket #</TableHead>
                <TableHead className="min-w-[220px] font-bold text-gray-700">Subject / Category</TableHead>
                {showCustomerCol && <TableHead className="font-bold text-gray-700">Customer</TableHead>}
                {showBranchCol && <TableHead className="font-bold text-gray-700">Branch</TableHead>}
                <TableHead className="font-bold text-gray-700">Priority</TableHead>
                <TableHead className="font-bold text-gray-700">Status</TableHead>
                <TableHead className="font-bold text-gray-700">SLA Timer</TableHead>
                {showAssigneeCol && <TableHead className="font-bold text-gray-700">Assignee</TableHead>}
                <TableHead className="font-bold text-gray-700 text-right">Updated</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-gray-500">
                    Loading tickets...
                  </TableCell>
                </TableRow>
              ) : filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-gray-500">
                    No tickets found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((ticket) => {
                  const sla = calculateSlaStatus(ticket);
                  return (
                    <TableRow
                      key={ticket.id}
                      className="hover:bg-blue-50/40 transition cursor-pointer group"
                    >
                      <TableCell className="font-mono font-semibold text-blue-700">
                        #{ticket.ticketNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900 group-hover:text-blue-600 transition flex items-center gap-1.5">
                          <span>{ticket.subject}</span>
                          {(ticket.messagesCount || 0) > 1 && (
                            <span className="inline-flex items-center text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                              {ticket.messagesCount}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {ticket.categoryName || 'General'}
                        </div>
                      </TableCell>
                      {showCustomerCol && (
                        <TableCell>
                          <div className="font-medium text-gray-800 text-xs">{ticket.customerName || 'Customer'}</div>
                          <div className="text-[11px] font-mono text-gray-500">{ticket.customerKey}</div>
                        </TableCell>
                      )}
                      {showBranchCol && (
                        <TableCell className="text-xs text-gray-600">
                          {ticket.branchName || '—'}
                        </TableCell>
                      )}
                      <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${sla.isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                          {sla.statusLabel}
                        </span>
                      </TableCell>
                      {showAssigneeCol && (
                        <TableCell className="text-xs text-gray-700">
                          {ticket.assignedStaffName || <span className="text-gray-400 italic">Unassigned</span>}
                        </TableCell>
                      )}
                      <TableCell className="text-right text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(ticket.updatedAt), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`${basePath}/${ticket.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-600">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
