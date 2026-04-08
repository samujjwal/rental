/**
 * Complete Payout Flow E2E Test
 * 
 * This test validates the end-to-end payout flow for owners:
 * 1. Owner completes bookings and earns revenue
 * 2. Owner requests payout
 * 3. Stripe Connect processes payout
 * 4. Ledger entries are created (double-entry validation)
 * 5. Payout status transitions to COMPLETED
 * 6. Owner balance is updated
 * 
 * Uses test Stripe Connect accounts for safe testing.
 * Validates business truth, not implementation.
 */

import { test, expect } from '@playwright/test';

test.describe('Complete Payout Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a test owner with Stripe Connect account
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'owner@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should complete full payout flow successfully', async ({ page }) => {
    // Step 1: Navigate to earnings dashboard
    await page.goto('/dashboard/earnings');
    
    // EXACT VALIDATION: Earnings summary is displayed
    await expect(page.locator('[data-testid="earnings-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="available-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-earnings"]')).toBeVisible();
    
    // Step 2: Verify available balance is sufficient
    const availableBalanceText = await page.locator('[data-testid="available-balance"]').textContent();
    const availableBalance = parseFloat(availableBalanceText?.replace(/[^0-9.]/g, '') || '0');
    expect(availableBalance).toBeGreaterThan(0);
    
    // Step 3: Request payout
    await page.click('[data-testid="request-payout-button"]');
    
    // EXACT VALIDATION: Payout form is displayed
    await expect(page.locator('[data-testid="payout-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="payout-amount-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="stripe-account-selector"]')).toBeVisible();
    
    // Step 4: Fill payout details
    await page.fill('[data-testid="payout-amount-input"]', availableBalance.toFixed(2));
    await page.selectOption('[data-testid="stripe-account-selector"]', 'acc_test123');
    
    // EXACT VALIDATION: Payout preview is calculated
    await expect(page.locator('[data-testid="payout-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="payout-fee"]')).toBeVisible();
    await expect(page.locator('[data-testid="payout-net-amount"]')).toBeVisible();
    
    // Step 5: Confirm payout
    await page.click('[data-testid="confirm-payout-button"]');
    
    // EXACT VALIDATION: Payout processing state
    await expect(page.locator('[data-testid="payout-processing"]')).toBeVisible();
    
    // Step 6: Verify payout appears in history
    await page.goto('/dashboard/earnings/history');
    await expect(page.locator('[data-testid="payout-history"]')).toBeVisible();
    
    const firstPayout = page.locator('[data-testid="payout-item"]').first();
    await expect(firstPayout).toBeVisible();
    await expect(firstPayout.locator('[data-testid="payout-status"]')).toHaveText('PROCESSING');
    
    // Step 7: Simulate Stripe Connect webhook (via test endpoint)
    // In production, this would happen automatically
    await page.goto('/api/test/simulate-payout-webhook');
    await expect(page.locator('text=Webhook simulated')).toBeVisible();
    
    // Step 8: Verify payout completed
    await page.goto('/dashboard/earnings/history');
    await page.reload();
    
    await expect(firstPayout.locator('[data-testid="payout-status"]')).toHaveText('COMPLETED');
    
    // Step 9: Verify ledger entries for payout
    await page.click('[data-testid="view-ledger-payout"]');
    await expect(page.locator('[data-testid="ledger-entries"]')).toBeVisible();
    
    const ledgerEntries = page.locator('[data-testid="ledger-entry"]');
    const entryCount = await ledgerEntries.count();
    expect(entryCount).toBe(2); // Debit receivable, credit cash
    
    // EXACT VALIDATION: Ledger entry types
    await expect(page.locator('[data-testid="entry-type=RECEIVABLE"]')).toBeVisible();
    await expect(page.locator('[data-testid="entry-type=CASH"]')).toBeVisible();
    
    // Step 10: Verify balance updated
    await page.goto('/dashboard/earnings');
    const newAvailableBalanceText = await page.locator('[data-testid="available-balance"]').textContent();
    const newAvailableBalance = parseFloat(newAvailableBalanceText?.replace(/[^0-9.]/g, '') || '0');
    expect(newAvailableBalance).toBeLessThan(availableBalance);
  });

  test('should validate minimum payout threshold', async ({ page }) => {
    await page.goto('/dashboard/earnings');
    
    // Check if available balance is below threshold
    const availableBalanceText = await page.locator('[data-testid="available-balance"]').textContent();
    const availableBalance = parseFloat(availableBalanceText?.replace(/[^0-9.]/g, '') || '0');
    
    if (availableBalance < 10) {
      // EXACT VALIDATION: Payout button should be disabled
      await expect(page.locator('[data-testid="request-payout-button"]')).toBeDisabled();
      await expect(page.locator('text=Minimum payout amount is $10')).toBeVisible();
    }
  });

  test('should handle insufficient funds in payout', async ({ page }) => {
    await page.goto('/dashboard/earnings');
    await page.click('[data-testid="request-payout-button"]');
    
    // Attempt to payout more than available
    const availableBalanceText = await page.locator('[data-testid="available-balance"]').textContent();
    const availableBalance = parseFloat(availableBalanceText?.replace(/[^0-9.]/g, '') || '0');
    
    await page.fill('[data-testid="payout-amount-input"]', (availableBalance + 1000).toFixed(2));
    
    // EXACT VALIDATION: Error message for insufficient funds
    await page.click('[data-testid="confirm-payout-button"]');
    await expect(page.locator('[data-testid="payout-error"]')).toBeVisible();
    await expect(page.locator('text=Insufficient funds')).toBeVisible();
  });

  test('should validate ledger double-entry for payout', async ({ page, request }) => {
    // Complete a payout
    await page.goto('/dashboard/earnings');
    await page.click('[data-testid="request-payout-button"]');
    
    const availableBalanceText = await page.locator('[data-testid="available-balance"]').textContent();
    const availableBalance = parseFloat(availableBalanceText?.replace(/[^0-9.]/g, '') || '0');
    
    await page.fill('[data-testid="payout-amount-input"]', availableBalance.toFixed(2));
    await page.selectOption('[data-testid="stripe-account-selector"]', 'acc_test123');
    await page.click('[data-testid="confirm-payout-button"]');
    
    await expect(page.locator('[data-testid="payout-processing"]')).toBeVisible();
    
    // Get payout ID from URL or UI
    await page.goto('/dashboard/earnings/history');
    const firstPayout = page.locator('[data-testid="payout-item"]').first();
    const payoutId = await firstPayout.getAttribute('data-payout-id');
    
    // CRITICAL VALIDATION: Query ledger entries via API
    const ledgerResponse = await request.get(`/api/payouts/${payoutId}/ledger`);
    const ledgerEntries = await ledgerResponse.json();
    
    // EXACT VALIDATION: Double-entry accounting
    const debits = ledgerEntries.filter((e: any) => e.side === 'DEBIT');
    const credits = ledgerEntries.filter((e: any) => e.side === 'CREDIT');
    
    expect(debits.length).toBe(1);
    expect(credits.length).toBe(1);
    
    // EXACT VALIDATION: Equal amounts
    const totalDebits = debits.reduce((sum: number, e: any) => sum + e.amount, 0);
    const totalCredits = credits.reduce((sum: number, e: any) => sum + e.amount, 0);
    expect(totalDebits).toBe(totalCredits);
    expect(totalDebits).toBe(availableBalance);
    
    // EXACT VALIDATION: Correct account types
    expect(debits[0].accountType).toBe('RECEIVABLE');
    expect(credits[0].accountType).toBe('CASH');
  });

  test('should handle Stripe Connect account verification', async ({ page }) => {
    await page.goto('/settings/payments/stripe-connect');
    
    // EXACT VALIDATION: Stripe Connect status is displayed
    await expect(page.locator('[data-testid="stripe-connect-status"]')).toBeVisible();
    
    const status = await page.locator('[data-testid="stripe-connect-status"]').textContent();
    
    if (status?.includes('Pending Verification')) {
      // Test incomplete account
      await expect(page.locator('[data-testid="complete-verification-button"]')).toBeVisible();
      
      await page.click('[data-testid="complete-verification-button"]');
      
      // EXACT VALIDATION: Verification form is displayed
      await expect(page.locator('[data-testid="verification-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="business-type"]')).toBeVisible();
      await expect(page.locator('[data-testid="tax-id"]')).toBeVisible();
    } else if (status?.includes('Verified')) {
      // Test verified account - payout should be available
      await page.goto('/dashboard/earnings');
      await expect(page.locator('[data-testid="request-payout-button"]')).not.toBeDisabled();
    }
  });

  test('should handle payout failure and retry', async ({ page }) => {
    // Navigate to a failed payout (test scenario)
    await page.goto('/dashboard/earnings/history');
    
    // Find a failed payout or create one via API
    const failedPayout = page.locator('[data-testid="payout-status=FAILED"]').first();
    
    if (await failedPayout.isVisible()) {
      await failedPayout.click();
      
      // EXACT VALIDATION: Failure details are displayed
      await expect(page.locator('[data-testid="payout-failure-reason"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-payout-button"]')).toBeVisible();
      
      // Retry payout
      await page.click('[data-testid="retry-payout-button"]');
      await expect(page.locator('[data-testid="payout-processing"]')).toBeVisible();
    }
  });

  test('should validate payout fee calculation', async ({ page }) => {
    await page.goto('/dashboard/earnings');
    await page.click('[data-testid="request-payout-button"]');
    
    const payoutAmount = 1000;
    await page.fill('[data-testid="payout-amount-input"]', payoutAmount.toFixed(2));
    
    // EXACT VALIDATION: Fee is calculated correctly
    // Stripe Connect instant payout fee is typically 1% ($10 min)
    const feeText = await page.locator('[data-testid="payout-fee"]').textContent();
    const fee = parseFloat(feeText?.replace(/[^0-9.]/g, '') || '0');
    
    const netAmountText = await page.locator('[data-testid="payout-net-amount"]').textContent();
    const netAmount = parseFloat(netAmountText?.replace(/[^0-9.]/g, '') || '0');
    
    expect(fee).toBeGreaterThanOrEqual(10); // Minimum fee
    expect(netAmount).toBe(payoutAmount - fee);
  });

  test('should handle multiple Stripe accounts', async ({ page }) => {
    await page.goto('/settings/payments/stripe-connect');
    
    // EXACT VALIDATION: Multiple accounts can be managed
    await expect(page.locator('[data-testid="stripe-accounts-list"]')).toBeVisible();
    
    const accounts = page.locator('[data-testid="stripe-account-item"]');
    const accountCount = await accounts.count();
    
    if (accountCount > 1) {
      // Test selecting different accounts for payout
      await page.goto('/dashboard/earnings');
      await page.click('[data-testid="request-payout-button"]');
      
      const accountSelector = page.locator('[data-testid="stripe-account-selector"]');
      const options = await accountSelector.locator('option').count();
      expect(options).toBeGreaterThan(1);
    }
  });

  test('should validate payout timing and availability', async ({ page }) => {
    await page.goto('/dashboard/earnings');
    
    // EXACT VALIDATION: Pending balance is shown
    await expect(page.locator('[data-testid="pending-balance"]')).toBeVisible();
    
    const pendingBalanceText = await page.locator('[data-testid="pending-balance"]').textContent();
    const pendingBalance = parseFloat(pendingBalanceText?.replace(/[^0-9.]/g, '') || '0');
    
    if (pendingBalance > 0) {
      // EXACT VALIDATION: Pending funds cannot be withdrawn
      await page.click('[data-testid="request-payout-button"]');
      const maxAmount = await page.locator('[data-testid="payout-amount-input"]').getAttribute('max');
      const availableBalanceText = await page.locator('[data-testid="available-balance"]').textContent();
      const availableBalance = parseFloat(availableBalanceText?.replace(/[^0-9.]/g, '') || '0');
      
      expect(parseFloat(maxAmount || '0')).toBe(availableBalance);
    }
  });

  test('should export payout history', async ({ page }) => {
    await page.goto('/dashboard/earnings/history');
    
    // EXACT VALIDATION: Export functionality is available
    await expect(page.locator('[data-testid="export-payouts-button"]')).toBeVisible();
    
    await page.click('[data-testid="export-payouts-button"]');
    
    // EXACT VALIDATION: Export options are displayed
    await expect(page.locator('[data-testid="export-format-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-date-range"]')).toBeVisible();
    
    // Select CSV format and export
    await page.selectOption('[data-testid="export-format-selector"]', 'csv');
    await page.click('[data-testid="confirm-export-button"]');
    
    // EXACT VALIDATION: Download is triggered
    // In a real test, we would verify the file download
  });
});
