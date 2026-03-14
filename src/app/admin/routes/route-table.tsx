
"use client";

import { Edit, Trash2 } from "lucide-react";
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
import { Info } from "lucide-react";

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

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Route Key</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Reader</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Assigned Meters</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No routes found.
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map((route) => (
                        <TableRow key={route.routeKey}>
                            <TableCell className="font-medium">{route.routeKey}</TableCell>
                            <TableCell>{getBranchName(route.branchId)}</TableCell>
                            <TableCell>
                                <Badge variant={route.readerId ? "default" : "outline"}>
                                    {getReaderName(route.readerId)}
                                </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{route.description || "—"}</TableCell>
                            <TableCell>
                                {(() => {
                                    const assigned = getAssignedMeters(route.routeKey);
                                    if (assigned.length === 0) return <span className="text-muted-foreground text-xs italic">No meters assigned</span>;

                                    return (
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="font-mono">
                                                {assigned.length} {assigned.length === 1 ? 'Meter' : 'Meters'}
                                            </Badge>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                                        <Info className="h-4 w-4" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80">
                                                    <div className="grid gap-4">
                                                        <div className="space-y-2">
                                                            <h4 className="font-medium leading-none">Assigned Bulk Meters</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                Meters assigned to route: <span className="font-bold">{route.routeKey}</span>
                                                            </p>
                                                        </div>
                                                        <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                                                            {assigned.map((bm: BulkMeter) => (
                                                                <div key={bm.customerKeyNumber} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors border">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-medium">{bm.name}</span>
                                                                        <span className="text-xs text-muted-foreground font-mono">{bm.customerKeyNumber}</span>
                                                                    </div>
                                                                    <Badge variant="outline" className="text-[10px] h-4">
                                                                        {bm.meterNumber || "No Meter #"}
                                                                    </Badge>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    );
                                })()}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    {canEdit && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(route)}
                                            title="Edit Route"
                                        >
                                            <Edit className="h-4 w-4 text-blue-500" />
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onDelete(route)}
                                            title="Delete Route"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );
}
