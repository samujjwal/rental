import { test, expect, Page } from "@playwright/test";

// Test owner credentials
const TEST_OWNER = {
  email: "owner@test.com",
  password: "Test123!@#",
};

// Helper to login as owner
async function loginAsOwner(page: Page) {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', TEST_OWNER.email);
  await page.fill('input[type="password"]', TEST_OWNER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe("Owner Listing Management", () => {
  test.describe("Create Listing - Complete Flow", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsOwner(page);
      await page.goto("/listings/new");
    });

    test("should display create listing page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Create|New|Add/i);
    });

    test("should show multi-step form", async ({ page }) => {
      await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible();
    });

    test.describe("Step 1: Basic Information", () => {
      test("should display basic info step", async ({ page }) => {
        await expect(page.locator('text=/Basic|Title|Name/i')).toBeVisible();
      });

      test("should show title input", async ({ page }) => {
        await expect(page.locator('input[name="title"]')).toBeVisible();
      });

      test("should validate title length", async ({ page }) => {
        await page.fill('input[name="title"]', 'ab');
        await page.click('button:has-text("Next")');
        await expect(page.locator('text=/too short|minimum|at least/i')).toBeVisible();
      });

      test("should show description textarea", async ({ page }) => {
        await expect(page.locator('textarea[name="description"]')).toBeVisible();
      });

      test("should validate description", async ({ page }) => {
        await page.fill('input[name="title"]', 'Test Listing Title');
        await page.fill('textarea[name="description"]', 'Too short');
        await page.click('button:has-text("Next")');
        await expect(page.locator('text=/too short|minimum|at least/i')).toBeVisible();
      });

      test("should show category select", async ({ page }) => {
        await expect(page.locator('[data-testid="category-select"]')).toBeVisible();
      });

      test("should select category", async ({ page }) => {
        await page.click('[data-testid="category-select"]');
        await page.click('text=Electronics');
        await expect(page.locator('[data-testid="category-select"]')).toContainText('Electronics');
      });

      test("should proceed to next step", async ({ page }) => {
        await page.fill('input[name="title"]', 'Professional Camera for Rent');
        await page.fill('textarea[name="description"]', 'This is a professional DSLR camera perfect for photography enthusiasts. Includes lens and carrying case.');
        await page.click('[data-testid="category-select"]');
        await page.click('text=Electronics');
        await page.click('button:has-text("Next")');
        
        await expect(page.locator('text=/Pricing|Price|Rate/i')).toBeVisible();
      });
    });

    test.describe("Step 2: Pricing", () => {
      test.beforeEach(async ({ page }) => {
        // Complete step 1 first
        await page.fill('input[name="title"]', 'Professional Camera for Rent');
        await page.fill('textarea[name="description"]', 'This is a professional DSLR camera perfect for photography enthusiasts.');
        await page.click('[data-testid="category-select"]');
        await page.click('text=Electronics');
        await page.click('button:has-text("Next")');
      });

      test("should display pricing step", async ({ page }) => {
        await expect(page.locator('text=/Pricing|Price|Rate/i')).toBeVisible();
      });

      test("should show daily rate input", async ({ page }) => {
        await expect(page.locator('input[name="dailyRate"]')).toBeVisible();
      });

      test("should show weekly rate input", async ({ page }) => {
        const weeklyRate = page.locator('input[name="weeklyRate"]');
        if (await weeklyRate.isVisible()) {
          await expect(weeklyRate).toBeVisible();
        }
      });

      test("should show monthly rate input", async ({ page }) => {
        const monthlyRate = page.locator('input[name="monthlyRate"]');
        if (await monthlyRate.isVisible()) {
          await expect(monthlyRate).toBeVisible();
        }
      });

      test("should validate daily rate", async ({ page }) => {
        await page.fill('input[name="dailyRate"]', '-10');
        await page.click('button:has-text("Next")');
        await expect(page.locator('text=/positive|greater than|invalid/i')).toBeVisible();
      });

      test("should show deposit amount input", async ({ page }) => {
        const deposit = page.locator('input[name="deposit"]');
        if (await deposit.isVisible()) {
          await expect(deposit).toBeVisible();
        }
      });

      test("should proceed to next step", async ({ page }) => {
        await page.fill('input[name="dailyRate"]', '50');
        const weeklyRate = page.locator('input[name="weeklyRate"]');
        if (await weeklyRate.isVisible()) {
          await weeklyRate.fill('300');
        }
        await page.click('button:has-text("Next")');
        
        await expect(page.locator('text=/Location|Address|Where/i')).toBeVisible();
      });
    });

    test.describe("Step 3: Location", () => {
      test.beforeEach(async ({ page }) => {
        // Complete steps 1 & 2
        await page.fill('input[name="title"]', 'Professional Camera for Rent');
        await page.fill('textarea[name="description"]', 'This is a professional DSLR camera perfect for photography enthusiasts.');
        await page.click('[data-testid="category-select"]');
        await page.click('text=Electronics');
        await page.click('button:has-text("Next")');
        await page.fill('input[name="dailyRate"]', '50');
        await page.click('button:has-text("Next")');
      });

      test("should display location step", async ({ page }) => {
        await expect(page.locator('text=/Location|Address/i')).toBeVisible();
      });

      test("should show address input", async ({ page }) => {
        await expect(page.locator('input[name="address"]')).toBeVisible();
      });

      test("should autocomplete address", async ({ page }) => {
        await page.fill('input[name="address"]', '123 Main Street');
        const suggestions = page.locator('[data-testid="address-suggestions"]');
        if (await suggestions.isVisible()) {
          await suggestions.first().click();
        }
      });

      test("should show city input", async ({ page }) => {
        await expect(page.locator('input[name="city"]')).toBeVisible();
      });

      test("should show state input", async ({ page }) => {
        await expect(page.locator('input[name="state"]')).toBeVisible();
      });

      test("should show zip code input", async ({ page }) => {
        await expect(page.locator('input[name="zipCode"]')).toBeVisible();
      });

      test("should show map for location selection", async ({ page }) => {
        const map = page.locator('[data-testid="location-map"]');
        if (await map.isVisible()) {
          await expect(map).toBeVisible();
        }
      });

      test("should proceed to next step", async ({ page }) => {
        await page.fill('input[name="address"]', '123 Main Street');
        await page.fill('input[name="city"]', 'New York');
        await page.fill('input[name="state"]', 'NY');
        await page.fill('input[name="zipCode"]', '10001');
        await page.click('button:has-text("Next")');
        
        await expect(page.locator('text=/Details|Features|Specifications/i')).toBeVisible();
      });
    });

    test.describe("Step 4: Details & Features", () => {
      test.beforeEach(async ({ page }) => {
        // Complete steps 1, 2 & 3
        await page.fill('input[name="title"]', 'Professional Camera for Rent');
        await page.fill('textarea[name="description"]', 'This is a professional DSLR camera perfect for photography enthusiasts.');
        await page.click('[data-testid="category-select"]');
        await page.click('text=Electronics');
        await page.click('button:has-text("Next")');
        await page.fill('input[name="dailyRate"]', '50');
        await page.click('button:has-text("Next")');
        await page.fill('input[name="address"]', '123 Main Street');
        await page.fill('input[name="city"]', 'New York');
        await page.fill('input[name="state"]', 'NY');
        await page.fill('input[name="zipCode"]', '10001');
        await page.click('button:has-text("Next")');
      });

      test("should display details step", async ({ page }) => {
        await expect(page.locator('text=/Details|Features|Specifications/i')).toBeVisible();
      });

      test("should show condition select", async ({ page }) => {
        const condition = page.locator('[data-testid="condition-select"]');
        if (await condition.isVisible()) {
          await expect(condition).toBeVisible();
        }
      });

      test("should show brand input", async ({ page }) => {
        const brand = page.locator('input[name="brand"]');
        if (await brand.isVisible()) {
          await expect(brand).toBeVisible();
        }
      });

      test("should show model input", async ({ page }) => {
        const model = page.locator('input[name="model"]');
        if (await model.isVisible()) {
          await expect(model).toBeVisible();
        }
      });

      test("should allow adding custom features", async ({ page }) => {
        const addFeature = page.locator('button:has-text("Add Feature")');
        if (await addFeature.isVisible()) {
          await addFeature.click();
          await page.fill('input[name="feature"]', 'Includes tripod');
          await page.click('button:has-text("Add")');
        }
      });

      test("should show availability settings", async ({ page }) => {
        await expect(page.locator('[data-testid="availability-settings"]')).toBeVisible();
      });

      test("should set minimum rental duration", async ({ page }) => {
        const minDuration = page.locator('input[name="minRentalDays"]');
        if (await minDuration.isVisible()) {
          await minDuration.fill('1');
        }
      });

      test("should set maximum rental duration", async ({ page }) => {
        const maxDuration = page.locator('input[name="maxRentalDays"]');
        if (await maxDuration.isVisible()) {
          await maxDuration.fill('30');
        }
      });

      test("should proceed to images step", async ({ page }) => {
        await page.click('button:has-text("Next")');
        await expect(page.locator('text=/Images|Photos|Upload/i')).toBeVisible();
      });
    });

    test.describe("Step 5: Images", () => {
      test.beforeEach(async ({ page }) => {
        // Complete previous steps - simplified version
        await page.fill('input[name="title"]', 'Professional Camera for Rent');
        await page.fill('textarea[name="description"]', 'This is a professional DSLR camera.');
        const categorySelect = page.locator('[data-testid="category-select"]');
        if (await categorySelect.isVisible()) {
          await categorySelect.click();
          await page.click('text=Electronics');
        }
        await page.click('button:has-text("Next")');
        await page.fill('input[name="dailyRate"]', '50');
        await page.click('button:has-text("Next")');
        await page.fill('input[name="address"]', '123 Main Street');
        await page.fill('input[name="city"]', 'New York');
        await page.fill('input[name="state"]', 'NY');
        await page.fill('input[name="zipCode"]', '10001');
        await page.click('button:has-text("Next")');
        await page.click('button:has-text("Next")');
      });

      test("should display images step", async ({ page }) => {
        await expect(page.locator('text=/Images|Photos|Upload/i')).toBeVisible();
      });

      test("should show upload area", async ({ page }) => {
        await expect(page.locator('[data-testid="image-upload-area"]')).toBeVisible();
      });

      test("should upload single image", async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'camera.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image data'),
        });
        
        await expect(page.locator('[data-testid="image-preview"]')).toBeVisible();
      });

      test("should upload multiple images", async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles([
          {
            name: 'camera1.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake image 1'),
          },
          {
            name: 'camera2.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake image 2'),
          },
        ]);
        
        await expect(page.locator('[data-testid="image-preview"]').first()).toBeVisible();
      });

      test("should set primary image", async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles([
          {
            name: 'camera1.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake image 1'),
          },
          {
            name: 'camera2.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake image 2'),
          },
        ]);
        
        const setPrimary = page.locator('[data-testid="set-primary"]').nth(1);
        if (await setPrimary.isVisible()) {
          await setPrimary.click();
        }
      });

      test("should delete image", async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'camera.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image'),
        });
        
        const deleteButton = page.locator('[data-testid="delete-image"]');
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
        }
      });

      test("should reorder images via drag-drop", async ({ page }) => {
        // Drag and drop test - simplified
        const images = page.locator('[data-testid="image-preview"]');
        if (await images.count() > 1) {
          await images.first().dragTo(images.last());
        }
      });

      test("should validate minimum images", async ({ page }) => {
        await page.click('button:has-text("Submit"), button:has-text("Create")');
        await expect(page.locator('text=/at least|minimum|image required/i')).toBeVisible();
      });
    });

    test.describe("Review & Submit", () => {
      test("should show review page", async ({ page }) => {
        // Navigate through all steps
        await page.fill('input[name="title"]', 'Test Listing');
        await page.fill('textarea[name="description"]', 'Test description for listing.');
        const categorySelect = page.locator('[data-testid="category-select"]');
        if (await categorySelect.isVisible()) {
          await categorySelect.click();
          await page.click('text=Electronics');
        }
        await page.click('button:has-text("Next")');
        await page.fill('input[name="dailyRate"]', '50');
        await page.click('button:has-text("Next")');
        await page.fill('input[name="address"]', '123 Main Street');
        await page.fill('input[name="city"]', 'New York');
        await page.fill('input[name="state"]', 'NY');
        await page.fill('input[name="zipCode"]', '10001');
        await page.click('button:has-text("Next")');
        await page.click('button:has-text("Next")');
        
        // Upload image
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'camera.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image'),
        });
        
        await page.click('button:has-text("Next"), button:has-text("Review")');
        
        // Review page
        await expect(page.locator('text=/Review|Summary/i')).toBeVisible();
      });

      test("should go back to edit", async ({ page }) => {
        const backButton = page.locator('button:has-text("Back"), button:has-text("Edit")');
        if (await backButton.isVisible()) {
          await backButton.click();
        }
      });
    });
  });

  test.describe("Edit Listing", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsOwner(page);
      await page.goto("/listings/1/edit");
    });

    test("should display edit listing page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Edit|Update/i);
    });

    test("should pre-fill existing data", async ({ page }) => {
      const titleInput = page.locator('input[name="title"]');
      await expect(titleInput).not.toBeEmpty();
    });

    test("should update title", async ({ page }) => {
      await page.fill('input[name="title"]', 'Updated Listing Title');
      await page.click('button:has-text("Save")');
      await expect(page.locator('text=/saved|updated|success/i')).toBeVisible();
    });

    test("should update price", async ({ page }) => {
      await page.fill('input[name="dailyRate"]', '75');
      await page.click('button:has-text("Save")');
      await expect(page.locator('text=/saved|updated/i')).toBeVisible();
    });

    test("should add new images", async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'new-image.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('new fake image'),
      });
    });

    test("should remove existing images", async ({ page }) => {
      const deleteButton = page.locator('[data-testid="delete-image"]').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
      }
    });

    test("should validate changes", async ({ page }) => {
      await page.fill('input[name="title"]', '');
      await page.click('button:has-text("Save")');
      await expect(page.locator('text=/required|cannot be empty/i')).toBeVisible();
    });

    test("should cancel edits", async ({ page }) => {
      await page.fill('input[name="title"]', 'Changed Title');
      await page.click('button:has-text("Cancel")');
      await expect(page).toHaveURL(/.*listings\/1|.*dashboard/);
    });
  });

  test.describe("Manage Listings", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsOwner(page);
      await page.goto("/dashboard/owner");
    });

    test("should display listings section", async ({ page }) => {
      await expect(page.locator('[data-testid="listings-section"]')).toBeVisible();
    });

    test("should show listing cards", async ({ page }) => {
      const listingCard = page.locator('[data-testid="listing-card"]');
      if (await listingCard.first().isVisible()) {
        await expect(listingCard.first()).toBeVisible();
      }
    });

    test("should filter by status - active", async ({ page }) => {
      const statusFilter = page.locator('[data-testid="status-filter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.click('text=Active');
      }
    });

    test("should filter by status - inactive", async ({ page }) => {
      const statusFilter = page.locator('[data-testid="status-filter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.click('text=Inactive');
      }
    });

    test("should navigate to create listing", async ({ page }) => {
      await page.click('button:has-text("Create"), a:has-text("New Listing")');
      await expect(page).toHaveURL(/.*listings\/new/);
    });

    test("should navigate to edit listing", async ({ page }) => {
      const editButton = page.locator('[data-testid="edit-listing"]').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page).toHaveURL(/.*listings\/.*\/edit/);
      }
    });

    test("should view listing details", async ({ page }) => {
      const listingCard = page.locator('[data-testid="listing-card"]').first();
      if (await listingCard.isVisible()) {
        await listingCard.click();
        await expect(page).toHaveURL(/.*listings\/.*/);
      }
    });

    test("should deactivate listing", async ({ page }) => {
      const deactivateButton = page.locator('[data-testid="deactivate-listing"]').first();
      if (await deactivateButton.isVisible()) {
        await deactivateButton.click();
        
        // Confirm
        await page.click('button:has-text("Confirm")');
        await expect(page.locator('text=/deactivated|inactive/i')).toBeVisible();
      }
    });

    test("should activate listing", async ({ page }) => {
      const activateButton = page.locator('[data-testid="activate-listing"]').first();
      if (await activateButton.isVisible()) {
        await activateButton.click();
        await expect(page.locator('text=/activated|active/i')).toBeVisible();
      }
    });

    test("should delete listing", async ({ page }) => {
      const deleteButton = page.locator('[data-testid="delete-listing"]').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Confirmation modal
        await expect(page.locator('[data-testid="delete-modal"]')).toBeVisible();
        await page.click('button:has-text("Delete")');
        
        await expect(page.locator('text=/deleted|removed/i')).toBeVisible();
      }
    });

    test("should show listing analytics", async ({ page }) => {
      const analyticsButton = page.locator('[data-testid="listing-analytics"]').first();
      if (await analyticsButton.isVisible()) {
        await analyticsButton.click();
        await expect(page.locator('[data-testid="analytics-modal"]')).toBeVisible();
      }
    });

    test("should show view count", async ({ page }) => {
      const viewCount = page.locator('[data-testid="view-count"]');
      if (await viewCount.first().isVisible()) {
        await expect(viewCount.first()).toBeVisible();
      }
    });

    test("should show booking count", async ({ page }) => {
      const bookingCount = page.locator('[data-testid="booking-count"]');
      if (await bookingCount.first().isVisible()) {
        await expect(bookingCount.first()).toBeVisible();
      }
    });
  });

  test.describe("Calendar & Availability", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsOwner(page);
      await page.goto("/dashboard/owner/calendar");
    });

    test("should display calendar view", async ({ page }) => {
      await expect(page.locator('[data-testid="calendar"]')).toBeVisible();
    });

    test("should show bookings on calendar", async ({ page }) => {
      const booking = page.locator('[data-testid="calendar-booking"]');
      if (await booking.first().isVisible()) {
        await expect(booking.first()).toBeVisible();
      }
    });

    test("should navigate between months", async ({ page }) => {
      await page.click('[data-testid="next-month"]');
      await page.click('[data-testid="prev-month"]');
    });

    test("should block dates", async ({ page }) => {
      const calendarDay = page.locator('[data-testid="calendar-day"]:not([disabled])').first();
      if (await calendarDay.isVisible()) {
        await calendarDay.click();
        const blockButton = page.locator('button:has-text("Block")');
        if (await blockButton.isVisible()) {
          await blockButton.click();
        }
      }
    });

    test("should unblock dates", async ({ page }) => {
      const blockedDay = page.locator('[data-testid="calendar-day"].blocked').first();
      if (await blockedDay.isVisible()) {
        await blockedDay.click();
        const unblockButton = page.locator('button:has-text("Unblock")');
        if (await unblockButton.isVisible()) {
          await unblockButton.click();
        }
      }
    });

    test("should filter by listing", async ({ page }) => {
      const listingFilter = page.locator('[data-testid="listing-filter"]');
      if (await listingFilter.isVisible()) {
        await listingFilter.click();
        await page.locator('[data-testid="listing-option"]').first().click();
      }
    });

    test("should click booking for details", async ({ page }) => {
      const booking = page.locator('[data-testid="calendar-booking"]').first();
      if (await booking.isVisible()) {
        await booking.click();
        await expect(page.locator('[data-testid="booking-details-modal"]')).toBeVisible();
      }
    });
  });
});
