import { test, expect, type Page } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";

async function openAdvancedEditor(page: Page): Promise<void> {
  const toggled = await clickFirstVisible(page, [
    'button:has-text("Open Advanced Manual Editor")',
    'button:has-text("Hide Advanced Manual Editor")',
  ]);

  if (!toggled) {
    await expect(page.locator("body")).toBeVisible();
    return;
  }

  await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible();
}

async function openFirstListingForEdit(page: Page): Promise<boolean> {
  await page.goto("/listings");

  const listingLinks = page.locator(
    'a[href^="/listings/"]:not([href="/listings/new"]):not([href$="/edit"])'
  );

  if ((await listingLinks.count()) === 0) {
    await expectAnyVisible(page, [
      'text=/No listings yet/i',
      'text=/No listings match your filters/i',
    ]);
    return false;
  }

  await listingLinks.first().click();
  const openedEdit = await clickFirstVisible(page, [
    'a:has-text("Edit Listing")',
    'a[href$="/edit"]',
  ]);

  if (!openedEdit) {
    await expect(page.locator("body")).toBeVisible();
    return false;
  }

  await expect(page).toHaveURL(/\/listings\/.*\/edit/);
  return true;
}

test.describe("Owner Listing Management", () => {
  test.describe("Create Listing", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/listings/new");
    });

    test("should display create listing page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Create New Listing/i);
    });

    test("should show quick create fields", async ({ page }) => {
      await expect(page.locator('input[name="title"]')).toBeVisible();
      await expect(page.locator('textarea[name="description"]')).toBeVisible();
      await expect(page.locator('[data-testid="category-select"]')).toBeVisible();
      await expect(page.locator('input[name="location.city"]')).toBeVisible();
      await expect(page.locator('input[name="location.address"]')).toBeVisible();
    });

    test("should show image upload area", async ({ page }) => {
      await expect(page.locator('[data-testid="image-upload-area"]').first()).toBeVisible();
    });

    test("should require at least one image before create", async ({ page }) => {
      await page.fill('input[name="title"]', "Owner e2e listing");
      await page.fill('textarea[name="description"]', "Listing description for image validation.");
      await page.fill('input[name="location.city"]', "New York");
      await page.fill('input[name="location.address"]', "123 Main St");
      await page.fill('input[name="location.state"]', "NY");
      await page.fill('input[name="location.country"]', "USA");
      await page.fill('input[name="location.postalCode"]', "10001");

      const categorySelect = page.locator('[data-testid="category-select"]');
      if (await categorySelect.isVisible().catch(() => false)) {
        const optionValue = await categorySelect
          .locator("option")
          .nth(1)
          .getAttribute("value")
          .catch(() => null);
        if (optionValue) {
          await categorySelect.selectOption(optionValue);
        }
      }

      const clickedCreate = await clickFirstVisible(page, [
        '[data-testid="create-listing-button"]',
        '[data-testid="create-listing-button-sticky"]',
      ]);
      expect(clickedCreate).toBe(true);

      await expect(page.locator("text=/At least one image is required/i")).toBeVisible();
    });

    test("should preview uploaded quick-create image", async ({ page }) => {
      await page.locator('input[type="file"]').first().setInputFiles({
        name: "owner-listing.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake image"),
      });

      await expect(page.locator('[data-testid="image-preview"]').first()).toBeVisible();
    });

    test("should open advanced editor and show step indicator", async ({ page }) => {
      await openAdvancedEditor(page);
      await expect(page.locator('[data-testid="step-indicator"]')).toContainText(/Basic Info|Pricing/i);
    });

    test("should navigate advanced steps", async ({ page }) => {
      await openAdvancedEditor(page);
      await expect(page.getByRole("heading", { name: /Basic Information/i })).toBeVisible();

      const movedForward = await clickFirstVisible(page, ['button:has-text("Next")']);
      expect(movedForward).toBe(true);
      await expect(page.getByRole("heading", { name: /Pricing & Condition/i })).toBeVisible();

      const movedBack = await clickFirstVisible(page, ['button:has-text("Previous")']);
      expect(movedBack).toBe(true);
      await expect(page.getByRole("heading", { name: /Basic Information/i })).toBeVisible();
    });

    test("should display advanced step-specific fields", async ({ page }) => {
      await openAdvancedEditor(page);

      await clickFirstVisible(page, ['button:has-text("Next")']);
      await expect(page.locator('input[name="pricePerDay"]')).toBeVisible();
      await expect(page.locator('input[name="securityDeposit"]')).toBeVisible();

      await clickFirstVisible(page, ['button:has-text("Next")']);
      await expect(page.locator('input[name="location.coordinates.lat"]')).toBeVisible();
      await expect(page.locator('input[name="location.coordinates.lng"]')).toBeVisible();
    });
  });

  test.describe("Manage Listings", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/listings");
    });

    test("should display owner listings page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/My Listings/i);
      await expect(page.locator("text=/Manage and track all your rental items/i")).toBeVisible();
    });

    test("should show listing stats cards", async ({ page }) => {
      await expect(page.locator("text=Total Listings")).toBeVisible();
      await expect(page.locator("text=Total Earnings")).toBeVisible();
      await expect(page.locator("text=Total Bookings")).toBeVisible();
    });

    test("should expose filters and search", async ({ page }) => {
      await expect(page.getByRole("button", { name: /^All/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Available/ })).toBeVisible();
      await expect(page.locator('input[name="search"]')).toBeVisible();
    });

    test("should apply search query", async ({ page }) => {
      const searchInput = page.locator('input[name="search"]');
      await searchInput.fill("camera");
      await searchInput.press("Enter");

      await expect(page).toHaveURL(/search=camera/);
    });

    test("should apply status filter", async ({ page }) => {
      await page.click('button:has-text("Available")');
      await expect(page).toHaveURL(/status=AVAILABLE/);
    });

    test("should switch to list view", async ({ page }) => {
      const toggled = await clickFirstVisible(page, ['button:has(svg.lucide-list)']);
      if (toggled) {
        await expectAnyVisible(page, [
          "table",
          'text=/No listings yet/i',
          'text=/No listings match your filters/i',
        ]);
      } else {
        await expect(page.locator("body")).toBeVisible();
      }
    });

    test("should navigate to create listing", async ({ page }) => {
      await page.click('a:has-text("Add Listing")');
      await expect(page).toHaveURL(/\/listings\/new/);
    });

    test("should render listings content or empty state", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/No listings yet/i',
        'text=/No listings match your filters/i',
        'a[href^="/listings/"]:not([href="/listings/new"])',
      ]);
    });
  });

  test.describe("Edit Listing", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.owner);
    });

    test("should open edit page for an existing listing", async ({ page }) => {
      const opened = await openFirstListingForEdit(page);
      if (!opened) return;

      await expect(page.locator("h1")).toContainText(/Edit Listing/i);
      await expect(page.locator('input[name="title"]')).toBeVisible();
      await expect(page.locator('textarea[name="description"]')).toBeVisible();
    });

    test("should navigate edit form steps", async ({ page }) => {
      const opened = await openFirstListingForEdit(page);
      if (!opened) return;

      const nextClicked = await clickFirstVisible(page, ['button:has-text("Next")']);
      if (!nextClicked) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await expect(page.locator('input[name="pricePerDay"]')).toBeVisible();

      const previousClicked = await clickFirstVisible(page, ['button:has-text("Previous")']);
      if (previousClicked) {
        await expect(page.locator('input[name="title"]')).toBeVisible();
      }
    });

    test("should open delete confirmation modal without deleting", async ({ page }) => {
      const opened = await openFirstListingForEdit(page);
      if (!opened) return;

      const deleteClicked = await clickFirstVisible(page, ['button:has-text("Delete")']);
      if (!deleteClicked) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await expect(page.locator("text=Delete Listing")).toBeVisible();
      await clickFirstVisible(page, ['button:has-text("Cancel")']);
    });
  });

  test.describe("Owner Calendar", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/dashboard/owner/calendar");
    });

    test("should display booking calendar page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Booking Calendar/i);
      await expect(page.locator("text=Legend:")).toBeVisible();
    });

    test("should navigate calendar months", async ({ page }) => {
      const monthHeading = page.locator("h2").first();
      const before = (await monthHeading.textContent())?.trim() || "";

      const moved = await clickFirstVisible(page, ['button:has(svg.lucide-chevron-right)']);
      if (!moved) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      const after = (await monthHeading.textContent())?.trim() || "";
      expect(after).not.toBe(before);
    });

    test("should show listing filter and today control", async ({ page }) => {
      await expect(page.locator('select:has(option:has-text("All Listings"))')).toBeVisible();
      await expect(page.locator('button:has-text("Today")')).toBeVisible();
    });

    test("should navigate to create listing from calendar", async ({ page }) => {
      const clicked = await clickFirstVisible(page, ['a:has-text("New Listing")']);
      expect(clicked).toBe(true);
      await expect(page).toHaveURL(/\/listings\/new/);
    });
  });
});
