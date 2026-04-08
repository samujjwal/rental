import { test, expect } from '@playwright/test';

/**
 * ORGANIZATION MANAGEMENT E2E TESTS
 * 
 * These tests validate organization management functionality:
 * - Organization creation and setup
 * - Member management and roles
 * - Organization settings and permissions
 * - Organization analytics and reporting
 * - Organization billing and subscriptions
 * 
 * Business Truth Validated:
 * - Organizations can be created and managed properly
 * - Member roles and permissions work correctly
 * - Organization settings are properly configured
 * - Analytics provide valuable insights
 * - Billing and subscriptions are handled correctly
 */

test.describe('Organization Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as organization admin
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('org-admin@example.com');
    await page.locator('[data-testid="password-input"]').fill('password123');
    await page.locator('[data-testid="login-button"]').click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create new organization', async ({ page }) => {
    // Navigate to organization creation
    await page.locator('[data-testid="organizations-nav"]').click();
    await expect(page).toHaveURL('/organizations');
    
    // Click create organization
    await page.locator('[data-testid="create-organization-button"]').click();
    await expect(page).toHaveURL('/organizations/new');
    
    // Check organization form
    await expect(page.locator('[data-testid="organization-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-description-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-type-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-industry-selector"]')).toBeVisible();
    
    // Fill organization details
    await page.locator('[data-testid="org-name-input"]').fill('Mountain Properties Nepal');
    await page.locator('[data-testid="org-description-input"]').fill(
      'Premium property management company specializing in vacation rentals and long-term leases in the Kathmandu Valley'
    );
    
    // Select organization type
    await page.locator('[data-testid="org-type-selector"]').click();
    await page.locator('[data-testid="org-type-property-management"]').click();
    
    // Select industry
    await page.locator('[data-testid="org-industry-selector"]').click();
    await page.locator('[data-testid="org-industry-real-estate"]').click();
    
    // Fill contact information
    await page.locator('[data-testid="org-phone-input"]').fill('+977-1-1234567');
    await page.locator('[data-testid="org-email-input"]').fill('info@mountainproperties.com');
    await page.locator('[data-testid="org-address-input"]').fill('Thamel, Kathmandu, Nepal');
    
    // Upload organization logo
    await page.locator('[data-testid="org-logo-upload"]').setInputFiles('test-files/org-logo.png');
    
    // Submit organization
    await page.locator('[data-testid="create-organization-submit"]').click();
    
    // Verify organization created
    await expect(page).toHaveURL(/\/organizations\/\w+/);
    await expect(page.locator('[data-testid="org-creation-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-name-display"]')).toContainText('Mountain Properties Nepal');
  });

  test('should manage organization members', async ({ page }) => {
    // Navigate to organization
    await page.goto('/organizations/test-org-id');
    
    // Click members tab
    await page.locator('[data-testid="org-members-tab"]').click();
    await expect(page.locator('[data-testid="org-members-list"]')).toBeVisible();
    
    // Check current members
    await expect(page.locator('[data-testid="org-member-item"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="member-name"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="member-role"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="member-status"]').first()).toBeVisible();
    
    // Add new member
    await page.locator('[data-testid="add-member-button"]').click();
    await expect(page.locator('[data-testid="add-member-modal"]')).toBeVisible();
    
    // Fill member details
    await page.locator('[data-testid="member-email-input"]').fill('newmember@example.com');
    await page.locator('[data-testid="member-first-name-input"]').fill('John');
    await page.locator('[data-testid="member-last-name-input"]').fill('Smith');
    
    // Select role
    await page.locator('[data-testid="member-role-selector"]').click();
    await page.locator('[data-testid="role-property-manager"]').click();
    
    // Set permissions
    await expect(page.locator('[data-testid="permissions-list"]')).toBeVisible();
    await page.locator('[data-testid="permission-manage-listings"]').check();
    await page.locator('[data-testid="permission-view-analytics"]').check();
    await page.locator('[data-testid="permission-manage-bookings"]').check();
    
    // Send invitation
    await page.locator('[data-testid="send-invitation-button"]').click();
    
    // Verify invitation sent
    await expect(page.locator('[data-testid="invitation-sent"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-invitation"]')).toBeVisible();
    
    // Check member list updated
    await expect(page.locator('[data-testid="org-members-list"]')).toContainText('newmember@example.com');
  });

  test('should manage member roles and permissions', async ({ page }) => {
    await page.goto('/organizations/test-org-id/members');
    
    // Click on existing member
    await page.locator('[data-testid="org-member-item"]').first().click();
    await expect(page.locator('[data-testid="member-details"]')).toBeVisible();
    
    // Edit member role
    await page.locator('[data-testid="edit-member-button"]').click();
    await expect(page.locator('[data-testid="edit-member-modal"]')).toBeVisible();
    
    // Change role
    await page.locator('[data-testid="member-role-selector"]').click();
    await page.locator('[data-testid="role-admin"]').click();
    
    // Update permissions
    await expect(page.locator('[data-testid="admin-permissions"]')).toBeVisible();
    await page.locator('[data-testid="permission-manage-organization"]').check();
    await page.locator('[data-testid="permission-manage-members"]').check();
    await page.locator('[data-testid="permission-view-billing"]').check();
    
    // Save changes
    await page.locator('[data-testid="save-member-changes"]').click();
    
    // Verify role updated
    await expect(page.locator('[data-testid="member-role"]')).toContainText('Admin');
    await expect(page.locator('[data-testid="role-update-success"]')).toBeVisible();
  });

  test('should handle organization settings', async ({ page }) => {
    await page.goto('/organizations/test-org-id');
    
    // Click settings tab
    await page.locator('[data-testid="org-settings-tab"]').click();
    await expect(page.locator('[data-testid="org-settings-form"]')).toBeVisible();
    
    // Check general settings
    await expect(page.locator('[data-testid="general-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-name-edit"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-description-edit"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-contact-edit"]')).toBeVisible();
    
    // Update organization name
    await page.locator('[data-testid="org-name-edit"]').clear();
    await page.locator('[data-testid="org-name-edit"]').fill('Mountain Properties Nepal Ltd.');
    
    // Update description
    await page.locator('[data-testid="org-description-edit"]').clear();
    await page.locator('[data-testid="org-description-edit"]').fill(
      'Leading property management company in Nepal offering premium vacation rentals and comprehensive property management services.'
    );
    
    // Check notification settings
    await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible();
    await page.locator('[data-testid="email-notifications"]').check();
    await page.locator('[data-testid="sms-notifications"]').check();
    await page.locator('[data-testid="booking-notifications"]').check();
    await page.locator('[data-testid="payment-notifications"]').check();
    
    // Check security settings
    await expect(page.locator('[data-testid="security-settings"]')).toBeVisible();
    await page.locator('[data-testid="two-factor-auth"]').check();
    await page.locator('[data-testid="session-timeout"]').selectOption('2 hours');
    await page.locator('[data-testid="ip-whitelist"]').check();
    
    // Save settings
    await page.locator('[data-testid="save-settings-button"]').click();
    
    // Verify settings saved
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-name-display"]')).toContainText('Mountain Properties Nepal Ltd.');
  });

  test('should manage organization listings', async ({ page }) => {
    await page.goto('/organizations/test-org-id');
    
    // Click listings tab
    await page.locator('[data-testid="org-listings-tab"]').click();
    await expect(page.locator('[data-testid="org-listings-grid"]')).toBeVisible();
    
    // Check organization listings
    await expect(page.locator('[data-testid="org-listing-card"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="listing-title"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="listing-status"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="listing-performance"]').first()).toBeVisible();
    
    // Add new listing to organization
    await page.locator('[data-testid="add-org-listing-button"]').click();
    await expect(page).toHaveURL(/\/listing\/create\?org=test-org-id/);
    
    // Fill listing details
    await page.locator('[data-testid="listing-title-input"]').fill('Luxury Apartment in Thamel');
    await page.locator('[data-testid="listing-description-input"]').fill(
      'Beautiful luxury apartment in the heart of Thamel with modern amenities and stunning mountain views.'
    );
    
    // Set organization as owner
    await expect(page.locator('[data-testid="owner-selector"]')).toHaveValue('test-org-id');
    
    // Fill property details
    await page.locator('[data-testid="property-type-selector"]').click();
    await page.locator('[data-testid="type-apartment"]').click();
    
    await page.locator('[data-testid="bedrooms-input"]').fill('2');
    await page.locator('[data-testid="bathrooms-input"]').fill('2');
    await page.locator('[data-testid="guests-input"]').fill('4');
    
    // Set price
    await page.locator('[data-testid="price-input"]').fill('150');
    
    // Submit listing
    await page.locator('[data-testid="create-listing-button"]').click();
    
    // Verify listing created
    await expect(page).toHaveURL(/\/listing\/\w+/);
    await expect(page.locator('[data-testid="listing-creation-success"]')).toBeVisible();
    
    // Check listing appears in organization
    await page.goto('/organizations/test-org-id/listings');
    await expect(page.locator('[data-testid="org-listings-grid"]')).toContainText('Luxury Apartment in Thamel');
  });

  test('should display organization analytics', async ({ page }) => {
    await page.goto('/organizations/test-org-id');
    
    // Click analytics tab
    await page.locator('[data-testid="org-analytics-tab"]').click();
    await expect(page.locator('[data-testid="org-analytics-dashboard"]')).toBeVisible();
    
    // Check overview metrics
    await expect(page.locator('[data-testid="total-listings"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-bookings"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="occupancy-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-rating"]')).toBeVisible();
    
    // Check revenue chart
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-period-selector"]')).toBeVisible();
    
    // Test chart period selection
    await page.locator('[data-testid="chart-period-selector"]').click();
    await page.locator('[data-testid="period-last-month"]').click();
    
    // Check booking trends
    await expect(page.locator('[data-testid="booking-trends-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="occupancy-chart"]')).toBeVisible();
    
    // Check top performing listings
    await expect(page.locator('[data-testid="top-listings"]')).toBeVisible();
    await expect(page.locator('[data-testid="top-listing-item"]').first()).toBeVisible();
    
    // Check member performance
    await expect(page.locator('[data-testid="member-performance"]')).toBeVisible();
    await expect(page.locator('[data-testid="member-performance-item"]').first()).toBeVisible();
    
    // Export analytics
    await page.locator('[data-testid="export-analytics-button"]').click();
    await expect(page.locator('[data-testid="export-options"]')).toBeVisible();
    
    await page.locator('[data-testid="export-pdf"]').click();
    await expect(page.locator('[data-testid="export-processing"]')).toBeVisible();
  });

  test('should manage organization billing', async ({ page }) => {
    await page.goto('/organizations/test-org-id');
    
    // Click billing tab
    await page.locator('[data-testid="org-billing-tab"]').click();
    await expect(page.locator('[data-testid="org-billing-dashboard"]')).toBeVisible();
    
    // Check billing overview
    await expect(page.locator('[data-testid="current-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-cycle"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-billing-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-usage"]')).toBeVisible();
    
    // Check subscription details
    await expect(page.locator('[data-testid="subscription-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-features"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-limits"]')).toBeVisible();
    
    // Upgrade plan
    await page.locator('[data-testid="upgrade-plan-button"]').click();
    await expect(page.locator('[data-testid="plan-upgrade-modal"]')).toBeVisible();
    
    // Select new plan
    await page.locator('[data-testid="plan-professional"]').click();
    await expect(page.locator('[data-testid="plan-features-professional"]')).toBeVisible();
    
    // Confirm upgrade
    await page.locator('[data-testid="confirm-upgrade"]').click();
    await expect(page.locator('[data-testid="upgrade-processing"]')).toBeVisible();
    
    // Check payment methods
    await expect(page.locator('[data-testid="payment-methods"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-method-item"]').first()).toBeVisible();
    
    // Add payment method
    await page.locator('[data-testid="add-payment-method"]').click();
    await expect(page.locator('[data-testid="payment-method-form"]')).toBeVisible();
    
    await page.locator('[data-testid="card-number-input"]').fill('4242424242424242');
    await page.locator('[data-testid="card-expiry-input"]').fill('12/25');
    await page.locator('[data-testid="card-cvv-input"]').fill('123');
    await page.locator('[data-testid="card-name-input"]').fill('Mountain Properties Nepal');
    
    await page.locator('[data-testid="save-payment-method"]').click();
    await expect(page.locator('[data-testid="payment-method-added"]')).toBeVisible();
    
    // Check billing history
    await expect(page.locator('[data-testid="billing-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-history-item"]').first()).toBeVisible();
    
    // Download invoice
    await page.locator('[data-testid="download-invoice"]').first().click();
    await expect(page.locator('[data-testid="invoice-downloaded"]')).toBeVisible();
  });

  test('should handle organization permissions', async ({ page }) => {
    await page.goto('/organizations/test-org-id/settings');
    
    // Click permissions section
    await page.locator('[data-testid="permissions-section"]').click();
    await expect(page.locator('[data-testid="permissions-manager"]')).toBeVisible();
    
    // Check role-based permissions
    await expect(page.locator('[data-testid="role-permissions"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-permissions-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="manager-permissions-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-permissions-list"]')).toBeVisible();
    
    // Create custom role
    await page.locator('[data-testid="create-custom-role"]').click();
    await expect(page.locator('[data-testid="custom-role-form"]')).toBeVisible();
    
    await page.locator('[data-testid="role-name-input"]').fill('Listing Manager');
    await page.locator('[data-testid="role-description-input"]').fill('Can manage listings but cannot access billing');
    
    // Set custom permissions
    await page.locator('[data-testid="permission-create-listings"]').check();
    await page.locator('[data-testid="permission-edit-listings"]').check();
    await page.locator('[data-testid="permission-view-listings"]').check();
    await page.locator('[data-testid="permission-manage-bookings"]').check();
    
    // Deny billing permissions
    await page.locator('[data-testid="permission-view-billing"]').uncheck();
    await page.locator('[data-testid="permission-manage-billing"]').uncheck();
    
    // Save custom role
    await page.locator('[data-testid="save-custom-role"]').click();
    await expect(page.locator('[data-testid="custom-role-created"]')).toBeVisible();
    
    // Apply custom role to member
    await page.goto('/organizations/test-org-id/members');
    await page.locator('[data-testid="org-member-item"]').nth(1).click();
    await page.locator('[data-testid="edit-member-button"]').click();
    
    await page.locator('[data-testid="member-role-selector"]').click();
    await page.locator('[data-testid="role-listing-manager"]').click();
    
    await page.locator('[data-testid="save-member-changes"]').click();
    await expect(page.locator('[data-testid="role-update-success"]')).toBeVisible();
  });

  test('should handle organization templates', async ({ page }) => {
    await page.goto('/organizations/test-org-id');
    
    // Click templates tab
    await page.locator('[data-testid="org-templates-tab"]').click();
    await expect(page.locator('[data-testid="org-templates"]')).toBeVisible();
    
    // Check listing templates
    await expect(page.locator('[data-testid="listing-templates"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-item"]').first()).toBeVisible();
    
    // Create new template
    await page.locator('[data-testid="create-template-button"]').click();
    await expect(page.locator('[data-testid="template-form"]')).toBeVisible();
    
    await page.locator('[data-testid="template-name-input"]').fill('Luxury Apartment Template');
    await page.locator('[data-testid="template-description-input"]').fill(
      'Template for creating luxury apartment listings with standard amenities and pricing'
    );
    
    // Set template defaults
    await page.locator('[data-testid="template-property-type"]').selectOption('apartment');
    await page.locator('[data-testid="template-bedrooms"]').fill('2');
    await page.locator('[data-testid="template-bathrooms"]').fill('2');
    await page.locator('[data-testid="template-guests"]').fill('4');
    
    // Set default amenities
    await page.locator('[data-testid="template-amenity-wifi"]').check();
    await page.locator('[data-testid="template-amenity-parking"]').check();
    await page.locator('[data-testid="template-amenity-kitchen"]').check();
    await page.locator('[data-testid="template-amenity-ac"]').check();
    
    // Set pricing template
    await page.locator('[data-testid="template-base-price"]').fill('150');
    await page.locator('[data-testid="template-weekly-discount"]').fill('10');
    await page.locator('[data-testid="template-monthly-discount"]').fill('20');
    
    // Save template
    await page.locator('[data-testid="save-template"]').click();
    await expect(page.locator('[data-testid="template-created"]')).toBeVisible();
    
    // Use template for new listing
    await page.locator('[data-testid="use-template-button"]').click();
    await expect(page).toHaveURL(/\/listing\/create\?template=template-id/);
    
    // Check template applied
    await expect(page.locator('[data-testid="listing-title-input"]')).toHaveValue('Luxury Apartment Template');
    await expect(page.locator('[data-testid="property-type-selector"]')).toHaveValue('apartment');
    await expect(page.locator('[data-testid="bedrooms-input"]')).toHaveValue('2');
  });

  test('should handle organization integrations', async ({ page }) => {
    await page.goto('/organizations/test-org-id');
    
    // Click integrations tab
    await page.locator('[data-testid="org-integrations-tab"]').click();
    await expect(page.locator('[data-testid="org-integrations"]')).toBeVisible();
    
    // Check available integrations
    await expect(page.locator('[data-testid="integration-calendar"]').toBeVisible();
    await expect(page.locator('[data-testid="integration-messaging"]').toBeVisible();
    await expect(page.locator('[data-testid="integration-analytics"]').toBeVisible();
    await expect(page.locator('[data-testid="integration-payment"]').toBeVisible();
    
    // Setup calendar integration
    await page.locator('[data-testid="setup-calendar-integration"]').click();
    await expect(page.locator('[data-testid="calendar-setup-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="calendar-provider"]').selectOption('google-calendar');
    await page.locator('[data-testid="calendar-auth-button"]').click();
    
    // Mock OAuth flow
    await expect(page).toHaveURL(/\/integrations\/calendar\/callback/);
    await page.locator('[data-testid="calendar-connected"]').click();
    
    // Configure calendar sync
    await expect(page.locator('[data-testid="calendar-sync-settings"]')).toBeVisible();
    await page.locator('[data-testid="sync-bookings"]').check();
    await page.locator('[data-testid="sync-availability"]').check();
    await page.locator('[data-testid="sync-frequency"]').selectOption('hourly');
    
    // Save integration
    await page.locator('[data-testid="save-calendar-integration"]').click();
    await expect(page.locator('[data-testid="calendar-integration-active"]')).toBeVisible();
    
    // Setup messaging integration
    await page.locator('[data-testid="setup-messaging-integration"]').click();
    await expect(page.locator('[data-testid="messaging-setup-modal"]')).toBeVisible();
    
    await page.locator('[data-testid="messaging-provider"]').selectOption('whatsapp');
    await page.locator('[data-testid="messaging-phone-input"]').fill('+9771234567890');
    
    await page.locator('[data-testid="save-messaging-integration"]').click();
    await expect(page.locator('[data-testid="messaging-integration-active"]')).toBeVisible();
  });

  test('should handle organization audit logs', async ({ page }) => {
    await page.goto('/organizations/test-org-id');
    
    // Click audit tab
    await page.locator('[data-testid="org-audit-tab"]').click();
    await expect(page.locator('[data-testid="org-audit-logs"]')).toBeVisible();
    
    // Check audit log entries
    await expect(page.locator('[data-testid="audit-log-item"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="audit-timestamp"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="audit-user"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="audit-action"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="audit-details"]').first()).toBeVisible();
    
    // Filter audit logs
    await page.locator('[data-testid="audit-filter"]').click();
    await page.locator('[data-testid="filter-member-actions"]').click();
    await page.locator('[data-testid="apply-filter"]').click();
    
    // Check filtered results
    await expect(page.locator('[data-testid="audit-log-item"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="audit-action"]').first()).toContainText('member');
    
    // Search audit logs
    await page.locator('[data-testid="audit-search"]').fill('Mountain Properties');
    await page.locator('[data-testid="search-audit"]').click();
    
    // Check search results
    await expect(page.locator('[data-testid="audit-log-item"]').first()).toBeVisible();
    
    // Export audit logs
    await page.locator('[data-testid="export-audit-logs"]').click();
    await expect(page.locator('[data-testid="export-options"]')).toBeVisible();
    
    await page.locator('[data-testid="export-csv"]').click();
    await expect(page.locator('[data-testid="audit-export-processing"]')).toBeVisible();
  });

  test('should handle organization mobile responsiveness', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/organizations/test-org-id');
    
    // Check mobile layout
    await expect(page.locator('[data-testid="mobile-org-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-org-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-org-menu"]')).toBeVisible();
    
    // Test mobile navigation
    await page.locator('[data-testid="mobile-org-menu"]').click();
    await expect(page.locator('[data-testid="mobile-org-sidebar"]')).toBeVisible();
    
    // Test mobile member management
    await page.locator('[data-testid="mobile-members-tab"]').click();
    await expect(page.locator('[data-testid="mobile-members-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-member-card"]').first()).toBeVisible();
    
    // Test mobile settings
    await page.locator('[data-testid="mobile-settings-tab"]').click();
    await expect(page.locator('[data-testid="mobile-settings-form"]')).toBeVisible();
    
    // Test mobile analytics
    await page.locator('[data-testid="mobile-analytics-tab"]').click();
    await expect(page.locator('[data-testid="mobile-analytics-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-revenue-chart"]')).toBeVisible();
  });
});
