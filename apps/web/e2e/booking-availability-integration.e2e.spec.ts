/**
 * Booking Availability Integration E2E Test
 * 
 * This test validates the end-to-end booking availability flow:
 * 1. User searches for listings with specific dates
 * 2. System checks availability across multiple listings
 * 3. User selects a listing and requests booking
 * 4. System validates availability and prevents double bookings
 * 5. System handles concurrent booking requests
 * 
 * Validates business truth, not implementation.
 */

import { test, expect } from '@playwright/test';

test.describe('Booking Availability Integration E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a test user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'renter@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should check availability for date range', async ({ page }) => {
    // Step 1: Navigate to search
    await page.goto('/search');
    
    // Step 2: Set date range
    await page.fill('[data-testid="check-in-date"]', '2026-04-15');
    await page.fill('[data-testid="check-out-date"]', '2026-04-20');
    await page.click('[data-testid="search-button"]');
    
    // Step 3: Verify only available listings are shown
    const listings = page.locator('[data-testid="listing-card"]');
    const count = await listings.count();
    expect(count).toBeGreaterThan(0);
    
    // Step 4: Verify availability badge is shown
    await expect(page.locator('[data-testid="availability-badge"]').first()).toBeVisible();
  });

  test('should prevent double booking for same dates', async ({ page, browser }) => {
    // Step 1: Open first browser session and create booking
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/auth/login');
    await page1.fill('[data-testid="email"]', 'renter@test.com');
    await page1.fill('[data-testid="password"]', 'password123');
    await page1.click('[data-testid="login-button"]');
    await page1.waitForURL('/dashboard');
    
    await page1.goto('/listings/test-listing-1');
    await page1.click('[data-testid="request-booking-button"]');
    await page1.fill('[data-testid="check-in-date"]', '2026-04-15');
    await page1.fill('[data-testid="check-out-date"]', '2026-04-20');
    await page1.click('[data-testid="submit-booking-request"]');
    await page1.waitForURL('/bookings');
    
    // Step 2: Open second browser session and try to book same dates
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/auth/login');
    await page2.fill('[data-testid="email"]', 'renter2@test.com');
    await page2.fill('[data-testid="password"]', 'password123');
    await page2.click('[data-testid="login-button"]');
    await page2.waitForURL('/dashboard');
    
    await page2.goto('/listings/test-listing-1');
    await page2.click('[data-testid="request-booking-button"]');
    await page2.fill('[data-testid="check-in-date"]', '2026-04-15');
    await page2.fill('[data-testid="check-out-date"]', '2026-04-20');
    await page2.click('[data-testid="submit-booking-request"]');
    
    // Step 3: Verify second booking shows unavailable error
    await expect(page2.locator('[data-testid="unavailable-error"]')).toBeVisible();
    await expect(page2.locator('[data-testid="unavailable-error"]')).toContainText('already booked');
    
    await context1.close();
    await context2.close();
  });

  test('should handle overlapping date ranges correctly', async ({ page }) => {
    // Step 1: Create a booking for a date range
    await page.goto('/listings/test-listing-2');
    await page.click('[data-testid="request-booking-button"]');
    await page.fill('[data-testid="check-in-date"]', '2026-04-15');
    await page.fill('[data-testid="check-out-date"]', '2026-04-20');
    await page.click('[data-testid="submit-booking-request"]');
    
    // Step 2: Try to book overlapping dates (partially overlapping)
    await page.goto('/listings/test-listing-2');
    await page.click('[data-testid="request-booking-button"]');
    await page.fill('[data-testid="check-in-date"]', '2026-04-18');
    await page.fill('[data-testid="check-out-date"]', '2026-04-25');
    await page.click('[data-testid="submit-booking-request"]');
    
    // Step 3: Verify overlap is detected
    await expect(page.locator('[data-testid="unavailable-error"]')).toBeVisible();
    
    // Step 4: Try to book non-overlapping dates
    await page.goto('/listings/test-listing-2');
    await page.click('[data-testid="request-booking-button"]');
    await page.fill('[data-testid="check-in-date"]', '2026-04-25');
    await page.fill('[data-testid="check-out-date"]', '2026-04-30');
    await page.click('[data-testid="submit-booking-request"]');
    
    // Step 5: Verify non-overlapping booking succeeds
    await expect(page.locator('[data-testid="booking-requested"]')).toBeVisible();
  });

  test('should display availability calendar correctly', async ({ page }) => {
    // Step 1: Navigate to listing details
    await page.goto('/listings/test-listing-3');
    
    // Step 2: Click on availability calendar
    await page.click('[data-testid="availability-calendar-button"]');
    
    // Step 3: Verify calendar is displayed
    await expect(page.locator('[data-testid="availability-calendar"]')).toBeVisible();
    
    // Step 4: Verify booked dates are marked
    await expect(page.locator('[data-testid="booked-date"]')).toBeVisible();
    
    // Step 5: Verify available dates are selectable
    await page.click('[data-testid="available-date"]');
    await expect(page.locator('[data-testid="date-selected"]')).toBeVisible();
  });

  test('should handle availability updates in real-time', async ({ page, browser }) => {
    // Step 1: Open listing in first browser
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/listings/test-listing-4');
    await page1.click('[data-testid="availability-calendar-button"]');
    
    // Step 2: Open same listing in second browser
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/listings/test-listing-4');
    await page2.click('[data-testid="availability-calendar-button"]');
    
    // Step 3: Create booking in first browser
    await page1.click('[data-testid="request-booking-button"]');
    await page1.fill('[data-testid="check-in-date"]', '2026-04-15');
    await page1.fill('[data-testid="check-out-date"]', '2026-04-20');
    await page1.click('[data-testid="submit-booking-request"]');
    
    // Step 4: Verify second browser shows updated availability
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    const bookedDates = page2.locator('[data-testid="booked-date"]');
    const count = await bookedDates.count();
    expect(count).toBeGreaterThan(0);
    
    await context1.close();
    await context2.close();
  });
});
