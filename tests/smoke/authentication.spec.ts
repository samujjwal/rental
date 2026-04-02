import { test, expect } from '../fixtures/auth';
import { createNavigationHelper, createAssertionHelper, createFormHelper } from '../helpers/navigation';

test.describe('Authentication Flow', () => {
  test('should allow user to login with valid credentials', async ({ page, unauthenticatedPage }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);
    const form = createFormHelper(page);

    // Navigate to login page
    await navigation.navigateToHome();
    await page.click('[data-testid="login-button"]');
    await assertions.assertUrlContains('/auth/login');

    // Fill login form
    await form.fillForm({
      'email-input': 'test@example.com',
      'password-input': 'TestPassword123!'
    });

    // Submit form
    await form.submitForm();

    // Verify successful login
    await assertions.assertUrlContains('/dashboard');
    await assertions.assertElementVisible('[data-testid="user-menu"]');
    await assertions.assertElementText('[data-testid="welcome-message"]', 'Welcome');
  });

  test('should show error for invalid credentials', async ({ page, unauthenticatedPage }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);
    const form = createFormHelper(page);

    // Mock authentication error
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid credentials'
        })
      });
    });

    // Navigate to login page
    await navigation.navigateToHome();
    await page.click('[data-testid="login-button"]');

    // Fill invalid credentials
    await form.fillForm({
      'email-input': 'invalid@example.com',
      'password-input': 'wrongpassword'
    });

    // Submit form
    await form.submitForm();

    // Verify error shown
    await assertions.assertErrorVisible('Invalid credentials');
    await assertions.assertUrlContains('/auth/login');
  });

  test('should validate form fields', async ({ page, unauthenticatedPage }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);
    const form = createFormHelper(page);

    // Navigate to login page
    await navigation.navigateToHome();
    await page.click('[data-testid="login-button"]');

    // Submit empty form
    await form.submitForm();

    // Verify validation errors
    await assertions.assertFormError('email-input', 'Email is required');
    await assertions.assertFormError('password-input', 'Password is required');

    // Fill email only
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await form.submitForm();

    // Verify email validation
    await assertions.assertFormError('email-input', 'Please enter a valid email');
  });

  test('should allow user registration', async ({ page, unauthenticatedPage }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);
    const form = createFormHelper(page);

    // Mock successful registration
    await page.route('**/auth/register', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'new-user-id',
            email: 'new@example.com',
            firstName: 'New',
            lastName: 'User',
            role: 'renter'
          },
          accessToken: 'new-access-token'
        })
      });
    });

    // Navigate to signup page
    await navigation.navigateToHome();
    await page.click('[data-testid="signup-button"]');
    await assertions.assertUrlContains('/auth/signup');

    // Fill registration form
    await form.fillForm({
      'email-input': 'new@example.com',
      'password-input': 'TestPassword123!',
      'confirm-password-input': 'TestPassword123!',
      'first-name-input': 'New',
      'last-name-input': 'User',
      'phone-input': '+1234567890'
    });

    // Submit form
    await form.submitForm();

    // Verify successful registration
    await assertions.assertUrlContains('/dashboard');
    await assertions.assertToastVisible('Registration successful');
  });

  test('should handle password reset flow', async ({ page, unauthenticatedPage }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);
    const form = createFormHelper(page);

    // Mock password reset
    await page.route('**/auth/password/reset-request', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Password reset email sent'
        })
      });
    });

    // Navigate to forgot password page
    await navigation.navigateToHome();
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="forgot-password-link"]');
    await assertions.assertUrlContains('/auth/forgot-password');

    // Fill email and submit
    await form.fillForm({
      'email-input': 'test@example.com'
    });
    await form.submitForm();

    // Verify success message
    await assertions.assertToastVisible('Password reset email sent');
    await assertions.assertUrlContains('/auth/login');
  });

  test('should logout user successfully', async ({ authenticatedPage }) => {
    const navigation = createNavigationHelper(authenticatedPage);
    const assertions = createAssertionHelper(authenticatedPage);

    // Verify user is logged in
    await assertions.assertElementVisible('[data-testid="user-menu"]');

    // Logout
    await authenticatedPage.click('[data-testid="user-menu"]');
    await authenticatedPage.click('[data-testid="logout-button"]');

    // Verify logout
    await assertions.assertUrlContains('/auth/login');
    await assertions.assertElementHidden('[data-testid="user-menu"]');
  });

  test('should handle session expiry', async ({ page }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);

    // Mock session expiry
    await page.route('**/api/**', async (route) => {
      if (route.request().url().includes('/auth/me')) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Session expired'
          })
        });
      } else {
        await route.continue();
      }
    });

    // Try to access protected route
    await navigation.navigateToDashboard();

    // Should be redirected to login
    await assertions.assertUrlContains('/auth/login');
    await assertions.assertToastVisible('Session expired');
  });
});
