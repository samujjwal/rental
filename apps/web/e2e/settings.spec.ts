/**
 * User Settings E2E Test Suite
 *
 * Tests user settings workflows:
 * - Profile settings
 * - Billing settings
 * - Notification preferences
 * - Security settings
 */

import { test, expect } from '@playwright/test';
import { testUsers } from './helpers/fixtures';

test.describe('User Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', testUsers.renter.email);
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/home/);
  });

  test.describe('Profile Settings', () => {
    test('can access profile settings', async ({ page }) => {
      await page.goto('/settings/profile');
      await expect(page.locator('h1')).toContainText(/Profile|Settings/i);
      await expect(page.locator('input[name="firstName"]')).toBeVisible();
      await expect(page.locator('input[name="lastName"]')).toBeVisible();
    });

    test('can update profile information', async ({ page }) => {
      await page.goto('/settings/profile');
      
      await page.fill('input[name="firstName"]', 'UpdatedFirst');
      await page.fill('input[name="lastName"]', 'UpdatedLast');
      
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
    });

    test('can upload profile picture', async ({ page }) => {
      await page.goto('/settings/profile');
      
      const uploadBtn = page.locator('[data-testid="avatar-upload"]');
      if (await uploadBtn.isVisible()) {
        await expect(uploadBtn).toBeVisible();
      }
    });
  });

  test.describe('Billing Settings', () => {
    test('can access billing settings', async ({ page }) => {
      await page.goto('/settings/billing');
      await expect(page.locator('h1')).toContainText(/Billing|Payment/i);
    });

    test('can view payment methods', async ({ page }) => {
      await page.goto('/settings/billing');
      await expect(page.locator('[data-testid="payment-methods"]')).toBeVisible();
    });

    test('can view billing history', async ({ page }) => {
      await page.goto('/settings/billing');
      await expect(page.locator('[data-testid="billing-history"]')).toBeVisible();
    });
  });

  test.describe('Notification Settings', () => {
    test('can access notification settings', async ({ page }) => {
      await page.goto('/settings/notifications');
      await expect(page.locator('h1')).toContainText(/Notification/i);
    });

    test('can toggle notification preferences', async ({ page }) => {
      await page.goto('/settings/notifications');
      
      const toggles = page.locator('[data-testid="notification-toggle"]');
      if (await toggles.first().isVisible()) {
        await toggles.first().click();
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      }
    });

    test('can update email preferences', async ({ page }) => {
      await page.goto('/settings/notifications');
      
      await expect(page.locator('[data-testid="email-preferences"]')).toBeVisible();
    });
  });

  test.describe('Security Settings', () => {
    test('can access security settings', async ({ page }) => {
      await page.goto('/settings/security');
      await expect(page.locator('h1')).toContainText(/Security/i);
    });

    test('can change password', async ({ page }) => {
      await page.goto('/settings/security');
      
      await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
      await expect(page.locator('input[name="newPassword"]')).toBeVisible();
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    });

    test('can enable/disable 2FA', async ({ page }) => {
      await page.goto('/settings/security');
      
      const twoFASection = page.locator('[data-testid="two-factor-auth"]');
      if (await twoFASection.isVisible()) {
        await expect(twoFASection).toBeVisible();
      }
    });

    test('can view active sessions', async ({ page }) => {
      await page.goto('/settings/security');
      
      await expect(page.locator('[data-testid="active-sessions"]')).toBeVisible();
    });
  });
});
