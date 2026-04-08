import { test, expect, devices } from '@playwright/test';

/**
 * MOBILE BOOKING E2E TESTS
 * 
 * These tests validate mobile-specific booking functionality:
 * - Mobile search and filtering
 * - Mobile booking creation
 * - Mobile payment flow
 * - Mobile booking management
 * - Mobile notifications
 * 
 * Business Truth Validated:
 * - Mobile users can search and book properties seamlessly
 * - Mobile booking flow is optimized for touch interactions
 * - Mobile payment processing works correctly
 * - Booking management is mobile-friendly
 * - Mobile notifications are timely and relevant
 */

test.describe('Mobile Booking Tests', () => {
  // Use mobile device configurations
  const mobileDevices = [
    { name: 'iPhone 14', ...devices['iPhone 14'] },
    { name: 'Pixel 5', ...devices['Pixel 5'] },
    { name: 'iPad', ...devices['iPad'] },
  ];

  mobileDevices.forEach(device => {
    test.describe(`${device.name} - Mobile Search and Filtering`, () => {
      test.use({ ...device });

      test('should handle mobile property search', async ({ page }) => {
        await page.goto('/search');
        
        // Check mobile search interface
        await expect(page.locator('[data-testid="mobile-search-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-search-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-search-button"]')).toBeVisible();
        
        // Test mobile search input
        await page.locator('[data-testid="mobile-search-input"]').tap();
        await expect(page.locator('[data-testid="mobile-keyboard"]')).toBeVisible();
        
        // Enter search query
        await page.locator('[data-testid="mobile-search-input"]').fill('Kathmandu');
        
        // Test search suggestions
        await expect(page.locator('[data-testid="mobile-search-suggestions"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-suggestion-item"]').first()).toBeVisible();
        
        // Select suggestion
        await page.locator('[data-testid="mobile-suggestion-item"]').first().tap();
        
        // Verify search results
        await expect(page).toHaveURL(/\/search\?location=Kathmandu/);
        await expect(page.locator('[data-testid="mobile-search-results"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-result-card"]').first()).toBeVisible();
      });

      test('should handle mobile search filters', async ({ page }) => {
        await page.goto('/search?location=Kathmandu');
        
        // Test mobile filter button
        await expect(page.locator('[data-testid="mobile-filter-button"]')).toBeVisible();
        await page.locator('[data-testid="mobile-filter-button"]').tap();
        
        // Check mobile filter interface
        await expect(page.locator('[data-testid="mobile-filter-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-filter-tabs"]')).toBeVisible();
        
        // Test price range filter
        await page.locator('[data-testid="mobile-filter-price"]').tap();
        await expect(page.locator('[data-testid="mobile-price-range"]')).toBeVisible();
        
        // Test price range slider
        await page.locator('[data-testid="mobile-min-price-slider"]').dragTo(page.locator('[data-testid="mobile-max-price-slider"]'));
        
        // Test property type filter
        await page.locator('[data-testid="mobile-filter-type"]').tap();
        await expect(page.locator('[data-testid="mobile-property-types"]')).toBeVisible();
        
        // Select property types
        await page.locator('[data-testid="mobile-type-apartment"]').tap();
        await page.locator('[data-testid="mobile-type-house"]').tap();
        
        // Test amenities filter
        await page.locator('[data-testid="mobile-filter-amenities"]').tap();
        await expect(page.locator('[data-testid="mobile-amenities-list"]')).toBeVisible();
        
        // Select amenities
        await page.locator('[data-testid="mobile-amenity-wifi"]').tap();
        await page.locator('[data-testid="mobile-amenity-parking"]').tap();
        
        // Apply filters
        await page.locator('[data-testid="mobile-apply-filters"]').tap();
        
        // Verify filtered results
        await expect(page.locator('[data-testid="mobile-filter-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-active-filters"]')).toBeVisible();
      });

      test('should handle mobile map search', async ({ page }) => {
        await page.goto('/search?location=Kathmandu');
        
        // Test mobile map view
        await expect(page.locator('[data-testid="mobile-map-toggle"]')).toBeVisible();
        await page.locator('[data-testid="mobile-map-toggle"]').tap();
        
        // Check mobile map interface
        await expect(page.locator('[data-testid="mobile-map-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-map"]')).toBeVisible();
        
        // Test map gestures
        const map = page.locator('[data-testid="mobile-map"]');
        await map.tap({ position: { x: 200, y: 200 } });
        
        // Test zoom controls
        await expect(page.locator('[data-testid="mobile-zoom-in"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-zoom-out"]')).toBeVisible();
        
        await page.locator('[data-testid="mobile-zoom-in"]').tap();
        await page.locator('[data-testid="mobile-zoom-out"]').tap();
        
        // Test location button
        await expect(page.locator('[data-testid="mobile-location-button"]')).toBeVisible();
        await page.locator('[data-testid="mobile-location-button"]').tap();
        
        // Should show location loading
        await expect(page.locator('[data-testid="mobile-location-loading"]')).toBeVisible();
        
        // Test map markers
        await expect(page.locator('[data-testid="mobile-map-marker"]').first()).toBeVisible();
        await page.locator('[data-testid="mobile-map-marker"]').first().tap();
        
        // Should show property preview
        await expect(page.locator('[data-testid="mobile-property-preview"]')).toBeVisible();
      });

      test('should handle mobile search pagination', async ({ page }) => {
        await page.goto('/search?location=Kathmandu');
        
        // Test infinite scroll
        const initialCount = await page.locator('[data-testid="mobile-result-card"]').count();
        
        // Scroll to load more
        await page.locator('[data-testid="mobile-search-results"]').scrollIntoViewIfNeeded();
        await page.waitForSelector('[data-testid="mobile-loading-more"]');
        
        // Verify more results loaded
        const newCount = await page.locator('[data-testid="mobile-result-card"]').count();
        expect(newCount).toBeGreaterThan(initialCount);
        
        // Test load more button
        await expect(page.locator('[data-testid="mobile-load-more"]')).toBeVisible();
        await page.locator('[data-testid="mobile-load-more"]').tap();
        
        // Should show loading indicator
        await expect(page.locator('[data-testid="mobile-loading-more"]')).toBeVisible();
      });
    });

    test.describe(`${device.name} - Mobile Booking Creation`, () => {
      test.use({ ...device });

      test('should handle mobile booking flow', async ({ page }) => {
        // First search for a property
        await page.goto('/search?location=Kathmandu');
        
        // Select a property
        await page.locator('[data-testid="mobile-result-card"]').first().tap();
        
        // Check mobile property details
        await expect(page.locator('[data-testid="mobile-property-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-property-gallery"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-property-info"]')).toBeVisible();
        
        // Test mobile booking form
        await expect(page.locator('[data-testid="mobile-booking-form"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-check-in-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-check-out-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-guests-input"]')).toBeVisible();
        
        // Test date selection
        await page.locator('[data-testid="mobile-check-in-input"]').tap();
        await expect(page.locator('[data-testid="mobile-date-picker"]')).toBeVisible();
        
        // Select dates
        await page.locator('[data-testid="mobile-date-2024-06-01"]').tap();
        await page.locator('[data-testid="mobile-date-2024-06-07"]').tap();
        
        // Test guest selection
        await page.locator('[data-testid="mobile-guests-input"]').tap();
        await expect(page.locator('[data-testid="mobile-guest-selector"]')).toBeVisible();
        
        // Select guests
        await page.locator('[data-testid="mobile-adults-plus"]').tap();
        await page.locator('[data-testid="mobile-children-plus"]').tap();
        
        // Test booking summary
        await expect(page.locator('[data-testid="mobile-booking-summary"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-price-breakdown"]')).toBeVisible();
        
        // Proceed to booking
        await page.locator('[data-testid="mobile-book-button"]').tap();
        
        // Should navigate to booking confirmation
        await expect(page).toHaveURL(/\/booking/);
      });

      test('should handle mobile booking confirmation', async ({ page }) => {
        await page.goto('/booking/test-booking-id');
        
        // Check mobile booking confirmation interface
        await expect(page.locator('[data-testid="mobile-booking-confirmation"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-details"]')).toBeVisible();
        
        // Test booking details
        await expect(page.locator('[data-testid="mobile-property-summary"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-dates-summary"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-guests-summary"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-price-summary"]')).toBeVisible();
        
        // Test special requests
        await expect(page.locator('[data-testid="mobile-special-requests"]')).toBeVisible();
        await page.locator('[data-testid="mobile-special-requests-input"]').fill('Early check-in requested if possible');
        
        // Test terms acceptance
        await expect(page.locator('[data-testid="mobile-terms-checkbox"]')).toBeVisible();
        await page.locator('[data-testid="mobile-terms-checkbox"]').tap();
        
        // Proceed to payment
        await page.locator('[data-testid="mobile-proceed-payment"]').tap();
        
        // Should navigate to payment
        await expect(page).toHaveURL(/\/payment/);
      });

      test('should handle mobile booking validation', async ({ page }) => {
        await page.goto('/listing/test-listing-id');
        
        // Test booking without dates
        await page.locator('[data-testid="mobile-book-button"]').tap();
        
        // Should show validation errors
        await expect(page.locator('[data-testid="mobile-validation-errors"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-dates-required"]')).toBeVisible();
        
        // Test invalid date range
        await page.locator('[data-testid="mobile-check-in-input"]').tap();
        await page.locator('[data-testid="mobile-date-2024-06-07"]').tap();
        await page.locator('[data-testid="mobile-date-2024-06-01"]').tap();
        
        await page.locator('[data-testid="mobile-book-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-invalid-date-range"]')).toBeVisible();
        
        // Test booking unavailable dates
        await page.locator('[data-testid="mobile-check-in-input"]').tap();
        await page.locator('[data-testid="mobile-date-2024-12-25"]').tap(); // Holiday
        await page.locator('[data-testid="mobile-date-2024-12-26"]').tap();
        
        await page.locator('[data-testid="mobile-book-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-dates-unavailable"]')).toBeVisible();
      });

      test('should handle mobile guest selection', async ({ page }) => {
        await page.goto('/listing/test-listing-id');
        
        // Test guest selector
        await page.locator('[data-testid="mobile-guests-input"]').tap();
        await expect(page.locator('[data-testid="mobile-guest-selector"]')).toBeVisible();
        
        // Test adult selection
        await expect(page.locator('[data-testid="mobile-adults-count"]')).toBeVisible();
        await page.locator('[data-testid="mobile-adults-plus"]').tap();
        await expect(page.locator('[data-testid="mobile-adults-count"]')).toContainText('2');
        
        // Test children selection
        await page.locator('[data-testid="mobile-children-plus"]').tap();
        await expect(page.locator('[data-testid="mobile-children-count"]')).toContainText('1');
        
        // Test infants selection
        await page.locator('[data-testid="mobile-infants-plus"]').tap();
        await expect(page.locator('[data-testid="mobile-infants-count"]')).toContainText('1');
        
        // Test guest limits
        await page.locator('[data-testid="mobile-adults-plus"]').tap(); // Add more adults
        await expect(page.locator('[data-testid="mobile-guest-limit-warning"]')).toBeVisible();
        
        // Apply guest selection
        await page.locator('[data-testid="mobile-apply-guests"]').tap();
        
        // Verify guest selection applied
        await expect(page.locator('[data-testid="mobile-guests-summary"]')).toContainText('2 Adults, 1 Child, 1 Infant');
      });
    });

    test.describe(`${device.name} - Mobile Payment Flow`, () => {
      test.use({ ...device });

      test('should handle mobile payment selection', async ({ page }) => {
        await page.goto('/payment/test-payment-id');
        
        // Check mobile payment interface
        await expect(page.locator('[data-testid="mobile-payment-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-payment-methods"]')).toBeVisible();
        
        // Test payment method options
        await expect(page.locator('[data-testid="mobile-payment-card"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-payment-apple-pay"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-payment-google-pay"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-payment-bank-transfer"]')).toBeVisible();
        
        // Test card payment
        await page.locator('[data-testid="mobile-payment-card"]').tap();
        await expect(page.locator('[data-testid="mobile-card-form"]')).toBeVisible();
        
        // Test card input fields
        await expect(page.locator('[data-testid="mobile-card-number"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-card-expiry"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-card-cvv"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-card-name"]')).toBeVisible();
        
        // Fill card details
        await page.locator('[data-testid="mobile-card-number"]').fill('4242424242424242');
        await page.locator('[data-testid="mobile-card-expiry"]').fill('12/25');
        await page.locator('[data-testid="mobile-card-cvv"]').fill('123');
        await page.locator('[data-testid="mobile-card-name"]').fill('John Doe');
        
        // Test billing address
        await expect(page.locator('[data-testid="mobile-billing-address"]')).toBeVisible();
        await page.locator('[data-testid="mobile-billing-same-as-property"]').tap();
        
        // Save card option
        await expect(page.locator('[data-testid="mobile-save-card"]')).toBeVisible();
        await page.locator('[data-testid="mobile-save-card"]').tap();
      });

      test('should handle mobile Apple Pay', async ({ page }) => {
        // Mock Apple Pay availability
        await page.addInitScript(() => {
          Object.defineProperty(window, 'ApplePaySession', {
            value: {
              supportsVersion: () => true,
              canMakePayments: () => true
            }
          });
        });
        
        await page.goto('/payment/test-payment-id');
        
        // Test Apple Pay option
        await page.locator('[data-testid="mobile-payment-apple-pay"]').tap();
        
        // Should show Apple Pay button
        await expect(page.locator('[data-testid="mobile-apple-pay-button"]')).toBeVisible();
        
        // Test Apple Pay flow
        await page.locator('[data-testid="mobile-apple-pay-button"]').tap();
        
        // Should show Apple Pay sheet
        await expect(page.locator('[data-testid="mobile-apple-pay-sheet"]')).toBeVisible();
        
        // Mock successful Apple Pay
        await page.locator('[data-testid="mobile-apple-pay-success"]').tap();
        
        // Should proceed to confirmation
        await expect(page).toHaveURL(/\/booking-confirmation/);
      });

      test('should handle mobile Google Pay', async ({ page }) => {
        // Mock Google Pay availability
        await page.addInitScript(() => {
          Object.defineProperty(window, 'google', {
            value: {
              payments: {
                api: {
                  PaymentsClient: class {
                    isReadyToPay: () => Promise.resolve({ result: true })
                  }
                }
              }
            }
          });
        });
        
        await page.goto('/payment/test-payment-id');
        
        // Test Google Pay option
        await page.locator('[data-testid="mobile-payment-google-pay"]').tap();
        
        // Should show Google Pay button
        await expect(page.locator('[data-testid="mobile-google-pay-button"]')).toBeVisible();
        
        // Test Google Pay flow
        await page.locator('[data-testid="mobile-google-pay-button"]').tap();
        
        // Should show Google Pay sheet
        await expect(page.locator('[data-testid="mobile-google-pay-sheet"]')).toBeVisible();
        
        // Mock successful Google Pay
        await page.locator('[data-testid="mobile-google-pay-success"]').tap();
        
        // Should proceed to confirmation
        await expect(page).toHaveURL(/\/booking-confirmation/);
      });

      test('should handle mobile payment validation', async ({ page }) => {
        await page.goto('/payment/test-payment-id');
        
        // Test empty card form submission
        await page.locator('[data-testid="mobile-payment-card"]').tap();
        await page.locator('[data-testid="mobile-pay-button"]').tap();
        
        // Should show validation errors
        await expect(page.locator('[data-testid="mobile-card-errors"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-card-number-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-card-expiry-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-card-cvv-error"]')).toBeVisible();
        
        // Test invalid card number
        await page.locator('[data-testid="mobile-card-number"]').fill('invalid-card');
        await page.locator('[data-testid="mobile-pay-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-card-number-error"]')).toContainText('Invalid card number');
        
        // Test invalid expiry
        await page.locator('[data-testid="mobile-card-number"]').fill('4242424242424242');
        await page.locator('[data-testid="mobile-card-expiry"]').fill('13/25'); // Invalid month
        await page.locator('[data-testid="mobile-pay-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-card-expiry-error"]')).toContainText('Invalid expiry date');
        
        // Test invalid CVV
        await page.locator('[data-testid="mobile-card-expiry"]').fill('12/25');
        await page.locator('[data-testid="mobile-card-cvv"]').fill('12');
        await page.locator('[data-testid="mobile-pay-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-card-cvv-error"]')).toContainText('Invalid CVV');
      });

      test('should handle mobile payment processing', async ({ page }) => {
        await page.goto('/payment/test-payment-id');
        
        // Fill valid card details
        await page.locator('[data-testid="mobile-payment-card"]').tap();
        await page.locator('[data-testid="mobile-card-number"]').fill('4242424242424242');
        await page.locator('[data-testid="mobile-card-expiry"]').fill('12/25');
        await page.locator('[data-testid="mobile-card-cvv"]').fill('123');
        await page.locator('[data-testid="mobile-card-name"]').fill('John Doe');
        
        // Submit payment
        await page.locator('[data-testid="mobile-pay-button"]').tap();
        
        // Should show processing indicator
        await expect(page.locator('[data-testid="mobile-payment-processing"]')).toBeVisible();
        
        // Should show payment success
        await expect(page.locator('[data-testid="mobile-payment-success"]')).toBeVisible();
        
        // Should navigate to confirmation
        await expect(page).toHaveURL(/\/booking-confirmation/);
      });
    });

    test.describe(`${device.name} - Mobile Booking Management`, () => {
      test.use({ ...device });

      test('should handle mobile booking list', async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Navigate to bookings
        await page.goto('/bookings');
        
        // Check mobile booking list interface
        await expect(page.locator('[data-testid="mobile-bookings-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-bookings-tabs"]')).toBeVisible();
        
        // Test booking tabs
        await expect(page.locator('[data-testid="mobile-tab-upcoming"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-tab-past"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-tab-cancelled"]')).toBeVisible();
        
        // Test upcoming bookings
        await page.locator('[data-testid="mobile-tab-upcoming"]').tap();
        await expect(page.locator('[data-testid="mobile-booking-card"]').first()).toBeVisible();
        
        // Test booking card information
        await expect(page.locator('[data-testid="mobile-booking-property"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-dates"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-status"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-price"]')).toBeVisible();
        
        // Test booking actions
        await expect(page.locator('[data-testid="mobile-booking-actions"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-view-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-contact-host"]')).toBeVisible();
      });

      test('should handle mobile booking details', async ({ page }) => {
        // Login and navigate to booking details
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        await page.goto('/bookings/test-booking-id');
        
        // Check mobile booking details interface
        await expect(page.locator('[data-testid="mobile-booking-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-header"]')).toBeVisible();
        
        // Test booking information
        await expect(page.locator('[data-testid="mobile-booking-property-info"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-dates-info"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-guests-info"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-price-info"]')).toBeVisible();
        
        // Test booking status
        await expect(page.locator('[data-testid="mobile-booking-status-badge"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-timeline"]')).toBeVisible();
        
        // Test booking actions
        await expect(page.locator('[data-testid="mobile-booking-actions"]')).toBeVisible();
        
        // Test different status actions
        const status = await page.locator('[data-testid="mobile-booking-status"]').textContent();
        
        if (status?.includes('confirmed')) {
          await expect(page.locator('[data-testid="mobile-cancel-booking"]')).toBeVisible();
          await expect(page.locator('[data-testid="mobile-modify-booking"]')).toBeVisible();
        }
        
        if (status?.includes('completed')) {
          await expect(page.locator('[data-testid="mobile-leave-review"]')).toBeVisible();
          await expect(page.locator('[data-testid="mobile-book-again"]')).toBeVisible();
        }
      });

      test('should handle mobile booking cancellation', async ({ page }) => {
        // Login and navigate to booking
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        await page.goto('/bookings/test-booking-id');
        
        // Test cancellation flow
        await page.locator('[data-testid="mobile-cancel-booking"]').tap();
        
        // Should show cancellation confirmation
        await expect(page.locator('[data-testid="mobile-cancel-confirmation"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-cancellation-policy"]')).toBeVisible();
        
        // Test cancellation reason
        await expect(page.locator('[data-testid="mobile-cancellation-reason"]')).toBeVisible();
        await page.locator('[data-testid="mobile-cancellation-reason-select"]').tap();
        await expect(page.locator('[data-testid="mobile-reason-options"]')).toBeVisible();
        
        // Select reason
        await page.locator('[data-testid="mobile-reason-change-of-plans"]').tap();
        
        // Test additional comments
        await expect(page.locator('[data-testid="mobile-cancellation-comments"]')).toBeVisible();
        await page.locator('[data-testid="mobile-cancellation-comments"]').fill('Need to change travel dates');
        
        // Confirm cancellation
        await page.locator('[data-testid="mobile-confirm-cancellation"]').tap();
        
        // Should show processing
        await expect(page.locator('[data-testid="mobile-cancellation-processing"]')).toBeVisible();
        
        // Should show confirmation
        await expect(page.locator('[data-testid="mobile-cancellation-success"]')).toBeVisible();
        
        // Should refund information
        await expect(page.locator('[data-testid="mobile-refund-info"]')).toBeVisible();
      });

      test('should handle mobile booking modification', async ({ page }) => {
        // Login and navigate to booking
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        await page.goto('/bookings/test-booking-id');
        
        // Test modification flow
        await page.locator('[data-testid="mobile-modify-booking"]').tap();
        
        // Should show modification options
        await expect(page.locator('[data-testid="mobile-modification-options"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-modify-dates"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-modify-guests"]')).toBeVisible();
        
        // Test date modification
        await page.locator('[data-testid="mobile-modify-dates"]').tap();
        await expect(page.locator('[data-testid="mobile-date-modifier"]')).toBeVisible();
        
        // Select new dates
        await page.locator('[data-testid="mobile-new-check-in"]').tap();
        await page.locator('[data-testid="mobile-date-2024-06-02"]').tap();
        await page.locator('[data-testid="mobile-new-check-out"]').tap();
        await page.locator('[data-testid="mobile-date-2024-06-08"]').tap();
        
        // Test price adjustment
        await expect(page.locator('[data-testid="mobile-price-adjustment"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-price-difference"]')).toBeVisible();
        
        // Confirm modification
        await page.locator('[data-testid="mobile-confirm-modification"]').tap();
        
        // Should show processing
        await expect(page.locator('[data-testid="mobile-modification-processing"]')).toBeVisible();
        
        // Should show confirmation
        await expect(page.locator('[data-testid="mobile-modification-success"]')).toBeVisible();
      });
    });

    test.describe(`${device.name} - Mobile Notifications`, () => {
      test.use({ ...device });

      test('should handle mobile booking notifications', async ({ page }) => {
        // Grant notification permissions
        await page.context().grantPermissions(['notifications']);
        
        // Login
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Navigate to dashboard
        await page.goto('/dashboard');
        
        // Test notification bell
        await expect(page.locator('[data-testid="mobile-notification-bell"]')).toBeVisible();
        await page.locator('[data-testid="mobile-notification-bell"]').tap();
        
        // Check notification dropdown
        await expect(page.locator('[data-testid="mobile-notification-dropdown"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-notification-list"]')).toBeVisible();
        
        // Test notification items
        await expect(page.locator('[data-testid="mobile-notification-item"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="mobile-notification-type"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-notification-time"]')).toBeVisible();
        
        // Test notification interaction
        await page.locator('[data-testid="mobile-notification-item"]').first().tap();
        
        // Should show notification details
        await expect(page.locator('[data-testid="mobile-notification-detail"]')).toBeVisible();
        
        // Test mark as read
        await page.locator('[data-testid="mobile-mark-read"]').tap();
        
        // Should update notification status
        await expect(page.locator('[data-testid="mobile-notification-read"]')).toBeVisible();
      });

      test('should handle mobile push notifications', async ({ page }) => {
        // Mock push notification
        await page.addInitScript(() => {
          // Simulate push notification
          const event = new MessageEvent('push', {
            data: JSON.stringify({
              type: 'booking_confirmation',
              title: 'Booking Confirmed',
              body: 'Your booking has been confirmed',
              bookingId: 'test-booking-id'
            })
          });
          
          window.dispatchEvent(event);
        });
        
        // Login
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Should show push notification
        await expect(page.locator('[data-testid="mobile-push-notification"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-notification-title"]')).toContainText('Booking Confirmed');
        await expect(page.locator('[data-testid="mobile-notification-body"]')).toContainText('Your booking has been confirmed');
        
        // Test notification actions
        await expect(page.locator('[data-testid="mobile-notification-actions"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-view-booking"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-dismiss-notification"]')).toBeVisible();
        
        // Test view booking action
        await page.locator('[data-testid="mobile-view-booking"]').tap();
        
        // Should navigate to booking details
        await expect(page).toHaveURL(/\/bookings\/test-booking-id/);
      });

      test('should handle mobile notification preferences', async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Navigate to notification settings
        await page.goto('/settings/notifications');
        
        // Check mobile notification preferences
        await expect(page.locator('[data-testid="mobile-notification-settings"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-notification-categories"]')).toBeVisible();
        
        // Test booking notifications
        await expect(page.locator('[data-testid="mobile-booking-notifications"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-confirmation"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-reminder"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-booking-cancellation"]')).toBeVisible();
        
        // Test notification toggles
        await page.locator('[data-testid="mobile-booking-confirmation"]').tap();
        await expect(page.locator('[data-testid="mobile-booking-confirmation"].enabled')).toBeVisible();
        
        // Test message notifications
        await expect(page.locator('[data-testid="mobile-message-notifications"]')).toBeVisible();
        await page.locator('[data-testid="mobile-new-messages"]').tap();
        
        // Test promotion notifications
        await expect(page.locator('[data-testid="mobile-promotion-notifications"]')).toBeVisible();
        await page.locator('[data-testid="mobile-promotional-offers"]').tap();
        
        // Save preferences
        await page.locator('[data-testid="mobile-save-preferences"]').tap();
        
        // Should show success message
        await expect(page.locator('[data-testid="mobile-preferences-saved"]')).toBeVisible();
      });
    });

    test.describe(`${device.name} - Mobile Booking Performance`, () => {
      test.use({ ...device });

      test('should handle mobile booking performance', async ({ page }) => {
        // Measure booking flow performance
        const startTime = Date.now();
        
        await page.goto('/search?location=Kathmandu');
        await page.locator('[data-testid="mobile-result-card"]').first().tap();
        await page.locator('[data-testid="mobile-check-in-input"]').tap();
        await page.locator('[data-testid="mobile-date-2024-06-01"]').tap();
        await page.locator('[data-testid="mobile-date-2024-06-07"]').tap();
        await page.locator('[data-testid="mobile-book-button"]').tap();
        
        const bookingTime = Date.now() - startTime;
        
        // Mobile booking should be fast
        expect(bookingTime).toBeLessThan(5000); // 5 seconds max
        
        // Check booking performance metrics
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          };
        });
        
        expect(metrics.loadTime).toBeLessThan(3000);
        expect(metrics.domContentLoaded).toBeLessThan(2000);
      });

      test('should handle mobile booking under poor network', async ({ page }) => {
        // Simulate slow network
        await page.route('**/*', async route => {
          await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
          await route.continue();
        });
        
        const startTime = Date.now();
        
        await page.goto('/search?location=Kathmandu');
        await page.locator('[data-testid="mobile-result-card"]').first().tap();
        
        // Should show loading indicators
        await expect(page.locator('[data-testid="mobile-booking-loading"]')).toBeVisible();
        
        await page.locator('[data-testid="mobile-check-in-input"]').tap();
        await page.locator('[data-testid="mobile-date-2024-06-01"]').tap();
        await page.locator('[data-testid="mobile-date-2024-06-07"]').tap();
        await page.locator('[data-testid="mobile-book-button"]').tap();
        
        const bookingTime = Date.now() - startTime;
        
        // Should still complete within reasonable time
        expect(bookingTime).toBeLessThan(10000); // 10 seconds max with slow network
      });
    });
  });

  test.describe('Mobile Cross-Device Booking Consistency', () => {
    test.use({ ...devices['iPhone 14'] });
    
    test('should maintain booking consistency across mobile devices', async ({ page }) => {
      // Test that booking flow works consistently across different mobile devices
      await page.goto('/search?location=Kathmandu');
      
      // Verify mobile booking interface is consistent
      const coreBookingElements = [
        '[data-testid="mobile-search-container"]',
        '[data-testid="mobile-result-card"]',
        '[data-testid="mobile-booking-form"]',
        '[data-testid="mobile-payment-methods"]',
      ];
      
      for (const selector of coreBookingElements) {
        await expect(page.locator(selector)).toBeVisible();
      }
      
      // Test basic booking flow
      await page.locator('[data-testid="mobile-result-card"]').first().tap();
      await page.locator('[data-testid="mobile-check-in-input"]').tap();
      await page.locator('[data-testid="mobile-date-2024-06-01"]').tap();
      await page.locator('[data-testid="mobile-date-2024-06-07"]').tap();
      await page.locator('[data-testid="mobile-book-button"]').tap();
      
      // Verify booking flow works
      await expect(page).toHaveURL(/\/booking/);
    });
  });
});
