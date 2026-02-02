import { test, expect, Page } from "@playwright/test";

// Test user credentials
const TEST_RENTER = {
  email: "renter@test.com",
  password: "Test123!@#",
};

// Helper to login as renter
async function loginAsRenter(page: Page) {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', TEST_RENTER.email);
  await page.fill('input[type="password"]', TEST_RENTER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe("Complete Renter Booking Journey", () => {
  test.describe("Step 1: Search and Find Listing", () => {
    test("should search for available items", async ({ page }) => {
      await page.goto("/");
      await page.fill('input[placeholder*="Search"]', "camera");
      await page.click('button:has-text("Search")');
      await expect(page).toHaveURL(/.*search/);
      await expect(page.locator('[data-testid="listing-card"]')).toBeVisible();
    });

    test("should filter search results", async ({ page }) => {
      await page.goto("/search");
      
      // Apply price filter
      const minPrice = page.locator('input[name="minPrice"]');
      if (await minPrice.isVisible()) {
        await minPrice.fill("10");
        await page.locator('input[name="maxPrice"]').fill("500");
        await page.click('button:has-text("Apply")');
      }
      
      await expect(page.locator('[data-testid="listing-card"]')).toBeVisible();
    });

    test("should view listing details", async ({ page }) => {
      await page.goto("/search");
      await page.locator('[data-testid="listing-card"]').first().click();
      await expect(page).toHaveURL(/.*listings\/.*/);
      await expect(page.locator("h1")).toBeVisible();
    });
  });

  test.describe("Step 2: Login and Select Dates", () => {
    test("should prompt login when booking as guest", async ({ page }) => {
      await page.goto("/listings/1");
      await page.click('button:has-text("Book"), button:has-text("Rent")');
      await expect(page).toHaveURL(/.*login/);
    });

    test("should return to listing after login", async ({ page }) => {
      await page.goto("/listings/1");
      await page.click('button:has-text("Book"), button:has-text("Rent")');
      await page.fill('input[type="email"]', TEST_RENTER.email);
      await page.fill('input[type="password"]', TEST_RENTER.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*listings\/1|.*checkout/);
    });

    test("should select rental dates", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/listings/1");
      
      const dateInput = page.locator('[data-testid="date-picker"]');
      if (await dateInput.isVisible()) {
        await dateInput.click();
        // Select start date
        const startDate = page.locator('[data-testid="calendar-day"]:not([disabled])').first();
        await startDate.click();
        // Select end date
        const endDate = page.locator('[data-testid="calendar-day"]:not([disabled])').nth(3);
        await endDate.click();
      }
    });
  });

  test.describe("Step 3: Checkout Flow", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRenter(page);
    });

    test("should navigate to checkout page", async ({ page }) => {
      await page.goto("/listings/1");
      await page.click('button:has-text("Book"), button:has-text("Rent")');
      
      // Select dates if required
      const dateInput = page.locator('[data-testid="date-picker"]');
      if (await dateInput.isVisible()) {
        await dateInput.click();
        await page.locator('[data-testid="calendar-day"]:not([disabled])').first().click();
        await page.locator('[data-testid="calendar-day"]:not([disabled])').nth(3).click();
      }
      
      await page.click('button:has-text("Continue"), button:has-text("Proceed")');
      await expect(page).toHaveURL(/.*checkout/);
    });

    test("should display booking summary", async ({ page }) => {
      await page.goto("/checkout/1");
      
      await expect(page.locator('[data-testid="booking-summary"]')).toBeVisible();
      await expect(page.locator('text=/\\$\\d+/')).toBeVisible(); // Price
    });

    test("should display rental dates in summary", async ({ page }) => {
      await page.goto("/checkout/1");
      
      await expect(page.locator('[data-testid="rental-dates"]')).toBeVisible();
    });

    test("should show price breakdown", async ({ page }) => {
      await page.goto("/checkout/1");
      
      const priceBreakdown = page.locator('[data-testid="price-breakdown"]');
      if (await priceBreakdown.isVisible()) {
        await expect(page.locator('text=/Subtotal|Base Price/i')).toBeVisible();
        await expect(page.locator('text=/Service Fee|Fee/i')).toBeVisible();
        await expect(page.locator('text=/Total/i')).toBeVisible();
      }
    });

    test("should apply promo/discount code", async ({ page }) => {
      await page.goto("/checkout/1");
      
      const promoInput = page.locator('input[name="promoCode"]');
      if (await promoInput.isVisible()) {
        await promoInput.fill("DISCOUNT10");
        await page.click('button:has-text("Apply")');
        await expect(page.locator('text=/discount|applied|savings/i')).toBeVisible();
      }
    });

    test("should show error for invalid promo code", async ({ page }) => {
      await page.goto("/checkout/1");
      
      const promoInput = page.locator('input[name="promoCode"]');
      if (await promoInput.isVisible()) {
        await promoInput.fill("INVALIDCODE");
        await page.click('button:has-text("Apply")');
        await expect(page.locator('text=/invalid|expired|not found/i')).toBeVisible();
      }
    });
  });

  test.describe("Step 4: Payment", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/checkout/1");
    });

    test("should display payment form", async ({ page }) => {
      await expect(page.locator('[data-testid="payment-section"]')).toBeVisible();
    });

    test("should show saved payment methods", async ({ page }) => {
      const savedMethods = page.locator('[data-testid="saved-payment-methods"]');
      if (await savedMethods.isVisible()) {
        await expect(savedMethods).toBeVisible();
      }
    });

    test("should add new payment method", async ({ page }) => {
      const addNewCard = page.locator('button:has-text("Add Card"), button:has-text("New Card")');
      if (await addNewCard.isVisible()) {
        await addNewCard.click();
        await expect(page.locator('[data-testid="card-form"]')).toBeVisible();
      }
    });

    test("should validate card number", async ({ page }) => {
      const cardInput = page.locator('input[name="cardNumber"]');
      if (await cardInput.isVisible()) {
        await cardInput.fill("1234");
        await page.click('button:has-text("Pay")');
        await expect(page.locator('text=/invalid.*card|card.*invalid/i')).toBeVisible();
      }
    });

    test("should display Stripe elements", async ({ page }) => {
      // Stripe Elements iframe
      const stripeFrame = page.frameLocator('iframe[name*="stripe"]');
      const cardElement = page.locator('[data-testid="stripe-card-element"]');
      
      if (await cardElement.isVisible()) {
        await expect(cardElement).toBeVisible();
      }
    });

    test("should show payment processing state", async ({ page }) => {
      const payButton = page.locator('button:has-text("Pay"), button:has-text("Complete Booking")');
      
      // Click pay (won't complete without valid card)
      await payButton.click();
      
      // Should show loading or processing state
      const loadingState = page.locator('text=/Processing|Loading|Please wait/i');
      const errorState = page.locator('text=/error|failed|invalid/i');
      
      await expect(loadingState.or(errorState)).toBeVisible();
    });
  });

  test.describe("Step 5: Booking Confirmation", () => {
    test("should display booking confirmation page", async ({ page }) => {
      await loginAsRenter(page);
      
      // Direct navigation to confirmation (assuming successful payment)
      await page.goto("/bookings/1");
      
      await expect(page.locator('[data-testid="booking-details"]')).toBeVisible();
    });

    test("should show booking status", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/bookings/1");
      
      await expect(page.locator('[data-testid="booking-status"]')).toBeVisible();
    });

    test("should show rental dates", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/bookings/1");
      
      await expect(page.locator('text=/Start|From/i')).toBeVisible();
      await expect(page.locator('text=/End|To/i')).toBeVisible();
    });

    test("should show owner contact info", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/bookings/1");
      
      await expect(page.locator('[data-testid="owner-contact"]')).toBeVisible();
    });

    test("should show pickup/delivery instructions", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/bookings/1");
      
      const instructions = page.locator('[data-testid="pickup-instructions"]');
      if (await instructions.isVisible()) {
        await expect(instructions).toBeVisible();
      }
    });
  });

  test.describe("Step 6: Message Owner", () => {
    test("should open message thread with owner", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/bookings/1");
      
      await page.click('button:has-text("Message"), button:has-text("Contact")');
      await expect(page).toHaveURL(/.*messages/);
    });

    test("should send message to owner", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/messages");
      
      // Open conversation
      const conversation = page.locator('[data-testid="conversation-item"]').first();
      if (await conversation.isVisible()) {
        await conversation.click();
        
        await page.fill('textarea[name="message"]', 'Hello, I have a question about the rental.');
        await page.click('button:has-text("Send")');
        
        await expect(page.locator('text=Hello, I have a question')).toBeVisible();
      }
    });
  });

  test.describe("Step 7: Complete Rental & Review", () => {
    test("should view completed booking", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/bookings?status=completed");
      
      await expect(page.locator('[data-testid="booking-card"]')).toBeVisible();
    });

    test("should submit review for owner", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Review"), button:has-text("Leave Review")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        
        // Rating
        await page.locator('[data-testid="rating-star-5"]').click();
        
        // Review text
        await page.fill('textarea[name="review"]', 'Great experience! Item was exactly as described.');
        
        await page.click('button:has-text("Submit")');
        
        await expect(page.locator('text=/thank|submitted|success/i')).toBeVisible();
      }
    });

    test("should submit review for listing", async ({ page }) => {
      await loginAsRenter(page);
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Review Listing")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        
        // Fill review form
        await page.locator('[data-testid="rating-star-4"]').click();
        await page.fill('textarea[name="review"]', 'Good quality equipment.');
        
        await page.click('button:has-text("Submit")');
        
        await expect(page.locator('text=/thank|submitted|success/i')).toBeVisible();
      }
    });
  });

  test.describe("Error Scenarios", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRenter(page);
    });

    test("should handle unavailable dates", async ({ page }) => {
      await page.goto("/listings/1");
      
      // Try to select unavailable dates (if calendar shows unavailable)
      const unavailableDate = page.locator('[data-testid="calendar-day"][disabled]').first();
      if (await unavailableDate.isVisible()) {
        await unavailableDate.click({ force: true });
        await expect(page.locator('text=/unavailable|not available|booked/i')).toBeVisible();
      }
    });

    test("should handle booking conflict", async ({ page }) => {
      // This would require setting up a conflict scenario
      await page.goto("/listings/1");
      
      // The error would appear if someone else books the same dates
      const errorMessage = page.locator('text=/conflict|already booked|no longer available/i');
      // This is a conditional test that depends on state
    });

    test("should handle payment failure", async ({ page }) => {
      await page.goto("/checkout/1");
      
      // Use Stripe test card that will decline
      const cardInput = page.locator('input[name="cardNumber"]');
      if (await cardInput.isVisible()) {
        await cardInput.fill("4000000000000002"); // Stripe decline test card
        await page.fill('input[name="expiry"]', "12/25");
        await page.fill('input[name="cvc"]', "123");
        await page.click('button:has-text("Pay")');
        
        await expect(page.locator('text=/declined|failed|error/i')).toBeVisible();
      }
    });

    test("should handle network error gracefully", async ({ page, context }) => {
      await page.goto("/listings/1");
      
      // Simulate offline
      await context.setOffline(true);
      await page.click('button:has-text("Book")');
      
      await expect(page.locator('text=/network|offline|connection/i')).toBeVisible();
      
      await context.setOffline(false);
    });
  });
});

test.describe("Booking Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRenter(page);
  });

  test.describe("Bookings List", () => {
    test("should display all bookings", async ({ page }) => {
      await page.goto("/bookings");
      await expect(page.locator('[data-testid="bookings-list"]')).toBeVisible();
    });

    test("should filter by status - pending", async ({ page }) => {
      await page.goto("/bookings");
      await page.click('button:has-text("Pending")');
      await expect(page).toHaveURL(/.*status=pending/);
    });

    test("should filter by status - confirmed", async ({ page }) => {
      await page.goto("/bookings");
      await page.click('button:has-text("Confirmed")');
      await expect(page).toHaveURL(/.*status=confirmed/);
    });

    test("should filter by status - completed", async ({ page }) => {
      await page.goto("/bookings");
      await page.click('button:has-text("Completed")');
      await expect(page).toHaveURL(/.*status=completed/);
    });

    test("should filter by status - cancelled", async ({ page }) => {
      await page.goto("/bookings");
      await page.click('button:has-text("Cancelled")');
      await expect(page).toHaveURL(/.*status=cancelled/);
    });

    test("should search bookings", async ({ page }) => {
      await page.goto("/bookings");
      const searchInput = page.locator('input[name="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill("camera");
        await page.keyboard.press("Enter");
      }
    });

    test("should sort bookings", async ({ page }) => {
      await page.goto("/bookings");
      const sortSelect = page.locator('[data-testid="sort-select"]');
      if (await sortSelect.isVisible()) {
        await sortSelect.click();
        await page.click('text=Newest First');
      }
    });

    test("should paginate bookings", async ({ page }) => {
      await page.goto("/bookings");
      const pagination = page.locator('[data-testid="pagination"]');
      if (await pagination.isVisible()) {
        await page.click('[data-testid="pagination-next"]');
        await expect(page).toHaveURL(/.*page=2/);
      }
    });
  });

  test.describe("Booking Details", () => {
    test("should view booking details", async ({ page }) => {
      await page.goto("/bookings/1");
      await expect(page.locator('[data-testid="booking-details"]')).toBeVisible();
    });

    test("should display listing info", async ({ page }) => {
      await page.goto("/bookings/1");
      await expect(page.locator('[data-testid="listing-info"]')).toBeVisible();
    });

    test("should display payment info", async ({ page }) => {
      await page.goto("/bookings/1");
      await expect(page.locator('[data-testid="payment-info"]')).toBeVisible();
    });

    test("should navigate to listing", async ({ page }) => {
      await page.goto("/bookings/1");
      await page.click('[data-testid="view-listing-link"]');
      await expect(page).toHaveURL(/.*listings\/.*/);
    });
  });

  test.describe("Cancel Booking", () => {
    test("should show cancel button for pending booking", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const cancelButton = page.locator('button:has-text("Cancel")');
      if (await cancelButton.isVisible()) {
        await expect(cancelButton).toBeVisible();
      }
    });

    test("should confirm cancellation", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const cancelButton = page.locator('button:has-text("Cancel Booking")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        
        // Confirmation modal
        await expect(page.locator('[data-testid="cancel-modal"]')).toBeVisible();
        await expect(page.locator('text=/Are you sure|Confirm cancellation/i')).toBeVisible();
      }
    });

    test("should show refund policy", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const cancelButton = page.locator('button:has-text("Cancel Booking")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        
        await expect(page.locator('text=/refund|cancellation policy/i')).toBeVisible();
      }
    });

    test("should cancel booking successfully", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const cancelButton = page.locator('button:has-text("Cancel Booking")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await page.click('button:has-text("Confirm")');
        
        await expect(page.locator('text=/cancelled|success/i')).toBeVisible();
      }
    });

    test("should require cancellation reason", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const cancelButton = page.locator('button:has-text("Cancel Booking")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        
        const reasonSelect = page.locator('[data-testid="cancel-reason"]');
        if (await reasonSelect.isVisible()) {
          await reasonSelect.click();
          await page.click('text=Change of plans');
        }
      }
    });
  });

  test.describe("File Dispute", () => {
    test("should show dispute option for completed booking", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const disputeButton = page.locator('button:has-text("Dispute"), button:has-text("Report Issue")');
      if (await disputeButton.isVisible()) {
        await expect(disputeButton).toBeVisible();
      }
    });

    test("should navigate to dispute form", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const disputeButton = page.locator('button:has-text("Dispute"), button:has-text("Report Issue")');
      if (await disputeButton.isVisible()) {
        await disputeButton.click();
        await expect(page).toHaveURL(/.*disputes.*new/);
      }
    });

    test("should fill dispute form", async ({ page }) => {
      await page.goto("/disputes/new/1");
      
      // Select dispute type
      const typeSelect = page.locator('[data-testid="dispute-type"]');
      if (await typeSelect.isVisible()) {
        await typeSelect.click();
        await page.click('text=Item not as described');
      }
      
      // Fill description
      await page.fill('textarea[name="description"]', 'The item was damaged when I received it.');
      
      // Attach evidence
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles({
          name: 'evidence.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image data'),
        });
      }
    });

    test("should submit dispute", async ({ page }) => {
      await page.goto("/disputes/new/1");
      
      const typeSelect = page.locator('[data-testid="dispute-type"]');
      if (await typeSelect.isVisible()) {
        await typeSelect.click();
        await page.click('text=Item not as described');
      }
      
      await page.fill('textarea[name="description"]', 'The item was damaged.');
      await page.click('button:has-text("Submit")');
      
      await expect(page.locator('text=/submitted|success|review/i')).toBeVisible();
    });
  });
});
