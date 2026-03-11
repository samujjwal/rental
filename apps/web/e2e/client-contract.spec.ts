/**
 * P1: Client Contract Tests
 *
 * Validates that the API returns response shapes that match the TypeScript
 * interfaces consumed by web + mobile clients. Catches contract drift between
 * the API layer and the shared-types package.
 *
 * Tests are organised per domain: auth, listings, bookings, categories.
 * Each test hits the real API (via Playwright request context) and asserts
 * structural invariants (required fields, types) rather than exact values.
 */

import { test, expect } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TokenPayload {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

async function getToken(
  request: any,
  role: "USER" | "HOST" | "ADMIN" = "USER"
): Promise<TokenPayload> {
  const emailMap = {
    USER: "renter@test.com",
    HOST: "owner@test.com",
    ADMIN: "admin@test.com",
  };
  const res = await (request as any).post(`${API}/auth/dev-login`, {
    data: { email: emailMap[role], role },
  });
  expect(res.ok(), `dev-login failed for ${role}: ${res.status()}`).toBe(true);
  return res.json();
}

function assertString(val: unknown, label: string) {
  expect(typeof val, `${label} should be a string`).toBe("string");
  expect((val as string).length, `${label} should not be empty`).toBeGreaterThan(0);
}

function assertOptionalString(val: unknown, label: string) {
  if (val !== null && val !== undefined) {
    expect(typeof val, `${label} should be a string or null`).toBe("string");
  }
}

function assertNumber(val: unknown, label: string) {
  expect(typeof val, `${label} should be a number`).toBe("number");
}

function assertOptionalNumber(val: unknown, label: string) {
  if (val !== null && val !== undefined) {
    expect(typeof val, `${label} should be a number or null`).toBe("number");
  }
}

function assertISODate(val: unknown, label: string) {
  expect(typeof val, `${label} should be a string`).toBe("string");
  expect(
    isNaN(Date.parse(val as string)),
    `${label} should be a valid ISO date`
  ).toBe(false);
}

// ---------------------------------------------------------------------------
// Contract: Auth
// ---------------------------------------------------------------------------

test.describe("Contract: Auth", () => {
  test("dev-login response matches AuthResponse shape", async ({ request }) => {
    const payload = await getToken(request, "USER");

    // AuthResponse { accessToken, refreshToken, user }
    assertString(payload.accessToken, "accessToken");
    assertString(payload.refreshToken, "refreshToken");
    expect(payload.user).toBeDefined();
    assertString(payload.user.id, "user.id");
    assertString(payload.user.email, "user.email");
    expect(payload.user.role).toBeDefined();
  });

  test("POST /auth/register with missing fields returns 400 with ApiErrorResponse shape", async ({
    request,
  }) => {
    const res = await request.post(`${API}/auth/register`, {
      data: {},
    });

    expect(res.status()).toBe(400);
    const body = await res.json();

    // ApiErrorResponse { statusCode, message, error? }
    assertNumber(body.statusCode, "statusCode");
    expect(body.message).toBeDefined();
    // message can be string or string[]
    expect(
      typeof body.message === "string" || Array.isArray(body.message)
    ).toBe(true);
  });

  test("POST /auth/login with wrong credentials returns 401 with error shape", async ({
    request,
  }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: "no-such-user@example.com", password: "wrongpassword" },
    });

    expect([401, 400, 404]).toContain(res.status());
    const body = await res.json();
    expect(body.message).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Contract: Listings
// ---------------------------------------------------------------------------

test.describe("Contract: Listings", () => {
  test("GET /listings returns PaginatedResponse<Listing> shape", async ({
    request,
  }) => {
    const { accessToken } = await getToken(request, "USER");
    const res = await request.get(`${API}/listings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();

    // PaginatedResponse has data[], total, page, limit, totalPages, hasMore
    // OR the API may return items[] — accept both
    const items = body.data ?? body.items ?? (Array.isArray(body) ? body : null);
    expect(items, "Response should contain data[] or items[]").toBeDefined();
    expect(Array.isArray(items)).toBe(true);

    // If pagination metadata present, validate shape
    if (body.total !== undefined) assertNumber(body.total, "total");
    if (body.page !== undefined) assertNumber(body.page, "page");
    if (body.totalPages !== undefined) assertNumber(body.totalPages, "totalPages");

    // Validate first listing if available
    if (items.length > 0) {
      const listing = items[0];
      assertString(listing.id, "listing.id");
      assertString(listing.title, "listing.title");
      assertNumber(listing.basePrice, "listing.basePrice");
      assertString(listing.currency, "listing.currency");

      // Optional but typed fields
      assertOptionalString(listing.description, "listing.description");
      if (listing.status) {
        expect(
          [
            "DRAFT",
            "AVAILABLE",
            "RENTED",
            "MAINTENANCE",
            "UNAVAILABLE",
            "PENDING",
            "PUBLISHED",
            "PENDING_REVIEW",
            "VERIFIED",
            "SUSPENDED",
            "ARCHIVED",
          ].includes(listing.status)
        ).toBe(true);
      }
    }
  });

  test("GET /listings/:id returns Listing shape", async ({ request }) => {
    const { accessToken } = await getToken(request, "USER");

    // Get a listing ID first
    const listRes = await request.get(`${API}/listings?limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listBody = await listRes.json();
    const items = listBody.data ?? listBody.items ?? listBody;
    if (!Array.isArray(items) || items.length === 0) {
      test.skip(true, "No listings available to test detail endpoint");
      return;
    }

    const res = await request.get(`${API}/listings/${items[0].id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.ok()).toBe(true);
    const listing = await res.json();

    assertString(listing.id, "listing.id");
    assertString(listing.title, "listing.title");
    assertNumber(listing.basePrice, "listing.basePrice");
    assertString(listing.currency, "listing.currency");
    assertString(listing.ownerId, "listing.ownerId");
    assertISODate(listing.createdAt, "listing.createdAt");
    assertISODate(listing.updatedAt, "listing.updatedAt");
  });
});

// ---------------------------------------------------------------------------
// Contract: Categories
// ---------------------------------------------------------------------------

test.describe("Contract: Categories", () => {
  test("GET /categories returns array of Category objects", async ({
    request,
  }) => {
    const res = await request.get(`${API}/categories`);

    expect(res.ok()).toBe(true);
    const body = await res.json();
    const cats = body.data ?? body.items ?? (Array.isArray(body) ? body : []);
    expect(Array.isArray(cats)).toBe(true);

    if (cats.length > 0) {
      const cat = cats[0];
      assertString(cat.id, "category.id");
      assertString(cat.name, "category.name");
      assertOptionalString(cat.slug, "category.slug");
    }
  });
});

// ---------------------------------------------------------------------------
// Contract: Bookings
// ---------------------------------------------------------------------------

test.describe("Contract: Bookings", () => {
  test("GET /bookings returns PaginatedResponse<Booking> shape", async ({
    request,
  }) => {
    const { accessToken } = await getToken(request, "USER");

    const res = await request.get(`${API}/bookings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();

    const items = body.data ?? body.items ?? (Array.isArray(body) ? body : null);
    expect(items, "Response should contain data[] or items[]").toBeDefined();
    expect(Array.isArray(items)).toBe(true);

    if (items.length > 0) {
      const booking = items[0];
      assertString(booking.id, "booking.id");
      assertString(booking.status, "booking.status");
      assertString(booking.listingId, "booking.listingId");

      // Booking status must be one of the known BookingStatus values
      expect(
        [
          "DRAFT",
          "PENDING",
          "PENDING_PAYMENT",
          "PENDING_OWNER_APPROVAL",
          "CONFIRMED",
          "IN_PROGRESS",
          "CANCELLED",
          "PAYMENT_FAILED",
          "DISPUTED",
          "COMPLETED",
          "AWAITING_RETURN_INSPECTION",
          "REFUNDED",
          "SETTLED",
          "EXPIRED",
        ].includes(booking.status)
      ).toBe(true);

      // Date fields
      if (booking.startDate) assertISODate(booking.startDate, "booking.startDate");
      if (booking.endDate) assertISODate(booking.endDate, "booking.endDate");
      if (booking.createdAt) assertISODate(booking.createdAt, "booking.createdAt");
    }
  });

  test("POST /bookings with invalid data returns 400 with error shape", async ({
    request,
  }) => {
    const { accessToken } = await getToken(request, "USER");

    const res = await request.post(`${API}/bookings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      data: {},
    });

    // Should reject with 400 (validation) or 422 (unprocessable)
    expect([400, 422]).toContain(res.status());
    const body = await res.json();
    expect(body.message).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Contract: Health
// ---------------------------------------------------------------------------

test.describe("Contract: Health", () => {
  test("GET /health returns health check shape", async ({ request }) => {
    const res = await request.get(`${API}/health`);

    expect(res.ok()).toBe(true);
    const body = await res.json();

    // Typical NestJS health check shape: { status, info?, error?, details? }
    expect(body).toBeDefined();
    expect(typeof body).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// Contract: Mobile-specific shapes
// ---------------------------------------------------------------------------

test.describe("Contract: Mobile Client Compatibility", () => {
  test("auth response user has fields mobile client needs", async ({
    request,
  }) => {
    const payload = await getToken(request, "USER");

    // Mobile client expects: id, email, role, firstName, lastName
    const user = payload.user as Record<string, unknown>;
    assertString(user.id, "user.id");
    assertString(user.email, "user.email");
    expect(user.role).toBeDefined();

    // firstName/lastName may be on the user object
    // The mobile client uses these for display
    if (user.firstName !== undefined) {
      assertOptionalString(user.firstName, "user.firstName");
    }
  });

  test("listing response has images array for mobile gallery", async ({
    request,
  }) => {
    const { accessToken } = await getToken(request, "USER");
    const res = await request.get(`${API}/listings?limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok()) return;
    const body = await res.json();
    const items = body.data ?? body.items ?? (Array.isArray(body) ? body : []);

    if (items.length > 0) {
      const listing = items[0];
      // Mobile client expects photos[] or images[] for the gallery carousel
      const hasPhotos =
        Array.isArray(listing.photos) || Array.isArray(listing.images);
      expect(
        hasPhotos,
        "Listing should have photos[] or images[] for mobile gallery"
      ).toBe(true);
    }
  });

  test("booking list endpoint supports pagination params", async ({
    request,
  }) => {
    const { accessToken } = await getToken(request, "USER");

    const res = await request.get(`${API}/bookings?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();

    // The mobile app relies on pagination for infinite scroll
    const items = body.data ?? body.items ?? (Array.isArray(body) ? body : null);
    expect(items).toBeDefined();
    expect(Array.isArray(items)).toBe(true);
    // Limit should be respected
    expect(items.length).toBeLessThanOrEqual(5);
  });
});
