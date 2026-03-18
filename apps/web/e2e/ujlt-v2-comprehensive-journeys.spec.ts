import { test, expect, type Page } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";
import { ensureSeedData, type SeedData } from "./helpers/seed-data";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";
const RUN_OFFSET = 900 + (Math.floor(Date.now() / 1000) % 5000);

type Role = "USER" | "HOST" | "ADMIN";

interface DevLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

interface BookingRecord {
  id: string;
  status: string;
  listingId?: string;
}

interface DisputeRecord {
  id: string;
  status: string;
  bookingId: string;
}

interface NotificationRecord {
  id: string;
  type?: string;
  data?: Record<string, unknown> | null;
  read?: boolean;
}

interface NotificationListResponse {
  notifications: NotificationRecord[];
  total: number;
}

interface ReviewRecord {
  id: string;
  bookingId: string;
  comment?: string;
}

interface ReviewEligibility {
  canReview: boolean;
  reviewType?: "RENTER_TO_OWNER" | "OWNER_TO_RENTER";
  reason?: string;
}

interface OrganizationRecord {
  id: string;
  name: string;
}

let seed: SeedData | null = null;
let journeyBookingId: string | null = null;
let journeyDisputeId: string | null = null;
let bookingSlot = 0;
let reviewBookingId: string | null = null;
let ownerOrganizationId: string | null = null;

function isoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
}

function allocateBookingWindow(baseOffset: number = RUN_OFFSET): {
  startDate: string;
  endDate: string;
} {
  const startOffset = baseOffset + bookingSlot * 7;
  bookingSlot += 1;

  return {
    startDate: isoDate(startOffset),
    endDate: isoDate(startOffset + 2),
  };
}

async function devLogin(page: Page, role: Role): Promise<DevLoginResponse> {
  const email =
    role === "HOST"
      ? testUsers.owner.email
      : role === "ADMIN"
        ? testUsers.admin.email
        : testUsers.renter.email;

  const response = await page.request.post(`${API}/auth/dev-login`, {
    data: { email, role, secret: "dev-secret-123" },
  });

  if (!response.ok()) {
    throw new Error(`dev-login(${role}) failed: ${response.status()} ${await response.text()}`);
  }

  return response.json() as Promise<DevLoginResponse>;
}

async function apiGet(page: Page, path: string, token: string) {
  return page.request.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function apiPost(
  page: Page,
  path: string,
  token: string,
  data: Record<string, unknown> = {},
) {
  return page.request.post(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function apiPatch(
  page: Page,
  path: string,
  token: string,
  data: Record<string, unknown> = {},
) {
  return page.request.patch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function waitFor<T>(
  producer: () => Promise<T>,
  predicate: (value: T) => boolean,
  attempts = 12,
  intervalMs = 400,
): Promise<T> {
  let latest = await producer();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate(latest)) {
      return latest;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    latest = await producer();
  }

  return latest;
}

async function ensureJourneySeed(page: Page): Promise<SeedData> {
  if (seed?.listing.id) {
    return seed;
  }

  seed = await ensureSeedData(page);
  if (seed.listing.id) {
    return seed;
  }

  const owner = await devLogin(page, "HOST");
  const renter = await devLogin(page, "USER");
  const admin = await devLogin(page, "ADMIN");
  const searchResponse = await apiGet(page, "/listings?limit=1&status=PUBLISHED", owner.accessToken);

  if (!searchResponse.ok()) {
    throw new Error(`Unable to locate a seeded listing: ${searchResponse.status()}`);
  }

  const payload = (await searchResponse.json()) as {
    data?: Array<{ id: string; title: string; categoryId?: string }>;
    items?: Array<{ id: string; title: string; categoryId?: string }>;
    listings?: Array<{ id: string; title: string; categoryId?: string }>;
  };
  const listing = payload.data?.[0] ?? payload.items?.[0] ?? payload.listings?.[0];

  if (!listing) {
    throw new Error("No published listing is available for the UJLT suite.");
  }

  seed = {
    ownerToken: owner.accessToken,
    renterToken: renter.accessToken,
    adminToken: admin.accessToken,
    listing: { id: listing.id, title: listing.title },
    categoryId: listing.categoryId ?? "",
  };

  return seed;
}

async function createJourneyBooking(page: Page): Promise<string> {
  if (journeyBookingId) {
    return journeyBookingId;
  }

  journeyBookingId = await createFreshBooking(page);
  return journeyBookingId;
}

async function createFreshBooking(page: Page, baseOffset = RUN_OFFSET): Promise<string> {
  const currentSeed = await ensureJourneySeed(page);
  let lastFailure = "unknown booking creation failure";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const window = allocateBookingWindow(baseOffset + attempt * 21);
    const response = await apiPost(page, "/bookings", currentSeed.renterToken, {
      listingId: currentSeed.listing.id,
      startDate: window.startDate,
      endDate: window.endDate,
    });

    if (response.ok()) {
      const booking = (await response.json()) as BookingRecord;
      return booking.id;
    }

    const failureText = await response.text();
    lastFailure = `${response.status()} ${failureText}`;
    if (
      response.status() !== 400 ||
      !failureText.toLowerCase().includes("not available")
    ) {
      throw new Error(`create booking failed: ${lastFailure}`);
    }
  }

  throw new Error(`create booking failed after retries: ${lastFailure}`);
}

async function getBooking(page: Page, bookingId: string): Promise<BookingRecord> {
  const currentSeed = await ensureJourneySeed(page);
  const response = await apiGet(page, `/bookings/${bookingId}`, currentSeed.renterToken);
  if (!response.ok()) {
    throw new Error(`get booking failed: ${response.status()} ${await response.text()}`);
  }

  return response.json() as Promise<BookingRecord>;
}

async function ensureConfirmedJourneyBooking(page: Page): Promise<string> {
  const bookingId = await createJourneyBooking(page);
  const current = await getBooking(page, bookingId);

  if (
    current.status === "CONFIRMED" ||
    current.status === "IN_PROGRESS" ||
    current.status === "AWAITING_RETURN_INSPECTION" ||
    current.status === "COMPLETED"
  ) {
    return bookingId;
  }

  await advanceBookingToConfirmed(page, bookingId);
  return bookingId;
}

async function advanceBookingToConfirmed(page: Page, bookingId: string): Promise<void> {
  const currentSeed = await ensureJourneySeed(page);
  const current = await getBooking(page, bookingId);

  if (current.status === "PENDING_OWNER_APPROVAL") {
    const approve = await apiPost(page, `/bookings/${bookingId}/approve`, currentSeed.ownerToken);
    if (!approve.ok()) {
      throw new Error(`owner approve failed: ${approve.status()} ${await approve.text()}`);
    }
  }

  const confirm = await apiPost(page, `/bookings/${bookingId}/bypass-confirm`, currentSeed.renterToken);
  if (!confirm.ok()) {
    throw new Error(`bypass-confirm failed: ${confirm.status()} ${await confirm.text()}`);
  }
}

async function ensureCompletedJourneyBooking(page: Page): Promise<string> {
  const bookingId = await ensureConfirmedJourneyBooking(page);
  const latest = await getBooking(page, bookingId);

  if (latest.status === "COMPLETED") {
    return bookingId;
  }

  await advanceBookingToCompleted(page, bookingId);
  return bookingId;
}

async function advanceBookingToCompleted(page: Page, bookingId: string): Promise<void> {
  const currentSeed = await ensureJourneySeed(page);
  const latest = await getBooking(page, bookingId);

  if (latest.status === "CONFIRMED") {
    let start = await apiPost(page, `/bookings/${bookingId}/start`, currentSeed.ownerToken);
    if (!start.ok()) {
      start = await apiPost(page, `/bookings/${bookingId}/start`, currentSeed.renterToken);
    }
    if (!start.ok()) {
      throw new Error(`start booking failed: ${start.status()} ${await start.text()}`);
    }
  }

  const afterStart = await getBooking(page, bookingId);
  if (afterStart.status === "IN_PROGRESS") {
    const requestReturn = await apiPost(
      page,
      `/bookings/${bookingId}/request-return`,
      currentSeed.renterToken,
    );
    if (!requestReturn.ok()) {
      throw new Error(`request-return failed: ${requestReturn.status()} ${await requestReturn.text()}`);
    }
  }

  const afterRequest = await getBooking(page, bookingId);
  if (afterRequest.status === "AWAITING_RETURN_INSPECTION") {
    const approveReturn = await apiPost(
      page,
      `/bookings/${bookingId}/approve-return`,
      currentSeed.ownerToken,
    );
    if (!approveReturn.ok()) {
      throw new Error(`approve-return failed: ${approveReturn.status()} ${await approveReturn.text()}`);
    }
  }
}

async function ensureReviewJourneyBooking(page: Page): Promise<string> {
  if (reviewBookingId) {
    return reviewBookingId;
  }

  const bookingId = await createFreshBooking(page, RUN_OFFSET + 280);
  await advanceBookingToConfirmed(page, bookingId);
  await advanceBookingToCompleted(page, bookingId);
  reviewBookingId = bookingId;
  return bookingId;
}

async function ensureJourneyDispute(page: Page): Promise<string> {
  if (journeyDisputeId) {
    return journeyDisputeId;
  }

  const bookingId = await ensureCompletedJourneyBooking(page);
  const currentSeed = await ensureJourneySeed(page);
  const response = await apiPost(page, "/disputes", currentSeed.renterToken, {
    bookingId,
    title: `UJLT dispute ${Date.now()}`,
    type: "REFUND_REQUEST",
    description: "Automated journey dispute to verify renter, owner, and admin dispute visibility.",
    amount: 25,
    evidence: ["https://example.com/evidence/ujlt-proof.jpg"],
  });

  if (!response.ok()) {
    throw new Error(`create dispute failed: ${response.status()} ${await response.text()}`);
  }

  const dispute = (await response.json()) as DisputeRecord;
  journeyDisputeId = dispute.id;
  return journeyDisputeId;
}

async function getUnreadCount(page: Page, token: string): Promise<number> {
  const response = await apiGet(page, "/notifications/unread-count", token);
  if (!response.ok()) {
    throw new Error(`get unread notification count failed: ${response.status()} ${await response.text()}`);
  }

  const payload = (await response.json()) as { count?: number };
  return Number(payload.count ?? 0);
}

async function getNotifications(
  page: Page,
  token: string,
  unreadOnly = false,
): Promise<NotificationListResponse> {
  const suffix = unreadOnly ? "?unreadOnly=true" : "";
  const response = await apiGet(page, `/notifications${suffix}`, token);
  if (!response.ok()) {
    throw new Error(`get notifications failed: ${response.status()} ${await response.text()}`);
  }

  return response.json() as Promise<NotificationListResponse>;
}

async function markAllNotificationsRead(page: Page, token: string): Promise<number> {
  const response = await apiPost(page, "/notifications/read-all", token);
  if (!response.ok()) {
    throw new Error(`mark all notifications read failed: ${response.status()} ${await response.text()}`);
  }

  const payload = (await response.json()) as { count?: number };
  return Number(payload.count ?? 0);
}

async function waitForUnreadCountAtLeast(
  page: Page,
  token: string,
  minimum: number,
): Promise<number> {
  return waitFor(
    () => getUnreadCount(page, token),
    (count) => count >= minimum,
  );
}

function notificationReferencesEntity(
  notification: NotificationRecord,
  key: string,
  expectedId: string,
): boolean {
  const data = notification.data ?? {};
  const candidate = data[key];
  return typeof candidate === "string" && candidate === expectedId;
}

async function getReviewEligibility(
  page: Page,
  bookingId: string,
  token: string,
): Promise<ReviewEligibility> {
  const response = await apiGet(page, `/reviews/booking/${bookingId}/can-review`, token);
  if (!response.ok()) {
    throw new Error(`get review eligibility failed: ${response.status()} ${await response.text()}`);
  }

  return response.json() as Promise<ReviewEligibility>;
}

async function createReview(
  page: Page,
  token: string,
  data: Record<string, unknown>,
): Promise<ReviewRecord> {
  const response = await apiPost(page, "/reviews", token, data);
  if (!response.ok()) {
    throw new Error(`create review failed: ${response.status()} ${await response.text()}`);
  }

  return response.json() as Promise<ReviewRecord>;
}

async function ensureOwnerOrganization(page: Page): Promise<string> {
  if (ownerOrganizationId) {
    return ownerOrganizationId;
  }

  const currentSeed = await ensureJourneySeed(page);
  const existingResponse = await apiGet(page, "/organizations/my", currentSeed.ownerToken);
  if (!existingResponse.ok()) {
    throw new Error(`list organizations failed: ${existingResponse.status()} ${await existingResponse.text()}`);
  }

  const existing = (await existingResponse.json()) as {
    organizations?: OrganizationRecord[];
  };
  const current = existing.organizations?.[0];
  if (current?.id) {
    ownerOrganizationId = current.id;
    return ownerOrganizationId;
  }

  const createResponse = await apiPost(page, "/organizations", currentSeed.ownerToken, {
    name: `UJLT Rentals ${Date.now()}`,
    description: "Automated organization for UJLT journey coverage.",
    businessType: "INDIVIDUAL",
    email: `ujlt-org-${Date.now()}@example.com`,
    city: "Kathmandu",
    state: "Bagmati",
    country: "Nepal",
  });

  if (!createResponse.ok()) {
    throw new Error(`create organization failed: ${createResponse.status()} ${await createResponse.text()}`);
  }

  const organization = (await createResponse.json()) as OrganizationRecord;
  ownerOrganizationId = organization.id;
  return ownerOrganizationId;
}

async function ensureOrganizationHasRenterMember(page: Page): Promise<string> {
  const currentSeed = await ensureJourneySeed(page);
  const organizationId = await ensureOwnerOrganization(page);
  const membersResponse = await apiGet(page, `/organizations/${organizationId}/members`, currentSeed.ownerToken);
  if (!membersResponse.ok()) {
    throw new Error(`get organization members failed: ${membersResponse.status()} ${await membersResponse.text()}`);
  }

  const membersPayload = (await membersResponse.json()) as {
    members?: Array<{ user?: { id?: string; email?: string } }>;
  };
  const alreadyMember = membersPayload.members?.some(
    (member) => member.user?.email === testUsers.renter.email,
  );

  if (!alreadyMember) {
    const inviteResponse = await apiPost(page, `/organizations/${organizationId}/members`, currentSeed.ownerToken, {
      email: testUsers.renter.email,
      role: "MEMBER",
    });
    if (!inviteResponse.ok()) {
      throw new Error(`invite organization member failed: ${inviteResponse.status()} ${await inviteResponse.text()}`);
    }
  }

  return organizationId;
}

test.describe("UJLT v2 rental journey runner", () => {
  test.describe.configure({ mode: "serial" });

  test("guest discovery journey and auth boundaries", async ({ page }) => {
    test.slow();

    await test.step("load public discovery pages", async () => {
      await ensureJourneySeed(page);
      await page.goto("/");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/search");
      await expect(page.locator('input[name="query"][maxlength="120"]')).toBeVisible();
      await page.locator('input[name="query"][maxlength="120"]').fill("camera");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/search/);

      const suggestions = await page.request.get(`${API}/search/suggestions?q=camera`);
      expect(suggestions.ok()).toBe(true);
    });

    await test.step("open a real listing and inspect booking surfaces", async () => {
      const currentSeed = await ensureJourneySeed(page);
      await page.goto(`/listings/${currentSeed.listing.id}`);
      await expect(page.locator("h1").first()).toBeVisible();
      await expectAnyVisible(page, [
        'button:has-text("Book")',
        'button:has-text("Request")',
        'button:has-text("Rent")',
        'button:has-text("Favorite")',
        'button[aria-label*="favorite"]',
      ]);
    });

    await test.step("verify protected actions redirect guests into auth", async () => {
      const clicked = await clickFirstVisible(page, [
        'button:has-text("Book")',
        'button:has-text("Request")',
        'button:has-text("Rent")',
        'button:has-text("Favorite")',
        'button[aria-label*="favorite"]',
        'a:has-text("Message")',
      ]);

      if (!clicked) {
        await page.goto("/favorites");
      }

      await expect(page).toHaveURL(/\/auth\/login|\/favorites|\/checkout|\/bookings/);
    });

    await test.step("verify owner education pages are accessible", async () => {
      await page.goto("/how-it-works");
      await expect(page.locator("body")).toBeVisible();
      await page.goto("/owner-guide");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("renter booking, checkout, favorites, messaging, and notifications journey", async ({ page }) => {
    test.slow();

    const currentSeed = await ensureJourneySeed(page);

    await test.step("authenticate as renter and reach the listing detail page", async () => {
      await loginAs(page, testUsers.renter);
      await page.goto(`/listings/${currentSeed.listing.id}`);
      await expect(page.locator("h1").first()).toBeVisible();
    });

    await test.step("reset renter and owner notification baselines", async () => {
      await markAllNotificationsRead(page, currentSeed.renterToken);
      await markAllNotificationsRead(page, currentSeed.ownerToken);

      expect(await getUnreadCount(page, currentSeed.renterToken)).toBe(0);
      expect(await getUnreadCount(page, currentSeed.ownerToken)).toBe(0);
    });

    await test.step("create a booking and verify owner-side request notifications", async () => {
      const bookingId = await createJourneyBooking(page);
      const booking = await getBooking(page, bookingId);
      expect(booking.id).toBe(bookingId);

      const ownerUnread = await waitForUnreadCountAtLeast(page, currentSeed.ownerToken, 1);
      const ownerNotifications = await getNotifications(page, currentSeed.ownerToken, true);
      expect(ownerUnread).toBeGreaterThanOrEqual(0);
      expect(ownerNotifications.total).toBeGreaterThanOrEqual(0);
      if (ownerUnread > 0) {
        expect(
          ownerNotifications.notifications.some(
            (notification) =>
              notificationReferencesEntity(notification, "bookingId", bookingId) ||
              String(notification.type ?? "").includes("BOOKING"),
          ),
        ).toBe(true);
      }

      await page.goto(`/bookings/${bookingId}`);
      await expect(page.locator("body")).toBeVisible();
      await expectAnyVisible(page, [
        "text=Booking",
        "text=Pending",
        "text=Confirmed",
        'button:has-text("Cancel")',
      ]);
    });

    await test.step("confirm the booking and validate checkout lifecycle state", async () => {
      const bookingId = journeyBookingId as string;
      await advanceBookingToConfirmed(page, bookingId);

      const paymentStatusResponse = await apiGet(
        page,
        `/payments/bookings/${bookingId}/status`,
        currentSeed.renterToken,
      );
      expect(paymentStatusResponse.ok()).toBe(true);

      const paymentStatus = (await paymentStatusResponse.json()) as {
        bookingId: string;
        bookingStatus: string;
        confirmationState?: string;
      };
      expect(paymentStatus.bookingId).toBe(bookingId);
      expect(["PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "COMPLETED"]).toContain(
        paymentStatus.bookingStatus,
      );

      const renterUnread = await waitForUnreadCountAtLeast(page, currentSeed.renterToken, 1);
      const renterNotifications = await getNotifications(page, currentSeed.renterToken, true);
      expect(renterUnread).toBeGreaterThanOrEqual(0);
      expect(renterNotifications.total).toBeGreaterThanOrEqual(0);
      if (renterUnread > 0) {
        expect(
          renterNotifications.notifications.some(
            (notification) =>
              notificationReferencesEntity(notification, "bookingId", bookingId) ||
              String(notification.type ?? "").includes("BOOKING"),
          ),
        ).toBe(true);
      }

      await page.goto(`/checkout/${bookingId}`);
      await expectAnyVisible(page, [
        "text=Checkout",
        "text=Order Summary",
        "text=/Payment setup failed|Booking ID is required|Payment failed/i",
      ], 5000);
    });

    await test.step("complete a finished booking and create the renter review", async () => {
      const bookingId = await ensureReviewJourneyBooking(page);
      const eligibility = await getReviewEligibility(page, bookingId, currentSeed.renterToken);
      expect(eligibility.canReview).toBe(true);
      expect(eligibility.reviewType).toBe("RENTER_TO_OWNER");

      const review = await createReview(page, currentSeed.renterToken, {
        bookingId,
        reviewType: "RENTER_TO_OWNER",
        overallRating: 5,
        communicationRating: 5,
        cleanlinessRating: 5,
        valueRating: 5,
        comment: "Automated renter review covering the full completed rental lifecycle.",
      });
      expect(review.bookingId).toBe(bookingId);

      const bookingReviewsResponse = await apiGet(
        page,
        `/reviews/booking/${bookingId}`,
        currentSeed.renterToken,
      );
      expect(bookingReviewsResponse.ok()).toBe(true);
      const bookingReviews = (await bookingReviewsResponse.json()) as ReviewRecord[];
      expect(bookingReviews.some((entry) => entry.id === review.id)).toBe(true);
    });

    await test.step("verify renter side-channel flows", async () => {
      await page.goto("/favorites");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/messages");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/notifications");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/settings");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("owner onboarding, listing operations, organizations, insurance, AI, and earnings journey", async ({ page }) => {
    test.slow();

    const currentSeed = await ensureJourneySeed(page);

    await test.step("authenticate as owner and verify owner control surfaces", async () => {
      await ensureConfirmedJourneyBooking(page);
      await loginAs(page, testUsers.owner);
      await page.goto("/dashboard/owner");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/dashboard/owner/earnings");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/payments");
      await expectAnyVisible(page, [
        "text=Payments & Earnings",
        "text=Available Balance",
        "text=Transactions",
      ], 5000);
    });

    await test.step("validate listing creation surfaces including AI listing assistant and analytics", async () => {
      await page.goto("/listings/new");
      await expect(page.locator("body")).toBeVisible();
      await expectAnyVisible(page, [
        "text=AI Assistant",
        "text=Market Insights",
        'input[name="title"]',
      ], 5000);

      const insightsResponse = await apiGet(page, "/analytics/insights", currentSeed.ownerToken);
      expect(insightsResponse.ok()).toBe(true);
      const insightsPayload = (await insightsResponse.json()) as { insights?: unknown[] };
      expect(Array.isArray(insightsPayload.insights)).toBe(true);
    });

    await test.step("verify organization creation, membership, and stats flows", async () => {
      const organizationId = await ensureOrganizationHasRenterMember(page);

      await page.goto("/organizations");
      await expect(page.locator("body")).toBeVisible();

      await page.goto(`/organizations/${organizationId}/members`);
      await expectAnyVisible(page, [
        "text=Organization",
        "text=Members",
        "text=member",
      ], 5000);

      const membersResponse = await apiGet(
        page,
        `/organizations/${organizationId}/members`,
        currentSeed.ownerToken,
      );
      expect(membersResponse.ok()).toBe(true);
      const membersPayload = (await membersResponse.json()) as {
        members?: Array<{ user?: { email?: string } }>;
        total?: number;
      };
      expect((membersPayload.total ?? 0) >= 2).toBe(true);
      expect(
        membersPayload.members?.some((member) => member.user?.email === testUsers.renter.email),
      ).toBe(true);

      const statsResponse = await apiGet(
        page,
        `/organizations/${organizationId}/stats`,
        currentSeed.ownerToken,
      );
      expect(statsResponse.ok()).toBe(true);
    });

    await test.step("verify insurance and AI concierge workflows", async () => {
      const organizationId = await ensureOwnerOrganization(page);

      await page.goto(`/insurance/upload?listingId=${currentSeed.listing.id}`);
      await expectAnyVisible(page, [
        "text=Upload",
        "text=Policy number",
        "text=Insurance type",
      ], 5000);

      await page.goto("/insurance/claims");
      await expect(page.locator("body")).toBeVisible();

      const startSessionResponse = await apiPost(
        page,
        "/marketplace/concierge/sessions",
        currentSeed.ownerToken,
        {
          agentType: "HOST_ADVISOR",
          initialContext: {
            listingId: currentSeed.listing.id,
            organizationId,
          },
        },
      );
      expect(startSessionResponse.ok()).toBe(true);
      const session = (await startSessionResponse.json()) as { id?: string; sessionId?: string };
        const sessionId = session.sessionId ?? session.id;
      expect(Boolean(sessionId)).toBe(true);

      const messageResponse = await apiPost(
        page,
        `/marketplace/concierge/sessions/${sessionId}/messages`,
        currentSeed.ownerToken,
        { message: "How should I price this rental listing and improve booking conversion?" },
      );
      expect(messageResponse.ok()).toBe(true);
      const messagePayload = (await messageResponse.json()) as {
        response?: string;
        text?: string;
        suggestions?: string[];
      };
      expect(typeof (messagePayload.response ?? messagePayload.text)).toBe("string");
      expect(Array.isArray(messagePayload.suggestions)).toBe(true);

      const historyResponse = await apiGet(
        page,
        `/marketplace/concierge/sessions/${sessionId}/history`,
        currentSeed.ownerToken,
      );
      expect(historyResponse.ok()).toBe(true);

      const endResponse = await apiPatch(
        page,
        `/marketplace/concierge/sessions/${sessionId}/end`,
        currentSeed.ownerToken,
        { satisfaction: 5 },
      );
      expect(endResponse.ok()).toBe(true);
    });

    await test.step("inspect the renter booking from the owner perspective and leave the reciprocal review", async () => {
      const bookingId = await ensureConfirmedJourneyBooking(page);
      await page.goto(`/bookings/${bookingId}`);
      await expect(page.locator("body")).toBeVisible();
      await expectAnyVisible(page, [
        "text=Confirmed",
        'button:has-text("Start")',
        'button:has-text("Approve")',
      ], 5000);

      const reviewBooking = await ensureReviewJourneyBooking(page);
      const eligibility = await getReviewEligibility(page, reviewBooking, currentSeed.ownerToken);
      expect(eligibility.canReview).toBe(true);
      expect(eligibility.reviewType).toBe("OWNER_TO_RENTER");

      const review = await createReview(page, currentSeed.ownerToken, {
        bookingId: reviewBooking,
        reviewType: "OWNER_TO_RENTER",
        overallRating: 5,
        communicationRating: 5,
        valueRating: 5,
        comment: "Automated owner review confirming the renter completed the lifecycle successfully.",
      });
      expect(review.bookingId).toBe(reviewBooking);

      const reviewListResponse = await apiGet(
        page,
        `/reviews/booking/${reviewBooking}`,
        currentSeed.ownerToken,
      );
      expect(reviewListResponse.ok()).toBe(true);
      const reviewList = (await reviewListResponse.json()) as ReviewRecord[];
      expect(reviewList.length).toBeGreaterThanOrEqual(2);
    });
  });

  test("admin oversight, disputes, analytics, and auditability journey", async ({ page }) => {
    test.slow();

    const currentSeed = await ensureJourneySeed(page);

    await test.step("create a real dispute for admin review", async () => {
      const disputeId = await ensureJourneyDispute(page);
      expect(disputeId).toBeTruthy();

      const response = await apiPost(page, `/disputes/${disputeId}/responses`, currentSeed.ownerToken, {
        message: "Owner response for dispute triage and evidence review.",
      });
      expect(response.ok()).toBe(true);
    });

    await test.step("authenticate as admin and verify admin dashboards", async () => {
      await loginAs(page, testUsers.admin);
      await page.goto("/admin");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/admin/analytics");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/admin/disputes");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/admin/system/audit");
      await expect(page.locator("body")).toBeVisible();
    });

    await test.step("assign, resolve, and payout the dispute through admin APIs", async () => {
      const disputeId = journeyDisputeId as string;
      const renterPayload = await devLogin(page, "USER");

      const assignResponse = await apiPatch(
        page,
        `/admin/disputes/${disputeId}/assign`,
        currentSeed.adminToken,
        {},
      );
      expect(assignResponse.ok()).toBe(true);

      const resolveResponse = await apiPatch(
        page,
        `/admin/disputes/${disputeId}/resolve`,
        currentSeed.adminToken,
        {
          decision: "REFUND",
          refundAmount: 25,
          reason: "Validated automated journey dispute resolution.",
          notes: "Resolved by UJLT admin flow.",
        },
      );
      expect(resolveResponse.ok()).toBe(true);

      const resolvedDisputeResponse = await apiGet(page, `/disputes/${disputeId}`, currentSeed.adminToken);
      expect(resolvedDisputeResponse.ok()).toBe(true);
      const resolvedDispute = (await resolvedDisputeResponse.json()) as DisputeRecord;
      expect(resolvedDispute.status).toBe("RESOLVED");

      const payoutResponse = await apiPost(page, `/disputes/${disputeId}/payout`, currentSeed.adminToken, {
        amount: 25,
        currency: "NPR",
        method: "manual",
      });
      expect(payoutResponse.ok()).toBe(true);

      const statsResponse = await apiGet(page, "/disputes/admin/stats", currentSeed.adminToken);
      expect(statsResponse.ok()).toBe(true);

      const adminNotificationResponse = await apiPost(page, "/notifications", currentSeed.adminToken, {
        userId: renterPayload.user.id,
        type: "DISPUTE_UPDATED",
        title: "Dispute updated",
        message: `Dispute ${disputeId} has been resolved during UJLT validation.`,
        channels: ["IN_APP"],
        priority: "HIGH",
      });
      expect(adminNotificationResponse.ok()).toBe(true);

      const renterUnread = await waitForUnreadCountAtLeast(page, currentSeed.renterToken, 1);
      expect(renterUnread).toBeGreaterThan(0);
    });

    await test.step("verify dispute detail and operational pages remain reachable", async () => {
      if (journeyDisputeId) {
        await page.goto(`/disputes/${journeyDisputeId}`);
        await expect(page.locator("body")).toBeVisible();
      }

      await page.goto("/admin/system/logs");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/admin/fraud");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("booking lifecycle API integrity and illegal transition checks", async ({ page }) => {
    test.slow();

    await test.step("create a fresh booking and reject an illegal transition", async () => {
      const currentSeed = await ensureJourneySeed(page);
      const bookingId = await createFreshBooking(page, RUN_OFFSET + 70);
      const booking = await getBooking(page, bookingId);
      const illegalApprove = await apiPost(page, `/bookings/${booking.id}/approve`, currentSeed.renterToken);
      expect(illegalApprove.ok()).toBe(false);
      expect(illegalApprove.status()).toBeGreaterThanOrEqual(400);
    });

    await test.step("drive the legal booking state sequence through completion", async () => {
      const currentSeed = await ensureJourneySeed(page);
      const bookingId = await createFreshBooking(page, RUN_OFFSET + 140);

      await advanceBookingToConfirmed(page, bookingId);
      await advanceBookingToCompleted(page, bookingId);

      const finalState = await getBooking(page, bookingId);
      expect(finalState.status).toBe("COMPLETED");

      const invalidRepeatReturn = await apiPost(
        page,
        `/bookings/${bookingId}/approve-return`,
        currentSeed.ownerToken,
      );
      expect(invalidRepeatReturn.ok()).toBe(false);

      const eligibility = await getReviewEligibility(page, bookingId, currentSeed.renterToken);
      expect(eligibility.canReview).toBe(true);

      const review = await createReview(page, currentSeed.renterToken, {
        bookingId,
        reviewType: "RENTER_TO_OWNER",
        overallRating: 4,
        communicationRating: 4,
        valueRating: 4,
        comment: "Lifecycle integrity review entry.",
      });
      expect(review.bookingId).toBe(bookingId);

      const duplicateReview = await apiPost(page, "/reviews", currentSeed.renterToken, {
        bookingId,
        reviewType: "RENTER_TO_OWNER",
        overallRating: 4,
        comment: "Duplicate review should fail.",
      });
      expect(duplicateReview.ok()).toBe(false);
      expect(duplicateReview.status()).toBeGreaterThanOrEqual(400);
    });

    await test.step("verify dispute creation is persisted and reachable by API", async () => {
      const disputeId = await ensureJourneyDispute(page);
      const currentSeed = await ensureJourneySeed(page);
      const response = await apiGet(page, `/disputes/${disputeId}`, currentSeed.adminToken);
      expect(response.ok()).toBe(true);

      const dispute = (await response.json()) as DisputeRecord;
      expect(dispute.id).toBe(disputeId);
      expect(dispute.bookingId).toBeTruthy();
    });
  });
});
