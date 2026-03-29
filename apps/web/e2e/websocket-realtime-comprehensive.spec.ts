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
});
