import { test as base, expect, Page, BrowserContext } from "@playwright/test";

// Test user types
export interface TestUser {
  email: string;
  password: string;
  role: "renter" | "owner" | "admin";
}

// Test users
export const testUsers: Record<string, TestUser> = {
  renter: {
    email: "renter@test.com",
    password: "Test123!@#",
    role: "renter",
  },
  owner: {
    email: "owner@test.com",
    password: "Test123!@#",
    role: "owner",
  },
  admin: {
    email: "admin@test.com",
    password: "Test123!@#",
    role: "admin",
  },
};

// Extend the base test with fixtures
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

// Re-export expect
export { expect };

/**
 * Login as a specific user
 */
export async function loginAs(page: Page, user: TestUser): Promise<void> {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  
  // Wait for redirect based on role
  if (user.role === "admin") {
    await page.waitForURL(/.*admin|.*dashboard/);
  } else {
    await page.waitForURL(/.*dashboard/);
  }
}

/**
 * Logout the current user
 */
export async function logout(page: Page): Promise<void> {
  const userMenu = page.locator('[data-testid="user-menu"]');
  if (await userMenu.isVisible()) {
    await userMenu.click();
  }
  await page.click('text=/Logout|Sign Out/i');
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
    const availableDays = page.locator('[data-testid="calendar-day"]:not([disabled])');
    await availableDays.nth(startDaysFromNow).click();
    await availableDays.nth(endDaysFromNow).click();
  }
}

/**
 * Upload a file to a file input
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
    (response) => urlPattern.test(response.url()) && response.status() === status
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
  const loader = page.locator('[data-testid="loading"], [data-testid="spinner"]');
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
    const input = page.locator(`input[name="${name}"], textarea[name="${name}"]`);
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
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector);
  return await element.isVisible();
}

/**
 * Scroll to element
 */
export async function scrollToElement(page: Page, selector: string): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Get text content of element
 */
export async function getText(page: Page, selector: string): Promise<string | null> {
  return await page.locator(selector).textContent();
}

/**
 * Check if page has no console errors
 */
export async function checkNoConsoleErrors(page: Page): Promise<void> {
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
 * Mock API response
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
export async function takeScreenshot(
  page: Page,
  name: string
): Promise<void> {
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
 * Check accessibility
 */
export async function checkA11y(page: Page): Promise<void> {
  // Basic accessibility checks
  // Check for alt text on images
  const imagesWithoutAlt = await page.locator('img:not([alt])').count();
  expect(imagesWithoutAlt).toBe(0);
  
  // Check for form labels
  const inputsWithoutLabel = await page.locator('input:not([aria-label]):not([id])').count();
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
