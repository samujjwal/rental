import { test, expect, Page } from '@playwright/test';

/**
 * Visual Regression Test Suite
 * 
 * Tests critical UI components and pages for visual consistency.
 * Run with: npx playwright test --config=playwright.visual.config.ts
 */

// Helper to wait for fonts and images to load
async function waitForPageStability(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  // Animations are mocked to be instant in beforeEach, so no additional delay needed
}

// Set consistent viewport and mock time for stable screenshots
test.beforeEach(async ({ page }) => {
  // Mock date/time for consistent rendering
  await page.addInitScript(() => {
    const mockDate = new Date('2026-03-16T10:00:00Z');
    Date.now = () => mockDate.getTime();
  });
  
  // Mock animations to be instant
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0ms !important;
        transition-delay: 0ms !important;
      }
    `,
  });
});

// ============================================================================
// AUTHENTICATION PAGES
// ============================================================================

test.describe('Authentication Pages', () => {
  
  test('login page - desktop', async ({ page }) => {
    await page.goto('/auth/login');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('login-desktop.png', {
      fullPage: true,
    });
  });

  test('login page - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/auth/login');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('login-mobile.png', {
      fullPage: true,
    });
  });

  test('signup page - desktop', async ({ page }) => {
    await page.goto('/auth/signup');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('signup-desktop.png', {
      fullPage: true,
    });
  });

  test('forgot password page', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('forgot-password.png', {
      fullPage: true,
    });
  });
});

// ============================================================================
// HOME & LANDING PAGES
// ============================================================================

test.describe('Home & Landing Pages', () => {
  
  test('homepage - desktop', async ({ page }) => {
    await page.goto('/');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('homepage-desktop.png', {
      fullPage: true,
    });
  });

  test('homepage - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
    });
  });

  test('about page', async ({ page }) => {
    await page.goto('/about');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('about.png', {
      fullPage: true,
    });
  });

  test('how it works page', async ({ page }) => {
    await page.goto('/how-it-works');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('how-it-works.png', {
      fullPage: true,
    });
  });
});

// ============================================================================
// SEARCH & LISTINGS
// ============================================================================

test.describe('Search & Listings', () => {
  
  test('search results page', async ({ page }) => {
    await page.goto('/search?q=camera');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('search-results.png', {
      fullPage: true,
    });
  });

  test('search with filters open', async ({ page }) => {
    await page.goto('/search');
    await waitForPageStability(page);
    await page.click('[data-testid="filter-button"]');
    await page.waitForSelector('[data-testid="filter-panel"]', { state: 'visible' });
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('search-filters-open.png', {
      fullPage: true,
    });
  });

  test('listing detail page', async ({ page }) => {
    await page.goto('/listings/test-camera');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('listing-detail.png', {
      fullPage: true,
    });
  });

  test('listing detail - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/listings/test-camera');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('listing-detail-mobile.png', {
      fullPage: true,
    });
  });
});

// ============================================================================
// DASHBOARD PAGES
// ============================================================================

test.describe('Dashboard Pages', () => {
  
  test('renter dashboard', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/renter');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('renter-dashboard.png', {
      fullPage: true,
    });
  });

  test('owner dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'owner@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/owner');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('owner-dashboard.png', {
      fullPage: true,
    });
  });

  test('owner earnings page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'owner@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/dashboard/owner/earnings');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('owner-earnings.png', {
      fullPage: true,
    });
  });

  test('owner calendar page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'owner@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/dashboard/owner/calendar');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('owner-calendar.png', {
      fullPage: true,
    });
  });
});

// ============================================================================
// BOOKING & PAYMENT FLOWS
// ============================================================================

test.describe('Booking & Payment Pages', () => {
  
  test('booking page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/bookings/booking-123');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('booking-detail.png', {
      fullPage: true,
    });
  });

  test('checkout page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/checkout/checkout-123');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('checkout.png', {
      fullPage: true,
    });
  });

  test('booking state machine - confirmed', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/bookings/confirmed-booking');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('booking-state-confirmed.png', {
      fullPage: false,
      clip: { x: 0, y: 200, width: 1280, height: 600 },
    });
  });

  test('booking state machine - pending', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/bookings/pending-booking');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('booking-state-pending.png', {
      fullPage: false,
      clip: { x: 0, y: 200, width: 1280, height: 600 },
    });
  });
});

// ============================================================================
// SETTINGS & PROFILE
// ============================================================================

test.describe('Settings & Profile', () => {
  
  test('profile settings', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/settings/profile');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('settings-profile.png', {
      fullPage: true,
    });
  });

  test('notification settings', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/settings/notifications');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('settings-notifications.png', {
      fullPage: true,
    });
  });

  test('security settings', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/settings/security');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('settings-security.png', {
      fullPage: true,
    });
  });
});

// ============================================================================
// MESSAGING & NOTIFICATIONS
// ============================================================================

test.describe('Messaging & Notifications', () => {
  
  test('messages page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/messages');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('messages.png', {
      fullPage: true,
    });
  });

  test('conversation detail', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/messages/conv-123');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('conversation.png', {
      fullPage: true,
    });
  });

  test('notifications page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/notifications');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('notifications.png', {
      fullPage: true,
    });
  });
});

// ============================================================================
// ADMIN PAGES
// ============================================================================

test.describe('Admin Pages', () => {
  
  test('admin dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.goto('/admin');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('admin-dashboard.png', {
      fullPage: true,
    });
  });

  test('admin moderation queue', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.goto('/admin/moderation');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('admin-moderation.png', {
      fullPage: true,
    });
  });

  test('admin analytics', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.goto('/admin/analytics');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('admin-analytics.png', {
      fullPage: true,
    });
  });
});

// ============================================================================
// COMPONENT SCREENSHOTS
// ============================================================================

test.describe('UI Components', () => {
  
  test('booking state machine component', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/bookings/component-test');
    await waitForPageStability(page);
    const component = await page.locator('[data-testid="booking-state-machine"]');
    await expect(component).toHaveScreenshot('component-booking-state-machine.png');
  });

  test('AI listing assistant component', async ({ page }) => {
    // NOTE: Previous version targeted data-testid="ai-assistant-tab" and
    // data-testid="ai-suggestions" which were never implemented. This test
    // has been rewritten to match the actual UI:
    //   - data-testid="ai-panel-toggle" opens the AIListingAssistant panel
    //   - data-testid="ai-listing-assistant" is the component wrapper
    // See apps/web/e2e/ai-listing-assistant.e2e.spec.ts.QUARANTINE_REASON.md
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'owner@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/listings/new');
    await waitForPageStability(page);
    // Open the AI assistant panel via the real toggle button.
    await page.click('[data-testid="ai-panel-toggle"]');
    await page.waitForSelector('[data-testid="ai-listing-assistant"]', { state: 'visible' });
    const component = page.locator('[data-testid="ai-listing-assistant"]');
    await expect(component).toHaveScreenshot('component-ai-assistant.png');
  });

  test('smart form component', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'owner@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/test/smart-form');
    await waitForPageStability(page);
    const component = await page.locator('[data-testid="smart-form"]');
    await expect(component).toHaveScreenshot('component-smart-form.png');
  });

  test('error boundary fallback', async ({ page }) => {
    await page.goto('/test/error-boundary');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('component-error-boundary.png', {
      fullPage: false,
    });
  });
});

// ============================================================================
// ERROR & EDGE CASE PAGES
// ============================================================================

test.describe('Error Pages', () => {
  
  test('404 not found page', async ({ page }) => {
    await page.goto('/non-existent-page');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('404-not-found.png', {
      fullPage: true,
    });
  });

  test('403 forbidden page', async ({ page }) => {
    await page.goto('/admin'); // Without admin role
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('403-forbidden.png', {
      fullPage: true,
    });
  });

  test('500 error page', async ({ page }) => {
    await page.goto('/test/error');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('500-error.png', {
      fullPage: true,
    });
  });

  test('maintenance page', async ({ page }) => {
    await page.goto('/maintenance');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('maintenance.png', {
      fullPage: true,
    });
  });
});

// ============================================================================
// DARK MODE TESTS
// ============================================================================

test.describe('Dark Mode', () => {
  
  test('homepage - dark mode', async ({ page }) => {
    await page.goto('/');
    await waitForPageStability(page);
    // Toggle dark mode
    await page.click('[data-testid="theme-toggle"]');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('homepage-dark.png', {
      fullPage: true,
    });
  });

  test('dashboard - dark mode', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/dashboard/renter');
    await waitForPageStability(page);
    await page.click('[data-testid="theme-toggle"]');
    await waitForPageStability(page);
    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      fullPage: true,
    });
  });
});
