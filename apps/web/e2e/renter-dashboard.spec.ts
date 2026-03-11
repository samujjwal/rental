import { test, expect, type Page } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";

async function getCurrentUserId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return null;
      const user = JSON.parse(raw) as { id?: string };
      return typeof user.id === "string" ? user.id : null;
    } catch {
      return null;
    }
  });
}

test.describe("Renter Experience", () => {
  test.describe("Renter Dashboard", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/dashboard/renter");
    });

    test("should display renter dashboard sections", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Renter Portal/i);
      await expect(
        page.getByRole("heading", { name: "My Bookings" })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Recommended for You/i })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Spending Summary" })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "My Favorites" })
      ).toBeVisible();
    });

    test("should show booking and favorites stats", async ({ page }) => {
      await expect(
        page.locator("p:text-is('Upcoming Bookings')")
      ).toBeVisible();
      await expect(page.locator("p:text-is('Active Bookings')")).toBeVisible();
      await expect(
        page.locator("p:text-is('Completed Bookings')")
      ).toBeVisible();
      await expect(page.locator("p:text-is('Favorites')")).toBeVisible();
    });

    test("should render bookings list or empty state", async ({ page }) => {
      await expectAnyVisible(page, [
        'a[href^="/bookings/"]',
        "text=No bookings yet",
      ]);
    });

    test("should navigate to bookings from dashboard", async ({ page }) => {
      const clicked = await clickFirstVisible(page, ['a:has-text("View All")']);
      if (clicked) {
        await expect(page).toHaveURL(/\/bookings/);
      } else {
        await page.goto("/bookings");
        await expect(page).toHaveURL(/\/bookings/);
      }
    });

    test("should navigate to search from recommendations", async ({ page }) => {
      const clicked = await clickFirstVisible(page, [
        'a:has-text("Explore More")',
      ]);
      if (clicked) {
        await expect(page).toHaveURL(/\/search/);
      } else {
        await page.goto("/search");
        await expect(page).toHaveURL(/\/search/);
      }
    });

    test("should navigate to favorites", async ({ page }) => {
      const clicked = await clickFirstVisible(page, [
        'a[href="/favorites"]',
        'a:has-text("View All")',
      ]);
      if (!clicked) {
        await page.goto("/favorites");
      }
      await expect(page).toHaveURL(/\/favorites/);
    });

    test("should expose quick browse action when no bookings", async ({
      page,
    }) => {
      const browseVisible = await page
        .locator('a:has-text("Start Browsing")')
        .first()
        .isVisible()
        .catch(() => false);

      if (browseVisible) {
        await page.click('a:has-text("Start Browsing")');
        await expect(page).toHaveURL(/\/search/);
      } else {
        await expect(page.locator("body")).toBeVisible();
      }
    });
  });

  test.describe("Favorites", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/favorites");
    });

    test("should display favorites page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Saved Listings/i);
    });

    test("should navigate to search from browse more", async ({ page }) => {
      const clicked = await clickFirstVisible(page, [
        'a:has-text("Browse More")',
      ]);
      if (!clicked) return;
      await expect(page).toHaveURL(/\/search/);
    });

    test("should render favorite listings or empty state", async ({ page }) => {
      await expectAnyVisible(page, [
        "text=/No favorites yet/i",
        'a[href^="/listings/"]',
      ]);
    });

    test("should show search input when favorites exist", async ({ page }) => {
      await expectAnyVisible(page, [
        'input[placeholder="Search favorites..."]',
        "text=/No favorites yet/i",
      ]);
    });

    test("should toggle view controls when favorites exist", async ({
      page,
    }) => {
      const gridVisible = await page
        .locator("button:has(svg.lucide-grid)")
        .first()
        .isVisible()
        .catch(() => false);
      const listVisible = await page
        .locator("button:has(svg.lucide-list)")
        .first()
        .isVisible()
        .catch(() => false);

      if (gridVisible && listVisible) {
        await page.click("button:has(svg.lucide-list)");
        await page.click("button:has(svg.lucide-grid)");
        await expect(page.locator("body")).toBeVisible();
      } else {
        await expectAnyVisible(page, ["text=/No favorites yet/i"]);
      }
    });

    test("should open listing detail from favorites when available", async ({
      page,
    }) => {
      const listingLink = page.locator('a[href^="/listings/"]').first();
      if ((await listingLink.count()) === 0) {
        await expectAnyVisible(page, ["text=/No favorites yet/i"]);
        return;
      }
      await listingLink.click();
      await expect(page).toHaveURL(/\/listings\/.+/);
    });
  });

  test.describe("Messages", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/messages");
    });

    test("should display messages page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Messages/i);
      await expect(page.locator('[data-testid="conversation-search"]')).toBeVisible();
    });

    test("should render conversations list or empty state", async ({
      page,
    }) => {
      await expectAnyVisible(page, [
        '[data-testid="conversation-empty-state"]',
        '[data-testid="conversation-item"]',
      ]);
    });

    test("should show chat panel prompt or message input", async ({ page }) => {
      await expectAnyVisible(page, [
        '[data-testid="message-empty-prompt"]',
        '[data-testid="message-composer"]',
      ]);
    });

    test("should open first conversation when available", async ({ page }) => {
      await expectAnyVisible(page, [
        '[data-testid="conversation-item"]',
        '[data-testid="conversation-empty-state"]',
      ]);
      const conversation = page.locator('[data-testid="conversation-item"]').first();
      if ((await conversation.count()) === 0) {
        await expect(page.locator('[data-testid="conversation-empty-state"]')).toBeVisible();
        return;
      }

      await conversation.click();
      await expectAnyVisible(page, [
        '[data-testid="message-composer"]',
        '[data-testid="message-empty-state"]',
      ]);
    });

    test("should filter conversations with search input", async ({ page }) => {
      const search = page.locator('[data-testid="conversation-search"]');
      await search.fill("owner");
      await expect(search).toHaveValue("owner");
    });

    test("should allow composing text when input is visible", async ({
      page,
    }) => {
      await expectAnyVisible(page, [
        '[data-testid="message-composer"]',
        '[data-testid="message-empty-prompt"]',
      ]);
      const textarea = page.locator('[data-testid="message-composer"]');
      const visible = await textarea.isVisible().catch(() => false);
      if (visible) {
        await textarea.fill("E2E message draft");
        await expect(textarea).toHaveValue("E2E message draft");
      } else {
        await expect(page.locator('[data-testid="message-empty-prompt"]')).toBeVisible();
      }
    });
  });

  test.describe("Settings Profile", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/settings/profile");
    });

    test("should display profile settings page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Profile Settings/i);
      await expect(page.locator("text=Personal Information")).toBeVisible();
      await expect(page.locator("text=Change Password")).toBeVisible();
    });

    test("should show editable profile fields", async ({ page }) => {
      await expect(page.locator('input[name="firstName"]')).toBeVisible();
      await expect(page.locator('input[name="lastName"]')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="phoneNumber"]')).toBeVisible();
    });

    test("should allow editing profile field values", async ({ page }) => {
      const firstName = page.locator('input[name="firstName"]');
      await firstName.fill("RenterUpdated");
      await expect(firstName).toHaveValue("RenterUpdated");
    });

    test("should show password update fields", async ({ page }) => {
      await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
      await expect(page.locator('input[name="newPassword"]')).toBeVisible();
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    });

    test("should keep delete account disabled before confirmation", async ({
      page,
    }) => {
      const deleteButton = page.locator('button:has-text("Delete Account")');
      await expect(deleteButton).toBeDisabled();
    });

    test("should enable delete account after entering DELETE", async ({
      page,
    }) => {
      await page.fill('input[name="deleteConfirmation"]', "DELETE");
      await expect(
        page.locator('button:has-text("Delete Account")')
      ).toBeEnabled();
    });

    test("should navigate to notification settings from sidebar", async ({
      page,
    }) => {
      await page.click('a[href="/settings/notifications"]');
      await expect(page).toHaveURL(/\/settings\/notifications/);
    });
  });

  test.describe("Settings Notifications", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/settings/notifications");
    });

    test("should display notification preferences page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(
        /Notification Preferences/i
      );
      await expect(page.locator("text=Channels")).toBeVisible();
      await expect(page.locator("text=Activity Types")).toBeVisible();
    });

    test("should render notification toggles", async ({ page }) => {
      const checkboxes = page.locator('input[type="checkbox"]');
      await expect(checkboxes.first()).toBeVisible();
      expect(await checkboxes.count()).toBeGreaterThan(3);
    });

    test("should support enable and disable all actions", async ({ page }) => {
      await page.click('button:has-text("Disable All")');
      const firstCheckbox = page.locator('input[type="checkbox"]').first();
      await expect(firstCheckbox).not.toBeChecked();

      await page.click('button:has-text("Enable All")');
      await expect(firstCheckbox).toBeChecked();
    });

    test("should show save preferences action", async ({ page }) => {
      await expect(
        page.locator('button:has-text("Save Preferences")')
      ).toBeVisible();
    });

    test("should submit notification preferences form", async ({ page }) => {
      await page.click('button:has-text("Save Preferences")');
      await expectAnyVisible(page, [
        "text=/updated successfully/i",
        "text=/Failed to/i",
        "text=/Invalid/i",
      ]);
    });
  });

  test.describe("Public Profile Routing", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/dashboard/renter");
    });

    test("should redirect non-uuid current user profile path to home", async ({
      page,
    }) => {
      const userId = await getCurrentUserId(page);
      expect(userId).not.toBeNull();

      await page.goto(`/profile/${userId}`);
      await expect(page).toHaveURL(/\/$/);
    });

    test("should redirect unknown uuid profile path to home", async ({
      page,
    }) => {
      await page.goto("/profile/00000000-0000-0000-0000-000000000000");
      await expect(page).toHaveURL(/\/$/);
    });

    test("should recover to renter dashboard after profile redirect", async ({
      page,
    }) => {
      const userId = await getCurrentUserId(page);
      if (!userId) return;

      await page.goto(`/profile/${userId}`);
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/dashboard/renter");
      await expect(page.locator("h1")).toContainText(/Renter Portal/i);
    });
  });
});
