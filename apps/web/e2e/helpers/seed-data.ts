/**
 * E2E Seed Helper — Ensures test data exists before Playwright tests run.
 *
 * Creates a published listing + category via the API so that
 * `findBookableListing()` always returns data and tests don't skip.
 */

import type { Page } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

export interface SeedData {
  ownerToken: string;
  renterToken: string;
  adminToken: string;
  listing: { id: string; title: string };
  categoryId: string;
}

let _cached: SeedData | null = null;

/**
 * Ensures a bookable listing exists. Idempotent — returns cached data on
 * subsequent calls within the same worker.
 */
export async function ensureSeedData(page: Page): Promise<SeedData> {
  if (_cached) return _cached;

  // 1. Get tokens via dev-login
  const ownerPayload = await devLoginRaw(page, "HOST");
  const renterPayload = await devLoginRaw(page, "USER");
  const adminPayload = await devLoginRaw(page, "ADMIN");

  // 2. Check if a bookable listing already exists
  const existingRes = await page.request.get(
    `${API}/listings?limit=1&status=PUBLISHED`,
    { headers: { Authorization: `Bearer ${ownerPayload.accessToken}` } },
  );

  if (existingRes.ok()) {
    const data = await existingRes.json();
    const items = data.data ?? data.items ?? (Array.isArray(data) ? data : []);
    if (items.length > 0) {
      _cached = {
        ownerToken: ownerPayload.accessToken,
        renterToken: renterPayload.accessToken,
        adminToken: adminPayload.accessToken,
        listing: { id: items[0].id, title: items[0].title },
        categoryId: items[0].categoryId ?? "",
      };
      return _cached;
    }
  }

  // 3. Create a category
  const catRes = await page.request.post(`${API}/categories`, {
    headers: {
      Authorization: `Bearer ${adminPayload.accessToken}`,
      "Content-Type": "application/json",
    },
    data: {
      name: `E2E Seed Category ${Date.now()}`,
      slug: `e2e-seed-${Date.now()}`,
    },
  });

  let categoryId = "";
  if (catRes.ok()) {
    const cat = await catRes.json();
    categoryId = cat.id;
  } else {
    // Try to find an existing category
    const catsRes = await page.request.get(`${API}/categories`, {
      headers: { Authorization: `Bearer ${adminPayload.accessToken}` },
    });
    if (catsRes.ok()) {
      const cats = await catsRes.json();
      const catsList = cats.data ?? cats ?? [];
      if (Array.isArray(catsList) && catsList.length > 0) {
        categoryId = catsList[0].id;
      }
    }
  }

  // 4. Create a listing
  const start = new Date();
  start.setDate(start.getDate() + 5);
  const listingRes = await page.request.post(`${API}/listings`, {
    headers: {
      Authorization: `Bearer ${ownerPayload.accessToken}`,
      "Content-Type": "application/json",
    },
    data: {
      title: `E2E Seed Listing ${Date.now()}`,
      description: "Auto-created for E2E booking lifecycle tests",
      basePrice: 100,
      currency: "NPR",
      categoryId,
      condition: "GOOD",
      location: "Kathmandu, Nepal",
    },
  });

  let listingId = "";
  let listingTitle = "";
  if (listingRes.ok()) {
    const listing = await listingRes.json();
    listingId = listing.id;
    listingTitle = listing.title;

    // 5. Publish the listing
    await page.request.post(`${API}/listings/${listingId}/publish`, {
      headers: { Authorization: `Bearer ${ownerPayload.accessToken}` },
    });
  }

  _cached = {
    ownerToken: ownerPayload.accessToken,
    renterToken: renterPayload.accessToken,
    adminToken: adminPayload.accessToken,
    listing: { id: listingId, title: listingTitle },
    categoryId,
  };

  return _cached;
}

async function devLoginRaw(
  page: Page,
  role: "USER" | "HOST" | "ADMIN",
): Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string; role: string } }> {
  const emailMap = {
    USER: "renter@test.com",
    HOST: "owner@test.com",
    ADMIN: "admin@test.com",
  };

  const res = await page.request.post(`${API}/auth/dev-login`, {
    data: { email: emailMap[role], role },
  });

  if (!res.ok()) {
    throw new Error(`Seed dev-login failed for ${role}: ${res.status()}`);
  }
  return res.json();
}

/**
 * Reset cached data (call in afterAll if needed).
 */
export function resetSeedCache() {
  _cached = null;
}
