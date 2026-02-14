# Typography Resources

## Free Distinctive Fonts

### Display Fonts (Headlines)
- **Space Grotesk** - Geometric with personality, excellent for tech
- **Clash Display** - Bold, contemporary, great for statements
- **Cabinet Grotesk** - Neutral but distinctive grotesque
- **Satoshi** - Modern geometric, highly legible
- **General Sans** - Versatile with character

### Body Fonts (Content)
- **Outfit** - Geometric sans with warmth
- **Plus Jakarta Sans** - Professional, highly readable
- **Switzer** - Neo-grotesque with subtle charm
- **Geist** - Vercel's font, modern and crisp
- **DM Sans** - Low contrast, friendly

### Monospace Fonts (Code)
- **JetBrains Mono** - Excellent for code, ligatures
- **Geist Mono** - Clean, modern
- **IBM Plex Mono** - Neutral but distinctive
- **Fira Code** - Great ligatures
- **Source Code Pro** - Adobe's reliable choice

## Font Pairing Strategies

### Contrast Pairing
- Display: Geometric (Space Grotesk)
- Body: Humanist (Source Sans 3)

### Complementary Pairing
- Display: Bold Grotesque (Clash Display)
- Body: Light Grotesque (Outfit)

### Mono + Sans Pairing
- Headers: Monospace (JetBrains Mono)
- Body: Sans-serif (Plus Jakarta Sans)

## Font Loading Best Practices

```css
/* Preload critical fonts */
<link rel="preload" href="/fonts/space-grotesk.woff2" as="font" type="font/woff2" crossorigin>

/* Font-display: swap for performance */
@font-face {
  font-family: 'Space Grotesk';
  src: url('/fonts/space-grotesk.woff2') format('woff2');
  font-weight: 300 700;
  font-display: swap;
}

/* Fallback stack */
font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
```

## Resources

- **Fontshare** - https://fontshare.com (Free, high quality)
- **Google Fonts** - https://fonts.google.com (Massive library)
- **Uncut.wtf** - https://uncut.wtf (Distinctive, free)
- **Font In Use** - https://fontsinuse.com (Inspiration)
- **Typewolf** - https://typewolf.com (Trends and pairings)
