import { test, expect } from '@playwright/test';
import { PaymentPage } from '../page-objects/payments.po';

/**
 * Payment Processing E2E Test Suite
 * Comprehensive coverage for all payment scenarios including Stripe integration
 */
test.describe('Payment Processing Flow', () => {
  let paymentPage: PaymentPage;

  test.beforeEach(async ({ page }) => {
    paymentPage = new PaymentPage(page);
    
    // Login as renter
    await page.goto('/auth/login');
    await page.fill('[data-testid=email-input]', 'renter@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    await expect(page.locator('[data-testid=user-avatar]')).toBeVisible();
  });

  test('complete successful payment journey @critical', async ({ page }) => {
    await test.step('navigate to listing and initiate booking', async () => {
      await page.goto('/listings/test-listing-id');
      await expect(page.locator('[data-testid=listing-detail]')).toBeVisible();
      
      await page.click('[data-testid=book-now-button]');
      await expect(page.locator('[data-testid=booking-form]')).toBeVisible();
    });

    await test.step('select dates and view pricing', async () => {
      await page.fill('[data-testid=start-date]', '2024-06-15');
      await page.fill('[data-testid=end-date]', '2024-06-17');
      
      // Verify pricing calculation
      await expect(page.locator('[data-testid=total-price]')).toContainText('$');
      await expect(page.locator('[data-testid=price-breakdown]')).toBeVisible();
    });

    await test.step('proceed to checkout', async () => {
      await page.click('[data-testid=proceed-to-checkout]');
      await expect(page).toHaveURL(/\/checkout\//);
      await expect(page.locator('[data-testid=checkout-page]')).toBeVisible();
    });

    await test.step('verify booking summary', async () => {
      await expect(page.locator('[data-testid=booking-summary]')).toBeVisible();
      await expect(page.locator('[data-testid=listing-image]')).toBeVisible();
      await expect(page.locator('[data-testid=date-range]')).toContainText('June 15');
      await expect(page.locator('[data-testid=total-amount]')).toContainText('$');
    });

    await test.step('fill payment details', async () => {
      await paymentPage.fillPaymentForm({
        cardNumber: '4242424242424242',
        expiryDate: '12/25',
        cvv: '123',
        name: 'Test User'
      });
    });

    await test.step('complete payment and verify processing state', async () => {
      await paymentPage.completePayment();
      
      // Verify processing state appears immediately
      await expect(page.locator('[data-testid=payment-processing]')).toBeVisible();
      await expect(page.locator('[data-testid=payment-processing]')).toContainText('Processing');
      
      // Verify button is disabled during processing
      await expect(page.locator('[data-testid=complete-payment]')).toBeDisabled();
    });

    await test.step('verify payment success', async () => {
      await paymentPage.waitForPaymentSuccess();
      
      await expect(page.locator('[data-testid=payment-success]')).toBeVisible();
      await expect(page.locator('[data-testid=booking-confirmation]')).toBeVisible();
      await expect(page.locator('[data-testid=booking-id]')).toBeVisible();
      
      // Verify confirmation details
      await expect(page.locator('[data-testid=confirmation-email]')).toContainText('Confirmation email sent');
    });

    await test.step('verify booking in dashboard', async () => {
      await page.click('[data-testid=view-booking]');
      await expect(page).toHaveURL(/\/bookings\//);
      await expect(page.locator('[data-testid=booking-status]')).toContainText('confirmed');
    });
  });

  test('handles declined card gracefully @critical', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await test.step('fill declined card details', async () => {
      await paymentPage.fillPaymentForm({
        cardNumber: '4000000000000002', // Stripe test card for generic decline
        expiryDate: '12/25',
        cvv: '123',
        name: 'Test User'
      });
    });

    await test.step('submit payment and verify error', async () => {
      await paymentPage.completePayment();
      await paymentPage.waitForPaymentError();
      
      await expect(page.locator('[data-testid=payment-error]')).toBeVisible();
      await expect(page.locator('[data-testid=payment-error-title]')).toContainText('Payment Declined');
      await expect(page.locator('[data-testid=payment-error-message]')).toContainText('declined');
    });

    await test.step('verify actionable error UI', async () => {
      // Should show try another card button
      await expect(page.locator('[data-testid=try-another-card]')).toBeVisible();
      
      // Should show retry button
      await expect(page.locator('[data-testid=retry-payment]')).toBeVisible();
      
      // Should show no charges message
      await expect(page.locator('[data-testid=no-charges-message]')).toContainText('No charges');
    });

    await test.step('can retry with different card', async () => {
      await paymentPage.clickTryAnotherCard();
      
      // Form should be ready for new card
      await expect(page.locator('[data-testid=payment-form]')).toBeVisible();
      await expect(page.locator('[data-testid=payment-error]')).not.toBeVisible();
    });
  });

  test('handles insufficient funds error', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await paymentPage.fillPaymentForm({
      cardNumber: '4000000000009995', // Insufficient funds
      expiryDate: '12/25',
      cvv: '123',
      name: 'Test User'
    });

    await paymentPage.completePayment();
    await paymentPage.waitForPaymentError();

    await expect(page.locator('[data-testid=payment-error-title]')).toContainText('Insufficient Funds');
    await expect(page.locator('[data-testid=payment-error-message]')).toContainText('insufficient funds');
  });

  test('handles expired card error', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await paymentPage.fillPaymentForm({
      cardNumber: '4000000000000069', // Expired card
      expiryDate: '12/25',
      cvv: '123',
      name: 'Test User'
    });

    await paymentPage.completePayment();
    await paymentPage.waitForPaymentError();

    await expect(page.locator('[data-testid=payment-error-title]')).toContainText('Expired');
    await expect(page.locator('[data-testid=try-another-card]')).toBeVisible();
  });

  test('handles incorrect CVC error', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await paymentPage.fillPaymentForm({
      cardNumber: '4000000000000127', // Incorrect CVC
      expiryDate: '12/25',
      cvv: '123',
      name: 'Test User'
    });

    await paymentPage.completePayment();
    await paymentPage.waitForPaymentError();

    await expect(page.locator('[data-testid=payment-error-title]')).toContainText('Security Code');
    await expect(page.locator('[data-testid=payment-error-message]')).toContainText('security code');
  });

  test('prevents duplicate payment submissions @critical', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await paymentPage.fillPaymentForm({
      cardNumber: '4242424242424242',
      expiryDate: '12/25',
      cvv: '123',
      name: 'Test User'
    });

    await test.step('submit payment once', async () => {
      await paymentPage.completePayment();
      
      // Button should be disabled immediately
      await expect(page.locator('[data-testid=complete-payment]')).toBeDisabled();
    });

    await test.step('attempt duplicate submission', async () => {
      // Try clicking again
      await page.click('[data-testid=complete-payment]');
      
      // Should still show processing, not start new payment
      await expect(page.locator('[data-testid=payment-processing]')).toBeVisible();
    });

    await test.step('verify single payment processed', async () => {
      await paymentPage.waitForPaymentSuccess();
      
      // Should only show one booking confirmation
      const confirmations = await page.locator('[data-testid=booking-confirmation]').count();
      expect(confirmations).toBe(1);
    });
  });

  test('handles network errors during payment @critical', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await paymentPage.fillPaymentForm({
      cardNumber: '4242424242424242',
      expiryDate: '12/25',
      cvv: '123',
      name: 'Test User'
    });

    await test.step('block network requests', async () => {
      await page.route('**/api/payments/**', route => route.abort());
    });

    await test.step('attempt payment with network error', async () => {
      await paymentPage.completePayment();
      
      await expect(page.locator('[data-testid=network-error]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid=network-error]')).toContainText('connection');
    });

    await test.step('restore network and retry', async () => {
      await page.unroute('**/api/payments/**');
      await paymentPage.clickRetry();
      
      await paymentPage.waitForPaymentSuccess();
      await expect(page.locator('[data-testid=payment-success]')).toBeVisible();
    });
  });

  test('handles processing timeout gracefully', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await paymentPage.fillPaymentForm({
      cardNumber: '4000000000009113', // Processing error
      expiryDate: '12/25',
      cvv: '123',
      name: 'Test User'
    });

    await paymentPage.completePayment();
    await paymentPage.waitForPaymentError();

    await expect(page.locator('[data-testid=payment-error-title]')).toContainText('Processing Error');
    await expect(page.locator('[data-testid=payment-error-message]')).toContainText('try again');
    
    // Should allow retry
    await expect(page.locator('[data-testid=retry-payment]')).toBeVisible();
  });

  test('validates required payment fields', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await test.step('submit empty form', async () => {
      await page.click('[data-testid=complete-payment]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid=card-number-error]')).toContainText('required');
      await expect(page.locator('[data-testid=expiry-error]')).toContainText('required');
      await expect(page.locator('[data-testid=cvc-error]')).toContainText('required');
    });

    await test.step('validate card number format', async () => {
      await page.fill('[data-testid=card-number]', '1234');
      await page.click('[data-testid=complete-payment]');
      
      await expect(page.locator('[data-testid=card-number-error]')).toContainText('incomplete');
    });

    await test.step('validate expiry date', async () => {
      await page.fill('[data-testid=card-number]', '4242424242424242');
      await page.fill('[data-testid=expiry-date]', '12/20'); // Expired
      await page.click('[data-testid=complete-payment]');
      
      await expect(page.locator('[data-testid=expiry-error]')).toContainText('expired');
    });
  });

  test('supports 3D Secure authentication', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await paymentPage.fillPaymentForm({
      cardNumber: '4000002500003155', // Requires 3D Secure
      expiryDate: '12/25',
      cvv: '123',
      name: 'Test User'
    });

    await test.step('initiate payment with 3DS card', async () => {
      await paymentPage.completePayment();
      
      // Should show 3DS iframe
      await expect(page.locator('iframe[name^="__privateStripeFrame"]').locator('text=Authenticate')).toBeVisible({ timeout: 10000 });
    });

    await test.step('complete 3D Secure authentication', async () => {
      // Complete 3DS in iframe
      const frame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
      await frame.locator('[data-testid=complete-authentication]').click();
      
      await paymentPage.waitForPaymentSuccess();
    });
  });

  test('preserves checkout state on refresh', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    await test.step('fill partial payment form', async () => {
      await page.fill('[data-testid=cardholder-name]', 'Test User');
      await page.fill('[data-testid=card-number]', '4242424242424242');
    });

    await test.step('refresh page', async () => {
      await page.reload();
    });

    await test.step('verify state preservation', async () => {
      // Form should still have values (if implemented)
      const nameValue = await page.inputValue('[data-testid=cardholder-name]');
      expect(nameValue).toBe('Test User');
    });
  });

  test('handles currency display correctly', async ({ page }) => {
    await page.goto('/checkout/test-booking-id');

    // Verify currency formatting
    const priceText = await page.locator('[data-testid=total-amount]').textContent();
    
    // Should include currency symbol
    expect(priceText).toMatch(/[$€£¥]/);
    
    // Should have proper decimal places
    expect(priceText).toMatch(/\d+\.\d{2}/);
  });
});

export default test;
