"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, ListX, ArrowRight, Droplets, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DisplayTariffRate {
  id: string;
  description: string;
  minConsumption: string;
  maxConsumption: string;
  rate: number;
  originalLimit: number | typeof Infinity;
  originalRate: number;
}

interface TariffRateTableProps {
  rates: DisplayTariffRate[];
  onEdit: (rate: DisplayTariffRate) => void;
  onDelete: (rate: DisplayTariffRate) => void;
  currency?: string;
  canUpdate: boolean;
}

const tierGradients = [
  { bg: "from-sky-50 to-blue-50", border: "border-blue-200", badge: "bg-blue-600", dot: "bg-blue-500", text: "text-blue-700", iconBg: "bg-blue-100", iconText: "text-blue-700", hoverBorder: "hover:border-blue-400" },
  { bg: "from-indigo-50 to-violet-50", border: "border-indigo-200", badge: "bg-indigo-600", dot: "bg-indigo-500", text: "text-indigo-700", iconBg: "bg-indigo-100", iconText: "text-indigo-700", hoverBorder: "hover:border-indigo-400" },
  { bg: "from-violet-50 to-purple-50", border: "border-violet-200", badge: "bg-violet-600", dot: "bg-violet-500", text: "text-violet-700", iconBg: "bg-violet-100", iconText: "text-violet-700", hoverBorder: "hover:border-violet-400" },
  { bg: "from-purple-50 to-fuchsia-50", border: "border-purple-200", badge: "bg-purple-600", dot: "bg-purple-500", text: "text-purple-700", iconBg: "bg-purple-100", iconText: "text-purple-700", hoverBorder: "hover:border-purple-400" },
  { bg: "from-fuchsia-50 to-pink-50", border: "border-fuchsia-200", badge: "bg-fuchsia-600", dot: "bg-fuchsia-500", text: "text-fuchsia-700", iconBg: "bg-fuchsia-100", iconText: "text-fuchsia-700", hoverBorder: "hover:border-fuchsia-400" },
  { bg: "from-rose-50 to-red-50", border: "border-rose-200", badge: "bg-rose-600", dot: "bg-rose-500", text: "text-rose-700", iconBg: "bg-rose-100", iconText: "text-rose-700", hoverBorder: "hover:border-rose-400" },
];

function getTierStyle(index: number) {
  return tierGradients[index % tierGradients.length];
}

export function TariffRateTable({ rates, onEdit, onDelete, currency = "ETB", canUpdate }: TariffRateTableProps) {
  if (rates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <ListX className="h-8 w-8 text-slate-400" />
        </div>
        <p className="font-black text-slate-600 text-lg">No tariff tiers configured</p>
        {canUpdate && (
          <p className="text-sm text-slate-400 font-medium mt-1">Click &quot;Add Tier&quot; above to define pricing tiers.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Column headers */}
      <div className="hidden md:grid md:grid-cols-12 px-4 pb-1">
        <div className="col-span-1" />
        <div className="col-span-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">Tier</div>
        <div className="col-span-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Consumption Range</div>
        <div className="col-span-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">Unit Rate</div>
        {canUpdate && <div className="col-span-1 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</div>}
      </div>

      {rates.map((rate, index) => {
        const style = getTierStyle(index);
        const isLast = rate.maxConsumption === "Above";

        return (
          <div
            key={rate.id}
            className={cn(
              "group relative grid md:grid-cols-12 items-center gap-4 p-4 md:p-5 rounded-2xl border bg-gradient-to-r transition-all duration-200 hover:shadow-lg",
              style.bg,
              style.border,
              style.hoverBorder
            )}
          >
            {/* Tier number badge */}
            <div className="col-span-1 flex items-center justify-center">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-base font-black text-white shadow-md", style.badge)}>
                {index + 1}
              </div>
            </div>

            {/* Tier description */}
            <div className="col-span-3">
              <p className={cn("font-black text-base text-slate-900")}>{rate.description}</p>
              <p className={cn("text-xs font-bold mt-0.5", style.text)}>
                {isLast ? "Unlimited (Highest Tier)" : `Step ${index + 1} of ${rates.length}`}
              </p>
            </div>

            {/* Consumption range */}
            <div className="col-span-4 flex items-center gap-2">
              <div className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-white shadow-sm")}>
                <Droplets className={cn("h-3.5 w-3.5", style.text)} />
                <span className="text-sm font-black text-slate-800">{rate.minConsumption} m³</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl border shadow-sm",
                  isLast ? cn("text-white", style.badge) : "bg-white"
                )}
              >
                <Droplets className={cn("h-3.5 w-3.5", isLast ? "text-white/80" : style.text)} />
                <span className={cn("text-sm font-black", isLast ? "text-white" : "text-slate-800")}>
                  {isLast ? "Above" : `${rate.maxConsumption} m³`}
                </span>
              </div>
            </div>

            {/* Rate */}
            <div className="col-span-3 flex flex-col">
              <span className="text-2xl font-black text-slate-900 tabular-nums leading-none">
                {rate.rate.toFixed(2)}
              </span>
              <span className={cn("text-[11px] font-black uppercase tracking-widest mt-1", style.text)}>
                {currency} / m³
              </span>
            </div>

            {/* Actions */}
            {canUpdate && (
              <div className="col-span-1 flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(rate)}
                  className="h-9 w-9 bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 transition-all rounded-xl"
                >
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(rate)}
                  className="h-9 w-9 bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all rounded-xl"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Summary footer */}
      <div className="flex items-center justify-between px-4 pt-3 border-t border-slate-100 mt-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          {rates.length} tier{rates.length !== 1 ? "s" : ""} configured
        </div>
        <div className="text-xs font-bold text-slate-400">
          {rates[0] && `Range: ${rates[0].minConsumption} m³ → `}
          {rates[rates.length - 1]?.maxConsumption === "Above" ? "∞" : `${rates[rates.length - 1]?.maxConsumption} m³`}
        </div>
      </div>
    </div>
  );
}
