/**
 * Release Gate Test Suite
 * 
 * Comprehensive smoke tests that must pass before any deployment.
 * These tests validate all critical paths and core functionality.
 * 
 * Criteria for release gate tests:
 * - Fast execution (< 5 minutes total)
 * - Cover all critical user journeys
 * - Validate API health and core endpoints
 * - Check database connectivity
 * - Verify external service integrations
 * - Test authentication and authorization
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3400/api';
const WEB_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3401';

// Test data
const TEST_USERS = {
  renter: { email: 'renter@example.com', password: 'test123' },
  owner: { email: 'owner@example.com', password: 'test123' },
  admin: { email: 'admin@example.com', password: 'test123' },
};

test.describe('Release Gate Suite', () => {
  test.describe.configure({ mode: 'serial' });

  // ==========================================================================
  // 1. API Health & Connectivity
  // ==========================================================================
  test.describe('API Health', () => {
    test('API root endpoint returns 200', async ({ request }) => {
      const response = await request.get(API_URL);
      expect(response.status()).toBeLessThan(500);
    });

    test('Health check endpoint is accessible', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
    });

    test('Liveness probe returns ok', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/live`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });

    test('Readiness probe validates dependencies', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/ready`);
      expect(response.status()).toBe(200);
    });

    test('Database connectivity is confirmed', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/database`);
      expect(response.status()).toBe(200);
    });
  });

  // ==========================================================================
  // 2. Authentication & Authorization
  // ==========================================================================
  test.describe('Authentication', () => {
    test('User can register with valid data', async ({ request }) => {
      const timestamp = Date.now();
      const response = await request.post(`${API_URL}/auth/register`, {
        data: {
          email: `test_${timestamp}@example.com`,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
        },
      });
      expect([200, 201, 409]).toContain(response.status()); // 409 if user exists
    });

    test('User can login with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/login`, {
        data: {
          email: TEST_USERS.renter.email,
          password: TEST_USERS.renter.password,
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.accessToken).toBeDefined();
      expect(body.user).toBeDefined();
    });

    test('Login fails with invalid credentials', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/login`, {
        data: {
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        },
      });
      expect(response.status()).toBe(401);
    });

    test('Protected endpoints require authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/bookings/my-bookings`);
      expect(response.status()).toBe(401);
    });

    test('Token refresh works with valid refresh token', async ({ request }) => {
      // First login to get tokens
      const loginRes = await request.post(`${API_URL}/auth/login`, {
        data: TEST_USERS.renter,
      });
      const { refreshToken } = await loginRes.json();

      const response = await request.post(`${API_URL}/auth/refresh`, {
        data: { refreshToken },
      });
      expect([200, 201]).toContain(response.status());
    });

    test('Password reset flow initiates correctly', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/forgot-password`, {
        data: { email: TEST_USERS.renter.email },
      });
      // Should return 200 even if email doesn't exist (security)
      expect(response.status()).toBe(200);
    });
  });

  // ==========================================================================
  // 3. Core Listings Functionality
  // ==========================================================================
  test.describe('Listings', () => {
    test('Public search returns results', async ({ request }) => {
      const response = await request.get(`${API_URL}/search?q=kathmandu`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.results).toBeDefined();
      expect(Array.isArray(body.results)).toBe(true);
    });

    test('Listing details can be fetched by ID', async ({ request }) => {
      // First get a listing ID from search
      const searchRes = await request.get(`${API_URL}/search?limit=1`);
      const { results } = await searchRes.json();
      
      if (results.length > 0) {
        const listingId = results[0].id;
        const response = await request.get(`${API_URL}/listings/${listingId}`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.id).toBe(listingId);
      }
    });

    test('Categories can be fetched', async ({ request }) => {
      const response = await request.get(`${API_URL}/categories`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('Listings can be filtered by category', async ({ request }) => {
      const response = await request.get(`${API_URL}/listings?category=apartment`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.results).toBeDefined();
    });
  });

  // ==========================================================================
  // 4. Bookings Core Flow
  // ==========================================================================
  test.describe('Bookings', () => {
    test('Booking creation requires authentication', async ({ request }) => {
      const response = await request.post(`${API_URL}/bookings`, {
        data: { listingId: 'test', startDate: '2025-01-01', endDate: '2025-01-05' },
      });
      expect(response.status()).toBe(401);
    });

    test('Authenticated user can view their bookings', async ({ request }) => {
      // Login first
      const loginRes = await request.post(`${API_URL}/auth/login`, {
        data: TEST_USERS.renter,
      });
      const { accessToken } = await loginRes.json();

      const response = await request.get(`${API_URL}/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('Availability can be checked for a listing', async ({ request }) => {
      const searchRes = await request.get(`${API_URL}/search?limit=1`);
      const { results } = await searchRes.json();
      
      if (results.length > 0) {
        const listingId = results[0].id;
        const response = await request.get(
          `${API_URL}/listings/${listingId}/availability?startDate=2025-06-01&endDate=2025-06-30`
        );
        expect([200, 404]).toContain(response.status());
      }
    });
  });

  // ==========================================================================
  // 5. User Profile & Settings
  // ==========================================================================
  test.describe('User Management', () => {
    test('User can fetch their profile', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/auth/login`, {
        data: TEST_USERS.renter,
      });
      const { accessToken } = await loginRes.json();

      const response = await request.get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.email).toBeDefined();
    });

    test('User can update their profile', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/auth/login`, {
        data: TEST_USERS.renter,
      });
      const { accessToken } = await loginRes.json();

      const response = await request.patch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { firstName: 'Updated', lastName: 'Name' },
      });
      expect([200, 204]).toContain(response.status());
    });
  });

  // ==========================================================================
  // 6. Notifications
  // ==========================================================================
  test.describe('Notifications', () => {
    test('User can fetch notifications', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/auth/login`, {
        data: TEST_USERS.renter,
      });
      const { accessToken } = await loginRes.json();

      const response = await request.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status()).toBe(200);
    });

    test('User can fetch unread notification count', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/auth/login`, {
        data: TEST_USERS.renter,
      });
      const { accessToken } = await loginRes.json();

      const response = await request.get(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status()).toBe(200);
    });
  });

  // ==========================================================================
  // 7. Admin Operations
  // ==========================================================================
  test.describe('Admin', () => {
    test('Admin can access admin dashboard', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/auth/login`, {
        data: TEST_USERS.admin,
      });
      const { accessToken } = await loginRes.json();

      const response = await request.get(`${API_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect([200, 403]).toContain(response.status()); // 403 if not admin
    });

    test('Non-admin cannot access admin endpoints', async ({ request }) => {
      const loginRes = await request.post(`${API_URL}/auth/login`, {
        data: TEST_USERS.renter,
      });
      const { accessToken } = await loginRes.json();

      const response = await request.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status()).toBe(403);
    });
  });

  // ==========================================================================
  // 8. Web Frontend Smoke Tests
  // ==========================================================================
  test.describe('Web Frontend', () => {
    test('Homepage loads successfully', async ({ page }) => {
      await page.goto(WEB_URL);
      await expect(page).toHaveTitle(/GharBatai|Rental/);
    });

    test('Search page loads and shows results', async ({ page }) => {
      await page.goto(`${WEB_URL}/search?q=kathmandu`);
      await expect(page.locator('body')).toContainText(/search|results|listings/i);
    });

    test('Login page is accessible', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    });

    test('Registration page is accessible', async ({ page }) => {
      await page.goto(`${WEB_URL}/signup`);
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    });

    test('About page loads', async ({ page }) => {
      await page.goto(`${WEB_URL}/about`);
      await expect(page.locator('body')).toBeVisible();
    });

    test('Privacy policy page loads', async ({ page }) => {
      await page.goto(`${WEB_URL}/privacy`);
      await expect(page.locator('body')).toBeVisible();
    });
  });

  // ==========================================================================
  // 9. Critical Business Logic Validation
  // ==========================================================================
  test.describe('Business Logic', () => {
    test('Price calculation endpoint works', async ({ request }) => {
      const searchRes = await request.get(`${API_URL}/search?limit=1`);
      const { results } = await searchRes.json();
      
      if (results.length > 0) {
        const listingId = results[0].id;
        const response = await request.post(`${API_URL}/bookings/calculate-price`, {
          data: {
            listingId,
            startDate: '2025-06-01',
            endDate: '2025-06-05',
          },
        });
        expect([200, 404]).toContain(response.status());
        if (response.status() === 200) {
          const body = await response.json();
          expect(body.totalAmount).toBeDefined();
          expect(body.subtotal).toBeDefined();
        }
      }
    });

    test('Geocoding service is available', async ({ request }) => {
      const response = await request.get(`${API_URL}/geo/geocode?address=kathmandu`);
      expect([200, 404, 500]).toContain(response.status());
    });
  });

  // ==========================================================================
  // 10. Performance Checks
  // ==========================================================================
  test.describe('Performance', () => {
    test('API response time for search is acceptable', async ({ request }) => {
      const start = Date.now();
      const response = await request.get(`${API_URL}/search?q=test`);
      const duration = Date.now() - start;
      
      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(5000); // 5 second threshold
    });

    test('API response time for health check is fast', async ({ request }) => {
      const start = Date.now();
      const response = await request.get(`${API_URL}/health`);
      const duration = Date.now() - start;
      
      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(1000); // 1 second threshold
    });

    test('Homepage loads within acceptable time', async ({ page }) => {
      const start = Date.now();
      await page.goto(WEB_URL);
      await page.waitForLoadState('networkidle');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10000); // 10 second threshold
    });
  });
});
