"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Calendar, 
    User, 
    MapPin, 
    Activity, 
    AlertTriangle, 
    CheckCircle2, 
    ArrowRight,
    TrendingUp,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { getFaultCodeLabel } from "@/lib/fault-codes";

export interface ReadingData {
    id: string;
    meterIdentifier: string;
    meterId: string;
    meterType: 'Individual' | 'Bulk';
    previousReading: number;
    currentReading: number;
    usage: number;
    readingDate: string;
    monthYear: string;
    faultCode?: string;
    notes?: string;
    readerName?: string;
    branchName?: string;
}

interface ReadingDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reading: ReadingData | null;
}

export function ReadingDetailsDialog({ open, onOpenChange, reading }: ReadingDetailsDialogProps) {
    if (!reading) return null;

    const {
        meterIdentifier,
        meterId,
        meterType,
        previousReading,
        currentReading,
        usage,
        readingDate,
        monthYear,
        faultCode,
        notes,
        readerName = "System/Admin",
        branchName = "N/A"
    } = reading;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Reading Details
                            </DialogTitle>
                            <DialogDescription className="text-blue-100 mt-1">
                                Full metadata for reading in {monthYear}
                            </DialogDescription>
                        </div>
                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-none">
                            {meterType}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6 bg-white">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <div className="p-2 bg-blue-100 rounded-md">
                                <MapPin className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900">{meterIdentifier}</h4>
                                <p className="text-xs text-muted-foreground">Meter Key: {meterId}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="relative p-5 rounded-xl border-2 border-blue-50 bg-blue-50/30 overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 opacity-5">
                                <TrendingUp size={100} />
                            </div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Consumption Details</span>
                                <Badge variant={usage >= 0 ? "default" : "destructive"} className={cn(usage >= 0 && "bg-emerald-500")}>
                                    {usage > 0 ? "Increase" : usage < 0 ? "Decrease" : "Zero"}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Previous</p>
                                    <p className="text-lg font-black text-gray-700">{previousReading.toLocaleString()}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-blue-300 shrink-0" />
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Current</p>
                                    <p className="text-lg font-black text-gray-900">{currentReading.toLocaleString()}</p>
                                </div>
                                <div className="w-px h-8 bg-blue-100" />
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-blue-600 uppercase font-black mb-1">Usage (m³)</p>
                                    <p className={cn(
                                        "text-xl font-black",
                                        usage > 0 ? "text-emerald-600" : usage < 0 ? "text-red-600" : "text-gray-400"
                                    )}>
                                        {usage > 0 ? '+' : ''}{usage.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Reading Date
                            </label>
                            <p className="text-sm font-semibold">{readingDate ? formatDate(readingDate) : "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                <User className="h-3 w-3" /> Reader
                            </label>
                            <p className="text-sm font-semibold truncate">{readerName}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                <Activity className="h-3 w-3" /> Branch
                            </label>
                            <p className="text-sm font-semibold">{branchName}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                <FileText className="h-3 w-3" /> Period
                            </label>
                            <p className="text-sm font-semibold">{monthYear}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {faultCode && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <h5 className="text-xs font-bold text-red-800 uppercase">Fault Reported</h5>
                                    <p className="text-sm font-medium text-red-700">{getFaultCodeLabel(faultCode)} ({faultCode})</p>
                                </div>
                            </div>
                        )}
                        
                        {notes && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Observer Notes</label>
                                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-sm italic text-gray-600">
                                    "{notes}"
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <Button onClick={() => onOpenChange(false)} className="bg-blue-600 hover:bg-blue-700">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Close Details
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
