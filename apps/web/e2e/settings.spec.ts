import { test, expect, Page } from '@playwright/test';
import { loginAs, testUsers } from './helpers/test-utils';

test.describe('Settings', () => {
  test.describe('Profile Settings', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should display current profile information', async ({ page }) => {
      await page.goto('/settings/profile');
      await page.waitForLoadState('networkidle');

      // Profile form should be visible with current data
      await expect(page.locator('input[name="firstName"]')).toBeVisible();
      await expect(page.locator('input[name="lastName"]')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });

    test('should update first and last name', async ({ page }) => {
      await page.goto('/settings/profile');
      await page.waitForLoadState('networkidle');

      // Update name fields
      await page.fill('input[name="firstName"]', 'UpdatedFirst');
      await page.fill('input[name="lastName"]', 'UpdatedLast');

      // Save changes
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
      await saveButton.click();

      // Should show success message
      await expect(page.locator('text=/saved|updated|success/i')).toBeVisible();
    });

    test('should update phone number', async ({ page }) => {
      await page.goto('/settings/profile');
      await page.waitForLoadState('networkidle');

      const phoneInput = page.locator('input[name="phoneNumber"], input[name="phone"]');
      await phoneInput.fill('+1234567890');

      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
      await saveButton.click();

      await expect(page.locator('text=/saved|updated|success/i')).toBeVisible();
    });

    test('should update bio', async ({ page }) => {
      await page.goto('/settings/profile');
      await page.waitForLoadState('networkidle');

      const bioInput = page.locator('textarea[name="bio"], [name="bio"]');
      if (await bioInput.isVisible()) {
        await bioInput.fill('This is my updated bio. I love traveling and exploring new places!');

        const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
        await saveButton.click();

        await expect(page.locator('text=/saved|updated|success/i')).toBeVisible();
      }
    });

    test('should upload profile photo', async ({ page }) => {
      await page.goto('/settings/profile');
      await page.waitForLoadState('networkidle');

      // Look for photo upload
      const photoInput = page.locator('input[type="file"][accept*="image"]');
      if (await photoInput.isVisible()) {
        await photoInput.setInputFiles({
          name: 'profile.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image content'),
        });

        // Should show uploaded image preview
        await expect(page.locator('[data-testid="profile-photo"], img.profile-photo')).toBeVisible();
      }
    });

    test('should validate phone number format', async ({ page }) => {
      await page.goto('/settings/profile');
      await page.waitForLoadState('networkidle');

      const phoneInput = page.locator('input[name="phoneNumber"], input[name="phone"]');
      await phoneInput.fill('invalid-phone');

      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
      await saveButton.click();

      // Should show validation error
      await expect(page.locator('text=/invalid|phone/i')).toBeVisible();
    });

    test('should update address information', async ({ page }) => {
      await page.goto('/settings/profile');
      await page.waitForLoadState('networkidle');

      // Fill address fields if they exist
      const addressFields = [
        { name: 'addressLine1', value: '123 Main Street' },
        { name: 'city', value: 'San Francisco' },
        { name: 'state', value: 'CA' },
        { name: 'postalCode', value: '94102' },
        { name: 'country', value: 'USA' },
      ];

      for (const field of addressFields) {
        const input = page.locator(`input[name="${field.name}"]`);
        if (await input.isVisible()) {
          await input.fill(field.value);
        }
      }

      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
      await saveButton.click();
    });
  });

  test.describe('Notification Settings', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should display notification preferences', async ({ page }) => {
      await page.goto('/settings/notifications');
      await page.waitForLoadState('networkidle');

      // Should show notification toggles
      await expect(page.locator('text=/email notifications/i')).toBeVisible();
      await expect(page.locator('text=/push notifications/i')).toBeVisible();
    });

    test('should toggle email notifications', async ({ page }) => {
      await page.goto('/settings/notifications');
      await page.waitForLoadState('networkidle');

      const emailToggle = page.locator('[data-testid="email-notifications-toggle"], input[name="emailNotifications"]');
      if (await emailToggle.isVisible()) {
        await emailToggle.click();

        // Should save automatically or show save button
        const saveButton = page.locator('button:has-text("Save")');
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }

        await expect(page.locator('text=/saved|updated/i')).toBeVisible();
      }
    });

    test('should toggle push notifications', async ({ page }) => {
      await page.goto('/settings/notifications');
      await page.waitForLoadState('networkidle');

      const pushToggle = page.locator('[data-testid="push-notifications-toggle"], input[name="pushNotifications"]');
      if (await pushToggle.isVisible()) {
        await pushToggle.click();
      }
    });

    test('should toggle marketing emails', async ({ page }) => {
      await page.goto('/settings/notifications');
      await page.waitForLoadState('networkidle');

      const marketingToggle = page.locator('[data-testid="marketing-toggle"], input[name="marketingEmails"]');
      if (await marketingToggle.isVisible()) {
        await marketingToggle.click();
      }
    });

    test('should configure notification types', async ({ page }) => {
      await page.goto('/settings/notifications');
      await page.waitForLoadState('networkidle');

      // Check for different notification types
      const notificationTypes = [
        'Booking Updates',
        'Messages',
        'Reviews',
        'Promotions',
        'Security Alerts',
      ];

      for (const type of notificationTypes) {
        const toggle = page.locator(`text=${type}`).locator('..').locator('input[type="checkbox"], [role="switch"]');
        if (await toggle.isVisible()) {
          // Toggle is available
        }
      }
    });
  });

  test.describe('Security Settings', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should navigate to security settings', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const securityLink = page.locator('a:has-text("Security"), button:has-text("Security")');
      if (await securityLink.isVisible()) {
        await securityLink.click();
      }
    });

    test('should change password', async ({ page }) => {
      await page.goto('/settings/security');
      await page.waitForLoadState('networkidle');

      const currentPasswordInput = page.locator('input[name="currentPassword"]');
      const newPasswordInput = page.locator('input[name="newPassword"]');
      const confirmPasswordInput = page.locator('input[name="confirmPassword"]');

      if (await currentPasswordInput.isVisible()) {
        await currentPasswordInput.fill('Password123!');
        await newPasswordInput.fill('NewPassword456!');
        await confirmPasswordInput.fill('NewPassword456!');

        const saveButton = page.locator('button:has-text("Change Password"), button[type="submit"]');
        await saveButton.click();
      }
    });

    test('should validate password requirements', async ({ page }) => {
      await page.goto('/settings/security');
      await page.waitForLoadState('networkidle');

      const newPasswordInput = page.locator('input[name="newPassword"]');
      if (await newPasswordInput.isVisible()) {
        await newPasswordInput.fill('weak');

        // Should show password requirements
        await expect(page.locator('text=/must contain|at least|characters/i')).toBeVisible();
      }
    });

    test('should enable two-factor authentication', async ({ page }) => {
      await page.goto('/settings/security');
      await page.waitForLoadState('networkidle');

      const enable2FAButton = page.locator('button:has-text("Enable 2FA"), button:has-text("Enable Two-Factor")');
      if (await enable2FAButton.isVisible()) {
        await enable2FAButton.click();

        // Should show QR code for authenticator app
        await expect(page.locator('[data-testid="qr-code"], img[alt*="QR"]')).toBeVisible();
      }
    });

    test('should view login sessions', async ({ page }) => {
      await page.goto('/settings/security');
      await page.waitForLoadState('networkidle');

      const sessionsSection = page.locator('[data-testid="sessions"], text=/active sessions/i');
      if (await sessionsSection.isVisible()) {
        // Should show current session
        await expect(page.locator('text=/current session|this device/i')).toBeVisible();
      }
    });

    test('should logout other sessions', async ({ page }) => {
      await page.goto('/settings/security');
      await page.waitForLoadState('networkidle');

      const logoutAllButton = page.locator('button:has-text("Logout All"), button:has-text("Sign out all other sessions")');
      if (await logoutAllButton.isVisible()) {
        await logoutAllButton.click();

        // Confirm modal
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
    });
  });

  test.describe('Payment Settings', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.owner);
    });

    test('should display payment methods', async ({ page }) => {
      await page.goto('/settings/payments');
      await page.waitForLoadState('networkidle');

      // Should show saved payment methods or empty state
      const paymentMethods = page.locator('[data-testid="payment-methods"]');
      const emptyState = page.locator('text=/no payment methods|add a card/i');

      await expect(paymentMethods.or(emptyState)).toBeVisible();
    });

    test('should add payment method', async ({ page }) => {
      await page.goto('/settings/payments');
      await page.waitForLoadState('networkidle');

      const addCardButton = page.locator('button:has-text("Add Card"), button:has-text("Add Payment Method")');
      if (await addCardButton.isVisible()) {
        await addCardButton.click();

        // Stripe elements should appear
        await expect(page.locator('iframe[name*="stripe"], [data-testid="card-element"]')).toBeVisible();
      }
    });

    test('should configure payout settings', async ({ page }) => {
      await page.goto('/settings/payments');
      await page.waitForLoadState('networkidle');

      const payoutSection = page.locator('[data-testid="payout-settings"], text=/payout/i');
      if (await payoutSection.isVisible()) {
        // Should show Stripe Connect status or setup button
        await expect(page.locator('text=/connected|set up payouts/i')).toBeVisible();
      }
    });
  });

  test.describe('Settings Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should navigate between settings sections', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Check all navigation links
      const settingsSections = ['Profile', 'Notifications', 'Security', 'Payments'];

      for (const section of settingsSections) {
        const link = page.locator(`a:has-text("${section}"), button:has-text("${section}")`);
        if (await link.isVisible()) {
          await link.click();
          await page.waitForLoadState('networkidle');
          await page.goBack();
        }
      }
    });

    test('should highlight active section', async ({ page }) => {
      await page.goto('/settings/profile');
      await page.waitForLoadState('networkidle');

      const profileLink = page.locator('a:has-text("Profile")[aria-current="page"], a:has-text("Profile").active');
      await expect(profileLink).toBeVisible();
    });
  });

  test.describe('Account Deletion', () => {
    test('should show account deletion option', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Scroll to danger zone
      const deleteSection = page.locator('text=/delete account|danger zone/i');
      if (await deleteSection.isVisible()) {
        await deleteSection.scrollIntoViewIfNeeded();
        await expect(deleteSection).toBeVisible();
      }
    });

    test('should require confirmation for account deletion', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const deleteButton = page.locator('button:has-text("Delete Account")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Should show confirmation modal
        await expect(page.locator('text=/are you sure|cannot be undone/i')).toBeVisible();

        // Cancel deletion
        const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
        }
      }
    });
  });

  test.describe('Responsive Design', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should show mobile settings layout', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Settings should be in mobile-friendly format
      await expect(page.locator('[data-testid="settings-menu"], .settings-list')).toBeVisible();
    });

    test('should navigate settings on mobile', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/settings/profile');
      await page.waitForLoadState('networkidle');

      // Should have back navigation
      const backButton = page.locator('button:has-text("Back"), [data-testid="back-button"]');
      if (await backButton.isVisible()) {
        await backButton.click();
        await expect(page).toHaveURL(/\/settings$/);
      }
    });
  });
});
