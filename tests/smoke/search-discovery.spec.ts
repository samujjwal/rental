import { test, expect } from '../fixtures/auth';
import { createNavigationHelper, createAssertionHelper, createFormHelper } from '../helpers/navigation';

test.describe('Search and Discovery Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock search API responses
    await page.route('**/listings/search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          listings: [
            {
              id: 'listing-1',
              title: 'Test Vehicle Rental',
              description: 'A great car for rent',
              price: 50,
              currency: 'USD',
              category: 'vehicle',
              location: 'Test City',
              images: ['car1.jpg'],
              rating: 4.5,
              reviewsCount: 10,
              owner: {
                id: 'owner-1',
                firstName: 'John',
                lastName: 'Doe'
              }
            },
            {
              id: 'listing-2',
              title: 'Test Property Rental',
              description: 'A beautiful apartment',
              price: 100,
              currency: 'USD',
              category: 'property',
              location: 'Test City',
              images: ['apt1.jpg'],
              rating: 4.8,
              reviewsCount: 25,
              owner: {
                id: 'owner-2',
                firstName: 'Jane',
                lastName: 'Smith'
              }
            }
          ],
          total: 2,
          page: 1,
          totalPages: 1
        })
      });
    });

    // Mock categories API
    await page.route('**/categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'vehicle', name: 'Vehicles', slug: 'vehicle' },
          { id: 'property', name: 'Properties', slug: 'property' },
          { id: 'equipment', name: 'Equipment', slug: 'equipment' }
        ])
      });
    });
  });

  test('should display search results for valid query', async ({ page }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);

    // Navigate to search page
    await navigation.navigateToSearch();
    await assertions.assertPageTitle('Search Rentals');

    // Perform search
    await page.fill('[data-testid="search-input"]', 'car');
    await page.click('[data-testid="search-button"]');

    // Wait for results
    await assertions.assertLoadingHidden();
    await assertions.assertElementVisible('[data-testid="search-results"]');

    // Verify results
    await assertions.assertElementCount('[data-testid="listing-card"]', 2);
    await assertions.assertElementText('[data-testid="listing-card-1"]', 'Test Vehicle Rental');
    await assertions.assertElementText('[data-testid="listing-card-2"]', 'Test Property Rental');
  });

  test('should apply filters correctly', async ({ page }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);

    // Navigate to search with filters
    await navigation.navigateToSearch({ category: 'vehicle', minPrice: '25', maxPrice: '75' });

    // Verify filters are applied
    await assertions.assertElementVisible('[data-testid="filter-category"]');
    await assertions.assertElementVisible('[data-testid="filter-price-range"]');
    
    // Check filter values
    await expect(page.locator('[data-testid="filter-category"]')).toHaveValue('vehicle');
    await expect(page.locator('[data-testid="min-price"]')).toHaveValue('25');
    await expect(page.locator('[data-testid="max-price"]')).toHaveValue('75');
  });

  test('should handle empty search results', async ({ page }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);

    // Mock empty search results
    await page.route('**/listings/search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          listings: [],
          total: 0,
          page: 1,
          totalPages: 0
        })
      });
    });

    // Navigate to search
    await navigation.navigateToSearch();
    await page.fill('[data-testid="search-input"]', 'nonexistent');
    await page.click('[data-testid="search-button"]');

    // Verify empty state
    await assertions.assertEmptyStateVisible();
    await assertions.assertElementText('[data-testid="empty-state-title"]', 'No listings found');
    await assertions.assertElementVisible('[data-testid="clear-filters-button"]');
  });

  test('should handle search errors gracefully', async ({ page }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);

    // Mock search error
    await page.route('**/listings/search', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Search service unavailable'
        })
      });
    });

    // Navigate to search
    await navigation.navigateToSearch();
    await page.fill('[data-testid="search-input"]', 'test');
    await page.click('[data-testid="search-button"]');

    // Verify error handling
    await assertions.assertErrorVisible('Search service unavailable');
    await assertions.assertElementVisible('[data-testid="retry-button"]');
  });

  test('should preserve search state on navigation', async ({ page }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);

    // Perform search
    await navigation.navigateToSearch();
    await page.fill('[data-testid="search-input"]', 'car');
    await page.selectOption('[data-testid="sort-select"]', 'price-low-high');
    await page.click('[data-testid="search-button"]');

    // Navigate away and back
    await page.click('[data-testid="listing-card-1"]');
    await page.goBack();

    // Verify search state preserved
    await assertions.assertFieldValue('search-input', 'car');
    await expect(page.locator('[data-testid="sort-select"]')).toHaveValue('price-low-high');
    await assertions.assertElementVisible('[data-testid="search-results"]');
  });

  test('should support map view', async ({ page }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);

    // Navigate to search
    await navigation.navigateToSearch();
    await page.fill('[data-testid="search-input"]', 'car');
    await page.click('[data-testid="search-button"]');

    // Switch to map view
    await page.click('[data-testid="map-view-button"]');

    // Verify map view
    await assertions.assertElementVisible('[data-testid="listings-map"]');
    await assertions.assertElementVisible('[data-testid="map-marker"]', 2); // 2 listings
  });

  test('should handle pagination', async ({ page }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);

    // Mock paginated results
    await page.route('**/listings/search', async (route) => {
      const url = new URL(route.request().url());
      const page = url.searchParams.get('page') || '1';
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          listings: page === '1' ? [
            { id: 'listing-1', title: 'Listing 1' },
            { id: 'listing-2', title: 'Listing 2' }
          ] : [
            { id: 'listing-3', title: 'Listing 3' },
            { id: 'listing-4', title: 'Listing 4' }
          ],
          total: 4,
          page: parseInt(page),
          totalPages: 2
        })
      });
    });

    // Navigate to search
    await navigation.navigateToSearch();
    await page.fill('[data-testid="search-input"]', 'test');
    await page.click('[data-testid="search-button"]');

    // Verify first page
    await assertions.assertElementCount('[data-testid="listing-card"]', 2);
    await assertions.assertElementText('[data-testid="current-page"]', '1');

    // Navigate to next page
    await page.click('[data-testid="next-page"]');

    // Verify second page
    await assertions.assertElementCount('[data-testid="listing-card"]', 2);
    await assertions.assertElementText('[data-testid="current-page"]', '2');
    await assertions.assertElementText('[data-testid="listing-card-3"]', 'Listing 3');
  });

  test('should support keyboard navigation in search results', async ({ page }) => {
    const navigation = createNavigationHelper(page);
    const assertions = createAssertionHelper(page);

    // Navigate to search
    await navigation.navigateToSearch();
    await page.fill('[data-testid="search-input"]', 'car');
    await page.click('[data-testid="search-button"]');

    // Test keyboard navigation
    await page.press('[data-testid="search-input"]', 'ArrowDown');
    await assertions.assertElementVisible('[data-testid="search-suggestions"]');

    // Navigate suggestions with keyboard
    await page.press('[data-testid="search-suggestions"]', 'ArrowDown');
    await page.press('[data-testid="search-suggestions"]', 'Enter');

    // Verify suggestion selected
    await assertions.assertElementVisible('[data-testid="search-results"]');
  });
});
