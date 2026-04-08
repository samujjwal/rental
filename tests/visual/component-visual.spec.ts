import { test, expect, Page } from '@playwright/test';

/**
 * COMPONENT VISUAL TESTS
 * 
 * This test suite validates individual component visual consistency:
 * - Component variations across different states and props
 * - Component states (normal, hover, active, disabled, loading)
 * - Component interactions and transitions
 * - Component animations and micro-interactions
 * - Component accessibility visual indicators
 * - Component responsive behavior
 * - Component theme consistency
 * - Component error and validation states
 * 
 * Component Coverage:
 * 1. UI Components (buttons, forms, cards, modals)
 * 2. Interactive Components (dropdowns, tabs, accordions)
 * 3. Navigation Components (menus, breadcrumbs, pagination)
 * 4. Feedback Components (alerts, notifications, loaders)
 * 5. Data Display Components (tables, charts, lists)
 * 6. Input Components (fields, selectors, pickers)
 */

test.describe('Component Visual Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page }) => {
    this.page = page;
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  describe('Button Component Variations', () => {
    test('should render button variations consistently', async () => {
      await page.goto('/components/buttons');
      await page.waitForLoadState('networkidle');
      
      const buttons = page.locator('.btn');
      const buttonCount = await buttons.count();
      
      // Test different button types
      const buttonTypes = ['btn-primary', 'btn-secondary', 'btn-success', 'btn-danger', 'btn-warning', 'btn-info', 'btn-light', 'btn-dark'];
      
      for (const buttonType of buttonTypes) {
        const button = page.locator(`.${buttonType}`);
        if (await button.isVisible()) {
          await expect(button).toHaveScreenshot(`${buttonType}-button.png`);
        }
      }
      
      // Test button sizes
      const buttonSizes = ['btn-sm', 'btn-md', 'btn-lg'];
      
      for (const buttonSize of buttonSizes) {
        const button = page.locator(`.${buttonSize}`);
        if (await button.isVisible()) {
          await expect(button).toHaveScreenshot(`${buttonSize}-button.png`);
        }
      }
    });

    test('should render button states consistently', async () => {
      await page.goto('/components/buttons');
      await page.waitForLoadState('networkidle');
      
      const primaryButton = page.locator('.btn-primary').first();
      await expect(primaryButton).toBeVisible();
      
      // Normal state
      await expect(primaryButton).toHaveScreenshot('btn-primary-normal.png');
      
      // Hover state
      await primaryButton.hover();
      await page.waitForTimeout(200);
      await expect(primaryButton).toHaveScreenshot('btn-primary-hover.png');
      
      // Active state
      await primaryButton.click();
      await page.waitForTimeout(200);
      await expect(primaryButton).toHaveScreenshot('btn-primary-active.png');
      
      // Focus state
      await primaryButton.focus();
      await page.waitForTimeout(200);
      await expect(primaryButton).toHaveScreenshot('btn-primary-focus.png');
      
      // Disabled state
      const disabledButton = page.locator('.btn-primary:disabled');
      if (await disabledButton.isVisible()) {
        await expect(disabledButton).toHaveScreenshot('btn-primary-disabled.png');
      }
      
      // Loading state
      const loadingButton = page.locator('.btn-primary.loading');
      if (await loadingButton.isVisible()) {
        await expect(loadingButton).toHaveScreenshot('btn-primary-loading.png');
      }
    });

    test('should render button with icons consistently', async () => {
      await page.goto('/components/buttons');
      await page.waitForLoadState('networkidle');
      
      const iconButtons = page.locator('.btn-icon');
      const iconButtonCount = await iconButtons.count();
      
      for (let i = 0; i < Math.min(iconButtonCount, 3); i++) {
        const button = iconButtons.nth(i);
        await expect(button).toHaveScreenshot(`btn-icon-${i}.png`);
        
        // Test icon-only buttons
        const iconOnly = button.locator('.icon-only');
        if (await iconOnly.isVisible()) {
          await expect(iconOnly).toHaveScreenshot(`btn-icon-only-${i}.png`);
        }
      }
    });
  });

  describe('Form Component Variations', () => {
    test('should render input field variations consistently', async () => {
      await page.goto('/components/forms');
      await page.waitForLoadState('networkidle');
      
      const inputTypes = ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time'];
      
      for (const inputType of inputTypes) {
        const input = page.locator(`input[type="${inputType}"]`);
        if (await input.isVisible()) {
          await expect(input).toHaveScreenshot(`input-${inputType}.png`);
        }
      }
      
      // Test textarea
      const textarea = page.locator('textarea');
      if (await textarea.isVisible()) {
        await expect(textarea).toHaveScreenshot('textarea.png');
      }
      
      // Test select dropdown
      const select = page.locator('select');
      if (await select.isVisible()) {
        await expect(select).toHaveScreenshot('select.png');
      }
    });

    test('should render input field states consistently', async () => {
      await page.goto('/components/forms');
      await page.waitForLoadState('networkidle');
      
      const textInput = page.locator('input[type="text"]').first();
      await expect(textInput).toBeVisible();
      
      // Normal state
      await expect(textInput).toHaveScreenshot('input-normal.png');
      
      // Focus state
      await textInput.focus();
      await page.waitForTimeout(200);
      await expect(textInput).toHaveScreenshot('input-focus.png');
      
      // Filled state
      await textInput.fill('Test value');
      await expect(textInput).toHaveScreenshot('input-filled.png');
      
      // Hover state
      await textInput.hover();
      await page.waitForTimeout(200);
      await expect(textInput).toHaveScreenshot('input-hover.png');
      
      // Error state
      const errorInput = page.locator('.input-error');
      if (await errorInput.isVisible()) {
        await expect(errorInput).toHaveScreenshot('input-error.png');
      }
      
      // Success state
      const successInput = page.locator('.input-success');
      if (await successInput.isVisible()) {
        await expect(successInput).toHaveScreenshot('input-success.png');
      }
      
      // Disabled state
      const disabledInput = page.locator('input:disabled');
      if (await disabledInput.isVisible()) {
        await expect(disabledInput).toHaveScreenshot('input-disabled.png');
      }
    });

    test('should render form layouts consistently', async () => {
      await page.goto('/components/forms');
      await page.waitForLoadState('networkidle');
      
      // Test horizontal form layout
      const horizontalForm = page.locator('.form-horizontal');
      if (await horizontalForm.isVisible()) {
        await expect(horizontalForm).toHaveScreenshot('form-horizontal.png');
      }
      
      // Test vertical form layout
      const verticalForm = page.locator('.form-vertical');
      if (await verticalForm.isVisible()) {
        await expect(verticalForm).toHaveScreenshot('form-vertical.png');
      }
      
      // Test inline form layout
      const inlineForm = page.locator('.form-inline');
      if (await inlineForm.isVisible()) {
        await expect(inlineForm).toHaveScreenshot('form-inline.png');
      }
    });

    test('should render form validation states consistently', async () => {
      await page.goto('/components/forms');
      await page.waitForLoadState('networkidle');
      
      const form = page.locator('form').first();
      const submitButton = form.locator('button[type="submit"]');
      
      // Trigger validation
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Check validation error states
      const errorFields = form.locator('.field-error');
      const errorCount = await errorFields.count();
      
      for (let i = 0; i < Math.min(errorCount, 3); i++) {
        const field = errorFields.nth(i);
        await expect(field).toHaveScreenshot(`field-error-${i}.png`);
      }
      
      // Check validation messages
      const errorMessages = form.locator('.error-message');
      const messageCount = await errorMessages.count();
      
      for (let i = 0; i < Math.min(messageCount, 3); i++) {
        const message = errorMessages.nth(i);
        await expect(message).toHaveScreenshot(`error-message-${i}.png`);
      }
    });
  });

  describe('Card Component Variations', () => {
    test('should render card variations consistently', async () => {
      await page.goto('/components/cards');
      await page.waitForLoadState('networkidle');
      
      const cardTypes = ['card-basic', 'card-featured', 'card-compact', 'card-expanded', 'card-horizontal'];
      
      for (const cardType of cardTypes) {
        const card = page.locator(`.${cardType}`);
        if (await card.isVisible()) {
          await expect(card).toHaveScreenshot(`${cardType}.png`);
        }
      }
      
      // Test listing cards
      const listingCards = page.locator('.listing-card');
      const listingCardCount = await listingCards.count();
      
      for (let i = 0; i < Math.min(listingCardCount, 3); i++) {
        const card = listingCards.nth(i);
        await expect(card).toHaveScreenshot(`listing-card-${i}.png`);
      }
      
      // Test user cards
      const userCards = page.locator('.user-card');
      const userCardCount = await userCards.count();
      
      for (let i = 0; i < Math.min(userCardCount, 3); i++) {
        const card = userCards.nth(i);
        await expect(card).toHaveScreenshot(`user-card-${i}.png`);
      }
    });

    test('should render card states consistently', async () => {
      await page.goto('/components/cards');
      await page.waitForLoadState('networkidle');
      
      const card = page.locator('.card').first();
      await expect(card).toBeVisible();
      
      // Normal state
      await expect(card).toHaveScreenshot('card-normal.png');
      
      // Hover state
      await card.hover();
      await page.waitForTimeout(200);
      await expect(card).toHaveScreenshot('card-hover.png');
      
      // Active state
      await card.click();
      await page.waitForTimeout(200);
      await expect(card).toHaveScreenshot('card-active.png');
      
      // Loading state
      const loadingCard = page.locator('.card.loading');
      if (await loadingCard.isVisible()) {
        await expect(loadingCard).toHaveScreenshot('card-loading.png');
      }
      
      // Error state
      const errorCard = page.locator('.card.error');
      if (await errorCard.isVisible()) {
        await expect(errorCard).toHaveScreenshot('card-error.png');
      }
    });

    test('should render card interactions consistently', async () => {
      await page.goto('/components/cards');
      await page.waitForLoadState('networkidle');
      
      const card = page.locator('.card').first();
      
      // Test favorite button interaction
      const favoriteButton = card.locator('.favorite-button');
      if (await favoriteButton.isVisible()) {
        await expect(favoriteButton).toHaveScreenshot('favorite-button-normal.png');
        
        await favoriteButton.click();
        await page.waitForTimeout(200);
        await expect(favoriteButton).toHaveScreenshot('favorite-button-active.png');
      }
      
      // Test share button interaction
      const shareButton = card.locator('.share-button');
      if (await shareButton.isVisible()) {
        await expect(shareButton).toHaveScreenshot('share-button-normal.png');
        
        await shareButton.click();
        await page.waitForTimeout(200);
        
        const shareModal = page.locator('.share-modal');
        if (await shareModal.isVisible()) {
          await expect(shareModal).toHaveScreenshot('share-modal.png');
        }
      }
    });
  });

  describe('Modal Component Variations', () => {
    test('should render modal variations consistently', async () => {
      await page.goto('/components/modals');
      await page.waitForLoadState('networkidle');
      
      // Test different modal triggers
      const modalTriggers = page.locator('[data-modal-trigger]');
      const triggerCount = await modalTriggers.count();
      
      for (let i = 0; i < Math.min(triggerCount, 3); i++) {
        const trigger = modalTriggers.nth(i);
        await trigger.click();
        await page.waitForTimeout(500);
        
        const modal = page.locator('.modal.show');
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot(`modal-${i}.png`);
          
          // Close modal
          const closeButton = modal.locator('.modal-close');
          if (await closeButton.isVisible()) {
            await closeButton.click();
            await page.waitForTimeout(500);
          }
        }
      }
    });

    test('should render modal states consistently', async () => {
      await page.goto('/components/modals');
      await page.waitForLoadState('networkidle');
      
      const trigger = page.locator('[data-modal-trigger]').first();
      await trigger.click();
      await page.waitForTimeout(500);
      
      const modal = page.locator('.modal.show');
      await expect(modal).toBeVisible();
      
      // Normal state
      await expect(modal).toHaveScreenshot('modal-normal.png');
      
      // Test modal backdrop
      const backdrop = page.locator('.modal-backdrop');
      if (await backdrop.isVisible()) {
        await expect(backdrop).toHaveScreenshot('modal-backdrop.png');
      }
      
      // Test modal header
      const header = modal.locator('.modal-header');
      if (await header.isVisible()) {
        await expect(header).toHaveScreenshot('modal-header.png');
      }
      
      // Test modal body
      const body = modal.locator('.modal-body');
      if (await body.isVisible()) {
        await expect(body).toHaveScreenshot('modal-body.png');
      }
      
      // Test modal footer
      const footer = modal.locator('.modal-footer');
      if (await footer.isVisible()) {
        await expect(footer).toHaveScreenshot('modal-footer.png');
      }
      
      // Close modal
      const closeButton = modal.locator('.modal-close');
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    });

    test('should render modal sizes consistently', async () => {
      await page.goto('/components/modals');
      await page.waitForLoadState('networkidle');
      
      const modalSizes = ['modal-sm', 'modal-md', 'modal-lg', 'modal-xl'];
      
      for (const modalSize of modalSizes) {
        const trigger = page.locator(`[data-modal-size="${modalSize.replace('modal-', '')}"]`);
        if (await trigger.isVisible()) {
          await trigger.click();
          await page.waitForTimeout(500);
          
          const modal = page.locator(`.${modalSize}.show`);
          if (await modal.isVisible()) {
            await expect(modal).toHaveScreenshot(`${modalSize}.png`);
          }
          
          // Close modal
          const closeButton = modal.locator('.modal-close');
          if (await closeButton.isVisible()) {
            await closeButton.click();
            await page.waitForTimeout(500);
          }
        }
      }
    });
  });

  describe('Navigation Component Variations', () => {
    test('should render navigation variations consistently', async () => {
      await page.goto('/components/navigation');
      await page.waitForLoadState('networkidle');
      
      // Test main navigation
      const mainNav = page.locator('.main-navigation');
      if (await mainNav.isVisible()) {
        await expect(mainNav).toHaveScreenshot('main-navigation.png');
      }
      
      // Test sidebar navigation
      const sidebarNav = page.locator('.sidebar-navigation');
      if (await sidebarNav.isVisible()) {
        await expect(sidebarNav).toHaveScreenshot('sidebar-navigation.png');
      }
      
      // Test breadcrumb navigation
      const breadcrumb = page.locator('.breadcrumb');
      if (await breadcrumb.isVisible()) {
        await expect(breadcrumb).toHaveScreenshot('breadcrumb.png');
      }
      
      // Test pagination
      const pagination = page.locator('.pagination');
      if (await pagination.isVisible()) {
        await expect(pagination).toHaveScreenshot('pagination.png');
      }
    });

    test('should render navigation states consistently', async () => {
      await page.goto('/components/navigation');
      await page.waitForLoadState('networkidle');
      
      const navItems = page.locator('.nav-item');
      const navCount = await navItems.count();
      
      for (let i = 0; i < Math.min(navCount, 3); i++) {
        const item = navItems.nth(i);
        
        // Normal state
        await expect(item).toHaveScreenshot(`nav-item-normal-${i}.png`);
        
        // Hover state
        await item.hover();
        await page.waitForTimeout(200);
        await expect(item).toHaveScreenshot(`nav-item-hover-${i}.png`);
        
        // Active state
        await item.click();
        await page.waitForTimeout(200);
        await expect(item).toHaveScreenshot(`nav-item-active-${i}.png`);
      }
    });

    test('should render dropdown menus consistently', async () => {
      await page.goto('/components/navigation');
      await page.waitForLoadState('networkidle');
      
      const dropdowns = page.locator('.dropdown');
      const dropdownCount = await dropdowns.count();
      
      for (let i = 0; i < Math.min(dropdownCount, 2); i++) {
        const dropdown = dropdowns.nth(i);
        const trigger = dropdown.locator('.dropdown-toggle');
        
        if (await trigger.isVisible()) {
          // Normal state
          await expect(dropdown).toHaveScreenshot(`dropdown-normal-${i}.png`);
          
          // Open dropdown
          await trigger.click();
          await page.waitForTimeout(500);
          
          const menu = dropdown.locator('.dropdown-menu.show');
          if (await menu.isVisible()) {
            await expect(menu).toHaveScreenshot(`dropdown-menu-${i}.png`);
          }
          
          // Close dropdown
          await trigger.click();
          await page.waitForTimeout(500);
        }
      }
    });
  });

  describe('Alert and Notification Variations', () => {
    test('should render alert variations consistently', async () => {
      await page.goto('/components/alerts');
      await page.waitForLoadState('networkidle');
      
      const alertTypes = ['alert-success', 'alert-info', 'alert-warning', 'alert-danger', 'alert-primary', 'alert-secondary', 'alert-light', 'alert-dark'];
      
      for (const alertType of alertTypes) {
        const alert = page.locator(`.${alertType}`);
        if (await alert.isVisible()) {
          await expect(alert).toHaveScreenshot(`${alertType}.png`);
        }
      }
    });

    test('should render notification variations consistently', async () => {
      await page.goto('/components/notifications');
      await page.waitForLoadState('networkidle');
      
      const notifications = page.locator('.notification');
      const notificationCount = await notifications.count();
      
      for (let i = 0; i < Math.min(notificationCount, 3); i++) {
        const notification = notifications.nth(i);
        await expect(notification).toHaveScreenshot(`notification-${i}.png`);
        
        // Test notification close button
        const closeButton = notification.locator('.notification-close');
        if (await closeButton.isVisible()) {
          await expect(notification).toHaveScreenshot(`notification-with-close-${i}.png`);
        }
      }
    });

    test('should render toast notifications consistently', async () => {
      await page.goto('/components/notifications');
      await page.waitForLoadState('networkidle');
      
      // Trigger toast notifications
      const toastTriggers = page.locator('[data-toast-trigger]');
      const triggerCount = await toastTriggers.count();
      
      for (let i = 0; i < Math.min(triggerCount, 3); i++) {
        const trigger = toastTriggers.nth(i);
        await trigger.click();
        await page.waitForTimeout(500);
        
        const toast = page.locator('.toast.show');
        if (await toast.isVisible()) {
          await expect(toast).toHaveScreenshot(`toast-${i}.png`);
          
          // Auto-hide toast
          await page.waitForTimeout(3000);
        }
      }
    });
  });

  describe('Table Component Variations', () => {
    test('should render table variations consistently', async () => {
      await page.goto('/components/tables');
      await page.waitForLoadState('networkidle');
      
      // Test basic table
      const basicTable = page.locator('.table-basic');
      if (await basicTable.isVisible()) {
        await expect(basicTable).toHaveScreenshot('table-basic.png');
      }
      
      // Test striped table
      const stripedTable = page.locator('.table-striped');
      if (await stripedTable.isVisible()) {
        await expect(stripedTable).toHaveScreenshot('table-striped.png');
      }
      
      // Test bordered table
      const borderedTable = page.locator('.table-bordered');
      if (await borderedTable.isVisible()) {
        await expect(borderedTable).toHaveScreenshot('table-bordered.png');
      }
      
      // Test hover table
      const hoverTable = page.locator('.table-hover');
      if (await hoverTable.isVisible()) {
        await expect(hoverTable).toHaveScreenshot('table-hover.png');
      }
    });

    test('should render table states consistently', async () => {
      await page.goto('/components/tables');
      await page.waitForLoadState('networkidle');
      
      const table = page.locator('.table').first();
      await expect(table).toBeVisible();
      
      // Test table header
      const header = table.locator('thead');
      if (await header.isVisible()) {
        await expect(header).toHaveScreenshot('table-header.png');
      }
      
      // Test table body
      const body = table.locator('tbody');
      if (await body.isVisible()) {
        await expect(body).toHaveScreenshot('table-body.png');
      }
      
      // Test table footer
      const footer = table.locator('tfoot');
      if (await footer.isVisible()) {
        await expect(footer).toHaveScreenshot('table-footer.png');
      }
      
      // Test table row hover
      const rows = body.locator('tr');
      const rowCount = await rows.count();
      
      if (rowCount > 0) {
        const firstRow = rows.first();
        await firstRow.hover();
        await page.waitForTimeout(200);
        await expect(firstRow).toHaveScreenshot('table-row-hover.png');
      }
    });

    test('should render responsive table consistently', async () => {
      await page.goto('/components/tables');
      await page.waitForLoadState('networkidle');
      
      const responsiveTable = page.locator('.table-responsive');
      if (await responsiveTable.isVisible()) {
        await expect(responsiveTable).toHaveScreenshot('table-responsive.png');
        
        // Test mobile view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(500);
        await expect(responsiveTable).toHaveScreenshot('table-responsive-mobile.png');
        
        // Reset viewport
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(500);
      }
    });
  });

  describe('Loading and Progress Variations', () => {
    test('should render loading variations consistently', async () => {
      await page.goto('/components/loading');
      await page.waitForLoadState('networkidle');
      
      const loadingTypes = ['spinner', 'dots', 'bars', 'pulse', 'skeleton'];
      
      for (const loadingType of loadingTypes) {
        const loader = page.locator(`.loading-${loadingType}`);
        if (await loader.isVisible()) {
          await expect(loader).toHaveScreenshot(`loading-${loadingType}.png`);
        }
      }
    });

    test('should render progress variations consistently', async () => {
      await page.goto('/components/progress');
      await page.waitForLoadState('networkidle');
      
      const progressBars = page.locator('.progress');
      const progressCount = await progressBars.count();
      
      for (let i = 0; i < Math.min(progressCount, 3); i++) {
        const progress = progressBars.nth(i);
        await expect(progress).toHaveScreenshot(`progress-${i}.png`);
      }
      
      // Test different progress states
      const progressStates = ['progress-success', 'progress-info', 'progress-warning', 'progress-danger'];
      
      for (const progressState of progressStates) {
        const stateProgress = page.locator(`.${progressState}`);
        if (await stateProgress.isVisible()) {
          await expect(stateProgress).toHaveScreenshot(`${progressState}.png`);
        }
      }
    });
  });

  describe('Component Animations', () => {
    test('should render fade animations consistently', async () => {
      await page.goto('/components/animations');
      await page.waitForLoadState('networkidle');
      
      const fadeElements = page.locator('.fade-animation');
      const fadeCount = await fadeElements.count();
      
      for (let i = 0; i < Math.min(fadeCount, 2); i++) {
        const element = fadeElements.nth(i);
        
        // Trigger animation
        await element.click();
        await page.waitForTimeout(1000);
        
        await expect(element).toHaveScreenshot(`fade-animation-${i}.png`);
      }
    });

    test('should render slide animations consistently', async () => {
      await page.goto('/components/animations');
      await page.waitForLoadState('networkidle');
      
      const slideElements = page.locator('.slide-animation');
      const slideCount = await slideElements.count();
      
      for (let i = 0; i < Math.min(slideCount, 2); i++) {
        const element = slideElements.nth(i);
        
        // Trigger animation
        await element.click();
        await page.waitForTimeout(1000);
        
        await expect(element).toHaveScreenshot(`slide-animation-${i}.png`);
      }
    });

    test('should render scale animations consistently', async () => {
      await page.goto('/components/animations');
      await page.waitForLoadState('networkidle');
      
      const scaleElements = page.locator('.scale-animation');
      const scaleCount = await scaleElements.count();
      
      for (let i = 0; i < Math.min(scaleCount, 2); i++) {
        const element = scaleElements.nth(i);
        
        // Trigger animation
        await element.hover();
        await page.waitForTimeout(1000);
        
        await expect(element).toHaveScreenshot(`scale-animation-${i}.png`);
      }
    });
  });

  describe('Component Accessibility', () => {
    test('should render accessible components consistently', async () => {
      await page.goto('/components/accessibility');
      await page.waitForLoadState('networkidle');
      
      // Test ARIA labels
      const ariaElements = page.locator('[aria-label], [aria-describedby], [aria-labelledby]');
      const ariaCount = await ariaElements.count();
      
      for (let i = 0; i < Math.min(ariaCount, 3); i++) {
        const element = ariaElements.nth(i);
        if (await element.isVisible()) {
          await expect(element).toHaveScreenshot(`aria-element-${i}.png`);
        }
      }
      
      // Test focus indicators
      const focusableElements = page.locator('button, input, select, textarea, a, [tabindex]');
      const focusableCount = await focusableElements.count();
      
      for (let i = 0; i < Math.min(focusableCount, 3); i++) {
        const element = focusableElements.nth(i);
        await element.focus();
        await page.waitForTimeout(200);
        await expect(element).toHaveScreenshot(`focus-indicator-${i}.png`);
      }
      
      // Test skip links
      const skipLinks = page.locator('.skip-link');
      const skipLinkCount = await skipLinks.count();
      
      for (let i = 0; i < Math.min(skipLinkCount, 2); i++) {
        const skipLink = skipLinks.nth(i);
        await expect(skipLink).toHaveScreenshot(`skip-link-${i}.png`);
      }
    });

    test('should render screen reader friendly components', async () => {
      await page.goto('/components/accessibility');
      await page.waitForLoadState('networkidle');
      
      // Test semantic HTML
      const semanticElements = page.locator('main, nav, header, footer, section, article, aside');
      const semanticCount = await semanticElements.count();
      
      for (let i = 0; i < Math.min(semanticCount, 3); i++) {
        const element = semanticElements.nth(i);
        if (await element.isVisible()) {
          await expect(element).toHaveScreenshot(`semantic-element-${i}.png`);
        }
      }
      
      // Test alt text for images
      const images = page.locator('img[alt]');
      const imageCount = await images.count();
      
      for (let i = 0; i < Math.min(imageCount, 3); i++) {
        const image = images.nth(i);
        await expect(image).toHaveScreenshot(`accessible-image-${i}.png`);
      }
    });
  });
});
