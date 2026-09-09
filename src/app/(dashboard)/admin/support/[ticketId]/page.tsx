'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { TicketDetail } from '@/features/support/components/ticket-detail';
import { getAllStaffMembersAction } from '@/lib/actions';

export default function AdminTicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; role?: string }>>([]);

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await getAllStaffMembersAction();
        if (res.data) {
          setStaffList(res.data.map((s: any) => ({ id: s.id, name: s.name, role: s.role })));
        }
      } catch (e) {
        // non critical
      }
    }
    loadStaff();
  }, []);

  return (
    <div>
      <TicketDetail
        ticketId={ticketId}
        isStaffViewer={true}
        backHref="/admin/support"
        staffList={staffList}
      />
    </div>
  );
}
