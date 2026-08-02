
"use client"

import * as React from "react"
import { format, isValid } from "date-fns" // Added isValid
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined;
  setDate?: (date: Date | undefined) => void;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  disabledTrigger?: boolean;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ 
  date, 
  setDate, 
  onSelect,
  disabled, 
  disabledTrigger,
  placeholder = "Pick a date",
  className
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDateSelect = (selectedDay: Date | undefined) => {
    if (onSelect) {
      onSelect(selectedDay);
    } else if (setDate) {
      setDate(selectedDay);
    }
    setIsOpen(false);
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
          disabled={disabledTrigger}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date && isValid(date) ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          disabled={disabled}
          initialFocus
          captionLayout="dropdown-buttons"
          fromYear={new Date().getFullYear() - 10}
          toYear={new Date().getFullYear() + 10}
        />
      </PopoverContent>
    </Popover>
  )
}

