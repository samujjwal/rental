# Comprehensive Testing Guide

## Overview

Complete testing infrastructure for the Gharbatai Rentals platform covering E2E testing, performance testing, load testing, and security auditing.

---

## 🧪 Testing Stack

### **E2E Testing**

- **Playwright** - Cross-browser end-to-end testing
- **Coverage:** Authentication, Listings, Booking flows
- **Browsers:** Chromium, Firefox, WebKit, Mobile

### **Performance Testing**

- **Lighthouse CI** - Web performance auditing
- **Metrics:** FCP, LCP, CLS, TBT, TTI
- **Budgets:** Performance, Accessibility, SEO

### **Load Testing**

- **k6** - Load and stress testing
- **Scenarios:** Normal load, Spike, Stress
- **Thresholds:** Response time, Error rate

### **Security Testing**

- **npm audit** - Dependency vulnerabilities
- **OWASP Dependency Check** - Security scanning
- **Custom scripts** - Secret scanning, config checks

---

## 📁 Test Structure

```
gharbatai-rentals/
├── apps/web/
│   ├── tests/
│   │   └── e2e/
│   │       ├── auth.spec.ts
│   │       ├── listings.spec.ts
│   │       └── booking.spec.ts
│   └── playwright.config.ts
├── tests/
│   └── load/
│       ├── api-load-test.js
│       ├── spike-test.js
│       └── stress-test.js
├── scripts/
│   └── security-audit.sh
├── .lighthouserc.json
└── .github/workflows/
    └── testing.yml
```

---

## 🎭 E2E Testing with Playwright

### **Setup**

```bash
cd apps/web
npm install -D @playwright/test
npx playwright install
```

### **Running Tests**

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run tests in headed mode
npx playwright test --headed

# Run tests in specific browser
npx playwright test --project=chromium

# Run smoke tests only
npx playwright test --grep @smoke

# Debug mode
npx playwright test --debug

# UI mode
npx playwright test --ui
```

### **Test Examples**

#### **Authentication Test**

```typescript
test('should login with valid credentials @smoke', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
  await expect(page.locator('text=Dashboard')).toBeVisible();
});
```

#### **Listing Search Test**

```typescript
test('should display listings on search page @smoke', async ({ page }) => {
  await page.goto('/search');
  await page.waitForSelector('[data-testid="listing-card"]');
  const listings = await page.locator('[data-testid="listing-card"]').count();
  expect(listings).toBeGreaterThan(0);
});
```

### **Best Practices**

1. **Use data-testid attributes** for stable selectors
2. **Tag critical tests** with @smoke for quick validation
3. **Use Page Object Model** for complex flows
4. **Handle async operations** with proper waits
5. **Clean up test data** after tests
6. **Run tests in parallel** for speed
7. **Use fixtures** for common setup

---

## 🚀 Performance Testing with Lighthouse

### **Setup**

```bash
npm install -g @lhci/cli
```

### **Configuration**

`.lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

### **Running Tests**

```bash
# Run Lighthouse CI
lhci autorun

# Run on specific URL
lhci collect --url=http://localhost:3000

# View results
lhci open
```

### **Performance Budgets**

| Metric      | Target  | Critical |
| ----------- | ------- | -------- |
| FCP         | < 2s    | < 1.5s   |
| LCP         | < 2.5s  | < 2s     |
| CLS         | < 0.1   | < 0.05   |
| TBT         | < 300ms | < 200ms  |
| TTI         | < 3.5s  | < 3s     |
| Speed Index | < 3s    | < 2.5s   |

### **Optimization Tips**

1. **Images:** Use WebP, lazy loading, responsive images
2. **JavaScript:** Code splitting, tree shaking, minification
3. **CSS:** Critical CSS, remove unused CSS
4. **Fonts:** Font display swap, preload fonts
5. **Caching:** Long cache TTL, service workers
6. **CDN:** Use CDN for static assets

---

## 📊 Load Testing with k6

### **Setup**

```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

### **Running Tests**

```bash
# Normal load test
k6 run tests/load/api-load-test.js

# Spike test
k6 run tests/load/spike-test.js

# Stress test
k6 run tests/load/stress-test.js

# With environment variables
k6 run --env API_URL=https://api.example.com tests/load/api-load-test.js

# Output to file
k6 run --out json=results.json tests/load/api-load-test.js

# Cloud execution
k6 cloud tests/load/api-load-test.js
```

### **Test Scenarios**

#### **Load Test**

- Ramp up to 50 users (2 min)
- Stay at 50 users (5 min)
- Ramp up to 100 users (2 min)
- Stay at 100 users (5 min)
- Spike to 200 users (2 min)
- Stay at 200 users (5 min)
- Ramp down (5 min)

#### **Spike Test**

- Normal load: 50 users (1 min)
- Sudden spike: 500 users (30 sec)
- Sustained spike: 500 users (2 min)
- Return to normal: 50 users (1 min)

#### **Stress Test**

- Gradually increase load to find breaking point
- 100 → 200 → 300 → 400 → 500 users
- Monitor error rates and response times

### **Thresholds**

```javascript
thresholds: {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
  http_reqs: ['rate>100'],
}
```

### **Metrics to Monitor**

- **Response Time:** p95, p99
- **Throughput:** Requests per second
- **Error Rate:** Failed requests percentage
- **Concurrent Users:** Active virtual users
- **Data Transfer:** Bandwidth usage

---

## 🔒 Security Testing

### **Running Security Audit**

```bash
./scripts/security-audit.sh
```

### **What It Checks**

1. **Dependency Vulnerabilities** - npm audit
2. **Outdated Packages** - pnpm outdated
3. **License Compliance** - License check
4. **Secret Scanning** - gitleaks / grep patterns
5. **Code Quality** - ESLint security rules
6. **TypeScript Strict Mode** - Configuration check
7. **Environment Variables** - Exposure check
8. **CORS Configuration** - Security review
9. **SQL Injection** - Raw query detection
10. **XSS Prevention** - Dangerous HTML check
11. **Authentication** - Password hashing, JWT
12. **Rate Limiting** - Implementation check
13. **HTTPS/SSL** - TLS configuration
14. **Docker Security** - Non-root user check

### **Security Tools**

#### **npm audit**

```bash
pnpm audit
pnpm audit --audit-level=moderate
pnpm audit fix
```

#### **gitleaks (Secret Scanning)**

```bash
brew install gitleaks
gitleaks detect --source . --verbose
```

#### **OWASP Dependency Check**

```bash
dependency-check --project gharbatai-rentals --scan .
```

### **Security Best Practices**

1. **Dependencies:** Update regularly, use Dependabot
2. **Secrets:** Never commit secrets, use environment variables
3. **Authentication:** Strong password hashing (bcrypt/argon2)
4. **Authorization:** Implement RBAC, validate permissions
5. **Input Validation:** Validate all user input
6. **Output Encoding:** Prevent XSS attacks
7. **HTTPS:** Always use HTTPS in production
8. **Headers:** Set security headers (CSP, HSTS, etc.)
9. **Rate Limiting:** Prevent brute force attacks
10. **Logging:** Log security events, monitor logs

---

## 🔄 CI/CD Integration

### **GitHub Actions Workflow**

Tests run automatically on:

- **Push to main/develop**
- **Pull requests**
- **Weekly schedule** (Sundays)
- **Manual trigger**

### **Test Jobs**

1. **Unit Tests** - Fast feedback on code changes
2. **E2E Tests** - Full user flow validation
3. **Lighthouse** - Performance monitoring
4. **Load Tests** - Capacity verification (weekly)
5. **Security Audit** - Vulnerability scanning
6. **Accessibility** - WCAG compliance

### **Artifacts**

- Playwright reports (30 days)
- Lighthouse results (30 days)
- k6 results (30 days)
- Security reports (90 days)
- Accessibility reports (30 days)

---

## 📈 Test Coverage Goals

| Category          | Current | Target |
| ----------------- | ------- | ------ |
| Unit Tests        | 75%     | 80%    |
| Integration Tests | 60%     | 70%    |
| E2E Tests         | 50%     | 60%    |
| Critical Paths    | 90%     | 95%    |

---

## 🎯 Testing Checklist

### **Before Deployment**

- [ ] All unit tests passing
- [ ] E2E smoke tests passing
- [ ] Performance budgets met
- [ ] No critical security vulnerabilities
- [ ] Accessibility score > 95
- [ ] Load test passed (if applicable)
- [ ] Security audit completed
- [ ] Code coverage > 75%

### **After Deployment**

- [ ] Smoke tests on production
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify critical user flows
- [ ] Review logs for errors
- [ ] Test rollback procedure

---

## 🐛 Debugging Tests

### **Playwright**

```bash
# Debug specific test
npx playwright test auth.spec.ts --debug

# Show browser
npx playwright test --headed

# Slow motion
npx playwright test --headed --slow-mo=1000

# Generate test
npx playwright codegen http://localhost:3000
```

### **k6**

```bash
# Verbose output
k6 run --verbose tests/load/api-load-test.js

# Single VU for debugging
k6 run --vus 1 --iterations 1 tests/load/api-load-test.js
```

---

## 📚 Resources

**Playwright:**

- Docs: https://playwright.dev
- Best Practices: https://playwright.dev/docs/best-practices

**Lighthouse:**

- Docs: https://github.com/GoogleChrome/lighthouse-ci
- Performance: https://web.dev/performance

**k6:**

- Docs: https://k6.io/docs
- Examples: https://k6.io/docs/examples

**Security:**

- OWASP: https://owasp.org
- npm audit: https://docs.npmjs.com/cli/v8/commands/npm-audit

---

## 🎓 Training

### **For Developers**

1. Write tests for new features
2. Run tests locally before pushing
3. Fix failing tests immediately
4. Maintain test coverage
5. Review test reports

### **For QA**

1. Run full test suite before releases
2. Investigate test failures
3. Add tests for bug fixes
4. Monitor test metrics
5. Update test documentation

---

## 📊 Test Metrics Dashboard

Track these metrics:

- Test pass rate
- Test execution time
- Code coverage
- Performance scores
- Security vulnerabilities
- Flaky test rate

---

**Status:** ✅ **Complete Testing Infrastructure**

All testing tools configured and ready for use. Tests can be run locally or in CI/CD pipeline.
