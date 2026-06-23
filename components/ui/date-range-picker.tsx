"use client"

import * as React from "react"
import { format, subDays, subMonths, subYears, startOfMonth, endOfMonth, startOfDay } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
    onUpdate?: (values: { range: DateRange | undefined, label?: string }) => void;
}

export function DateRangePicker({
    className,
    onUpdate,
    ...props
}: DateRangePickerProps) {
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: subDays(new Date(), 7),
        to: new Date(),
    })

    const [tempDate, setTempDate] = React.useState<DateRange | undefined>(date)
    const [tempLabel, setTempLabel] = React.useState<string | undefined>("Last 7 days")
    const [open, setOpen] = React.useState(false)
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    React.useEffect(() => {
        if (open) {
            setTempDate(date)
        }
    }, [open, date])

    if (!isMounted) {
        return <div className={cn("grid gap-2 h-10 w-[260px] bg-[var(--fill-quaternary)] rounded-[10px] animate-pulse", className)}></div>
    }

    const presets = [
        {
            label: "Today",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(today), to: today };
            }
        },
        {
            label: "Last 7 days",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subDays(today, 7)), to: today };
            }
        },
        {
            label: "Last 30 days",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subDays(today, 30)), to: today };
            }
        },
        {
            label: "This Month",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(startOfMonth(today)), to: endOfMonth(today) };
            }
        },
        {
            label: "Last 3 Months",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subMonths(today, 3)), to: today };
            }
        },
        {
            label: "Last 6 Months",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subMonths(today, 6)), to: today };
            }
        },
        {
            label: "Last 1 year",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subYears(today, 1)), to: today };
            }
        },
    ];

    const handlePresetChange = (value: string) => {
        const preset = presets.find(p => p.label === value);
        if (preset) {
            setTempDate(preset.getValue());
            setTempLabel(value);
        }
    };

    const handleApply = () => {
        setDate(tempDate);
        setOpen(false);
        if (onUpdate) {
            onUpdate({ range: tempDate, label: tempLabel });
        }
    };

    const handleCancel = () => {
        setOpen(false);
    };

    const handleClear = () => {
        setDate(undefined);
        setTempDate(undefined);
        setTempLabel(undefined);
        if (onUpdate) {
            onUpdate({ range: undefined, label: undefined });
        }
    };

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[260px] justify-start text-left font-normal bg-[var(--glass-fill)] border-[var(--separator)] text-[var(--label-primary)] hover:bg-[var(--fill-tertiary)] rounded-[10px] h-10",
                            !date && "text-[var(--label-tertiary)]"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-[var(--blue)]" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-transparent border-none shadow-none" align="end">
                    <div className="flex rounded-[20px] bg-[var(--glass-fill)] backdrop-blur-[60px] shadow-[0_8px_16px_rgba(0,0,0,0.16),0_32px_64px_rgba(0,0,0,0.32)] outline outline-1 outline-[var(--glass-border)] overflow-hidden">
                        <div className="p-2.5 border-r border-[var(--separator)] w-[160px]">
                            <div className="space-y-0.5">
                                {presets.map((preset) => (
                                    <Button
                                        key={preset.label}
                                        variant="ghost"
                                        className="w-full justify-start font-normal text-[14px] h-8 rounded-[8px]"
                                        onClick={() => handlePresetChange(preset.label)}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                                <div className="pt-2 mt-2 border-t border-[var(--separator)]">
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start font-normal text-[14px] h-8 text-[var(--label-secondary)] hover:text-[var(--label-primary)] rounded-[8px]"
                                        onClick={() => setTempLabel("Custom Range")}
                                    >
                                        Custom Range
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="p-0">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={tempDate?.from}
                                selected={tempDate}
                                onSelect={(val) => {
                                    setTempDate(val);
                                    setTempLabel("Custom Range");
                                }}
                                numberOfMonths={2}
                            />
                        </div>
                    </div>
                    <div className="p-3 flex items-center justify-end gap-2 mt-1 rounded-[14px] bg-[var(--glass-fill)] backdrop-blur-[40px] shadow-[var(--glass-shadow)] outline outline-1 outline-[var(--glass-border)]">
                        <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 px-4 text-[var(--red)] hover:bg-[rgba(255,59,48,0.1)] mr-auto font-medium rounded-[8px]">
                            Clear
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancel} className="h-8 px-4 text-[var(--label-secondary)] hover:text-[var(--label-primary)] font-medium rounded-[8px]">
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleApply} className="h-8 px-4 bg-[var(--blue)] hover:opacity-90 text-white font-medium rounded-[8px]">
                            Apply
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
