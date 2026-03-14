
"use client";

import * as React from "react";
import { MoreHorizontal, Edit, Trash2, Building } from "lucide-react";
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
import type { Branch } from "./branch-types";

interface BranchTableProps {
  data: Branch[];
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function BranchTable({ data, onEdit, onDelete, canEdit, canDelete }: BranchTableProps) {
  if (data.length === 0) {
    return (
      <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
        No branches match your search criteria. <Building className="inline-block ml-2 h-5 w-5" />
      </div>
    );
  }

  const showActionsColumn = canEdit || canDelete;

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Contact Phone</TableHead>
            <TableHead>Status</TableHead>
            {showActionsColumn && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((branch) => (
            <TableRow key={branch.id}>
              <TableCell className="font-medium">{branch.name}</TableCell>
              <TableCell>{branch.location}</TableCell>
              <TableCell>{branch.contactPerson || "-"}</TableCell>
              <TableCell>{branch.contactPhone || "-"}</TableCell>
              <TableCell>
                <Badge variant={branch.status === 'Active' ? 'default' : 'destructive'}>
                  {branch.status}
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
                        <DropdownMenuItem onClick={() => onEdit(branch)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canEdit && canDelete && <DropdownMenuSeparator />}
                      {canDelete && (
                        <DropdownMenuItem onClick={() => onDelete(branch)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
