---
version: 1.1.1
name: frontend-design
description: Production-grade component patterns and tooling
---

# Production-Grade Component Patterns

## Complete Button Component

```tsx
'use client'

import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'whitespace-nowrap text-sm font-medium',
    'ring-offset-background transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
          'shadow-lg shadow-primary/25',
        ],
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:bg-destructive/90',
          'shadow-lg shadow-destructive/25',
        ],
        outline: [
          'border-2 border-input bg-background',
          'hover:bg-accent hover:text-accent-foreground',
        ],
        secondary: [
          'bg-secondary text-secondary-foreground',
          'hover:bg-secondary/80',
        ],
        ghost: [
          'hover:bg-accent hover:text-accent-foreground',
        ],
        link: [
          'text-primary underline-offset-4',
          'hover:underline',
        ],
      },
      size: {
        default: 'h-10 px-4 py-2 rounded-lg',
        sm: 'h-9 px-3 text-xs rounded-md',
        lg: 'h-11 px-8 text-base rounded-xl',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends ComponentPropsWithoutRef<'button'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

## Input with Label and Error

```tsx
'use client'

import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && <Label htmlFor={props.id}>{label}</Label>}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-lg border border-input',
            'bg-background px-3 py-2 text-sm',
            'ring-offset-background file:border-0',
            'file:bg-transparent file:text-sm file:font-medium',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${props.id}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${props.id}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-sm text-muted-foreground">{helperText}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
```

## Card with Loading State

```tsx
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface CardProps {
  children: React.ReactNode
  className?: string
  isLoading?: boolean
}

export function Card({ children, className, isLoading }: CardProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-xl border bg-card p-6', className)}>
        <Skeleton className="h-4 w-1/3 mb-4" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border bg-card p-6 shadow-sm', className)}>
      {children}
    </div>
  )
}
```

## Error Boundary Component

```tsx
'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 text-center">
          <h3 className="text-lg font-semibold text-destructive">
            Something went wrong
          </h3>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

## Performance Optimizations

```tsx
// Memoize expensive computations
const ExpensiveComponent = React.memo(function ExpensiveComponent({ data }) {
  const processed = useMemo(() => {
    return data.map(item => expensiveTransform(item))
  }, [data])

  return <div>{processed}</div>
})

// Virtualize long lists
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index]}
          </div>
        ))}
      </div>
    </div>
  )
}

// Code splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'))

function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <HeavyComponent />
    </Suspense>
  )
}
```

# Recommended Tools Reference

## Font Sources

| Source | Type | Best For |
|--------|------|----------|
| [Google Fonts](https://fonts.google.com) | Free, hosted | Quick prototyping, standard fonts |
| [Fontshare](https://www.fontshare.com) | Free, quality | Display fonts, modern aesthetics |
| [Uncut](https://uncut.wtf) | Free, indie | Unique, distinctive choices |
| [Adobe Fonts](https://fonts.adobe.com) | Subscription | Professional, extensive library |
| [ Pangram Pangram](https://pangrampangram.com) | Premium | High-end display fonts |

## Color Tools

| Tool | Purpose |
|------|---------|
| [Realtime Colors](https://realtimecolors.com) | Live palette preview |
| [Happy Hues](https://happyhues.co) | Curated color palettes |
| [Radix Colors](https://radix-ui.com/colors) | Accessible, systematic colors |
| [OKLCH Color Picker](https://oklch.com) | Modern color space |
| [Color Hunt](https://colorhunt.co) | Inspiration |

## Animation Libraries

| Library | Best For |
|---------|----------|
| [Framer Motion](https://framer.com/motion) | React animations, gestures |
| [GSAP](https://greensock.com/gsap) | Complex timelines, scroll |
| [React Spring](https://react-spring.dev) | Physics-based animations |
| [Lottie](https://airbnb.io/lottie) | Complex vector animations |
| [Rive](https://rive.app) | Interactive animations |

## Icon Libraries

| Library | Style |
|---------|-------|
| [Lucide](https://lucide.dev) | Clean, consistent |
| [Phosphor](https://phosphoricons.com) | Flexible weights |
| [Tabler](https://tabler-icons.io) | Modern, outlined |
| [Heroicons](https://heroicons.com) | Tailwind-native |
| [Radix Icons](https://radix-ui.com/icons) | Minimal |
