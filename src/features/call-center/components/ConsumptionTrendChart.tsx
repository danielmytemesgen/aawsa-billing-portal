"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, TrendingUp, TrendingDown, AlertTriangle, Activity } from "lucide-react";

interface ConsumptionTrendChartProps {
  bills: any[];
  readings?: any[];
  className?: string;
}

export function ConsumptionTrendChart({ bills, readings, className }: ConsumptionTrendChartProps) {
  // Aggregate monthly consumption data from bills or readings
  const trendData = React.useMemo(() => {
    if (!bills || bills.length === 0) return [];

    // Map bills to consumption items
    const rawList = bills.map((b, idx) => {
      const monthStr = b.month_year || b.MONTHYEAR || b.month || `Period ${idx + 1}`;
      const prev = Number(b.prev_read ?? b.PREVREAD ?? b.prevRead ?? 0);
      const curr = Number(b.curr_read ?? b.CURRREAD ?? b.currRead ?? 0);
      const cons = Number(b.cons ?? b.CONS ?? Math.max(0, curr - prev));
      const diff = Number(b.difference_usage ?? b.differenceUsage ?? 0);
      const billAmt = Number(b.total_bill_amount ?? b.TOTALBILLAMOUNT ?? b.this_month_bill_amt ?? 0);

      return {
        month: monthStr,
        consumption: cons,
        diffUsage: diff,
        totalConsumption: cons + diff,
        billAmt,
      };
    });

    // Reverse to chronological order (oldest to newest) and take last 12
    return rawList.slice(0, 12).reverse();
  }, [bills]);

  // Calculate 6-month average (or available months up to 6)
  const { averageConsumption, latestConsumption, percentChange, isSpike } = React.useMemo(() => {
    if (trendData.length === 0) {
      return { averageConsumption: 0, latestConsumption: 0, percentChange: 0, isSpike: false };
    }

    const recentSlice = trendData.slice(-6);
    const sum = recentSlice.reduce((acc, d) => acc + d.consumption, 0);
    const avg = sum / recentSlice.length;
    const latest = trendData[trendData.length - 1].consumption;

    // Prior month
    const prior = trendData.length > 1 ? trendData[trendData.length - 2].consumption : avg;
    const pct = prior > 0 ? ((latest - prior) / prior) * 100 : 0;
    const spike = avg > 5 && latest >= avg * 1.4;

    return {
      averageConsumption: avg,
      latestConsumption: latest,
      percentChange: pct,
      isSpike: spike,
    };
  }, [trendData]);

  if (trendData.length === 0) {
    return null;
  }

  return (
    <Card className="border border-gray-200 shadow-xs">
      <CardHeader className="p-3 pb-2 border-b bg-gray-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-blue-600" />
              Consumption Trend (Last {trendData.length} Billing Periods)
            </CardTitle>
            <CardDescription className="text-xs text-gray-400 mt-0.5">
              Historical water consumption (m³) patterns and anomaly detection.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs bg-white text-gray-700 font-mono">
              Latest: <span className="font-bold ml-1">{latestConsumption.toFixed(1)} m³</span>
            </Badge>
            <Badge variant="outline" className="text-xs bg-white text-gray-700 font-mono">
              Avg: <span className="font-bold ml-1">{averageConsumption.toFixed(1)} m³</span>
            </Badge>
            {percentChange !== 0 && (
              <Badge
                className={percentChange > 0 ? "bg-amber-100 text-amber-800 border-amber-200 text-xs" : "bg-emerald-100 text-emerald-800 border-emerald-200 text-xs"}
              >
                {percentChange > 0 ? <TrendingUp className="h-3 w-3 mr-0.5 inline" /> : <TrendingDown className="h-3 w-3 mr-0.5 inline" />}
                {percentChange > 0 ? `+${percentChange.toFixed(0)}%` : `${percentChange.toFixed(0)}%`} vs prior
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-3 space-y-2">
        {/* Anomaly warning banner */}
        {isSpike && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Unusual Consumption Surge:</strong> Current usage ({latestConsumption.toFixed(1)} m³) is{" "}
              <strong>{(((latestConsumption - averageConsumption) / averageConsumption) * 100).toFixed(0)}% higher</strong> than the 6-month average ({averageConsumption.toFixed(1)} m³). Caller may have an underground leak or a stuck float valve.
            </span>
          </div>
        )}

        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                unit="m³"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 shadow-md rounded p-2 text-xs">
                        <div className="font-bold text-gray-800 mb-1">{label}</div>
                        <div className="text-blue-600 flex justify-between gap-3">
                          <span>Usage:</span>
                          <span className="font-mono font-semibold">{data.consumption.toFixed(2)} m³</span>
                        </div>
                        {data.diffUsage > 0 && (
                          <div className="text-orange-600 flex justify-between gap-3">
                            <span>Diff Apportionment:</span>
                            <span className="font-mono font-semibold">+{data.diffUsage.toFixed(2)} m³</span>
                          </div>
                        )}
                        <div className="text-gray-500 flex justify-between gap-3 mt-1 pt-1 border-t">
                          <span>Billed:</span>
                          <span className="font-mono">{Number(data.billAmt).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {averageConsumption > 0 && (
                <ReferenceLine
                  y={averageConsumption}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: `Avg: ${averageConsumption.toFixed(0)}m³`, fill: "#94a3b8", fontSize: 9, position: "insideTopRight" }}
                />
              )}
              <Bar dataKey="consumption" radius={[3, 3, 0, 0]} maxBarSize={36}>
                {trendData.map((entry, index) => {
                  const isLatest = index === trendData.length - 1;
                  const isHigh = isSpike && isLatest;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isHigh ? "#f97316" : isLatest ? "#2563eb" : "#93c5fd"}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
