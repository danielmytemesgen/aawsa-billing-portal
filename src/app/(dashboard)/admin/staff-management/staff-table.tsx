
"use client";

import * as React from "react";
import { MoreHorizontal, Edit, Trash2, LogOut, History, ShieldAlert } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { StaffMember } from "./staff-types";

interface StaffTableProps {
  data: StaffMember[];
  onEdit: (staff: StaffMember) => void;
  onDelete: (staff: StaffMember) => void;
  onRevokeSessions?: (staff: StaffMember) => void;
  onViewHistory?: (staff: StaffMember) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function StaffTable({
  data,
  onEdit,
  onDelete,
  onRevokeSessions,
  onViewHistory,
  canEdit,
  canDelete,
}: StaffTableProps) {
  if (data.length === 0) {
    return (
      <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
        No staff members match your search criteria.
      </div>
    );
  }

  const showActionsColumn = canEdit || canDelete || !!onRevokeSessions || !!onViewHistory;

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Status</TableHead>
            {showActionsColumn && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((staff) => (
            <TableRow key={staff.email}>
              <TableCell className="font-medium">{staff.name}</TableCell>
              <TableCell>{staff.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {staff.role}
                </Badge>
              </TableCell>
              <TableCell>{staff.branchName}</TableCell>
              <TableCell>
                <Badge variant={staff.status === 'Active' ? 'default' : staff.status === 'Inactive' ? 'destructive' : 'secondary'}>
                  {staff.status}
                </Badge>
              </TableCell>
              {showActionsColumn && (
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      {canEdit && (
                        <DropdownMenuItem onClick={() => onEdit(staff)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Staff
                        </DropdownMenuItem>
                      )}
                      {onViewHistory && (
                        <DropdownMenuItem onClick={() => onViewHistory(staff)}>
                          <History className="mr-2 h-4 w-4 text-blue-600" />
                          Role & Access History
                        </DropdownMenuItem>
                      )}
                      {onRevokeSessions && (
                        <DropdownMenuItem onClick={() => onRevokeSessions(staff)} className="text-amber-700 focus:text-amber-700 focus:bg-amber-50">
                          <LogOut className="mr-2 h-4 w-4 text-amber-600" />
                          Revoke Sessions (Force Logout)
                        </DropdownMenuItem>
                      )}
                      {(canEdit || onViewHistory || onRevokeSessions) && canDelete && <DropdownMenuSeparator />}
                      {canDelete && (
                        <DropdownMenuItem onClick={() => onDelete(staff)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
