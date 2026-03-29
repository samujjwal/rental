import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

/**
 * Multi-language Support E2E Tests
 * 
 * Tests comprehensive internationalization workflow:
 * - Language switching and persistence
 * - RTL language support
 * - Currency localization
 * - Date and number formatting
 * - Content translation validation
 * - Language-specific URLs and routing
 */

test.describe("Multi-language Support", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("Language Switching", () => {
    test("should switch between languages", async ({ page }) => {
      // Navigate to homepage
      await page.goto("/");
      
      // Should show language selector
      const languageSelector = page.locator('[data-testid="language-selector"]');
      await expect(languageSelector).toBeVisible();
      
      // Default should be English
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/English|EN/i);
      
      // Switch to Nepali
      await languageSelector.click();
      await page.locator('[data-testid="lang-ne"]').click();
      
      // Should update page content to Nepali
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/नेपाली|NE/i);
      
      // Should update page title
      await expect(page).toHaveTitle(/नेपाली/);
      
      // Should update navigation
      await expect(page.locator('[data-testid="nav-home"]')).toContainText(/घर/i);
      await expect(page.locator('[data-testid="nav-search"]')).toContainText(/खोज/i);
      
      // Switch to Hindi
      await languageSelector.click();
      await page.locator('[data-testid="lang-hi"]').click();
      
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/हिन्दी|HI/i);
      await expect(page).toHaveTitle(/हिन्दी/);
      
      // Switch back to English
      await languageSelector.click();
      await page.locator('[data-testid="lang-en"]').click();
      
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/English|EN/i);
      await expect(page).toHaveTitle(/GharBatai|Rental Portal/);
    });

    test("should persist language preference", async ({ page }) => {
      // Set language to Nepali
      await page.goto("/");
      const languageSelector = page.locator('[data-testid="language-selector"]');
      await languageSelector.click();
      await page.locator('[data-testid="lang-ne"]').click();
      
      // Navigate to different page
      await page.goto("/search");
      
      // Should maintain Nepali language
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/नेपाली|NE/i);
      await expect(page.locator('[data-testid="search-title"]')).toContainText(/खोज/i);
      
      // Navigate to login page
      await page.goto("/auth/login");
      
      // Should maintain Nepali language
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/नेपाली|NE/i);
      await expect(page.locator('[data-testid="login-title"]')).toContainText(/लगइन/i);
      
      // Refresh page
      await page.reload();
      
      // Should persist language preference
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/नेपाली|NE/i);
    });

    test("should handle language-specific URLs", async ({ page }) => {
      // Navigate to Nepali URL
      await page.goto("/ne");
      
      // Should show Nepali content
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/नेपाली|NE/i);
      await expect(page).toHaveURL(/.*\/ne/);
      
      // Navigate to Hindi URL
      await page.goto("/hi");
      
      // Should show Hindi content
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/हिन्दी|HI/i);
      await expect(page).toHaveURL(/.*\/hi/);
      
      // Navigate to English URL
      await page.goto("/en");
      
      // Should show English content
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/English|EN/i);
      await expect(page).toHaveURL(/.*\/en/);
      
      // Test language-specific page URLs
      await page.goto("/ne/listings");
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/नेपाली|NE/i);
      await expect(page.locator('[data-testid="listings-title"]')).toContainText(/सूचीहरू/);
      
      await page.goto("/hi/listings");
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/हिन्दी|HI/i);
      await expect(page.locator('[data-testid="listings-title"]')).toContainText(/सूची/);
    });

    test("should handle browser language detection", async ({ page }) => {
      // Set browser language to Nepali
      const context = page.context();
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'language', {
          get: () => 'ne-NP',
          configurable: true
        });
      });
      
      await page.goto("/");
      
      // Should detect and set Nepali language
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/नेपाली|NE/i);
      
      // Set browser language to Hindi
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'language', {
          get: () => 'hi-IN',
          configurable: true
        });
      });
      
      await page.goto("/");
      
      // Should detect and set Hindi language
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/हिन्दी|HI/i);
      
      // Set browser language to English
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'language', {
          get: () => 'en-US',
          configurable: true
        });
      });
      
      await page.goto("/");
      
      // Should detect and set English language
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/English|EN/i);
    });
  });

  test.describe("RTL Language Support", () => {
    test("should handle Arabic RTL layout", async ({ page }) => {
      // Navigate to Arabic language
      await page.goto("/");
      const languageSelector = page.locator('[data-testid="language-selector"]');
      await languageSelector.click();
      await page.locator('[data-testid="lang-ar"]').click();
      
      // Should show Arabic content
      await expect(page.locator('[data-testid="current-language"]')).toContainText(/العربية|AR/i);
      
      // Should apply RTL direction
      const htmlElement = page.locator('html');
      await expect(htmlElement).toHaveAttribute('dir', 'rtl');
      
      // Should show RTL layout adjustments
      await expect(page.locator('[data-testid="rtl-layout"]')).toBeVisible();
      
      // Should align text to right
      const bodyElement = page.locator('body');
      await expect(bodyElement).toHaveCSS('text-align', 'right');
      
      // Should flip navigation
      await expect(page.locator('[data-testid="nav-container"]')).toHaveCSS('flex-direction', 'row-reverse');
      
      // Test RTL forms
      await page.goto("/ar/auth/login");
      
      await expect(page.locator('[data-testid="login-form"]')).toHaveCSS('text-align', 'right');
      await expect(page.locator('[data-testid="form-input"]')).toHaveCSS('text-align', 'right');
      
      // Test RTL buttons
      await expect(page.locator('[data-testid="submit-button"]')).toHaveCSS('margin-left', 'auto');
      await expect(page.locator('[data-testid="submit-button"]')).toHaveCSS('margin-right', '0');
    });

    test("should handle bidirectional text", async ({ page }) => {
      // Navigate to Arabic
      await page.goto("/ar");
      
      // Should handle mixed LTR/RTL content
      const mixedContent = page.locator('[data-testid="mixed-content"]');
      if (await mixedContent.isVisible()) {
        // Should have proper Unicode bidi handling
        await expect(mixedContent).toHaveAttribute('dir', 'auto');
      }
      
      // Test English text in Arabic context
      const englishText = page.locator('[data-testid="english-text"]');
      if (await englishText.isVisible()) {
        await expect(englishText).toHaveAttribute('dir', 'ltr');
      }
      
      // Test Arabic text in English context
      await page.goto("/en");
      const arabicText = page.locator('[data-testid="arabic-text"]');
      if (await arabicText.isVisible()) {
        await expect(arabicText).toHaveAttribute('dir', 'rtl');
      }
    });
  });

  test.describe("Currency Localization", () => {
    test("should display correct currency symbols", async ({ page }) => {
      // English (USD)
      await page.goto("/en");
      await expect(page.locator('[data-testid="currency-symbol"]')).toContainText('$');
      await expect(page.locator('[data-testid="currency-code"]')).toContainText('USD');
      
      // Nepali (NPR)
      await page.goto("/ne");
      await expect(page.locator('[data-testid="currency-symbol"]')).toContainText('रू');
      await expect(page.locator('[data-testid="currency-code"]')).toContainText('NPR');
      
      // Hindi (INR)
      await page.goto("/hi");
      await expect(page.locator('[data-testid="currency-symbol"]')).toContainText('₹');
      await expect(page.locator('[data-testid="currency-code"]')).toContainText('INR');
      
      // Arabic (SAR)
      await page.goto("/ar");
      await expect(page.locator('[data-testid="currency-symbol"]')).toContainText('ر.س');
      await expect(page.locator('[data-testid="currency-code"]')).toContainText('SAR');
    });

    test("should format currency amounts correctly", async ({ page }) => {
      // Test English formatting
      await page.goto("/en/listings");
      const priceElements = page.locator('[data-testid="listing-price"]');
      const englishPrice = await priceElements.first().textContent();
      expect(englishPrice).toMatch(/\$\d{1,3}(,\d{3})*(\.\d{2})?/);
      
      // Test Nepali formatting
      await page.goto("/ne/listings");
      const nepaliPrice = await priceElements.first().textContent();
      expect(nepaliPrice).toMatch(/रू\d{1,3}(,\d{3})*(\.\d{2})?/);
      
      // Test Hindi formatting
      await page.goto("/hi/listings");
      const hindiPrice = await priceElements.first().textContent();
      expect(hindiPrice).toMatch(/₹\d{1,3}(,\d{3})*(\.\d{2})?/);
      
      // Test Arabic formatting
      await page.goto("/ar/listings");
      const arabicPrice = await priceElements.first().textContent();
      expect(arabicPrice).toMatch(/ر\.س\d{1,3}(,\d{3})*(\.\d{2})?/);
    });

    test("should handle currency conversion", async ({ page }) => {
      // Navigate to listing with currency selector
      await page.goto("/en/listings/listing-123");
      
      const currencySelector = page.locator('[data-testid="currency-selector"]');
      if (await currencySelector.isVisible()) {
        // Original price in USD
        const originalPrice = page.locator('[data-testid="listing-price"]');
        const usdPrice = await originalPrice.textContent();
        
        // Switch to NPR
        await currencySelector.click();
        await page.locator('[data-testid="currency-npr"]').click();
        
        const nprPrice = await originalPrice.textContent();
        expect(nprPrice).not.toBe(usdPrice);
        expect(nprPrice).toContain('रू');
        
        // Switch to INR
        await currencySelector.click();
        await page.locator('[data-testid="currency-inr"]').click();
        
        const inrPrice = await originalPrice.textContent();
        expect(inrPrice).not.toBe(usdPrice);
        expect(inrPrice).toContain('₹');
        
        // Switch to SAR
        await currencySelector.click();
        await page.locator('[data-testid="currency-sar"]').click();
        
        const sarPrice = await originalPrice.textContent();
        expect(sarPrice).not.toBe(usdPrice);
        expect(sarPrice).toContain('ر.س');
      }
    });
  });

  test.describe("Date and Number Formatting", () => {
    test("should format dates according to locale", async ({ page }) => {
      // English date format (MM/DD/YYYY)
      await page.goto("/en/bookings");
      const englishDate = page.locator('[data-testid="booking-date"]').first();
      const englishDateText = await englishDate.textContent();
      expect(englishDateText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      
      // Nepali date format (YYYY-MM-DD)
      await page.goto("/ne/bookings");
      const nepaliDate = page.locator('[data-testid="booking-date"]').first();
      const nepaliDateText = await nepaliDate.textContent();
      expect(nepaliDateText).toMatch(/\d{4}-\d{2}-\d{2}/);
      
      // Hindi date format (DD/MM/YYYY)
      await page.goto("/hi/bookings");
      const hindiDate = page.locator('[data-testid="booking-date"]').first();
      const hindiDateText = await hindiDate.textContent();
      expect(hindiDateText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      
      // Arabic date format (DD/MM/YYYY)
      await page.goto("/ar/bookings");
      const arabicDate = page.locator('[data-testid="booking-date"]').first();
      const arabicDateText = await arabicDate.textContent();
      expect(arabicDateText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    test("should format time according to locale", async ({ page }) => {
      // English 12-hour format
      await page.goto("/en/messages");
      const englishTime = page.locator('[data-testid="message-time"]').first();
      const englishTimeText = await englishTime.textContent();
      expect(englishTimeText).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
      
      // Nepali 24-hour format
      await page.goto("/ne/messages");
      const nepaliTime = page.locator('[data-testid="message-time"]').first();
      const nepaliTimeText = await nepaliTime.textContent();
      expect(nepaliTimeText).toMatch(/\d{1,2}:\d{2}/);
      
      // Hindi 12-hour format
      await page.goto("/hi/messages");
      const hindiTime = page.locator('[data-testid="message-time"]').first();
      const hindiTimeText = await hindiTime.textContent();
      expect(hindiTimeText).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
      
      // Arabic 24-hour format
      await page.goto("/ar/messages");
      const arabicTime = page.locator('[data-testid="message-time"]').first();
      const arabicTimeText = await arabicTime.textContent();
      expect(arabicTimeText).toMatch(/\d{1,2}:\d{2}/);
    });

    test("should format numbers according to locale", async ({ page }) => {
      // English decimal separator
      await page.goto("/en/dashboard");
      const englishNumber = page.locator('[data-testid="stats-number"]').first();
      const englishNumberText = await englishNumber.textContent();
      expect(englishNumberText).toMatch(/\d{1,3}(,\d{3})*(\.\d+)?/);
      
      // Nepali decimal separator
      await page.goto("/ne/dashboard");
      const nepaliNumber = page.locator('[data-testid="stats-number"]').first();
      const nepaliNumberText = await nepaliNumber.textContent();
      expect(nepaliNumberText).toMatch(/\d{1,3}(,\d{3})*(\.\d+)?/);
      
      // Hindi decimal separator
      await page.goto("/hi/dashboard");
      const hindiNumber = page.locator('[data-testid="stats-number"]').first();
      const hindiNumberText = await hindiNumber.textContent();
      expect(hindiNumberText).toMatch(/\d{1,3}(,\d{3})*(\.\d+)?/);
      
      // Arabic decimal separator
      await page.goto("/ar/dashboard");
      const arabicNumber = page.locator('[data-testid="stats-number"]').first();
      const arabicNumberText = await arabicNumber.textContent();
      expect(arabicNumberText).toMatch(/\d{1,3}(,\d{3})*(\.\d+)?/);
    });
  });

  test.describe("Content Translation Validation", () => {
    test("should translate all UI elements", async ({ page }) => {
      // Test English translations
      await page.goto("/en");
      
      const commonElements = [
        '[data-testid="nav-home"]',
        '[data-testid="nav-search"]',
        '[data-testid="nav-listings"]',
        '[data-testid="nav-bookings"]',
        '[data-testid="nav-messages"]',
        '[data-testid="nav-profile"]'
      ];
      
      for (const selector of commonElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const text = await element.textContent();
          expect(text?.length).toBeGreaterThan(0);
          expect(text).toMatch(/^[A-Za-z0-9\s\-\.,!?]+$/);
        }
      }
      
      // Test Nepali translations
      await page.goto("/ne");
      
      for (const selector of commonElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const text = await element.textContent();
          expect(text?.length).toBeGreaterThan(0);
          expect(text).toMatch(/^[\u0900-\u097F\s\-\.,!?]+$/);
        }
      }
      
      // Test Hindi translations
      await page.goto("/hi");
      
      for (const selector of commonElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const text = await element.textContent();
          expect(text?.length).toBeGreaterThan(0);
          expect(text).toMatch(/^[\u0900-\u097F\s\-\.,!?]+$/);
        }
      }
      
      // Test Arabic translations
      await page.goto("/ar");
      
      for (const selector of commonElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const text = await element.textContent();
          expect(text?.length).toBeGreaterThan(0);
          expect(text).toMatch(/^[\u0600-\u06FF\s\-\.,!?]+$/);
        }
      }
    });

    test("should translate error messages", async ({ page }) => {
      // Test English error messages
      await page.goto("/en/auth/login");
      await page.click('[data-testid="login-button"]');
      
      const errorElement = page.locator('[data-testid="error-message"]');
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        expect(errorText).toMatch(/^[A-Za-z0-9\s\-\.,!?]+$/);
      }
      
      // Test Nepali error messages
      await page.goto("/ne/auth/login");
      await page.click('[data-testid="login-button"]');
      
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        expect(errorText).toMatch(/^[\u0900-\u097F\s\-\.,!?]+$/);
      }
      
      // Test Hindi error messages
      await page.goto("/hi/auth/login");
      await page.click('[data-testid="login-button"]');
      
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        expect(errorText).toMatch(/^[\u0900-\u097F\s\-\.,!?]+$/);
      }
      
      // Test Arabic error messages
      await page.goto("/ar/auth/login");
      await page.click('[data-testid="login-button"]');
      
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        expect(errorText).toMatch(/^[\u0600-\u06FF\s\-\.,!?]+$/);
      }
    });

    test("should translate form labels and placeholders", async ({ page }) => {
      // Test English form elements
      await page.goto("/en/auth/signup");
      
      const formElements = [
        '[data-testid="first-name-label"]',
        '[data-testid="email-label"]',
        '[data-testid="password-label"]',
        '[data-testid="email-placeholder"]',
        '[data-testid="password-placeholder"]'
      ];
      
      for (const selector of formElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const text = await element.textContent() || await element.getAttribute('placeholder');
          expect(text?.length).toBeGreaterThan(0);
          expect(text).toMatch(/^[A-Za-z0-9\s\-\.,!?]+$/);
        }
      }
      
      // Test Nepali form elements
      await page.goto("/ne/auth/signup");
      
      for (const selector of formElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const text = await element.textContent() || await element.getAttribute('placeholder');
          expect(text?.length).toBeGreaterThan(0);
          expect(text).toMatch(/^[\u0900-\u097F\s\-\.,!?]+$/);
        }
      }
      
      // Test Hindi form elements
      await page.goto("/hi/auth/signup");
      
      for (const selector of formElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const text = await element.textContent() || await element.getAttribute('placeholder');
          expect(text?.length).toBeGreaterThan(0);
          expect(text).toMatch(/^[\u0900-\u097F\s\-\.,!?]+$/);
        }
      }
      
      // Test Arabic form elements
      await page.goto("/ar/auth/signup");
      
      for (const selector of formElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const text = await element.textContent() || await element.getAttribute('placeholder');
          expect(text?.length).toBeGreaterThan(0);
          expect(text).toMatch(/^[\u0600-\u06FF\s\-\.,!?]+$/);
        }
      }
    });

    test("should translate dynamic content", async ({ page }) => {
      // Test search results translation
      await page.goto("/en/search");
      await page.fill('[data-testid="search-input"]', "apartment");
      await page.press('[data-testid="search-input"]', 'Enter');
      
      const searchResults = page.locator('[data-testid="search-result"]');
      if (await searchResults.first().isVisible()) {
        const resultText = await searchResults.first().textContent();
        expect(resultText).toMatch(/^[A-Za-z0-9\s\-\.,!?]+$/);
      }
      
      // Test Nepali search results
      await page.goto("/ne/search");
      await page.fill('[data-testid="search-input"]', "घर");
      await page.press('[data-testid="search-input"]', 'Enter');
      
      if (await searchResults.first().isVisible()) {
        const resultText = await searchResults.first().textContent();
        expect(resultText).toMatch(/^[\u0900-\u097F\s\-\.,!?]+$/);
      }
      
      // Test Hindi search results
      await page.goto("/hi/search");
      await page.fill('[data-testid="search-input"]', "मकान");
      await page.press('[data-testid="search-input"]', 'Enter');
      
      if (await searchResults.first().isVisible()) {
        const resultText = await searchResults.first().textContent();
        expect(resultText).toMatch(/^[\u0900-\u097F\s\-\.,!?]+$/);
      }
      
      // Test Arabic search results
      await page.goto("/ar/search");
      await page.fill('[data-testid="search-input"]', "شقة");
      await page.press('[data-testid="search-input"]', 'Enter');
      
      if (await searchResults.first().isVisible()) {
        const resultText = await searchResults.first().textContent();
        expect(resultText).toMatch(/^[\u0600-\u06FF\s\-\.,!?]+$/);
      }
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should work on mobile devices", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Test language switching on mobile
      await page.goto("/");
      
      const mobileLanguageSelector = page.locator('[data-testid="mobile-language-selector"]');
      if (await mobileLanguageSelector.isVisible()) {
        await mobileLanguageSelector.click();
        
        // Should show mobile language menu
        await expect(page.locator('[data-testid="mobile-language-menu"]')).toBeVisible();
        
        await page.locator('[data-testid="mobile-lang-ne"]').click();
        
        await expect(page.locator('[data-testid="current-language"]')).toContainText(/नेपाली|NE/i);
        
        // Test mobile navigation in Nepali
        const mobileNav = page.locator('[data-testid="mobile-nav"]');
        if (await mobileNav.isVisible()) {
          await mobileNav.click();
          
          await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
          await expect(page.locator('[data-testid="nav-home"]')).toContainText(/घर/i);
        }
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should maintain accessibility across languages", async ({ page }) => {
      // Test English accessibility
      await page.goto("/en");
      
      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
      
      // Check for landmark regions
      const landmarks = page.locator('main, nav, header, footer, section, article');
      const landmarkCount = await landmarks.count();
      expect(landmarkCount).toBeGreaterThan(0);
      
      // Test Nepali accessibility
      await page.goto("/ne");
      
      // Should maintain heading structure
      const nepaliHeadings = page.locator('h1, h2, h3, h4, h5, h6');
      const nepaliHeadingCount = await nepaliHeadings.count();
      expect(nepaliHeadingCount).toBeGreaterThan(0);
      
      // Should maintain landmark regions
      const nepaliLandmarks = page.locator('main, nav, header, footer, section, article');
      const nepaliLandmarkCount = await nepaliLandmarks.count();
      expect(nepaliLandmarkCount).toBeGreaterThan(0);
      
      // Test Arabic accessibility
      await page.goto("/ar");
      
      // Should maintain heading structure
      const arabicHeadings = page.locator('h1, h2, h3, h4, h5, h6');
      const arabicHeadingCount = await arabicHeadings.count();
      expect(arabicHeadingCount).toBeGreaterThan(0);
      
      // Should maintain landmark regions
      const arabicLandmarks = page.locator('main, nav, header, footer, section, article');
      const arabicLandmarkCount = await arabicLandmarks.count();
      expect(arabicLandmarkCount).toBeGreaterThan(0);
    });

    test("should support screen readers in different languages", async ({ page }) => {
      // Test English screen reader support
      await page.goto("/en");
      
      const interactiveElements = page.locator('button, input, select, textarea, a[href]');
      const englishCount = await interactiveElements.count();
      
      for (let i = 0; i < Math.min(englishCount, 5); i++) {
        const element = interactiveElements.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
      
      // Test Nepali screen reader support
      await page.goto("/ne");
      
      const nepaliInteractiveElements = page.locator('button, input, select, textarea, a[href]');
      const nepaliCount = await nepaliInteractiveElements.count();
      
      for (let i = 0; i < Math.min(nepaliCount, 5); i++) {
        const element = nepaliInteractiveElements.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
      
      // Test Arabic screen reader support
      await page.goto("/ar");
      
      const arabicInteractiveElements = page.locator('button, input, select, textarea, a[href]');
      const arabicCount = await arabicInteractiveElements.count();
      
      for (let i = 0; i < Math.min(arabicCount, 5); i++) {
        const element = arabicInteractiveElements.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });
  });
});
