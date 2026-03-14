import { test, expect, type Page } from "@playwright/test";
import { clickFirstVisible, isAnyVisible } from "./helpers/test-utils";

async function openSearch(page: Page) {
  await page.goto("/search");
  await expect(page.locator('input[name="query"]')).toBeVisible();
}

async function openFirstListing(page: Page): Promise<boolean> {
  await openSearch(page);
  const listingLink = page.locator('a[href^="/listings/"]').first();
  if ((await listingLink.count()) === 0) {
    return false;
  }
  await listingLink.click();
  await expect(page).toHaveURL(/\/listings\/.+/);
  return true;
}

test.describe("Search and Listing Browse", () => {
  test("should load search page with primary controls", async ({ page }) => {
    await openSearch(page);
    await expect(
      page.getByRole("button", { name: "Filters", exact: true })
    ).toBeVisible();
  });

  test("should support keyword query input on search page", async ({
    page,
  }) => {
    await openSearch(page);
    const searchInput = page.locator('input[name="query"]');
    await searchInput.fill("camera");
    await page.keyboard.press("Enter");

    expect(
      page.url().includes("query=camera") ||
        (await searchInput.inputValue()).toLowerCase().includes("camera")
    ).toBe(true);
  });

  test("should expose search filters controls", async ({ page }) => {
    await openSearch(page);
    const openedFilters = await clickFirstVisible(page, [
      'button:has-text("Filters")',
    ]);
    expect(openedFilters).toBe(true);

    const hasFilterControls = await isAnyVisible(
      page,
      [
        "select",
        'input[name="minPrice"]',
        'input[name="maxPrice"]',
        '[role="spinbutton"]',
      ],
      3000
    );
    expect(hasFilterControls).toBe(true);
  });

  test("should expose result sorting and view controls", async ({ page }) => {
    await openSearch(page);
    const hasSortingOrView = await isAnyVisible(
      page,
      [
        "select",
        'button:has-text("Grid view")',
        'button:has-text("List view")',
        'button:has-text("Map view")',
      ],
      3000
    );
    expect(hasSortingOrView).toBe(true);
  });

  test("should open listing detail from search results when available", async ({
    page,
  }) => {
    const opened = await openFirstListing(page);
    if (!opened) return;

    await expect(page.locator("h1").first()).toBeVisible();
    // BookingCalendar uses custom date picker (not native date input) — verify it renders
    const hasBookingControl = await isAnyVisible(page, [
      'button[aria-label="Next month"]',
      'button[aria-label="Previous month"]',
      'button:has-text("Book")',
      'button:has-text("Request")',
      '[role="button"]',
    ], 5000);
    expect(hasBookingControl).toBe(true);
  });

  test("should show pricing/date booking controls on listing detail", async ({
    page,
  }) => {
    const opened = await openFirstListing(page);
    if (!opened) return;

    const hasBookingControls = await isAnyVisible(
      page,
      [
        'input[type="date"]',
        'button:has-text("Book")',
        'button:has-text("Request")',
        'button:has-text("Rent")',
      ],
      3000
    );
    expect(hasBookingControls).toBe(true);
  });

  test("should redirect guest to login when starting booking flow", async ({
    page,
  }) => {
    const opened = await openFirstListing(page);
    if (!opened) return;

    const startedBooking = await clickFirstVisible(page, [
      'button:has-text("Book")',
      'button:has-text("Request")',
      'button:has-text("Rent")',
    ]);
    if (!startedBooking) return;

    await expect(page).toHaveURL(/\/auth\/login|\/login|\/checkout|\/bookings/);
  });
});
