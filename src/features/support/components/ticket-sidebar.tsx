'use client';

import React, { useState } from 'react';
import type { SupportTicket, TicketStatus, TicketPriority } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateSlaStatus } from '@/lib/escalation-utils';
import { 
  Clock, 
  User, 
  Building, 
  Tag, 
  AlertCircle, 
  CheckCircle, 
  Flame, 
  Calendar,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';

import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/constants/auth';

interface TicketSidebarProps {
  ticket: SupportTicket;
  isStaffViewer?: boolean;
  onStatusChange?: (newStatus: TicketStatus) => Promise<boolean | void>;
  onAssignChange?: (staffId: string) => Promise<boolean | void>;
  onOpenFeedback?: () => void;
  staffList?: Array<{ id: string; name: string; role?: string }>;
}

export function TicketSidebar({
  ticket,
  isStaffViewer = false,
  onStatusChange,
  onAssignChange,
  onOpenFeedback,
  staffList = [],
}: TicketSidebarProps) {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const canAssign = isStaffViewer && (
    hasAnyPermission(PERMISSIONS.SUPPORT_ASSIGN, PERMISSIONS.SUPPORT_MANAGE) ||
    hasPermission('support:assign') ||
    hasPermission('support:manage')
  );
  const canResolve = isStaffViewer ? (
    hasAnyPermission(PERMISSIONS.SUPPORT_RESOLVE, PERMISSIONS.SUPPORT_MANAGE) ||
    hasPermission('support:resolve') ||
    hasPermission('support:manage')
  ) : false;

  const sla = calculateSlaStatus(ticket);

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
      {/* SLA Timer Card */}
      <Card className={`border shadow-xs ${sla.isOverdue ? 'border-red-300 bg-red-50/50' : 'border-blue-200 bg-blue-50/40'}`}>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-600" />
              SLA Timer & Resolution
            </span>
            {ticket.escalationLevel && ticket.escalationLevel > 0 ? (
              <Badge variant="destructive" className="text-[10px] uppercase font-bold animate-pulse">
                Level {ticket.escalationLevel} Escalated
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">SLA Status:</span>
            <span className={`font-bold ${sla.isOverdue ? 'text-red-700' : 'text-blue-900'}`}>
              {sla.statusLabel}
            </span>
          </div>
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Hours Elapsed: {sla.hoursElapsed}h</span>
            <span>Target: {sla.targetHours}h</span>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Details & Metadata */}
      <Card className="border-gray-200 shadow-sm bg-white">
        <CardHeader className="p-4 pb-3 border-b">
          <CardTitle className="text-sm font-bold text-gray-800">Ticket Information</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4 text-sm">
          {/* Status & Transitions */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5 flex items-center justify-between">
              <span>Status</span>
              {isStaffViewer && !canResolve && (
                <span className="text-[10px] text-gray-400 font-normal">Read only</span>
              )}
            </div>
            {isStaffViewer && canResolve && onStatusChange ? (
              <Select
                value={ticket.status}
                onValueChange={(val) => onStatusChange(val as TicketStatus)}
              >
                <SelectTrigger className="w-full h-8 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Pending Customer">Pending Customer</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center justify-between">
                {getStatusBadge(ticket.status)}
                {ticket.status === 'Resolved' && onOpenFeedback && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                    onClick={onOpenFeedback}
                  >
                    Rate Support
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Priority:</span>
            {getPriorityBadge(ticket.priority)}
          </div>

          {/* Category */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Category:</span>
            <span className="font-semibold text-gray-800 text-xs bg-gray-100 px-2.5 py-1 rounded-md">
              {ticket.categoryName || 'General Inquiry'}
            </span>
          </div>

          {/* Branch */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Branch:</span>
            <span className="font-medium text-gray-700 text-xs flex items-center gap-1">
              <Building className="h-3.5 w-3.5 text-gray-400" />
              {ticket.branchName || 'Unassigned'}
            </span>
          </div>

          {/* Assigned Staff */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5 flex items-center justify-between">
              <span>Assigned To</span>
              {isStaffViewer && !canAssign && (
                <span className="text-[10px] text-gray-400 font-normal">Read only</span>
              )}
            </div>
            {isStaffViewer && canAssign && onAssignChange ? (
              <Select
                value={ticket.assignedTo || 'unassigned'}
                onValueChange={(val) => onAssignChange(val === 'unassigned' ? '' : val)}
              >
                <SelectTrigger className="w-full h-8 text-xs font-medium">
                  <SelectValue placeholder="Assign Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staffList.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.name} {st.role ? `(${st.role})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="font-medium text-gray-800 text-xs flex items-center justify-between bg-gray-50/70 p-2 rounded-md border border-gray-100">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-600" />
                  <span>{ticket.assignedStaffName || 'Not yet assigned'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Submitted:</span>
              <span>{format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</span>
            </div>
            {ticket.firstResponseAt && (
              <div className="flex justify-between">
                <span>First Response:</span>
                <span>{format(new Date(ticket.firstResponseAt), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}
            {ticket.resolvedAt && (
              <div className="flex justify-between">
                <span>Resolved:</span>
                <span>{format(new Date(ticket.resolvedAt), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
