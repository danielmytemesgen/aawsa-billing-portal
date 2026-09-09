'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { SupportDashboardMetrics, SupportTicket, TicketStatus } from '../types';
import { getSupportDashboardAction, runEscalationSweepAction } from '@/lib/support-actions';
import { TicketList } from './ticket-list';
import { SupportReportDialog } from './support-report-dialog';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Inbox, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Star, 
  ShieldAlert, 
  TrendingUp,
  BarChart3,
  PieChart,
  Users,
  Building,
  RefreshCw,
  FileSpreadsheet,
  Check
} from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllBranchesAction } from '@/lib/actions';

interface SupportDashboardProps {
  branchId?: string;
  isGlobalAdmin?: boolean;
  basePath?: string; // '/admin/support' or '/staff/support'
}

export function SupportDashboard({
  branchId,
  isGlobalAdmin = false,
  basePath = '/admin/support',
}: SupportDashboardProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>(branchId || 'all');
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [metrics, setMetrics] = useState<SupportDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepMessage, setSweepMessage] = useState<string | null>(null);

  // Background interval sweep: checks for escalations every 15 minutes while dashboard is active
  useEffect(() => {
    const sweepInterval = setInterval(async () => {
      try {
        const res = await runEscalationSweepAction();
        if (res.data && res.data.escalatedCount > 0) {
          fetchMetrics();
        }
      } catch {
        // silent background sweep
      }
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(sweepInterval);
  }, []);

  const handleRunSweep = async () => {
    setIsSweeping(true);
    setSweepMessage(null);
    try {
      const res = await runEscalationSweepAction();
      if (res.data) {
        setSweepMessage(res.data.message);
        await fetchMetrics();
      } else if (res.error) {
        setSweepMessage(res.error.message);
      }
    } catch (e: any) {
      setSweepMessage(e?.message || 'Sweep execution failed');
    } finally {
      setIsSweeping(false);
      setTimeout(() => setSweepMessage(null), 6000);
    }
  };

  useEffect(() => {
    async function loadBranches() {
      if (isGlobalAdmin) {
        try {
          const res = await getAllBranchesAction();
          if (res.data) setBranches(res.data);
        } catch (e) {
          // non critical
        }
      }
    }
    loadBranches();
  }, [isGlobalAdmin]);

  const fetchMetrics = async () => {
    setIsLoading(true);
    const targetBranch = isGlobalAdmin 
      ? (selectedBranch === 'all' ? undefined : selectedBranch)
      : branchId;
    const res = await getSupportDashboardAction(targetBranch);
    if (res.data) setMetrics(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, [selectedBranch, branchId]);

  if (isLoading || !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open & In Progress */}
        <Card className="border-blue-100 bg-gradient-to-br from-blue-50/50 to-white shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Open Tickets</p>
              <h3 className="text-2xl font-black text-blue-950 mt-1">{metrics.openTickets}</h3>
              <p className="text-[11px] text-gray-500 mt-1">
                <span className="font-semibold text-amber-600">{metrics.inProgressTickets}</span> in progress
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Inbox className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* SLA Compliance */}
        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">SLA Compliance</p>
              <h3 className="text-2xl font-black text-emerald-950 mt-1">{metrics.slaComplianceRate}%</h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Avg Response: <span className="font-semibold text-gray-800">{metrics.averageResponseTimeHours}h</span>
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Resolved Count */}
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Resolved Total</p>
              <h3 className="text-2xl font-black text-indigo-950 mt-1">{metrics.resolvedTickets}</h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Avg Resolution: <span className="font-semibold text-gray-800">{metrics.averageResolutionTimeHours}h</span>
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* CSAT Rating */}
        <Card className="border-amber-100 bg-gradient-to-br from-amber-50/50 to-white shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">CSAT Score</p>
              <h3 className="text-2xl font-black text-amber-950 mt-1 flex items-center gap-1">
                {metrics.averageCsatRating} <span className="text-base text-amber-500">★</span>
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Based on <span className="font-semibold text-gray-800">{metrics.totalFeedbackCount}</span> reviews
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Star className="h-6 w-6 fill-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Breakdown: Categories & Branches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <Card className="border-gray-200 shadow-xs bg-white">
          <CardHeader className="p-4 pb-2 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-blue-600" />
              Ticket Volume by Issue Category
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {metrics.ticketsByCategory.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No data yet</p>
            ) : (
              metrics.ticketsByCategory.map((cat, idx) => {
                const percent = metrics.totalTickets > 0 ? Math.round((cat.count / metrics.totalTickets) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-gray-700">
                      <span>{cat.category}</span>
                      <span>{cat.count} ({percent}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.max(percent, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* By Branch */}
        <Card className="border-gray-200 shadow-xs bg-white">
          <CardHeader className="p-4 pb-2 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Building className="h-4 w-4 text-indigo-600" />
              Ticket Distribution by Branch Office
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {metrics.ticketsByBranch.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No data yet</p>
            ) : (
              metrics.ticketsByBranch.map((br, idx) => {
                const percent = metrics.totalTickets > 0 ? Math.round((br.count / metrics.totalTickets) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-gray-700">
                      <span>{br.branch}</span>
                      <span>{br.count} ({percent}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${Math.max(percent, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Global / Branch Ticket Queue Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">Support Ticket Queue</h2>
            {selectedBranch !== 'all' && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {branches.find(b => b.id === selectedBranch)?.name || 'Branch Scoped'}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isGlobalAdmin && branches.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Building className="h-4 w-4 text-gray-400" />
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-[180px] h-8 text-xs bg-white">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches (Global)</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Run SLA Escalation Sweep Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunSweep}
              disabled={isSweeping}
              className="gap-1.5 text-xs h-8 bg-amber-50/80 hover:bg-amber-100 text-amber-900 border-amber-300"
              title="Execute SLA escalation check for overdue tickets (24h Level 1 / 48h Level 2)"
            >
              <ShieldAlert className={`h-3.5 w-3.5 text-amber-600 ${isSweeping ? 'animate-spin' : ''}`} />
              <span>{isSweeping ? 'Sweeping...' : 'Run SLA Sweep'}</span>
            </Button>

            {/* Export Monthly Branch Report Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReportOpen(true)}
              className="gap-1.5 text-xs h-8 bg-blue-50/80 hover:bg-blue-100 text-blue-900 border-blue-300"
              title="Generate monthly branch SLA, resolution time, and CSAT report (Excel/PDF)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-700" />
              <span>Export Report</span>
            </Button>

            <Button variant="outline" size="sm" onClick={fetchMetrics} className="gap-1 text-xs h-8">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Live SLA Sweep Notification Banner */}
        {sweepMessage && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-950 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="font-medium">{sweepMessage}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSweepMessage(null)} 
              className="h-6 text-[11px] px-2 text-blue-800 hover:bg-blue-100"
            >
              Dismiss
            </Button>
          </div>
        )}

        <TicketList
          tickets={metrics.recentTickets}
          basePath={basePath}
          showCustomerCol={true}
          showBranchCol={true}
          showAssigneeCol={true}
        />
      </div>

      {/* Monthly SLA & CSAT Report Modal */}
      <SupportReportDialog
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        branchId={selectedBranch === 'all' ? undefined : selectedBranch}
      />
    </div>
  );
}
