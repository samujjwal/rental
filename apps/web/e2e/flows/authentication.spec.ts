import { test, expect } from '@playwright/test';
import { AuthPage } from '../page-objects/auth.po';
import { NavigationHelper } from '../helpers/navigation';

/**
 * Authentication E2E Test Suite
 * Comprehensive coverage for all authentication flows
 */
test.describe('Authentication Flow', () => {
  let authPage: AuthPage;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    navHelper = new NavigationHelper(page);
  });

  test('complete successful authentication journey', async ({ page }) => {
    await test.step('navigate to login page', async () => {
      await page.goto('/');
      await navHelper.navigateToLogin();
      await expect(page).toHaveURL('/auth/login');
      await expect(page.locator('h1')).toContainText('Sign In');
    });

    await test.step('login with valid credentials', async () => {
      await authPage.login('renter@example.com', 'password123');
      await expect(page.locator('[data-testid=user-avatar]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid=user-name]')).toContainText('Test Renter');
    });

    await test.step('verify dashboard access', async () => {
      await navHelper.navigateToDashboard();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('[data-testid=dashboard-content]')).toBeVisible();
      await expect(page.locator('[data-testid=welcome-message]')).toContainText('Welcome');
    });

    await test.step('verify protected route access', async () => {
      await page.goto('/bookings');
      await expect(page).toHaveURL('/bookings');
      await expect(page.locator('[data-testid=bookings-list]')).toBeVisible();
    });

    await test.step('logout successfully', async () => {
      await authPage.logout();
      await expect(page).toHaveURL('/auth/login');
      await expect(page.locator('[data-testid=login-form]')).toBeVisible();
    });

    await test.step('verify protected routes after logout', async () => {
      await page.goto('/bookings');
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });

  test('handles invalid login credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await test.step('empty form submission', async () => {
      await page.click('[data-testid=login-button]');
      await expect(page.locator('[data-testid=email-error]')).toContainText('Required');
      await expect(page.locator('[data-testid=password-error]')).toContainText('Required');
    });

    await test.step('invalid email format', async () => {
      await page.fill('[data-testid=email-input]', 'invalid-email');
      await page.fill('[data-testid=password-input]', 'password123');
      await page.click('[data-testid=login-button]');
      await expect(page.locator('[data-testid=email-error]')).toContainText('Invalid email');
    });

    await test.step('incorrect password', async () => {
      await page.fill('[data-testid=email-input]', 'renter@example.com');
      await page.fill('[data-testid=password-input]', 'wrongpassword');
      await page.click('[data-testid=login-button]');
      await expect(page.locator('[data-testid=login-error]')).toContainText('Invalid credentials');
      await expect(page.locator('[data-testid=login-error]')).toContainText('Please check your email and password');
    });

    await test.step('non-existent user', async () => {
      await page.fill('[data-testid=email-input]', 'nonexistent@example.com');
      await page.fill('[data-testid=password-input]', 'password123');
      await page.click('[data-testid=login-button]');
      await expect(page.locator('[data-testid=login-error]')).toContainText('Invalid credentials');
    });
  });

  test('signup flow with validation', async ({ page }) => {
    await page.goto('/auth/signup');

    await test.step('validate required fields', async () => {
      await page.click('[data-testid=signup-button]');
      await expect(page.locator('[data-testid=email-error]')).toBeVisible();
      await expect(page.locator('[data-testid=password-error]')).toBeVisible();
      await expect(page.locator('[data-testid=confirm-password-error]')).toBeVisible();
    });

    await test.step('validate email format', async () => {
      await page.fill('[data-testid=signup-email]', 'invalid-email');
      await page.fill('[data-testid=signup-password]', 'password123');
      await page.fill('[data-testid=signup-confirm-password]', 'password123');
      await page.click('[data-testid=signup-button]');
      await expect(page.locator('[data-testid=email-error]')).toContainText('Invalid email');
    });

    await test.step('validate password strength', async () => {
      await page.fill('[data-testid=signup-email]', 'newuser@example.com');
      await page.fill('[data-testid=signup-password]', '123');
      await page.fill('[data-testid=signup-confirm-password]', '123');
      await page.click('[data-testid=signup-button]');
      await expect(page.locator('[data-testid=password-error]')).toContainText('at least 8 characters');
    });

    await test.step('validate password confirmation', async () => {
      await page.fill('[data-testid=signup-email]', 'newuser@example.com');
      await page.fill('[data-testid=signup-password]', 'password123');
      await page.fill('[data-testid=signup-confirm-password]', 'differentpassword');
      await page.click('[data-testid=signup-button]');
      await expect(page.locator('[data-testid=confirm-password-error]')).toContainText('Passwords do not match');
    });

    await test.step('validate terms acceptance', async () => {
      await page.fill('[data-testid=signup-email]', 'newuser@example.com');
      await page.fill('[data-testid=signup-password]', 'password123');
      await page.fill('[data-testid=signup-confirm-password]', 'password123');
      await page.selectOption('[data-testid=role-select]', 'renter');
      await page.click('[data-testid=signup-button]');
      await expect(page.locator('[data-testid=terms-error]')).toContainText('Please accept the terms');
    });

    await test.step('successful signup', async ({ page }) => {
      const uniqueEmail = `test${Date.now()}@example.com`;
      await page.fill('[data-testid=signup-email]', uniqueEmail);
      await page.fill('[data-testid=signup-password]', 'SecurePass123!');
      await page.fill('[data-testid=signup-confirm-password]', 'SecurePass123!');
      await page.fill('[data-testid=first-name]', 'Test');
      await page.fill('[data-testid=last-name]', 'User');
      await page.selectOption('[data-testid=role-select]', 'renter');
      await page.check('[data-testid=terms-checkbox]');
      await page.click('[data-testid=signup-button]');
      
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
      await expect(page.locator('[data-testid=welcome-message]')).toContainText('Welcome');
    });
  });

  test('password reset flow', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    await test.step('request password reset', async () => {
      await page.fill('[data-testid=email-input]', 'renter@example.com');
      await page.click('[data-testid=reset-button]');
      await expect(page.locator('[data-testid=success-message]')).toContainText('Reset link sent');
    });

    await test.step('invalid email for reset', async () => {
      await page.goto('/auth/forgot-password');
      await page.fill('[data-testid=email-input]', 'nonexistent@example.com');
      await page.click('[data-testid=reset-button]');
      // Should still show success to prevent email enumeration
      await expect(page.locator('[data-testid=success-message]')).toContainText('Reset link sent');
    });
  });

  test('session expiry handling', async ({ page, context }) => {
    await test.step('login and verify session', async () => {
      await page.goto('/auth/login');
      await authPage.login('renter@example.com', 'password123');
      await expect(page.locator('[data-testid=user-avatar]')).toBeVisible();
    });

    await test.step('simulate token expiry', async () => {
      // Clear cookies to simulate token expiry
      await context.clearCookies();
      
      // Try to access protected route
      await page.goto('/bookings');
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.locator('[data-testid=session-expired-message]')).toContainText('Session expired');
    });

    await test.step('re-login after session expiry', async () => {
      await authPage.login('renter@example.com', 'password123');
      await expect(page.locator('[data-testid=user-avatar]')).toBeVisible();
    });
  });

  test('role-based access control', async ({ page }) => {
    await test.step('renter cannot access owner routes', async () => {
      await page.goto('/auth/login');
      await authPage.login('renter@example.com', 'password123');
      
      await page.goto('/listings/new');
      await expect(page.locator('[data-testid=access-denied]')).toBeVisible();
      await expect(page.locator('[data-testid=access-denied]')).toContainText('Owner access required');
    });

    await test.step('owner can access owner routes', async () => {
      await authPage.logout();
      await page.goto('/auth/login');
      await authPage.login('owner@example.com', 'password123');
      
      await page.goto('/listings/new');
      await expect(page).toHaveURL('/listings/new');
      await expect(page.locator('[data-testid=listing-creation-form]')).toBeVisible();
    });

    await test.step('admin can access all routes', async () => {
      await authPage.logout();
      await page.goto('/auth/login');
      await authPage.login('admin@example.com', 'password123');
      
      await page.goto('/admin');
      await expect(page).toHaveURL('/admin');
      await expect(page.locator('[data-testid=admin-dashboard]')).toBeVisible();
    });
  });

  test('redirect after login', async ({ page }) => {
    await test.step('redirect to protected page after login', async () => {
      await page.goto('/bookings');
      await expect(page).toHaveURL(/\/auth\/login/);
      
      await authPage.login('renter@example.com', 'password123');
      await expect(page).toHaveURL('/bookings');
    });

    await test.step('redirect to home if no specific redirect', async () => {
      await page.goto('/auth/login');
      await authPage.login('renter@example.com', 'password123');
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
});
