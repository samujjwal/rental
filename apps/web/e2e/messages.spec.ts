import { test, expect } from "@playwright/test";
import { expectAnyVisible, loginAs, testUsers } from "./helpers/test-utils";

test.describe("Messaging", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.renter);
    await page.goto("/messages");
  });

  test("should display messages page and search", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Messages/i);
    await expect(page.locator('[data-testid="conversation-search"]')).toBeVisible();
  });

  test("should show conversations list or empty state", async ({ page }) => {
    await expectAnyVisible(page, [
      '[data-testid="conversation-item"]',
      '[data-testid="conversation-empty-state"]',
    ]);
  });

  test("should filter conversations by search", async ({ page }) => {
    const search = page.locator('[data-testid="conversation-search"]');
    await search.fill("camera");
    await expect(search).toHaveValue("camera");
  });

  test("should show chat prompt or active composer", async ({ page }) => {
    await expectAnyVisible(page, [
      '[data-testid="message-empty-prompt"]',
      '[data-testid="message-composer"]',
    ]);
  });

  test("should open first conversation when available", async ({ page }) => {
    await expectAnyVisible(page, [
      '[data-testid="conversation-item"]',
      '[data-testid="conversation-empty-state"]',
    ]);
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if ((await conversation.count()) === 0) {
      await expect(page.locator('[data-testid="conversation-empty-state"]')).toBeVisible();
      return;
    }

    await conversation.click();
    await expect(page).toHaveURL(/conversation=/);
    await expectAnyVisible(page, [
      '[data-testid="message-composer"]',
      '[data-testid="message-empty-state"]',
    ]);
  });

  test("should display attachment control for active conversation", async ({ page }) => {
    await expectAnyVisible(page, [
      '[data-testid="conversation-item"]',
      '[data-testid="conversation-empty-state"]',
    ]);
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if ((await conversation.count()) === 0) {
      await expect(page.locator('[data-testid="conversation-empty-state"]')).toBeVisible();
      return;
    }

    await conversation.click();
    await expect(page.locator('[data-testid="message-attachment-button"]')).toBeVisible();
  });

  test("should allow drafting a message when composer is visible", async ({ page }) => {
    await expectAnyVisible(page, [
      '[data-testid="conversation-item"]',
      '[data-testid="conversation-empty-state"]',
    ]);
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    if ((await conversation.count()) === 0) {
      await expect(page.locator('[data-testid="conversation-empty-state"]')).toBeVisible();
      return;
    }

    await conversation.click();
    const composer = page.locator('[data-testid="message-composer"]');
    await composer.fill("Test draft message");
    await expect(composer).toHaveValue("Test draft message");
  });

  test("should show filtered empty state for unmatched query", async ({ page }) => {
    const search = page.locator('[data-testid="conversation-search"]');
    await search.fill("zzzz-non-existent-conversation");
    await expect(page.locator('[data-testid="conversation-empty-state"]')).toBeVisible();
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
      '[data-testid="conversation-item"]',
      '[data-testid="conversation-empty-state"]',
    ]);
  });
});
