# QA Testing Strategy - GharBatai Nepal Rental Portal

## Overview

This document outlines the comprehensive Quality Assurance (QA) strategy for the GharBatai Nepal Rental Portal, covering all testing types, methodologies, and best practices.

## Test Architecture

### Test Pyramid
```
        /\
       /  \
   / E2E \          (route-aligned Playwright release suites)
     /--------\
    / Integration \     (API, WebSocket, Payment tests)
   /--------------\
  /    Unit Tests    \   (900+ Jest/Vitest tests)
 /--------------------\
```

### Test Categories

#### 1. Unit Tests (900+ tests)
- **API Services**: NestJS services with mocked dependencies
- **Frontend Components**: React components with React Testing Library
- **Hooks & Utilities**: Custom hooks and utility functions
- **Coverage Target**: 80%+ for critical paths

#### 2. Integration Tests
- **API Integration**: Controller + Service + Database
- **WebSocket Real-time**: Connection, message handling, reconnection
- **Payment Processing**: Stripe integration with test cards
- **File Uploads**: S3/MinIO storage integration

#### 3. E2E Tests (route-aligned Playwright suites)
- **User Journeys**: Route-aligned core flows from login to booking completion
- **Cross-browser**: Chrome, Firefox, Safari, Edge
- **Responsive Design**: Mobile, Tablet, Desktop viewports
- **Accessibility**: WCAG 2.1 AA compliance

Release guidance: only route-aligned suites that are verified against `apps/web/app/routes.ts` should be treated as release-gate coverage. Broad exploratory specs are useful for investigation, but they are not authoritative until their routes are validated against the current router manifest.

## Manual Testing Guidelines

### Critical User Flows (Must Test Every Release)

#### Authentication & Onboarding
1. **User Registration**
   - Sign up with email/password
   - Email verification flow
   - Social login (if applicable)
   - Password strength validation

2. **Login & Security**
   - Login with valid credentials
   - Invalid password handling
   - Password reset flow
   - Session management
   - 2FA (if enabled)

#### Listing Management (Owner)
1. **Create Listing**
   - Fill all required fields
   - Upload multiple images
   - Set pricing and availability
   - Publish/unpublish flow

2. **Edit Listing**
   - Update pricing
   - Modify availability calendar
   - Add/remove images
   - Change location

3. **Owner Dashboard**
   - View bookings calendar
   - Manage booking requests
   - Track earnings
   - View analytics

#### Booking Flow (Renter)
1. **Search & Browse**
   - Filter by category
   - Filter by location
   - Filter by price range
   - Sort results

2. **Book Item**
   - Select dates
   - Check availability
   - Add message to owner
   - Complete payment (Stripe)
   - Receive confirmation

3. **Booking Management**
   - View booking status
   - Cancel booking (if allowed)
   - Extend rental period
   - Request return

#### Payment & Payouts
1. **Payment Processing**
   - Credit card payment (Stripe)
   - Payment confirmation
   - Receipt generation
   - Failed payment handling

2. **Owner Payouts**
   - View earnings
   - Request payout
   - Payout history
   - Bank account management

#### Disputes & Support
1. **File Dispute**
   - Create dispute from booking
   - Upload evidence
   - Track dispute status

2. **Messaging**
   - Send message to owner/renter
   - View conversation history
   - Attach files

### Edge Cases & Error Scenarios

#### Data Validation
- Empty required fields
- Invalid date ranges (past dates, end before start)
- Oversized image uploads (>10MB)
- Special characters in text fields
- Maximum length validation

#### Network & Performance
- Slow network conditions (3G simulation)
- Offline mode handling
- API timeout scenarios
- Concurrent booking attempts

#### Security
- SQL injection attempts
- XSS prevention
- CSRF protection
- Rate limiting validation

## Test Data Management

### Seed Data Strategy
```typescript
// E2E Test Data Structure
interface SeedData {
  users: {
    renter: TestUser;
    owner: TestUser;
    admin: TestUser;
  };
  listings: SeededListing[];
  bookings: SeededBooking[];
  categories: Category[];
}
```

### Test User Credentials
- **Renter**: renter@test.com / password123
- **Owner**: owner@test.com / password123
- **Admin**: admin@test.com / password123

### Data Cleanup
- All E2E test data tagged with "[E2E]"
- Automatic cleanup in `afterAll` hooks
- Database reset between test suites

## Release Testing Checklist

### Pre-Release Verification

#### API Layer
- [ ] All API endpoints return 200/201 for valid requests
- [ ] Proper error codes (400, 401, 403, 404, 500) for invalid requests
- [ ] Authentication middleware working on protected routes
- [ ] Rate limiting functioning correctly
- [ ] API documentation (Swagger) up to date

#### Frontend
- [ ] All routes accessible without errors
- [ ] Responsive design on mobile/tablet/desktop
- [ ] No console errors or warnings
- [ ] Loading states and error boundaries working
- [ ] SEO meta tags present on public pages

#### Database
- [ ] Migrations run successfully
- [ ] Seed data loads without errors
- [ ] Indexes optimized for query performance
- [ ] Backup/restore tested

#### Integrations
- [ ] Stripe webhooks handling correctly
- [ ] Email notifications sending
- [ ] SMS notifications (if applicable)
- [ ] S3/MinIO file uploads working
- [ ] WebSocket connections stable

### Post-Deployment Verification
- [ ] Smoke tests pass on production
- [ ] Critical user flows functional
- [ ] Error monitoring (Sentry) capturing exceptions
- [ ] Performance metrics within SLA
- [ ] SSL certificate valid

## Performance Testing

### Load Testing Targets (K6)
- **Homepage**: 1000 concurrent users, <2s response time
- **Search**: 500 concurrent users, <3s response time
- **Booking API**: 200 concurrent users, <1s response time
- **Checkout**: 100 concurrent users, <3s response time

### Key Metrics
- Time to First Byte (TTFB): <200ms
- First Contentful Paint (FCP): <1.5s
- Largest Contentful Paint (LCP): <2.5s
- Time to Interactive (TTI): <3.5s

## Accessibility Testing

### WCAG 2.1 AA Compliance
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Keyboard navigation functional
- [ ] Screen reader compatibility (ARIA labels)
- [ ] Focus indicators visible
- [ ] Form labels associated with inputs
- [ ] Alt text for images
- [ ] Skip links for navigation

### Testing Tools
- Lighthouse Accessibility Audit
- axe DevTools
- Screen readers (NVDA, VoiceOver)
- Keyboard-only navigation test

## Security Testing

### Automated Security Scans
- OWASP ZAP baseline scan
- Dependency vulnerability check (npm audit)
- SAST with CodeQL
- Container scanning (Trivy)

### Manual Security Tests
- [ ] SQL injection on search fields
- [ ] XSS on review/description fields
- [ ] CSRF token validation
- [ ] JWT token expiration
- [ ] File upload restrictions
- [ ] Rate limiting effectiveness

## Bug Reporting Template

```markdown
## Bug Report

**Severity**: [Critical/High/Medium/Low]
**Environment**: [Staging/Production]
**Browser**: [Chrome/Firefox/Safari/Edge]
**Device**: [Desktop/Mobile/Tablet]

### Steps to Reproduce
1. 
2. 
3. 

### Expected Behavior

### Actual Behavior

### Screenshots/Videos

### Console Errors

### Network Requests (if applicable)
```

## CI/CD Integration

### Test Gates
1. **Pre-commit**: Linting, formatting
2. **Pull Request**: Unit tests, type checking
3. **Merge to Main**: Full E2E suite, security scan
4. **Pre-deployment**: Smoke tests, performance baseline
5. **Post-deployment**: Health checks, monitoring alerts

### Test Automation
```bash
# Run all tests
npm run test:comprehensive

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:e2e          # Playwright E2E tests
npm run test:api          # API integration tests
npm run test:performance  # K6 load tests
npm run test:security     # Security scans
```

## Test Maintenance

### Weekly Tasks
- Review flaky tests and fix
- Update test data for new features
- Check test coverage reports

### Monthly Tasks
- Audit test suite for redundancy
- Update Playwright browser versions
- Review and update test documentation
- Performance baseline comparison

### Quarterly Tasks
- Full regression test execution
- Test strategy review and updates
- Tool evaluation and upgrades
- Team training on new testing practices

## Contact & Escalation

- **QA Lead**: qa-lead@gharbatai.com
- **DevOps**: devops@gharbatai.com
- **On-call**: oncall@gharbatai.com

## Appendix

### Useful Commands

```bash
# Debug specific E2E test
npx playwright test e2e/auth.spec.ts --headed --debug

# View test report
npx playwright show-report

# Update test snapshots
npx playwright test --update-snapshots

# Run tests with specific tag
npx playwright test --grep "@critical"
```

### Resources
- [Playwright Docs](https://playwright.dev/)
- [Stripe Testing Guide](https://docs.stripe.com/testing)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles/)
