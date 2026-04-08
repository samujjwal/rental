import { test, expect } from '@playwright/test';

/**
 * ADVANCED SETTINGS E2E TESTS
 * 
 * These tests validate advanced settings functionality:
 * - Billing and payment settings
 * - Notification preferences
 * - Security and privacy settings
 * - API and integration settings
 * - Advanced user preferences
 * 
 * Business Truth Validated:
 * - Advanced settings work correctly
 * - User preferences are saved properly
 * - Security settings are enforced
 * - Billing information is accurate
 * - API integrations function properly
 */

test.describe('Advanced Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a user with advanced settings access
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('advanced@example.com');
    await page.locator('[data-testid="password-input"]').fill('password123');
    await page.locator('[data-testid="login-button"]').click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to advanced settings', async ({ page }) => {
    // Navigate to settings
    await page.locator('[data-testid="settings-nav"]').click();
    await expect(page).toHaveURL('/settings');
    
    // Check advanced settings sections
    await expect(page.locator('[data-testid="settings-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="advanced-settings-link"]')).toBeVisible();
    
    // Click advanced settings
    await page.locator('[data-testid="advanced-settings-link"]').click();
    await expect(page).toHaveURL('/settings/advanced');
    
    // Check advanced settings sections
    await expect(page.locator('[data-testid="billing-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="security-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="privacy-settings"]')).toBeVisible();
  });

  test('should manage billing settings', async ({ page }) => {
    await page.goto('/settings/advanced');
    
    // Navigate to billing settings
    await page.locator('[data-testid="billing-settings"]').click();
    await expect(page.locator('[data-testid="billing-panel"]')).toBeVisible();
    
    // Check current billing information
    await expect(page.locator('[data-testid="billing-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-cycle"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-methods"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-history"]')).toBeVisible();
    
    // Add new payment method
    await page.locator('[data-testid="add-payment-method"]').click();
    await expect(page.locator('[data-testid="payment-method-form"]')).toBeVisible();
    
    // Fill payment method details
    await page.locator('[data-testid="card-number-input"]').fill('4242424242424242');
    await page.locator('[data-testid="card-expiry-input"]').fill('12/25');
    await page.locator('[data-testid="card-cvc-input"]').fill('123');
    await page.locator('[data-testid="card-holder-input"]').fill('John Doe');
    await page.locator('[data-testid="billing-address-input"]').fill('Kathmandu, Nepal');
    
    // Save payment method
    await page.locator('[data-testid="save-payment-method"]').click();
    await expect(page.locator('[data-testid="payment-method-added"]')).toBeVisible();
    
    // Update billing cycle
    await page.locator('[data-testid="billing-cycle-selector"]').click();
    await page.locator('[data-testid="annual-billing"]').click();
    await page.locator('[data-testid="save-billing-settings"]').click();
    await expect(page.locator('[data-testid="billing-settings-saved"]')).toBeVisible();
  });

  test('should manage notification preferences', async ({ page }) => {
    await page.goto('/settings/advanced');
    
    // Navigate to notification settings
    await page.locator('[data-testid="notification-settings"]').click();
    await expect(page.locator('[data-testid="notification-panel"]')).toBeVisible();
    
    // Check notification categories
    await expect(page.locator('[data-testid="email-notifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="sms-notifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="push-notifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="in-app-notifications"]')).toBeVisible();
    
    // Configure email notifications
    await page.locator('[data-testid="email-booking-confirmations"]').check();
    await page.locator('[data-testid="email-payment-receipts"]').check();
    await page.locator('[data-testid="email-marketing-updates"]').uncheck();
    await page.locator('[data-testid="email-security-alerts"]').check();
    
    // Configure SMS notifications
    await page.locator('[data-testid="sms-booking-reminders"]').check();
    await page.locator('[data-testid="sms-payment-alerts"]').uncheck();
    await page.locator('[data-testid="sms-emergency-notifications"]').check();
    
    // Configure push notifications
    await page.locator('[data-testid="push-new-messages"]').check();
    await page.locator('[data-testid="push-booking-updates"]').check();
    await page.locator('[data-testid="push-promotional-offers"]').uncheck();
    
    // Set notification frequency
    await page.locator('[data-testid="notification-frequency"]').click();
    await page.locator('[data-testid="frequency-daily"]').click();
    
    // Save notification settings
    await page.locator('[data-testid="save-notification-settings"]').click();
    await expect(page.locator('[data-testid="notification-settings-saved"]')).toBeVisible();
    
    // Test notification preview
    await page.locator('[data-testid="preview-notifications"]').click();
    await expect(page.locator('[data-testid="notification-preview-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-sms"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-push"]')).toBeVisible();
  });

  test('should manage security settings', async ({ page }) => {
    await page.goto('/settings/advanced');
    
    // Navigate to security settings
    await page.locator('[data-testid="security-settings"]').click();
    await expect(page.locator('[data-testid="security-panel"]')).toBeVisible();
    
    // Check security sections
    await expect(page.locator('[data-testid="password-security"]')).toBeVisible();
    await expect(page.locator('[data-testid="two-factor-auth"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-activity"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="security-logs"]')).toBeVisible();
    
    // Change password
    await page.locator('[data-testid="change-password"]').click();
    await expect(page.locator('[data-testid="password-change-form"]')).toBeVisible();
    
    await page.locator('[data-testid="current-password-input"]').fill('password123');
    await page.locator('[data-testid="new-password-input"]').fill('newPassword456!');
    await page.locator('[data-testid="confirm-password-input"]').fill('newPassword456!');
    
    await page.locator('[data-testid="update-password"]').click();
    await expect(page.locator('[data-testid="password-updated"]')).toBeVisible();
    
    // Enable two-factor authentication
    await page.locator('[data-testid="enable-2fa"]').click();
    await expect(page.locator('[data-testid="2fa-setup-modal"]')).toBeVisible();
    
    // Mock 2FA setup (in real test, would scan QR code)
    await page.locator('[data-testid="2fa-code-input"]').fill('123456');
    await page.locator('[data-testid="verify-2fa"]').click();
    await expect(page.locator('[data-testid="2fa-enabled"]')).toBeVisible();
    
    // Review login activity
    await page.locator('[data-testid="login-activity"]').click();
    await expect(page.locator('[data-testid="activity-log"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-entry"]').first()).toBeVisible();
    
    // Test filtering login activity
    await page.locator('[data-testid="activity-filter"]').click();
    await page.locator('[data-testid="filter-last-30-days"]').click();
    await expect(page.locator('[data-testid="activity-updated"]')).toBeVisible();
    
    // Manage active sessions
    await page.locator('[data-testid="active-sessions"]').click();
    await expect(page.locator('[data-testid="sessions-list"]')).toBeVisible();
    
    // Revoke a session
    await page.locator('[data-testid="session-item"]').first().hover();
    await page.locator('[data-testid="revoke-session"]').click();
    await expect(page.locator('[data-testid="session-revoked"]')).toBeVisible();
  });

  test('should manage API settings', async ({ page }) => {
    await page.goto('/settings/advanced');
    
    // Navigate to API settings
    await page.locator('[data-testid="api-settings"]').click();
    await expect(page.locator('[data-testid="api-panel"]')).toBeVisible();
    
    // Check API sections
    await expect(page.locator('[data-testid="api-keys"]')).toBeVisible();
    await expect(page.locator('[data-testid="webhooks"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-documentation"]')).toBeVisible();
    
    // Generate new API key
    await page.locator('[data-testid="generate-api-key"]').click();
    await expect(page.locator('[data-testid="api-key-form"]')).toBeVisible();
    
    await page.locator('[data-testid="key-name-input"]').fill('Mobile App API');
    await page.locator('[data-testid="key-permissions"]').click();
    await page.locator('[data-testid="permission-read-listings"]').check();
    await page.locator('[data-testid="permission-create-bookings"]').check();
    await page.locator('[data-testid="permission-payments"]').uncheck();
    
    await page.locator('[data-testid="create-api-key"]').click();
    await expect(page.locator('[data-testid="api-key-created"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-key-value"]').toBeVisible();
    
    // Copy API key
    await page.locator('[data-testid="copy-api-key"]').click();
    await expect(page.locator('[data-testid="api-key-copied"]')).toBeVisible();
    
    // Configure webhooks
    await page.locator('[data-testid="webhooks"]').click();
    await expect(page.locator('[data-testid="webhooks-list"]')).toBeVisible();
    
    await page.locator('[data-testid="add-webhook"]').click();
    await expect(page.locator('[data-testid="webhook-form"]')).toBeVisible();
    
    await page.locator('[data-testid="webhook-url-input"]').fill('https://example.com/webhook');
    await page.locator('[data-testid="webhook-events"]').click();
    await page.locator('[data-testid="event-booking-created"]').check();
    await page.locator('[data-testid="event-payment-completed"]').check();
    
    await page.locator('[data-testid="save-webhook"]').click();
    await expect(page.locator('[data-testid="webhook-saved"]')).toBeVisible();
    
    // Test webhook
    await page.locator('[data-testid="test-webhook"]').click();
    await expect(page.locator('[data-testid="webhook-test-sent"]')).toBeVisible();
    
    // Check API usage
    await page.locator('[data-testid="api-usage"]').click();
    await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-stats"]')).toBeVisible();
    
    // Test usage filtering
    await page.locator('[data-testid="usage-period"]').click();
    await page.locator('[data-testid="period-last-7-days"]').click();
    await expect(page.locator('[data-testid="usage-updated"]')).toBeVisible();
  });

  test('should manage privacy settings', async ({ page }) => {
    await page.goto('/settings/advanced');
    
    // Navigate to privacy settings
    await page.locator('[data-testid="privacy-settings"]').click();
    await expect(page.locator('[data-testid="privacy-panel"]')).toBeVisible();
    
    // Check privacy sections
    await expect(page.locator('[data-testid="profile-privacy"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-sharing"]')).toBeVisible();
    await expect(page.locator('[data-testid="marketing-preferences"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-retention"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-data"]')).toBeVisible();
    
    // Configure profile privacy
    await page.locator('[data-testid="profile-visibility"]').click();
    await page.locator('[data-testid="visibility-friends-only"]').click();
    
    await page.locator('[data-testid="show-email"]').uncheck();
    await page.locator('[data-testid="show-phone"]').uncheck();
    await page.locator('[data-testid="show-location"]').check();
    
    // Configure data sharing
    await page.locator('[data-testid="share-analytics"]').uncheck();
    await page.locator('[data-testid="share-demographics"]').uncheck();
    await page.locator('[data-testid="share-usage-patterns"]').check();
    
    // Configure marketing preferences
    await page.locator('[data-testid="email-marketing"]').uncheck();
    await page.locator('[data-testid="sms-marketing"]').uncheck();
    await page.locator('[data-testid="third-party-sharing"]').uncheck();
    
    // Save privacy settings
    await page.locator('[data-testid="save-privacy-settings"]').click();
    await expect(page.locator('[data-testid="privacy-settings-saved"]')).toBeVisible();
    
    // Download personal data
    await page.locator('[data-testid="download-data"]').click();
    await expect(page.locator('[data-testid="data-download-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="data-format"]').click();
    await page.locator('[data-testid="format-json"]').click();
    
    await page.locator('[data-testid="request-data-download"]').click();
    await expect(page.locator('[data-testid="download-requested"]')).toBeVisible();
    
    // Test data deletion
    await page.locator('[data-testid="delete-account"]').click();
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    
    await page.locator('[data-testid="delete-reason"]').selectOption('privacy-concerns');
    await page.locator('[data-testid="delete-password-input"]').fill('newPassword456!');
    
    // Don't actually delete - just test the validation
    await page.locator('[data-testid="confirm-delete"]').click();
    await expect(page.locator('[data-testid="delete-validated"]')).toBeVisible();
  });

  test('should manage accessibility settings', async ({ page }) => {
    await page.goto('/settings/advanced');
    
    // Navigate to accessibility settings
    await page.locator('[data-testid="accessibility-settings"]').click();
    await expect(page.locator('[data-testid="accessibility-panel"]')).toBeVisible();
    
    // Check accessibility options
    await expect(page.locator('[data-testid="visual-accessibility"]')).toBeVisible();
    await expect(page.locator('[data-testid="keyboard-accessibility"]')).toBeVisible();
    await expect(page.locator('[data-testid="screen-reader-settings"]')).toBeVisible();
    
    // Configure visual accessibility
    await page.locator('[data-testid="font-size-slider"]').fill('120');
    await page.locator('[data-testid="high-contrast-mode"]').check();
    await page.locator('[data-testid="reduce-motion"]').check();
    
    // Configure keyboard accessibility
    await page.locator('[data-testid="keyboard-navigation"]').check();
    await page.locator('[data-testid="focus-indicators"]').check();
    await page.locator('[data-testid="skip-links"]').check();
    
    // Configure screen reader settings
    await page.locator('[data-testid="screen-reader-optimization"]').check();
    await page.locator('[data-testid="alt-text-descriptions"]').check();
    
    // Save accessibility settings
    await page.locator('[data-testid="save-accessibility-settings"]').click();
    await expect(page.locator('[data-testid="accessibility-settings-saved"]')).toBeVisible();
    
    // Test accessibility preview
    await page.locator('[data-testid="preview-accessibility"]').click();
    await expect(page.locator('[data-testid="accessibility-preview"]')).toBeVisible();
    
    // Verify changes applied
    const fontSize = await page.locator('body').evaluate(el => {
      return getComputedStyle(el).fontSize;
    });
    expect(fontSize).toContain('120%');
  });

  test('should manage language and regional settings', async ({ page }) => {
    await page.goto('/settings/advanced');
    
    // Navigate to language settings
    await page.locator('[data-testid="language-settings"]').click();
    await expect(page.locator('[data-testid="language-panel"]')).toBeVisible();
    
    // Check language options
    await expect(page.locator('[data-testid="language-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="region-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="timezone-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="currency-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="date-format-selector"]')).toBeVisible();
    
    // Change language
    await page.locator('[data-testid="language-selector"]').click();
    await page.locator('[data-testid="language-nepali"]').click();
    
    // Change region
    await page.locator('[data-testid="region-selector"]').click();
    await page.locator('[data-testid="region-nepal"]').click();
    
    // Change timezone
    await page.locator('[data-testid="timezone-selector"]').click();
    await page.locator('[data-testid="timezone-kathmandu"]').click();
    
    // Change currency
    await page.locator('[data-testid="currency-selector"]').click();
    await page.locator('[data-testid="currency-npr"]').click();
    
    // Change date format
    await page.locator('[data-testid="date-format-selector"]').click();
    await page.locator('[data-testid="format-dd-mm-yyyy"]').click();
    
    // Save language settings
    await page.locator('[data-testid="save-language-settings"]').click();
    await expect(page.locator('[data-testid="language-settings-saved"]')).toBeVisible();
    
    // Verify language change
    await page.reload();
    await expect(page.locator('[data-testid="language-indicator"]')).toContainText('नेपाली');
  });

  test('should manage advanced preferences', async ({ page }) => {
    await page.goto('/settings/advanced');
    
    // Navigate to advanced preferences
    await page.locator('[data-testid="advanced-preferences"]').click();
    await expect(page.locator('[data-testid="preferences-panel"]')).toBeVisible();
    
    // Check preference categories
    await expect(page.locator('[data-testid="search-preferences"]')).toBeVisible();
    await expect(page.locator('[data-testid="display-preferences"]')).toBeVisible();
    await expect(page.locator('[data-testid="behavior-preferences"]')).toBeVisible();
    await expect(page.locator('[data-testid="experimental-features"]')).toBeVisible();
    
    // Configure search preferences
    await page.locator('[data-testid="save-search-history"]').check();
    await page.locator('[data-testid="auto-complete-suggestions"]').check();
    await page.locator('[data-testid="personalized-results"]').uncheck();
    
    // Configure display preferences
    await page.locator('[data-testid="compact-view"]').check();
    await page.locator('[data-testid="show-thumbnails"]').check();
    await page.locator('[data-testid="grid-columns"]').fill('3');
    
    // Configure behavior preferences
    await page.locator('[data-testid="auto-save-drafts"]').check();
    await page.locator('[data-testid="confirm-actions"]').check();
    await page.locator('[data-testid="keyboard-shortcuts"]').check();
    
    // Enable experimental features
    await page.locator('[data-testid="beta-features"]').check();
    await page.locator('[data-testid="ai-recommendations"]').check();
    await page.locator('[data-testid="advanced-analytics"]').uncheck();
    
    // Save preferences
    await page.locator('[data-testid="save-preferences"]').click();
    await expect(page.locator('[data-testid="preferences-saved"]')).toBeVisible();
    
    // Test experimental features
    await page.goto('/search');
    await expect(page.locator('[data-testid="ai-suggestions"]')).toBeVisible();
    await expect(page.locator('[data-testid="beta-badge"]')).toBeVisible();
  });

  test('should handle settings validation and errors', async ({ page }) => {
    await page.goto('/settings/advanced');
    
    // Test invalid email in notification settings
    await page.locator('[data-testid="notification-settings"]').click();
    await page.locator('[data-testid="additional-email-input"]').fill('invalid-email');
    await page.locator('[data-testid="save-notification-settings"]').click();
    
    await expect(page.locator('[data-testid="email-validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-validation-error"]')).toContainText('Invalid email format');
    
    // Test weak password
    await page.locator('[data-testid="security-settings"]').click();
    await page.locator('[data-testid="change-password"]').click();
    
    await page.locator('[data-testid="current-password-input"]').fill('password123');
    await page.locator('[data-testid="new-password-input"]').fill('weak');
    await page.locator('[data-testid="confirm-password-input"]').fill('weak');
    
    await page.locator('[data-testid="update-password"]').click();
    await expect(page.locator('[data-testid="password-strength-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-strength-error"]')).toContainText('Password too weak');
    
    // Test invalid API key permissions
    await page.locator('[data-testid="api-settings"]').click();
    await page.locator('[data-testid="generate-api-key"]').click();
    
    await page.locator('[data-testid="key-name-input"]').fill('Test Key');
    // Don't select any permissions
    await page.locator('[data-testid="create-api-key"]').click();
    
    await expect(page.locator('[data-testid="permissions-required-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="permissions-required-error"]')).toContainText('At least one permission must be selected');
  });

  test('should handle mobile responsive settings', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/settings/advanced');
    
    // Check mobile layout
    await expect(page.locator('[data-testid="mobile-settings-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-settings-nav"]')).toBeVisible();
    
    // Test mobile navigation
    await page.locator('[data-testid="mobile-nav-toggle"]').click();
    await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
    
    await page.locator('[data-testid="mobile-billing-settings"]').click();
    await expect(page.locator('[data-testid="mobile-billing-panel"]')).toBeVisible();
    
    // Test mobile forms
    await page.locator('[data-testid="mobile-add-payment-method"]').click();
    await expect(page.locator('[data-testid="mobile-payment-form"]')).toBeVisible();
    
    // Test mobile save buttons
    await page.locator('[data-testid="mobile-save-button"]').click();
    await expect(page.locator('[data-testid="mobile-save-success"]')).toBeVisible();
  });
});
