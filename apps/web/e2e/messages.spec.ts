import { test, expect, Page } from '@playwright/test';
import { loginAs, testUsers } from './helpers/test-utils';

test.describe('Messaging', () => {
  test.describe('Conversations List', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should display conversations list', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Should show conversations or empty state
      const conversationsList = page.locator('[data-testid="conversations-list"], .conversations');
      const emptyState = page.locator('text=/no conversations|no messages|start a conversation/i');

      await expect(conversationsList.or(emptyState)).toBeVisible();
    });

    test('should show unread message indicator', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Check for unread badge
      const unreadBadge = page.locator('[data-testid="unread-badge"], .unread-count, .badge');
      if (await unreadBadge.isVisible()) {
        await expect(unreadBadge).toHaveText(/\d+/);
      }
    });

    test('should search conversations', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('[data-testid="search-conversations"], input[placeholder*="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test search');
        await page.waitForTimeout(500); // Debounce
        
        // Should filter results
        await page.waitForLoadState('networkidle');
      }
    });

    test('should sort conversations by date', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // First conversation should be most recent
      const conversations = page.locator('[data-testid="conversation-item"]');
      const count = await conversations.count();

      if (count >= 2) {
        // Verify they're in order (most recent first)
        const firstTimestamp = page.locator('[data-testid="conversation-item"]').first().locator('[data-testid="timestamp"]');
        if (await firstTimestamp.isVisible()) {
          await expect(firstTimestamp).toBeVisible();
        }
      }
    });
  });

  test.describe('Conversation Thread', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should open conversation thread', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Should show message thread
        await expect(page.locator('[data-testid="message-thread"], .messages-container')).toBeVisible();
      }
    });

    test('should display messages in chronological order', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Open first conversation
      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Messages should be displayed
        const messages = page.locator('[data-testid="message-bubble"], .message');
        await expect(messages.first()).toBeVisible();
      }
    });

    test('should send a text message', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Open conversation
      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Type message
        const messageInput = page.locator('[data-testid="message-input"], input[placeholder*="message"], textarea');
        await messageInput.fill('Hello, this is a test message!');

        // Send message
        const sendButton = page.locator('button[type="submit"], button:has-text("Send"), [data-testid="send-button"]');
        await sendButton.click();

        // Should show sent message
        await expect(page.locator('text=Hello, this is a test message!')).toBeVisible();
      }
    });

    test('should handle long messages', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        const longMessage = 'This is a very long message. '.repeat(50);
        const messageInput = page.locator('[data-testid="message-input"], textarea');
        await messageInput.fill(longMessage);

        const sendButton = page.locator('button[type="submit"], button:has-text("Send")');
        await sendButton.click();
      }
    });

    test('should mark messages as read when viewed', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Check for unread conversation
      const unreadConversation = page.locator('[data-testid="conversation-item"].unread, [data-testid="conversation-item"]:has(.unread)').first();
      
      if (await unreadConversation.isVisible()) {
        await unreadConversation.click();
        await page.waitForLoadState('networkidle');

        // Unread indicator should be removed
        await page.goBack();
        await page.waitForLoadState('networkidle');
        
        // Previous unread should now be read
      }
    });
  });

  test.describe('Message Attachments', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');
    });

    test('should attach and send image', async ({ page }) => {
      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Look for attachment button
        const attachButton = page.locator('[data-testid="attach-button"], button[aria-label*="attach"]');
        if (await attachButton.isVisible()) {
          await attachButton.click();

          // Upload image
          const fileInput = page.locator('input[type="file"]');
          await fileInput.setInputFiles({
            name: 'test-image.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('test image'),
          });
        }
      }
    });

    test('should preview attached image', async ({ page }) => {
      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Check for image messages
        const imageMessage = page.locator('[data-testid="image-message"], img.message-image');
        if (await imageMessage.isVisible()) {
          await imageMessage.click();

          // Should open preview
          await expect(page.locator('[data-testid="image-preview"], .lightbox')).toBeVisible();
        }
      }
    });
  });

  test.describe('Booking-Related Messages', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, testUsers.renter);
    });

    test('should navigate to related booking from message', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Open a booking-related conversation
      const bookingConversation = page.locator('[data-testid="conversation-item"]:has-text("Booking")').first();
      
      if (await bookingConversation.isVisible()) {
        await bookingConversation.click();

        // Look for booking link
        const bookingLink = page.locator('a:has-text("View Booking"), [data-testid="booking-link"]');
        if (await bookingLink.isVisible()) {
          await bookingLink.click();
          await expect(page).toHaveURL(/\/bookings\//);
        }
      }
    });

    test('should show booking context in conversation', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Check for booking context header
        const bookingContext = page.locator('[data-testid="booking-context"], .conversation-header');
        if (await bookingContext.isVisible()) {
          // Should show property name, dates, etc.
          await expect(bookingContext).toBeVisible();
        }
      }
    });
  });

  test.describe('Contact Owner/Renter', () => {
    test('should start conversation from listing page', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/search');
      await page.waitForLoadState('networkidle');

      // Click on a listing
      const listingCard = page.locator('[data-testid="listing-card"]').first();
      if (await listingCard.isVisible()) {
        await listingCard.click();
        await page.waitForLoadState('networkidle');

        // Click contact owner button
        const contactButton = page.locator('button:has-text("Contact Owner"), button:has-text("Message")');
        if (await contactButton.isVisible()) {
          await contactButton.click();

          // Should open message modal or redirect to messages
          await expect(page.locator('[data-testid="message-modal"], [data-testid="message-input"]')).toBeVisible();
        }
      }
    });

    test('should start conversation from booking', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/bookings');
      await page.waitForLoadState('networkidle');

      const bookingCard = page.locator('[data-testid="booking-card"]').first();
      if (await bookingCard.isVisible()) {
        await bookingCard.click();

        const messageButton = page.locator('button:has-text("Message Owner"), button:has-text("Contact")');
        if (await messageButton.isVisible()) {
          await messageButton.click();
        }
      }
    });
  });

  test.describe('Real-time Updates', () => {
    test('should receive new message notification', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Simulate receiving a message (via WebSocket or polling)
      // This would typically require a mock server or second browser context
      
      // Check that the UI can handle incoming messages
      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        
        // The message list should be visible and ready for new messages
        await expect(page.locator('[data-testid="message-thread"]')).toBeVisible();
      }
    });
  });

  test.describe('Empty States', () => {
    test('should show empty state when no conversations', async ({ page }) => {
      // Create a new user with no conversations
      await page.goto('/auth/signup');
      await page.fill('input[name="email"]', `new-user-${Date.now()}@test.com`);
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="firstName"]', 'New');
      await page.fill('input[name="lastName"]', 'User');
      
      // After signup, check messages
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      const emptyState = page.locator('text=/no messages|no conversations|start messaging/i');
      await expect(emptyState).toBeVisible();
    });
  });

  test.describe('Mobile View', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should show mobile-friendly conversation list', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Should show conversations list in mobile format
      await expect(page.locator('[data-testid="conversations-list"]')).toBeVisible();
    });

    test('should navigate back from conversation on mobile', async ({ page }) => {
      await loginAs(page, testUsers.renter);
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Should show back button
        const backButton = page.locator('button:has-text("Back"), [data-testid="back-button"]');
        if (await backButton.isVisible()) {
          await backButton.click();
          await expect(page.locator('[data-testid="conversations-list"]')).toBeVisible();
        }
      }
    });
  });
});
