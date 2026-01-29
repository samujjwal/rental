# UI Design System

This directory contains the design system documentation and configuration for the Rental Portal application.

## Overview

The design system is built on top of Tailwind CSS with custom CSS variables for theming. It provides a consistent, accessible, and maintainable approach to styling across the application.

## Key Principles

1. **Consistency**: Use standardized components and color tokens throughout the app
2. **Accessibility**: Ensure WCAG AA compliance for all color combinations (4.5:1 contrast ratio minimum)
3. **Maintainability**: Centralized configuration makes updates easy
4. **Flexibility**: CSS variables enable easy theming including dark mode

## File Structure

```
app/
├── styles/
│   ├── design-system.md    # Detailed design system review & recommendations
│   └── README.md           # This file
├── components/
│   ├── ui/                 # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   └── index.ts
│   └── layout/             # Layout components
│       ├── PageContainer.tsx
│       ├── PageHeader.tsx
│       └── index.ts
├── lib/
│   └── utils.ts            # Utility functions including `cn()` helper
├── tailwind.css            # Global styles and CSS variables
└── tailwind.config.ts      # Tailwind configuration
```

## Quick Start

### Using UI Components

```tsx
import { Button, Badge, Card } from "~/components/ui";
import { PageContainer, PageHeader } from "~/components/layout";

export default function MyPage() {
  return (
    <PageContainer>
      <PageHeader title="Page Title" description="Page description">
        <Button>Action</Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="success">Active</Badge>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
```

### Using the `cn()` Utility

The `cn()` function merges Tailwind classes with proper precedence:

```tsx
import { cn } from "~/lib/utils";

// Conditional classes
<div className={cn("base-class", isActive && "active-class", className)}>

// Merging with overrides
<div className={cn("px-4 py-2", "px-6")}> // Results in "py-2 px-6"
```

## Color System

### Semantic Colors

| Token                   | Light Mode | Dark Mode | Usage              |
| ----------------------- | ---------- | --------- | ------------------ |
| `bg-background`         | slate-50   | slate-900 | Page background    |
| `bg-card`               | white      | slate-900 | Card backgrounds   |
| `bg-primary`            | blue-500   | blue-500  | Primary actions    |
| `bg-secondary`          | slate-100  | slate-800 | Secondary surfaces |
| `bg-destructive`        | red-500    | red-900   | Error states       |
| `text-foreground`       | slate-900  | slate-50  | Primary text       |
| `text-muted-foreground` | slate-500  | slate-400 | Secondary text     |
| `border-border`         | slate-200  | slate-800 | Borders            |

### Status Colors

| Status  | Background                    | Text                              | Usage           |
| ------- | ----------------------------- | --------------------------------- | --------------- |
| Success | `bg-success` / `bg-green-100` | `text-success` / `text-green-800` | Positive states |
| Warning | `bg-warning` / `bg-amber-100` | `text-warning` / `text-amber-800` | Caution states  |
| Error   | `bg-error` / `bg-red-100`     | `text-error` / `text-red-800`     | Error states    |
| Info    | `bg-info` / `bg-blue-100`     | `text-info` / `text-blue-800`     | Information     |

## Component Variants

### Button

```tsx
<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="link">Link</Button>
```

Sizes: `sm`, `md` (default), `lg`, `icon`

### Badge

```tsx
<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
```

### Card

```tsx
<Card variant="default">
<Card variant="bordered">  {/* With border */}
<Card variant="elevated">  {/* With shadow */}
```

## Layout Patterns

### Page Container

```tsx
<PageContainer>           {/* Default max-w-7xl */}
<PageContainer size="small">   {/* max-w-4xl */}
<PageContainer size="large">   {/* max-w-screen-2xl */}
<PageContainer size="full">    {/* No max-width */}
```

### Page Header

```tsx
<PageHeader title="Page Title" description="Optional description">
  {/* Optional action buttons */}
</PageHeader>
```

## Migration Guide

### From Hardcoded Colors

**Before:**

```tsx
<button className="bg-blue-600 text-white hover:bg-blue-700">
```

**After:**

```tsx
<Button>Click me</Button>
// or
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
```

### From Inconsistent Grays

**Before:**

```tsx
<p className="text-gray-600">
<p className="text-slate-600">
<p className="text-zinc-600">
```

**After:**

```tsx
<p className="text-muted-foreground">  {/* Secondary text */}
<p className="text-foreground">         {/* Primary text */}
```

### From Ad-hoc Layouts

**Before:**

```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
```

**After:**

```tsx
<PageContainer>
```

## Accessibility Guidelines

### Contrast Requirements

- Normal text: 4.5:1 minimum contrast ratio
- Large text (18px+): 3:1 minimum contrast ratio
- UI components: 3:1 minimum contrast ratio

### Focus States

All interactive elements should have visible focus states:

```tsx
<button className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
```

### Reduced Motion

Respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable animations */
}
```

## Best Practices

1. **Use semantic color tokens** instead of hardcoded values
2. **Use the `cn()` utility** for conditional classes
3. **Use standardized components** instead of one-off styles
4. **Test in both light and dark modes** if implementing dark mode
5. **Verify contrast ratios** when introducing new color combinations
6. **Use layout components** for consistent page structure

## Troubleshooting

### Colors not applying

Ensure CSS variables are properly set in `tailwind.css` and the element is within the `@layer base` scope.

### Class conflicts

Use the `cn()` utility to properly merge classes:

```tsx
// ❌ May have conflicts
className={`base ${className}`}

// ✅ Properly merged
className={cn("base", className)}
```

### Dark mode not working

Ensure the `dark` class is applied to a parent element (typically `<html>` or `<body>`).

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Radix UI Colors](https://www.radix-ui.com/colors) - For understanding accessible color palettes
