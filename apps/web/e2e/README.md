# Comprehensive E2E Test Suite

This directory contains comprehensive end-to-end tests for the rental portal web application using Playwright.

## Test Coverage

### 1. **Form Validation Tests** (`comprehensive-form-validation.spec.ts`)

Complete validation testing for all forms in the application:

#### Auth Forms
- **Login**: Empty fields, invalid email formats, wrong credentials, password visibility, rate limiting
- **Signup**: All required fields, password strength, confirmation matching, phone validation, duplicate email, terms acceptance
- **Forgot Password**: Email validation, success/error messages, security considerations

#### Listing Forms
- **Create/Edit Listing**: Required fields, title/description length, price validation, rental period ranges, delivery methods, image uploads (size, type, count), location validation, zip code formats
- **Success Flows**: Complete listing creation with valid data

#### Booking Forms
- **Date Selection**: Required dates, date range validation, guest count limits, message length
- **Conflicts**: Handling unavailable dates, concurrent bookings

#### Payment Forms
- **Card Validation**: Number format, expiry date, CVC, cardholder name
- **Error Handling**: Declined cards, insufficient funds, timeouts

#### Profile/Settings Forms
- **Profile Updates**: Name validation, bio length, password changes
- **Security**: Current password verification, confirmation matching

#### Search Filters
- **Price Ranges**: Min/max validation
- **Date Ranges**: Start/end date validation

#### Review Forms
- **Rating**: Required selection, star ratings
- **Comments**: Minimum length requirements

### 2. **User Journey Tests** (`comprehensive-user-journeys.spec.ts`)

Complete user flows from start to finish with realistic data:

#### Journey 1: New Renter - Full Booking Flow
1. Signup as new renter with complete profile
2. Browse and search for items with filters
3. View listing details and check information
4. Select dates and proceed to booking
5. Review booking summary and pricing
6. Enter payment information
7. Complete booking and get confirmation
8. View booking in dashboard
9. Message owner about booking
10. Leave review after rental completion

#### Journey 2: Owner - List and Manage Rental
1. Create new listing with all details and photos
2. View listing analytics and performance
3. Receive and review booking requests
4. Approve booking and communicate with renter
5. Mark item as returned and complete rental
6. Manage calendar availability
7. View earnings and request payouts

#### Journey 3: Complete Dispute Resolution
1. Renter files dispute with evidence
2. Owner responds with counter-evidence
3. Admin reviews and resolves dispute fairly

#### Journey 4: Organization Management
1. Owner creates organization profile
2. Invites team members with roles
3. Adds listings to organization
4. Manages organization settings

### 3. **Edge Cases and Error Scenarios** (`comprehensive-edge-cases.spec.ts`)

Testing unusual scenarios and error handling:

#### Network and API Errors
- Timeouts, 500 errors, rate limiting, retry mechanisms
- Offline mode, slow connections

#### Authentication Edge Cases
- Expired sessions, concurrent logins, token refresh failures
- Password changes affecting active sessions

#### Payment Edge Cases
- Declined cards, insufficient funds, timeouts
- Double payment prevention
- Payment processing failures

#### Booking Edge Cases
- Listing unavailable during booking
- Date conflicts and concurrent bookings
- Price changes during checkout

#### File Upload Edge Cases
- Upload failures, corrupted files
- Maximum file size/count limits
- Unsupported file types

#### Concurrency Issues
- Simultaneous booking attempts
- Listing edits during viewing
- Race conditions

#### Browser Edge Cases
- Offline/online transitions
- Browser back/forward buttons
- Page reloads during submission
- Storage quota limits

#### Data Validation Edge Cases
- Special characters and SQL injection attempts
- XSS prevention and HTML sanitization
- Very long input strings
- Invalid date formats

## Test Data

All tests use realistic data from `helpers/fixtures.ts`:

- **Test Users**: Renter, Owner, Admin with complete profiles
- **Test Listings**: Camera equipment, drones, camping gear with detailed descriptions
- **Test Bookings**: Weekend, week-long, and extended rentals
- **Test Payment Cards**: Valid, declined, insufficient funds (Stripe test cards)
- **Test Reviews**: Positive, negative, moderate ratings with detailed comments
- **Test Organizations**: Professional rental companies with teams
- **Invalid Data Sets**: Comprehensive sets of invalid inputs for validation testing

## Helper Functions

Located in `helpers/test-utils.ts`:

- `loginAs()` - Quick authentication
- `logout()` - Clear session
- `waitForToast()` - Wait for notifications
- `fillForm()` - Bulk form filling
- `selectOption()` - Dropdown selection
- `uploadFile()` - File upload simulation
- `mockApiResponse()` - API mocking
- `waitForNetworkIdle()` - Network stabilization
- And many more...

## Running Tests

### Run all tests
```bash
cd apps/web
pnpm test:e2e
```

### Run specific test file
```bash
pnpm test:e2e comprehensive-form-validation
pnpm test:e2e comprehensive-user-journeys
pnpm test:e2e comprehensive-edge-cases
```

### Run in headed mode (see browser)
```bash
pnpm test:e2e --headed
```

### Run with specific browser
```bash
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit
```

### Run in debug mode
```bash
pnpm test:e2e --debug
```

### Run specific test
```bash
pnpm test:e2e -g "should validate password strength"
```

### Run tests in UI mode (interactive)
```bash
pnpm test:e2e --ui
```

### Generate HTML report
```bash
pnpm test:e2e --reporter=html
```

### Run on multiple browsers in parallel
```bash
pnpm test:e2e --project=chromium --project=firefox --project=webkit
```

### Run mobile tests
```bash
pnpm test:e2e --project="Mobile Chrome"
pnpm test:e2e --project="Mobile Safari"
```

## Test Configuration

Configuration in `playwright.config.ts`:

- **Base URL**: `http://localhost:3401`
- **Timeout**: 30 seconds per test
- **Retries**: 2 in CI, 0 locally
- **Workers**: 1 in CI, unlimited locally
- **Screenshots**: Only on failure
- **Video**: Only on failure
- **Trace**: On first retry

## CI/CD Integration

Tests automatically run in GitHub Actions on:
- Pull requests
- Pushes to main/develop branches
- Scheduled nightly runs

Configuration: `.github/workflows/e2e-tests.yml`

## Best Practices

1. **Realistic Data**: Always use realistic test data from fixtures
2. **Proper Waits**: Use `expect().toBeVisible()` instead of `waitForTimeout()`
3. **Selectors**: Prefer `data-testid` over CSS classes
4. **Isolation**: Each test should be independent
5. **Cleanup**: Tests clean up after themselves
6. **Error Messages**: Descriptive test names and assertions
7. **Parallel Safe**: Tests can run in parallel without conflicts

## Debugging Tips

### View test traces
```bash
npx playwright show-trace trace.zip
```

### Use VS Code extension
Install "Playwright Test for VSCode" for:
- Running tests from editor
- Debugging with breakpoints
- Viewing test results inline

### Use console logs
```typescript
await page.on('console', msg => console.log(msg.text()));
```

### Take screenshots manually
```typescript
await page.screenshot({ path: 'debug.png' });
```

### Use inspector
```bash
PWDEBUG=1 pnpm test:e2e
```

## Coverage Goals

- ✅ All user-facing forms validated
- ✅ Complete user journeys tested end-to-end
- ✅ Error scenarios and edge cases covered
- ✅ Mobile responsive testing
- ✅ Cross-browser compatibility
- ✅ Accessibility checks
- ✅ Performance monitoring

## Adding New Tests

1. Create new test file or add to existing
2. Import fixtures and helpers
3. Use descriptive test names
4. Follow existing patterns
5. Update this README

Example:
```typescript
import { test, expect } from "@playwright/test";
import { testUsers } from "./helpers/fixtures";
import { loginAs } from "./helpers/test-utils";

test.describe("Feature Name", () => {
  test("should do something specific", async ({ page }) => {
    await loginAs(page, testUsers.renter);
    // ... test steps
    await expect(page.locator('...')).toBeVisible();
  });
});
```

## Test Maintenance

- Update fixtures when features change
- Keep selectors in sync with component updates
- Review and update tests after major refactors
- Remove obsolete tests
- Add tests for new features immediately

## Performance

Tests are optimized for speed:
- Parallel execution where safe
- Reusable authentication states
- Smart waiting strategies
- Minimal use of hard timeouts
- Efficient selector strategies

Average test suite run time:
- Full suite: ~15-20 minutes (parallel)
- Single journey: ~2-3 minutes
- Single validation test: ~30-60 seconds

## Reporting

After test run, view HTML report:
```bash
npx playwright show-report
```

Report includes:
- Pass/fail status
- Screenshots of failures
- Video recordings
- Test traces
- Browser console logs
- Network activity

## Troubleshooting

### Tests fail locally but pass in CI
- Check for timing issues (add proper waits)
- Verify test data consistency
- Check for environment-specific config

### Flaky tests
- Add more specific wait conditions
- Use `toBeVisible()` instead of checking existence
- Increase timeout for slow operations
- Check for race conditions

### Can't find elements
- Verify selector in browser DevTools
- Check if element is in shadow DOM
- Wait for element to be visible
- Check for iframe context

## Contributing

1. Write tests for new features
2. Ensure tests are deterministic
3. Use realistic test data
4. Follow existing patterns
5. Update documentation
6. Ensure tests pass locally before PR

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Selectors Guide](https://playwright.dev/docs/selectors)
