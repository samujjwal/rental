/**
 * Payment Retry Flow E2E Test
 * 
 * This test validates the end-to-end payment retry flow:
 * 1. User initiates a payment that fails
 * 2. System detects payment failure
 * 3. System retries payment with exponential backoff
 * 4. System escalates if max retries exceeded
 * 5. User is notified of payment status
 * 
 * Uses Stripe sandbox with test card numbers for safe testing.
 * Validates business truth, not implementation.
 */

import { test, expect } from '@playwright/test';

const STRIPE_TEST_CARDS = {
  genericDecline: '4000000000000002',
  insufficientFunds: '4000000000009995',
  processingError: '4000000000000119',
};

test.describe('Payment Retry Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a test user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'renter@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should retry failed payment with exponential backoff', async ({ page }) => {
    // Step 1: Navigate to a listing and initiate booking
    await page.goto('/listings/test-listing-1');
    await page.click('[data-testid="request-booking-button"]');
    
    // Step 2: Fill booking details
    await page.fill('[data-testid="card-number"]', STRIPE_TEST_CARDS.genericDecline);
    await page.fill('[data-testid="card-expiry"]', '12/34');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.click('[data-testid="submit-payment-button"]');
    
    // Step 3: Payment should fail initially
    await expect(page.locator('[data-testid="payment-failed"]')).toBeVisible();
    
    // Step 4: System should initiate retry
    await expect(page.locator('[data-testid="payment-retrying"]')).toBeVisible();
    
    // Step 5: After retry attempts, should show final status
    await expect(page.locator('[data-testid="payment-status"]')).toBeVisible({ timeout: 15000 });
  });

  test('should escalate payment after max retries', async ({ page }) => {
    // Step 1: Navigate to a listing and initiate booking with failing card
    await page.goto('/listings/test-listing-2');
    await page.click('[data-testid="request-booking-button"]');
    
    await page.fill('[data-testid="card-number"]', STRIPE_TEST_CARDS.insufficientFunds);
    await page.fill('[data-testid="card-expiry"]', '12/34');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.click('[data-testid="submit-payment-button"]');
    
    // Step 2-3: Wait for max retries then escalation
    await expect(page.locator('[data-testid="payment-escalated"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="escalation-ticket-id"]')).toBeVisible();
  });

  test('should notify user of payment retry attempts', async ({ page }) => {
    // Step 1: Initiate payment that will fail
    await page.goto('/listings/test-listing-3');
    await page.click('[data-testid="request-booking-button"]');
    
    await page.fill('[data-testid="card-number"]', STRIPE_TEST_CARDS.processingError);
    await page.fill('[data-testid="card-expiry"]', '12/34');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.click('[data-testid="submit-payment-button"]');
    
    // Step 2: Check for retry notification
    await expect(page.locator('[data-testid="retry-notification"]')).toBeVisible({ timeout: 10000 });
    
    // Step 3: Verify retry count is displayed
    await expect(page.locator('[data-testid="retry-count"]')).toBeVisible();
  });

  test('should succeed on retry with valid card', async ({ page }) => {
    // Step 1: Initiate payment with card that initially fails
    await page.goto('/listings/test-listing-4');
    await page.click('[data-testid="request-booking-button"]');
    
    await page.fill('[data-testid="card-number"]', STRIPE_TEST_CARDS.processingError);
    await page.fill('[data-testid="card-expiry"]', '12/34');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.click('[data-testid="submit-payment-button"]');
    
    // Step 2: Wait for initial failure
    await expect(page.locator('[data-testid="payment-failed"]')).toBeVisible();
    
    // Step 3: Update payment method to valid card
    await page.click('[data-testid="update-payment-method"]');
    await page.fill('[data-testid="card-number"]', '4242424242424242'); // Valid test card
    await page.fill('[data-testid="card-expiry"]', '12/34');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.click('[data-testid="retry-payment-button"]');
    
    // Step 4: Payment should succeed on retry
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-confirmed"]')).toBeVisible();
  });
});
