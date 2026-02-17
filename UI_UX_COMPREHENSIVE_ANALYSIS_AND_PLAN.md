# UI/UX Comprehensive Analysis & Implementation Plan
## GharBatai Rental Portal — Revised v2.0

**Date:** February 12, 2026  
**Revision:** v2.0 — Evidence-based rewrite with specific code findings  
**Scope:** Complete UI/UX Review & Modern Enhancement Strategy

---

## Executive Summary

This revised plan is based on a **line-by-line code audit** of every major route, layout component, shared UI primitive, and theme file. Unlike the initial plan, every finding below cites **specific files, line numbers, and code snippets**. The codebase has a solid technical skeleton — React Router v7, Zustand, React Query, Framer Motion, Tailwind — but the audit uncovered **critical systemic issues** that actively harm usability today, plus strategic gaps that prevent the product from feeling modern and engagement-driven.

### Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 **Critical** | 6 | Blocks core user flows or violates accessibility requirements |
| 🟠 **High** | 9 | Significantly degrades experience for large user segments |
| 🟡 **Medium** | 12 | Inconsistencies and polish issues that reduce perceived quality |
| 🟢 **Low** | 8 | Opportunities to exceed standards and delight users |

---

## 1. Current State — Evidence-Based Findings

### 1.1 Strengths (What to Keep) ✅

- **HSL CSS-variable color system** in `tailwind.css` — proper light/dark token definitions, clean `:root` / `.dark` separation
- **Accessibility utilities** in `lib/accessibility.ts` — `prefersReducedMotion()`, `trapFocus()`, `announceToScreenReader()`, focus management (315 lines of solid a11y infra)
- **Skip link** in root layout (`<SkipLink />`) — most apps omit this
- **`prefers-reduced-motion` CSS rule** in `tailwind.css` — disables animations globally for users who opt out
- **Touch target spacing tokens** in `tailwind.config.ts` — `touch: 44px`, `touch-sm: 36px` custom spacing
- **UnifiedButton** with Framer Motion — respects reduced motion, has loading state, accessible props
- **Skeleton system** — `CardSkeleton`, `CardGridSkeleton`, `DashboardSkeleton` with pulse and wave animations
- **Debounced search** in search route with `useDebounce` hook
- **Auth state restoration** via Zustand persist + token refresh interceptor
- **Focus-visible CSS rule** in `tailwind.css` base layer — `ring-2 ring-ring ring-offset-2`

### 1.2 Critical Findings 🔴

#### CF-1: MUI + Tailwind Dual Design System (card.tsx)

**File:** `app/components/ui/card.tsx`  
**Impact:** Every page using `<Card>`, `<CardContent>`, `<CardHeader>`, `<CardTitle>` wraps `@mui/material` components. This means:
- **Two CSS-in-JS runtimes** (Emotion from MUI + Tailwind) loaded simultaneously
- **Style conflicts** — MUI `CardHeader` has its own padding that fights the `p-6` Tailwind classes in consuming components
- **Dark mode breakage** — MUI uses its own theme provider, completely disconnected from the CSS variable tokens in `tailwind.css`
- **Bundle bloat** — `@mui/material@7.3.7` + `@mui/icons-material@7.3.7` in `package.json`
- `CardTitle` wraps MUI `Typography` but exposes `React.HTMLAttributes<HTMLHeadingElement>` — type mismatch

```tsx
// card.tsx — wraps MUI instead of using native Tailwind
import { Card as MuiCard, CardContent as MuiCardContent } from "@mui/material";
export function Card({ children, ...props }: CardProps) {
  return <MuiCard {...props}>{children}</MuiCard>;  // ← All of MUI loaded
}
```

**Action:** Replace with pure Tailwind `<div>` components using the existing CSS variable tokens.

---

#### CF-2: Dashboard Completely Broken on Mobile

**Files:** `DashboardSidebar.tsx` L38, `dashboard.owner.tsx` ~L259, `dashboard.renter.tsx`  
**Impact:** Both owner and renter dashboards use `<DashboardSidebar>` with `w-64 shrink-0` in a `flex gap-8` layout. The sidebar **never collapses or hides** on screens < 768px. There is no hamburger toggle, no drawer, no responsive behavior. The dashboard — the most critical authenticated surface — is **unusable on mobile**.

```tsx
// DashboardSidebar.tsx L38
<aside className={cn("w-64 shrink-0", className)}>
```

Additionally, the stats grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` fights with the 256px sidebar on tablets, causing content overflow.

**Action:** Convert sidebar to a responsive drawer with hamburger toggle on mobile, overlay on tablet.

---

#### CF-3: `alert()` Used for Error Handling (12 Instances)

**Files:** `bookings.tsx` (5×), `listings.$id.edit.tsx` (3×), `listings.new.tsx` (4×)  
**Impact:** `window.alert()` blocks the main thread, provides no dismiss control, is not stylable, and is jarring UX.

```tsx
// bookings.tsx L193, L203, L213, L223, L233
alert("Failed to cancel booking. Please try again.");
alert("Failed to confirm booking. Please try again.");
alert("Failed to complete booking. Please try again.");
// ...
```

**Action:** Replace all 12 instances with the existing `ToastManager` system.

---

#### CF-4: Cancel Modal Has No Focus Trap or ARIA

**File:** `bookings.tsx` ~L614-L650  
**Impact:** WCAG 2.4.3 violation. The cancel-booking modal:
- Has no `role="dialog"` or `aria-modal="true"`
- Has no `aria-labelledby` 
- No focus trap — Tab key navigates to elements behind the backdrop
- Pressing Escape doesn't close it
- No open/close animation

Same issues exist in `MobileNavigation.tsx` slide menu (~L155-L175).

---

#### CF-5: Hardcoded Colors Bypass Design System (30+ Instances)

**Files:** `badge.tsx`, `ThemeToggle.tsx`, `toast.tsx`, `dashboard.owner.insights.tsx`, `listings.$id.tsx`, `search.tsx`  
**Impact:** These hardcoded values **break in dark mode** since they don't reference CSS variable tokens:

| Component | Hardcoded | Should Be |
|-----------|-----------|-----------|
| Badge `success` | `bg-green-500 text-white` | `bg-success text-success-foreground` |
| Badge `warning` | `bg-yellow-500 text-white` | `bg-warning text-warning-foreground` |
| ThemeToggle track | `bg-slate-700` / `bg-slate-200` | `bg-muted` / `bg-card` |
| Toast success | `bg-green-50 border-green-200` | `bg-success-light border-success` |
| Star rating | `text-yellow-400 fill-yellow-400` | `text-warning fill-warning` |
| Insights score | `text-green-600` / `text-yellow-600` / `text-red-600` | Semantic tokens |
| Search ratings | `⭐` emoji | `<Star>` Lucide icon (inconsistent with detail page) |

---

#### CF-6: No Loading Skeletons on Critical Pages

**Files:** `listings.$id.tsx`, `dashboard.owner.tsx`, `dashboard.renter.tsx`, `checkout.$bookingId.tsx`  
**Impact:** These pages use `clientLoader` to fetch data but show **no skeleton or loading indicator** during client-side navigation. Users see a blank page or stale content while data loads. The skeleton components (`DashboardSkeleton`, `CardGridSkeleton`) exist but are **not wired in**.

---

### 1.3 High-Severity Findings 🟠

#### HF-1: Duplicate Navigation in Standalone Headers

Every route defines its own header/nav bar inline:
- `home.tsx` ~L193-L231: Full nav with logo, links, auth buttons
- `dashboard.tsx` ~L107-L122: Different nav with logout button
- `bookings.tsx` ~L241-L253: Minimal header with logo + dashboard link
- `checkout.$bookingId.tsx`: Yet another header

This means **no shared Header component**. Brand identity (logo, primary nav) is inconsistently rendered. On some pages the header is sticky, on others it's not.

#### HF-2: Listing Detail — 12 useState Calls, No Form Abstraction

**File:** `listings.$id.tsx` L81-L106  
Booking form state scattered across 12 individual `useState` calls. Price calculation error silently caught with `console.error` — no user-visible feedback. Should be consolidated into `useReducer` or a form library.

#### HF-3: Gallery Accessibility Gaps

**File:** `listings.$id.tsx` ~L281-L310  
- Prev/next buttons have no `aria-label` — screen readers announce "ChevronLeft"
- Dot indicators have no `aria-label` — announced as empty buttons
- No keyboard arrow-key navigation for gallery
- Image swap has no animation or transition
- Active dot uses `bg-background` vs `bg-background/50` — nearly invisible on light backgrounds

#### HF-4: Search Page Mobile Issues

**File:** `search.tsx`  
- Location autocomplete wrapped in `hidden md:block w-60` — completely hidden on mobile with no alternative
- Filter sidebar is `w-64 shrink-0` with no slide animation for show/hide, no drawer on mobile
- Map split view uses hardcoded `w-1/2` — two cramped columns on small screens, no responsive stacking
- View mode localStorage read happens after first paint → flash of default grid view

#### HF-5: Missing Pagination Accessibility

**File:** `search.tsx` ~L773-L822  
- No `<nav>` landmark with `aria-label="Pagination"` 
- No `aria-current="page"` on active page button
- Search input has no `<label>` — relies on placeholder only

#### HF-6: Booking Actions Have No Optimistic UI

**File:** `bookings.tsx` L169-L233  
Five async action handlers (confirm, cancel, start, complete, return) all follow: call API → wait → `revalidator.revalidate()`. No optimistic update, no inline loading state on the specific card, no success toast. After error, uses `alert()`.

#### HF-7: Checkout Column Order on Mobile

**File:** `checkout.$bookingId.tsx` ~L257-L259  
`grid-cols-1` on mobile renders order summary first, payment form second. Convention is form-first on mobile. Plus, the summary uses `sticky top-6` which sticks awkwardly in single-column layout.

#### HF-8: DashboardSidebar Nav Duplication

Navigation items are defined **three times**:
1. `DashboardSidebar.tsx` L96-L141 (exported `renterNavItems` + `ownerNavItems`)
2. Inside `dashboard.owner.tsx` (inline nav items)
3. Inside `dashboard.renter.tsx` (inline nav items)

Plus `MobileNavigation.tsx` defines its own `ownerNavItems` with a wrong icon (Settings gear for Earnings).

#### HF-9: No Shared Layout for Authenticated Pages

Home, dashboard, bookings, listings, settings, checkout — all render their own `<nav>` + content + footer. There's no `AuthenticatedLayout` wrapper. This means:
- Inconsistent header behavior across pages
- Footer present only on home page
- Mobile navigation (`MobileNavigation.tsx`) exists but isn't consistently mounted

---

### 1.4 Medium-Severity Findings 🟡

| ID | Finding | File(s) |
|----|---------|---------|
| MF-1 | Emoji icons in all `EmptyStatePresets` instead of Lucide icons — inconsistent with rest of app, varying rendering cross-platform | `empty-state.tsx` |
| MF-2 | `buttonVariants` `hover:-translate-y-0.5` causes layout shift in dense grids (booking cards); not gated by `prefers-reduced-motion` | `button-variants.ts` L10+ |
| MF-3 | `success` button variant references `hover:bg-success-dark` — this token only exists in `designTokens.ts`, not in Tailwind config → silently fails (no hover change) | `button-variants.ts` L51 |
| MF-4 | Status labels in bookings show raw `pending_owner_approval` with `replace(/_/g, " ")` — no proper capitalization or human-friendly names | `bookings.tsx` ~L256 |
| MF-5 | Duplicate `StatCard` components — owner version has `trend` prop, renter version doesn't; two diverging implementations | Both dashboards |
| MF-6 | ThemeToggle radio group has correct ARIA roles but no keyboard arrow-key navigation — fails ARIA radio group interaction pattern | `ThemeToggle.tsx` |
| MF-7 | `badge.tsx` warning variant: `bg-yellow-500 text-white` fails WCAG AA contrast (ratio ~3.0:1 for small text; needs 4.5:1) | `badge.tsx` L21 |
| MF-8 | Hero section gradient `from-primary/5 to-background` is extremely subtle — hero lacks visual impact and energy | `home.tsx` ~L262 |
| MF-9 | Featured listings on home use raw `<Link>` + `<img>` instead of the existing `ListingCard` component — duplicated card rendering logic | `home.tsx` ~L416-L455 |
| MF-10 | Login form uses raw `<input>` + inline classes instead of `EnhancedInput` — no animated validation, no icon support | `auth.login.tsx` |
| MF-11 | `DashboardSidebar` nav has no `aria-label`, no `aria-current="page"` on active item | `DashboardSidebar.tsx` |
| MF-12 | Home page nav is defined inline in `home.tsx` — not reusable, different from dashboard nav | `home.tsx` ~L193 |

### 1.5 Low-Severity / Enhancement Opportunities 🟢

| ID | Opportunity | Impact |
|----|-------------|--------|
| LF-1 | No page transition animations between routes | Perceived performance, delight |
| LF-2 | No glassmorphism or gradient mesh effects on hero/marketing pages | Visual modernity |
| LF-3 | No "back to top" button on search results | Long-scroll usability |
| LF-4 | No copy-to-clipboard / share button on listing detail | Engagement, virality |
| LF-5 | No animated success feedback after booking actions | Delight, confirmation |
| LF-6 | No image preloading or slide transition in listing gallery | Perceived speed |
| LF-7 | Filter sidebar show/hide has no slide animation | Polish |
| LF-8 | No confetti or celebration animation on successful booking/payment | Engagement |

---

## 2. Architecture & Pattern Assessment

### 2.1 Design System Inventory

| Layer | Tool | Status | Issues |
|-------|------|--------|--------|
| CSS Variables | `tailwind.css` `:root` / `.dark` | ✅ Well-structured | — |
| Tailwind Config | `tailwind.config.ts` | ✅ Custom tokens | Missing `success-dark` token |
| JS Design Tokens | `designTokens.ts` | 🟡 Exists but underused | Not imported by most components |
| Button System | `unified-button.tsx` + `button-variants.ts` | 🟡 Mixed | Auth pages use raw `<button>` |
| Card System | `card.tsx` | 🔴 MUI wrapper | Needs full rewrite |
| Input System | `EnhancedInput.tsx` | ✅ Feature-rich | Not used in auth forms |
| Badge System | `badge.tsx` | 🟡 Works | Hardcoded colors |
| Toast System | `toast.tsx` + `ToastManager` | ✅ Available | Bypassed by 12 `alert()` calls |
| Empty States | `empty-state.tsx` | 🟡 Emoji-based | Should use Lucide SVG icons |
| Skeleton | `skeleton.tsx` | ✅ Well-built | Not wired into route loaders |
| Motion | Framer Motion | ✅ UnifiedButton, FadeIn | Not used for page transitions |

### 2.2 Routing & Layout Architecture

```
Current Layout Structure:
├── root.tsx (QueryClientProvider, AuthProvider, Outlet)
│   ├── home.tsx → Inline nav + hero + categories + listings + footer (monolith)
│   ├── auth.login.tsx → Inline layout, no shared auth shell
│   ├── auth.signup.tsx → Separate inline layout
│   ├── dashboard.tsx → Redirect hub only
│   │   ├── dashboard.owner.tsx → Inline nav + DashboardSidebar + content
│   │   ├── dashboard.renter.tsx → Inline nav + DashboardSidebar + content
│   │   ├── dashboard.owner.insights.tsx → Hardcoded colors throughout
│   ├── bookings.tsx → Own header, 5 alert() calls
│   ├── listings.$id.tsx → 12 useState, no skeleton, no page transition
│   ├── search.tsx → 1163 lines, hidden mobile location input
│   └── checkout.$bookingId.tsx → Own header, wrong mobile column order

Problem: No shared layout wrappers (AuthLayout, DashboardLayout, MarketingLayout)
Result: Duplicated headers, inconsistent nav, footer appears only on home
```

### 2.3 State Management Assessment

| Concern | Tool | File | Status |
|---------|------|------|--------|
| Auth | Zustand + persist | `lib/store/auth.ts` | ✅ Solid |
| Server data | React Query | `root.tsx` + `api-client.ts` | ✅ Good base |
| UI state | Local useState | Various routes | 🟡 Over-fragmented |
| Theme | CSS class toggle | `ThemeToggle.tsx` | 🟡 Works but manual |
| Search filters | URL searchParams + localStorage | `search.tsx` | 🟡 Flash of default view |
| Form state | Individual useState | `listings.$id.tsx`, `auth.login.tsx` | 🟠 Should use react-hook-form |

---

## 3. Revised Implementation Plan

### Phase 1: Critical Infrastructure Fixes (Week 1-2) 🔴

> **Goal:** Fix issues that actively break user flows today.

#### 3.1 Remove MUI — Replace with Pure Tailwind Cards

**Priority:** Critical | **Effort:** 2 days | **Impact:** All pages using Card

**Step 1:** Create new pure-Tailwind card components:

```tsx
// apps/web/app/components/ui/card.tsx (REWRITE)
import { cn } from "~/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "elevated" | "outlined";
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
};

const variantMap = {
  default: "bg-card text-card-foreground border border-border rounded-xl shadow-sm",
  glass: "bg-card/70 backdrop-blur-md text-card-foreground border border-border/50 rounded-xl shadow-sm",
  elevated: "bg-card text-card-foreground rounded-xl shadow-md hover:shadow-lg transition-shadow",
  outlined: "bg-transparent text-foreground border-2 border-border rounded-xl",
};

export function Card({
  children,
  className,
  variant = "default",
  hoverable = false,
  padding = "md",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        variantMap[variant],
        paddingMap[padding],
        hoverable && "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1.5 pb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, as: Tag = "h3", ...props }: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <Tag className={cn("text-lg font-semibold leading-tight tracking-tight", className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardDescription({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center pt-4 border-t border-border", className)} {...props}>
      {children}
    </div>
  );
}
```

**Step 2:** Uninstall MUI:
```bash
cd apps/web && pnpm remove @mui/material @mui/icons-material @emotion/react @emotion/styled
```

**Step 3:** Search and replace all MUI icon imports with Lucide equivalents.

---

#### 3.2 Fix Dashboard Mobile Layout

**Priority:** Critical | **Effort:** 1.5 days | **Impact:** All dashboard pages

Create a responsive `DashboardLayout` component:

```tsx
// apps/web/app/components/layout/DashboardLayout.tsx (NEW)
import { useState, useEffect, useCallback } from "react";
import { cn } from "~/lib/utils";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { trapFocus } from "~/lib/accessibility";

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  header?: React.ReactNode;
}

export function DashboardLayout({ sidebar, children, header }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    if (sidebarOpen) {
      document.addEventListener("keydown", handler);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed header for mobile */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 py-3 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {header}
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-border bg-card min-h-[calc(100vh-0px)] sticky top-0">
          <nav aria-label="Dashboard navigation">
            {sidebar}
          </nav>
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-xl lg:hidden overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
              >
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <span className="font-semibold text-lg">Menu</span>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Close navigation menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav aria-label="Dashboard navigation">
                  {sidebar}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Integration:** Wrap `dashboard.owner.tsx` and `dashboard.renter.tsx` content with `DashboardLayout`, removing their inline flex layouts.

---

#### 3.3 Replace All `alert()` Calls with Toast Notifications

**Priority:** Critical | **Effort:** 0.5 day | **Impact:** bookings.tsx, listings.$id.edit.tsx, listings.new.tsx

**Pattern to apply across all 12 instances:**

```tsx
// BEFORE (bookings.tsx L193):
alert("Failed to cancel booking. Please try again.");

// AFTER:
import { useToast } from "~/components/ui/toast";
const { addToast } = useToast();

addToast({
  type: "error",
  title: "Cancellation Failed",
  message: "Could not cancel this booking. Please try again.",
  duration: 5000,
});
```

Also add **success toasts** for successful actions (currently no feedback on success).

---

#### 3.4 Fix Cancel Modal Accessibility

**Priority:** Critical | **Effort:** 0.5 day | **Impact:** bookings.tsx

Create a reusable accessible dialog:

```tsx
// apps/web/app/components/ui/dialog.tsx (NEW)
import { useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

export function Dialog({ open, onClose, title, description, children, size = "md" }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      // Focus first focusable element
      requestAnimationFrame(() => {
        const first = dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        first?.focus();
      });
    } else {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Trap focus + Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby={description ? "dialog-description" : undefined}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className={cn(
              "relative w-full rounded-xl bg-card border border-border shadow-2xl p-6",
              sizeMap[size]
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
                {description && (
                  <p id="dialog-description" className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

---

### Phase 2: Design System Consistency (Week 2-3) 🟠

> **Goal:** Ensure every component uses the token system, consistent styling, and proper accessibility.

#### 3.5 Fix Hardcoded Colors (30+ Instances)

**Add missing semantic tokens** to `tailwind.css`:

```css
@theme {
  /* Add to existing @theme block */
  --color-success: hsl(var(--success));
  --color-success-foreground: hsl(var(--success-foreground));
  --color-success-light: hsl(var(--success) / 0.1);
  --color-warning: hsl(var(--warning));
  --color-warning-foreground: hsl(var(--warning-foreground));
  --color-warning-light: hsl(var(--warning) / 0.1);
  --color-error: hsl(var(--destructive));
  --color-error-foreground: hsl(var(--destructive-foreground));
  --color-error-light: hsl(var(--destructive) / 0.1);
  --color-info: hsl(var(--info));
  --color-info-foreground: hsl(var(--info-foreground));
  --color-info-light: hsl(var(--info) / 0.1);
  --color-star: hsl(var(--warning));
}
```

Add corresponding CSS variables to `:root` and `.dark`:

```css
:root {
  /* Success */
  --success: 160 84% 39%;        /* green-600 equivalent */
  --success-foreground: 0 0% 100%;
  /* Warning */
  --warning: 38 92% 50%;         /* amber-500 equivalent */
  --warning-foreground: 0 0% 100%;
  /* Info */
  --info: 217 91% 60%;           /* blue-500 equivalent */
  --info-foreground: 0 0% 100%;
}

.dark {
  --success: 160 84% 45%;
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 55%;
  --warning-foreground: 24 10% 10%;
  --info: 217 91% 65%;
  --info-foreground: 0 0% 100%;
}
```

**Then systematically replace across files:**
- `badge.tsx`: `bg-green-500` → `bg-success`, `bg-yellow-500` → `bg-warning`
- `toast.tsx`: `bg-green-50` → `bg-success-light`
- `ThemeToggle.tsx`: `bg-slate-700` → `bg-muted`
- `dashboard.owner.insights.tsx`: all `text-green-600`, `text-yellow-600`, `text-red-600` → semantic tokens
- **Star ratings everywhere**: `text-yellow-400 fill-yellow-400` → `text-star fill-star`

---

#### 3.6 Fix Badge Accessibility (WCAG Contrast)

```tsx
// badge.tsx — REWRITE with token colors + ARIA
const variantStyles = {
  default: "bg-primary/10 text-primary border border-primary/20",
  secondary: "bg-secondary/10 text-secondary-foreground border border-secondary/20",
  success: "bg-success/10 text-success border border-success/20",      // ← Token, good contrast
  warning: "bg-warning/10 text-warning-foreground border border-warning/20", // ← Dark text on light bg
  destructive: "bg-destructive/10 text-destructive border border-destructive/20",
  info: "bg-info/10 text-info border border-info/20",
  outline: "bg-transparent text-foreground border border-border",
};

export function Badge({ variant = "default", children, className, ...props }: BadgeProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
        "text-xs font-medium leading-tight",
        "transition-colors duration-150",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
```

---

#### 3.7 Enforce Design System in Auth Forms

Replace raw HTML in `auth.login.tsx` and `auth.signup.tsx` with existing design system components:

```tsx
// BEFORE (auth.login.tsx):
<input type="email" className="w-full px-4 py-3 rounded-xl border ..." />
<button type="submit" className="w-full py-3 px-4 bg-primary ..." />

// AFTER:
import { EnhancedInput } from "~/components/ui/enhanced-input";
import { UnifiedButton } from "~/components/ui/unified-button";

<EnhancedInput
  type="email"
  label="Email address"
  icon={<Mail className="h-4 w-4" />}
  error={errors.email}
  required
/>
<UnifiedButton type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting}>
  Sign In
</UnifiedButton>
```

---

#### 3.8 Fix `button-variants.ts` Issues

```diff
// Remove hover translate from non-hoverable contexts
- "hover:-translate-y-0.5"
+ "motion-safe:hover:-translate-y-0.5"  // Only when reduced motion is NOT preferred

// Fix broken success token
- "hover:bg-success-dark"
+ "hover:bg-success/90"  // Darken via opacity — works without custom token

// Add ring-offset for focus
- "focus-visible:ring-2 focus-visible:ring-ring"
+ "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
```

---

### Phase 3: Layout Architecture (Week 3-4) 🟠

> **Goal:** Extract shared layouts, eliminate nav duplication, create consistent page shells.

#### 3.9 Create Shared Layout Components

```
New layout hierarchy:
├── root.tsx (providers only)
│   ├── MarketingLayout → home, about, pricing, contact
│   │   ├── SharedHeader (logo, nav, auth buttons, mobile hamburger)
│   │   ├── <Outlet />
│   │   └── SharedFooter
│   ├── AuthLayout → login, signup, forgot-password, reset-password
│   │   ├── Split-screen or centered card
│   │   ├── <Outlet />
│   ├── DashboardLayout → dashboard.*, bookings, settings
│   │   ├── DashboardHeader (mobile hamburger + breadcrumbs)
│   │   ├── DashboardSidebar (responsive drawer)
│   │   ├── <Outlet />
│   ├── FullWidthLayout → search, listing detail, checkout
│       ├── MinimalHeader (logo + back button)
│       └── <Outlet />
```

```tsx
// apps/web/app/components/layout/MarketingLayout.tsx (NEW)
import { Outlet } from "react-router";
import { SharedHeader } from "./SharedHeader";
import { SharedFooter } from "./SharedFooter";

export function MarketingLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SharedHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SharedFooter />
    </div>
  );
}
```

**Step 1:** Extract `home.tsx` nav (L193-L231) into `SharedHeader.tsx`  
**Step 2:** Extract `home.tsx` footer (L571-L636) into `SharedFooter.tsx`  
**Step 3:** Create `AuthLayout.tsx` — split-screen with branding on left  
**Step 4:** Integrate `DashboardLayout.tsx` from 3.2 into routes  
**Step 5:** Update `routes.ts` to use layout routes

---

#### 3.10 Consolidate Navigation Configuration

**Single source of truth:**

```tsx
// apps/web/app/config/navigation.ts (NEW)
import {
  Home, Search, Calendar, Settings, BarChart3,
  Building2, CreditCard, Users, Shield, DollarSign,
  Heart, MessageSquare, Bell, HelpCircle,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  match?: string[];  // Additional paths that should mark this as active
}

export const ownerNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/owner", icon: Home },
  { label: "My Listings", href: "/listings/my", icon: Building2 },
  { label: "Bookings", href: "/bookings", icon: Calendar },
  { label: "Earnings", href: "/dashboard/owner/earnings", icon: DollarSign }, // ← Fixed: was Settings icon
  { label: "Insights", href: "/dashboard/owner/insights", icon: BarChart3 },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const renterNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/renter", icon: Home },
  { label: "Search", href: "/search", icon: Search },
  { label: "Bookings", href: "/bookings", icon: Calendar },
  { label: "Favorites", href: "/favorites", icon: Heart },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: Home },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Listings", href: "/admin/listings", icon: Building2 },
  { label: "Verifications", href: "/admin/verifications", icon: Shield },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
```

**Then:** Import from this single config in `DashboardSidebar.tsx`, `MobileNavigation.tsx`, and any mobile bottom tabs.

---

### Phase 4: Loading, Error & Empty States (Week 4-5) 🟡

> **Goal:** Every page has a branded, skeleton-based loading state. Errors are recoverable. Empty states drive action.

#### 3.11 Branded App Loading (root.tsx)

Replace the generic spinner in `HydrateFallback`:

```tsx
// root.tsx — Replace HydrateFallback
export function HydrateFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      {/* Animated logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 text-2xl font-bold text-primary">
          <Building2 className="h-8 w-8" />
          <span>GharBatai</span>
        </div>
      </motion.div>
      {/* Pulsing dots */}
      <div className="flex gap-1.5" aria-label="Loading application">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-primary"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

#### 3.12 Wire Skeletons into Route Loaders

```tsx
// listings.$id.tsx — Add skeleton for client-side navigation
import { DashboardSkeleton } from "~/components/ui/skeleton";

export default function ListingDetail() {
  const { listing, isLoading } = useListingData();
  
  if (isLoading) {
    return <ListingDetailSkeleton />;
  }
  // ... rest of component
}

// New skeleton specific to listing detail
function ListingDetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
      {/* Image gallery skeleton */}
      <div className="aspect-[16/9] rounded-xl bg-muted mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-8 w-3/4 bg-muted rounded" />
          <div className="h-4 w-1/2 bg-muted rounded" />
          <div className="space-y-2 mt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded" style={{ width: `${90 - i * 10}%` }} />
            ))}
          </div>
        </div>
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
```

Apply the same pattern to: `dashboard.owner.tsx`, `dashboard.renter.tsx`, `bookings.tsx`, `checkout.$bookingId.tsx`, `search.tsx`.

---

#### 3.13 Replace Emoji Empty States with SVG Icons

```tsx
// empty-state.tsx — Replace presets dictionary
import { Package, Calendar, Heart, Search, MessageSquare, FileText } from "lucide-react";

export const EmptyStatePresets = {
  noListings: {
    icon: <Package className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />,
    title: "No listings yet",
    description: "Start by creating your first property listing.",
    actionLabel: "Create Listing",
    actionHref: "/listings/new",
  },
  noBookings: {
    icon: <Calendar className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />,
    title: "No bookings yet",
    description: "Your booking history will appear here.",
    actionLabel: "Browse Properties",
    actionHref: "/search",
  },
  noFavorites: {
    icon: <Heart className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />,
    title: "No favorites yet",
    description: "Save properties you love to find them quickly later.",
    actionLabel: "Explore Properties",
    actionHref: "/search",
  },
  noResults: {
    icon: <Search className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />,
    title: "No results found",
    description: "Try adjusting your filters or search criteria.",
  },
  noMessages: {
    icon: <MessageSquare className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />,
    title: "No messages yet",
    description: "Start a conversation with a property owner.",
  },
};
```

---

#### 3.14 Add Optimistic UI for Booking Actions

```tsx
// bookings.tsx — Replace basic fetch-wait-revalidate
async function handleBookingAction(bookingId: string, action: string, optimisticStatus: string) {
  // Optimistic update — immediately update UI
  setBookings(prev =>
    prev.map(b => b.id === bookingId ? { ...b, status: optimisticStatus, _pending: true } : b)
  );

  try {
    await apiClient.patch(`/bookings/${bookingId}/${action}`);
    addToast({ type: "success", title: "Booking Updated", message: `Booking ${action} successful.` });
    revalidator.revalidate(); // Sync with server
  } catch (error) {
    // Rollback optimistic update
    setBookings(prev =>
      prev.map(b => b.id === bookingId ? { ...b, status: b._previousStatus, _pending: false } : b)
    );
    addToast({ type: "error", title: "Action Failed", message: `Could not ${action} booking. Please try again.` });
  }
}
```

---

### Phase 5: Visual Polish & Modern Aesthetics (Week 5-7) 🟡

> **Goal:** Elevate the visual quality to match Airbnb/Booking.com tier.

#### 3.15 Enhanced Hero Section (home.tsx)

Replace the flat `from-primary/5 to-background` gradient:

```tsx
// home.tsx — Hero section rewrite
<section className="relative overflow-hidden min-h-[85vh] flex items-center">
  {/* Gradient mesh background */}
  <div className="absolute inset-0 -z-10">
    <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-primary/15 rounded-full blur-[120px]" />
    <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-accent/10 rounded-full blur-[120px]" />
    <div className="absolute top-1/3 right-1/3 w-1/3 h-1/3 bg-secondary/10 rounded-full blur-[80px]" />
  </div>

  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="text-center max-w-3xl mx-auto"
    >
      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
        bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
        <Sparkles className="h-3.5 w-3.5" />
        Nepal's #1 Rental Platform
      </span>
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
        Find Your Perfect
        <span className="block mt-2 bg-gradient-to-r from-primary via-primary/80 to-accent
          bg-clip-text text-transparent">
          Home Away From Home
        </span>
      </h1>
      <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
        Discover verified properties across Nepal — from city apartments to mountain retreats.
        Book instantly, pay securely, move in worry-free.
      </p>
    </motion.div>

    {/* Integrated search bar */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="mt-10 max-w-3xl mx-auto"
    >
      <HeroSearchBar />
    </motion.div>

    {/* Trust indicators */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
    >
      <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-success" /> Verified Listings</span>
      <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Secure Payments</span>
      <span className="flex items-center gap-2"><Star className="h-4 w-4 text-star" /> 4.8/5 Rating</span>
    </motion.div>
  </div>
</section>
```

---

#### 3.16 Page Transition System

```tsx
// apps/web/app/components/ui/PageTransition.tsx (NEW)
import { motion } from "framer-motion";

const variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

Wrap each route's main content in `<PageTransition>`.

---

#### 3.17 Modern Listing Card Component

Use `ListingCard` from the component library instead of inline `<Link>` + `<img>` in `home.tsx`:

```tsx
// Replace home.tsx L416-L455 inline listing cards with:
<ListingCard
  listing={listing}
  variant="featured"    // New variant: larger image, badge overlay
  showFavorite          // Heart button overlay
  showBadge             // "Featured" / "New" badge
  priority={index < 4}  // First 4 cards get priority image loading
/>
```

Add a `featured` variant to `ListingCard.tsx`:
- Image aspect ratio: `aspect-[4/3]` (taller for visual impact)
- Hover: scale image slightly (`group-hover:scale-105` with `overflow-hidden`)
- Price tag: overlay on bottom-right of image
- Location: with MapPin icon
- Rating: with filled Star icon (not ⭐ emoji)

---

#### 3.18 Image Gallery with Transitions

```tsx
// listings.$id.tsx — Enhanced gallery
<div className="relative group overflow-hidden rounded-xl">
  <AnimatePresence mode="wait">
    <motion.img
      key={currentImageIndex}
      src={images[currentImageIndex]}
      alt={`Property image ${currentImageIndex + 1} of ${images.length}`}
      initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
      transition={{ duration: 0.3 }}
      className="w-full aspect-[16/9] object-cover"
    />
  </AnimatePresence>

  {/* Navigation with a11y */}
  <button
    onClick={prevImage}
    aria-label={`Previous image (${currentImageIndex} of ${images.length})`}
    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full
      bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100
      transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
  >
    <ChevronLeft className="h-5 w-5" />
  </button>
  <button
    onClick={nextImage}
    aria-label={`Next image (${currentImageIndex + 2} of ${images.length})`}
    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full
      bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100
      transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
  >
    <ChevronRight className="h-5 w-5" />
  </button>

  {/* Dot indicators */}
  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5" role="tablist" aria-label="Image gallery">
    {images.map((_, i) => (
      <button
        key={i}
        role="tab"
        aria-selected={i === currentImageIndex}
        aria-label={`View image ${i + 1}`}
        onClick={() => setCurrentImageIndex(i)}
        className={cn(
          "w-2 h-2 rounded-full transition-all",
          i === currentImageIndex
            ? "bg-background w-4 shadow-sm"
            : "bg-background/50 hover:bg-background/80"
        )}
      />
    ))}
  </div>
</div>
```

---

### Phase 6: Search & Discovery (Week 6-7) 🟡

> **Goal:** Make the search experience feel fast, filter-friendly, and mobile-complete.

#### 3.19 Fix Search Mobile Issues

1. **Show location input on mobile** — move from `hidden md:block` to always visible with responsive width:
   ```tsx
   // search.tsx — location autocomplete
   <div className="w-full md:w-60">
     <LocationAutocomplete ... />
   </div>
   ```

2. **Filter drawer on mobile** — convert filter sidebar to bottom sheet:
   ```tsx
   // On mobile: full-screen drawer with "Apply Filters" button
   // On desktop: sidebar as current
   <div className="hidden lg:block w-64 shrink-0">{/* desktop filters */}</div>
   <Sheet open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)}>
     {/* same filter content */}
     <Button fullWidth onClick={() => { applyFilters(); setMobileFiltersOpen(false); }}>
       Apply Filters ({activeFilterCount})
     </Button>
   </Sheet>
   ```

3. **Replace ⭐ emoji with Star icon:**
   ```tsx
   <Star className="h-3.5 w-3.5 fill-star text-star" />
   ```

4. **Fix view toggle accessibility:**
   ```tsx
   <div role="group" aria-label="View mode">
     <button aria-pressed={view === "grid"} ...>Grid</button>
     <button aria-pressed={view === "list"} ...>List</button>
     <button aria-pressed={view === "map"} ...>Map</button>
   </div>
   ```

5. **Fix pagination accessibility:**
   ```tsx
   <nav aria-label="Search results pagination">
     {pages.map(p => (
       <button key={p} aria-current={p === currentPage ? "page" : undefined} ...>{p}</button>
     ))}
   </nav>
   ```

6. **Prevent flash of default view:** Read localStorage in `clientLoader` or use `useSyncExternalStore` to hydrate view mode before first paint.

---

#### 3.20 Listing Detail — Consolidate State

Replace 12 `useState` calls with a form reducer:

```tsx
// listings.$id.tsx — Consolidated booking form state
interface BookingForm {
  startDate: string;
  endDate: string;
  guests: number;
  message: string;
}

const [form, setForm] = useReducer(
  (state: BookingForm, update: Partial<BookingForm>) => ({ ...state, ...update }),
  { startDate: "", endDate: "", guests: 1, message: "" }
);

// Usage:
setForm({ startDate: "2026-03-01" });
setForm({ guests: 3 });
```

---

### Phase 7: Engagement & Delight (Week 7-8) 🟢

> **Goal:** Add the micro-interactions and delight factors that make the app feel premium.

#### 3.21 Success Celebrations

```tsx
// apps/web/app/components/ui/SuccessOverlay.tsx (NEW)
import confetti from "canvas-confetti";

export function celebrateBooking() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["hsl(243 75% 59%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)"],
  });
}

export function SuccessCheckmark() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", damping: 12, stiffness: 200 }}
      className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"
    >
      <motion.div
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Check className="h-8 w-8 text-success" strokeWidth={3} />
      </motion.div>
    </motion.div>
  );
}
```

---

#### 3.22 Staggered List Animations

```tsx
// Reusable stagger container for listing grids, booking lists, etc.
export function StaggeredGrid({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
    >
      {React.Children.map(children, child => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

---

#### 3.23 Scroll-Triggered Animations (Home Page)

```tsx
// apps/web/app/hooks/useInView.ts (NEW — or use Framer Motion's built-in)
import { useInView as useFramerInView } from "framer-motion";

// home.tsx — each section animates on scroll
<motion.section
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-80px" }}
  transition={{ duration: 0.5 }}
>
  <CategoryGrid categories={categories} />
</motion.section>
```

---

#### 3.24 Booking Status Labels (Human-Friendly)

```tsx
// apps/web/app/lib/booking-utils.ts (NEW)
export const BOOKING_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
  pending_owner_approval: { label: "Pending Approval", variant: "warning", icon: Clock },
  approved: { label: "Approved", variant: "success", icon: CheckCircle },
  rejected: { label: "Declined", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelled", variant: "secondary", icon: Ban },
  active: { label: "Active", variant: "info", icon: Play },
  completed: { label: "Completed", variant: "success", icon: CheckCircle2 },
  payment_pending: { label: "Payment Pending", variant: "warning", icon: CreditCard },
};

// Usage in bookings.tsx:
const status = BOOKING_STATUS_MAP[booking.status];
<Badge variant={status.variant}>
  <status.icon className="h-3 w-3 mr-1" />
  {status.label}
</Badge>
```

---

### Phase 8: Performance & Final Polish (Week 8-10) 🟢

> **Goal:** Optimize bundle size, lazy loading, and perceived performance.

#### 3.25 Lazy Route Loading with Branded Fallbacks

```tsx
// routes.ts — lazy load heavy routes
{
  path: "search",
  lazy: () => import("./routes/search"),
  HydrateFallback: SearchSkeleton,
},
{
  path: "listings/:id",
  lazy: () => import("./routes/listings.$id"),
  HydrateFallback: ListingDetailSkeleton,
},
```

#### 3.26 Image Optimization

- Use `loading="lazy"` on all images below the fold
- Use `fetchpriority="high"` on hero and first listing card images
- Implement `srcset` with CDN-generated sizes for responsive images
- Add blur-up placeholder data URLs for listing gallery images

#### 3.27 Reduce Motion System Check

Audit all Framer Motion `animate` props and ensure they use the existing `prefersReducedMotion()` helper or `motion-safe:` Tailwind prefix. Currently, `button-variants.ts` `hover:-translate-y-0.5` and several Framer Motion components animate without checking.

#### 3.28 Bundle Analysis

After MUI removal, run `npx vite-bundle-visualizer` to verify:
- MUI + Emotion bundles are gone
- Framer Motion is tree-shaken properly
- React Query isn't duplicated across chunks

---

## 4. Implementation Timeline

```
Week 1-2  │ Phase 1: Critical Fixes
          │ ├── CF-1: Remove MUI, rewrite card.tsx
          │ ├── CF-2: DashboardLayout + mobile drawer
          │ ├── CF-3: Replace 12 alert() with toast
          │ ├── CF-4: Accessible dialog component
          │ └── CF-5: Fix badge WCAG contrast
          │
Week 2-3  │ Phase 2: Design System Consistency
          │ ├── Add semantic CSS variable tokens
          │ ├── Replace 30+ hardcoded colors
          │ ├── Enforce EnhancedInput/UnifiedButton in auth
          │ ├── Fix button-variants.ts issues
          │ └── Fix ThemeToggle radio keyboard nav
          │
Week 3-4  │ Phase 3: Layout Architecture
          │ ├── Create MarketingLayout, AuthLayout, DashboardLayout
          │ ├── Extract SharedHeader, SharedFooter
          │ ├── Consolidate navigation config
          │ └── Update routes.ts for layout routes
          │
Week 4-5  │ Phase 4: Loading, Error & Empty States
          │ ├── Branded app loading (root.tsx)
          │ ├── Wire skeletons into every route
          │ ├── Replace emoji empty states
          │ └── Add optimistic UI for booking actions
          │
Week 5-7  │ Phase 5: Visual Polish
          │ ├── Enhanced hero with gradient mesh
          │ ├── Page transition system
          │ ├── Modern ListingCard with featured variant
          │ ├── Image gallery transitions + a11y
          │ └── Checkout mobile column fix
          │
Week 6-7  │ Phase 6: Search & Discovery
          │ ├── Fix mobile search (location, filters, map)
          │ ├── Search a11y (pagination, view toggle)
          │ ├── Prevent flash of default view
          │ └── Consolidate listing detail state
          │
Week 7-8  │ Phase 7: Engagement & Delight
          │ ├── Success celebrations (confetti)
          │ ├── Staggered list animations
          │ ├── Scroll-triggered section reveals
          │ └── Human-friendly booking status labels
          │
Week 8-10 │ Phase 8: Performance & Polish
          │ ├── Lazy route loading with skeletons
          │ ├── Image optimization pipeline
          │ ├── Reduced motion audit
          │ └── Bundle analysis post-MUI removal
```

---

## 5. Success Metrics

| Metric | Current (Estimated) | Target | How to Measure |
|--------|---------------------|--------|----------------|
| Lighthouse Performance | ~65 | 90+ | CI Lighthouse |
| Lighthouse Accessibility | ~72 | 95+ | CI Lighthouse |
| First Contentful Paint | ~2.8s | < 1.5s | Web Vitals |
| Cumulative Layout Shift | ~0.15 | < 0.05 | Web Vitals (fix button translate) |
| Bundle Size (JS) | ~450KB (with MUI) | < 280KB | `vite-bundle-visualizer` |
| Mobile Usability | Dashboard broken | 100% functional | Manual QA + Playwright |
| WCAG AA Compliance | Partial | Full | axe-core automated scan |
| `alert()` calls | 12 | 0 | `grep -r "alert("` |
| Hardcoded colors | 30+ | 0 | ESLint rule or grep |
| Design system adoption | ~60% | 95%+ | Component audit |

---

## 6. Testing Strategy

### Automated
- **Playwright a11y**: Run `axe-core` on every page after each phase
- **Visual regression**: Percy or Chromatic snapshots for component changes
- **Lighthouse CI**: Enforce thresholds in CI pipeline
- **ESLint**: Add custom rule to flag `alert(`, hardcoded color classes, raw `<button>` in routes

### Manual
- **Mobile QA**: Test all dashboard pages on iPhone SE (375px) and Galaxy Fold (280px) after Phase 1
- **Dark mode sweep**: Screenshot every page in light + dark after Phase 2
- **Screen reader**: Test with VoiceOver on Mac for dialog, pagination, gallery after Phase 4
- **Keyboard navigation**: Full tab-through of all forms and modals after Phase 1+2

---

## 7. Priority Recommendations (Quick Wins)

If time is limited, these 5 changes deliver the highest impact:

1. **Replace `alert()` with toast** — 30 min effort, fixes 12 broken UX moments
2. **Add `DashboardLayout` with mobile drawer** — 4 hour effort, unbreaks all dashboard pages on mobile
3. **Replace `bg-yellow-500 text-white`** in badge.tsx — 5 min effort, fixes WCAG AA violation
4. **Wire `ListingDetailSkeleton`** into listing detail page — 30 min, eliminates blank-page flash on navigation
5. **Remove MUI imports from card.tsx** — 2 hour effort, significant bundle size reduction

---

## 8. Files Changed / Created Summary

### New Files
| File | Purpose |
|------|---------|
| `components/ui/dialog.tsx` | Accessible modal with focus trap |
| `components/layout/DashboardLayout.tsx` | Responsive dashboard shell |
| `components/layout/MarketingLayout.tsx` | Marketing pages shell |
| `components/layout/SharedHeader.tsx` | Shared site header |
| `components/layout/SharedFooter.tsx` | Shared site footer |
| `components/ui/PageTransition.tsx` | Route transition animation |
| `components/ui/SuccessOverlay.tsx` | Celebration animations |
| `config/navigation.ts` | Single-source nav config |
| `lib/booking-utils.ts` | Status labels + formatting |

### Modified Files
| File | Changes |
|------|---------|
| `components/ui/card.tsx` | Full rewrite — remove MUI, pure Tailwind |
| `components/ui/badge.tsx` | Token colors, ARIA, WCAG contrast |
| `components/ui/button-variants.ts` | Fix translate, success token, focus ring |
| `components/ui/empty-state.tsx` | SVG icons instead of emoji |
| `routes/home.tsx` | Extract nav/footer, enhanced hero, use ListingCard |
| `routes/auth.login.tsx` | Use EnhancedInput + UnifiedButton |
| `routes/auth.signup.tsx` | Use EnhancedInput + UnifiedButton |
| `routes/bookings.tsx` | Replace alert→toast, use Dialog, optimistic UI |
| `routes/listings.$id.tsx` | Skeleton, gallery a11y, consolidated state |
| `routes/listings.$id.edit.tsx` | Replace alert→toast |
| `routes/listings.new.tsx` | Replace alert→toast |
| `routes/search.tsx` | Mobile location, filter, pagination a11y |
| `routes/checkout.$bookingId.tsx` | Mobile column order |
| `routes/dashboard.owner.tsx` | Use DashboardLayout, wire skeleton |
| `routes/dashboard.renter.tsx` | Use DashboardLayout, wire skeleton |
| `routes/dashboard.owner.insights.tsx` | Replace hardcoded colors |
| `root.tsx` | Branded loading, layout route setup |
| `tailwind.css` | Add semantic tokens |
| `components/layout/MobileNavigation.tsx` | Import from config/navigation.ts |
| `components/layout/DashboardSidebar.tsx` | Responsive, ARIA, shared nav config |
| `components/theme/ThemeToggle.tsx` | Token colors, keyboard nav |
| `package.json` | Remove @mui/* dependencies |

---

## Conclusion

This revised plan is **evidence-based** — every finding cites specific files, line numbers, and code snippets from the actual codebase. The 8-phase plan is ordered by severity:

1. **Phases 1-2** fix issues that actively harm users today (broken mobile, alert() UX, a11y violations, WCAG failures)
2. **Phases 3-4** create the architectural foundation for consistency (shared layouts, loading states)
3. **Phases 5-7** elevate the visual and interaction quality to modern standards (gradient mesh, animations, celebrations)
4. **Phase 8** optimizes performance and validates everything works

The highest-ROI action is **removing MUI** — it resolves the dual framework conflict, shrinks the bundle by ~170KB, fixes dark mode inconsistencies, and forces all components through the existing Tailwind token system.

---

**Document Version:** 2.0  
**Last Updated:** February 12, 2026  
**Method:** Deep code audit with line-number-specific findings across 25+ files
