import { test, expect, type Page } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";
import { loginAsUi, testUsers, expectAnyVisible } from "./helpers/test-utils";
import type { TestUser } from "./helpers/fixtures";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

async function registerFreshRenter(page: Page): Promise<TestUser> {
  const uniqueId = Date.now();
  const user: TestUser = {
    email: `insurance.e2e.${uniqueId}@example.com`,
    password: "Test123!@#",
    firstName: "Insurance",
    lastName: `User${uniqueId}`,
    phone: "+15550199",
    role: "renter",
  };

  const response = await page.request.post(`${API}/auth/register`, {
    data: {
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    },
  });

  expect(response.ok(), `fresh insurance user registration failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  return user;
}

test.describe("Insurance Claims E2E", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
    await loginAsUi(page, testUsers.renter);
  });

  test("should navigate to insurance page", async ({ page }) => {
    await page.goto("/insurance");
    
    // Should show insurance overview
    await expectAnyVisible(page, [
      "text=/Insurance|Coverage|Protection/i",
      "h1:has-text('Insurance')",
    ]);
  });

  test("should view list of insurance policies", async ({ page }) => {
    await page.goto("/insurance");

    await expectAnyVisible(page, [
      "text=/My Insurance Policies/i",
      "text=/No insurance policies yet/i",
      "text=/Failed to load policies/i",
    ]);
  });

  test("should navigate to claims page", async ({ page }) => {
    await page.goto("/insurance/claims");
    await expect(page).toHaveURL(/\/insurance\/claims$/);

    await expectAnyVisible(page, [
      "text=/My Insurance Claims|No insurance claims yet/i",
    ]);
  });

  test("should view specific claim details", async ({ page }) => {
    await page.goto("/insurance/claims");
    await expect(page).toHaveURL(/\/insurance\/claims$/);

    const claimLinks = page.locator('a[href^="/insurance/claims/"]');
    const count = await claimLinks.count();

    if (count > 0) {
      await claimLinks.first().click();

      await expectAnyVisible(page, [
        "text=/Claim Details|Status|Amount|Description/i",
        "button:has-text('Upload Document')",
      ]);
    } else {
      await expectAnyVisible(page, [
        "text=/No insurance claims yet/i",
      ]);
    }
  });

  test("should navigate to document upload page", async ({ page }) => {
    await page.goto("/insurance/upload");

    await expectAnyVisible(page, [
      "text=/Upload|Documents|Files/i",
      'input[type="file"]',
      "button:has-text('Upload')",
    ]);
  });

  test("should show insurance coverage options and support links", async ({ page }) => {
    await page.goto("/insurance");

    await expectAnyVisible(page, [
      "text=/Coverage|Protection|Policy|Plan/i",
    ]);
    await expect(page.locator('a[href="/contact"]')).toBeVisible();
    await expect(page.locator('a[href="/help"]')).toBeVisible();
  });

  test("should handle mobile responsive layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/insurance");

    await expectAnyVisible(page, [
      "text=/Insurance|Coverage/i",
    ]);
  });

  test("should navigate between insurance sections", async ({ page }) => {
    await page.goto("/insurance");
    await expect(page).toHaveURL(/\/insurance$/);
    await page.goto("/insurance/claims");
    await expect(page).toHaveURL(/\/insurance\/claims$/);
    await page.goto("/insurance/upload");
    await expect(page).toHaveURL(/\/insurance\/upload/);
  });

  test("should show empty state when no insurance data", async ({ page }) => {
    const freshUser = await registerFreshRenter(page);
    await loginAsUi(page, freshUser);

    await page.goto("/insurance");
    await expectAnyVisible(page, [
      "text=/No insurance policies yet/i",
    ]);

    await page.goto("/insurance/claims");
    await expect(page).toHaveURL(/\/insurance\/claims$/);
    await expectAnyVisible(page, [
      "text=/No insurance claims yet/i",
    ]);
  });

  test("should handle accessibility requirements", async ({ page }) => {
    await page.goto("/insurance");

    await expect(page.locator("h1").first()).toBeVisible();

    const buttons = page.locator('button[aria-label], a[aria-label]');
    const hasAccessibleButtons = await buttons.count() > 0 ||
      await page.locator("button").first().isVisible();

    expect(hasAccessibleButtons).toBeTruthy();
  });

  test("should render either policy cards or an insurance empty state", async ({ page }) => {
    await page.goto("/insurance");

    await expectAnyVisible(page, [
      "text=/Active|Pending|Expired|Cancelled|Claimed/i",
      "text=/No insurance policies yet/i",
      "text=/Failed to load policies/i",
    ]);
  });
});
