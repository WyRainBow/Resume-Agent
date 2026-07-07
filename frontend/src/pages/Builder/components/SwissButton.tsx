/**
 * Swiss International Style Button —— 移植自 Resume-Matcher components/ui/button.tsx。
 * 差异:RM Tailwind v4 自定义 token 换算为 arbitrary class(见实施计划§二);
 * 只保留本页用到的 variants(default/success/outline/secondary/ghost/link)。
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SwissButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'success' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'icon'
}

export const SwissButton = React.forwardRef<HTMLButtonElement, SwissButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = cn(
      'relative inline-flex items-center justify-center gap-2',
      'whitespace-nowrap text-sm font-medium font-mono uppercase tracking-wide',
      'transition-[transform,box-shadow,background-color] duration-100 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      "[&_svg]:pointer-events-none [&_svg]:shrink-0",
      'rounded-none'
    )

    const variants = {
      // PRIMARY - Hyper Blue
      default: cn(
        'bg-blue-700 text-white',
        'border border-black',
        'shadow-[2px_2px_0px_0px_#000000]',
        'hover:bg-blue-800',
        'hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none',
        'active:translate-y-[2px] active:translate-x-[2px]'
      ),
      // SUCCESS - Signal Green
      success: cn(
        'bg-green-700 text-white',
        'border border-black',
        'shadow-[2px_2px_0px_0px_#000000]',
        'hover:bg-green-800',
        'hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none',
        'active:translate-y-[2px] active:translate-x-[2px]'
      ),
      // OUTLINE - Canvas background with black border
      outline: cn(
        'bg-[#F0F0E8] text-black',
        'border border-black',
        'shadow-[2px_2px_0px_0px_#000000]',
        'hover:bg-[#E5E5E0]',
        'hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none',
        'active:translate-y-[2px] active:translate-x-[2px]'
      ),
      // SECONDARY - Panel Grey
      secondary: cn(
        'bg-[#E5E5E0] text-black',
        'border border-black',
        'shadow-[2px_2px_0px_0px_#000000]',
        'hover:bg-[#D8D8D2]',
        'hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none',
        'active:translate-y-[2px] active:translate-x-[2px]'
      ),
      // GHOST - No background, minimal styling
      ghost: cn(
        'bg-transparent text-black',
        'border-none shadow-none',
        'hover:bg-[#F1F2F5]',
        'active:bg-[#F1F2F5]'
      ),
      // LINK - Text only with underline
      link: cn(
        'bg-transparent text-blue-700',
        'border-none shadow-none',
        'underline-offset-4 hover:underline',
        'p-0 h-auto'
      ),
    }

    const sizes = {
      default: 'h-10 px-6 py-2 [&_svg]:size-4',
      sm: 'h-8 px-4 py-1 text-xs [&_svg]:size-4',
      icon: 'h-8 w-8 p-0 [&_svg]:size-4',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)
SwissButton.displayName = 'SwissButton'
