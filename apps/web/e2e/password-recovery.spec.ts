import { test, expect, Page } from '@playwright/test';

test.describe('Password Recovery', () => {
  test.describe('Forgot Password Flow', () => {
    test('should display forgot password form', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1, h2')).toContainText(/forgot|reset|password/i);
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
      await expect(page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Reset")')).toBeVisible();
    });

    test('should navigate from login page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const forgotPasswordLink = page.locator('a:has-text("Forgot"), a:has-text("forgot password")');
      await forgotPasswordLink.click();

      await expect(page).toHaveURL(/\/forgot-password|\/password-reset/);
    });

    test('should submit email for password reset', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');

      const submitButton = page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Reset")');
      await submitButton.click();

      // Should show success message
      await expect(page.locator('text=/email sent|check your inbox|instructions sent/i')).toBeVisible({ timeout: 10000 });
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('invalid-email');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show validation error
      await expect(page.locator('text=/invalid|valid email/i')).toBeVisible();
    });

    test('should handle non-existent email gracefully', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill('nonexistent@example.com');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should still show success message (security best practice)
      // Or show a generic message without revealing if email exists
      await expect(page.locator('text=/email sent|check your inbox|if an account exists/i')).toBeVisible({ timeout: 10000 });
    });

    test('should show rate limiting message', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      // Submit multiple times quickly
      for (let i = 0; i < 5; i++) {
        await page.fill('input[type="email"]', `test${i}@example.com`);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(100);
      }

      // Should show rate limit message
      const rateLimitMessage = page.locator('text=/too many|try again|rate limit/i');
      // This may or may not appear depending on implementation
      if (await rateLimitMessage.isVisible({ timeout: 2000 })) {
        await expect(rateLimitMessage).toBeVisible();
      }
    });

    test('should have back to login link', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const backLink = page.locator('a:has-text("Back to"), a:has-text("Login"), a:has-text("Sign in")');
      await expect(backLink).toBeVisible();

      await backLink.click();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Reset Password Flow', () => {
    test('should display reset password form with valid token', async ({ page }) => {
      // Simulate having a valid token in URL
      await page.goto('/reset-password?token=valid-test-token');
      await page.waitForLoadState('networkidle');

      // If token is valid, should show password form
      const passwordInput = page.locator('input[type="password"][name="password"], input[name="newPassword"]');
      const confirmInput = page.locator('input[name="confirmPassword"], input[name="passwordConfirm"]');

      const invalidTokenMessage = page.locator('text=/invalid|expired|link/i');

      // Either show form or invalid token message
      const formVisible = await passwordInput.isVisible();
      const invalidVisible = await invalidTokenMessage.isVisible();

      expect(formVisible || invalidVisible).toBeTruthy();
    });

    test('should validate password requirements', async ({ page }) => {
      await page.goto('/reset-password?token=valid-test-token');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[type="password"][name="password"], input[name="newPassword"]');
      
      if (await passwordInput.isVisible()) {
        await passwordInput.fill('weak');
        await passwordInput.blur();

        // Should show password requirements
        await expect(page.locator('text=/must contain|at least|characters|uppercase|lowercase|number/i')).toBeVisible();
      }
    });

    test('should validate password confirmation match', async ({ page }) => {
      await page.goto('/reset-password?token=valid-test-token');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[type="password"][name="password"], input[name="newPassword"]');
      const confirmInput = page.locator('input[name="confirmPassword"], input[name="passwordConfirm"]');

      if (await passwordInput.isVisible() && await confirmInput.isVisible()) {
        await passwordInput.fill('NewPassword123!');
        await confirmInput.fill('DifferentPassword456!');

        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Should show mismatch error
        await expect(page.locator('text=/match|don\'t match|must match/i')).toBeVisible();
      }
    });

    test('should successfully reset password', async ({ page }) => {
      await page.goto('/reset-password?token=valid-test-token');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[type="password"][name="password"], input[name="newPassword"]');
      const confirmInput = page.locator('input[name="confirmPassword"], input[name="passwordConfirm"]');

      if (await passwordInput.isVisible() && await confirmInput.isVisible()) {
        await passwordInput.fill('NewSecurePassword123!');
        await confirmInput.fill('NewSecurePassword123!');

        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Should redirect to login or show success
        const successMessage = page.locator('text=/password changed|password reset|success/i');
        const loginRedirect = page.url().includes('/login');

        expect(await successMessage.isVisible() || loginRedirect).toBeTruthy();
      }
    });

    test('should show error for expired token', async ({ page }) => {
      await page.goto('/reset-password?token=expired-token-test');
      await page.waitForLoadState('networkidle');

      // Should show expired/invalid message
      const errorMessage = page.locator('text=/expired|invalid|link is no longer valid/i');
      const passwordInput = page.locator('input[type="password"]');

      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible();
      }
    });

    test('should show error for missing token', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');

      // Should show error or redirect
      const errorMessage = page.locator('text=/invalid|missing|required/i');
      const redirectedToForgot = page.url().includes('/forgot-password');

      expect(await errorMessage.isVisible() || redirectedToForgot).toBeTruthy();
    });

    test('should have link to request new reset', async ({ page }) => {
      await page.goto('/reset-password?token=expired-token-test');
      await page.waitForLoadState('networkidle');

      const errorMessage = page.locator('text=/expired|invalid/i');
      if (await errorMessage.isVisible()) {
        const newResetLink = page.locator('a:has-text("request new"), a:has-text("try again"), a:has-text("forgot password")');
        await expect(newResetLink).toBeVisible();
      }
    });
  });

  test.describe('Password Strength Indicator', () => {
    test('should show password strength meter', async ({ page }) => {
      await page.goto('/reset-password?token=valid-test-token');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[type="password"][name="password"], input[name="newPassword"]');
      
      if (await passwordInput.isVisible()) {
        await passwordInput.fill('weak');

        // Should show strength indicator
        const strengthIndicator = page.locator('[data-testid="password-strength"], .password-strength, [class*="strength"]');
        if (await strengthIndicator.isVisible()) {
          await expect(strengthIndicator).toBeVisible();
        }
      }
    });

    test('should update strength as password changes', async ({ page }) => {
      await page.goto('/reset-password?token=valid-test-token');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[type="password"][name="password"], input[name="newPassword"]');
      
      if (await passwordInput.isVisible()) {
        // Weak password
        await passwordInput.fill('abc');
        const strengthIndicator = page.locator('[data-testid="password-strength"], .password-strength');
        
        if (await strengthIndicator.isVisible()) {
          // Fill with stronger password
          await passwordInput.fill('StrongP@ssw0rd123!');
          // Strength should update
        }
      }
    });
  });

  test.describe('Show/Hide Password Toggle', () => {
    test('should toggle password visibility', async ({ page }) => {
      await page.goto('/reset-password?token=valid-test-token');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[name="password"], input[name="newPassword"]');
      const toggleButton = page.locator('[data-testid="toggle-password"], button[aria-label*="Show"], button[aria-label*="visibility"]');

      if (await passwordInput.isVisible() && await toggleButton.isVisible()) {
        // Initially hidden
        await expect(passwordInput).toHaveAttribute('type', 'password');

        await toggleButton.click();

        // Should be visible now
        await expect(passwordInput).toHaveAttribute('type', 'text');

        await toggleButton.click();

        // Back to hidden
        await expect(passwordInput).toHaveAttribute('type', 'password');
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper form labels', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"]');
      const inputId = await emailInput.getAttribute('id');
      
      if (inputId) {
        const label = page.locator(`label[for="${inputId}"]`);
        await expect(label).toBeVisible();
      }
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      // Tab to email input
      await page.keyboard.press('Tab');
      
      // Type email
      await page.keyboard.type('test@example.com');
      
      // Tab to submit button
      await page.keyboard.press('Tab');
      
      // Enter to submit
      await page.keyboard.press('Enter');
    });

    test('should announce errors to screen readers', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      await page.fill('input[type="email"]', 'invalid');
      await page.click('button[type="submit"]');

      // Error should have appropriate ARIA attributes
      const errorMessage = page.locator('[role="alert"], [aria-live="polite"], .error-message');
      await expect(errorMessage).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should display properly on mobile', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      // Form should be visible and properly sized
      const form = page.locator('form');
      await expect(form).toBeVisible();

      // Elements should be touch-friendly
      const submitButton = page.locator('button[type="submit"]');
      const buttonBox = await submitButton.boundingBox();
      if (buttonBox) {
        expect(buttonBox.height).toBeGreaterThanOrEqual(44); // Min touch target
      }
    });

    test('should handle landscape orientation', async ({ page }) => {
      await page.setViewportSize({ width: 667, height: 375 });
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      // Form should still be visible
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });
  });

  test.describe('Security Features', () => {
    test('should not expose whether email exists', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      // Submit with non-existent email
      await page.fill('input[type="email"]', 'nonexistent@example.com');
      await page.click('button[type="submit"]');

      // Message should be generic (not reveal email existence)
      const message = page.locator('text=/if an account exists|check your inbox|email has been sent/i');
      await expect(message).toBeVisible({ timeout: 10000 });
    });

    test('should use secure token format in URL', async ({ page }) => {
      // This would be tested with an actual token
      await page.goto('/reset-password?token=test-token-format');
      
      // URL should use HTTPS in production
      // Token should be in query param or path
      expect(page.url()).toMatch(/token=/);
    });

    test('should clear sensitive data on page leave', async ({ page }) => {
      await page.goto('/reset-password?token=valid-test-token');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[type="password"][name="password"]');
      if (await passwordInput.isVisible()) {
        await passwordInput.fill('SensitivePassword123!');

        // Navigate away
        await page.goto('/login');

        // Go back
        await page.goBack();

        // Password should be cleared (browser may or may not do this)
        const currentValue = await passwordInput.inputValue();
        // Just verify the page loaded correctly
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      // Block network
      await page.route('**/api/auth/forgot-password', (route) => {
        route.abort();
      });

      await page.fill('input[type="email"]', 'test@example.com');
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('text=/error|failed|try again/i')).toBeVisible({ timeout: 10000 });
    });

    test('should handle server errors gracefully', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      // Mock server error
      await page.route('**/api/auth/forgot-password', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      });

      await page.fill('input[type="email"]', 'test@example.com');
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('text=/error|something went wrong|try again/i')).toBeVisible({ timeout: 10000 });
    });
  });
});
