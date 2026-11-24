"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { History, Search, PhoneCall, RotateCw, Filter, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { getCallHistoryAction } from "@/lib/actions";
import { format } from "date-fns";

export function CallHistoryTable() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [totalLogs, setTotalLogs] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);

  const fetchLogs = React.useCallback(async (p: number, ps: number, q: string, cat: string) => {
    setLoading(true);
    try {
      const res: any = await getCallHistoryAction({
        page: p,
        pageSize: ps,
        search: q || undefined,
        category: cat !== "all" ? cat : undefined,
      });

      if (res && res.logs) {
        setLogs(res.logs);
        setTotalLogs(res.total || 0);
      } else {
        setLogs([]);
        setTotalLogs(0);
      }
    } catch (err) {
      console.warn("Failed to fetch call logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      fetchLogs(page, pageSize, search, categoryFilter);
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchLogs, page, pageSize, search, categoryFilter]);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "billing_dispute":
        return <Badge className="bg-red-50 text-red-700 border-red-200">Billing Dispute</Badge>;
      case "payment_inquiry":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Payment Inquiry</Badge>;
      case "reading_check":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Reading Check</Badge>;
      case "leak_report":
        return <Badge className="bg-rose-600 text-white">Leak / Pipe Burst</Badge>;
      case "water_interruption":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Supply Interruption</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{cat.replace(/_/g, " ")}</Badge>;
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="bg-slate-50 border-b p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Call Center Interaction Logs
            </CardTitle>
            <CardDescription className="text-xs">
              Complete audit history of customer hotline inquiries, resolution outcomes, and agent notes.
            </CardDescription>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchLogs(page, pageSize, search, categoryFilter)}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Filter by caller phone, name, customer key, or notes..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-8 pl-8 text-xs bg-white"
            />
          </div>

          <div className="w-full sm:w-52">
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-white">
                <div className="flex items-center gap-1.5 truncate">
                  <Filter className="h-3 w-3 text-slate-400" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                <SelectItem value="billing_dispute" className="text-xs">Billing Dispute</SelectItem>
                <SelectItem value="payment_inquiry" className="text-xs">Payment Inquiry</SelectItem>
                <SelectItem value="reading_check" className="text-xs">Reading Verification</SelectItem>
                <SelectItem value="leak_report" className="text-xs">Leak / Pipe Burst</SelectItem>
                <SelectItem value="water_interruption" className="text-xs">Supply Interruption</SelectItem>
                <SelectItem value="general" className="text-xs">General Information</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-xs font-bold text-slate-700">Call Timestamp</TableHead>
              <TableHead className="text-xs font-bold text-slate-700">Caller / Customer</TableHead>
              <TableHead className="text-xs font-bold text-slate-700">Phone</TableHead>
              <TableHead className="text-xs font-bold text-slate-700">Category</TableHead>
              <TableHead className="text-xs font-bold text-slate-700">Duration</TableHead>
              <TableHead className="text-xs font-bold text-slate-700">Agent Notes</TableHead>
              <TableHead className="text-xs font-bold text-slate-700">Agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-36 text-center">
                  <div className="flex flex-col items-center justify-center space-y-1.5 text-slate-400">
                    <RotateCw className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-xs">Loading call logs...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-slate-400 text-xs">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <PhoneCall className="h-6 w-6 text-slate-300" />
                    <p className="font-semibold text-slate-600">No Call Logs Found</p>
                    <p className="text-[11px] text-slate-400">No interactions match your current filter criteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log: any) => (
                <TableRow key={log.id} className="text-xs hover:bg-slate-50/80 border-b border-slate-100">
                  <TableCell className="font-mono text-slate-500 whitespace-nowrap">
                    {log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{log.caller_name || "Caller"}</div>
                    {log.customer_key_number && (
                      <span className="font-mono text-[11px] text-blue-700">{log.customer_key_number}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-slate-700 whitespace-nowrap">{log.caller_phone}</TableCell>
                  <TableCell>{getCategoryBadge(log.category)}</TableCell>
                  <TableCell className="font-mono text-slate-600 whitespace-nowrap">
                    {Math.floor(log.duration_seconds / 60)}m {log.duration_seconds % 60}s
                  </TableCell>
                  <TableCell className="max-w-xs text-slate-700">
                    <p className="line-clamp-2">{log.notes || "—"}</p>
                  </TableCell>
                  <TableCell className="text-slate-500 text-[11px] whitespace-nowrap">
                    {log.agent_email}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalLogs > 0 && (
        <div className="p-3 border-t">
          <TablePagination
            count={totalLogs}
            page={page - 1}
            rowsPerPage={pageSize}
            onPageChange={(p) => setPage(p + 1)}
            onRowsPerPageChange={(ps) => {
              setPageSize(ps);
              setPage(1);
            }}
          />
        </div>
      )}
    </Card>
  );
}
