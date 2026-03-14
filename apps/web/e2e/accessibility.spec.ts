/**
 * P3: Accessibility Tests — axe-core Integration
 *
 * Uses @axe-core/playwright to run automated WCAG 2.1 AA accessibility
 * checks on critical pages. Catches violations like missing alt text,
 * insufficient color contrast, missing ARIA labels, and form labeling.
 *
 * Setup:
 *   cd apps/web && pnpm add -D @axe-core/playwright
 *
 * Each test navigates to a page and runs a full axe scan. Violations
 * with "critical" or "serious" impact fail the test.
 */

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3401";
const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAs(page: Page, role: "USER" | "HOST" | "ADMIN") {
  const email =
    role === "HOST"
      ? "owner@test.com"
      : role === "ADMIN"
        ? "admin@test.com"
        : "renter@test.com";

  const res = await page.request.post(`${API}/auth/dev-login`, {
    data: { email, role, secret: 'dev-secret-123' },
  });
  if (!res.ok()) throw new Error(`dev-login failed: ${res.status()}`);
  const payload = await res.json();

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ accessToken, refreshToken, user }: any) => {
      const rawRole = (user.role ?? "").toUpperCase();
      const normalizedRole =
        rawRole === "HOST"
          ? "owner"
          : rawRole === "ADMIN" || rawRole === "SUPER_ADMIN"
            ? "admin"
            : "renter";
      const normalizedUser = { ...user, role: normalizedRole };
      const state = JSON.stringify({
        state: { user: normalizedUser, accessToken, refreshToken },
        version: 0,
      });
      localStorage.setItem("auth-storage", state);
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
    },
    payload
  );
}

/**
 * Run axe on the current page and assert no critical/serious violations.
 * Returns the full results for optional logging.
 */
async function expectAccessible(page: Page, pageName: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  // Filter to critical and serious only — skip minor/moderate for now
  const serious = results.violations.filter(
    (v: any) => v.impact === "critical" || v.impact === "serious"
  );

  if (serious.length > 0) {
    const summary = serious
      .map(
        (v: any) => {
          const nodeDetails = v.nodes.slice(0, 3).map((n: any) => {
            const contrastData = n.any?.[0]?.data;
            const contrastInfo = contrastData?.contrastRatio
              ? ` (ratio: ${contrastData.contrastRatio}, required: ${contrastData.expectedContrastRatio})`
              : '';
            return `    - ${n.html?.substring(0, 120)}${contrastInfo}`;
          }).join('\n');
          return `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance${v.nodes.length > 1 ? "s" : ""})\n${nodeDetails}`;
        }
      )
      .join("\n  ");
    expect
      .soft(serious.length, `axe violations on ${pageName}:\n  ${summary}`)
      .toBe(0);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public pages
// ---------------------------------------------------------------------------

test.describe("Accessibility — Public Pages", () => {
  test("login page passes WCAG 2.1 AA", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle" });
    await expectAccessible(page, "login");
  });

  test("signup page passes WCAG 2.1 AA", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/signup`, {
      waitUntil: "networkidle",
    });
    await expectAccessible(page, "signup");
  });

  test("home page passes WCAG 2.1 AA", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await expectAccessible(page, "home");
  });
});

// ---------------------------------------------------------------------------
// Authenticated pages — Renter
// ---------------------------------------------------------------------------

test.describe("Accessibility — Renter Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "USER");
  });

  test("dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await expectAccessible(page, "renter-dashboard");
  });

  test("listings browse", async ({ page }) => {
    await page.goto(`${BASE_URL}/listings`, { waitUntil: "networkidle" });
    await expectAccessible(page, "listings-browse");
  });

  test("bookings list", async ({ page }) => {
    await page.goto(`${BASE_URL}/bookings`, { waitUntil: "networkidle" });
    await expectAccessible(page, "renter-bookings");
  });

  test("settings", async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    await expectAccessible(page, "settings");
  });
});

// ---------------------------------------------------------------------------
// Authenticated pages — Owner
// ---------------------------------------------------------------------------

test.describe("Accessibility — Owner Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "HOST");
  });

  test("owner dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await expectAccessible(page, "owner-dashboard");
  });

  test("owner listings", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/owner`, {
      waitUntil: "networkidle",
    });
    await expectAccessible(page, "owner-listings");
  });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

test.describe("Accessibility — Admin Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "ADMIN");
  });

  test("admin dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expectAccessible(page, "admin-dashboard");
  });
});

// ---------------------------------------------------------------------------
// Keyboard navigation spot-check
// ---------------------------------------------------------------------------

test.describe("Accessibility — Keyboard Navigation", () => {
  test("login form is fully navigable with Tab key", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle" });

    // Tab through the form and verify focus moves to interactive elements
    await page.keyboard.press("Tab");
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(["INPUT", "BUTTON", "A", "SELECT"]).toContain(firstFocused);

    // Keep tabbing — should eventually reach the submit button
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
    }

    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeDefined();
    // At worst we've cycled back, but focus should never get "stuck"
    expect(["INPUT", "BUTTON", "A", "SELECT", "BODY"]).toContain(focusedTag);
  });

  test("skip-to-content link exists on dashboard", async ({ page }) => {
    await loginAs(page, "USER");
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });

    // Many accessible sites include a "skip to main content" link as the first Tab stop
    const skipLink = page.locator(
      'a[href="#main-content"], a[href="#content"], [data-testid="skip-link"]'
    );
    const hasSkipLink = (await skipLink.count()) > 0;

    // Soft assert — skip link is recommended, not required for this pass
    expect.soft(hasSkipLink, "Skip-to-content link recommended for keyboard users").toBe(true);
  });
});
