/**
 * P2: Visual Regression Tests
 *
 * Uses Playwright's built-in screenshot comparison (`toHaveScreenshot()`)
 * to detect unintended visual changes across critical pages.
 *
 * Baseline screenshots are stored in `e2e/visual-regression.spec.ts-snapshots/`
 * and committed to the repo. On subsequent runs, any pixel diff beyond the
 * threshold will fail the test.
 *
 * Usage:
 *   npx playwright test visual-regression --update-snapshots  # create/update baselines
 *   npx playwright test visual-regression                     # compare against baselines
 *
 * Configuration:
 *   - maxDiffPixelRatio: 0.01 (1% tolerance for anti-aliasing / font rendering)
 *   - Runs in chromium-only for deterministic baselines
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3401";
const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function devLogin(page: Page, role: "USER" | "HOST" | "ADMIN") {
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

  return payload;
}

const screenshotOpts = {
  maxDiffPixelRatio: 0.01,
  animations: "disabled" as const,
  mask: [] as any[], // will be populated per-test to mask dynamic content
};

// ---------------------------------------------------------------------------
// Public pages (no auth required)
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Public Pages", () => {
  test("login page", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`, {
      waitUntil: "networkidle",
    });
    // Wait for animations to settle using requestAnimationFrame
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    await page.waitForLoadState("load");

    await expect(page).toHaveScreenshot("login-page.png", {
      ...screenshotOpts,
      fullPage: true,
    });
  });

  test("signup page", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/register`, {
      waitUntil: "networkidle",
    });
    // Wait for animations to settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    await expect(page).toHaveScreenshot("signup-page.png", {
      ...screenshotOpts,
      fullPage: true,
    });
  });

  test("home / landing page", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    // Wait for animations to settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    await expect(page).toHaveScreenshot("home-page.png", {
      ...screenshotOpts,
      fullPage: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Authenticated pages
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Authenticated (Renter)", () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page, "USER");
  });

  test("dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    // Wait for animations to settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    // Mask dynamic content like dates, counts
    const dynamicElements = page.locator(
      '[data-testid*="count"], [data-testid*="date"], time'
    );

    await expect(page).toHaveScreenshot("renter-dashboard.png", {
      ...screenshotOpts,
      mask: [dynamicElements],
      fullPage: true,
    });
  });

  test("listings browse", async ({ page }) => {
    await page.goto(`${BASE_URL}/listings`, { waitUntil: "networkidle" });
    // Wait for listing cards to load
    await expect(page.locator('[data-testid="listing-card"], .listing-card, a[href^="/listings/"]').first())
      .toBeVisible({ timeout: 5000 });

    await expect(page).toHaveScreenshot("listings-browse.png", {
      ...screenshotOpts,
      fullPage: false, // viewport only — listings may be long
    });
  });

  test("bookings list", async ({ page }) => {
    await page.goto(`${BASE_URL}/bookings`, { waitUntil: "networkidle" });
    // Wait for animations to settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    await expect(page).toHaveScreenshot("renter-bookings.png", {
      ...screenshotOpts,
      fullPage: true,
    });
  });
});

test.describe("Visual Regression — Authenticated (Owner)", () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page, "HOST");
  });

  test("owner dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    // Wait for animations to settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    const dynamicElements = page.locator(
      '[data-testid*="count"], [data-testid*="date"], time, [data-testid*="earnings"]'
    );

    await expect(page).toHaveScreenshot("owner-dashboard.png", {
      ...screenshotOpts,
      mask: [dynamicElements],
      fullPage: true,
    });
  });

  test("my listings page", async ({ page }) => {
    await page.goto(`${BASE_URL}/owner/listings`, {
      waitUntil: "networkidle",
    });
    // Wait for animations to settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    await expect(page).toHaveScreenshot("owner-listings.png", {
      ...screenshotOpts,
      fullPage: true,
    });
  });
});

test.describe("Visual Regression — Admin", () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page, "ADMIN");
  });

  test("admin dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    // Wait for animations to settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    const dynamicElements = page.locator(
      '[data-testid*="count"], [data-testid*="stat"], time'
    );

    await expect(page).toHaveScreenshot("admin-dashboard.png", {
      ...screenshotOpts,
      mask: [dynamicElements],
      fullPage: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Responsive breakpoints
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Mobile Viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

  test("login page (mobile)", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`, {
      waitUntil: "networkidle",
    });
    // Wait for animations to settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    await expect(page).toHaveScreenshot("login-page-mobile.png", {
      ...screenshotOpts,
      fullPage: true,
    });
  });

  test("home page (mobile)", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    // Wait for animations to settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    await expect(page).toHaveScreenshot("home-page-mobile.png", {
      ...screenshotOpts,
      fullPage: true,
    });
  });
});
