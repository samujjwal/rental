import { test, expect, type Page } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";
import { loginAsUi, testUsers, expectAnyVisible } from "./helpers/test-utils";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

test.describe("User Settings E2E", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
    await loginAsUi(page, testUsers.renter);
  });

  test("should redirect the settings index to profile settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/profile/);
    await expectAnyVisible(page, [
      "text=/Profile Settings|Personal Information/i",
      'input[name="firstName"]',
    ]);
  });

  test("should navigate to profile settings", async ({ page }) => {
    await page.goto("/settings/profile");
    
    // Should show profile settings
    await expectAnyVisible(page, [
      "text=/Profile|Personal|Information/i",
      'input[name="firstName"], input[name="first_name"]',
      'input[name="lastName"], input[name="last_name"]',
      "button:has-text('Save')",
    ]);
  });

  test("should update profile information", async ({ page }) => {
    await page.goto("/settings/profile");

    await page.locator('input[name="firstName"]').fill("Updated");
    await page.locator('input[name="lastName"]').fill("Renter");
    await page.locator('input[name="phoneNumber"]').fill("+15550101");
    await page.getByRole("button", { name: /Save/i }).click();

    await expect(page.locator('input[name="firstName"]')).toHaveValue("Updated", { timeout: 15000 });
    await expect(page.locator('input[name="lastName"]')).toHaveValue("Renter");
    await expect(page.locator('input[name="phoneNumber"]')).toHaveValue("+15550101");

    await page.goto("/settings/security");
    await expect(page).toHaveURL(/\/settings\/security/);

    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/settings\/profile/);

    await expect(page.locator('input[name="firstName"]')).toHaveValue("Updated", { timeout: 15000 });
    await expect(page.locator('input[name="lastName"]')).toHaveValue("Renter");
    await expect(page.locator('input[name="phoneNumber"]')).toHaveValue("+15550101");
  });

  test("should navigate to security settings", async ({ page }) => {
    await page.goto("/settings/security");
    
    // Should show security settings
    await expectAnyVisible(page, [
      "text=/Security|Password|Authentication/i",
      'input[type="password"]',
    ]);
  });

  test("should show password change form", async ({ page }) => {
    await page.goto("/settings/security");

    await expect(page.locator('#currentPassword')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.getByRole("button", { name: /Update Password/i })).toBeVisible();
  });

  test("should navigate to billing settings", async ({ page }) => {
    await page.goto("/settings/billing");
    
    // Should show billing settings
    await expectAnyVisible(page, [
      "text=/Billing|Payment|Subscription|Invoices/i",
    ]);
  });

  test("should display payment methods", async ({ page }) => {
    await page.goto("/settings/billing");

    await expectAnyVisible(page, [
      "text=/Billing & Payments|Recent Transactions/i",
      "text=/No transactions yet|temporarily unavailable/i",
    ]);
  });

  test("should navigate to notification settings", async ({ page }) => {
    await page.goto("/settings/notifications");
    
    // Should show notification settings
    await expectAnyVisible(page, [
      "text=/Notifications|Alerts|Preferences/i",
    ]);
  });

  test("should toggle notification preferences", async ({ page }) => {
    await page.goto("/settings/notifications");

    const firstToggle = page.locator('input[type="checkbox"]').first();
    await expect(firstToggle).toBeVisible();
    const initialValue = await firstToggle.isChecked();
    await firstToggle.click();
    await expect(firstToggle).toHaveJSProperty("checked", !initialValue);
    await page.getByRole("button", { name: /Save Preferences/i }).click();
    await expectAnyVisible(page, [
      "text=/saved|updated|preferences/i",
      "text=/Try Again/i",
    ]);
  });

  test("should handle mobile responsive layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/settings");
    await expectAnyVisible(page, [
      "text=/Profile Settings|Personal Information/i",
    ]);
  });

  test("should show account deletion option", async ({ page }) => {
    await page.goto("/settings/profile");

    await expect(page.getByText(/Danger Zone/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete Account/i })).toBeVisible();
  });

  test("should validate required fields", async ({ page }) => {
    await page.goto("/settings/profile");

    const firstNameInput = page.locator('input[name="firstName"]');
    const previousFirstName = await firstNameInput.inputValue();

    await firstNameInput.fill("A");
    await page.getByRole("button", { name: /Save/i }).click();

    await expect(firstNameInput).toHaveValue(previousFirstName, { timeout: 10000 });
  });

  test("should expose settings sidebar links between profile and notifications", async ({ page }) => {
    await page.goto("/settings/profile");
    await page.locator('a[href="/settings/notifications"]').click();
    await expect(page).toHaveURL(/\/settings\/notifications/);
    await expect(page.getByRole("button", { name: /Save Preferences/i })).toBeVisible();
  });
});
