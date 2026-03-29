/**
 * PW-CHECKOUT-001: Complete Checkout Flow with Stripe Elements
 * End-to-end browser test for payment processing
 *
 * Tests the full checkout flow including:
 * - Booking summary review
 * - Stripe Elements integration
 * - Payment confirmation
 * - Success/error handling
 */
import { test, expect } from '@playwright/test';
import { getTestUser, loginUser, createTestListing, cleanupTestData } from './helpers/test-utils';

test.describe('Checkout Payment Flow', () => {
  let hostUser: any;
  let renterUser: any;
  let listingId: string;

  test.beforeAll(async () => {
    // Setup test data
    hostUser = await getTestUser('HOST');
    renterUser = await getTestUser('USER');
    listingId = await createTestListing(hostUser.id, {
      title: 'Checkout Test Listing',
      basePrice: 100,
      cleaningFee: 50,
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('should complete checkout with valid card', async ({ page }) => {
    // 1. Login as renter
    await loginUser(page, renterUser.email, renterUser.password);

    // 2. Navigate to listing
    await page.goto(`/listings/${listingId}`);
    await expect(page.locator('h1')).toContainText('Checkout Test Listing');

    // 3. Select dates
    await page.click('[data-testid="date-picker-start"]');
    // Select date 7 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const day = futureDate.getDate();
    await page.click(`text=${day}`);

    // Select end date (3 days later)
    const endDate = new Date(futureDate);
    endDate.setDate(endDate.getDate() + 3);
    const endDay = endDate.getDate();
    await page.click(`text=${endDay}`);

    // 4. Click book now
    await page.click('[data-testid="book-now-button"]');

    // 5. Verify redirect to checkout
    await expect(page).toHaveURL(/.*checkout.*/);

    // 6. Verify booking summary
    await expect(page.locator('[data-testid="booking-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="nights-count"]')).toContainText('3');
    await expect(page.locator('[data-testid="base-price"]')).toContainText('$300');
    await expect(page.locator('[data-testid="cleaning-fee"]')).toContainText('$50');

    // 7. Fill Stripe card details in iframe
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    await stripeFrame.locator('[name="exp-date"]').fill('12/25');
    await stripeFrame.locator('[name="cvc"]').fill('123');
    await stripeFrame.locator('[name="postal"]').fill('12345');

    // 8. Submit payment
    await page.click('[data-testid="confirm-payment-button"]');

    // 9. Wait for processing
    await expect(page.locator('[data-testid="payment-processing"]')).toBeVisible();

    // 10. Verify success
    await expect(page).toHaveURL(/.*booking-confirmation.*/);
    await expect(page.locator('[data-testid="confirmation-message"]')).toContainText('Booking Confirmed');
    await expect(page.locator('[data-testid="booking-reference"]')).toBeVisible();
  });

  test('should handle declined card', async ({ page }) => {
    await loginUser(page, renterUser.email, renterUser.password);

    // Navigate and select dates
    await page.goto(`/listings/${listingId}`);
    await page.click('[data-testid="date-picker-start"]');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    await page.click(`text=${futureDate.getDate()}`);
    const endDate = new Date(futureDate);
    endDate.setDate(endDate.getDate() + 2);
    await page.click(`text=${endDate.getDate()}`);

    await page.click('[data-testid="book-now-button"]');
    await expect(page).toHaveURL(/.*checkout.*/);

    // Fill declined card (generic decline)
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();
    await stripeFrame.locator('[name="cardnumber"]').fill('4000000000000002');
    await stripeFrame.locator('[name="exp-date"]').fill('12/25');
    await stripeFrame.locator('[name="cvc"]').fill('123');
    await stripeFrame.locator('[name="postal"]').fill('12345');

    // Submit
    await page.click('[data-testid="confirm-payment-button"]');

    // Verify error message
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-error"]')).toContainText('declined');

    // Verify still on checkout page (can retry)
    await expect(page).toHaveURL(/.*checkout.*/);
  });

  test('should handle 3D Secure challenge', async ({ page }) => {
    await loginUser(page, renterUser.email, renterUser.password);

    // Navigate and select dates
    await page.goto(`/listings/${listingId}`);
    await page.click('[data-testid="date-picker-start"]');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 21);
    await page.click(`text=${futureDate.getDate()}`);
    const endDate = new Date(futureDate);
    endDate.setDate(endDate.getDate() + 2);
    await page.click(`text=${endDate.getDate()}`);

    await page.click('[data-testid="book-now-button"]');

    // Fill card that triggers 3D Secure
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();
    await stripeFrame.locator('[name="cardnumber"]').fill('4000002500003155');
    await stripeFrame.locator('[name="exp-date"]').fill('12/25');
    await stripeFrame.locator('[name="cvc"]').fill('123');

    await page.click('[data-testid="confirm-payment-button"]');

    // Handle 3D Secure modal
    const secureFrame = page.frameLocator('iframe[name*="__stripe"]');
    await secureFrame.locator('text=Complete').click();

    // Verify success after 3D Secure
    await expect(page).toHaveURL(/.*booking-confirmation.*/);
  });

  test('should preserve form data on error', async ({ page }) => {
    await loginUser(page, renterUser.email, renterUser.password);

    await page.goto(`/listings/${listingId}`);
    await page.click('[data-testid="date-picker-start"]');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 28);
    await page.click(`text=${futureDate.getDate()}`);

    await page.click('[data-testid="book-now-button"]');

    // Fill invalid card (expired)
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    await stripeFrame.locator('[name="exp-date"]').fill('01/20'); // Expired
    await stripeFrame.locator('[name="cvc"]').fill('123');

    await page.click('[data-testid="confirm-payment-button"]');

    // Verify error
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();

    // Form should still have card number (convenience for retry)
    const cardValue = await stripeFrame.locator('[name="cardnumber"]').inputValue();
    expect(cardValue).toContain('4242');
  });

  test('should display price breakdown correctly', async ({ page }) => {
    await loginUser(page, renterUser.email, renterUser.password);

    await page.goto(`/listings/${listingId}`);
    await page.click('[data-testid="date-picker-start"]');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 35);
    await page.click(`text=${futureDate.getDate()}`);
    const endDate = new Date(futureDate);
    endDate.setDate(endDate.getDate() + 5); // 5 nights
    await page.click(`text=${endDay}`);

    await page.click('[data-testid="book-now-button"]');

    // Verify detailed price breakdown
    await expect(page.locator('[data-testid="price-breakdown"]')).toBeVisible();
    await expect(page.locator('[data-testid="nightly-rate"]')).toContainText('$100');
    await expect(page.locator('[data-testid="nights-count"]')).toContainText('5');
    await expect(page.locator('[data-testid="subtotal"]')).toContainText('$500');
    await expect(page.locator('[data-testid="cleaning-fee"]')).toContainText('$50');
    await expect(page.locator('[data-testid="service-fee"]')).toContainText('$'); // Has value
    await expect(page.locator('[data-testid="total"]')).toContainText('$');
  });

  test('should handle saved payment methods', async ({ page }) => {
    // Assuming user has saved payment method
    await loginUser(page, renterUser.email, renterUser.password);

    await page.goto(`/listings/${listingId}`);
    await page.click('[data-testid="date-picker-start"]');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 42);
    await page.click(`text=${futureDate.getDate()}`);

    await page.click('[data-testid="book-now-button"]');

    // Should show saved cards section
    const savedCards = page.locator('[data-testid="saved-payment-methods"]');
    
    if (await savedCards.isVisible().catch(() => false)) {
      // Select first saved card
      await savedCards.locator('[data-testid="select-card"]').first().click();
      
      // Submit without entering new card details
      await page.click('[data-testid="confirm-payment-button"]');
      
      // Should process successfully
      await expect(page).toHaveURL(/.*booking-confirmation.*/);
    }
  });

  test('should validate required fields', async ({ page }) => {
    await loginUser(page, renterUser.email, renterUser.password);

    await page.goto(`/listings/${listingId}`);
    await page.click('[data-testid="date-picker-start"]');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 49);
    await page.click(`text=${futureDate.getDate()}`);

    await page.click('[data-testid="book-now-button"]');

    // Try to submit without filling card details
    await page.click('[data-testid="confirm-payment-button"]');

    // Should show validation error
    await expect(page.locator('[data-testid="card-error"]')).toBeVisible();
    await expect(page).toHaveURL(/.*checkout.*/); // Still on checkout
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await loginUser(page, renterUser.email, renterUser.password);

    await page.goto(`/listings/${listingId}`);
    await page.click('[data-testid="date-picker-start"]');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 56);
    await page.click(`text=${futureDate.getDate()}`);

    await page.click('[data-testid="book-now-button"]');

    // Fill valid card
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    await stripeFrame.locator('[name="exp-date"]').fill('12/25');
    await stripeFrame.locator('[name="cvc"]').fill('123');

    // Simulate network failure
    await page.route('**/api/v1/payments/**', (route) => {
      route.abort('failed');
    });

    await page.click('[data-testid="confirm-payment-button"]');

    // Should show network error
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });
});
