import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

/**
 * Profile Management E2E Tests
 * 
 * Tests comprehensive profile workflow:
 * - Public profile viewing
 * - Profile editing and customization
 * - Profile photo and media management
 * - Social links and verification
 * - Reviews and ratings display
 * - Profile privacy controls
 */

test.describe("Profile Management", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("Public Profile Viewing", () => {
    test("should display user profile information", async ({ page }) => {
      // Navigate to a user's profile
      await page.goto("/profile/user-123");
      
      // Should show profile header
      await expect(page.locator("h1")).toContainText(/Profile/i);
      await expect(page.locator('[data-testid="profile-header"]')).toBeVisible();
      
      // Should show basic profile information
      await expect(page.locator('[data-testid="profile-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="profile-avatar"]')).toBeVisible();
      await expect(page.locator('[data-testid="profile-bio"]')).toBeVisible();
      
      // Should show profile stats
      await expect(page.locator('[data-testid="profile-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="join-date"]')).toBeVisible();
      await expect(page.locator('[data-testid="response-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-reviews"]')).toBeVisible();
    });

    test("should display user listings and properties", async ({ page }) => {
      await page.goto("/profile/user-123");
      
      // Should show listings section
      const listingsSection = page.locator('[data-testid="user-listings"]');
      await expect(listingsSection).toBeVisible();
      
      // Check for listing cards
      const listingCards = listingsSection.locator('[data-testid="listing-card"]');
      const listingCount = await listingCards.count();
      
      if (listingCount > 0) {
        const firstListing = listingCards.first();
        
        // Should show listing details
        await expect(firstListing.locator('[data-testid="listing-title"]')).toBeVisible();
        await expect(firstListing.locator('[data-testid="listing-price"]')).toBeVisible();
        await expect(firstListing.locator('[data-testid="listing-location"]')).toBeVisible();
        await expect(firstListing.locator('[data-testid="listing-rating"]')).toBeVisible();
        
        // Click to view listing details
        await firstListing.click();
        await expect(page).toHaveURL(/.*\/listings\/[^\/]+/);
      }
    });

    test("should display reviews and ratings", async ({ page }) => {
      await page.goto("/profile/user-123");
      
      // Should show reviews section
      const reviewsSection = page.locator('[data-testid="user-reviews"]');
      await expect(reviewsSection).toBeVisible();
      
      // Should show overall rating
      await expect(reviewsSection.locator('[data-testid="overall-rating"]')).toBeVisible();
      await expect(reviewsSection.locator('[data-testid="rating-stars"]')).toBeVisible();
      
      // Check for individual reviews
      const reviewCards = reviewsSection.locator('[data-testid="review-card"]');
      const reviewCount = await reviewCards.count();
      
      if (reviewCount > 0) {
        const firstReview = reviewCards.first();
        
        // Should show review details
        await expect(firstReview.locator('[data-testid="reviewer-name"]')).toBeVisible();
        await expect(firstReview.locator('[data-testid="review-date"]')).toBeVisible();
        await expect(firstReview.locator('[data-testid="review-rating"]')).toBeVisible();
        await expect(firstReview.locator('[data-testid="review-comment"]')).toBeVisible();
      }
      
      // Should have rating breakdown
      await expect(reviewsSection.locator('[data-testid="rating-breakdown"]')).toBeVisible();
    });

    test("should display verification badges", async ({ page }) => {
      await page.goto("/profile/user-123");
      
      // Should show verification section
      const verificationSection = page.locator('[data-testid="verification-badges"]');
      if (await verificationSection.isVisible()) {
        await expect(verificationSection.locator('[data-testid="email-verified"]')).toBeVisible();
        await expect(verificationSection.locator('[data-testid="phone-verified"]')).toBeVisible();
        await expect(verificationSection.locator('[data-testid="identity-verified"]')).toBeVisible();
      }
    });

    test("should show social links and contact information", async ({ page }) => {
      await page.goto("/profile/user-123");
      
      // Should show contact section
      const contactSection = page.locator('[data-testid="contact-info"]');
      if (await contactSection.isVisible()) {
        await expect(contactSection.locator('[data-testid="response-time"]')).toBeVisible();
        await expect(contactSection.locator('[data-testid="languages"]')).toBeVisible();
        await expect(contactSection.locator('[data-testid="contact-button"]')).toBeVisible();
      }
      
      // Should show social links
      const socialSection = page.locator('[data-testid="social-links"]');
      if (await socialSection.isVisible()) {
        await expect(socialSection.locator('[data-testid="social-facebook"]')).toBeVisible();
        await expect(socialSection.locator('[data-testid="social-twitter"]')).toBeVisible();
        await expect(socialSection.locator('[data-testid="social-instagram"]')).toBeVisible();
      }
    });
  });

  test.describe("Profile Editing", () => {
    test("should allow editing own profile", async ({ page }) => {
      // Login as user
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to own profile
      await page.goto("/profile/user-123");
      
      // Should show edit button for own profile
      const editBtn = page.locator('[data-testid="edit-profile"]');
      await expect(editBtn).toBeVisible();
      
      await editBtn.click();
      
      // Should show edit form
      await expect(page.locator('[data-testid="profile-edit-form"]')).toBeVisible();
      
      // Update basic information
      await page.fill('[data-testid="first-name"]', "John");
      await page.fill('[data-testid="last-name"]', "Doe");
      await page.fill('[data-testid="bio"]', "Passionate traveler and property host");
      await page.fill('[data-testid="location"]', "Kathmandu, Nepal");
      
      // Update contact information
      await page.fill('[data-testid="phone"]', "+977-1-2345678");
      await page.fill('[data-testid="website"]', "https://johndoe.com");
      
      // Save changes
      await page.click('[data-testid="save-profile"]');
      
      // Should show success message
      await expect(page.locator('[data-testid="profile-updated"]')).toBeVisible();
      
      // Should reflect changes on profile page
      await expect(page.locator('[data-testid="profile-name"]')).toContainText("John Doe");
      await expect(page.locator('[data-testid="profile-bio"]')).toContainText("Passionate traveler");
    });

    test("should manage profile photo and cover image", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/user-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Profile photo section
      const profilePhotoSection = page.locator('[data-testid="profile-photo"]');
      await expect(profilePhotoSection).toBeVisible();
      
      // Upload new profile photo
      const uploadPhotoBtn = profilePhotoSection.locator('[data-testid="upload-photo"]');
      await uploadPhotoBtn.click();
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'profile-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image data')
      });
      
      // Should show upload progress
      await expect(profilePhotoSection.locator('[data-testid="upload-progress"]')).toBeVisible();
      
      // Should show crop interface
      await expect(page.locator('[data-testid="crop-modal"]')).toBeVisible({ timeout: 10000 });
      
      // Crop and save
      await page.locator('[data-testid="confirm-crop"]').click();
      
      // Cover image section
      const coverImageSection = page.locator('[data-testid="cover-image"]');
      if (await coverImageSection.isVisible()) {
        const uploadCoverBtn = coverImageSection.locator('[data-testid="upload-cover"]');
        await uploadCoverBtn.click();
        
        await fileInput.setInputFiles({
          name: 'cover-image.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image data')
        });
        
        await expect(coverImageSection.locator('[data-testid="upload-progress"]')).toBeVisible();
        await expect(page.locator('[data-testid="crop-modal"]')).toBeVisible({ timeout: 10000 });
        
        await page.locator('[data-testid="confirm-crop"]').click();
      }
      
      await page.click('[data-testid="save-profile"]');
      await expect(page.locator('[data-testid="profile-updated"]')).toBeVisible();
    });

    test("should manage social media links", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/user-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Social links section
      const socialSection = page.locator('[data-testid="social-links-edit"]');
      if (await socialSection.isVisible()) {
        // Add social media links
        await page.fill('[data-testid="facebook-url"]', "https://facebook.com/johndoe");
        await page.fill('[data-testid="twitter-url"]', "https://twitter.com/johndoe");
        await page.fill('[data-testid="instagram-url"]', "https://instagram.com/johndoe");
        await page.fill('[data-testid="linkedin-url"]', "https://linkedin.com/in/johndoe");
        
        await page.click('[data-testid="save-social-links"]');
        await expect(page.locator('[data-testid="social-links-saved"]')).toBeVisible();
        
        // Verify links appear on profile
        await page.goto("/profile/user-123");
        const socialLinksSection = page.locator('[data-testid="social-links"]');
        if (await socialLinksSection.isVisible()) {
          await expect(socialLinksSection.locator('[data-testid="social-facebook"]')).toBeVisible();
          await expect(socialLinksSection.locator('[data-testid="social-twitter"]')).toBeVisible();
        }
      }
    });

    test("should manage languages and skills", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/user-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Languages section
      const languagesSection = page.locator('[data-testid="languages-section"]');
      if (await languagesSection.isVisible()) {
        // Add languages
        await page.selectOption('[data-testid="add-language"]', "English");
        await page.selectOption('[data-testid="add-language"]', "Nepali");
        await page.selectOption('[data-testid="add-language"]', "Hindi");
        
        // Set proficiency levels
        await page.selectOption('[data-testid="english-level"]', "fluent");
        await page.selectOption('[data-testid="nepali-level"]', "conversational");
        await page.selectOption('[data-testid="hindi-level"]', "basic");
        
        await page.click('[data-testid="save-languages"]');
        await expect(page.locator('[data-testid="languages-saved"]')).toBeVisible();
      }
      
      // Skills section
      const skillsSection = page.locator('[data-testid="skills-section"]');
      if (await skillsSection.isVisible()) {
        // Add skills
        await page.fill('[data-testid="skill-input"]', "Property Management");
        await page.locator('[data-testid="add-skill"]').click();
        
        await page.fill('[data-testid="skill-input"]', "Customer Service");
        await page.locator('[data-testid="add-skill"]').click();
        
        await page.fill('[data-testid="skill-input"]', "Maintenance");
        await page.locator('[data-testid="add-skill"]').click();
        
        await page.click('[data-testid="save-skills"]');
        await expect(page.locator('[data-testid="skills-saved"]')).toBeVisible();
      }
    });

    test("should validate profile information", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/user-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Try to save with invalid data
      await page.fill('[data-testid="first-name"]', "");
      await page.fill('[data-testid="website"]', "invalid-url");
      await page.click('[data-testid="save-profile"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="first-name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="website-error"]')).toBeVisible();
      
      // Fix errors and save successfully
      await page.fill('[data-testid="first-name"]', "John");
      await page.fill('[data-testid="website"]', "https://johndoe.com");
      await page.click('[data-testid="save-profile"]');
      
      await expect(page.locator('[data-testid="profile-updated"]')).toBeVisible();
    });
  });

  test.describe("Profile Privacy Controls", () => {
    test("should manage profile visibility settings", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/user-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Privacy settings section
      const privacySection = page.locator('[data-testid="privacy-settings"]');
      if (await privacySection.isVisible()) {
        // Profile visibility
        await page.selectOption('[data-testid="profile-visibility"]', "public");
        await page.check('[data-testid="show-email"]');
        await page.uncheck('[data-testid="show-phone"]');
        await page.check('[data-testid="show-last-seen"]');
        
        // Search visibility
        await page.uncheck('[data-testid="appear-in-search"]');
        await page.check('[data-testid="allow-direct-messages"]');
        
        await page.click('[data-testid="save-privacy"]');
        await expect(page.locator('[data-testid="privacy-saved"]')).toBeVisible();
      }
    });

    test("should control review visibility", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/user-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Review settings section
      const reviewSection = page.locator('[data-testid="review-settings"]');
      if (await reviewSection.isVisible()) {
        await page.check('[data-testid="show-reviews"]');
        await page.check('[data-testid="allow-reviews"]');
        await page.uncheck('[data-testid="show-negative-reviews"]');
        
        await page.click('[data-testid="save-review-settings"]');
        await expect(page.locator('[data-testid="review-settings-saved"]')).toBeVisible();
      }
    });

    test("should manage data sharing preferences", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/user-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Data sharing section
      const dataSection = page.locator('[data-testid="data-sharing"]');
      if (await dataSection.isVisible()) {
        await page.uncheck('[data-testid="share-analytics"]');
        await page.check('[data-testid="share-with-partners"]');
        await page.uncheck('[data-testid="allow-data-collection"]');
        
        await page.click('[data-testid="save-data-sharing"]');
        await expect(page.locator('[data-testid="data-sharing-saved"]')).toBeVisible();
      }
    });
  });

  test.describe("Profile Verification", () => {
    test("should start verification process", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/user-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Verification section
      const verificationSection = page.locator('[data-testid="verification-section"]');
      if (await verificationSection.isVisible()) {
        // Email verification
        const verifyEmailBtn = verificationSection.locator('[data-testid="verify-email"]');
        if (await verifyEmailBtn.isVisible()) {
          await verifyEmailBtn.click();
          
          await expect(page.locator('[data-testid="email-verification-modal"]')).toBeVisible();
          
          await page.locator('[data-testid="send-verification-email"]').click();
          await expect(page.locator('[data-testid="verification-email-sent"]')).toBeVisible();
        }
        
        // Phone verification
        const verifyPhoneBtn = verificationSection.locator('[data-testid="verify-phone"]');
        if (await verifyPhoneBtn.isVisible()) {
          await verifyPhoneBtn.click();
          
          await expect(page.locator('[data-testid="phone-verification-modal"]')).toBeVisible();
          
          await page.fill('[data-testid="phone-number"]', "+977-1-2345678");
          await page.locator('[data-testid="send-verification-sms"]').click();
          
          await expect(page.locator('[data-testid="verification-code-sent"]')).toBeVisible();
          
          await page.fill('[data-testid="verification-code"]', "123456");
          await page.locator('[data-testid="verify-phone-code"]').click();
          
          await expect(page.locator('[data-testid="phone-verified"]')).toBeVisible();
        }
        
        // Identity verification
        const verifyIdentityBtn = verificationSection.locator('[data-testid="verify-identity"]');
        if (await verifyIdentityBtn.isVisible()) {
          await verifyIdentityBtn.click();
          
          await expect(page.locator('[data-testid="identity-verification-modal"]')).toBeVisible();
          
          // Upload ID document
          const idUpload = page.locator('[data-testid="id-upload"]');
          await idUpload.locator('input[type="file"]').setInputFiles({
            name: 'id-document.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake image data')
          });
          
          await expect(idUpload.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
          
          // Upload selfie
          const selfieUpload = page.locator('[data-testid="selfie-upload"]');
          await selfieUpload.locator('input[type="file"]').setInputFiles({
            name: 'selfie.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake image data')
          });
          
          await expect(selfieUpload.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
          
          await page.locator('[data-testid="submit-identity-verification"]').click();
          await expect(page.locator('[data-testid="identity-verification-submitted"]')).toBeVisible();
        }
      }
    });

    test("should show verification status and badges", async ({ page }) => {
      await page.goto("/profile/user-123");
      
      // Should show verification badges
      const verificationBadges = page.locator('[data-testid="verification-badges"]');
      if (await verificationBadges.isVisible()) {
        // Check for different verification types
        const emailVerified = verificationBadges.locator('[data-testid="email-verified"]');
        const phoneVerified = verificationBadges.locator('[data-testid="phone-verified"]');
        const identityVerified = verificationBadges.locator('[data-testid="identity-verified"]');
        
        // Should show verification status
        if (await emailVerified.isVisible()) {
          await expect(emailVerified.locator('[data-testid="verified-badge"]')).toBeVisible();
        }
        
        if (await phoneVerified.isVisible()) {
          await expect(phoneVerified.locator('[data-testid="verified-badge"]')).toBeVisible();
        }
        
        if (await identityVerified.isVisible()) {
          await expect(identityVerified.locator('[data-testid="verified-badge"]')).toBeVisible();
        }
      }
    });
  });

  test.describe("Profile Analytics", () => {
    test("should show profile statistics for owners", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/owner-123");
      
      // Should show analytics section
      const analyticsSection = page.locator('[data-testid="profile-analytics"]');
      if (await analyticsSection.isVisible()) {
        // Profile views
        await expect(analyticsSection.locator('[data-testid="profile-views"]')).toBeVisible();
        await expect(analyticsSection.locator('[data-testid="views-chart"]')).toBeVisible();
        
        // Contact requests
        await expect(analyticsSection.locator('[data-testid="contact-requests"]')).toBeVisible();
        await expect(analyticsSection.locator('[data-testid="requests-chart"]')).toBeVisible();
        
        // Listing performance
        await expect(analyticsSection.locator('[data-testid="listing-performance"]')).toBeVisible();
        await expect(analyticsSection.locator('[data-testid="performance-metrics"]')).toBeVisible();
        
        // Date range selector
        await expect(analyticsSection.locator('[data-testid="date-range-selector"]')).toBeVisible();
        
        // Test date range selection
        await page.selectOption('[data-testid="date-range"]', "last-30-days");
        await page.click('[data-testid="apply-date-range"]');
        
        // Should update charts
        await expect(analyticsSection.locator('[data-testid="views-chart"]')).toBeVisible();
      }
    });

    test("should show booking statistics", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/owner-123");
      
      const analyticsSection = page.locator('[data-testid="profile-analytics"]');
      if (await analyticsSection.isVisible()) {
        // Booking statistics
        const bookingStats = analyticsSection.locator('[data-testid="booking-statistics"]');
        if (await bookingStats.isVisible()) {
          await expect(bookingStats.locator('[data-testid="total-bookings"]')).toBeVisible();
          await expect(bookingStats.locator('[data-testid="booking-rate"]')).toBeVisible();
          await expect(bookingStats.locator('[data-testid="average-stay"]')).toBeVisible();
          await expect(bookingStats.locator('[data-testid="revenue-per-booking"]')).toBeVisible();
        }
        
        // Guest demographics
        const demographicsSection = analyticsSection.locator('[data-testid="guest-demographics"]');
        if (await demographicsSection.isVisible()) {
          await expect(demographicsSection.locator('[data-testid="demographics-chart"]')).toBeVisible();
          await expect(demographicsSection.locator('[data-testid="top-countries"]')).toBeVisible();
        }
      }
    });
  });

  test.describe("Profile Recommendations", () => {
    test("should show profile completion tips", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/user-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Profile completion section
      const completionSection = page.locator('[data-testid="profile-completion"]');
      if (await completionSection.isVisible()) {
        // Should show completion percentage
        await expect(completionSection.locator('[data-testid="completion-percentage"]')).toBeVisible();
        
        // Should show missing items
        const missingItems = completionSection.locator('[data-testid="missing-item"]');
        const missingCount = await missingItems.count();
        
        if (missingCount > 0) {
          const firstMissing = missingItems.first();
          await expect(firstMissing.locator('[data-testid="item-description"]')).toBeVisible();
          await expect(firstMissing.locator('[data-testid="complete-item-btn"]')).toBeVisible();
          
          // Click to complete item
          await firstMissing.locator('[data-testid="complete-item-btn"]').click();
          // Should navigate to relevant section
        }
      }
    });

    test("should show profile improvement suggestions", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/profile/owner-123");
      await page.locator('[data-testid="edit-profile"]').click();
      
      // Suggestions section
      const suggestionsSection = page.locator('[data-testid="profile-suggestions"]');
      if (await suggestionsSection.isVisible()) {
        await expect(suggestionsSection.locator('[data-testid="suggestion-list"]')).toBeVisible();
        
        const suggestions = suggestionsSection.locator('[data-testid="suggestion-item"]');
        const suggestionCount = await suggestions.count();
        
        if (suggestionCount > 0) {
          const firstSuggestion = suggestions.first();
          await expect(firstSuggestion.locator('[data-testid="suggestion-text"]')).toBeVisible();
          await expect(firstSuggestion.locator('[data-testid="apply-suggestion"]')).toBeVisible();
        }
      }
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should work on mobile devices", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto("/profile/user-123");
      
      // Should be mobile-friendly
      await expect(page.locator("h1")).toBeVisible();
      
      // Profile header should be responsive
      await expect(page.locator('[data-testid="profile-header"]')).toBeVisible();
      
      // Content should be scrollable
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      expect(bodyHeight).toBeGreaterThan(viewportHeight);
      
      // Test mobile profile editing
      const editBtn = page.locator('[data-testid="edit-profile"]');
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await expect(page.locator('[data-testid="profile-edit-form"]')).toBeVisible();
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should be accessible with keyboard navigation", async ({ page }) => {
      await page.goto("/profile/user-123");
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Test ARIA labels
      const interactiveElements = page.locator('button, input, select, textarea, a[href]');
      const count = await interactiveElements.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = interactiveElements.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });

    test("should support screen readers", async ({ page }) => {
      await page.goto("/profile/user-123");
      
      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
      
      // Check for landmark regions
      const landmarks = page.locator('main, nav, header, footer, section, article');
      const landmarkCount = await landmarks.count();
      expect(landmarkCount).toBeGreaterThan(0);
      
      // Check for alt text on images
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        expect(alt).toBeTruthy();
      }
    });
  });
});
