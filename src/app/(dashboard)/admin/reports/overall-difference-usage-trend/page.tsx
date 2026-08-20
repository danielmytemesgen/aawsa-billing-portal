"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  getBulkMeters, initializeBulkMeters, subscribeToBulkMeters,
  getBranches, initializeBranches, subscribeToBranches
} from "@/lib/data-store";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { usePermissions } from "@/hooks/use-permissions";
import { TrendingUp } from "lucide-react";
import { PERMISSIONS } from "@/lib/constants/auth";

export default function OverallDifferenceUsageTrendPage() {
  const { hasPermission } = usePermissions();
  const canViewAllBranches = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) || hasPermission('reports_generate_all') || hasPermission(PERMISSIONS.BILL_VIEW_ALL);
  const [currentUser, setCurrentUser] = React.useState<any>(null);

  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("all");
  const [selectedYear, setSelectedYear] = React.useState<string>("all");
  const [selectedMonth, setSelectedMonth] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(true);
  const chartRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      const parsedUser = JSON.parse(user);
      setCurrentUser(parsedUser);
      if (parsedUser.branchId && !hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) && !hasPermission('reports_generate_all')) {
        setSelectedBranchId(parsedUser.branchId);
      }
    }

    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([
        initializeBulkMeters(),
        initializeBranches(),
      ]);
      setBulkMeters(getBulkMeters());
      setBranches(getBranches());
      setIsLoading(false);
    };
    fetchData();

    const unsubBms = subscribeToBulkMeters(setBulkMeters);
    const unsubBranches = subscribeToBranches(setBranches);

    return () => {
      unsubBms();
      unsubBranches();
    };
  }, [hasPermission]);

  const years = React.useMemo(() => {
    const allYears = new Set(bulkMeters.map(bm => bm.month.split('-')[0]));
    return Array.from(allYears).sort().reverse();
  }, [bulkMeters]);


  const chartData = React.useMemo(() => {
    let filteredBms = bulkMeters;

    if (selectedYear !== "all") {
      filteredBms = filteredBms.filter(bm => bm.month.startsWith(selectedYear));
    }
    if (selectedMonth !== "all") {
      filteredBms = filteredBms.filter(bm => bm.month.split('-')[1] === selectedMonth);
    }

    const effectiveBranchId = canViewAllBranches ? selectedBranchId : (currentUser?.branchId || selectedBranchId);

    const branchUsage: { [key: string]: { name: string; differenceUsage: number } } = {};

    branches.forEach(branch => {
      if (branch.id) {
        branchUsage[branch.id] = { name: branch.name, differenceUsage: 0 };
      }
    });

    filteredBms.forEach(bm => {
      if (bm.branchId && bm.differenceUsage && branchUsage[bm.branchId]) {
        branchUsage[bm.branchId].differenceUsage += bm.differenceUsage;
      }
    });

    let data = Object.values(branchUsage);

    if (effectiveBranchId !== "all") {
      data = data.filter(d => branches.find(b => b.name === d.name)?.id === effectiveBranchId);
    }

    return data;
  }, [bulkMeters, branches, selectedBranchId, selectedYear, selectedMonth, canViewAllBranches, currentUser]);

  const downloadCSV = React.useCallback(() => {
    if (!chartData || chartData.length === 0) return;
    const headers = ["name", "differenceUsage"];
    const rows = chartData.map(d => [d.name, String(d.differenceUsage ?? 0)]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'difference-usage.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [chartData]);

  const downloadPNG = React.useCallback(async () => {
    const container = chartRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svg as SVGElement);
    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URLObject = window.URL || window.webkitURL || window;
    const blobURL = URLObject.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const png = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = png;
      a.download = 'difference-usage.png';
      a.click();
      URLObject.revokeObjectURL(blobURL);
    };
    img.src = blobURL;
  }, []);

  const assignedBranchName = branches.find(b => b.id === currentUser?.branchId)?.name || currentUser?.branchName;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overall Difference Usage Trend</h1>
          <p className="text-muted-foreground mt-1 text-base">Visualize overall difference usage across different branches and time periods.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadPNG} variant="outline" className="shadow-sm rounded-xl px-4 h-11 border-slate-200">
             Export PNG
          </Button>
          <Button onClick={downloadCSV} className="bg-slate-800 hover:bg-slate-900 text-white shadow-sm rounded-xl px-4 h-11 transition-all">
             Export CSV
          </Button>
        </div>
      </div>

      <Card className="shadow-md border-slate-200/60 overflow-hidden rounded-3xl">
        <CardHeader className="bg-slate-50/50 border-b pb-6 pt-6 px-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Trend Analysis</CardTitle>
                <CardDescription>Usage discrepancies by branch and time period</CardDescription>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {canViewAllBranches ? (
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="w-full sm:w-[180px] h-11 bg-white rounded-xl border-slate-200 shadow-sm">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      branch?.id !== undefined && branch?.id !== null ? (
                        <SelectItem key={String(branch.id)} value={String(branch.id)}>
                          {branch.name}
                        </SelectItem>
                      ) : null
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 px-3.5 h-11 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm">
                  <span className="text-slate-400 font-medium">Branch:</span>
                  <span className="text-slate-900">{assignedBranchName || "Your Branch"}</span>
                </div>
              )}
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full sm:w-[130px] h-11 bg-white rounded-xl border-slate-200 shadow-sm">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[150px] h-11 bg-white rounded-xl border-slate-200 shadow-sm">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Months</SelectItem>
                  {[...Array(12)].map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                      {new Date(0, i).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading chart data...</div>
          ) : (
            <div ref={chartRef}>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: 'Usage (m³)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="differenceUsage" 
                    fill="#4f46e5" 
                    name="Difference Usage (m³)" 
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
