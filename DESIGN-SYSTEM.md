# Design System Documentation

## Overview

BentoLinks AI uses a comprehensive design token system for consistent styling across the application. This design system follows an **8px grid** spacing system and a dark-mode-first approach with neon green (`#c1ff00`) brand accents.

---

## 🎨 Design Tokens

All design tokens are centralized in `src/styles/tokens.ts` and automatically integrated with Tailwind CSS.

### Color Palette

#### Brand Colors
The signature neon green brand color with hover and dark variants.

| Token | Value | Usage |
|-------|-------|-------|
| `brand.neon` | `#c1ff00` | Primary brand color, CTAs, focus states |
| `brand.neonHover` | `#a8e600` | Hover state for neon elements |
| `brand.neonDark` | `#8fc000` | Active/pressed state |

**Tailwind Usage:**
```tsx
<button className="bg-brand-neon hover:bg-brand-neonHover">
  Click Me
</button>
```

**CSS Variables:**
```css
background: var(--color-brand-neon);
```

---

#### Background Colors
Layered backgrounds from darkest (primary) to slightly lighter (elevated).

| Token | Value | Usage |
|-------|-------|-------|
| `bg.primary` | `#0a0a0a` | Main app background |
| `bg.secondary` | `#141414` | Content sections |
| `bg.tertiary` | `#1a1a1a` | Cards, panels |
| `bg.elevated` | `#1f1f1f` | Modals, dropdowns |

**Tailwind Usage:**
```tsx
<div className="bg-bg-primary">
  <section className="bg-bg-secondary">
    <div className="bg-bg-tertiary">Card content</div>
  </section>
</div>
```

---

#### Surface Colors
Interactive surface states for hover/active feedback.

| Token | Value | Usage |
|-------|-------|-------|
| `surface.default` | `#1a1a1a` | Default surface |
| `surface.hover` | `#242424` | Hover state |
| `surface.active` | `#2a2a2a` | Active/pressed state |

**Tailwind Usage:**
```tsx
<div className="bg-surface-default hover:bg-surface-hover active:bg-surface-active">
  Interactive Card
</div>
```

---

#### Text Colors
Typography colors from primary (white) to tertiary (gray).

| Token | Value | Usage |
|-------|-------|-------|
| `text.primary` | `#ffffff` | Headings, primary text |
| `text.secondary` | `#a3a3a3` | Body text, descriptions |
| `text.tertiary` | `#737373` | Muted text, labels |
| `text.inverse` | `#0a0a0a` | Text on neon backgrounds |

**Tailwind Usage:**
```tsx
<h1 className="text-text-primary">Main Heading</h1>
<p className="text-text-secondary">Description text</p>
<span className="text-text-tertiary">Muted label</span>
```

---

#### Border Colors
Border colors for default, hover, and focus states.

| Token | Value | Usage |
|-------|-------|-------|
| `border.default` | `#2a2a2a` | Default borders |
| `border.hover` | `#3a3a3a` | Hover state borders |
| `border.focus` | `#c1ff00` | Focus rings, active borders |

**Tailwind Usage:**
```tsx
<input className="border border-border-default focus:border-border-focus" />
```

---

#### Status Colors
Semantic colors for feedback and states.

| Token | Value | Usage |
|-------|-------|-------|
| `status.success` | `#22c55e` | Success messages, confirmations |
| `status.error` | `#ef4444` | Errors, warnings |
| `status.warning` | `#f59e0b` | Warnings, cautions |
| `status.info` | `#3b82f6` | Info messages |

**Tailwind Usage:**
```tsx
<div className="bg-status-success text-white p-4">Success!</div>
```

---

## 📏 Spacing System (8px Grid)

All spacing follows an **8px base unit** for visual consistency.

| Token | Value | Multiplier | Usage |
|-------|-------|------------|-------|
| `0` | `0px` | 0× | No spacing |
| `1` | `4px` | 0.5× | Micro spacing |
| `2` | `8px` | 1× | Small spacing |
| `3` | `12px` | 1.5× | Medium-small |
| `4` | `16px` | 2× | Standard spacing |
| `5` | `20px` | 2.5× | Medium |
| `6` | `24px` | 3× | Large |
| `8` | `32px` | 4× | Extra large |
| `10` | `40px` | 5× | XXL |
| `12` | `48px` | 6× | XXXL |
| `16` | `64px` | 8× | Section spacing |
| `20` | `80px` | 10× | Large sections |
| `24` | `96px` | 12× | Hero sections |

**Tailwind Usage:**
```tsx
<div className="p-4 mb-6 mt-8">
  {/* padding: 16px, margin-bottom: 24px, margin-top: 32px */}
</div>
```

**Rule of Thumb:**
- **Component padding:** `4` (16px)
- **Section margins:** `8` or `12` (32px or 48px)
- **Card gaps:** `6` (24px)
- **Input padding:** `3` or `4` (12px or 16px)

---

## 🔤 Typography

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `fontFamily.sans` | System fonts | Body text, UI |
| `fontFamily.mono` | Fira Code, Courier | Code blocks, monospace |

**Tailwind Usage:**
```tsx
<p className="font-sans">Regular text</p>
<code className="font-mono">const x = 10;</code>
```

---

### Font Sizes

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `xs` | `0.75rem` | 12px | Small labels, captions |
| `sm` | `0.875rem` | 14px | Secondary text |
| `base` | `1rem` | 16px | Body text |
| `lg` | `1.125rem` | 18px | Large body text |
| `xl` | `1.25rem` | 20px | Subheadings |
| `2xl` | `1.5rem` | 24px | H3 |
| `3xl` | `1.875rem` | 30px | H2 |
| `4xl` | `2.25rem` | 36px | H1 |

**Tailwind Usage:**
```tsx
<h1 className="text-4xl">Main Title</h1>
<h2 className="text-3xl">Section Title</h2>
<p className="text-base">Body text</p>
```

---

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `normal` | 400 | Body text |
| `medium` | 500 | Emphasis |
| `semibold` | 600 | Subheadings |
| `bold` | 700 | Headings, strong emphasis |

**Tailwind Usage:**
```tsx
<h1 className="font-bold">Bold Heading</h1>
<p className="font-normal">Normal text</p>
```

---

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `tight` | 1.25 | Headings |
| `normal` | 1.5 | Body text |
| `relaxed` | 1.75 | Long-form content |

**Tailwind Usage:**
```tsx
<h1 className="leading-tight">Heading</h1>
<p className="leading-normal">Body paragraph</p>
```

---

## 🔲 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `none` | `0px` | Sharp corners |
| `sm` | `4px` | Subtle rounding |
| `md` | `8px` | Standard components |
| `lg` | `12px` | Cards, panels |
| `xl` | `16px` | Large cards |
| `full` | `9999px` | Pills, avatars |

**Tailwind Usage:**
```tsx
<div className="rounded-lg">Card</div>
<button className="rounded-full">Pill Button</button>
```

---

## ✨ Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | Subtle shadow | Slight elevation |
| `md` | Medium shadow | Cards |
| `lg` | Large shadow | Modals |
| `xl` | Extra large | Floating elements |
| `neon` | Neon glow (subtle) | Neon elements at rest |
| `neonHover` | Neon glow (intense) | Neon elements on hover |

**Tailwind Usage:**
```tsx
<div className="shadow-md">Card</div>
<button className="shadow-neon hover:shadow-neonHover">
  Neon Button
</button>
```

---

## ⚡ Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `fast` | `150ms` | Quick interactions (hover) |
| `normal` | `300ms` | Standard animations |
| `slow` | `500ms` | Complex transitions |

**Tailwind Usage:**
```tsx
<button className="transition-all duration-fast hover:scale-105">
  Quick Hover
</button>
```

**CSS Variables:**
```css
transition: all var(--transition-normal);
```

---

## 🛠️ Usage Guide

### 1. **Importing Tokens in TypeScript**

```typescript
import { tokens } from '@/styles/tokens';

const myColor = tokens.colors.brand.neon;
```

### 2. **Using the Hook**

```typescript
import { useDesignTokens } from '@/hooks/useDesignTokens';

function MyComponent() {
  const tokens = useDesignTokens();
  
  return (
    <div style={{ color: tokens.colors.text.primary }}>
      Custom styled element
    </div>
  );
}
```

### 3. **Applying CSS Variables**

Add this to your main entry file (e.g., `index.tsx`):

```typescript
import { applyTokensToRoot } from '@/hooks/useDesignTokens';

// Apply on mount
applyTokensToRoot();
```

Then use CSS variables:

```css
.custom-button {
  background: var(--color-brand-neon);
  box-shadow: var(--shadow-neon);
  transition: all var(--transition-fast);
}

.custom-button:hover {
  background: var(--color-brand-neonHover);
  box-shadow: var(--shadow-neonHover);
}
```

---

## 📦 Component Patterns

### Button Component Example

```tsx
// Primary Neon Button
<button className="
  bg-brand-neon 
  hover:bg-brand-neonHover 
  active:bg-brand-neonDark
  text-text-inverse 
  font-semibold 
  px-6 py-3 
  rounded-lg 
  shadow-neon 
  hover:shadow-neonHover
  transition-all 
  duration-fast
">
  Primary Action
</button>

// Secondary Button
<button className="
  bg-surface-default 
  hover:bg-surface-hover 
  active:bg-surface-active
  text-text-primary 
  border border-border-default
  hover:border-border-hover
  font-medium 
  px-6 py-3 
  rounded-lg 
  transition-all 
  duration-fast
">
  Secondary Action
</button>
```

### Card Component Example

```tsx
<div className="
  bg-bg-tertiary 
  border border-border-default
  rounded-lg 
  p-6 
  shadow-md
  hover:border-border-hover
  transition-all
  duration-normal
">
  <h3 className="text-2xl font-bold text-text-primary mb-4">
    Card Title
  </h3>
  <p className="text-base text-text-secondary leading-normal">
    Card description content goes here.
  </p>
</div>
```

### Input Component Example

```tsx
<input 
  type="text"
  className="
    w-full
    bg-surface-default
    text-text-primary
    border border-border-default
    focus:border-border-focus
    focus:ring-2 focus:ring-brand-neon/20
    rounded-md
    px-4 py-3
    transition-all
    duration-fast
    placeholder:text-text-tertiary
  "
  placeholder="Enter text..."
/>
```

---

## 🎯 Best Practices

### Do's ✅
- **Use spacing tokens** — Avoid arbitrary values like `p-[13px]`
- **Follow the 8px grid** — Consistent spacing creates visual harmony
- **Use semantic colors** — Use `status.success` instead of hard-coded green
- **Leverage Tailwind classes** — They auto-sync with design tokens
- **Apply hover/active states** — Provide clear interactive feedback

### Don'ts ❌
- **Don't use hard-coded colors** — Use tokens instead
- **Don't break the 8px grid** — Use multiples of 4px/8px only
- **Don't skip transitions** — Smooth animations improve UX
- **Don't forget accessibility** — Ensure sufficient color contrast

---

## 🔄 Extending the System

To add new tokens:

1. **Update `src/styles/tokens.ts`:**
   ```typescript
   export const tokens = {
     colors: {
       // Add new color group
       accent: {
         purple: '#a855f7',
         blue: '#3b82f6',
       },
     },
   };
   ```

2. **Update `src/styles/tailwind-theme.ts`:**
   ```typescript
   export const tailwindTheme = {
     extend: {
       colors: {
         accent: tokens.colors.accent,
       },
     },
   };
   ```

3. **Use in components:**
   ```tsx
   <div className="bg-accent-purple">New accent color!</div>
   ```

---

## 📚 Additional Resources

- **Tailwind CSS Docs:** https://tailwindcss.com/docs
- **8-Point Grid System:** https://builttoadapt.io/intro-to-the-8-point-grid-system-d2573cde8632
- **Color Contrast Checker:** https://webaim.org/resources/contrastchecker/

---

**Design System Version:** 1.0.0  
**Last Updated:** March 21, 2026
