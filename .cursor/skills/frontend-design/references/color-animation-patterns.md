---
version: 1.1.1
name: frontend-design
description: Advanced color palette and animation patterns
---

# Advanced Color Palettes

## Semantic Token Structure

```typescript
const tokens = {
  colors: {
    // Brand
    primary: {
      DEFAULT: 'hsl(340 80% 55%)',
      50: 'hsl(340 80% 97%)',
      100: 'hsl(340 80% 92%)',
      500: 'hsl(340 80% 55%)',
      600: 'hsl(340 80% 45%)',
      900: 'hsl(340 80% 20%)',
    },
    
    // Functional
    success: 'hsl(142 76% 36%)',
    warning: 'hsl(38 92% 50%)',
    error: 'hsl(0 84% 60%)',
    info: 'hsl(217 91% 60%)',
    
    // Surface
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(240 10% 3.9%)',
    muted: 'hsl(240 5% 96%)',
    
    // Elevation
    card: 'hsl(0 0% 100% / 0.8)',
    popover: 'hsl(0 0% 100% / 0.95)',
    overlay: 'hsl(240 10% 3.9% / 0.8)',
  }
}
```

## Gradient Strategies

```css
/* Mesh gradient background */
.mesh-gradient {
  background: 
    radial-gradient(at 40% 20%, hsl(340 80% 55% / 0.3) 0px, transparent 50%),
    radial-gradient(at 80% 0%, hsl(210 100% 50% / 0.3) 0px, transparent 50%),
    radial-gradient(at 0% 50%, hsl(280 100% 60% / 0.3) 0px, transparent 50%),
    hsl(0 0% 100%);
}

/* Aurora gradient animation */
@keyframes aurora {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.aurora {
  background: linear-gradient(
    -45deg,
    hsl(340 80% 55%),
    hsl(210 100% 50%),
    hsl(280 100% 60%),
    hsl(340 80% 55%)
  );
  background-size: 400% 400%;
  animation: aurora 15s ease infinite;
}
```

## Dark Mode Reimagined

```typescript
const darkPalette = {
  // Not just inverted - completely rethought
  background: 'hsl(240 10% 3.9%)',
  foreground: 'hsl(0 0% 98%)',
  
  // Warm dark neutrals
  muted: {
    DEFAULT: 'hsl(240 5% 15%)',
    foreground: 'hsl(240 5% 65%)',
  },
  
  // Elevated surfaces with subtle warmth
  card: 'hsl(240 6% 10%)',
  popover: 'hsl(240 6% 12%)',
  
  // Adjusted primary for dark
  primary: {
    DEFAULT: 'hsl(340 80% 65%)',  // Brighter on dark
    foreground: 'hsl(0 0% 100%)',
  }
}
```

# Animation Patterns

## Spring Physics Configuration

```typescript
const springConfigs = {
  gentle: { type: 'spring', damping: 25, stiffness: 120 },
  bouncy: { type: 'spring', damping: 15, stiffness: 300 },
  stiff: { type: 'spring', damping: 30, stiffness: 400 },
  slow: { type: 'spring', damping: 20, stiffness: 80 },
}
```

## Staggered Entrance Patterns

```tsx
// Container variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    }
  }
}

// Item variants with different directions
const slideUp = {
  hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
  show: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  }
}

const slideIn = {
  hidden: { opacity: 0, x: -30 },
  show: { 
    opacity: 1, 
    x: 0,
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { 
    opacity: 1, 
    scale: 1,
    transition: { type: 'spring', damping: 20, stiffness: 300 }
  }
}
```

## Hover Micro-interactions

```tsx
// Magnetic button effect
const magneticButton = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
  transition: { type: 'spring', stiffness: 400, damping: 17 }
}

// Card lift with shadow
const cardHover = {
  whileHover: { 
    y: -8,
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  }
}

// Icon rotation
const iconSpin = {
  whileHover: { rotate: 180 },
  transition: { duration: 0.4, ease: 'easeInOut' }
}
```

## Scroll-Triggered Animations

```tsx
// Fade in on scroll
const fadeInOnScroll = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-100px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
}

// Parallax effect
const parallax = {
  style: { y: useTransform(scrollY, [0, 500], [0, 150]) }
}

// Text reveal line by line
const textReveal = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 }
  }
}

const textLine = {
  hidden: { y: '100%', opacity: 0 },
  show: { 
    y: 0, 
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  }
}
```

## Reduced Motion Support

```tsx
// Always respect user preferences
const accessibleAnimation = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { 
    duration: 0.5,
    // Framer Motion automatically respects prefers-reduced-motion
  }
}

// Manual check for complex animations
const prefersReducedMotion = 
  typeof window !== 'undefined' && 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const animationProps = prefersReducedMotion 
  ? {} 
  : { initial: { opacity: 0 }, animate: { opacity: 1 } };
```
