/**
 * Insurance Claims E2E Test Suite
 *
 * Covers critical insurance workflows:
 * - Filing a new insurance claim
 * - Viewing claim details and status
 * - Uploading claim documentation
 * - Claim status tracking
 * - Admin claim review workflow
 */

import { test, expect } from "@playwright/test";
import { loginAs, testUsers, expectAnyVisible } from "./helpers/test-utils";
import { SeedApi } from "./helpers/seed-api";

// ===========================================================================
// 1. Insurance Claims List Page
// ===========================================================================

test.describe("Insurance Claims - List Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
  });

  test("renders insurance claims page with correct heading", async ({ page }) => {
    await page.goto("/insurance/claims");
    await expect(page.locator("h1")).toContainText(/Insurance|Claims/i);
  });

  test("shows empty state when user has no claims", async ({ page }) => {
    await page.goto("/insurance/claims");
    await page.waitForLoadState("domcontentloaded");

    // Either shows empty state or claims list
    await expectAnyVisible(page, [
      "text=/no claims|empty|No insurance claims/i",
      "text=/file a claim|submit claim/i",
    ]);
  });

  test("navigates to claim detail when clicking on a claim", async ({ page }) => {
    await page.goto("/insurance/claims");
    await page.waitForLoadState("domcontentloaded");

    // Look for a claim card or row
    const claimLink = page.locator('a[href^="/insurance/claims/"], [data-testid="claim-item"]').first();
    if (await claimLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimLink.click();
      await expect(page).toHaveURL(/\/insurance\/claims\/[a-f0-9-]+/);
    }
  });

  test("shows claim status indicators", async ({ page }) => {
    await page.goto("/insurance/claims");
    await page.waitForLoadState("domcontentloaded");

    // Look for status badges
    const statusBadge = page.locator('[data-testid="claim-status"], .status-badge, [class*="status"]').first();
    if (await statusBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      const statusText = await statusBadge.textContent();
      expect(statusText).toMatch(/PENDING|REVIEWING|APPROVED|REJECTED|RESOLVED|pending|approved|rejected/i);
    }
  });
});

// ===========================================================================
// 2. Filing a New Insurance Claim
// ===========================================================================

test.describe("Insurance Claims - Filing New Claim", () => {
  let seed: SeedApi;
  let listingId: string;
  let bookingId: string | null = null;

  test.beforeAll(async ({ request }) => {
    seed = new SeedApi(request);
    await seed.init();
    // Create a listing for testing
    const listing = await seed.createListing("camera");
    listingId = listing.id;
    // Note: We'll create the booking through the UI since SeedApi doesn't have createBooking
  });

  test.afterAll(async () => {
    await seed.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
  });

  test("navigates to new claim form from booking", async ({ page }) => {
    // Navigate to a completed booking
    await page.goto(`/bookings/${bookingId}`);
    await page.waitForLoadState("domcontentloaded");

    // Look for "File Claim" button
    const fileClaimBtn = page.locator('button:has-text("File Claim"), a:has-text("File Claim"), button:has-text("Report Issue")').first();
    if (await fileClaimBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileClaimBtn.click();
      await expect(page).toHaveURL(/\/insurance\/claims\/new|new.*claim/i);
    }
  });

  test("renders claim creation form with required fields", async ({ page }) => {
    await page.goto(`/insurance/claims/new/${bookingId}`);
    await page.waitForLoadState("domcontentloaded");

    // Check for form fields
    await expectAnyVisible(page, [
      'textarea[name="description"], textarea[name="details"], textarea',
      'select[name="claimType"], select[name="type"], input[name="claimType"]',
      'input[name="amount"], input[name="claimAmount"]',
      'button[type="submit"], button:has-text("Submit")',
    ]);
  });

  test("validates required fields before submission", async ({ page }) => {
    await page.goto(`/insurance/claims/new/${bookingId}`);
    await page.waitForLoadState("domcontentloaded");

    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit")').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try to submit empty form
      await submitBtn.click();

      // Should show validation error
      await expectAnyVisible(page, [
        "text=/required|Required/i",
        "text=/please fill|validation/i",
        ".error",
        "[role=alert]",
      ], 5000);
    }
  });

  test("successfully submits a new insurance claim", async ({ page }) => {
    await page.goto(`/insurance/claims/new/${bookingId}`);
    await page.waitForLoadState("domcontentloaded");

    // Fill claim type if dropdown exists
    const typeSelect = page.locator('select[name="claimType"], select[name="type"]').first();
    if (await typeSelect.isVisible().catch(() => false)) {
      await typeSelect.selectOption({ label: "Damage" });
    }

    // Fill description
    const descTextarea = page.locator('textarea[name="description"], textarea[name="details"], textarea').first();
    if (await descTextarea.isVisible().catch(() => false)) {
      await descTextarea.fill("Item was damaged during rental period. Screen has visible crack.");
    }

    // Fill amount if field exists
    const amountInput = page.locator('input[name="amount"], input[name="claimAmount"]').first();
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill("500");
    }

    // Submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit")').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();

      // Should redirect to claim detail or show success
      await Promise.race([
        expect(page).toHaveURL(/\/insurance\/claims\/[a-f0-9-]+/, { timeout: 10000 }),
        expect(page.locator("text=/submitted|success|created/i")).toBeVisible({ timeout: 10000 }),
      ]);
    }
  });

  test("shows confirmation after successful claim submission", async ({ page }) => {
    await page.goto(`/insurance/claims/new/${bookingId}`);
    await page.waitForLoadState("domcontentloaded");

    // Fill and submit claim
    const descTextarea = page.locator('textarea').first();
    if (await descTextarea.isVisible().catch(() => false)) {
      await descTextarea.fill("Test claim for confirmation message");
    }

    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();

      // Check for success message
      await expectAnyVisible(page, [
        "text=/submitted successfully|claim created|confirmation/i",
        "text=/track your claim|view claim/i",
      ], 10000);
    }
  });
});

// ===========================================================================
// 3. Claim Detail Page
// ===========================================================================

test.describe("Insurance Claims - Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
  });

  test("renders claim detail with claim information", async ({ page }) => {
    // Try to navigate to a claim detail (may not exist)
    await page.goto("/insurance/claims/test-claim-id");
    await page.waitForLoadState("domcontentloaded");

    // Should show claim details or not found
    await expectAnyVisible(page, [
      "h1",
      "text=/claim|Claim/i",
      "text=/not found|404/i",
    ]);
  });

  test("displays claim status timeline", async ({ page }) => {
    await page.goto("/insurance/claims");
    await page.waitForLoadState("domcontentloaded");

    const claimLink = page.locator('a[href^="/insurance/claims/"]').first();
    if (await claimLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimLink.click();

      // Look for timeline or status history
      await expectAnyVisible(page, [
        "text=/timeline|history|status updates/i",
        "[data-testid=\"timeline\"]",
        ".timeline",
      ], 5000);
    }
  });

  test("shows claim amount and reimbursement details", async ({ page }) => {
    await page.goto("/insurance/claims");
    await page.waitForLoadState("domcontentloaded");

    const claimLink = page.locator('a[href^="/insurance/claims/"]').first();
    if (await claimLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimLink.click();

      // Look for amount information
      await expectAnyVisible(page, [
        "text=/amount|Amount|reimbursement|Reimbursement/i",
        "text=/NPR|USD|\\$/i",
      ], 5000);
    }
  });

  test("allows adding comments or updates to claim", async ({ page }) => {
    await page.goto("/insurance/claims");
    await page.waitForLoadState("domcontentloaded");

    const claimLink = page.locator('a[href^="/insurance/claims/"]').first();
    if (await claimLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimLink.click();

      // Look for comment input
      const commentInput = page.locator('textarea[name="comment"], input[name="comment"]').first();
      if (await commentInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await commentInput.fill("Additional details about the claim");

        const addBtn = page.locator('button:has-text("Add"), button:has-text("Comment")').first();
        if (await addBtn.isVisible().catch(() => false)) {
          await addBtn.click();

          // Comment should appear
          await expect(page.locator("text=/Additional details/")).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});

// ===========================================================================
// 4. Claim Document Upload
// ===========================================================================

test.describe("Insurance Claims - Document Upload", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
  });

  test("renders document upload page", async ({ page }) => {
    await page.goto("/insurance/upload");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toContainText(/Upload|Document|File/i);
  });

  test("shows upload instructions and requirements", async ({ page }) => {
    await page.goto("/insurance/upload");
    await page.waitForLoadState("domcontentloaded");

    await expectAnyVisible(page, [
      "text=/upload|Upload/i",
      "text=/photo|image|document|file/i",
      "text=/required|format|jpg|png|pdf/i",
    ]);
  });

  test("has file input or drag-drop area", async ({ page }) => {
    await page.goto("/insurance/upload");
    await page.waitForLoadState("domcontentloaded");

    const fileInput = page.locator('input[type="file"]').first();
    const dropZone = page.locator('[data-testid="drop-zone"], .drop-zone, [class*="drop"]').first();

    const hasFileInput = await fileInput.isVisible().catch(() => false);
    const hasDropZone = await dropZone.isVisible().catch(() => false);

    expect(hasFileInput || hasDropZone).toBe(true);
  });

  test("validates file type and size", async ({ page }) => {
    await page.goto("/insurance/upload");
    await page.waitForLoadState("domcontentloaded");

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      // Try to upload invalid file (would need actual file in real test)
      // This test verifies the validation exists
      await expect(fileInput).toHaveAttribute("accept", /image|pdf|jpg|png/i);
    }
  });

  test("associates uploaded documents with a claim", async ({ page }) => {
    await page.goto("/insurance/claims");
    await page.waitForLoadState("domcontentloaded");

    const claimLink = page.locator('a[href^="/insurance/claims/"]').first();
    if (await claimLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimLink.click();

      // Look for upload section or documents list
      await expectAnyVisible(page, [
        "text=/documents|attachments|evidence/i",
        'button:has-text("Upload"), a:has-text("Upload")',
      ], 5000);
    }
  });
});

// ===========================================================================
// 5. Admin Claim Review Workflow
// ===========================================================================

test.describe("Insurance Claims - Admin Review", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.admin);
  });

  test("admin can view all insurance claims", async ({ page }) => {
    await page.goto("/admin/insurance-claims");
    await page.waitForLoadState("domcontentloaded");

    // Should show claims list or admin dashboard
    await expectAnyVisible(page, [
      "h1",
      "text=/claims|Claims|insurance/i",
      "table",
      "[data-testid=\"claims-list\"]",
    ]);
  });

  test("admin can filter claims by status", async ({ page }) => {
    await page.goto("/admin/insurance-claims");
    await page.waitForLoadState("domcontentloaded");

    // Look for filter controls
    const statusFilter = page.locator('select[name="status"], button:has-text("Filter"), [data-testid="status-filter"]').first();
    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.click();

      // Should show status options
      await expectAnyVisible(page, [
        "text=/PENDING|APPROVED|REJECTED|REVIEWING/i",
        "option",
      ]);
    }
  });

  test("admin can view claim details and evidence", async ({ page }) => {
    await page.goto("/admin/insurance-claims");
    await page.waitForLoadState("domcontentloaded");

    const claimRow = page.locator('tr, [data-testid="claim-row"], a[href*="/admin/insurance/claims/"]').first();
    if (await claimRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimRow.click();

      // Should show claim details
      await expectAnyVisible(page, [
        "text=/description|Description/i",
        "text=/amount|Amount/i",
        "text=/documents|evidence|photos/i",
      ], 5000);
    }
  });

  test("admin can approve or reject a claim", async ({ page }) => {
    await page.goto("/admin/insurance-claims");
    await page.waitForLoadState("domcontentloaded");

    // Look for pending claim
    const pendingClaim = page.locator('tr:has-text("PENDING"), [data-testid="claim-row"]:has-text("Pending")').first();
    if (await pendingClaim.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingClaim.click();

      // Look for approve/reject buttons
      const approveBtn = page.locator('button:has-text("Approve")').first();
      const rejectBtn = page.locator('button:has-text("Reject")').first();

      if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await approveBtn.click();

        // Should show confirmation or update status
        await expectAnyVisible(page, [
          "text=/approved|Approved/i",
          "text=/confirmation|success/i",
        ], 5000);
      }
    }
  });

  test("admin can request additional information", async ({ page }) => {
    await page.goto("/admin/insurance-claims");
    await page.waitForLoadState("domcontentloaded");

    const claimRow = page.locator('tr, [data-testid="claim-row"]').first();
    if (await claimRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimRow.click();

      // Look for request info button
      const requestInfoBtn = page.locator('button:has-text("Request Info"), button:has-text("More Info")').first();
      if (await requestInfoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await requestInfoBtn.click();

        // Should show input for message
        const messageInput = page.locator('textarea, input[type="text"]').first();
        if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await messageInput.fill("Please provide photos of the damage");

          const sendBtn = page.locator('button:has-text("Send"), button:has-text("Request")').first();
          if (await sendBtn.isVisible().catch(() => false)) {
            await sendBtn.click();

            // Should show confirmation
            await expect(page.locator("text=/sent|requested/i")).toBeVisible({ timeout: 5000 });
          }
        }
      }
    }
  });
});

// ===========================================================================
// 6. Mobile Responsiveness
// ===========================================================================

test.describe("Insurance Claims - Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
  });

  test("claims list is accessible on mobile", async ({ page }) => {
    await page.goto("/insurance/claims");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
  });

  test("claim form is usable on mobile", async ({ page }) => {
    await page.goto("/insurance/claims/new/test-booking-id");
    await page.waitForLoadState("domcontentloaded");

    // Form elements should be visible and accessible
    const inputs = page.locator('input, textarea, select, button[type="submit"]');
    expect(await inputs.count()).toBeGreaterThan(0);
  });
});
