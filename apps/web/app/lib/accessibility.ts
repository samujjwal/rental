/**
 * Accessibility Utilities
 * Provides helpers for WCAG 2.1 AA compliance
 */

/**
 * Generate unique IDs for ARIA relationships
 */
let idCounter = 0;
export function generateId(prefix: string = "id"): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: "polite" | "assertive" = "polite"
) {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Trap focus within a container (for modals, dialogs)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener("keydown", handleTabKey);
  firstElement?.focus();

  return () => {
    container.removeEventListener("keydown", handleTabKey);
  };
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

/**
 * Check if element is visible to screen readers
 */
export function isVisibleToScreenReader(element: HTMLElement): boolean {
  return (
    element.offsetWidth > 0 &&
    element.offsetHeight > 0 &&
    window.getComputedStyle(element).visibility !== "hidden" &&
    window.getComputedStyle(element).display !== "none"
  );
}

/**
 * Format number for screen readers
 */
export function formatNumberForScreenReader(num: number): string {
  if (num === 0) return "zero";
  if (num === 1) return "one";
  return num.toString();
}

/**
 * Format date for screen readers
 */
export function formatDateForScreenReader(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Format price for screen readers
 */
export function formatPriceForScreenReader(
  price: number,
  currency: string = "USD"
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(price);

  return formatted.replace("$", "dollars ");
}

/**
 * Keyboard event helpers
 */
export const Keys = {
  ENTER: "Enter",
  SPACE: " ",
  ESCAPE: "Escape",
  TAB: "Tab",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
} as const;

/**
 * Check if key matches
 */
export function isKey(event: KeyboardEvent, key: string): boolean {
  return event.key === key;
}

/**
 * Check if activation key (Enter or Space)
 */
export function isActivationKey(event: KeyboardEvent): boolean {
  return event.key === Keys.ENTER || event.key === Keys.SPACE;
}

/**
 * Prevent default for activation keys
 */
export function handleActivationKey(
  event: KeyboardEvent,
  callback: () => void
): void {
  if (isActivationKey(event)) {
    event.preventDefault();
    callback();
  }
}

/**
 * ARIA live region manager
 */
class LiveRegionManager {
  private regions: Map<string, HTMLElement> = new Map();

  private createRegion(
    id: string,
    priority: "polite" | "assertive"
  ): HTMLElement {
    const region = document.createElement("div");
    region.id = id;
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", priority);
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    document.body.appendChild(region);
    return region;
  }

  announce(message: string, priority: "polite" | "assertive" = "polite"): void {
    const id = `live-region-${priority}`;
    let region = this.regions.get(id);

    if (!region) {
      region = this.createRegion(id, priority);
      this.regions.set(id, region);
    }

    region.textContent = message;

    setTimeout(() => {
      if (region) region.textContent = "";
    }, 1000);
  }

  cleanup(): void {
    this.regions.forEach((region) => {
      if (region.parentNode) {
        region.parentNode.removeChild(region);
      }
    });
    this.regions.clear();
  }
}

export const liveRegion = new LiveRegionManager();

/**
 * Focus management utilities
 */
export class FocusManager {
  private previousFocus: HTMLElement | null = null;

  saveFocus(): void {
    this.previousFocus = document.activeElement as HTMLElement;
  }

  restoreFocus(): void {
    if (this.previousFocus && typeof this.previousFocus.focus === "function") {
      this.previousFocus.focus();
    }
    this.previousFocus = null;
  }

  focusFirst(container: HTMLElement): void {
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }

  focusLast(container: HTMLElement): void {
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
    }
  }
}

/**
 * Skip link utilities
 */
export function createSkipLink(
  targetId: string,
  label: string = "Skip to main content"
): HTMLAnchorElement {
  const skipLink = document.createElement("a");
  skipLink.href = `#${targetId}`;
  skipLink.textContent = label;
  skipLink.className =
    "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded";

  skipLink.addEventListener("click", (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  return skipLink;
}

/**
 * ARIA label helpers
 */
export function getAriaLabel(element: HTMLElement): string | null {
  return (
    element.getAttribute("aria-label") ||
    element.getAttribute("aria-labelledby") ||
    element.textContent ||
    null
  );
}

export function setAriaLabel(element: HTMLElement, label: string): void {
  element.setAttribute("aria-label", label);
}

/**
 * Reduced motion detection
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * High contrast detection
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia("(prefers-contrast: high)").matches;
}

/**
 * Color scheme detection
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
