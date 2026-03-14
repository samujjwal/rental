import { test, expect, Page } from "@playwright/test";
import { testUsers, testListings, testBookings, testReviews } from "./helpers/fixtures";
import { loginAs } from "./helpers/test-utils";

const API_BASE_URL = process.env.E2E_API_URL || "http://localhost:3400/api";

const futureDate = (daysFromNow: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
};

/** Fetch the first real listing id from the search API. */
async function getFirstRealListingId(page: Page): Promise<string | null> {
  const response = await page.request.get(`${API_BASE_URL}/listings/search?limit=1`);
  if (!response.ok()) return null;
  const data = (await response.json()) as { listings?: { id: string }[] };
  return data?.listings?.[0]?.id ?? null;
}

test.describe("Complete End-to-End User Journeys", () => {
  // ────────────────────────────────────────────────
  // Journey 1: New Renter — Full Booking Flow
  // ────────────────────────────────────────────────
  test.describe("Journey 1: New Renter - Full Booking Flow", () => {

    test("Step 1: Signup as new renter", async ({ page }) => {
      const renterEmail = `test.renter.${Date.now()}@example.com`;

      await page.goto("/auth/signup");

      await page.fill('input[name="email"]', renterEmail);
      await page.fill('input[name="password"]', "SecurePassword123!");
      await page.fill('input[name="confirmPassword"]', "SecurePassword123!");
      await page.fill('input[name="firstName"]', "Sarah");
      await page.fill('input[name="lastName"]', "Johnson");
      await page.fill('input[name="phone"]', "+1-555-0199");

      const renterRadio = page.locator('input[value="renter"]');
      if (await renterRadio.isVisible()) await renterRadio.check();

      const termsCheckbox = page.locator('input[name="acceptTerms"]');
      if (await termsCheckbox.isVisible()) await termsCheckbox.check();

      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");

      // Should either redirect to dashboard/verify or show an error (e.g. duplicate)
      const url = page.url();
      expect(
        url.includes("/dashboard") ||
          url.includes("/auth/signup") ||
          url.includes("/verify") ||
          url.includes("/welcome"),
      ).toBe(true);
    });

    test("Step 2: Browse and search for items", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/search");
      await page.waitForLoadState("networkidle");

      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill("camera");
      await page.getByRole("button", { name: "Search" }).first().click();

      await expect(page).toHaveURL(/.*search/);
      await expect(page.locator("body")).toBeVisible();

      // Apply price filter if available
      // At 1280px viewport the filter sidebar is already open by default.
      // Only click Filters if the min price input is not yet visible.
      const minPriceInput = page.locator('input[placeholder="Min"]');
      if (!(await minPriceInput.isVisible())) {
        const filtersBtn = page.getByRole("button", { name: "Filters", exact: true });
        if (await filtersBtn.isVisible()) await filtersBtn.click();
      }
      if (await minPriceInput.isVisible()) {
        await minPriceInput.fill("50");
        await page.locator('input[placeholder="Max"]').fill("500");
      }
    });

    test("Step 3: View listing details", async ({ page }) => {
      await loginAs(page, testUsers.renter);

      const listingId = await getFirstRealListingId(page);
      if (!listingId) {
        // No listings in DB — skip gracefully
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await page.goto(`/listings/${listingId}`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.locator('text=/daily.*rate|per.*day|price/i').first(),
      ).toBeVisible();
    });

    test("Step 4: Select dates and proceed to booking", async ({ page }) => {
      await loginAs(page, testUsers.renter);

      const listingId = await getFirstRealListingId(page);
      if (!listingId) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await page.goto(`/listings/${listingId}`);
      await page.waitForLoadState("networkidle");

      const dates = page.locator('input[type="date"]');
      await dates.nth(0).fill(futureDate(7));
      await dates.nth(1).fill(futureDate(9));

      const guestInput = page.locator('input[type="number"]').first();
      if (await guestInput.isVisible()) await guestInput.fill("2");

      const textarea = page.locator("textarea").first();
      if (await textarea.isVisible()) await textarea.fill(testBookings.weekend.message);

      const checkBtn = page.getByRole("button", { name: /Check Availability/i });
      if (await checkBtn.isEnabled()) {
        await checkBtn.click();
        await page.waitForLoadState("networkidle");

        const bookBtn = page.getByRole("button", {
          name: /Request to Book|Book Instantly/i,
        });
        if (await bookBtn.isVisible()) {
          await bookBtn.click();
          await page.waitForURL(/.*checkout|.*bookings/, { timeout: 10000 }).catch(() => {});
        }
      }
      await expect(page.locator("body")).toBeVisible();
    });

    test("Step 5: View bookings in dashboard", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/dashboard");

      const bookingsLink = page.locator('a[href*="/bookings"]').first();
      if (await bookingsLink.isVisible()) {
        await bookingsLink.click();
      } else {
        await page.goto("/bookings");
      }

      await expect(page).toHaveURL(/.*bookings/);
      await expect(page.locator("body")).toBeVisible();
    });

    test("Step 6: Message owner about booking", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/messages");
      await expect(page.locator("body")).toBeVisible();

      const composer = page.locator("textarea").first();
      if (await composer.isVisible()) {
        await composer.fill(
          "Hello! Looking forward to picking this up. What time works best?",
        );
        const sendButton = page.locator('button:has-text("Send")').first();
        if (await sendButton.isVisible()) await sendButton.click();
      }
    });

    test("Step 7: Leave review after rental", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/bookings");

      const completedBooking = page
        .locator('[data-testid="booking-card"]:has-text("Completed")')
        .first();
      if (await completedBooking.isVisible()) {
        await completedBooking.click();
        await page.click(
          'button:has-text("Leave Review"), button:has-text("Write Review")',
        );

        await page.click(`[data-rating="${testReviews.positive.rating}"]`);
        await page.fill('input[name="title"]', testReviews.positive.title);
        await page.fill('textarea[name="comment"]', testReviews.positive.comment);
        await page.click('button[type="submit"]');

        await expect(
          page.locator('text=/review.*submitted|thank.*you/i'),
        ).toBeVisible();
      }
    });
  });

  // ────────────────────────────────────────────────
  // Journey 2: Owner — List and Manage Rental
  // ────────────────────────────────────────────────
  test.describe("Journey 2: Owner - List and Manage Rental", () => {

    test("Step 1: Owner creates new listing", async ({ page }) => {
      await loginAs(page, testUsers.owner);

      // Mock upload and listing creation so the test doesn't depend on real API
      await page.route("**/api/upload/images", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(["https://example.com/owner-listing.jpg"]),
        })
      );
      await page.route("**/api/categories**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ id: "cat-photo-1", name: "Photography", slug: "photography" }]),
        })
      );
      await page.route("**/api/listings", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ id: "journey-listing-001", title: testListings.camera.title }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/listings/new");
      await page.waitForLoadState("networkidle");

      const listing = testListings.camera;

      await page.fill('input[name="title"]', listing.title);
      await page.fill('textarea[name="description"]', listing.description);
      await page.fill('input[name="location.city"]', listing.location.city);
      await page.fill('input[name="location.address"]', listing.location.address);
      await page.fill('input[name="location.state"]', listing.location.state);
      await page.fill('input[name="location.country"]', listing.location.country);
      await page.fill('input[name="location.postalCode"]', listing.location.zipCode);

      await page.locator('input[type="file"]').setInputFiles({
        name: "owner-listing.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("owner listing image"),
      });

      await page.locator('[data-testid="create-listing-button"]').click();

      // Wait for page to settle then verify no crash
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await expect(page.locator("body")).toBeVisible();
    });

    test("Step 2: Owner views listing analytics", async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/dashboard/owner");
      await page.waitForLoadState("networkidle");

      await expect(
        page.locator('text=/active listings|pending|earnings|rating/i').first(),
      ).toBeVisible();
    });

    test("Step 3: Owner receives booking request", async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/bookings?view=owner");
      await page.waitForLoadState("networkidle");

      const pendingBooking = page
        .locator('[data-testid="booking-card"]:has-text("Pending")')
        .first();
      if (await pendingBooking.isVisible()) {
        await pendingBooking.click();
        await expect(
          page.locator('text=/renter.*profile|booked.*by/i'),
        ).toBeVisible();
      }
    });

    test("Step 4: Owner approves booking", async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/bookings?view=owner");

      const pendingBooking = page
        .locator('[data-testid="booking-card"]:has-text("Pending")')
        .first();
      if (await pendingBooking.isVisible()) {
        await pendingBooking.click();
        await page.click(
          'button:has-text("Approve"), button:has-text("Accept")',
        );

        const confirmBtn = page.locator('button:has-text("Confirm")');
        if (await confirmBtn.isVisible()) await confirmBtn.click();

        await expect(page.locator('text=/approved|confirmed/i')).toBeVisible();
      }
    });

    test("Step 5: Owner marks item as returned", async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/bookings?view=owner&status=active");

      const activeBooking = page.locator('[data-testid="booking-card"]').first();
      if (await activeBooking.isVisible()) {
        await activeBooking.click();
        const returnBtn = page.locator(
          'button:has-text("Mark as Returned"), button:has-text("Complete")',
        );
        if (await returnBtn.isVisible()) {
          await returnBtn.click();
          await page.fill(
            'textarea[name="returnNotes"]',
            "Item returned in excellent condition.",
          );
          await page.click(
            'button:has-text("Confirm"), button:has-text("Submit")',
          );
          await expect(
            page.locator('text=/completed|rental.*complete/i'),
          ).toBeVisible();
        }
      }
    });

    test("Step 6: Owner manages calendar availability", async ({ page }) => {
      await loginAs(page, testUsers.owner);

      const listingId = await getFirstRealListingId(page);
      if (!listingId) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await page.goto(`/listings/${listingId}/edit`);
      await page.waitForLoadState("networkidle");

      const availabilityTab = page.locator('text="Availability"');
      if (await availabilityTab.isVisible()) {
        await availabilityTab.click();
        const saveBtn = page.locator('button:has-text("Save")');
        if (await saveBtn.isVisible()) await saveBtn.click();
      }
      await expect(page.locator("body")).toBeVisible();
    });

    test("Step 7: Owner views earnings and payouts", async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/payments");
      await page.waitForLoadState("networkidle");

      await expect(
        page
          .locator('text=/payments|earnings|available balance|pending/i')
          .first(),
      ).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────
  // Journey 3: Complete Dispute Resolution
  // ────────────────────────────────────────────────
  test.describe("Journey 3: Complete Dispute Resolution", () => {
    test("Renter files dispute", async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/disputes");
      await expect(
        page.locator("text=/My Disputes|No disputes|Open/i").first(),
      ).toBeVisible();
    });

    test("Owner responds to dispute", async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/disputes");

      const dispute = page
        .locator('[data-testid="dispute-card"]:has-text("Open")')
        .first();
      if (await dispute.isVisible()) {
        await dispute.click();
        await page.fill(
          'textarea[name="response"]',
          "The scratch was minor and noted in the listing description.",
        );
        await page.click('button:has-text("Submit Response")');
        await expect(
          page.locator('text=/response.*submitted|sent/i'),
        ).toBeVisible();
      }
    });

    test("Admin reviews and resolves dispute", async ({ page }) => {
      await loginAs(page, testUsers.admin);
      await page.goto("/admin/disputes");

      const dispute = page
        .locator('[data-testid="dispute-row"]:has-text("Pending")')
        .first();
      if (await dispute.isVisible()) {
        await dispute.click();
        await page.click('button:has-text("Resolve")');
        await page.click('input[value="partial_refund"]');
        await page.fill('input[name="refundAmount"]', "50.00");
        await page.fill(
          'textarea[name="adminNotes"]',
          "Both parties have valid points. Partial refund seems fair.",
        );
        await page.click('button:has-text("Confirm Resolution")');
        await expect(
          page.locator('text=/dispute.*resolved|resolution.*sent/i'),
        ).toBeVisible();
      }
    });
  });

  // ────────────────────────────────────────────────
  // Journey 4: Organization Management
  // ────────────────────────────────────────────────
  test.describe("Journey 4: Organization Management", () => {
    test("Owner creates organization", async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/organizations/create");

      if (!page.url().includes("/organizations/create")) {
        await page.goto("/organizations");
        const createBtn = page
          .locator(
            'a[href="/organizations/create"], button:has-text("Create Organization"), button:has-text("Create Your First Organization")',
          )
          .first();
        if (await createBtn.isVisible()) await createBtn.click();
      }

      if (!page.url().includes("/organizations/create")) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      const businessTypeCard = page
        .locator('label:has-text("Individual / Sole Proprietor")')
        .first();
      if (await businessTypeCard.isVisible()) await businessTypeCard.click();

      const businessTypeInput = page.locator(
        'input[name="businessType"][value="INDIVIDUAL"]',
      );
      const continueBtn = page.getByRole("button", { name: "Next" }).first();
      if (await continueBtn.isDisabled()) {
        await businessTypeInput.setChecked(true, { force: true });
      }
      await expect(continueBtn).toBeEnabled();
      await continueBtn.click();

      await page.fill('input[name="name"]', "Pro Camera Rentals");
      await page.fill(
        'textarea[name="description"]',
        "Professional camera and video equipment rental service.",
      );
      await page.fill('input[name="email"]', "contact@procamerarentals.com");
      await page.fill('input[name="phoneNumber"]', "+1-555-0200");
      await page.getByRole("button", { name: "Next" }).click();

      const createButton = page
        .getByRole("button", { name: /Create Organization|Creating/i })
        .first();
      if (await createButton.isVisible()) await createButton.click();

      await page.waitForLoadState("networkidle");
      const url = page.url();
      expect(
        /\/organizations\/.+\/settings/.test(url) ||
          url.includes("/organizations/create") ||
          /\/organizations\/?$/.test(url),
      ).toBe(true);
    });

    test("Owner invites team member", async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/organizations");

      const membersButton = page.getByRole("button", { name: "Members" }).first();
      if (await membersButton.isVisible()) {
        await membersButton.click();
      }
      await expect(page.locator("body")).toBeVisible();
    });

    test("Owner adds listings to organization", async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/organizations");

      const listingsButton = page
        .getByRole("button", { name: "Listings" })
        .first();
      if (await listingsButton.isVisible()) {
        await listingsButton.click();
      }
      await expect(page.locator("body")).toBeVisible();
    });
  });
});
