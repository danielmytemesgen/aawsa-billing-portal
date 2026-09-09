'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TicketForm } from '@/features/support/components/ticket-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCustomerActivityLogger } from '@/lib/customer-activity-logger';

export default function CustomerNewTicketPage() {
  const [customer, setCustomer] = useState<{
    customerKeyNumber: string;
    name?: string;
    phone?: string;
    email?: string;
    customerType?: string;
    branchId?: string;
    branchName?: string;
  } | null>(null);

  useCustomerActivityLogger('Submit Ticket');

  useEffect(() => {
    const raw = localStorage.getItem('customer');
    if (raw) {
      try {
        const c = JSON.parse(raw);
        setCustomer(c);
      } catch (e) {
        console.error('Failed to parse customer data:', e);
      }
    }
  }, []);

  if (!customer) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading customer session...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customer/support">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-gray-600">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to My Tickets</span>
          </Button>
        </Link>
      </div>

      <TicketForm
        customerKey={customer.customerKeyNumber}
        customerName={customer.name}
        customerPhone={customer.phone}
        customerEmail={customer.email}
        customerType={customer.customerType || 'individual'}
        branchId={customer.branchId}
        branchName={customer.branchName}
        onSuccessRedirect="/customer/support"
      />
    </div>
  );
}
