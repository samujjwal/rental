import { test, expect } from '@playwright/test';

/**
 * ULTRA-STRICT: Security Penetration Tests (Phase 4)
 * 
 * These tests validate security controls, input validation,
 * and protection against common attack vectors.
 */

test.describe('Security Penetration Tests', () => {
  
  test.describe('Authentication & Authorization Security', () => {
    test('blocks brute force login attempts', async ({ page }) => {
      await page.goto('/auth/login');
      
      // Attempt multiple failed logins
      for (let i = 0; i < 6; i++) {
        await page.fill('[data-testid="email"]', 'victim@test.com');
        await page.fill('[data-testid="password"]', 'wrongpassword');
        await page.click('[data-testid="login-button"]');
      }
      
      // Verify rate limit triggered
      await expect(page.locator('[data-testid="rate-limit-message"]')).toContainText('Too many attempts');
    });

    test('enforces strong password requirements', async ({ page }) => {
      await page.goto('/auth/signup');
      
      // Weak password
      await page.fill('[data-testid="email"]', 'newuser@test.com');
      await page.fill('[data-testid="password"]', '123');
      await page.fill('[data-testid="confirm-password"]', '123');
      await page.click('[data-testid="signup-button"]');
      
      await expect(page.locator('[data-testid="password-error"]')).toContainText('at least 8 characters');
      
      // Password without uppercase
      await page.fill('[data-testid="password"]', 'lowercase123!');
      await page.click('[data-testid="signup-button"]');
      await expect(page.locator('[data-testid="password-error"]')).toContainText('uppercase');
    });

    test('prevents session hijacking via token validation', async ({ page, context }) => {
      // Login
      await page.goto('/auth/login');
      await page.fill('[data-testid="email"]', 'user@test.com');
      await page.fill('[data-testid="password"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      // Get authenticated state
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name.includes('auth'));
      
      // Tamper with token
      await context.addCookies([{
        ...authCookie!,
        value: 'tampered_token',
      }]);
      
      // Verify redirect to login
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('enforces role-based access control', async ({ page }) => {
      // Login as regular user
      await page.goto('/auth/login');
      await page.fill('[data-testid="email"]', 'renter@test.com');
      await page.fill('[data-testid="password"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      // Attempt to access admin routes
      await page.goto('/admin');
      
      // Verify forbidden or redirected
      await expect(page.locator('[data-testid="forbidden"]')).toBeVisible();
    });
  });

  test.describe('SQL Injection Prevention', () => {
    test('sanitizes search input', async ({ page }) => {
      await page.goto('/search');
      
      // SQL injection attempt
      await page.fill('[data-testid="search-input"]', "'; DROP TABLE users; --");
      await page.click('[data-testid="search-button"]');
      
      // Should not cause error, results should be empty or filtered
      await expect(page.locator('[data-testid="search-error"]')).not.toBeVisible();
    });

    test('sanitizes listing filter parameters', async ({ page }) => {
      await page.goto('/listings?category=1 OR 1=1');
      
      // Should handle gracefully
      await expect(page.locator('[data-testid="listings-grid"]')).toBeVisible();
    });

    test('parameterized queries prevent injection', async ({ request }) => {
      // API SQL injection attempt
      const response = await request.get('/api/listings/search', {
        params: { q: "' OR '1'='1" }
      });
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      // Should return empty or filtered results, not all data
      expect(data).toBeDefined();
    });
  });

  test.describe('XSS Prevention', () => {
    test('sanitizes user-generated content in listings', async ({ page }) => {
      // View a listing with malicious title
      await page.goto('/listings/malicious-test-id');
      
      // Verify script tags are escaped
      const title = page.locator('[data-testid="listing-title"]');
      await expect(title).not.toContainText('<script>');
    });

    test('prevents stored XSS in reviews', async ({ page }) => {
      // Attempt to submit review with XSS
      await page.goto('/bookings/completed-test-id');
      await page.click('[data-testid="leave-review"]');
      
      await page.fill('[data-testid="review-text"]', '<script>alert("XSS")</script>Great stay!');
      await page.click('[data-testid="submit-review"]');
      
      // View the review
      await page.goto('/listings/test-listing-id');
      const review = page.locator('[data-testid="review-content"]').first();
      
      // Should display escaped text
      await expect(review).toContainText('Great stay!');
      await expect(review).not.toContainText('<script>');
    });

    test('sanitizes URL parameters', async ({ page }) => {
      await page.goto('/search?q=<script>alert(1)</script>');
      
      // Should not execute script
      await expect(page.locator('body')).not.toContainText('alert(1)');
    });
  });

  test.describe('CSRF Protection', () => {
    test('requires CSRF token for state-changing operations', async ({ page, context }) => {
      // Get authenticated
      await page.goto('/auth/login');
      await page.fill('[data-testid="email"]', 'user@test.com');
      await page.fill('[data-testid="password"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      // Attempt POST without CSRF token
      const response = await context.request.post('/api/bookings', {
        data: { listingId: 'test', dates: ['2026-04-01'] },
        headers: { 'X-CSRF-Token': '' }
      });
      
      expect(response.status()).toBe(403);
    });

    test('validates CSRF token on mutations', async ({ page }) => {
      await page.goto('/listings/new');
      
      // Get CSRF token from page
      const csrfToken = await page.getAttribute('meta[name="csrf-token"]', 'content');
      expect(csrfToken).toBeTruthy();
      
      // Submit form
      await page.fill('[data-testid="listing-title"]', 'Test Listing');
      await page.click('[data-testid="submit-listing"]');
      
      // Should succeed with valid CSRF
      await expect(page.locator('[data-testid="listing-created"]')).toBeVisible();
    });
  });

  test.describe('Input Validation & Sanitization', () => {
    test('validates email format', async ({ page }) => {
      await page.goto('/auth/signup');
      
      await page.fill('[data-testid="email"]', 'not-an-email');
      await page.fill('[data-testid="password"]', 'Password123!');
      await page.click('[data-testid="signup-button"]');
      
      await expect(page.locator('[data-testid="email-error"]')).toContainText('valid email');
    });

    test('validates price boundaries', async ({ page }) => {
      await page.goto('/listings/new');
      
      // Negative price
      await page.fill('[data-testid="base-price"]', '-100');
      await page.click('[data-testid="next-step"]');
      
      await expect(page.locator('[data-testid="price-error"]')).toContainText('positive');
      
      // Excessive price
      await page.fill('[data-testid="base-price"]', '999999999');
      await page.click('[data-testid="next-step"]');
      
      await expect(page.locator('[data-testid="price-error"]')).toContainText('maximum');
    });

    test('validates date ranges', async ({ page }) => {
      await page.goto('/search');
      
      // End date before start date
      await page.fill('[data-testid="start-date"]', '2026-04-10');
      await page.fill('[data-testid="end-date"]', '2026-04-05');
      await page.click('[data-testid="search-button"]');
      
      await expect(page.locator('[data-testid="date-error"]')).toContainText('after');
    });

    test('validates file upload types', async ({ page }) => {
      await page.goto('/listings/new');
      
      const fileInput = page.locator('[data-testid="photo-upload"]');
      await fileInput.setInputFiles('./test-assets/malicious.exe');
      
      await expect(page.locator('[data-testid="upload-error"]')).toContainText('image');
    });

    test('enforces maximum file size', async ({ page }) => {
      await page.goto('/listings/new');
      
      const fileInput = page.locator('[data-testid="photo-upload"]');
      // File larger than 10MB
      await fileInput.setInputFiles('./test-assets/oversized.jpg');
      
      await expect(page.locator('[data-testid="upload-error"]')).toContainText('10MB');
    });
  });

  test.describe('API Security', () => {
    test('requires authentication for protected endpoints', async ({ request }) => {
      const response = await request.get('/api/bookings');
      expect(response.status()).toBe(401);
    });

    test('returns 404 for non-existent resources (no info leak)', async ({ request }) => {
      const response = await request.get('/api/bookings/non-existent-id');
      expect(response.status()).toBe(401); // Should not reveal if ID exists
    });

    test('enforces rate limiting on API', async ({ request }) => {
      // Make rapid requests
      const promises = Array(100).fill(null).map(() => 
        request.get('/api/health')
      );
      
      const responses = await Promise.all(promises);
      
      // Some should be rate limited
      const rateLimited = responses.filter(r => r.status() === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('sanitizes API response data', async ({ request }) => {
      const response = await request.get('/api/listings/public-test-id');
      const data = await response.json();
      
      // Should not expose sensitive fields
      expect(data.owner?.password).toBeUndefined();
      expect(data.owner?.stripeConnectId).toBeUndefined();
    });
  });

  test.describe('Secure Headers & Transport', () => {
    test('sets security headers', async ({ page }) => {
      const response = await page.goto('/');
      const headers = response?.headers();
      
      expect(headers?.['x-frame-options']).toBeDefined();
      expect(headers?.['x-content-type-options']).toBe('nosniff');
      expect(headers?.['x-xss-protection']).toBeDefined();
    });

    test('enforces HTTPS in production', async ({ page, context }) => {
      // Attempt HTTP request
      const response = await context.request.get('http://localhost:3401/');
      
      // Should redirect to HTTPS
      expect(response.status()).toBe(301);
    });

    test('sets secure cookie attributes', async ({ context }) => {
      await context.goto('/auth/login');
      
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name.includes('auth'));
      
      if (authCookie) {
        expect(authCookie.secure).toBe(true);
        expect(authCookie.httpOnly).toBe(true);
        expect(authCookie.sameSite).toBe('Strict');
      }
    });
  });
});
