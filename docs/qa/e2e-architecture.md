# E2E Test Architecture

This document describes the architecture and design of the End-to-End (E2E) testing strategy for the GharBatai Nepal Rental Portal.

## Overview

The E2E test suite validates complete user journeys across the entire application stack, ensuring that all components work together correctly from the user's perspective.

## Technology Stack

### Web E2E Tests
- **Framework**: Playwright
- **Language**: TypeScript
- **Location**: `apps/web/e2e/`
- **Browsers**: Chromium (primary), Firefox, Safari (for cross-browser testing)

### Mobile E2E Tests
- **Framework**: Maestro (for React Native)
- **Language**: YAML (test definitions) + TypeScript (custom flows)
- **Location**: `apps/mobile/.maestro/`

### API E2E Tests
- **Framework**: Supertest + Jest
- **Language**: TypeScript
- **Location**: `apps/api/test/`

## Test Organization

### Web E2E Test Structure

```
apps/web/e2e/
├── helpers/
│   ├── fixtures.ts          # Test data fixtures
│   ├── seed-data.ts         # Database seeding helpers
│   └── test-utils.ts        # Reusable test utilities
├── visual/                  # Visual regression tests
│   └── visual-regression.spec.ts
├── auth-flows.spec.ts       # Authentication journeys
├── booking-workflows.spec.ts # Booking creation/management
├── listing-workflows.spec.ts # Listing creation/management
├── payment-flows.spec.ts    # Payment processing
├── messaging.spec.ts        # Messaging functionality
├── profile-management.spec.ts # User profile operations
├── file-upload-workflows-comprehensive.spec.ts # File uploads
├── multi-language-comprehensive.spec.ts # i18n testing
├── visual-regression.spec.ts # Screenshot comparison
└── [additional test files]
```

### Test File Naming Convention

- **Feature-based naming**: `{feature}-{workflow}.spec.ts`
- **Comprehensive tests**: `{feature}-comprehensive.spec.ts`
- **Edge cases**: `{feature}-edge-cases.spec.ts`
- **Visual tests**: `visual-regression.spec.ts`

## Test Data Management

### Seed Data Strategy

Test data is seeded before each test suite using the `ensureSeedData()` helper:

```typescript
import { ensureSeedData } from "./helpers/seed-data";

test.beforeEach(async ({ page }) => {
  await ensureSeedData(page);
});
```

### Fixtures

Test fixtures provide consistent, reusable test data:

```typescript
// helpers/fixtures.ts
export const testUsers = {
  renter: {
    email: `renter-${Date.now()}@test.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'Renter'
  },
  owner: {
    email: `owner-${Date.now()}@test.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'Owner'
  }
};
```

### Dynamic Data

To avoid conflicts, use timestamps or UUIDs for dynamic data:

```typescript
const uniqueEmail = `test-${Date.now()}@example.com`;
const uniqueListingTitle = `Test Listing ${Date.now()}`;
```

## Test Utilities

### Authentication Helpers

```typescript
// helpers/auth-helpers.ts
async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}
```

### Navigation Helpers

```typescript
// helpers/navigation.ts
async function navigateToListing(page: Page, listingId: string) {
  await page.goto(`/listings/${listingId}`);
  await page.waitForLoadState('networkidle');
}
```

### Wait Strategies

Use explicit waits instead of hard-coded timeouts:

```typescript
// ❌ Bad
await page.waitForTimeout(5000);

// ✅ Good
await page.waitForSelector('[data-testid="listing-card"]');
await page.waitForLoadState('networkidle');
await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
```

## Test Design Patterns

### Page Object Model

Organize page interactions into reusable page objects:

```typescript
// pages/ListingsPage.ts
export class ListingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/listings');
  }

  async search(query: string) {
    await this.page.fill('[data-testid="search-input"]', query);
    await this.page.press('[data-testid="search-input"]', 'Enter');
  }

  async getFirstListing() {
    return this.page.locator('[data-testid="listing-card"]').first();
  }
}
```

### Test Data Builders

Use builder patterns for complex test data:

```typescript
// builders/ListingBuilder.ts
export class ListingBuilder {
  private listing: Partial<Listing> = {};

  withTitle(title: string) {
    this.listing.title = title;
    return this;
  }

  withPrice(price: number) {
    this.listing.price = price;
    return this;
  }

  withCategory(category: string) {
    this.listing.category = category;
    return this;
  }

  build() {
    return { ...defaultListing, ...this.listing };
  }
}
```

## Test Execution Strategies

### Local Development

```bash
# Run all E2E tests
cd apps/web && pnpm run test:e2e

# Run specific test file
cd apps/web && npx playwright test auth-flows.spec.ts

# Run with UI mode
cd apps/web && npx playwright test --ui

# Run with headed mode
cd apps/web && npx playwright test --headed
```

### CI/CD Execution

E2E tests run in CI with the following strategy:

1. **PR Checks**: Run smoke test suite (critical paths only)
2. **Main Branch**: Run full E2E suite
3. **Nightly**: Run complete E2E + visual regression + performance tests

### Parallel Execution

Tests run in parallel using Playwright's built-in worker pool:

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 4 : undefined, // Use 4 workers in CI
  fullyParallel: true,
});
```

## Test Categories

### Smoke Tests (Critical Paths)

Run on every deployment to verify core functionality:

- User login/logout
- Listing search
- Booking creation
- Payment processing
- Dashboard loading

### Regression Tests

Run on every PR to prevent regressions:

- All user authentication flows
- Complete booking lifecycle
- Listing management
- Messaging functionality
- Profile operations

### Comprehensive Tests

Run nightly or before releases:

- All user journeys
- Edge cases and error scenarios
- Cross-browser compatibility
- Visual regression
- Performance validation

## Visual Regression Testing

### Screenshot Strategy

Visual tests use Playwright's `toHaveScreenshot()` with the following configuration:

```typescript
const screenshotOpts = {
  maxDiffPixelRatio: 0.01, // 1% tolerance for anti-aliasing
  animations: 'disabled',
  mask: [], // Mask dynamic content
};
```

### Masking Dynamic Content

Mask elements that change between runs:

```typescript
await expect(page).toHaveScreenshot('dashboard.png', {
  mask: [
    page.locator('[data-testid="timestamp"]'),
    page.locator('[data-testid="random-id"]')
  ]
});
```

### Responsive Breakpoints

Test across multiple viewports:

- Mobile: 375x812 (iPhone X)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080 (Full HD)

## Error Handling

### Retry Strategy

Configure retries for flaky tests:

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
});
```

### Test Isolation

Each test should be independent:

```typescript
test.afterEach(async ({ page }) => {
  // Clean up test data
  await cleanupTestData(page);
  // Clear local storage
  await page.evaluate(() => localStorage.clear());
});
```

### Debugging Failed Tests

Use Playwright's debugging tools:

```bash
# Run with debug mode
npx playwright test --debug

# Run with trace viewer
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## Performance Testing Integration

### Load Testing with K6

Performance tests run separately but use similar test data:

```javascript
// tests/load/booking-flow.js
import { check } from 'k6';
import http from 'k6/http';

export default function () {
  const res = http.post('https://api.example.com/bookings', {
    // booking payload
  });
  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## Accessibility Testing

### Axe Integration

Use Playwright's axe-core integration for accessibility:

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have accessibility violations', async ({ page }) => {
  await page.goto('/');
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

## Mobile Testing

### Maestro Flows

Mobile E2E tests use Maestro for cross-platform testing:

```yaml
# apps/mobile/.maestro/login-flow.yaml
- launchApp
- tapOn: "Email"
- inputText: "test@example.com"
- tapOn: "Password"
- inputText: "password123"
- tapOn: "Login"
- assertVisible: "Dashboard"
```

### Device Farm Integration

Tests run on real devices via device farm services for production validation.

## Continuous Integration

### GitHub Actions Configuration

E2E tests run in GitHub Actions with:

- Service containers (PostgreSQL, Redis)
- Caching for dependencies and browsers
- Parallel job execution
- Artifact uploads for test reports
- Failure notifications

### Test Results

Test results are stored as artifacts:

- HTML reports
- Screenshots (on failure)
- Videos (on failure)
- Trace files (on failure)
- Coverage reports

## Best Practices

### DO

- Use data-testid attributes for element selection
- Write independent, isolated tests
- Use explicit waits instead of timeouts
- Clean up test data after each test
- Use descriptive test names
- Group related tests with describe blocks
- Mock external services when appropriate
- Test at the user journey level, not individual components

### DON'T

- Use hard-coded timeouts
- Depend on test execution order
- Use implementation details in selectors (CSS classes, etc.)
- Leave test data in the database after tests
- Write overly complex test logic
- Test third-party integrations directly
- Use production data in tests

## Maintenance

### Regular Reviews

- Review and update test data monthly
- Remove obsolete tests quarterly
- Update baselines for visual tests after UI changes
- Review flaky test reports weekly

### Test Metrics

Track the following metrics:

- Test execution time
- Flaky test rate
- Pass/fail rate
- Coverage percentage
- Mean time to repair failures

## Troubleshooting

### Common Issues

**Tests timeout waiting for element**
- Check if selector is correct
- Verify element exists in DOM
- Use waitForLoadState instead of timeout

**Tests fail intermittently**
- Increase retries
- Check for race conditions
- Verify test isolation

**Visual regression failures**
- Update baselines if change is intentional
- Check for dynamic content masking
- Verify browser version consistency

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Maestro Documentation](https://mobile.dev/docs/maestro)
- [Testing Best Practices](https://testingjavascript.com/)
- [Web Testing Guide](https://web.dev/test-your-web-app/)
