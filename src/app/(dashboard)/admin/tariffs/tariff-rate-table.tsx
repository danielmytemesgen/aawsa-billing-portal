
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
import { Button } from "@/components/ui/button";
import { Edit, Trash2, ListX, ArrowRight, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

export function TariffRateTable({ rates, onEdit, onDelete, currency = "ETB", canUpdate }: TariffRateTableProps) {
  if (rates.length === 0) {
    return (
      <div className="mt-4 p-6 border rounded-md bg-muted/50 text-center text-muted-foreground">
        <ListX className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <p className="font-semibold">No tariff rates configured.</p>
        {canUpdate && <p className="text-sm">Click &quot;Add New Tier&quot; to get started.</p>}
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-slate-100 overflow-hidden bg-white shadow-xl shadow-slate-200/50">
      <Table>
        <TableHeader className="bg-slate-50 border-b border-slate-200">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[30%] font-black text-slate-700 uppercase tracking-widest text-xs h-16 pl-8">Tier Identifier</TableHead>
            <TableHead className="font-black text-slate-700 uppercase tracking-widest text-xs h-16">Consumption Range (m³)</TableHead>
            <TableHead className="font-black text-slate-700 uppercase tracking-widest text-xs h-16 text-center">Unit Rate</TableHead>
            {canUpdate && <TableHead className="text-right font-black text-slate-700 uppercase tracking-widest text-xs h-16 pr-8">Management</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rates.map((rate, index) => (
            <TableRow key={rate.id} className="hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-none group">
              <TableCell className="pl-8 py-5">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    {index + 1}
                  </div>
                  <span className="font-black text-slate-900 text-base tracking-tight">{rate.description}</span>
                </div>
              </TableCell>
              <TableCell className="py-5">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-white border-slate-300 text-slate-900 font-black px-4 py-1.5 rounded-xl shadow-sm text-sm">
                    {rate.minConsumption}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <Badge variant="secondary" className={`font-black px-4 py-1.5 rounded-xl shadow-sm text-sm ${rate.maxConsumption === 'Above' ? 'bg-indigo-600 text-white border-none' : 'bg-white border-slate-300 text-slate-900'}`}>
                    {rate.maxConsumption}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="py-5 text-center">
                <div className="inline-flex flex-col items-center">
                  <span className="text-2xl font-black text-slate-900 tabular-nums">
                    {rate.rate.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">{currency} / m³</span>
                </div>
              </TableCell>
              {canUpdate && (
                <TableCell className="text-right pr-8 py-5">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(rate)} className="h-10 w-10 bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 transition-all rounded-xl">
                      <Edit className="h-5 w-5" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(rate)} className="h-10 w-10 bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-red-700 hover:bg-red-50 transition-all rounded-xl">
                      <Trash2 className="h-5 w-5" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
