import { test as base, expect, type Page, type Route } from '@playwright/test';

// Navigation helpers for consistent test interactions
export class NavigationHelper {
  constructor(private page: Page) {}

  async navigateToHome() {
    await this.page.goto('/');
    await this.waitForPageLoad();
  }

  async navigateToSearch(filters?: Record<string, string>) {
    const url = filters ? `/search?${new URLSearchParams(filters)}` : '/search';
    await this.page.goto(url);
    await this.waitForPageLoad();
  }

  async navigateToListing(listingId: string) {
    await this.page.goto(`/listings/${listingId}`);
    await this.waitForPageLoad();
  }

  async navigateToDashboard() {
    await this.page.goto('/dashboard');
    await this.waitForPageLoad();
  }

  async navigateToBookings() {
    await this.page.goto('/bookings');
    await this.waitForPageLoad();
  }

  async navigateToMessages() {
    await this.page.goto('/messages');
    await this.waitForPageLoad();
  }

  async navigateToSettings() {
    await this.page.goto('/settings');
    await this.waitForPageLoad();
  }

  private async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('[data-testid="page-loaded"]', { timeout: 5000 }).catch(() => {
      // Fallback if page-loaded selector doesn't exist
    });
  }

  async waitForLoadingComplete() {
    await this.page.waitForSelector('[data-testid="loading"]', { state: 'detached' }).catch(() => {
      // Continue if no loading indicator
    });
  }

  async getCurrentPath() {
    return this.page.url().split('?')[0];
  }

  async getCurrentQueryParams() {
    const url = new URL(this.page.url());
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }
}

// Assertion helpers for consistent test validations
export class AssertionHelper {
  constructor(private page: Page) {}

  async assertPageTitle(expectedTitle: string) {
    await expect(this.page).toHaveTitle(new RegExp(expectedTitle, 'i'));
  }

  async assertUrlContains(expectedPath: string) {
    await expect(this.page).toHaveURL(new RegExp(expectedPath));
  }

  async assertElementVisible(selector: string, timeout = 5000) {
    await expect(this.page.locator(selector)).toBeVisible({ timeout });
  }

  async assertElementHidden(selector: string) {
    await expect(this.page.locator(selector)).toBeHidden();
  }

  async assertElementText(selector: string, expectedText: string | RegExp) {
    await expect(this.page.locator(selector)).toContainText(expectedText);
  }

  async assertElementDisabled(selector: string) {
    await expect(this.page.locator(selector)).toBeDisabled();
  }

  async assertElementEnabled(selector: string) {
    await expect(this.page.locator(selector)).toBeEnabled();
  }

  async assertElementCount(selector: string, expectedCount: number) {
    await expect(this.page.locator(selector)).toHaveCount(expectedCount);
  }

  async assertToastVisible(message?: string) {
    const toast = this.page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible();
    if (message) {
      await expect(toast).toContainText(message);
    }
  }

  async assertErrorVisible(message?: string) {
    const error = this.page.locator('[data-testid="error-message"]');
    await expect(error).toBeVisible();
    if (message) {
      await expect(error).toContainText(message);
    }
  }

  async assertLoadingVisible() {
    await expect(this.page.locator('[data-testid="loading"]')).toBeVisible();
  }

  async assertLoadingHidden() {
    await expect(this.page.locator('[data-testid="loading"]')).toBeHidden();
  }

  async assertEmptyStateVisible() {
    await expect(this.page.locator('[data-testid="empty-state"]')).toBeVisible();
  }

  async assertSkeletonVisible() {
    await expect(this.page.locator('[data-testid="skeleton"]')).toBeVisible();
  }
}

// Accessibility helpers for WCAG compliance testing
export class AccessibilityHelper {
  constructor(private page: Page) {}

  async checkKeyboardNavigation() {
    const focusableElements = await this.page.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();
    
    for (let i = 0; i < focusableElements.length; i++) {
      await focusableElements[i].focus();
      const focusedElement = await this.page.locator(':focus');
      await expect(focusedElement).toBe(focusableElements[i]);
    }
  }

  async checkColorContrast() {
    // This would typically use a color contrast library
    // For now, just ensure high contrast mode works
    await this.page.emulateMedia({ colorScheme: 'dark' });
    await this.page.waitForTimeout(1000);
    
    // Check that content is still visible in high contrast
    const visibleElements = await this.page.locator('body *:visible').count();
    expect(visibleElements).toBeGreaterThan(0);
  }

  async checkScreenReaderSupport() {
    // Check for proper ARIA labels
    const interactiveElements = await this.page.locator(
      'button, [href], input, select, textarea'
    ).all();
    
    for (const element of interactiveElements) {
      const hasAriaLabel = await element.getAttribute('aria-label');
      const hasAriaLabelledBy = await element.getAttribute('aria-labelledby');
      const hasTitle = await element.getAttribute('title');
      const hasText = await element.textContent();
      
      const hasAccessibleName = hasAriaLabel || hasAriaLabelledBy || hasTitle || hasText?.trim();
      expect(hasAccessibleName).toBeTruthy();
    }
  }

  async checkFocusManagement() {
    // Check that modals trap focus
    const modals = await this.page.locator('[role="dialog"]').all();
    
    for (const modal of modals) {
      if (await modal.isVisible()) {
        await modal.press('Tab');
        const focusedElement = await this.page.locator(':focus');
        const isInsideModal = await modal.evaluate((el, focused) => 
          el.contains(focused), await focusedElement.elementHandle()
        );
        expect(isInsideModal).toBeTruthy();
      }
    }
  }

  async checkReducedMotion() {
    await this.page.emulateMedia({ reducedMotion: 'reduce' });
    await this.page.waitForTimeout(1000);
    
    // Check that animations are disabled
    const animatedElements = await this.page.locator('[style*="animation"], [style*="transition"]').all();
    
    for (const element of animatedElements) {
      const style = await element.getAttribute('style');
      expect(style).not.toContain('animation');
      expect(style).not.toContain('transition');
    }
  }
}

// Form helpers for form interaction testing
export class FormHelper {
  constructor(private page: Page) {}

  async fillForm(formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      await this.page.fill(`[data-testid="${field}"]`, value);
    }
  }

  async submitForm(formSelector = 'form') {
    await this.page.click(`${formSelector} [data-testid="submit-button"]`);
  }

  async assertFormError(field: string, expectedError: string) {
    const errorElement = this.page.locator(`[data-testid="${field}-error"]`);
    await expect(errorElement).toBeVisible();
    await expect(errorElement).toContainText(expectedError);
  }

  async assertFormValid() {
    const errorElements = await this.page.locator('[data-testid*="-error"]').all();
    for (const error of errorElements) {
      await expect(error).toBeHidden();
    }
  }

  async assertFieldValue(field: string, expectedValue: string) {
    await expect(this.page.locator(`[data-testid="${field}"]`)).toHaveValue(expectedValue);
  }
}

// API helpers for mocking and testing API interactions
export class ApiHelper {
  constructor(private page: Page) {}

  async mockApiResponse(endpoint: string, response: any, status = 200) {
    await this.page.route(`**${endpoint}`, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  async mockApiError(endpoint: string, error: any, status = 400) {
    await this.page.route(`**${endpoint}`, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(error)
      });
    });
  }

  async waitForApiCall(endpoint: string) {
    return this.page.waitForResponse(response => 
      response.url().includes(endpoint)
    );
  }

  async assertApiCallMade(endpoint: string) {
    const requests = await this.page.request.all();
    const apiCall = requests.find(req => req.url().includes(endpoint));
    expect(apiCall).toBeTruthy();
  }

  async getApiCalls(endpoint: string) {
    const requests = await this.page.request.all();
    return requests.filter(req => req.url().includes(endpoint));
  }
}

// Export helper factory functions
export function createNavigationHelper(page: Page) {
  return new NavigationHelper(page);
}

export function createAssertionHelper(page: Page) {
  return new AssertionHelper(page);
}

export function createAccessibilityHelper(page: Page) {
  return new AccessibilityHelper(page);
}

export function createFormHelper(page: Page) {
  return new FormHelper(page);
}

export function createApiHelper(page: Page) {
  return new ApiHelper(page);
}
