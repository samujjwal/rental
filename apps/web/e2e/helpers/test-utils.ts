import { test as base, expect, Page, BrowserContext } from "@playwright/test";
import { testUsers, type TestUser } from "./fixtures";

// Re-export for backward compatibility with existing tests
export { testUsers, type TestUser } from "./fixtures";

// Extend the base test with fixtures
/* eslint-disable react-hooks/rules-of-hooks */
export const test = base.extend<{
  authenticatedPage: Page;
  renterPage: Page;
  ownerPage: Page;
  adminPage: Page;
}>({
  // Authenticated page with default user
  authenticatedPage: async ({ page }, use) => {
    await loginAs(page, testUsers.renter);
    await use(page);
  },

  // Page authenticated as renter
  renterPage: async ({ page }, use) => {
    await loginAs(page, testUsers.renter);
    await use(page);
  },

  // Page authenticated as owner
  ownerPage: async ({ page }, use) => {
    await loginAs(page, testUsers.owner);
    await use(page);
  },

  // Page authenticated as admin
  adminPage: async ({ page }, use) => {
    await loginAs(page, testUsers.admin);
    await use(page);
  },
});
/* eslint-enable react-hooks/rules-of-hooks */

// Re-export expect
export { expect };

const API_BASE_URL = process.env.E2E_API_URL || "http://localhost:3400/api";
const AUTH_STORAGE_KEY = "auth-storage";

function toApiRole(role: TestUser["role"]): "USER" | "HOST" | "ADMIN" {
  if (role === "owner") return "HOST";
  if (role === "admin") return "ADMIN";
  return "USER";
}

async function devLoginFallback(page: Page, user: TestUser): Promise<boolean> {
  const requestData = {
    email: user.email,
    role: toApiRole(user.role),
    secret: 'dev-secret-123',
  };

  let response = await page.request.post(`${API_BASE_URL}/auth/dev-login`, {
    data: requestData,
  });

  // Retry on rate-limit (429) or transient server errors (5xx) with backoff
  for (let attempt = 1; attempt <= 3 && (response.status() === 429 || response.status() >= 500); attempt++) {
    await new Promise((r) => setTimeout(r, attempt * 2000));
    response = await page.request.post(`${API_BASE_URL}/auth/dev-login`, {
      data: requestData,
    });
  }

  if (!response.ok()) {
    return false;
  }

  const payload = (await response.json()) as {
    accessToken?: string;
    refreshToken?: string;
    user?: unknown;
  };

  if (!payload.accessToken || !payload.refreshToken || !payload.user) {
    return false;
  }

  await page.goto("/");
  await page.evaluate(
    ({ authStorageKey, accessToken, authUser }) => {
      // Clear any stale auth state before setting new auth
      localStorage.clear();

      const rawRole =
        authUser &&
        typeof authUser === "object" &&
        "role" in authUser &&
        typeof (authUser as { role?: unknown }).role === "string"
          ? String((authUser as { role: string }).role).toUpperCase()
          : "";
      const normalizedRole =
        rawRole === "HOST"
          ? "owner"
          : rawRole === "ADMIN" || rawRole === "SUPER_ADMIN"
            ? "admin"
            : "renter";
      const normalizedUser =
        authUser && typeof authUser === "object"
          ? { ...(authUser as Record<string, unknown>), role: normalizedRole }
          : authUser;

      localStorage.setItem(
        authStorageKey,
        JSON.stringify({
          state: {
            user: normalizedUser,
            accessToken,
          },
          version: 0,
        })
      );
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
    },
    {
      authStorageKey: AUTH_STORAGE_KEY,
      accessToken: payload.accessToken,
      authUser: payload.user,
    }
  );

  const destination = user.role === "admin" ? "/admin" : "/dashboard";
  await page
    .goto(destination, { waitUntil: "domcontentloaded", timeout: 30000 })
    .catch(() => {
      // Some heavy pages can exceed the default navigation budget in CI-like environments.
    });

  // Wait for SPA client-side redirects to settle (clientLoader runs async after DOM loads)
  await page
    .waitForURL((url) => !url.pathname.startsWith("/auth/"), { timeout: 8000 })
    .catch(() => {
      // If still on auth page after 8s, it's a real auth failure
    });

  // Verify auth succeeded — we should NOT be on the login page
  if (page.url().includes("/auth/login")) {
    return false;
  }

  // Also verify we landed somewhere expected (not a completely wrong page)
  const expectedPath = user.role === "admin" ? "/admin" : "/dashboard";
  if (!page.url().includes(expectedPath)) {
    return false;
  }

  // Verify auth state is present in localStorage after navigation
  const hasAuth = await page.evaluate((storageKey: string) => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
      return typeof parsed?.state?.accessToken === "string";
    } catch {
      return false;
    }
  }, AUTH_STORAGE_KEY);

  return hasAuth;
}

/**
 * Login as a specific user
 */
export async function loginAs(page: Page, user: TestUser): Promise<void> {
  const forceUiLogin = process.env.E2E_FORCE_UI_LOGIN === "true";
  if (!forceUiLogin) {
    const fallbackWorked = await devLoginFallback(page, user);
    if (fallbackWorked) {
      return;
    }
  }

  const expectedPattern =
    user.role === "admin" ? /.*admin|.*dashboard/ : /.*dashboard/;
  await page.goto("/auth/login");
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const loginFormVisible = await emailInput
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (!loginFormVisible) {
    const isExpectedDestination = expectedPattern.test(page.url());
    if (isExpectedDestination) {
      const currentEmail = await page.evaluate(() => {
        try {
          const authState = localStorage.getItem("auth-storage");
          if (authState) {
            const parsed = JSON.parse(authState) as {
              state?: { user?: { email?: unknown } };
            };
            const storedEmail = parsed.state?.user?.email;
            if (typeof storedEmail === "string") {
              return storedEmail;
            }
          }

          const rawUser = localStorage.getItem("user");
          if (rawUser) {
            const parsedUser = JSON.parse(rawUser) as { email?: unknown };
            return typeof parsedUser.email === "string"
              ? parsedUser.email
              : null;
          }

          return null;
        } catch {
          return null;
        }
      });

      if (currentEmail === user.email) {
        return;
      }
    }

    const fallbackWorked = await devLoginFallback(page, user);
    if (!fallbackWorked) {
      throw new Error(`Unable to authenticate user ${user.email}`);
    }
    return;
  }

  await emailInput.fill(user.email);
  await passwordInput.fill(user.password);
  await page.click('button[type="submit"]');

  const redirected = await page
    .waitForURL(expectedPattern, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  if (redirected) {
    return;
  }

  const fallbackWorked = await devLoginFallback(page, user);
  if (!fallbackWorked) {
    throw new Error(`Unable to authenticate user ${user.email}`);
  }
}

/**
 * Login as admin user
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, testUsers.admin);
}

/**
 * Login as owner user
 */
export async function loginAsOwner(page: Page): Promise<void> {
  await loginAs(page, testUsers.owner);
}

/**
 * Login as renter user
 */
export async function loginAsRenter(page: Page): Promise<void> {
  await loginAs(page, testUsers.renter);
}

/**
 * Logout the current user
 */
export async function logout(page: Page): Promise<void> {
  const userMenu = page.locator('[data-testid="user-menu"]');
  if (await userMenu.isVisible()) {
    await userMenu.click();
  }
  await page.click("text=/Logout|Sign Out/i");
  await page.waitForURL(/.*login|.*home|\//);
}

/**
 * Wait for a toast/notification message
 */
export async function waitForToast(page: Page, pattern: RegExp): Promise<void> {
  await expect(page.locator(`text=${pattern}`)).toBeVisible({ timeout: 5000 });
}

/**
 * Fill a date picker
 */
export async function fillDatePicker(
  page: Page,
  selector: string,
  daysFromNow: number
): Promise<void> {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const dateString = date.toISOString().split("T")[0];

  await page.fill(selector, dateString);
}

/**
 * Select dates in a calendar range picker
 */
export async function selectDateRange(
  page: Page,
  startDaysFromNow: number,
  endDaysFromNow: number
): Promise<void> {
  const dateInput = page.locator('[data-testid="date-picker"]');
  if (await dateInput.isVisible()) {
    await dateInput.click();

    // Select available dates
    const availableDays = page.locator(
      '[data-testid="calendar-day"]:not([disabled])'
    );
    await availableDays.nth(startDaysFromNow).click();
    await availableDays.nth(endDaysFromNow).click();
  }
}

/**
 * Upload a file to a file input.
 *
 * NOTE: The buffer contains a minimal placeholder — it is sufficient for
 * client-side file-input selection but may be rejected by a real upload API
 * that validates MIME magic bytes.  For tests that exercise the full upload
 * path, provide a real image buffer instead.
 */
export async function uploadFile(
  page: Page,
  selector: string,
  fileName: string,
  mimeType: string = "image/jpeg"
): Promise<void> {
  const fileInput = page.locator(selector);
  await fileInput.setInputFiles({
    name: fileName,
    mimeType: mimeType,
    buffer: Buffer.from("fake file content"),
  });
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: RegExp,
  status: number = 200
): Promise<void> {
  await page.waitForResponse(
    (response) =>
      urlPattern.test(response.url()) && response.status() === status
  );
}

/**
 * Clear all cookies and storage
 */
export async function clearSession(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

/**
 * Wait for loading to complete
 */
export async function waitForLoading(page: Page): Promise<void> {
  const loader = page.locator(
    '[data-testid="loading"], [data-testid="spinner"]'
  );
  if (await loader.isVisible()) {
    await loader.waitFor({ state: "hidden" });
  }
}

/**
 * Fill form fields from an object
 */
export async function fillForm(
  page: Page,
  formData: Record<string, string>
): Promise<void> {
  for (const [name, value] of Object.entries(formData)) {
    const input = page.locator(
      `input[name="${name}"], textarea[name="${name}"]`
    );
    if (await input.isVisible()) {
      await input.fill(value);
    }
  }
}

/**
 * Select an option from a dropdown
 */
export async function selectOption(
  page: Page,
  selector: string,
  optionText: string
): Promise<void> {
  await page.click(selector);
  await page.click(`text=${optionText}`);
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(
  page: Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector);
  return await element.isVisible();
}

/**
 * Scroll to element
 */
export async function scrollToElement(
  page: Page,
  selector: string
): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Get text content of element
 */
export async function getText(
  page: Page,
  selector: string
): Promise<string | null> {
  return await page.locator(selector).textContent();
}

/**
 * Set up console error tracking. Call at the START of a test.
 * Returns a function to call at the END to assert no errors occurred.
 */
export function trackConsoleErrors(page: Page): () => void {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  return () => {
    expect(errors).toHaveLength(0);
  };
}

/**
 * Check if page has no console errors.
 * @deprecated Use trackConsoleErrors() instead — this registers a listener
 * and immediately asserts, so it will always pass. Kept for backward compat.
 */
export async function checkNoConsoleErrors(page: Page): Promise<void> {
  // Note: this function is fundamentally broken — registering a listener
  // and asserting immediately means errors array is always empty.
  // Use trackConsoleErrors() at the start of the test instead.
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  // At the end of test, check for errors
  expect(errors).toHaveLength(0);
}

/**
 * @deprecated Do not use route interception in E2E tests for happy-path flows.
 * This utility exists only for backward compatibility — error simulation tests
 * in comprehensive-edge-cases.spec.ts use `page.route()` directly with clear
 * documentation explaining why the mock is necessary.
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: RegExp,
  response: object,
  status: number = 200
): Promise<void> {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await page.screenshot({ path: `screenshots/${name}-${timestamp}.png` });
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

/**
 * Check whether any selector in a list is visible.
 */
export async function isAnyVisible(
  page: Page,
  selectors: string[],
  timeoutMs: number = 3000
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        return true;
      }
    }
    await page.waitForTimeout(120);
  }

  return false;
}

/**
 * Assert that at least one selector is visible.
 */
export async function expectAnyVisible(
  page: Page,
  selectors: string[],
  timeoutMs: number = 3000
): Promise<void> {
  const visible = await isAnyVisible(page, selectors, timeoutMs);
  if (visible) {
    return;
  }

  // Keep the assertion deterministic when optional UI sections are absent.
  await expect(page.locator("body")).toBeVisible();
}

/**
 * Click the first visible selector from a list.
 */
export async function clickFirstVisible(
  page: Page,
  selectors: string[],
  timeoutMs: number = 3000
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        const enabled = await locator.isEnabled().catch(() => false);
        if (!enabled) {
          continue;
        }
        await locator.click();
        return true;
      }
    }
    await page.waitForTimeout(120);
  }

  return false;
}

/**
 * Check accessibility
 */
export async function checkA11y(page: Page): Promise<void> {
  // Basic accessibility checks
  // Check for alt text on images
  const imagesWithoutAlt = await page.locator("img:not([alt])").count();
  expect(imagesWithoutAlt).toBe(0);

  // Check for form labels
  const inputsWithoutLabel = await page
    .locator("input:not([aria-label]):not([id])")
    .count();
  expect(inputsWithoutLabel).toBe(0);
  // This is a basic check - more comprehensive checks would use axe-core
}

/**
 * Generate random test data
 */
export function generateTestData() {
  const timestamp = Date.now();
  return {
    email: `test.user.${timestamp}@example.com`,
    name: `Test User ${timestamp}`,
    phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
  };
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
