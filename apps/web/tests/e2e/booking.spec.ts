import { test, expect } from "@playwright/test";

/**
 * Booking E2E Tests
 * Tests complete booking flow from search to confirmation
 */

test.describe("Booking Flow", () => {
  test.use({ storageState: "tests/fixtures/auth.json" }); // Use authenticated state

  test("should complete full booking flow @smoke", async ({ page }) => {
    // 1. Search for listing
    await page.goto("/search");
    await page.waitForSelector('[data-testid="listing-card"]');

    // 2. Select listing
    await page.click('[data-testid="listing-card"]');
    await expect(page).toHaveURL(/.*listings\/[a-z0-9-]+/);

    // 3. Select dates
    await page.click('[data-testid="check-in-date"]');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.click(`[data-date="${tomorrow.toISOString().split("T")[0]}"]`);

    await page.click('[data-testid="check-out-date"]');
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 3);
    await page.click(`[data-date="${dayAfter.toISOString().split("T")[0]}"]`);

    // 4. Proceed to booking
    await page.click('button:has-text("Book Now")');
    await expect(page).toHaveURL(/.*bookings\/new/);

    // 5. Fill booking details
    await page.fill('textarea[name="notes"]', "Test booking notes");

    // 6. Proceed to payment
    await page.click('button:has-text("Continue to Payment")');

    // 7. Fill payment details (test mode)
    await page.fill('input[name="cardNumber"]', "4242424242424242");
    await page.fill('input[name="expiry"]', "12/25");
    await page.fill('input[name="cvc"]', "123");

    // 8. Confirm booking
    await page.click('button:has-text("Confirm Booking")');

    // 9. Verify confirmation
    await expect(page).toHaveURL(/.*bookings\/[a-z0-9-]+\/confirmation/);
    await expect(page.locator("text=/Booking Confirmed/i")).toBeVisible();
  });

  test("should show booking summary", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Select dates
    await page.click('[data-testid="check-in-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');
    await page.click('[data-testid="check-out-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');

    await page.click('button:has-text("Book Now")');

    // Should show booking summary
    await expect(page.locator('[data-testid="booking-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="subtotal"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-fee"]')).toBeVisible();
    await expect(page.locator('[data-testid="total"]')).toBeVisible();
  });

  test("should validate booking dates", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Try to book past dates
    await page.click('[data-testid="check-in-date"]');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Past dates should be disabled
    const pastDate = page.locator(
      `[data-date="${yesterday.toISOString().split("T")[0]}"]`
    );
    await expect(pastDate).toHaveAttribute("disabled", "");
  });

  test("should prevent double booking", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Select already booked dates (if any)
    await page.click('[data-testid="check-in-date"]');

    // Booked dates should be disabled
    const bookedDates = await page
      .locator('[data-testid="calendar-day"][data-booked="true"]')
      .count();
    if (bookedDates > 0) {
      const bookedDate = page
        .locator('[data-testid="calendar-day"][data-booked="true"]')
        .first();
      await expect(bookedDate).toHaveAttribute("disabled", "");
    }
  });

  test("should apply discount code", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Select dates and proceed
    await page.click('[data-testid="check-in-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');
    await page.click('[data-testid="check-out-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');
    await page.click('button:has-text("Book Now")');

    // Apply discount code
    await page.fill('input[name="discountCode"]', "TEST10");
    await page.click('button:has-text("Apply")');

    // Should show discount applied
    await expect(page.locator('[data-testid="discount-amount"]')).toBeVisible();
  });

  test("should show cancellation policy", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Should show cancellation policy
    await expect(
      page.locator('[data-testid="cancellation-policy"]')
    ).toBeVisible();
  });

  test("should handle payment errors", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Complete booking flow
    await page.click('[data-testid="check-in-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');
    await page.click('[data-testid="check-out-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');
    await page.click('button:has-text("Book Now")');
    await page.click('button:has-text("Continue to Payment")');

    // Use declined card
    await page.fill('input[name="cardNumber"]', "4000000000000002");
    await page.fill('input[name="expiry"]', "12/25");
    await page.fill('input[name="cvc"]', "123");
    await page.click('button:has-text("Confirm Booking")');

    // Should show error
    await expect(page.locator("text=/Payment failed/i")).toBeVisible();
  });

  test("should save booking to user account", async ({ page }) => {
    // Complete a booking
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');
    await page.click('[data-testid="check-in-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');
    await page.click('[data-testid="check-out-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');
    await page.click('button:has-text("Book Now")');
    await page.click('button:has-text("Continue to Payment")');
    await page.fill('input[name="cardNumber"]', "4242424242424242");
    await page.fill('input[name="expiry"]', "12/25");
    await page.fill('input[name="cvc"]', "123");
    await page.click('button:has-text("Confirm Booking")');

    // Navigate to bookings
    await page.goto("/bookings");

    // Should show the booking
    await expect(page.locator('[data-testid="booking-card"]')).toHaveCount({
      min: 1,
    });
  });

  test("should send confirmation email", async ({ page }) => {
    // This would require email testing setup
    // For now, just verify the confirmation page shows email sent message
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');
    await page.click('[data-testid="check-in-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');
    await page.click('[data-testid="check-out-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');
    await page.click('button:has-text("Book Now")');
    await page.click('button:has-text("Continue to Payment")');
    await page.fill('input[name="cardNumber"]', "4242424242424242");
    await page.fill('input[name="expiry"]', "12/25");
    await page.fill('input[name="cvc"]', "123");
    await page.click('button:has-text("Confirm Booking")');

    // Should mention email confirmation
    await expect(page.locator("text=/confirmation email/i")).toBeVisible();
  });
});
