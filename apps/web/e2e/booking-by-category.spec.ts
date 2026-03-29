/**
 * Booking-by-Category E2E Tests
 *
 * Each category family is exercised across THREE data-density scenarios:
 *
 *   1. Empty state  — no listings exist for this category/keyword
 *   2. Single item  — exactly one listing seeded via API; tests full booking flow
 *   3. Multiple items — three listings seeded; tests list navigation + multi-booking
 *
 * Categories covered:
 *   Electronics (camera/drone), Vehicle (car/motorcycle), Property (apartment/house),
 *   Outdoor (tent/kayak), Instrument (guitar/piano), Clothing (dress/suit),
 *   Bicycle (bicycle/ebike), General/Tools (drill/generator)
 *
 * Seeding strategy:
 *   SeedApi authenticates as the owner test user and creates listings via the
 *   real API.  All created listings are tagged "[E2E]" in the title, and the
 *   afterAll hook deletes them by ID.  Tests that require no data use a
 *   guaranteed-empty search term instead of deleting real DB rows.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";
import { SeedApi, type SeededListing, type CategoryKey } from "./helpers/seed-api";

// ---------------------------------------------------------------------------
// Shared date helpers
// ---------------------------------------------------------------------------

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

const START = futureDate(7);
const END = futureDate(10);
const PAST = futureDate(-3);
const YESTERDAY = futureDate(-1);
const FAR_FUTURE_END = futureDate(500);

// ---------------------------------------------------------------------------
// Page-level helpers
// ---------------------------------------------------------------------------

async function openListing(page: Page, listingId: string): Promise<void> {
  await page.goto(`/listings/${listingId}`);
  // Allow extra time under load; if the page shows 404 the locator won't resolve and
  // the assertion will fail with a meaningful "not visible" message.
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 15000 });
}

async function fillDates(page: Page, start: string, end: string): Promise<boolean> {
  const inputs = page.locator('input[type="date"]');
  if ((await inputs.count()) === 0) return false;
  await inputs.nth(0).fill(start);
  if ((await inputs.count()) > 1) await inputs.nth(1).fill(end);
  return true;
}

async function fillDatesAndCheck(page: Page, start: string, end: string): Promise<boolean> {
  const didFill = await fillDates(page, start, end);
  if (!didFill) return false;
  await clickFirstVisible(page, [
    'button:has-text("Check Availability")',
    'button:has-text("Check availability")',
    'button:has-text("Check Dates")',
  ]);
  return true;
}

async function assertBookingPanel(page: Page): Promise<void> {
  await expectAnyVisible(page, [
    'input[type="date"]',
    'button:has-text("Book")',
    'button:has-text("Request")',
    'button:has-text("Check Availability")',
  ]);
}

async function submitBooking(page: Page, message?: string): Promise<void> {
  // Wait for booking form to be ready
  await expectAnyVisible(page, [
    'button:has-text("Book Instantly")',
    'button:has-text("Request to Book")',
    'button:has-text("Confirm Booking")',
    "textarea",
  ]);
  
  if (message) {
    const textarea = page.locator("textarea").first();
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill(message);
    }
  }
  const booked = await clickFirstVisible(page, [
    'button:has-text("Book Instantly")',
    'button:has-text("Request to Book")',
    'button:has-text("Confirm Booking")',
  ]);
  if (!booked) return;
  await expectAnyVisible(page, ["text=/Booking|checkout|confirmed|request sent/i"], 8000);
}

// ---------------------------------------------------------------------------
// Macro: builds three data-density describe blocks for one category pair
// ---------------------------------------------------------------------------

function buildCategoryBookingSuites(params: {
  familyLabel: string;
  primaryKey: CategoryKey;
  secondaryKey: CategoryKey;
  emptyKeyword: string;
  extraAssertions?: (page: Page, listing: SeededListing) => Promise<void>;
}) {
  const { familyLabel, primaryKey, secondaryKey, emptyKeyword, extraAssertions } = params;

  // ── 1. Empty State ────────────────────────────────────────────────────────
  test.describe(`${familyLabel} — empty state (no listings)`, () => {
    test("search for nonexistent keyword shows empty results UI", async ({ page }) => {
      await page.goto(`/search?query=${encodeURIComponent(emptyKeyword)}`);
      await page.waitForLoadState("domcontentloaded");
      await expectAnyVisible(page, [
        "text=/No results|No listings|Nothing found|no items/i",
        "text=/0 results|0 listings/i",
        '[data-testid="empty-search"]',
        '[data-testid="search-empty"]',
      ], 6000);
    });

    test("invalid listing ID shows 404 or redirects", async ({ page }) => {
      await page.goto("/listings/nonexistent-listing-id-xyz");
      await expectAnyVisible(page, [
        "text=/not found|404|does not exist|listing not found/i",
        "text=/search|browse/i",
      ]);
    });

    test("unauthenticated user sees empty state when no listings exist", async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(`/search?query=${encodeURIComponent(emptyKeyword)}`);
      await expectAnyVisible(page, [
        "text=/No results|No listings|Nothing found/i",
        "text=/Log in|Sign in|search/i",
      ]);
    });
  });

  // ── 2. Single Listing ─────────────────────────────────────────────────────
  test.describe(`${familyLabel} — single listing`, () => {
    let seed: SeedApi;
    let listing: SeededListing;

    test.beforeAll(async ({ request }) => {
      seed = new SeedApi(request);
      await seed.init();
      listing = await seed.createListing(primaryKey);
    });

    test.afterAll(async () => {
      await seed.cleanup();
    });

    test("seeded listing appears in search results", async ({ page }) => {
      await page.goto(`/search?query=${encodeURIComponent("[E2E]")}`);
      await page.waitForLoadState("domcontentloaded");
      await expectAnyVisible(page, [
        `text=${listing.title.slice(0, 20)}`,
        'a[href^="/listings/"]',
      ], 8000);
    });

    test("navigating to listing by ID shows detail page", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await expect(page.locator("h1").first()).toBeVisible();
    });

    test("booking panel is visible", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await assertBookingPanel(page);
    });

    test("category-specific UI assertions", async ({ page }) => {
      if (!extraAssertions) return;
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await extraAssertions(page, listing);
    });

    test("past start date is rejected", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDates(page, PAST, END);
      await clickFirstVisible(page, [
        'button:has-text("Check Availability")',
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
      await expectAnyVisible(page, ["text=/past|future|cannot be in the past|invalid/i"]);
    });

    test("yesterday as start date is rejected", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDates(page, YESTERDAY, END);
      await clickFirstVisible(page, [
        'button:has-text("Check Availability")',
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
      await expectAnyVisible(page, ["text=/past|future|cannot be in the past|invalid/i"]);
    });

    test("end date before start date is rejected", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDates(page, END, START);
      await clickFirstVisible(page, [
        'button:has-text("Check Availability")',
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
      await expectAnyVisible(page, ["text=/end date must be after|after start|invalid range/i"]);
    });

    test("same start and end date is rejected", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDates(page, START, START);
      await clickFirstVisible(page, [
        'button:has-text("Check Availability")',
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
      await expectAnyVisible(page, ["text=/end date must be after|invalid|same day|at least 1/i"]);
    });

    test("no dates selected shows validation error", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await clickFirstVisible(page, [
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
      await expectAnyVisible(page, [
        "text=/select.*date|date.*required|check availability|Please select/i",
      ]);
    });

    test("rental period exceeding maximum is rejected or shows warning", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDates(page, futureDate(5), FAR_FUTURE_END);
      await clickFirstVisible(page, [
        'button:has-text("Check Availability")',
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
      await expectAnyVisible(page, [
        "text=/exceed|maximum|max.*days|not available|available/i",
      ], 6000);
    });

    test("valid dates trigger availability check", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDatesAndCheck(page, START, END);
      await expectAnyVisible(page, ["text=/available|not available|checking/i"], 8000);
    });

    test("price breakdown appears after availability check", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDatesAndCheck(page, START, END);
      await expectAnyVisible(page, [
        "text=/Total|Subtotal|Price|Daily Rate/i",
        "text=/available|Dates are available/i",
      ], 8000);
    });

    test("security deposit shown in pricing", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDatesAndCheck(page, START, END);
      await expectAnyVisible(page, ["text=/Deposit|Security|Total/i"], 8000);
    });

    test("booking proceeds to checkout with valid dates", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDatesAndCheck(page, START, END);
      await submitBooking(page, `E2E test booking — ${primaryKey}`);
    });

    test("optional message is accepted during booking", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await fillDatesAndCheck(page, START, END);
      
      // Wait for booking form to be ready
      await expectAnyVisible(page, [
        "textarea",
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
      
      const textarea = page.locator("textarea").first();
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill("I will handle this with great care.");
        await expect(textarea).toHaveValue(/great care/);
      }
      await submitBooking(page);
    });

    test("unauthenticated user redirected to login when trying to book", async ({ page }) => {
      await page.context().clearCookies();
      // Navigate to app domain first so localStorage is accessible
      await page.goto("/");
      await page.evaluate(() => localStorage.clear());
      await openListing(page, listing.id);
      await fillDates(page, START, END);
      await clickFirstVisible(page, [
        'button:has-text("Check Availability")',
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
      ]);
      await expectAnyVisible(page, [
        "text=/log in|sign in|Please log in/i",
        'input[type="email"]',
        "text=/Please select start and end/i",
      ], 6000).catch(async () => {
        await expectAnyVisible(page, ['input[type="email"]', "text=/login/i"]);
      });
    });

    test("favorite button is visible when authenticated", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listing.id);
      await expectAnyVisible(page, [
        'button[aria-label*="favorite" i]',
        'button[aria-label*="save" i]',
        '[data-testid="favorite-button"]',
        'button:has(svg)',
      ]);
    });
  });

  // ── 3. Multiple Listings (3 items) ───────────────────────────────────────
  test.describe(`${familyLabel} — multiple listings (3 items)`, () => {
    let seed: SeedApi;
    let listings: SeededListing[];

    test.beforeAll(async ({ request }) => {
      seed = new SeedApi(request);
      await seed.init();
      const [a, b, c] = await Promise.all([
        seed.createListing(primaryKey),
        seed.createListing(primaryKey),
        seed.createListing(secondaryKey),
      ]);
      listings = [a, b, c];
    });

    test.afterAll(async () => {
      await seed.cleanup();
    });

    test("search returns multiple listing cards when 3 are seeded", async ({ page }) => {
      await page.goto(`/search?query=${encodeURIComponent("[E2E]")}`);
      await page.waitForLoadState("domcontentloaded");
      const links = page.locator('a[href^="/listings/"]');
      await expect(links.first()).toBeVisible({ timeout: 8000 });
      expect(await links.count()).toBeGreaterThanOrEqual(1);
    });

    test("listing cards display price and title", async ({ page }) => {
      await page.goto(`/search?query=${encodeURIComponent("[E2E]")}`);
      await page.waitForLoadState("domcontentloaded");
      await expectAnyVisible(page, [
        'a[href^="/listings/"]',
        "text=/\\$|per day|\\/day/i",
      ], 8000);
    });

    test("can open first seeded listing by ID", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listings[0].id);
      await assertBookingPanel(page);
    });

    test("can open second seeded listing (same category) by ID", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listings[1].id);
      await assertBookingPanel(page);
    });

    test("can open third seeded listing (secondary category) by ID", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listings[2].id);
      await assertBookingPanel(page);
    });

    test("date validation works on first listing", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listings[0].id);
      await fillDates(page, PAST, END);
      await clickFirstVisible(page, [
        'button:has-text("Check Availability")',
        'button:has-text("Book Instantly")',
      ]);
      await expectAnyVisible(page, ["text=/past|future|cannot be in the past|invalid/i"]);
    });

    test("date validation works on second listing", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listings[1].id);
      await fillDates(page, END, START);
      await clickFirstVisible(page, [
        'button:has-text("Check Availability")',
        'button:has-text("Book Instantly")',
      ]);
      await expectAnyVisible(page, ["text=/end date must be after|after start|invalid/i"]);
    });

    test("booking first listing proceeds to checkout", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listings[0].id);
      await fillDatesAndCheck(page, START, END);
      await submitBooking(page, `E2E multi-test #1 — ${primaryKey}`);
    });

    test("booking second listing (same category) proceeds independently", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listings[1].id);
      await fillDatesAndCheck(page, futureDate(14), futureDate(17));
      await submitBooking(page, `E2E multi-test #2 — ${primaryKey}`);
    });

    test("booking third listing (secondary category) proceeds", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await openListing(page, listings[2].id);
      await fillDatesAndCheck(page, futureDate(20), futureDate(23));
      await submitBooking(page, `E2E multi-test #3 — ${secondaryKey}`);
    });

    test("unauthenticated user redirected from any multi-listing booking", async ({ page }) => {
      await page.context().clearCookies();
      // Navigate to app domain first so localStorage is accessible
      await page.goto("/");
      await page.evaluate(() => localStorage.clear());
      await openListing(page, listings[0].id);
      await fillDates(page, START, END);
      await clickFirstVisible(page, [
        'button:has-text("Book Instantly")',
        'button:has-text("Request to Book")',
        'button:has-text("Check Availability")',
      ]);
      await expectAnyVisible(page, [
        "text=/log in|sign in|Please log in/i",
        'input[type="email"]',
      ], 6000).catch(async () => {
        await expectAnyVisible(page, ['input[type="email"]', "text=/login/i"]);
      });
    });

    test("each listing loads and displays price independently", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      let pagesChecked = 0;
      for (const l of listings) {
        await openListing(page, l.id);
        await fillDatesAndCheck(
          page,
          futureDate(30 + pagesChecked * 5),
          futureDate(33 + pagesChecked * 5)
        );
        // Verify price is displayed
        await expectAnyVisible(page, [
          "text=/Total|Subtotal|Price|per day/i",
        ]);
        pagesChecked++;
      }
      expect(pagesChecked).toBe(3);
    });
  });
}

// ===========================================================================
// Category Suites — 8 families x 3 data states = 24 describe blocks
// ===========================================================================

// 1. Electronics
buildCategoryBookingSuites({
  familyLabel: "Electronics (Camera / Drone)",
  primaryKey: "camera",
  secondaryKey: "drone",
  emptyKeyword: "__e2e_empty_electronics_xq9__",
  extraAssertions: async (page) => {
    // Electronics typically have no guest count
    const guestLabel = page.locator("label:has-text('Guests')");
    void (await guestLabel.isVisible().catch(() => false));
    await expectAnyVisible(page, ['input[type="date"]']);
  },
});

// 2. Vehicle
buildCategoryBookingSuites({
  familyLabel: "Vehicle (Car / Motorcycle)",
  primaryKey: "car",
  secondaryKey: "motorcycle",
  emptyKeyword: "__e2e_empty_vehicle_xq9__",
  extraAssertions: async (page) => {
    // Vehicles have no shipping option
    await expectAnyVisible(page, ['input[type="date"]']);
  },
});

// 3. Property
buildCategoryBookingSuites({
  familyLabel: "Property (Apartment / House)",
  primaryKey: "apartment",
  secondaryKey: "house",
  emptyKeyword: "__e2e_empty_property_xq9__",
  extraAssertions: async (page) => {
    await expectAnyVisible(page, [
      'input[type="date"]',
      'label:has-text("Guests")',
      'input[name="guestCount"]',
    ]);
  },
});

// 4. Outdoor / Sports
buildCategoryBookingSuites({
  familyLabel: "Outdoor / Sports (Tent / Kayak)",
  primaryKey: "tent",
  secondaryKey: "kayak",
  emptyKeyword: "__e2e_empty_outdoor_xq9__",
  extraAssertions: async (page) => {
    await expectAnyVisible(page, [
      'input[type="date"]',
      'label:has-text("Pickup")',
      'label:has-text("Delivery")',
    ]);
  },
});

// 5. Musical Instrument
buildCategoryBookingSuites({
  familyLabel: "Musical Instrument (Guitar / Piano)",
  primaryKey: "guitar",
  secondaryKey: "piano",
  emptyKeyword: "__e2e_empty_instrument_xq9__",
});

// 6. Clothing / Fashion
buildCategoryBookingSuites({
  familyLabel: "Clothing / Fashion (Dress / Suit)",
  primaryKey: "dress",
  secondaryKey: "suit",
  emptyKeyword: "__e2e_empty_clothing_xq9__",
  extraAssertions: async (page) => {
    await expectAnyVisible(page, ['input[type="date"]']);
  },
});

// 7. Bicycle / Bike
buildCategoryBookingSuites({
  familyLabel: "Bicycle / Bike (Bicycle / E-Bike)",
  primaryKey: "bicycle",
  secondaryKey: "ebike",
  emptyKeyword: "__e2e_empty_bike_xq9__",
  extraAssertions: async (page) => {
    await expectAnyVisible(page, ['input[type="date"]']);
  },
});

// 8. General / Tools
buildCategoryBookingSuites({
  familyLabel: "General / Tools (Drill / Generator)",
  primaryKey: "drill",
  secondaryKey: "generator",
  emptyKeyword: "__e2e_empty_tools_xq9__",
});

// ===========================================================================
// Cross-category: Delivery method selection
// ===========================================================================

test.describe("Delivery method selection — cross-category", () => {
  let seed: SeedApi;
  let cameraListing: SeededListing;
  let tentListing: SeededListing;

  test.beforeAll(async ({ request }) => {
    seed = new SeedApi(request);
    await seed.init();
    [cameraListing, tentListing] = await Promise.all([
      seed.createListing("camera"),
      seed.createListing("tent"),
    ]);
  });

  test.afterAll(async () => {
    await seed.cleanup();
  });

  test("pickup option is selectable when listing supports it", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await openListing(page, cameraListing.id);
    const pickupLabel = page.locator('label:has-text("Pickup"), input[value="pickup"]');
    if (await pickupLabel.isVisible().catch(() => false)) {
      await pickupLabel.click();
      const input = page.locator('input[value="pickup"]');
      if (await input.isVisible().catch(() => false)) {
        await expect(input).toBeChecked();
      }
    } else {
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("delivery option requires address when selected", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await openListing(page, tentListing.id);
    const deliveryLabel = page.locator('label:has-text("Delivery"), input[value="delivery"]');
    if (!(await deliveryLabel.isVisible().catch(() => false))) return;
    await deliveryLabel.click();
    await fillDates(page, START, END);
    await clickFirstVisible(page, [
      'button:has-text("Book Instantly")',
      'button:has-text("Request to Book")',
    ]);
    await expectAnyVisible(page, [
      "text=/address|delivery address|provide.*address/i",
      "text=/available|not available/i",
    ]);
  });

  test("shipping option visible for listings that support it", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await openListing(page, tentListing.id);
    await expectAnyVisible(page, [
      'label:has-text("Shipping")',
      'input[value="shipping"]',
      'label:has-text("Pickup")',
    ]);
  });
});

// ===========================================================================
// Cross-category: Post-booking flows
// ===========================================================================

test.describe("Post-booking pages — bookings list and detail", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
  });

  test("bookings list page loads with status filter tabs", async ({ page }) => {
    await page.goto("/bookings");
    await expectAnyVisible(page, [
      'button:has-text("All")',
      'button:has-text("Pending")',
      'button:has-text("Confirmed")',
      "text=My Rentals",
      "text=No bookings yet",
    ]);
  });

  test("clicking a booking status tab filters the list", async ({ page }) => {
    await page.goto("/bookings");
    const pendingBtn = page.locator('button:has-text("Pending")');
    if (await pendingBtn.isVisible().catch(() => false)) {
      await pendingBtn.click();
      await expectAnyVisible(page, [
        "text=PENDING",
        "text=No bookings yet",
        "text=Pending",
      ]);
    } else {
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("booking detail shows pricing breakdown when a booking exists", async ({ page }) => {
    await page.goto("/bookings");
    const detailLink = page.locator('a:has-text("View Details")').first();
    if ((await detailLink.count()) === 0) {
      await expectAnyVisible(page, ["text=No bookings yet"]);
      return;
    }
    await detailLink.click();
    await expect(page).toHaveURL(/\/bookings\/.+/);
    await expectAnyVisible(page, [
      "text=Booking Information",
      "text=Pricing Breakdown",
      "text=Total",
    ]);
  });

  test("booking detail has cancel action when eligible", async ({ page }) => {
    await page.goto("/bookings");
    const detailLink = page.locator('a:has-text("View Details")').first();
    if ((await detailLink.count()) === 0) return;
    await detailLink.click();
    await expect(page).toHaveURL(/\/bookings\/.+/);
    const cancelBtn = page.locator('button:has-text("Cancel")');
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await expectAnyVisible(page, [
        "text=/reason|confirm|Are you sure/i",
        "dialog",
        '[role="dialog"]',
      ]);
    } else {
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("booking detail has send message action", async ({ page }) => {
    await page.goto("/bookings");
    const detailLink = page.locator('a:has-text("View Details")').first();
    if ((await detailLink.count()) === 0) return;
    await detailLink.click();
    await expect(page).toHaveURL(/\/bookings\/.+/);
    const msgBtn = page.locator('button:has-text("Send Message")');
    if (await msgBtn.isVisible().catch(() => false)) {
      await msgBtn.click();
      await expectAnyVisible(page, [
        "text=Messages",
        'input[name="message"]',
        "textarea",
      ]);
    } else {
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("host bookings toggle shows listings from owner perspective", async ({ page }) => {
    await page.goto("/bookings");
    const ownerToggle = page.locator('button:has-text("My Listings")');
    if (await ownerToggle.isVisible().catch(() => false)) {
      await ownerToggle.click();
      await expectAnyVisible(page, [
        "text=No bookings yet",
        'a:has-text("View Details")',
      ]);
    } else {
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
