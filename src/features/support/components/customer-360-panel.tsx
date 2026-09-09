'use client';

import React, { useState, useEffect } from 'react';
import type { Customer360Summary } from '../types';
import { getCustomer360Action } from '@/lib/support-actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Gauge, 
  CreditCard, 
  History, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Receipt,
  Navigation
} from 'lucide-react';
import { MeterMiniMap } from './meter-mini-map';

interface Customer360PanelProps {
  customerKey: string;
  ticketCategory?: string | null;
  ticketSubject?: string | null;
}

export function Customer360Panel({ customerKey, ticketCategory, ticketSubject }: Customer360PanelProps) {
  const [data, setData] = useState<Customer360Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isPhysicalIssue = Boolean(
    (ticketCategory && /pipe|burst|leak|pressure|meter|physical|damage|flow|replace/i.test(ticketCategory)) ||
    (ticketSubject && /pipe|burst|leak|pressure|meter|physical|damage|flow|replace/i.test(ticketSubject))
  );

  useEffect(() => {
    async function loadSummary() {
      if (!customerKey) return;
      setIsLoading(true);
      const res = await getCustomer360Action(customerKey);
      if (res.data) setData(res.data);
      setIsLoading(false);
    }
    loadSummary();
  }, [customerKey]);

  if (isLoading) {
    return (
      <Card className="border-gray-200 shadow-sm p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border-blue-200 shadow-sm bg-gradient-to-b from-blue-50/40 to-white">
      <CardHeader className="p-4 pb-2 border-b border-blue-100">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
          <User className="h-4 w-4 text-blue-600" />
          Customer 360° Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4 text-xs">
        {/* Customer Identity */}
        <div>
          <div className="font-bold text-sm text-gray-900">{data.name}</div>
          <div className="text-gray-500">Key: <span className="font-mono text-blue-700 font-semibold">{data.customerKey}</span></div>
          {data.phone && (
            <div className="flex items-center gap-1 text-gray-600 mt-1">
              <Phone className="h-3 w-3 text-gray-400" />
              <span>{data.phone}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-1 text-gray-600 mt-0.5">
              <Mail className="h-3 w-3 text-gray-400" />
              <span>{data.email}</span>
            </div>
          )}
          {data.branchName && (
            <div className="flex items-center gap-1 text-gray-600 mt-0.5">
              <MapPin className="h-3 w-3 text-gray-400" />
              <span>{data.branchName} {data.subCity ? `(${data.subCity})` : ''}</span>
            </div>
          )}
        </div>

        {/* Meter Info & Readings */}
        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs space-y-1.5">
          <div className="font-semibold text-gray-700 flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-indigo-600" />
            <span>Meter & Consumption</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Meter Key:</span>
            <span className="font-mono font-medium">{data.meterKey || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Current Reading:</span>
            <span className="font-semibold text-gray-900">{data.currentReading ?? '—'} m³</span>
          </div>
        </div>

        {/* GIS Physical Meter Location (Leaflet) */}
        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs space-y-2">
          <div className="font-semibold text-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              <span>GIS Meter Location</span>
            </div>
            {isPhysicalIssue && (
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 uppercase tracking-wide">
                Dispatch Target
              </Badge>
            )}
          </div>

          <MeterMiniMap
            latitude={
              data.xCoordinate != null && data.yCoordinate != null && data.yCoordinate < 15 && data.xCoordinate > 30
                ? data.yCoordinate
                : data.xCoordinate
            }
            longitude={
              data.xCoordinate != null && data.yCoordinate != null && data.yCoordinate < 15 && data.xCoordinate > 30
                ? data.xCoordinate
                : data.yCoordinate
            }
            customerName={data.name}
            customerKey={data.customerKey}
            meterKey={data.meterKey}
            specificArea={data.specificArea ? `${data.specificArea}${data.woreda ? `, Woreda ${data.woreda}` : ''}` : undefined}
            isPhysicalIssue={isPhysicalIssue}
            issueTitle={ticketSubject || ticketCategory || undefined}
          />
        </div>

        {/* Account & Billing Status */}
        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs space-y-1.5">
          <div className="font-semibold text-gray-700 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
            <span>Account Balance</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Outstanding:</span>
            <span className={`font-bold ${Number(data.outstandingBill || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              ETB {Number(data.outstandingBill || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Credit Balance:</span>
            <span className="font-bold text-emerald-700">
              ETB {Number(data.creditBalance || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-gray-100">
            <span className="text-gray-600">Status:</span>
            <Badge variant={data.paymentStatus === 'Paid' ? 'outline' : 'secondary'} className="text-[10px]">
              {data.paymentStatus || 'Active'}
            </Badge>
          </div>
        </div>

        {/* Ticket History stats */}
        <div className="flex items-center justify-between p-2.5 bg-blue-50/80 rounded-lg text-blue-950 font-medium">
          <span className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-blue-600" />
            Support History:
          </span>
          <span>{data.resolvedTicketsCount} / {data.totalTicketsCount} Resolved</span>
        </div>

        {/* Recent Bills Mini Table */}
        {data.recentBills && data.recentBills.length > 0 && (
          <div>
            <div className="font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
              <Receipt className="h-3.5 w-3.5 text-gray-500" />
              <span>Recent Bills</span>
            </div>
            <div className="space-y-1">
              {data.recentBills.slice(0, 3).map((bill, idx) => (
                <div key={idx} className="flex justify-between items-center p-1.5 bg-gray-50 rounded border border-gray-100 text-[11px]">
                  <span className="font-medium text-gray-700">{bill.month}</span>
                  <span className="text-gray-600">ETB {Number(bill.totalAmount || 0).toLocaleString()}</span>
                  <Badge 
                    variant="outline" 
                    className={`text-[9px] px-1 py-0 ${
                      bill.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {bill.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
