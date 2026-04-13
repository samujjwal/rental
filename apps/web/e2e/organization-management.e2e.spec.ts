/**
 * P1: Organization Management E2E Tests
 *
 * Comprehensive E2E coverage for organization workflows:
 * - Create and manage organizations
 * - Invite and manage members
 * - Organization listings management
 * - Role-based permissions
 * - Organization settings
 */

import { test, expect } from '@playwright/test';
import { BASE_URL, loginAs, testUsers } from './test-utils';

test.describe('Organization Management E2E', () => {
  test.describe('Organization Creation', () => {
    test('should allow owner to create a new organization', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/new`);
      
      // Fill organization creation form
      await page.fill('[data-testid="org-name-input"]', 'Test Property Management Co');
      await page.fill('[data-testid="org-slug-input"]', 'test-property-mgmt');
      await page.fill('[data-testid="org-description-input"]', 'A test organization for managing rental properties');
      await page.selectOption('[data-testid="org-type-select"]', 'PROPERTY_MANAGEMENT');
      
      // Submit form
      await page.click('[data-testid="create-org-btn"]');
      
      // Verify redirect to organization dashboard
      await expect(page).toHaveURL(/\/organizations\/[^/]+$/);
      
      // Verify organization details displayed
      await expect(page.locator('[data-testid="org-name-display"]')).toContainText('Test Property Management Co');
      await expect(page.locator('[data-testid="org-type-display"]')).toContainText('Property Management');
    });

    test('should validate required fields on organization creation', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/new`);
      
      // Submit without filling required fields
      await page.click('[data-testid="create-org-btn"]');
      
      // Verify validation errors
      await expect(page.locator('[data-testid="org-name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-slug-error"]')).toBeVisible();
      
      // Verify form not submitted (still on creation page)
      await expect(page).toHaveURL(/\/organizations\/new$/);
    });

    test('should enforce unique organization slug', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/new`);
      
      // Try to use existing slug
      await page.fill('[data-testid="org-name-input"]', 'Another Org');
      await page.fill('[data-testid="org-slug-input"]', 'existing-org');
      await page.selectOption('[data-testid="org-type-select"]', 'INDIVIDUAL');
      
      await page.click('[data-testid="create-org-btn"]');
      
      // Verify error message
      await expect(page.locator('[data-testid="org-slug-error"]')).toContainText('already taken');
    });
  });

  test.describe('Organization Member Management', () => {
    test('should allow owner to invite members by email', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      // Navigate to existing organization members page
      await page.goto(`${BASE_URL}/organizations/org-test/members`);
      
      // Click invite button
      await page.click('[data-testid="invite-member-btn"]');
      
      // Fill invite form
      await page.fill('[data-testid="invite-email-input"]', 'newmember@test.com');
      await page.selectOption('[data-testid="invite-role-select"]', 'MANAGER');
      await page.fill('[data-testid="invite-message-input"]', 'Welcome to our team!');
      
      await page.click('[data-testid="send-invite-btn"]');
      
      // Verify success message
      await expect(page.locator('[data-testid="invite-success-message"]')).toContainText('Invitation sent');
      
      // Verify pending member appears in list
      await expect(page.locator('[data-testid="pending-invites-list"]')).toContainText('newmember@test.com');
    });

    test('should display current organization members', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/members`);
      
      // Verify members table displayed
      await expect(page.locator('[data-testid="members-table"]')).toBeVisible();
      
      // Verify owner appears in members list
      await expect(page.locator('[data-testid="members-list"]')).toContainText('Owner');
      
      // Verify role badges displayed
      await expect(page.locator('[data-testid="role-badge-owner"]')).toBeVisible();
    });

    test('should allow changing member roles', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/members`);
      
      // Find member row and click edit role
      const memberRow = page.locator('[data-testid="member-row"]').first();
      await memberRow.locator('[data-testid="edit-role-btn"]').click();
      
      // Change role
      await page.selectOption('[data-testid="role-select"]', 'ADMIN');
      await page.click('[data-testid="save-role-btn"]');
      
      // Verify role updated
      await expect(memberRow.locator('[data-testid="role-badge-admin"]')).toBeVisible();
    });

    test('should allow removing members', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/members`);
      
      // Find member to remove
      const memberRow = page.locator('[data-testid="member-row"]').nth(1);
      await memberRow.locator('[data-testid="remove-member-btn"]').click();
      
      // Confirm removal in modal
      await page.click('[data-testid="confirm-remove-btn"]');
      
      // Verify member removed from list
      await expect(page.locator('[data-testid="member-removed-toast"]')).toBeVisible();
    });

    test('should prevent non-owners from accessing member management', async ({ page }) => {
      // Login as manager (non-owner)
      await loginAs(page, testUsers.renter);
      
      await page.goto(`${BASE_URL}/organizations/org-test/members`);
      
      // Verify access denied or limited UI
      await expect(page.locator('[data-testid="invite-member-btn"]')).toBeDisabled();
      await expect(page.locator('[data-testid="edit-role-btn"]')).toHaveCount(0);
    });
  });

  test.describe('Organization Listings', () => {
    test('should display organization listings', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/listings`);
      
      // Verify listings table
      await expect(page.locator('[data-testid="org-listings-table"]')).toBeVisible();
      
      // Verify listing count displayed
      await expect(page.locator('[data-testid="listings-count"]')).toBeVisible();
    });

    test('should allow adding listing to organization', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/listings`);
      
      // Click add listing
      await page.click('[data-testid="add-listing-btn"]');
      
      // Select existing listing
      await page.selectOption('[data-testid="listing-select"]', 'listing-test-1');
      await page.click('[data-testid="confirm-add-listing-btn"]');
      
      // Verify listing added
      await expect(page.locator('[data-testid="listing-added-toast"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-listings-table"]')).toContainText('Test Apartment');
    });

    test('should allow removing listing from organization', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/listings`);
      
      // Find listing row
      const listingRow = page.locator('[data-testid="listing-row"]').first();
      await listingRow.locator('[data-testid="remove-listing-btn"]').click();
      
      // Confirm removal
      await page.click('[data-testid="confirm-remove-listing-btn"]');
      
      // Verify removal
      await expect(page.locator('[data-testid="listing-removed-toast"]')).toBeVisible();
    });

    test('should filter listings by status', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/listings`);
      
      // Filter by status
      await page.selectOption('[data-testid="status-filter"]', 'AVAILABLE');
      
      // Verify filtered results
      const rows = page.locator('[data-testid="listing-row"]');
      const count = await rows.count();
      
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('[data-testid="listing-status"]')).toContainText('Available');
      }
    });
  });

  test.describe('Organization Settings', () => {
    test('should allow updating organization profile', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/settings`);
      
      // Update profile info
      await page.fill('[data-testid="org-name-input"]', 'Updated Org Name');
      await page.fill('[data-testid="org-description-input"]', 'Updated description');
      await page.fill('[data-testid="org-website-input"]', 'https://example.com');
      await page.fill('[data-testid="org-phone-input"]', '+977-1-4444444');
      
      await page.click('[data-testid="save-profile-btn"]');
      
      // Verify success
      await expect(page.locator('[data-testid="profile-saved-toast"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-name-display"]')).toContainText('Updated Org Name');
    });

    test('should allow updating organization branding', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/settings/branding`);
      
      // Upload logo (simulate file upload)
      await page.setInputFiles('[data-testid="logo-upload-input"]', {
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake-logo-data'),
      });
      
      // Select brand color
      await page.fill('[data-testid="brand-color-input"]', '#FF5733');
      
      await page.click('[data-testid="save-branding-btn"]');
      
      // Verify branding saved
      await expect(page.locator('[data-testid="branding-saved-toast"]')).toBeVisible();
      await expect(page.locator('[data-testid="brand-color-preview"]')).toHaveAttribute('style', /#FF5733/);
    });

    test('should allow configuring notification preferences', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/settings/notifications`);
      
      // Toggle notification settings
      await page.check('[data-testid="email-new-booking-checkbox"]');
      await page.uncheck('[data-testid="email-marketing-checkbox"]');
      await page.check('[data-testid="sms-urgent-checkbox"]');
      
      await page.click('[data-testid="save-notifications-btn"]');
      
      // Verify saved
      await expect(page.locator('[data-testid="notifications-saved-toast"]')).toBeVisible();
    });

    test('should allow owner to delete organization', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      // First create a test organization to delete
      await page.goto(`${BASE_URL}/organizations/new`);
      await page.fill('[data-testid="org-name-input"]', 'Org To Delete');
      await page.fill('[data-testid="org-slug-input"]', 'org-to-delete-test');
      await page.selectOption('[data-testid="org-type-select"]', 'INDIVIDUAL');
      await page.click('[data-testid="create-org-btn"]');
      
      // Navigate to settings
      await page.click('[data-testid="org-settings-link"]');
      
      // Navigate to danger zone
      await page.click('[data-testid="danger-zone-tab"]');
      
      // Click delete
      await page.click('[data-testid="delete-org-btn"]');
      
      // Confirm deletion
      await page.fill('[data-testid="delete-confirm-input"]', 'DELETE');
      await page.click('[data-testid="confirm-delete-btn"]');
      
      // Verify redirect to organizations list
      await expect(page).toHaveURL(/\/organizations$/);
      
      // Verify deleted org not in list
      await expect(page.locator('text=Org To Delete')).toHaveCount(0);
    });
  });

  test.describe('Organization Dashboard', () => {
    test('should display organization overview', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test`);
      
      // Verify dashboard components
      await expect(page.locator('[data-testid="org-stats-cards"]')).toBeVisible();
      await expect(page.locator('[data-testid="recent-bookings"]')).toBeVisible();
      await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-listings"]')).toBeVisible();
    });

    test('should display organization analytics', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/analytics`);
      
      // Verify analytics components
      await expect(page.locator('[data-testid="revenue-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="booking-trends"]')).toBeVisible();
      await expect(page.locator('[data-testid="occupancy-rate"]')).toBeVisible();
    });

    test('should allow date range selection for analytics', async ({ page }) => {
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/analytics`);
      
      // Select date range
      await page.click('[data-testid="date-range-picker"]');
      await page.click('text=Last 30 Days');
      
      // Verify chart updates
      await expect(page.locator('[data-testid="chart-date-range"]')).toContainText('30 Days');
    });
  });

  test.describe('Role-Based Access Control', () => {
    test('admin should have full access except delete', async ({ page }) => {
      // Login as org admin
      await loginAs(page, { ...testUsers.owner, role: 'ORG_ADMIN' });
      
      await page.goto(`${BASE_URL}/organizations/org-test/settings`);
      
      // Can access settings
      await expect(page.locator('[data-testid="org-settings-form"]')).toBeVisible();
      
      // Cannot delete org (no danger zone tab)
      await expect(page.locator('[data-testid="danger-zone-tab"]')).toHaveCount(0);
    });

    test('manager should have limited access', async ({ page }) => {
      // Login as org manager
      await loginAs(page, { ...testUsers.renter, role: 'ORG_MANAGER' });
      
      // Can view listings
      await page.goto(`${BASE_URL}/organizations/org-test/listings`);
      await expect(page.locator('[data-testid="org-listings-table"]')).toBeVisible();
      
      // Cannot access settings
      await page.goto(`${BASE_URL}/organizations/org-test/settings`);
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
    });

    test('member should have view-only access', async ({ page }) => {
      // Login as org member
      await loginAs(page, { ...testUsers.renter, role: 'ORG_MEMBER' });
      
      // Can view dashboard
      await page.goto(`${BASE_URL}/organizations/org-test`);
      await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible();
      
      // Cannot modify listings
      await page.goto(`${BASE_URL}/organizations/org-test/listings`);
      await expect(page.locator('[data-testid="add-listing-btn"]')).toBeDisabled();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('organization dashboard renders correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test`);
      
      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-org-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
    });

    test('member list is scrollable on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await loginAs(page, testUsers.owner);
      
      await page.goto(`${BASE_URL}/organizations/org-test/members`);
      
      // Verify members list scrollable
      const membersList = page.locator('[data-testid="members-list"]');
      await expect(membersList).toHaveCSS('overflow-y', /auto|scroll/);
    });
  });
});
