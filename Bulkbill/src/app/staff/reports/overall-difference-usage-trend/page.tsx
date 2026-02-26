"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  getBulkMeters, initializeBulkMeters, subscribeToBulkMeters,
  getBranches, initializeBranches, subscribeToBranches 
} from "@/lib/data-store";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import type { Branch } from "@/app/admin/branches/branch-types";
import { usePermissions } from "@/hooks/use-permissions";
import { TrendingUp } from "lucide-react";

export default function OverallDifferenceUsageTrendPage() {
  const { hasPermission } = usePermissions();
  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedBranchId, setSelectedBranchId] = React.useState("all");
  const [selectedYear, setSelectedYear] = React.useState<string>("all");
  const [selectedMonth, setSelectedMonth] = React.useState<string>("all");
  const chartRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
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
  }, []);

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

    if (selectedBranchId !== "all") {
      data = data.filter(d => branches.find(b => b.name === d.name)?.id === selectedBranchId);
    }
    
    return data;
  }, [bulkMeters, branches, selectedBranchId, selectedYear, selectedMonth]);

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
    svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    const bbox = (svg as SVGElement).getBBox ? (svg as SVGElement).getBBox() : { width: 800, height: 400 } as any;
    const width = (svg as SVGElement).clientWidth || bbox.width || 800;
    const height = (svg as SVGElement).clientHeight || bbox.height || 400;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, width, height);
        const png = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = png;
        a.download = 'difference-usage.png';
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); };
    img.src = url;
  }, [chartData]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Overall Difference Usage Trend</CardTitle>
                <CardDescription>Shows the trend of difference usage by branch.</CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {hasPermission('reports_generate_all') && (
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
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
              )}
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full md:w-[120px]">
                      <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full md:w-[120px]">
                      <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      {[...Array(12)].map((_, i) => (
                        <SelectItem key={i+1} value={String(i + 1).padStart(2, '0')}>
                          {new Date(0, i).toLocaleString('default', { month: 'long' })}
                        </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={downloadPNG} className="inline-flex items-center px-3 py-1.5 rounded-md border bg-white text-sm shadow-sm">Download PNG</button>
              <button type="button" onClick={downloadCSV} className="inline-flex items-center px-3 py-1.5 rounded-md border bg-white text-sm shadow-sm">Download CSV</button>
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
                <Bar dataKey="differenceUsage" fill="#8884d8" name="Difference Usage (m³)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
