import { test, expect } from "@playwright/test";
import { loginAs, testUsers } from "./helpers/test-utils";

test.describe("Admin Basic Test", () => {
  test("admin can access dashboard", async ({ page }) => {
    await loginAs(page, testUsers.admin);
    await page.goto("/admin");
    await page.waitForLoadState('networkidle');
    
    // Check if we're on admin page
    const url = page.url();
    expect(url).toContain('/admin');
    
    // Check for admin content
    const body = await page.textContent('body');
    console.log('Body contains:', body?.substring(0, 200));
  });
});
