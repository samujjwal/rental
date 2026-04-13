/**
 * Organization Management E2E Test Suite
 *
 * Tests organization workflows:
 * - Viewing organization dashboard
 * - Managing organization listings
 * - Managing organization members
 * - Organization settings
 */

import { test, expect } from '@playwright/test';
import { testUsers } from './helpers/fixtures';

test.describe('Organization Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', testUsers.owner.email);
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/home/);
  });

  test.describe('Organization Dashboard', () => {
    test('can view organizations list', async ({ page }) => {
      await page.goto('/organizations');
      await expect(page.locator('h1')).toContainText(/Organizations|Teams/i);
    });

    test('can view organization details', async ({ page }) => {
      await page.goto('/organizations');
      
      const firstOrg = page.locator('[data-testid="organization-card"]').first();
      if (await firstOrg.isVisible()) {
        await firstOrg.click();
        await page.waitForURL(/\/organizations\//);
        
        await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible();
      }
    });
  });

  test.describe('Organization Listings', () => {
    test('can view organization listings', async ({ page }) => {
      await page.goto('/organizations');
      
      const firstOrg = page.locator('[data-testid="organization-card"]').first();
      if (await firstOrg.isVisible()) {
        const orgId = await firstOrg.getAttribute('data-org-id') || 'test-org';
        await page.goto(`/organizations/${orgId}/listings`);
        
        await expect(page.locator('h1')).toContainText(/Listings/i);
        await expect(page.locator('[data-testid="org-listings"]')).toBeVisible();
      }
    });

    test('can manage organization listings', async ({ page }) => {
      await page.goto('/organizations');
      
      const firstOrg = page.locator('[data-testid="organization-card"]').first();
      if (await firstOrg.isVisible()) {
        const orgId = await firstOrg.getAttribute('data-org-id') || 'test-org';
        await page.goto(`/organizations/${orgId}/listings`);
        
        // Verify bulk actions are available
        await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible();
        await expect(page.locator('[data-testid="add-listing-btn"]')).toBeVisible();
      }
    });
  });

  test.describe('Organization Members', () => {
    test('can view organization members', async ({ page }) => {
      await page.goto('/organizations');
      
      const firstOrg = page.locator('[data-testid="organization-card"]').first();
      if (await firstOrg.isVisible()) {
        const orgId = await firstOrg.getAttribute('data-org-id') || 'test-org';
        await page.goto(`/organizations/${orgId}/members`);
        
        await expect(page.locator('h1')).toContainText(/Members|Team/i);
        await expect(page.locator('[data-testid="members-list"]')).toBeVisible();
      }
    });

    test('can invite new members', async ({ page }) => {
      await page.goto('/organizations');
      
      const firstOrg = page.locator('[data-testid="organization-card"]').first();
      if (await firstOrg.isVisible()) {
        const orgId = await firstOrg.getAttribute('data-org-id') || 'test-org';
        await page.goto(`/organizations/${orgId}/members`);
        
        const inviteBtn = page.locator('[data-testid="invite-member-btn"]');
        if (await inviteBtn.isVisible()) {
          await inviteBtn.click();
          await expect(page.locator('[data-testid="invite-modal"]')).toBeVisible();
          await expect(page.locator('input[name="email"]')).toBeVisible();
        }
      }
    });
  });

  test.describe('Organization Settings', () => {
    test('can access organization settings', async ({ page }) => {
      await page.goto('/organizations');
      
      const firstOrg = page.locator('[data-testid="organization-card"]').first();
      if (await firstOrg.isVisible()) {
        const orgId = await firstOrg.getAttribute('data-org-id') || 'test-org';
        await page.goto(`/organizations/${orgId}/settings`);
        
        await expect(page.locator('h1')).toContainText(/Settings/i);
        await expect(page.locator('[data-testid="org-settings-form"]')).toBeVisible();
      }
    });

    test('can update organization profile', async ({ page }) => {
      await page.goto('/organizations');
      
      const firstOrg = page.locator('[data-testid="organization-card"]').first();
      if (await firstOrg.isVisible()) {
        const orgId = await firstOrg.getAttribute('data-org-id') || 'test-org';
        await page.goto(`/organizations/${orgId}/settings`);
        
        await page.fill('input[name="name"]', 'Updated Org Name');
        await page.fill('textarea[name="description"]', 'Updated description');
        
        await page.click('button[type="submit"]');
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      }
    });
  });
});
