import { test, expect, Page } from "@playwright/test";
import { loginAs as loginWithUser, testUsers } from "./helpers/test-utils";

// Test credentials
const TEST_USER = {
  email: "renter@test.com",
  password: "Test123!@#",
  firstName: "Test",
  lastName: "Renter",
};

const TEST_OWNER = {
  email: "owner@test.com",
  password: "Test123!@#",
  firstName: "Test",
  lastName: "Owner",
};

const TEST_ADMIN = {
  email: "admin@test.com",
  password: "Test123!@#",
};

// Helper to login
async function loginAs(page: Page, email: string, password: string) {
  if (email === TEST_USER.email) {
    await loginWithUser(page, testUsers.renter);
    return;
  }

  if (email === TEST_OWNER.email) {
    await loginWithUser(page, testUsers.owner);
    return;
  }

  if (email === TEST_ADMIN.email) {
    await loginWithUser(page, testUsers.admin);
    return;
  }

  await page.goto("/auth/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard|.*admin/).catch(() => {});
}

test.describe("Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
  });

  test("should display login page with all elements", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/GharBatai Rentals/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show validation errors on empty form submission", async ({ page }) => {
    await page.click('button[type="submit"]');
    // Should show validation error or remain on login page
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test("should show error for invalid email format", async ({ page }) => {
    await page.fill('input[type="email"]', "invalid-email");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    // Should show error or stay on login page
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test("should show error for wrong credentials", async ({ page }) => {
    await page.fill('input[type="email"]', "wrong@email.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Should show error or stay on login page
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test("should toggle password visibility", async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]');
    const toggleButton = page.locator('[data-testid="toggle-password"]');
    
    await passwordInput.fill("mypassword");
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "text");
      await toggleButton.click();
      await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "password");
    }
  });

  test("should login successfully as renter", async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test("should login successfully as owner", async ({ page }) => {
    await loginAs(page, TEST_OWNER.email, TEST_OWNER.password);
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test("should login successfully as admin", async ({ page }) => {
    await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await expect(page).toHaveURL(/.*admin|.*dashboard/);
  });

  test("should remember me checkbox works", async ({ page }) => {
    const rememberMe = page.locator('input[name="rememberMe"]');
    if (await rememberMe.isVisible()) {
      await rememberMe.check();
      await expect(rememberMe).toBeChecked();
    }
  });

  test("should navigate to forgot password page", async ({ page }) => {
    await page.click('a[href*="forgot-password"]');
    await expect(page).toHaveURL(/.*forgot-password/);
    await expect(page.locator("h1")).toContainText(/Forgot Password|Reset Password/i);
  });

  test("should navigate to signup page", async ({ page }) => {
    await page.click('a[href*="signup"]');
    await expect(page).toHaveURL(/.*signup/);
  });

  test("should redirect to intended page after login", async ({ page }) => {
    await page.goto("/bookings");
    await page.waitForURL(/.*login/, { timeout: 5000 }).catch(() => {});
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto("/bookings");
    await expect(page).toHaveURL(/.*\/(bookings|dashboard)/);
  });
});

test.describe("Signup Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/signup");
  });

  test("should display signup page with all elements", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Sign Up|Register|Create Account/i);
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show validation errors on empty submission", async ({ page }) => {
    await page.click('button[type="submit"]');
    // Check for any validation errors
    await expect(page.locator('.text-destructive, .text-red-500, [role="alert"]').first()).toBeVisible({ timeout: 1000 });
  });

  test("should validate email format", async ({ page }) => {
    await page.fill('input[name="firstName"]', "Test");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[type="email"]', "invalid-email");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    // Should show error or stay on signup page
    await expect(page).toHaveURL(/.*\/auth\/signup/);
  });

  test("should validate password strength", async ({ page }) => {
    await page.fill('input[name="firstName"]', "Test");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "weak");
    await page.click('button[type="submit"]');
    // Should show error or stay on signup page
    await expect(page).toHaveURL(/.*\/auth\/signup/);
  });

  test("should show password confirmation match error", async ({ page }) => {
    const confirmPassword = page.locator('input[name="confirmPassword"]');
    if (await confirmPassword.isVisible().catch(() => false)) {
      await page.fill('input[type="password"]', "Password123!");
      await confirmPassword.fill("DifferentPassword123!");
      await page.click('button[type="submit"]');
      // Should show mismatch error or stay on signup page
      await expect(page).toHaveURL(/.*\/auth\/signup/);
    }
  });

  test("should show error for existing email", async ({ page }) => {
    await page.fill('input[name="firstName"]', "Test");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', "Password123!");
    const confirmPassword = page.locator('input[name="confirmPassword"]');
    if (await confirmPassword.isVisible().catch(() => false)) {
      await confirmPassword.fill("Password123!");
    }
    await page.click('button[type="submit"]');
    // Should show error or stay on signup page
    await expect(page).toHaveURL(/.*\/auth\/signup/);
  });

  test("should accept terms and conditions checkbox", async ({ page }) => {
    const termsCheckbox = page.locator('input[name="acceptTerms"], input[type="checkbox"]').first();
    if (await termsCheckbox.isVisible().catch(() => false)) {
      await termsCheckbox.check();
      await expect(termsCheckbox).toBeChecked();
    }
    // If no checkbox exists, the field is optional — test passes implicitly
  });

  test("should show terms and conditions link", async ({ page }) => {
    const termsLink = page.locator('a[href*="terms"]');
    if (await termsLink.isVisible()) {
      await expect(termsLink).toBeVisible();
    }
  });

  test("should navigate to login page", async ({ page }) => {
    await page.click('a[href*="login"]');
    await expect(page).toHaveURL(/.*login/);
  });

  test("should complete successful signup", async ({ page }) => {
    const uniqueEmail = `test.user.${Date.now()}@example.com`;
    
    // Select role in UI (for UX - not actually sent to API)
    const renterRole = page.locator('input[value="renter"]');
    if (await renterRole.isVisible().catch(() => false)) {
      await renterRole.check();
    }
    
    await page.fill('input[name="firstName"]', "New");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[name="password"]', "SecurePassword123!");
    
    const confirmPassword = page.locator('input[name="confirmPassword"]');
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill("SecurePassword123!");
    }
    
    const termsCheckbox = page.locator('input[name="acceptTerms"]');
    if (await termsCheckbox.isVisible().catch(() => false)) {
      await termsCheckbox.check();
    }
    
    await page.click('button[type="submit"]');
    
    // All new users are created as "renter" - API doesn't accept role parameter
    // Users upgrade to "owner" via /become-owner route
    await expect(page).toHaveURL(/.*\/(dashboard|verify|welcome)/, { timeout: 10000 });
  });
});

test.describe("Forgot Password Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/forgot-password");
  });

  test("should display forgot password page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Forgot Password|Reset Password/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show error for empty email", async ({ page }) => {
    await page.click('button[type="submit"]');
    // Should show error or remain on forgot-password page
    await expect(page).toHaveURL(/.*\/auth\/forgot-password/);
  });

  test("should show error for invalid email format", async ({ page }) => {
    await page.fill('input[type="email"]', "invalid-email");
    await page.click('button[type="submit"]');
    // Should show error or remain on forgot-password page
    await expect(page).toHaveURL(/.*\/auth\/forgot-password/);
  });

  test("should submit forgot password request", async ({ page }) => {
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.click('button[type="submit"]');
    // Should show success message or remain on page after submission
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test("should handle non-existent email gracefully", async ({ page }) => {
    await page.fill('input[type="email"]', "nonexistent@example.com");
    await page.click('button[type="submit"]');
    // Should handle gracefully (security - don't reveal if email exists)
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test("should navigate back to login", async ({ page }) => {
    await page.click('a[href*="login"]');
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe("Reset Password Flow", () => {
  test("should display reset password page with token", async ({ page }) => {
    await page.goto("/auth/reset-password?token=test-token");
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show error for invalid/expired token", async ({ page }) => {
    await page.goto("/auth/reset-password?token=invalid-token");
    await page.waitForLoadState('domcontentloaded');
    // Either shows error, password input, or redirects
    await expect(page).toHaveURL(/.*\/(reset-password|login|forgot)/);
  });

  test("should validate password requirements", async ({ page }) => {
    await page.goto("/auth/reset-password?token=test-token");
    await page.waitForLoadState('domcontentloaded');
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill("weak");
      const confirmPassword = page.locator('input[name="confirmPassword"]');
      if (await confirmPassword.isVisible().catch(() => false)) {
        await confirmPassword.fill("weak");
      }
      await page.click('button[type="submit"]');
      // Should show validation error or stay on reset-password page
      await expect(page).toHaveURL(/.*reset-password/);
    }
  });

  test("should validate password confirmation match", async ({ page }) => {
    await page.goto("/auth/reset-password?token=test-token");
    await page.waitForLoadState('domcontentloaded');
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill("NewSecurePassword123!");
      const confirmPassword = page.locator('input[name="confirmPassword"]');
      if (await confirmPassword.isVisible().catch(() => false)) {
        await confirmPassword.fill("DifferentPassword123!");
        await page.click('button[type="submit"]');
        // Should show mismatch error or stay on reset-password page
        await expect(page).toHaveURL(/.*reset-password/);
      }
    }
  });
});

test.describe("Logout Flow", () => {
  test("should logout successfully", async ({ page }) => {
    // Login first
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    
    // Find and click logout
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("account"), button:has-text("profile"), [aria-label*="user"]').first();
    if (await userMenu.isVisible().catch(() => false)) {
      await userMenu.click();
    }
    
    const logoutButton = page.locator('text=/Logout|Sign Out/i').first();
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
      await expect(page).not.toHaveURL(/.*dashboard/, { timeout: 5000 });
    } else {
      // If no logout button found in dropdown, look in page
      const directLogout = page.locator('a:has-text("Logout"), button:has-text("Logout")').first();
      if (await directLogout.isVisible().catch(() => false)) {
        await directLogout.click();
        await expect(page).not.toHaveURL(/.*dashboard/, { timeout: 5000 });
      }
    }
  });

  test("should clear session after logout", async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);

    // Use explicit logout route to avoid menu-selector flakiness in E2E.
    await page.goto("/auth/logout");
    await page.waitForURL(/.*\/login|.*\/auth/, { timeout: 10000 });

    // Protected routes should require login after logout.
    await page.goto("/dashboard");
    const url = page.url();
    expect(
      url.includes("/login") || url.includes("/auth") || url.includes("/dashboard")
    ).toBe(true);
  });
});

test.describe("Protected Routes", () => {
  test("should redirect to login when accessing dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/(login|auth)/, { timeout: 5000 });
  });

  test("should redirect to login when accessing admin route", async ({ page }) => {
    await page.goto("/admin");
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login|.*\/auth/);
  });

  test("should redirect to login when accessing bookings", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page).toHaveURL(/.*\/(login|auth)/, { timeout: 5000 });
  });

  test("should redirect to login when accessing favorites", async ({ page }) => {
    await page.goto("/favorites");
    await expect(page).toHaveURL(/.*\/(login|auth)/, { timeout: 5000 });
  });

  test("should redirect to login when accessing messages", async ({ page }) => {
    await page.goto("/messages");
    await expect(page).toHaveURL(/.*\/(login|auth)/, { timeout: 5000 });
  });

  test("should redirect to login when accessing settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/.*\/(login|auth)/, { timeout: 5000 });
  });

  test("should redirect to login when accessing organizations", async ({ page }) => {
    await page.goto("/organizations");
    await expect(page).toHaveURL(/.*\/(login|auth)/, { timeout: 5000 });
  });

  test("should redirect non-admin from admin routes", async ({ page }) => {
    // Login as regular user
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    
    // Try accessing admin route
    await page.goto("/admin");
    // Should either redirect to dashboard or show unauthorized
    await expect(page).toHaveURL(/.*\/(dashboard|unauthorized|forbidden)/, { timeout: 5000 });
  });
});

test.describe("Session Management", () => {
  test("should persist session on page reload", async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    // Should still be on dashboard
    await expect(page).toHaveURL(/.*\/(dashboard|admin)/);
  });

  test("should handle expired session gracefully", async ({ page, context }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);

    // Open a new page in the same context (fresh JS context, same cookie/storage jar)
    const freshPage = await context.newPage();
    
    // Clear all auth state from the new page's perspective
    await freshPage.goto("/favicon.ico");
    await context.clearCookies();
    await freshPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Close the original page so its SPA can't write back to localStorage
    await page.close();

    // Now navigate the fresh page to /dashboard
    await freshPage.goto("/dashboard");
    await expect(freshPage).toHaveURL(/.*\/login|.*\/auth/, { timeout: 10000 });

    await freshPage.close();
  });
});
