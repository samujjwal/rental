import { test, expect, type Page } from "@playwright/test";
import { ensureSeedData, resetSeedCache } from "./helpers/seed-data";
import { expectAnyVisible, loginAsUi, testUsers } from "./helpers/test-utils";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";
const TEST_IMAGE_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0n0AAAAASUVORK5CYII=",
  "base64",
);

let bookingId: string | null = null;
let listingId: string | null = null;
let disputeDescription: string | null = null;
let renterConversationMessage: string | null = null;
let ownerConversationReply: string | null = null;
let bookingStartDate: string | null = null;
let bookingEndDate: string | null = null;
let manualRequestListingId: string | null = null;
let checkInReportNote: string | null = null;
let checkOutReportNote: string | null = null;

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
  let seed = await ensureSeedData(page);
  const uniqueSuffix = Date.now();
  const createListing = async () => page.request.post(`${API}/listings`, {
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
        city: "Kathmandu",
        state: "Bagmati",
        country: "Nepal",
        address: "Durbar Marg 1",
        postalCode: "44600",
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

  let createResponse = await createListing();
  if (createResponse.status() === 401) {
    resetSeedCache();
    seed = await ensureSeedData(page);
    createResponse = await createListing();
  }

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

async function createOwnerListingThroughUi(page: Page): Promise<string> {
  const uniqueSuffix = Date.now();
  const listingTitle = `Manual UI owner listing guitar ${uniqueSuffix}`;

  await loginAsUi(page, testUsers.owner);
  await page.goto("/listings/new");
  await expect(page).toHaveURL((url) => url.pathname === "/listings/new");

  await page.locator('input[name="title"]').first().fill(listingTitle);
  await page.locator('textarea[name="description"]').first().fill(
    "Manual browser-first owner listing creation coverage that fills the real listing form and verifies the created listing detail page.",
  );
  await page.locator('input[name="location.city"]').first().fill("Kathmandu");
  await page.locator('input[name="location.address"]').first().fill("Durbar Marg 1");
  await page.locator('input[name="location.state"]').first().fill("Bagmati");
  await page.locator('input[name="location.country"]').first().fill("Nepal");
  await page.locator('input[name="location.postalCode"]').first().fill("44600");

  const categorySelect = page.locator('[data-testid="category-select"]').first();
  await expect(categorySelect).toBeVisible({ timeout: 10000 });
  const optionCount = await categorySelect.locator("option").count();
  expect(optionCount).toBeGreaterThan(0);
  if (optionCount > 1) {
    const categoryOptions = await categorySelect.locator("option").allTextContents();
    const musicalInstrumentIndex = categoryOptions.findIndex((option) => /musical instrument/i.test(option));
    if (musicalInstrumentIndex > 0) {
      await categorySelect.selectOption({ index: musicalInstrumentIndex });
    } else {
      await categorySelect.selectOption({ index: 1 });
    }
  }

  await page.locator('input[type="file"]').first().setInputFiles({
    name: `manual-owner-listing-${uniqueSuffix}.png`,
    mimeType: "image/png",
    buffer: TEST_IMAGE_BUFFER,
  });
  await expect(page.locator('[data-testid="image-preview"]').first()).toBeVisible({ timeout: 15000 });

  const createButton = page.locator('[data-testid="create-listing-button"]').first();
  await expect(createButton).toBeVisible({ timeout: 10000 });
  await createButton.click();

  await page.waitForURL(
    (url) => url.pathname.startsWith("/listings/") && url.pathname !== "/listings/new",
    { timeout: 30000 },
  );
  const createdListingId = page.url().match(/\/listings\/([^/?#]+)/)?.[1] ?? null;
  expect(createdListingId).not.toBe("new");
  expect(createdListingId).toBeTruthy();

  await expectAnyVisible(page, [
    `text=${listingTitle}`,
    "text=/Request to Book|Book Instantly|Edit Listing|Owner/i",
  ]);

  return createdListingId as string;
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
  await page.waitForURL((url) => url.pathname === "/messages" && Boolean(url.searchParams.get("conversation")), {
    timeout: 15000,
  });
  await expect(page.locator('[data-testid="message-composer"]')).toBeVisible({ timeout: 15000 });
}

async function expectChatBubble(page: Page, message: string, alignment: "start" | "end"): Promise<void> {
  await expect(
    page.locator(`div.justify-${alignment}`).filter({ hasText: message }).last(),
  ).toBeVisible({ timeout: 15000 });
}

async function waitForBookingStatus(page: Page, currentBookingId: string, expectedStatus: string): Promise<void> {
  const seed = await ensureSeedData(page);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await page.request.get(`${API}/bookings/${currentBookingId}`, {
      headers: { Authorization: `Bearer ${seed.ownerToken}` },
    });

    if (response.ok()) {
      const booking = (await response.json()) as { status?: string };
      if (booking.status === expectedStatus) {
        return;
      }
    }

    // Wait for response using network idle
    await page.waitForLoadState('networkidle');
  }

  throw new Error(`Booking ${currentBookingId} did not reach ${expectedStatus}`);
}

async function waitForConditionReport(page: Page, currentBookingId: string, reportType: string): Promise<void> {
  const seed = await ensureSeedData(page);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await page.request.get(`${API}/bookings/${currentBookingId}/condition-reports`, {
      headers: { Authorization: `Bearer ${seed.renterToken}` },
    });

    if (response.ok()) {
      const reports = (await response.json()) as Array<{ reportType?: string }>;
      if (reports.some((report) => report.reportType === reportType)) {
        return;
      }
    }

    // Wait for response using network idle
    await page.waitForLoadState('networkidle');
  }

  throw new Error(`Booking ${currentBookingId} did not expose condition report ${reportType}`);
}

async function openConditionReport(page: Page, currentBookingId: string): Promise<void> {
  await page.goto(`/bookings/${currentBookingId}/condition-report`);
  await expect(page).toHaveURL(
    (url) => url.pathname === `/bookings/${currentBookingId}/condition-report`,
    { timeout: 15000 },
  );
  await expect(page.getByRole("heading", { name: "Condition Reports" })).toBeVisible({ timeout: 10000 });
}

async function saveConditionReport(
  page: Page,
  options: {
    sectionHeading: string;
    notes?: string;
    damages?: string;
    photos?: string[];
  },
): Promise<void> {
  const section = page.locator("div.mb-6").filter({
    has: page.getByRole("heading", { name: options.sectionHeading }),
  }).first();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sectionVisible = await section.isVisible().catch(() => false);
    if (sectionVisible) {
      break;
    }
    // Wait for section to appear using network idle
    await page.waitForLoadState('domcontentloaded');
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  await expect(section).toBeVisible({ timeout: 10000 });
  const form = section.locator("form").first();
  await expect(form).toBeVisible({ timeout: 10000 });

  if (options.notes !== undefined) {
    await form.locator('textarea[name="notes"]').fill(options.notes);
  }
  if (options.damages !== undefined) {
    await form.locator('textarea[name="damages"]').fill(options.damages);
  }
  if (options.photos !== undefined) {
    await form.locator('input[name="photos"]').fill(JSON.stringify(options.photos));
  }

  await form.getByRole("button", { name: /Save Report/i }).click();
  await expect(section.getByText("Report saved successfully.")).toBeVisible({ timeout: 15000 });

  if (options.notes) {
    await expect(section.locator("p").filter({ hasText: options.notes }).first()).toBeVisible({ timeout: 15000 });
  }
  if (options.damages) {
    await expect(section.locator("p").filter({ hasText: options.damages }).first()).toBeVisible({ timeout: 15000 });
  }
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
  test("owner creates a listing through the real listing creation UI", async ({ page }) => {
    const createdListingId = await createOwnerListingThroughUi(page);

    await page.goto(`/listings/${createdListingId}`);
    await expect(page).toHaveURL((url) => url.pathname === `/listings/${createdListingId}`);
    await expect(page.locator("body")).toContainText(/Manual UI owner listing/);
  });

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

    const confirmButton = page.getByRole("button", { name: /^Confirm Booking$/ }).first();
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await confirmButton.click();

    await expectAnyVisible(page, [
      "text=Booking confirmed successfully",
      "text=Pending Payment",
      "text=Awaiting payment",
    ]);
    await openBooking(page, bookingId as string);
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
    await expectChatBubble(page, renterConversationMessage, "end");

    await loginAsUi(page, testUsers.owner);
    await openBookingConversation(page, bookingId as string);
    await expectChatBubble(page, renterConversationMessage, "start");
    await page.locator('[data-testid="message-composer"]').fill(ownerConversationReply);
    await page.locator('[data-testid="message-composer"]').press("Enter");
    await expectChatBubble(page, ownerConversationReply, "end");

    await loginAsUi(page, testUsers.renter);
    await openBookingConversation(page, bookingId as string);
    await expectChatBubble(page, ownerConversationReply, "start");
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

  test("owner starts the rental, renter completes the check-in report, and renter requests return", async ({ page }) => {
    expect(bookingId).toBeTruthy();

    await loginAsUi(page, testUsers.owner);
    await openBooking(page, bookingId as string);

    const startButton = page.getByRole("button", { name: /^Start Rental$/ }).first();
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();
    await waitForBookingStatus(page, bookingId as string, "IN_PROGRESS");
    await waitForConditionReport(page, bookingId as string, "CHECK_IN");
    await openBooking(page, bookingId as string);

    await loginAsUi(page, testUsers.renter);
    checkInReportNote = `Manual check-in report ${Date.now()} for booking ${bookingId}`;

    await openConditionReport(page, bookingId as string);
    await saveConditionReport(page, {
      sectionHeading: "Check-In Report",
      notes: checkInReportNote,
      damages: "",
      photos: [`${API}/health?check-in=${bookingId}`],
    });

    await loginAsUi(page, testUsers.owner);
    await openConditionReport(page, bookingId as string);
    await expect(page.getByText(checkInReportNote)).toBeVisible({ timeout: 15000 });

    await loginAsUi(page, testUsers.renter);
    await openBooking(page, bookingId as string);

    const requestReturnButton = page.getByRole("button", { name: /^Request Return$/ }).first();
    await expect(requestReturnButton).toBeVisible({ timeout: 10000 });
    await requestReturnButton.click();

    await waitForBookingStatus(page, bookingId as string, "AWAITING_RETURN_INSPECTION");
    await waitForConditionReport(page, bookingId as string, "CHECK_OUT");
    await openBooking(page, bookingId as string);
    await expectAnyVisible(page, [
      "text=Awaiting Return Inspection",
      "text=Inspect & Approve the Return",
      "text=Return",
    ]);
  });

  test("owner completes the booking and renter leaves a review and files a dispute through the UI", async ({ page }) => {
    expect(bookingId).toBeTruthy();

    await loginAsUi(page, testUsers.owner);
    checkOutReportNote = `Manual return inspection ${Date.now()} for booking ${bookingId}`;

    await openConditionReport(page, bookingId as string);
    await saveConditionReport(page, {
      sectionHeading: "Check-Out / Return Inspection Report",
      notes: checkOutReportNote,
      damages: "No damage found during the manual browser-first inspection.",
      photos: [`${API}/health?check-out=${bookingId}`],
    });

    await openBooking(page, bookingId as string);

    const approveReturnButton = page.getByRole("button", { name: /^Approve Return$/ }).first();
    await expect(approveReturnButton).toBeVisible({ timeout: 10000 });
    await approveReturnButton.click();
    await waitForBookingStatus(page, bookingId as string, "COMPLETED");
    await openBooking(page, bookingId as string);

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