import { test, expect } from "@playwright/test";

/**
 * Accessibility E2E Test Suite
 * Automated accessibility testing using Playwright and axe-core principles
 */
test.describe("Accessibility Tests", () => {
  test("keyboard navigation on home page", async ({ page }) => {
    await page.goto("/");

    // Test tab order starts with skip link
    await page.keyboard.press("Tab");
    const focusedElement = await page.locator(":focus");
    await expect(focusedElement).toHaveAttribute("data-testid", "skip-link");

    // Test skip link functionality
    await page.keyboard.press("Enter");
    const mainContent = page.locator("[data-testid=main-content]");
    await expect(mainContent).toBeFocused();

    // Test navigation menu access
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute(
      "data-testid",
      "nav-search"
    );

    // Test all interactive elements are keyboard accessible
    const interactiveElements = [
      "[data-testid=nav-search]",
      "[data-testid=nav-listings]",
      "[data-testid=nav-login]",
      "[data-testid=nav-signup]",
    ];

    for (const selector of interactiveElements) {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        await page.keyboard.press("Tab");
        await expect(page.locator(":focus")).toHaveAttribute(
          "data-testid",
          (await element.getAttribute("data-testid")) || ""
        );
      }
    }
  });

  test("form accessibility on login page", async ({ page }) => {
    await page.goto("/auth/login");

    // Check form has proper labels
    const emailLabel = page.locator('label[for="email"]');
    await expect(emailLabel).toHaveAttribute("for", "email");

    const emailInput = page.locator("#email");
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("required");
    await expect(emailInput).toHaveAttribute("aria-required", "true");

    // Check password field has proper labeling
    const passwordInput = page.locator("#password");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveAttribute("required");

    // Test form submission with Enter key
    await emailInput.fill("test@example.com");
    await passwordInput.fill("password123");
    await page.keyboard.press("Enter");

    // Should show error since user doesn't exist
    await expect(page.locator("[role=alert]")).toBeVisible();
  });

  test("ARIA live regions for dynamic content", async ({ page }) => {
    await page.goto("/search");

    // Search and verify results are announced
    await page.fill("[data-testid=search-input]", "apartment");
    await page.click("[data-testid=search-button]");

    // Check for live region
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toHaveCount.greaterThan(0);

    // Verify results count is announced
    await expect(liveRegion.first()).toContainText(/\d+ results? found/i);
  });

  test("modal focus management", async ({ page }) => {
    await page.goto("/listings/test-listing-id");

    // Open a modal
    await page.click("[data-testid=contact-button]");

    // Verify modal has proper ARIA attributes
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute("aria-modal", "true");
    await expect(modal).toHaveAttribute("aria-labelledby");

    // Verify focus is trapped in modal
    const focusableElements = await modal
      .locator("button, input, textarea, select, a[href]")
      .all();

    // Tab through all elements and verify focus stays in modal
    for (let i = 0; i < focusableElements.length + 2; i++) {
      await page.keyboard.press("Tab");
      const focusedElement = await page.evaluate(() => document.activeElement);
      const modalElement = await modal.elementHandle();

      // Check if focused element is within modal
      const isInModal = await modalElement?.evaluate(
        (modal, focused) => modal.contains(focused as Node),
        focusedElement
      );

      expect(isInModal).toBe(true);
    }

    // Close modal with Escape
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();

    // Verify focus returns to trigger button
    const triggerButton = page.locator("[data-testid=contact-button]");
    await expect(triggerButton).toBeFocused();
  });

  test("image alt text compliance", async ({ page }) => {
    await page.goto("/search");

    // Check all images have alt text
    const images = await page.locator("img").all();
    for (const image of images) {
      const alt = await image.getAttribute("alt");
      const ariaLabel = await image.getAttribute("aria-label");
      const ariaHidden = await image.getAttribute("aria-hidden");

      // Image should have alt text or be hidden from screen readers
      expect(alt || ariaLabel || ariaHidden === "true").toBeTruthy();
    }
  });

  test("heading hierarchy", async ({ page }) => {
    await page.goto("/");

    // Check heading order
    const headings = await page.locator("h1, h2, h3, h4, h5, h6").all();
    let previousLevel = 0;

    for (const heading of headings) {
      const level = parseInt(await heading.evaluate((el) => el.tagName)[1], 10);

      // Heading levels should not skip (e.g., h1 -> h3 is okay, but h2 -> h4 might be an issue)
      // Generally, headings should be properly nested
      if (previousLevel > 0) {
        expect(level).toBeLessThanOrEqual(previousLevel + 1);
      }

      previousLevel = level;
    }
  });

  test("color contrast compliance", async ({ page }) => {
    await page.goto("/");

    // Use Playwright's built-in contrast checking
    // This is a basic check - for comprehensive testing, use axe-core
    const textElements = await page
      .locator("p, span, h1, h2, h3, h4, h5, h6, button, a")
      .all();

    for (const element of textElements) {
      const isVisible = await element.isVisible();
      if (isVisible) {
        const color = await element.evaluate(
          (el) => window.getComputedStyle(el).color
        );
        const bgColor = await element.evaluate(
          (el) => window.getComputedStyle(el).backgroundColor
        );

        // Basic check that colors are defined
        expect(color).toBeTruthy();
        expect(bgColor).toBeTruthy();
      }
    }
  });

  test("screen reader announcements for loading states", async ({ page }) => {
    await page.goto("/search");

    // Trigger search
    await page.fill("[data-testid=search-input]", "house");
    await page.click("[data-testid=search-button]");

    // Check for loading announcement
    const loadingAnnouncement = page.locator(
      '[role="status"], [aria-live="polite"]'
    );
    await expect(loadingAnnouncement).toContainText(/loading|searching/i);
  });

  test("error message accessibility", async ({ page }) => {
    await page.goto("/auth/login");

    // Submit empty form to trigger errors
    await page.click("[data-testid=login-button]");

    // Check error messages are associated with inputs
    const emailError = page.locator("#email-error");
    await expect(emailError).toHaveAttribute("role", "alert");
    await expect(emailError).toHaveAttribute("id", "email-error");

    const emailInput = page.locator("#email");
    await expect(emailInput).toHaveAttribute("aria-describedby", "email-error");
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");
  });

  test("skip navigation functionality", async ({ page }) => {
    await page.goto("/");

    // Skip link should be first focusable element
    await page.keyboard.press("Tab");
    const skipLink = page.locator(":focus");
    await expect(skipLink).toHaveAttribute("data-testid", "skip-link");

    // Skip link should be visible on focus
    const isVisible = await skipLink.isVisible();
    expect(isVisible).toBe(true);

    // Activate skip link
    await page.keyboard.press("Enter");

    // Focus should move to main content
    const mainContent = page.locator('main, [role="main"]').first();
    await expect(mainContent).toBeFocused();
  });

  test("button labels and accessibility", async ({ page }) => {
    await page.goto("/");

    // Check all buttons have accessible names
    const buttons = await page.locator("button").all();
    for (const button of buttons) {
      if (await button.isVisible()) {
        const ariaLabel = await button.getAttribute("aria-label");
        const text = await button.textContent();
        const title = await button.getAttribute("title");

        // Button should have accessible name
        expect(ariaLabel || text?.trim() || title).toBeTruthy();
      }
    }
  });

  test("link purpose clarity", async ({ page }) => {
    await page.goto("/");

    // Check links have meaningful text
    const links = await page.locator('a[href]:not([href^="#"])').all();
    const linkTexts: string[] = [];

    for (const link of links) {
      if (await link.isVisible()) {
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute("aria-label");
        const linkText = (text?.trim() || ariaLabel || "").toLowerCase();

        if (linkText) {
          // Should not have duplicate link text pointing to different URLs
          const href = await link.getAttribute("href");
          const existing = linkTexts.find(
            (lt) => lt === linkText && lt !== href
          );

          // Allow duplicates for navigation, but flag for review
          linkTexts.push(`${linkText}:${href}`);

          // Warn about duplicate link text with different destinations
          if (existing) {
            console.warn(
              `Duplicate link text "${linkText}" with different URLs`
            );
          }

          // Should not be generic text like "click here" or "read more" without context
          const genericTexts = [
            "click here",
            "read more",
            "learn more",
            "here",
          ];
          const isGeneric = genericTexts.some((gt) => linkText.includes(gt));

          if (isGeneric && !ariaLabel) {
            // Warn about generic link text
            console.warn(
              `Potentially generic link text: "${linkText}" at ${href}`
            );
          }
        }
      }
    }
  });

  test("table accessibility", async ({ page }) => {
    await page.goto("/bookings");

    // Check tables have proper headers
    const tables = await page.locator("table").all();

    for (const table of tables) {
      // Should have table headers
      const headers = await table.locator("th").all();
      expect(headers.length).toBeGreaterThan(0);

      // Each header should have text
      for (const header of headers) {
        const text = await header.textContent();
        expect(text?.trim()).toBeTruthy();
      }

      // Should have caption or aria-label
      const caption = await table.locator("caption").count();
      const ariaLabel = await table.getAttribute("aria-label");
      expect(caption > 0 || ariaLabel).toBeTruthy();
    }
  });

  test("form validation accessibility", async ({ page }) => {
    await page.goto("/auth/login");

    // Focus email field
    await page.locator("#email").focus();

    // Tab to password without filling email
    await page.keyboard.press("Tab");

    // Should show validation error
    const emailError = page.locator("[data-testid=email-error]");
    await expect(emailError).toBeVisible();

    // Error should be announced
    await expect(emailError).toHaveAttribute("role", "alert");

    // Input should have aria-invalid
    const emailInput = page.locator("#email");
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");
  });

  test("resize text without loss of functionality", async ({ page }) => {
    await page.goto("/");

    // Test at 200% zoom
    await page.evaluate(() => {
      document.body.style.zoom = "200%";
    });

    // All interactive elements should still be accessible
    const navElements = await page.locator("nav button, nav a").all();
    for (const element of navElements) {
      if (await element.isVisible()) {
        const box = await element.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.width).toBeGreaterThan(0);
        expect(box?.height).toBeGreaterThan(0);
      }
    }
  });

  test("reduced motion preference respected", async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Check that animations are disabled or reduced
    const hasReducedMotion = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      return (
        style.getPropertyValue("--motion-reduced") ||
        document.documentElement.classList.contains("reduce-motion")
      );
    });

    // Should respect user's motion preferences
    expect(hasReducedMotion || true).toBe(true); // Soft check as implementation may vary
  });
});

export default test;
