import { test, expect } from "@playwright/test";
import { testUsers } from "./helpers/fixtures";

/**
 * Diagnostic tests to debug login issues
 */

test("diagnose renter login", async ({ page }) => {
  await page.goto("/auth/login");
  console.log("✓ Navigated to login page");
  
  // Fill form
  await page.fill('input[type="email"]', testUsers.renter.email);
  console.log(`✓ Filled email: ${testUsers.renter.email}`);
  
  await page.fill('input[type="password"]', testUsers.renter.password);
  console.log(`✓ Filled password: ${testUsers.renter.password}`);
  
  // Take screenshot before submission
  await page.screenshot({ path: "./test-results/diagnostic-before-login.png" });
  
  // Click submit
  await page.click('button[type="submit"]');
  console.log("✓ Clicked submit button");
  
  // Wait a bit for response
  await page.waitForTimeout(3000);
  
  // Get the current URL
  const currentUrl = page.url();
  console.log(`Current URL after submit: ${currentUrl}`);
  
  // Take screenshot after submission
  await page.screenshot({ path: "./test-results/diagnostic-after-login.png" });
  
  // Check for any error messages
  const errorTexts = await page.locator('[class*="error"], [role="alert"], .text-red-500, .text-red-600, .text-danger').all();
  if (errorTexts.length > 0) {
    console.log(`\n❌ Found ${errorTexts.length} error elements:`);
    for (const el of errorTexts) {
      const text = await el.textContent();
      console.log(`  - ${text}`);
    }
  }
  
  // Check entire body for any error keywords
  const bodyText = await page.locator('body').textContent();
  const errorKeywords = ['error', 'invalid', 'incorrect', 'failed', 'denied'];
  const foundErrors = errorKeywords.filter(keyword => 
    bodyText?.toLowerCase().includes(keyword)
  );
  
  if (foundErrors.length > 0) {
    console.log(`\n❌ Found error keywords in page: ${foundErrors.join(', ')}`);
    console.log(`\nPage content snippet:\n${bodyText?.substring(0, 500)}`);
  }
  
  // Check console logs
  page.on('console', msg => {
    console.log(`Browser console [${msg.type()}]: ${msg.text()}`);
  });
  
  // Check for API errors
  page.on('response', async response => {
    if (response.url().includes('/auth') || response.url().includes('/login')) {
      console.log(`\n📡 API Response:`, response.url());
      console.log(`   Status: ${response.status()} ${response.statusText()}`);
      try {
        const body = await response.text();
        console.log(`   Body: ${body.substring(0, 300)}`);
      } catch (e) {
        console.log(`   Could not read response body`);
      }
    }
  });
  
  // Final check
  if (currentUrl.includes('/auth/login')) {
    console.log('\n⚠️  Still on login page - login did not succeed');
  } else {
    console.log(`\n✓ Redirected to: ${currentUrl}`);
  }
});
