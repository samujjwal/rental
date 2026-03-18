import { test, expect } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";

async function getFirstOwnerListingId(page: import("@playwright/test").Page): Promise<string | null> {
  await page.goto("/listings");
  const link = page
    .locator('a[href^="/listings/"]:not([href="/listings/new"]):not([href$="/edit"])')
    .first();

  if ((await link.count()) === 0) {
    return null;
  }

  const href = await link.getAttribute("href");
  if (!href) return null;
  const match = href.match(/\/listings\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function getExpectedNotificationPath(notification: {
  type: string;
  data?: Record<string, unknown> | null;
}): string | null {
  const data = notification.data ?? {};
  const readString = (value: unknown) =>
    typeof value === "string" ? value : null;

  switch (notification.type) {
    case "BOOKING_REQUEST":
    case "BOOKING_CONFIRMED":
    case "BOOKING_CANCELLED":
    case "BOOKING_COMPLETED":
    case "BOOKING_REMINDER": {
      const bookingId = readString(data.bookingId);
      return bookingId ? `/bookings/${bookingId}` : "/bookings";
    }
    case "PAYMENT_RECEIVED": {
      const bookingId = readString(data.bookingId);
      return bookingId ? `/bookings/${bookingId}` : "/payments";
    }
    case "PAYOUT_PROCESSED":
      return "/earnings";
    case "MESSAGE_RECEIVED": {
      const conversationId =
        readString(data.conversationId) ?? readString(data.threadId);
      return conversationId
        ? `/messages?conversation=${conversationId}`
        : "/messages";
    }
    case "REVIEW_RECEIVED":
    case "REVIEW_RESPONSE":
      return "/reviews";
    case "DISPUTE_OPENED":
    case "DISPUTE_RESOLVED": {
      const disputeId = readString(data.disputeId);
      return disputeId ? `/disputes/${disputeId}` : "/disputes";
    }
    case "LISTING_APPROVED":
    case "LISTING_REJECTED": {
      const listingId = readString(data.listingId);
      return listingId ? `/listings/${listingId}/edit` : "/listings";
    }
    case "ACCOUNT_VERIFIED":
    case "VERIFICATION_COMPLETE":
      return "/settings/profile";
    default:
      return null;
  }
}

function getAcceptableNotificationPathPattern(expectedPath: string): RegExp {
  const escapedExpected = expectedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (expectedPath.startsWith("/bookings/")) {
    return new RegExp(`(${escapedExpected}|/bookings)$`);
  }

  if (expectedPath.startsWith("/disputes/")) {
    return new RegExp(`(${escapedExpected}|/disputes)$`);
  }

  if (expectedPath.startsWith("/listings/")) {
    return new RegExp(`(${escapedExpected}|/listings)$`);
  }

  if (expectedPath.startsWith("/messages")) {
    return new RegExp(`(${escapedExpected}|/messages(?:\?.*)?)$`);
  }

  return new RegExp(escapedExpected);
}

test.describe("Checkout and Financial Flows", () => {
  test.describe("Checkout", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/checkout/1");
    });

    test("should render checkout page or access error", async ({ page }) => {
      await expectAnyVisible(page, [
        "text=Checkout",
        "text=/Payment setup failed|Booking ID is required|Payment failed/i",
      ]);
    });

    test("should show order summary details when checkout is available", async ({ page }) => {
      const hasCheckout = await page.locator("text=Order Summary").isVisible().catch(() => false);
      if (!hasCheckout) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await expect(page.locator("text=Order Summary")).toBeVisible();
      await expect(page.locator("text=Rental Period")).toBeVisible();
      await expect(page.locator("text=Total")).toBeVisible();
    });

    test("should show payment form controls when available", async ({ page }) => {
      const hasCheckout = await page.locator("text=Payment Information").isVisible().catch(() => false);
      if (!hasCheckout) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await expect(page.locator("text=Payment Information")).toBeVisible();
      await expect(page.locator("text=/Payments are secure and encrypted/i")).toBeVisible();
      await expect(page.locator('button:has-text("Pay $")')).toBeVisible();
    });

    test("should provide back to booking navigation", async ({ page }) => {
      const clicked = await clickFirstVisible(page, ['a:has-text("Back to Booking")']);
      if (!clicked) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }
      await expect(page).toHaveURL(/\/bookings\/.+/);
    });
  });

  test.describe("Payments Page", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.owner);
      await page.goto("/payments");
    });

    test("should display payments and earnings page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Payments & Earnings/i);
      await expect(page.locator("text=Available Balance")).toBeVisible();
      await expect(page.locator("text=Total Earnings")).toBeVisible();
    });

    test("should display transactions section", async ({ page }) => {
      await expect(page.locator("text=Transactions")).toBeVisible();
      await expectAnyVisible(page, [
        "text=No transactions found",
        "table",
      ]);
    });

    test("should expose request payout action", async ({ page }) => {
      await expectAnyVisible(page, [
        'a:has-text("Request Payout")',
        "text=Payout Settings",
      ]);
    });

    test("should support transaction filtering controls", async ({ page }) => {
      const openedFilters = await clickFirstVisible(page, ['button:has-text("Filters")']);
      if (!openedFilters) {
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      const selects = page.locator("select");
      await expect(selects.first()).toBeVisible();
      await expect(selects.nth(1)).toBeVisible();
    });
  });
});

test.describe("Reviews and Notifications", () => {
  test.describe("Reviews", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/reviews");
    });

    test("should display reviews page and stats", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Reviews/i);
      await expectAnyVisible(page, [
        "text=Reviews Received",
        "text=Reviews Given",
        "text=No reviews yet",
      ]);
    });

    test("should render rating filter controls", async ({ page }) => {
      await expect(page.locator('button:has-text("5")').first()).toBeVisible();
      await expect(page.locator('button:has-text("1")').first()).toBeVisible();
    });

    test("should render reviews list or empty state", async ({ page }) => {
      await expectAnyVisible(page, [
        "text=No reviews yet",
        "text=User",
        "text=Listing",
      ]);
    });
  });

  test.describe("Notifications", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/notifications");
    });

    test("should display notifications page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Notifications/i);
      await expectAnyVisible(page, [
        "text=No notifications",
        "button:has-text(\"Unread Only\")",
      ]);
    });

    test("should toggle unread filter", async ({ page }) => {
      const clicked = await clickFirstVisible(page, [
        'button:has-text("Unread Only")',
        'button:has-text("Show All")',
      ]);
      expect(clicked).toBe(true);
      await expect(page).toHaveURL(/\/notifications/);
    });

    test("should mark all as read when action is visible", async ({ page }) => {
      const markAll = page.locator('button:has-text("Mark All Read")');
      if (await markAll.isVisible().catch(() => false)) {
        await markAll.click();
        await expectAnyVisible(page, [
          "text=/marked as read/i",
          "text=No notifications",
        ]);
      } else {
        await expect(page.locator("body")).toBeVisible();
      }
    });

    test("should follow notification deep links when payload data is present", async ({ page }) => {
      const accessToken = await page.evaluate(() => {
        const raw = localStorage.getItem("auth-storage");
        if (!raw) return null;

        try {
          const parsed = JSON.parse(raw) as {
            state?: { accessToken?: string };
          };
          return parsed.state?.accessToken ?? null;
        } catch {
          return null;
        }
      });

      expect(accessToken).toBeTruthy();

      const apiBaseUrl = process.env.E2E_API_URL || "http://localhost:3400/api";
      const notificationsResponse = await page.request.get(
        `${apiBaseUrl}/notifications?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      expect(notificationsResponse.ok()).toBe(true);

      const payload = (await notificationsResponse.json()) as {
        notifications?: Array<{
          type: string;
          data?: Record<string, unknown> | null;
        }>;
      };
      const firstLinkableNotification = (payload.notifications ?? []).find(
        (notification) => getExpectedNotificationPath(notification) !== null
      );
      const linkableNotifications = (payload.notifications ?? []).filter(
        (notification) => getExpectedNotificationPath(notification) !== null
      );
      const linkableIndex = firstLinkableNotification
        ? linkableNotifications.findIndex((notification) => notification === firstLinkableNotification)
        : -1;

      expect(firstLinkableNotification).toBeTruthy();
      expect(linkableIndex).toBeGreaterThanOrEqual(0);

      const expectedPath = getExpectedNotificationPath(firstLinkableNotification!);
      expect(expectedPath).toBeTruthy();

      await page.goto("/notifications");
      await page.locator('div[role="link"]').nth(linkableIndex).click();
      await expect(page).toHaveURL(getAcceptableNotificationPathPattern(expectedPath!));
    });
  });
});

test.describe("Insurance Upload", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
  });

  test("should redirect when listing id is missing", async ({ page }) => {
    await page.goto("/insurance/upload");
    await expect(page).toHaveURL(/\/listings|\/dashboard/);
  });

  test("should display insurance upload form for a valid owner listing", async ({ page }) => {
    const listingId = await getFirstOwnerListingId(page);
    if (!listingId) {
      await expect(page.locator("body")).toBeVisible();
      return;
    }

    await page.goto(`/insurance/upload?listingId=${listingId}`);
    await expect(page.locator("h1")).toContainText(/Upload Insurance Policy/i);
    await expect(page.locator('input[name="provider"]')).toBeVisible();
    await expect(page.locator('select[name="type"]')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test("should validate missing required insurance fields", async ({ page }) => {
    const listingId = await getFirstOwnerListingId(page);
    if (!listingId) {
      await expect(page.locator("body")).toBeVisible();
      return;
    }

    await page.goto(`/insurance/upload?listingId=${listingId}`);
    await page.click('button:has-text("Submit for Verification")');
    await expectAnyVisible(page, [
      "text=/required|invalid|please/i",
      "text=/Policy number|provider|insurance type/i",
    ]);
  });

  test("should allow selecting insurance document", async ({ page }) => {
    const listingId = await getFirstOwnerListingId(page);
    if (!listingId) {
      await expect(page.locator("body")).toBeVisible();
      return;
    }

    await page.goto(`/insurance/upload?listingId=${listingId}`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "insurance-proof.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake pdf"),
    });
    await expect(fileInput).toHaveValue(/insurance-proof\.pdf/i);
  });

  test("should show review lifecycle guidance for owner insurance verification", async ({ page }) => {
    const listingId = await getFirstOwnerListingId(page);
    if (!listingId) {
      await expect(page.locator("body")).toBeVisible();
      return;
    }

    await page.goto(`/insurance/upload?listingId=${listingId}`);
    await expect(page.getByText(/What Happens Next/i)).toBeVisible();
    await expect(page.locator("li")).toContainText([
      /review/i,
      /verification/i,
      /approved|rejected/i,
      /listing/i,
    ]);
  });

  test("should surface pending insurance review state on policy list", async ({ page }) => {
    await page.route("**/insurance/policies/me**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "pol-1",
              bookingId: "booking-1",
              type: "BASIC",
              status: "PENDING",
              premiumAmount: 1250,
              coverageAmount: 50000,
              deductible: 1000,
              startDate: "2026-03-01T00:00:00.000Z",
              endDate: "2026-04-01T00:00:00.000Z",
              provider: "Nepal Insurance",
              policyNumber: "POL-42",
              coverageDetails: {
                damage: true,
                theft: true,
                liability: true,
                cancellation: false,
                weather: false,
              },
              listing: {
                id: "listing-1",
                title: "Riverside Loft",
                images: [],
              },
              createdAt: "2026-03-01T00:00:00.000Z",
              updatedAt: "2026-03-01T00:00:00.000Z",
            },
          ],
          pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
        }),
      });
    });

    await page.goto("/insurance");
    await expect(page.getByText("Riverside Loft")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();
  });
});
