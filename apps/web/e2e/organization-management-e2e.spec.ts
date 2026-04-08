import { test, expect } from '@playwright/test';

/**
 * ORGANIZATION MANAGEMENT E2E TESTS
 * 
 * These tests validate the complete organization management workflow:
 * - Organization creation and setup
 * - Member management and permissions
 * - Organization listings management
 * - Organization settings and configuration
 * - Role-based access control
 * 
 * Business Truth Validated:
 * - Organizations can be created and managed properly
 * - Member permissions work correctly
 * - Organization assets are managed securely
 * - Settings are applied consistently
 * - Access control is enforced properly
 */

test.describe('Organization Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as organization admin
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('admin@organization.com');
    await page.locator('[data-testid="password-input"]').fill('admin123');
    await page.locator('[data-testid="login-button"]').click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create new organization', async ({ page }) => {
    // Navigate to organization creation
    await page.locator('[data-testid="organizations-nav"]').click();
    await page.locator('[data-testid="create-organization-button"]').click();
    
    // Check creation form
    await expect(page).toHaveURL('/organizations/create');
    await expect(page.locator('[data-testid="organization-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-description-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-type-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-address-input"]')).toBeVisible();
    
    // Fill organization details
    await page.locator('[data-testid="org-name-input"]').fill('Property Management Nepal');
    await page.locator('[data-testid="org-description-input"]').fill(
      'Professional property management company specializing in residential and commercial properties in Kathmandu valley.'
    );
    
    await page.locator('[data-testid="org-type-selector"]').click();
    await page.locator('[data-testid="org-type-property-management"]').click();
    
    await page.locator('[data-testid="org-address-input"]').fill('Thamel, Kathmandu, Nepal');
    await page.locator('[data-testid="org-phone-input"]').fill('+9771234567890');
    await page.locator('[data-testid="org-email-input"]').fill('info@propertymanagement.com');
    await page.locator('[data-testid="org-website-input"]').fill('www.propertymanagement.com');
    
    // Upload organization logo
    await page.locator('[data-testid="logo-upload"]').setInputFiles('test-files/org-logo.png');
    
    // Create organization
    await page.locator('[data-testid="create-organization-submit"]').click();
    
    // Verify creation
    await expect(page.locator('[data-testid="organization-created"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-id"]')).toBeVisible();
    await expect(page).toHaveURL(/\/organizations\/\w+/);
  });

  test('should manage organization settings', async ({ page }) => {
    await page.goto('/organizations/test-org-id');
    
    // Navigate to settings
    await page.locator('[data-testid="org-settings-tab"]').click();
    await expect(page.locator('[data-testid="org-settings-panel"]')).toBeVisible();
    
    // Check settings sections
    await expect(page.locator('[data-testid="general-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="member-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="listing-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible();
    
    // Update general settings
    await page.locator('[data-testid="org-name-input"]').clear();
    await page.locator('[data-testid="org-name-input"]').fill('Property Management Nepal Ltd.');
    await page.locator('[data-testid="org-description-input"]').clear();
    await page.locator('[data-testid="org-description-input"]').fill(
      'Leading property management company in Nepal with 10+ years of experience.'
    );
    
    // Save settings
    await page.locator('[data-testid="save-general-settings"]').click();
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
  });

  test('should manage organization members', async ({ page }) => {
    await page.goto('/organizations/test-org-id/members');
    
    // Check members list
    await expect(page.locator('[data-testid="members-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="member-item"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="invite-member-button"]').toBeVisible();
    
    // Invite new member
    await page.locator('[data-testid="invite-member-button"]').click();
    await expect(page.locator('[data-testid="invite-member-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="member-email-input"]').fill('newmember@example.com');
    await page.locator('[data-testid="member-role-selector"]').click();
    await page.locator('[data-testid="role-property-manager"]').click();
    
    await page.locator('[data-testid="send-invitation"]').click();
    await expect(page.locator('[data-testid="invitation-sent"]')).toBeVisible();
    
    // Check member roles
    await page.locator('[data-testid="member-item"]').first().hover();
    await expect(page.locator('[data-testid="member-role-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="edit-member-role"]')).toBeVisible();
  });

  test('should manage member permissions', async ({ page }) => {
    await page.goto('/organizations/test-org-id/members');
    
    // Click on member to manage permissions
    await page.locator('[data-testid="member-item"]').first().click();
    await expect(page).toHaveURL(/\/organizations\/\w+\/members\/\w+/);
    
    // Check permissions panel
    await expect(page.locator('[data-testid="member-permissions"]')).toBeVisible();
    await expect(page.locator('[data-testid="permission-categories"]')).toBeVisible();
    
    // Test permission toggles
    await expect(page.locator('[data-testid="permission-listings"]')).toBeVisible();
    await expect(page.locator('[data-testid="permission-bookings"]')).toBeVisible();
    await expect(page.locator('[data-testid="permission-payments"]')).toBeVisible();
    await expect(page.locator('[data-testid="permission-reports"]')).toBeVisible();
    
    // Update permissions
    await page.locator('[data-testid="permission-listings-edit"]').check();
    await page.locator('[data-testid="permission-bookings-view"]').check();
    await page.locator('[data-testid="permission-payments-view"]').uncheck();
    
    await page.locator('[data-testid="save-permissions"]').click();
    await expect(page.locator('[data-testid="permissions-updated"]')).toBeVisible();
  });

  test('should manage organization listings', async ({ page }) => {
    await page.goto('/organizations/test-org-id/listings');
    
    // Check listings management
    await expect(page.locator('[data-testid="org-listings-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-listings-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-listings-grid"]')).toBeVisible();
    
    // Check listing actions
    await page.locator('[data-testid="org-listing-item"]').first().hover();
    await expect(page.locator('[data-testid="listing-edit-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="listing-view-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="listing-stats-button"]')).toBeVisible();
    
    // Add new listing to organization
    await page.locator('[data-testid="add-listing-button"]').click();
    await expect(page.locator('[data-testid="add-to-org-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="listing-selector"]').click();
    await page.locator('[data-testid="listing-option-1"]').click();
    
    await page.locator('[data-testid="add-to-org"]').click();
    await expect(page.locator('[data-testid="listing-added"]')).toBeVisible();
  });

  test('should manage organization finances', async ({ page }) => {
    await page.goto('/organizations/test-org-id/finances');
    
    // Check financial dashboard
    await expect(page.locator('[data-testid="org-finances-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="expense-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="profit-loss-summary"]')).toBeVisible();
    
    // Check transaction history
    await expect(page.locator('[data-testid="transaction-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="transaction-item"]').first()).toBeVisible();
    
    // Test filtering
    await page.locator('[data-testid="transaction-filter"]').click();
    await page.locator('[data-testid="filter-income"]').click();
    await expect(page.locator('[data-testid="transaction-item"]').first()).toBeVisible();
    
    // Test date range filter
    await page.locator('[data-testid="date-range-selector"]').click();
    await page.locator('[data-testid="last-30-days"]').click();
    await expect(page.locator('[data-testid="transactions-updated"]')).toBeVisible();
  });

  test('should manage organization reports', async ({ page }) => {
    await page.goto('/organizations/test-org-id/reports');
    
    // Check reports dashboard
    await expect(page.locator('[data-testid="org-reports-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="report-types"]')).toBeVisible();
    
    // Generate occupancy report
    await page.locator('[data-testid="occupancy-report"]').click();
    await expect(page.locator('[data-testid="report-generator"]')).toBeVisible();
    
    await page.locator('[data-testid="report-period-selector"]').click();
    await page.locator('[data-testid="last-quarter"]').click();
    
    await page.locator('[data-testid="generate-report"]').click();
    await expect(page.locator('[data-testid="report-generated"]')).toBeVisible();
    
    // Download report
    await page.locator('[data-testid="download-report"]').click();
    // Note: In real test, would verify file download
  });

  test('should handle organization templates', async ({ page }) => {
    await page.goto('/organizations/test-org-id/templates');
    
    // Check templates management
    await expect(page.locator('[data-testid="org-templates"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-categories"]')).toBeVisible();
    
    // Create listing template
    await page.locator('[data-testid="create-template-button"]').click();
    await expect(page.locator('[data-testid="template-form"]')).toBeVisible();
    
    await page.locator('[data-testid="template-name"]').fill('Standard Apartment Template');
    await page.locator('[data-testid="template-description"]').fill(
      'Template for standard apartment listings with common amenities and features.'
    );
    
    // Add template fields
    await page.locator('[data-testid="add-template-field"]').click();
    await page.locator('[data-testid="field-name"]').fill('Bedrooms');
    await page.locator('[data-testid="field-type"]').selectOption('Number');
    await page.locator('[data-testid="field-required"]').check();
    
    await page.locator('[data-testid="save-template-field"]').click();
    await page.locator('[data-testid="save-template"]').click();
    
    await expect(page.locator('[data-testid="template-created"]')).toBeVisible();
  });

  test('should manage organization branding', async ({ page }) => {
    await page.goto('/organizations/test-org-id/branding');
    
    // Check branding settings
    await expect(page.locator('[data-testid="org-branding-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="brand-colors"]')).toBeVisible();
    await expect(page.locator('[data-testid="brand-logo"]')).toBeVisible();
    await expect(page.locator('[data-testid="brand-fonts"]')).toBeVisible();
    
    // Update brand colors
    await page.locator('[data-testid="primary-color-input"]').fill('#2563eb');
    await page.locator('[data-testid="secondary-color-input"]').fill('#64748b');
    
    // Update logo
    await page.locator('[data-testid="update-logo"]').setInputFiles('test-files/new-logo.png');
    
    // Save branding
    await page.locator('[data-testid="save-branding"]').click();
    await expect(page.locator('[data-testid="branding-updated"]')).toBeVisible();
  });

  test('should handle organization subscriptions', async ({ page }) => {
    await page.goto('/organizations/test-org-id/subscription');
    
    // Check subscription details
    await expect(page.locator('[data-testid="subscription-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-stats"]')).toBeVisible();
    
    // Upgrade subscription
    await page.locator('[data-testid="upgrade-plan-button"]').click();
    await expect(page.locator('[data-testid="plan-selector"]')).toBeVisible();
    
    await page.locator('[data-testid="professional-plan"]').click();
    await expect(page.locator('[data-testid="plan-details"]')).toBeVisible();
    
    await page.locator('[data-testid="confirm-upgrade"]').click();
    await expect(page.locator('[data-testid="upgrade-confirmed"]')).toBeVisible();
  });

  test('should handle organization notifications', async ({ page }) => {
    await page.goto('/organizations/test-org-id/notifications');
    
    // Check notification settings
    await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-channels"]')).toBeVisible();
    
    // Configure email notifications
    await page.locator('[data-testid="email-notifications"]').check();
    await page.locator('[data-testid="new-booking-alerts"]').check();
    await page.locator('[data-testid="payment-notifications"]').check();
    await page.locator('[data-testid="member-activity-alerts"]').uncheck();
    
    // Configure SMS notifications
    await page.locator('[data-testid="sms-notifications"]').check();
    await page.locator('[data-testid="urgent-alerts-only"]').check();
    
    // Save settings
    await page.locator('[data-testid="save-notifications"]').click();
    await expect(page.locator('[data-testid="notifications-saved"]')).toBeVisible();
  });

  test('should handle organization audit logs', async ({ page }) => {
    await page.goto('/organizations/test-org-id/audit');
    
    // Check audit logs
    await expect(page.locator('[data-testid="audit-logs"]')).toBeVisible();
    await expect(page.locator('[data-testid="log-filters"]')).toBeVisible();
    await expect(page.locator('[data-testid="audit-table"]')).toBeVisible();
    
    // Test filtering
    await page.locator('[data-testid="action-filter"]').click();
    await page.locator('[data-testid="filter-member-added"]').click();
    
    await page.locator('[data-testid="date-filter"]').click();
    await page.locator('[data-testid="last-7-days"]').click();
    
    await page.locator('[data-testid="apply-filters"]').click();
    await expect(page.locator('[data-testid="logs-filtered"]')).toBeVisible();
    
    // Check log details
    await page.locator('[data-testid="audit-log-item"]').first().click();
    await expect(page.locator('[data-testid="log-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="log-metadata"]')).toBeVisible();
  });

  test('should handle organization integrations', async ({ page }) => {
    await page.goto('/organizations/test-org-id/integrations');
    
    // Check integrations panel
    await expect(page.locator('[data-testid="integrations-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="available-integrations"]')).toBeVisible();
    
    // Connect payment gateway
    await page.locator('[data-testid="payment-gateway-integration"]').click();
    await expect(page.locator('[data-testid="gateway-selector"]')).toBeVisible();
    
    await page.locator('[data-testid="khalti-gateway"]').click();
    await page.locator('[data-testid="gateway-api-key"]').fill('test_api_key_12345');
    await page.locator('[data-testid="gateway-secret"]').fill('test_secret_67890');
    
    await page.locator('[data-testid="test-connection"]').click();
    await expect(page.locator('[data-testid="connection-success"]')).toBeVisible();
    
    await page.locator('[data-testid="save-integration"]').click();
    await expect(page.locator('[data-testid="integration-saved"]')).toBeVisible();
  });

  test('should handle organization backup and restore', async ({ page }) => {
    await page.goto('/organizations/test-org-id/backup');
    
    // Check backup panel
    await expect(page.locator('[data-testid="backup-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="backup-history"]')).toBeVisible();
    
    // Create backup
    await page.locator('[data-testid="create-backup-button"]').click();
    await expect(page.locator('[data-testid="backup-options"]')).toBeVisible();
    
    await page.locator('[data-testid="backup-listings"]').check();
    await page.locator('[data-testid="backup-bookings"]').check();
    await page.locator('[data-testid="backup-finances"]').check();
    await page.locator('[data-testid="backup-members"]').uncheck();
    
    await page.locator('[data-testid="start-backup"]').click();
    await expect(page.locator('[data-testid="backup-in-progress"]')).toBeVisible();
    
    // Wait for backup completion
    await page.waitForSelector('[data-testid="backup-completed"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="backup-download"]')).toBeVisible();
  });

  test('should handle organization mobile app settings', async ({ page }) => {
    await page.goto('/organizations/test-org-id/mobile');
    
    // Check mobile app settings
    await expect(page.locator('[data-testid="mobile-app-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="app-customization"]')).toBeVisible();
    
    // Configure app settings
    await page.locator('[data-testid="app-name-input"]').fill('Property Manager Pro');
    await page.locator('[data-testid="app-theme-selector"]').click();
    await page.locator('[data-testid="theme-dark"]').click();
    
    // Configure app features
    await page.locator('[data-testid="feature-mobile-check-in"]').check();
    await page.locator('[data-testid="feature-mobile-key-exchange"]').check();
    await page.locator('[data-testid="feature-mobile-maintenance"]').uncheck();
    
    // Save settings
    await page.locator('[data-testid="save-mobile-settings"]').click();
    await expect(page.locator('[data-testid="mobile-settings-saved"]')).toBeVisible();
  });

  test('should handle organization API access', async ({ page }) => {
    await page.goto('/organizations/test-org-id/api');
    
    // Check API access panel
    await expect(page.locator('[data-testid="api-access-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-keys"]')).toBeVisible();
    
    // Generate API key
    await page.locator('[data-testid="generate-api-key"]').click();
    await expect(page.locator('[data-testid="api-key-form"]')).toBeVisible();
    
    await page.locator('[data-testid="key-name"]').fill('Mobile App API');
    await page.locator('[data-testid="key-permissions"]').click();
    await page.locator('[data-testid="permission-read-only"]').click();
    
    await page.locator('[data-testid="create-api-key"]').click();
    await expect(page.locator('[data-testid="api-key-created"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-key-value"]')).toBeVisible();
    
    // Test API documentation
    await page.locator('[data-testid="api-documentation"]').click();
    await expect(page.locator('[data-testid="api-docs"]')).toBeVisible();
  });

  test('should handle organization deletion', async ({ page }) => {
    await page.goto('/organizations/test-org-id/settings');
    
    // Navigate to dangerous zone
    await page.locator('[data-testid="dangerous-zone"]').click();
    await expect(page.locator('[data-testid="delete-organization-button"]')).toBeVisible();
    
    // Start deletion process
    await page.locator('[data-testid="delete-organization-button"]').click();
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    
    // Confirm deletion
    await page.locator('[data-testid="confirm-delete-input"]').fill('DELETE');
    await page.locator('[data-testid="final-confirm-delete"]').click();
    
    // Verify deletion
    await expect(page.locator('[data-testid="organization-deleted"]')).toBeVisible();
    await expect(page).toHaveURL('/organizations');
  });
});
