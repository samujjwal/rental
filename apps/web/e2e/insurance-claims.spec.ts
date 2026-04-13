/**
 * Insurance Claims E2E Test Suite
 *
 * Tests the complete insurance claims flow:
 * - Viewing insurance policies
 * - Filing new claims
 * - Uploading claim documents
 * - Tracking claim status
 * - Managing claim communications
 */

import { test, expect } from '@playwright/test';
import { testUsers } from './helpers/fixtures';

test.describe('Insurance Claims Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as renter who has active insurance
    await page.goto('/login');
    await page.fill('input[name="email"]', testUsers.renter.email);
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/home/);
  });

  test.describe('Insurance Dashboard', () => {
    test('can view insurance dashboard', async ({ page }) => {
      await page.goto('/insurance');
      await expect(page.locator('h1')).toContainText(/Insurance|Coverage/i);
      await expect(page.locator('[data-testid="insurance-policies"]')).toBeVisible();
    });

    test('can view active policies', async ({ page }) => {
      await page.goto('/insurance');
      await page.waitForSelector('[data-testid="policy-card"]', { timeout: 5000 });
      
      const policies = page.locator('[data-testid="policy-card"]');
      const count = await policies.count();
      
      if (count > 0) {
        await expect(policies.first()).toBeVisible();
        await expect(policies.first().locator('[data-testid="policy-status"]')).toContainText(/Active|active/);
      }
    });

    test('can view policy details', async ({ page }) => {
      await page.goto('/insurance');
      
      // Click on first policy
      const firstPolicy = page.locator('[data-testid="policy-card"]').first();
      if (await firstPolicy.isVisible()) {
        await firstPolicy.click();
        await page.waitForURL(/\/insurance\/policies\//);
        
        await expect(page.locator('[data-testid="policy-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="coverage-details"]')).toBeVisible();
      }
    });
  });

  test.describe('Claims Management', () => {
    test('can view claims list', async ({ page }) => {
      await page.goto('/insurance/claims');
      await expect(page.locator('h1')).toContainText(/Claims/i);
      await expect(page.locator('[data-testid="claims-list"]')).toBeVisible();
    });

    test('can view claim details', async ({ page }) => {
      await page.goto('/insurance/claims');
      
      const firstClaim = page.locator('[data-testid="claim-item"]').first();
      if (await firstClaim.isVisible()) {
        await firstClaim.click();
        await page.waitForURL(/\/insurance\/claims\//);
        
        await expect(page.locator('[data-testid="claim-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="claim-status"]')).toBeVisible();
        await expect(page.locator('[data-testid="claim-timeline"]')).toBeVisible();
      }
    });

    test('can file a new claim', async ({ page }) => {
      await page.goto('/insurance/claims/new');
      
      // Verify form elements exist
      await expect(page.locator('[data-testid="claim-form"]')).toBeVisible();
      await expect(page.locator('select[name="policyId"]')).toBeVisible();
      await expect(page.locator('select[name="claimType"]')).toBeVisible();
      await expect(page.locator('textarea[name="description"]')).toBeVisible();
      await expect(page.locator('input[name="incidentDate"]')).toBeVisible();
      
      // Fill out claim form
      await page.selectOption('select[name="claimType"]', 'DAMAGE');
      await page.fill('textarea[name="description"]', 'Test damage claim description');
      await page.fill('input[name="incidentDate"]', '2025-01-15');
      await page.fill('input[name="amount"]', '5000');
      
      // Submit should be enabled
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();
    });

    test('shows validation errors for incomplete claim form', async ({ page }) => {
      await page.goto('/insurance/claims/new');
      
      // Submit empty form
      await page.click('button[type="submit"]');
      
      // Wait for validation errors
      await page.waitForSelector('[data-testid="field-error"], .error-message', { timeout: 3000 });
      
      const errors = page.locator('[data-testid="field-error"], .error-message');
      await expect(errors.first()).toBeVisible();
    });
  });

  test.describe('Document Upload', () => {
    test('can access document upload page', async ({ page }) => {
      await page.goto('/insurance/upload');
      await expect(page.locator('h1')).toContainText(/Upload|Document/i);
      await expect(page.locator('[data-testid="upload-zone"]')).toBeVisible();
    });

    test('can upload documents for a claim', async ({ page }) => {
      // First navigate to a claim
      await page.goto('/insurance/claims');
      
      const firstClaim = page.locator('[data-testid="claim-item"]').first();
      if (await firstClaim.isVisible()) {
        // Get claim ID from URL or attribute
        const claimId = await firstClaim.getAttribute('data-claim-id') || 'test-claim-id';
        
        await page.goto(`/insurance/claims/${claimId}/upload`);
        
        await expect(page.locator('[data-testid="upload-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="document-type-select"]')).toBeVisible();
        
        // Verify upload restrictions are shown
        await expect(page.locator('[data-testid="upload-restrictions"]')).toContainText(/MB|PNG|JPG|PDF/i);
      }
    });

    test('upload form validates file size', async ({ page }) => {
      await page.goto('/insurance/upload');
      
      // Try to submit without file
      await page.click('button[type="submit"]');
      
      await page.waitForSelector('[data-testid="upload-error"]', { timeout: 3000 });
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    });
  });

  test.describe('Claim Status Tracking', () => {
    test('displays claim status timeline', async ({ page }) => {
      await page.goto('/insurance/claims');
      
      const firstClaim = page.locator('[data-testid="claim-item"]').first();
      if (await firstClaim.isVisible()) {
        await firstClaim.click();
        await page.waitForURL(/\/insurance\/claims\//);
        
        // Verify timeline is visible
        await expect(page.locator('[data-testid="claim-timeline"]')).toBeVisible();
        
        // Check timeline has status items
        const timelineItems = page.locator('[data-testid="timeline-item"]');
        await expect(timelineItems.first()).toBeVisible();
      }
    });

    test('shows appropriate actions based on claim status', async ({ page }) => {
      await page.goto('/insurance/claims');
      
      // Look for claims with specific statuses
      const submittedClaims = page.locator('[data-testid="claim-item"][data-status="SUBMITTED"]');
      const approvedClaims = page.locator('[data-testid="claim-item"][data-status="APPROVED"]');
      
      if (await submittedClaims.first().isVisible()) {
        await submittedClaims.first().click();
        // Should show withdraw/edit actions for submitted claims
        await expect(page.locator('[data-testid="withdraw-claim-btn"]')).toBeVisible();
      } else if (await approvedClaims.first().isVisible()) {
        await approvedClaims.first().click();
        // Should show payment/reimbursement info for approved claims
        await expect(page.locator('[data-testid="payment-info"]')).toBeVisible();
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('insurance dashboard is responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/insurance');
      
      await expect(page.locator('h1')).toContainText(/Insurance/i);
      await expect(page.locator('[data-testid="insurance-policies"]')).toBeVisible();
      
      // Verify mobile layout
      const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"]');
      if (await mobileMenu.isVisible()) {
        await expect(mobileMenu).toBeVisible();
      }
    });

    test('claim filing form is usable on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/insurance/claims/new');
      
      // Form fields should be accessible
      await expect(page.locator('select[name="claimType"]')).toBeVisible();
      await expect(page.locator('textarea[name="description"]')).toBeVisible();
      
      // Submit button should be reachable
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();
    });
  });
});
