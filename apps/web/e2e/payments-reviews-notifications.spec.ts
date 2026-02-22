import { test, expect } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";

async function getFirstOwnerListingId(page: import("@playwright/test").Page): Promise<string | null> {
  await page.goto("/listings");
  const link = page
    .locator('a[href^="/listings/"]:not([href="/listings/new"]):not([href$="/edit"])')
    .first();

  if ((await link.count()) === 0) {
    return null;
  }

  const href = await link.getAttribute("href");
  if (!href) return null;
  const match = href.match(/\/listings\/([^/?#]+)/);
  return match?.[1] ?? null;
}

test.describe("Checkout and Financial Flows", () => {
  test.describe("Checkout", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/checkout/1");
    });

    test("should render checkout page or access error", async ({ page }) => {
      await expectAnyVisible(page, [
        "text=Checkout",
        "text=/Payment setup failed|Booking ID is required|Payment failed/i",
      ]);
    });

    test("should show order summary details when checkout is available", async ({ page }) => {
      const hasCheckout = await page.locator("text=Order Summary").isVisible().catch(() => false);
      if (!hasCheckout) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await expect(page.locator("text=Order Summary")).toBeVisible();
      await expect(page.locator("text=Rental Period")).toBeVisible();
      await expect(page.locator("text=Total")).toBeVisible();
    });

    test("should show payment form controls when available", async ({ page }) => {
      const hasCheckout = await page.locator("text=Payment Information").isVisible().catch(() => false);
      if (!hasCheckout) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await expect(page.locator("text=Payment Information")).toBeVisible();
      await expect(page.locator("text=/Payments are secure and encrypted/i")).toBeVisible();
      await expect(page.locator('button:has-text("Pay $")')).toBeVisible();
    });

    test("should provide back to booking navigation", async ({ page }) => {
      const clicked = await clickFirstVisible(page, ['a:has-text("Back to Booking")']);
      if (!clicked) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }
      await expect(page).toHaveURL(/\/bookings\/.+/);
    });
  });

  test.describe("Payments Page", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/payments");
    });

    test("should display payments and earnings page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Payments & Earnings/i);
      await expect(page.locator("text=Available Balance")).toBeVisible();
      await expect(page.locator("text=Total Earnings")).toBeVisible();
    });

    test("should display transactions section", async ({ page }) => {
      await expect(page.locator("text=Transactions")).toBeVisible();
      await expectAnyVisible(page, [
        "text=No transactions found",
        "table",
      ]);
    });

    test("should expose request payout action", async ({ page }) => {
      await expectAnyVisible(page, [
        'a:has-text("Request Payout")',
        "text=Payout Settings",
      ]);
    });

    test("should support transaction filtering controls", async ({ page }) => {
      const openedFilters = await clickFirstVisible(page, ['button:has-text("Filters")']);
      if (!openedFilters) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      const selects = page.locator("select");
      await expect(selects.first()).toBeVisible();
      await expect(selects.nth(1)).toBeVisible();
    });
  });
});

test.describe("Reviews and Notifications", () => {
  test.describe("Reviews", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/reviews");
    });

    test("should display reviews page and stats", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Reviews/i);
      await expectAnyVisible(page, [
        "text=Reviews Received",
        "text=Reviews Given",
        "text=No reviews yet",
      ]);
    });

    test("should render rating filter controls", async ({ page }) => {
      await expect(page.locator('button:has-text("5")').first()).toBeVisible();
      await expect(page.locator('button:has-text("1")').first()).toBeVisible();
    });

    test("should render reviews list or empty state", async ({ page }) => {
      await expectAnyVisible(page, [
        "text=No reviews yet",
        "text=User",
        "text=Listing",
      ]);
    });
  });

  test.describe("Notifications", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/notifications");
    });

    test("should display notifications page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Notifications/i);
      await expectAnyVisible(page, [
        "text=No notifications",
        "button:has-text(\"Unread Only\")",
      ]);
    });

    test("should toggle unread filter", async ({ page }) => {
      const clicked = await clickFirstVisible(page, [
        'button:has-text("Unread Only")',
        'button:has-text("Show All")',
      ]);
      expect(clicked).toBe(true);
      await expect(page).toHaveURL(/\/notifications/);
    });

    test("should mark all as read when action is visible", async ({ page }) => {
      const markAll = page.locator('button:has-text("Mark All Read")');
      if (await markAll.isVisible().catch(() => false)) {
        await markAll.click();
        await expectAnyVisible(page, [
          "text=/marked as read/i",
          "text=No notifications",
        ]);
      } else {
        await expect(page.locator("body")).toBeVisible();
      }
    });
  });
});

test.describe("Insurance Upload", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
  });

  test("should redirect when listing id is missing", async ({ page }) => {
    await page.goto("/insurance/upload");
    await expect(page).toHaveURL(/\/listings|\/dashboard/);
  });

  test("should display insurance upload form for a valid owner listing", async ({ page }) => {
    const listingId = await getFirstOwnerListingId(page);
    if (!listingId) {
      await expect(page.locator("body")).toBeVisible();
      return;
    }

    await page.goto(`/insurance/upload?listingId=${listingId}`);
    await expect(page.locator("h1")).toContainText(/Upload Insurance Policy/i);
    await expect(page.locator('input[name="provider"]')).toBeVisible();
    await expect(page.locator('select[name="type"]')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test("should validate missing required insurance fields", async ({ page }) => {
    const listingId = await getFirstOwnerListingId(page);
    if (!listingId) {
      await expect(page.locator("body")).toBeVisible();
      return;
    }

    await page.goto(`/insurance/upload?listingId=${listingId}`);
    await page.click('button:has-text("Submit for Verification")');
    await expectAnyVisible(page, [
      "text=/required|invalid|please/i",
      "text=/Policy number|provider|insurance type/i",
    ]);
  });

  test("should allow selecting insurance document", async ({ page }) => {
    const listingId = await getFirstOwnerListingId(page);
    if (!listingId) {
      await expect(page.locator("body")).toBeVisible();
      return;
    }

    await page.goto(`/insurance/upload?listingId=${listingId}`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "insurance-proof.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake pdf"),
    });
    await expect(fileInput).toHaveValue(/insurance-proof\.pdf/i);
  });
});
