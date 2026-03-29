/**
 * Error Scenarios & Resilience Tests
 * Validates graceful handling of failures and edge cases
 * @tags @resilience @error-handling @critical
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3401';
const API_URL = process.env.E2E_API_URL || 'http://localhost:3400/api';

test.describe('Error Scenarios & Resilience', () => {
  test('API returns 500 - UI shows error boundary', async ({ page, context }) => {
    // Abort all API calls to simulate 500
    await context.route(`${API_URL}/listings*`, route => {
      route.abort('failed');
    });
    
    await page.goto(`${BASE_URL}/search`);
    
    // Should show error state
    const errorContainer = page.locator('[data-testid="error-container"]');
    await expect(errorContainer).toBeVisible();
    
    // Should have retry button
    const retryBtn = page.locator('[data-testid="retry-btn"]');
    await expect(retryBtn).toBeVisible();
    
    // Disable abort and retry
    await context.unroute(`${API_URL}/listings*`);
    await retryBtn.click();
    
    // Should recover
    await expect(page.locator('[data-testid="listing-card"]')).toBeVisible({ timeout: 10_000 });
  });

  test('Network disconnection during booking - recover on reconnect', async ({ page, context }) => {
    // Start booking
    await page.goto(`${BASE_URL}/listings/test-listing`);
    await page.locator('[data-testid="book-now-btn"]').click();
    
    // Simulate disconnection
    await context.setOffline(true);
    
    // Attempt to submit
    await page.locator('[data-testid="submit-booking"]').click();
    
    // Should show error state
    await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
    
    // Reconnect
    await context.setOffline(false);
    
    // Retry should work
    const retryBtn = page.locator('[data-testid="retry-btn"]');
    await retryBtn.click();
    
    // Should complete booking
    await page.waitForURL(/\/booking\/.+\/confirmation/, { timeout: 15_000 });
  });

  test('Invalid Date range handling', async ({ request }) => {
    // Try to create booking with end < start
    const response = await request.post(`${API_URL}/bookings`, {
      data: {
        listingId: 'test-listing',
        startDate: '2026-04-10T00:00:00Z',
        endDate: '2026-04-05T00:00:00Z', // Earlier than start
        guestCount: 1,
      },
    });
    
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toContain('end date');
  });

  test('Guest count exceeds maximum - validation', async ({ page }) => {
    await page.goto(`${BASE_URL}/listings/test-listing`);
    await page.locator('[data-testid="book-now-btn"]').click();
    
    // Set guest count way over limit
    await page.locator('[data-testid="guest-count"]').fill('500');
    
    // Should show error
    const error = page.locator('[data-testid="guest-error"]');
    await expect(error).toBeVisible();
    
    // Submit button should be disabled
    const submit = page.locator('[data-testid="submit-booking"]');
    await expect(submit).toBeDisabled();
  });

  test('Non-existent listing returns 404', async ({ page }) => {
    await page.goto(`${BASE_URL}/listings/non-existent-id-12345`);
    
    // Should show 404 page
    await expect(page.locator('[data-testid="error-404"]')).toBeVisible();
    
    // Home link should be available
    await page.locator('[data-testid="go-home"]').click();
    await page.waitForURL(`${BASE_URL}/?`);
  });

  test('Unauthorized access to admin routes', async ({ page, context }) => {
    // Login as user (not admin)
    const userPage = await context.newPage();
    await userPage.goto(`${BASE_URL}/auth/login`);
    await userPage.locator('[data-testid="email"]').fill('renter@test.com');
    await userPage.locator('[data-testid="password"]').fill('password');
    await userPage.locator('[data-testid="login-btn"]').click();
    
    // Try to access admin page
    await userPage.goto(`${BASE_URL}/admin`);
    
    // Should redirect to 403 or home
    expect(userPage.url()).not.toContain('/admin');
    
    await userPage.close();
  });

  test('Expired token refresh flow', async ({ page, request }) => {
    // Get a token and wait for it to expire
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'renter@test.com', password: 'password' },
    });
    
    const { token } = await login.json();
    
    // Manually set expired token
    await page.goto(`${BASE_URL}`);
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'expired-token-value');
    });
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Should detect expired token and redirect to login
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
  });

  test('Listing cannot be edited by non-owner', async ({ page, request, context }) => {
    // Create a listing as owner1
    const owner1 = await request.post(`${API_URL}/listings`, {
      data: {
        title: 'Owner1 Listing',
        ownerId: 'owner1',
        price: 100,
        category: 'apartment',
        country: 'NP',
      },
    });
    
    const listingId = (await owner1.json()).id;
    
    // Login as owner2
    const page2 = await context.newPage();
    await page2.goto(`${BASE_URL}/auth/login`);
    await page2.locator('[data-testid="email"]').fill('owner2@test.com');
    await page2.locator('[data-testid="password"]').fill('password');
    await page2.locator('[data-testid="login-btn"]').click();
    
    // Try to edit listing
    const editRes = await request.patch(`${API_URL}/listings/${listingId}`, {
      data: { title: 'New Title' },
      headers: {
        authorization: 'Bearer owner2-token', // owner2's token
      },
    });
    
    expect(editRes.status()).toBe(403);
    
    await page2.close();
  });

  test('Database unavailable - graceful degradation', async ({ context, request }) => {
    // Simulate database error
    await context.route(`${API_URL}/**`, route => {
      if (route.request().method() === 'POST' || route.request().method() === 'PATCH') {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Try to create listing
    await page.locator('[data-testid="create-listing-btn"]').click();
    await page.goto(`${BASE_URL}/listings/new`);
    
    await page.locator('[data-testid="title"]').fill('New Listing');
    await page.locator('[data-testid="submit"]').click();
    
    // Should show error, not crash
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    await page.close();
  });

  test('Concurrent booking on same slot with inventory check', async ({ request }) => {
    const listingId = 'single-unit-listing';
    
    // Create single-unit listing
    await request.post(`${API_URL}/listings`, {
      data: {
        id: listingId,
        title: 'Single Unit',
        maxUnits: 1,
      },
    });
    
    // Verify inventory
    const inv1 = await request.get(`${API_URL}/listings/${listingId}/inventory`);
    const inventoryBefore = await inv1.json();
    expect(inventoryBefore.available).toBe(1);
    
    // Book the unit
    const booking1 = await request.post(`${API_URL}/bookings`, {
      data: {
        listingId,
        startDate: '2026-05-01T00:00:00Z',
        endDate: '2026-05-05T00:00:00Z',
        guestCount: 1,
      },
    });
    
    expect(booking1.ok()).toBeTruthy();
    
    // Try to book same period (should fail)
    const booking2 = await request.post(`${API_URL}/bookings`, {
      data: {
        listingId,
        startDate: '2026-05-02T00:00:00Z',
        endDate: '2026-05-04T00:00:00Z',
        guestCount: 1,
      },
    });
    
    expect(booking2.status()).toBe(409); // Conflict
    const conflict = await booking2.json();
    expect(conflict.message).toContain('not available');
  });

  test('Image upload failure with retry', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/listings/new`);
    
    // Mock image upload to fail first time
    let attemptCount = 0;
    await context.route(`${API_URL}/upload`, route => {
      attemptCount++;
      if (attemptCount === 1) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    // Attempt to upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test-image.jpg');
    
    // Should show error
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    
    // Click retry
    await page.locator('[data-testid="retry-upload"]').click();
    
    // Should succeed on retry
    await expect(page.locator('[data-testid="image-preview"]')).toBeVisible({ timeout: 10_000 });
  });

  test('Unicode and special characters in listing description', async ({ request }) => {
    const specialChars = 'नेपाली 中文 🏠 <script>alert("xss")</script> "quotes"';
    
    const response = await request.post(`${API_URL}/listings`, {
      data: {
        title: 'Safe Title',
        description: specialChars,
        category: 'apartment',
        country: 'NP',
      },
    });
    
    expect(response.ok()).toBeTruthy();
    
    const listing = await response.json();
    
    // Verify stored and retrieved safely (XSS prevention)
    const getRes = await request.get(`${API_URL}/listings/${listing.id}`);
    const retreived = await getRes.json();
    
    // Should be escaped or sanitized
    expect(retreived.description).not.toContain('<script>');
  });

  test('Rate limit handling with backoff', async ({ request }) => {
    // Rapidly make requests to rate-limited endpoint
    const responses = await Promise.allSettled(
      Array.from({ length: 100 }, () =>
        request.post(`${API_URL}/auth/login`, {
          data: { email: 'test@test.com', password: 'test' },
        })
      )
    );
    
    // Should get 429 responses after threshold
    const statusCodes = responses
      .filter(r => r.status === 'fulfilled')
      .map((r: any) => r.value.status());
    
    const hasRateLimit = statusCodes.some(code => code === 429);
    expect(hasRateLimit).toBeTruthy();
  });
});
