import { Page } from '@playwright/test';

/**
 * Navigation Helper
 * Provides consistent navigation methods for E2E tests
 */
export class NavigationHelper {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateToLogin() {
    await this.page.click('[data-testid=login-link]');
    await this.page.waitForURL('/auth/login');
  }

  async navigateToSignup() {
    await this.page.click('[data-testid=signup-link]');
    await this.page.waitForURL('/auth/signup');
  }

  async navigateToDashboard() {
    await this.page.click('[data-testid=dashboard-link]');
    await this.page.waitForURL(/\/dashboard/);
  }

  async navigateToSearch() {
    await this.page.click('[data-testid=search-link]');
    await this.page.waitForURL('/search');
  }

  async navigateToBookings() {
    await this.page.click('[data-testid=bookings-link]');
    await this.page.waitForURL('/bookings');
  }

  async navigateToListings() {
    await this.page.click('[data-testid=listings-link]');
    await this.page.waitForURL('/listings');
  }

  async navigateToSettings() {
    await this.page.click('[data-testid=user-menu]');
    await this.page.click('[data-testid=settings-link]');
    await this.page.waitForURL('/settings');
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async goBack() {
    await this.page.goBack();
  }

  async refresh() {
    await this.page.reload();
  }
}

export default NavigationHelper;
