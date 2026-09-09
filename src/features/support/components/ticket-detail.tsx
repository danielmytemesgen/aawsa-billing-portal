'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SupportTicket, TicketMessage, TicketStatus } from '../types';
import { useTicketMessages } from '../hooks/use-messages';
import { MessageThread } from './message-thread';
import { MessageComposer } from './message-composer';
import { TicketSidebar } from './ticket-sidebar';
import { Customer360Panel } from './customer-360-panel';
import { FeedbackDialog } from './feedback-dialog';
import { updateTicketStatusAction, assignTicketAction } from '@/lib/support-actions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  MessageSquare, 
  CheckCircle2, 
  RotateCcw, 
  UserCheck,
  Star,
  Layers,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/constants/auth';

interface TicketDetailProps {
  ticketId: string;
  isStaffViewer?: boolean;
  backHref: string;
  staffList?: Array<{ id: string; name: string; role?: string }>;
}

export function TicketDetail({
  ticketId,
  isStaffViewer = false,
  backHref,
  staffList = [],
}: TicketDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission, hasAnyPermission } = usePermissions();

  const canResolve = isStaffViewer ? (
    hasAnyPermission(PERMISSIONS.SUPPORT_RESOLVE, PERMISSIONS.SUPPORT_MANAGE) ||
    hasPermission('support:resolve') ||
    hasPermission('support:manage')
  ) : true;

  const canAssign = isStaffViewer && (
    hasAnyPermission(PERMISSIONS.SUPPORT_ASSIGN, PERMISSIONS.SUPPORT_MANAGE) ||
    hasPermission('support:assign') ||
    hasPermission('support:manage')
  );

  const canReply = isStaffViewer ? (
    hasAnyPermission(PERMISSIONS.SUPPORT_VIEW_ALL, PERMISSIONS.SUPPORT_VIEW_BRANCH, PERMISSIONS.SUPPORT_MANAGE) ||
    hasPermission('support:view_all') ||
    hasPermission('support:view_branch') ||
    hasPermission('support:manage')
  ) : true;

  const { ticket, messages, isLoading, sendMessage, refetch } = useTicketMessages(ticketId);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'thread' | '360'>('thread');

  if (isLoading || !ticket) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('customer') : null;
    const sessionObj = raw ? JSON.parse(raw) : null;
    const sessionId = sessionObj?.sessionId;
    const res = await updateTicketStatusAction(ticket.id, newStatus, sessionId);
    if (res.error) {
      toast({ title: 'Error', description: res.error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Status Updated', description: `Ticket is now marked as ${newStatus}` });
      refetch();
      if (newStatus === 'Resolved' && !isStaffViewer) {
        setIsFeedbackOpen(true);
      }
    }
  };

  const handleAssignChange = async (staffId: string) => {
    const res = await assignTicketAction(ticket.id, staffId);
    if (res.error) {
      toast({ title: 'Error', description: res.error.message, variant: 'destructive' });
    } else {
      const msg = res.data?.assignedStaffName ? `Ticket assigned to ${res.data.assignedStaffName}` : 'Ticket is now unassigned';
      toast({ title: 'Assignment Updated', description: msg });
      refetch();
    }
  };

  const handleReopen = async () => {
    await handleStatusChange('Open');
  };

  const handleResolve = async () => {
    await handleStatusChange('Resolved');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(backHref)}
            className="gap-1.5 text-xs text-gray-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-blue-700">#{ticket.ticketNumber}</span>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 line-clamp-1">{ticket.subject}</h1>
            </div>
            <div className="text-xs text-gray-500">
              Submitted by <span className="font-medium text-gray-700">{ticket.customerName || 'Customer'}</span> on {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canResolve && (ticket.status === 'Resolved' || ticket.status === 'Closed') && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleReopen}
              className="gap-1.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reopen Ticket</span>
            </Button>
          )}

          {canResolve && isStaffViewer && ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
            <Button
              size="sm"
              onClick={handleResolve}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Mark as Resolved</span>
            </Button>
          )}

          {ticket.feedback && (
            <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 text-xs font-semibold text-amber-800">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span>Rated {ticket.feedback.rating}/5</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Conversation / 360 Tab */}
        <div className="lg:col-span-2 space-y-6">
          {/* Staff Tab Switcher between Thread and Customer 360 */}
          {isStaffViewer && (
            <div className="flex border-b border-gray-200 pb-2 gap-2">
              <Button
                variant={activeTab === 'thread' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('thread')}
                className={`text-xs gap-1.5 ${activeTab === 'thread' ? 'bg-blue-600' : ''}`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Conversation Thread ({messages.length})</span>
              </Button>
              <Button
                variant={activeTab === '360' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('360')}
                className={`text-xs gap-1.5 ${activeTab === '360' ? 'bg-blue-600' : ''}`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Customer 360° Overview</span>
              </Button>
            </div>
          )}

          {activeTab === 'thread' ? (
            <>
              {/* Original Issue Description Card */}
              <Card className="border-gray-200 shadow-xs bg-white">
                <CardHeader className="p-4 pb-2 border-b border-gray-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Original Issue Description
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] text-gray-600 bg-gray-50">
                    {ticket.categoryName || 'General Inquiry'}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </CardContent>
              </Card>

              {/* Threaded Message Stream */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
                  Responses & History
                </h3>
                <MessageThread
                  messages={messages}
                  isStaffViewer={isStaffViewer}
                />
              </div>

              {/* Message Composer */}
              {ticket.status !== 'Closed' ? (
                canReply ? (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
                      Reply to Ticket
                    </h3>
                    <MessageComposer
                      onSendMessage={sendMessage}
                      isStaffViewer={isStaffViewer}
                      placeholder={isStaffViewer ? "Reply to customer or log internal progress..." : "Write a follow-up message..."}
                    />
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    You have read-only access to view this ticket. Replying is disabled for your role.
                  </div>
                )
              ) : (
                <div className="p-4 text-center text-xs text-gray-500 bg-gray-100 rounded-lg border border-gray-200">
                  This ticket has been closed. {canResolve ? "To continue the conversation, click Reopen Ticket above." : ""}
                </div>
              )}
            </>
          ) : (
            <Customer360Panel 
              customerKey={ticket.customerKey} 
              ticketCategory={ticket.categoryName}
              ticketSubject={ticket.subject}
            />
          )}
        </div>

        {/* Right Column: Metadata Sidebar & Customer 360 Quick Card */}
        <div className="space-y-6">
          <TicketSidebar
            ticket={ticket}
            isStaffViewer={isStaffViewer}
            onStatusChange={handleStatusChange}
            onAssignChange={handleAssignChange}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
            staffList={staffList}
          />

          {!isStaffViewer ? (
            <Card className="border-blue-100 bg-blue-50/50 shadow-xs">
              <CardContent className="p-4 text-xs text-blue-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Need emergency assistance?
                </div>
                <p>For urgent pipe bursts or immediate water leakage emergency, you can also reach the AAWSA 24/7 hotline at <strong>906</strong>.</p>
              </CardContent>
            </Card>
          ) : (
            <Customer360Panel 
              customerKey={ticket.customerKey} 
              ticketCategory={ticket.categoryName}
              ticketSubject={ticket.subject}
            />
          )}
        </div>
      </div>

      {/* CSAT Survey Modal */}
      <FeedbackDialog
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        ticketId={ticket.id}
        ticketNumber={ticket.ticketNumber}
        onFeedbackSubmitted={refetch}
      />
    </div>
  );
}
