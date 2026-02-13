# Color System Reference

## HSL Color System

HSL (Hue, Saturation, Lightness) is preferred for design systems because it's intuitive to manipulate.

```css
/* Base color */
--primary: hsl(350, 89%, 60%);  /* Rose */

/* Derived colors */
--primary-light: hsl(350, 89%, 70%);    /* +10 lightness */
--primary-dark: hsl(350, 89%, 50%);     /* -10 lightness */
--primary-muted: hsl(350, 50%, 60%);    /* -39 saturation */
--primary-vibrant: hsl(350, 100%, 60%); /* max saturation */
```

## Tailwind CSS Variable Pattern

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
    },
  },
}

// globals.css
:root {
  --primary: 350 89% 60%;
  --primary-foreground: 0 0% 100%;
  --accent: 38 92% 50%;
  --accent-foreground: 0 0% 0%;
}

.dark {
  --primary: 350 89% 70%;
  --primary-foreground: 0 0% 0%;
  --accent: 38 92% 60%;
  --accent-foreground: 0 0% 0%;
}
```

## Distinctive Palettes (Non-Generic)

### Warm Rose + Amber
```css
--primary: 350 89% 60%;     /* Rose */
--accent: 38 92% 50%;       /* Amber */
--neutral: 20 14.3% 4.1%;   /* Warm black */
```

### Cool Cyan + Violet
```css
--primary: 189 94% 43%;     /* Cyan */
--accent: 263 70% 50%;      /* Violet */
--neutral: 240 10% 3.9%;    /* Cool black */
```

### Earthy Emerald + Terracotta
```css
--primary: 142 71% 45%;     /* Emerald */
--accent: 12 76% 61%;       /* Terracotta */
--neutral: 24 10% 10%;      /* Warm stone */
```

### Modern Indigo + Yellow
```css
--primary: 239 84% 67%;     /* Indigo */
--accent: 48 96% 53%;       /* Yellow */
--neutral: 224 71% 4%;      /* Deep blue-black */
```

## Color Contrast Requirements

- **Normal text**: 4.5:1 minimum (WCAG AA)
- **Large text**: 3:1 minimum (18px+ or 14px+ bold)
- **UI components**: 3:1 minimum against adjacent colors

### Tools
- WebAIM Contrast Checker
- Stark (Figma plugin)
- Polypane Color Contrast

## Dark Mode Strategies

### Not Just Inversion
```css
/* Light mode */
:root {
  --background: 0 0% 100%;      /* Pure white */
  --foreground: 20 14.3% 4.1%;  /* Warm black */
  --card: 0 0% 100%;
  --primary: 350 89% 60%;       /* Rose */
}

/* Dark mode - reimagined, not inverted */
.dark {
  --background: 20 14.3% 4.1%;  /* Warm black, not gray */
  --foreground: 60 9% 98%;      /* Cream, not white */
  --card: 24 10% 10%;           /* Elevated surface */
  --primary: 350 89% 70%;       /* Lighter rose for contrast */
}
```

### Surface Elevation
```css
.dark {
  --surface-1: hsl(24 10% 10%);   /* Base */
  --surface-2: hsl(24 10% 12%);   /* Slightly raised */
  --surface-3: hsl(24 10% 14%);   /* Modal/popover */
  --surface-4: hsl(24 10% 16%);   /* Highest elevation */
}
```

## Gradient Strategies

### Subtle Brand Gradient
```css
background: linear-gradient(
  135deg,
  hsl(var(--primary)) 0%,
  hsl(var(--accent)) 100%
);
```

### Mesh Gradient (Modern)
```css
background:
  radial-gradient(at 40% 20%, hsl(350 89% 60% / 0.3) 0px, transparent 50%),
  radial-gradient(at 80% 0%, hsl(38 92% 50% / 0.2) 0px, transparent 50%),
  radial-gradient(at 0% 50%, hsl(263 70% 50% / 0.2) 0px, transparent 50%);
```

### Text Gradient
```css
.gradient-text {
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

## Resources

- **Realtime Colors** - https://realtimecolors.com
- **Happy Hues** - https://happyhues.co
- **Radix Colors** - https://radix-ui.com/colors
- **Coolors** - https://coolors.co
- **Color Hunt** - https://colorhunt.co
