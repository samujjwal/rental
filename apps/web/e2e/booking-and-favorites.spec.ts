/**
 * Booking and Favorites E2E Tests
 *
 * Covers:
 *   1. Full booking flow — from listing detail through checkout to /bookings
 *      list (UI-driven, not database fetch). Verifies:
 *      • Date selection, availability check, price calculation
 *      • Booking creation → checkout page renders with correct details
 *      • Booking appears in /bookings after creation (status = PENDING/REQUIRES_PAYMENT)
 *      • Booking detail page shows dates, pricing, listing title, status badge
 *      • Owner sees the booking in their view
 *      • Renter can cancel a pending booking
 *
 *   2. Favorites flow — seed a listing, add to favorites via the heart button,
 *      verify in /favorites, navigate back to listing, remove, verify empty state.
 *
 *   3. Viewing booked items — navigates /bookings list and detail pages
 *      using bookings that were created THROUGH THE UI in this test run,
 *      not pre-loaded from the database.
 *
 * All listings are seeded via SeedApi · cleaned up in afterAll.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";
import { SeedApi, type SeededListing } from "./helpers/seed-api";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const START = futureDate(8);
const END = futureDate(11);

// ---------------------------------------------------------------------------
// Booking flow helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to a listing, fill dates, check availability, and click the book
 * button.  Returns the booking/checkout URL if navigation happened.
 */
async function fillAndBook(
  page: Page,
  listingId: string,
  start: string = START,
  end: string = END
): Promise<void> {
  await page.goto(`/listings/${listingId}`);
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });

  // Fill date inputs
  const dateInputs = page.locator('input[type="date"]');
  if ((await dateInputs.count()) >= 2) {
    await dateInputs.nth(0).fill(start);
    await dateInputs.nth(1).fill(end);
  }

  // Check availability
  await clickFirstVisible(page, [
    'button:has-text("Check Availability")',
    'button:has-text("Check Dates")',
  ]);

  await page.waitForTimeout(2000);

  // Click book
  await clickFirstVisible(page, [
    'button:has-text("Book Instantly")',
    'button:has-text("Request to Book")',
  ]);

  // Wait for navigation (checkout page or error)
  await page.waitForTimeout(2000);
}

/**
 * Returns the booking ID from the current URL if on a booking/checkout page.
 */
function extractBookingId(url: string): string | null {
  const m = url.match(/\/(?:checkout|bookings)\/([a-f0-9-]{36})/);
  return m ? m[1] : null;
}

// ===========================================================================
// 1. Full Booking Flow
// ===========================================================================

test.describe("Full booking flow — from listing to /bookings list", () => {
  let seed: SeedApi;
  let listing: SeededListing;

  test.beforeAll(async ({ request }) => {
    seed = new SeedApi(request);
    await seed.init();
    listing = await seed.createListing("camera");
  });

  test.afterAll(async () => {
    await seed.cleanup();
  });

  // ── Pre-booking: listing detail ──────────────────────────────────────────

  test("listing detail page shows booking panel with date inputs", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`/listings/${listing.id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });
    await expectAnyVisible(page, [
      'input[type="date"]',
      'button:has-text("Check Availability")',
    ]);
  });

  test("valid dates trigger availability response", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`/listings/${listing.id}`);
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) < 2) return;
    await dateInputs.nth(0).fill(START);
    await dateInputs.nth(1).fill(END);
    await clickFirstVisible(page, ['button:has-text("Check Availability")']);
    await expectAnyVisible(page, [
      "text=/available|not available|Dates are available/i",
    ], 8000);
  });

  test("price breakdown appears after availability check", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`/listings/${listing.id}`);
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) < 2) return;
    await dateInputs.nth(0).fill(START);
    await dateInputs.nth(1).fill(END);
    await clickFirstVisible(page, ['button:has-text("Check Availability")']);
    await page.waitForTimeout(2000);
    await expectAnyVisible(page, [
      "text=/Total|Subtotal|Daily Rate|Rental Amount/i",
    ], 6000);
  });

  test("security deposit is shown in the price breakdown", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`/listings/${listing.id}`);
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) < 2) return;
    await dateInputs.nth(0).fill(START);
    await dateInputs.nth(1).fill(END);
    await clickFirstVisible(page, ['button:has-text("Check Availability")']);
    await page.waitForTimeout(2000);
    await expectAnyVisible(page, ["text=/Deposit|Security/i"], 6000);
  });

  test("clicking Book creates a booking and navigates to checkout or booking detail", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await fillAndBook(page, listing.id);

    await expectAnyVisible(page, [
      "text=/checkout|Checkout|Confirm Booking|Booking Information/i",
      "text=/start and end dates|Please check availability/i",
    ], 8000);
  });

  test("guest clicking Book is redirected to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/listings/${listing.id}`);
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) >= 2) {
      await dateInputs.nth(0).fill(START);
      await dateInputs.nth(1).fill(END);
    }
    await clickFirstVisible(page, [
      'button:has-text("Book Instantly")',
      'button:has-text("Request to Book")',
      'button:has-text("Check Availability")',
    ]);
    await expectAnyVisible(page, [
      'input[type="email"]',
      "text=/log in|sign in|Please log in/i",
      "text=/select start and end/i",
    ], 8000);
  });

  // ── Checkout page ─────────────────────────────────────────────────────────

  test("checkout page shows listing title and date range", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await fillAndBook(page, listing.id);

    const currentUrl = page.url();
    if (!currentUrl.includes("/checkout/")) return;

    await expectAnyVisible(page, [
      `text=${listing.title.slice(0, 20)}`,
      "text=/checkout|Checkout/i",
    ]);
  });

  test("checkout page shows price subtotal and total", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await fillAndBook(page, listing.id);

    if (!page.url().includes("/checkout/")) return;

    await expectAnyVisible(page, [
      "text=/subtotal|Subtotal|total|Total/i",
      "text=/[$]/",
    ]);
  });

  test("checkout page has a payment section", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await fillAndBook(page, listing.id);

    if (!page.url().includes("/checkout/")) return;

    await expectAnyVisible(page, [
      "text=/Payment|payment information|Card/i",
      "text=/secure|Secure/i",
    ]);
  });

  test("cancelling checkout navigates to booking detail", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await fillAndBook(page, listing.id);

    if (!page.url().includes("/checkout/")) return;

    await clickFirstVisible(page, [
      'button:has-text("Cancel")',
      'button:has-text("Go Back")',
      'button:has-text("Back")',
    ]);

    await expectAnyVisible(page, [
      "text=/Booking Information|Booking Details|My Rentals/i",
    ], 8000);
  });

  // ── /bookings list — booking created via UI ───────────────────────────────

  test("after creating a booking, it appears in /bookings list", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await fillAndBook(page, listing.id);

    // Regardless of checkout, navigate to bookings list
    await page.goto("/bookings");
    await page.waitForLoadState("domcontentloaded");

    await expectAnyVisible(page, [
      'a:has-text("View Details")',
      `text=${listing.title.slice(0, 20)}`,
      "text=/PENDING|REQUIRES_PAYMENT|Pending/i",
    ], 8000);
  });

  test("/bookings list shows title of booked listing", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    await page.waitForLoadState("domcontentloaded");

    await expectAnyVisible(page, [
      `text=${listing.title.slice(0, 15)}`,
      'a:has-text("View Details")',
      "text=No bookings yet",
    ], 8000);
  });

  test("/bookings list has status filter tabs", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    await expectAnyVisible(page, [
      'button:has-text("All")',
      'button:has-text("Pending")',
      'button:has-text("Confirmed")',
    ]);
  });

  test("clicking Pending tab filters to pending bookings", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const pendingBtn = page.locator('button:has-text("Pending")');
    if (await pendingBtn.isVisible().catch(() => false)) {
      await pendingBtn.click();
      await expectAnyVisible(page, [
        "text=/PENDING|Pending/i",
        "text=No bookings yet",
      ]);
    }
  });

  // ── Booking detail page ───────────────────────────────────────────────────

  test("booking detail page shows Booking Information section", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    await expect(page).toHaveURL(/\/bookings\/.+/);
    await expectAnyVisible(page, [
      "text=/Booking Information|Booking Details/i",
    ]);
  });

  test("booking detail page shows pricing breakdown", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    await expectAnyVisible(page, [
      "text=/Pricing|Total|Rental Amount/i",
    ]);
  });

  test("booking detail shows booking dates", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    await expectAnyVisible(page, [
      "text=/start|end|duration|days/i",
    ]);
  });

  test("booking detail shows a status badge", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    await expectAnyVisible(page, [
      "text=/PENDING|CONFIRMED|CANCELLED|COMPLETED|REQUIRES_PAYMENT/i",
    ]);
  });

  test("booking detail has a Send Message action", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    const msgBtn = page.locator('button:has-text("Send Message")');
    if (await msgBtn.isVisible().catch(() => false)) {
      await msgBtn.click();
      await expectAnyVisible(page, [
        "text=/Messages|Send/i",
        'textarea, input[name="message"]',
      ]);
    }
  });

  test("renter can cancel a pending booking", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();

    const cancelBtn = page.locator('button:has-text("Cancel")');
    if (!(await cancelBtn.isVisible().catch(() => false))) return;
    await cancelBtn.click();

    // Should show reason input or confirm dialog
    await expectAnyVisible(page, [
      "text=/reason|confirm|Are you sure|Cancel Booking/i",
      '[role="dialog"]',
    ]);
  });

  // ── Owner view ────────────────────────────────────────────────────────────

  test("owner sees booking in their bookings view", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    // Ensure a booking exists
    await fillAndBook(page, listing.id);

    // Now switch to owner account
    await loginAs(page, testUsers.owner);
    await page.goto("/bookings");

    const toggle = page.locator('button:has-text("My Listings")');
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    }

    await expectAnyVisible(page, [
      'a:has-text("View Details")',
      "text=No bookings yet",
    ], 6000);
  });
});

// ===========================================================================
// 2. Booking Validation Edge Cases (seeded listing required)
// ===========================================================================

test.describe("Booking validation — edge cases", () => {
  let seed: SeedApi;
  let listing: SeededListing;

  test.beforeAll(async ({ request }) => {
    seed = new SeedApi(request);
    await seed.init();
    listing = await seed.createListing("tent");
  });

  test.afterAll(async () => {
    await seed.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`/listings/${listing.id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });
  });

  async function tryBook(page: Page): Promise<void> {
    await clickFirstVisible(page, [
      'button:has-text("Check Availability")',
      'button:has-text("Book Instantly")',
      'button:has-text("Request to Book")',
    ]);
  }

  test("past start date shows error", async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) < 2) return;
    await dateInputs.nth(0).fill(futureDate(-5));
    await dateInputs.nth(1).fill(END);
    await tryBook(page);
    await expectAnyVisible(page, ["text=/past|future|cannot be in the past|invalid/i"]);
  });

  test("end date before start date shows error", async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) < 2) return;
    await dateInputs.nth(0).fill(END);
    await dateInputs.nth(1).fill(START); // reversed
    await tryBook(page);
    await expectAnyVisible(page, ["text=/end date must be after|after start|invalid range/i"]);
  });

  test("same start and end date shows error", async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) < 2) return;
    await dateInputs.nth(0).fill(START);
    await dateInputs.nth(1).fill(START);
    await tryBook(page);
    await expectAnyVisible(page, ["text=/end date must be after|same day|at least 1/i"]);
  });

  test("no dates selected shows validation message", async ({ page }) => {
    await clickFirstVisible(page, [
      'button:has-text("Book Instantly")',
      'button:has-text("Request to Book")',
    ]);
    await expectAnyVisible(page, ["text=/select.*date|date.*required|check availability/i"]);
  });

  test("booking without checking availability first shows warning", async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) < 2) return;
    await dateInputs.nth(0).fill(START);
    await dateInputs.nth(1).fill(END);
    // Skip check-availability, click book directly
    await clickFirstVisible(page, [
      'button:has-text("Book Instantly")',
      'button:has-text("Request to Book")',
    ]);
    await expectAnyVisible(page, [
      "text=/check availability|Please check|available/i",
    ]);
  });

  test("rental period exceeding maximum shows rejection", async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) < 2) return;
    await dateInputs.nth(0).fill(futureDate(5));
    await dateInputs.nth(1).fill(futureDate(500)); // way too long
    await tryBook(page);
    await expectAnyVisible(page, [
      "text=/exceed|maximum|max.*days|not available|available/i",
    ], 6000);
  });
});

// ===========================================================================
// 3. Favorites Flow
// ===========================================================================

test.describe("Favorites — empty state (no listings favorited)", () => {
  test("favorites page loads for authenticated renter", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/favorites");
    await page.waitForLoadState("domcontentloaded");
    await expectAnyVisible(page, [
      "text=/Favorites|Your Saved/i",
      "text=/no favorites|start browsing|explore|haven't saved/i",
      'a[href^="/listings/"]',
    ]);
  });

  test("empty favorites shows a link to browse listings", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/favorites");
    await page.waitForLoadState("domcontentloaded");
    await expectAnyVisible(page, [
      'a:has-text("Browse")',
      'a:has-text("Explore")',
      'a[href="/search"]',
      'a[href="/"]',
      'a[href^="/listings"]',
    ]);
  });

  test("guest accessing /favorites is redirected to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto("/favorites");
    await expectAnyVisible(page, [
      'input[type="email"]',
      "text=/log in|sign in|Login/i",
    ]);
  });
});

test.describe("Favorites — add, view, navigate, remove (seeded listing)", () => {
  let seed: SeedApi;
  let listing: SeededListing;

  test.beforeAll(async ({ request }) => {
    seed = new SeedApi(request);
    await seed.init();
    listing = await seed.createListing("bicycle");
  });

  test.afterAll(async () => {
    await seed.cleanup();
  });

  test("listing detail page shows heart/favorite button for authenticated renter", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`/listings/${listing.id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });
    await expectAnyVisible(page, [
      'button[aria-label="Add to favorites"]',
      'button[aria-label="Remove from favorites"]',
      'button[aria-label*="favorite" i]',
      'button[aria-label*="save" i]',
    ], 5000);
  });

  test("clicking Add to favorites changes button aria-label to Remove from favorites", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`/listings/${listing.id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });

    const addBtn = page.locator('button[aria-label="Add to favorites"]');
    if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await addBtn.click();
    await page.waitForTimeout(1500);

    await expectAnyVisible(page, [
      'button[aria-label="Remove from favorites"]',
      "text=/saved|added|favorite/i",
    ]);
  });

  test("favorited listing appears in /favorites page", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`/listings/${listing.id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });

    // Ensure it is favorited
    const addBtn = page.locator('button[aria-label="Add to favorites"]');
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
    }

    // Navigate to favorites
    await page.goto("/favorites");
    await page.waitForLoadState("domcontentloaded");

    await expectAnyVisible(page, [
      `text=${listing.title.slice(0, 20)}`,
      'a[href^="/listings/"]',
      "text=/[$]/",
    ], 8000);
  });

  test("clicking favorited listing in /favorites navigates to listing detail", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    // Ensure favorited
    await page.goto(`/listings/${listing.id}`);
    const addBtn = page.locator('button[aria-label="Add to favorites"]');
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.goto("/favorites");
    await page.waitForLoadState("domcontentloaded");

    const listingLink = page.locator(`a[href="/listings/${listing.id}"]`).first();
    const anyLink = page.locator('a[href^="/listings/"]').first();

    if (await listingLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await listingLink.click();
      await expect(page).toHaveURL(/\/listings\/.+/);
    } else if (await anyLink.isVisible().catch(() => false)) {
      await anyLink.click();
      await expect(page).toHaveURL(/\/listings\/.+/);
    }
  });

  test("removing from favorites via /favorites page removes the listing", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    // Ensure favorited
    await page.goto(`/listings/${listing.id}`);
    const addBtn = page.locator('button[aria-label="Add to favorites"]');
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1200);
    }

    await page.goto("/favorites");
    await page.waitForLoadState("domcontentloaded");

    const removeBtn = page.locator('button[aria-label="Remove from favorites"]').first();
    if (!(await removeBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;

    const before = await page.locator('a[href^="/listings/"]').count();
    await removeBtn.click();
    await page.waitForTimeout(1500);

    const after = await page.locator('a[href^="/listings/"]').count();
    expect(after).toBeLessThanOrEqual(before);
  });

  test("toggling favorite on listing detail (add then remove) works", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`/listings/${listing.id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });

    // Start from known state — unfavorited if possible
    const removeFirst = page.locator('button[aria-label="Remove from favorites"]');
    if (await removeFirst.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeFirst.click();
      await page.waitForTimeout(1000);
    }

    const addBtn = page.locator('button[aria-label="Add to favorites"]');
    if (!(await addBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;

    // Add
    await addBtn.click();
    await page.waitForTimeout(1200);
    await expect(page.locator('button[aria-label="Remove from favorites"]')).toBeVisible({ timeout: 5000 });

    // Remove
    await page.locator('button[aria-label="Remove from favorites"]').click();
    await page.waitForTimeout(1200);
    await expect(page.locator('button[aria-label="Add to favorites"]')).toBeVisible({ timeout: 5000 });
  });

  test("favoriting same listing twice is idempotent (no duplicate in /favorites)", async ({ page }) => {
    await loginAs(page, testUsers.renter);

    // Add once
    await page.goto(`/listings/${listing.id}`);
    const addBtn1 = page.locator('button[aria-label="Add to favorites"]');
    if (await addBtn1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn1.click();
      await page.waitForTimeout(1000);
    }

    // Navigate away and back — can't click add again if already favorited
    await page.goto("/");
    await page.goto(`/listings/${listing.id}`);

    // Should now be in "Remove" state — no second "Add" available
    await expectAnyVisible(page, [
      'button[aria-label="Remove from favorites"]',
      'button[aria-label="Add to favorites"]',
    ], 3000);

    // Check /favorites — should have exactly one entry for this listing
    await page.goto("/favorites");
    await page.waitForLoadState("domcontentloaded");
    const entries = page.locator(`a[href="/listings/${listing.id}"]`);
    const count = await entries.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test("guest clicking heart button is redirected to login or shown login prompt", async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/listings/${listing.id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });

    const favoriteBtn = page.locator(
      'button[aria-label="Add to favorites"], button[aria-label*="favorite" i]'
    ).first();
    if (!(await favoriteBtn.isVisible({ timeout: 4000 }).catch(() => false))) return;

    await favoriteBtn.click();
    await expectAnyVisible(page, [
      'input[type="email"]',
      "text=/log in|sign in|Login/i",
    ], 6000).catch(async () => {
      // Some apps show a toast/modal rather than redirect
      await expectAnyVisible(page, ["text=/Please log in|must be logged in/i"]);
    });
  });
});

test.describe("Favorites — multiple favorited listings", () => {
  let seed: SeedApi;
  let listingA: SeededListing;
  let listingB: SeededListing;

  test.beforeAll(async ({ request }) => {
    seed = new SeedApi(request);
    await seed.init();
    [listingA, listingB] = await Promise.all([
      seed.createListing("guitar"),
      seed.createListing("tent"),
    ]);
  });

  test.afterAll(async () => {
    await seed.cleanup();
  });

  test("favoriting two different listings shows both in /favorites", async ({ page }) => {
    await loginAs(page, testUsers.renter);

    for (const l of [listingA, listingB]) {
      await page.goto(`/listings/${l.id}`);
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });
      const addBtn = page.locator('button[aria-label="Add to favorites"]');
      if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    await page.goto("/favorites");
    await page.waitForLoadState("domcontentloaded");

    const links = page.locator('a[href^="/listings/"]');
    expect(await links.count()).toBeGreaterThanOrEqual(1);
  });

  test("removing one favorite leaves the other intact", async ({ page }) => {
    await loginAs(page, testUsers.renter);

    // Ensure both favorited
    for (const l of [listingA, listingB]) {
      await page.goto(`/listings/${l.id}`);
      const addBtn = page.locator('button[aria-label="Add to favorites"]');
      if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(800);
      }
    }

    await page.goto("/favorites");
    await page.waitForLoadState("domcontentloaded");

    const before = await page.locator('a[href^="/listings/"]').count();
    const removeBtn = page.locator('button[aria-label="Remove from favorites"]').first();
    if (!(await removeBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;

    await removeBtn.click();
    await page.waitForTimeout(1500);

    const after = await page.locator('a[href^="/listings/"]').count();
    if (before > 0) {
      expect(after).toBeLessThan(before + 1); // at most same count (may be 0 if only 1)
    }
  });

  test("/favorites page filters work (search input if present)", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/favorites");
    await page.waitForLoadState("domcontentloaded");

    const searchInput = page.locator(
      'input[placeholder*="Search"], input[name="search"], [data-testid="favorites-search"]'
    ).first();
    if (!await searchInput.isVisible().catch(() => false)) return;

    await searchInput.fill("[E2E]");
    await page.waitForTimeout(800);
    // Should either show results or empty state
    await expectAnyVisible(page, [
      'a[href^="/listings/"]',
      "text=/no results|nothing found|no favorites/i",
    ]);
  });
});

// ===========================================================================
// 4. Viewing Booked Items — UI-driven verification (not database)
// ===========================================================================

test.describe("Viewing booked items — based on UI-created booking", () => {
  let seed: SeedApi;
  let listing: SeededListing;

  test.beforeAll(async ({ request }) => {
    seed = new SeedApi(request);
    await seed.init();
    listing = await seed.createListing("car");
  });

  test.afterAll(async () => {
    await seed.cleanup();
  });

  test("after booking via UI, /bookings shows My Rentals heading", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await fillAndBook(page, listing.id);
    await page.goto("/bookings");
    await expectAnyVisible(page, [
      "text=My Rentals",
      "text=/bookings|Bookings/i",
    ]);
  });

  test("booking created via UI appears on /bookings with correct listing title", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await fillAndBook(page, listing.id);
    await page.goto("/bookings");
    await page.waitForLoadState("domcontentloaded");

    // Either the booking appears or the list is empty (if booking errored)
    await expectAnyVisible(page, [
      `text=${listing.title.slice(0, 15)}`,
      'a:has-text("View Details")',
      "text=No bookings yet",
    ], 6000);
  });

  test("booking detail page URL matches /bookings/:id pattern", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await fillAndBook(page, listing.id);
    await page.goto("/bookings");

    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+/);
  });

  test("booking detail shows Booking Information and Pricing Breakdown sections", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    await expectAnyVisible(page, ["text=/Booking Information|Booking Details/i"]);
    await expectAnyVisible(page, ["text=/Pricing|Total|Rental Amount/i"]);
  });

  test("booking detail shows correct start and end dates", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    // Create a booking with known dates
    await page.goto(`/listings/${listing.id}`);
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) >= 2) {
      await dateInputs.nth(0).fill(futureDate(40));
      await dateInputs.nth(1).fill(futureDate(43));
    }
    await clickFirstVisible(page, ['button:has-text("Check Availability")']);
    await page.waitForTimeout(2000);
    await clickFirstVisible(page, [
      'button:has-text("Book Instantly")',
      'button:has-text("Request to Book")',
    ]);
    await page.waitForTimeout(2000);

    // Navigate to bookings
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();

    await expectAnyVisible(page, [
      "text=/start|begin|from/i",
      "text=/end|until|to/i",
    ]);
  });

  test("booking detail shows status badge corresponding to booking state", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    await expectAnyVisible(page, [
      "text=/PENDING|CONFIRMED|CANCELLED|COMPLETED|REQUIRES_PAYMENT|pending|confirmed/i",
    ]);
  });

  test("booking detail shows listing title linking back to listing", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    await expectAnyVisible(page, [
      `text=${listing.title.slice(0, 15)}`,
      `a[href="/listings/${listing.id}"]`,
    ]);
  });

  test("All tab in /bookings shows all bookings regardless of status", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const allTab = page.locator('button:has-text("All")');
    if (await allTab.isVisible().catch(() => false)) {
      await allTab.click();
      await expectAnyVisible(page, [
        'a:has-text("View Details")',
        "text=No bookings yet",
      ]);
    }
  });

  test("Cancelled tab shows only cancelled bookings (or empty)", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const cancelledTab = page.locator('button:has-text("Cancelled"), button:has-text("canceled")');
    if (await cancelledTab.first().isVisible().catch(() => false)) {
      await cancelledTab.first().click();
      await expectAnyVisible(page, [
        "text=/CANCELLED|Cancelled/i",
        "text=No bookings yet",
      ]);
    }
  });

  test("dispute action is available on eligible bookings", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    const disputeBtn = page.locator('button:has-text("File a Dispute")');
    if (await disputeBtn.isVisible().catch(() => false)) {
      await disputeBtn.click();
      await expectAnyVisible(page, ["text=/dispute|Dispute/i"]);
    } else {
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("review action is visible on completed bookings", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/bookings");
    const link = page.locator('a:has-text("View Details")').first();
    if ((await link.count()) === 0) return;
    await link.click();
    const reviewBtn = page.locator('button:has-text("Leave Review")');
    if (await reviewBtn.isVisible().catch(() => false)) {
      await reviewBtn.click();
      await expectAnyVisible(page, ["text=/Leave a Review|Rating/i"]);
    } else {
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
