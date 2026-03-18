import { test, expect } from '@playwright/test';
import { loginAs, testUsers } from './helpers/test-utils';

test.describe('AI Listing Assistant Integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
  });

  test('should render AI assistant on listing creation page', async ({ page }) => {
    // Navigate to listing creation page
    await page.goto('/listings/new');
    
    // Wait for AI assistant to load
    await expect(page.locator('h3:has-text("AI Assistant")')).toBeVisible();
    
    // Check if suggestions tab is active
    await expect(page.locator('button:has-text("Suggestions")')).toHaveClass(/bg-primary/);
  });

  test('should generate suggestions based on listing data', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Fill in some listing data
    await page.fill('input[name="title"]', 'Camera for Rent');
    await page.selectOption('select[name="category"]', 'electronics');
    
    // Wait for AI suggestions to appear
    await page.waitForTimeout(2000);
    
    // Should show suggestions
    await expect(page.locator('[data-testid="ai-suggestions"]')).toBeVisible();
    
    // Should show suggestion items
    const suggestionItems = page.locator('[data-testid="suggestion-item"]');
    await expect(suggestionItems.first()).toBeVisible();
  });

  test('should apply suggestions when clicked', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Fill in some data to trigger suggestions
    await page.selectOption('select[name="category"]', 'electronics');
    
    // Wait for suggestions
    await page.waitForTimeout(2000);
    
    // Click on a suggestion
    const firstSuggestion = page.locator('[data-testid="suggestion-item"]').first();
    await firstSuggestion.click();
    
    // Should show applied state
    await expect(firstSuggestion.locator('[data-testid="applied-indicator"]')).toBeVisible();
  });

  test('should switch to market insights tab', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Click on market insights tab
    await page.click('button:has-text("Market Insights")');
    
    // Should show market insights content
    await expect(page.locator('h4:has-text("Market Demand")')).toBeVisible();
    await expect(page.locator('h4:has-text("Pricing Insights")')).toBeVisible();
    await expect(page.locator('h4:has-text("Popular Features")')).toBeVisible();
  });

  test('should display market demand indicator', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Switch to insights tab
    await page.click('button:has-text("Market Insights")');
    
    // Should show demand level
    await expect(page.locator('[data-testid="demand-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="demand-level"]')).toHaveText(/HIGH|MEDIUM|LOW/);
  });

  test('should show pricing insights', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Select a category to get pricing data
    await page.selectOption('select[name="category"]', 'electronics');
    
    // Switch to insights tab
    await page.click('button:has-text("Market Insights")');
    
    // Wait for data to load
    await page.waitForTimeout(1000);
    
    // Should show average price
    await expect(page.locator('[data-testid="average-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="price-range"]')).toBeVisible();
  });

  test('should show popular features', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Select a category
    await page.selectOption('select[name="category"]', 'electronics');
    
    // Switch to insights tab
    await page.click('button:has-text("Market Insights")');
    
    // Wait for data to load
    await page.waitForTimeout(1000);
    
    // Should show popular features
    await expect(page.locator('[data-testid="popular-features"]')).toBeVisible();
    const featureTags = page.locator('[data-testid="feature-tag"]');
    await expect(featureTags.first()).toBeVisible();
  });

  test('should show seasonal trends', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Switch to insights tab
    await page.click('button:has-text("Market Insights")');
    
    // Should show seasonal trends
    await expect(page.locator('h4:has-text("Seasonal Trends")')).toBeVisible();
    const trendItems = page.locator('[data-testid="trend-item"]');
    await expect(trendItems.first()).toBeVisible();
  });

  test('should show competition information', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Select a category
    await page.selectOption('select[name="category"]', 'electronics');
    
    // Switch to insights tab
    await page.click('button:has-text("Market Insights")');
    
    // Wait for data to load
    await page.waitForTimeout(1000);
    
    // Should show competition info
    await expect(page.locator('h4:has-text("Competition")')).toBeVisible();
    await expect(page.locator('[data-testid="competitor-count"]')).toBeVisible();
  });

  test('should regenerate suggestions', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Fill in some data
    await page.fill('input[name="title"]', 'Test Item');
    
    // Wait for initial suggestions
    await page.waitForTimeout(2000);
    
    // Click regenerate button
    await page.click('button:has-text("Regenerate Suggestions")');
    
    // Should show loading state
    await expect(page.locator('text=Generating AI suggestions...')).toBeVisible();
    
    // Should show new suggestions
    await page.waitForTimeout(2000);
    const newSuggestions = page.locator('[data-testid="suggestion-item"]');
    await expect(newSuggestions.first()).toBeVisible();
  });

  test('should show confidence indicators', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Fill in data to trigger suggestions
    await page.fill('input[name="title"]', 'Test Item');
    
    // Wait for suggestions
    await page.waitForTimeout(2000);
    
    // Should show confidence scores
    const confidenceScores = page.locator('[data-testid="confidence-score"]');
    await expect(confidenceScores.first()).toBeVisible();
    
    // Should show percentage
    const confidenceText = await page.locator('[data-testid="confidence-score"]').first().textContent();
    expect(confidenceText).toMatch(/\d+% confidence/);
  });

  test('should handle different categories', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Test different categories
    const categories = ['electronics', 'furniture', 'tools'];
    
    for (const category of categories) {
      // Select category
      await page.selectOption('select[name="category"]', category);
      
      // Switch to insights tab
      await page.click('button:has-text("Market Insights")');
      
      // Wait for data to load
      await page.waitForTimeout(1000);
      
      // Should show category-specific insights
      await expect(page.locator('[data-testid="market-insights"]')).toBeVisible();
      
      // Go back to suggestions
      await page.click('button:has-text("Suggestions")');
    }
  });

  test('should show loading states', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Fill in data to trigger API calls
    await page.fill('input[name="title"]', 'Test Item');
    
    // Should show loading state initially
    await expect(page.locator('text=Generating AI suggestions...')).toBeVisible();
    
    // Should show content after loading
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="ai-suggestions"]')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/ai/generate-suggestions', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });
    
    await page.goto('/listings/new');
    
    // Fill in data to trigger API call
    await page.fill('input[name="title"]', 'Test Item');
    
    // Wait for error handling
    await page.waitForTimeout(2000);
    
    // Should show error state
    await expect(page.locator('text=Add more details to get AI suggestions')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/listings/new');
    
    // Should show mobile-optimized layout
    await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible();
    
    // Should show stacked tabs on mobile
    const tabs = page.locator('[data-testid="ai-tabs"]');
    await expect(tabs).toHaveCSS('flex-direction', 'column');
  });

  test('should handle accessibility', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Check ARIA labels
    await expect(page.locator('[aria-label="AI Assistant"]')).toBeVisible();
    
    // Check keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('button:focus')).toBeVisible();
    
    // Check screen reader support
    const aiAssistant = page.locator('[data-testid="ai-assistant"]');
    await expect(aiAssistant).toHaveAttribute('role', 'region');
  });

  test('should integrate with form submission', async ({ page }) => {
    await page.goto('/listings/new');
    
    // Fill in form with AI assistance
    await page.selectOption('select[name="category"]', 'electronics');
    
    // Wait for AI suggestions
    await page.waitForTimeout(2000);
    
    // Apply a suggestion
    const firstSuggestion = page.locator('[data-testid="suggestion-item"]').first();
    await firstSuggestion.click();
    
    // Fill in other required fields
    await page.fill('input[name="title"]', 'Camera for Rent');
    await page.fill('textarea[name="description"]', 'Great camera for photography');
    await page.fill('input[name="basePrice"]', '5000');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should navigate to listing details
    await expect(page).toHaveURL(/\/listings\/.*/);
  });
});
