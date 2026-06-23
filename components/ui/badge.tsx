import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[12px] font-semibold tracking-[-0.005em] transition-colors focus:outline-none",
    {
        variants: {
            variant: {
                default:
                    "bg-[rgba(10,132,255,0.15)] text-[var(--blue)]",
                secondary:
                    "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]",
                destructive:
                    "bg-[rgba(255,59,48,0.15)] text-[var(--red)]",
                outline: "text-[var(--label-primary)] border border-[var(--separator)]",
                success:
                    "bg-[rgba(48,209,88,0.15)] text-[var(--green)]",
                warning:
                    "bg-[rgba(255,149,0,0.15)] text-[var(--orange)]",
                purple:
                    "bg-[rgba(175,82,222,0.15)] text-[var(--purple)]",
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
