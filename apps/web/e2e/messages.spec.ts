import { test, expect } from "@playwright/test";
import { expectAnyVisible, loginAs, testUsers } from "./helpers/test-utils";

test.describe("Messaging", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/messages");
  });

  test("should display messages page and search", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Messages/i);
    await expect(page.locator('input[placeholder="Search conversations..."]')).toBeVisible();
  });

  test("should show conversations list or empty state", async ({ page }) => {
    await expectAnyVisible(page, [
      "div.divide-y button",
      "text=No conversations yet",
    ]);
  });

  test("should filter conversations by search", async ({ page }) => {
    const search = page.locator('input[placeholder="Search conversations..."]');
    await search.fill("camera");
    await expect(search).toHaveValue("camera");
  });

  test("should show chat prompt or active composer", async ({ page }) => {
    await expectAnyVisible(page, [
      "text=Select a conversation to start messaging",
      'textarea[placeholder="Type a message..."]',
    ]);
  });

  test("should open first conversation when available", async ({ page }) => {
    const conversation = page.locator("div.divide-y button").first();
    if ((await conversation.count()) === 0) {
      await expect(page.locator("text=No conversations yet")).toBeVisible();
      return;
    }

    await conversation.click();
    await expect(page).toHaveURL(/conversation=/);
    await expectAnyVisible(page, [
      'textarea[placeholder="Type a message..."]',
      "text=No messages yet. Start the conversation!",
    ]);
  });

  test("should display attachment control for active conversation", async ({ page }) => {
    const conversation = page.locator("div.divide-y button").first();
    if ((await conversation.count()) === 0) {
      await expect(page.locator("text=No conversations yet")).toBeVisible();
      return;
    }

    await conversation.click();
    await expect(page.locator('label:has(svg.lucide-image)')).toBeVisible();
  });

  test("should allow drafting a message when composer is visible", async ({ page }) => {
    const conversation = page.locator("div.divide-y button").first();
    if ((await conversation.count()) === 0) {
      await expect(page.locator("text=No conversations yet")).toBeVisible();
      return;
    }

    await conversation.click();
    const composer = page.locator('textarea[placeholder="Type a message..."]');
    await composer.fill("Test draft message");
    await expect(composer).toHaveValue("Test draft message");
  });

  test("should show filtered empty state for unmatched query", async ({ page }) => {
    const search = page.locator('input[placeholder="Search conversations..."]');
    await search.fill("zzzz-non-existent-conversation");
    await expect(page.locator("text=No conversations yet")).toBeVisible();
  });

  test("should load booking-context message entry route", async ({ page }) => {
    await page.goto("/messages?booking=00000000-0000-0000-0000-000000000000");
    await expect(page.locator("h1")).toContainText(/Messages/i);
    await expect(page).toHaveURL(/\/messages/);
  });

  test("should load listing-context message entry route", async ({ page }) => {
    await page.goto(
      "/messages?listing=00000000-0000-0000-0000-000000000000&participant=00000000-0000-0000-0000-000000000000"
    );
    await expect(page.locator("h1")).toContainText(/Messages/i);
    await expect(page).toHaveURL(/\/messages/);
  });

  test("should render mobile conversation pane", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/messages");
    await expect(page.locator("h1")).toContainText(/Messages/i);
    await expectAnyVisible(page, [
      "div.divide-y button",
      "text=No conversations yet",
    ]);
  });
});
