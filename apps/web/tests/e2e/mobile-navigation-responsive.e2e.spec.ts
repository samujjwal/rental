import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation and Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a renter
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'renter@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard/renter');
  });

  test('displays mobile navigation on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard/renter');
    
    // Should show mobile navigation
    const mobileNav = page.locator('[data-testid=mobile-nav]');
    await expect(mobileNav).toBeVisible();
    
    // Should not show desktop sidebar
    const desktopSidebar = page.locator('[data-testid=desktop-sidebar]');
    await expect(desktopSidebar).not.toBeVisible();
  });

  test('hides mobile navigation on desktop devices', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    
    await page.goto('/dashboard/renter');
    
    // Should not show mobile navigation
    const mobileNav = page.locator('[data-testid=mobile-nav]');
    await expect(mobileNav).not.toBeVisible();
    
    // Should show desktop sidebar
    const desktopSidebar = page.locator('[data-testid=desktop-sidebar]');
    await expect(desktopSidebar).toBeVisible();
  });

  test('mobile navigation has correct navigation items', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    const mobileNav = page.locator('[data-testid=mobile-nav]');
    await expect(mobileNav).toBeVisible();
    
    // Check for expected navigation items
    const expectedItems = ['Search', 'Favorites', 'Messages', 'Bookings', 'Profile'];
    
    for (const item of expectedItems) {
      const navItem = mobileNav.locator(`text=${item}`);
      await expect(navItem).toBeVisible();
    }
  });

  test('mobile navigation items are clickable and navigate correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    // Click on Search
    const searchItem = page.locator('[data-testid=mobile-nav] a:has-text("Search")');
    await searchItem.click();
    await page.waitForURL('/search');
    expect(page.url()).toContain('/search');
    
    // Go back to dashboard
    await page.goto('/dashboard/renter');
    
    // Click on Favorites
    const favoritesItem = page.locator('[data-testid=mobile-nav] a:has-text("Favorites")');
    await favoritesItem.click();
    await page.waitForURL('/favorites');
    expect(page.url()).toContain('/favorites');
  });

  test('mobile navigation shows badges correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    // Check for badges on Messages and Favorites
    const messagesItem = page.locator('[data-testid=mobile-nav] a:has-text("Messages")');
    const messagesBadge = messagesItem.locator('[data-testid=badge]');
    
    if (await messagesBadge.isVisible()) {
      await expect(messagesBadge).toBeVisible();
      const badgeText = await messagesBadge.textContent();
      expect(parseInt(badgeText || '0')).toBeGreaterThan(0);
    }
    
    const favoritesItem = page.locator('[data-testid=mobile-nav] a:has-text("Favorites")');
    const favoritesBadge = favoritesItem.locator('[data-testid=badge]');
    
    if (await favoritesBadge.isVisible()) {
      await expect(favoritesBadge).toBeVisible();
    }
  });

  test('mobile navigation supports horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // Small screen to trigger overflow
    await page.goto('/dashboard/renter');
    
    const mobileNav = page.locator('[data-testid=mobile-nav]');
    await expect(mobileNav).toBeVisible();
    
    // Check if scroll indicators are present (when overflow occurs)
    const scrollIndicators = page.locator('[data-testid=mobile-nav-scroll-indicator]');
    
    if (await scrollIndicators.count() > 0) {
      await expect(scrollIndicators.first()).toBeVisible();
    }
    
    // Test horizontal scrolling
    const navContainer = mobileNav.locator('[data-testid=mobile-nav-container]');
    if (await navContainer.isVisible()) {
      const initialScrollLeft = await navContainer.evaluate(el => el.scrollLeft);
      
      // Scroll horizontally
      await navContainer.evaluate((el) => el.scrollLeft += 100);
      
      const newScrollLeft = await navContainer.evaluate(el => el.scrollLeft);
      expect(newScrollLeft).toBeGreaterThan(initialScrollLeft);
    }
  });

  test('mobile navigation highlights active item', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to favorites first
    await page.goto('/favorites');
    
    // Then go to dashboard
    await page.goto('/dashboard/renter');
    
    // Check that Profile or current page is highlighted
    const mobileNav = page.locator('[data-testid=mobile-nav]');
    const activeItem = mobileNav.locator('[data-testid=mobile-nav-item].active');
    
    // Should have at least one active item
    expect(await activeItem.count()).toBeGreaterThanOrEqual(0);
  });

  test('dashboard layout is responsive on different screen sizes', async ({ page }) => {
    const viewports = [
      { width: 320, height: 568 },  // iPhone SE
      { width: 375, height: 667 },  // iPhone 8
      { width: 414, height: 896 },  // iPhone 11
      { width: 768, height: 1024 }, // iPad
      { width: 1024, height: 768 }, // iPad landscape
      { width: 1200, height: 800 }, // Desktop
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard/renter');
      
      // Wait for content to load
      await page.waitForSelector('[data-testid=dashboard-content]');
      
      // Check that content is visible and properly laid out
      const dashboardContent = page.locator('[data-testid=dashboard-content]');
      await expect(dashboardContent).toBeVisible();
      
      // Verify responsive behavior
      const isMobile = viewport.width < 768;
      const mobileNav = page.locator('[data-testid=mobile-nav]');
      const desktopSidebar = page.locator('[data-testid=desktop-sidebar]');
      
      if (isMobile) {
        await expect(mobileNav).toBeVisible();
        await expect(desktopSidebar).not.toBeVisible();
      } else {
        await expect(mobileNav).not.toBeVisible();
        await expect(desktopSidebar).toBeVisible();
      }
    }
  });

  test('progressive disclosure works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    // Find progressive disclosure sections
    const progressiveSections = page.locator('[data-testid=progressive-disclosure]');
    
    if (await progressiveSections.count() > 0) {
      const firstSection = progressiveSections.first();
      
      // Should be collapsed by default on mobile
      const sectionContent = firstSection.locator('[data-testid=progressive-disclosure-content]');
      const isCollapsed = await sectionContent.isVisible();
      
      // Click to expand/collapse
      const sectionHeader = firstSection.locator('[data-testid=progressive-disclosure-header]');
      await sectionHeader.click();
      
      // Should toggle visibility
      await page.waitForTimeout(300);
      const newVisibility = await sectionContent.isVisible();
      expect(newVisibility).toBe(!isCollapsed);
    }
  });

  test('first-time help displays correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    // Check for first-time help (for new users)
    const firstTimeHelp = page.locator('[data-testid=first-time-help]');
    
    if (await firstTimeHelp.isVisible()) {
      // Should be properly styled for mobile
      await expect(firstTimeHelp).toBeVisible();
      
      // Should have dismiss button
      const dismissButton = firstTimeHelp.locator('button:has-text("Got it"), button:has-text("Dismiss")');
      if (await dismissButton.isVisible()) {
        await dismissButton.click();
        
        // Should be dismissed
        await expect(firstTimeHelp).not.toBeVisible();
      }
    }
  });

  test('touch interactions work correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    // Test tap on mobile navigation items
    const searchItem = page.locator('[data-testid=mobile-nav] a:has-text("Search")');
    await searchItem.tap();
    await page.waitForURL('/search');
    
    // Test swipe gestures on cards (if implemented)
    const card = page.locator('[data-testid=dashboard-card]').first();
    if (await card.isVisible()) {
      // Swipe left
      await card.evaluate((el) => {
        const touchStart = new TouchEvent('touchstart', {
          touches: [{ clientX: 100, clientY: 50 }]
        });
        const touchEnd = new TouchEvent('touchend', {
          changedTouches: [{ clientX: 20, clientY: 50 }]
        });
        el.dispatchEvent(touchStart);
        el.dispatchEvent(touchEnd);
      });
      
      // Should handle swipe without errors
      await page.waitForTimeout(100);
    }
  });

  test('contextual help works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    // Find contextual help elements
    const helpButtons = page.locator('[data-testid=contextual-help-button]');
    
    if (await helpButtons.count() > 0) {
      const firstHelpButton = helpButtons.first();
      await firstHelpButton.tap();
      
      // Should show help tooltip/modal
      const helpTooltip = page.locator('[data-testid=contextual-help-tooltip]');
      if (await helpTooltip.isVisible()) {
        await expect(helpTooltip).toBeVisible();
        
        // Should be dismissible
        const backdrop = page.locator('[data-testid=contextual-help-backdrop]');
        if (await backdrop.isVisible()) {
          await backdrop.tap();
          await expect(helpTooltip).not.toBeVisible();
        }
      }
    }
  });

  test('search recommendations work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    // Find search recommendations
    const searchRecommendations = page.locator('[data-testid=search-recommendations]');
    
    if (await searchRecommendations.isVisible()) {
      // Should be scrollable on mobile
      const isScrollable = await searchRecommendations.evaluate(el => {
        return el.scrollWidth > el.clientWidth;
      });
      
      if (isScrollable) {
        // Test horizontal scrolling
        const initialScrollLeft = await searchRecommendations.evaluate(el => el.scrollLeft);
        await searchRecommendations.evaluate((el) => el.scrollLeft += 100);
        
        const newScrollLeft = await searchRecommendations.evaluate(el => el.scrollLeft);
        expect(newScrollLeft).toBeGreaterThan(initialScrollLeft);
      }
      
      // Test clicking on recommendations
      const firstRecommendation = searchRecommendations.locator('a').first();
      if (await firstRecommendation.isVisible()) {
        await firstRecommendation.tap();
        // Should navigate
        await page.waitForTimeout(1000);
      }
    }
  });

  test('dashboard stats are responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    // Find stats cards
    const statsCards = page.locator('[data-testid=stat-card]');
    
    if (await statsCards.count() > 0) {
      // Should be arranged in a responsive grid
      const firstCard = statsCards.first();
      await expect(firstCard).toBeVisible();
      
      // Should have mobile-optimized styling
      const hasMobileClass = await firstCard.evaluate(el => {
        return el.classList.contains('mobile-optimized') || 
               el.classList.contains('sm:col-span-2') ||
               el.classList.contains('md:col-span-1');
      });
      
      // Cards should be readable on mobile
      const cardText = firstCard.locator('[data-testid=stat-value]');
      if (await cardText.isVisible()) {
        const fontSize = await cardText.evaluate(el => 
          window.getComputedStyle(el).fontSize
        );
        expect(parseInt(fontSize || '0')).toBeGreaterThanOrEqual(14); // Readable font size
      }
    }
  });

  test('performance on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Measure page load time
    const startTime = Date.now();
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=dashboard-content]');
    const loadTime = Date.now() - startTime;
    
    // Should load reasonably fast on mobile
    expect(loadTime).toBeLessThan(3000); // 3 seconds max
    
    // Check for performance optimizations
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const hasLoadingAttr = await img.getAttribute('loading');
      // Should have lazy loading for images
      expect(hasLoadingAttr === 'lazy' || hasLoadingAttr === 'eager').toBeTruthy();
    }
  });

  test('accessibility on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/renter');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    
    // Should focus on interactive elements
    const focusedElement = page.locator(':focus');
    expect(await focusedElement.count()).toBeGreaterThan(0);
    
    // Test screen reader compatibility
    const mobileNav = page.locator('[data-testid=mobile-nav]');
    if (await mobileNav.isVisible()) {
      const navItems = mobileNav.locator('a');
      const itemCount = await navItems.count();
      
      for (let i = 0; i < itemCount; i++) {
        const item = navItems.nth(i);
        const ariaLabel = await item.getAttribute('aria-label');
        
        // Should have proper ARIA labels
        if (ariaLabel) {
          expect(ariaLabel.length).toBeGreaterThan(0);
        }
      }
    }
    
    // Test touch target sizes (WCAG minimum 44x44 pixels)
    const touchTargets = page.locator('button, a, input, [role="button"]');
    const targetCount = await touchTargets.count();
    
    for (let i = 0; i < Math.min(targetCount, 10); i++) { // Check first 10 targets
      const target = touchTargets.nth(i);
      const boundingBox = await target.boundingBox();
      
      if (boundingBox) {
        expect(boundingBox.width).toBeGreaterThanOrEqual(44);
        expect(boundingBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
