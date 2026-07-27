import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-[14px] font-semibold tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
    {
        variants: {
            variant: {
                default:
                    "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 hover:-translate-y-0.5",
                destructive:
                    "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 hover:-translate-y-0.5",
                outline:
                    "border border-white/20 bg-white/[0.06] backdrop-blur-xl text-white hover:bg-white/[0.12] hover:border-white/30 hover:-translate-y-0.5 shadow-sm",
                secondary:
                    "bg-white/10 backdrop-blur-xl text-white border border-white/20 hover:bg-white/15 hover:-translate-y-0.5",
                ghost: "hover:bg-white/10 text-slate-200 hover:text-white hover:-translate-y-0.5",
                link: "text-blue-400 underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-5 py-2",
                sm: "h-8 rounded-lg px-3 text-[13px]",
                lg: "h-11 rounded-[14px] px-8 text-base",
                icon: "h-9 w-9 rounded-lg",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                suppressHydrationWarning={true}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
