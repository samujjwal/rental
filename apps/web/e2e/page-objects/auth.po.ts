import { Page, Locator } from '@playwright/test';

/**
 * Auth Page Object
 * Encapsulates all authentication-related page interactions
 */
export class AuthPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signupButton: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[data-testid=email-input]');
    this.passwordInput = page.locator('[data-testid=password-input]');
    this.loginButton = page.locator('[data-testid=login-button]');
    this.signupButton = page.locator('[data-testid=signup-button]');
    this.userMenu = page.locator('[data-testid=user-menu]');
    this.logoutButton = page.locator('[data-testid=logout-button]');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async signup(email: string, password: string, confirmPassword: string, role: string) {
    await this.page.fill('[data-testid=signup-email]', email);
    await this.page.fill('[data-testid=signup-password]', password);
    await this.page.fill('[data-testid=signup-confirm-password]', confirmPassword);
    await this.page.selectOption('[data-testid=role-select]', role);
    await this.signupButton.click();
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
  }

  async isLoggedIn(): Promise<boolean> {
    return await this.userMenu.isVisible();
  }

  async getErrorMessage(): Promise<string> {
    const error = this.page.locator('[data-testid=login-error], [data-testid=signup-error]');
    return await error.textContent() || '';
  }
}

/**
 * Payment Page Object
 * Encapsulates payment and checkout interactions
 */
export class PaymentPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async fillPaymentForm(details: {
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    name: string;
  }) {
    // Wait for Stripe Elements to be ready
    await this.page.waitForSelector('[data-testid=payment-element]', { timeout: 10000 });
    
    // Fill payment details in Stripe Elements
    // Note: In real tests, Stripe Elements are iframes and need special handling
    const cardFrame = this.page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    await cardFrame.locator('[placeholder="Card number"]').fill(details.cardNumber);
    await cardFrame.locator('[placeholder="MM / YY"]').fill(details.expiryDate);
    await cardFrame.locator('[placeholder="CVC"]').fill(details.cvv);
    
    await this.page.fill('[data-testid=cardholder-name]', details.name);
  }

  async completePayment() {
    await this.page.click('[data-testid=complete-payment]');
  }

  async waitForPaymentSuccess(timeout = 30000) {
    await this.page.waitForSelector('[data-testid=payment-success]', { timeout });
  }

  async waitForPaymentError(timeout = 10000) {
    await this.page.waitForSelector('[data-testid=payment-error]', { timeout });
  }

  async getPaymentErrorMessage(): Promise<string> {
    const error = this.page.locator('[data-testid=payment-error-message]');
    return await error.textContent() || '';
  }

  async isProcessing(): Promise<boolean> {
    return await this.page.locator('[data-testid=payment-processing]').isVisible();
  }

  async clickRetry() {
    await this.page.click('[data-testid=retry-payment]');
  }

  async clickTryAnotherCard() {
    await this.page.click('[data-testid=try-another-card]');
  }
}

/**
 * Search Page Object
 * Encapsulates search functionality
 */
export class SearchPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly resultsList: Locator;
  readonly filterPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('[data-testid=search-input]');
    this.searchButton = page.locator('[data-testid=search-button]');
    this.resultsList = page.locator('[data-testid=search-results]');
    this.filterPanel = page.locator('[data-testid=filter-panel]');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async getResultsCount(): Promise<number> {
    const results = this.page.locator('[data-testid=listing-card]');
    return await results.count();
  }

  async applyPriceFilter(min: number, max: number) {
    await this.page.click('[data-testid=price-filter]');
    await this.page.fill('[data-testid=min-price]', min.toString());
    await this.page.fill('[data-testid=max-price]', max.toString());
    await this.page.click('[data-testid=apply-filters]');
    await this.page.waitForLoadState('networkidle');
  }

  async selectFirstResult() {
    const firstResult = this.page.locator('[data-testid=listing-card]').first();
    await firstResult.click();
  }
}

/**
 * Bookings Page Object
 * Encapsulates booking management interactions
 */
export class BookingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateToBookings() {
    await this.page.goto('/bookings');
  }

  async getBookingsCount(): Promise<number> {
    const bookings = this.page.locator('[data-testid=booking-item]');
    return await bookings.count();
  }

  async selectBooking(index: number) {
    const booking = this.page.locator('[data-testid=booking-item]').nth(index);
    await booking.click();
  }

  async cancelBooking(reason: string) {
    await this.page.click('[data-testid=cancel-booking-button]');
    await this.page.fill('[data-testid=cancel-reason]', reason);
    await this.page.click('[data-testid=confirm-cancel]');
  }

  async approveBooking() {
    await this.page.click('[data-testid=approve-booking-button]');
    await this.page.click('[data-testid=confirm-approve]');
  }

  async getBookingStatus(): Promise<string> {
    const status = this.page.locator('[data-testid=booking-status]');
    return await status.textContent() || '';
  }
}

/**
 * Listings Page Object
 * Encapsulates listing management
 */
export class ListingsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateToCreateListing() {
    await this.page.goto('/listings/new');
  }

  async fillListingDetails(details: {
    title: string;
    description: string;
    price: number;
    category: string;
  }) {
    await this.page.fill('[data-testid=listing-title]', details.title);
    await this.page.fill('[data-testid=listing-description]', details.description);
    await this.page.fill('[data-testid=listing-price]', details.price.toString());
    await this.page.selectOption('[data-testid=listing-category]', details.category);
  }

  async nextStep() {
    await this.page.click('[data-testid=next-step-button]');
  }

  async publishListing() {
    await this.page.click('[data-testid=publish-button]');
  }

  async uploadImages(filePaths: string[]) {
    const input = this.page.locator('[data-testid=image-upload-input]');
    await input.setInputFiles(filePaths);
  }
}

export default AuthPage;
