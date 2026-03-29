# Comprehensive E2E Test Suite

This directory contains comprehensive end-to-end tests for the rental portal web application using Playwright.

## Test Coverage

### Coverage Lanes

- `manual-critical-ui-journeys.spec.ts`: browser-first, manual-style critical path coverage. Uses the real login form, the real owner listing creation UI, a dedicated request-based listing fixture for deterministic booking setup, the listing page calendar, booking detail actions, booking-thread messaging, checkout guard redirects, owner rejection, renter checkout cancellation, payment-failed retry recovery, the dispute form, and the admin dispute modal. This is the closest lane to human QA behavior, with payment only bridged at the external provider boundary.
- The unhappy-path booking tests in the manual lane assume a non-production degraded local API: run the isolated stack with `SAFETY_CHECKS_FAIL_OPEN=true` so compliance gating does not block browser-first booking creation before the decline, cancellation, and payment-retry scenarios start.
- `ujlt-v2-comprehensive-journeys.spec.ts`: deep lifecycle and state-machine coverage. This suite is intentionally API-assisted so it can validate complete continuation logic, side effects, and admin/system outcomes without relying on long UI setup for every transition.
- Route-aligned suites such as `route-health.spec.ts`, `admin-flows.spec.ts`, `insurance-flows.spec.ts`, `static-pages.spec.ts`, `organizations-flows.spec.ts`, and `settings-flows.spec.ts` are the authoritative hybrid lanes. Legacy broad "comprehensive" suites should not be treated as coverage proof unless they are explicitly verified against the current router.
- The currently known exploratory suites are ignored by default in Playwright discovery: `file-upload-workflows-comprehensive.spec.ts`, `help-support-comprehensive.spec.ts`, `multi-language-comprehensive.spec.ts`, `organization-management-comprehensive.spec.ts`, `payment-integration-comprehensive.spec.ts`, `profile-management.spec.ts`, `profile-management-comprehensive.spec.ts`, `stripe-payments.spec.ts`, and `websocket-realtime-comprehensive.spec.ts`. Opt back in only for investigation with `PLAYWRIGHT_INCLUDE_EXPLORATORY=true`.
- Current retained-suite status on rebuilt isolated Chromium stacks:
  - Strict rebuilt stack (`SAFETY_CHECKS_FAIL_OPEN=false`): `insurance-flows.spec.ts`, `static-pages.spec.ts`, `organizations-flows.spec.ts`, and `settings-flows.spec.ts` are green.
  - Manual rebuilt stack (`SAFETY_CHECKS_FAIL_OPEN=true`): `manual-critical-ui-journeys.spec.ts` is green.
  - If you edit web code and rerun Playwright against an already-running `start:isolated:skip-build` preview, you can get false negatives from stale client assets. Rebuild the web app or start a fresh isolated stack before treating browser failures as product defects.

Use the manual lane when the question is "can a user really do this through the browser?" Use UJLT when the question is "does the full lifecycle and all related side effects hold together end to end?"

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
pnpm --filter @rental-portal/web run test:e2e
```

To include the ignored exploratory suites in an ad hoc run:

```bash
PLAYWRIGHT_INCLUDE_EXPLORATORY=true pnpm --filter @rental-portal/web run test:e2e
```

### Run the full suite

```bash
pnpm --filter @rental-portal/web run test:e2e:full
```

### Run the browser-first manual lane

```bash
pnpm run dev:isolated:manual
pnpm run test:e2e:web:isolated:manual:chromium
```

If you are already inside `apps/web`, the equivalent web-local command is:

```bash
pnpm run test:e2e:manual:isolated:chromium
```

### Run the deep lifecycle lane

```bash
pnpm --filter @rental-portal/web run test:e2e:ujlt
```

### Run a specific test file

```bash
pnpm --filter @rental-portal/web run test:e2e -- e2e/comprehensive-form-validation.spec.ts
pnpm --filter @rental-portal/web run test:e2e -- e2e/comprehensive-user-journeys.spec.ts
pnpm --filter @rental-portal/web run test:e2e -- e2e/comprehensive-edge-cases.spec.ts
```

### Run in headed mode (see browser)

```bash
pnpm --filter @rental-portal/web run test:e2e -- --headed
```

### Run with specific browser

```bash
pnpm --filter @rental-portal/web run test:e2e -- --project=chromium
pnpm --filter @rental-portal/web run test:e2e -- --project=firefox
pnpm --filter @rental-portal/web run test:e2e -- --project=webkit
```

### Run in debug mode

```bash
pnpm --filter @rental-portal/web run test:e2e:debug
```

### Run specific test

```bash
pnpm --filter @rental-portal/web run test:e2e -- -g "should validate password strength"
```

### Run tests in UI mode (interactive)

```bash
pnpm --filter @rental-portal/web run test:e2e:ui
```

### Generate HTML report

```bash
pnpm --filter @rental-portal/web run test:e2e -- --reporter=html
```

### Run on multiple browsers in parallel

```bash
pnpm --filter @rental-portal/web run test:e2e -- --project=chromium --project=firefox --project=webkit
```

### Run mobile tests

```bash
pnpm --filter @rental-portal/web run test:e2e -- --project="Mobile Chrome"
pnpm --filter @rental-portal/web run test:e2e -- --project="Mobile Safari"
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
await page.on("console", (msg) => console.log(msg.text()));
```

### Take screenshots manually

```typescript
await page.screenshot({ path: "debug.png" });
```

### Use inspector

```bash
PWDEBUG=1 pnpm --filter @rental-portal/web run test:e2e
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
    await expect(page.locator("...")).toBeVisible();
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
