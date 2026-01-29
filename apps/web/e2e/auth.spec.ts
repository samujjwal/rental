import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/auth/login");

    await expect(page.locator("h1")).toContainText("Login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should display signup page", async ({ page }) => {
    await page.goto("/auth/signup");

    await expect(page.locator("h1")).toContainText("Sign Up");
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should show validation errors on empty form submission", async ({
    page,
  }) => {
    await page.goto("/auth/login");

    await page.click('button[type="submit"]');

    await expect(page.locator("text=Email is required")).toBeVisible();
    await expect(page.locator("text=Password is required")).toBeVisible();
  });

  test("should navigate to forgot password page", async ({ page }) => {
    await page.goto("/auth/login");

    await page.click("text=Forgot password?");

    await expect(page).toHaveURL(/.*forgot-password/);
    await expect(page.locator("h1")).toContainText("Forgot Password");
  });
});

test.describe("Protected Routes", () => {
  test("should redirect to login when accessing protected route", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/.*login/);
  });

  test("should redirect to login when accessing admin route", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/.*login/);
  });
});
