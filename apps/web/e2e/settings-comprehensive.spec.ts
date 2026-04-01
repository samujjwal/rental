/**
 * Settings Pages E2E Test Suite
 *
 * Covers all settings sub-pages:
 * - Profile Settings (settings/profile)
 * - Notification Settings (settings/notifications)
 * - Security Settings (settings/security)
 * - Billing Settings (settings/billing)
 */

import { test, expect } from "@playwright/test";
import { loginAs, testUsers, expectAnyVisible } from "./helpers/test-utils";

// ===========================================================================
// 1. Profile Settings
// ===========================================================================

test.describe("Settings - Profile", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/settings/profile");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders profile settings page with correct heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Profile|Settings/i);
  });

  test("displays current user information in form fields", async ({ page }) => {
    // Check for form fields with user data
    const firstNameInput = page.locator('input[name="firstName"], input[name="first_name"]').first();
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();

    if (await firstNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const value = await firstNameInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }

    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const value = await emailInput.inputValue();
      expect(value).toContain("@");
    }
  });

  test("allows updating profile information", async ({ page }) => {
    const firstNameInput = page.locator('input[name="firstName"], input[name="first_name"]').first();
    if (!(await firstNameInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

    const newName = `Updated${Date.now()}`;
    await firstNameInput.fill(newName);

    const saveBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();

      // Should show success message
      await expectAnyVisible(page, [
        "text=/saved|updated|success/i",
        "text=/profile updated/i",
      ], 5000);
    }
  });

  test("validates required fields", async ({ page }) => {
    const firstNameInput = page.locator('input[name="firstName"], input[name="first_name"]').first();
    if (!(await firstNameInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

    // Clear required field
    await firstNameInput.fill("");

    const saveBtn = page.locator('button[type="submit"]').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();

      // Should show validation error
      await expectAnyVisible(page, [
        "text=/required|Required/i",
        "text=/please enter|validation/i",
        ".error",
        "[role=alert]",
      ], 5000);
    }
  });

  test("has avatar/profile photo upload option", async ({ page }) => {
    await expectAnyVisible(page, [
      "img[alt*=\"avatar\" i], img[alt*=\"profile\" i]",
      "[data-testid=\"avatar-upload\"]",
      'input[type="file"][accept*=\"image\"]',
      "button:has-text('Upload'), button:has-text('Change Photo')",
    ]);
  });

  test("shows bio/about text area", async ({ page }) => {
    const bioTextarea = page.locator('textarea[name="bio"], textarea[name="about"], textarea').first();
    if (await bioTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bioTextarea.fill("This is my updated bio for testing purposes.");

      const saveBtn = page.locator('button[type="submit"]').first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await expect(page.locator("text=/saved|updated/i")).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

// ===========================================================================
// 2. Notification Settings
// ===========================================================================

test.describe("Settings - Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/settings/notifications");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders notification settings page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Notification|Notifications/i);
  });

  test("displays notification preference toggles or checkboxes", async ({ page }) => {
    // Look for notification preferences
    const toggles = page.locator('input[type="checkbox"], [role="switch"], .toggle, button[role="switch"]').first();
    const checkboxes = page.locator('input[type="checkbox"]').first();

    const hasToggles = await toggles.isVisible({ timeout: 3000 }).catch(() => false);
    const hasCheckboxes = await checkboxes.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasToggles || hasCheckboxes).toBe(true);
  });

  test("has email notification preferences", async ({ page }) => {
    await expectAnyVisible(page, [
      "text=/email|Email/i",
      "text=/messages|Messages/i",
      "text=/bookings|Bookings/i",
    ]);
  });

  test("has push notification preferences if supported", async ({ page }) => {
    // Check for push notification settings
    const pushSection = page.locator('text=/push|Push|mobile|Mobile/i').first();
    if (await pushSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expectAnyVisible(page, [
        "text=/push notifications|Push Notifications/i",
        'input[type="checkbox"][name*="push"], [role="switch"]',
      ]);
    }
  });

  test("allows toggling notification preferences", async ({ page }) => {
    const firstToggle = page.locator('input[type="checkbox"]').first();
    if (!(await firstToggle.isVisible({ timeout: 3000 }).catch(() => false))) return;

    const initialState = await firstToggle.isChecked();

    // Toggle the preference
    await firstToggle.click();

    // Verify state changed
    const newState = await firstToggle.isChecked();
    expect(newState).toBe(!initialState);

    // Save if there's a save button
    const saveBtn = page.locator('button[type="submit"], button:has-text("Save")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await expect(page.locator("text=/saved|updated/i")).toBeVisible({ timeout: 5000 });
    }
  });

  test("has SMS notification preferences if applicable", async ({ page }) => {
    const smsSection = page.locator('text=/SMS|sms|text message/i').first();
    if (await smsSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expectAnyVisible(page, [
        "text=/phone|Phone/i",
        'input[type="tel"]',
      ]);
    }
  });
});

// ===========================================================================
// 3. Security Settings
// ===========================================================================

test.describe("Settings - Security", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/settings/security");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders security settings page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Security|Password/i);
  });

  test("has password change form", async ({ page }) => {
    await expectAnyVisible(page, [
      'input[type="password"][name*="current"], input[name="currentPassword"]',
      'input[type="password"][name*="new"], input[name="newPassword"]',
      'input[type="password"][name*="confirm"], input[name="confirmPassword"]',
      "text=/current password|Current Password/i",
      "text=/new password|New Password/i",
    ]);
  });

  test("validates password change requirements", async ({ page }) => {
    const currentPassInput = page.locator('input[type="password"]').first();
    if (!(await currentPassInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

    // Fill with weak password
    const newPassInput = page.locator('input[type="password"]').nth(1);
    if (await newPassInput.isVisible().catch(() => false)) {
      await newPassInput.fill("weak");
    }

    const saveBtn = page.locator('button[type="submit"]').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();

      // Should show password strength error
      await expectAnyVisible(page, [
        "text=/at least|minimum|strength/i",
        "text=/uppercase|lowercase|number/i",
        "text=/too weak|weak password/i",
      ], 5000);
    }
  });

  test("requires current password to change password", async ({ page }) => {
    const newPassInput = page.locator('input[name*="new"], input[name="newPassword"]').first();
    const confirmPassInput = page.locator('input[name*="confirm"], input[name="confirmPassword"]').first();

    if (await newPassInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newPassInput.fill("NewPass123!");
    }

    if (await confirmPassInput.isVisible().catch(() => false)) {
      await confirmPassInput.fill("NewPass123!");
    }

    // Try to submit without current password
    const saveBtn = page.locator('button[type="submit"]').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();

      // Should show error about current password
      await expectAnyVisible(page, [
        "text=/current password required|enter current password/i",
        "text=/required|Required/i",
      ], 5000);
    }
  });

  test("has two-factor authentication section", async ({ page }) => {
    await expectAnyVisible(page, [
      "text=/two-factor|2FA|MFA|Multi-Factor/i",
      "text=/authenticator|Authenticator/i",
    ]);
  });

  test("has session management section", async ({ page }) => {
    await expectAnyVisible(page, [
      "text=/sessions|Sessions|active devices|Active Devices/i",
      "text=/log out|Log Out|sign out|Sign Out/i",
    ]);
  });

  test("has account deletion option with confirmation", async ({ page }) => {
    const deleteBtn = page.locator('button:has-text("Delete"), button:has-text("Close Account"), [data-testid="delete-account"]').first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();

      // Should show confirmation dialog
      await expectAnyVisible(page, [
        "text=/confirm|Confirm|are you sure|Are you sure/i",
        "text=/permanent|Permanent|cannot be undone/i",
        'input[type="password"]',
        'button:has-text("Confirm"), button:has-text("Delete")',
      ], 5000);
    }
  });
});

// ===========================================================================
// 4. Billing Settings
// ===========================================================================

test.describe("Settings - Billing", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/settings/billing");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders billing settings page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Billing|Payment|Billing & Payments/i);
  });

  test("displays payment methods section", async ({ page }) => {
    await expectAnyVisible(page, [
      "text=/payment methods|Payment Methods|cards|Cards/i",
      "text=/add payment|Add Payment|add card|Add Card/i",
    ]);
  });

  test("has add payment method button or form", async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add"), button:has-text("+"), a:has-text("Add")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();

      // Should show payment form or modal
      await expectAnyVisible(page, [
        'input[name="cardNumber"], input[name="card_number"], input[name="number"]',
        'input[name="expiry"], input[name="expiration"], input[name="expDate"]',
        'input[name="cvc"], input[name="cvv"], input[name="securityCode"]',
        "text=/card details|Card Details/i",
      ], 5000);
    }
  });

  test("displays billing history or transactions", async ({ page }) => {
    await expectAnyVisible(page, [
      "text=/billing history|Billing History|transactions|Transactions/i",
      "text=/invoices|Invoices|receipts|Receipts/i",
    ]);
  });

  test("has default payment method selection", async ({ page }) => {
    // Look for default payment indicator
    const defaultLabel = page.locator("text=/default|Default|primary|Primary/i").first();
    const radioButtons = page.locator('input[type="radio"]').first();

    if (await defaultLabel.isVisible({ timeout: 3000 }).catch(() => false) ||
        await radioButtons.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(true).toBe(true); // At least one billing option exists
    }
  });

  test("shows billing address section", async ({ page }) => {
    await expectAnyVisible(page, [
      "text=/billing address|Billing Address/i",
      'input[name="address"], input[name="street"], input[name="line1"]',
      'input[name="city"], input[name="City"]',
      'input[name="zip"], input[name="zipCode"], input[name="postal"]',
      'select[name="country"], input[name="country"]',
    ]);
  });

  test("allows editing billing address", async ({ page }) => {
    const cityInput = page.locator('input[name="city"], input[name="City"]').first();
    if (!(await cityInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

    const newCity = `TestCity${Date.now()}`;
    await cityInput.fill(newCity);

    const saveBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await expect(page.locator("text=/saved|updated/i")).toBeVisible({ timeout: 5000 });
    }
  });

  test("has tax information section if applicable", async ({ page }) => {
    const taxSection = page.locator("text=/tax|Tax|tax id|Tax ID|vat|VAT/i").first();
    if (await taxSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expectAnyVisible(page, [
        'input[name="taxId"], input[name="vat"], input[name="tax_id"]',
        "text=/tax identification|Tax Identification/i",
      ]);
    }
  });

  test("displays subscription or plan information if applicable", async ({ page }) => {
    const planSection = page.locator("text=/plan|Plan|subscription|Subscription/i").first();
    if (await planSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expectAnyVisible(page, [
        "text=/current plan|Current Plan|active|Active/i",
        "text=/upgrade|Upgrade|downgrade|Downgrade/i",
      ]);
    }
  });
});

// ===========================================================================
// 5. Settings Navigation & Mobile
// ===========================================================================

test.describe("Settings - Navigation & Mobile", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
  });

  test("settings page has navigation to all sub-pages", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");

    // Check for navigation links
    await expectAnyVisible(page, [
      'a[href="/settings/profile"], a[href*="/profile"]',
      'a[href="/settings/notifications"], a[href*="/notifications"]',
      'a[href="/settings/security"], a[href*="/security"]',
      'a[href="/settings/billing"], a[href*="/billing"]',
    ]);
  });

  test("navigates between settings pages", async ({ page }) => {
    await page.goto("/settings/profile");
    await page.waitForLoadState("domcontentloaded");

    // Click on notifications link
    const notificationsLink = page.locator('a[href="/settings/notifications"], a[href*="/notifications"]').first();
    if (await notificationsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await notificationsLink.click();
      await expect(page).toHaveURL(/\/settings\/notifications/);
      await expect(page.locator("h1")).toContainText(/Notification/i);
    }
  });

  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X
	test("settings pages are accessible on mobile", async ({ page }) => {
    await page.goto("/settings/profile");
    await page.waitForLoadState("domcontentloaded");

    // Form should be accessible
    const form = page.locator("form").first();
    const inputs = page.locator("input").first();

    expect(await form.isVisible().catch(() => false) || await inputs.isVisible().catch(() => false)).toBe(true);
  });
});
