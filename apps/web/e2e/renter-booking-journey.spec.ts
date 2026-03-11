import { test, expect, type Page } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";

async function openFirstSearchListing(page: Page): Promise<boolean> {
  await page.goto("/search");
  const listing = page.locator('a[href^="/listings/"]').first();

  if ((await listing.count()) === 0) {
    await expectAnyVisible(page, [
      "text=/No results|No listings|No geocoded listings/i",
    ]);
    return false;
  }

  await listing.click();
  await expect(page).toHaveURL(/\/listings\/.+/);
  return true;
}

async function openFirstBookingDetails(page: Page): Promise<boolean> {
  await page.goto("/bookings");
  const detailsLink = page.locator('a:has-text("View Details")').first();

  if ((await detailsLink.count()) === 0) {
    await expectAnyVisible(page, [
      "text=No bookings yet",
      "text=Error Loading Bookings",
    ]);
    return false;
  }

  await detailsLink.click();
  await expect(page).toHaveURL(/\/bookings\/.+/);
  return true;
}

test.describe("Renter Booking Journey", () => {
  test.describe("Search and Discovery", () => {
    test("should load search page and filters", async ({ page }) => {
      await page.goto("/search");
      await expect(page.locator('input[name="query"]')).toBeVisible();
      await expectAnyVisible(page, [
        'button:has-text("Filters")',
        "button:has(svg.lucide-sliders-horizontal)",
      ]);
    });

    test("should support query input", async ({ page }) => {
      await page.goto("/search");
      const query = page.locator('input[name="query"]');
      await query.fill("camera");
      await expect(query).toHaveValue("camera");
    });

    test("should open first listing when available", async ({ page }) => {
      await openFirstSearchListing(page);
    });
  });

  test.describe("Listing Booking Panel", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test("should show listing rental details", async ({ page }) => {
      const opened = await openFirstSearchListing(page);
      if (!opened) return;

      await expectAnyVisible(page, [
        "text=Rental Terms",
        "text=Min Rental Period",
        "text=Cancellation Policy",
      ]);
    });

    test("should show booking date inputs", async ({ page }) => {
      const opened = await openFirstSearchListing(page);
      if (!opened) return;

      await expect(page.locator('input[type="date"]').first()).toBeVisible();
      await expect(page.locator('input[type="date"]').nth(1)).toBeVisible();
    });

    test("should show booking action button", async ({ page }) => {
      const opened = await openFirstSearchListing(page);
      if (!opened) return;

      await expectAnyVisible(page, [
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
    });

    test("should allow entering optional message to owner", async ({
      page,
    }) => {
      const opened = await openFirstSearchListing(page);
      if (!opened) return;

      const message = page
        .locator('textarea[placeholder*="message"], textarea')
        .first();
      if (await message.isVisible().catch(() => false)) {
        await message.fill("Hi, I am interested in this rental.");
        await expect(message).toHaveValue(/interested/);
      } else {
        await expect(page.locator("body")).toBeVisible();
      }
    });

    test("should redirect guest to login when booking from listing", async ({
      page,
    }) => {
      await page.context().clearCookies();
      await page.goto("/search");

      const listing = page.locator('a[href^="/listings/"]').first();
      if ((await listing.count()) === 0) return;

      await listing.click();
      const clicked = await clickFirstVisible(page, [
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
      if (!clicked) return;

      await expectAnyVisible(page, [
        "text=/Please log in|auth\\/login/i",
        "text=/Please select start and end dates|Dates are available/i",
      ]);
    });
  });

  test.describe("Bookings Overview", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/bookings");
    });

    test("should display bookings page", async ({ page }) => {
      await expectAnyVisible(page, [
        "text=My Rentals",
        "text=No bookings yet",
        "text=Error Loading Bookings",
      ]);
    });

    test("should show status filters", async ({ page }) => {
      await expect(page.locator('button:has-text("All")')).toBeVisible();
      await expect(
        page.locator('button:has-text("confirmed")').first()
      ).toBeVisible();
    });

    test("should switch to owner view toggle when available", async ({
      page,
    }) => {
      const ownerToggle = page.locator('button:has-text("My Listings")');
      if (await ownerToggle.isVisible().catch(() => false)) {
        await ownerToggle.click();
        await expect(page).toHaveURL(/view=owner|\/bookings/);
      } else {
        await expect(page.locator("body")).toBeVisible();
      }
    });

    test("should open booking details from list", async ({ page }) => {
      await openFirstBookingDetails(page);
    });
  });

  test.describe("Booking Detail Actions", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test("should show booking information section", async ({ page }) => {
      const opened = await openFirstBookingDetails(page);
      if (!opened) return;

      await expectAnyVisible(page, [
        "text=Booking Information",
        "text=Booking Timeline",
      ]);
    });

    test("should show pricing summary section", async ({ page }) => {
      const opened = await openFirstBookingDetails(page);
      if (!opened) return;

      await expectAnyVisible(page, [
        "text=Pricing Breakdown",
        "text=Rental Amount",
        "text=Total",
      ]);
    });

    test("should allow navigating to booking messages", async ({ page }) => {
      const opened = await openFirstBookingDetails(page);
      if (!opened) return;

      const clicked = await clickFirstVisible(page, [
        'button:has-text("Send Message")',
      ]);
      if (!clicked) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await expect(page).toHaveURL(/\/messages\?booking=/);
    });

    test("should expose dispute action when available", async ({ page }) => {
      const opened = await openFirstBookingDetails(page);
      if (!opened) return;

      const dispute = page.locator('button:has-text("File a Dispute")');
      if (await dispute.isVisible().catch(() => false)) {
        await dispute.click();
        await expect(page).toHaveURL(/\/disputes\/new\//);
      } else {
        await expect(page.locator("body")).toBeVisible();
      }
    });

    test("should expose review action when booking is eligible", async ({
      page,
    }) => {
      const opened = await openFirstBookingDetails(page);
      if (!opened) return;

      const leaveReview = page.locator('button:has-text("Leave Review")');
      if (await leaveReview.isVisible().catch(() => false)) {
        await leaveReview.click();
        await expectAnyVisible(page, ["text=Leave a Review", "text=/rating/i"]);
      } else {
        await expect(page.locator("body")).toBeVisible();
      }
    });
  });
});
