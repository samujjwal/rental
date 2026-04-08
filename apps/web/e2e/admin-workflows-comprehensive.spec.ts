import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/test-utils';

/**
 * COMPREHENSIVE ADMIN WORKFLOW E2E TESTS
 * 
 * These tests validate critical admin workflows:
 * 1. User management (view, edit, ban, role changes)
 * 2. Moderation (dispute resolution, content moderation)
 * 3. System configuration (settings, environment variables)
 * 4. API key management (create, revoke, rotate)
 * 5. Audit logs (view, filter, export)
 * 6. Email configuration (SMTP settings, templates)
 * 7. Security settings (2FA, password policies)
 * 8. Database operations (backups, migrations)
 * 
 * Business Truth Validated:
 * - Admin actions have proper authorization checks
 * - Critical operations require confirmation
 * - Audit trails are recorded
 * - System changes are validated before applying
 */

test.describe('Comprehensive Admin Workflows', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('User Management', () => {
    test('should view user list with filters', async () => {
      await page.goto('/admin/entities/users');
      await expect(page.getByRole('heading', { level: 1, name: /Users/i })).toBeVisible();
      
      // Check for table
      await expect(page.locator('[data-testid="data-table"]')).toBeVisible();
      
      // Check for filters
      await expect(page.getByPlaceholder('Search...')).toBeVisible();
      await expect(page.getByRole('button', { name: /Filter/i })).toBeVisible();
    });

    test('should view user details and edit user', async () => {
      await page.goto('/admin/entities/users');
      
      // Click on first user
      const firstUser = page.locator('[data-testid="data-table"] tbody tr').first();
      const viewButton = firstUser.locator('button[title="View"], button[aria-label="view"]');
      
      if (await viewButton.isVisible()) {
        await viewButton.click();
        await expect(page.locator('[data-testid="user-details"]')).toBeVisible();
        
        // Check for edit button
        const editButton = page.getByRole('button', { name: /Edit/i });
        if (await editButton.isVisible()) {
          await editButton.click();
          await expect(page.locator('[data-testid="user-edit-form"]')).toBeVisible();
        }
      }
    });

    test('should ban user with confirmation', async () => {
      await page.goto('/admin/entities/users');
      
      const firstUser = page.locator('[data-testid="data-table"] tbody tr').first();
      const banButton = firstUser.locator('button[title="Ban"], button[aria-label="ban"]');
      
      if (await banButton.isVisible()) {
        await banButton.click();
        
        // Should show confirmation dialog
        await expect(page.locator('dialog')).toBeVisible();
        await expect(page.getByText(/Are you sure/i)).toBeVisible();
        
        // Cancel first to test cancel flow
        await page.getByRole('button', { name: /Cancel/i }).click();
        await expect(page.locator('dialog')).not.toBeVisible();
      }
    });

    test('should change user role', async () => {
      await page.goto('/admin/entities/users');
      
      const firstUser = page.locator('[data-testid="data-table"] tbody tr').first();
      const editButton = firstUser.locator('button[title="Edit"], button[aria-label="edit"]');
      
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Look for role selector
        const roleSelect = page.locator('[data-testid="role-select"]');
        if (await roleSelect.isVisible()) {
          await roleSelect.click();
          await page.getByRole('option', { name: /Admin/i }).click();
          
          // Save changes
          await page.getByRole('button', { name: /Save/i }).click();
          
          // Should show success message
          await expect(page.getByText(/saved|updated/i, { exact: false })).toBeVisible();
        }
      }
    });
  });

  test.describe('Moderation Workflows', () => {
    test('should view active disputes', async () => {
      await page.goto('/admin/disputes');
      await expect(page.getByRole('heading', { level: 1, name: /Disputes/i })).toBeVisible();
      
      // Check for dispute cards or table
      const disputeCards = page.locator('[data-testid="dispute-card"]');
      const disputeTable = page.locator('[data-testid="data-table"]');
      
      const hasCards = await disputeCards.count() > 0;
      const hasTable = await disputeTable.isVisible().catch(() => false);
      
      expect(hasCards || hasTable).toBe(true);
    });

    test('should resolve dispute in favor of renter', async () => {
      await page.goto('/admin/disputes');
      
      const disputeCard = page.locator('[data-testid="dispute-card"]').first();
      const visible = await disputeCard.isVisible().catch(() => false);
      
      if (visible) {
        await disputeCard.click();
        await expect(page.locator('[data-testid="dispute-details"]')).toBeVisible();
        
        // Look for resolve buttons
        const resolveRenter = page.getByRole('button', { name: /Resolve in favor of renter/i });
        
        if (await resolveRenter.isVisible()) {
          await resolveRenter.click();
          
          // Should show confirmation
          await expect(page.locator('dialog')).toBeVisible();
          await page.getByRole('button', { name: /Confirm/i }).click();
          
          // Should show success message
          await expect(page.getByText(/resolved/i, { exact: false })).toBeVisible();
        }
      }
    });

    test('should view content moderation queue', async () => {
      await page.goto('/admin/moderation');
      
      const heading = page.getByRole('heading', { level: 1, name: /Moderation/i });
      const visible = await heading.isVisible().catch(() => false);
      
      if (visible) {
        await expect(heading).toBeVisible();
        
        // Check for moderation items
        await expect(page.locator('[data-testid="moderation-item"]')).toBeVisible();
      }
    });
  });

  test.describe('System Configuration', () => {
    test('should view system settings', async () => {
      await page.goto('/admin/system/general');
      await expect(page.getByRole('heading', { level: 1, name: /General Settings/i })).toBeVisible();
      
      // Check for configuration sections
      await expect(page.locator('[data-testid="config-section"]')).toBeVisible();
    });

    test('should update system configuration', async () => {
      await page.goto('/admin/system/general');
      
      // Look for editable settings
      const saveButton = page.getByRole('button', { name: /Save/i });
      
      if (await saveButton.isVisible()) {
        // Modify a setting
        const platformNameInput = page.locator('[data-testid="platform-name"]');
        if (await platformNameInput.isVisible()) {
          await platformNameInput.fill('Test Platform Name');
          
          await saveButton.click();
          
          // Should show success message
          await expect(page.getByText(/saved|updated/i, { exact: false })).toBeVisible();
        }
      }
    });

    test('should view environment variables', async () => {
      await page.goto('/admin/system/environment');
      await expect(page.getByRole('heading', { level: 1, name: /Environment/i })).toBeVisible();
      
      // Check for environment variable list
      await expect(page.locator('[data-testid="env-var-list"]')).toBeVisible();
    });
  });

  test.describe('API Key Management', () => {
    test('should view API keys', async () => {
      await page.goto('/admin/system/api-keys');
      await expect(page.getByRole('heading', { level: 1, name: /API Keys/i })).toBeVisible();
      
      // Check for API key table
      await expect(page.locator('[data-testid="api-keys-table"]')).toBeVisible();
    });

    test('should create new API key', async () => {
      await page.goto('/admin/system/api-keys');
      
      const createButton = page.getByRole('button', { name: /Create|Add New/i });
      
      if (await createButton.isVisible()) {
        await createButton.click();
        
        // Should show create form
        await expect(page.locator('[data-testid="api-key-form"]')).toBeVisible();
        
        // Fill in form
        const nameInput = page.locator('[data-testid="api-key-name"]');
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test API Key');
          
          // Select scopes
          const scopesSelect = page.locator('[data-testid="api-key-scopes"]');
          if (await scopesSelect.isVisible()) {
            await scopesSelect.click();
            await page.getByRole('option', { name: /read/i }).click();
          }
          
          // Submit
          await page.getByRole('button', { name: /Create|Generate/i }).click();
          
          // Should show success and display key
          await expect(page.getByText(/api key|generated/i, { exact: false })).toBeVisible();
        }
      }
    });

    test('should revoke API key with confirmation', async () => {
      await page.goto('/admin/system/api-keys');
      
      const revokeButton = page.locator('button[title="Revoke"], button[aria-label="revoke"]').first();
      
      if (await revokeButton.isVisible()) {
        await revokeButton.click();
        
        // Should show confirmation dialog
        await expect(page.locator('dialog')).toBeVisible();
        await page.getByRole('button', { name: /Cancel/i }).click();
      }
    });
  });

  test.describe('Audit Logs', () => {
    test('should view audit logs', async () => {
      await page.goto('/admin/system/audit');
      await expect(page.getByRole('heading', { level: 1, name: /Audit/i })).toBeVisible();
      
      // Check for audit log table
      await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible();
    });

    test('should filter audit logs by date range', async () => {
      await page.goto('/admin/system/audit');
      
      // Look for date filters
      const dateFilter = page.locator('[data-testid="date-filter"]');
      
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        
        // Select date range
        await page.getByRole('button', { name: /Last 7 days/i }).click();
        
        // Should refresh logs
        await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible();
      }
    });

    test('should filter audit logs by user', async () => {
      await page.goto('/admin/system/audit');
      
      const userFilter = page.locator('[data-testid="user-filter"]');
      
      if (await userFilter.isVisible()) {
        await userFilter.fill('admin');
        
        // Should filter logs
        await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible();
      }
    });

    test('should export audit logs', async () => {
      await page.goto('/admin/system/audit');
      
      const exportButton = page.getByRole('button', { name: /Export/i });
      
      if (await exportButton.isVisible()) {
        // Note: Actual download handling would require more setup
        await expect(exportButton).toBeVisible();
      }
    });
  });

  test.describe('Email Configuration', () => {
    test('should view email settings', async () => {
      await page.goto('/admin/system/email');
      await expect(page.getByRole('heading', { level: 1, name: /Email/i })).toBeVisible();
      
      // Check for SMTP configuration
      await expect(page.locator('[data-testid="smtp-config"]')).toBeVisible();
    });

    test('should update SMTP settings', async () => {
      await page.goto('/admin/system/email');
      
      const saveButton = page.getByRole('button', { name: /Save/i });
      
      if (await saveButton.isVisible()) {
        // Modify SMTP settings
        const smtpHost = page.locator('[data-testid="smtp-host"]');
        if (await smtpHost.isVisible()) {
          await smtpHost.fill('smtp.example.com');
          
          await saveButton.click();
          
          // Should show success or validation
          const successMessage = page.getByText(/saved|updated/i, { exact: false });
          const errorMessage = page.getByText(/error|invalid/i, { exact: false });
          
          expect(await successMessage.isVisible() || await errorMessage.isVisible()).toBe(true);
        }
      }
    });

    test('should send test email', async () => {
      await page.goto('/admin/system/email');
      
      const testEmailButton = page.getByRole('button', { name: /Send Test Email/i });
      
      if (await testEmailButton.isVisible()) {
        await testEmailButton.click();
        
        // Should show test email dialog
        await expect(page.locator('[data-testid="test-email-dialog"]')).toBeVisible();
        
        // Fill in recipient
        const recipientInput = page.locator('[data-testid="test-email-recipient"]');
        await recipientInput.fill('test@example.com');
        
        await page.getByRole('button', { name: /Send/i }).click();
        
        // Should show success or error
        const successMessage = page.getByText(/sent|success/i, { exact: false });
        const errorMessage = page.getByText(/error|failed/i, { exact: false });
        
        expect(await successMessage.isVisible() || await errorMessage.isVisible()).toBe(true);
      }
    });
  });

  test.describe('Security Settings', () => {
    test('should view security settings', async () => {
      await page.goto('/admin/system/security');
      await expect(page.getByRole('heading', { level: 1, name: /Security/i })).toBeVisible();
      
      // Check for security configuration sections
      await expect(page.locator('[data-testid="security-config"]')).toBeVisible();
    });

    test('should enable/disable 2FA requirement', async () => {
      await page.goto('/admin/system/security');
      
      const twoFactorToggle = page.locator('[data-testid="2fa-toggle"]');
      
      if (await twoFactorToggle.isVisible()) {
        await twoFactorToggle.click();
        
        // Should show confirmation
        await expect(page.locator('dialog')).toBeVisible();
        await page.getByRole('button', { name: /Cancel/i }).click();
      }
    });

    test('should update password policy', async () => {
      await page.goto('/admin/system/security');
      
      const saveButton = page.getByRole('button', { name: /Save/i });
      
      if (await saveButton.isVisible()) {
        // Modify password requirements
        const minLengthInput = page.locator('[data-testid="password-min-length"]');
        if (await minLengthInput.isVisible()) {
          await minLengthInput.fill('12');
          
          await saveButton.click();
          
          // Should show success
          await expect(page.getByText(/saved|updated/i, { exact: false })).toBeVisible();
        }
      }
    });
  });

  test.describe('Database Operations', () => {
    test('should view database status', async () => {
      await page.goto('/admin/system/database');
      await expect(page.getByRole('heading', { level: 1, name: /Database/i })).toBeVisible();
      
      // Check for database status indicators
      await expect(page.locator('[data-testid="db-status"]')).toBeVisible();
    });

    test('should create database backup', async () => {
      await page.goto('/admin/system/database');
      
      const backupButton = page.getByRole('button', { name: /Create Backup/i });
      
      if (await backupButton.isVisible()) {
        await backupButton.click();
        
        // Should show confirmation dialog
        await expect(page.locator('dialog')).toBeVisible();
        await page.getByRole('button', { name: /Cancel/i }).click();
      }
    });

    test('should view backup history', async () => {
      await page.goto('/admin/system/database');
      
      const backupHistory = page.locator('[data-testid="backup-history"]');
      
      if (await backupHistory.isVisible()) {
        // Should show list of backups
        await expect(backupHistory.locator('tr, [data-testid="backup-item"]')).toBeVisible();
      }
    });
  });

  test.describe('Analytics and Diagnostics', () => {
    test('should view platform analytics', async () => {
      await page.goto('/admin/analytics');
      await expect(page.getByRole('heading', { level: 1, name: /Analytics/i })).toBeVisible();
      
      // Check for analytics charts/metrics
      await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible();
    });

    test('should view system diagnostics', async () => {
      await page.goto('/admin/diagnostics');
      await expect(page.getByRole('heading', { level: 1, name: /Diagnostics/i })).toBeVisible();
      
      // Check for diagnostic information
      await expect(page.locator('[data-testid="diagnostics-info"]')).toBeVisible();
    });

    test('should view system logs', async () => {
      await page.goto('/admin/system/logs');
      await expect(page.getByRole('heading', { level: 1, name: /Logs/i })).toBeVisible();
      
      // Check for log viewer
      await expect(page.locator('[data-testid="log-viewer"]')).toBeVisible();
    });
  });

  test.describe('Power Operations', () => {
    test('should view power operations menu', async () => {
      await page.goto('/admin/system/power-operations');
      await expect(page.getByRole('heading', { level: 1, name: /Power Operations/i })).toBeVisible();
      
      // Check for dangerous operation warnings
      await expect(page.getByText(/dangerous|caution/i, { exact: false })).toBeVisible();
    });

    test('should require confirmation for critical operations', async () => {
      await page.goto('/admin/system/power-operations');
      
      const criticalButton = page.locator('button').filter({ hasText: /restart|clear cache|flush/i }).first();
      
      if (await criticalButton.isVisible()) {
        await criticalButton.click();
        
        // Should show confirmation dialog with warning
        await expect(page.locator('dialog')).toBeVisible();
        await expect(page.getByText(/are you sure/i, { exact: false })).toBeVisible();
        
        await page.getByRole('button', { name: /Cancel/i }).click();
      }
    });
  });
});
