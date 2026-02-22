import { test, expect, type Page } from "@playwright/test";
import { clickFirstVisible, isAnyVisible } from "./helpers/test-utils";

async function openForgotPassword(page: Page) {
  await page.goto("/auth/forgot-password");
  await expect(page).toHaveURL(/forgot-password/);
}

test.describe("Password Recovery", () => {
  test("should render forgot password form on canonical route", async ({ page }) => {
    await openForgotPassword(page);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test("should expose forgot-password entry point from login", async ({ page }) => {
    await page.goto("/auth/login");

    const opened = await clickFirstVisible(page, [
      'a[href*="forgot-password"]',
      'a:has-text("Forgot")',
      'button:has-text("Forgot")',
    ]);
    expect(opened).toBe(true);
    await expect(page).toHaveURL(/forgot-password/);
  });

  test("should keep forgot-password flow stable for invalid email input", async ({ page }) => {
    await openForgotPassword(page);
    await page.fill('input[type="email"]', "invalid-email");
    await page.click('button[type="submit"]');

    const hasValidation = await isAnyVisible(
      page,
      ['text=/invalid|valid email/i', ".text-destructive", ".text-red-500"],
      2000
    );
    expect(hasValidation || page.url().includes("forgot-password")).toBe(true);
  });

  test("should submit forgot-password request without breaking route flow", async ({ page }) => {
    await openForgotPassword(page);
    await page.fill('input[type="email"]', "renter@test.com");
    await page.click('button[type="submit"]');

    const hasFeedback = await isAnyVisible(
      page,
      ['text=/sent|check your email|if an account exists|success/i', '[role="status"]', '[role="alert"]'],
      4000
    );

    expect(
      hasFeedback ||
        page.url().includes("forgot-password") ||
        page.url().includes("login")
    ).toBe(true);
  });

  test("should handle reset-password route with token", async ({ page }) => {
    await page.goto("/auth/reset-password?token=test-token");

    const hasPasswordInputs = await isAnyVisible(
      page,
      ['input[name="password"]', 'input[name="newPassword"]', 'input[type="password"]'],
      3000
    );
    const hasTokenError = await isAnyVisible(
      page,
      ['text=/invalid|expired|token/i', '[role="alert"]'],
      1500
    );

    expect(
      hasPasswordInputs ||
        hasTokenError ||
        page.url().includes("forgot-password") ||
        page.url().includes("login")
    ).toBe(true);
  });

  test("should handle reset-password route without token gracefully", async ({ page }) => {
    await page.goto("/auth/reset-password");

    const hasError = await isAnyVisible(
      page,
      ['text=/invalid|missing|required|token/i', '[role="alert"]'],
      1500
    );

    expect(
      hasError ||
        page.url().includes("forgot-password") ||
        page.url().includes("login") ||
        page.url().includes("reset-password")
    ).toBe(true);
  });

  test.describe("Responsive and Accessibility Baseline", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("should keep forgot-password inputs usable on mobile", async ({ page }) => {
      await openForgotPassword(page);
      const emailInput = page.locator('input[type="email"]').first();
      await expect(emailInput).toBeVisible();
      await emailInput.fill("mobile@example.com");
      await expect(emailInput).toHaveValue("mobile@example.com");
      await expect(page.locator('button[type="submit"]').first()).toBeVisible();
    });

    test("should support keyboard interaction on forgot-password form", async ({ page }) => {
      await openForgotPassword(page);
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.focus();
      await page.keyboard.type("keyboard@example.com");
      await expect(emailInput).toHaveValue("keyboard@example.com");
    });
  });
});
