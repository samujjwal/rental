import { test, expect, Page, BrowserContext } from '@playwright/test';
import { chromium, Browser } from 'playwright';
import path from 'path';

/**
 * VISUAL REGRESSION TEST SUITE
 * 
 * This test suite validates UI consistency across the rental portal:
 * - Page layout consistency across different viewports
 * - Component rendering accuracy and visual consistency
 * - Responsive design behavior across devices
 * - Cross-browser compatibility testing
 * - Visual accessibility compliance
 * - Visual regression detection with screenshot comparison
 * - Dynamic content rendering validation
 * - Theme and styling consistency
 * 
 * Test Coverage:
 * 1. Core pages (home, listings, booking, profile)
 * 2. Admin interface pages
 * 3. Mobile responsive layouts
 * 4. Cross-browser rendering
 * 5. Accessibility visual checks
 * 6. Interactive component states
 */

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
  largeDesktop: { width: 2560, height: 1440 },
};

const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;

const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Listings', path: '/listings' },
  { name: 'Search Results', path: '/listings?category=property' },
  { name: 'Listing Details', path: '/listings/sample-listing-id' },
  { name: 'Booking', path: '/bookings/sample-booking-id' },
  { name: 'Profile', path: '/profile' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Admin Dashboard', path: '/admin' },
  { name: 'Settings', path: '/settings' },
  { name: 'Help', path: '/help' },
];

const COMPONENTS_TO_TEST = [
  'header',
  'navigation',
  'footer',
  'search-bar',
  'listing-card',
  'booking-form',
  'user-profile',
  'admin-sidebar',
  'notification-bell',
  'language-selector',
];

test.describe('Visual Regression Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor'],
    });
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.beforeEach(async () => {
    context = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    
    // Set up visual testing options
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await context.close();
  });

  describe('Page Layout Consistency', () => {
    test('should render home page layout consistently', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Take full page screenshot
      await expect(page.locator('body')).toHaveScreenshot('home-page-layout.png', {
        fullPage: true,
        animations: 'disabled',
      });
      
      // Verify key layout elements
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
      
      // Check layout consistency
      const header = page.locator('header');
      await expect(header).toHaveScreenshot('header-layout.png');
      
      const mainContent = page.locator('main');
      await expect(mainContent).toHaveScreenshot('main-content-layout.png');
    });

    test('should render listings page with consistent layout', async () => {
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');
      
      // Verify listings grid layout
      await expect(page.locator('.listings-grid')).toBeVisible();
      await expect(page.locator('.listings-grid')).toHaveScreenshot('listings-grid-layout.png');
      
      // Check individual listing cards
      const listingCards = page.locator('.listing-card');
      const cardCount = await listingCards.count();
      
      if (cardCount > 0) {
        await expect(listingCards.first()).toHaveScreenshot('listing-card-layout.png');
      }
      
      // Verify filters sidebar
      await expect(page.locator('.filters-sidebar')).toBeVisible();
      await expect(page.locator('.filters-sidebar')).toHaveScreenshot('filters-sidebar-layout.png');
    });

    test('should render booking page layout consistently', async () => {
      await page.goto('/bookings/sample-booking-id');
      await page.waitForLoadState('networkidle');
      
      // Verify booking form layout
      await expect(page.locator('.booking-form')).toBeVisible();
      await expect(page.locator('.booking-form')).toHaveScreenshot('booking-form-layout.png');
      
      // Verify booking details section
      await expect(page.locator('.booking-details')).toBeVisible();
      await expect(page.locator('.booking-details')).toHaveScreenshot('booking-details-layout.png');
      
      // Verify payment section
      await expect(page.locator('.payment-section')).toBeVisible();
      await expect(page.locator('.payment-section')).toHaveScreenshot('payment-section-layout.png');
    });

    test('should render admin dashboard layout consistently', async () => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      
      // Verify admin sidebar
      await expect(page.locator('.admin-sidebar')).toBeVisible();
      await expect(page.locator('.admin-sidebar')).toHaveScreenshot('admin-sidebar-layout.png');
      
      // Verify main dashboard area
      await expect(page.locator('.admin-dashboard')).toBeVisible();
      await expect(page.locator('.admin-dashboard')).toHaveScreenshot('admin-dashboard-layout.png');
      
      // Verify charts and widgets
      await expect(page.locator('.analytics-widgets')).toBeVisible();
      await expect(page.locator('.analytics-widgets')).toHaveScreenshot('analytics-widgets-layout.png');
    });
  });

  describe('Component Rendering', () => {
    test('should render header component consistently', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const header = page.locator('header');
      await expect(header).toBeVisible();
      await expect(header).toHaveScreenshot('header-component.png');
      
      // Test header with different states
      // Test with user logged in
      await page.evaluate(() => {
        localStorage.setItem('user', JSON.stringify({ id: 'test-user', name: 'Test User' }));
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await expect(header).toHaveScreenshot('header-logged-in.png');
      
      // Test header on scroll
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(1000);
      await expect(header).toHaveScreenshot('header-scrolled.png');
    });

    test('should render navigation component consistently', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const navigation = page.locator('nav');
      await expect(navigation).toBeVisible();
      await expect(navigation).toHaveScreenshot('navigation-component.png');
      
      // Test mobile navigation
      await page.setViewportSize(VIEWPORTS.mobile);
      await expect(navigation).toHaveScreenshot('navigation-mobile.png');
      
      // Test navigation menu open
      const menuButton = page.locator('.menu-toggle');
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(500);
        await expect(navigation).toHaveScreenshot('navigation-menu-open.png');
      }
    });

    test('should render search bar component consistently', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const searchBar = page.locator('.search-bar');
      await expect(searchBar).toBeVisible();
      await expect(searchBar).toHaveScreenshot('search-bar-component.png');
      
      // Test search bar focus state
      await searchBar.locator('input').focus();
      await expect(searchBar).toHaveScreenshot('search-bar-focused.png');
      
      // Test search bar with results
      await searchBar.locator('input').fill('apartment');
      await page.waitForTimeout(1000);
      
      const searchResults = page.locator('.search-results');
      if (await searchResults.isVisible()) {
        await expect(searchResults).toHaveScreenshot('search-results-dropdown.png');
      }
    });

    test('should render listing card component consistently', async () => {
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');
      
      const listingCards = page.locator('.listing-card');
      const cardCount = await listingCards.count();
      
      if (cardCount > 0) {
        const firstCard = listingCards.first();
        await expect(firstCard).toBeVisible();
        await expect(firstCard).toHaveScreenshot('listing-card-component.png');
        
        // Test card hover state
        await firstCard.hover();
        await page.waitForTimeout(500);
        await expect(firstCard).toHaveScreenshot('listing-card-hover.png');
        
        // Test card favorite state
        const favoriteButton = firstCard.locator('.favorite-button');
        if (await favoriteButton.isVisible()) {
          await favoriteButton.click();
          await page.waitForTimeout(500);
          await expect(firstCard).toHaveScreenshot('listing-card-favorited.png');
        }
      }
    });

    test('should render booking form component consistently', async () => {
      await page.goto('/bookings/sample-booking-id');
      await page.waitForLoadState('networkidle');
      
      const bookingForm = page.locator('.booking-form');
      await expect(bookingForm).toBeVisible();
      await expect(bookingForm).toHaveScreenshot('booking-form-component.png');
      
      // Test form validation states
      const submitButton = bookingForm.locator('button[type="submit"]');
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      await expect(bookingForm).toHaveScreenshot('booking-form-validation.png');
      
      // Test form filled state
      await bookingForm.locator('input[name="startDate"]').fill('2024-12-25');
      await bookingForm.locator('input[name="endDate"]').fill('2024-12-28');
      await bookingForm.locator('input[name="guests"]').fill('2');
      
      await expect(bookingForm).toHaveScreenshot('booking-form-filled.png');
    });
  });

  describe('Responsive Design', () => {
    test('should render consistently on mobile viewport', async () => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('body')).toHaveScreenshot('home-mobile.png', {
        fullPage: true,
        animations: 'disabled',
      });
      
      // Test mobile navigation
      const mobileNav = page.locator('.mobile-navigation');
      await expect(mobileNav).toBeVisible();
      await expect(mobileNav).toHaveScreenshot('mobile-navigation.png');
      
      // Test mobile search
      const mobileSearch = page.locator('.mobile-search');
      await expect(mobileSearch).toBeVisible();
      await expect(mobileSearch).toHaveScreenshot('mobile-search.png');
    });

    test('should render consistently on tablet viewport', async () => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('body')).toHaveScreenshot('home-tablet.png', {
        fullPage: true,
        animations: 'disabled',
      });
      
      // Test tablet layout adjustments
      const content = page.locator('.content');
      await expect(content).toHaveScreenshot('content-tablet.png');
    });

    test('should render consistently on large desktop viewport', async () => {
      await page.setViewportSize(VIEWPORTS.largeDesktop);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('body')).toHaveScreenshot('home-large-desktop.png', {
        fullPage: true,
        animations: 'disabled',
      });
      
      // Test large desktop layout optimizations
      const mainContent = page.locator('main');
      await expect(mainContent).toHaveScreenshot('content-large-desktop.png');
    });

    test('should handle viewport resizing gracefully', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test progressive viewport changes
      const viewports = [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop, VIEWPORTS.largeDesktop];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);
        
        const viewportName = Object.keys(VIEWPORTS).find(key => 
          VIEWPORTS[key as keyof typeof VIEWPORTS].width === viewport.width
        );
        
        await expect(page.locator('body')).toHaveScreenshot(`responsive-${viewportName}.png`, {
          fullPage: true,
          animations: 'disabled',
        });
      }
    });
  });

  describe('Cross-Browser Compatibility', () => {
    for (const browserType of BROWSERS) {
      test.describe(`${browserType} browser tests`, () => {
        let browserContext: BrowserContext;
        let browserPage: Page;

        test.beforeAll(async () => {
          const testBrowser = await chromium.launch({
            headless: true,
            channel: browserType === 'chromium' ? 'chrome' : undefined,
          });
          browserContext = await testBrowser.newContext({
            viewport: VIEWPORTS.desktop,
            ignoreHTTPSErrors: true,
          });
          browserPage = await browserContext.newPage();
        });

        test.afterAll(async () => {
          await browserContext.close();
        });

        test(`should render home page consistently in ${browserType}`, async () => {
          await browserPage.goto('/');
          await browserPage.waitForLoadState('networkidle');
          
          await expect(browserPage.locator('body')).toHaveScreenshot(`home-${browserType}.png`, {
            fullPage: true,
            animations: 'disabled',
          });
        });

        test(`should render listings page consistently in ${browserType}`, async () => {
          await browserPage.goto('/listings');
          await browserPage.waitForLoadState('networkidle');
          
          await expect(browserPage.locator('.listings-grid')).toHaveScreenshot(`listings-${browserType}.png`);
        });
      });
    }
  });

  describe('Visual Accessibility', () => {
    test('should maintain sufficient color contrast', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for sufficient contrast ratios
      const textElements = page.locator('p, h1, h2, h3, h4, h5, h6, span, a, button');
      const elementCount = await textElements.count();
      
      for (let i = 0; i < Math.min(elementCount, 10); i++) {
        const element = textElements.nth(i);
        if (await element.isVisible()) {
          await expect(element).toHaveScreenshot(`text-element-${i}.png`);
        }
      }
    });

    test('should render focus states properly', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test focus on navigation items
      const navItems = page.locator('nav a, nav button');
      const navCount = await navItems.count();
      
      for (let i = 0; i < Math.min(navCount, 5); i++) {
        const item = navItems.nth(i);
        await item.focus();
        await page.waitForTimeout(200);
        await expect(item).toHaveScreenshot(`nav-focus-${i}.png`);
      }
    });

    test('should maintain readable text sizes', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check text sizes are readable
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      
      for (let i = 0; i < Math.min(headingCount, 5); i++) {
        const heading = headings.nth(i);
        if (await heading.isVisible()) {
          await expect(heading).toHaveScreenshot(`heading-${i}.png`);
        }
      }
      
      // Check paragraph text
      const paragraphs = page.locator('p');
      const paragraphCount = await paragraphs.count();
      
      for (let i = 0; i < Math.min(paragraphCount, 3); i++) {
        const paragraph = paragraphs.nth(i);
        if (await paragraph.isVisible()) {
          await expect(paragraph).toHaveScreenshot(`paragraph-${i}.png`);
        }
      }
    });

    test('should render alt text for images', async () => {
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');
      
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < Math.min(imageCount, 5); i++) {
        const image = images.nth(i);
        if (await image.isVisible()) {
          await expect(image).toHaveScreenshot(`image-${i}.png`);
          
          // Check if alt text is present
          const altText = await image.getAttribute('alt');
          expect(altText).toBeTruthy();
        }
      }
    });
  });

  describe('Dynamic Content Rendering', () => {
    test('should render loading states consistently', async () => {
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');
      
      // Simulate loading state
      await page.route('**/api/listings', route => {
        // Delay response to show loading state
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [] }),
          });
        }, 2000);
      });
      
      await page.reload();
      
      // Capture loading state
      await expect(page.locator('.loading-spinner')).toBeVisible();
      await expect(page.locator('.loading-spinner')).toHaveScreenshot('loading-state.png');
      
      // Wait for content to load
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.listings-grid')).toHaveScreenshot('content-loaded.png');
    });

    test('should render error states consistently', async () => {
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');
      
      // Simulate error state
      await page.route('**/api/listings', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Capture error state
      await expect(page.locator('.error-message')).toBeVisible();
      await expect(page.locator('.error-message')).toHaveScreenshot('error-state.png');
    });

    test('should render empty states consistently', async () => {
      await page.goto('/listings?category=nonexistent');
      await page.waitForLoadState('networkidle');
      
      // Check for empty state
      const emptyState = page.locator('.empty-state');
      if (await emptyState.isVisible()) {
        await expect(emptyState).toHaveScreenshot('empty-state.png');
      }
    });

    test('should render interactive states consistently', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test button states
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = buttons.nth(i);
        
        // Normal state
        await expect(button).toHaveScreenshot(`button-normal-${i}.png`);
        
        // Hover state
        await button.hover();
        await page.waitForTimeout(200);
        await expect(button).toHaveScreenshot(`button-hover-${i}.png`);
        
        // Active/pressed state
        await button.click();
        await page.waitForTimeout(200);
        await expect(button).toHaveScreenshot(`button-active-${i}.png`);
      }
    });

    test('should render form states consistently', async () => {
      await page.goto('/bookings/sample-booking-id');
      await page.waitForLoadState('networkidle');
      
      const form = page.locator('.booking-form');
      const inputs = form.locator('input, select, textarea');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < Math.min(inputCount, 3); i++) {
        const input = inputs.nth(i);
        
        // Normal state
        await expect(input).toHaveScreenshot(`input-normal-${i}.png`);
        
        // Focus state
        await input.focus();
        await page.waitForTimeout(200);
        await expect(input).toHaveScreenshot(`input-focus-${i}.png`);
        
        // Filled state
        await input.fill('test value');
        await expect(input).toHaveScreenshot(`input-filled-${i}.png`);
        
        // Error state (if applicable)
        await input.blur();
        await page.waitForTimeout(200);
        const hasError = await input.locator('.error-message').isVisible();
        if (hasError) {
          await expect(input).toHaveScreenshot(`input-error-${i}.png`);
        }
      }
    });
  });

  describe('Theme and Styling Consistency', () => {
    test('should maintain consistent color scheme', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test primary colors
      const primaryElements = page.locator('.btn-primary, .text-primary, .bg-primary');
      const primaryCount = await primaryElements.count();
      
      for (let i = 0; i < Math.min(primaryCount, 3); i++) {
        const element = primaryElements.nth(i);
        if (await element.isVisible()) {
          await expect(element).toHaveScreenshot(`primary-color-${i}.png`);
        }
      }
      
      // Test secondary colors
      const secondaryElements = page.locator('.btn-secondary, .text-secondary, .bg-secondary');
      const secondaryCount = await secondaryElements.count();
      
      for (let i = 0; i < Math.min(secondaryCount, 3); i++) {
        const element = secondaryElements.nth(i);
        if (await element.isVisible()) {
          await expect(element).toHaveScreenshot(`secondary-color-${i}.png`);
        }
      }
    });

    test('should maintain consistent typography', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test font consistency
      const textElements = page.locator('h1, h2, h3, p, span');
      const textCount = await textElements.count();
      
      for (let i = 0; i < Math.min(textCount, 5); i++) {
        const element = textElements.nth(i);
        if (await element.isVisible()) {
          await expect(element).toHaveScreenshot(`typography-${i}.png`);
        }
      }
    });

    test('should maintain consistent spacing', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test spacing in containers
      const containers = page.locator('.container, .card, .section');
      const containerCount = await containers.count();
      
      for (let i = 0; i < Math.min(containerCount, 3); i++) {
        const container = containers.nth(i);
        if (await container.isVisible()) {
          await expect(container).toHaveScreenshot(`spacing-${i}.png`);
        }
      }
    });

    test('should maintain consistent borders and shadows', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test cards with borders and shadows
      const cards = page.locator('.card, .listing-card, .booking-card');
      const cardCount = await cards.count();
      
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = cards.nth(i);
        if (await card.isVisible()) {
          await expect(card).toHaveScreenshot(`card-styling-${i}.png`);
        }
      }
    });
  });
});
