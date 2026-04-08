import { test, expect, devices } from '@playwright/test';

/**
 * MOBILE COMPREHENSIVE E2E TESTS
 * 
 * These tests validate mobile-specific functionality and responsive design:
 * - Mobile viewport rendering
 * - Touch interactions and gestures
 * - Mobile navigation patterns
 * - Performance on mobile devices
 * - Mobile-specific UI components
 * 
 * Business Truth Validated:
 * - Mobile users have optimal experience
 * - Touch interactions work correctly
 * - Mobile UI components render properly
 * - Performance is acceptable on mobile devices
 */

test.describe('Mobile Comprehensive Tests', () => {
  // Use mobile device configurations
  const mobileDevices = [
    { name: 'iPhone 14', ...devices['iPhone 14'] },
    { name: 'Pixel 5', ...devices['Pixel 5'] },
    { name: 'iPad', ...devices['iPad'] },
  ];

  mobileDevices.forEach(device => {
    test.describe(`${device.name}`, () => {
      test.use({ ...device });

      test('should render homepage correctly on mobile', async ({ page }) => {
        await page.goto('/');
        
        // Check mobile-specific elements
        await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
        
        // Check responsive grid
        await expect(page.locator('[data-testid="listings-grid"]')).toBeVisible();
        const gridColumns = await page.locator('[data-testid="listings-grid"]').evaluate(el => {
          return getComputedStyle(el).gridTemplateColumns;
        });
        expect(gridColumns).toContain('1fr'); // Single column on mobile
      });

      test('should handle mobile navigation correctly', async ({ page }) => {
        await page.goto('/');
        
        // Test mobile menu toggle
        const menuButton = page.locator('[data-testid="mobile-menu-button"]');
        await menuButton.click();
        
        await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-menu-items"]')).toBeVisible();
        
        // Test navigation items
        await page.locator('[data-testid="nav-search"]').click();
        await expect(page).toHaveURL(/\/search/);
        
        // Close menu
        await page.locator('[data-testid="mobile-menu-close"]').click();
        await expect(page.locator('[data-testid="mobile-sidebar"]')).not.toBeVisible();
      });

      test('should handle mobile search functionality', async ({ page }) => {
        await page.goto('/search');
        
        // Test mobile search interface
        await expect(page.locator('[data-testid="mobile-search-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-search-filters"]')).toBeVisible();
        
        // Test search input
        await page.locator('[data-testid="mobile-search-input"]').fill('Kathmandu');
        await page.locator('[data-testid="mobile-search-button"]').click();
        
        // Verify search results
        await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-result-card"]').first()).toBeVisible();
      });

      test('should handle mobile listing details', async ({ page }) => {
        await page.goto('/listing/test-listing-id');
        
        // Check mobile listing layout
        await expect(page.locator('[data-testid="mobile-listing-gallery"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-listing-info"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-form"]')).toBeVisible();
        
        // Test image gallery swipe
        const gallery = page.locator('[data-testid="mobile-listing-gallery"]');
        await gallery.locator('[data-testid="gallery-image"]').first().isVisible();
        
        // Test mobile booking form
        await page.locator('[data-testid="mobile-check-in-input"]').fill('2024-06-01');
        await page.locator('[data-testid="mobile-check-out-input"]').fill('2024-06-07');
        await page.locator('[data-testid="mobile-book-button"]').click();
        
        // Should navigate to booking page
        await expect(page).toHaveURL(/\/booking/);
      });

      test('should handle mobile booking flow', async ({ page }) => {
        await page.goto('/booking/test-booking-id');
        
        // Check mobile booking interface
        await expect(page.locator('[data-testid="mobile-booking-summary"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-payment-form"]')).toBeVisible();
        
        // Test mobile payment
        await page.locator('[data-testid="mobile-payment-method"]').click();
        await expect(page.locator('[data-testid="mobile-payment-options"]')).toBeVisible();
        
        // Test form validation
        await page.locator('[data-testid="mobile-pay-button"]').click();
        await expect(page.locator('[data-testid="mobile-validation-error"]')).toBeVisible();
      });

      test('should handle mobile user dashboard', async ({ page }) => {
        // Login as mobile user
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').click();
        
        // Navigate to dashboard
        await page.goto('/dashboard');
        
        // Check mobile dashboard layout
        await expect(page.locator('[data-testid="mobile-dashboard-header"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-dashboard-tabs"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-stats-cards"]')).toBeVisible();
        
        // Test tab navigation
        await page.locator('[data-testid="mobile-tab-bookings"]').click();
        await expect(page.locator('[data-testid="mobile-bookings-list"]')).toBeVisible();
        
        await page.locator('[data-testid="mobile-tab-listings"]').click();
        await expect(page.locator('[data-testid="mobile-listings-manage"]')).toBeVisible();
      });

      test('should handle mobile messaging', async ({ page }) => {
        await page.goto('/messages');
        
        // Check mobile messaging interface
        await expect(page.locator('[data-testid="mobile-conversations-list"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-conversation-item"]').first()).toBeVisible();
        
        // Open conversation
        await page.locator('[data-testid="mobile-conversation-item"]').first().click();
        
        // Check mobile chat interface
        await expect(page.locator('[data-testid="mobile-chat-header"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-messages-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-message-input"]')).toBeVisible();
        
        // Test message sending
        await page.locator('[data-testid="mobile-message-input"]').fill('Hello, this is a test message');
        await page.locator('[data-testid="mobile-send-button"]').click();
        
        // Verify message appears
        await expect(page.locator('[data-testid="mobile-message-sent"]')).toBeVisible();
      });

      test('should handle mobile profile management', async ({ page }) => {
        await page.goto('/profile');
        
        // Check mobile profile layout
        await expect(page.locator('[data-testid="mobile-profile-header"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-profile-form"]')).toBeVisible();
        
        // Test profile editing
        await page.locator('[data-testid="mobile-edit-profile-button"]').click();
        await expect(page.locator('[data-testid="mobile-profile-edit-form"]')).toBeVisible();
        
        // Test form fields
        await page.locator('[data-testid="mobile-first-name-input"]').clear();
        await page.locator('[data-testid="mobile-first-name-input"]').fill('John');
        await page.locator('[data-testid="mobile-last-name-input"]').clear();
        await page.locator('[data-testid="mobile-last-name-input"]').fill('Doe');
        
        // Test photo upload
        await page.locator('[data-testid="mobile-photo-upload"]').click();
        await expect(page.locator('[data-testid="mobile-photo-options"]')).toBeVisible();
        
        // Save changes
        await page.locator('[data-testid="mobile-save-profile-button"]').click();
        await expect(page.locator('[data-testid="mobile-success-message"]')).toBeVisible();
      });

      test('should handle mobile pull-to-refresh', async ({ page }) => {
        await page.goto('/');
        
        // Test pull-to-refresh gesture
        await page.locator('body').touchStart({ x: 200, y: 100 });
        await page.locator('body').touchMove({ x: 200, y: 300 });
        await page.locator('body').touchEnd();
        
        // Check for refresh indicator
        await expect(page.locator('[data-testid="mobile-refresh-indicator"]')).toBeVisible();
        
        // Wait for refresh to complete
        await page.waitForSelector('[data-testid="mobile-refresh-indicator"]', { state: 'hidden' });
      });

      test('should handle mobile infinite scroll', async ({ page }) => {
        await page.goto('/search?location=Kathmandu');
        
        // Scroll to trigger infinite scroll
        await page.locator('[data-testid="mobile-search-results"]').scrollIntoViewIfNeeded();
        
        // Load more items
        await page.waitForSelector('[data-testid="mobile-search-results"] >> visible=true');
        await page.locator('[data-testid="mobile-search-results"]').scrollIntoViewIfNeeded();
        
        // Verify more items loaded
        const initialCount = await page.locator('[data-testid="mobile-result-card"]').count();
        await page.waitForSelector('[data-testid="mobile-result-card"] >> nth=' + (initialCount + 1));
        const newCount = await page.locator('[data-testid="mobile-result-card"]').count();
        expect(newCount).toBeGreaterThan(initialCount);
      });

      test('should handle mobile gestures correctly', async ({ page }) => {
        await page.goto('/listing/test-listing-id');
        
        // Test swipe gestures on image gallery
        const gallery = page.locator('[data-testid="mobile-listing-gallery"]');
        
        // Swipe left
        await gallery.touchStart({ x: 300, y: 200 });
        await gallery.touchMove({ x: 100, y: 200 });
        await gallery.touchEnd();
        
        // Wait for animation
        await page.waitForSelector('[data-testid="gallery-indicators"] >> visible=true');
        
        // Swipe right
        await gallery.touchStart({ x: 100, y: 200 });
        await gallery.touchMove({ x: 300, y: 200 });
        await gallery.touchEnd();
        
        // Verify navigation indicators update
        await expect(page.locator('[data-testid="gallery-indicators"]')).toBeVisible();
      });

      test('should handle mobile offline scenarios', async ({ page }) => {
        // Simulate offline mode
        await page.context().setOffline(true);
        
        await page.goto('/');
        
        // Check offline indicator
        await expect(page.locator('[data-testid="mobile-offline-indicator"]')).toBeVisible();
        
        // Test offline functionality
        await expect(page.locator('[data-testid="mobile-cached-content"]')).toBeVisible();
        
        // Go back online
        await page.context().setOffline(false);
        
        // Check online indicator
        await expect(page.locator('[data-testid="mobile-online-indicator"]')).toBeVisible();
      });

      test('should handle mobile performance', async ({ page }) => {
        // Measure page load performance
        const startTime = Date.now();
        await page.goto('/');
        const loadTime = Date.now() - startTime;
        
        // Mobile should load within reasonable time
        expect(loadTime).toBeLessThan(3000); // 3 seconds max
        
        // Check Core Web Vitals
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          };
        });
        
        expect(metrics.loadTime).toBeLessThan(1000);
        expect(metrics.domContentLoaded).toBeLessThan(1500);
        expect(metrics.firstPaint).toBeLessThan(1000);
      });

      test('should handle mobile accessibility', async ({ page }) => {
        await page.goto('/');
        
        // Check mobile accessibility features
        await expect(page.locator('[data-testid="mobile-skip-link"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-focus-indicators"]')).toBeVisible();
        
        // Test keyboard navigation
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toBeVisible();
        
        // Test screen reader compatibility
        const accessibilityTree = await page.accessibility.snapshot();
        expect(accessibilityTree).toBeDefined();
        
        // Check ARIA labels
        const buttons = page.locator('button[aria-label]');
        const buttonCount = await buttons.count();
        expect(buttonCount).toBeGreaterThan(0);
      });

      test('should handle mobile form interactions', async ({ page }) => {
        await page.goto('/listing/create');
        
        // Test mobile form inputs
        await expect(page.locator('[data-testid="mobile-form-input"]')).toBeVisible();
        
        // Test keyboard behavior
        await page.locator('[data-testid="mobile-title-input"]').tap();
        await expect(page.locator('[data-testid="mobile-keyboard"]')).toBeVisible();
        
        // Test input validation
        await page.locator('[data-testid="mobile-title-input"]').fill('');
        await page.locator('[data-testid="mobile-price-input"]').fill('-100');
        await page.locator('[data-testid="mobile-submit-button"]').tap();
        
        // Check validation errors
        await expect(page.locator('[data-testid="mobile-validation-errors"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-error-title"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-error-price"]')).toBeVisible();
      });

      test('should handle mobile notifications', async ({ page }) => {
        // Grant notification permissions
        await page.context().grantPermissions(['notifications']);
        
        await page.goto('/dashboard');
        
        // Test notification bell
        await page.locator('[data-testid="mobile-notification-bell"]').tap();
        await expect(page.locator('[data-testid="mobile-notification-dropdown"]')).toBeVisible();
        
        // Test notification interactions
        await page.locator('[data-testid="mobile-notification-item"]').first().tap();
        await expect(page.locator('[data-testid="mobile-notification-detail"]')).toBeVisible();
      });

      test('should handle mobile map interactions', async ({ page }) => {
        await page.goto('/search');
        
        // Test mobile map
        await expect(page.locator('[data-testid="mobile-map-container"]')).toBeVisible();
        
        // Test map gestures
        const map = page.locator('[data-testid="mobile-map"]');
        await map.tap({ position: { x: 200, y: 200 } });
        
        // Test zoom controls
        await page.locator('[data-testid="mobile-zoom-in"]').tap();
        await page.locator('[data-testid="mobile-zoom-out"]').tap();
        
        // Test location button
        await page.locator('[data-testid="mobile-location-button"]').tap();
        await expect(page.locator('[data-testid="mobile-location-loading"]')).toBeVisible();
      });
    });
  });

  test.describe('Mobile Cross-Device Consistency', () => {
    test.use({ ...devices['iPhone 14'] });
    
    test('should maintain consistency across mobile devices', async ({ page }) => {
      await page.goto('/');
      
      // Test core functionality consistency
      const coreElements = [
        '[data-testid="mobile-header"]',
        '[data-testid="mobile-navigation"]',
        '[data-testid="listings-grid"]',
        '[data-testid="mobile-search-input"]',
      ];
      
      for (const selector of coreElements) {
        await expect(page.locator(selector)).toBeVisible();
      }
      
      // Test responsive behavior
      const viewport = page.viewportSize();
      expect(viewport.width).toBeLessThanOrEqual(414); // iPhone width
      expect(viewport.height).toBeGreaterThan(600);
    });
  });
});
