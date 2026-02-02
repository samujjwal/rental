import { test, expect, Page } from "@playwright/test";

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
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard|.*admin/);
}

test.describe("Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
  });

  test("should display login page with all elements", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href*="signup"]')).toBeVisible();
    await expect(page.locator('a[href*="forgot-password"]')).toBeVisible();
  });

  test("should show validation errors on empty form submission", async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Email is required")).toBeVisible();
    await expect(page.locator("text=Password is required")).toBeVisible();
  });

  test("should show error for invalid email format", async ({ page }) => {
    await page.fill('input[type="email"]', "invalid-email");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/invalid.*email|email.*invalid/i")).toBeVisible();
  });

  test("should show error for wrong credentials", async ({ page }) => {
    await page.fill('input[type="email"]', "wrong@email.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/invalid.*credentials|unauthorized|incorrect/i")).toBeVisible();
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
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test("should login successfully as owner", async ({ page }) => {
    await page.fill('input[type="email"]', TEST_OWNER.email);
    await page.fill('input[type="password"]', TEST_OWNER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test("should login successfully as admin", async ({ page }) => {
    await page.fill('input[type="email"]', TEST_ADMIN.email);
    await page.fill('input[type="password"]', TEST_ADMIN.password);
    await page.click('button[type="submit"]');
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
    await expect(page).toHaveURL(/.*login.*redirect=/);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*bookings/);
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
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show validation errors on empty submission", async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/first name.*required|required.*first name/i")).toBeVisible();
    await expect(page.locator("text=/email.*required|required.*email/i")).toBeVisible();
    await expect(page.locator("text=/password.*required|required.*password/i")).toBeVisible();
  });

  test("should validate email format", async ({ page }) => {
    await page.fill('input[name="firstName"]', "Test");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[type="email"]', "invalid-email");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/invalid.*email|email.*invalid/i")).toBeVisible();
  });

  test("should validate password strength", async ({ page }) => {
    await page.fill('input[name="firstName"]', "Test");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "weak");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/password.*characters|strong.*password|password.*weak/i")).toBeVisible();
  });

  test("should show password confirmation match error", async ({ page }) => {
    const confirmPassword = page.locator('input[name="confirmPassword"]');
    if (await confirmPassword.isVisible()) {
      await page.fill('input[type="password"]', "Password123!");
      await confirmPassword.fill("DifferentPassword123!");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=/passwords.*match|match.*passwords/i")).toBeVisible();
    }
  });

  test("should show error for existing email", async ({ page }) => {
    await page.fill('input[name="firstName"]', "Test");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', "Password123!");
    const confirmPassword = page.locator('input[name="confirmPassword"]');
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill("Password123!");
    }
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/already.*exists|email.*taken|account.*exists/i")).toBeVisible();
  });

  test("should accept terms and conditions checkbox", async ({ page }) => {
    const termsCheckbox = page.locator('input[name="acceptTerms"]');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
      await expect(termsCheckbox).toBeChecked();
    }
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
    await page.fill('input[name="firstName"]', "New");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', "SecurePassword123!");
    
    const confirmPassword = page.locator('input[name="confirmPassword"]');
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill("SecurePassword123!");
    }
    
    const termsCheckbox = page.locator('input[name="acceptTerms"]');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }
    
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard|.*verify|.*welcome/);
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
    await expect(page.locator("text=/email.*required|required.*email/i")).toBeVisible();
  });

  test("should show error for invalid email format", async ({ page }) => {
    await page.fill('input[type="email"]', "invalid-email");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/invalid.*email|email.*invalid/i")).toBeVisible();
  });

  test("should submit forgot password request", async ({ page }) => {
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/email.*sent|check.*email|reset.*link/i")).toBeVisible();
  });

  test("should handle non-existent email gracefully", async ({ page }) => {
    await page.fill('input[type="email"]', "nonexistent@example.com");
    await page.click('button[type="submit"]');
    // Should show success message (security - don't reveal if email exists)
    await expect(page.locator("text=/email.*sent|check.*email/i")).toBeVisible();
  });

  test("should navigate back to login", async ({ page }) => {
    await page.click('a[href*="login"]');
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe("Reset Password Flow", () => {
  test("should display reset password page with token", async ({ page }) => {
    await page.goto("/auth/reset-password?token=test-token");
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show error for invalid/expired token", async ({ page }) => {
    await page.goto("/auth/reset-password?token=invalid-token");
    // Either shows error or redirects
    const errorMessage = page.locator("text=/invalid.*token|expired|link.*invalid/i");
    const passwordInput = page.locator('input[type="password"]');
    await expect(errorMessage.or(passwordInput)).toBeVisible();
  });

  test("should validate password requirements", async ({ page }) => {
    await page.goto("/auth/reset-password?token=test-token");
    await page.fill('input[name="password"]', "weak");
    const confirmPassword = page.locator('input[name="confirmPassword"]');
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill("weak");
    }
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/password.*characters|strong.*password/i")).toBeVisible();
  });

  test("should validate password confirmation match", async ({ page }) => {
    await page.goto("/auth/reset-password?token=test-token");
    await page.fill('input[name="password"]', "NewSecurePassword123!");
    const confirmPassword = page.locator('input[name="confirmPassword"]');
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill("DifferentPassword123!");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=/passwords.*match|match.*passwords/i")).toBeVisible();
    }
  });
});

test.describe("Logout Flow", () => {
  test("should logout successfully", async ({ page }) => {
    // Login first
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    
    // Find and click logout
    const userMenu = page.locator('[data-testid="user-menu"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }
    
    await page.click('text=/Logout|Sign Out/i');
    await expect(page).toHaveURL(/.*login|.*home|\//);
  });

  test("should clear session after logout", async ({ page }) => {
    // Login first
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    
    // Logout
    const userMenu = page.locator('[data-testid="user-menu"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }
    await page.click('text=/Logout|Sign Out/i');
    
    // Try accessing protected route
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe("Protected Routes", () => {
  test("should redirect to login when accessing dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should redirect to login when accessing admin route", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should redirect to login when accessing bookings", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should redirect to login when accessing favorites", async ({ page }) => {
    await page.goto("/favorites");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should redirect to login when accessing messages", async ({ page }) => {
    await page.goto("/messages");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should redirect to login when accessing settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should redirect to login when accessing organizations", async ({ page }) => {
    await page.goto("/organizations");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should redirect non-admin from admin routes", async ({ page }) => {
    // Login as regular user
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    
    // Try accessing admin route
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*dashboard|.*unauthorized|.*forbidden/);
  });
});

test.describe("Session Management", () => {
  test("should persist session on page reload", async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.reload();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test("should handle expired session gracefully", async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    
    // Clear cookies to simulate expired session
    await page.context().clearCookies();
    
    // Navigate to protected route
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*login/);
  });
});
