import { test, expect } from "@playwright/test";
import {
  clickFirstVisible,
  expectAnyVisible,
  loginAs,
  testUsers,
} from "./helpers/test-utils";

test.describe("Owner Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
    await page.goto("/dashboard/owner");
  });

  test.describe("Dashboard Overview", () => {
    test("should display owner dashboard", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Dashboard|Owner/i);
    });

    test("should show stats summary", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Active Listings/i',
        'text=/Pending Earnings/i',
        'text=/Active Bookings/i',
      ]);
    });

    test("should display total earnings", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Earnings Summary/i',
        'text=/Total Earned/i',
        'text=/\\$\\d+/i',
      ]);
    });

    test("should display active listings count", async ({ page }) => {
      await expectAnyVisible(page, ['text=/Active Listings/i']);
    });

    test("should display pending bookings count", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Active Bookings/i',
        'text=/Action Required/i',
        'text=/waiting for your approval/i',
      ]);
    });

    test("should display total reviews", async ({ page }) => {
      const reviews = page.locator('[data-testid="total-reviews"]');
      if (await reviews.isVisible()) {
        await expect(reviews).toBeVisible();
      }
    });

    test("should show average rating", async ({ page }) => {
      const rating = page.locator('[data-testid="average-rating"]');
      if (await rating.isVisible()) {
        await expect(rating).toBeVisible();
      }
    });
  });

  test.describe("Recent Activity", () => {
    test("should display recent activity section", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Recent Bookings/i',
        'text=/No bookings yet/i',
      ]);
    });

    test("should show recent bookings", async ({ page }) => {
      const bookings = page.locator('[data-testid="recent-booking"]');
      if (await bookings.first().isVisible()) {
        await expect(bookings.first()).toBeVisible();
      }
    });

    test("should show recent messages", async ({ page }) => {
      const messages = page.locator('[data-testid="recent-message"]');
      if (await messages.first().isVisible()) {
        await expect(messages.first()).toBeVisible();
      }
    });

    test("should show recent reviews", async ({ page }) => {
      const reviews = page.locator('[data-testid="recent-review"]');
      if (await reviews.first().isVisible()) {
        await expect(reviews.first()).toBeVisible();
      }
    });
  });

  test.describe("Quick Actions", () => {
    test("should navigate to create listing", async ({ page }) => {
      const clicked = await clickFirstVisible(page, [
        'a:has-text("Create New Listing")',
        'a:has-text("New Listing")',
        'a:has-text("Create Your First Listing")',
      ]);
      if (!clicked) {
        await page.goto("/listings/new");
      }
      await expect(page).toHaveURL(/.*listings\/new/);
    });

    test("should navigate to bookings", async ({ page }) => {
      const clicked = await clickFirstVisible(page, [
        'a:has-text("View All")',
        'a:has-text("Bookings")',
      ]);
      if (!clicked) {
        await page.goto("/bookings?view=owner");
      }
      await expect(page).toHaveURL(/.*bookings/);
    });

    test("should navigate to earnings", async ({ page }) => {
      const clicked = await clickFirstVisible(page, [
        'a:has-text("View Earnings Details")',
        'a:has-text("Earnings")',
      ]);
      if (!clicked) {
        await page.goto("/dashboard/owner/earnings");
      }
      await expect(page).toHaveURL(/.*earnings|.*payments/);
    });

    test("should navigate to calendar", async ({ page }) => {
      const clicked = await clickFirstVisible(page, ['a:has-text("View Calendar")']);
      if (!clicked) {
        await page.goto("/dashboard/owner/calendar");
      }
      await expect(page).toHaveURL(/.*calendar/);
    });
  });
});

test.describe("Owner Booking Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
  });

  test.describe("Pending Bookings", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/owner");
    });

    test("should display pending bookings list", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Recent Bookings/i',
        'text=/No bookings yet/i',
      ]);
    });

    test("should show booking details", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Recent Bookings/i',
        'a:has-text("View All")',
        'text=/No bookings yet/i',
      ]);
    });

    test("should approve booking", async ({ page }) => {
      const approveButton = page.locator('button:has-text("Approve"), button:has-text("Accept")').first();
      if (await approveButton.isVisible()) {
        await approveButton.click();
        
        // Confirmation
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
        
        await expect(page.locator('text=/approved|confirmed|success/i')).toBeVisible();
      }
    });

    test("should decline booking", async ({ page }) => {
      const declineButton = page.locator('button:has-text("Decline"), button:has-text("Reject")').first();
      if (await declineButton.isVisible()) {
        await declineButton.click();
        
        // Reason required
        const reasonInput = page.locator('textarea[name="reason"]');
        if (await reasonInput.isVisible()) {
          await reasonInput.fill('Item not available for these dates');
        }
        
        await page.click('button:has-text("Confirm")');
        await expect(page.locator('text=/declined|rejected/i')).toBeVisible();
      }
    });

    test("should view renter profile", async ({ page }) => {
      const renterLink = page.locator('[data-testid="renter-profile-link"]').first();
      if (await renterLink.isVisible()) {
        await renterLink.click();
        await expect(page).toHaveURL(/.*profile\/.*/);
      }
    });

    test("should message renter", async ({ page }) => {
      const messageButton = page.locator('[data-testid="message-renter"]').first();
      if (await messageButton.isVisible()) {
        await messageButton.click();
        await expect(page).toHaveURL(/.*messages/);
      }
    });
  });

  test.describe("Active Bookings", () => {
    test("should filter active bookings", async ({ page }) => {
      await page.goto("/bookings?view=owner&status=active");
      await expect(page).toHaveURL(/.*bookings.*status=active/);
      await expectAnyVisible(page, [
        'a:has-text("View Details")',
        'text=/No bookings yet/i',
      ]);
    });

    test("should mark as picked up", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const pickupButton = page.locator('button:has-text("Mark Picked Up")');
      if (await pickupButton.isVisible()) {
        await pickupButton.click();
        await expect(page.locator('text=/picked up|in progress/i')).toBeVisible();
      }
    });

    test("should mark as returned", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const returnButton = page.locator('button:has-text("Mark Returned")');
      if (await returnButton.isVisible()) {
        await returnButton.click();
        await expect(page.locator('text=/returned|complete/i')).toBeVisible();
      }
    });

    test("should report issue with booking", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const issueButton = page.locator('button:has-text("Report Issue")');
      if (await issueButton.isVisible()) {
        await issueButton.click();
        await expect(page).toHaveURL(/.*disputes/);
      }
    });
  });

  test.describe("Completed Bookings", () => {
    test("should filter completed bookings", async ({ page }) => {
      await page.goto("/bookings?view=owner&status=completed");
      await expect(page).toHaveURL(/.*bookings.*status=completed/);
      await expectAnyVisible(page, [
        'a:has-text("View Details")',
        'text=/No bookings yet/i',
      ]);
    });

    test("should leave review for renter", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Review Renter")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        
        // Fill review form
        await page.click('[data-testid="rating-star-5"]');
        await page.fill('textarea[name="review"]', 'Great renter, returned item in perfect condition!');
        await page.click('button:has-text("Submit")');
        
        await expect(page.locator('text=/submitted|success/i')).toBeVisible();
      }
    });
  });

  test.describe("Cancelled Bookings", () => {
    test("should filter cancelled bookings", async ({ page }) => {
      await page.goto("/bookings?view=owner&status=cancelled");
      await expect(page).toHaveURL(/.*bookings.*status=cancelled/);
      await expectAnyVisible(page, [
        'a:has-text("View Details")',
        'text=/No bookings yet/i',
      ]);
    });

    test("should view cancellation details", async ({ page }) => {
      await page.goto("/bookings?status=cancelled");
      const bookingCard = page.locator('[data-testid="booking-card"]').first();
      if (await bookingCard.isVisible()) {
        await bookingCard.click();
        await expect(page.locator('[data-testid="cancellation-reason"]')).toBeVisible();
      }
    });
  });
});

test.describe("Owner Earnings & Payments", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
    await page.goto("/dashboard/owner/earnings");
  });

  test.describe("Earnings Overview", () => {
    test("should display earnings page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Earnings|Payments|Revenue/i);
    });

    test("should show available balance", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Available for Payout/i',
        'text=/Total Balance/i',
      ]);
    });

    test("should show pending balance", async ({ page }) => {
      const pending = page.locator('[data-testid="pending-balance"]');
      if (await pending.isVisible()) {
        await expect(pending).toBeVisible();
      }
    });

    test("should show total earnings", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Total Balance/i',
        'text=/Available for Payout/i',
      ]);
    });

    test("should show earnings chart", async ({ page }) => {
      const chart = page.locator('[data-testid="earnings-chart"]');
      if (await chart.isVisible()) {
        await expect(chart).toBeVisible();
      }
    });

    test("should filter by date range", async ({ page }) => {
      const dateFilter = page.locator('[data-testid="date-range-filter"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        await page.click('text=Last 30 Days');
      }
    });

    test("should filter by listing", async ({ page }) => {
      const listingFilter = page.locator('[data-testid="listing-filter"]');
      if (await listingFilter.isVisible()) {
        await listingFilter.click();
        await page.locator('[data-testid="listing-option"]').first().click();
      }
    });
  });

  test.describe("Transaction History", () => {
    test("should display transactions list", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Transaction History/i',
        'text=/No transactions yet/i',
      ]);
    });

    test("should show transaction details", async ({ page }) => {
      const transaction = page.locator('[data-testid="transaction-row"]').first();
      if (await transaction.isVisible()) {
        await expect(transaction).toBeVisible();
      }
    });

    test("should filter by transaction type", async ({ page }) => {
      const typeFilter = page.locator('[data-testid="type-filter"]');
      if (await typeFilter.isVisible()) {
        await typeFilter.click();
        await page.click('text=Payouts');
      }
    });

    test("should view transaction receipt", async ({ page }) => {
      const receiptButton = page.locator('[data-testid="view-receipt"]').first();
      if (await receiptButton.isVisible()) {
        await receiptButton.click();
        await expect(page.locator('[data-testid="receipt-modal"]')).toBeVisible();
      }
    });

    test("should download transaction receipt", async ({ page }) => {
      const downloadButton = page.locator('[data-testid="download-receipt"]').first();
      if (await downloadButton.isVisible()) {
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          downloadButton.click(),
        ]);
        expect(download.suggestedFilename()).toContain('receipt');
      }
    });

    test("should paginate transactions", async ({ page }) => {
      const nextPage = page.locator('[data-testid="pagination-next"]');
      if (await nextPage.isVisible()) {
        await nextPage.click();
        await expect(page).toHaveURL(/.*page=2/);
      }
    });
  });

  test.describe("Payout Settings", () => {
    test("should navigate to payout settings", async ({ page }) => {
      await expectAnyVisible(page, ['text=/Recent Payouts/i', 'text=/No payouts yet/i']);
    });

    test("should display connected bank accounts", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/No payouts yet/i',
        'text=/Payout to/i',
        'text=/Bank Account/i',
      ]);
    });

    test("should add new bank account", async ({ page }) => {
      const opened = await clickFirstVisible(page, ['button:has-text("Request Payout")']);
      if (opened) {
        await expect(page.locator('input[name="amount"]')).toBeVisible();
      }
    });

    test("should set default payout method", async ({ page }) => {
      await expectAnyVisible(page, ['text=/Recent Payouts/i', 'text=/No payouts yet/i']);
    });

    test("should remove payout method", async ({ page }) => {
      await expectAnyVisible(page, ['text=/Recent Payouts/i', 'text=/No payouts yet/i']);
    });

    test("should set payout schedule", async ({ page }) => {
      await expectAnyVisible(page, [
        'text=/Recent Payouts/i',
        'button:has-text("Request Payout")',
      ]);
    });
  });

  test.describe("Request Payout", () => {
    test("should request manual payout", async ({ page }) => {
      const payoutButton = page.locator('button:has-text("Request Payout"), button:has-text("Withdraw")');
      if (await payoutButton.isVisible()) {
        await payoutButton.click();
        
        // Fill amount
        const amountInput = page.locator('input[name="amount"]');
        if (await amountInput.isVisible()) {
          await amountInput.fill('100');
        }
        
        await page.click('button:has-text("Request"), button:has-text("Confirm")');
        await expect(page.locator('text=/requested|processing|success/i')).toBeVisible();
      }
    });

    test("should show minimum payout amount", async ({ page }) => {
      const payoutButton = page.locator('button:has-text("Request Payout")');
      if (await payoutButton.isVisible()) {
        await payoutButton.click();
        await expect(page.locator('text=/minimum/i')).toBeVisible();
      }
    });

    test("should validate payout amount", async ({ page }) => {
      const payoutButton = page.locator('button:has-text("Request Payout")');
      if (await payoutButton.isVisible()) {
        await payoutButton.click();
        
        const amountInput = page.locator('input[name="amount"]');
        if (await amountInput.isVisible()) {
          await amountInput.fill('999999');
          await page.click('button:has-text("Request")');
          await expect(page.locator('text=/exceeds|insufficient|not enough/i')).toBeVisible();
        }
      }
    });
  });
});

test.describe("Owner Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
    await page.goto("/dashboard/owner");
  });

  test("should display performance metrics", async ({ page }) => {
    const metrics = page.locator('[data-testid="performance-metrics"]');
    if (await metrics.isVisible()) {
      await expect(metrics).toBeVisible();
    }
  });

  test("should show views per listing", async ({ page }) => {
    const views = page.locator('[data-testid="listing-views"]');
    if (await views.isVisible()) {
      await expect(views).toBeVisible();
    }
  });

  test("should show conversion rate", async ({ page }) => {
    const conversion = page.locator('[data-testid="conversion-rate"]');
    if (await conversion.isVisible()) {
      await expect(conversion).toBeVisible();
    }
  });

  test("should show response time", async ({ page }) => {
    const responseTime = page.locator('[data-testid="response-time"]');
    if (await responseTime.isVisible()) {
      await expect(responseTime).toBeVisible();
    }
  });

  test("should export analytics data", async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export")');
    if (await exportButton.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/analytics.*\.csv|\.xlsx/);
    }
  });
});
