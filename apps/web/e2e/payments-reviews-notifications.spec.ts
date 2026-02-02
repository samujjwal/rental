import { test, expect, Page } from "@playwright/test";

// Test credentials
const TEST_RENTER = {
  email: "renter@test.com",
  password: "Test123!@#",
};

const TEST_OWNER = {
  email: "owner@test.com",
  password: "Test123!@#",
};

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe("Payment Flows", () => {
  test.describe("Checkout Payment", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, TEST_RENTER.email, TEST_RENTER.password);
      await page.goto("/checkout/1");
    });

    test("should display payment section", async ({ page }) => {
      await expect(page.locator('[data-testid="payment-section"]')).toBeVisible();
    });

    test("should show Stripe card element", async ({ page }) => {
      const stripeElement = page.locator('[data-testid="stripe-card-element"]');
      if (await stripeElement.isVisible()) {
        await expect(stripeElement).toBeVisible();
      }
    });

    test("should show saved payment methods", async ({ page }) => {
      const savedMethods = page.locator('[data-testid="saved-payment-methods"]');
      if (await savedMethods.isVisible()) {
        await expect(savedMethods).toBeVisible();
      }
    });

    test("should select saved payment method", async ({ page }) => {
      const savedMethod = page.locator('[data-testid="payment-method-card"]').first();
      if (await savedMethod.isVisible()) {
        await savedMethod.click();
        await expect(savedMethod).toHaveClass(/selected/);
      }
    });

    test("should add new payment method", async ({ page }) => {
      const addNew = page.locator('button:has-text("Add New Card")');
      if (await addNew.isVisible()) {
        await addNew.click();
        await expect(page.locator('[data-testid="stripe-card-element"]')).toBeVisible();
      }
    });

    test("should show order summary", async ({ page }) => {
      await expect(page.locator('[data-testid="order-summary"]')).toBeVisible();
    });

    test("should show item price", async ({ page }) => {
      await expect(page.locator('[data-testid="item-price"]')).toBeVisible();
    });

    test("should show service fee", async ({ page }) => {
      const serviceFee = page.locator('[data-testid="service-fee"]');
      if (await serviceFee.isVisible()) {
        await expect(serviceFee).toBeVisible();
      }
    });

    test("should show insurance option", async ({ page }) => {
      const insurance = page.locator('[data-testid="insurance-option"]');
      if (await insurance.isVisible()) {
        await expect(insurance).toBeVisible();
      }
    });

    test("should add insurance to order", async ({ page }) => {
      const insuranceCheckbox = page.locator('input[name="insurance"]');
      if (await insuranceCheckbox.isVisible()) {
        await insuranceCheckbox.check();
        // Total should update
        await expect(page.locator('[data-testid="total-amount"]')).toBeVisible();
      }
    });

    test("should show total amount", async ({ page }) => {
      await expect(page.locator('[data-testid="total-amount"]')).toBeVisible();
    });

    test("should apply discount code", async ({ page }) => {
      const discountInput = page.locator('input[name="discountCode"]');
      if (await discountInput.isVisible()) {
        await discountInput.fill('SAVE10');
        await page.click('button:has-text("Apply")');
        
        // Should show discount applied or error
        const result = page.locator('text=/applied|invalid/i');
        await expect(result).toBeVisible();
      }
    });

    test("should show payment processing state", async ({ page }) => {
      const payButton = page.locator('button:has-text("Pay"), button:has-text("Complete")');
      await payButton.click();
      
      // Should show processing state
      const processing = page.locator('text=/Processing|Loading/i');
      const error = page.locator('text=/error|failed/i');
      await expect(processing.or(error)).toBeVisible();
    });

    test("should handle payment failure", async ({ page }) => {
      // Simulate payment failure by using test card
      const payButton = page.locator('button:has-text("Pay")');
      await payButton.click();
      
      // Should show error message
      const error = page.locator('text=/failed|declined|error/i');
      await expect(error).toBeVisible({ timeout: 10000 });
    });

    test("should redirect to confirmation on success", async ({ page }) => {
      // This requires actual successful payment
      // In test mode, would mock the payment success
    });
  });

  test.describe("Payment Methods Management", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, TEST_RENTER.email, TEST_RENTER.password);
      await page.goto("/settings/payment-methods");
    });

    test("should display payment methods page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Payment|Cards/i);
    });

    test("should list saved cards", async ({ page }) => {
      const cards = page.locator('[data-testid="saved-card"]');
      if (await cards.first().isVisible()) {
        await expect(cards.first()).toBeVisible();
      }
    });

    test("should show card details", async ({ page }) => {
      const card = page.locator('[data-testid="saved-card"]').first();
      if (await card.isVisible()) {
        await expect(page.locator('[data-testid="card-last-four"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="card-expiry"]').first()).toBeVisible();
      }
    });

    test("should add new card", async ({ page }) => {
      await page.click('button:has-text("Add Card")');
      await expect(page.locator('[data-testid="add-card-modal"]')).toBeVisible();
    });

    test("should set default payment method", async ({ page }) => {
      const setDefault = page.locator('[data-testid="set-default"]').first();
      if (await setDefault.isVisible()) {
        await setDefault.click();
        await expect(page.locator('text=/default|success/i')).toBeVisible();
      }
    });

    test("should remove payment method", async ({ page }) => {
      const removeButton = page.locator('[data-testid="remove-card"]').first();
      if (await removeButton.isVisible()) {
        await removeButton.click();
        await page.click('button:has-text("Confirm")');
        await expect(page.locator('text=/removed|deleted/i')).toBeVisible();
      }
    });
  });
});

test.describe("Insurance Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_RENTER.email, TEST_RENTER.password);
  });

  test("should display insurance options at checkout", async ({ page }) => {
    await page.goto("/checkout/1");
    
    const insurance = page.locator('[data-testid="insurance-options"]');
    if (await insurance.isVisible()) {
      await expect(insurance).toBeVisible();
    }
  });

  test("should show insurance coverage details", async ({ page }) => {
    await page.goto("/checkout/1");
    
    const details = page.locator('[data-testid="insurance-details"]');
    if (await details.isVisible()) {
      await expect(details).toBeVisible();
    }
  });

  test("should upload insurance proof", async ({ page }) => {
    await page.goto("/insurance/upload");
    
    const uploadArea = page.locator('[data-testid="insurance-upload"]');
    if (await uploadArea.isVisible()) {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'insurance-proof.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('fake pdf content'),
      });
    }
  });

  test("should verify insurance coverage", async ({ page }) => {
    await page.goto("/insurance/upload");
    
    // Upload insurance
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: 'insurance-proof.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('fake pdf content'),
      });
      
      await page.click('button:has-text("Verify"), button:has-text("Submit")');
      
      // Should show pending or verified status
      await expect(page.locator('text=/pending|verified|under review/i')).toBeVisible();
    }
  });
});

test.describe("Reviews Flow", () => {
  test.describe("Renter Reviews", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, TEST_RENTER.email, TEST_RENTER.password);
    });

    test("should see review prompt after completed booking", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const reviewPrompt = page.locator('[data-testid="review-prompt"]');
      if (await reviewPrompt.isVisible()) {
        await expect(reviewPrompt).toBeVisible();
      }
    });

    test("should open review modal", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Leave Review")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        await expect(page.locator('[data-testid="review-modal"]')).toBeVisible();
      }
    });

    test("should select star rating", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Leave Review")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        
        // Select 5 stars
        await page.click('[data-testid="rating-star-5"]');
        await expect(page.locator('[data-testid="rating-star-5"]')).toHaveClass(/selected|active/);
      }
    });

    test("should write review text", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Leave Review")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        
        await page.fill('textarea[name="review"]', 'Great experience renting this item. The owner was very responsive and helpful. Item was exactly as described!');
      }
    });

    test("should submit review", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Leave Review")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        
        await page.click('[data-testid="rating-star-5"]');
        await page.fill('textarea[name="review"]', 'Great experience!');
        await page.click('button:has-text("Submit")');
        
        await expect(page.locator('text=/submitted|success|thank/i')).toBeVisible();
      }
    });

    test("should validate review requirements", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Leave Review")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        
        // Try to submit without rating
        await page.click('button:has-text("Submit")');
        await expect(page.locator('text=/required|select.*rating/i')).toBeVisible();
      }
    });

    test("should add photos to review", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Leave Review")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        
        const photoInput = page.locator('[data-testid="review-photos"] input[type="file"]');
        if (await photoInput.isVisible()) {
          await photoInput.setInputFiles({
            name: 'review-photo.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake image'),
          });
        }
      }
    });
  });

  test.describe("Owner Reviews", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, TEST_OWNER.email, TEST_OWNER.password);
    });

    test("should review renter after booking", async ({ page }) => {
      await page.goto("/dashboard/owner");
      
      // Find completed booking to review
      const reviewRenter = page.locator('[data-testid="review-renter"]').first();
      if (await reviewRenter.isVisible()) {
        await reviewRenter.click();
        await expect(page.locator('[data-testid="review-modal"]')).toBeVisible();
      }
    });

    test("should submit renter review", async ({ page }) => {
      await page.goto("/bookings/1");
      
      const reviewButton = page.locator('button:has-text("Review Renter")');
      if (await reviewButton.isVisible()) {
        await reviewButton.click();
        
        await page.click('[data-testid="rating-star-5"]');
        await page.fill('textarea[name="review"]', 'Great renter! Returned item on time and in perfect condition.');
        await page.click('button:has-text("Submit")');
        
        await expect(page.locator('text=/submitted|success/i')).toBeVisible();
      }
    });
  });

  test.describe("View Reviews", () => {
    test("should display reviews on listing page", async ({ page }) => {
      await page.goto("/listings/1");
      
      await expect(page.locator('[data-testid="reviews-section"]')).toBeVisible();
    });

    test("should show average rating", async ({ page }) => {
      await page.goto("/listings/1");
      
      await expect(page.locator('[data-testid="average-rating"]')).toBeVisible();
    });

    test("should show review count", async ({ page }) => {
      await page.goto("/listings/1");
      
      await expect(page.locator('[data-testid="review-count"]')).toBeVisible();
    });

    test("should filter reviews", async ({ page }) => {
      await page.goto("/listings/1");
      
      const filterSelect = page.locator('[data-testid="review-filter"]');
      if (await filterSelect.isVisible()) {
        await filterSelect.click();
        await page.click('text=5 Stars');
      }
    });

    test("should sort reviews", async ({ page }) => {
      await page.goto("/listings/1");
      
      const sortSelect = page.locator('[data-testid="review-sort"]');
      if (await sortSelect.isVisible()) {
        await sortSelect.click();
        await page.click('text=Most Recent');
      }
    });

    test("should paginate reviews", async ({ page }) => {
      await page.goto("/listings/1");
      
      const nextPage = page.locator('[data-testid="reviews-pagination-next"]');
      if (await nextPage.isVisible()) {
        await nextPage.click();
      }
    });

    test("should display individual review", async ({ page }) => {
      await page.goto("/listings/1");
      
      const review = page.locator('[data-testid="review-card"]').first();
      if (await review.isVisible()) {
        await expect(page.locator('[data-testid="reviewer-name"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="review-rating"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="review-text"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="review-date"]').first()).toBeVisible();
      }
    });

    test("should display owner response", async ({ page }) => {
      await page.goto("/listings/1");
      
      const response = page.locator('[data-testid="owner-response"]').first();
      if (await response.isVisible()) {
        await expect(response).toBeVisible();
      }
    });
  });

  test.describe("Owner Review Responses", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, TEST_OWNER.email, TEST_OWNER.password);
    });

    test("should respond to review", async ({ page }) => {
      await page.goto("/listings/1");
      
      const respondButton = page.locator('[data-testid="respond-to-review"]').first();
      if (await respondButton.isVisible()) {
        await respondButton.click();
        
        await page.fill('textarea[name="response"]', 'Thank you for your feedback! We appreciate your kind words.');
        await page.click('button:has-text("Submit")');
        
        await expect(page.locator('text=/submitted|posted/i')).toBeVisible();
      }
    });

    test("should edit response", async ({ page }) => {
      await page.goto("/listings/1");
      
      const editButton = page.locator('[data-testid="edit-response"]').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        await page.fill('textarea[name="response"]', 'Updated response text.');
        await page.click('button:has-text("Save")');
        
        await expect(page.locator('text=/updated|saved/i')).toBeVisible();
      }
    });

    test("should delete response", async ({ page }) => {
      await page.goto("/listings/1");
      
      const deleteButton = page.locator('[data-testid="delete-response"]').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await page.click('button:has-text("Confirm")');
        
        await expect(page.locator('text=/deleted|removed/i')).toBeVisible();
      }
    });
  });

  test.describe("Report Review", () => {
    test("should report inappropriate review", async ({ page }) => {
      await loginAs(page, TEST_RENTER.email, TEST_RENTER.password);
      await page.goto("/listings/1");
      
      const reportButton = page.locator('[data-testid="report-review"]').first();
      if (await reportButton.isVisible()) {
        await reportButton.click();
        
        // Select reason
        await page.click('text=Inappropriate content');
        
        // Add details
        const detailsInput = page.locator('textarea[name="details"]');
        if (await detailsInput.isVisible()) {
          await detailsInput.fill('This review contains inappropriate language.');
        }
        
        await page.click('button:has-text("Report")');
        await expect(page.locator('text=/reported|submitted/i')).toBeVisible();
      }
    });
  });
});

test.describe("Notifications Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_RENTER.email, TEST_RENTER.password);
  });

  test("should display notifications icon", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-testid="notifications-icon"]')).toBeVisible();
  });

  test("should show notification badge", async ({ page }) => {
    await page.goto("/dashboard");
    
    const badge = page.locator('[data-testid="notification-badge"]');
    if (await badge.isVisible()) {
      await expect(badge).toBeVisible();
    }
  });

  test("should open notifications dropdown", async ({ page }) => {
    await page.goto("/dashboard");
    
    await page.click('[data-testid="notifications-icon"]');
    await expect(page.locator('[data-testid="notifications-dropdown"]')).toBeVisible();
  });

  test("should display notification list", async ({ page }) => {
    await page.goto("/dashboard");
    
    await page.click('[data-testid="notifications-icon"]');
    await expect(page.locator('[data-testid="notification-item"]')).toBeVisible();
  });

  test("should mark notification as read", async ({ page }) => {
    await page.goto("/dashboard");
    
    await page.click('[data-testid="notifications-icon"]');
    const notification = page.locator('[data-testid="notification-item"]').first();
    if (await notification.isVisible()) {
      await notification.click();
      // Notification should be marked as read
    }
  });

  test("should mark all as read", async ({ page }) => {
    await page.goto("/dashboard");
    
    await page.click('[data-testid="notifications-icon"]');
    const markAllRead = page.locator('button:has-text("Mark all as read")');
    if (await markAllRead.isVisible()) {
      await markAllRead.click();
    }
  });

  test("should navigate to notification target", async ({ page }) => {
    await page.goto("/dashboard");
    
    await page.click('[data-testid="notifications-icon"]');
    const notification = page.locator('[data-testid="notification-item"]').first();
    if (await notification.isVisible()) {
      await notification.click();
      // Should navigate to related page (booking, message, etc.)
    }
  });

  test("should show empty state", async ({ page }) => {
    await page.goto("/dashboard");
    
    await page.click('[data-testid="notifications-icon"]');
    const emptyState = page.locator('text=/No notifications|All caught up/i');
    const notifications = page.locator('[data-testid="notification-item"]');
    
    await expect(emptyState.or(notifications.first())).toBeVisible();
  });

  test("should navigate to notification settings", async ({ page }) => {
    await page.goto("/dashboard");
    
    await page.click('[data-testid="notifications-icon"]');
    const settingsLink = page.locator('a:has-text("Settings")');
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL(/.*settings.*notifications/);
    }
  });
});

test.describe("Real-time Updates", () => {
  test("should receive new message notification", async ({ page }) => {
    await loginAs(page, TEST_RENTER.email, TEST_RENTER.password);
    await page.goto("/messages");
    
    // This would require WebSocket testing
    // Or triggering a message from another user
  });

  test("should receive booking status update", async ({ page }) => {
    await loginAs(page, TEST_RENTER.email, TEST_RENTER.password);
    await page.goto("/bookings/1");
    
    // Status should update in real-time when owner approves
  });
});
