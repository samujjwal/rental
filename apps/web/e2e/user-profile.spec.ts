import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

/**
 * User Profile E2E Tests
 * 
 * Tests user profile functionality:
 * - Profile viewing
 * - Profile editing
 * - Profile picture management
 * - Profile privacy settings
 * - Profile verification
 * - Profile statistics
 * - Profile reviews and ratings
 * - Profile activity history
 */

test.describe("User Profile E2E", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("Profile Viewing", () => {
    test("should display user profile page", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile
      await page.click('a[href="/profile"]');
      await page.waitForURL("/profile");

      // Should show profile information
      await expect(page.locator("h1")).toContainText(/Profile|John Doe/i);
      await expect(page.locator('[data-testid="profile-info"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-name"]')).toContainText("John Doe");
      await expect(page.locator('[data-testid="user-email"]')).toContainText("user@example.com");
    });

    test("should display public profile for other users", async ({ page }) => {
      // Navigate to public profile without login
      await page.goto("/profile/public-user-123");

      // Should show public profile information
      await expect(page.locator("h1")).toContainText(/Public Profile|Jane Smith/i);
      await expect(page.locator('[data-testid="public-profile-info"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-name"]')).toContainText("Jane Smith");
      
      // Should not show private information
      await expect(page.locator('[data-testid="user-email"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="user-phone"]')).not.toBeVisible();
    });

    test("should show profile verification status", async ({ page }) => {
      // Login as verified user
      await page.goto("/login");
      await page.fill('input[name="email"]', "verified@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile
      await page.goto("/profile");

      // Should show verification badges
      await expect(page.locator('[data-testid="email-verified-badge"]')).toBeVisible();
      await expect(page.locator('[data-testid="phone-verified-badge"]')).toBeVisible();
      await expect(page.locator('[data-testid="identity-verified-badge"]')).toBeVisible();
      
      // Should show verification status
      await expect(page.locator('[data-testid="verification-status"]')).toContainText(/verified|trusted/i);
    });

    test("should display profile statistics", async ({ page }) => {
      // Login as user with activity
      await page.goto("/login");
      await page.fill('input[name="email"]', "active@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile
      await page.goto("/profile");

      // Should show profile statistics
      await expect(page.locator('[data-testid="profile-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-bookings"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-reviews"]')).toBeVisible();
      await expect(page.locator('[data-testid="average-rating"]')).toBeVisible();
      await expect(page.locator('[data-testid="response-rate"]')).toBeVisible();
      
      // Should show meaningful numbers
      await expect(page.locator('[data-testid="total-bookings"]')).toContainText(/\d+/);
      await expect(page.locator('[data-testid="average-rating"]')).toContainText(/\d+\.\d+/);
    });
  });

  test.describe("Profile Editing", () => {
    test("should edit basic profile information", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile edit
      await page.goto("/profile/edit");

      // Edit profile information
      await page.fill('input[name="firstName"]', "Updated");
      await page.fill('input[name="lastName"]', "Name");
      await page.fill('textarea[name="bio"]', "Updated bio information");
      await page.fill('input[name="location"]', "Kathmandu, Nepal");
      await page.fill('input[name="website"]', "https://example.com");
      
      // Save changes
      await page.click('button[data-testid="save-profile"]');

      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText(/updated|saved/i);

      // Should reflect changes on profile page
      await page.goto("/profile");
      await expect(page.locator('[data-testid="user-name"]')).toContainText("Updated Name");
      await expect(page.locator('[data-testid="user-bio"]')).toContainText("Updated bio information");
      await expect(page.locator('[data-testid="user-location"]')).toContainText("Kathmandu, Nepal");
    });

    test("should validate profile edit form", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile edit
      await page.goto("/profile/edit");

      // Try to submit invalid data
      await page.fill('input[name="firstName"]', ""); // Empty first name
      await page.fill('input[name="website"]', "invalid-url"); // Invalid URL
      await page.click('button[data-testid="save-profile"]');

      // Should show validation errors
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-error"]')).toContainText(/first name|required/i);
      await expect(page.locator('[data-testid="validation-error"]')).toContainText(/invalid url/i);
    });

    test("should handle profile picture upload", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile edit
      await page.goto("/profile/edit");

      // Upload profile picture
      await page.click('[data-testid="upload-avatar"]');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('test-files/profile-picture.jpg');

      // Should show uploaded picture
      await expect(page.locator('[data-testid="avatar-preview"] img')).toBeVisible();
      
      // Add alt text
      await page.fill('input[name="avatarAlt"]', "Profile picture of user");
      
      // Save changes
      await page.click('button[data-testid="save-profile"]');

      // Should show success
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      
      // Should show new avatar on profile page
      await page.goto("/profile");
      await expect(page.locator('[data-testid="user-avatar"]')).toHaveAttribute('src', /profile-picture/);
    });

    test("should handle profile picture deletion", async ({ page }) => {
      // Login as user with existing avatar
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile edit
      await page.goto("/profile/edit");

      // Delete existing avatar
      await page.click('[data-testid="delete-avatar"]');
      await page.click('button[data-testid="confirm-delete"]');

      // Should show default avatar
      await expect(page.locator('[data-testid="default-avatar"]')).toBeVisible();
      
      // Save changes
      await page.click('button[data-testid="save-profile"]');

      // Should show success
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });
  });

  test.describe("Profile Privacy Settings", () => {
    test("should configure profile visibility", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to privacy settings
      await page.goto("/profile/privacy");

      // Configure privacy settings
      await page.check('input[name="showPublicProfile"]');
      await page.check('input[name="showEmail"]');
      await page.uncheck('input[name="showPhone"]');
      await page.check('input[name="showBookings"]');
      await page.uncheck('input[name="showReviews"]');
      
      // Save settings
      await page.click('button[data-testid="save-privacy"]');

      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      
      // Test public profile visibility
      await page.goto("/profile/public-user-123");
      await expect(page.locator('[data-testid="user-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-phone"]')).not.toBeVisible();
    });

    test("should handle profile blocking", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to another user's profile
      await page.goto("/profile/public-user-456");

      // Block user
      await page.click('[data-testid="block-user"]');
      await page.click('button[data-testid="confirm-block"]');

      // Should show blocked message
      await expect(page.locator('[data-testid="blocked-message"]')).toBeVisible();
      
      // Should not show profile content
      await expect(page.locator('[data-testid="profile-content"]')).not.toBeVisible();
      
      // Verify block in privacy settings
      await page.goto("/profile/privacy");
      await expect(page.locator('[data-testid="blocked-users"]')).toContainText("public-user-456");
    });

    test("should manage blocked users list", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to privacy settings
      await page.goto("/profile/privacy");

      // Should show blocked users
      await expect(page.locator('[data-testid="blocked-users"]')).toBeVisible();
      
      // Unblock user
      await page.click('[data-testid="unblock-user"]:first-child');
      await page.click('button[data-testid="confirm-unblock"]');

      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      
      // User should be removed from blocked list
      await expect(page.locator('[data-testid="blocked-users"]')).not.toContainText("unblocked-user");
    });
  });

  test.describe("Profile Verification", () => {
    test("should initiate email verification", async ({ page }) => {
      // Login as unverified user
      await page.goto("/login");
      await page.fill('input[name="email"]', "unverified@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile verification
      await page.goto("/profile/verification");

      // Should show verification status
      await expect(page.locator('[data-testid="email-verification-status"]')).toContainText(/not verified/i);
      
      // Initiate email verification
      await page.click('[data-testid="verify-email"]');
      
      // Should show success message
      await expect(page.locator('[data-testid="verification-sent"]')).toBeVisible();
      await expect(page.locator('[data-testid="verification-sent"]')).toContainText(/email sent/i);
    });

    test("should verify email with token", async ({ page }) => {
      // Navigate to email verification with token
      await page.goto("/profile/verify-email?token=verification-token-123");

      // Should show verification success
      await expect(page.locator('[data-testid="verification-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="verification-success"]')).toContainText(/email verified/i);
      
      // Should redirect to profile
      await expect(page).toHaveURL(/\/profile/);
      
      // Should show verified badge
      await expect(page.locator('[data-testid="email-verified-badge"]')).toBeVisible();
    });

    test("should handle phone verification", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile verification
      await page.goto("/profile/verification");

      // Add phone number
      await page.fill('input[name="phone"]', "+9771234567890");
      await page.click('[data-testid="send-sms-code"]');
      
      // Should show code input
      await expect(page.locator('[data-testid="sms-code-input"]')).toBeVisible();
      
      // Enter verification code
      await page.fill('input[name="smsCode"]', "123456");
      await page.click('[data-testid="verify-sms"]');

      // Should show verification success
      await expect(page.locator('[data-testid="phone-verified"]')).toBeVisible();
      await expect(page.locator('[data-testid="phone-verified-badge"]')).toBeVisible();
    });

    test("should handle identity verification", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile verification
      await page.goto("/profile/verification");

      // Start identity verification
      await page.click('[data-testid="verify-identity"]');
      
      // Should show identity verification form
      await expect(page.locator('[data-testid="identity-form"]')).toBeVisible();
      
      // Fill identity information
      await page.selectOption('select[name="documentType"]', "passport");
      await page.fill('input[name="documentNumber"]', "A123456789");
      await page.fill('input[name="fullName"]', "John Doe");
      await page.fill('input[name="dateOfBirth"]', "1990-01-01");
      
      // Upload documents
      await page.click('[data-testid="upload-front"]');
      const frontInput = page.locator('input[type="file"]').first();
      await frontInput.setInputFiles('test-files/id-front.jpg');
      
      await page.click('[data-testid="upload-back"]');
      const backInput = page.locator('input[type="file"]').last();
      await backInput.setInputFiles('test-files/id-back.jpg');
      
      // Submit verification
      await page.click('[data-testid="submit-identity"]');

      // Should show pending status
      await expect(page.locator('[data-testid="identity-pending"]')).toBeVisible();
      await expect(page.locator('[data-testid="identity-pending"]')).toContainText(/under review/i);
    });
  });

  test.describe("Profile Reviews and Ratings", () => {
    test("should display user reviews", async ({ page }) => {
      // Navigate to user's public profile
      await page.goto("/profile/public-user-123");

      // Should show reviews section
      await expect(page.locator('[data-testid="reviews-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-item"]')).toHaveCount.greaterThan(0);
      
      // Should show review content
      await expect(page.locator('[data-testid="review-rating"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-comment"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-date"]')).toBeVisible();
      await expect(page.locator('[data-testid="reviewer-name"]')).toBeVisible();
    });

    test("should show overall rating summary", async ({ page }) => {
      // Navigate to user's public profile
      await page.goto("/profile/public-user-123");

      // Should show rating summary
      await expect(page.locator('[data-testid="rating-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="average-rating"]')).toContainText(/\d+\.\d+/);
      await expect(page.locator('[data-testid="total-reviews"]')).toContainText(/\d+/);
      
      // Should show rating distribution
      await expect(page.locator('[data-testid="rating-distribution"]')).toBeVisible();
      await expect(page.locator('[data-testid="rating-bar"]')).toHaveCount(5);
    });

    test("should allow writing reviews", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to another user's profile
      await page.goto("/profile/public-user-456");

      // Write a review
      await page.click('[data-testid="write-review"]');
      
      // Should show review form
      await expect(page.locator('[data-testid="review-form"]')).toBeVisible();
      
      // Fill review form
      await page.click('[data-testid="rating-star-4"]'); // 4-star rating
      await page.fill('textarea[name="review"]', "Great experience! Highly recommended.");
      
      // Submit review
      await page.click('[data-testid="submit-review"]');

      // Should show success message
      await expect(page.locator('[data-testid="review-success"]')).toBeVisible();
      
      // Should show new review
      await expect(page.locator('[data-testid="review-item"]')).toContainText("Great experience!");
    });

    test("should validate review submission", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to another user's profile
      await page.goto("/profile/public-user-456");

      // Try to submit empty review
      await page.click('[data-testid="write-review"]');
      await page.click('[data-testid="submit-review"]'); // Without rating or comment

      // Should show validation errors
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-error"]')).toContainText(/rating|required/i);
      await expect(page.locator('[data-testid="validation-error"]')).toContainText(/review|required/i);
    });
  });

  test.describe("Profile Activity History", () => {
    test("should display user activity timeline", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile activity
      await page.goto("/profile/activity");

      // Should show activity timeline
      await expect(page.locator('[data-testid="activity-timeline"]')).toBeVisible();
      await expect(page.locator('[data-testid="activity-item"]')).toHaveCount.greaterThan(0);
      
      // Should show different activity types
      await expect(page.locator('[data-testid="booking-activity"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-activity"]')).toBeVisible();
      await expect(page.locator('[data-testid="profile-activity"]')).toBeVisible();
    });

    test("should filter activity by type", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile activity
      await page.goto("/profile/activity");

      // Filter by bookings
      await page.selectOption('select[name="activityFilter"]', "bookings");
      
      // Should show only booking activities
      await expect(page.locator('[data-testid="booking-activity"]')).toHaveCount.greaterThan(0);
      await expect(page.locator('[data-testid="review-activity"]')).toHaveCount(0);
      
      // Filter by reviews
      await page.selectOption('select[name="activityFilter"]', "reviews");
      
      // Should show only review activities
      await expect(page.locator('[data-testid="review-activity"]')).toHaveCount.greaterThan(0);
      await expect(page.locator('[data-testid="booking-activity"]')).toHaveCount(0);
    });

    test("should show activity details", async ({ page }) => {
      // Login as user
      await page.goto("/login");
      await page.fill('input[name="email"]', "user@example.com");
      await page.fill('input[name="password"]', "password123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to profile activity
      await page.goto("/profile/activity");

      // Click on activity item
      await page.click('[data-testid="activity-item"]:first-child');

      // Should show activity details modal
      await expect(page.locator('[data-testid="activity-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="activity-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="activity-description"]')).toBeVisible();
      await expect(page.locator('[data-testid="activity-timestamp"]')).toBeVisible();
    });
  });

  test.describe("Profile Responsive Design", () => {
    test("should be responsive on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Navigate to profile
      await page.goto("/profile/public-user-123");

      // Should be mobile-optimized
      await expect(page.locator('[data-testid="profile-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="profile-content"]')).toBeVisible();
      
      // Check no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
    });

    test("should be responsive on tablet", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Navigate to profile
      await page.goto("/profile/public-user-123");

      // Should adapt to tablet layout
      await expect(page.locator('[data-testid="profile-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="profile-main"]')).toBeVisible();
    });

    test("should be responsive on desktop", async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Navigate to profile
      await page.goto("/profile/public-user-123");

      // Should show full desktop layout
      await expect(page.locator('[data-testid="profile-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="profile-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="profile-reviews"]')).toBeVisible();
    });
  });

  test.describe("Profile Accessibility", () => {
    test("should have proper heading structure", async ({ page }) => {
      await page.goto("/profile/public-user-123");

      // Should have exactly one h1
      const h1Count = await page.locator("h1").count();
      expect(h1Count).toBe(1);
      
      // Headings should be in proper order
      const headings = await page.locator("h1, h2, h3").all();
      expect(headings.length).toBeGreaterThan(0);
    });

    test("should have accessible profile information", async ({ page }) => {
      await page.goto("/profile/public-user-123");

      // Check for proper ARIA labels
      await expect(page.locator('[data-testid="user-avatar"]')).toHaveAttribute('alt');
      await expect(page.locator('[data-testid="rating-summary"]')).toHaveAttribute('aria-label');
      
      // Check for keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
    });

    test("should support screen readers", async ({ page }) => {
      await page.goto("/profile/public-user-123");

      // Check for semantic HTML
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('section')).toHaveCount.greaterThan(0);
      
      // Check for proper text alternatives
      const images = await page.locator('img').all();
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        expect(alt).toBeTruthy();
      }
    });
  });
});
