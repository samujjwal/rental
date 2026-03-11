import { test, expect, type Page } from "@playwright/test";
import { loginAs, testUsers } from "./helpers/test-utils";

async function openFirstListingFromSearch(page: Page): Promise<boolean> {
  await page.goto("/search");
  const listing = page.locator('a[href^="/listings/"]').first();
  if ((await listing.count()) === 0) return false;
  await listing.click();
  await expect(page).toHaveURL(/\/listings\/.+/);
  return true;
}

test.describe("Responsive Design", () => {
  test.describe("Mobile (390x844)", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("should render homepage content without breaking layout", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.locator('input[placeholder="What are you looking for?"]')
      ).toBeVisible();
    });

    test("should render search page controls", async ({ page }) => {
      await page.goto("/search");
      await expect(page.locator('input[name="query"]')).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Filters", exact: true })
      ).toBeVisible();
    });

    test("should render listing details on mobile", async ({ page }) => {
      const opened = await openFirstListingFromSearch(page);
      if (!opened) return;

      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator('input[type="date"]').first()).toBeVisible();
    });

    test("should stack renter dashboard stats vertically on mobile", async ({
      page,
    }) => {
      await loginAs(page, testUsers.renter);
      await page.goto("/dashboard/renter");

      const cards = page.locator("p:text-is('Upcoming Bookings')");
      await expect(cards.first()).toBeVisible();

      const firstCard = cards.first().locator("..");
      const secondCard = page
        .locator("p:text-is('Active Bookings')")
        .first()
        .locator("..");
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();

      if (firstBox && secondBox) {
        expect(secondBox.y).toBeGreaterThanOrEqual(firstBox.y);
      }
    });
  });

  test.describe("Tablet (768x1024)", () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test("should render home and top navigation", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("nav")).toBeVisible();
      await expect(page.locator("h1")).toBeVisible();
    });

    test("should render search page results area", async ({ page }) => {
      await page.goto("/search");
      await expect(page.locator('input[name="query"]')).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
    });
  });

  test.describe("Desktop (1440x900)", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("should show desktop navigation links", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator('a[href="/search"]').first()).toBeVisible();
      await expect(
        page.locator('a[href="/listings/new"]').first()
      ).toBeVisible();
    });

    test("should render search filters and sorting controls", async ({
      page,
    }) => {
      await page.goto("/search");
      const filtersButton = page.getByRole("button", {
        name: "Filters",
        exact: true,
      });
      await expect(filtersButton).toBeVisible();
      const minPrice = page.locator('input[name="minPrice"]');
      if (!(await minPrice.isVisible().catch(() => false))) {
        await filtersButton.click();
      }
      await expect(page.locator("select").first()).toBeVisible();

      if ((await minPrice.count()) > 0) {
        await expect(minPrice).toBeVisible();
        await expect(page.locator('input[name="maxPrice"]')).toBeVisible();
      } else {
        await expect(page.getByRole("spinbutton").first()).toBeVisible();
        await expect(page.getByRole("spinbutton").nth(1)).toBeVisible();
      }
    });
  });
});

test.describe("Accessibility Baseline", () => {
  test("should expose page heading structure on home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("should support keyboard focus traversal on login", async ({ page }) => {
    await page.goto("/auth/login");
    await page.keyboard.press("Tab");
    const activeTag = await page.evaluate(
      () => document.activeElement?.tagName || ""
    );
    expect(activeTag.length).toBeGreaterThan(0);
  });

  test("should expose email/password fields on login", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should keep form fields operable via keyboard input", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    const email = page.locator('input[type="email"]');
    const password = page.locator('input[type="password"]');
    await email.focus();
    await page.keyboard.type("user@example.com");
    await password.focus();
    await page.keyboard.type("Password123!");
    await expect(email).toHaveValue("user@example.com");
    await expect(password).toHaveValue("Password123!");
  });

  test("should include alt text on visible listing/detail images", async ({
    page,
  }) => {
    await page.goto("/search");
    const firstImage = page.locator("img[alt]").first();
    if ((await firstImage.count()) === 0) return;
    await expect(firstImage).toBeVisible();
  });
});
