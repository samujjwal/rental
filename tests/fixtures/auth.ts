import { test as base, expect, type Page, type Route } from '@playwright/test';

// Authentication fixtures with proper typing
export const authFixtures = base.extend<{
  authenticatedUser: { email: string; password: string; role: string };
  authenticatedPage: Page;
  unauthenticatedPage: Page;
}>({
  authenticatedUser: async (
    {},
    use: (user: { email: string; password: string; role: string }) => Promise<void>,
  ) => {
    const user = {
      email: 'test-user@example.com',
      password: 'TestPassword123!',
      role: 'renter',
    };
    await use(user);
  },

  authenticatedPage: async ({ page, authenticatedUser }, use: (page: Page) => Promise<void>) => {
    // Mock authentication API
    await page.route('**/auth/login', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-id',
            email: authenticatedUser.email,
            firstName: 'Test',
            lastName: 'User',
            role: authenticatedUser.role,
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: false,
          },
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
        }),
      });
    });

    // Mock auth/me endpoint
    await page.route('**/auth/me', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: authenticatedUser.email,
          firstName: 'Test',
          lastName: 'User',
          role: authenticatedUser.role,
          status: 'ACTIVE',
          emailVerified: true,
          phoneVerified: false,
        }),
      });
    });

    // Visit login page and authenticate
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', authenticatedUser.email);
    await page.fill('[data-testid="password-input"]', authenticatedUser.password);
    await page.click('[data-testid="login-button"]');

    // Wait for navigation to dashboard
    await page.waitForURL('/dashboard');

    await use(page);
  },

  unauthenticatedPage: async ({ page }, use: (page: Page) => Promise<void>) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await use(page);
  },
});

// Role-specific fixtures
export const renterFixtures = authFixtures.extend({
  authenticatedUser: async (
    {},
    use: (user: { email: string; password: string; role: string }) => Promise<void>,
  ) => {
    await use({
      email: 'renter@example.com',
      password: 'TestPassword123!',
      role: 'renter',
    });
  },
});

export const ownerFixtures = authFixtures.extend({
  authenticatedUser: async (
    {},
    use: (user: { email: string; password: string; role: string }) => Promise<void>,
  ) => {
    await use({
      email: 'owner@example.com',
      password: 'TestPassword123!',
      role: 'owner',
    });
  },
});

export const adminFixtures = authFixtures.extend({
  authenticatedUser: async (
    {},
    use: (user: { email: string; password: string; role: string }) => Promise<void>,
  ) => {
    await use({
      email: 'admin@example.com',
      password: 'TestPassword123!',
      role: 'admin',
    });
  },
});

// Test data fixtures
export const dataFixtures = base.extend<{
  testListing: any;
  testBooking: any;
}>({
  testListing: async ({}, use: (listing: any) => Promise<void>) => {
    await use({
      id: 'test-listing-id',
      title: 'Test Listing',
      description: 'A comprehensive test listing',
      category: 'vehicle',
      price: 50,
      currency: 'USD',
      location: 'Test City',
      images: ['image1.jpg', 'image2.jpg'],
      features: {
        make: 'TestMake',
        model: 'TestModel',
        year: 2024,
      },
    });
  },

  testBooking: async ({}, use: (booking: any) => Promise<void>) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    await use({
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: nextWeek.toISOString().split('T')[0],
      totalPrice: 350,
      currency: 'USD',
    });
  },
});

// Export test objects
export { test, expect };
