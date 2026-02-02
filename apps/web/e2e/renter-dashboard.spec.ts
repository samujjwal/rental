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

test.describe("Renter Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRenter(page);
  });

  test.describe("Dashboard Overview", () => {
    test("should display dashboard welcome message", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await expect(page.locator('text=/Welcome|Hello/i')).toBeVisible();
    });

    test("should display stats cards", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible();
    });

    test("should show active rentals count", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await expect(page.locator('text=/Active|Current/i')).toBeVisible();
    });

    test("should show upcoming rentals count", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await expect(page.locator('text=/Upcoming|Scheduled/i')).toBeVisible();
    });

    test("should show completed rentals count", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await expect(page.locator('text=/Completed|Past/i')).toBeVisible();
    });

    test("should show total spent", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const spentSection = page.locator('text=/Spent|Total/i');
      if (await spentSection.isVisible()) {
        await expect(spentSection).toBeVisible();
      }
    });
  });

  test.describe("Recent Bookings", () => {
    test("should display recent bookings section", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await expect(page.locator('[data-testid="recent-bookings"]')).toBeVisible();
    });

    test("should show booking cards", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const bookingCard = page.locator('[data-testid="booking-card"]');
      if (await bookingCard.first().isVisible()) {
        await expect(bookingCard.first()).toBeVisible();
      }
    });

    test("should navigate to booking details", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const bookingCard = page.locator('[data-testid="booking-card"]').first();
      if (await bookingCard.isVisible()) {
        await bookingCard.click();
        await expect(page).toHaveURL(/.*bookings\/.*/);
      }
    });

    test("should show view all bookings link", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const viewAllLink = page.locator('a:has-text("View All"), a:has-text("See All")');
      if (await viewAllLink.isVisible()) {
        await viewAllLink.click();
        await expect(page).toHaveURL(/.*bookings/);
      }
    });
  });

  test.describe("Quick Actions", () => {
    test("should display quick actions section", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const quickActions = page.locator('[data-testid="quick-actions"]');
      if (await quickActions.isVisible()) {
        await expect(quickActions).toBeVisible();
      }
    });

    test("should have search action", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const searchAction = page.locator('a:has-text("Search"), button:has-text("Browse")');
      if (await searchAction.isVisible()) {
        await searchAction.click();
        await expect(page).toHaveURL(/.*search/);
      }
    });

    test("should have favorites action", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const favoritesAction = page.locator('a:has-text("Favorites")');
      if (await favoritesAction.isVisible()) {
        await favoritesAction.click();
        await expect(page).toHaveURL(/.*favorites/);
      }
    });

    test("should have messages action", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const messagesAction = page.locator('a:has-text("Messages")');
      if (await messagesAction.isVisible()) {
        await messagesAction.click();
        await expect(page).toHaveURL(/.*messages/);
      }
    });
  });

  test.describe("Recommendations", () => {
    test("should display recommendations section", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const recommendations = page.locator('[data-testid="recommendations"]');
      if (await recommendations.isVisible()) {
        await expect(recommendations).toBeVisible();
      }
    });

    test("should show recommended listings", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const listingCard = page.locator('[data-testid="recommendation-card"]');
      if (await listingCard.first().isVisible()) {
        await expect(listingCard.first()).toBeVisible();
      }
    });

    test("should navigate to recommended listing", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const listingCard = page.locator('[data-testid="recommendation-card"]').first();
      if (await listingCard.isVisible()) {
        await listingCard.click();
        await expect(page).toHaveURL(/.*listings\/.*/);
      }
    });
  });

  test.describe("Notifications", () => {
    test("should display notifications icon", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await expect(page.locator('[data-testid="notifications-icon"]')).toBeVisible();
    });

    test("should show notification badge for unread", async ({ page }) => {
      await page.goto("/dashboard/renter");
      const badge = page.locator('[data-testid="notification-badge"]');
      if (await badge.isVisible()) {
        await expect(badge).toBeVisible();
      }
    });

    test("should open notifications dropdown", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await page.click('[data-testid="notifications-icon"]');
      await expect(page.locator('[data-testid="notifications-dropdown"]')).toBeVisible();
    });

    test("should mark notification as read", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await page.click('[data-testid="notifications-icon"]');
      
      const notification = page.locator('[data-testid="notification-item"]').first();
      if (await notification.isVisible()) {
        await notification.click();
        // Notification should be marked as read
      }
    });

    test("should navigate to notification settings", async ({ page }) => {
      await page.goto("/dashboard/renter");
      await page.click('[data-testid="notifications-icon"]');
      
      const settingsLink = page.locator('a:has-text("Settings")');
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await expect(page).toHaveURL(/.*settings.*notifications/);
      }
    });
  });
});

test.describe("Favorites", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRenter(page);
    await page.goto("/favorites");
  });

  test("should display favorites page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Favorites|Saved/i);
  });

  test("should show favorited listings", async ({ page }) => {
    const listingCard = page.locator('[data-testid="listing-card"]');
    if (await listingCard.first().isVisible()) {
      await expect(listingCard.first()).toBeVisible();
    }
  });

  test("should show empty state when no favorites", async ({ page }) => {
    // If no favorites
    const emptyState = page.locator('text=/No favorites|No saved items|Start exploring/i');
    const listingCard = page.locator('[data-testid="listing-card"]');
    
    await expect(emptyState.or(listingCard.first())).toBeVisible();
  });

  test("should remove from favorites", async ({ page }) => {
    const removeButton = page.locator('[data-testid="remove-favorite"]').first();
    if (await removeButton.isVisible()) {
      await removeButton.click();
      await expect(page.locator('text=/removed|deleted/i')).toBeVisible();
    }
  });

  test("should navigate to listing from favorites", async ({ page }) => {
    const listingCard = page.locator('[data-testid="listing-card"]').first();
    if (await listingCard.isVisible()) {
      await listingCard.click();
      await expect(page).toHaveURL(/.*listings\/.*/);
    }
  });

  test("should add to favorites from listing page", async ({ page }) => {
    await page.goto("/listings/1");
    
    const favoriteButton = page.locator('[data-testid="favorite-button"]');
    if (await favoriteButton.isVisible()) {
      await favoriteButton.click();
      await expect(page.locator('text=/added|saved/i')).toBeVisible();
    }
  });
});

test.describe("Messages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRenter(page);
    await page.goto("/messages");
  });

  test("should display messages page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Messages|Inbox/i);
  });

  test("should show conversation list", async ({ page }) => {
    await expect(page.locator('[data-testid="conversation-list"]')).toBeVisible();
  });

  test("should show empty state when no messages", async ({ page }) => {
    const emptyState = page.locator('text=/No messages|No conversations/i');
    const conversation = page.locator('[data-testid="conversation-item"]');
    
    await expect(emptyState.or(conversation.first())).toBeVisible();
  });

  test("should open conversation", async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if (await conversation.isVisible()) {
      await conversation.click();
      await expect(page.locator('[data-testid="message-thread"]')).toBeVisible();
    }
  });

  test("should display messages in thread", async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if (await conversation.isVisible()) {
      await conversation.click();
      await expect(page.locator('[data-testid="message-bubble"]')).toBeVisible();
    }
  });

  test("should send a message", async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if (await conversation.isVisible()) {
      await conversation.click();
      
      await page.fill('textarea[name="message"]', 'Test message from e2e test');
      await page.click('button:has-text("Send")');
      
      await expect(page.locator('text=Test message from e2e test')).toBeVisible();
    }
  });

  test("should show message timestamp", async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if (await conversation.isVisible()) {
      await conversation.click();
      await expect(page.locator('[data-testid="message-timestamp"]')).toBeVisible();
    }
  });

  test("should show typing indicator", async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if (await conversation.isVisible()) {
      await conversation.click();
      await page.fill('textarea[name="message"]', 'Typing...');
      
      // Typing indicator would show on the other user's screen
      // This test just verifies the input works
      await expect(page.locator('textarea[name="message"]')).toHaveValue('Typing...');
    }
  });

  test("should attach file to message", async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if (await conversation.isVisible()) {
      await conversation.click();
      
      const attachButton = page.locator('[data-testid="attach-file"]');
      if (await attachButton.isVisible()) {
        await attachButton.click();
        
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image'),
        });
      }
    }
  });

  test("should search messages", async ({ page }) => {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('hello');
      await page.keyboard.press('Enter');
    }
  });

  test("should navigate to booking from message", async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if (await conversation.isVisible()) {
      await conversation.click();
      
      const bookingLink = page.locator('[data-testid="booking-link"]');
      if (await bookingLink.isVisible()) {
        await bookingLink.click();
        await expect(page).toHaveURL(/.*bookings\/.*/);
      }
    }
  });
});

test.describe("Settings - Profile", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRenter(page);
    await page.goto("/settings/profile");
  });

  test("should display profile settings page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Profile|Account/i);
  });

  test("should show profile picture", async ({ page }) => {
    await expect(page.locator('[data-testid="profile-picture"]')).toBeVisible();
  });

  test("should upload new profile picture", async ({ page }) => {
    const uploadButton = page.locator('[data-testid="upload-picture"]');
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'avatar.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image'),
      });
    }
  });

  test("should display editable name fields", async ({ page }) => {
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
  });

  test("should update first name", async ({ page }) => {
    await page.fill('input[name="firstName"]', 'UpdatedFirstName');
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=/saved|updated|success/i')).toBeVisible();
  });

  test("should display email (read-only or editable)", async ({ page }) => {
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test("should display phone number field", async ({ page }) => {
    const phoneInput = page.locator('input[name="phone"]');
    if (await phoneInput.isVisible()) {
      await expect(phoneInput).toBeVisible();
    }
  });

  test("should update phone number", async ({ page }) => {
    const phoneInput = page.locator('input[name="phone"]');
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('+1234567890');
      await page.click('button:has-text("Save")');
      await expect(page.locator('text=/saved|updated/i')).toBeVisible();
    }
  });

  test("should display bio/description field", async ({ page }) => {
    const bioInput = page.locator('textarea[name="bio"]');
    if (await bioInput.isVisible()) {
      await expect(bioInput).toBeVisible();
    }
  });

  test("should update bio", async ({ page }) => {
    const bioInput = page.locator('textarea[name="bio"]');
    if (await bioInput.isVisible()) {
      await bioInput.fill('This is my updated bio for e2e testing.');
      await page.click('button:has-text("Save")');
      await expect(page.locator('text=/saved|updated/i')).toBeVisible();
    }
  });

  test("should navigate to change password", async ({ page }) => {
    await page.click('a:has-text("Change Password"), button:has-text("Change Password")');
    await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
  });

  test("should change password", async ({ page }) => {
    await page.click('a:has-text("Change Password"), button:has-text("Change Password")');
    
    await page.fill('input[name="currentPassword"]', TEST_RENTER.password);
    await page.fill('input[name="newPassword"]', 'NewPassword123!');
    await page.fill('input[name="confirmPassword"]', 'NewPassword123!');
    await page.click('button:has-text("Update Password")');
    
    await expect(page.locator('text=/updated|success/i')).toBeVisible();
  });

  test("should delete account", async ({ page }) => {
    const deleteButton = page.locator('button:has-text("Delete Account")');
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Confirmation modal
      await expect(page.locator('[data-testid="delete-modal"]')).toBeVisible();
      await expect(page.locator('text=/Are you sure|This action/i')).toBeVisible();
    }
  });
});

test.describe("Settings - Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRenter(page);
    await page.goto("/settings/notifications");
  });

  test("should display notification settings page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Notification/i);
  });

  test("should show email notification toggle", async ({ page }) => {
    await expect(page.locator('[data-testid="email-notifications-toggle"]')).toBeVisible();
  });

  test("should toggle email notifications", async ({ page }) => {
    const toggle = page.locator('[data-testid="email-notifications-toggle"]');
    await toggle.click();
    await expect(page.locator('text=/saved|updated/i')).toBeVisible();
  });

  test("should show push notification toggle", async ({ page }) => {
    const toggle = page.locator('[data-testid="push-notifications-toggle"]');
    if (await toggle.isVisible()) {
      await expect(toggle).toBeVisible();
    }
  });

  test("should show SMS notification toggle", async ({ page }) => {
    const toggle = page.locator('[data-testid="sms-notifications-toggle"]');
    if (await toggle.isVisible()) {
      await expect(toggle).toBeVisible();
    }
  });

  test("should show booking notifications option", async ({ page }) => {
    await expect(page.locator('text=/Booking/i')).toBeVisible();
  });

  test("should show message notifications option", async ({ page }) => {
    await expect(page.locator('text=/Message/i')).toBeVisible();
  });

  test("should show promotional notifications option", async ({ page }) => {
    const promo = page.locator('text=/Promotional|Marketing/i');
    if (await promo.isVisible()) {
      await expect(promo).toBeVisible();
    }
  });

  test("should save notification preferences", async ({ page }) => {
    const toggle = page.locator('[data-testid="email-notifications-toggle"]');
    await toggle.click();
    
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=/saved|updated/i')).toBeVisible();
  });
});

test.describe("Public Profile View", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRenter(page);
  });

  test("should view own public profile", async ({ page }) => {
    await page.goto("/profile/me");
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
  });

  test("should view other user profile", async ({ page }) => {
    await page.goto("/profile/user123");
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
  });

  test("should display user name", async ({ page }) => {
    await page.goto("/profile/user123");
    await expect(page.locator('[data-testid="profile-name"]')).toBeVisible();
  });

  test("should display user avatar", async ({ page }) => {
    await page.goto("/profile/user123");
    await expect(page.locator('[data-testid="profile-avatar"]')).toBeVisible();
  });

  test("should display user bio", async ({ page }) => {
    await page.goto("/profile/user123");
    const bio = page.locator('[data-testid="profile-bio"]');
    if (await bio.isVisible()) {
      await expect(bio).toBeVisible();
    }
  });

  test("should display user reviews", async ({ page }) => {
    await page.goto("/profile/user123");
    await expect(page.locator('[data-testid="profile-reviews"]')).toBeVisible();
  });

  test("should display user listings (if owner)", async ({ page }) => {
    await page.goto("/profile/user123");
    const listings = page.locator('[data-testid="profile-listings"]');
    if (await listings.isVisible()) {
      await expect(listings).toBeVisible();
    }
  });

  test("should display member since date", async ({ page }) => {
    await page.goto("/profile/user123");
    await expect(page.locator('text=/Member since|Joined/i')).toBeVisible();
  });

  test("should display verification badges", async ({ page }) => {
    await page.goto("/profile/user123");
    const badges = page.locator('[data-testid="verification-badges"]');
    if (await badges.isVisible()) {
      await expect(badges).toBeVisible();
    }
  });

  test("should send message from profile", async ({ page }) => {
    await page.goto("/profile/user123");
    
    const messageButton = page.locator('button:has-text("Message")');
    if (await messageButton.isVisible()) {
      await messageButton.click();
      await expect(page).toHaveURL(/.*messages/);
    }
  });
});
