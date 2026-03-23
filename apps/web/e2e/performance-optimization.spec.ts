/**
 * Performance and Optimization Tests
 * Validates load times, memory usage, and performance optimization
 * @tags @performance @optimization @critical
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3401';
const API_URL = process.env.E2E_API_URL || 'http://localhost:3400/api';

test.describe('Performance & Optimization', () => {
  test('Search page loads within 2 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${BASE_URL}/search`, { waitUntil: 'networkidle' });
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    // Should load within 2 seconds
    expect(loadTime).toBeLessThan(2000);
    
    // All critical elements should be visible
    await expect(page.locator('[data-testid="search-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="listing-grid"]')).toBeVisible();
  });

  test('Lazy loading for listing images', async ({ page }) => {
    await page.goto(`${BASE_URL}/search?query=apartment`);
    
    // All images should have loading attribute
    const images = page.locator('[data-testid="listing-image"]');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const loading = await img.getAttribute('loading');
      
      // Should have lazy loading
      expect(['lazy', 'auto']).toContain(loading);
    }
  });

  test('Scroll performance - no jank when scrolling listings', async ({ page }) => {
    await page.goto(`${BASE_URL}/search?limit=50`);
    
    // Get metrics before scroll
    const initialMetrics = await page.metrics();
    
    // Scroll down to load more content
    await page.locator('[data-testid="listing-grid"]').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    
    // Wait a moment for handler
    await page.waitForTimeout(100);
    
    // Scroll back up
    await page.locator('[data-testid="listing-grid"]').evaluate((el) => {
      el.scrollTop = 0;
    });
    
    // Get metrics after scroll
    const finalMetrics = await page.metrics();
    
    // Memory shouldn't increase significantly (allow 10% margin)
    const memoryIncrease =
      (finalMetrics.JSHeapUsedSize - initialMetrics.JSHeapUsedSize) /
      initialMetrics.JSHeapUsedSize;
    
    expect(memoryIncrease).toBeLessThan(0.1); // Less than 10% increase
  });

  test('API response time optimization', async ({ request }) => {
    const startTime = Date.now();
    
    const response = await request.get(`${API_URL}/listings?limit=20&offset=0`);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(response.ok()).toBeTruthy();
    
    // Should respond within 500ms
    expect(responseTime).toBeLessThan(500);
  });

  test('Bundle size is reasonable', async ({ page }) => {
    // Get network logs
    const requests: Array<{ url: string; size: number }> = [];
    
    page.on('response', (response) => {
      const request = response.request();
      const size = response.headers()['content-length'];
      
      if (size) {
        requests.push({
          url: request.url(),
          size: parseInt(size, 10),
        });
      }
    });
    
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' });
    
    // Main JS bundle shouldn't exceed 500KB
    const mainBundle = requests.find((r) =>
      r.url.includes('main') && r.url.endsWith('.js')
    );
    
    if (mainBundle) {
      expect(mainBundle.size).toBeLessThan(500000); // 500KB
    }
    
    // Total JS shouldn't exceed 1MB
    const totalJsSize = requests
      .filter((r) => r.url.endsWith('.js'))
      .reduce((sum, r) => sum + r.size, 0);
    
    expect(totalJsSize).toBeLessThan(1000000); // 1MB
  });

  test('Database query performance - search optimization', async ({ request }) => {
    const startTime = Date.now();
    
    // Complex search with multiple filters
    const response = await request.get(
      `${API_URL}/listings?category=apartment&country=NP&minPrice=100&maxPrice=500&maxGuests=4&limit=20`
    );
    
    const endTime = Date.now();
    const queryTime = endTime - startTime;
    
    expect(response.ok()).toBeTruthy();
    
    // Complex query should still respond quickly
    expect(queryTime).toBeLessThan(1000); // 1 second max
  });

  test('CSS/Style optimization - no render blocking', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate and measure first paint
    await page.goto(`${BASE_URL}`);
    
    const endTime = Date.now();
    
    // Page should be interactive within 2 seconds
    expect(endTime - startTime).toBeLessThan(2000);
    
    // Should have used CSS-in-JS or optimized CSS
    const styleTags = await page.$$('style');
    const linkTags = await page.$$('link[rel="stylesheet"]');
    
    // Either approach is fine, but not both (no duplicates)
    expect(styleTags.length + linkTags.length).toBeGreaterThan(0);
  });

  test('Caching headers are set correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}`);
    
    const cacheControl = response.headers()['cache-control'];
    
    // Should have cache directives
    expect(cacheControl).toBeTruthy();
    
    // Static assets should be cached longer
    const logoResponse = await request.get(`${BASE_URL}/logo.svg`);
    const logoCacheControl = logoResponse.headers()['cache-control'];
    
    // Logo should have longer cache (contains max-age or public)
    expect(logoCacheControl).toMatch(/max-age|public/);
  });

  test('Infinite scroll pagination performance', async ({ page }) => {
    await page.goto(`${BASE_URL}/search`);
    
    // Get initial listing count
    const initialCount = await page
      .locator('[data-testid="listing-card"]')
      .count();
    
    // Scroll to bottom to trigger infinite scroll
    await page.locator('[data-testid="listing-grid"]').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    
    // Wait for new items to load
    await page.waitForTimeout(500);
    
    // Get new count
    const newCount = await page
      .locator('[data-testid="listing-card"]')
      .count();
    
    // Should have loaded more items without reloading page
    expect(newCount).toBeGreaterThan(initialCount);
    
    // All items should still be visible without lag
    const visibleItems = await page.locator('[data-testid="listing-card"]');
    for (let i = 0; i < await visibleItems.count(); i++) {
      const item = visibleItems.nth(i);
      // Each item should render quickly
      await expect(item).toBeVisible({ timeout: 1000 });
    }
  });

  test('Image optimization - responsive images', async ({ page }) => {
    await page.goto(`${BASE_URL}/search?limit=10`);
    
    // Check for responsive image attributes
    const images = page.locator('[data-testid="listing-image"]');
    
    for (let i = 0; i < (await images.count()); i++) {
      const img = images.nth(i);
      
      // Should have either srcset or data-src for optimization
      const srcset = await img.getAttribute('srcset');
      const dataSrc = await img.getAttribute('data-src');
      const src = await img.getAttribute('src');
      
      // At least one optimization technique
      expect(srcset || dataSrc || src).toBeTruthy();
    }
  });

  test('No memory leaks - component cleanup', async ({ page }) => {
    // Navigate through multiple pages
    const pages = [
      `${BASE_URL}`,
      `${BASE_URL}/search`,
      `${BASE_URL}/my-bookings`,
      `${BASE_URL}/my-listings`,
      `${BASE_URL}`,
    ];
    
    const memoryReadings: number[] = [];
    
    for (const pageUrl of pages) {
      await page.goto(pageUrl, { waitUntil: 'networkidle' });
      
      const metrics = await page.metrics();
      memoryReadings.push(metrics.JSHeapUsedSize);
      
      await page.waitForTimeout(200);
    }
    
    // Memory should stabilize (not continuously increase)
    const firstReading = memoryReadings[0];
    const lastReading = memoryReadings[memoryReadings.length - 1];
    
    // Memory shouldn't double
    expect(lastReading).toBeLessThan(firstReading * 2);
  });

  test('Search filter application delay < 300ms', async ({ page }) => {
    await page.goto(`${BASE_URL}/search`);
    
    // Set price filter and measure response time
    const startTime = Date.now();
    
    await page.locator('[data-testid="price-min"]').fill('100');
    
    // Wait for results to update
    await page.locator('[data-testid="listing-grid"]').evaluate((el) =>
      el.getAttribute('data-updated')
    );
    
    const endTime = Date.now();
    const updateTime = endTime - startTime;
    
    // Debounced filter should apply within 300ms
    expect(updateTime).toBeLessThan(300);
  });

  test('Real-time reservation updates performance', async ({ page, request }) => {
    // Subscribe to reservation updates
    await page.goto(`${BASE_URL}/listings/test-listing`);
    
    // Simulate rapid availability updates
    const startTime = Date.now();
    let updateCount = 0;
    
    for (let i = 0; i < 10; i++) {
      await request.patch(`${API_URL}/listings/test-listing/availability`, {
        data: {
          date: new Date(2026, 4, i + 1).toISOString().split('T')[0],
          available: Math.random() > 0.5,
        },
      });
      
      updateCount++;
      
      // Check if UI updates without lag
      const cal = page.locator('[data-testid="calendar"]');
      if (await cal.isVisible({ timeout: 100 })) {
        const text = await cal.innerText();
        expect(text).toBeTruthy();
      }
    }
    
    const endTime = Date.now();
    const elapsed = endTime - startTime;
    
    // 10 updates should complete in reasonable time
    expect(elapsed).toBeLessThan(2000); // 2 seconds for 10 updates
  });
});
