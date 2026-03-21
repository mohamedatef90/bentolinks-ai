# Design System Quick Start Guide

## ⚡ 3-Minute Setup

### Step 1: Install Tailwind CSS

```bash
npm install -D tailwindcss postcss autoprefixer
```

✅ **Note:** We already created `tailwind.config.js` for you.

---

### Step 2: Import Global CSS

**Option A: In `index.tsx` (root entry):**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/styles/global.css'; // ← Add this
import { applyTokensToRoot } from './src/hooks/useDesignTokens'; // ← Add this

// Apply CSS variables on mount
applyTokensToRoot();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Option B: In `App.tsx`:**

```typescript
import './src/styles/global.css'; // ← Add this
import { applyTokensToRoot } from './src/hooks/useDesignTokens';

// Apply CSS variables once
applyTokensToRoot();

function App() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Your app */}
    </div>
  );
}

export default App;
```

---

### Step 3: Test It!

Create a test component to verify everything works:

```tsx
function TestDesignSystem() {
  return (
    <div className="p-8 space-y-6">
      {/* Test: Brand Color */}
      <button className="
        bg-brand-neon 
        hover:bg-brand-neonHover 
        text-text-inverse 
        font-semibold 
        px-6 py-3 
        rounded-lg 
        shadow-neon 
        hover:shadow-neonHover
        transition-all 
        duration-fast
      ">
        Primary Button
      </button>

      {/* Test: Card */}
      <div className="
        bg-bg-tertiary 
        border border-border-default
        rounded-lg 
        p-6 
        max-w-md
      ">
        <h3 className="text-2xl font-bold text-text-primary mb-2">
          Design System Test
        </h3>
        <p className="text-base text-text-secondary">
          If you can see neon green, dark backgrounds, and smooth transitions, 
          the design system is working! 🎉
        </p>
      </div>

      {/* Test: Input */}
      <input 
        type="text"
        className="
          w-full max-w-md
          bg-surface-default
          text-text-primary
          border border-border-default
          focus:border-border-focus
          rounded-md
          px-4 py-3
          transition-all
          duration-fast
        "
        placeholder="Test input field..."
      />
    </div>
  );
}
```

---

## 🎨 Common Patterns

### Button Variants

```tsx
// Primary (Neon)
<button className="bg-brand-neon hover:bg-brand-neonHover text-text-inverse px-6 py-3 rounded-lg shadow-neon hover:shadow-neonHover transition-all duration-fast">
  Primary
</button>

// Secondary (Ghost)
<button className="bg-surface-default hover:bg-surface-hover text-text-primary border border-border-default px-6 py-3 rounded-lg transition-all duration-fast">
  Secondary
</button>

// Danger
<button className="bg-status-error hover:bg-red-600 text-white px-6 py-3 rounded-lg transition-all duration-fast">
  Delete
</button>
```

---

### Card Component

```tsx
<div className="bg-bg-tertiary border border-border-default hover:border-border-hover rounded-lg p-6 shadow-md transition-all duration-normal">
  <h3 className="text-2xl font-bold text-text-primary mb-3">Card Title</h3>
  <p className="text-base text-text-secondary mb-4">Card description goes here.</p>
  <button className="bg-brand-neon text-text-inverse px-4 py-2 rounded-md">
    Action
  </button>
</div>
```

---

### Input Field

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-text-secondary">
    Email Address
  </label>
  <input 
    type="email"
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
    "
    placeholder="you@example.com"
  />
</div>
```

---

### Modal / Dialog

```tsx
<div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
  <div className="
    bg-bg-elevated 
    border border-border-default
    rounded-xl 
    p-6 
    max-w-md 
    w-full
    shadow-xl
  ">
    <h2 className="text-3xl font-bold text-text-primary mb-4">
      Confirm Action
    </h2>
    <p className="text-base text-text-secondary mb-6">
      Are you sure you want to proceed?
    </p>
    <div className="flex gap-3">
      <button className="flex-1 bg-surface-default hover:bg-surface-hover text-text-primary border border-border-default px-4 py-3 rounded-lg transition-all duration-fast">
        Cancel
      </button>
      <button className="flex-1 bg-brand-neon hover:bg-brand-neonHover text-text-inverse px-4 py-3 rounded-lg shadow-neon hover:shadow-neonHover transition-all duration-fast">
        Confirm
      </button>
    </div>
  </div>
</div>
```

---

## 🔧 Using Design Tokens Programmatically

### With React Hook

```tsx
import { useDesignTokens } from './hooks/useDesignTokens';

function MyComponent() {
  const tokens = useDesignTokens();
  
  return (
    <div style={{ 
      backgroundColor: tokens.colors.bg.tertiary,
      color: tokens.colors.text.primary,
      padding: tokens.spacing[6],
      borderRadius: tokens.borderRadius.lg,
    }}>
      Custom styled component
    </div>
  );
}
```

### With CSS Variables

```css
.my-custom-button {
  background: var(--color-brand-neon);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-neon);
  transition: all var(--transition-fast);
}

.my-custom-button:hover {
  background: var(--color-brand-neonHover);
  box-shadow: var(--shadow-neonHover);
}
```

---

## 📏 Spacing Reference (Quick Lookup)

| Class | Value | Use Case |
|-------|-------|----------|
| `p-2` | 8px | Input padding (small) |
| `p-3` | 12px | Input padding (medium) |
| `p-4` | 16px | Card padding, Button padding |
| `p-6` | 24px | Modal padding, Large card padding |
| `gap-4` | 16px | Flex/Grid gap (standard) |
| `gap-6` | 24px | Section gaps |
| `mb-8` | 32px | Section margin |
| `mt-12` | 48px | Large section spacing |

---

## 🎯 Best Practices Checklist

- ✅ Use design tokens (not hard-coded values)
- ✅ Follow 8px grid for spacing
- ✅ Add hover/active states to interactive elements
- ✅ Use transitions for smooth animations
- ✅ Ensure text contrast meets accessibility standards
- ✅ Test components in dark mode (default)
- ✅ Use semantic status colors (success/error/warning)

---

## 🐛 Troubleshooting

### Issue: Tailwind classes not working

**Solution:** Make sure you:
1. Installed Tailwind: `npm install -D tailwindcss`
2. Imported `global.css` in your entry file
3. Ran the dev server: `npm run dev`

### Issue: CSS variables are undefined

**Solution:** Call `applyTokensToRoot()` in your entry file:

```typescript
import { applyTokensToRoot } from './hooks/useDesignTokens';
applyTokensToRoot();
```

### Issue: Colors look different than expected

**Solution:** Check your browser's color profile and ensure you're viewing in a dark mode environment (design is optimized for dark backgrounds).

---

## 📚 Full Documentation

For complete details, see **[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)**

---

**You're all set!** 🚀 Start building with your new design system.
