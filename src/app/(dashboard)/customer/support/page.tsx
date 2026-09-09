'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCustomerTickets } from '@/features/support/hooks/use-tickets';
import { TicketList } from '@/features/support/components/ticket-list';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PlusCircle, LifeBuoy, HelpCircle, PhoneCall, CheckCircle2, Clock, Inbox } from 'lucide-react';
import { useCustomerActivityLogger } from '@/lib/customer-activity-logger';

export default function CustomerSupportPage() {
  const [customerKey, setCustomerKey] = useState('');
  const [customerName, setCustomerName] = useState('');
  useCustomerActivityLogger('Customer Support');

  useEffect(() => {
    const raw = localStorage.getItem('customer');
    if (raw) {
      try {
        const c = JSON.parse(raw);
        setCustomerKey(c.customerKeyNumber || '');
        setCustomerName(c.name || 'Customer');
      } catch (e) {
        console.error('Failed to parse customer data:', e);
      }
    }
  }, []);

  const { tickets, isLoading, refetch } = useCustomerTickets(customerKey);

  const openTicketsCount = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 rounded-2xl text-white shadow-md">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-100 text-xs font-medium mb-2 backdrop-blur-xs">
            <LifeBuoy className="h-3.5 w-3.5 text-blue-300" />
            <span>AAWSA Customer Support Portal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black">Support & Service Requests</h1>
          <p className="text-blue-100 text-sm mt-1 max-w-xl">
            Track your submitted inquiries, report meter issues or billing disputes, and message directly with our customer care representatives.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/customer/support/new">
            <Button className="bg-white hover:bg-blue-50 text-blue-900 font-bold gap-2 shadow-lg h-11 px-5">
              <PlusCircle className="h-5 w-5 text-blue-700" />
              <span>Submit New Ticket</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-blue-100 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Tickets</p>
              <h3 className="text-xl font-bold text-gray-900 mt-0.5">{tickets.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Inbox className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">In Progress / Open</p>
              <h3 className="text-xl font-bold text-amber-600 mt-0.5">{openTicketsCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resolved</p>
              <h3 className="text-xl font-bold text-emerald-600 mt-0.5">{resolvedCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Queue / List */}
      <TicketList
        tickets={tickets}
        isLoading={isLoading}
        basePath="/customer/support"
        showBranchCol={false}
        onNewTicketHref="/customer/support/new"
      />
    </div>
  );
}
