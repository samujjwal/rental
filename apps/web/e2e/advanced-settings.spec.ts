import { test, expect } from '@playwright/test';

/**
 * ADVANCED SETTINGS E2E TESTS
 * 
 * These tests validate advanced settings functionality:
 * - Account settings and preferences
 * - Notification settings and management
 * - Security settings and privacy controls
 * - Billing settings and payment methods
 * - Integration settings and third-party services
 * 
 * Business Truth Validated:
 * - Users can configure advanced settings properly
 * - Notifications work as expected
 * - Security settings protect user accounts
 * - Billing settings are managed correctly
 * - Integrations function properly
 */

test.describe('Advanced Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Login as user
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('test@example.com');
    await page.locator('[data-testid="password-input"]').fill('password123');
    await page.locator('[data-testid="login-button"]').click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should manage account settings', async ({ page }) => {
    // Navigate to settings
    await page.locator('[data-testid="settings-nav"]').click();
    await expect(page).toHaveURL('/settings');
    
    // Check account settings section
    await expect(page.locator('[data-testid="account-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="personal-info"]')).toBeVisible();
    
    // Update personal information
    await page.locator('[data-testid="edit-profile-button"]').click();
    await expect(page.locator('[data-testid="profile-edit-form"]')).toBeVisible();
    
    await page.locator('[data-testid="first-name-input"]').clear();
    await page.locator('[data-testid="first-name-input"]').fill('John');
    
    await page.locator('[data-testid="last-name-input"]').clear();
    await page.locator('[data-testid="last-name-input"]').fill('Doe');
    
    await page.locator('[data-testid="phone-input"]').clear();
    await page.locator('[data-testid="phone-input"]').fill('+977-1-1234567');
    
    await page.locator('[data-testid="bio-input"]').clear();
    await page.locator('[data-testid="bio-input"]').fill('Property enthusiast and frequent traveler');
    
    // Update profile picture
    await page.locator('[data-testid="profile-picture-upload"]').setInputFiles('test-files/profile-pic.jpg');
    
    // Save profile changes
    await page.locator('[data-testid="save-profile-button"]').click();
    
    // Verify profile updated
    await expect(page.locator('[data-testid="profile-update-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-name-display"]')).toContainText('John Doe');
  });

  test('should manage notification preferences', async ({ page }) => {
    await page.goto('/settings');
    
    // Click notifications tab
    await page.locator('[data-testid="notifications-tab"]').click();
    await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible();
    
    // Check email notifications
    await expect(page.locator('[data-testid="email-notifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-notifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-notifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="review-notifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-notifications"]')).toBeVisible();
    
    // Configure email notifications
    await page.locator('[data-testid="booking-email"]').check();
    await page.locator('[data-testid="message-email"]').check();
    await page.locator('[data-testid="review-email"]').check();
    await page.locator('[data-testid="payment-email"]').check();
    
    // Check SMS notifications
    await expect(page.locator('[data-testid="sms-notifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-sms"]').toBeVisible();
    await expect(page.locator('[data-testid="urgent-sms"]').toBeVisible();
    
    // Configure SMS notifications
    await page.locator('[data-testid="booking-sms"]').check();
    await page.locator('[data-testid="urgent-sms"]').check();
    
    // Check push notifications
    await expect(page.locator('[data-testid="push-notifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-push"]').toBeVisible();
    await expect(page.locator('[data-testid="message-push"]').toBeVisible();
    
    // Configure push notifications
    await page.locator('[data-testid="booking-push"]').check();
    await page.locator('[data-testid="message-push"]').check();
    
    // Test notification frequency
    await expect(page.locator('[data-testid="notification-frequency"]')).toBeVisible();
    await page.locator('[data-testid="frequency-selector"]').selectOption('daily');
    
    // Save notification settings
    await page.locator('[data-testid="save-notifications"]').click();
    
    // Verify settings saved
    await expect(page.locator('[data-testid="notifications-saved"]')).toBeVisible();
    
    // Test notification preview
    await page.locator('[data-testid="test-notification-button"]').click();
    await expect(page.locator('[data-testid="notification-preview"]')).toBeVisible();
  });

  test('should manage security settings', async ({ page }) => {
    await page.goto('/settings');
    
    // Click security tab
    await page.locator('[data-testid="security-tab"]').click();
    await expect(page.locator('[data-testid="security-settings"]')).toBeVisible();
    
    // Check password section
    await expect(page.locator('[data-testid="password-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="change-password-button"]')).toBeVisible();
    
    // Change password
    await page.locator('[data-testid="change-password-button"]').click();
    await expect(page.locator('[data-testid="password-change-form"]')).toBeVisible();
    
    await page.locator('[data-testid="current-password-input"]').fill('password123');
    await page.locator('[data-testid="new-password-input"]').fill('NewSecureP@ssw0rd123!');
    await page.locator('[data-testid="confirm-password-input"]').fill('NewSecureP@ssw0rd123!');
    
    // Check password strength indicator
    await expect(page.locator('[data-testid="password-strength"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-strength"].strong')).toBeVisible();
    
    // Save password change
    await page.locator('[data-testid="update-password-button"]').click();
    
    // Verify password updated
    await expect(page.locator('[data-testid="password-updated"]')).toBeVisible();
    
    // Check two-factor authentication
    await expect(page.locator('[data-testid="two-factor-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="enable-2fa-button"]').toBeVisible();
    
    // Enable 2FA
    await page.locator('[data-testid="enable-2fa-button"]').click();
    await expect(page.locator('[data-testid="2fa-setup-modal"]')).toBeVisible();
    
    // Test SMS 2FA
    await page.locator('[data-testid="2fa-method-sms"]').click();
    await page.locator('[data-testid="phone-input-2fa"]').fill('+977-1-1234567');
    await page.locator('[data-testid="send-2fa-code"]').click();
    
    // Mock verification
    await page.locator('[data-testid="2fa-code-input"]').fill('123456');
    await page.locator('[data-testid="verify-2fa"]').click();
    
    // Verify 2FA enabled
    await expect(page.locator('[data-testid="2fa-enabled"]')).toBeVisible();
    await expect(page.locator('[data-testid="2fa-backup-codes"]')).toBeVisible();
    
    // Check session management
    await expect(page.locator('[data-testid="session-management"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-item"]').first()).toBeVisible();
    
    // Revoke session
    await page.locator('[data-testid="revoke-session"]').first().click();
    await expect(page.locator('[data-testid="session-revoked"]')).toBeVisible();
    
    // Check login alerts
    await expect(page.locator('[data-testid="login-alerts"]')).toBeVisible();
    await page.locator('[data-testid="login-alert-email"]').check();
    await page.locator('[data-testid="login-alert-sms"]').check();
    
    // Save security settings
    await page.locator('[data-testid="save-security-settings"]').click();
    await expect(page.locator('[data-testid="security-saved"]')).toBeVisible();
  });

  test('should manage privacy settings', async ({ page }) => {
    await page.goto('/settings');
    
    // Click privacy tab
    await page.locator('[data-testid="privacy-tab"]').click();
    await expect(page.locator('[data-testid="privacy-settings"]')).toBeVisible();
    
    // Check profile visibility
    await expect(page.locator('[data-testid="profile-visibility"]')).toBeVisible();
    await expect(page.locator('[data-testid="public-profile"]').toBeVisible();
    await expect(page.locator('[data-testid="private-profile"]').toBeVisible();
    
    // Set profile visibility
    await page.locator('[data-testid="private-profile"]').click();
    
    // Check data sharing
    await expect(page.locator('[data-testid="data-sharing"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-analytics"]').toBeVisible();
    await expect(page.locator('[data-testid="share-marketing"]').toBeVisible();
    
    // Configure data sharing
    await page.locator('[data-testid="share-analytics"]').check();
    await page.locator('[data-testid="share-marketing"]').uncheck();
    
    // Check cookie preferences
    await expect(page.locator('[data-testid="cookie-preferences"]')).toBeVisible();
    await expect(page.locator('[data-testid="essential-cookies"]').toBeVisible();
    await expect(page.locator('[data-testid="analytics-cookies"]').toBeVisible();
    await expect(page.locator('[data-testid="marketing-cookies"]').toBeVisible();
    
    // Configure cookies
    await page.locator('[data-testid="essential-cookies"]').check();
    await page.locator('[data-testid="analytics-cookies"]').check();
    await page.locator('[data-testid="marketing-cookies"]').uncheck();
    
    // Check data deletion
    await expect(page.locator('[data-testid="data-deletion"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-account-button"]').toBeVisible();
    
    // Test data export
    await page.locator('[data-testid="export-data-button"]').click();
    await expect(page.locator('[data-testid="data-export-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="export-format"]').selectOption('json');
    await page.locator('[data-testid="start-export"]').click();
    
    // Verify export started
    await expect(page.locator('[data-testid="export-processing"]')).toBeVisible();
    
    // Save privacy settings
    await page.locator('[data-testid="save-privacy-settings"]').click();
    await expect(page.locator('[data-testid="privacy-saved"]')).toBeVisible();
  });

  test('should manage billing settings', async ({ page }) => {
    await page.goto('/settings');
    
    // Click billing tab
    await page.locator('[data-testid="billing-tab"]').click();
    await expect(page.locator('[data-testid="billing-settings"]')).toBeVisible();
    
    // Check billing overview
    await expect(page.locator('[data-testid="billing-overview"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-cycle"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-billing-date"]')).toBeVisible();
    
    // Check payment methods
    await expect(page.locator('[data-testid="payment-methods"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-method-item"]').first()).toBeVisible();
    
    // Add new payment method
    await page.locator('[data-testid="add-payment-method"]').click();
    await expect(page.locator('[data-testid="payment-method-form"]')).toBeVisible();
    
    await page.locator('[data-testid="card-number-input"]').fill('4242424242424242');
    await page.locator('[data-testid="card-expiry-input"]').fill('12/25');
    await page.locator('[data-testid="card-cvv-input"]').fill('123');
    await page.locator('[data-testid="card-name-input"]').fill('John Doe');
    
    // Set as default
    await page.locator('[data-testid="set-default-payment"]').check();
    
    // Save payment method
    await page.locator('[data-testid="save-payment-method"]').click();
    await expect(page.locator('[data-testid="payment-method-added"]')).toBeVisible();
    
    // Check billing history
    await expect(page.locator('[data-testid="billing-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-item"]').first()).toBeVisible();
    
    // Download invoice
    await page.locator('[data-testid="download-invoice"]').first().click();
    await expect(page.locator('[data-testid="invoice-downloaded"]')).toBeVisible();
    
    // Check subscription management
    await expect(page.locator('[data-testid="subscription-management"]')).toBeVisible();
    await expect(page.locator="[data-testid='upgrade-plan-button']").toBeVisible();
    
    // Upgrade plan
    await page.locator('[data-testid="upgrade-plan-button"]').click();
    await expect(page.locator('[data-testid="plan-upgrade-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="plan-professional"]').click();
    await page.locator('[data-testid="confirm-upgrade"]').click();
    
    // Verify upgrade processed
    await expect(page.locator('[data-testid="upgrade-processed"]')).toBeVisible();
    
    // Check billing notifications
    await expect(page.locator('[data-testid="billing-notifications"]')).toBeVisible();
    await page.locator('[data-testid="payment-reminders"]').check();
    await page.locator('[data-testid="billing-alerts"]').check();
    
    // Save billing settings
    await page.locator('[data-testid="save-billing-settings"]').click();
    await expect(page.locator('[data-testid="billing-saved"]')).toBeVisible();
  });

  test('should manage integration settings', async ({ page }) => {
    await page.goto('/settings');
    
    // Click integrations tab
    await page.locator('[data-testid="integrations-tab"]').click();
    await expect(page.locator('[data-testid="integration-settings"]')).toBeVisible();
    
    // Check calendar integration
    await expect(page.locator('[data-testid="calendar-integration"]')).toBeVisible();
    await expect(page.locator('[data-testid="connect-calendar"]').toBeVisible();
    
    // Connect calendar
    await page.locator('[data-testid="connect-calendar"]').click();
    await expect(page.locator('[data-testid="calendar-setup-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="calendar-provider"]').selectOption('google-calendar');
    await page.locator('[data-testid="calendar-auth-button"]').click();
    
    // Mock OAuth success
    await expect(page.locator('[data-testid="calendar-connected"]')).toBeVisible();
    
    // Configure calendar sync
    await page.locator('[data-testid="sync-bookings"]').check();
    await page.locator('[data-testid="sync-availability"]').check();
    await page.locator('[data-testid="sync-frequency"]').selectOption('hourly');
    
    // Save calendar settings
    await page.locator('[data-testid="save-calendar-settings"]').click();
    await expect(page.locator('[data-testid="calendar-settings-saved"]')).toBeVisible();
    
    // Check messaging integration
    await expect(page.locator('[data-testid="messaging-integration"]')).toBeVisible();
    await expect(page.locator('[data-testid="connect-messaging"]').toBeVisible();
    
    // Connect messaging
    await page.locator('[data-testid="connect-messaging"]').click();
    await expect(page.locator('[data-testid="messaging-setup-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="messaging-provider"]').selectOption('whatsapp');
    await page.locator('[data-testid="messaging-phone-input"]').fill('+9771234567890');
    
    // Save messaging settings
    await page.locator('[data-testid="save-messaging-settings"]').click();
    await expect(page.locator('[data-testid="messaging-settings-saved"]')).toBeVisible();
    
    // Check analytics integration
    await expect(page.locator('[data-testid="analytics-integration"]')).toBeVisible();
    await expect(page.locator('[data-testid="connect-analytics"]').toBeVisible();
    
    // Connect analytics
    await page.locator('[data-testid="connect-analytics"]').click();
    await expect(page.locator('[data-testid="analytics-setup-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="analytics-provider"]').selectOption('google-analytics');
    await page.locator('[data-testid="analytics-tracking-id"]').fill('GA-123456789');
    
    // Save analytics settings
    await page.locator('[data-testid="save-analytics-settings"]').click();
    await expect(page.locator('[data-testid="analytics-settings-saved"]')).toBeVisible();
    
    // Check API integration
    await expect(page.locator('[data-testid="api-integration"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-keys"]').toBeVisible();
    
    // Generate API key
    await page.locator('[data-testid="generate-api-key"]').click();
    await expect(page.locator('[data-testid="api-key-generated"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-key-value"]')).toBeVisible();
    
    // Copy API key
    await page.locator('[data-testid="copy-api-key"]').click();
    await expect(page.locator('[data-testid="api-key-copied"]')).toBeVisible();
    
    // Save integration settings
    await page.locator('[data-testid="save-integration-settings"]').click();
    await expect(page.locator('[data-testid="integration-settings-saved"]')).toBeVisible();
  });

  test('should manage accessibility settings', async ({ page }) => {
    await page.goto('/settings');
    
    // Click accessibility tab
    await page.locator('[data-testid="accessibility-tab"]').click();
    await expect(page.locator('[data-testid="accessibility-settings"]')).toBeVisible();
    
    // Check visual accessibility
    await expect(page.locator('[data-testid="visual-accessibility"]')).toBeVisible();
    await expect(page.locator('[data-testid="font-size-selector"]').toBeVisible();
    await expect(page.locator('[data-testid="high-contrast-mode"]').toBeVisible();
    await expect(page.locator('[data-testid="color-blind-mode"]').toBeVisible();
    
    // Configure visual settings
    await page.locator('[data-testid="font-size-selector"]').selectOption('large');
    await page.locator('[data-testid="high-contrast-mode"]').check();
    
    // Check interaction accessibility
    await expect(page.locator('[data-testid="interaction-accessibility"]')).toBeVisible();
    await expect(page.locator="[data-testid='keyboard-navigation']").toBeVisible();
    await expect(page.locator('[data-testid="screen-reader-support"]').toBeVisible();
    await expect(page.locator('[data-testid="reduced-motion"]').toBeVisible();
    
    // Configure interaction settings
    await page.locator('[data-testid="keyboard-navigation"]').check();
    await page.locator('[data-testid="screen-reader-support"]').check();
    await page.locator('[data-testid="reduced-motion"]').check();
    
    // Check language settings
    await expect(page.locator('[data-testid="language-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="language-selector"]').toBeVisible();
    await expect(page.locator('[data-testid="translation-toggle"]').toBeVisible();
    
    // Configure language settings
    await page.locator('[data-testid="language-selector"]').selectOption('nepali');
    await page.locator('[data-testid="translation-toggle"]').check();
    
    // Save accessibility settings
    await page.locator('[data-testid="save-accessibility-settings"]').click();
    await expect(page.locator('[data-testid="accessibility-saved"]')).toBeVisible();
    
    // Test accessibility preview
    await page.locator('[data-testid="preview-accessibility"]').click();
    await expect(page.locator('[data-testid="accessibility-preview-modal"]')).toBeVisible();
    
    // Check preview reflects changes
    await expect(page.locator('[data-testid="preview-large-font"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-high-contrast"]')).toBeVisible();
  });

  test('should manage advanced preferences', async ({ page }) => {
    await page.goto('/settings');
    
    // Click advanced tab
    await page.locator('[data-testid="advanced-tab"]').click();
    await expect(page.locator('[data-testid="advanced-settings"]')).toBeVisible();
    
    // Check performance settings
    await expect(page.locator('[data-testid="performance-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="lazy-loading"]').toBeVisible();
    await expect(page.locator('[data-testid="image-compression"]').toBeVisible();
    await expect(page.locator('[data-testid="cache-preferences"]').toBeVisible();
    
    // Configure performance settings
    await page.locator('[data-testid="lazy-loading"]').check();
    await page.locator('[data-testid="image-compression"]').check();
    await page.locator('[data-testid="cache-preferences"]').selectOption('aggressive');
    
    // Check experimental features
    await expect(page.locator('[data-testid="experimental-features"]')).toBeVisible();
    await expect(page.locator('[data-testid="beta-features"]').toBeVisible();
    await expect(page.locator('[data-testid="ai-suggestions"]').toBeVisible();
    await expect(page.locator('[data-testid="smart-search"]').toBeVisible();
    
    // Enable experimental features
    await page.locator('[data-testid="beta-features"]').check();
    await page.locator('[data-testid="ai-suggestions"]').check();
    await page.locator('[data-testid="smart-search"]').check();
    
    // Check developer settings
    await expect(page.locator('[data-testid="developer-settings"]')).toBeVisible();
    await expect(page.locator="[data-testid='debug-mode']").toBeVisible();
    await expect(page.locator('[data-testid="api-debug"]').toBeVisible();
    await expect(page.locator('[data-testid="performance-monitor"]').toBeVisible();
    
    // Configure developer settings
    await page.locator('[data-testid="debug-mode"]').check();
    await page.locator('[data-testid="api-debug"]').check();
    await page.locator('[data-testid="performance-monitor"]').check();
    
    // Check data management
    await expect(page.locator('[data-testid="data-management"]')).toBeVisible();
    await expect(page.locator('[data-testid="clear-cache"]').toBeVisible();
    await expect(page.locator('[data-testid="reset-preferences"]').toBeVisible();
    await expect(page.locator('[data-testid="export-settings"]').toBeVisible();
    
    // Test clear cache
    await page.locator('[data-testid="clear-cache"]').click();
    await expect(page.locator('[data-testid="cache-cleared"]')).toBeVisible();
    
    // Test export settings
    await page.locator('[data-testid="export-settings"]').click();
    await expect(page.locator('[data-testid="settings-exported"]')).toBeVisible();
    
    // Save advanced settings
    await page.locator('[data-testid="save-advanced-settings"]').click();
    await expect(page.locator('[data-testid="advanced-saved"]')).toBeVisible();
  });

  test('should handle settings mobile responsiveness', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/settings');
    
    // Check mobile layout
    await expect(page.locator('[data-testid="mobile-settings-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-settings-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-settings-menu"]')).toBeVisible();
    
    // Test mobile navigation
    await page.locator('[data-testid="mobile-settings-menu"]').click();
    await expect(page.locator('[data-testid="mobile-settings-sidebar"]')).toBeVisible();
    
    // Test mobile account settings
    await page.locator('[data-testid="mobile-account-tab"]').click();
    await expect(page.locator('[data-testid="mobile-account-form"]')).toBeVisible();
    
    // Test mobile notification settings
    await page.locator('[data-testid="mobile-notifications-tab"]').click();
    await expect(page.locator('[data-testid="mobile-notification-form"]')).toBeVisible();
    
    // Test mobile security settings
    await page.locator('[data-testid="mobile-security-tab"]').click();
    await expect(page.locator('[data-testid="mobile-security-form"]')).toBeVisible();
    
    // Test mobile billing settings
    await page.locator('[data-testid="mobile-billing-tab"]').click();
    await expect(page.locator('[data-testid="mobile-billing-form"]')).toBeVisible();
  });

  test('should validate settings changes', async ({ page }) => {
    await page.goto('/settings');
    
    // Test invalid email in profile
    await page.locator('[data-testid="edit-profile-button"]').click();
    await page.locator('[data-testid="email-input"]').fill('invalid-email');
    await page.locator('[data-testid="save-profile-button"]').click();
    
    // Should show validation error
    await expect(page.locator('[data-testid="email-validation-error"]')).toBeVisible();
    
    // Test weak password
    await page.locator('[data-testid="security-tab"]').click();
    await page.locator('[data-testid="change-password-button"]').click();
    await page.locator('[data-testid="new-password-input"]').fill('weak');
    await page.locator('[data-testid="update-password-button"]').click();
    
    // Should show password strength error
    await expect(page.locator('[data-testid="password-strength-error"]')).toBeVisible();
    
    // Test invalid phone number
    await page.locator('[data-testid="notifications-tab"]').click();
    await page.locator('[data-testid="sms-notifications"]').check();
    await page.locator('[data-testid="phone-input"]').fill('invalid-phone');
    await page.locator('[data-testid="save-notifications"]').click();
    
    // Should show phone validation error
    await expect(page.locator('[data-testid="phone-validation-error"]')).toBeVisible();
    
    // Test invalid API key format
    await page.locator('[data-testid="integrations-tab"]').click();
    await page.locator('[data-testid="analytics-tracking-id"]').fill('invalid-tracking-id');
    await page.locator('[data-testid="save-analytics-settings"]').click();
    
    // Should show API key validation error
    await expect(page.locator('[data-testid="tracking-id-validation-error"]')).toBeVisible();
  });

  test('should handle settings backup and restore', async ({ page }) => {
    await page.goto('/settings');
    
    // Click advanced tab
    await page.locator('[data-testid="advanced-tab"]').click();
    
    // Test backup settings
    await page.locator('[data-testid="backup-settings"]').click();
    await expect(page.locator('[data-testid="backup-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="backup-name"]').fill('My Settings Backup');
    await page.locator('[data-testid="create-backup"]').click();
    
    // Verify backup created
    await expect(page.locator('[data-testid="backup-created"]')).toBeVisible();
    await expect(page.locator('[data-testid="backup-list"]')).toContainText('My Settings Backup');
    
    // Test restore settings
    await page.locator('[data-testid="restore-settings"]').click();
    await expect(page.locator('[data-testid="restore-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="backup-select"]').selectOption('My Settings Backup');
    await page.locator('[data-testid="confirm-restore"]').click();
    
    // Verify restore completed
    await expect(page.locator('[data-testid="restore-completed"]')).toBeVisible();
    
    // Test auto-backup
    await page.locator('[data-testid="auto-backup"]').check();
    await page.locator('[data-testid="backup-frequency"]').selectOption('weekly');
    
    // Save backup settings
    await page.locator('[data-testid="save-backup-settings"]').click();
    await expect(page.locator('[data-testid="backup-settings-saved"]')).toBeVisible();
  });
});
