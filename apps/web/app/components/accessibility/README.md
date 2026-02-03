# Accessibility Components & Utilities

## Overview

Comprehensive accessibility implementation for WCAG 2.1 AA compliance. This directory contains components, hooks, and utilities to make the rental platform accessible to all users, including those using assistive technologies.

## WCAG 2.1 AA Compliance

Our implementation targets WCAG 2.1 Level AA compliance with the following success criteria:

### Perceivable

- **1.1.1 Non-text Content (Level A)** - All images have alt text
- **1.3.1 Info and Relationships (Level A)** - Proper semantic HTML and ARIA
- **1.4.3 Contrast (Level AA)** - Minimum 4.5:1 contrast ratio
- **1.4.11 Non-text Contrast (Level AA)** - UI components have 3:1 contrast

### Operable

- **2.1.1 Keyboard (Level A)** - All functionality available via keyboard
- **2.1.2 No Keyboard Trap (Level A)** - Focus can move away from components
- **2.4.1 Bypass Blocks (Level A)** - Skip links provided
- **2.4.3 Focus Order (Level A)** - Logical focus order
- **2.4.7 Focus Visible (Level AA)** - Visible focus indicators

### Understandable

- **3.2.1 On Focus (Level A)** - No context changes on focus
- **3.2.2 On Input (Level A)** - No unexpected context changes
- **3.3.1 Error Identification (Level A)** - Clear error messages
- **3.3.2 Labels or Instructions (Level A)** - Form labels provided

### Robust

- **4.1.2 Name, Role, Value (Level A)** - Proper ARIA attributes
- **4.1.3 Status Messages (Level AA)** - Live regions for dynamic content

---

## Components

### SkipLink

Allows keyboard users to skip repetitive navigation and jump directly to main content.

**Usage:**

```tsx
import { SkipLink } from "~/components/accessibility";

// Single skip link
<SkipLink targetId="main-content" label="Skip to main content" />;

// Multiple skip links
import { SkipLinks } from "~/components/accessibility";

<SkipLinks
  links={[
    { targetId: "main-content", label: "Skip to main content" },
    { targetId: "search-filters", label: "Skip to search filters" },
    { targetId: "footer", label: "Skip to footer" },
  ]}
/>;
```

**WCAG:** 2.4.1 Bypass Blocks (Level A)

---

### FocusTrap

Traps focus within a container, essential for modals and dialogs.

**Usage:**

```tsx
import { FocusTrap } from "~/components/accessibility";

<FocusTrap active={isModalOpen} restoreFocus={true}>
  <div role="dialog" aria-modal="true">
    <h2>Modal Title</h2>
    <button onClick={closeModal}>Close</button>
  </div>
</FocusTrap>;
```

**WCAG:** 2.1.2 No Keyboard Trap (Level A), 2.4.3 Focus Order (Level A)

---

### VisuallyHidden

Hides content visually while keeping it accessible to screen readers.

**Usage:**

```tsx
import { VisuallyHidden } from '~/components/accessibility';

<button>
  <SearchIcon />
  <VisuallyHidden>Search listings</VisuallyHidden>
</button>

// Focusable variant (visible on focus)
<VisuallyHidden focusable>
  Additional instructions for screen reader users
</VisuallyHidden>
```

**WCAG:** 1.1.1 Non-text Content (Level A), 4.1.2 Name, Role, Value (Level A)

---

### LiveRegion

Announces dynamic content changes to screen readers.

**Usage:**

```tsx
import { LiveRegion, useAnnounce } from "~/components/accessibility";

// Component approach
<LiveRegion
  message="5 new listings found"
  priority="polite"
  clearAfter={1000}
/>;

// Hook approach
function SearchResults() {
  const { announce } = useAnnounce();

  useEffect(() => {
    if (results.length > 0) {
      announce(`${results.length} listings found`, "polite");
    }
  }, [results]);
}
```

**WCAG:** 4.1.3 Status Messages (Level AA)

---

## Hooks

### useKeyboardNavigation

Provides consistent keyboard interaction patterns.

**Usage:**

```tsx
import { useKeyboardNavigation } from "~/hooks/useKeyboardNavigation";

function Dropdown({ onClose }) {
  const { handleKeyDown } = useKeyboardNavigation({
    onEscape: onClose,
    onEnter: () => selectItem(),
    onArrowDown: () => focusNext(),
    onArrowUp: () => focusPrevious(),
  });

  return <div onKeyDown={handleKeyDown}>...</div>;
}
```

**WCAG:** 2.1.1 Keyboard (Level A)

---

### useListNavigation

Keyboard navigation for lists with arrow keys.

**Usage:**

```tsx
import { useListNavigation } from "~/hooks/useKeyboardNavigation";

function Menu({ items, onSelect }) {
  const { focusedIndex, handleKeyDown } = useListNavigation(items, onSelect, {
    orientation: "vertical",
    loop: true,
  });

  return (
    <ul onKeyDown={handleKeyDown}>
      {items.map((item, index) => (
        <li
          key={item.id}
          tabIndex={index === focusedIndex ? 0 : -1}
          aria-selected={index === focusedIndex}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}
```

**WCAG:** 2.1.1 Keyboard (Level A), 2.4.3 Focus Order (Level A)

---

### useRovingTabIndex

Implements roving tabindex pattern for complex widgets.

**Usage:**

```tsx
import { useRovingTabIndex } from "~/hooks/useKeyboardNavigation";

function Toolbar({ items }) {
  const { activeIndex, getTabIndex, handleKeyDown } = useRovingTabIndex(
    items.length,
    { orientation: "horizontal" }
  );

  return (
    <div role="toolbar">
      {items.map((item, index) => (
        <button
          key={item.id}
          tabIndex={getTabIndex(index)}
          onKeyDown={(e) => handleKeyDown(e.nativeEvent, index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

**WCAG:** 2.1.1 Keyboard (Level A), 2.4.3 Focus Order (Level A)

---

## Utilities

### Focus Management

```tsx
import {
  trapFocus,
  getFocusableElements,
  FocusManager,
} from "~/lib/accessibility";

// Trap focus in a container
const cleanup = trapFocus(modalElement);

// Get all focusable elements
const focusable = getFocusableElements(containerElement);

// Focus manager for modals
const focusManager = new FocusManager();
focusManager.saveFocus();
focusManager.focusFirst(modalElement);
// Later...
focusManager.restoreFocus();
```

---

### Screen Reader Announcements

```tsx
import { announceToScreenReader, liveRegion } from "~/lib/accessibility";

// Simple announcement
announceToScreenReader("Form submitted successfully", "polite");

// Using live region manager
liveRegion.announce("5 new messages", "assertive");
```

---

### Keyboard Event Helpers

```tsx
import {
  Keys,
  isKey,
  isActivationKey,
  handleActivationKey,
} from "~/lib/accessibility";

function handleKeyPress(event: KeyboardEvent) {
  if (isKey(event, Keys.ESCAPE)) {
    closeModal();
  }

  if (isActivationKey(event)) {
    // Enter or Space pressed
    activateItem();
  }
}

// Or use helper
handleActivationKey(event, () => activateItem());
```

---

### Formatting for Screen Readers

```tsx
import {
  formatNumberForScreenReader,
  formatDateForScreenReader,
  formatPriceForScreenReader,
} from "~/lib/accessibility";

// Numbers
formatNumberForScreenReader(0); // "zero"
formatNumberForScreenReader(1); // "one"
formatNumberForScreenReader(5); // "5"

// Dates
formatDateForScreenReader(new Date());
// "Monday, January 1, 2024"

// Prices
formatPriceForScreenReader(150, "USD");
// "dollars 150.00"
```

---

### User Preferences

```tsx
import {
  prefersReducedMotion,
  prefersHighContrast,
  prefersDarkMode,
} from "~/lib/accessibility";

// Respect user preferences
const shouldAnimate = !prefersReducedMotion();
const useHighContrast = prefersHighContrast();
const isDark = prefersDarkMode();
```

---

## Best Practices

### 1. Semantic HTML

Always use semantic HTML elements:

```tsx
// ✅ Good
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/listings">Listings</a></li>
  </ul>
</nav>

// ❌ Bad
<div className="nav">
  <div onClick={goTo}>Listings</div>
</div>
```

### 2. ARIA Labels

Provide descriptive labels for interactive elements:

```tsx
// ✅ Good
<button aria-label="Close modal">
  <XIcon />
</button>

// ✅ Also good
<button>
  <XIcon aria-hidden="true" />
  <VisuallyHidden>Close modal</VisuallyHidden>
</button>

// ❌ Bad
<button>
  <XIcon />
</button>
```

### 3. Focus Management

Manage focus for dynamic content:

```tsx
// ✅ Good
function Modal({ isOpen, onClose }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      const cleanup = trapFocus(modalRef.current);
      return cleanup;
    }
  }, [isOpen]);

  return (
    <FocusTrap active={isOpen}>
      <div ref={modalRef} role="dialog" aria-modal="true">
        ...
      </div>
    </FocusTrap>
  );
}
```

### 4. Keyboard Navigation

Ensure all interactive elements are keyboard accessible:

```tsx
// ✅ Good
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Click me
</div>

// ✅ Better - use actual button
<button onClick={handleClick}>
  Click me
</button>
```

### 5. Form Accessibility

Properly label all form inputs:

```tsx
// ✅ Good
<div>
  <label htmlFor="email">Email Address</label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-invalid={hasError}
    aria-describedby={hasError ? "email-error" : undefined}
  />
  {hasError && (
    <div id="email-error" role="alert">
      Please enter a valid email address
    </div>
  )}
</div>
```

### 6. Dynamic Content

Announce dynamic content changes:

```tsx
// ✅ Good
function SearchResults({ results }) {
  const { announce } = useAnnounce();

  useEffect(() => {
    announce(`${results.length} results found`, "polite");
  }, [results]);

  return <div>...</div>;
}
```

---

## Testing

### Manual Testing

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Ensure visible focus indicators
   - Test all keyboard shortcuts

2. **Screen Reader Testing**
   - Test with NVDA (Windows)
   - Test with JAWS (Windows)
   - Test with VoiceOver (macOS/iOS)
   - Test with TalkBack (Android)

3. **Zoom Testing**
   - Test at 200% zoom
   - Ensure no horizontal scrolling
   - Verify text reflow

### Automated Testing

```bash
# Install axe-core for automated testing
pnpm add -D @axe-core/react

# Run accessibility tests
pnpm test:a11y
```

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)

---

## Support

For accessibility issues or questions:

1. Check WCAG 2.1 guidelines
2. Review ARIA Authoring Practices
3. Test with screen readers
4. Consult WebAIM resources
