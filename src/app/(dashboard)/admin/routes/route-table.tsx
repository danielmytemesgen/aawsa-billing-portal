
"use client";

import { Edit, Trash2, MapPin, Users, CheckCircle2, AlertCircle, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { type Route, type BulkMeter } from "../bulk-meters/bulk-meter-types";
import { useBranches, useStaffMembers, useBulkMeters } from "@/lib/data-store";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RouteTableProps {
    data: Route[];
    onEdit: (route: Route) => void;
    onDelete: (route: Route) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function RouteTable({ data, onEdit, onDelete, canEdit, canDelete }: RouteTableProps) {
    const branches = useBranches();
    const staffMembers = useStaffMembers();
    const allBulkMeters = useBulkMeters();

    const getAssignedMeters = (routeKey: string) => {
        return allBulkMeters.filter((bm: BulkMeter) => bm.routeKey === routeKey);
    };

    const getBranchName = (branchId?: string | null) => {
        if (!branchId) return "N/A";
        const branch = branches.find((b: any) => b.id === branchId);
        return branch ? branch.name : "N/A";
    };

    const getReaderName = (readerId?: string | null) => {
        if (!readerId) return "Unassigned";
        const staff = staffMembers.find((s: any) => s.id === readerId);
        return staff ? staff.name : "Unknown";
    };

    const getRouteStatus = (route: Route) => {
        const hasBranch = !!route.branchId;
        const hasReader = !!route.readerId;
        
        if (hasBranch && hasReader) return { label: "Ready", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 };
        if (hasBranch || hasReader) return { label: "Partial", color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle };
        return { label: "Draft", color: "bg-slate-50 text-slate-700 border-slate-200", icon: Info };
    };

    return (
        <TooltipProvider>
            <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-md shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[120px] font-bold text-slate-700 uppercase text-[11px] tracking-wider pl-6">Route ID</TableHead>
                            <TableHead className="font-bold text-slate-700 uppercase text-[11px] tracking-wider">Status</TableHead>
                            <TableHead className="font-bold text-slate-700 uppercase text-[11px] tracking-wider">Branch & Location</TableHead>
                            <TableHead className="font-bold text-slate-700 uppercase text-[11px] tracking-wider">Assigned Reader</TableHead>
                            <TableHead className="font-bold text-slate-700 uppercase text-[11px] tracking-wider">Meter Context</TableHead>
                            <TableHead className="text-right pr-6 font-bold text-slate-700 uppercase text-[11px] tracking-wider">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-20">
                                    <div className="flex flex-col items-center gap-3 opacity-40">
                                        <MapPin className="h-12 w-12 text-slate-300" />
                                        <p className="text-slate-500 font-medium">No routes matching your criteria</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((route) => {
                                const status = getRouteStatus(route);
                                const assigned = getAssignedMeters(route.routeKey);
                                const StatusIcon = status.icon;

                                return (
                                    <TableRow 
                                        key={route.routeKey} 
                                        className="group transition-all duration-300 hover:bg-blue-50/30 border-b border-slate-100/80 last:border-0"
                                    >
                                        <TableCell className="pl-6 py-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-slate-900 font-mono tracking-tight group-hover:text-blue-600 transition-colors">
                                                    {route.routeKey}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium uppercase truncate max-w-[100px]">
                                                    {route.description || "No description"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit border shadow-sm", status.color)}>
                                                <StatusIcon className="h-3 w-3" />
                                                {status.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-slate-600 font-medium">
                                                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                                                    <MapPin className="h-4 w-4" />
                                                </div>
                                                <span className="text-sm">{getBranchName(route.branchId)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {route.readerId ? (
                                                    <>
                                                        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                                                            <Users className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-slate-800">{getReaderName(route.readerId)}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Certified Reader</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-xs italic text-slate-400 flex items-center gap-1.5">
                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                        Unassigned
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] px-2 py-0.5 border-slate-200 cursor-default">
                                                    {assigned.length} {assigned.length === 1 ? 'Meter' : 'Meters'}
                                                </Badge>
                                                {assigned.length > 0 && (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                            >
                                                                <Info className="h-4 w-4" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80 p-0 shadow-2xl rounded-2xl border-slate-200 overflow-hidden" align="end">
                                                            <div className="bg-slate-900 text-white p-4">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <h4 className="font-bold text-sm tracking-tight">Route Assignments</h4>
                                                                    <Badge variant="outline" className="text-white/70 border-white/20 text-[9px] uppercase font-bold tracking-widest">{route.routeKey}</Badge>
                                                                </div>
                                                                <p className="text-xs text-white/60">Currently assigned bulk meters for this route.</p>
                                                            </div>
                                                            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto bg-slate-50/50">
                                                                {assigned.map((bm: BulkMeter) => (
                                                                    <div key={bm.customerKeyNumber} className="group/item flex items-center justify-between p-2.5 rounded-xl hover:bg-white hover:shadow-md transition-all duration-300 border border-transparent hover:border-slate-100">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-bold text-slate-800">{bm.name}</span>
                                                                            <span className="text-[10px] text-slate-400 font-mono font-medium">{bm.customerKeyNumber}</span>
                                                                        </div>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover/item:bg-blue-50 group-hover/item:text-blue-600 transition-colors">
                                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="left">View Meter Details</TooltipContent>
                                                                        </Tooltip>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="bg-slate-100 border-t p-3 text-center">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End of List</span>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-x-2 group-hover:translate-x-0 transition-transform">
                                                {canEdit && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => onEdit(route)}
                                                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                        <span className="sr-only">Edit</span>
                                                    </Button>
                                                )}
                                                {canDelete && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => onDelete(route)}
                                                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="sr-only">Delete</span>
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </TooltipProvider>
    );
}
