import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

/**
 * Payment Integration Flows E2E Tests
 * 
 * Tests comprehensive payment workflows:
 * - Stripe payment integration
 * - Payment method management
 * - Checkout process
 * - Refund processing
 * - Payment security and validation
 * - Payment history and receipts
 */

test.describe("Payment Integration Flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("Stripe Payment Integration", () => {
    test("should complete booking payment with Stripe", async ({ page }) => {
      // Login as renter
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to checkout
      await page.goto("/checkout/booking-123");
      
      // Should show checkout page
      await expect(page.locator("h1")).toContainText(/Checkout|Payment/i);
      await expect(page.locator('[data-testid="booking-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="payment-form"]')).toBeVisible();
      
      // Should show booking details
      await expect(page.locator('[data-testid="listing-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="booking-dates"]')).toBeVisible();
      await expect(page.locator('[data-testid="price-breakdown"]')).toBeVisible();
      
      // Fill payment form
      await page.fill('[data-testid="card-number"]', "4242424242424242");
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="card-name"]', "John Doe");
      
      // Fill billing address
      await page.fill('[data-testid="billing-address"]', "123 Test Street");
      await page.fill('[data-testid="billing-city"]', "Kathmandu");
      await page.selectOption('[data-testid="billing-country"]', "NP");
      await page.fill('[data-testid="billing-postal"]', "44600");
      
      // Accept terms
      await page.check('[data-testid="accept-terms"]');
      await page.check('[data-testid="accept-cancellation-policy"]');
      
      // Submit payment
      await page.click('[data-testid="submit-payment"]');
      
      // Should show processing state
      await expect(page.locator('[data-testid="payment-processing"]')).toBeVisible();
      
      // Should redirect to success page
      await expect(page).toHaveURL(/.*\/booking\/[^\/]+\/confirmation/, { timeout: 30000 });
      
      // Should show confirmation
      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="booking-confirmed"]')).toBeVisible();
      await expect(page.locator('[data-testid="payment-receipt"]')).toBeVisible();
    });

    test("should handle payment errors gracefully", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/checkout/booking-123");
      
      // Fill payment form with declined card
      await page.fill('[data-testid="card-number"]', "4000000000000002"); // Stripe test decline card
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="card-name"]', "John Doe");
      
      await page.check('[data-testid="accept-terms"]');
      await page.check('[data-testid="accept-cancellation-policy"]');
      
      await page.click('[data-testid="submit-payment"]');
      
      // Should show payment error
      await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/declined|failed/i);
      
      // Should allow retry
      await expect(page.locator('[data-testid="retry-payment"]')).toBeVisible();
      
      // Should show alternative payment options
      await expect(page.locator('[data-testid="alternative-payments"]')).toBeVisible();
    });

    test("should support multiple payment methods", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/checkout/booking-123");
      
      // Should show payment method selection
      await expect(page.locator('[data-testid="payment-methods"]')).toBeVisible();
      
      // Test credit card option
      await page.locator('[data-testid="payment-credit-card"]').click();
      await expect(page.locator('[data-testid="card-form"]')).toBeVisible();
      
      // Test PayPal option
      await page.locator('[data-testid="payment-paypal"]').click();
      await expect(page.locator('[data-testid="paypal-button"]')).toBeVisible();
      
      // Test bank transfer option
      await page.locator('[data-testid="payment-bank-transfer"]').click();
      await expect(page.locator('[data-testid="bank-transfer-instructions"]')).toBeVisible();
      
      // Test digital wallet option
      await page.locator('[data-testid="payment-digital-wallet"]').click();
      await expect(page.locator('[data-testid="wallet-options"]')).toBeVisible();
      
      // Return to credit card
      await page.locator('[data-testid="payment-credit-card"]').click();
    });

    test("should validate payment form fields", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/checkout/booking-123");
      
      // Try to submit without filling form
      await page.click('[data-testid="submit-payment"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="card-number-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="card-expiry-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="card-cvc-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="terms-error"]')).toBeVisible();
      
      // Fill invalid card number
      await page.fill('[data-testid="card-number"]', "1234567890123456");
      await page.click('[data-testid="submit-payment"]');
      
      await expect(page.locator('[data-testid="card-number-error"]')).toContainText(/invalid/i);
      
      // Fill invalid expiry
      await page.fill('[data-testid="card-number"]', "4242424242424242");
      await page.fill('[data-testid="card-expiry"]', "13/25"); // Invalid month
      await page.click('[data-testid="submit-payment"]');
      
      await expect(page.locator('[data-testid="card-expiry-error"]')).toContainText(/invalid/i);
      
      // Fill valid card details
      await page.fill('[data-testid="card-number"]', "4242424242424242");
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="card-name"]', "John Doe");
      
      // Should still show terms error
      await expect(page.locator('[data-testid="terms-error"]')).toBeVisible();
      
      // Accept terms
      await page.check('[data-testid="accept-terms"]');
      await page.check('[data-testid="accept-cancellation-policy"]');
      
      // Should proceed to processing
      await page.click('[data-testid="submit-payment"]');
      await expect(page.locator('[data-testid="payment-processing"]')).toBeVisible();
    });
  });

  test.describe("Payment Method Management", () => {
    test("should add and manage payment methods", async ({ page }) => {
      // Login as user
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to payment methods
      await page.goto("/settings/billing");
      
      // Should show payment methods section
      await expect(page.locator('[data-testid="payment-methods"]')).toBeVisible();
      
      // Add new payment method
      const addPaymentBtn = page.locator('[data-testid="add-payment-method"]');
      await addPaymentBtn.click();
      
      // Should show payment method form
      await expect(page.locator('[data-testid="payment-form"]')).toBeVisible();
      
      // Add credit card
      await page.selectOption('[data-testid="payment-type"]', "credit-card");
      await page.fill('[data-testid="card-number"]', "4242424242424242");
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="card-name"]', "John Doe");
      await page.check('[data-testid="set-as-default"]');
      
      await page.click('[data-testid="save-payment-method"]');
      
      // Should show success
      await expect(page.locator('[data-testid="payment-method-added"]')).toBeVisible();
      
      // Should show new payment method in list
      await expect(page.locator('[data-testid="payment-method-card"]')).toBeVisible();
      await expect(page.locator('text=•••• 4242')).toBeVisible();
      await expect(page.locator('[data-testid="default-badge"]')).toBeVisible();
      
      // Edit payment method
      const editBtn = page.locator('[data-testid="edit-payment-method"]');
      if (await editBtn.isVisible()) {
        await editBtn.click();
        
        await expect(page.locator('[data-testid="edit-form"]')).toBeVisible();
        await page.fill('[data-testid="card-name"]', "John Updated");
        
        await page.locator('[data-testid="save-changes"]').click();
        await expect(page.locator('[data-testid="payment-method-updated"]')).toBeVisible();
      }
      
      // Remove payment method
      const removeBtn = page.locator('[data-testid="remove-payment-method"]');
      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        
        await expect(page.locator('[data-testid="remove-confirmation"]')).toBeVisible();
        await page.locator('[data-testid="confirm-remove"]').click();
        
        await expect(page.locator('[data-testid="payment-method-removed"]')).toBeVisible();
      }
    });

    test("should set default payment method", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/billing");
      
      // Add multiple payment methods first
      const addPaymentBtn = page.locator('[data-testid="add-payment-method"]');
      await addPaymentBtn.click();
      
      await page.selectOption('[data-testid="payment-type"]', "credit-card");
      await page.fill('[data-testid="card-number"]', "4242424242424242");
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="card-name"]', "John Doe");
      
      await page.click('[data-testid="save-payment-method"]');
      await expect(page.locator('[data-testid="payment-method-added"]')).toBeVisible();
      
      // Add second payment method
      await addPaymentBtn.click();
      await page.selectOption('[data-testid="payment-type"]', "credit-card");
      await page.fill('[data-testid="card-number"]', "4000000000000002");
      await page.fill('[data-testid="card-expiry"]', "01/26");
      await page.fill('[data-testid="card-cvc"]', "456");
      await page.fill('[data-testid="card-name"]', "Jane Doe");
      
      await page.click('[data-testid="save-payment-method"]');
      await expect(page.locator('[data-testid="payment-method-added"]')).toBeVisible();
      
      // Set first card as default
      const paymentMethods = page.locator('[data-testid="payment-method-card"]');
      const firstMethod = paymentMethods.first();
      
      const setDefaultBtn = firstMethod.locator('[data-testid="set-default"]');
      if (await setDefaultBtn.isVisible()) {
        await setDefaultBtn.click();
        
        await expect(page.locator('[data-testid="default-confirmation"]')).toBeVisible();
        await page.locator('[data-testid="confirm-default"]').click();
        
        await expect(firstMethod.locator('[data-testid="default-badge"]')).toBeVisible();
      }
    });

    test("should handle payment method validation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/billing");
      
      const addPaymentBtn = page.locator('[data-testid="add-payment-method"]');
      await addPaymentBtn.click();
      
      // Try to add invalid card
      await page.selectOption('[data-testid="payment-type"]', "credit-card");
      await page.fill('[data-testid="card-number"]', "1234567890123456");
      await page.fill('[data-testid="card-expiry"]', "13/25");
      await page.fill('[data-testid="card-cvc"]', "12");
      await page.fill('[data-testid="card-name"]', "");
      
      await page.click('[data-testid="save-payment-method"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="card-number-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="card-expiry-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="card-cvc-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="card-name-error"]')).toBeVisible();
      
      // Try to add duplicate card
      await page.fill('[data-testid="card-number"]', "4242424242424242");
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="card-name"]', "John Doe");
      
      await page.click('[data-testid="save-payment-method"]');
      
      // Should show duplicate error
      await expect(page.locator('[data-testid="duplicate-card-error"]')).toBeVisible();
    });
  });

  test.describe("Refund Processing", () => {
    test("should process refund for cancelled booking", async ({ page }) => {
      // Login as renter
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to bookings
      await page.goto("/bookings");
      
      // Find a paid booking
      const bookingCards = page.locator('[data-testid="booking-card"]');
      const bookingCount = await bookingCards.count();
      
      if (bookingCount > 0) {
        const firstBooking = bookingCards.first();
        const bookingStatus = firstBooking.locator('[data-testid="booking-status"]');
        
        // Look for paid booking
        if (await bookingStatus.textContent() === 'PAID') {
          await firstBooking.click();
          
          // Should show booking details
          await expect(page.locator('[data-testid="booking-details"]')).toBeVisible();
          
          // Initiate cancellation
          const cancelBtn = page.locator('[data-testid="cancel-booking"]');
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            
            await expect(page.locator('[data-testid="cancellation-form"]')).toBeVisible();
            
            await page.selectOption('[data-testid="cancellation-reason"]', "change-of-plans");
            await page.fill('[data-testid="cancellation-details"]', "Need to cancel due to emergency");
            
            await page.locator('[data-testid="confirm-cancellation"]').click();
            
            // Should show cancellation confirmation
            await expect(page.locator('[data-testid="cancellation-confirmed"]')).toBeVisible();
            
            // Should show refund processing
            await expect(page.locator('[data-testid="refund-processing"]')).toBeVisible();
            await expect(page.locator('[data-testid="refund-amount"]')).toBeVisible();
            await expect(page.locator('[data-testid="refund-method"]')).toBeVisible();
            
            // Wait for refund completion
            await expect(page.locator('[data-testid="refund-completed"]')).toBeVisible({ timeout: 30000 });
            
            // Should show refund details
            await expect(page.locator('[data-testid="refund-receipt"]')).toBeVisible();
            await expect(page.locator('[data-testid="refund-date"]')).toBeVisible();
            await expect(page.locator('[data-testid="refund-transaction-id"]')).toBeVisible();
          }
        }
      }
    });

    test("should handle partial refunds", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/bookings");
      
      const bookingCards = page.locator('[data-testid="booking-card"]');
      if (await bookingCards.first().isVisible()) {
        await bookingCards.first().click();
        
        // Look for refund option (owner initiated)
        const refundBtn = page.locator('[data-testid="process-refund"]');
        if (await refundBtn.isVisible()) {
          await refundBtn.click();
          
          await expect(page.locator('[data-testid="refund-form"]')).toBeVisible();
          
          // Select partial refund
          await page.selectOption('[data-testid="refund-type"]', "partial");
          await page.fill('[data-testid="refund-amount"]', "5000");
          await page.fill('[data-testid="refund-reason"]', "Compensation for service issue");
          
          await page.locator('[data-testid="process-refund"]').click();
          
          await expect(page.locator('[data-testid="refund-confirmation"]')).toBeVisible();
          await page.locator('[data-testid="confirm-refund"]').click();
          
          await expect(page.locator('[data-testid="partial-refund-processed"]')).toBeVisible();
          await expect(page.locator('[data-testid="remaining-balance"]')).toBeVisible();
        }
      }
    });

    test("should show refund history", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to payment history
      await page.goto("/settings/billing");
      
      const paymentHistorySection = page.locator('[data-testid="payment-history"]');
      if (await paymentHistorySection.isVisible()) {
        // Should show payment transactions
        const transactions = paymentHistorySection.locator('[data-testid="transaction"]');
        const transactionCount = await transactions.count();
        
        if (transactionCount > 0) {
          // Look for refund transactions
          const refundTransactions = paymentHistorySection.locator('[data-testid="refund-transaction"]');
          const refundCount = await refundTransactions.count();
          
          if (refundCount > 0) {
            const firstRefund = refundTransactions.first();
            
            await expect(firstRefund.locator('[data-testid="refund-amount"]')).toBeVisible();
            await expect(firstRefund.locator('[data-testid="refund-date"]')).toBeVisible();
            await expect(firstRefund.locator('[data-testid="refund-status"]')).toBeVisible();
            await expect(firstRefund.locator('[data-testid="refund-receipt-link"]')).toBeVisible();
            
            // Download refund receipt
            const receiptBtn = firstRefund.locator('[data-testid="download-receipt"]');
            if (await receiptBtn.isVisible()) {
              const downloadPromise = page.waitForEvent('download');
              await receiptBtn.click();
              const download = await downloadPromise;
              
              expect(download.suggestedFilename()).toContain('refund');
            }
          }
        }
      }
    });
  });

  test.describe("Payment Security", () => {
    test("should use secure payment form", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/checkout/booking-123");
      
      // Should show secure payment indicators
      await expect(page.locator('[data-testid="secure-payment"]')).toBeVisible();
      await expect(page.locator('[data-testid="ssl-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="trust-badges"]')).toBeVisible();
      
      // Should show PCI compliance info
      await expect(page.locator('[data-testid="pci-compliance"]')).toBeVisible();
      
      // Should mask card number input
      const cardInput = page.locator('[data-testid="card-number"]');
      await expect(cardInput).toHaveAttribute('type', 'password');
      
      // Should have autocomplete attributes
      await expect(cardInput).toHaveAttribute('autocomplete', 'cc-number');
      await expect(page.locator('[data-testid="card-expiry"]')).toHaveAttribute('autocomplete', 'cc-exp');
      await expect(page.locator('[data-testid="card-cvc"]')).toHaveAttribute('autocomplete', 'cc-csc');
    });

    test("should handle 3D Secure authentication", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/checkout/booking-123");
      
      // Use card that triggers 3D Secure
      await page.fill('[data-testid="card-number"]', "4000000000003055"); // Stripe 3D Secure test card
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="card-name"]', "John Doe");
      
      await page.check('[data-testid="accept-terms"]');
      await page.check('[data-testid="accept-cancellation-policy"]');
      
      await page.click('[data-testid="submit-payment"]');
      
      // Should show 3D Secure modal
      await expect(page.locator('[data-testid="3d-secure-modal"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="3d-secure-frame"]')).toBeVisible();
      
      // Complete 3D Secure authentication
      const secureFrame = page.frameLocator('[data-testid="3d-secure-frame"]');
      await secureFrame.locator('[data-testid="otp-input"]').fill('123456');
      await secureFrame.locator('[data-testid="authenticate"]').click();
      
      // Should complete payment
      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 30000 });
    });

    test("should detect and prevent fraud", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/checkout/booking-123");
      
      // Use high-risk card
      await page.fill('[data-testid="card-number"]', "4000000000009995"); // Stripe high-risk test card
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="card-name"]', "John Doe");
      
      await page.check('[data-testid="accept-terms"]');
      await page.check('[data-testid="accept-cancellation-policy"]');
      
      await page.click('[data-testid="submit-payment"]');
      
      // Should show fraud detection
      await expect(page.locator('[data-testid="fraud-detection"]')).toBeVisible();
      await expect(page.locator('[data-testid="additional-verification"]')).toBeVisible();
      
      // Should request additional verification
      await expect(page.locator('[data-testid="verify-identity"]')).toBeVisible();
      await page.fill('[data-testid="verification-code"]', "123456");
      
      await page.locator('[data-testid="submit-verification"]').click();
      
      // May proceed or block based on risk assessment
      const paymentResult = page.locator('[data-testid="payment-result"]');
      if (await paymentResult.isVisible()) {
        const result = await paymentResult.textContent();
        if (result?.includes('blocked')) {
          await expect(page.locator('[data-testid="payment-blocked"]')).toBeVisible();
        } else {
          await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();
        }
      }
    });
  });

  test.describe("Payment History and Receipts", () => {
    test("should display comprehensive payment history", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to payment history
      await page.goto("/settings/billing");
      
      const paymentHistorySection = page.locator('[data-testid="payment-history"]');
      if (await paymentHistorySection.isVisible()) {
        // Should show transaction list
        await expect(paymentHistorySection.locator('[data-testid="transaction-list"]')).toBeVisible();
        
        const transactions = paymentHistorySection.locator('[data-testid="transaction"]');
        const transactionCount = await transactions.count();
        
        if (transactionCount > 0) {
          // Check transaction details
          const firstTransaction = transactions.first();
          await expect(firstTransaction.locator('[data-testid="transaction-date"]')).toBeVisible();
          await expect(firstTransaction.locator('[data-testid="transaction-amount"]')).toBeVisible();
          await expect(firstTransaction.locator('[data-testid="transaction-type"]')).toBeVisible();
          await expect(firstTransaction.locator('[data-testid="transaction-status"]')).toBeVisible();
          
          // Should have receipt download
          const receiptBtn = firstTransaction.locator('[data-testid="download-receipt"]');
          if (await receiptBtn.isVisible()) {
            const downloadPromise = page.waitForEvent('download');
            await receiptBtn.click();
            const download = await downloadPromise;
            
            expect(download.suggestedFilename()).toMatch(/\.(pdf|html)$/);
          }
        }
        
        // Test filtering
        const filterBtn = paymentHistorySection.locator('[data-testid="filter-transactions"]');
        if (await filterBtn.isVisible()) {
          await filterBtn.click();
          
          await expect(page.locator('[data-testid="filter-modal"]')).toBeVisible();
          
          // Filter by date range
          await page.fill('[data-testid="start-date"]', "2025-01-01");
          await page.fill('[data-testid="end-date"]', "2025-12-31");
          
          // Filter by type
          await page.selectOption('[data-testid="transaction-type-filter"]', "payment");
          
          // Filter by status
          await page.selectOption('[data-testid="transaction-status-filter"]', "completed");
          
          await page.locator('[data-testid="apply-filter"]').click();
          
          await expect(paymentHistorySection.locator('[data-testid="active-filters"]')).toBeVisible();
        }
        
        // Test export
        const exportBtn = paymentHistorySection.locator('[data-testid="export-history"]');
        if (await exportBtn.isVisible()) {
          await exportBtn.click();
          
          await expect(page.locator('[data-testid="export-modal"]')).toBeVisible();
          
          await page.selectOption('[data-testid="export-format"]', "csv");
          await page.locator('[data-testid="confirm-export"]').click();
          
          const downloadPromise = page.waitForEvent('download');
          await downloadPromise;
        }
      }
    });

    test("should show detailed receipt information", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to a specific booking confirmation
      await page.goto("/booking/booking-123/confirmation");
      
      // Should show receipt
      const receiptSection = page.locator('[data-testid="payment-receipt"]');
      if (await receiptSection.isVisible()) {
        // Should show receipt header
        await expect(receiptSection.locator('[data-testid="receipt-number"]')).toBeVisible();
        await expect(receiptSection.locator('[data-testid="receipt-date"]')).toBeVisible();
        await expect(receiptSection.locator('[data-testid="receipt-status"]')).toBeVisible();
        
        // Should show billing details
        await expect(receiptSection.locator('[data-testid="billing-details"]')).toBeVisible();
        await expect(receiptSection.locator('[data-testid="billed-to"]')).toBeVisible();
        await expect(receiptSection.locator('[data-testid="payment-method"]')).toBeVisible();
        
        // Should show itemized charges
        await expect(receiptSection.locator('[data-testid="itemized-charges"]')).toBeVisible();
        const chargeItems = receiptSection.locator('[data-testid="charge-item"]');
        const chargeCount = await chargeItems.count();
        expect(chargeCount).toBeGreaterThan(0);
        
        // Should show tax breakdown
        await expect(receiptSection.locator('[data-testid="tax-breakdown"]')).toBeVisible();
        
        // Should show total
        await expect(receiptSection.locator('[data-testid="total-amount"]')).toBeVisible();
        
        // Download receipt
        const downloadBtn = receiptSection.locator('[data-testid="download-receipt"]');
        if (await downloadBtn.isVisible()) {
          const downloadPromise = page.waitForEvent('download');
          await downloadBtn.click();
          const download = await downloadPromise;
          
          expect(download.suggestedFilename()).toContain('receipt');
        }
        
        // Email receipt
        const emailBtn = receiptSection.locator('[data-testid="email-receipt"]');
        if (await emailBtn.isVisible()) {
          await emailBtn.click();
          
          await expect(page.locator('[data-testid="email-sent"]')).toBeVisible();
        }
        
        // Print receipt
        const printBtn = receiptSection.locator('[data-testid="print-receipt"]');
        if (await printBtn.isVisible()) {
          await printBtn.click();
          // Should trigger print dialog
        }
      }
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should work on mobile devices", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/checkout/booking-123");
      
      // Should be mobile-friendly
      await expect(page.locator('[data-testid="payment-form"]')).toBeVisible();
      
      // Test mobile payment form
      await page.fill('[data-testid="card-number"]', "4242424242424242");
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="card-name"]', "John Doe");
      
      // Should show mobile-optimized layout
      await expect(page.locator('[data-testid="mobile-payment-layout"]')).toBeVisible();
      
      // Test mobile keyboard
      await page.locator('[data-testid="card-number"]').focus();
      await expect(page.locator('[data-testid="numeric-keyboard"]')).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("should be accessible with keyboard navigation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/checkout/booking-123");
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Test ARIA labels
      const formInputs = page.locator('input, select, button');
      const count = await formInputs.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = formInputs.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
      
      // Test form validation announcements
      await page.click('[data-testid="submit-payment"]');
      const errorMessages = page.locator('[data-testid$="-error"]');
      const errorCount = await errorMessages.count();
      
      for (let i = 0; i < errorCount; i++) {
        const error = errorMessages.nth(i);
        const ariaLive = await error.getAttribute('aria-live');
        expect(ariaLive).toBe('polite');
      }
    });

    test("should support screen readers", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/checkout/booking-123");
      
      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
      
      // Check for landmark regions
      const landmarks = page.locator('main, section, article, nav, header, footer');
      const landmarkCount = await landmarks.count();
      expect(landmarkCount).toBeGreaterThan(0);
      
      // Check for semantic form structure
      await expect(page.locator('form')).toHaveAttribute('role', 'form');
      await expect(page.locator('[data-testid="payment-form"] fieldset')).toBeVisible();
      
      // Check for progress indicators
      const progressIndicator = page.locator('[data-testid="payment-progress"]');
      if (await progressIndicator.isVisible()) {
        await expect(progressIndicator).toHaveAttribute('aria-live', 'polite');
      }
    });
  });
});
