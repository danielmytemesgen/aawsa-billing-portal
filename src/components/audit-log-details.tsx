"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface AuditLogDetailsProps {
    log: {
        id: string;
        created_at: string;
        event: string;
        staff_email: string | null;
        ip_address: string | null;
        details: any | null;
    };
}

export function AuditLogDetails({ log }: AuditLogDetailsProps) {
    const details = log.details || {};

    // Determine the comparison data
    const comparisonData: { property: string; oldValue: any; newValue: any }[] = [];

    if (details.old_values && details.new_values) {
        // Full comparison provided
        const allKeys = Array.from(new Set([
            ...Object.keys(details.old_values),
            ...Object.keys(details.new_values)
        ]));

        allKeys.forEach(key => {
            comparisonData.push({
                property: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
                oldValue: details.old_values[key],
                newValue: details.new_values[key]
            });
        });
    } else if (details.updates) {
        // Partial updates provided
        Object.keys(details.updates).forEach(key => {
            comparisonData.push({
                property: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
                oldValue: "N/A",
                newValue: details.updates[key]
            });
        });
    } else if (typeof details === 'object' && Object.keys(details).length > 0) {
        // Generic object, show as new values
        Object.keys(details).forEach(key => {
            if (key === 'id') return; // Hide internal IDs unless useful
            comparisonData.push({
                property: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
                oldValue: "Current",
                newValue: details[key]
            });
        });
    }

    const formatValue = (val: any) => {
        if (val === null || val === undefined) return "N/A";
        if (typeof val === 'boolean') return val ? "true" : "false";
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-lg">
                <Info className="h-6 w-6" />
                <span>Audit Log Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/20">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Performed By</p>
                    <p className="text-sm font-semibold">{log.staff_email || 'System'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Timestamp</p>
                    <p className="text-sm font-semibold">{format(new Date(log.created_at), 'MMM dd, yyyy, hh:mm:ss a')}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">IP Address</p>
                    <p className="text-sm font-semibold">{log.ip_address || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">User Agent</p>
                    <p className="text-sm font-semibold truncate" title={details.userAgent || 'N/A'}>
                        {details.userAgent || 'N/A'}
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-base font-bold text-gray-700">Changes Comparison</h3>
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="font-bold">Property</TableHead>
                                <TableHead className="font-bold text-red-500">Old Value</TableHead>
                                <TableHead className="font-bold text-green-600">New Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {comparisonData.length > 0 ? (
                                comparisonData.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-transparent">
                                        <TableCell className="font-medium bg-muted/5 w-1/4">
                                            {row.property}
                                        </TableCell>
                                        <TableCell className="text-red-500 bg-red-50/30 font-mono text-xs break-all">
                                            {formatValue(row.oldValue)}
                                        </TableCell>
                                        <TableCell className="text-green-600 bg-green-50/30 font-mono text-xs break-all">
                                            {formatValue(row.newValue)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                        No specific changes recorded in the metadata.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
