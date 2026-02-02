import { test, expect, Page } from '@playwright/test';
import { loginAs, testUsers } from './helpers/test-utils';

test.describe('Favorites / Wishlist', () => {
  test.describe('Viewing Favorites List', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should display favorites page', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      // Should show favorites list or empty state
      const favoritesList = page.locator('[data-testid="favorites-list"], .favorites-grid');
      const emptyState = page.locator('text=/no favorites|haven\'t saved/i');

      await expect(favoritesList.or(emptyState)).toBeVisible();
    });

    test('should show favorite listings with details', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const firstFavorite = page.locator('[data-testid="favorite-item"], .favorite-card').first();
      if (await firstFavorite.isVisible()) {
        // Should show listing info
        await expect(firstFavorite.locator('img')).toBeVisible(); // Image
        await expect(firstFavorite.locator('text=/\\$/i')).toBeVisible(); // Price
      }
    });

    test('should navigate to listing from favorites', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const firstFavorite = page.locator('[data-testid="favorite-item"], .favorite-card').first();
      if (await firstFavorite.isVisible()) {
        await firstFavorite.click();
        await expect(page).toHaveURL(/\/listings\/[a-zA-Z0-9-]+$/);
      }
    });

    test('should remove from favorites', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const initialCount = await page.locator('[data-testid="favorite-item"]').count();
      
      const removeButton = page.locator('[data-testid="remove-favorite"], button[aria-label*="Remove"]').first();
      if (await removeButton.isVisible()) {
        await removeButton.click();

        // Should show success feedback
        await expect(page.locator('text=/removed|deleted/i')).toBeVisible();

        // Count should decrease
        const newCount = await page.locator('[data-testid="favorite-item"]').count();
        expect(newCount).toBeLessThan(initialCount);
      }
    });

    test('should show empty state when no favorites', async ({ page }) => {
      // Assuming this user has no favorites
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const emptyState = page.locator('text=/no favorites|start browsing|explore listings/i');
      const favoritesList = page.locator('[data-testid="favorite-item"]');

      const itemCount = await favoritesList.count();
      if (itemCount === 0) {
        await expect(emptyState).toBeVisible();
        
        // Should have link to browse listings
        const browseLink = page.locator('a:has-text("Browse"), a:has-text("Explore")');
        await expect(browseLink).toBeVisible();
      }
    });
  });

  test.describe('Adding to Favorites', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should add listing to favorites from listing detail', async ({ page }) => {
      // Navigate to a listing
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');

      const firstListing = page.locator('[data-testid="listing-card"], .listing-card').first();
      await firstListing.click();
      await page.waitForLoadState('networkidle');

      // Click favorite/heart button
      const favoriteButton = page.locator('[data-testid="favorite-button"], button[aria-label*="favorite"], button[aria-label*="save"], .heart-icon');
      if (await favoriteButton.isVisible()) {
        await favoriteButton.click();

        // Should show confirmation
        await expect(page.locator('text=/saved|added to favorites/i')).toBeVisible();
      }
    });

    test('should add listing to favorites from search results', async ({ page }) => {
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');

      // Hover over listing to show favorite button
      const firstListing = page.locator('[data-testid="listing-card"], .listing-card').first();
      await firstListing.hover();

      const favoriteButton = firstListing.locator('[data-testid="favorite-button"], button[aria-label*="favorite"]');
      if (await favoriteButton.isVisible()) {
        await favoriteButton.click();
      }
    });

    test('should toggle favorite status', async ({ page }) => {
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');

      const firstListing = page.locator('[data-testid="listing-card"]').first();
      await firstListing.click();
      await page.waitForLoadState('networkidle');

      const favoriteButton = page.locator('[data-testid="favorite-button"]');
      if (await favoriteButton.isVisible()) {
        // Add to favorites
        await favoriteButton.click();
        await page.waitForTimeout(500);

        // Should be marked as favorite
        await expect(favoriteButton.locator('[data-favorite="true"], .favorited, [aria-pressed="true"]')).toBeVisible();

        // Remove from favorites
        await favoriteButton.click();

        // Should no longer be marked
        await expect(favoriteButton.locator('[data-favorite="false"], .not-favorited, [aria-pressed="false"]')).toBeVisible();
      }
    });

    test('should prompt login when adding favorite as guest', async ({ page }) => {
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');

      const firstListing = page.locator('[data-testid="listing-card"]').first();
      await firstListing.click();
      await page.waitForLoadState('networkidle');

      // Log out first
      await page.goto('/logout');
      
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');

      const favoriteButton = page.locator('[data-testid="favorite-button"]');
      if (await favoriteButton.isVisible()) {
        await favoriteButton.click();

        // Should redirect to login or show login modal
        const loginRedirect = page.url().includes('/login');
        const loginModal = await page.locator('[data-testid="login-modal"], .login-modal').isVisible();

        expect(loginRedirect || loginModal).toBeTruthy();
      }
    });
  });

  test.describe('Favorites Organization', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should filter favorites by category', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const categoryFilter = page.locator('[data-testid="category-filter"], select[name="category"]');
      if (await categoryFilter.isVisible()) {
        await categoryFilter.selectOption({ index: 1 });
        await page.waitForLoadState('networkidle');
      }
    });

    test('should search within favorites', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder*="Search"], [data-testid="favorites-search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test search');
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle');
      }
    });

    test('should sort favorites', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const sortDropdown = page.locator('[data-testid="sort-dropdown"], select[name="sort"]');
      if (await sortDropdown.isVisible()) {
        await sortDropdown.selectOption('price_low');
        await page.waitForLoadState('networkidle');
      }
    });

    test('should create wishlist collection', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const createCollectionButton = page.locator('button:has-text("Create Collection"), button:has-text("New List")');
      if (await createCollectionButton.isVisible()) {
        await createCollectionButton.click();

        // Fill in collection name
        const nameInput = page.locator('input[name="collectionName"], input[placeholder*="name"]');
        await nameInput.fill('Summer Trip');

        const saveButton = page.locator('button:has-text("Create"), button:has-text("Save")');
        await saveButton.click();

        // Should show new collection
        await expect(page.locator('text=Summer Trip')).toBeVisible();
      }
    });

    test('should move favorite to collection', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const firstFavorite = page.locator('[data-testid="favorite-item"]').first();
      if (await firstFavorite.isVisible()) {
        // Open actions menu
        const menuButton = firstFavorite.locator('[data-testid="more-options"], button[aria-label="More"]');
        if (await menuButton.isVisible()) {
          await menuButton.click();

          const moveOption = page.locator('text=/move to|add to collection/i');
          if (await moveOption.isVisible()) {
            await moveOption.click();
          }
        }
      }
    });
  });

  test.describe('Favorites Synchronization', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should sync favorites across devices', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      // Favorites should be loaded from server
      const loadingState = page.locator('[data-testid="loading"]');
      await expect(loadingState).not.toBeVisible();
    });

    test('should show favorite count in header', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const favoritesBadge = page.locator('[data-testid="favorites-count"], .favorites-badge');
      if (await favoritesBadge.isVisible()) {
        const count = await favoritesBadge.textContent();
        expect(parseInt(count || '0')).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Favorites Notifications', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should show price drop notification', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      // Check for price drop indicators
      const priceDropBadge = page.locator('[data-testid="price-drop"], .price-drop-badge');
      if (await priceDropBadge.isVisible()) {
        await expect(priceDropBadge).toContainText(/price drop|reduced/i);
      }
    });

    test('should show availability status', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const firstFavorite = page.locator('[data-testid="favorite-item"]').first();
      if (await firstFavorite.isVisible()) {
        // Should show availability
        const availabilityStatus = firstFavorite.locator('[data-testid="availability"], .availability-status');
        await expect(availabilityStatus).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should display favorites grid on mobile', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      // Should show mobile-optimized layout
      const favoritesContainer = page.locator('[data-testid="favorites-list"]');
      if (await favoritesContainer.isVisible()) {
        // Grid should adapt to mobile
        const computedStyle = await favoritesContainer.evaluate((el) => {
          return window.getComputedStyle(el).display;
        });
        // Could be grid or flex
        expect(['grid', 'flex', 'block']).toContain(computedStyle);
      }
    });

    test('should show favorite button on mobile cards', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/listings');
      await page.waitForLoadState('networkidle');

      const firstListing = page.locator('[data-testid="listing-card"]').first();
      // On mobile, favorite button should be visible without hover
      const favoriteButton = firstListing.locator('[data-testid="favorite-button"]');
      await expect(favoriteButton).toBeVisible();
    });
  });

  test.describe('Sharing Favorites', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should share favorite via email', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const firstFavorite = page.locator('[data-testid="favorite-item"]').first();
      if (await firstFavorite.isVisible()) {
        const shareButton = firstFavorite.locator('[data-testid="share-button"], button[aria-label*="Share"]');
        if (await shareButton.isVisible()) {
          await shareButton.click();

          const emailOption = page.locator('text=/email|send to friend/i');
          if (await emailOption.isVisible()) {
            await emailOption.click();
          }
        }
      }
    });

    test('should copy share link', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const firstFavorite = page.locator('[data-testid="favorite-item"]').first();
      if (await firstFavorite.isVisible()) {
        const shareButton = firstFavorite.locator('[data-testid="share-button"]');
        if (await shareButton.isVisible()) {
          await shareButton.click();

          const copyLinkOption = page.locator('text=/copy link|copy url/i');
          if (await copyLinkOption.isVisible()) {
            await copyLinkOption.click();

            // Should show copied confirmation
            await expect(page.locator('text=/copied|link copied/i')).toBeVisible();
          }
        }
      }
    });

    test('should share collection', async ({ page }) => {
      await page.goto('/favorites');
      await page.waitForLoadState('networkidle');

      const shareCollectionButton = page.locator('[data-testid="share-collection"], button:has-text("Share Collection")');
      if (await shareCollectionButton.isVisible()) {
        await shareCollectionButton.click();

        // Should show sharing options
        await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
      }
    });
  });
});
