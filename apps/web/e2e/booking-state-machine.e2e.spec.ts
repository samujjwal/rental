import { test, expect } from '@playwright/test';

test.describe('Booking State Machine E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a test user
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'owner@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display booking state machine on booking details page', async ({ page }) => {
    // Navigate to a booking details page
    await page.goto('/bookings/test-booking-id');
    
    // Wait for the booking state machine to load
    await expect(page.locator('h2:has-text("Booking Progress")')).toBeVisible();
    
    // Check if the state machine component is rendered
    await expect(page.locator('[data-testid="booking-state-machine"]')).toBeVisible();
  });

  test('should show correct state for pending approval booking', async ({ page }) => {
    // Navigate to a pending booking
    await page.goto('/bookings/pending-booking-id');
    
    // Should show "Requested" as current state
    await expect(page.locator('text=Requested')).toBeVisible();
    
    // Should show approve/reject buttons for owner
    await expect(page.locator('button:has-text("Approve")')).toBeVisible();
    await expect(page.locator('button:has-text("Reject")')).toBeVisible();
  });

  test('should show correct state for confirmed booking', async ({ page }) => {
    // Navigate to a confirmed booking
    await page.goto('/bookings/confirmed-booking-id');
    
    // Should show "Confirmed" as current state
    await expect(page.locator('text=Confirmed')).toBeVisible();
    
    // Should show start rental button for owner
    await expect(page.locator('button:has-text("Start Rental")')).toBeVisible();
  });

  test('should show correct state for in-progress booking', async ({ page }) => {
    // Navigate to an in-progress booking
    await page.goto('/bookings/in-progress-booking-id');
    
    // Should show "Active" as current state
    await expect(page.locator('text=Active')).toBeVisible();
    
    // Should show request return button for renter
    await expect(page.locator('button:has-text("Request Return")')).toBeVisible();
  });

  test('should show correct state for completed booking', async ({ page }) => {
    // Navigate to a completed booking
    await page.goto('/bookings/completed-booking-id');
    
    // Should show "Completed" as current state
    await expect(page.locator('text=Completed')).toBeVisible();
    
    // Should show leave review button for renter
    await expect(page.locator('button:has-text("Leave Review")')).toBeVisible();
  });

  test('should handle state transitions correctly', async ({ page }) => {
    // Start with a pending booking
    await page.goto('/bookings/pending-booking-id');
    
    // Click approve button
    await page.click('button:has-text("Approve")');
    
    // Should show confirmation dialog
    await expect(page.locator('dialog')).toBeVisible();
    
    // Confirm approval
    await page.click('button:has-text("Confirm")');
    
    // Wait for state to update
    await page.waitForTimeout(1000);
    
    // Should now be in confirmed state
    await expect(page.locator('text=Confirmed')).toBeVisible();
  });

  test('should show cancelled state alert', async ({ page }) => {
    // Navigate to a cancelled booking
    await page.goto('/bookings/cancelled-booking-id');
    
    // Should show cancelled alert
    await expect(page.locator('text=Booking Cancelled')).toBeVisible();
    await expect(page.locator('text=This booking has been cancelled.')).toBeVisible();
  });

  test('should show disputed state alert', async ({ page }) => {
    // Navigate to a disputed booking
    await page.goto('/bookings/disputed-booking-id');
    
    // Should show disputed alert
    await expect(page.locator('text=Dispute in Progress')).toBeVisible();
    await expect(page.locator('text=This booking is currently under dispute resolution.')).toBeVisible();
  });

  test('should handle payment action for renter', async ({ page }) => {
    // Login as renter
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'renter@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to a booking pending payment
    await page.goto('/bookings/pending-payment-booking-id');
    
    // Should show pay now button
    await expect(page.locator('button:has-text("Pay Now")')).toBeVisible();
    
    // Click pay now button
    await page.click('button:has-text("Pay Now")');
    
    // Should navigate to checkout
    await expect(page).toHaveURL(/\/checkout\/.*/);
  });

  test('should show different actions based on user role', async ({ page }) => {
    // Login as owner
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'owner@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to a confirmed booking
    await page.goto('/bookings/confirmed-booking-id');
    
    // Should show owner-specific actions
    await expect(page.locator('button:has-text("Start Rental")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    
    // Should not show renter-specific actions
    await expect(page.locator('button:has-text("Request Return")')).not.toBeVisible();
  });

  test('should display state progression correctly', async ({ page }) => {
    // Navigate to a booking with multiple completed steps
    await page.goto('/bookings/in-progress-booking-id');
    
    // Should show completed steps
    await expect(page.locator('[data-testid="step-requested"].completed')).toBeVisible();
    await expect(page.locator('[data-testid="step-payment"].completed')).toBeVisible();
    await expect(page.locator('[data-testid="step-confirmed"].completed')).toBeVisible();
    
    // Should show current step
    await expect(page.locator('[data-testid="step-active"].current')).toBeVisible();
    
    // Should show pending steps
    await expect(page.locator('[data-testid="step-completed"].pending')).toBeVisible();
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Navigate to a booking that doesn't exist
    await page.goto('/bookings/non-existent-booking');
    
    // Should show error boundary
    await expect(page.locator('text=Something went wrong')).toBeVisible();
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to booking details
    await page.goto('/bookings/confirmed-booking-id');
    
    // Should show mobile-optimized layout
    await expect(page.locator('[data-testid="booking-state-machine"]')).toBeVisible();
    
    // Should show stacked layout on mobile
    const stateSteps = page.locator('[data-testid="state-step"]');
    const firstStep = stateSteps.first();
    await expect(firstStep).toHaveCSS('flex-direction', 'column');
  });

  test('should handle real-time updates', async ({ page }) => {
    // Navigate to a booking
    await page.goto('/bookings/pending-booking-id');
    
    // Simulate real-time update via WebSocket (mock)
    await page.evaluate(() => {
      // Mock WebSocket message
      window.postMessage({
        type: 'booking_update',
        data: {
          bookingId: 'pending-booking-id',
          status: 'confirmed',
          previousStatus: 'PENDING_OWNER_APPROVAL'
        }
      }, '*');
    });
    
    // Should show toast notification
    await expect(page.locator('text=Booking pending-booking-id has been confirmed!')).toBeVisible();
    
    // Should update UI state
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Confirmed')).toBeVisible();
  });

  test('should handle accessibility', async ({ page }) => {
    // Navigate to booking details
    await page.goto('/bookings/confirmed-booking-id');
    
    // Check ARIA labels
    await expect(page.locator('[aria-label="Booking Progress"]')).toBeVisible();
    
    // Check keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('button:focus')).toBeVisible();
    
    // Check screen reader support
    const bookingProgress = page.locator('[data-testid="booking-state-machine"]');
    await expect(bookingProgress).toHaveAttribute('role', 'region');
  });
});
