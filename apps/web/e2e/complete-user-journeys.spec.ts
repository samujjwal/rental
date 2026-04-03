import { test, expect } from '@playwright/test';

/**
 * ULTRA-STRICT: Complete User Journey E2E Tests (Phase 3)
 * 
 * These tests validate complete user journeys from end-to-end
 * with real data flows and business logic validation.
 */

test.describe('Complete User Journey E2E', () => {
  
  test.describe('Renter Journey: Search to Booking Completion', () => {
    test('complete renter booking journey', async ({ page }) => {
      // Step 1: Search and discovery
      await page.goto('/search');
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      
      // Apply filters
      await page.fill('[data-testid="location-input"]', 'Kathmandu');
      await page.click('[data-testid="search-button"]');
      
      // Verify results load
      await expect(page.locator('[data-testid="listing-card"]').first()).toBeVisible();
      
      // Step 2: View listing details
      await page.click('[data-testid="listing-card"]');
      await expect(page.locator('[data-testid="listing-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="price-display"]')).toBeVisible();
      
      // Step 3: Check availability
      await page.fill('[data-testid="start-date"]', '2026-04-15');
      await page.fill('[data-testid="end-date"]', '2026-04-18');
      await page.click('[data-testid="check-availability"]');
      
      await expect(page.locator('[data-testid="availability-status"]')).toContainText('Available');
      
      // Step 4: Add to favorites
      await page.click('[data-testid="favorite-button"]');
      await expect(page.locator('[data-testid="favorite-button"]')).toHaveAttribute('aria-pressed', 'true');
      
      // Step 5: Start booking process
      await page.click('[data-testid="book-now-button"]');
      await expect(page.url()).toContain('/checkout');
      
      // Step 6: Review booking details
      await expect(page.locator('[data-testid="booking-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="price-breakdown"]')).toBeVisible();
      
      // Step 7: Complete payment (mock)
      await page.fill('[data-testid="card-number"]', '4242424242424242');
      await page.fill('[data-testid="card-expiry"]', '12/30');
      await page.fill('[data-testid="card-cvc"]', '123');
      await page.click('[data-testid="pay-button"]');
      
      // Step 8: Verify confirmation
      await expect(page.locator('[data-testid="booking-confirmation"]')).toBeVisible();
      await expect(page.locator('[data-testid="booking-id"]')).toBeVisible();
    });

    test('renter journey with payment failure recovery', async ({ page }) => {
      // Navigate to checkout
      await page.goto('/checkout/test-booking-id');
      
      // Attempt payment with declined card
      await page.fill('[data-testid="card-number"]', '4000000000000002');
      await page.fill('[data-testid="card-expiry"]', '12/30');
      await page.fill('[data-testid="card-cvc"]', '123');
      await page.click('[data-testid="pay-button"]');
      
      // Verify error displayed
      await expect(page.locator('[data-testid="payment-error"]')).toContainText('declined');
      
      // Retry with valid card
      await page.fill('[data-testid="card-number"]', '4242424242424242');
      await page.click('[data-testid="pay-button"]');
      
      // Verify success
      await expect(page.locator('[data-testid="booking-confirmation"]')).toBeVisible();
    });
  });

  test.describe('Owner Journey: Listing Creation to First Booking', () => {
    test('complete owner onboarding and listing creation', async ({ page }) => {
      // Step 1: Login as owner
      await page.goto('/auth/login');
      await page.fill('[data-testid="email"]', 'owner@test.com');
      await page.fill('[data-testid="password"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      await expect(page).toHaveURL('/dashboard');
      
      // Step 2: Navigate to listing creation
      await page.click('[data-testid="create-listing-button"]');
      await expect(page).toHaveURL('/listings/new');
      
      // Step 3: Fill listing details
      await page.fill('[data-testid="listing-title"]', 'Beautiful Apartment in Kathmandu');
      await page.fill('[data-testid="listing-description"]', 'Spacious 2-bedroom apartment');
      await page.selectOption('[data-testid="listing-category"]', 'HOMES_SPACES');
      
      // Step 4: Set location
      await page.fill('[data-testid="address"]', 'Thamel, Kathmandu');
      await page.click('[data-testid="verify-location"]');
      await expect(page.locator('[data-testid="map-preview"]')).toBeVisible();
      
      // Step 5: Upload photos
      const fileInput = page.locator('[data-testid="photo-upload"]');
      await fileInput.setInputFiles([
        './test-assets/photo1.jpg',
        './test-assets/photo2.jpg',
      ]);
      await expect(page.locator('[data-testid="uploaded-photo"]').first()).toBeVisible();
      
      // Step 6: Set pricing
      await page.fill('[data-testid="base-price"]', '150');
      await page.fill('[data-testid="cleaning-fee"]', '25');
      
      // Step 7: Set availability
      await page.click('[data-testid="availability-calendar"]');
      await page.click('[data-testid="set-available"]');
      
      // Step 8: Publish listing
      await page.click('[data-testid="publish-button"]');
      await expect(page.locator('[data-testid="listing-published"]')).toBeVisible();
      
      // Step 9: View in search results
      await page.goto('/search?location=Kathmandu');
      await expect(page.locator('text=Beautiful Apartment in Kathmandu')).toBeVisible();
    });

    test('owner manages bookings and payouts', async ({ page }) => {
      // Login and navigate to owner dashboard
      await page.goto('/dashboard/owner');
      
      // View bookings calendar
      await expect(page.locator('[data-testid="bookings-calendar"]')).toBeVisible();
      
      // Approve a pending booking request
      await page.click('[data-testid="booking-request-card"]');
      await expect(page.locator('[data-testid="booking-details"]')).toBeVisible();
      
      await page.click('[data-testid="approve-booking-button"]');
      await expect(page.locator('[data-testid="booking-approved"]')).toBeVisible();
      
      // View earnings
      await page.click('[data-testid="earnings-tab"]');
      await expect(page.locator('[data-testid="earnings-summary"]')).toBeVisible();
      
      // Request payout
      await page.click('[data-testid="request-payout-button"]');
      await expect(page.locator('[data-testid="payout-requested"]')).toBeVisible();
    });
  });

  test.describe('Dispute Resolution Journey', () => {
    test('renter files dispute → admin resolves', async ({ page }) => {
      // Login as renter
      await page.goto('/bookings');
      
      // Navigate to completed booking
      await page.click('[data-testid="completed-booking"]');
      
      // File dispute
      await page.click('[data-testid="file-dispute-button"]');
      await expect(page).toHaveURL(/\/disputes\/new/);
      
      // Fill dispute details
      await page.selectOption('[data-testid="dispute-type"]', 'PROPERTY_DAMAGE');
      await page.fill('[data-testid="dispute-description"]', 'Damaged furniture found');
      
      // Upload evidence
      const fileInput = page.locator('[data-testid="evidence-upload"]');
      await fileInput.setInputFiles('./test-assets/damage-photo.jpg');
      
      // Submit dispute
      await page.click('[data-testid="submit-dispute-button"]');
      await expect(page.locator('[data-testid="dispute-submitted"]')).toBeVisible();
      
      // Admin side: View dispute
      await page.goto('/admin/disputes');
      await expect(page.locator('[data-testid="dispute-list"]')).toContainText('PROPERTY_DAMAGE');
      
      // Admin investigates
      await page.click('[data-testid="dispute-row"]');
      await expect(page.locator('[data-testid="evidence-review"]')).toBeVisible();
      
      // Admin resolves
      await page.selectOption('[data-testid="resolution-type"]', 'PARTIAL_REFUND');
      await page.fill('[data-testid="refund-amount"]', '100');
      await page.click('[data-testid="resolve-button"]');
      
      await expect(page.locator('[data-testid="dispute-resolved"]')).toBeVisible();
    });
  });

  test.describe('Admin Operations', () => {
    test('admin moderates content and manages platform', async ({ page }) => {
      // Login as admin
      await page.goto('/admin');
      
      // View analytics
      await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
      
      // Review listings for moderation
      await page.click('[data-testid="listings-tab"]');
      await page.click('[data-testid="flagged-listing"]');
      
      // Moderate listing
      await page.click('[data-testid="reject-listing"]');
      await page.fill('[data-testid="moderation-reason"]', 'Inappropriate content');
      await page.click('[data-testid="confirm-rejection"]');
      
      await expect(page.locator('[data-testid="listing-rejected"]')).toBeVisible();
      
      // System diagnostics
      await page.click('[data-testid="system-tab"]');
      await expect(page.locator('[data-testid="system-health"]')).toBeVisible();
    });
  });
});
