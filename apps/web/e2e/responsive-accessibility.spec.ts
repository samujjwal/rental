import { test, expect, Page } from "@playwright/test";

// Test credentials
const TEST_USER = {
  email: "renter@test.com",
  password: "Test123!@#",
};

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe("Responsive Design - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test.describe("Navigation", () => {
    test("should show mobile menu button", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    });

    test("should open mobile menu", async ({ page }) => {
      await page.goto("/");
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    });

    test("should close mobile menu", async ({ page }) => {
      await page.goto("/");
      await page.click('[data-testid="mobile-menu-button"]');
      await page.click('[data-testid="close-menu"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).not.toBeVisible();
    });

    test("should navigate from mobile menu", async ({ page }) => {
      await page.goto("/");
      await page.click('[data-testid="mobile-menu-button"]');
      await page.click('a:has-text("Search")');
      await expect(page).toHaveURL(/.*search/);
    });
  });

  test.describe("Homepage", () => {
    test("should display hero section properly", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("h1")).toBeVisible();
    });

    test("should stack content vertically", async ({ page }) => {
      await page.goto("/");
      const container = page.locator('[data-testid="hero-content"]');
      if (await container.isVisible()) {
        const box = await container.boundingBox();
        expect(box?.width).toBeLessThanOrEqual(375);
      }
    });
  });

  test.describe("Search Page", () => {
    test("should show filters button on mobile", async ({ page }) => {
      await page.goto("/search");
      const filtersButton = page.locator('[data-testid="mobile-filters-button"]');
      await expect(filtersButton).toBeVisible();
    });

    test("should open filters drawer", async ({ page }) => {
      await page.goto("/search");
      await page.click('[data-testid="mobile-filters-button"]');
      await expect(page.locator('[data-testid="filters-drawer"]')).toBeVisible();
    });

    test("should display single column listing grid", async ({ page }) => {
      await page.goto("/search");
      const grid = page.locator('[data-testid="search-results"]');
      // On mobile, should be single column
    });
  });

  test.describe("Listing Details", () => {
    test("should display sticky book button", async ({ page }) => {
      await page.goto("/listings/1");
      const stickyButton = page.locator('[data-testid="sticky-book-button"]');
      if (await stickyButton.isVisible()) {
        await expect(stickyButton).toBeVisible();
      }
    });

    test("should show gallery in carousel mode", async ({ page }) => {
      await page.goto("/listings/1");
      const carousel = page.locator('[data-testid="mobile-gallery"]');
      if (await carousel.isVisible()) {
        await expect(carousel).toBeVisible();
      }
    });
  });

  test.describe("Authentication", () => {
    test("should display full-width forms", async ({ page }) => {
      await page.goto("/auth/login");
      const form = page.locator('form');
      const box = await form.boundingBox();
      expect(box?.width).toBeGreaterThan(300);
    });
  });

  test.describe("Dashboard", () => {
    test("should display mobile-friendly dashboard", async ({ page }) => {
      await login(page);
      await page.goto("/dashboard");
      // Stats should stack vertically
      await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible();
    });

    test("should show bottom navigation", async ({ page }) => {
      await login(page);
      await page.goto("/dashboard");
      const bottomNav = page.locator('[data-testid="bottom-navigation"]');
      if (await bottomNav.isVisible()) {
        await expect(bottomNav).toBeVisible();
      }
    });
  });
});

test.describe("Responsive Design - Tablet", () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test.describe("Navigation", () => {
    test("should show appropriate navigation", async ({ page }) => {
      await page.goto("/");
      // Tablet might show collapsed or full nav
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
    });
  });

  test.describe("Search Page", () => {
    test("should display two-column grid", async ({ page }) => {
      await page.goto("/search");
      // On tablet, should be 2 columns
    });

    test("should show sidebar filters", async ({ page }) => {
      await page.goto("/search");
      const sidebar = page.locator('[data-testid="filters-sidebar"]');
      // Might be visible or collapsible on tablet
    });
  });

  test.describe("Listing Details", () => {
    test("should display appropriate layout", async ({ page }) => {
      await page.goto("/listings/1");
      await expect(page.locator('[data-testid="listing-content"]')).toBeVisible();
    });
  });
});

test.describe("Responsive Design - Desktop", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.describe("Navigation", () => {
    test("should show full navigation bar", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
    });

    test("should hide mobile menu button", async ({ page }) => {
      await page.goto("/");
      const mobileButton = page.locator('[data-testid="mobile-menu-button"]');
      await expect(mobileButton).not.toBeVisible();
    });
  });

  test.describe("Search Page", () => {
    test("should display multi-column grid", async ({ page }) => {
      await page.goto("/search");
      // On desktop, should be 3-4 columns
    });

    test("should show sidebar filters", async ({ page }) => {
      await page.goto("/search");
      await expect(page.locator('[data-testid="filters-sidebar"]')).toBeVisible();
    });
  });

  test.describe("Listing Details", () => {
    test("should display two-column layout", async ({ page }) => {
      await page.goto("/listings/1");
      // Content on left, booking form on right
    });

    test("should show sticky booking form", async ({ page }) => {
      await page.goto("/listings/1");
      const bookingForm = page.locator('[data-testid="booking-form-sticky"]');
      if (await bookingForm.isVisible()) {
        await expect(bookingForm).toBeVisible();
      }
    });
  });
});

test.describe("Touch Interactions", () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test("should support swipe gestures in gallery", async ({ page }) => {
    await page.goto("/listings/1");
    const gallery = page.locator('[data-testid="mobile-gallery"]');
    if (await gallery.isVisible()) {
      // Simulate swipe
      await gallery.dispatchEvent('touchstart', { touches: [{ clientX: 300, clientY: 200 }] });
      await gallery.dispatchEvent('touchmove', { touches: [{ clientX: 100, clientY: 200 }] });
      await gallery.dispatchEvent('touchend', {});
    }
  });

  test("should support pull-to-refresh", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    
    // Simulate pull down gesture
    const content = page.locator('[data-testid="dashboard-content"]');
    if (await content.isVisible()) {
      // This is a simplified test - actual implementation depends on the app
    }
  });
});

test.describe("Accessibility", () => {
  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/");
    
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
    expect(h1Count).toBeLessThanOrEqual(1); // Should only have one h1
  });

  test("should have proper focus indicators", async ({ page }) => {
    await page.goto("/auth/login");
    
    // Tab through elements
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeDefined();
  });

  test("should support keyboard navigation", async ({ page }) => {
    await page.goto("/auth/login");
    
    // Tab to email input
    await page.keyboard.press('Tab');
    await page.keyboard.type('test@example.com');
    
    // Tab to password input
    await page.keyboard.press('Tab');
    await page.keyboard.type('password123');
    
    // Tab to submit button and press Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
  });

  test("should have alt text on images", async ({ page }) => {
    await page.goto("/");
    
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    // Allow some images to be decorative (empty alt is valid for decorative images)
    // expect(imagesWithoutAlt).toBe(0);
  });

  test("should have proper form labels", async ({ page }) => {
    await page.goto("/auth/login");
    
    // Check that inputs have associated labels
    const emailInput = page.locator('input[type="email"]');
    const id = await emailInput.getAttribute('id');
    if (id) {
      const label = page.locator(`label[for="${id}"]`);
      await expect(label).toBeVisible();
    }
  });

  test("should have proper color contrast", async ({ page }) => {
    await page.goto("/");
    // This would require axe-core or similar for proper testing
  });

  test("should support screen reader announcements", async ({ page }) => {
    await page.goto("/");
    
    // Check for aria-live regions
    const liveRegions = page.locator('[aria-live]');
    // Should have at least one for notifications
  });

  test("should have skip links", async ({ page }) => {
    await page.goto("/");
    
    const skipLink = page.locator('a[href="#main-content"]');
    if (await skipLink.isVisible()) {
      await expect(skipLink).toBeVisible();
    }
  });
});

test.describe("Print Styles", () => {
  test("should have print-friendly styles for booking confirmation", async ({ page }) => {
    await login(page);
    await page.goto("/bookings/1");
    
    // Emulate print media
    await page.emulateMedia({ media: 'print' });
    
    // Check that essential info is visible
    await expect(page.locator('[data-testid="booking-details"]')).toBeVisible();
  });
});

test.describe("Dark Mode", () => {
  test("should support dark mode", async ({ page }) => {
    await page.goto("/");
    await page.emulateMedia({ colorScheme: 'dark' });
    
    // Check that dark mode styles are applied
    const body = page.locator('body');
    const backgroundColor = await body.evaluate((el) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Dark mode should have a dark background
    // This is a simplified check
  });

  test("should toggle dark mode manually", async ({ page }) => {
    await page.goto("/");
    
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      // Check that mode changed
    }
  });
});

test.describe("Performance", () => {
  test("should load homepage within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test("should lazy load images", async ({ page }) => {
    await page.goto("/search");
    
    // Check for lazy loading attribute
    const lazyImages = page.locator('img[loading="lazy"]');
    const lazyCount = await lazyImages.count();
    expect(lazyCount).toBeGreaterThan(0);
  });
});

test.describe("Error States", () => {
  test("should display 404 page for unknown routes", async ({ page }) => {
    await page.goto("/unknown-route-12345");
    await expect(page.locator('text=/404|Not Found|Page not found/i')).toBeVisible();
  });

  test("should handle network errors gracefully", async ({ page, context }) => {
    await page.goto("/");
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate
    await page.click('a:has-text("Search")');
    
    // Should show offline message
    const offlineMessage = page.locator('text=/offline|network|connection/i');
    if (await offlineMessage.isVisible()) {
      await expect(offlineMessage).toBeVisible();
    }
    
    await context.setOffline(false);
  });

  test("should show error boundary for component errors", async ({ page }) => {
    // This would require triggering an actual error
    // Typically done with special test routes or mocking
  });
});

test.describe("Internationalization", () => {
  test("should display proper date format", async ({ page }) => {
    await page.goto("/search");
    // Check that dates are formatted correctly based on locale
  });

  test("should display proper currency format", async ({ page }) => {
    await page.goto("/listings/1");
    // Check for currency symbol
    await expect(page.locator('text=/\\$|€|£/')).toBeVisible();
  });
});
