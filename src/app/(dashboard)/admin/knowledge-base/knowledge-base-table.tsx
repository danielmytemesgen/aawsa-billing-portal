
"use client";

import * as React from "react";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
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
import type { KnowledgeBaseArticle } from "./knowledge-base-types";
import { formatDistanceToNow } from "date-fns";

interface KnowledgeBaseTableProps {
  data: KnowledgeBaseArticle[];
  onEdit: (article: KnowledgeBaseArticle) => void;
  onDelete: (article: KnowledgeBaseArticle) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function KnowledgeBaseTable({ data, onEdit, onDelete, canEdit, canDelete }: KnowledgeBaseTableProps) {
  if (data.length === 0) {
    return (
      <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
        No articles found.
      </div>
    );
  }

  const showActionsColumn = canEdit || canDelete;

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Last Updated</TableHead>
            {showActionsColumn && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((article) => (
            <TableRow key={article.id}>
              <TableCell className="font-medium">{article.title}</TableCell>
              <TableCell>{article.category || "-"}</TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}
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
                        <DropdownMenuItem onClick={() => onEdit(article)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canEdit && canDelete && <DropdownMenuSeparator />}
                      {canDelete && (
                        <DropdownMenuItem onClick={() => onDelete(article)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
