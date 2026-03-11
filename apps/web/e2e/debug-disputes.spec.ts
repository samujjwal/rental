import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/test-utils";

test.describe("Disputes Navigation Debug", () => {
  test("direct navigation to disputes page", async ({ page }) => {
    await loginAsAdmin(page);
    
    // Try direct navigation
    await page.goto("/admin/disputes");
    await page.waitForLoadState('networkidle');

    console.log("Current URL:", page.url());
    console.log("Page title:", await page.title());
    
    // Check what's on the page
    const bodyText = await page.locator('body').textContent();
    console.log("Body contains 'dispute':", bodyText?.toLowerCase().includes('dispute'));
    console.log("Body contains 'admin':", bodyText?.toLowerCase().includes('admin'));
    
    // Take screenshot
    await page.screenshot({ path: 'dispute-debug-direct.png', fullPage: true });
    
    // Check if dispute page loaded
    const hasDisputeHeading = await page.locator('h1, h2').filter({ hasText: /dispute/i }).isVisible({ timeout: 5000 }).catch(() => false);
    const hasDisputesList = await page.locator('[data-testid="disputes-list"]').isVisible({ timeout: 5000 }).catch(() => false);
    
    console.log("Has dispute heading:", hasDisputeHeading);
    console.log("Has disputes list:", hasDisputesList);
    
    expect(hasDisputeHeading || hasDisputesList).toBe(true);
  });

  test("sidebar navigation to disputes page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await page.waitForLoadState('networkidle');

    
    // Check if sidebar link exists
    const disputeLink = page.locator('a[href="/admin/disputes"]').first();
    const linkVisible = await disputeLink.isVisible({ timeout: 5000 }).catch(() => false);
    console.log("Dispute sidebar link visible:", linkVisible);
    
    if (linkVisible) {
      console.log("Link text:", await disputeLink.textContent());
      await disputeLink.click();
      await page.waitForLoadState('networkidle');

      console.log("After click, URL:", page.url());
      await page.screenshot({ path: 'dispute-debug-sidebar.png', fullPage: true });
      
      const hasDisputeHeading = await page.locator('h1, h2').filter({ hasText: /dispute/i }).isVisible({ timeout: 5000 }).catch(() => false);
      console.log("Has dispute heading after sidebar click:", hasDisputeHeading);
      
      expect(hasDisputeHeading).toBe(true);
    } else {
      console.log("Dispute link not found in sidebar");
      await page.screenshot({ path: 'dispute-debug-no-link.png', fullPage: true });
      expect(linkVisible).toBe(true); // This will fail and show the issue
    }
  });
});
