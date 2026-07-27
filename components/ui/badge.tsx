import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-md border shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none",
    {
        variants: {
            variant: {
                default: "bg-blue-500/15 text-blue-300 border-blue-400/30 shadow-blue-500/10",
                secondary: "bg-white/10 text-slate-200 border-white/20",
                destructive: "bg-rose-500/15 text-rose-300 border-rose-400/30 shadow-rose-500/10",
                outline: "text-white border-white/20 bg-white/5",
                success: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30 shadow-emerald-500/10",
                warning: "bg-amber-500/15 text-amber-300 border-amber-400/30 shadow-amber-500/10",
                purple: "bg-purple-500/15 text-purple-300 border-purple-400/30 shadow-purple-500/10",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
