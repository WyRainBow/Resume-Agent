import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-none fresh:rounded-lg text-sm font-medium font-mono uppercase tracking-wide ring-offset-background transition-[transform,box-shadow,background-color] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3367D6] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#4285F4] text-white border border-black fresh:border-slate-200 shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm hover:bg-[#3367D6] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none active:translate-y-[2px] active:translate-x-[2px]",
        destructive:
          "bg-red-700 text-white border border-black fresh:border-slate-200 shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm hover:bg-red-800 hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none active:translate-y-[2px] active:translate-x-[2px]",
        outline:
          "bg-[#F0F0E8] fresh:bg-slate-50 text-black border border-black fresh:border-slate-200 shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm hover:bg-[#E5E5E0] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none active:translate-y-[2px] active:translate-x-[2px]",
        secondary:
          "bg-[#E5E5E0] text-black border border-black fresh:border-slate-200 shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm hover:bg-[#D8D8D2] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none active:translate-y-[2px] active:translate-x-[2px]",
        ghost: "bg-transparent text-black hover:bg-[#E5E5E0] active:bg-[#E5E5E0]",
        link: "text-[#3367D6] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
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
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

