import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

/**
 * WebSocket Real-time Features E2E Tests
 * 
 * Tests comprehensive real-time functionality:
 * - WebSocket connection management
 * - Real-time messaging
 * - Live booking updates
 * - Real-time notifications
 * - Presence indicators
 * - Connection error handling
 */

test.describe("WebSocket Real-time Features", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("WebSocket Connection Management", () => {
    test("should establish WebSocket connection", async ({ page }) => {
      // Login as user
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to dashboard
      await page.goto("/dashboard");
      
      // Should establish WebSocket connection
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Should show connection status
      await expect(page.locator('[data-testid="connection-status"]')).toContainText(/connected|online/i);
      
      // Should have WebSocket instance
      const wsStatus = await page.evaluate(() => {
        return (window as any).socket?.connected || false;
      });
      expect(wsStatus).toBe(true);
    });

    test("should handle WebSocket reconnection", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      
      // Wait for initial connection
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Simulate connection loss
      await page.evaluate(() => {
        if ((window as any).socket) {
          (window as any).socket.disconnect();
        }
      });
      
      // Should show disconnected status
      await expect(page.locator('[data-testid="connection-status"]')).toContainText(/disconnected|offline/i);
      await expect(page.locator('[data-testid="websocket-disconnected"]')).toBeVisible();
      
      // Should attempt reconnection
      await expect(page.locator('[data-testid="reconnecting"]')).toBeVisible({ timeout: 3000 });
      
      // Should reconnect successfully
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="connection-status"]')).toContainText(/connected|online/i);
    });

    test("should handle connection errors gracefully", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      
      // Mock WebSocket connection error
      await page.route('**/socket.io/**', route => route.abort('failed'));
      
      // Should show connection error
      await expect(page.locator('[data-testid="connection-error"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/connection failed/i);
      
      // Should show retry option
      await expect(page.locator('[data-testid="retry-connection"]')).toBeVisible();
      
      // Should provide offline mode
      await expect(page.locator('[data-testid="offline-mode"]')).toBeVisible();
      
      // Remove mock and retry
      await page.unroute('**/socket.io/**');
      await page.locator('[data-testid="retry-connection"]').click();
      
      // Should reconnect successfully
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 10000 });
    });

    test("should maintain connection across page navigation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      
      // Wait for connection
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Navigate to different pages
      await page.goto("/bookings");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible();
      
      await page.goto("/messages");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible();
      
      await page.goto("/search");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible();
      
      // Should maintain connection ID
      const connectionId = await page.evaluate(() => {
        return (window as any).socket?.id;
      });
      expect(connectionId).toBeTruthy();
    });
  });

  test.describe("Real-time Messaging", () => {
    test("should send and receive messages in real-time", async ({ page }) => {
      // Setup two users in separate contexts
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      try {
        // Login first user
        await page1.goto("/auth/login");
        await page1.fill('[data-testid="email"]', "user1@example.com");
        await page1.fill('[data-testid="password"]', "password123");
        await page1.click('[data-testid="login-button"]');
        
        // Login second user
        await page2.goto("/auth/login");
        await page2.fill('[data-testid="email"]', "user2@example.com");
        await page2.fill('[data-testid="password"]', "password123");
        await page2.click('[data-testid="login-button"]');
        
        // Navigate to messages
        await page1.goto("/messages");
        await page2.goto("/messages");
        
        // Wait for WebSocket connections
        await expect(page1.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(page2.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Start conversation from user1
        await page1.locator('[data-testid="new-conversation"]').click();
        await page1.fill('[data-testid="recipient-search"]', "user2@example.com");
        await page1.locator('[data-testid="user-result"]').first().click();
        
        // Send message
        await page1.fill('[data-testid="message-input"]', "Hello from user1!");
        await page1.locator('[data-testid="send-message"]').click();
        
        // Should show message in user1's chat
        await expect(page1.locator('[data-testid="message-sent"]')).toBeVisible();
        await expect(page1.locator('text=Hello from user1!')).toBeVisible();
        
        // Should receive message in user2's chat in real-time
        await expect(page2.locator('[data-testid="message-received"]')).toBeVisible({ timeout: 5000 });
        await expect(page2.locator('text=Hello from user1!')).toBeVisible();
        
        // Send reply from user2
        await page2.fill('[data-testid="message-input"]', "Hello back from user2!");
        await page2.locator('[data-testid="send-message"]').click();
        
        // Should receive reply in user1's chat
        await expect(page1.locator('[data-testid="message-received"]')).toBeVisible({ timeout: 5000 });
        await expect(page1.locator('text=Hello back from user2!')).toBeVisible();
        
        // Should show typing indicators
        await page1.fill('[data-testid="message-input"]', "typing...");
        await expect(page2.locator('[data-testid="typing-indicator"]')).toBeVisible({ timeout: 3000 });
        
        await page1.locator('[data-testid="message-input"]').fill("");
        await expect(page2.locator('[data-testid="typing-indicator"]')).not.toBeVisible({ timeout: 3000 });
        
      } finally {
        await context1.close();
        await context2.close();
      }
    });

    test("should handle message delivery status", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user1@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/messages");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Start conversation
      await page.locator('[data-testid="new-conversation"]').click();
      await page.fill('[data-testid="recipient-search"]', "user2@example.com");
      await page.locator('[data-testid="user-result"]').first().click();
      
      // Send message
      await page.fill('[data-testid="message-input"]', "Test message");
      await page.locator('[data-testid="send-message"]').click();
      
      // Should show sending status
      await expect(page.locator('[data-testid="message-sending"]')).toBeVisible();
      
      // Should show sent status
      await expect(page.locator('[data-testid="message-sent"]')).toBeVisible({ timeout: 5000 });
      
      // Should show delivered status (if recipient is online)
      await expect(page.locator('[data-testid="message-delivered"]')).toBeVisible({ timeout: 10000 });
      
      // Should show read status (if message is read)
      await expect(page.locator('[data-testid="message-read"]')).toBeVisible({ timeout: 15000 });
    });

    test("should handle offline message queuing", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user1@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/messages");
      
      // Disconnect WebSocket
      await page.evaluate(() => {
        if ((window as any).socket) {
          (window as any).socket.disconnect();
        }
      });
      
      await expect(page.locator('[data-testid="websocket-disconnected"]')).toBeVisible();
      
      // Start conversation
      await page.locator('[data-testid="new-conversation"]').click();
      await page.fill('[data-testid="recipient-search"]', "user2@example.com");
      await page.locator('[data-testid="user-result"]').first().click();
      
      // Send message while offline
      await page.fill('[data-testid="message-input"]', "Offline message");
      await page.locator('[data-testid="send-message"]').click();
      
      // Should show queued status
      await expect(page.locator('[data-testid="message-queued"]')).toBeVisible();
      
      // Reconnect WebSocket
      await page.evaluate(() => {
        if ((window as any).socket) {
          (window as any).socket.connect();
        }
      });
      
      // Should send queued messages when reconnected
      await expect(page.locator('[data-testid="message-sent"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Live Booking Updates", () => {
    test("should receive booking updates in real-time", async ({ page }) => {
      // Setup owner and renter contexts
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      
      const renterContext = await browser.newContext();
      const renterPage = await renterContext.newPage();
      
      try {
        // Login as owner
        await ownerPage.goto("/auth/login");
        await ownerPage.fill('[data-testid="email"]', "owner@example.com");
        await ownerPage.fill('[data-testid="password"]', "password123");
        await ownerPage.click('[data-testid="login-button"]');
        
        // Login as renter
        await renterPage.goto("/auth/login");
        await renterPage.fill('[data-testid="email"]', "renter@example.com");
        await renterPage.fill('[data-testid="password"]', "password123");
        await renterPage.click('[data-testid="login-button"]');
        
        // Navigate to booking pages
        await ownerPage.goto("/dashboard/owner");
        await renterPage.goto("/bookings");
        
        // Wait for WebSocket connections
        await expect(ownerPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(renterPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Renter makes a booking
        await renterPage.goto("/listings/listing-123");
        await renterPage.fill('[data-testid="check-in"]', "2025-02-01");
        await renterPage.fill('[data-testid="check-out"]', "2025-02-03");
        await renterPage.locator('[data-testid="book-now"]').click();
        
        // Complete booking process
        await renterPage.fill('[data-testid="card-number"]', "4242424242424242");
        await renterPage.fill('[data-testid="card-expiry"]', "12/25");
        await renterPage.fill('[data-testid="card-cvc"]', "123");
        await renterPage.locator('[data-testid="confirm-booking"]').click();
        
        // Owner should receive real-time notification
        await expect(ownerPage.locator('[data-testid="new-booking-notification"]')).toBeVisible({ timeout: 10000 });
        await expect(ownerPage.locator('[data-testid="booking-alert"]')).toContainText(/new booking/i);
        
        // Owner dashboard should update
        await ownerPage.reload();
        await expect(ownerPage.locator('[data-testid="pending-bookings"]')).toContainText('1');
        
        // Owner accepts booking
        await ownerPage.locator('[data-testid="accept-booking"]').click();
        await ownerPage.locator('[data-testid="confirm-accept"]').click();
        
        // Renter should receive real-time update
        await expect(renterPage.locator('[data-testid="booking-accepted-notification"]')).toBeVisible({ timeout: 10000 });
        await expect(renterPage.locator('[data-testid="booking-status"]')).toContainText(/confirmed|accepted/i);
        
      } finally {
        await ownerContext.close();
        await renterContext.close();
      }
    });

    test("should show real-time availability updates", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/listings/listing-123");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Should show current availability
      await expect(page.locator('[data-testid="availability-calendar"]')).toBeVisible();
      
      // Simulate booking from another user
      await page.evaluate(() => {
        // Mock real-time booking event
        (window as any).socket?.emit('booking:created', {
          listingId: 'listing-123',
          dates: ['2025-02-01', '2025-02-02'],
          status: 'pending'
        });
      });
      
      // Should update availability in real-time
      await expect(page.locator('[data-testid="availability-updated"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="date-2025-02-01"]')).toHaveClass(/booked|pending/);
      
      // Should show booking indicator
      await expect(page.locator('[data-testid="booking-indicator"]')).toBeVisible();
    });

    test("should handle booking status changes", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "renter@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/bookings/booking-123");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Initial status
      await expect(page.locator('[data-testid="booking-status"]')).toContainText(/confirmed/i);
      
      // Simulate status change
      await page.evaluate(() => {
        (window as any).socket?.emit('booking:status:changed', {
          bookingId: 'booking-123',
          status: 'cancelled',
          reason: 'Owner cancelled'
        });
      });
      
      // Should update status in real-time
      await expect(page.locator('[data-testid="booking-status"]')).toContainText(/cancelled/i, { timeout: 5000 });
      await expect(page.locator('[data-testid="status-change-notification"]')).toBeVisible();
      
      // Should show cancellation details
      await expect(page.locator('[data-testid="cancellation-reason"]')).toContainText('Owner cancelled');
    });
  });

  test.describe("Real-time Notifications", () => {
    test("should receive notifications in real-time", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Should show notification bell
      await expect(page.locator('[data-testid="notification-bell"]')).toBeVisible();
      
      // Simulate incoming notification
      await page.evaluate(() => {
        (window as any).socket?.emit('notification:new', {
          id: 'notif-123',
          type: 'message',
          title: 'New Message',
          body: 'You have a new message from John Doe',
          timestamp: new Date().toISOString()
        });
      });
      
      // Should show notification badge
      await expect(page.locator('[data-testid="notification-badge"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="notification-count"]')).toContainText('1');
      
      // Should show notification popup
      await expect(page.locator('[data-testid="notification-popup"]')).toBeVisible();
      await expect(page.locator('[data-testid="notification-title"]')).toContainText('New Message');
      await expect(page.locator('[data-testid="notification-body"]')).toContainText('John Doe');
      
      // Click notification to open details
      await page.locator('[data-testid="notification-popup"]').click();
      
      // Should navigate to relevant page
      await expect(page).toHaveURL(/.*\/messages/);
      
      // Should clear notification badge
      await expect(page.locator('[data-testid="notification-badge"]')).not.toBeVisible();
    });

    test("should handle notification preferences", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/notifications");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Disable message notifications
      await page.uncheck('[data-testid="message-notifications"]');
      await page.locator('[data-testid="save-preferences"]').click();
      
      await expect(page.locator('[data-testid="preferences-saved"]')).toBeVisible();
      
      // Simulate message notification
      await page.evaluate(() => {
        (window as any).socket?.emit('notification:new', {
          id: 'notif-456',
          type: 'message',
          title: 'New Message',
          body: 'You have a new message'
        });
      });
      
      // Should not show notification popup
      await expect(page.locator('[data-testid="notification-popup"]')).not.toBeVisible({ timeout: 5000 });
      
      // Should not show notification badge
      await expect(page.locator('[data-testid="notification-badge"]')).not.toBeVisible();
      
      // Enable message notifications
      await page.check('[data-testid="message-notifications"]');
      await page.locator('[data-testid="save-preferences"]').click();
      
      // Simulate another message notification
      await page.evaluate(() => {
        (window as any).socket?.emit('notification:new', {
          id: 'notif-789',
          type: 'message',
          title: 'New Message',
          body: 'You have a new message'
        });
      });
      
      // Should show notification
      await expect(page.locator('[data-testid="notification-popup"]')).toBeVisible({ timeout: 5000 });
    });

    test("should handle notification history", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/notifications");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Should show notification history
      await expect(page.locator('[data-testid="notification-list"]')).toBeVisible();
      
      // Simulate multiple notifications
      await page.evaluate(() => {
        (window as any).socket?.emit('notification:new', {
          id: 'notif-1',
          type: 'booking',
          title: 'Booking Confirmed',
          body: 'Your booking has been confirmed'
        });
        
        (window as any).socket?.emit('notification:new', {
          id: 'notif-2',
          type: 'message',
          title: 'New Message',
          body: 'You have a new message'
        });
      });
      
      // Should update notification list in real-time
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(2, { timeout: 5000 });
      
      // Should mark notifications as read
      await page.locator('[data-testid="notification-item"]').first().click();
      
      await expect(page.locator('[data-testid="notification-item"]').first()).toHaveClass(/read/);
    });
  });

  test.describe("Presence Indicators", () => {
    test("should show online/offline status", async ({ page }) => {
      // Setup two users
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      try {
        // Login both users
        await page1.goto("/auth/login");
        await page1.fill('[data-testid="email"]', "user1@example.com");
        await page1.fill('[data-testid="password"]', "password123");
        await page1.click('[data-testid="login-button"]');
        
        await page2.goto("/auth/login");
        await page2.fill('[data-testid="email"]', "user2@example.com");
        await page2.fill('[data-testid="password"]', "password123");
        await page2.click('[data-testid="login-button"]');
        
        // Navigate to messages
        await page1.goto("/messages");
        await page2.goto("/messages");
        
        // Wait for connections
        await expect(page1.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(page2.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Start conversation
        await page1.locator('[data-testid="new-conversation"]').click();
        await page1.fill('[data-testid="recipient-search"]', "user2@example.com");
        await page1.locator('[data-testid="user-result"]').first().click();
        
        // Should show user2 as online
        await expect(page1.locator('[data-testid="user-status"]')).toContainText(/online|available/i);
        await expect(page1.locator('[data-testid="online-indicator"]')).toBeVisible();
        
        // User2 goes offline
        await page2.evaluate(() => {
          if (window.socket) {
            window.socket.disconnect();
          }
        });
        
        // Should show user2 as offline
        await expect(page1.locator('[data-testid="user-status"]')).toContainText(/offline|away/i, { timeout: 10000 });
        await expect(page1.locator('[data-testid="offline-indicator"]')).toBeVisible();
        
        // User2 comes back online
        await page2.evaluate(() => {
          if (window.socket) {
            window.socket.connect();
          }
        });
        
        // Should show user2 as online again
        await expect(page1.locator('[data-testid="user-status"]')).toContainText(/online|available/i, { timeout: 10000 });
        await expect(page1.locator('[data-testid="online-indicator"]')).toBeVisible();
        
      } finally {
        await context1.close();
        await context2.close();
      }
    });

    test("should show last seen timestamps", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/messages");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Start conversation
      await page.locator('[data-testid="new-conversation"]').click();
      await page.fill('[data-testid="recipient-search"]', "user2@example.com");
      await page.locator('[data-testid="user-result"]').first().click();
      
      // Should show last seen when user is offline
      await expect(page.locator('[data-testid="last-seen"]')).toBeVisible();
      
      const lastSeenText = await page.locator('[data-testid="last-seen"]').textContent();
      expect(lastSeenText).toMatch(/last seen|active/i);
    });

    test("should handle presence in multiple tabs", async ({ page }) => {
      // Open multiple tabs for same user
      const page1 = page;
      const page2 = await page.context().newPage();
      
      // Login in first tab
      await page1.goto("/auth/login");
      await page1.fill('[data-testid="email"]', "user@example.com");
      await page1.fill('[data-testid="password"]', "password123");
      await page1.click('[data-testid="login-button"]');
      
      // Navigate to dashboard in both tabs
      await page1.goto("/dashboard");
      await page2.goto("/dashboard");
      
      // Wait for connections
      await expect(page1.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Should show presence in both tabs
      await expect(page1.locator('[data-testid="presence-indicator"]')).toBeVisible();
      await expect(page2.locator('[data-testid="presence-indicator"]')).toBeVisible();
      
      // Close one tab
      await page2.close();
      
      // Should maintain connection in remaining tab
      await expect(page1.locator('[data-testid="websocket-connected"]')).toBeVisible();
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should work on mobile devices", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      
      // Should establish WebSocket connection on mobile
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Should show mobile-optimized connection status
      await expect(page.locator('[data-testid="mobile-connection-status"]')).toBeVisible();
      
      // Should handle mobile background/foreground
      await page.evaluate(() => {
        // Simulate app going to background
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            window.socket?.disconnect();
          } else {
            window.socket?.connect();
          }
        });
        
        // Trigger visibility change
        Object.defineProperty(document, 'hidden', {
          get: () => true,
          configurable: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      // Should disconnect when hidden
      await expect(page.locator('[data-testid="websocket-disconnected"]')).toBeVisible();
      
      // Simulate app coming to foreground
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          get: () => false,
          configurable: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      // Should reconnect when visible
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Accessibility", () => {
    test("should announce connection status changes", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      
      // Should announce connection status
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toHaveAttribute('aria-live', 'polite');
      
      // Should announce notifications
      await page.evaluate(() => {
        window.socket?.emit('notification:new', {
          id: 'notif-123',
          type: 'message',
          title: 'New Message',
          body: 'You have a new message'
        });
      });
      
      const notificationPopup = page.locator('[data-testid="notification-popup"]');
      await expect(notificationPopup).toHaveAttribute('aria-live', 'assertive');
    });

    test("should be keyboard accessible", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/messages");
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Test keyboard shortcuts
      await page.keyboard.press('n'); // New message shortcut
      await expect(page.locator('[data-testid="new-conversation-modal"]')).toBeVisible();
      
      await page.keyboard.press('Escape'); // Close modal
      await expect(page.locator('[data-testid="new-conversation-modal"]')).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────
  // BOOKING STATE SYNC TESTS (Task 1.5.2)
  // ──────────────────────────────────────────────────────

  test.describe("Multi-Client Booking Synchronization", () => {
    test("should sync booking updates across multiple clients", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      // Setup multiple client contexts
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      
      const renterContext1 = await browser.newContext();
      const renterPage1 = await renterContext1.newPage();
      
      const renterContext2 = await browser.newContext();
      const renterPage2 = await renterContext2.newPage();
      
      try {
        // Login all users
        await ownerPage.goto("/auth/login");
        await ownerPage.fill('[data-testid="email"]', "owner@example.com");
        await ownerPage.fill('[data-testid="password"]', "password123");
        await ownerPage.click('[data-testid="login-button"]');
        
        await renterPage1.goto("/auth/login");
        await renterPage1.fill('[data-testid="email"]', "renter1@example.com");
        await renterPage1.fill('[data-testid="password"]', "password123");
        await renterPage1.click('[data-testid="login-button"]');
        
        await renterPage2.goto("/auth/login");
        await renterPage2.fill('[data-testid="email"]', "renter2@example.com");
        await renterPage2.fill('[data-testid="password"]', "password123");
        await renterPage2.click('[data-testid="login-button"]');
        
        // Navigate to booking pages
        await ownerPage.goto("/dashboard/owner");
        await renterPage1.goto("/bookings/booking-123");
        await renterPage2.goto("/bookings/booking-123");
        
        // Wait for WebSocket connections
        await expect(ownerPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(renterPage1.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(renterPage2.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Owner accepts booking
        await ownerPage.locator('[data-testid="accept-booking"]').click();
        await ownerPage.locator('[data-testid="confirm-accept"]').click();
        
        // All clients should receive real-time update
        await expect(renterPage1.locator('[data-testid="booking-status"]')).toContainText(/confirmed|accepted/i, { timeout: 10000 });
        await expect(renterPage2.locator('[data-testid="booking-status"]')).toContainText(/confirmed|accepted/i, { timeout: 10000 });
        
        // Should show real-time notifications
        await expect(renterPage1.locator('[data-testid="booking-accepted-notification"]')).toBeVisible();
        await expect(renterPage2.locator('[data-testid="booking-accepted-notification"]')).toBeVisible();
        
        // Verify state consistency across all clients
        const ownerStatus = await ownerPage.locator('[data-testid="booking-status"]').textContent();
        const renter1Status = await renterPage1.locator('[data-testid="booking-status"]').textContent();
        const renter2Status = await renterPage2.locator('[data-testid="booking-status"]').textContent();
        
        expect(ownerStatus).toContain(/confirmed|accepted/i);
        expect(renter1Status).toContain(/confirmed|accepted/i);
        expect(renter2Status).toContain(/confirmed|accepted/i);
        
      } finally {
        await ownerContext.close();
        await renterContext1.close();
        await renterContext2.close();
      }
    });

    test("should handle simultaneous booking attempts", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      // Setup two renters attempting same booking
      const renterContext1 = await browser.newContext();
      const renterPage1 = await renterContext1.newPage();
      
      const renterContext2 = await browser.newContext();
      const renterPage2 = await renterContext2.newPage();
      
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      
      try {
        // Login all users
        await renterPage1.goto("/auth/login");
        await renterPage1.fill('[data-testid="email"]', "renter1@example.com");
        await renterPage1.fill('[data-testid="password"]', "password123");
        await renterPage1.click('[data-testid="login-button"]');
        
        await renterPage2.goto("/auth/login");
        await renterPage2.fill('[data-testid="email"]', "renter2@example.com");
        await renterPage2.fill('[data-testid="password"]', "password123");
        await renterPage2.click('[data-testid="login-button"]');
        
        await ownerPage.goto("/auth/login");
        await ownerPage.fill('[data-testid="email"]', "owner@example.com");
        await ownerPage.fill('[data-testid="password"]', "password123");
        await ownerPage.click('[data-testid="login-button"]');
        
        // Navigate to listing page
        await renterPage1.goto("/listings/listing-123");
        await renterPage2.goto("/listings/listing-123");
        await ownerPage.goto("/dashboard/owner");
        
        // Wait for connections
        await expect(renterPage1.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(renterPage2.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(ownerPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Simultaneous booking attempts
        const bookingPromises = [
          renterPage1.locator('[data-testid="book-now"]').click(),
          renterPage2.locator('[data-testid="book-now"]').click()
        ];
        
        await Promise.all(bookingPromises);
        
        // Complete booking process for first renter
        await renterPage1.fill('[data-testid="card-number"]', "4242424242424242");
        await renterPage1.fill('[data-testid="card-expiry"]', "12/25");
        await renterPage1.fill('[data-testid="card-cvc"]', "123");
        await renterPage1.locator('[data-testid="confirm-booking"]').click();
        
        // First renter should succeed
        await expect(renterPage1.locator('[data-testid="booking-success"]')).toBeVisible({ timeout: 10000 });
        
        // Second renter should get conflict notification
        await expect(renterPage2.locator('[data-testid="booking-conflict"]')).toBeVisible({ timeout: 10000 });
        await expect(renterPage2.locator('[data-testid="conflict-message"]')).toContainText(/no longer available/i);
        
        // Owner should receive only one booking request
        await expect(ownerPage.locator('[data-testid="pending-bookings"]')).toContainText('1');
        
      } finally {
        await renterContext1.close();
        await renterContext2.close();
        await ownerContext.close();
      }
    });

    test("should maintain state consistency during rapid updates", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      
      const renterContext = await browser.newContext();
      const renterPage = await renterContext.newPage();
      
      try {
        // Login users
        await ownerPage.goto("/auth/login");
        await ownerPage.fill('[data-testid="email"]', "owner@example.com");
        await ownerPage.fill('[data-testid="password"]', "password123");
        await ownerPage.click('[data-testid="login-button"]');
        
        await renterPage.goto("/auth/login");
        await renterPage.fill('[data-testid="email"]', "renter@example.com");
        await renterPage.fill('[data-testid="password"]', "password123");
        await renterPage.click('[data-testid="login-button"]');
        
        // Navigate to booking page
        await ownerPage.goto("/bookings/booking-123");
        await renterPage.goto("/bookings/booking-123");
        
        // Wait for connections
        await expect(ownerPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(renterPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Rapid status changes
        const statusChanges = [
          () => ownerPage.locator('[data-testid="accept-booking"]').click(),
          () => ownerPage.locator('[data-testid="start-rental"]').click(),
          () => ownerPage.locator('[data-testid="complete-rental"]').click()
        ];
        
        for (const change of statusChanges) {
          await change();
          await ownerPage.locator('[data-testid="confirm-action"]').click();
          
          // Wait for sync
          await expect(renterPage.locator('[data-testid="booking-status"]')).toBeVisible({ timeout: 5000 });
          
          // Verify consistency
          const ownerStatus = await ownerPage.locator('[data-testid="booking-status"]').textContent();
          const renterStatus = await renterPage.locator('[data-testid="booking-status"]').textContent();
          
          expect(ownerStatus).toBe(renterStatus);
        }
        
      } finally {
        await ownerContext.close();
        await renterContext.close();
      }
    });
  });

  test.describe("Connection Failure Recovery", () => {
    test("should handle network interruption during booking updates", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      
      const renterContext = await browser.newContext();
      const renterPage = await renterContext.newPage();
      
      try {
        // Login users
        await ownerPage.goto("/auth/login");
        await ownerPage.fill('[data-testid="email"]', "owner@example.com");
        await ownerPage.fill('[data-testid="password"]', "password123");
        await ownerPage.click('[data-testid="login-button"]');
        
        await renterPage.goto("/auth/login");
        await renterPage.fill('[data-testid="email"]', "renter@example.com");
        await renterPage.fill('[data-testid="password"]', "password123");
        await renterPage.click('[data-testid="login-button"]');
        
        // Navigate to booking pages
        await ownerPage.goto("/bookings/booking-123");
        await renterPage.goto("/bookings/booking-123");
        
        // Wait for connections
        await expect(ownerPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(renterPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Simulate network interruption for renter
        await renterPage.evaluate(() => {
          if (window.socket) {
            window.socket.disconnect();
          }
        });
        
        await expect(renterPage.locator('[data-testid="websocket-disconnected"]')).toBeVisible();
        
        // Owner makes booking update while renter is offline
        await ownerPage.locator('[data-testid="accept-booking"]').click();
        await ownerPage.locator('[data-testid="confirm-accept"]').click();
        
        // Renter should show offline indicator
        await expect(renterPage.locator('[data-testid="sync-pending"]')).toBeVisible();
        
        // Reconnect renter
        await renterPage.evaluate(() => {
          if (window.socket) {
            window.socket.connect();
          }
        });
        
        // Should sync missed updates
        await expect(renterPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 10000 });
        await expect(renterPage.locator('[data-testid="booking-status"]')).toContainText(/confirmed|accepted/i, { timeout: 15000 });
        
        // Should clear sync pending indicator
        await expect(renterPage.locator('[data-testid="sync-pending"]')).not.toBeVisible();
        
      } finally {
        await ownerContext.close();
        await renterContext.close();
      }
    });

    test("should handle server restart scenarios", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/bookings/booking-123");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Simulate server restart by disconnecting WebSocket
      await page.evaluate(() => {
        if (window.socket) {
          window.socket.disconnect();
          // Clear any reconnection attempts
          window.socket.io.disconnect();
        }
      });
      
      await expect(page.locator('[data-testid="websocket-disconnected"]')).toBeVisible();
      await expect(page.locator('[data-testid="server-reconnecting"]')).toBeVisible();
      
      // Should attempt reconnection with exponential backoff
      await expect(page.locator('[data-testid="reconnection-attempt"]')).toBeVisible();
      
      // Simulate server coming back online
      await page.evaluate(() => {
        if (window.socket) {
          window.socket.connect();
        }
      });
      
      // Should reconnect successfully
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="server-reconnecting"]')).not.toBeVisible();
      
      // Should restore booking state
      await expect(page.locator('[data-testid="booking-status"]')).toBeVisible();
    });

    test("should handle connection timeout gracefully", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/bookings/booking-123");
      
      // Mock connection timeout
      await page.route('**/socket.io/**', route => {
        // Delay response to simulate timeout
        setTimeout(() => route.abort('failed'), 10000);
      });
      
      // Should show timeout error
      await expect(page.locator('[data-testid="connection-timeout"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="timeout-message"]')).toContainText(/connection timeout/i);
      
      // Should provide retry option
      await expect(page.locator('[data-testid="retry-connection"]')).toBeVisible();
      
      // Remove mock and retry
      await page.unroute('**/socket.io/**');
      await page.locator('[data-testid="retry-connection"]').click();
      
      // Should connect successfully
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 10000 });
    });

    test("should implement graceful degradation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/bookings/booking-123");
      
      // Mock persistent WebSocket failure
      await page.route('**/socket.io/**', route => route.abort('failed'));
      
      // Should enter offline mode
      await expect(page.locator('[data-testid="offline-mode"]')).toBeVisible({ timeout: 5000 });
      
      // Should disable real-time features
      await expect(page.locator('[data-testid="real-time-disabled"]')).toBeVisible();
      
      // Should provide manual refresh option
      await expect(page.locator('[data-testid="manual-refresh"]')).toBeVisible();
      
      // Should still show basic booking information
      await expect(page.locator('[data-testid="booking-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="booking-status"]')).toBeVisible();
      
      // Manual refresh should update data
      await page.locator('[data-testid="manual-refresh"]').click();
      await expect(page.locator('[data-testid="data-updated"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Event Ordering and Consistency", () => {
    test("should maintain event ordering during rapid updates", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      
      const renterContext = await browser.newContext();
      const renterPage = await renterContext.newPage();
      
      try {
        // Login users
        await ownerPage.goto("/auth/login");
        await ownerPage.fill('[data-testid="email"]', "owner@example.com");
        await ownerPage.fill('[data-testid="password"]', "password123");
        await ownerPage.click('[data-testid="login-button"]');
        
        await renterPage.goto("/auth/login");
        await renterPage.fill('[data-testid="email"]', "renter@example.com");
        await renterPage.fill('[data-testid="password"]', "password123");
        await renterPage.click('[data-testid="login-button"]');
        
        // Navigate to booking page
        await ownerPage.goto("/bookings/booking-123");
        await renterPage.goto("/bookings/booking-123");
        
        // Wait for connections
        await expect(ownerPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(renterPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Track event order
        const eventLog: string[] = [];
        
        await renterPage.evaluate(() => {
          window.eventLog = [];
          window.socket?.on('booking:status:changed', (data) => {
            window.eventLog.push(`status:${data.status}:${Date.now()}`);
          });
        });
        
        // Rapid status changes
        const statusSequence = ['confirmed', 'active', 'completed'];
        
        for (const status of statusSequence) {
          await ownerPage.evaluate((newStatus) => {
            window.socket?.emit('booking:status:changed', {
              bookingId: 'booking-123',
              status: newStatus,
              timestamp: Date.now()
            });
          }, status);
          
          // Small delay to ensure order
          await page.waitForTimeout(100);
        }
        
        // Wait for all events to process
        await page.waitForTimeout(1000);
        
        // Verify event order
        const receivedEvents = await renterPage.evaluate(() => window.eventLog);
        
        expect(receivedEvents.length).toBe(3);
        expect(receivedEvents[0]).toContain('confirmed');
        expect(receivedEvents[1]).toContain('active');
        expect(receivedEvents[2]).toContain('completed');
        
        // Verify timestamps are in order
        const timestamps = receivedEvents.map(event => parseInt(event.split(':')[2]));
        expect(timestamps[0]).toBeLessThan(timestamps[1]);
        expect(timestamps[1]).toBeLessThan(timestamps[2]);
        
      } finally {
        await ownerContext.close();
        await renterContext.close();
      }
    });

    test("should handle conflicting updates", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const ownerContext1 = await browser.newContext();
      const ownerPage1 = await ownerContext1.newPage();
      
      const ownerContext2 = await browser.newContext();
      const ownerPage2 = await ownerContext2.newPage();
      
      try {
        // Login both as owner (same account different sessions)
        await ownerPage1.goto("/auth/login");
        await ownerPage1.fill('[data-testid="email"]', "owner@example.com");
        await ownerPage1.fill('[data-testid="password"]', "password123");
        await ownerPage1.click('[data-testid="login-button"]');
        
        await ownerPage2.goto("/auth/login");
        await ownerPage2.fill('[data-testid="email"]', "owner@example.com");
        await ownerPage2.fill('[data-testid="password"]', "password123");
        await ownerPage2.click('[data-testid="login-button"]');
        
        // Navigate to booking page
        await ownerPage1.goto("/bookings/booking-123");
        await ownerPage2.goto("/bookings/booking-123");
        
        // Wait for connections
        await expect(ownerPage1.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(ownerPage2.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Simultaneous conflicting updates
        await Promise.all([
          ownerPage1.locator('[data-testid="accept-booking"]').click(),
          ownerPage2.locator('[data-testid="reject-booking"]').click()
        ]);
        
        // Confirm actions
        await Promise.all([
          ownerPage1.locator('[data-testid="confirm-accept"]').click(),
          ownerPage2.locator('[data-testid="confirm-reject"]').click()
        ]);
        
        // Should handle conflict gracefully
        await expect(ownerPage1.locator('[data-testid="conflict-resolution"]')).toBeVisible({ timeout: 10000 });
        await expect(ownerPage2.locator('[data-testid="conflict-resolution"]')).toBeVisible({ timeout: 10000 });
        
        // Should show which action prevailed
        await expect(ownerPage1.locator('[data-testid="final-status"]')).toBeVisible();
        await expect(ownerPage2.locator('[data-testid="final-status"]')).toBeVisible();
        
        // Both should show same final state
        const finalStatus1 = await ownerPage1.locator('[data-testid="booking-status"]').textContent();
        const finalStatus2 = await ownerPage2.locator('[data-testid="booking-status"]').textContent();
        
        expect(finalStatus1).toBe(finalStatus2);
        
      } finally {
        await ownerContext1.close();
        await ownerContext2.close();
      }
    });
  });

  // ──────────────────────────────────────────────────────
  // NOTIFICATION TESTS (Task 1.5.3)
  // ──────────────────────────────────────────────────────

  test.describe("Advanced Notification Features", () => {
    test("should handle high-frequency notification batching", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Simulate rapid notification bursts
      const notificationPromises = Array.from({ length: 20 }, (_, i) => 
        page.evaluate((index) => {
          window.socket?.emit('notification:new', {
            id: `notif-${index}`,
            type: 'message',
            title: `Message ${index}`,
            body: `This is message number ${index}`,
            timestamp: new Date().toISOString()
          });
        }, i)
      );
      
      await Promise.all(notificationPromises);
      
      // Should batch notifications to prevent UI spam
      await expect(page.locator('[data-testid="notification-batch"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="batch-count"]')).toContainText(/20/i);
      
      // Should show batch summary
      await expect(page.locator('[data-testid="batch-summary"]')).toContainText(/20 new messages/i);
      
      // Click to expand batch
      await page.locator('[data-testid="expand-batch"]').click();
      
      // Should show individual notifications
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(20);
    });

    test("should implement priority-based notification delivery", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Send notifications with different priorities
      const notifications = [
        { type: 'system', priority: 'high', title: 'System Alert', body: 'Critical system update' },
        { type: 'message', priority: 'normal', title: 'New Message', body: 'You have a new message' },
        { type: 'booking', priority: 'urgent', title: 'Booking Cancelled', body: 'Your booking was cancelled' },
        { type: 'promotion', priority: 'low', title: 'Special Offer', body: 'Limited time discount' }
      ];
      
      for (const notification of notifications) {
        await page.evaluate((notif) => {
          window.socket?.emit('notification:new', {
            ...notif,
            id: `notif-${notif.type}`,
            timestamp: new Date().toISOString()
          });
        }, notification);
        
        await page.waitForTimeout(100);
      }
      
      // Should show urgent notification first
      await expect(page.locator('[data-testid="notification-urgent"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="notification-urgent"]')).toContainText('Booking Cancelled');
      
      // Should show high priority next
      await expect(page.locator('[data-testid="notification-high"]')).toContainText('System Alert');
      
      // Should show normal priority
      await expect(page.locator('[data-testid="notification-normal"]')).toContainText('New Message');
      
      // Should show low priority last or batch
      await expect(page.locator('[data-testid="notification-low"]')).toContainText('Special Offer');
    });

    test("should handle notification queue management", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Disconnect WebSocket to simulate offline
      await page.evaluate(() => {
        if (window.socket) {
          window.socket.disconnect();
        }
      });
      
      await expect(page.locator('[data-testid="websocket-disconnected"]')).toBeVisible();
      
      // Send notifications while offline
      const offlineNotifications = Array.from({ length: 5 }, (_, i) => 
        page.evaluate((index) => {
          window.socket?.emit('notification:new', {
            id: `offline-notif-${index}`,
            type: 'message',
            title: `Offline Message ${index}`,
            body: `Sent while offline`,
            timestamp: new Date().toISOString()
          });
        }, i)
      );
      
      await Promise.all(offlineNotifications);
      
      // Should show queued notifications indicator
      await expect(page.locator('[data-testid="queued-notifications"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="queue-count"]')).toContainText('5');
      
      // Reconnect WebSocket
      await page.evaluate(() => {
        if (window.socket) {
          window.socket.connect();
        }
      });
      
      // Should process queued notifications
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="queued-notifications"]')).not.toBeVisible({ timeout: 15000 });
      
      // Should show all queued notifications
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(5);
    });

    test("should handle notification persistence across sessions", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      try {
        // Login in first session
        await page1.goto("/auth/login");
        await page1.fill('[data-testid="email"]', "user@example.com");
        await page1.fill('[data-testid="password"]', "password123");
        await page1.click('[data-testid="login-button"]');
        
        await page1.goto("/dashboard");
        await expect(page1.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Send notifications to first session
        await page1.evaluate(() => {
          window.socket?.emit('notification:new', {
            id: 'persist-notif-1',
            type: 'message',
            title: 'Persistent Message 1',
            body: 'Should persist across sessions',
            timestamp: new Date().toISOString()
          });
        });
        
        // Wait for notification to be received
        await expect(page1.locator('[data-testid="notification-item"]')).toHaveCount(1);
        
        // Mark notification as read
        await page1.locator('[data-testid="notification-item"]').first().click();
        await expect(page1.locator('[data-testid="notification-item"]').first()).toHaveClass(/read/);
        
        // Login in second session
        await page2.goto("/auth/login");
        await page2.fill('[data-testid="email"]', "user@example.com");
        await page2.fill('[data-testid="password"]', "password123");
        await page2.click('[data-testid="login-button"]');
        
        await page2.goto("/notifications");
        await expect(page2.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Should show persisted notifications
        await expect(page2.locator('[data-testid="notification-item"]')).toHaveCount(1);
        await expect(page2.locator('[data-testid="notification-item"]')).toContainText('Persistent Message 1');
        
        // Should show as read in both sessions
        await expect(page2.locator('[data-testid="notification-item"]')).toHaveClass(/read/);
        
        // Send new notification to second session
        await page2.evaluate(() => {
          window.socket?.emit('notification:new', {
            id: 'persist-notif-2',
            type: 'message',
            title: 'Persistent Message 2',
            body: 'Synced across sessions',
            timestamp: new Date().toISOString()
          });
        });
        
        // Should sync to first session
        await expect(page1.locator('[data-testid="notification-item"]')).toHaveCount(2);
        await expect(page1.locator('[data-testid="notification-item"]')).toContainText('Persistent Message 2');
        
      } finally {
        await context1.close();
        await context2.close();
      }
    });

    test("should handle cross-device notification synchronization", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      // Setup mobile and desktop contexts
      const mobileContext = await browser.newContext({
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      });
      const mobilePage = await mobileContext.newPage();
      
      const desktopContext = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });
      const desktopPage = await desktopContext.newPage();
      
      try {
        // Login on both devices
        await mobilePage.goto("/auth/login");
        await mobilePage.fill('[data-testid="email"]', "user@example.com");
        await mobilePage.fill('[data-testid="password"]', "password123");
        await mobilePage.click('[data-testid="login-button"]');
        
        await desktopPage.goto("/auth/login");
        await desktopPage.fill('[data-testid="email"]', "user@example.com");
        await desktopPage.fill('[data-testid="password"]', "password123");
        await desktopPage.click('[data-testid="login-button"]');
        
        // Navigate to dashboard on both devices
        await mobilePage.goto("/dashboard");
        await desktopPage.goto("/dashboard");
        
        // Wait for connections
        await expect(mobilePage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(desktopPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Send notification from desktop
        await desktopPage.evaluate(() => {
          window.socket?.emit('notification:new', {
            id: 'cross-device-notif',
            type: 'message',
            title: 'Cross-Device Message',
            body: 'Should sync to mobile',
            timestamp: new Date().toISOString()
          });
        });
        
        // Should appear on both devices
        await expect(desktopPage.locator('[data-testid="notification-item"]')).toContainText('Cross-Device Message');
        await expect(mobilePage.locator('[data-testid="notification-item"]')).toContainText('Cross-Device Message');
        
        // Mark as read on mobile
        await mobilePage.locator('[data-testid="notification-item"]').click();
        await expect(mobilePage.locator('[data-testid="notification-item"]')).toHaveClass(/read/);
        
        // Should sync read status to desktop
        await expect(desktopPage.locator('[data-testid="notification-item"]')).toHaveClass(/read/);
        
        // Should clear notification badge on both devices
        await expect(mobilePage.locator('[data-testid="notification-badge"]')).not.toBeVisible();
        await expect(desktopPage.locator('[data-testid="notification-badge"]')).not.toBeVisible();
        
      } finally {
        await mobileContext.close();
        await desktopContext.close();
      }
    });

    test("should handle notification cleanup and archiving", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/notifications");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Send old notifications (simulate existing notifications)
      const oldNotifications = Array.from({ length: 10 }, (_, i) => ({
        id: `old-notif-${i}`,
        type: 'message',
        title: `Old Message ${i}`,
        body: `Old notification ${i}`,
        timestamp: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString(), // i+1 days ago
        read: i < 5 // First 5 are read
      }));
      
      // Mock old notifications in the UI
      await page.evaluate((notifications) => {
        window.mockNotifications = notifications;
        // Simulate loading old notifications
        notifications.forEach(notif => {
          window.socket?.emit('notification:loaded', notif);
        });
      }, oldNotifications);
      
      // Should show all notifications
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(10);
      
      // Should show read/unread status
      await expect(page.locator('[data-testid="notification-item"].read')).toHaveCount(5);
      await expect(page.locator('[data-testid="notification-item"].unread')).toHaveCount(5);
      
      // Test archiving old notifications
      await page.locator('[data-testid="archive-old-notifications"]').click();
      await page.locator('[data-testid="confirm-archive"]').click();
      
      // Should archive notifications older than 7 days
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(5); // Only recent ones remain
      
      // Should show archive success message
      await expect(page.locator('[data-testid="archive-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="archive-success"]')).toContainText('5 notifications archived');
      
      // Test clearing all notifications
      await page.locator('[data-testid="clear-all-notifications"]').click();
      await page.locator('[data-testid="confirm-clear"]').click();
      
      // Should clear all notifications
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="no-notifications"]')).toBeVisible();
    });
  });

  test.describe("Notification Performance and Scalability", () => {
    test("should handle notification delivery under load", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Send 1000 notifications rapidly
      const startTime = Date.now();
      
      const notificationPromises = Array.from({ length: 1000 }, (_, i) => 
        page.evaluate((index) => {
          window.socket?.emit('notification:new', {
            id: `load-test-${index}`,
            type: 'message',
            title: `Load Test ${index}`,
            body: `Message ${index}`,
            timestamp: new Date().toISOString()
          });
        }, i)
      );
      
      await Promise.all(notificationPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle high load efficiently
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Should batch notifications to prevent UI freezing
      await expect(page.locator('[data-testid="notification-batch"]')).toBeVisible({ timeout: 10000 });
      
      // Should show total count
      const batchCount = await page.locator('[data-testid="batch-count"]').textContent();
      expect(batchCount).toContain('1000');
      
      // Expand batch and verify all notifications are present
      await page.locator('[data-testid="expand-batch"]').click();
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(1000);
    });

    test("should maintain performance with multiple notification types", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/dashboard");
      await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
      
      // Send different types of notifications
      const notificationTypes = ['message', 'booking', 'payment', 'system', 'promotion', 'review'];
      
      const startTime = Date.now();
      
      const allNotifications = [];
      for (const type of notificationTypes) {
        for (let i = 0; i < 100; i++) {
          allNotifications.push(
            page.evaluate((notifType, index) => {
              window.socket?.emit('notification:new', {
                id: `${notifType}-${index}`,
                type: notifType,
                title: `${notifType.charAt(0).toUpperCase() + notifType.slice(1)} ${index}`,
                body: `${notifType} notification ${index}`,
                timestamp: new Date().toISOString()
              });
            }, type, i)
          );
        }
      }
      
      await Promise.all(allNotifications);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle mixed notification types efficiently
      expect(duration).toBeLessThan(8000); // Should complete within 8 seconds
      
      // Should categorize notifications properly
      await page.locator('[data-testid="expand-batch"]').click();
      
      for (const type of notificationTypes) {
        await expect(page.locator(`[data-testid="notification-${type}"]`)).toHaveCount(100);
      }
      
      // Should provide filtering options
      await expect(page.locator('[data-testid="filter-by-type"]')).toBeVisible();
      
      // Test filtering by type
      await page.locator('[data-testid="filter-by-type"]').click();
      await page.locator('[data-testid="filter-message"]').click();
      
      // Should show only message notifications
      await expect(page.locator('[data-testid="notification-message"]')).toHaveCount(100);
      await expect(page.locator('[data-testid="notification-booking"]')).toHaveCount(0);
    });
  });

  // ──────────────────────────────────────────────────────
  // MESSAGING TESTS (Task 1.5.4)
  // ──────────────────────────────────────────────────────

  test.describe("Real-time Messaging Features", () => {
    test("should handle real-time messaging between users", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      // Setup two users
      const user1Context = await browser.newContext();
      const user1Page = await user1Context.newPage();
      
      const user2Context = await browser.newContext();
      const user2Page = await user2Context.newPage();
      
      try {
        // Login both users
        await user1Page.goto("/auth/login");
        await user1Page.fill('[data-testid="email"]', "user1@example.com");
        await user1Page.fill('[data-testid="password"]', "password123");
        await user1Page.click('[data-testid="login-button"]');
        
        await user2Page.goto("/auth/login");
        await user2Page.fill('[data-testid="email"]', "user2@example.com");
        await user2Page.fill('[data-testid="password"]', "password123");
        await user2Page.click('[data-testid="login-button"]');
        
        // Navigate to messages
        await user1Page.goto("/messages");
        await user2Page.goto("/messages");
        
        // Wait for WebSocket connections
        await expect(user1Page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(user2Page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // User1 starts conversation
        await user1Page.locator('[data-testid="new-conversation"]').click();
        await user1Page.fill('[data-testid="recipient-search"]', "user2@example.com");
        await user1Page.locator('[data-testid="user-result"]').first().click();
        
        // Send message
        await user1Page.fill('[data-testid="message-input"]', "Hello, this is a test message!");
        await user1Page.locator('[data-testid="send-message"]').click();
        
        // Should show message in User1's chat
        await expect(user1Page.locator('[data-testid="message-content"]')).toContainText("Hello, this is a test message!");
        await expect(user1Page.locator('[data-testid="message-sent"]')).toBeVisible();
        
        // User2 should receive real-time message
        await expect(user2Page.locator('[data-testid="message-notification"]')).toBeVisible({ timeout: 5000 });
        await user2Page.locator('[data-testid="message-notification"]').click();
        
        await expect(user2Page.locator('[data-testid="message-content"]')).toContainText("Hello, this is a test message!");
        await expect(user2Page.locator('[data-testid="message-received"]')).toBeVisible();
        
        // User2 replies
        await user2Page.fill('[data-testid="message-input"]', "Thanks for the message!");
        await user2Page.locator('[data-testid="send-message"]').click();
        
        // User1 should receive reply
        await expect(user1Page.locator('[data-testid="message-content"]')).toContainText("Thanks for the message!");
        await expect(user1Page.locator('[data-testid="message-received"]')).toBeVisible();
        
      } finally {
        await user1Context.close();
        await user2Context.close();
      }
    });

    test("should handle message delivery confirmation", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const senderContext = await browser.newContext();
      const senderPage = await senderContext.newPage();
      
      const receiverContext = await browser.newContext();
      const receiverPage = await receiverContext.newPage();
      
      try {
        // Login users
        await senderPage.goto("/auth/login");
        await senderPage.fill('[data-testid="email"]', "sender@example.com");
        await senderPage.fill('[data-testid="password"]', "password123");
        await senderPage.click('[data-testid="login-button"]');
        
        await receiverPage.goto("/auth/login");
        await receiverPage.fill('[data-testid="email"]', "receiver@example.com");
        await receiverPage.fill('[data-testid="password"]', "password123");
        await receiverPage.click('[data-testid="login-button"]');
        
        await senderPage.goto("/messages");
        await receiverPage.goto("/messages");
        
        // Wait for connections
        await expect(senderPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(receiverPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Start conversation
        await senderPage.locator('[data-testid="new-conversation"]').click();
        await senderPage.fill('[data-testid="recipient-search"]', "receiver@example.com");
        await senderPage.locator('[data-testid="user-result"]').first().click();
        
        // Send message
        await senderPage.fill('[data-testid="message-input"]', "Message with delivery confirmation");
        await senderPage.locator('[data-testid="send-message"]').click();
        
        // Should show sending status
        await expect(senderPage.locator('[data-testid="message-sending"]')).toBeVisible();
        
        // Should show delivered status when receiver gets it
        await expect(senderPage.locator('[data-testid="message-delivered"]')).toBeVisible({ timeout: 5000 });
        
        // Should show read status when receiver reads it
        await receiverPage.locator('[data-testid="message-notification"]').click();
        await expect(senderPage.locator('[data-testid="message-read"]')).toBeVisible({ timeout: 5000 });
        
        // Test failed delivery scenario
        await receiverPage.evaluate(() => {
          if (window.socket) {
            window.socket.disconnect();
          }
        });
        
        await expect(receiverPage.locator('[data-testid="websocket-disconnected"]')).toBeVisible();
        
        // Send another message
        await senderPage.fill('[data-testid="message-input"]', "Message to offline user");
        await senderPage.locator('[data-testid="send-message"]').click();
        
        // Should show pending status
        await expect(senderPage.locator('[data-testid="message-pending"]')).toBeVisible();
        
        // Should show failed status after timeout
        await expect(senderPage.locator('[data-testid="message-failed"]')).toBeVisible({ timeout: 10000 });
        
        // Should provide retry option
        await expect(senderPage.locator('[data-testid="retry-message"]')).toBeVisible();
        
      } finally {
        await senderContext.close();
        await receiverContext.close();
      }
    });

    test("should sync message history across sessions", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      try {
        // Login in first session
        await page1.goto("/auth/login");
        await page1.fill('[data-testid="email"]', "user@example.com");
        await page1.fill('[data-testid="password"]', "password123");
        await page1.click('[data-testid="login-button"]');
        
        await page1.goto("/messages");
        await expect(page1.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Send some messages
        await page1.locator('[data-testid="new-conversation"]').click();
        await page1.fill('[data-testid="recipient-search"]', "contact@example.com");
        await page1.locator('[data-testid="user-result"]').first().click();
        
        const messages = [
          "First message in history",
          "Second message in history",
          "Third message in history"
        ];
        
        for (const message of messages) {
          await page1.fill('[data-testid="message-input"]', message);
          await page1.locator('[data-testid="send-message"]').click();
          await page1.waitForTimeout(500);
        }
        
        // Verify messages are in first session
        await expect(page1.locator('[data-testid="message-item"]')).toHaveCount(3);
        
        // Login in second session
        await page2.goto("/auth/login");
        await page2.fill('[data-testid="email"]', "user@example.com");
        await page2.fill('[data-testid="password"]', "password123");
        await page2.click('[data-testid="login-button"]');
        
        await page2.goto("/messages");
        await expect(page2.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Should sync message history
        await expect(page2.locator('[data-testid="message-item"]')).toHaveCount(3);
        
        // Should show all messages in correct order
        for (let i = 0; i < messages.length; i++) {
          await expect(page2.locator(`[data-testid="message-item"]:nth-child(${i + 1})`)).toContainText(messages[i]);
        }
        
        // Send new message from second session
        await page2.fill('[data-testid="message-input"]', "New message from second session");
        await page2.locator('[data-testid="send-message"]').click();
        
        // Should sync to first session
        await expect(page1.locator('[data-testid="message-item"]')).toHaveCount(4);
        await expect(page1.locator('[data-testid="message-item"]')).toContainText("New message from second session");
        
        // Should maintain message status sync
        await expect(page2.locator('[data-testid="message-read"]')).toHaveCount(4);
        await expect(page1.locator('[data-testid="message-read"]')).toHaveCount(4);
        
      } finally {
        await context1.close();
        await context2.close();
      }
    });

    test("should handle typing indicators", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const user1Context = await browser.newContext();
      const user1Page = await user1Context.newPage();
      
      const user2Context = await browser.newContext();
      const user2Page = await user2Context.newPage();
      
      try {
        // Login users
        await user1Page.goto("/auth/login");
        await user1Page.fill('[data-testid="email"]', "user1@example.com");
        await user1Page.fill('[data-testid="password"]', "password123");
        await user1Page.click('[data-testid="login-button"]');
        
        await user2Page.goto("/auth/login");
        await user2Page.fill('[data-testid="email"]', "user2@example.com");
        await user2Page.fill('[data-testid="password"]', "password123");
        await user2Page.click('[data-testid="login-button"]');
        
        await user1Page.goto("/messages");
        await user2Page.goto("/messages");
        
        // Wait for connections
        await expect(user1Page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(user2Page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Start conversation
        await user1Page.locator('[data-testid="new-conversation"]').click();
        await user1Page.fill('[data-testid="recipient-search"]', "user2@example.com");
        await user1Page.locator('[data-testid="user-result"]').first().click();
        
        // User2 should see conversation
        await user2Page.locator('[data-testid="conversation-item"]').first().click();
        
        // User1 starts typing
        await user1Page.fill('[data-testid="message-input"]', "Typing...");
        
        // User2 should see typing indicator
        await expect(user2Page.locator('[data-testid="typing-indicator"]')).toBeVisible({ timeout: 3000 });
        await expect(user2Page.locator('[data-testid="typing-indicator"]')).toContainText("user1 is typing");
        
        // User1 stops typing (clear input)
        await user1Page.fill('[data-testid="message-input"]', "");
        
        // Typing indicator should disappear after timeout
        await expect(user2Page.locator('[data-testid="typing-indicator"]')).not.toBeVisible({ timeout: 5000 });
        
        // Test multiple users typing
        const user3Context = await browser.newContext();
        const user3Page = await user3Context.newPage();
        
        try {
          await user3Page.goto("/auth/login");
          await user3Page.fill('[data-testid="email"]', "user3@example.com");
          await user3Page.fill('[data-testid="password"]', "password123");
          await user3Page.click('[data-testid="login-button"]');
          
          await user3Page.goto("/messages");
          await expect(user3Page.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
          
          // Add user3 to conversation
          await user1Page.locator('[data-testid="add-participant"]').click();
          await user1Page.fill('[data-testid="participant-search"]', "user3@example.com");
          await user1Page.locator('[data-testid="user-result"]').first().click();
          
          // Both user2 and user3 join conversation
          await user2Page.locator('[data-testid="conversation-item"]').first().click();
          await user3Page.locator('[data-testid="conversation-item"]').first().click();
          
          // Multiple users typing
          await user1Page.fill('[data-testid="message-input"]', "User1 typing");
          await user2Page.fill('[data-testid="message-input"]', "User2 typing");
          
          // Should show multiple typing indicators
          await expect(user3Page.locator('[data-testid="typing-indicator"]')).toContainText("user1 and user2 are typing");
          
        } finally {
          await user3Context.close();
        }
        
      } finally {
        await user1Context.close();
        await user2Context.close();
      }
    });

    test("should handle read receipts", async ({ page }) => {
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser not available');
      
      const senderContext = await browser.newContext();
      const senderPage = await senderContext.newPage();
      
      const receiverContext = await browser.newContext();
      const receiverPage = await receiverContext.newPage();
      
      try {
        // Login users
        await senderPage.goto("/auth/login");
        await senderPage.fill('[data-testid="email"]', "sender@example.com");
        await senderPage.fill('[data-testid="password"]', "password123");
        await senderPage.click('[data-testid="login-button"]');
        
        await receiverPage.goto("/auth/login");
        await receiverPage.fill('[data-testid="email"]', "receiver@example.com");
        await receiverPage.fill('[data-testid="password"]', "password123");
        await receiverPage.click('[data-testid="login-button"]');
        
        await senderPage.goto("/messages");
        await receiverPage.goto("/messages");
        
        // Wait for connections
        await expect(senderPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        await expect(receiverPage.locator('[data-testid="websocket-connected"]')).toBeVisible({ timeout: 5000 });
        
        // Start conversation
        await senderPage.locator('[data-testid="new-conversation"]').click();
        await senderPage.fill('[data-testid="recipient-search"]', "receiver@example.com");
        await senderPage.locator('[data-testid="user-result"]').first().click();
        
        // Send multiple messages
        const messages = [
          "First message",
          "Second message", 
          "Third message"
        ];
        
        for (const message of messages) {
          await senderPage.fill('[data-testid="message-input"]', message);
          await senderPage.locator('[data-testid="send-message"]').click();
          await senderPage.waitForTimeout(500);
        }
        
        // Receiver opens conversation
        await receiverPage.locator('[data-testid="message-notification"]').click();
        
        // Should show unread messages initially
        await expect(receiverPage.locator('[data-testid="message-unread"]')).toHaveCount(3);
        
        // Receiver reads first message
        await receiverPage.locator('[data-testid="message-item"]:first-child').click();
        
        // Sender should see read receipt for first message
        await expect(senderPage.locator('[data-testid="message-item"]:first-child [data-testid="message-read"]')).toBeVisible({ timeout: 3000 });
        
        // Receiver reads all messages
        await receiverPage.locator('[data-testid="mark-all-read"]').click();
        
        // Sender should see read receipts for all messages
        await expect(senderPage.locator('[data-testid="message-read"]')).toHaveCount(3);
        
        // Test read receipt preferences
        await receiverPage.goto("/settings/privacy");
        await receiverPage.uncheck('[data-testid="read-receipts-enabled"]');
        await receiverPage.locator('[data-testid="save-settings"]').click();
        
        // Send new message
        await senderPage.fill('[data-testid="message-input"]', "Message with disabled read receipts");
        await senderPage.locator('[data-testid="send-message"]').click();
        
        // Receiver reads message
        await receiverPage.goto("/messages");
        await receiverPage.locator('[data-testid="conversation-item"]').first().click();
        
        // Sender should not see read receipt
        await expect(senderPage.locator('[data-testid="message-item"]:last-child [data-testid="message-read"]')).not.toBeVisible({ timeout: 5000 });
        
      } finally {
        await senderContext.close();
        await receiverContext.close();
      }
    });
  });
});
