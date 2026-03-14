"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TablePaginationProps {
  count: number;
  page: number; // 0-based index
  rowsPerPage: number;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
  rowsPerPageOptions?: number[];
}

export function TablePagination({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 25, 50, 100],
}: TablePaginationProps) {
  const totalPages = Math.ceil(count / rowsPerPage);

  const handleBackButtonClick = () => {
    onPageChange(page - 1);
  };

  const handleNextButtonClick = () => {
    onPageChange(page + 1);
  };

  return (
    <div className="flex items-center justify-end space-x-6 p-4 text-sm font-medium border-t">
       <div className="flex items-center gap-2">
        <Label htmlFor="rows-per-page" className="hidden sm:block">Rows per page</Label>
        <Select
          value={`${rowsPerPage}`}
          onValueChange={(value) => {
            onRowsPerPageChange(Number(value));
          }}
        >
          <SelectTrigger id="rows-per-page" className="h-8 w-[70px]">
            <SelectValue placeholder={rowsPerPage} />
          </SelectTrigger>
          <SelectContent side="top">
            {rowsPerPageOptions.map((option) => (
              <SelectItem key={option} value={`${option}`}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex w-[100px] items-center justify-center">
        Page {count > 0 ? page + 1 : 0} of {totalPages > 0 ? totalPages : 1}
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={handleBackButtonClick}
          disabled={page === 0}
        >
          <span className="sr-only">Go to previous page</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={handleNextButtonClick}
          disabled={page >= totalPages - 1}
        >
          <span className="sr-only">Go to next page</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
