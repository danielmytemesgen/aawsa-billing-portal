
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
  setDate: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean; // For disabling specific dates in the calendar
  disabledTrigger?: boolean; // For disabling the trigger button itself
}

export function DatePicker({ date, setDate, disabled, disabledTrigger }: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDateSelect = (selectedDay: Date | undefined) => {
    setDate(selectedDay);
    setIsOpen(false); // Close popover on date selection
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
          disabled={disabledTrigger} // Use the disabledTrigger prop here
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date && isValid(date) ? format(date, "yyyy-MM") : <span>Select a month</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          disabled={disabled}
          initialFocus
          captionLayout="dropdown-buttons" // Allows easier year/month navigation
          fromYear={new Date().getFullYear() - 10}
          toYear={new Date().getFullYear() + 10}
        />
      </PopoverContent>
    </Popover>
  )
}

