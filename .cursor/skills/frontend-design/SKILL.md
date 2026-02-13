---
version: 1.1.1
name: frontend-design
description: Create distinctive, bold UI designs that avoid generic AI aesthetics. This skill should be used when users want frontend components with strong visual identity, creative typography, intentional color palettes, and production-grade animations - specifically to avoid the bland, safe, homogeneous "AI slop" that plagues most generated interfaces.
location: user
license: MIT
---

# Frontend Design Skill

Create distinctive, production-grade UI that stands out from generic AI-generated interfaces.

> **Official Plugin Available**: Install `frontend-design@claude-code-plugins` from the Anthropic marketplace for auto-invocation on frontend tasks. This skill provides extended guidance beyond the official version.

## Core Philosophy

Most AI-generated UIs suffer from "AI slop" - they're technically correct but visually bland. This skill helps you break that pattern by making **bold aesthetic choices** that give your interface a distinctive personality.

## The Five Pillars

### 1. Typography with Character

**Avoid:** Inter, Arial, Roboto, system-ui (the default AI choices)

**Instead:** Commit to distinctive font stacks that vary by project tone:
- Display: Clash Display, Cabinet Grotesk, Satoshi, General Sans, Syne, Archivo
- Body: Outfit, Plus Jakarta Sans, Switzer, Geist
- Mono: JetBrains Mono, Geist Mono, IBM Plex Mono

**Key principle:** NEVER use the same fonts across different projects. Each design should feel genuinely different.

### 2. Intentional Color Palettes

**Avoid:** Default Tailwind colors, basic blue buttons, gray backgrounds

**Create signature palettes with:**
- Semantic tokens (primary, accent, neutral, surface)
- HSL for easier manipulation
- Subtle hue shifts in neutrals (warm stone, cool slate)
- Gradients as primary colors

### 3. Bold Spatial Composition

**Avoid:** Everything centered, symmetric, grid-locked

**Break the grid intentionally:**
- Use negative space as a design element
- Overlap elements to create depth
- Break alignment rules purposefully
- Use `clamp()` for fluid typography

### 4. Motion as Personality

**Avoid:** No animations or generic fade-in

**Add purposeful motion:**
- Spring physics (not linear easing)
- Staggered entrances
- Subtle blur transitions
- Responsive hover states
- Respect `prefers-reduced-motion`

### 5. Production-Grade Implementation

**Requirements:**
- TypeScript with proper types
- Accessibility (focus states, ARIA, keyboard nav)
- Loading states
- Error boundaries
- Responsive design
- Performance optimization

## Match Complexity to Vision

- **Maximalist designs:** Elaborate code with extensive animations, layered effects
- **Minimalist designs:** Restraint, precision, careful attention to spacing

## Workflow

1. **Establish Design Direction** - Define emotion, target user, color palette, typography
2. **Create Component Architecture** - Atomic design system with composition
3. **Add Visual Personality** - Distinctive choices, intentional relationships, purposeful asymmetry
4. **Implement Motion** - Entrance animations, interactions, transitions
5. **Production Harden** - Type everything, handle edge cases, optimize

## Anti-Patterns to Avoid

- Using Inter/Roboto as default font
- Same fonts across projects
- Gray-on-white with blue buttons
- Everything centered and symmetric
- No animations or generic fades
- Ignoring dark mode
- Forgetting loading/error states
- Skipping accessibility

## Additional Resources

For detailed implementation guidance, see the references directory:

- **`references/typography-examples.md`** - Font stacks by tone, variable fonts, responsive scales
- **`references/color-animation-patterns.md`** - Advanced palettes, gradients, dark mode, animation patterns
- **`references/production-patterns.md`** - Complete component examples, error boundaries, performance optimization, tooling recommendations

## Quick Reference

```bash
# Distinctive font stacks (vary these per project!)
font-display: 'Clash Display', 'Cabinet Grotesk', 'Satoshi', 'General Sans'
font-body: 'Outfit', 'Plus Jakarta Sans', 'Switzer', 'Geist'
font-mono: 'JetBrains Mono', 'Geist Mono', 'IBM Plex Mono'

# Tailwind config pattern
theme: {
  extend: {
    colors: { /* HSL tokens */ },
    fontFamily: { /* Variable fonts */ },
    animation: { /* Spring-based */ },
  }
}
```

## Integration with Design Specialist Agent

Use this skill for:
- Distinctive visual identity
- Creative typography and color choices
- Bold spatial compositions
- Production-ready animated components

Use the design-specialist agent for:
- Comprehensive UI/UX reviews
- Accessibility audits
- Design system architecture
- Component library setup
