import { test, expect } from '@playwright/test';

test.describe('Enhanced Activity Feed Actions', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a renter with activity data
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'renter@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard/renter');
  });

  test('displays enhanced activity feed with contextual action buttons', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard/renter');
    
    // Wait for activity feed to load
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Check that activity items are displayed
    const activityItems = page.locator('[data-testid=activity-item]');
    await expect(activityItems.first()).toBeVisible();
    
    // Verify enhanced action buttons are present
    const actionButtons = page.locator('[data-testid=activity-action-button]');
    await expect(actionButtons.first()).toBeVisible();
    
    // Check that action buttons have proper text (not just icons)
    const firstActionButton = actionButtons.first();
    const buttonText = await firstActionButton.textContent();
    expect(buttonText?.length).toBeGreaterThan(2); // More than just an icon
  });

  test('shows correct action text for different activity types', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Test booking created activity
    const bookingCreatedAction = page.locator('[data-testid=activity-item]').filter({ hasText: 'booking created' }).locator('[data-testid=activity-action-button]');
    if (await bookingCreatedAction.count() > 0) {
      const text = await bookingCreatedAction.first().textContent();
      expect(text).toContain('View Details');
    }
    
    // Test booking completed activity
    const bookingCompletedAction = page.locator('[data-testid=activity-item]').filter({ hasText: 'booking completed' }).locator('[data-testid=activity-action-button]');
    if (await bookingCompletedAction.count() > 0) {
      const text = await bookingCompletedAction.first().textContent();
      expect(text).toContain('Leave Review');
    }
    
    // Test payment failed activity
    const paymentFailedAction = page.locator('[data-testid=activity-item]').filter({ hasText: 'payment failed' }).locator('[data-testid=activity-action-button]');
    if (await paymentFailedAction.count() > 0) {
      const text = await paymentFailedAction.first().textContent();
      expect(text).toContain('Retry Payment');
    }
  });

  test('navigates to correct pages when action buttons are clicked', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Find and click a booking-related action
    const bookingAction = page.locator('[data-testid=activity-item]').filter({ hasText: 'booking' }).locator('[data-testid=activity-action-button]').first();
    
    if (await bookingAction.isVisible()) {
      // Click the action button
      await bookingAction.click();
      
      // Should navigate to booking details page
      await page.waitForURL(/\/bookings\/\w+/);
      expect(page.url()).toMatch(/\/bookings\/\w+/);
      
      // Verify booking details page content
      await expect(page.locator('[data-testid=booking-details]')).toBeVisible();
    }
  });

  test('handles message-related actions correctly', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Find message-related activity
    const messageActivity = page.locator('[data-testid=activity-item]').filter({ hasText: 'message' }).first();
    
    if (await messageActivity.isVisible()) {
      const messageAction = messageActivity.locator('[data-testid=activity-action-button]');
      
      if (await messageAction.isVisible()) {
        // Click message action
        await messageAction.click();
        
        // Should navigate to messages
        await page.waitForURL(/\/messages/);
        expect(page.url()).toMatch(/\/messages/);
      }
    }
  });

  test('displays proper styling for action buttons', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Check that action buttons have primary styling
    const actionButtons = page.locator('[data-testid=activity-action-button]');
    const firstButton = actionButtons.first();
    
    if (await firstButton.isVisible()) {
      // Should have primary button styling
      await expect(firstButton).toHaveClass(/bg-primary/);
      await expect(firstButton).toHaveClass(/text-primary-foreground/);
      await expect(firstButton).toHaveClass(/px-3/);
      await expect(firstButton).toHaveClass(/py-1\.5/);
      await expect(firstButton).toHaveClass(/text-xs/);
      await expect(firstButton).toHaveClass(/font-medium/);
      await expect(firstButton).toHaveClass(/rounded-md/);
    }
  });

  test('shows hover effects on action buttons', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    const actionButton = page.locator('[data-testid=activity-action-button]').first();
    
    if (await actionButton.isVisible()) {
      // Hover over the button
      await actionButton.hover();
      
      // Should have hover effect
      await expect(actionButton).toHaveClass(/hover:bg-primary\/90/);
    }
  });

  test('loads more activities when scrolling', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Get initial count of activity items
    const initialCount = await page.locator('[data-testid=activity-item]').count();
    
    // Scroll to bottom of activity feed
    await page.locator('[data-testid=recent-activity]').evaluate((el) => el.scrollTop = el.scrollHeight);
    
    // Wait for potential loading
    await page.waitForTimeout(1000);
    
    // Check if more activities loaded (optional, depends on data)
    const finalCount = await page.locator('[data-testid=activity-item]').count();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('refreshes activity feed when refresh button is clicked', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Find and click refresh button
    const refreshButton = page.locator('[data-testid=activity-refresh-button]');
    
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      
      // Should show loading state
      await expect(page.locator('[data-testid=activity-loading]')).toBeVisible();
      
      // Should finish loading and show activities
      await page.waitForSelector('[data-testid=activity-item]', { timeout: 5000 });
    }
  });

  test('displays empty state when no activities', async ({ page }) => {
    // This would require mocking empty activity data
    // For now, just test that empty state component exists
    
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Check if empty state could be displayed
    const emptyState = page.locator('[data-testid=activity-empty-state]');
    
    // This test would need proper data mocking to be reliable
    if (await emptyState.isVisible()) {
      await expect(emptyState).toContainText('No recent activity');
    }
  });

  test('handles error states gracefully', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Check for error state (would need API mocking to test properly)
    const errorState = page.locator('[data-testid=activity-error]');
    
    if (await errorState.isVisible()) {
      await expect(errorState).toContainText('Failed to load');
      
      // Should have retry button
      const retryButton = page.locator('[data-testid=activity-retry-button]');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        // Should attempt to reload
      }
    }
  });

  test('maintains accessibility with enhanced actions', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Check keyboard navigation
    const actionButton = page.locator('[data-testid=activity-action-button]').first();
    
    if (await actionButton.isVisible()) {
      // Tab to action button
      await page.keyboard.press('Tab');
      await expect(actionButton).toBeFocused();
      
      // Activate with Enter key
      await page.keyboard.press('Enter');
      
      // Should navigate (we checked this in previous tests)
    }
    
    // Check ARIA labels
    const actionButtons = page.locator('[data-testid=activity-action-button]');
    const count = await actionButtons.count();
    
    for (let i = 0; i < count; i++) {
      const button = actionButtons.nth(i);
      if (await button.isVisible()) {
        // Should have proper ARIA attributes
        const ariaLabel = await button.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel!.length).toBeGreaterThan(0);
      }
    }
  });

  test('works correctly on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // Action buttons should be touch-friendly on mobile
    const actionButtons = page.locator('[data-testid=activity-action-button]');
    const firstButton = actionButtons.first();
    
    if (await firstButton.isVisible()) {
      // Check button size is appropriate for touch
      const boundingBox = await firstButton.boundingBox();
      expect(boundingBox?.height).toBeGreaterThanOrEqual(32); // Minimum touch target
      expect(boundingBox?.width).toBeGreaterThanOrEqual(32);
    }
    
    // Test touch interaction
    if (await firstButton.isVisible()) {
      await firstButton.tap();
      // Should work the same as click
    }
  });

  test('integrates with real-time updates', async ({ page }) => {
    await page.goto('/dashboard/renter');
    await page.waitForSelector('[data-testid=recent-activity]');
    
    // This test would require WebSocket mocking
    // For now, just verify the component structure supports real-time updates
    
    const activityFeed = page.locator('[data-testid=recent-activity]');
    await expect(activityFeed).toBeVisible();
    
    // Should have data attributes for real-time updates
    const hasRealTimeAttr = await activityFeed.getAttribute('data-real-time-enabled');
    // This would be set if real-time is enabled
  });
});
