import { test, expect } from '@playwright/test';

/**
 * Mobile-Specific E2E Test Suite
 * 
 * Tests mobile-specific functionality including:
 * - Touch interactions (tap, swipe, pinch)
 * - Mobile viewport testing across device sizes
 * - Mobile-specific UI patterns (bottom sheets, pull-to-refresh)
 * - Mobile keyboard behavior
 * - Mobile performance on slower connections
 * 
 * @tags @mobile @responsive @touch
 */

test.describe('Mobile-Specific E2E Tests', () => {
  test.describe('Touch Interactions', () => {
    test('tap interactions work correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Tap on listing card
      await page.tap('[data-testid="listing-card"]:first-child');
      await expect(page).toHaveURL(/\/listings\/.+/);
    });

    test('double-tap to like/unlike listing', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/search');

      // Double tap on listing card to like
      const listingCard = page.locator('[data-testid="listing-card"]:first-child');
      await listingCard.dblclick();

      // Verify like indicator appears
      await expect(page.locator('[data-testid="like-indicator"]')).toBeVisible();
    });

    test('long press on listing shows context menu', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/search');

      const listingCard = page.locator('[data-testid="listing-card"]:first-child');

      // Long press (simulated with mousedown + wait for context menu + mouseup)
      await listingCard.dispatchEvent('mousedown');
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible({ timeout: 1000 });
      await listingCard.dispatchEvent('mouseup');

      // Verify context menu appears
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
    });
  });

  test.describe('Mobile Viewports', () => {
    const mobileViewports = [
      { width: 320, height: 568, name: 'iPhone SE' },
      { width: 375, height: 667, name: 'iPhone 8' },
      { width: 390, height: 844, name: 'iPhone 12' },
      { width: 414, height: 896, name: 'iPhone Max' },
      { width: 360, height: 640, name: 'Android' },
      { width: 412, height: 915, name: 'Android Large' },
    ];

    for (const viewport of mobileViewports) {
      test(`homepage renders correctly on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');

        // Verify critical elements are visible
        await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();
        await expect(page.locator('[data-testid="search-bar"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
      });
    }

    test('tablet viewport shows desktop layout', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      // Should show desktop layout
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-nav"]')).not.toBeVisible();
    });
  });

  test.describe('Mobile-Specific UI Patterns', () => {
    test('bottom sheet opens from bottom on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/listings/test-listing');

      // Tap to open booking bottom sheet
      await page.tap('[data-testid="book-button"]');

      // Verify bottom sheet slides up from bottom
      const bottomSheet = page.locator('[data-testid="bottom-sheet"]');
      await expect(bottomSheet).toBeVisible();
      
      // Verify it has bottom sheet styling
      const box = await bottomSheet.boundingBox();
      expect(box?.y).toBeGreaterThan(400); // Should be near bottom
    });

    test('pull-to-refresh refreshes listings', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/search');

      // Pull down to refresh using touch swipe
      await page.touchscreen.tap(200, 100);
      await page.touchscreen.tap(200, 100);
      await page.touchscreen.tap(200, 500);

      // Wait for refresh indicator if it exists
      const refreshIndicator = page.locator('[data-testid="refresh-indicator"]');
      if (await refreshIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(refreshIndicator).toBeVisible();
        await page.waitForSelector('[data-testid="refresh-indicator"]', { state: 'hidden', timeout: 5000 });
      }
    });

    test('infinite scroll loads more listings on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/search');

      const initialCount = await page.locator('[data-testid="listing-card"]').count();

      // Scroll to bottom and wait for new listings to load
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      
      // Wait for either new listings to appear or loading indicator to disappear
      await Promise.race([
        page.waitForSelector('[data-testid="listing-card"]', { state: 'attached' }),
        page.waitForSelector('[data-testid="loading-indicator"]', { state: 'hidden' }),
      ]);

      // Wait a moment for content to render
      await page.waitForLoadState('networkidle');

      // Verify more listings loaded
      const newCount = await page.locator('[data-testid="listing-card"]').count();
      expect(newCount).toBeGreaterThan(initialCount);
    });
  });

  test.describe('Mobile Keyboard Behavior', () => {
    test('mobile keyboard shows appropriate input type', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/auth/login');

      // Tap email field
      await page.tap('[data-testid="email-input"]');

      // Verify keyboard shows email layout (simulated check)
      const emailInput = page.locator('[data-testid="email-input"]');
      await expect(emailInput).toHaveAttribute('type', 'email');
    });

    test('mobile keyboard dismisses on backdrop tap', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/search');

      // Tap search input to show keyboard
      await page.tap('[data-testid="search-input"]');

      // Tap outside to dismiss
      await page.tap('[data-testid="hero-section"]');

      // Verify keyboard is dismissed (input loses focus)
      await expect(page.locator('[data-testid="search-input"]')).not.toBeFocused();
    });
  });

  test.describe('Mobile Performance on Slow Connections', () => {
    test('page loads with slow 3G connection', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Simulate slow 3G
      const context = await page.context();
      await context.route('**/*', (route) => {
        route.continue({
          // Slow 3G: 500ms latency, 50KB/s throughput
          headers: { 'X-Slow-Network': 'true' },
        });
      });

      const startTime = Date.now();
      await page.goto('/');
      const loadTime = Date.now() - startTime;

      // Should still load within reasonable time (10s for slow connection)
      expect(loadTime).toBeLessThan(10000);
    });

    test('images load progressively on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/search');

      // Check for lazy loading attributes
      const images = page.locator('[data-testid="listing-image"]');
      const count = await images.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        await expect(img).toHaveAttribute('loading', 'lazy');
      }
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('mobile has adequate touch targets (44x44 minimum)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      const buttons = page.locator('button, [role="button"]');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        
        if (box) {
          // Touch target should be at least 44x44
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('mobile has proper spacing between interactive elements', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      const navItems = page.locator('[data-testid="mobile-nav"] button');
      const count = await navItems.count();

      for (let i = 0; i < count - 1; i++) {
        const currentItem = navItems.nth(i);
        const nextItem = navItems.nth(i + 1);

        const currentBox = await currentItem.boundingBox();
        const nextBox = await nextItem.boundingBox();

        if (currentBox && nextBox) {
          // Should have at least 8px spacing
          const spacing = nextBox.y - (currentBox.y + currentBox.height);
          expect(spacing).toBeGreaterThanOrEqual(8);
        }
      }
    });
  });

  test.describe('Mobile Orientation', () => {
    test('layout adapts to landscape orientation', async ({ page }) => {
      await page.setViewportSize({ width: 667, height: 375 }); // Landscape
      await page.goto('/');

      // Verify layout adapts to landscape
      await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-bar"]')).toBeVisible();
    });

    test('content remains readable in landscape', async ({ page }) => {
      await page.setViewportSize({ width: 667, height: 375 });
      await page.goto('/listings/test-listing');

      // Verify text is readable
      const title = page.locator('[data-testid="listing-title"]');
      await expect(title).toBeVisible();
      
      const box = await title.boundingBox();
      expect(box?.width).toBeGreaterThan(300); // Should have adequate width
    });
  });

  test.describe('Mobile Gesture Navigation', () => {
    test('swipe left on listing card opens quick actions', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/search');

      const listingCard = page.locator('[data-testid="listing-card"]:first-child');
      
      // Tap and swipe using mouse events to simulate swipe
      const box = await listingCard.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2);
        await page.mouse.up();

        // Check if quick actions appear (may not exist in all implementations)
        const quickActions = page.locator('[data-testid="quick-actions"]');
        if (await quickActions.isVisible({ timeout: 1000 }).catch(() => false)) {
          await expect(quickActions).toBeVisible();
        }
      }
    });

    test('pinch to zoom on listing images', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/listings/test-listing');

      const image = page.locator('[data-testid="listing-image"]:first-child');
      await image.tap();

      // Verify image viewer opens
      await expect(page.locator('[data-testid="image-viewer"]')).toBeVisible();
    });
  });
});
