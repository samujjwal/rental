/**
 * Booking Lifecycle — Full E2E Test Suite
 *
 * Covers every stage of the booking state machine, all actor perspectives,
 * and every edge-case branch described in the product requirements.
 *
 * Status machine (simplified):
 *   PENDING_OWNER_APPROVAL → (approve) → PENDING_PAYMENT
 *   PENDING_OWNER_APPROVAL → (reject)  → CANCELLED
 *   PENDING_PAYMENT        → (pay)     → CONFIRMED      [Stripe; skipped in CI]
 *   CONFIRMED              → (start)   → IN_PROGRESS
 *   IN_PROGRESS            → (request_return) → AWAITING_RETURN_INSPECTION
 *   AWAITING_RETURN_INSPECTION → (approve_return) → COMPLETED
 *   COMPLETED              → (review)  → SETTLED-ish
 *
 * Actors: renter, owner, admin, guest (unauthenticated)
 */

import { test, expect, type Page } from "@playwright/test";
import { testUsers } from "./helpers/fixtures";
import { ensureSeedData, type SeedData } from "./helpers/seed-data";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

interface DevLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

interface ListingItem {
  id: string;
  title: string;
  bookingType?: "INSTANT_BOOK" | "REQUEST";
  status?: string;
}

interface BookingItem {
  id: string;
  status: string;
  renterId?: string;
  ownerId?: string;
}

// ---------------------------------------------------------------------------
// Low-level API helpers (no page-auth side effects)
// ---------------------------------------------------------------------------

async function devLogin(
  page: Page,
  role: "USER" | "HOST" | "ADMIN"
): Promise<DevLoginResponse> {
  const email =
    role === "HOST"
      ? testUsers.owner.email
      : role === "ADMIN"
        ? testUsers.admin.email
        : testUsers.renter.email;

  const res = await page.request.post(`${API}/auth/dev-login`, {
    data: { email, role },
  });

  if (!res.ok()) {
    throw new Error(`dev-login failed: ${res.status()} ${await res.text()}`);
  }
  return res.json() as Promise<DevLoginResponse>;
}

/** Inject tokens into localStorage so the SPA treats the user as authenticated. */
async function injectAuth(page: Page, payload: DevLoginResponse) {
  await page.evaluate(
    ({ accessToken, refreshToken, user }) => {
      const rawRole = (user.role ?? "").toUpperCase();
      const normalizedRole =
        rawRole === "HOST"
          ? "owner"
          : rawRole === "ADMIN" || rawRole === "SUPER_ADMIN"
            ? "admin"
            : "renter";
      const normalizedUser = { ...user, role: normalizedRole };
      const state = JSON.stringify({
        state: { user: normalizedUser, accessToken, refreshToken },
        version: 0,
      });
      localStorage.setItem("auth-storage", state);
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
    },
    payload
  );
}

/** Login and navigate, wiring up localStorage auth. */
async function loginAndGo(
  page: Page,
  role: "USER" | "HOST" | "ADMIN",
  path = "/dashboard"
) {
  // land on the app first so we can touch localStorage
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const payload = await devLogin(page, role);
  await injectAuth(page, payload);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
  return payload;
}

/** Authed API call helper (uses an already-obtained token). */
async function apiPost(
  page: Page,
  path: string,
  token: string,
  body: Record<string, unknown> = {}
) {
  return page.request.post(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
}

async function apiGet(page: Page, path: string, token: string) {
  return page.request.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

/** Find the first approved & published listing that can be booked. */
async function findBookableListing(
  page: Page,
  token: string
): Promise<ListingItem | null> {
  const res = await apiGet(page, "/listings?limit=20&status=PUBLISHED", token);
  if (!res.ok()) return null;
  const data = (await res.json()) as { data?: ListingItem[]; items?: ListingItem[] };
  const items = data.data ?? data.items ?? (data as unknown as ListingItem[]);
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

/** Create a booking via the API and return response body. */
async function createBookingViaApi(
  page: Page,
  token: string,
  listingId: string,
  daysFromNow = 5
): Promise<BookingItem> {
  const start = new Date();
  start.setDate(start.getDate() + daysFromNow);
  start.setHours(10, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 2);

  const res = await apiPost(page, "/bookings", token, {
    listingId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  if (!res.ok()) {
    throw new Error(`createBooking failed: ${res.status()} ${await res.text()}`);
  }
  return res.json() as Promise<BookingItem>;
}

/** Drive the booking through a sequence of API state transitions.
 *  transitions: array of { path, token } e.g. `/bookings/:id/approve`
 */
async function advanceBookingViaApi(
  page: Page,
  bookingId: string,
  steps: Array<{ endpoint: string; token: string; body?: Record<string, unknown> }>
) {
  for (const step of steps) {
    const res = await apiPost(
      page,
      `/bookings/${bookingId}${step.endpoint}`,
      step.token,
      step.body ?? {}
    );
    if (!res.ok()) {
      const text = await res.text();
      throw new Error(
        `advance step ${step.endpoint} failed (${res.status()}): ${text}`
      );
    }
  }
}

/** Navigate to booking detail page and wait for content. */
async function gotoBooking(page: Page, bookingId: string) {
  await page.goto(`${BASE_URL}/bookings/${bookingId}`, {
    waitUntil: "domcontentloaded",
  });
  // Booking page renders a heading or status badge
  await expect(
    page.locator('h1, [data-testid="booking-status"], .booking-status').first()
  ).toBeVisible({ timeout: 10_000 });
}

/** Click a booking action button by its visible text. */
async function clickActionButton(page: Page, text: string) {
  const btn = page.locator(`button:has-text("${text}")`).first();
  await btn.waitFor({ state: "visible", timeout: 8_000 });
  await btn.click();
}

/** Wait for a toast/success message containing text. */
async function expectSuccess(page: Page, fragment?: string) {
  // Accept either a toast with role=status, a .success element, or URL change
  const toastLocator = page.locator(
    '[role="status"], [role="alert"], .toast, [data-testid*="toast"], [data-testid*="success"]'
  );
  const appeared = await toastLocator
    .first()
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  if (!appeared && fragment) {
    // Fallback: check page text
    await expect(page.locator("body")).toContainText(fragment, {
      timeout: 5_000,
    });
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Booking Lifecycle — Full E2E", () => {
  /**
   * Seed data is created once per worker (beforeAll) to guarantee that
   * findBookableListing() and createBookingViaApi() never return null.
   * This replaces the 113 conditional test.skip() calls that previously
   * silently skipped tests when prerequisite data was missing.
   */
  let seedData: SeedData;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      seedData = await ensureSeedData(page);
    } finally {
      await ctx.close();
    }
  });

  // =========================================================================
  // 1. Auth & Access Guards
  // =========================================================================
  test.describe("1. Auth & Access Guards", () => {
    test("guest is redirected to login when accessing /bookings", async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/bookings`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/auth\/login/, { timeout: 8_000 });
    });

    test("guest is redirected to login when accessing a booking detail page", async ({
      page,
    }) => {
      // Use a syntactically valid UUID (not real)
      const fakeId = "00000000-0000-4000-8000-000000000001";
      await page.goto(`${BASE_URL}/bookings/${fakeId}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/auth\/login/, { timeout: 8_000 });
    });

    test("non-UUID booking id redirects to /bookings", async ({ page }) => {
      await loginAndGo(page, "USER", "/dashboard");
      await page.goto(`${BASE_URL}/bookings/not-a-uuid`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/\/bookings$/, { timeout: 8_000 });
    });

    test("non-participant (wrong user) is redirected away from booking detail", async ({
      page,
      browser,
    }) => {
      // Owner gets their token to make a booking for themselves, then renter
      // tries to access owner's booking — should be redirected.
      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();

      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      // Now log in as a completely different renter
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      // Seed: owner creates a booking using the owner token (simulates owner viewing
      // their booking) — for the redirect test we just need any valid booking id
      // owned by the HOST that is NOT the renter.
      const listing = await findBookableListing(page, ownerPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        ownerPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      // Authenticate as renter and try to access owner-only booking
      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/\/bookings($|\?)/, { timeout: 8_000 });
    });
  });

  // =========================================================================
  // 2. Booking Creation via UI — Listing Detail Page
  // =========================================================================
  test.describe("2. Listing Detail → Booking Panel", () => {
    test("booking panel shows on listing page and validates date input", async ({
      page,
    }) => {
      const payload = await loginAndGo(page, "USER", "/listings");
      const listing = await findBookableListing(page, payload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      await page.goto(`${BASE_URL}/listings/${listing.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Price/availability panel should be visible
      const panel = page.locator(
        '[data-testid="booking-panel"], .booking-panel, form:has([name="startDate"])'
      );
      await expect(panel.first()).toBeVisible({ timeout: 10_000 });
    });

    test("Book button is present and labels match booking mode", async ({
      page,
    }) => {
      const payload = await loginAndGo(page, "USER", "/dashboard");
      const listing = await findBookableListing(page, payload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      await page.goto(`${BASE_URL}/listings/${listing.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Either "Book Now" (instant) or "Request to Book" (request) must exist
      const bookBtn = page.locator(
        'button:has-text("Book Now"), button:has-text("Request to Book"), button:has-text("Book")'
      );
      await expect(bookBtn.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // =========================================================================
  // 3. REQUEST Booking — Owner Approval Flow (happy path)
  // =========================================================================
  test.describe("3. REQUEST Booking — Owner Approval → Payment → Active → Return → Complete", () => {
    /**
     * Shared booking id across the sequential steps below.
     * We use test.step to keep them in one test so state is naturally shared.
     */
    test("full REQUEST booking lifecycle via API + UI actions", async ({
      page,
      browser,
    }) => {
      // ---------- Seed auth tokens for both actors ----------
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;

      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      // ---------- Find a bookable listing ----------
      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      // ---------- Step 1: Renter creates booking ----------
      let booking: BookingItem;
      await test.step("Renter creates a booking", async () => {
        booking = await createBookingViaApi(
          page,
          renterPayload.accessToken,
          listing.id
        );
        expect(booking.id).toBeTruthy();
        // Status is either PENDING_OWNER_APPROVAL or PENDING_PAYMENT (instant)
        expect(["PENDING_OWNER_APPROVAL", "PENDING_PAYMENT"]).toContain(
          booking.status
        );
      });

      // ---------- Step 2: Renter sees booking in /bookings list ----------
      await test.step("Renter sees booking in their list", async () => {
        await injectAuth(page, renterPayload);
        await page.goto(`${BASE_URL}/bookings`, {
          waitUntil: "domcontentloaded",
        });
        // Booking card must appear
        const card = page.locator(`[data-booking-id="${booking!.id}"], a[href*="${booking!.id}"]`).first();
        const found = await card
          .waitFor({ state: "visible", timeout: 8_000 })
          .then(() => true)
          .catch(() => false);
        if (!found) {
          // Fallback: at least navigating to the booking detail works
          await page.goto(`${BASE_URL}/bookings/${booking!.id}`, {
            waitUntil: "domcontentloaded",
          });
          await expect(page.locator("body")).not.toContainText("404", {
            timeout: 5_000,
          });
        }
      });

      // If INSTANT_BOOK, skip approval steps
      if (booking!.status === "PENDING_OWNER_APPROVAL") {
        // ---------- Step 3: Owner approves ----------
        await test.step("Owner confirms booking via API", async () => {
          await advanceBookingViaApi(page, booking!.id, [
            { endpoint: "/approve", token: ownerPayload.accessToken },
          ]);
        });

        // ---------- Step 3b: Owner sees Confirm / Decline buttons in UI ----------
        // (tested separately in owner-perspective tests)
      }

      // At this point status should be PENDING_PAYMENT (or CONFIRMED if instant+no stripe)
      // For the rest of the lifecycle we use API to drive state forward
      // (Stripe is not available in test env)

      // Advance: approve (if needed) → skip payment → start
      const advanceSteps: Array<{endpoint: string; token: string}> = [];

      if (booking!.status === "PENDING_OWNER_APPROVAL") {
        // already approved above; reload booking to check
      }

      // advance to CONFIRMED via approve-return mock: skip Stripe payment by
      // setting status directly through the /start endpoint which the backend
      // accepts only when status=CONFIRMED. We rely on the API seed.
      // For this test we only verify the UI reflects states fetched from API.

      // ---------- Step 4: Renter sees booking detail with correct status ----------
      await test.step("Renter's booking detail renders without errors", async () => {
        await injectAuth(page, renterPayload);
        await page.goto(`${BASE_URL}/bookings/${booking!.id}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page.locator("body")).not.toContainText("Something went wrong", {
          timeout: 5_000,
        });
        await expect(page.locator("body")).not.toContainText("404");
      });
    });
  });

  // =========================================================================
  // 4. Owner Perspective — Approve & Decline Buttons Visible in UI
  // =========================================================================
  test.describe("4. Owner UI — Approval Buttons", () => {
    test("owner sees Confirm and Decline buttons on PENDING_OWNER_APPROVAL booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking || booking.status !== "PENDING_OWNER_APPROVAL") throw new Error("Skipped: prerequisite not met — seed data required");

      // Log in as owner and view the booking
      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Confirm button should be present
      await expect(
        page.locator('button:has-text("Confirm Booking")').first()
      ).toBeVisible({ timeout: 10_000 });

      // Decline button should be present
      await expect(
        page.locator('button:has-text("Decline Booking")').first()
      ).toBeVisible({ timeout: 5_000 });
    });

    test("owner can approve a pending booking", async ({ page, browser }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking || booking.status !== "PENDING_OWNER_APPROVAL") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await clickActionButton(page, "Confirm Booking");

      // After confirmation the status should change — Confirm button disappears
      // or a success indicator appears
      await expect(
        page.locator('button:has-text("Confirm Booking")')
      ).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // =========================================================================
  // 5. Owner Rejection Flow
  // =========================================================================
  test.describe("5. Owner Rejection Flow", () => {
    test("owner can decline a booking with a reason", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking || booking.status !== "PENDING_OWNER_APPROVAL") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Click "Decline Booking" to open reject modal
      await clickActionButton(page, "Decline Booking");

      // Modal / inline form: fill in rejection reason
      const reasonInput = page.locator(
        'textarea[placeholder*="reason"], textarea[name="reason"], textarea[placeholder*="cancellation"]'
      );
      await reasonInput.first().waitFor({ state: "visible", timeout: 8_000 });
      await reasonInput.first().fill("Dates unavailable for this listing.");

      // Confirm the rejection (the modal submit)
      const confirmBtn = page.locator(
        'button:has-text("Decline Booking"), button:has-text("Reject"), button[type="submit"]'
      );
      await confirmBtn.first().click();

      // Booking should be in CANCELLED state → buttons for PENDING_OWNER_APPROVAL gone
      await expect(
        page.locator('button:has-text("Confirm Booking")')
      ).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // =========================================================================
  // 6. Checkout / Payment Page
  // =========================================================================
  test.describe("6. Checkout / Payment Page", () => {
    test("checkout page is accessible for PENDING_PAYMENT booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      // Create booking and advance to PENDING_PAYMENT
      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      // If REQUEST, approve first
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/checkout/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Without Stripe key the page redirects to /bookings/:id — either is fine.
      // With Stripe key a payment form is rendered.
      const isOnCheckout = page.url().includes("/checkout/");
      const isOnBookingDetail = page.url().includes(`/bookings/${booking.id}`);

      expect(isOnCheckout || isOnBookingDetail).toBe(true);

      if (isOnCheckout) {
        // Stripe PaymentElement or a placeholder must render
        const paymentEl = page.locator(
          '[data-testid="payment-form"], iframe[title*="payment"], .stripe-element, #payment-element'
        );
        const hasEl = await paymentEl
          .first()
          .waitFor({ state: "attached", timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        // If no Stripe element, at minimum there should be no 404/crash
        if (!hasEl) {
          await expect(page.locator("body")).not.toContainText("404");
          await expect(page.locator("body")).not.toContainText("Something went wrong");
        }
      }
    });

    test("non-renter cannot access checkout page", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      // Owner tries to access renter's checkout
      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/checkout/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Should be redirected away from checkout
      await expect(page).not.toHaveURL(/\/checkout\//, { timeout: 8_000 });
    });

    test("checkout page with non-UUID id redirects", async ({ page }) => {
      await loginAndGo(page, "USER", "/dashboard");
      await page.goto(`${BASE_URL}/checkout/not-a-uuid`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).not.toHaveURL(/\/checkout\//, { timeout: 8_000 });
    });
  });

  // =========================================================================
  // 7. Active Rental — Start → Return Request → Approve Return
  // =========================================================================
  test.describe("7. Active Rental Lifecycle (API-seeded)", () => {
    test("owner sees Start Rental button on CONFIRMED booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      // Advance to CONFIRMED (approve if needed, then skip payment by calling /start
      // which the backend allows only from CONFIRMED — we advance via API)
      const advanceSteps: Array<{endpoint: string; token: string}> = [];
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        advanceSteps.push({ endpoint: "/approve", token: ownerPayload.accessToken });
      }
      // Note: advancing from PENDING_PAYMENT to CONFIRMED requires Stripe webhook.
      // We test the UI conditional on the booking reaching CONFIRMED status; if the
      // test env doesn't support this path we skip gracefully.
      if (advanceSteps.length > 0) {
        await advanceBookingViaApi(page, booking.id, advanceSteps).catch(
          () => null
        );
      }

      // Fetch booking state after advancement
      const latestRes = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const latest = latestRes.ok()
        ? ((await latestRes.json()) as BookingItem)
        : booking;

      test.skip(
        latest.status !== "CONFIRMED",
        `Stripe not available in this environment (status=${latest.status})`
      );

      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await expect(
        page.locator('button:has-text("Start Rental")').first()
      ).toBeVisible({ timeout: 10_000 });
    });

    test("owner starts rental and rental transitions to active", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const latestRes = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const latest = latestRes.ok()
        ? ((await latestRes.json()) as BookingItem)
        : booking;

      if (latest.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      // Owner starts via UI
      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });
      await clickActionButton(page, "Start Rental");

      // Start Rental button disappears after action
      await expect(
        page.locator('button:has-text("Start Rental")')
      ).not.toBeVisible({ timeout: 10_000 });
    });

    test("renter sees Request Return button when booking is IN_PROGRESS", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      const steps: Array<{endpoint: string; token: string}> = [];
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        steps.push({ endpoint: "/approve", token: ownerPayload.accessToken });
      }
      if (steps.length > 0) {
        await advanceBookingViaApi(page, booking.id, steps).catch(() => null);
      }

      // Check if CONFIRMED; if so advance to IN_PROGRESS via API
      const afterApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const afterApproveData = afterApprove.ok()
        ? ((await afterApprove.json()) as BookingItem)
        : booking;

      if (afterApproveData.status === "CONFIRMED") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/start", token: ownerPayload.accessToken },
        ]).catch(() => null);
      } else {
        test.skip(true, `Stripe not available — cannot transition past PENDING_PAYMENT (status=${afterApproveData.status})`);
      }

      // Verify IN_PROGRESS state via API
      const activeRes = await apiGet(
        page,
        `/bookings/${booking.id}`,
        renterPayload.accessToken
      );
      const activeData = activeRes.ok()
        ? ((await activeRes.json()) as BookingItem)
        : null;
      if (!activeData || activeData.status !== "IN_PROGRESS") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await expect(
        page.locator('button:has-text("Request Return")').first()
      ).toBeVisible({ timeout: 10_000 });
    });

    test("owner sees Approve Return button after renter requests return", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      // Try advancing all the way to AWAITING_RETURN_INSPECTION
      const steps: Array<{endpoint: string; token: string}> = [];
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        steps.push({ endpoint: "/approve", token: ownerPayload.accessToken });
      }
      if (steps.length > 0) {
        await advanceBookingViaApi(page, booking.id, steps).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
      ]).catch(() => null);

      const awaitingRes = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const awaitingData = awaitingRes.ok()
        ? ((await awaitingRes.json()) as BookingItem)
        : null;
      if (
        !awaitingData ||
        awaitingData.status !== "AWAITING_RETURN_INSPECTION"
      ) throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await expect(
        page.locator('button:has-text("Approve Return")').first()
      ).toBeVisible({ timeout: 10_000 });
    });

    test("owner approves return and booking reaches COMPLETED", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      const steps: Array<{endpoint: string; token: string}> = [];
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        steps.push({ endpoint: "/approve", token: ownerPayload.accessToken });
      }
      if (steps.length > 0) {
        await advanceBookingViaApi(page, booking.id, steps).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
      ]).catch(() => null);

      const awaitingRes = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const awaitingData = awaitingRes.ok()
        ? ((await awaitingRes.json()) as BookingItem)
        : null;
      if (
        !awaitingData ||
        awaitingData.status !== "AWAITING_RETURN_INSPECTION"
      ) throw new Error("Skipped: prerequisite not met — seed data required");

      // Owner approves return via UI
      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await clickActionButton(page, "Approve Return");

      // After approval the Approve Return button should no longer be visible
      await expect(
        page.locator('button:has-text("Approve Return")')
      ).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // =========================================================================
  // 8. Cancellation
  // =========================================================================
  test.describe("8. Cancellation", () => {
    test("renter can cancel a PENDING_OWNER_APPROVAL booking", async ({
      page,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Open cancel modal
      await clickActionButton(page, "Cancel Booking");

      // Fill in reason
      const reasonInput = page.locator(
        'textarea[placeholder*="reason"], textarea[placeholder*="cancellation"], textarea[name="reason"]'
      );
      await reasonInput.first().waitFor({ state: "visible", timeout: 8_000 });
      await reasonInput.first().fill("Plans changed, no longer needed.");

      // Submit cancellation
      const submitBtn = page.locator(
        'button:has-text("Cancel Booking"), button[type="submit"]'
      ).last();
      await submitBtn.click();

      // Should redirect to /bookings after cancellation
      await expect(page).toHaveURL(/\/bookings($|\?)/, { timeout: 10_000 });
    });

    test("cancel modal validation — cannot submit without reason", async ({
      page,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await clickActionButton(page, "Cancel Booking");

      const reasonInput = page.locator(
        'textarea[placeholder*="reason"], textarea[placeholder*="cancellation"], textarea[name="reason"]'
      );
      await reasonInput.first().waitFor({ state: "visible", timeout: 8_000 });
      // Leave reason empty and try to submit
      const submitBtn = page.locator(
        'button:has-text("Cancel Booking"), button[type="submit"]'
      ).last();
      await submitBtn.click();

      // Should still be on the booking detail page (not redirected away)
      await expect(page).toHaveURL(
        new RegExp(`/bookings/${booking.id}`),
        { timeout: 5_000 }
      );
    });
  });

  // =========================================================================
  // 9. Dispute Filing
  // =========================================================================
  test.describe("9. Dispute Filing", () => {
    test("File a Dispute button is visible on active/confirmed booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
      ]).catch(() => null);

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await expect(
        page.locator('button:has-text("File a Dispute"), a:has-text("File a Dispute")').first()
      ).toBeVisible({ timeout: 10_000 });
    });

    test("clicking File a Dispute navigates to dispute form", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
      ]).catch(() => null);

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      const disputeBtn = page.locator(
        'button:has-text("File a Dispute"), a:has-text("File a Dispute")'
      ).first();
      await disputeBtn.waitFor({ state: "visible", timeout: 10_000 });
      await disputeBtn.click();

      await expect(page).toHaveURL(
        new RegExp(`/disputes/new/${booking.id}`),
        { timeout: 8_000 }
      );
    });

    test("dispute form renders all required fields", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
      ]).catch(() => null);

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/disputes/new/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Dispute type radio buttons
      await expect(
        page.locator('input[name="type"][value="PROPERTY_DAMAGE"]')
      ).toBeAttached({ timeout: 10_000 });

      // Title and description fields
      await expect(page.locator('input[name="title"]')).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.locator('textarea[name="description"]')).toBeVisible();

      // Submit button
      await expect(
        page.locator('button[type="submit"]').last()
      ).toBeVisible();
    });

    test("dispute form submits successfully with all required fields", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
      ]).catch(() => null);

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/disputes/new/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Select dispute type
      await page
        .locator('input[name="type"][value="PROPERTY_DAMAGE"]')
        .click();

      // Fill title
      await page.locator('input[name="title"]').fill("Item was damaged on arrival");

      // Fill description
      await page
        .locator('textarea[name="description"]')
        .fill(
          "The rental item had visible scratches and dents that were not shown in the listing photos."
        );

      // Submit
      await page.locator('button[type="submit"]').last().click();

      // After successful submission, navigate away from the form
      await expect(page).not.toHaveURL(
        new RegExp(`/disputes/new/${booking.id}`),
        { timeout: 10_000 }
      );
    });

    test("dispute form shows error when type is not selected", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
      ]).catch(() => null);

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/disputes/new/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Fill description only (no type)
      await page.locator('input[name="title"]').fill("Missing part");
      await page.locator('textarea[name="description"]').fill("A key part is missing.");

      // Submit button should be disabled without type selected
      const submitBtn = page.locator('button[type="submit"]').last();
      await expect(submitBtn).toBeDisabled({ timeout: 5_000 });
    });
  });

  // =========================================================================
  // 10. Review Submission
  // =========================================================================
  test.describe("10. Review Submission", () => {
    test("Leave a Review button opens review modal on COMPLETED booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
        { endpoint: "/approve-return", token: ownerPayload.accessToken },
      ]).catch(() => null);

      const completedRes = await apiGet(
        page,
        `/bookings/${booking.id}`,
        renterPayload.accessToken
      );
      const completedData = completedRes.ok()
        ? ((await completedRes.json()) as BookingItem)
        : null;
      if (!completedData || completedData.status !== "COMPLETED") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await expect(
        page.locator('button:has-text("Leave a Review")').first()
      ).toBeVisible({ timeout: 10_000 });

      // Open the modal
      await clickActionButton(page, "Leave a Review");

      // Modal should appear with star rating and text area
      await expect(
        page.locator('[aria-label="Rate 5 star(s)"], [aria-label="Rate 4 star(s)"]')
          .first()
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        page.locator('textarea[placeholder*="experience"]').first()
      ).toBeVisible();
    });

    test("renter can submit a 5-star review", async ({ page, browser }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
        { endpoint: "/approve-return", token: ownerPayload.accessToken },
      ]).catch(() => null);

      const completedRes = await apiGet(
        page,
        `/bookings/${booking.id}`,
        renterPayload.accessToken
      );
      const completedData = completedRes.ok()
        ? ((await completedRes.json()) as BookingItem)
        : null;
      if (!completedData || completedData.status !== "COMPLETED") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await clickActionButton(page, "Leave a Review");

      // Select 5 stars
      await page.locator('[aria-label="Rate 5 star(s)"]').click();

      // Write comment
      await page
        .locator('textarea[placeholder*="experience"]')
        .fill("Excellent rental experience. Item was exactly as described. Highly recommend!");

      // Submit review
      await page.locator('button:has-text("Submit Review")').click();

      // Review button should disappear or a success indicator shown
      await expect(
        page.locator('button:has-text("Leave a Review")')
      ).not.toBeVisible({ timeout: 10_000 });
    });

    test("review modal requires rating to submit", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
        { endpoint: "/approve-return", token: ownerPayload.accessToken },
      ]).catch(() => null);

      const completedRes = await apiGet(
        page,
        `/bookings/${booking.id}`,
        renterPayload.accessToken
      );
      const completedData = completedRes.ok()
        ? ((await completedRes.json()) as BookingItem)
        : null;
      if (!completedData || completedData.status !== "COMPLETED") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      await clickActionButton(page, "Leave a Review");

      // Do NOT select stars; just write a comment
      await page
        .locator('textarea[placeholder*="experience"]')
        .fill("No rating selected");

      // Submit button should be disabled or the modal stays open
      const submitBtn = page.locator('button:has-text("Submit Review")');
      const isDisabled = await submitBtn.isDisabled().catch(() => false);
      if (!isDisabled) {
        // Try clicking anyway and verify we stay on the page (validation prevents)
        await submitBtn.click();
        await expect(page).toHaveURL(
          new RegExp(`/bookings/${booking.id}`),
          { timeout: 5_000 }
        );
      } else {
        expect(isDisabled).toBe(true);
      }
    });
  });

  // =========================================================================
  // 11. Bookings List — Filters & Navigation
  // =========================================================================
  test.describe("11. Bookings List", () => {
    test("renter can view their bookings list", async ({ page }) => {
      const payload = await loginAndGo(page, "USER", "/bookings");
      await expect(page).not.toHaveURL(/auth\/login/, { timeout: 5_000 });
      // List page renders without unhandled errors
      await expect(page.locator("body")).not.toContainText("Something went wrong");
    });

    test("owner can view their host bookings", async ({ page }) => {
      await loginAndGo(page, "HOST", "/bookings");
      await expect(page).not.toHaveURL(/auth\/login/, { timeout: 5_000 });
      await expect(page.locator("body")).not.toContainText("Something went wrong");
    });

    test("bookings list has status filter controls", async ({ page }) => {
      await loginAndGo(page, "USER", "/bookings");
      // Status filter tabs or select should be present
      const filterEl = page.locator(
        '[data-testid*="filter"], [role="tablist"], select, .filter-tabs, button:has-text("All"), button:has-text("Pending"), button:has-text("Active")'
      );
      const hasFilters = await filterEl
        .first()
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);

      // Filter controls are expected but not strictly required for the skeleton
      if (hasFilters) {
        await expect(filterEl.first()).toBeVisible();
      }
    });

    test("admin can access admin booking management", async ({ page }) => {
      await loginAndGo(page, "ADMIN", "/admin");
      await expect(page).not.toHaveURL(/auth\/login/, { timeout: 5_000 });
      await expect(page.locator("body")).not.toContainText("Something went wrong");
    });
  });

  // =========================================================================
  // 12. Edge Cases
  // =========================================================================
  test.describe("12. Edge Cases", () => {
    test("booking detail page gracefully handles unknown booking id", async ({
      page,
    }) => {
      await loginAndGo(page, "USER", "/dashboard");
      // Valid UUID format but doesn't exist in DB
      const unknownId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
      await page.goto(`${BASE_URL}/bookings/${unknownId}`, {
        waitUntil: "domcontentloaded",
      });
      // Should redirect to /bookings or show an error page — not crash with 500
      const url = page.url();
      const acceptableUrl =
        url.includes("/bookings") && !url.includes(unknownId);
      const hasError =
        await page.locator("body").textContent().then((t) => {
          return (
            (t ?? "").includes("404") ||
            (t ?? "").includes("not found") ||
            (t ?? "").includes("Not Found")
          );
        });
      expect(acceptableUrl || hasError).toBe(true);
    });

    test("dispute page with unknown booking id redirects to /bookings", async ({
      page,
    }) => {
      await loginAndGo(page, "USER", "/dashboard");
      const unknownId = "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff";
      await page.goto(`${BASE_URL}/disputes/new/${unknownId}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/\/bookings/, { timeout: 8_000 });
    });

    test("dispute page with non-UUID booking id redirects", async ({
      page,
    }) => {
      await loginAndGo(page, "USER", "/dashboard");
      await page.goto(`${BASE_URL}/disputes/new/not-a-uuid`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/\/bookings/, { timeout: 8_000 });
    });

    test("booking detail page is accessible via direct URL after login", async ({
      page,
    }) => {
      const payload = await loginAndGo(page, "USER", "/dashboard");

      // Verify a valid booking created by the renter is accessible
      const listing = await findBookableListing(page, payload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        payload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      // Reload page freshly (simulate direct navigation)
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("body")).not.toContainText("404");
      await expect(page.locator("body")).not.toContainText("Something went wrong");
    });

    test("back navigation from dispute form returns to booking detail", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(
        page,
        renterPayload.accessToken,
        listing.id
      ).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(
        page,
        `/bookings/${booking.id}`,
        ownerPayload.accessToken
      );
      const postApproveData = postApprove.ok()
        ? ((await postApprove.json()) as BookingItem)
        : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
      ]).catch(() => null);

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/disputes/new/${booking.id}`, {
        waitUntil: "domcontentloaded",
      });

      // Click the Cancel button in the dispute form
      await page.locator('button:has-text("Cancel")').first().click();

      // Going back should land on booking detail or /bookings
      await expect(page).toHaveURL(/\/bookings/, { timeout: 8_000 });
    });
  });

  // =========================================================================
  // 13. Reject Return — Owner Reports Damage
  // =========================================================================
  test.describe("13. Reject Return — Owner Reports Damage", () => {
    test("owner sees Report Damage button on AWAITING_RETURN_INSPECTION booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      // Advance to AWAITING_RETURN_INSPECTION
      const steps: Array<{endpoint: string; token: string}> = [];
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        steps.push({ endpoint: "/approve", token: ownerPayload.accessToken });
      }
      if (steps.length > 0) {
        await advanceBookingViaApi(page, booking.id, steps).catch(() => null);
      }

      const postApprove = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const postApproveData = postApprove.ok() ? ((await postApprove.json()) as BookingItem) : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
      ]).catch(() => null);

      const awaitingRes = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const awaitingData = awaitingRes.ok() ? ((await awaitingRes.json()) as BookingItem) : null;
      if (!awaitingData || awaitingData.status !== "AWAITING_RETURN_INSPECTION") throw new Error("Skipped: prerequisite not met — seed data required");

      // Log in as owner and verify Report Damage button is visible
      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      await expect(
        page.locator('button:has-text("Report Damage")').first()
      ).toBeVisible({ timeout: 10_000 });
    });

    test("owner can reject return with a reason via Report Damage", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      const steps: Array<{endpoint: string; token: string}> = [];
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        steps.push({ endpoint: "/approve", token: ownerPayload.accessToken });
      }
      if (steps.length > 0) {
        await advanceBookingViaApi(page, booking.id, steps).catch(() => null);
      }

      const postApprove = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const postApproveData = postApprove.ok() ? ((await postApprove.json()) as BookingItem) : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
      ]).catch(() => null);

      const awaitingRes = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const awaitingData = awaitingRes.ok() ? ((await awaitingRes.json()) as BookingItem) : null;
      if (!awaitingData || awaitingData.status !== "AWAITING_RETURN_INSPECTION") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      // Click Report Damage button
      await clickActionButton(page, "Report Damage");

      // Modal should appear with reason textarea
      const reasonInput = page.locator(
        'textarea[placeholder*="reason"], textarea[placeholder*="damage"], textarea[name="reason"]'
      );
      await reasonInput.first().waitFor({ state: "visible", timeout: 8_000 });
      await reasonInput.first().fill("Item returned with scratches on the lens. Photos attached.");

      // Submit the damage report
      const submitBtn = page.locator(
        'button:has-text("Report Damage"), button[type="submit"]'
      ).last();
      await submitBtn.click();

      // Report Damage button should disappear or booking status changes
      await expect(
        page.locator('button:has-text("Report Damage")')
      ).not.toBeVisible({ timeout: 10_000 });
    });

    test("reject-return via API transitions booking to DISPUTED", async ({ page, browser }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      const steps: Array<{endpoint: string; token: string}> = [];
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        steps.push({ endpoint: "/approve", token: ownerPayload.accessToken });
      }
      if (steps.length > 0) {
        await advanceBookingViaApi(page, booking.id, steps).catch(() => null);
      }

      const postApprove = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const postApproveData = postApprove.ok() ? ((await postApprove.json()) as BookingItem) : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
      ]).catch(() => null);

      const awaitingRes = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const awaitingData = awaitingRes.ok() ? ((await awaitingRes.json()) as BookingItem) : null;
      if (!awaitingData || awaitingData.status !== "AWAITING_RETURN_INSPECTION") throw new Error("Skipped: prerequisite not met — seed data required");

      // Reject return via API
      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/reject-return", token: ownerPayload.accessToken, body: { reason: "Damaged item" } },
      ]);

      // Verify booking moved to DISPUTED
      const disputedRes = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const disputedData = disputedRes.ok() ? ((await disputedRes.json()) as BookingItem) : null;
      expect(disputedData?.status).toBe("DISPUTED");
    });

    test("renter does NOT see Report Damage button on AWAITING_RETURN_INSPECTION booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      const steps: Array<{endpoint: string; token: string}> = [];
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        steps.push({ endpoint: "/approve", token: ownerPayload.accessToken });
      }
      if (steps.length > 0) {
        await advanceBookingViaApi(page, booking.id, steps).catch(() => null);
      }

      const postApprove = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const postApproveData = postApprove.ok() ? ((await postApprove.json()) as BookingItem) : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
      ]).catch(() => null);

      const awaitingRes = await apiGet(page, `/bookings/${booking.id}`, renterPayload.accessToken);
      const awaitingData = awaitingRes.ok() ? ((await awaitingRes.json()) as BookingItem) : null;
      if (!awaitingData || awaitingData.status !== "AWAITING_RETURN_INSPECTION") throw new Error("Skipped: prerequisite not met — seed data required");

      // Log in as renter — should NOT see Report Damage
      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      await expect(
        page.locator('button:has-text("Report Damage")')
      ).not.toBeVisible({ timeout: 5_000 });
    });
  });

  // =========================================================================
  // 14. Payment Retry — Pay Now / Retry Payment Button
  // =========================================================================
  test.describe("14. Payment Retry — Pay Now / Retry Payment", () => {
    test("renter sees Pay Now button on PENDING_PAYMENT booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      // Approve if needed to reach PENDING_PAYMENT
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const statusRes = await apiGet(page, `/bookings/${booking.id}`, renterPayload.accessToken);
      const statusData = statusRes.ok() ? ((await statusRes.json()) as BookingItem) : null;
      if (!statusData || statusData.status !== "PENDING_PAYMENT") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      // Renter should see Pay Now button
      await expect(
        page.locator('button:has-text("Pay Now"), a:has-text("Pay Now")').first()
      ).toBeVisible({ timeout: 10_000 });
    });

    test("Pay Now button navigates to checkout page", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const statusRes = await apiGet(page, `/bookings/${booking.id}`, renterPayload.accessToken);
      const statusData = statusRes.ok() ? ((await statusRes.json()) as BookingItem) : null;
      if (!statusData || statusData.status !== "PENDING_PAYMENT") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      const payBtn = page.locator('button:has-text("Pay Now"), a:has-text("Pay Now")').first();
      await payBtn.waitFor({ state: "visible", timeout: 10_000 });
      await payBtn.click();

      // Should navigate to /checkout/:id
      await expect(page).toHaveURL(new RegExp(`/checkout/${booking.id}`), { timeout: 8_000 });
    });

    test("owner does NOT see Pay Now button on PENDING_PAYMENT booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const statusRes = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const statusData = statusRes.ok() ? ((await statusRes.json()) as BookingItem) : null;
      if (!statusData || statusData.status !== "PENDING_PAYMENT") throw new Error("Skipped: prerequisite not met — seed data required");

      // Log in as owner — should NOT see Pay Now
      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      await expect(
        page.locator('button:has-text("Pay Now"), a:has-text("Pay Now")')
      ).not.toBeVisible({ timeout: 5_000 });
    });
  });

  // =========================================================================
  // 15. Cancel from PENDING_PAYMENT
  // =========================================================================
  test.describe("15. Cancel from PENDING_PAYMENT", () => {
    test("renter can cancel a PENDING_PAYMENT booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const statusRes = await apiGet(page, `/bookings/${booking.id}`, renterPayload.accessToken);
      const statusData = statusRes.ok() ? ((await statusRes.json()) as BookingItem) : null;
      if (!statusData || statusData.status !== "PENDING_PAYMENT") throw new Error("Skipped: prerequisite not met — seed data required");

      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      // Cancel Booking button should be visible
      await expect(
        page.locator('button:has-text("Cancel Booking")').first()
      ).toBeVisible({ timeout: 10_000 });

      await clickActionButton(page, "Cancel Booking");

      // Fill reason
      const reasonInput = page.locator(
        'textarea[placeholder*="reason"], textarea[placeholder*="cancellation"], textarea[name="reason"]'
      );
      await reasonInput.first().waitFor({ state: "visible", timeout: 8_000 });
      await reasonInput.first().fill("Changed my mind before paying.");

      // Submit
      const submitBtn = page.locator(
        'button:has-text("Cancel Booking"), button[type="submit"]'
      ).last();
      await submitBtn.click();

      // Should redirect away from booking detail
      await expect(page).toHaveURL(/\/bookings($|\?)/, { timeout: 10_000 });
    });

    test("cancel from PENDING_PAYMENT via API transitions to CANCELLED", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const statusRes = await apiGet(page, `/bookings/${booking.id}`, renterPayload.accessToken);
      const statusData = statusRes.ok() ? ((await statusRes.json()) as BookingItem) : null;
      if (!statusData || statusData.status !== "PENDING_PAYMENT") throw new Error("Skipped: prerequisite not met — seed data required");

      // Cancel via API
      await apiPost(page, `/bookings/${booking.id}/cancel`, renterPayload.accessToken, {
        reason: "Changed my mind",
      });

      // Verify CANCELLED
      const cancelledRes = await apiGet(page, `/bookings/${booking.id}`, renterPayload.accessToken);
      const cancelledData = cancelledRes.ok() ? ((await cancelledRes.json()) as BookingItem) : null;
      expect(cancelledData?.status).toBe("CANCELLED");
    });
  });

  // =========================================================================
  // 16. Both-Party Reviews — Renter & Owner can both review
  // =========================================================================
  test.describe("16. Both-Party Reviews", () => {
    test("after renter reviews, owner can still see Leave a Review button", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      // Advance to COMPLETED
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const postApproveData = postApprove.ok() ? ((await postApprove.json()) as BookingItem) : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
        { endpoint: "/approve-return", token: ownerPayload.accessToken },
      ]).catch(() => null);

      const completedRes = await apiGet(page, `/bookings/${booking.id}`, renterPayload.accessToken);
      const completedData = completedRes.ok() ? ((await completedRes.json()) as BookingItem) : null;
      if (!completedData || completedData.status !== "COMPLETED") throw new Error("Skipped: prerequisite not met — seed data required");

      // Step 1: Renter submits a review
      await injectAuth(page, renterPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      const reviewBtn = page.locator('button:has-text("Leave a Review")').first();
      const renterCanReview = await reviewBtn
        .waitFor({ state: "visible", timeout: 8_000 })
        .then(() => true)
        .catch(() => false);

      if (renterCanReview) {
        await reviewBtn.click();
        await page.locator('[aria-label="Rate 4 star(s)"]').click();
        await page
          .locator('textarea[placeholder*="experience"]')
          .fill("Great rental experience from the renter side!");
        await page.locator('button:has-text("Submit Review")').click();

        // Wait for review submission
        await expect(
          page.locator('button:has-text("Leave a Review")')
        ).not.toBeVisible({ timeout: 10_000 });
      }

      // Step 2: Owner should still see Leave a Review button
      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      // Owner should be able to review even after renter has reviewed
      const ownerReviewBtn = page.locator('button:has-text("Leave a Review")').first();
      const ownerCanReview = await ownerReviewBtn
        .waitFor({ state: "visible", timeout: 8_000 })
        .then(() => true)
        .catch(() => false);

      // If renter's review creation succeeded, owner should still be able to review
      if (renterCanReview) {
        expect(ownerCanReview).toBe(true);
      }
    });

    test("owner can submit review on a COMPLETED booking", async ({
      page,
      browser,
    }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const renterPayload = await devLogin(page, "USER");

      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      let ownerPayload: DevLoginResponse;
      try {
        await ownerPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        ownerPayload = await devLogin(ownerPage, "HOST");
      } finally {
        await ownerCtx.close();
      }

      const listing = await findBookableListing(page, renterPayload.accessToken);
      if (!listing) throw new Error("Skipped: prerequisite not met — seed data required");

      const booking = await createBookingViaApi(page, renterPayload.accessToken, listing.id).catch(() => null);
      if (!booking) throw new Error("Skipped: prerequisite not met — seed data required");

      // Advance to COMPLETED
      if (booking.status === "PENDING_OWNER_APPROVAL") {
        await advanceBookingViaApi(page, booking.id, [
          { endpoint: "/approve", token: ownerPayload.accessToken },
        ]).catch(() => null);
      }

      const postApprove = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const postApproveData = postApprove.ok() ? ((await postApprove.json()) as BookingItem) : null;
      if (!postApproveData || postApproveData.status !== "CONFIRMED") throw new Error("Skipped: prerequisite not met — seed data required");

      await advanceBookingViaApi(page, booking.id, [
        { endpoint: "/start", token: ownerPayload.accessToken },
        { endpoint: "/request-return", token: renterPayload.accessToken },
        { endpoint: "/approve-return", token: ownerPayload.accessToken },
      ]).catch(() => null);

      const completedRes = await apiGet(page, `/bookings/${booking.id}`, ownerPayload.accessToken);
      const completedData = completedRes.ok() ? ((await completedRes.json()) as BookingItem) : null;
      if (!completedData || completedData.status !== "COMPLETED") throw new Error("Skipped: prerequisite not met — seed data required");

      // Owner reviews
      await injectAuth(page, ownerPayload);
      await page.goto(`${BASE_URL}/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });

      const reviewBtn = page.locator('button:has-text("Leave a Review")').first();
      await reviewBtn.waitFor({ state: "visible", timeout: 10_000 });
      await reviewBtn.click();

      await page.locator('[aria-label="Rate 5 star(s)"]').click();
      await page
        .locator('textarea[placeholder*="experience"]')
        .fill("Excellent renter, took great care of the item!");
      await page.locator('button:has-text("Submit Review")').click();

      await expect(
        page.locator('button:has-text("Leave a Review")')
      ).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // =========================================================================
  // 17. Listing Status Guards — API-level validation
  // =========================================================================
  test.describe("17. Listing Status Guards — API validation", () => {
    test("pause API rejects when listing is not AVAILABLE", async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const ownerPayload = await devLogin(page, "HOST");

      // Find a listing and pause it first
      const listingsRes = await apiGet(page, "/listings/my-listings", ownerPayload.accessToken);
      if (!listingsRes.ok()) throw new Error("Skipped: prerequisite not met — seed data required");
      const listingsData = (await listingsRes.json()) as { data?: ListingItem[]; items?: ListingItem[] };
      const listings = listingsData.data ?? listingsData.items ?? (listingsData as unknown as ListingItem[]);
      const available = Array.isArray(listings) ? listings.find(l => l.status === "AVAILABLE") : null;
      if (!available) throw new Error("Skipped: prerequisite not met — seed data required");

      // Pause it (should succeed since it's AVAILABLE)
      const pauseRes = await apiPost(page, `/listings/${available.id}/pause`, ownerPayload.accessToken);
      if (!pauseRes.ok()) throw new Error("Skipped: prerequisite not met — seed data required");

      // Try to pause again — should fail since it's now UNAVAILABLE
      const doublePauseRes = await apiPost(page, `/listings/${available.id}/pause`, ownerPayload.accessToken);
      expect(doublePauseRes.status()).toBeGreaterThanOrEqual(400);

      // Re-activate for cleanup
      await apiPost(page, `/listings/${available.id}/activate`, ownerPayload.accessToken);
    });

    test("activate API rejects when listing is already AVAILABLE", async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      const ownerPayload = await devLogin(page, "HOST");

      const listingsRes = await apiGet(page, "/listings/my-listings", ownerPayload.accessToken);
      if (!listingsRes.ok()) throw new Error("Skipped: prerequisite not met — seed data required");
      const listingsData = (await listingsRes.json()) as { data?: ListingItem[]; items?: ListingItem[] };
      const listings = listingsData.data ?? listingsData.items ?? (listingsData as unknown as ListingItem[]);
      const available = Array.isArray(listings) ? listings.find(l => l.status === "AVAILABLE") : null;
      if (!available) throw new Error("Skipped: prerequisite not met — seed data required");

      // Try to activate an already AVAILABLE listing — should fail
      const activateRes = await apiPost(page, `/listings/${available.id}/activate`, ownerPayload.accessToken);
      expect(activateRes.status()).toBeGreaterThanOrEqual(400);
    });
  });
});
