import { test, expect, type Page } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";
import { expectAnyVisible, loginAsUi, testUsers } from "./helpers/test-utils";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

let bookingId: string | null = null;
let listingId: string | null = null;
let disputeDescription: string | null = null;
let renterConversationMessage: string | null = null;
let ownerConversationReply: string | null = null;
let bookingStartDate: string | null = null;
let bookingEndDate: string | null = null;
let manualRequestListingId: string | null = null;

interface ListingCandidate {
  id: string;
  title: string;
  bookingMode?: string;
  instantBookable?: boolean;
}

interface ManualListingWindow {
  listingId: string;
  startDate: string;
  endDate: string;
}

function dateInputToMonthLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function dateInputToCalendarLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function calendarLabelToDateInput(label: string): string {
  const parsed = new Date(label);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Unable to parse calendar label: ${label}`);
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function selectBookingRange(page: Page, startDate: string, endDate: string): Promise<void> {
  await expect(page.getByRole("button", { name: "Next month" }).last()).toBeVisible({ timeout: 10000 });
  const targetMonths = new Set([dateInputToMonthLabel(startDate), dateInputToMonthLabel(endDate)]);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const visibleMonthLabels = await page.locator("text=/^[A-Z][a-z]+\\s\\d{4}$/").allTextContents();
    if ([...targetMonths].every((label) => visibleMonthLabels.includes(label))) {
      break;
    }

    await page.getByRole("button", { name: "Next month" }).last().click();
  }

  const bookingButton = page
    .locator('button:has-text("Request to Book"), button:has-text("Book Instantly")')
    .first();

  await page.getByRole("button", { name: dateInputToCalendarLabel(startDate) }).click();
  await page.getByRole("button", { name: dateInputToCalendarLabel(endDate) }).click();
  await expect(bookingButton).toBeEnabled({ timeout: 10000 });
}

async function ensureManualRequestListing(page: Page): Promise<string> {
  if (manualRequestListingId) {
    return manualRequestListingId;
  }

  const created = await createManualRequestListing(page, { dayOffset: 7 });
  manualRequestListingId = created.listingId;
  bookingStartDate = created.startDate;
  bookingEndDate = created.endDate;

  return manualRequestListingId;
}

async function createManualRequestListing(
  page: Page,
  options: { dayOffset: number; titlePrefix?: string },
): Promise<ManualListingWindow> {
  const seed = await ensureSeedData(page);
  const uniqueSuffix = Date.now();
  const createResponse = await page.request.post(`${API}/listings`, {
    headers: {
      Authorization: `Bearer ${seed.ownerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      title: `${options.titlePrefix ?? "[E2E] Manual Request Listing"} ${uniqueSuffix}`,
      description: "Owner-approval listing created for the manual Chromium critical-path suite.",
      category: "musical-instrument",
      basePrice: 30,
      securityDeposit: 250,
      location: {
        city: "Nashville",
        state: "TN",
        country: "US",
        address: "123 Test Street",
        postalCode: "00001",
      },
      deliveryOptions: { pickup: true, delivery: false, shipping: false },
      condition: "excellent",
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 14,
      cancellationPolicy: "flexible",
      instantBooking: false,
      photos: [{ url: `${API}/health`, order: 0 }],
    },
  });

  if (!createResponse.ok()) {
    throw new Error(`Unable to create a manual request listing: ${createResponse.status()} ${await createResponse.text()}`);
  }

  const createdListing = (await createResponse.json()) as { id: string };
  const createdListingId = createdListing.id;

  const publishResponse = await page.request.post(`${API}/listings/${createdListingId}/publish`, {
    headers: { Authorization: `Bearer ${seed.ownerToken}` },
  });
  if (!publishResponse.ok()) {
    throw new Error(`Unable to publish manual request listing: ${publishResponse.status()} ${await publishResponse.text()}`);
  }

  await page.request.post(`${API}/admin/listings/${createdListingId}/approve`, {
    headers: { Authorization: `Bearer ${seed.adminToken}` },
  }).catch(() => {
    // Some environments do not require explicit admin approval for visibility.
  });

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + options.dayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  return {
    listingId: createdListingId,
    startDate,
    endDate,
  };
}

async function bypassPaymentConfirmation(page: Page, currentBookingId: string): Promise<void> {
  const accessToken = await page.evaluate(() => {
    try {
      const rawAuth = localStorage.getItem("auth-storage");
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth) as { state?: { accessToken?: string } };
        if (parsed?.state?.accessToken) {
          return parsed.state.accessToken;
        }
      }

      return localStorage.getItem("accessToken");
    } catch {
      return null;
    }
  });

  const response = await page.request.post(`${API}/bookings/${currentBookingId}/bypass-confirm`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    data: {},
  });

  if (!response.ok()) {
    throw new Error(`bypass-confirm failed: ${response.status()} ${await response.text()}`);
  }
}

async function openBooking(page: Page, currentBookingId: string): Promise<void> {
  await page.goto(`/bookings/${currentBookingId}`);
  await expect(page).toHaveURL((url) => url.pathname === `/bookings/${currentBookingId}`);
  await expect(page.locator("body")).toBeVisible();
}

async function openBookingConversation(page: Page, currentBookingId: string): Promise<void> {
  await openBooking(page, currentBookingId);
  const messageButton = page.locator('button:has-text("Send Message")').first();
  await expect(messageButton).toBeVisible({ timeout: 10000 });
  await messageButton.click();
  await expect(page).toHaveURL((url) => url.pathname === "/messages", { timeout: 15000 });
  await expect(page.locator('[data-testid="message-composer"]')).toBeVisible({ timeout: 15000 });
}

async function requestBookingThroughUi(
  page: Page,
  listingWindow: ManualListingWindow,
  message: string,
): Promise<string> {
  await loginAsUi(page, testUsers.renter);
  await page.goto(`/listings/${listingWindow.listingId}`);
  await expect(page).toHaveURL((url) => url.pathname === `/listings/${listingWindow.listingId}`);

  const bookingButton = page
    .locator('button:has-text("Request to Book"), button:has-text("Book Instantly")')
    .first();

  await selectBookingRange(page, listingWindow.startDate, listingWindow.endDate);

  const moreOptionsButton = page.locator('button:has-text("More options")').first();
  if (await moreOptionsButton.isVisible().catch(() => false)) {
    await moreOptionsButton.click();
  }

  const messageBox = page.locator("textarea").last();
  if (await messageBox.isVisible().catch(() => false)) {
    await messageBox.fill(message);
  }

  await expect(bookingButton).toBeEnabled({ timeout: 10000 });
  await bookingButton.click();
  await page.waitForURL(/\/bookings\/[^/?#]+(?:\?.*)?$/, { timeout: 15000 });

  const createdBookingId = page.url().match(/\/bookings\/([^/?#]+)/)?.[1] ?? null;
  expect(createdBookingId).toBeTruthy();
  return createdBookingId as string;
}

async function adminForceBookingStatus(page: Page, currentBookingId: string, status: string): Promise<void> {
  const seed = await ensureSeedData(page);
  const response = await page.request.patch(`${API}/admin/bookings/${currentBookingId}/status`, {
    headers: {
      Authorization: `Bearer ${seed.adminToken}`,
      "Content-Type": "application/json",
    },
    data: { status },
  });

  if (!response.ok()) {
    throw new Error(`Unable to force booking ${currentBookingId} to ${status}: ${response.status()} ${await response.text()}`);
  }
}

test.describe.serial("Manual Critical UI Journeys", () => {
  test("renter logs in through the UI and requests a booking from the listing page", async ({ page }) => {
    listingId = await ensureManualRequestListing(page);
    expect(bookingStartDate).toBeTruthy();
    expect(bookingEndDate).toBeTruthy();

    await loginAsUi(page, testUsers.renter);
    await page.goto(`/listings/${listingId}`);
    await expect(page).toHaveURL((url) => url.pathname === `/listings/${listingId}`);

    const bookingButton = page
      .locator('button:has-text("Request to Book"), button:has-text("Book Instantly")')
      .first();

    await selectBookingRange(page, bookingStartDate as string, bookingEndDate as string);

    const moreOptionsButton = page.locator('button:has-text("More options")').first();
    if (await moreOptionsButton.isVisible().catch(() => false)) {
      await moreOptionsButton.click();
    }

    const messageBox = page.locator("textarea").last();
    if (await messageBox.isVisible().catch(() => false)) {
      await messageBox.fill("Manual browser-first renter journey booking request.");
    }

    await expect(bookingButton).toBeEnabled({ timeout: 10000 });
    await bookingButton.click();

    await page.waitForURL(/\/bookings\/[^/?#]+(?:\?.*)?$/, { timeout: 15000 });
    bookingId = page.url().match(/\/bookings\/([^/?#]+)/)?.[1] ?? null;

    expect(bookingId).toBeTruthy();
    await expectAnyVisible(page, [
      "text=Pending Owner Approval",
      "text=Booking Timeline",
      "text=Booking Information",
    ]);
  });

  test("owner approves the booking in the booking detail UI", async ({ page }) => {
    expect(bookingId).toBeTruthy();

    await loginAsUi(page, testUsers.owner);
    await openBooking(page, bookingId as string);

    const confirmButton = page.locator('button:has-text("Confirm Booking")').first();
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await confirmButton.click();

    await expect(confirmButton).toBeHidden({ timeout: 15000 });
    await expectAnyVisible(page, [
      "text=Pending Payment",
      "text=Payment",
      "text=Awaiting payment",
    ]);
  });

  test("renter and owner continue the booking conversation through the UI", async ({ page }) => {
    expect(bookingId).toBeTruthy();

    renterConversationMessage = `Manual renter booking thread message ${Date.now()}`;
    ownerConversationReply = `Manual owner booking thread reply ${Date.now()}`;

    await loginAsUi(page, testUsers.renter);
    await openBookingConversation(page, bookingId as string);
    const composer = page.locator('[data-testid="message-composer"]');
    await composer.fill(renterConversationMessage);
    await composer.press("Enter");
    await expect(page.locator(`text=${renterConversationMessage}`)).toBeVisible({ timeout: 15000 });

    await loginAsUi(page, testUsers.owner);
    await openBookingConversation(page, bookingId as string);
    await expect(page.locator(`text=${renterConversationMessage}`)).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="message-composer"]').fill(ownerConversationReply);
    await page.locator('[data-testid="message-composer"]').press("Enter");
    await expect(page.locator(`text=${ownerConversationReply}`)).toBeVisible({ timeout: 15000 });

    await loginAsUi(page, testUsers.renter);
    await openBookingConversation(page, bookingId as string);
    await expect(page.locator(`text=${ownerConversationReply}`)).toBeVisible({ timeout: 15000 });
  });

  test("checkout access is guarded correctly and the renter reaches the real checkout UI", async ({ page }) => {
    expect(bookingId).toBeTruthy();

    await loginAsUi(page, testUsers.owner);
    await page.goto(`/checkout/${bookingId}`);
    await expect(page).toHaveURL((url) => url.pathname === `/bookings/${bookingId}`, {
      timeout: 15000,
    });

    await loginAsUi(page, testUsers.renter);
    await openBooking(page, bookingId as string);

    const payNowButton = page.locator('button:has-text("Pay Now"), button:has-text("Retry Payment")').first();
    await expect(payNowButton).toBeVisible({ timeout: 10000 });
    await payNowButton.click();

    await page.waitForURL((url) => url.pathname === `/checkout/${bookingId}`, { timeout: 15000 });
    await expectAnyVisible(page, [
      "text=Checkout",
      "text=Order Summary",
      "text=Payment Information",
    ]);
    await expect(page.locator('button:has-text("Pay")').first()).toBeVisible({ timeout: 10000 });

    await bypassPaymentConfirmation(page, bookingId as string);
    await openBooking(page, bookingId as string);
    await expectAnyVisible(page, [
      "text=Confirmed",
      "text=Booking Timeline",
    ]);

    await page.goto(`/checkout/${bookingId}`);
    await expect(page).toHaveURL((url) => url.pathname === `/bookings/${bookingId}`, {
      timeout: 15000,
    });
  });

  test("owner starts the rental and renter requests the return using UI actions", async ({ page }) => {
    expect(bookingId).toBeTruthy();

    await loginAsUi(page, testUsers.owner);
    await openBooking(page, bookingId as string);

    const startButton = page.locator('button:has-text("Start Rental"), button:has-text("Start")').first();
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();
    await expect(startButton).toBeHidden({ timeout: 15000 });

    await loginAsUi(page, testUsers.renter);
    await openBooking(page, bookingId as string);

    const requestReturnButton = page.locator('button:has-text("Request Return")').first();
    await expect(requestReturnButton).toBeVisible({ timeout: 10000 });
    await requestReturnButton.click();

    await expect(requestReturnButton).toBeHidden({ timeout: 15000 });
    await expectAnyVisible(page, [
      "text=Awaiting Return Inspection",
      "text=Inspect & Approve the Return",
      "text=Return",
    ]);
  });

  test("owner completes the booking and renter leaves a review and files a dispute through the UI", async ({ page }) => {
    expect(bookingId).toBeTruthy();

    await loginAsUi(page, testUsers.owner);
    await openBooking(page, bookingId as string);

    const approveReturnButton = page.locator('button:has-text("Approve Return")').first();
    await expect(approveReturnButton).toBeVisible({ timeout: 10000 });
    await approveReturnButton.click();
    await expect(approveReturnButton).toBeHidden({ timeout: 15000 });

    await loginAsUi(page, testUsers.renter);
    await openBooking(page, bookingId as string);
    await expectAnyVisible(page, [
      "text=Completed",
      "text=Booking Timeline",
    ]);

    const leaveReviewButton = page.locator('button:has-text("Leave a Review"), button:has-text("Leave Review")').first();
    await expect(leaveReviewButton).toBeVisible({ timeout: 10000 });
    await leaveReviewButton.click();
    await page.locator('textarea[name="comment"]').fill("Manual browser-first review submission after a completed rental.");
    await page.locator('button:has-text("Submit Review")').click();
    await expectAnyVisible(page, [
      "text=Manual browser-first review submission after a completed rental.",
      "text=Review submitted",
    ]);
    await expect(page.locator('textarea[name="comment"]')).toBeHidden({ timeout: 15000 });

    const uniqueMarker = Date.now();
    disputeDescription = `Manual UI dispute ${uniqueMarker} for booking ${bookingId}`;

    const disputeButton = page.locator('button:has-text("File a Dispute")').first();
    await expect(disputeButton).toBeVisible({ timeout: 10000 });
    await disputeButton.click();

    await page.waitForURL((url) => url.pathname === `/disputes/new/${bookingId}`, { timeout: 15000 });
    await page.locator('input[name="type"][value="REFUND_REQUEST"]').check();
    await page.locator('input[name="title"]').fill(`Manual UI refund dispute ${uniqueMarker}`);
    await page.locator('textarea[name="description"]').fill(disputeDescription);
    await page.locator('input[name="requestedAmount"]').fill("25");
    await page.locator('button:has-text("Submit Dispute")').click();

    await page.waitForURL((url) => url.pathname === `/bookings/${bookingId}`, { timeout: 15000 });
    await expectAnyVisible(page, [
      "text=File a Dispute",
      "text=Booking Timeline",
    ]);
  });

  test("admin assigns and resolves the dispute from the admin disputes UI", async ({ page }) => {
    expect(disputeDescription).toBeTruthy();

    await loginAsUi(page, testUsers.admin);
    await page.goto("/admin/disputes");
    await expect(page).toHaveURL(/\/admin\/disputes/);

    const matchingCard = page.locator('[data-testid="dispute-card"]', {
      hasText: disputeDescription as string,
    }).first();
    await expect(matchingCard).toBeVisible({ timeout: 15000 });
    await matchingCard.click();

    await expect(page.locator('[data-testid="dispute-details"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="assign-dispute-button"]').click();
    await expect(page.locator('[data-testid="dispute-action-success"]')).toContainText(/assigned|review/i);

    await page.locator('[data-testid="resolution-note-input"]').fill("Manual UI admin resolution for the browser-first critical lane.");
    await page.locator('[data-testid="resolved-amount-input"]').fill("25");
    await page.locator('[data-testid="resolve-dispute-button"]').click();

    await expect(page.locator('[data-testid="dispute-action-success"]')).toContainText(/resolved/i, {
      timeout: 15000,
    });
    await expect(page.locator('[data-testid="dispute-details"]')).toContainText(/resolved/i);
  });
});

test.describe("Manual Critical UI Failure And Recovery", () => {
  test("owner declines a booking request through the UI and the renter sees the declined outcome", async ({ page }) => {
    const listingWindow = await createManualRequestListing(page, {
      dayOffset: 12,
      titlePrefix: "[E2E] Manual Decline Listing",
    });
    const rejectedBookingId = await requestBookingThroughUi(
      page,
      listingWindow,
      "Manual decline-path booking request from the renter.",
    );

    await loginAsUi(page, testUsers.owner);
    await openBooking(page, rejectedBookingId);
    const declineButton = page.locator('button:has-text("Decline Booking")').first();
    await expect(declineButton).toBeVisible({ timeout: 10000 });
    await declineButton.click();
    await page.locator('textarea[name="reason"]').fill("Manual UI owner decline for the Chromium unhappy-path lane.");
    await page.locator('button:has-text("Decline Booking")').last().click();
    await expectAnyVisible(page, [
      "text=Booking declined successfully",
      "text=CANCELLED",
    ]);

    await loginAsUi(page, testUsers.renter);
    await openBooking(page, rejectedBookingId);
    await expectAnyVisible(page, [
      "text=CANCELLED",
      "text=Manual UI owner decline for the Chromium unhappy-path lane.",
      "text=Booking Timeline",
    ]);
    await expect(page.locator('button:has-text("Pay Now"), button:has-text("Retry Payment")').first()).toBeHidden();
  });

  test("renter can cancel from the real checkout UI and lands on a cancelled booking", async ({ page }) => {
    const listingWindow = await createManualRequestListing(page, {
      dayOffset: 16,
      titlePrefix: "[E2E] Manual Checkout Cancel Listing",
    });
    const cancellableBookingId = await requestBookingThroughUi(
      page,
      listingWindow,
      "Manual checkout-cancel booking request from the renter.",
    );

    await loginAsUi(page, testUsers.owner);
    await openBooking(page, cancellableBookingId);
    await page.locator('button:has-text("Confirm Booking")').first().click();
    await expectAnyVisible(page, [
      "text=Pending Payment",
      "text=Awaiting payment",
    ]);

    await loginAsUi(page, testUsers.renter);
    await openBooking(page, cancellableBookingId);
    await page.locator('button:has-text("Pay Now")').first().click();
    await page.waitForURL((url) => url.pathname === `/checkout/${cancellableBookingId}`, { timeout: 15000 });
    await page.locator('button:has-text("Cancel")').click();
    await expect(page).toHaveURL((url) => url.pathname === `/bookings/${cancellableBookingId}`, {
      timeout: 15000,
    });
    await expectAnyVisible(page, [
      "text=CANCELLED",
      "text=Booking Timeline",
    ]);
  });

  test("renter sees payment failure recovery and can retry payment through the UI", async ({ page }) => {
    const listingWindow = await createManualRequestListing(page, {
      dayOffset: 20,
      titlePrefix: "[E2E] Manual Payment Retry Listing",
    });
    const retryBookingId = await requestBookingThroughUi(
      page,
      listingWindow,
      "Manual payment-retry booking request from the renter.",
    );

    await loginAsUi(page, testUsers.owner);
    await openBooking(page, retryBookingId);
    await page.locator('button:has-text("Confirm Booking")').first().click();
    await expectAnyVisible(page, [
      "text=Pending Payment",
      "text=Awaiting payment",
    ]);

    await adminForceBookingStatus(page, retryBookingId, "PAYMENT_FAILED");

    await loginAsUi(page, testUsers.renter);
    await openBooking(page, retryBookingId);
    await expectAnyVisible(page, [
      "text=PAYMENT_FAILED",
      "text=Retry Payment",
      "text=Payment Failed",
    ]);

    const retryPaymentButton = page.locator('button:has-text("Retry Payment")').first();
    await expect(retryPaymentButton).toBeVisible({ timeout: 10000 });
    await retryPaymentButton.click();

    await page.waitForURL((url) => url.pathname === `/checkout/${retryBookingId}`, { timeout: 15000 });
    await expectAnyVisible(page, [
      "text=Checkout",
      "text=Payment Information",
    ]);

    await bypassPaymentConfirmation(page, retryBookingId);
    await openBooking(page, retryBookingId);
    await expectAnyVisible(page, [
      "text=Confirmed",
      "text=Booking Timeline",
    ]);
  });
});