
"use client";

import * as React from "react";
import { MoreHorizontal, Edit, Trash2, FileText, ExternalLink } from "lucide-react";
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
            <TableHead>Attachment</TableHead>
            <TableHead>Last Updated</TableHead>
            {showActionsColumn && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((article) => (
            <TableRow key={article.id}>
              <TableCell className="font-medium max-w-xs truncate" title={article.title}>
                {article.title}
              </TableCell>
              <TableCell>
                {article.category ? (
                  <Badge variant="secondary" className="font-normal text-xs">
                    {article.category}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Uncategorized</span>
                )}
              </TableCell>
              <TableCell>
                {article.pdf_url ? (
                  <a
                    href={article.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900 transition-colors"
                    title="Open PDF Attachment"
                  >
                    <FileText className="h-3.5 w-3.5 text-red-500" />
                    <span>PDF</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs italic">None</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
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
                      {article.pdf_url && (
                        <DropdownMenuItem asChild>
                          <a
                            href={article.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center cursor-pointer"
                          >
                            <FileText className="mr-2 h-4 w-4 text-red-500" />
                            View PDF Attachment
                          </a>
                        </DropdownMenuItem>
                      )}
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
