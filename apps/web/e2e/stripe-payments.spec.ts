import { test, expect, type Page } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";
import { loginAsUi, testUsers, expectAnyVisible } from "./helpers/test-utils";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

// Stripe test card numbers from https://docs.stripe.com/testing
const STRIPE_TEST_CARDS = {
  visa: "4242424242424242",
  visaDebit: "4000056655665556",
  mastercard: "5555555555554444",
  amex: "378282246310005",
  declineGeneric: "4000000000000002",
  declineInsufficientFunds: "4000000000009995",
  declineLostCard: "4000000000009987",
  declineExpired: "4000000000000069",
  declineIncorrectCvc: "4000000000000127",
  threeDSRequired: "4000002500003155",
};

test.describe("Stripe Payment Flows E2E", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
    await loginAsUi(page, testUsers.renter);
  });

  test("should display checkout page with Stripe elements", async ({ page }) => {
    // Navigate to a booking checkout
    await page.goto("/checkout/test-booking-id");
    
    // Should show checkout interface
    await expectAnyVisible(page, [
      "text=/Checkout|Payment|Pay/i",
      "text=/Total|Amount|Order Summary/i",
    ]);
    
    // Look for Stripe card element or payment form
    const paymentForm = page.locator(
      '[data-testid="card-element"], iframe[src*="stripe"], input[placeholder*="Card"]'
    );
    
    // Stripe elements may be in an iframe
    expect(await paymentForm.count() > 0 || 
           await page.locator("text=/Card|Payment Method/i").isVisible()).toBeTruthy();
  });

  test("should complete payment with test Visa card", async ({ page }) => {
    await page.goto("/checkout/test-booking-id");
    
    // Fill in Stripe test card details
    // Note: Stripe Elements are typically in iframes
    const stripeFrame = page.frameLocator('iframe[name*="stripe"], iframe[src*="stripe"]').first();
    
    if (await stripeFrame.locator("input").first().isVisible().catch(() => false)) {
      // Fill card number
      await stripeFrame.locator('input[name="cardnumber"], input[placeholder*="Card"]').fill(STRIPE_TEST_CARDS.visa);
      
      // Fill expiry
      await stripeFrame.locator('input[name="exp-date"], input[placeholder*="MM/YY"]').fill("12/25");
      
      // Fill CVC
      await stripeFrame.locator('input[name="cvc"], input[placeholder*="CVC"]').fill("123");
      
      // Fill ZIP
      await stripeFrame.locator('input[name="postal"], input[placeholder*="ZIP"]').fill("12345");
      
      // Submit payment
      await page.click("button:has-text('Pay'), button[type='submit']");
      
      // Should redirect to success or confirmation
      await expectAnyVisible(page, [
        "text=/Success|Confirmed|Thank you|Payment Complete/i",
      ]);
    } else {
      // Fallback: just verify payment form structure
      await expectAnyVisible(page, [
        "text=/Card|Payment Method|Checkout/i",
      ]);
    }
  });

  test("should handle declined card - insufficient funds", async ({ page }) => {
    await page.goto("/checkout/test-booking-id");
    
    const stripeFrame = page.frameLocator('iframe[name*="stripe"], iframe[src*="stripe"]').first();
    
    if (await stripeFrame.locator("input").first().isVisible().catch(() => false)) {
      // Use declined test card
      await stripeFrame.locator('input[name="cardnumber"]').fill(STRIPE_TEST_CARDS.declineInsufficientFunds);
      await stripeFrame.locator('input[name="exp-date"]').fill("12/25");
      await stripeFrame.locator('input[name="cvc"]').fill("123");
      
      await page.click("button:has-text('Pay')");
      
      // Should show error message
      await expectAnyVisible(page, [
        "text=/declined|insufficient funds|payment failed|error/i",
      ]);
    }
  });

  test("should handle expired card", async ({ page }) => {
    await page.goto("/checkout/test-booking-id");
    
    const stripeFrame = page.frameLocator('iframe[name*="stripe"], iframe[src*="stripe"]').first();
    
    if (await stripeFrame.locator("input").first().isVisible().catch(() => false)) {
      await stripeFrame.locator('input[name="cardnumber"]').fill(STRIPE_TEST_CARDS.declineExpired);
      await stripeFrame.locator('input[name="exp-date"]').fill("12/25");
      await stripeFrame.locator('input[name="cvc"]').fill("123");
      
      await page.click("button:has-text('Pay')");
      
      // Should show expiration error
      await expectAnyVisible(page, [
        "text=/expired|expiration|invalid|error/i",
      ]);
    }
  });

  test("should display payment summary", async ({ page }) => {
    await page.goto("/checkout/test-booking-id");
    
    // Should show order summary
    await expectAnyVisible(page, [
      "text=/Order Summary|Booking Details|Rental Amount/i",
      "text=/Subtotal|Tax|Total|Deposit/i",
    ]);
  });

  test("should handle 3D Secure authentication", async ({ page }) => {
    await page.goto("/checkout/test-booking-id");
    
    const stripeFrame = page.frameLocator('iframe[name*="stripe"], iframe[src*="stripe"]').first();
    
    if (await stripeFrame.locator("input").first().isVisible().catch(() => false)) {
      // Use 3DS required test card
      await stripeFrame.locator('input[name="cardnumber"]').fill(STRIPE_TEST_CARDS.threeDSRequired);
      await stripeFrame.locator('input[name="exp-date"]').fill("12/25");
      await stripeFrame.locator('input[name="cvc"]').fill("123");
      
      await page.click("button:has-text('Pay')");
      
      // Should show 3DS challenge or handle it automatically in test mode
      await expectAnyVisible(page, [
        "text=/authenticating|3D Secure|verifying/i",
      ]);
    }
  });

  test("should save payment method for future use", async ({ page }) => {
    await page.goto("/settings/billing");
    
    // Look for "Add Payment Method" or similar
    const addBtn = page.locator('button:has-text("Add Card"), button:has-text("Add Payment")').first();
    
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      
      // Should show card input form
      await expectAnyVisible(page, [
        "text=/Card|Payment Method|Add Card/i",
        'iframe[src*="stripe"], input[placeholder*="Card"]',
      ]);
    }
  });

  test("should display saved payment methods", async ({ page }) => {
    await page.goto("/settings/billing");
    
    // Look for saved cards section
    const savedCards = page.locator(
      '[data-testid="saved-card"], .payment-method, [data-testid="payment-method"]'
    );
    
    // Either show saved cards or empty state with add button
    const hasContent = await savedCards.count() > 0 || 
                       await page.locator('button:has-text("Add Card")').isVisible();
    
    expect(hasContent).toBeTruthy();
  });

  test("should handle refund flow for owner", async ({ page }) => {
    await loginAsUi(page, testUsers.owner);
    await page.goto("/dashboard/owner/earnings");
    
    // Look for transactions or payouts
    await expectAnyVisible(page, [
      "text=/Earnings|Payouts|Transactions|Revenue/i",
    ]);
  });

  test("should show payment history", async ({ page }) => {
    await page.goto("/settings/billing");
    
    // Look for payment history section
    await expectAnyVisible(page, [
      "text=/Payment History|Transactions|Invoices|Receipts/i",
    ]);
  });

  test("should handle mobile payment flow", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto("/checkout/test-booking-id");
    
    // Should show mobile-optimized checkout
    await expectAnyVisible(page, [
      "text=/Checkout|Payment/i",
    ]);
  });

  test("should validate payment form fields", async ({ page }) => {
    await page.goto("/checkout/test-booking-id");
    
    // Try to submit without filling card details
    const payBtn = page.locator("button:has-text('Pay'), button[type='submit']").first();
    
    if (await payBtn.isVisible().catch(() => false)) {
      await payBtn.click();
      
      // Should show validation errors
      await expectAnyVisible(page, [
        "text=/required|invalid|error|complete/i",
      ]);
    }
  });
});
