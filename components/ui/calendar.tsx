"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-3 bg-[var(--glass-fill)] backdrop-blur-[40px] border border-[var(--glass-border)] rounded-[14px] shadow-[var(--glass-shadow)]", className)}
            classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-[14px] font-medium text-[var(--label-primary)]",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                    buttonVariants({ variant: "outline" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell:
                    "text-[var(--label-tertiary)] rounded-[8px] w-8 font-medium text-[12px]",
                row: "flex w-full mt-2",
                cell: cn(
                    "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[var(--fill-tertiary)] first:[&:has([aria-selected])]:rounded-l-[8px] last:[&:has([aria-selected])]:rounded-r-[8px]",
                    props.mode === "range"
                        ? "[&:has(>.day-range-end)]:rounded-r-[8px] [&:has(>.day-range-start)]:rounded-l-[8px] first:[&:has([aria-selected])]:rounded-l-[8px] last:[&:has([aria-selected])]:rounded-r-[8px]"
                        : "[&:has([aria-selected])]:rounded-[8px]"
                ),
                day: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-8 p-0 font-normal text-[var(--label-primary)] aria-selected:opacity-100"
                ),
                day_range_start: "day-range-start",
                day_range_end: "day-range-end",
                day_selected:
                    "bg-[var(--blue)] text-white hover:bg-[var(--blue)] hover:text-white focus:bg-[var(--blue)] focus:text-white",
                day_today: "bg-[var(--fill-tertiary)] text-[var(--label-primary)]",
                day_outside:
                    "day-outside text-[var(--label-tertiary)] opacity-50 aria-selected:bg-[var(--fill-quaternary)] aria-selected:text-[var(--label-tertiary)] aria-selected:opacity-30",
                day_disabled: "text-[var(--label-tertiary)] opacity-50",
                day_range_middle:
                    "aria-selected:bg-[var(--fill-tertiary)] aria-selected:text-[var(--label-primary)]",
                day_hidden: "invisible",
                ...classNames,
            }}
            components={{
                IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
                IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
            }}
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }
