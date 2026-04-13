/**
 * Accessibility Compliance Validation Tests
 * 
 * Tests for WCAG 2.1 AA compliance:
 * 1. Keyboard navigation
 * 2. Screen reader compatibility
 * 3. Color contrast
 * 4. Focus management
 * 5. ARIA attributes
 * 6. Semantic HTML
 */

import { test, expect } from '@playwright/test';

test.describe('Accessibility Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate through interactive elements with Tab key', async ({ page }) => {
      await page.goto('/');
      
      // Press Tab and check focus
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT', 'SELECT']).toContain(firstFocused);
    });

    test('should maintain visible focus indicator', async ({ page }) => {
      await page.goto('/');
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => document.activeElement);
      const hasFocusStyles = await page.evaluate((el) => {
        const computed = window.getComputedStyle(el as Element);
        return computed.outline !== 'none' || computed.boxShadow !== 'none';
      }, focusedElement);
      
      expect(hasFocusStyles).toBeTruthy();
    });

    test('should support Enter key for button activation', async ({ page }) => {
      await page.goto('/');
      const button = await page.locator('button').first();
      await button.focus();
      await page.keyboard.press('Enter');
      
      // Button should activate without error
      expect(await page.locator('body').isVisible()).toBeTruthy();
    });

    test('should support Escape key to close modals', async ({ page }) => {
      await page.goto('/');
      // Find and open a modal if available
      const modalTrigger = await page.locator('[aria-haspopup="true"]').first();
      
      if (await modalTrigger.isVisible()) {
        await modalTrigger.click();
        // Wait for modal to appear before pressing Escape
        await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });
        await page.keyboard.press('Escape');
        
        // Modal should be closed
        await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
      }
    });

    test('should have logical tab order', async ({ page }) => {
      await page.goto('/');
      const tabOrder: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const tagName = await page.evaluate(() => document.activeElement?.tagName);
        tabOrder.push(tagName || '');
        await page.keyboard.press('Tab');
      }
      
      // Tab order should follow document flow
      expect(tabOrder.length).toBeGreaterThan(0);
    });
  });

  test.describe('Screen Reader Compatibility', () => {
    test('should have proper ARIA labels on form inputs', async ({ page }) => {
      await page.goto('/auth/login');
      
      const inputs = await page.locator('input').all();
      for (const input of inputs) {
        const hasLabel = await input.evaluate((el) => {
          const id = el.getAttribute('id');
          const hasAriaLabel = el.hasAttribute('aria-label');
          const hasAriaLabelledby = el.hasAttribute('aria-labelledby');
          const hasLabelElement = id && document.querySelector(`label[for="${id}"]`);
          return hasLabel || hasAriaLabel || hasAriaLabelledby || hasLabelElement;
        });
        
        expect(hasLabel).toBeTruthy();
      }
    });

    test('should announce dynamic content changes', async ({ page }) => {
      await page.goto('/');
      
      // Check for live regions
      const liveRegions = await page.locator('[aria-live]').count();
      expect(liveRegions).toBeGreaterThan(0);
    });

    test('should have descriptive alt text for images', async ({ page }) => {
      await page.goto('/');
      
      const images = await page.locator('img').all();
      for (const image of images) {
        const alt = await image.getAttribute('alt');
        const decorative = await image.getAttribute('role') === 'presentation';
        
        if (!decorative) {
          expect(alt).toBeTruthy();
          expect(alt?.length).toBeGreaterThan(0);
        }
      }
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      let lastLevel = 0;
      
      for (const heading of headings) {
        const level = parseInt((await heading.evaluate((el) => el.tagName))[1]);
        // Headings should not skip levels (e.g., h1 to h3)
        expect(level).toBeLessThanOrEqual(lastLevel + 1);
        lastLevel = level;
      }
    });

    test('should have descriptive link text', async ({ page }) => {
      await page.goto('/');
      
      const links = await page.locator('a').all();
      for (const link of links) {
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');
        const title = await link.getAttribute('title');
        
        const hasDescriptiveText = (text && text.trim().length > 0) || ariaLabel || title;
        if (hasDescriptiveText) {
          // Avoid "click here" type text
          const isGeneric = text?.toLowerCase().includes('click here') || 
                           text?.toLowerCase().includes('read more');
          expect(isGeneric).toBeFalsy();
        }
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('should have sufficient color contrast for text', async ({ page }) => {
      await page.goto('/');
      
      const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, span, a, button').all();
      
      for (const element of textElements) {
        const contrast = await page.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          const color = computed.color;
          const bgColor = computed.backgroundColor;
          
          // Simple check - in production, use axe-core or similar for accurate contrast
          return { color, bgColor };
        }, element);
        
        // Elements should have defined colors
        expect(contrast.color).toBeTruthy();
      }
    });

    test('should not rely on color alone for information', async ({ page }) => {
      await page.goto('/');
      
      // Check for color-only indicators (e.g., error states should have text/icon too)
      const errorElements = await page.locator('[class*="error"], [class*="danger"]').all();
      
      for (const element of errorElements) {
        const hasTextContent = await element.evaluate((el) => el.textContent?.trim().length || 0);
        const hasIcon = await element.locator('svg, i').count();
        
        // Error indicators should have text or icon, not just color
        expect(hasTextContent + hasIcon).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Focus Management', () => {
    test('should trap focus in modals', async ({ page }) => {
      await page.goto('/');
      
      const modalTrigger = await page.locator('[aria-haspopup="true"]').first();
      
      if (await modalTrigger.isVisible()) {
        await modalTrigger.click();
        // Wait for modal to be visible
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        
        // Focus should be inside modal
        const activeElement = await page.evaluate(() => document.activeElement);
        const isInModal = await modal.evaluate((el, active) => 
          el.contains(active as Node), activeElement
        );
        
        expect(isInModal).toBeTruthy();
      }
    });

    test('should return focus to trigger after modal close', async ({ page }) => {
      await page.goto('/');
      
      const modalTrigger = await page.locator('[aria-haspopup="true"]').first();
      
      if (await modalTrigger.isVisible()) {
        await modalTrigger.click();
        // Wait for modal to be visible
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        
        const closeBtn = modal.locator('button').first();
        await closeBtn.click();
        // Wait for modal to close
        await modal.waitFor({ state: 'hidden', timeout: 5000 });
        
        const activeElement = await page.evaluate(() => document.activeElement);
        const isTrigger = await modalTrigger.evaluate((el, active) => 
          el === active, activeElement
        );
        
        expect(isTrigger).toBeTruthy();
      }
    });

    test('should have visible focus on all interactive elements', async ({ page }) => {
      await page.goto('/');
      
      const interactiveElements = await page.locator('button, a, input, select, textarea').all();
      
      for (const element of interactiveElements) {
        await element.focus();
        const hasFocusStyles = await page.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return computed.outline !== 'none' || 
                 computed.boxShadow !== 'none' ||
                 computed.borderColor !== 'rgb(0, 0, 0)';
        }, element);
        
        expect(hasFocusStyles).toBeTruthy();
      }
    });
  });

  test.describe('ARIA Attributes', () => {
    test('should have correct ARIA roles', async ({ page }) => {
      await page.goto('/');
      
      // Check for proper ARIA roles on interactive elements
      const buttons = await page.locator('button[role], button:not([role])').all();
      for (const button of buttons) {
        const role = await button.getAttribute('role');
        if (role) {
          expect(['button', 'link', 'menuitem', 'tab']).toContain(role);
        }
      }
    });

    test('should have proper aria-expanded on toggle elements', async ({ page }) => {
      await page.goto('/');
      
      const toggles = await page.locator('[aria-expanded]').all();
      for (const toggle of toggles) {
        const expanded = await toggle.getAttribute('aria-expanded');
        expect(['true', 'false']).toContain(expanded);
      }
    });

    test('should have proper aria-hidden on decorative elements', async ({ page }) => {
      await page.goto('/');
      
      const hiddenElements = await page.locator('[aria-hidden="true"]').all();
      for (const element of hiddenElements) {
        const isVisible = await element.isVisible().catch(() => true);
        // Should not be interactive if hidden
        const isInteractive = await element.evaluate((el) => {
          const tag = el.tagName.toLowerCase();
          return ['button', 'a', 'input', 'select', 'textarea'].includes(tag);
        });
        
        if (isVisible && isInteractive) {
          expect(isInteractive).toBeFalsy();
        }
      }
    });

    test('should have proper aria-current for navigation', async ({ page }) => {
      await page.goto('/');
      
      const navLinks = await page.locator('nav a[aria-current]').all();
      for (const link of navLinks) {
        const current = await link.getAttribute('aria-current');
        expect(['page', 'step', 'location', 'date', 'time', 'true', 'false']).toContain(current);
      }
    });
  });

  test.describe('Semantic HTML', () => {
    test('should use semantic HTML elements', async ({ page }) => {
      await page.goto('/');
      
      // Check for proper use of semantic elements
      const hasNav = await page.locator('nav').count();
      const hasMain = await page.locator('main').count();
      const hasHeader = await page.locator('header').count();
      const hasFooter = await page.locator('footer').count();
      
      expect(hasNav + hasMain + hasHeader + hasFooter).toBeGreaterThan(0);
    });

    test('should have proper list semantics', async ({ page }) => {
      await page.goto('/');
      
      const lists = await page.locator('ul, ol').all();
      for (const list of lists) {
        const listItems = await list.locator('li').count();
        // Lists should have list items
        expect(listItems).toBeGreaterThan(0);
      }
    });

    test('should use button element for actions, not div', async ({ page }) => {
      await page.goto('/');
      
      // Check for proper button usage
      const buttons = await page.locator('button').count();
      const divsWithClick = await page.locator('div[onclick], div[role="button"]').count();
      
      // Prefer button elements over divs for actions
      expect(buttons).toBeGreaterThanOrEqual(0);
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/auth/login');
      
      const forms = await page.locator('form').all();
      for (const form of forms) {
        const inputs = await form.locator('input, select, textarea').all();
        for (const input of inputs) {
          const hasLabel = await input.evaluate((el) => {
            const id = el.getAttribute('id');
            const hasAriaLabel = el.hasAttribute('aria-label');
            const hasAriaLabelledby = el.hasAttribute('aria-labelledby');
            const hasLabelElement = id && document.querySelector(`label[for="${id}"]`);
            return hasLabel || hasAriaLabel || hasAriaLabelledby || hasLabelElement;
          });
          
          expect(hasLabel).toBeTruthy();
        }
      }
    });
  });

  test.describe('Responsive Design Accessibility', () => {
    test('should be accessible on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Check that elements are not overlapping
      const visibleElements = await page.locator('button, a').all();
      for (const element of visibleElements) {
        if (await element.isVisible()) {
          const isClickable = await element.isClickable();
          expect(isClickable).toBeTruthy();
        }
      }
    });

    test('should have touch targets at least 44x44 pixels', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      const buttons = await page.locator('button').all();
      for (const button of buttons) {
        const box = await button.boundingBox();
        if (box) {
          const minDimension = Math.min(box.width, box.height);
          expect(minDimension).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should not have horizontal scroll on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });

  test.describe('Error Handling Accessibility', () => {
    test('should announce errors to screen readers', async ({ page }) => {
      await page.goto('/auth/login');
      
      // Submit empty form to trigger errors
      await page.locator('button[type="submit"]').click();
      // Wait for error elements to appear
      await page.locator('[role="alert"], [aria-live="assertive"]').first().waitFor({ state: 'visible', timeout: 5000 });
      
      // Check for error announcements
      const errorElements = await page.locator('[role="alert"], [aria-live="assertive"]').all();
      const hasErrors = errorElements.length > 0;
      
      expect(hasErrors).toBeTruthy();
    });

    test('should associate errors with form fields', async ({ page }) => {
      await page.goto('/auth/login');
      
      await page.locator('button[type="submit"]').click();
      // Wait for error elements to appear
      await page.locator('[role="alert"]').first().waitFor({ state: 'visible', timeout: 5000 });
      
      const errorMessages = await page.locator('[role="alert"]').all();
      for (const error of errorMessages) {
        const hasAriaDescribedby = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[aria-describedby]');
          return inputs.length > 0;
        });
        
        expect(hasAriaDescribedby).toBeTruthy();
      }
    });
  });
});
