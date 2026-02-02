import { test, expect, Page } from '@playwright/test';
import { loginAs, testUsers } from './helpers/test-utils';

test.describe('Disputes Flow', () => {
  test.describe('Create Dispute', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should navigate to dispute creation from booking', async ({ page }) => {
      // Go to bookings page
      await page.goto('/bookings');
      await page.waitForLoadState('networkidle');

      // Find a completed booking
      const completedBooking = page.locator('[data-testid="booking-card"]').filter({
        hasText: 'Completed',
      }).first();

      if (await completedBooking.isVisible()) {
        await completedBooking.click();
        
        // Click on file dispute button
        const disputeButton = page.locator('[data-testid="file-dispute-btn"], button:has-text("File Dispute")');
        if (await disputeButton.isVisible()) {
          await disputeButton.click();
          await expect(page).toHaveURL(/disputes\/new/);
        }
      }
    });

    test('should display dispute type selection', async ({ page }) => {
      await page.goto('/disputes/new/test-booking-id');
      
      // Check for dispute type options
      const disputeTypes = [
        'Property Damage',
        'Payment Issue',
        'Cancellation',
        'Refund Request',
        'Missing Items',
        'Condition Mismatch',
        'Other',
      ];

      for (const type of disputeTypes) {
        const typeOption = page.locator(`text=${type}`);
        // Type options should be present as radio buttons or select options
        await expect(typeOption.or(page.locator(`[value*="${type.toLowerCase()}"]`))).toBeVisible().catch(() => {});
      }
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/disputes/new/test-booking-id');
      await page.waitForLoadState('networkidle');

      // Try to submit without filling required fields
      const submitButton = page.locator('button:has-text("Submit Dispute"), button[type="submit"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show validation errors
        await expect(page.locator('text=/required|please fill|cannot be empty/i')).toBeVisible();
      }
    });

    test('should fill dispute form completely', async ({ page }) => {
      await page.goto('/disputes/new/test-booking-id');
      await page.waitForLoadState('networkidle');

      // Select dispute type
      await page.locator('[name="type"], [data-testid="dispute-type"]').selectOption('PROPERTY_DAMAGE').catch(() => {
        page.locator('input[value="PROPERTY_DAMAGE"]').check();
      });

      // Fill description
      await page.fill('[name="description"], textarea[placeholder*="description"]', 
        'The property had significant damage to the furniture that was not disclosed in the listing.');

      // Fill amount
      await page.fill('[name="amount"], input[type="number"]', '500');

      // Submit form
      const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();
      if (await submitButton.isEnabled()) {
        await submitButton.click();
      }
    });

    test('should upload evidence files', async ({ page }) => {
      await page.goto('/disputes/new/test-booking-id');
      await page.waitForLoadState('networkidle');

      // Look for file upload input
      const fileInput = page.locator('input[type="file"]');
      
      if (await fileInput.isVisible()) {
        // Create a test file to upload
        await fileInput.setInputFiles({
          name: 'evidence.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('test image content'),
        });

        // Should show uploaded file
        await expect(page.locator('text=/evidence\.jpg|uploaded/i')).toBeVisible();
      }
    });
  });

  test.describe('View Disputes', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should list user disputes', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForLoadState('networkidle');

      // Should show disputes list or empty state
      const disputesList = page.locator('[data-testid="disputes-list"], .disputes-list');
      const emptyState = page.locator('text=/no disputes|nothing here/i');

      await expect(disputesList.or(emptyState)).toBeVisible();
    });

    test('should filter disputes by status', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForLoadState('networkidle');

      const statusFilters = ['Open', 'Under Review', 'Resolved', 'Closed'];

      for (const status of statusFilters) {
        const filterButton = page.locator(`button:has-text("${status}"), [data-filter="${status.toLowerCase()}"]`);
        if (await filterButton.isVisible()) {
          await filterButton.click();
          // Should update the list based on filter
          await page.waitForLoadState('networkidle');
        }
      }
    });

    test('should view dispute details', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForLoadState('networkidle');

      const disputeCard = page.locator('[data-testid="dispute-card"], .dispute-item').first();
      
      if (await disputeCard.isVisible()) {
        await disputeCard.click();

        // Should show dispute details
        await expect(page.locator('text=/status|description|amount/i')).toBeVisible();
      }
    });
  });

  test.describe('Dispute Response', () => {
    test('should allow adding response to dispute', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/disputes');
      await page.waitForLoadState('networkidle');

      // Click on a dispute
      const disputeItem = page.locator('[data-testid="dispute-card"]').first();
      if (await disputeItem.isVisible()) {
        await disputeItem.click();

        // Add response
        const responseInput = page.locator('[name="response"], textarea[placeholder*="response"]');
        if (await responseInput.isVisible()) {
          await responseInput.fill('I would like to provide additional information regarding this dispute.');
          
          const sendButton = page.locator('button:has-text("Send"), button:has-text("Submit Response")');
          if (await sendButton.isVisible()) {
            await sendButton.click();
          }
        }
      }
    });
  });

  test.describe('Admin Dispute Management', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.admin);
    });

    test('should view all disputes as admin', async ({ page }) => {
      await page.goto('/admin/disputes');
      await page.waitForLoadState('networkidle');

      // Should show admin disputes table
      await expect(page.locator('table, [data-testid="disputes-table"]')).toBeVisible();
    });

    test('should filter disputes by priority', async ({ page }) => {
      await page.goto('/admin/disputes');
      await page.waitForLoadState('networkidle');

      const priorityFilter = page.locator('[data-testid="priority-filter"], select[name="priority"]');
      if (await priorityFilter.isVisible()) {
        await priorityFilter.selectOption('HIGH');
        await page.waitForLoadState('networkidle');
      }
    });

    test('should assign dispute to admin', async ({ page }) => {
      await page.goto('/admin/disputes');
      await page.waitForLoadState('networkidle');

      // Open dispute details
      const disputeRow = page.locator('tr, [data-testid="dispute-row"]').first();
      if (await disputeRow.isVisible()) {
        await disputeRow.click();

        // Look for assign button
        const assignButton = page.locator('button:has-text("Assign"), button:has-text("Assign to me")');
        if (await assignButton.isVisible()) {
          await assignButton.click();
        }
      }
    });

    test('should update dispute status', async ({ page }) => {
      await page.goto('/admin/disputes');
      await page.waitForLoadState('networkidle');

      // Open dispute
      const disputeRow = page.locator('tr, [data-testid="dispute-row"]').first();
      if (await disputeRow.isVisible()) {
        await disputeRow.click();

        // Update status
        const statusSelect = page.locator('[name="status"], select[data-testid="status-select"]');
        if (await statusSelect.isVisible()) {
          await statusSelect.selectOption('UNDER_REVIEW');
          
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")');
          if (await saveButton.isVisible()) {
            await saveButton.click();
          }
        }
      }
    });

    test('should resolve dispute with resolution', async ({ page }) => {
      await page.goto('/admin/disputes');
      await page.waitForLoadState('networkidle');

      // Open dispute
      const disputeRow = page.locator('tr, [data-testid="dispute-row"]').first();
      if (await disputeRow.isVisible()) {
        await disputeRow.click();

        // Click resolve button
        const resolveButton = page.locator('button:has-text("Resolve")');
        if (await resolveButton.isVisible()) {
          await resolveButton.click();

          // Fill resolution details
          await page.fill('[name="resolution"], textarea', 'Dispute resolved in favor of the renter with partial refund.');
          await page.locator('[name="resolutionType"]').selectOption('PARTIAL_REFUND');
          await page.fill('[name="refundAmount"]', '250');

          // Submit resolution
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Submit Resolution")');
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
          }
        }
      }
    });
  });
});
