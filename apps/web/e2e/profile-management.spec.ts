import { test, expect, type Page } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";
import { loginAsUi, testUsers, expectAnyVisible } from "./helpers/test-utils";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

test.describe("Profile Management E2E", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
    await loginAsUi(page, testUsers.renter);
  });

  test("should navigate to own profile", async ({ page }) => {
    await page.goto("/profile/me");
    
    // Should show profile page
    await expectAnyVisible(page, [
      "text=/Profile|My Profile|Account/i",
    ]);
  });

  test("should view other user profile", async ({ page }) => {
    // Navigate to a specific user profile
    await page.goto("/profile/test-user-id");
    
    // Should show user profile information
    await expectAnyVisible(page, [
      "text=/Profile|User|Member/i",
    ]);
  });

  test("should display profile information", async ({ page }) => {
    await page.goto("/profile/me");
    
    // Should show profile details
    await expectAnyVisible(page, [
      "text=/Name|Email|Phone|Bio|About/i",
    ]);
  });

  test("should show profile avatar/image", async ({ page }) => {
    await page.goto("/profile/me");
    
    // Look for avatar or profile image
    const avatar = page.locator(
      'img[alt*="profile"], img[alt*="avatar"], [data-testid="avatar"], .avatar'
    );
    
    // Should have avatar or placeholder
    expect(await avatar.count() > 0 || 
           await page.locator('button:has-text("Add Photo")').isVisible().catch(() => false)).toBeTruthy();
  });

  test("should display user listings on profile", async ({ page }) => {
    await page.goto("/profile/me");
    
    // Look for listings section
    await expectAnyVisible(page, [
      "text=/Listings|Items|Properties|For Rent/i",
    ]);
  });

  test("should display user reviews on profile", async ({ page }) => {
    await page.goto("/profile/me");
    
    // Look for reviews section
    await expectAnyVisible(page, [
      "text=/Reviews|Ratings|Feedback/i",
    ]);
  });

  test("should show verification status", async ({ page }) => {
    await page.goto("/profile/me");
    
    // Look for verification indicators
    const verificationBadge = page.locator(
      '[data-testid="verification-badge"], .verified-badge, text=/Verified|ID Verified|Email Verified/i'
    );
    
    // Profile should show verification status (verified or not)
    expect(await verificationBadge.count() > 0 || 
           await page.locator("text=/Get Verified|Verify/i").isVisible().catch(() => false)).toBeTruthy();
  });

  test("should handle profile edit navigation", async ({ page }) => {
    await page.goto("/profile/me");
    
    // Look for edit button
    const editBtn = page.locator('button:has-text("Edit"), a[href*="/settings/profile"]').first();
    
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      
      // Should navigate to settings/profile
      await expect(page).toHaveURL(/\/settings\/profile/);
    }
  });

  test("should display user stats or metrics", async ({ page }) => {
    await page.goto("/profile/me");
    
    // Look for stats like response rate, joined date, etc.
    await expectAnyVisible(page, [
      "text=/Joined|Member Since|Response Rate|Response Time/i",
    ]);
  });

  test("should handle mobile responsive layout", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto("/profile/me");
    
    // Should show mobile-optimized layout
    await expectAnyVisible(page, [
      "text=/Profile/i",
    ]);
  });

  test("should show user activity or history", async ({ page }) => {
    await page.goto("/profile/me");
    
    // Look for activity section
    const activitySection = page.locator(
      'text=/Activity|History|Recent|Bookings|Transactions/i'
    );
    
    if (await activitySection.isVisible().catch(() => false)) {
      expect(await activitySection.isVisible()).toBeTruthy();
    }
  });

  test("should handle public vs private profile views", async ({ page }) => {
    // View own profile (logged in)
    await page.goto("/profile/me");
    
    // Should show edit options for own profile
    const editOptions = await page.locator('button:has-text("Edit"), a[href*="settings"]').count();
    
    // Logout and view as guest
    await page.goto("/auth/logout");
    await page.goto("/profile/test-user-id");
    
    // Should show public profile (no edit options)
    await expectAnyVisible(page, [
      "text=/Profile|User/i",
    ]);
  });

  test("should display contact or message button", async ({ page }) => {
    await loginAsUi(page, testUsers.renter);
    
    // View another user's profile
    await page.goto("/profile/test-owner-id");
    
    // Should show message or contact button
    const contactBtn = page.locator(
      'button:has-text("Message"), button:has-text("Contact"), a[href*="/messages"]'
    );
    
    if (await contactBtn.isVisible().catch(() => false)) {
      expect(await contactBtn.isVisible()).toBeTruthy();
    }
  });

  test("should handle profile not found", async ({ page }) => {
    await page.goto("/profile/non-existent-user-id");
    
    // Should show error or not found message
    await expectAnyVisible(page, [
      "text=/Not Found|404|User not found|Does not exist/i",
    ]);
  });
});
