import { test, expect } from "@playwright/test";

/**
 * Listings E2E Tests
 * Tests listing search, view, and booking flows
 */

test.describe("Listings", () => {
  test("should display listings on search page @smoke", async ({ page }) => {
    await page.goto("/search");

    // Wait for listings to load
    await page.waitForSelector('[data-testid="listing-card"]', {
      timeout: 10000,
    });

    // Should have at least one listing
    const listings = await page.locator('[data-testid="listing-card"]').count();
    expect(listings).toBeGreaterThan(0);
  });

  test("should filter listings by category", async ({ page }) => {
    await page.goto("/search");

    // Select category filter
    await page.click('[data-testid="category-filter"]');
    await page.click("text=Apartment");

    // Wait for filtered results
    await page.waitForTimeout(1000);

    // Verify filtered results
    const listings = await page.locator('[data-testid="listing-card"]');
    expect(await listings.count()).toBeGreaterThan(0);
  });

  test("should search listings by location", async ({ page }) => {
    await page.goto("/search");

    // Enter location
    await page.fill('input[placeholder*="location" i]', "New York");
    await page.press('input[placeholder*="location" i]', "Enter");

    // Wait for results
    await page.waitForTimeout(1000);

    // Should show results
    const listings = await page.locator('[data-testid="listing-card"]');
    expect(await listings.count()).toBeGreaterThan(0);
  });

  test("should view listing details @smoke", async ({ page }) => {
    await page.goto("/search");

    // Click first listing
    await page.click('[data-testid="listing-card"]');

    // Should navigate to listing detail
    await expect(page).toHaveURL(/.*listings\/[a-z0-9-]+/);

    // Should show listing details
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('[data-testid="listing-price"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="listing-description"]')
    ).toBeVisible();
  });

  test("should add listing to favorites", async ({ page, context }) => {
    // Login first
    await context.addCookies([
      {
        name: "auth_token",
        value: "test-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Click favorite button
    await page.click('[aria-label="Add to favorites"]');

    // Should show success message
    await expect(page.locator("text=/Added to favorites/i")).toBeVisible();

    // Button should show favorited state
    await expect(
      page.locator('[aria-label="Remove from favorites"]')
    ).toBeVisible();
  });

  test("should display listing images in gallery", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Should show image gallery
    const images = await page.locator('[data-testid="listing-image"]');
    expect(await images.count()).toBeGreaterThan(0);

    // Should be able to navigate images
    if ((await images.count()) > 1) {
      await page.click('[aria-label="Next image"]');
      await page.waitForTimeout(500);
      await page.click('[aria-label="Previous image"]');
    }
  });

  test("should show listing availability calendar", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Should show calendar
    await expect(
      page.locator('[data-testid="availability-calendar"]')
    ).toBeVisible();
  });

  test("should calculate booking price", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Select dates
    await page.click('[data-testid="check-in-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');

    await page.click('[data-testid="check-out-date"]');
    await page.click('[data-testid="calendar-day"]:not([disabled])');

    // Should show calculated price
    await expect(page.locator('[data-testid="total-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-price"]')).toContainText(
      "$"
    );
  });

  test("should show listing reviews", async ({ page }) => {
    await page.goto("/search");
    await page.click('[data-testid="listing-card"]');

    // Scroll to reviews section
    await page
      .locator('[data-testid="reviews-section"]')
      .scrollIntoViewIfNeeded();

    // Should show reviews or "no reviews" message
    const hasReviews =
      (await page.locator('[data-testid="review-card"]').count()) > 0;
    const hasNoReviews = await page
      .locator("text=/No reviews yet/i")
      .isVisible();

    expect(hasReviews || hasNoReviews).toBeTruthy();
  });

  test("should display map view", async ({ page }) => {
    await page.goto("/search");

    // Toggle to map view
    await page.click('[aria-label="Map view"]');

    // Should show map
    await expect(page.locator('[data-testid="listings-map"]')).toBeVisible();

    // Should show markers
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount({ min: 1 });
  });

  test("should filter by price range", async ({ page }) => {
    await page.goto("/search");

    // Set price range
    await page.fill('input[name="minPrice"]', "50");
    await page.fill('input[name="maxPrice"]', "200");
    await page.click('button:has-text("Apply")');

    // Wait for filtered results
    await page.waitForTimeout(1000);

    // Verify results are within range
    const prices = await page
      .locator('[data-testid="listing-price"]')
      .allTextContents();
    prices.forEach((priceText) => {
      const price = parseInt(priceText.replace(/[^0-9]/g, ""));
      expect(price).toBeGreaterThanOrEqual(50);
      expect(price).toBeLessThanOrEqual(200);
    });
  });

  test("should sort listings", async ({ page }) => {
    await page.goto("/search");

    // Select sort option
    await page.click('[data-testid="sort-dropdown"]');
    await page.click("text=Price: Low to High");

    // Wait for sorted results
    await page.waitForTimeout(1000);

    // Verify sorting
    const prices = await page
      .locator('[data-testid="listing-price"]')
      .allTextContents();
    const priceValues = prices.map((p) => parseInt(p.replace(/[^0-9]/g, "")));

    for (let i = 1; i < priceValues.length; i++) {
      expect(priceValues[i]).toBeGreaterThanOrEqual(priceValues[i - 1]);
    }
  });
});
