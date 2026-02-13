---
version: 1.1.1
name: frontend-design
description: Detailed implementation examples for distinctive UI design
---

# Typography Implementation Examples

## Display Font Stacks by Tone

### Brutalist/Raw
```typescript
const typography = {
  display: {
    family: 'Clash Display',
    weights: [700],
    letterSpacing: '-0.03em',
    lineHeight: 0.9,
  },
  body: {
    family: 'Inter',
    weights: [400, 500],
    lineHeight: 1.5,
  }
}
```

### Luxury/Refined
```typescript
const typography = {
  display: {
    family: 'Bodoni Moda',
    weights: [400],
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  body: {
    family: 'Source Serif 4',
    weights: [400, 600],
    lineHeight: 1.7,
  }
}
```

### Playful/Tech
```typescript
const typography = {
  display: {
    family: 'Space Grotesk',
    weights: [500, 700],
    letterSpacing: '-0.02em',
  },
  body: {
    family: 'DM Sans',
    weights: [400, 500, 700],
    lineHeight: 1.6,
  }
}
```

## Variable Font Implementation

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter.var.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}

/* Usage with font-variation-settings */
.headline {
  font-variation-settings: 'wght' 700, 'slnt' -10;
}
```

## Responsive Type Scale

```typescript
// Fluid typography with clamp()
const fluidType = {
  hero: 'clamp(3rem, 8vw, 8rem)',
  h1: 'clamp(2.5rem, 5vw, 4rem)',
  h2: 'clamp(1.75rem, 3vw, 2.5rem)',
  body: 'clamp(1rem, 1.5vw, 1.125rem)',
}
```

## Mixed Serif/Sans Combinations

| Display | Body | Use Case |
|---------|------|----------|
| Playfair Display | Inter | Editorial/Magazine |
| Cormorant Garamond | DM Sans | Luxury/Beauty |
| Syne | Space Grotesk | Tech/Modern |
| Editorial New | Spline Sans | Fashion/Creative |
