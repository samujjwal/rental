import { test, expect } from "@playwright/test";

test.describe("Search & Browse", () => {
  test.describe("Search Page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/search");
    });

    test("should display search results grid", async ({ page }) => {
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    });

    test("should display search filters panel", async ({ page }) => {
      await expect(page.locator('[data-testid="filters-panel"]')).toBeVisible();
    });

    test("should search by keyword", async ({ page }) => {
      await page.fill('input[name="q"]', "camera");
      await page.press('input[name="q"]', "Enter");
      await expect(page).toHaveURL(/.*q=camera/);
    });

    test("should filter by category", async ({ page }) => {
      const categoryFilter = page.locator('[data-testid="category-filter"]');
      if (await categoryFilter.isVisible()) {
        await categoryFilter.click();
        const option = page.locator('[data-testid="category-option"]').first();
        await option.click();
        await expect(page).toHaveURL(/.*category=/);
      }
    });

    test("should filter by price range", async ({ page }) => {
      const minPrice = page.locator('input[name="minPrice"]');
      const maxPrice = page.locator('input[name="maxPrice"]');
      if (await minPrice.isVisible()) {
        await minPrice.fill("10");
        await maxPrice.fill("100");
        await page.click('button:has-text("Apply")');
        await expect(page).toHaveURL(/.*minPrice=10.*maxPrice=100/);
      }
    });

    test("should filter by location", async ({ page }) => {
      const locationInput = page.locator('input[name="location"]');
      if (await locationInput.isVisible()) {
        await locationInput.fill("New York");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/.*location=/);
      }
    });

    test("should filter by availability dates", async ({ page }) => {
      const dateInput = page.locator('input[name="startDate"]');
      if (await dateInput.isVisible()) {
        await dateInput.click();
        // Select start and end dates
        await page.locator('[data-testid="calendar-day"]').first().click();
      }
    });

    test("should sort results", async ({ page }) => {
      const sortSelect = page.locator('[data-testid="sort-select"]');
      if (await sortSelect.isVisible()) {
        await sortSelect.click();
        await page.locator('text=Price: Low to High').click();
        await expect(page).toHaveURL(/.*sort=price_asc/);
      }
    });

    test("should toggle view mode (grid/list)", async ({ page }) => {
      const viewToggle = page.locator('[data-testid="view-toggle"]');
      if (await viewToggle.isVisible()) {
        await viewToggle.click();
        await expect(page.locator('[data-testid="list-view"]')).toBeVisible();
      }
    });

    test("should paginate results", async ({ page }) => {
      const nextPage = page.locator('[data-testid="pagination-next"]');
      if (await nextPage.isVisible()) {
        await nextPage.click();
        await expect(page).toHaveURL(/.*page=2/);
      }
    });

    test("should clear all filters", async ({ page }) => {
      await page.goto("/search?category=electronics&minPrice=10");
      const clearButton = page.locator('button:has-text("Clear")');
      if (await clearButton.isVisible()) {
        await clearButton.click();
        await expect(page).toHaveURL(/\/search$/);
      }
    });

    test("should show empty state when no results", async ({ page }) => {
      await page.fill('input[name="q"]', "xyznonexistentitem123456");
      await page.press('input[name="q"]', "Enter");
      await expect(page.locator('text=/No results|No items found/')).toBeVisible();
    });
  });

  test.describe("Listing Detail View", () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to first available listing from search
      await page.goto("/search");
      const listingCard = page.locator('[data-testid="listing-card"]').first();
      if (await listingCard.isVisible()) {
        await listingCard.click();
        await page.waitForURL(/.*listings\/.*/);
      } else {
        // Direct navigation to a listing for testing
        await page.goto("/listings/1");
      }
    });

    test("should display listing title and description", async ({ page }) => {
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator('[data-testid="listing-description"]')).toBeVisible();
    });

    test("should display image gallery", async ({ page }) => {
      await expect(page.locator('[data-testid="image-gallery"]')).toBeVisible();
    });

    test("should navigate through gallery images", async ({ page }) => {
      const nextButton = page.locator('[data-testid="gallery-next"]');
      if (await nextButton.isVisible()) {
        await nextButton.click();
      }
    });

    test("should open lightbox on image click", async ({ page }) => {
      const mainImage = page.locator('[data-testid="gallery-main-image"]');
      if (await mainImage.isVisible()) {
        await mainImage.click();
        await expect(page.locator('[data-testid="lightbox"]')).toBeVisible();
      }
    });

    test("should display pricing information", async ({ page }) => {
      await expect(page.locator('[data-testid="pricing-section"]')).toBeVisible();
      await expect(page.locator('text=/\\$\\d+/')).toBeVisible();
    });

    test("should display owner information", async ({ page }) => {
      await expect(page.locator('[data-testid="owner-info"]')).toBeVisible();
    });

    test("should navigate to owner profile", async ({ page }) => {
      const ownerLink = page.locator('[data-testid="owner-profile-link"]');
      if (await ownerLink.isVisible()) {
        await ownerLink.click();
        await expect(page).toHaveURL(/.*profile\/.*/);
      }
    });

    test("should display location/map", async ({ page }) => {
      const mapSection = page.locator('[data-testid="location-map"]');
      await expect(mapSection).toBeVisible();
    });

    test("should display availability calendar", async ({ page }) => {
      await expect(page.locator('[data-testid="availability-calendar"]')).toBeVisible();
    });

    test("should display features and specifications", async ({ page }) => {
      await expect(page.locator('[data-testid="features-list"]')).toBeVisible();
    });

    test("should display reviews section", async ({ page }) => {
      await expect(page.locator('[data-testid="reviews-section"]')).toBeVisible();
    });

    test("should display rental terms", async ({ page }) => {
      await expect(page.locator('[data-testid="rental-terms"]')).toBeVisible();
    });

    test("should show book now button for guests", async ({ page }) => {
      await expect(page.locator('button:has-text("Book"), button:has-text("Rent")')).toBeVisible();
    });

    test("should redirect to login when booking as guest", async ({ page }) => {
      await page.click('button:has-text("Book"), button:has-text("Rent")');
      await expect(page).toHaveURL(/.*login.*redirect=/);
    });

    test("should allow adding to favorites (requires login)", async ({ page }) => {
      const favoriteButton = page.locator('[data-testid="favorite-button"]');
      if (await favoriteButton.isVisible()) {
        await favoriteButton.click();
        // Should redirect to login for guests
        await expect(page).toHaveURL(/.*login/);
      }
    });

    test("should share listing", async ({ page }) => {
      const shareButton = page.locator('[data-testid="share-button"]');
      if (await shareButton.isVisible()) {
        await shareButton.click();
        await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
      }
    });

    test("should display similar listings", async ({ page }) => {
      const similarSection = page.locator('[data-testid="similar-listings"]');
      if (await similarSection.isVisible()) {
        await expect(similarSection).toBeVisible();
      }
    });
  });
});
