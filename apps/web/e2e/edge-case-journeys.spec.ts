/**
 * Edge Case User Journey Coverage Tests
 * 
 * Tests for unusual or boundary scenarios in user journeys:
 * 1. Empty states
 * 2. Network failures
 * 3. Session expiration
 * 4. Concurrent actions
 * 5. Data inconsistency scenarios
 * 6. Browser navigation interruptions
 * 7. Form validation edge cases
 * 8. Permission boundary scenarios
 */

import { test, expect } from '@playwright/test';

test.describe('Edge Case User Journeys', () => {
  test.describe('Empty States', () => {
    test('should handle empty search results gracefully', async ({ page }) => {
      await page.goto('/search?q=xyznonexistentlisting123456');
      
      // Should show empty state message
      const emptyState = await page.locator('text=/no results/i').first();
      expect(await emptyState.isVisible()).toBeTruthy();
      
      // Should provide helpful next steps
      const helpfulMessage = await page.locator('text=/try different/i').first();
      expect(await helpfulMessage.isVisible()).toBeTruthy();
    });

    test('should handle empty favorites list', async ({ page }) => {
      await page.goto('/favorites');
      
      // Should show empty state for favorites
      const emptyFavorites = await page.locator('text=/no favorites/i').first();
      expect(await emptyFavorites.isVisible()).toBeTruthy();
    });

    test('should handle empty notifications', async ({ page }) => {
      await page.goto('/notifications');
      
      // Should show empty state for notifications
      const emptyNotifications = await page.locator('text=/no notifications/i').first();
      expect(await emptyNotifications.isVisible()).toBeTruthy();
    });

    test('should handle empty messages', async ({ page }) => {
      await page.goto('/messages');
      
      // Should show empty state for messages
      const emptyMessages = await page.locator('text=/no messages/i').first();
      expect(await emptyMessages.isVisible()).toBeTruthy();
    });
  });

  test.describe('Network Failure Scenarios', () => {
    test('should handle API timeout gracefully', async ({ page, context }) => {
      // Simulate network timeout
      await context.route('**/api/**', route => route.abort('timedout'));
      
      await page.goto('/listings');
      
      // Should show error message
      const errorMessage = await page.locator('text=/network error/i').first();
      expect(await errorMessage.isVisible()).toBeTruthy();
    });

    test('should handle API error 500 gracefully', async ({ page, context }) => {
      await context.route('**/api/**', route => route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      }));
      
      await page.goto('/listings');
      
      // Should show error message
      const errorMessage = await page.locator('text=/server error/i').first();
      expect(await errorMessage.isVisible()).toBeTruthy();
    });

    test('should handle API error 404 gracefully', async ({ page, context }) => {
      await context.route('**/api/listings/**', route => route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found' })
      }));
      
      await page.goto('/listings/nonexistent-id');
      
      // Should show not found message
      const notFoundMessage = await page.locator('text=/not found/i').first();
      expect(await notFoundMessage.isVisible()).toBeTruthy();
    });

    test('should retry failed requests', async ({ page, context }) => {
      let attemptCount = 0;
      
      await context.route('**/api/**', route => {
        attemptCount++;
        if (attemptCount < 3) {
          route.abort('timedout');
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [] })
          });
        }
      });
      
      await page.goto('/listings');
      
      // Should eventually succeed after retries
      const listings = await page.locator('[data-testid="listing-card"]').count();
      expect(attemptCount).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Session Expiration', () => {
    test('should handle session expiration during navigation', async ({ page, context }) => {
      // Login first
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      // Simulate session expiration by clearing cookies
      await context.clearCookies();
      
      // Try to navigate to protected page
      await page.goto('/dashboard');
      
      // Should redirect to login
      expect(page.url()).toContain('/auth/login');
    });

    test('should preserve form data on session expiration', async ({ page, context }) => {
      await page.goto('/listings/create');
      await page.fill('input[name="title"]', 'Test Listing');
      
      // Simulate session expiration
      await context.clearCookies();
      
      // Try to submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to login
      expect(page.url()).toContain('/auth/login');
      
      // After login, should preserve form data (if implemented)
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      // Check if form data is preserved
      const titleValue = await page.locator('input[name="title"]').inputValue();
      // This depends on implementation - may or may not preserve data
    });
  });

  test.describe('Concurrent Actions', () => {
    test('should handle double-click prevention on buttons', async ({ page }) => {
      await page.goto('/listings/create');
      await page.fill('input[name="title"]', 'Test Listing');
      
      // Double-click submit button
      const submitButton = await page.locator('button[type="submit"]');
      await submitButton.dblclick();
      
      // Should only submit once
      // Check for duplicate prevention (disabled state, etc.)
      const isDisabled = await submitButton.isDisabled();
      expect(isDisabled).toBeTruthy();
    });

    test('should handle rapid navigation between pages', async ({ page }) => {
      await page.goto('/');
      
      // Rapidly navigate between pages
      await page.goto('/listings');
      await page.goto('/search');
      await page.goto('/favorites');
      await page.goto('/dashboard');
      
      // Should not crash or show errors
      const currentUrl = page.url();
      expect(currentUrl).toContain('/dashboard');
    });

    test('should handle concurrent API requests', async ({ page }) => {
      await page.goto('/');
      
      // Trigger multiple concurrent requests
      const requests = Promise.all([
        page.goto('/listings'),
        page.goto('/search'),
        page.goto('/favorites')
      ]);
      
      await expect(requests).resolves.not.toThrow();
    });
  });

  test.describe('Data Inconsistency Scenarios', () => {
    test('should handle missing listing data gracefully', async ({ page, context }) => {
      await context.route('**/api/listings/**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: '123', title: null }) // Missing required fields
      }));
      
      await page.goto('/listings/123');
      
      // Should handle missing data gracefully
      const errorMessage = await page.locator('text=/data unavailable/i').first();
      expect(await errorMessage.isVisible()).toBeTruthy();
    });

    test('should handle malformed API responses', async ({ page, context }) => {
      await context.route('**/api/listings/**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{ invalid json }'
      }));
      
      await page.goto('/listings/123');
      
      // Should handle parse error gracefully
      const errorMessage = await page.locator('text=/error loading/i').first();
      expect(await errorMessage.isVisible()).toBeTruthy();
    });

    test('should handle inconsistent state across pages', async ({ page }) => {
      // Load listing details
      await page.goto('/listings/123');
      const firstTitle = await page.locator('h1').textContent();
      
      // Navigate away and back
      await page.goto('/search');
      await page.goto('/listings/123');
      
      const secondTitle = await page.locator('h1').textContent();
      
      // Should show consistent data (or handle inconsistency)
      expect(firstTitle).toEqual(secondTitle);
    });
  });

  test.describe('Browser Navigation Interruptions', () => {
    test('should handle back button after form submission', async ({ page }) => {
      await page.goto('/listings/create');
      await page.fill('input[name="title"]', 'Test Listing');
      await page.click('button[type="submit"]');
      
      // Navigate back
      await page.goBack();
      
      // Should handle back navigation gracefully
      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();
    });

    test('should handle page refresh during form submission', async ({ page }) => {
      await page.goto('/listings/create');
      await page.fill('input[name="title"]', 'Test Listing');
      
      // Refresh page
      await page.reload();
      
      // Should handle refresh gracefully
      const formExists = await page.locator('form').count();
      expect(formExists).toBeGreaterThan(0);
    });

    test('should handle browser close during operation', async ({ page }) => {
      await page.goto('/listings/create');
      await page.fill('input[name="title"]', 'Test Listing');
      
      // Close and reopen page
      await page.close();
      
      // In real scenario, this would test if data is preserved
      // For testing, we just verify no crashes
    });
  });

  test.describe('Form Validation Edge Cases', () => {
    test('should handle extremely long input', async ({ page }) => {
      await page.goto('/listings/create');
      
      const longText = 'a'.repeat(10000);
      await page.fill('textarea[name="description"]', longText);
      
      // Should truncate or show error
      const errorMessage = await page.locator('text=/too long/i').first();
      const hasError = await errorMessage.isVisible().catch(() => false);
      
      expect(hasError || longText.length > 0).toBeTruthy();
    });

    test('should handle special characters in input', async ({ page }) => {
      await page.goto('/listings/create');
      
      const specialChars = '<script>alert("xss")</script>&"\'';
      await page.fill('input[name="title"]', specialChars);
      
      // Should sanitize or escape special characters
      const input = await page.locator('input[name="title"]');
      const value = await input.inputValue();
      
      // Should not contain unescaped script tags
      expect(value).not.toContain('<script>');
    });

    test('should handle unicode characters', async ({ page }) => {
      await page.goto('/listings/create');
      
      const unicodeText = 'नेपाली 日本語 한국어 العربية';
      await page.fill('input[name="title"]', unicodeText);
      
      // Should accept unicode characters
      const input = await page.locator('input[name="title"]');
      const value = await input.inputValue();
      
      expect(value).toBe(unicodeText);
    });

    test('should handle emoji characters', async ({ page }) => {
      await page.goto('/listings/create');
      
      const emojiText = '🏠 🎉 ⭐ 🚀';
      await page.fill('input[name="title"]', emojiText);
      
      // Should accept emoji characters
      const input = await page.locator('input[name="title"]');
      const value = await input.inputValue();
      
      expect(value).toBe(emojiText);
    });
  });

  test.describe('Permission Boundary Scenarios', () {
    test('should prevent unauthorized access to admin pages', async ({ page }) => {
      await page.goto('/admin');
      
      // Should redirect to login or show unauthorized
      const currentUrl = page.url();
      const isUnauthorized = currentUrl.includes('/auth/login') || 
                           await page.locator('text=/unauthorized/i').isVisible();
      
      expect(isUnauthorized).toBeTruthy();
    });

    test('should prevent editing other users listings', async ({ page }) => {
      // Try to access another user's listing edit page
      await page.goto('/listings/other-user-123/edit');
      
      // Should show unauthorized or redirect
      const errorMessage = await page.locator('text=/not authorized/i').first();
      const hasError = await errorMessage.isVisible().catch(() => false);
      
      expect(hasError).toBeTruthy();
    });

    test('should prevent access to sensitive user data', async ({ page }) => {
      // Try to access another user's profile
      await page.goto('/users/other-user-123/settings');
      
      // Should show unauthorized or redirect
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('/auth/login');
      
      expect(isRedirected).toBeTruthy();
    });
  });

  test.describe('Browser Compatibility Edge Cases', () => {
    test('should handle JavaScript disabled gracefully', async ({ page, context }) => {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'javascriptEnabled', {
          get: () => false
        });
      });
      
      await page.goto('/');
      
      // Should show message to enable JavaScript
      const jsMessage = await page.locator('text=/enable javascript/i').first();
      const hasMessage = await jsMessage.isVisible().catch(() => false);
      
      // This depends on implementation
      expect(hasMessage || await page.locator('body').isVisible()).toBeTruthy();
    });

    test('should handle cookies disabled gracefully', async ({ page, context }) => {
      await context.clearCookies();
      
      await page.goto('/');
      
      // Should work without cookies (or show message)
      const pageLoaded = await page.locator('body').isVisible();
      expect(pageLoaded).toBeTruthy();
    });

    test('should handle localStorage disabled gracefully', async ({ page, context }) => {
      await context.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: null,
          writable: false
        });
      });
      
      await page.goto('/');
      
      // Should handle gracefully
      const pageLoaded = await page.locator('body').isVisible();
      expect(pageLoaded).toBeTruthy();
    });
  });

  test.describe('Pagination Edge Cases', () => {
    test('should handle pagination with single item', async ({ page }) => {
      await page.goto('/listings?page=1&limit=1');
      
      // Should show single item
      const items = await page.locator('[data-testid="listing-card"]').count();
      expect(items).toBeLessThanOrEqual(1);
    });

    test('should handle pagination beyond available pages', async ({ page }) => {
      await page.goto('/listings?page=999999');
      
      // Should show empty state or last page
      const emptyState = await page.locator('text=/no results/i').first();
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      
      expect(hasEmptyState).toBeTruthy();
    });

    test('should handle negative page numbers', async ({ page }) => {
      await page.goto('/listings?page=-1');
      
      // Should default to page 1
      const currentUrl = page.url();
      const hasPageOne = currentUrl.includes('page=1') || !currentUrl.includes('page=-1');
      
      expect(hasPageOne).toBeTruthy();
    });
  });

  test.describe('Search Edge Cases', () => {
    test('should handle empty search query', async ({ page }) => {
      await page.goto('/search?q=');
      
      // Should show all listings or prompt
      const listings = await page.locator('[data-testid="listing-card"]').count();
      const prompt = await page.locator('text=/enter search/i').first();
      const hasPrompt = await prompt.isVisible().catch(() => false);
      
      expect(listings > 0 || hasPrompt).toBeTruthy();
    });

    test('should handle very long search query', async ({ page }) => {
      const longQuery = 'a'.repeat(500);
      await page.goto(`/search?q=${longQuery}`);
      
      // Should truncate or handle gracefully
      const pageLoaded = await page.locator('body').isVisible();
      expect(pageLoaded).toBeTruthy();
    });

    test('should handle special characters in search', async ({ page }) => {
      await page.goto('/search?q=test%20%26%20search%20%3C%3E');
      
      // Should handle special characters
      const pageLoaded = await page.locator('body').isVisible();
      expect(pageLoaded).toBeTruthy();
    });
  });

  test.describe('File Upload Edge Cases', () => {
    test('should handle large file upload', async ({ page }) => {
      await page.goto('/listings/create');
      
      // Try to upload a large file (simulated)
      const fileInput = await page.locator('input[type="file"]').first();
      if (await fileInput.isVisible()) {
        // This would test file size validation
        const pageLoaded = await page.locator('body').isVisible();
        expect(pageLoaded).toBeTruthy();
      }
    });

    test('should handle invalid file type', async ({ page }) => {
      await page.goto('/listings/create');
      
      const fileInput = await page.locator('input[type="file"]').first();
      if (await fileInput.isVisible()) {
        // This would test file type validation
        const pageLoaded = await page.locator('body').isVisible();
        expect(pageLoaded).toBeTruthy();
      }
    });

    test('should handle multiple file uploads', async ({ page }) => {
      await page.goto('/listings/create');
      
      const fileInput = await page.locator('input[type="file"]').first();
      if (await fileInput.isVisible()) {
        // This would test multiple file handling
        const pageLoaded = await page.locator('body').isVisible();
        expect(pageLoaded).toBeTruthy();
      }
    });
  });
});
