import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test.describe("Hero Section", () => {
    test("should display hero section with search", async ({ page }) => {
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    });

    test("should perform search from hero", async ({ page }) => {
      await page.fill('input[placeholder*="Search"]', "camera equipment");
      await page.click('button:has-text("Search")');
      await expect(page).toHaveURL(/.*search/);
    });
  });

  test.describe("Featured Categories", () => {
    test("should display category cards", async ({ page }) => {
      await expect(page.locator('[data-testid="category-grid"]')).toBeVisible();
    });

    test("should navigate to category search on click", async ({ page }) => {
      const categoryCard = page.locator('[data-testid="category-card"]').first();
      if (await categoryCard.isVisible()) {
        await categoryCard.click();
        await expect(page).toHaveURL(/.*search.*category/);
      }
    });
  });

  test.describe("Featured Listings", () => {
    test("should display featured listings section", async ({ page }) => {
      await expect(page.locator('text=/Featured|Popular|Trending/')).toBeVisible();
    });

    test("should navigate to listing details on card click", async ({ page }) => {
      const listingCard = page.locator('[data-testid="listing-card"]').first();
      if (await listingCard.isVisible()) {
        await listingCard.click();
        await expect(page).toHaveURL(/.*listings\/.*/);
      }
    });
  });

  test.describe("Navigation", () => {
    test("should have working navigation links", async ({ page }) => {
      // Login link
      await expect(page.locator('a[href*="login"]')).toBeVisible();
      
      // Sign up link
      await expect(page.locator('a[href*="signup"]')).toBeVisible();
    });

    test("should navigate to login page", async ({ page }) => {
      await page.click('a[href*="login"]');
      await expect(page).toHaveURL(/.*login/);
    });

    test("should navigate to signup page", async ({ page }) => {
      await page.click('a[href*="signup"]');
      await expect(page).toHaveURL(/.*signup/);
    });
  });

  test.describe("Footer", () => {
    test("should display footer with links", async ({ page }) => {
      await expect(page.locator("footer")).toBeVisible();
    });
  });
});
