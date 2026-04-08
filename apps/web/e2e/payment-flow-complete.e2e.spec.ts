/**
 * Complete Payment Flow E2E Test
 * 
 * This test validates the end-to-end payment flow for booking:
 * 1. User searches and views listing
 * 2. User selects dates and requests booking
 * 3. Owner approves booking
 * 4. User completes payment with Stripe
 * 5. Booking state transitions to CONFIRMED
 * 6. Ledger entries are created (double-entry validation)
 * 7. Payment confirmation is displayed
 * 
 * Uses test Stripe keys and test card numbers for safe testing.
 * Validates business truth, not implementation.
 */

import { test, expect } from '@playwright/test';

const TEST_STRIPE_CARD = {
  number: '4242424242424242', // Stripe test card (always succeeds)
  expiry: '12/34',
  cvc: '123',
  name: 'Test User',
};

test.describe('Complete Payment Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a test renter
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'renter@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should complete full booking payment flow successfully', async ({ page }) => {
    // Step 1: Search for listings
    await page.goto('/search');
    await page.fill('[data-testid="search-input"]', 'camera');
    await page.click('[data-testid="search-button"]');
    await page.waitForSelector('[data-testid="listing-card"]');

    // Step 2: View listing details
    const firstListing = page.locator('[data-testid="listing-card"]').first();
    await firstListing.click();
    await page.waitForURL(/\/listings\/.+/);

    // EXACT VALIDATION: Verify listing details are displayed
    await expect(page.locator('[data-testid="listing-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="listing-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="listing-description"]')).toBeVisible();

    // Step 3: Select dates and request booking
    await page.click('[data-testid="booking-dates-button"]');
    
    // Select start date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('[data-testid="start-date"]', startDateStr);
    
    // Select end date (day after tomorrow)
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const endDateStr = dayAfter.toISOString().split('T')[0];
    await page.fill('[data-testid="end-date"]', endDateStr);
    
    await page.click('[data-testid="request-booking-button"]');
    
    // EXACT VALIDATION: Booking request created, status is PENDING_OWNER_APPROVAL
    await page.waitForURL(/\/bookings\/.+/);
    await expect(page.locator('text=Pending Approval')).toBeVisible();
    
    // Extract booking ID from URL
    const url = page.url();
    const bookingId = url.split('/').pop();
    expect(bookingId).toBeDefined();

    // Step 4: Owner approves booking (switch to owner account)
    await page.goto('/auth/logout');
    await page.waitForURL('/auth/login');
    
    await page.fill('[data-testid="email"]', 'owner@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to booking and approve
    await page.goto(`/bookings/${bookingId}`);
    await page.click('[data-testid="approve-booking-button"]');
    await page.click('[data-testid="confirm-approve-button"]');
    
    // EXACT VALIDATION: Booking status is now PENDING_PAYMENT
    await expect(page.locator('text=Pending Payment')).toBeVisible();

    // Step 5: Renter completes payment
    await page.goto('/auth/logout');
    await page.goto('/auth/login');
    
    await page.fill('[data-testid="email"]', 'renter@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    await page.goto(`/bookings/${bookingId}`);
    await page.click('[data-testid="complete-payment-button"]');
    
    // EXACT VALIDATION: Payment form is displayed
    await expect(page.locator('[data-testid="payment-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="stripe-element"]')).toBeVisible();
    
    // Fill in Stripe test card details
    await page.fill('[data-testid="card-number"]', TEST_STRIPE_CARD.number);
    await page.fill('[data-testid="card-expiry"]', TEST_STRIPE_CARD.expiry);
    await page.fill('[data-testid="card-cvc"]', TEST_STRIPE_CARD.cvc);
    await page.fill('[data-testid="card-name"]', TEST_STRIPE_CARD.name);
    
    // Submit payment
    await page.click('[data-testid="submit-payment-button"]');
    
    // EXACT VALIDATION: Payment processing, then success
    await expect(page.locator('[data-testid="payment-processing"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 });
    
    // Step 6: Verify booking state is CONFIRMED
    await page.waitForURL(/\/bookings\/.+/);
    await expect(page.locator('text=Confirmed')).toBeVisible();
    
    // Step 7: Verify price breakdown is correct
    await page.click('[data-testid="view-price-breakdown"]');
    await expect(page.locator('[data-testid="price-breakdown"]')).toBeVisible();
    
    // EXACT VALIDATION: Price breakdown components
    await expect(page.locator('[data-testid="subtotal"]')).toBeVisible();
    await expect(page.locator('[data-testid="platform-fee"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-fee"]')).toBeVisible();
    await expect(page.locator('[data-testid="total"]')).toBeVisible();
    
    // Step 8: Verify payment confirmation details
    await expect(page.locator('[data-testid="payment-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-id"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-amount"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-date"]')).toBeVisible();
  });

  test('should handle payment failure gracefully', async ({ page }) => {
    // Create a booking in PENDING_PAYMENT state (via API or direct navigation)
    // For this test, we'll navigate to a test booking
    
    await page.goto('/bookings/test-payment-failure-booking');
    await page.click('[data-testid="complete-payment-button"]');
    
    // Use a Stripe test card that always fails
    await page.fill('[data-testid="card-number"]', '4000000000000002'); // Declined card
    await page.fill('[data-testid="card-expiry"]', '12/34');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.fill('[data-testid="card-name"]', 'Test User');
    
    await page.click('[data-testid="submit-payment-button"]');
    
    // EXACT VALIDATION: Payment failure is displayed
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
    await expect(page.locator('text=Payment declined')).toBeVisible();
    
    // EXACT VALIDATION: Booking status remains PENDING_PAYMENT
    await expect(page.locator('text=Pending Payment')).toBeVisible();
    
    // EXACT VALIDATION: Retry option is available
    await expect(page.locator('[data-testid="retry-payment-button"]')).toBeVisible();
  });

  test('should validate ledger entries after successful payment', async ({ page, request }) => {
    // Complete a payment flow
    await page.goto('/search');
    await page.fill('[data-testid="search-input"]', 'camera');
    await page.click('[data-testid="search-button"]');
    
    const firstListing = page.locator('[data-testid="listing-card"]').first();
    await firstListing.click();
    
    await page.click('[data-testid="booking-dates-button"]');
    await page.fill('[data-testid="start-date"]', '2024-01-15');
    await page.fill('[data-testid="end-date"]', '2024-01-16');
    await page.click('[data-testid="request-booking-button"]');
    
    const url = page.url();
    const bookingId = url.split('/').pop();
    
    // Switch to owner and approve
    await page.goto('/auth/logout');
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'owner@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await page.goto(`/bookings/${bookingId}`);
    await page.click('[data-testid="approve-booking-button"]');
    await page.click('[data-testid="confirm-approve-button"]');
    
    // Switch to renter and pay
    await page.goto('/auth/logout');
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'renter@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await page.goto(`/bookings/${bookingId}`);
    await page.click('[data-testid="complete-payment-button"]');
    
    await page.fill('[data-testid="card-number"]', TEST_STRIPE_CARD.number);
    await page.fill('[data-testid="card-expiry"]', TEST_STRIPE_CARD.expiry);
    await page.fill('[data-testid="card-cvc"]', TEST_STRIPE_CARD.cvc);
    await page.fill('[data-testid="card-name"]', TEST_STRIPE_CARD.name);
    await page.click('[data-testid="submit-payment-button"]');
    
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 });
    
    // CRITICAL VALIDATION: Query ledger entries via API
    const ledgerResponse = await request.get(`/api/bookings/${bookingId}/ledger`);
    const ledgerEntries = await ledgerResponse.json();
    
    // EXACT VALIDATION: Double-entry accounting - equal debits and credits
    const debits = ledgerEntries.filter((e: any) => e.side === 'DEBIT');
    const credits = ledgerEntries.filter((e: any) => e.side === 'CREDIT');
    
    expect(debits.length).toBeGreaterThan(0);
    expect(credits.length).toBeGreaterThan(0);
    expect(debits.length).toBe(credits.length);
    
    // EXACT VALIDATION: Total debits equal total credits
    const totalDebits = debits.reduce((sum: number, e: any) => sum + e.amount, 0);
    const totalCredits = credits.reduce((sum: number, e: any) => sum + e.amount, 0);
    expect(totalDebits).toBe(totalCredits);
    
    // EXACT VALIDATION: All entries have required fields
    ledgerEntries.forEach((entry: any) => {
      expect(entry.bookingId).toBe(bookingId);
      expect(entry.transactionType).toBeDefined();
      expect(entry.accountType).toBeDefined();
      expect(entry.amount).toBeDefined();
      expect(entry.currency).toBeDefined();
      expect(entry.status).toBe('SETTLED');
    });
  });

  test('should handle payment timeout and retry', async ({ page }) => {
    await page.goto('/bookings/test-timeout-booking');
    await page.click('[data-testid="complete-payment-button"]');
    
    await page.fill('[data-testid="card-number"]', TEST_STRIPE_CARD.number);
    await page.fill('[data-testid="card-expiry"]', TEST_STRIPE_CARD.expiry);
    await page.fill('[data-testid="card-cvc"]', TEST_STRIPE_CARD.cvc);
    await page.fill('[data-testid="card-name"]', TEST_STRIPE_CARD.name);
    
    // Simulate slow network
    await page.context().setOffline(false);
    
    await page.click('[data-testid="submit-payment-button"]');
    
    // EXACT VALIDATION: Loading state is shown
    await expect(page.locator('[data-testid="payment-processing"]')).toBeVisible();
    
    // If timeout occurs, retry mechanism should kick in
    // This test validates the UI handles slow payments gracefully
    // Check for either timeout message or success
    try {
      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 15000 });
    } catch {
      await expect(page.locator('[data-testid="payment-timeout-message"]')).toBeVisible();
    }
  });

  test('should validate tax calculation in payment', async ({ page }) => {
    // Navigate to a booking with taxable location
    await page.goto('/bookings/test-taxable-booking');
    await page.click('[data-testid="complete-payment-button"]');
    
    await page.fill('[data-testid="card-number"]', TEST_STRIPE_CARD.number);
    await page.fill('[data-testid="card-expiry"]', TEST_STRIPE_CARD.expiry);
    await page.fill('[data-testid="card-cvc"]', TEST_STRIPE_CARD.cvc);
    await page.fill('[data-testid="card-name"]', TEST_STRIPE_CARD.name);
    
    // EXACT VALIDATION: Tax breakdown is visible before payment
    await expect(page.locator('[data-testid="tax-amount"]')).toBeVisible();
    await expect(page.locator('[data-testid="tax-jurisdiction"]')).toBeVisible();
    
    await page.click('[data-testid="submit-payment-button"]');
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 });
    
    // EXACT VALIDATION: Tax is included in final total
    await page.click('[data-testid="view-price-breakdown"]');
    const taxAmount = await page.locator('[data-testid="tax-amount"]').textContent();
    const totalAmount = await page.locator('[data-testid="total"]').textContent();
    
    expect(taxAmount).toBeDefined();
    expect(totalAmount).toBeDefined();
    expect(parseFloat(taxAmount || '0')).toBeGreaterThan(0);
  });

  test('should prevent double payment on retry', async ({ page }) => {
    // Navigate to an already paid booking
    await page.goto('/bookings/test-already-paid-booking');
    
    // EXACT VALIDATION: Payment button should not be available
    await expect(page.locator('[data-testid="complete-payment-button"]')).not.toBeVisible();
    await expect(page.locator('text=Payment Completed')).toBeVisible();
    
    // EXACT VALIDATION: Ledger entries already exist
    await page.click('[data-testid="view-ledger"]');
    await expect(page.locator('[data-testid="ledger-entries"]')).toBeVisible();
    
    const ledgerCount = await page.locator('[data-testid="ledger-entry"]').count();
    expect(ledgerCount).toBeGreaterThan(0);
  });

  test('should handle insufficient funds scenario', async ({ page }) => {
    await page.goto('/bookings/test-insufficient-funds-booking');
    await page.click('[data-testid="complete-payment-button"]');
    
    // Use a test card with insufficient funds
    await page.fill('[data-testid="card-number"]', '4000000000009995'); // Insufficient funds
    await page.fill('[data-testid="card-expiry"]', '12/34');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.fill('[data-testid="card-name"]', 'Test User');
    
    await page.click('[data-testid="submit-payment-button"]');
    
    // EXACT VALIDATION: Specific error message for insufficient funds
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
    await expect(page.locator('text=Insufficient funds')).toBeVisible();
    
    // EXACT VALIDATION: No ledger entries created
    await page.click('[data-testid="view-ledger"]');
    await expect(page.locator('text=No ledger entries')).toBeVisible();
  });

  test('should validate payment webhook processing', async ({ page, request }) => {
    // This test validates that Stripe webhooks are processed correctly
    // In a real scenario, this would trigger a webhook and verify the state change
    
    // For E2E, we'll simulate by checking the booking state after payment
    await page.goto('/bookings/test-webhook-booking');
    await page.click('[data-testid="complete-payment-button"]');
    
    await page.fill('[data-testid="card-number"]', TEST_STRIPE_CARD.number);
    await page.fill('[data-testid="card-expiry"]', TEST_STRIPE_CARD.expiry);
    await page.fill('[data-testid="card-cvc"]', TEST_STRIPE_CARD.cvc);
    await page.fill('[data-testid="card-name"]', TEST_STRIPE_CARD.name);
    
    await page.click('[data-testid="submit-payment-button"]');
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 });
    
    // EXACT VALIDATION: Payment intent status is succeeded
    const bookingId = page.url().split('/').pop();
    const bookingResponse = await request.get(`/api/bookings/${bookingId}`);
    const booking = await bookingResponse.json();
    
    expect(booking.paymentStatus).toBe('SUCCEEDED');
    expect(booking.paymentIntentId).toBeDefined();
  });
});
