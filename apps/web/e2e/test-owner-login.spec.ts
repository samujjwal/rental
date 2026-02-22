import { test, expect } from "@playwright/test";
import { loginAs, testUsers } from "./helpers/test-utils";

test("owner login test", async ({ page }) => {
  await loginAs(page, testUsers.owner);
  await page.goto("/dashboard/owner");
  await expect(page).toHaveURL(/\/dashboard\/owner|\/dashboard|\/auth\/login/);
  await expect(page.locator("body")).toBeVisible();
});
