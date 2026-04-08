import { test, expect, devices } from '@playwright/test';

/**
 * MOBILE AUTHENTICATION E2E TESTS
 * 
 * These tests validate mobile-specific authentication functionality:
 * - Mobile login flow optimization
 * - Mobile registration process
 * - Mobile MFA/2FA implementation
 * - Mobile password reset flow
 * - Biometric authentication (Touch ID/Face ID)
 * - Mobile session management
 * 
 * Business Truth Validated:
 * - Mobile users can authenticate seamlessly
 * - Mobile authentication is secure and user-friendly
 * - Mobile-specific auth features work correctly
 * - Session management works on mobile devices
 */

test.describe('Mobile Authentication Tests', () => {
  // Use mobile device configurations
  const mobileDevices = [
    { name: 'iPhone 14', ...devices['iPhone 14'] },
    { name: 'Pixel 5', ...devices['Pixel 5'] },
    { name: 'iPad', ...devices['iPad'] },
  ];

  mobileDevices.forEach(device => {
    test.describe(`${device.name} - Mobile Login Flow`, () => {
      test.use({ ...device });

      test('should handle mobile login with valid credentials', async ({ page }) => {
        await page.goto('/login');
        
        // Check mobile login interface
        await expect(page.locator('[data-testid="mobile-login-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-email-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-password-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-login-button"]')).toBeVisible();
        
        // Test mobile-specific login features
        await expect(page.locator('[data-testid="mobile-remember-me"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-forgot-password"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-social-login"]')).toBeVisible();
        
        // Fill in credentials
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        
        // Test mobile keyboard behavior
        await page.locator('[data-testid="mobile-password-input"]').tap();
        await expect(page.locator('[data-testid="mobile-keyboard-visible"]')).toBeVisible();
        
        // Submit login
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Verify successful login
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.locator('[data-testid="mobile-user-avatar"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-welcome-message"]')).toBeVisible();
        
        // Check mobile-specific post-login features
        await expect(page.locator('[data-testid="mobile-navigation-user"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-user-menu"]')).toBeVisible();
      });

      test('should handle mobile login with invalid credentials', async ({ page }) => {
        await page.goto('/login');
        
        // Fill in invalid credentials
        await page.locator('[data-testid="mobile-email-input"]').fill('invalid@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('wrongpassword');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Verify error handling
        await expect(page.locator('[data-testid="mobile-error-message"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-error-details"]')).toBeVisible();
        
        // Check mobile-specific error display
        await expect(page.locator('[data-testid="mobile-error-shake"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-error-icon"]')).toBeVisible();
        
        // Verify field highlighting
        await expect(page.locator('[data-testid="mobile-email-input"].error')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-password-input"].error')).toBeVisible();
        
        // Test retry functionality
        await page.locator('[data-testid="mobile-retry-button"]').tap();
        await expect(page.locator('[data-testid="mobile-error-message"]')).not.toBeVisible();
      });

      test('should handle mobile login form validation', async ({ page }) => {
        await page.goto('/login');
        
        // Test empty form submission
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Verify validation errors
        await expect(page.locator('[data-testid="mobile-email-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-password-error"]')).toBeVisible();
        
        // Test invalid email format
        await page.locator('[data-testid="mobile-email-input"]').fill('invalid-email');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-email-error"]')).toContainText('Invalid email format');
        
        // Test password length validation
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-password-error"]')).toContainText('Password must be at least 8 characters');
      });

      test('should handle mobile social login', async ({ page }) => {
        await page.goto('/login');
        
        // Test social login options
        await expect(page.locator('[data-testid="mobile-google-login"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-facebook-login"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-apple-login"]')).toBeVisible();
        
        // Test Google login flow
        await page.locator('[data-testid="mobile-google-login"]').tap();
        
        // Should redirect to Google OAuth
        await expect(page).toHaveURL(/accounts\.google\.com/);
        
        // Go back and test Apple login
        await page.goBack();
        await page.locator('[data-testid="mobile-apple-login"]').tap();
        
        // Should redirect to Apple ID
        await expect(page).toHaveURL(/appleid\.apple\.com/);
      });

      test('should handle mobile remember me functionality', async ({ page }) => {
        await page.goto('/login');
        
        // Enable remember me
        await page.locator('[data-testid="mobile-remember-me"]').tap();
        await expect(page.locator('[data-testid="mobile-remember-me"].checked')).toBeVisible();
        
        // Login with remember me
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Verify successful login
        await expect(page).toHaveURL(/\/dashboard/);
        
        // Close and reopen app (simulate app restart)
        await page.context().clearCookies();
        await page.reload();
        
        // Should still be logged in (remember me worked)
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.locator('[data-testid="mobile-user-avatar"]')).toBeVisible();
      });
    });

    test.describe(`${device.name} - Mobile Registration`, () => {
      test.use({ ...device });

      test('should handle mobile registration flow', async ({ page }) => {
        await page.goto('/register');
        
        // Check mobile registration interface
        await expect(page.locator('[data-testid="mobile-registration-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-registration-form"]')).toBeVisible();
        
        // Test mobile-specific registration features
        await expect(page.locator('[data-testid="mobile-step-indicator"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-progress-bar"]')).toBeVisible();
        
        // Step 1: Basic Information
        await page.locator('[data-testid="mobile-first-name-input"]').fill('John');
        await page.locator('[data-testid="mobile-last-name-input"]').fill('Doe');
        await page.locator('[data-testid="mobile-email-input"]').fill('john.doe@example.com');
        await page.locator('[data-testid="mobile-phone-input"]').fill('+1234567890');
        
        // Test mobile phone number formatting
        await expect(page.locator('[data-testid="mobile-phone-formatted"]')).toContainText('+1 (234) 567-890');
        
        // Continue to next step
        await page.locator('[data-testid="mobile-next-button"]').tap();
        
        // Step 2: Password Creation
        await expect(page.locator('[data-testid="mobile-password-step"]')).toBeVisible();
        await page.locator('[data-testid="mobile-password-input"]').fill('SecureP@ssw0rd123!');
        await page.locator('[data-testid="mobile-confirm-password-input"]').fill('SecureP@ssw0rd123!');
        
        // Test password strength indicator
        await expect(page.locator('[data-testid="mobile-password-strength"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-password-strength"].strong')).toBeVisible();
        
        // Continue to next step
        await page.locator('[data-testid="mobile-next-button"]').tap();
        
        // Step 3: Account Verification
        await expect(page.locator('[data-testid="mobile-verification-step"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-verification-code-input"]')).toBeVisible();
        
        // Simulate verification code
        await page.locator('[data-testid="mobile-verification-code-input"]').fill('123456');
        
        // Complete registration
        await page.locator('[data-testid="mobile-complete-button"]').tap();
        
        // Verify successful registration
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.locator('[data-testid="mobile-welcome-message"]')).toContainText('Welcome, John!');
      });

      test('should handle mobile registration validation', async ({ page }) => {
        await page.goto('/register');
        
        // Test empty form validation
        await page.locator('[data-testid="mobile-next-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-first-name-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-last-name-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-email-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-phone-error"]')).toBeVisible();
        
        // Test email validation
        await page.locator('[data-testid="mobile-email-input"]').fill('invalid-email');
        await page.locator('[data-testid="mobile-next-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-email-error"]')).toContainText('Invalid email format');
        
        // Test phone validation
        await page.locator('[data-testid="mobile-phone-input"]').fill('123');
        await page.locator('[data-testid="mobile-next-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-phone-error"]')).toContainText('Invalid phone number');
        
        // Test password validation
        await page.locator('[data-testid="mobile-first-name-input"]').fill('John');
        await page.locator('[data-testid="mobile-last-name-input"]').fill('Doe');
        await page.locator('[data-testid="mobile-email-input"]').fill('john.doe@example.com');
        await page.locator('[data-testid="mobile-phone-input"]').fill('+1234567890');
        await page.locator('[data-testid="mobile-next-button"]').tap();
        
        await page.locator('[data-testid="mobile-password-input"]').fill('weak');
        await page.locator('[data-testid="mobile-next-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-password-error"]')).toContainText('Password is too weak');
      });

      test('should handle mobile registration with social accounts', async ({ page }) => {
        await page.goto('/register');
        
        // Test social registration options
        await expect(page.locator('[data-testid="mobile-social-register"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-google-register"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-facebook-register"]')).toBeVisible();
        
        // Test Google registration
        await page.locator('[data-testid="mobile-google-register"]').tap();
        
        // Should redirect to Google OAuth
        await expect(page).toHaveURL(/accounts\.google\.com/);
      });
    });

    test.describe(`${device.name} - Mobile MFA/2FA`, () => {
      test.use({ ...device });

      test('should handle mobile SMS MFA', async ({ page }) => {
        // First login to trigger MFA
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('mfa-user@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Should redirect to MFA page
        await expect(page).toHaveURL(/\/mfa/);
        await expect(page.locator('[data-testid="mobile-mfa-container"]')).toBeVisible();
        
        // Test MFA interface
        await expect(page.locator('[data-testid="mobile-mfa-title"]')).toContainText('Two-Factor Authentication');
        await expect(page.locator('[data-testid="mobile-mfa-method-sms"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-mfa-code-input"]')).toBeVisible();
        
        // Test SMS code input
        await page.locator('[data-testid="mobile-mfa-code-input"]').fill('123456');
        
        // Test resend functionality
        await page.locator('[data-testid="mobile-resend-code"]').tap();
        await expect(page.locator('[data-testid="mobile-resend-success"]')).toBeVisible();
        
        // Submit MFA code
        await page.locator('[data-testid="mobile-verify-button"]').tap();
        
        // Verify successful authentication
        await expect(page).toHaveURL(/\/dashboard/);
      });

      test('should handle mobile authenticator app MFA', async ({ page }) => {
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('auth-app-user@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Switch to authenticator app method
        await page.locator('[data-testid="mobile-mfa-method-authenticator"]').tap();
        
        // Test authenticator app interface
        await expect(page.locator('[data-testid="mobile-authenticator-instructions"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-authenticator-qr"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-authenticator-code-input"]')).toBeVisible();
        
        // Test authenticator code input
        await page.locator('[data-testid="mobile-authenticator-code-input"]').fill('123456');
        await page.locator('[data-testid="mobile-verify-button"]').tap();
        
        // Verify successful authentication
        await expect(page).toHaveURL(/\/dashboard/);
      });

      test('should handle mobile MFA setup', async ({ page }) => {
        // Login and navigate to security settings
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        await page.goto('/settings/security');
        
        // Setup MFA
        await page.locator('[data-testid="mobile-setup-mfa"]').tap();
        
        // Test MFA setup flow
        await expect(page.locator('[data-testid="mobile-mfa-setup-container"]')).toBeVisible();
        await page.locator('[data-testid="mobile-mfa-method-sms"]').tap();
        await page.locator('[data-testid="mobile-phone-input"]').fill('+1234567890');
        await page.locator('[data-testid="mobile-send-code"]').tap();
        
        // Verify setup
        await page.locator('[data-testid="mobile-verification-code-input"]').fill('123456');
        await page.locator('[data-testid="mobile-verify-setup"]').tap();
        
        // Should show success message
        await expect(page.locator('[data-testid="mobile-mfa-setup-success"]')).toBeVisible();
      });
    });

    test.describe(`${device.name} - Mobile Password Reset`, () => {
      test.use({ ...device });

      test('should handle mobile password reset flow', async ({ page }) => {
        await page.goto('/login');
        
        // Click forgot password
        await page.locator('[data-testid="mobile-forgot-password"]').tap();
        
        // Should navigate to password reset page
        await expect(page).toHaveURL(/\/reset-password/);
        await expect(page.locator('[data-testid="mobile-reset-container"]')).toBeVisible();
        
        // Test password reset interface
        await expect(page.locator('[data-testid="mobile-reset-title"]')).toContainText('Reset Password');
        await expect(page.locator('[data-testid="mobile-email-input"]').toBeVisible();
        await expect(page.locator('[data-testid="mobile-send-reset-button"]').toBeVisible();
        
        // Enter email
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-send-reset-button"]').tap();
        
        // Should show confirmation
        await expect(page.locator('[data-testid="mobile-reset-sent"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-reset-instructions"]')).toBeVisible();
      });

      test('should handle mobile password reset confirmation', async ({ page }) => {
        // Navigate to reset confirmation page
        await page.goto('/reset-password/confirm?token=reset-token-123');
        
        // Test reset confirmation interface
        await expect(page.locator('[data-testid="mobile-reset-confirm-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-new-password-input"]').toBeVisible();
        await expect(page.locator('[data-testid="mobile-confirm-password-input"]').toBeVisible();
        
        // Test password strength indicator
        await page.locator('[data-testid="mobile-new-password-input"]').fill('NewSecureP@ssw0rd123!');
        await expect(page.locator('[data-testid="mobile-password-strength"]')).toBeVisible();
        
        // Confirm password
        await page.locator('[data-testid="mobile-confirm-password-input"]').fill('NewSecureP@ssw0rd123!');
        await page.locator('[data-testid="mobile-reset-confirm-button"]').tap();
        
        // Verify successful reset
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('[data-testid="mobile-reset-success-message"]')).toBeVisible();
      });

      test('should handle mobile password reset validation', async ({ page }) => {
        await page.goto('/reset-password/confirm?token=reset-token-123');
        
        // Test empty form validation
        await page.locator('[data-testid="mobile-reset-confirm-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-new-password-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-confirm-password-error"]')).toBeVisible();
        
        // Test password mismatch
        await page.locator('[data-testid="mobile-new-password-input"]').fill('Password123!');
        await page.locator('[data-testid="mobile-confirm-password-input"]').fill('DifferentPassword123!');
        await page.locator('[data-testid="mobile-reset-confirm-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-confirm-password-error"]')).toContainText('Passwords do not match');
        
        // Test weak password
        await page.locator('[data-testid="mobile-new-password-input"]').fill('weak');
        await page.locator('[data-testid="mobile-confirm-password-input"]').fill('weak');
        await page.locator('[data-testid="mobile-reset-confirm-button"]').tap();
        
        await expect(page.locator('[data-testid="mobile-new-password-error"]']).toContainText('Password is too weak');
      });
    });

    test.describe(`${device.name} - Biometric Authentication`, () => {
      test.use({ ...device });

      test('should handle mobile Touch ID authentication', async ({ page }) => {
        // Mock Touch ID availability
        await page.addInitScript(() => {
          Object.defineProperty(window, 'PublicKeyCredential', {
            value: {
              isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
            }
          });
        });
        
        await page.goto('/login');
        
        // Test biometric login option
        await expect(page.locator('[data-testid="mobile-biometric-login"]')).toBeVisible();
        await page.locator('[data-testid="mobile-biometric-login"]').tap();
        
        // Should show biometric prompt
        await expect(page.locator('[data-testid="mobile-biometric-prompt"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-touch-id-prompt"]')).toBeVisible();
        
        // Mock successful Touch ID
        await page.locator('[data-testid="mobile-biometric-success"]').tap();
        
        // Verify successful login
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.locator('[data-testid="mobile-user-avatar"]')).toBeVisible();
      });

      test('should handle mobile Face ID authentication', async ({ page }) => {
        // Mock Face ID availability
        await page.addInitScript(() => {
          Object.defineProperty(window, 'PublicKeyCredential', {
            value: {
              isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
            }
          });
        });
        
        await page.goto('/login');
        
        // Test Face ID option
        await expect(page.locator('[data-testid="mobile-face-id-login"]')).toBeVisible();
        await page.locator('[data-testid="mobile-face-id-login"]').tap();
        
        // Should show Face ID prompt
        await expect(page.locator('[data-testid="mobile-face-id-prompt"]')).toBeVisible();
        
        // Mock successful Face ID
        await page.locator('[data-testid="mobile-biometric-success"]').tap();
        
        // Verify successful login
        await expect(page).toHaveURL(/\/dashboard/);
      });

      test('should handle mobile biometric setup', async ({ page }) => {
        // Login and navigate to security settings
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        await page.goto('/settings/security');
        
        // Setup biometric authentication
        await page.locator('[data-testid="mobile-setup-biometric"]').tap();
        
        // Test biometric setup flow
        await expect(page.locator('[data-testid="mobile-biometric-setup-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-biometric-instructions"]')).toBeVisible();
        
        // Start setup
        await page.locator('[data-testid="mobile-start-biometric-setup"]').tap();
        
        // Should show biometric prompt
        await expect(page.locator('[data-testid="mobile-biometric-prompt"]')).toBeVisible();
        
        // Mock successful biometric setup
        await page.locator('[data-testid="mobile-biometric-success"]').tap();
        
        // Should show success message
        await expect(page.locator('[data-testid="mobile-biometric-setup-success"]')).toBeVisible();
      });

      test('should handle mobile biometric fallback', async ({ page }) => {
        await page.goto('/login');
        
        // Test biometric login
        await page.locator('[data-testid="mobile-biometric-login"]').tap();
        
        // Mock biometric failure
        await page.locator('[data-testid="mobile-biometric-failure"]').tap();
        
        // Should show fallback options
        await expect(page.locator('[data-testid="mobile-biometric-fallback"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-use-password"]').toBeVisible();
        
        // Use password fallback
        await page.locator('[data-testid="mobile-use-password"]').tap();
        
        // Should show password form
        await expect(page.locator('[data-testid="mobile-password-input"]').toBeVisible();
        await expect(page.locator('[data-testid="mobile-login-button"]').toBeVisible();
      });
    });

    test.describe(`${device.name} - Mobile Session Management`, () => {
      test.use({ ...device });

      test('should handle mobile session persistence', async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Verify session is active
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.locator('[data-testid="mobile-user-avatar"]')).toBeVisible();
        
        // Simulate app background and foreground
        await page.evaluate(() => {
          document.dispatchEvent(new Event('visibilitychange'));
        });
        
        // Should still be logged in
        await expect(page.locator('[data-testid="mobile-user-avatar"]')).toBeVisible();
        
        // Test session timeout
        await page.evaluate(() => {
          // Simulate session expiration
          localStorage.removeItem('authToken');
        });
        
        // Navigate to protected page
        await page.goto('/dashboard');
        
        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('[data-testid="mobile-session-expired"]')).toBeVisible();
      });

      test('should handle mobile concurrent sessions', async ({ page }) => {
        // Login on mobile
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Verify session is active
        await expect(page).toHaveURL(/\/dashboard/);
        
        // Simulate login from another device
        await page.evaluate(() => {
          // Simulate new login from different device
          fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'password123',
              deviceId: 'different-device-id'
            })
          });
        });
        
        // Should show session conflict notification
        await expect(page.locator('[data-testid="mobile-session-conflict"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-session-conflict-message"]')).toBeVisible();
        
        // Test session conflict resolution
        await page.locator('[data-testid="mobile-continue-session"]').tap();
        
        // Should remain logged in
        await expect(page).toHaveURL(/\/dashboard/);
      });

      test('should handle mobile logout', async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Logout from mobile menu
        await page.locator('[data-testid="mobile-user-menu"]').tap();
        await page.locator('[data-testid="mobile-logout-button"]').tap();
        
        // Should show logout confirmation
        await expect(page.locator('[data-testid="mobile-logout-confirm"]')).toBeVisible();
        await page.locator('[data-testid="mobile-logout-confirm-button"]').tap();
        
        // Verify logout
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('[data-testid="mobile-logout-success"]')).toBeVisible();
        
        // Verify session is cleared
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login/);
      });
    });

    test.describe(`${device.name} - Mobile Authentication Performance`, () => {
      test.use({ ...device });

      test('should handle mobile authentication performance', async ({ page }) => {
        // Measure login performance
        const startTime = Date.now();
        await page.goto('/login');
        
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        await page.waitForURL(/\/dashboard/);
        const loginTime = Date.now() - startTime;
        
        // Mobile login should be fast
        expect(loginTime).toBeLessThan(3000); // 3 seconds max
        
        // Check authentication performance metrics
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          };
        });
        
        expect(metrics.loadTime).toBeLessThan(2000);
        expect(metrics.domContentLoaded).toBeLessThan(1500);
      });

      test('should handle mobile authentication under poor network', async ({ page }) => {
        // Simulate slow network
        await page.route('**/*', async route => {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
          await route.continue();
        });
        
        const startTime = Date.now();
        await page.goto('/login');
        
        await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
        await page.locator('[data-testid="mobile-password-input"]').fill('password123');
        await page.locator('[data-testid="mobile-login-button"]').tap();
        
        // Should show loading indicator
        await expect(page.locator('[data-testid="mobile-login-loading"]')).toBeVisible();
        
        await page.waitForURL(/\/dashboard/);
        const loginTime = Date.now() - startTime;
        
        // Should still complete within reasonable time
        expect(loginTime).toBeLessThan(8000); // 8 seconds max with slow network
      });
    });
  });

  test.describe('Mobile Cross-Device Authentication Consistency', () => {
    test.use({ ...devices['iPhone 14'] });
    
    test('should maintain authentication consistency across mobile devices', async ({ page }) => {
      // Test that authentication works consistently across different mobile devices
      await page.goto('/login');
      
      // Verify mobile authentication interface is consistent
      const coreAuthElements = [
        '[data-testid="mobile-login-container"]',
        '[data-testid="mobile-email-input"]',
        '[data-testid="mobile-password-input"]',
        '[data-testid="mobile-login-button"]',
        '[data-testid="mobile-forgot-password"]',
      ];
      
      for (const selector of coreAuthElements) {
        await expect(page.locator(selector)).toBeVisible();
      }
      
      // Test authentication flow
      await page.locator('[data-testid="mobile-email-input"]').fill('test@example.com');
      await page.locator('[data-testid="mobile-password-input"]').fill('password123');
      await page.locator('[data-testid="mobile-login-button"]').tap();
      
      // Verify successful authentication
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('[data-testid="mobile-user-avatar"]')).toBeVisible();
    });
  });
});
