/**
 * Payment Integration Tests (Real Stripe Test Mode)
 * Validates end-to-end payment processing with real Stripe test mode (sk_test_ keys)
 *
 * === STRIPE TEST MODE SETUP ===
 *
 * These tests require Stripe test mode configuration:
 * - STRIPE_SECRET_KEY=sk_test_... (Stripe test secret key)
 * - STRIPE_PUBLISHABLE_KEY=pk_test_... (Stripe test publishable key)
 * - NODE_ENV=test (to enable test environment)
 *
 * The tests use Stripe's official test cards:
 * - 4242424242424242: Successful payment
 * - 4000000000000002: Card declined
 * - 4000000000009995: Insufficient funds
 *
 * See: https://stripe.com/docs/testing#cards
 *
 * @tags @payment @integration @critical
 */

import { test, expect } from '@playwright/test';
import { loginAs, testUsers } from './helpers/test-utils';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3401';

// Conditionally run tests only when Stripe test keys are configured
const hasStripeTestKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
const describeIfStripe = hasStripeTestKey ? test.describe : test.describe.skip;

describeIfStripe('Payment Integration — Real Stripe Test Mode', () => {

  test('Complete booking with real Stripe payment', async ({ page }) => {
    await loginAs(page, testUsers.renter);
    
    // Navigate to search
    await page.goto(`${BASE_URL}/search?query=apartment&location=Kathmandu`);
    await expect(page).toHaveURL(/\/search/);
    
    // Click first listing
    const listing = page.locator('[data-testid="listing-card"]').first();
    await listing.click();
    
    // Open booking panel
    await page.locator('[data-testid="book-now-btn"]').click();
    
    // Select dates
    await page.locator('[data-testid="check-in-date"]').click();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await page.locator(`[data-value="${tomorrowStr}"]`).click();
    
    const checkout = new Date(tomorrow);
    checkout.setDate(checkout.getDate() + 5);
    const checkoutStr = checkout.toISOString().split('T')[0];
    await page.locator(`[data-value="${checkoutStr}"]`).click();
    
    // Proceed to payment
    await page.locator('[data-testid="proceed-payment-btn"]').click();
    
    // Expect Stripe payment form
    await expect(page).toHaveURL(/\/checkout/);
    
    // Fill card details (Stripe test card - succeeds)
    const stripeFrame = page.frameLocator('iframe[name="__stripe"]').first();
    await stripeFrame.locator('[aria-label="Card number"]').fill('4242424242424242');
    await stripeFrame.locator('[aria-label="MM / YY"]').fill('1225');
    await stripeFrame.locator('[aria-label="CVC"]').fill('123');
    
    // Complete payment
    await page.locator('[data-testid="pay-now-btn"]').click();
    
    // Verify success
    await expect(page).toHaveURL(/\/booking\/.+\/confirmation/);
    await expect(page.locator('[data-testid="confirmation-badge"]')).toContainText('Confirmed');
  });

  test('Declined payment shows error message', async ({ page }) => {
    await loginAs(page, testUsers.renter);
    
    // Navigate to checkout
    await page.goto(`${BASE_URL}/checkout`);
    
    // Fill with declined test card
    const stripeFrame = page.frameLocator('iframe[name="__stripe"]').first();
    await stripeFrame.locator('[aria-label="Card number"]').fill('4000000000000002');
    await stripeFrame.locator('[aria-label="MM / YY"]').fill('1225');
    await stripeFrame.locator('[aria-label="CVC"]').fill('123');
    
    // Attempt payment
    await page.locator('[data-testid="pay-now-btn"]').click();
    
    // Verify error
    await expect(page.locator('[data-testid="payment-error"]')).toContainText('Your card was declined');
  });

  test('Payment timeout recovery', async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto(`${BASE_URL}/checkout`);
    
    // Simulate timeout by aborting request
    await page.route('**/api/payments/process', route => {
      setTimeout(() => route.abort('timedout'), 2000);
    });
    
    const stripeFrame = page.frameLocator('iframe[name="__stripe"]').first();
    await stripeFrame.locator('[aria-label="Card number"]').fill('4242424242424242');
    await stripeFrame.locator('[aria-label="MM / YY"]').fill('1225');
    await stripeFrame.locator('[aria-label="CVC"]').fill('123');
    
    await page.locator('[data-testid="pay-now-btn"]').click();
    
    // Should show retry option
    await expect(page.locator('[data-testid="retry-payment-btn"]')).toBeVisible();
    
    // Cancel abort to allow retry
    await page.unroute('**/api/payments/process');
    
    // Retry succeeds
    await page.locator('[data-testid="retry-payment-btn"]').click();
    await expect(page).toHaveURL(/\/booking\/.+\/confirmation/);
  });

  test('Partial refund processing', async ({ page, request }) => {
    await loginAs(page, testUsers.owner);
    
    // Create a test booking with API
    const booking = await request.post('http://localhost:3400/api/bookings', {
      data: {
        listingId: 'test-listing-id',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        guestCount: 2,
        totalAmount: 500,
      },
    });
    
    const bookingId = (await booking.json()).id;
    
    // Reject booking (should trigger refund)
    await page.goto(`${BASE_URL}/bookings/${bookingId}`);
    await page.locator('[data-testid="reject-btn"]').click();
    await page.locator('[data-testid="reject-confirm-btn"]').click();
    
    // Verify refund initiated
    await expect(page.locator('[data-testid="refund-status"]')).toContainText('Processing');
  });

  test('Escrow holds and releases correctly', async ({ page, request }) => {
    // Create booking
    const booking = await request.post('http://localhost:3400/api/bookings', {
      data: {
        listingId: 'test-listing-id',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        guestCount: 2,
      },
    });
    
    const bookingId = (await booking.json()).id;
    
    // Check hold was placed
    const holdRes = await request.get(`http://localhost:3400/api/bookings/${bookingId}/hold`);
    expect(holdRes.ok()).toBeTruthy();
    
    const hold = await holdRes.json();
    expect(hold.status).toBe('HELD');
    expect(hold.amount).toBeGreaterThan(0);
    
    // Complete booking (should release hold)
    await request.patch(`http://localhost:3400/api/bookings/${bookingId}`, {
      data: { status: 'COMPLETED' },
    });
    
    // Verify hold released
    const releaseRes = await request.get(`http://localhost:3400/api/bookings/${bookingId}/hold`);
    const releasedHold = await releaseRes.json();
    expect(releasedHold.status).toBe('RELEASED');
  });
});
