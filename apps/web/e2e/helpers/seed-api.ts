/**
 * Seed API Helper
 *
 * Manages test-data lifecycle for E2E tests:
 *   - Obtains owner/renter access tokens via the dev-login endpoint
 *   - Creates listings for any category via POST /api/listings
 *   - Deletes exactly the listings it created (tracked by ID)
 *
 * Usage:
 *   const seed = new SeedApi(page.request);
 *   await seed.init();                        // authenticate as owner
 *   const listing = await seed.createListing('camera');
 *   // ... run tests ...
 *   await seed.cleanup();                     // delete all created listings
 */

import type { APIRequestContext, APIResponse } from "@playwright/test";

const API_BASE_URL = process.env.E2E_API_URL || "http://localhost:3400/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeededListing {
  id: string;
  title: string;
  category: string;
  slug?: string;
}

interface DevLoginPayload {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

// ---------------------------------------------------------------------------
// Per-category seed blueprints
// Each must satisfy the minimal required fields of CreateListingDto.
// ---------------------------------------------------------------------------

export type CategoryKey =
  | "camera"
  | "drone"
  | "car"
  | "motorcycle"
  | "apartment"
  | "house"
  | "tent"
  | "kayak"
  | "guitar"
  | "piano"
  | "dress"
  | "suit"
  | "bicycle"
  | "ebike"
  | "drill"
  | "generator";

interface ListingBlueprint {
  title: string;
  description: string;
  category: string;          // free-text category sent in body
  basePrice: number;
  securityDeposit: number;
  city: string;
  state: string;
  country: string;
  deliveryOptions: { pickup: boolean; delivery: boolean; shipping: boolean };
  condition: string;
  minimumRentalPeriod: number;
  maximumRentalPeriod: number;
  cancellationPolicy: string;
}

const LONG_DESC = (what: string) =>
  `E2E test listing for ${what}. Created automatically by the Playwright test suite. ` +
  `This item is in excellent condition and available for rent. Please do not book this listing — ` +
  `it exists solely for automated testing. Includes all necessary accessories.`;

// Session-unique suffix to prevent slug conflicts between test runs
const RUN_ID = Date.now().toString(36).slice(-5);

export const BLUEPRINTS: Record<CategoryKey, ListingBlueprint> = {
  camera: {
    title: "[E2E] Canon EOS R5 Camera Kit",
    description: LONG_DESC("camera / electronics"),
    category: "camera-electronics",
    basePrice: 85,
    securityDeposit: 800,
    city: "San Francisco",
    state: "CA",
    country: "US",
    deliveryOptions: { pickup: true, delivery: true, shipping: false },
    condition: "excellent",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    cancellationPolicy: "flexible",
  },
  drone: {
    title: "[E2E] DJI Mavic 3 Pro Drone",
    description: LONG_DESC("drone / electronics"),
    category: "camera-electronics",
    basePrice: 120,
    securityDeposit: 1500,
    city: "Austin",
    state: "TX",
    country: "US",
    deliveryOptions: { pickup: true, delivery: false, shipping: false },
    condition: "like-new",
    minimumRentalPeriod: 2,
    maximumRentalPeriod: 14,
    cancellationPolicy: "moderate",
  },
  car: {
    title: "[E2E] 2022 Toyota Camry XSE",
    description: LONG_DESC("car / vehicle"),
    category: "car",
    basePrice: 65,
    securityDeposit: 500,
    city: "Los Angeles",
    state: "CA",
    country: "US",
    deliveryOptions: { pickup: true, delivery: false, shipping: false },
    condition: "good",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    cancellationPolicy: "strict",
  },
  motorcycle: {
    title: "[E2E] Honda CB500F Motorcycle",
    description: LONG_DESC("motorcycle / vehicle"),
    category: "bike",
    basePrice: 45,
    securityDeposit: 400,
    city: "Miami",
    state: "FL",
    country: "US",
    deliveryOptions: { pickup: true, delivery: false, shipping: false },
    condition: "good",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 14,
    cancellationPolicy: "flexible",
  },
  apartment: {
    title: "[E2E] Downtown Studio Apartment",
    description: LONG_DESC("apartment / property"),
    category: "apartment",
    basePrice: 120,
    securityDeposit: 300,
    city: "New York",
    state: "NY",
    country: "US",
    deliveryOptions: { pickup: true, delivery: false, shipping: false },
    condition: "excellent",
    minimumRentalPeriod: 2,
    maximumRentalPeriod: 90,
    cancellationPolicy: "moderate",
  },
  house: {
    title: "[E2E] 3BR Family House with Garden",
    description: LONG_DESC("house / property"),
    category: "house",
    basePrice: 250,
    securityDeposit: 500,
    city: "Denver",
    state: "CO",
    country: "US",
    deliveryOptions: { pickup: true, delivery: false, shipping: false },
    condition: "good",
    minimumRentalPeriod: 3,
    maximumRentalPeriod: 90,
    cancellationPolicy: "moderate",
  },
  tent: {
    title: "[E2E] REI Kingdom 6 Camping Tent",
    description: LONG_DESC("tent / outdoor"),
    category: "sports-equipment",
    basePrice: 35,
    securityDeposit: 150,
    city: "Denver",
    state: "CO",
    country: "US",
    deliveryOptions: { pickup: true, delivery: true, shipping: true },
    condition: "good",
    minimumRentalPeriod: 2,
    maximumRentalPeriod: 21,
    cancellationPolicy: "flexible",
  },
  kayak: {
    title: "[E2E] Wilderness Systems Kayak",
    description: LONG_DESC("kayak / outdoor / sports"),
    category: "sports-equipment",
    basePrice: 50,
    securityDeposit: 200,
    city: "Seattle",
    state: "WA",
    country: "US",
    deliveryOptions: { pickup: true, delivery: true, shipping: false },
    condition: "good",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 14,
    cancellationPolicy: "flexible",
  },
  guitar: {
    title: "[E2E] Taylor 814ce Acoustic Guitar",
    description: LONG_DESC("guitar / musical instrument"),
    category: "musical-instrument",
    basePrice: 30,
    securityDeposit: 400,
    city: "Nashville",
    state: "TN",
    country: "US",
    deliveryOptions: { pickup: true, delivery: false, shipping: false },
    condition: "excellent",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    cancellationPolicy: "flexible",
  },
  piano: {
    title: "[E2E] Roland FP-90X Digital Piano",
    description: LONG_DESC("piano / musical instrument"),
    category: "musical-instrument",
    basePrice: 25,
    securityDeposit: 300,
    city: "Chicago",
    state: "IL",
    country: "US",
    deliveryOptions: { pickup: true, delivery: true, shipping: false },
    condition: "like-new",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 90,
    cancellationPolicy: "moderate",
  },
  dress: {
    title: "[E2E] Designer Evening Dress Size M",
    description: LONG_DESC("dress / clothing / fashion"),
    category: "clothing-costumes",
    basePrice: 40,
    securityDeposit: 150,
    city: "New York",
    state: "NY",
    country: "US",
    deliveryOptions: { pickup: true, delivery: true, shipping: true },
    condition: "like-new",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 7,
    cancellationPolicy: "strict",
  },
  suit: {
    title: "[E2E] Hugo Boss Slim Fit Suit Size 40R",
    description: LONG_DESC("suit / clothing / fashion"),
    category: "clothing-costumes",
    basePrice: 35,
    securityDeposit: 200,
    city: "Chicago",
    state: "IL",
    country: "US",
    deliveryOptions: { pickup: true, delivery: false, shipping: true },
    condition: "excellent",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 7,
    cancellationPolicy: "strict",
  },
  bicycle: {
    title: "[E2E] Trek Marlin 7 Mountain Bike",
    description: LONG_DESC("bicycle / bike"),
    category: "bike",
    basePrice: 25,
    securityDeposit: 150,
    city: "Portland",
    state: "OR",
    country: "US",
    deliveryOptions: { pickup: true, delivery: false, shipping: false },
    condition: "good",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    cancellationPolicy: "flexible",
  },
  ebike: {
    title: "[E2E] Rad Power RadCity Electric Bike",
    description: LONG_DESC("ebike / bike / electric"),
    category: "bike",
    basePrice: 40,
    securityDeposit: 300,
    city: "San Francisco",
    state: "CA",
    country: "US",
    deliveryOptions: { pickup: true, delivery: true, shipping: false },
    condition: "like-new",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 14,
    cancellationPolicy: "flexible",
  },
  drill: {
    title: "[E2E] DeWalt 20V Cordless Drill Kit",
    description: LONG_DESC("drill / tools / general"),
    category: "equipment",
    basePrice: 15,
    securityDeposit: 80,
    city: "Dallas",
    state: "TX",
    country: "US",
    deliveryOptions: { pickup: true, delivery: true, shipping: false },
    condition: "good",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 14,
    cancellationPolicy: "flexible",
  },
  generator: {
    title: "[E2E] Honda EU2200i Portable Generator",
    description: LONG_DESC("generator / tools / general"),
    category: "equipment",
    basePrice: 45,
    securityDeposit: 250,
    city: "Phoenix",
    state: "AZ",
    country: "US",
    deliveryOptions: { pickup: true, delivery: true, shipping: false },
    condition: "good",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 14,
    cancellationPolicy: "moderate",
  },
};

// ---------------------------------------------------------------------------
// SeedApi class
// ---------------------------------------------------------------------------

export class SeedApi {
  private ownerToken: string | null = null;
  private adminToken: string | null = null;
  private createdIds: string[] = [];
  private listingCounter = 0;

  constructor(private readonly request: APIRequestContext) {}

  // ── Authentication ────────────────────────────────────────────────────────

  /**
   * Obtain owner and admin access tokens via the dev-login endpoint.
   * Must be called before any createListing() calls.
   */
  async init(): Promise<void> {
    const ownerEmail = process.env.E2E_OWNER_EMAIL || "owner@test.com";
    const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@test.com";

    // Helper to request a token with retry on 429 rate-limit
    const devLogin = async (email: string, role: string) => {
      let res = await this.request.post(`${API_BASE_URL}/auth/dev-login`, {
        data: { email, role, secret: "dev-secret-123" },
      });
      for (let attempt = 1; attempt <= 3 && res.status() === 429; attempt++) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
        res = await this.request.post(`${API_BASE_URL}/auth/dev-login`, {
          data: { email, role, secret: "dev-secret-123" },
        });
      }
      return res;
    };

    const [ownerRes, adminRes] = await Promise.all([
      devLogin(ownerEmail, "HOST"),
      devLogin(adminEmail, "ADMIN"),
    ]);

    if (!ownerRes.ok()) {
      throw new Error(
        `SeedApi.init: dev-login failed (${ownerRes.status()}) — is the API running?`
      );
    }

    const ownerBody = (await ownerRes.json()) as Partial<DevLoginPayload>;
    if (!ownerBody.accessToken) {
      throw new Error("SeedApi.init: dev-login returned no accessToken");
    }
    this.ownerToken = ownerBody.accessToken;

    // Admin token is optional — used for approving listings so they appear in search
    if (adminRes.ok()) {
      const adminBody = (await adminRes.json()) as Partial<DevLoginPayload>;
      this.adminToken = adminBody.accessToken ?? null;
    }
  }

  // ── Listing management ────────────────────────────────────────────────────

  /**
   * Create a single test listing for the given category key.
   * Returns the created listing's ID and title.
   */
  async createListing(categoryKey: CategoryKey): Promise<SeededListing> {
    if (!this.ownerToken) await this.init();

    const bp = BLUEPRINTS[categoryKey];
    if (!bp) throw new Error(`No blueprint for category "${categoryKey}"`);

    const seq = ++this.listingCounter;
    const payload = {
      title: `${bp.title} ${RUN_ID}-${seq}`,
      description: bp.description,
      category: bp.category,
      basePrice: bp.basePrice,
      securityDeposit: bp.securityDeposit,
      location: {
        city: bp.city,
        state: bp.state,
        country: bp.country,
        address: "123 Test Street",
        postalCode: "00001",
      },
      deliveryOptions: bp.deliveryOptions,
      condition: bp.condition,
      minimumRentalPeriod: bp.minimumRentalPeriod,
      maximumRentalPeriod: bp.maximumRentalPeriod,
      cancellationPolicy: bp.cancellationPolicy,
      // Use a local URL so content-moderation's image-accessibility check
      // completes instantly without depending on external network availability.
      photos: [{ url: `${API_BASE_URL}/health`, order: 0 }],
    };

    const res = await this.request.post(`${API_BASE_URL}/listings`, {
      data: payload,
      headers: { Authorization: `Bearer ${this.ownerToken}` },
    });

    if (!res.ok()) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `SeedApi.createListing("${categoryKey}"): API returned ${res.status()} — ${body}`
      );
    }

    const created = (await res.json()) as { id: string; title: string; slug?: string };
    this.createdIds.push(created.id);

    // Publish the listing so it appears in public search results.
    // The publish endpoint returns HTTP 200 even if moderation reverts the listing
    // back to DRAFT (fail-closed behaviour). We retry up to 3 times checking the
    // returned `status` field to confirm the listing actually became AVAILABLE.
    let published = false;
    for (let attempt = 1; attempt <= 3 && !published; attempt++) {
      if (attempt > 1) {
        // Brief pause before retrying — gives moderation service time to recover
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
      const publishRes = await this.request.post(
        `${API_BASE_URL}/listings/${created.id}/publish`,
        { headers: { Authorization: `Bearer ${this.ownerToken}` } }
      );
      if (publishRes.ok()) {
        const publishBody = await publishRes.json().catch(() => ({})) as { status?: string };
        if (publishBody.status === "AVAILABLE") {
          published = true;
        } else if (attempt === 3) {
          // Final attempt still didn't produce AVAILABLE — warn and continue
          console.warn(
            `SeedApi: listing ${created.id} publish returned status="${publishBody.status}" after ${attempt} attempts — detail-page tests may see 404`
          );
        }
      } else if (attempt === 3) {
        console.warn(
          `SeedApi: publish listing ${created.id} returned ${publishRes.status()} — tests using search may fail`
        );
      }
    }

    if (published && this.adminToken) {
      // Admin-approve so it passes verificationStatus: VERIFIED check in search
      const approveRes = await this.request.post(
        `${API_BASE_URL}/admin/listings/${created.id}/approve`,
        { headers: { Authorization: `Bearer ${this.adminToken}` } }
      );
      if (!approveRes.ok()) {
        console.warn(
          `SeedApi: admin approve listing ${created.id} returned ${approveRes.status()} — listing may not appear in search`
        );
      }
    }

    return {
      id: created.id,
      title: created.title ?? bp.title,
      category: bp.category,
      slug: created.slug,
    };
  }

  /**
   * Create N listings for the same category, returning all of them.
   */
  async createListings(
    categoryKey: CategoryKey,
    count: number
  ): Promise<SeededListing[]> {
    const results: SeededListing[] = [];
    for (let i = 0; i < count; i++) {
      // Vary the title slightly so each listing is distinct
      const listing = await this.createListing(categoryKey);
      // Patch title via update to make it distinguishable
      if (i > 0) {
        await this.patchTitle(listing.id, `${listing.title} #${i + 1}`);
        listing.title = `${listing.title} #${i + 1}`;
      }
      results.push(listing);
    }
    return results;
  }

  /**
   * Delete a listing by ID.
   */
  async deleteListing(id: string): Promise<void> {
    if (!this.ownerToken) return;

    const res = await this.request.delete(`${API_BASE_URL}/listings/${id}`, {
      headers: { Authorization: `Bearer ${this.ownerToken}` },
    });

    // 404 is fine — already gone
    if (!res.ok() && res.status() !== 404) {
      console.warn(`SeedApi.deleteListing: could not delete ${id} (${res.status()})`);
    }
  }

  /**
   * Delete all listings created by this SeedApi instance.
   */
  async cleanup(): Promise<void> {
    const ids = [...this.createdIds];
    this.createdIds = [];
    await Promise.allSettled(ids.map((id) => this.deleteListing(id)));
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private async patchTitle(id: string, title: string): Promise<void> {
    await this.request.patch(`${API_BASE_URL}/listings/${id}`, {
      data: { title },
      headers: { Authorization: `Bearer ${this.ownerToken}` },
    });
  }

  /**
   * Search for listings by keyword via the public search API.
   * Returns an array of listing IDs that match.
   */
  async searchListings(keyword: string): Promise<string[]> {
    const res = await this.request.get(
      `${API_BASE_URL}/search?q=${encodeURIComponent(keyword)}&limit=50`
    );
    if (!res.ok()) return [];
    const body = (await res.json()) as { data?: { id: string }[]; items?: { id: string }[] };
    const items = body.data ?? body.items ?? [];
    return items.map((i) => i.id);
  }

  /**
   * Returns true when the API is reachable.
   */
  async isApiReachable(): Promise<boolean> {
    try {
      const res = await this.request.get(`${API_BASE_URL}/health`, {
        timeout: 3000,
      });
      return res.ok();
    } catch {
      return false;
    }
  }
}
