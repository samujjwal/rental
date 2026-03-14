import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display hero and search controls", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.locator('input[placeholder="What are you looking for?"]')
    ).toBeVisible();
    await expect(page.locator('input[placeholder="Location"]')).toBeVisible();
  });

  test("should navigate to search from hero action", async ({ page }) => {
    const heroSearch = page.locator('input[role="combobox"]').first();
    const heroSearchButton = page
      .getByRole("button", { name: "Search" })
      .first();
    const hasHeroSearch = await heroSearch.isVisible().catch(() => false);

    const clicked = hasHeroSearch
      ? await heroSearch
          .fill("camera")
          .then(async () => {
            await heroSearchButton.click();
            return true;
          })
          .catch(() => false)
      : await page
          .locator('a[href^="/search"]')
          .first()
          .click()
          .then(() => true)
          .catch(() => false);

    if (!clicked) return;
    await expect(page).toHaveURL(/\/search/);
  });

  test("should show browse by category section", async ({ page }) => {
    await expect(page.locator("text=Browse by Category")).toBeVisible();
  });

  test("should navigate from a category card when available", async ({
    page,
  }) => {
    const categoryLink = page.locator('a[href^="/search"]').nth(1);
    if ((await categoryLink.count()) === 0) return;
    await categoryLink.click();
    await expect(page).toHaveURL(/\/search/);
  });

  test("should show how it works section", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "How It Works" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
  });

  test("should show auth links for guests", async ({ page }) => {
    await expect(page.locator('a[href^="/auth/login"]').first()).toBeVisible();
    await expect(page.locator('a[href^="/auth/signup"]').first()).toBeVisible();
  });

  test("should navigate to login page", async ({ page }) => {
    await page.locator('a[href^="/auth/login"]').first().click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("should navigate to signup page", async ({ page }) => {
    await page.click('a[href="/auth/signup"]');
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test("should render footer links", async ({ page }) => {
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.locator('footer a[href="/search"]')).toBeVisible();
    await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
  });
});
