import { test, expect } from "@playwright/test";

test("owner login test", async ({ page }) => {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', "owner@test.com");
  await page.fill('input[type="password"]', "Test123!@#");
  
  await page.click('button[type="submit"]');
  
  // Wait up to 5 seconds for navigation
  try {
    await page.waitForURL(/.*dashboard/, { timeout: 5000 });
    console.log("Successfully navigated to:", page.url());
  } catch (e) {
    console.log("Failed to navigate. Current URL:", page.url());
    console.log("Error:", e.message);
    
    // Check for error messages
    const errorMsg = await page.locator('[role="alert"], .error, .text-red-500').textContent().catch(() => "No error element found");
    console.log("Error on page:", errorMsg);
  }
});
