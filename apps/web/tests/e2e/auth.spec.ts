import { test, expect } from "@playwright/test";

/**
 * Authentication E2E Tests
 * Tests critical authentication flows
 */

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display login page", async ({ page }) => {
    await page.click("text=Login");
    await expect(page).toHaveURL(/.*auth\/login/);
    await expect(page.locator("h1")).toContainText("Login");
  });

  test("should login with valid credentials @smoke", async ({ page }) => {
    // Navigate to login
    await page.goto("/auth/login");

    // Fill in credentials
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForURL("/dashboard");

    // Verify logged in
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.goto("/auth/login");

    await page.fill('input[name="email"]', "invalid@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator("text=/Invalid credentials/i")).toBeVisible();
  });

  test("should register new user", async ({ page }) => {
    await page.goto("/auth/register");

    // Fill registration form
    await page.fill('input[name="firstName"]', "Test");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[name="password"]', "Password123!");
    await page.fill('input[name="confirmPassword"]', "Password123!");

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard or email verification
    await page.waitForURL(/\/(dashboard|auth\/verify-email)/);
  });

  test("should logout successfully", async ({ page }) => {
    // Login first
    await page.goto("/auth/login");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");

    // Logout
    await page.click('[aria-label="User menu"]');
    await page.click("text=Logout");

    // Should redirect to home
    await page.waitForURL("/");
    await expect(page.locator("text=Login")).toBeVisible();
  });

  test("should handle password reset flow", async ({ page }) => {
    await page.goto("/auth/forgot-password");

    await page.fill('input[name="email"]', "test@example.com");
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator("text=/Check your email/i")).toBeVisible();
  });

  test("should validate email format", async ({ page }) => {
    await page.goto("/auth/login");

    await page.fill('input[name="email"]', "invalid-email");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator("text=/Invalid email/i")).toBeVisible();
  });

  test("should validate password requirements", async ({ page }) => {
    await page.goto("/auth/register");

    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "123"); // Too short

    // Should show validation error
    await expect(page.locator("text=/at least 8 characters/i")).toBeVisible();
  });
});
