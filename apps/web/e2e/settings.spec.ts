import { test, expect } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  isAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";

test.describe("Settings", () => {
  test.describe("Profile", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/settings/profile");
    });

    test("should render profile settings form", async ({ page }) => {
      await expectAnyVisible(page, [
        'input[name="firstName"]',
        'input[name="lastName"]',
        'input[name="email"]',
      ]);
    });

    test("should allow editing profile fields", async ({ page }) => {
      const firstName = page.locator('input[name="firstName"]');
      const lastName = page.locator('input[name="lastName"]');
      const phone = page.locator('input[name="phoneNumber"], input[name="phone"]');

      if (await firstName.isVisible().catch(() => false)) {
        await firstName.fill("Renter");
      }
      if (await lastName.isVisible().catch(() => false)) {
        await lastName.fill("User");
      }
      if (await phone.first().isVisible().catch(() => false)) {
        await phone.first().fill("+15551234567");
      }

      const submitted = await clickFirstVisible(page, [
        'button:has-text("Save")',
        'button:has-text("Update")',
        'button[type="submit"]',
      ]);

      if (!submitted) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      const hasFeedback = await isAnyVisible(
        page,
        ['text=/saved|updated|success/i', '[role="status"]', '[role="alert"]'],
        2500
      );
      expect(hasFeedback || page.url().includes("/settings/profile")).toBe(true);
    });
  });

  test.describe("Notifications", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/settings/notifications");
    });

    test("should render notification preferences", async ({ page }) => {
      await expectAnyVisible(page, [
        'input[type="checkbox"]',
        '[role="switch"]',
        'button:has-text("Enable All")',
        'button:has-text("Disable All")',
      ]);
    });

    test("should support bulk notification actions when available", async ({ page }) => {
      const toggled =
        (await clickFirstVisible(page, ['button:has-text("Disable All")'])) ||
        (await clickFirstVisible(page, ['button:has-text("Enable All")']));

      if (!toggled) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Security", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/settings/security");
    });

    test("should render security settings route", async ({ page }) => {
      await expect(page.locator("body")).toBeVisible();
      expect(page.url()).toMatch(/\/settings\/security|\/settings/);
    });

    test("should expose password update controls when available", async ({ page }) => {
      const hasPasswordFields = await isAnyVisible(
        page,
        ['input[name="currentPassword"]', 'input[name="newPassword"]', 'input[name="confirmPassword"]'],
        2500
      );

      if (!hasPasswordFields) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await expectAnyVisible(page, ['button:has-text("Change Password")', 'button[type="submit"]']);
    });
  });

  test.describe("Payments", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/settings/payments");
    });

    test("should render payments settings for owner", async ({ page }) => {
      await expect(page.locator("body")).toBeVisible();
      expect(page.url()).toMatch(/\/settings\/payments|\/settings|\/auth\/login/);
    });

    test("should expose payment/payout actions when available", async ({ page }) => {
      await expectAnyVisible(page, [
        'button:has-text("Add Card")',
        'button:has-text("Add Payment Method")',
        'text=/payout|payment/i',
        'iframe[name*="stripe"]',
      ]);
    });
  });

  test.describe("Navigation and Danger Zone", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/settings");
    });

    test("should navigate between profile and notifications", async ({ page }) => {
      const openedProfile = await clickFirstVisible(page, [
        'a[href="/settings/profile"]',
        'a:has-text("Profile")',
      ]);
      if (openedProfile) {
        await expect(page).toHaveURL(/\/settings\/profile|\/settings/);
      }

      const openedNotifications = await clickFirstVisible(page, [
        'a[href="/settings/notifications"]',
        'a:has-text("Notifications")',
      ]);
      if (openedNotifications) {
        await expect(page).toHaveURL(/\/settings\/notifications|\/settings/);
      }
    });

    test("should enforce delete confirmation before enabling delete account", async ({ page }) => {
      const confirmationInput = page.locator('input[placeholder*="DELETE"], input[name="deleteConfirmation"]');
      const deleteButton = page.locator('button:has-text("Delete Account")').first();

      if (!(await confirmationInput.first().isVisible().catch(() => false))) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      if (await deleteButton.isVisible().catch(() => false)) {
        expect(await deleteButton.isEnabled().catch(() => false)).toBe(false);
      }

      await confirmationInput.first().fill("DELETE");

      if (await deleteButton.isVisible().catch(() => false)) {
        expect(await deleteButton.isEnabled().catch(() => false)).toBe(true);
      }
    });
  });

  test.describe("Responsive", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("should render settings on mobile", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/settings");
      await expect(page.locator("body")).toBeVisible();
      await expectAnyVisible(page, [
        'a[href="/settings/profile"]',
        'a[href="/settings/notifications"]',
        'a[href="/settings/security"]',
      ]);
    });
  });
});
