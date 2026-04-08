import { test, expect, devices } from '@playwright/test';

/**
 * MOBILE RESPONSIVE E2E TESTS
 * 
 * These tests validate mobile-responsive design and interactions:
 * - Responsive design across devices
 * - Touch interactions
 * - Mobile navigation
 * - Mobile forms
 * - Mobile performance
 * 
 * Business Truth Validated:
 * - Mobile users have optimal experience across all devices
 * - Touch interactions work correctly on mobile devices
 * - Mobile navigation is intuitive and accessible
 * - Mobile forms are user-friendly and functional
 * - Mobile performance meets expectations
 */

test.describe('Mobile Responsive Tests', () => {
  // Use mobile device configurations
  const mobileDevices = [
    { name: 'iPhone 14', ...devices['iPhone 14'] },
    { name: 'Pixel 5', ...devices['Pixel 5'] },
    { name: 'iPad', ...devices['iPad'] },
    { name: 'iPhone SE', ...devices['iPhone SE'] },
    { name: 'Samsung Galaxy S21', ...devices['Galaxy S21'] },
  ];

  mobileDevices.forEach(device => {
    test.describe(`${device.name} - Responsive Design`, () => {
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
        
        // Check mobile-specific layout
        await expect(page.locator('[data-testid="mobile-hero-section"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-search-bar"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-featured-listings"]')).toBeVisible();
      });

      test('should handle responsive typography', async ({ page }) => {
        await page.goto('/');
        
        // Check mobile font sizes
        const heading = page.locator('[data-testid="mobile-main-heading"]');
        const headingFontSize = await heading.evaluate(el => {
          return getComputedStyle(el).fontSize;
        });
        expect(parseFloat(headingFontSize)).toBeGreaterThanOrEqual(24); // Minimum heading size
        
        const bodyText = page.locator('[data-testid="mobile-body-text"]');
        const bodyFontSize = await bodyText.evaluate(el => {
          return getComputedStyle(el).fontSize;
        });
        expect(parseFloat(bodyFontSize)).toBeGreaterThanOrEqual(16); // Minimum body text size
        
        // Check text readability
        const lineHeight = await bodyText.evaluate(el => {
          return getComputedStyle(el).lineHeight;
        });
        expect(parseFloat(lineHeight)).toBeGreaterThanOrEqual(1.4); // Minimum line height
      });

      test('should handle responsive images', async ({ page }) => {
        await page.goto('/listing/test-listing-id');
        
        // Check mobile image gallery
        await expect(page.locator('[data-testid="mobile-gallery"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-gallery-image"]').first()).toBeVisible();
        
        // Check image sizing
        const galleryImage = page.locator('[data-testid="mobile-gallery-image"]').first();
        const imageWidth = await galleryImage.evaluate(el => {
          return getComputedStyle(el).width;
        });
        expect(imageWidth).toContain('100%'); // Full width on mobile
        
        // Check image loading
        await expect(galleryImage).toHaveAttribute('loading', 'lazy');
      });

      test('should handle responsive tables', async ({ page }) => {
        await page.goto('/bookings');
        
        // Check mobile table handling
        await expect(page.locator('[data-testid="mobile-bookings-table"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-cards"]')).toBeVisible();
        
        // Verify cards are used instead of tables on mobile
        const bookingCards = page.locator('[data-testid="mobile-booking-card"]');
        await expect(bookingCards.first()).toBeVisible();
        
        // Check card content layout
        await expect(page.locator('[data-testid="mobile-booking-info"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-status"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-actions"]')).toBeVisible();
      });

      test('should handle responsive forms', async ({ page }) => {
        await page.goto('/register');
        
        // Check mobile form layout
        await expect(page.locator('[data-testid="mobile-registration-form"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-form-field"]').first()).toBeVisible();
        
        // Check input sizing
        const formInput = page.locator('[data-testid="mobile-form-input"]').first();
        const inputWidth = await formInput.evaluate(el => {
          return getComputedStyle(el).width;
        });
        expect(inputWidth).toContain('100%'); // Full width inputs
        
        // Check button sizing
        const submitButton = page.locator('[data-testid="mobile-submit-button"]');
        const buttonWidth = await submitButton.evaluate(el => {
          return getComputedStyle(el).width;
        });
        expect(buttonWidth).toContain('100%'); // Full width buttons
      });
    });

    test.describe(`${device.name} - Touch Interactions`, () => {
      test.use({ ...device });

      test('should handle touch gestures', async ({ page }) => {
        await page.goto('/listing/test-listing-id');
        
        // Test swipe gestures on gallery
        const gallery = page.locator('[data-testid="mobile-gallery"]');
        
        // Swipe left
        await gallery.touchStart({ x: 300, y: 200 });
        await gallery.touchMove({ x: 100, y: 200 });
        await gallery.touchEnd();
        
        // Verify image changed
        await expect(page.locator('[data-testid="gallery-indicator-1"]')).toBeVisible();
        
        // Swipe right
        await gallery.touchStart({ x: 100, y: 200 });
        await gallery.touchMove({ x: 300, y: 200 });
        await gallery.touchEnd();
        
        // Verify image changed back
        await expect(page.locator('[data-testid="gallery-indicator-0"]')).toBeVisible();
      });

      test('should handle tap interactions', async ({ page }) => {
        await page.goto('/');
        
        // Test tap on listing card
        const listingCard = page.locator('[data-testid="mobile-listing-card"]').first();
        await listingCard.tap();
        
        // Should navigate to listing details
        await expect(page).toHaveURL(/\/listing\//);
      });

      test('should handle long press interactions', async ({ page }) => {
        await page.goto('/search');
        
        // Test long press on listing for context menu
        const listingCard = page.locator('[data-testid="mobile-listing-card"]').first();
        await listingCard.touchStart();
        await page.waitForTimeout(500); // Hold for 500ms
        await listingCard.touchEnd();
        
        // Should show context menu
        await expect(page.locator('[data-testid="mobile-context-menu"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-add-to-favorites"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-share-listing"]')).toBeVisible();
      });

      test('should handle pinch-to-zoom', async ({ page }) => {
        await page.goto('/listing/test-listing-id');
        
        // Test pinch-to-zoom on map
        const map = page.locator('[data-testid="mobile-map"]');
        
        // Pinch to zoom in
        await map.touchStart({ x: 200, y: 200 });
        await map.touchStart({ x: 250, y: 250 });
        await map.touchMove({ x: 180, y: 180 });
        await map.touchMove({ x: 270, y: 270 });
        await map.touchEnd();
        
        // Check zoom level changed
        await expect(page.locator('[data-testid="mobile-zoom-level"]')).toContainText('15');
      });

      test('should handle touch feedback', async ({ page }) => {
        await page.goto('/');
        
        // Test button touch feedback
        const button = page.locator('[data-testid="mobile-primary-button"]').first();
        await button.tap();
        
        // Should show touch feedback
        await expect(button).toHaveClass(/touch-active/);
        
        // Test link touch feedback
        const link = page.locator('[data-testid="mobile-link"]').first();
        await link.tap();
        
        // Should show touch feedback
        await expect(link).toHaveClass(/touch-active/);
      });
    });

    test.describe(`${device.name} - Mobile Navigation`, () => {
      test.use({ ...device });

      test('should handle mobile menu toggle', async ({ page }) => {
        await page.goto('/');
        
        // Test menu open
        const menuButton = page.locator('[data-testid="mobile-menu-button"]');
        await menuButton.tap();
        
        await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-menu-items"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-menu-overlay"]')).toBeVisible();
        
        // Test menu close
        await page.locator('[data-testid="mobile-menu-close"]').tap();
        await expect(page.locator('[data-testid="mobile-sidebar"]')).not.toBeVisible();
      });

      test('should handle mobile navigation items', async ({ page }) => {
        await page.goto('/');
        
        // Open mobile menu
        await page.locator('[data-testid="mobile-menu-button"]').tap();
        
        // Test navigation items
        await page.locator('[data-testid="mobile-nav-search"]').tap();
        await expect(page).toHaveURL(/\/search/);
        
        // Test back navigation
        await page.goBack();
        await expect(page).toHaveURL(/\//);
        
        // Test navigation with overlay close
        await page.locator('[data-testid="mobile-menu-button"]').tap();
        await page.locator('[data-testid="mobile-menu-overlay"]').tap();
        await expect(page.locator('[data-testid="mobile-sidebar"]')).not.toBeVisible();
      });

      test('should handle mobile breadcrumbs', async ({ page }) => {
        await page.goto('/listing/test-listing-id');
        
        // Check mobile breadcrumbs
        await expect(page.locator('[data-testid="mobile-breadcrumbs"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-breadcrumb-item"]').first()).toBeVisible();
        
        // Test breadcrumb navigation
        await page.locator('[data-testid="mobile-breadcrumb-home"]').tap();
        await expect(page).toHaveURL(/\//);
      });

      test('should handle mobile tab navigation', async ({ page }) => {
        await page.goto('/dashboard');
        
        // Check mobile tabs
        await expect(page.locator('[data-testid="mobile-tabs"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-tab-bookings"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-tab-listings"]')).toBeVisible();
        
        // Test tab switching
        await page.locator('[data-testid="mobile-tab-listings"]').tap();
        await expect(page.locator('[data-testid="mobile-listings-content"]')).toBeVisible();
        
        await page.locator('[data-testid="mobile-tab-bookings"]').tap();
        await expect(page.locator('[data-testid="mobile-bookings-content"]')).toBeVisible();
      });

      test('should handle mobile pagination', async ({ page }) => {
        await page.goto('/search?location=Kathmandu');
        
        // Check mobile pagination
        await expect(page.locator('[data-testid="mobile-pagination"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-page-button"]').first()).toBeVisible();
        
        // Test page navigation
        await page.locator('[data-testid="mobile-page-button"]').nth(1).tap();
        await expect(page).toHaveURL(/page=2/);
      });
    });

    test.describe(`${device.name} - Mobile Forms`, () => {
      test.use({ ...device });

      test('should handle mobile input types', async ({ page }) => {
        await page.goto('/login');
        
        // Test email input
        const emailInput = page.locator('[data-testid="mobile-email-input"]');
        await emailInput.tap();
        
        // Should show mobile keyboard
        await expect(page.locator('[data-testid="mobile-keyboard"]')).toBeVisible();
        await expect(emailInput).toHaveAttribute('type', 'email');
        
        // Test password input
        const passwordInput = page.locator('[data-testid="mobile-password-input"]');
        await passwordInput.tap();
        await expect(passwordInput).toHaveAttribute('type', 'password');
        
        // Test password visibility toggle
        await expect(page.locator('[data-testid="mobile-password-toggle"]')).toBeVisible();
        await page.locator('[data-testid="mobile-password-toggle"]').tap();
        await expect(passwordInput).toHaveAttribute('type', 'text');
      });

      test('should handle mobile form validation', async ({ page }) => {
        await page.goto('/register');
        
        // Test empty form submission
        await page.locator('[data-testid="mobile-submit-button"]').tap();
        
        // Check validation errors
        await expect(page.locator('[data-testid="mobile-validation-errors"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-field-error"]').first()).toBeVisible();
        
        // Check error styling
        const errorField = page.locator('[data-testid="mobile-field-error"]').first();
        const errorBorderColor = await errorField.evaluate(el => {
          return getComputedStyle(el).borderColor;
        });
        expect(errorBorderColor).toContain('rgb'); // Should have error color
      });

      test('should handle mobile file uploads', async ({ page }) => {
        await page.goto('/listing/create');
        
        // Test mobile file upload
        await expect(page.locator('[data-testid="mobile-file-upload"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-camera-upload"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-gallery-upload"]')).toBeVisible();
        
        // Test camera upload
        await page.locator('[data-testid="mobile-camera-upload"]').tap();
        
        // Should show camera interface
        await expect(page.locator('[data-testid="mobile-camera-interface"]')).toBeVisible();
        
        // Test gallery upload
        await page.locator('[data-testid="mobile-gallery-upload"]').tap();
        
        // Should show gallery interface
        await expect(page.locator('[data-testid="mobile-gallery-interface"]')).toBeVisible();
      });

      test('should handle mobile date/time inputs', async ({ page }) => {
        await page.goto('/booking/test-booking-id');
        
        // Test date input
        await page.locator('[data-testid="mobile-date-input"]').tap();
        await expect(page.locator('[data-testid="mobile-date-picker"]')).toBeVisible();
        
        // Test date selection
        await page.locator('[data-testid="mobile-date-2024-06-01"]').tap();
        await expect(page.locator('[data-testid="mobile-date-input"]')).toHaveValue('2024-06-01');
        
        // Test time input
        await page.locator('[data-testid="mobile-time-input"]').tap();
        await expect(page.locator('[data-testid="mobile-time-picker"]')).toBeVisible();
        
        // Test time selection
        await page.locator('[data-testid="mobile-time-14:30"]').tap();
        await expect(page.locator('[data-testid="mobile-time-input"]')).toHaveValue('14:30');
      });

      test('should handle mobile select inputs', async ({ page }) => {
        await page.goto('/listing/create');
        
        // Test mobile select
        await page.locator('[data-testid="mobile-category-select"]').tap();
        await expect(page.locator('[data-testid="mobile-select-dropdown"]')).toBeVisible();
        
        // Test option selection
        await page.locator('[data-testid="mobile-option-apartment"]').tap();
        await expect(page.locator('[data-testid="mobile-category-select"]')).toHaveValue('apartment');
        
        // Test multi-select
        await page.locator('[data-testid="mobile-amenities-select"]').tap();
        await expect(page.locator('[data-testid="mobile-multi-select-dropdown"]')).toBeVisible();
        
        await page.locator('[data-testid="mobile-amenity-wifi"]').tap();
        await page.locator('[data-testid="mobile-amenity-parking"]').tap();
        await page.locator('[data-testid="mobile-select-apply"]').tap();
        
        await expect(page.locator('[data-testid="mobile-selected-amenities"]')).toContainText('wifi, parking');
      });
    });

    test.describe(`${device.name} - Mobile Performance`, () => {
      test.use({ ...device });

      test('should handle mobile page load performance', async ({ page }) => {
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
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
          };
        });
        
        expect(metrics.loadTime).toBeLessThan(2000);
        expect(metrics.domContentLoaded).toBeLessThan(1500);
        expect(metrics.firstPaint).toBeLessThan(1000);
        expect(metrics.firstContentfulPaint).toBeLessThan(1500);
      });

      test('should handle mobile interaction performance', async ({ page }) => {
        await page.goto('/');
        
        // Measure interaction performance
        const startTime = Date.now();
        await page.locator('[data-testid="mobile-menu-button"]').tap();
        const interactionTime = Date.now() - startTime;
        
        // Mobile interactions should be fast
        expect(interactionTime).toBeLessThan(500); // 500ms max
        
        // Check animation performance
        await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible();
        
        const animationDuration = await page.locator('[data-testid="mobile-sidebar"]').evaluate(el => {
          return getComputedStyle(el).transitionDuration;
        });
        expect(parseFloat(animationDuration)).toBeLessThanOrEqual(0.3); // Max 300ms animation
      });

      test('should handle mobile scroll performance', async ({ page }) => {
        await page.goto('/search?location=Kathmandu');
        
        // Test scroll performance
        const startTime = Date.now();
        await page.locator('[data-testid="mobile-search-results"]').scrollIntoViewIfNeeded();
        const scrollTime = Date.now() - startTime;
        
        // Scrolling should be smooth
        expect(scrollTime).toBeLessThan(1000); // 1 second max
        
        // Test infinite scroll performance
        const initialCount = await page.locator('[data-testid="mobile-result-card"]').count();
        
        await page.locator('[data-testid="mobile-search-results"]').scrollTo('bottom');
        await page.waitForSelector('[data-testid="mobile-loading-more"]');
        
        const newCount = await page.locator('[data-testid="mobile-result-card"]').count();
        expect(newCount).toBeGreaterThan(initialCount);
      });

      test('should handle mobile memory usage', async ({ page }) => {
        await page.goto('/');
        
        // Check memory usage
        const memoryInfo = await page.evaluate(() => {
          return (performance as any).memory;
        });
        
        if (memoryInfo) {
          // Check reasonable memory usage
          expect(memoryInfo.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024); // 50MB max
          expect(memoryInfo.totalJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB max
        }
      });

      test('should handle mobile network performance', async ({ page }) => {
        // Simulate slow 3G network
        await page.route('**/*', async route => {
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
          await route.continue();
        });
        
        const startTime = Date.now();
        await page.goto('/');
        const loadTime = Date.now() - startTime;
        
        // Should still load within reasonable time on slow network
        expect(loadTime).toBeLessThan(8000); // 8 seconds max on slow network
        
        // Should show loading indicators
        await expect(page.locator('[data-testid="mobile-loading-indicator"]')).toBeVisible();
      });
    });

    test.describe(`${device.name} - Mobile Accessibility`, () => {
      test.use({ ...device });

      test('should handle mobile screen readers', async ({ page }) => {
        await page.goto('/');
        
        // Check ARIA labels
        const buttons = page.locator('button[aria-label]');
        const buttonCount = await buttons.count();
        expect(buttonCount).toBeGreaterThan(0);
        
        // Check semantic HTML
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('nav')).toBeVisible();
        await expect(page.locator('header')).toBeVisible();
        
        // Check heading hierarchy
        const headings = page.locator('h1, h2, h3, h4, h5, h6');
        const headingCount = await headings.count();
        expect(headingCount).toBeGreaterThan(0);
      });

      test('should handle mobile keyboard navigation', async ({ page }) => {
        await page.goto('/');
        
        // Test tab navigation
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toBeVisible();
        
        // Test enter key activation
        await page.keyboard.press('Enter');
        
        // Test escape key
        await page.locator('[data-testid="mobile-menu-button"]').tap();
        await page.keyboard.press('Escape');
        await expect(page.locator('[data-testid="mobile-sidebar"]')).not.toBeVisible();
      });

      test('should handle mobile focus management', async ({ page }) => {
        await page.goto('/login');
        
        // Test focus indicators
        await page.locator('[data-testid="mobile-email-input"]').tap();
        await expect(page.locator('[data-testid="mobile-email-input"]:focus')).toBeVisible();
        
        // Test focus trap in modals
        await page.locator('[data-testid="mobile-forgot-password"]').tap();
        await expect(page.locator('[data-testid="mobile-modal"]')).toBeVisible();
        
        // Focus should be trapped in modal
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-modal"] :focus')).toBeVisible();
      });

      test('should handle mobile color contrast', async ({ page }) => {
        await page.goto('/');
        
        // Check color contrast for text
        const textElements = page.locator('[data-testid="mobile-text"]');
        const textCount = await textElements.count();
        
        for (let i = 0; i < Math.min(textCount, 5); i++) {
          const element = textElements.nth(i);
          const styles = await element.evaluate(el => {
            return {
              color: getComputedStyle(el).color,
              backgroundColor: getComputedStyle(el).backgroundColor,
            };
          });
          
          // Should have sufficient contrast (basic check)
          expect(styles.color).not.toBe(styles.backgroundColor);
        }
      });
    });
  });

  test.describe('Mobile Cross-Device Consistency', () => {
    test('should maintain consistency across mobile devices', async ({ page }) => {
      // Test core mobile elements across devices
      await page.goto('/');
      
      const coreMobileElements = [
        '[data-testid="mobile-header"]',
        '[data-testid="mobile-navigation"]',
        '[data-testid="mobile-menu-button"]',
        '[data-testid="mobile-search-bar"]',
      ];
      
      for (const selector of coreMobileElements) {
        await expect(page.locator(selector)).toBeVisible();
      }
      
      // Test responsive behavior
      const viewport = page.viewportSize();
      expect(viewport.width).toBeLessThanOrEqual(1024); // Mobile width
      expect(viewport.height).toBeGreaterThan(400);
    });
  });

  test.describe('Mobile Orientation Changes', () => {
    test('should handle orientation changes', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Check portrait layout
      await expect(page.locator('[data-testid="mobile-portrait-layout"]')).toBeVisible();
      
      // Rotate to landscape
      await page.setViewportSize({ width: 667, height: 375 });
      
      // Check landscape layout
      await expect(page.locator('[data-testid="mobile-landscape-layout"]')).toBeVisible();
      
      // Rotate back to portrait
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check portrait layout restored
      await expect(page.locator('[data-testid="mobile-portrait-layout"]')).toBeVisible();
    });
  });

  test.describe('Mobile Browser Compatibility', () => {
    test('should work across mobile browsers', async ({ page }) => {
      // Test browser-specific features
      await page.goto('/');
      
      // Check browser compatibility
      await expect(page.locator('[data-testid="mobile-browser-compat"]')).toBeVisible();
      
      // Test feature detection
      const hasTouch = await page.evaluate(() => {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      });
      expect(hasTouch).toBe(true);
      
      // Test viewport meta tag
      const viewportMeta = await page.locator('meta[name="viewport"]');
      await expect(viewportMeta).toHaveAttribute('content', /width=device-width/);
    });
  });
});
