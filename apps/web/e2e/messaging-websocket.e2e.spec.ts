/**
 * Messaging WebSocket Integration E2E Test
 * 
 * This test validates the end-to-end WebSocket messaging flow:
 * 1. User connects to WebSocket gateway
 * 2. User authenticates via JWT
 * 3. User sends and receives messages
 * 4. User presence is tracked
 * 5. User disconnects cleanly
 * 
 * Validates real WebSocket behavior, not mocked implementations.
 */

import { test, expect } from '@playwright/test';

test.describe('Messaging WebSocket Integration E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a test user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should establish WebSocket connection with authentication', async ({ page }) => {
    // Step 1: Navigate to messaging page
    await page.goto('/messages');
    
    // Step 2: Verify WebSocket connection is established
    await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible();
    
    // Step 3: Verify authentication status
    await expect(page.locator('[data-testid="websocket-authenticated"]')).toBeVisible();
  });

  test('should send and receive messages in real-time', async ({ page, browser }) => {
    // Step 1: Open messaging page
    await page.goto('/messages/conversation/test-conversation-1');
    
    // Step 2: Send a message
    await page.fill('[data-testid="message-input"]', 'Hello, this is a test message');
    await page.click('[data-testid="send-message-button"]');
    
    // Step 3: Verify message appears in chat
    await expect(page.locator('[data-testid="message-content"]')).toHaveText('Hello, this is a test message');
    
    // Step 4: Verify message timestamp
    await expect(page.locator('[data-testid="message-timestamp"]')).toBeVisible();
  });

  test('should track user presence correctly', async ({ page }) => {
    // Step 1: Open messaging page
    await page.goto('/messages');
    
    // Step 2: Verify online status is shown
    await expect(page.locator('[data-testid="user-status-online"]')).toBeVisible();
    
    // Step 3: Navigate away from page
    await page.goto('/dashboard');
    
    // Step 4: Return to messaging and verify presence re-established
    await page.goto('/messages');
    await expect(page.locator('[data-testid="user-status-online"]')).toBeVisible();
  });

  test('should handle disconnection gracefully', async ({ page, browser }) => {
    // Step 1: Open messaging page
    await page.goto('/messages/conversation/test-conversation-1');
    
    // Step 2: Verify connection is active
    await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible();
    
    // Step 3: Close browser tab
    await page.close();
    
    // Step 4: Reopen and verify connection can be re-established
    const context = await browser.newContext();
    const newPage = await context.newPage();
    await newPage.goto('/auth/login');
    await newPage.fill('[data-testid="email"]', 'user@test.com');
    await newPage.fill('[data-testid="password"]', 'password123');
    await newPage.click('[data-testid="login-button"]');
    await newPage.waitForURL('/dashboard');
    
    await newPage.goto('/messages');
    await expect(newPage.locator('[data-testid="websocket-connected"]')).toBeVisible();
    
    await newPage.close();
  });

  test('should handle multiple users in conversation', async ({ page, browser }) => {
    // Step 1: Login as user 1
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'user1@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    // Step 2: Open conversation
    await page.goto('/messages/conversation/test-conversation-2');
    
    // Step 3: Send message
    await page.fill('[data-testid="message-input"]', 'Message from user 1');
    await page.click('[data-testid="send-message-button"]');
    
    // Step 4: Login as user 2 in new context
    const user2Context = await browser.newContext();
    const user2Page = await user2Context.newPage();
    await user2Page.goto('/auth/login');
    await user2Page.fill('[data-testid="email"]', 'user2@test.com');
    await user2Page.fill('[data-testid="password"]', 'password123');
    await user2Page.click('[data-testid="login-button"]');
    await user2Page.waitForURL('/dashboard');
    
    // Step 5: User 2 opens same conversation
    await user2Page.goto('/messages/conversation/test-conversation-2');
    
    // Step 6: Verify user 2 can see message from user 1
    await expect(user2Page.locator('[data-testid="message-content"]')).toHaveText('Message from user 1');
    
    // Step 7: User 2 replies
    await user2Page.fill('[data-testid="message-input"]', 'Reply from user 2');
    await user2Page.click('[data-testid="send-message-button"]');
    
    // Step 8: Verify user 1 can see reply (auto-retries until visible)
    await expect(page.locator('[data-testid="message-content"]').last()).toHaveText('Reply from user 2', { timeout: 5000 });
    
    await user2Page.close();
  });
});
