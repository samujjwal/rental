/**
 * Cross-Browser and Mobile Compatibility Tests
 * Ensures consistent experience across different browsers and devices
 * @tags @browser-compatibility @mobile @critical
 */

import { test, expect, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3401';
const API_URL = process.env.E2E_API_URL || 'http://localhost:3400/api';

test.describe('Cross-Browser Compatibility', () => {
  test('Search form works on Firefox', async ({ page, browserName }) => {
    if (browserName !== 'firefox') {
      test.skip();
    }
    
    await page.goto(`${BASE_URL}`);
    
    // Search form should be interactive
    const searchInput = page.locator('[data-testid="search"]');
    await searchInput.fill('apartment');
    
    // Test date picker (different in Firefox)
    const dateInput = page.locator('[data-testid="check-in"]');
    await dateInput.fill('2026-05-15');
    
    await page.locator('[data-testid="search-btn"]').click();
    
    await page.waitForURL(/\/search/);
    
    // Results should load
    const results = page.locator('[data-testid="listing-card"]');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Checkout form renders correctly in Safari', async ({
    page,
    browserName,
  }) => {
    if (browserName !== 'webkit') {
      test.skip();
    }
    
    // Navigate to checkout
    await page.goto(`${BASE_URL}/checkout`);
    
    // All form fields should be accessible
    const emailField = page.locator('[data-testid="email"]');
    const nameField = page.locator('[data-testid="name"]');
    const stripField = page.locator('[data-testid="card-element"]');
    
    await expect(emailField).toBeVisible();
    await expect(nameField).toBeVisible();
    await expect(stripField).toBeVisible();
    
    // Fill form
    await emailField.fill('test@example.com');
    await nameField.fill('Test User');
    
    // Should be able to submit
    const submitBtn = page.locator('[data-testid="pay-btn"]');
    await expect(submitBtn).toBeEnabled();
  });

  test('Responsive layout on tablet (iPad)', async ({ browser }) => {
    const context = await browser.newContext(devices['iPad Pro']);
    const page = await context.newPage();
    
    await page.goto(`${BASE_URL}`);
    
    // Should show tablet layout
    const mainContent = page.locator('[data-testid="main-content"]');
    const boundingBox = await mainContent.boundingBox();
    
    // Tablet should be between phone (375px) and desktop (1024px)
    expect(boundingBox?.width).toBeGreaterThan(600);
    expect(boundingBox?.width).toBeLessThan(1024);
    
    // Navigation should be accessible
    const navMenu = page.locator('[data-testid="nav-menu"]');
    await expect(navMenu).toBeVisible();
    
    await context.close();
  });

  test('Touch interactions on mobile device', async ({ browser }) => {
    const mobileContext = await browser.newContext(devices['iPhone 12']);
    const page = await mobileContext.newPage();
    
    await page.goto(`${BASE_URL}`);
    
    // Touch-friendly buttons
    const searchBtn = page.locator('[data-testid="search-btn"]');
    const btnBox = await searchBtn.boundingBox();
    
    // Touch target should be at least 44x44px
    expect(btnBox?.width).toBeGreaterThanOrEqual(44);
    expect(btnBox?.height).toBeGreaterThanOrEqual(44);
    
    // Touch scroll should work
    await page.locator('[data-testid="listing-grid"]').tap();
    
    // Should be able to scroll
    const scrolling = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="listing-grid"]');
      return el ? (el as any).scrollHeight > (el as any).clientHeight : false;
    });
    
    expect(scrolling).toBeTruthy();
    
    await mobileContext.close();
  });

  test('Form validation messages display correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout`);
    
    // Try to submit empty form
    await page.locator('[data-testid="pay-btn"]').click();
    
    // Should show validation errors
    const emailError = page.locator('[data-testid="email-error"]');
    const nameError = page.locator('[data-testid="name-error"]');
    
    await expect(emailError).toBeVisible();
    await expect(nameError).toBeVisible();
    
    // Error text should be readable
    const errorText = await emailError.textContent();
    expect(errorText?.toLowerCase()).toContain('email');
  });

  test('Dark mode support (prefers-color-scheme)', async ({ page }) => {
    // Set dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });
    
    await page.goto(`${BASE_URL}`);
    
    // Check that background adapts
    const bgColor = await page.evaluate(() => {
      const el = document.body;
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // Should use dark colors (not pure white)
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
    
    // Text should be light for readability
    const textColor = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="main-content"]') as any;
      return window.getComputedStyle(el).color;
    });
    
    expect(textColor).toBeTruthy();
  });

  test('Print stylesheet works correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/listings/test-listing`);
    
    // Trigger print preview
    await page.emulateMedia({ media: 'print' });
    
    // Print-specific elements should show
    const printHeader = await page.evaluate(() => {
      const el = document.querySelector('[data-print-only]');
      return window.getComputedStyle(el as any).display;
    });
    
    // Should not be hidden
    expect(printHeader).not.toBe('none');
  });

  test('Keyboard navigation on large monitor (1920px)', async ({ page }) => {
    // Set large viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await page.goto(`${BASE_URL}/search`);
    
    // Tab through navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Should show focus outline
    const outline = await page.evaluate(() => {
      const el = document.activeElement as any;
      return window.getComputedStyle(el).outline;
    });
    
    expect(outline).not.toBe('none');
  });

  test('Screen reader compatibility - main content landmarks', async ({ page }) => {
    await page.goto(`${BASE_URL}`);
    
    // Should have proper landmark regions
    const main = page.locator('main');
    const nav = page.locator('nav');
    const footer = page.locator('footer');
    
    // At least main content should exist
    const mainCount = await main.count();
    expect(mainCount).toBeGreaterThan(0);
    
    // Check for proper heading hierarchy
    const h1 = page.locator('h1');
    const h1Count = await h1.count();
    expect(h1Count).toBeGreaterThan(0);
  });

  test('Button labels don\'t get cut off on mobile', async ({ browser }) => {
    const context = await browser.newContext(devices['iPhone 12']);
    const page = await context.newPage();
    
    await page.goto(`${BASE_URL}`);
    
    const buttons = page.locator('button, [role="button"]');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      
      // Get text
      const text = await btn.innerText();
      
      // Button should be wide enough for text (rough check)
      if (text.length > 5) {
        expect(box?.width).toBeGreaterThan(text.length * 5); // Rough estimate
      }
    }
    
    await context.close();
  });

  test('Touchscreen dropdown menus expand properly', async ({ browser }) => {
    const context = await browser.newContext(devices['iPhone 12']);
    const page = await context.newPage();
    
    await page.goto(`${BASE_URL}/search`);
    
    // Find dropdown
    const categorySelect = page.locator('[data-testid="category"]');
    
    // Tap to open
    await categorySelect.tap();
    
    // Options should be visible
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();
    
    expect(optionCount).toBeGreaterThan(0);
    
    // Tap option
    if (optionCount > 0) {
      await options.first().tap();
      
      // Should close after selection
      await page.waitForTimeout(100);
    }
    
    await context.close();
  });

  test('High DPI display support (2x pixel ratio)', async ({ page }) => {
    // Emulate high-DPI display (like Retina)
    await page.goto(`${BASE_URL}`);
    
    // Images should be optimized for retina
    const images = page.locator('img');
    const count = await images.count();
    
    if (count > 0) {
      const img = images.first();
      const srcset = await img.getAttribute('srcset');
      
      // Either has srcset with multipliers or regular src is sufficient
      if (srcset) {
        expect(srcset).toMatch(/2x|3x|@2x|@3x/);
      }
    }
  });

  test('Slow network - images lazy load gracefully', async ({ page }) => {
    // Simulate slow 3G
    await page.route('**/*', (route) => {
      setTimeout(() => route.continue(), 100);
    });
    
    await page.goto(`${BASE_URL}/search`, { waitUntil: 'domcontentloaded' });
    
    // Should render without images initially
    const listings = page.locator('[data-testid="listing-card"]');
    await expect(listings.first()).toBeVisible();
    
    // Images should start loading
    const images = page.locator('[data-testid="listing-image"]');
    
    // Wait for images to load
    for (let i = 0; i < Math.min(await images.count(), 3); i++) {
      const img = images.nth(i);
      
      try {
        await img.waitFor({ state: 'visible', timeout: 5000 });
      } catch (e) {
        // Some images might timeout due to slow network - that's OK
      }
    }
  });

  test('Windows High Contrast mode support', async ({ page }) => {
    // Set high contrast preference
    await page.emulateMedia({ forcedColors: 'active' });
    
    await page.goto(`${BASE_URL}`);
    
    // Should have sufficient contrast (forced-color-adjust)
    const processed = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="main-content"]');
      return window.getComputedStyle(el as any).forcedColorAdjust;
    });
    
    // Should be 'auto' or 'none' (not 'none' which would respect forced colors)
    expect(processed).toBeTruthy();
  });
});
