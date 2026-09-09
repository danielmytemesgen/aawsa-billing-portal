'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { TicketDetail } from '@/features/support/components/ticket-detail';
import { useCustomerActivityLogger } from '@/lib/customer-activity-logger';

export default function CustomerTicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  useCustomerActivityLogger('View Ticket Detail');

  return (
    <div>
      <TicketDetail
        ticketId={ticketId}
        isStaffViewer={false}
        backHref="/customer/support"
      />
    </div>
  );
}
