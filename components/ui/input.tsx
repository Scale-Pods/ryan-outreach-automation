import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                suppressHydrationWarning={true}
                className={cn(
                    "flex h-10 w-full rounded-[10px] border border-[var(--separator)] bg-[var(--fill-quaternary)] px-3.5 py-2.5 text-[15px] text-[var(--label-primary)] placeholder:text-[var(--label-tertiary)] transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:border-[var(--blue)] focus-visible:ring-[0_0_0_3px_rgba(10,132,255,0.25)] disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
