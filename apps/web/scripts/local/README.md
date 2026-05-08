# Local Debug Scripts

This directory contains debug and diagnostic E2E scripts that are **not** part of the automated test suite. These scripts are intended for local development and troubleshooting only.

## Scripts

### debug-disputes.spec.ts
Debug script for disputes navigation issues. Tests direct navigation and sidebar navigation to the disputes page with detailed console logging and screenshots.

**Usage:**
```bash
cd apps/web
npx playwright test scripts/local/debug-disputes.spec.ts --headed
```

### diagnostic.spec.ts
Diagnostic tests for login issues. Tests renter login flow with extensive logging including:
- Form field validation
- Error message detection
- Console log monitoring
- API response tracking
- Screenshot capture

**Usage:**
```bash
cd apps/web
npx playwright test scripts/local/diagnostic.spec.ts --headed
```

### debug-a11y.spec.ts
Debug script for accessibility violations. Uses Axe to find color contrast and other WCAG violations on the home page.

**Usage:**
```bash
cd apps/web
npx playwright test scripts/local/debug-a11y.spec.ts
```

## Purpose

These scripts are **excluded from CI/CD** because they:
- Use extensive console logging for debugging
- Take screenshots for visual inspection
- Test specific edge cases or troubleshooting scenarios
- May not have proper assertions (informational only)
- Are not meant to be regression tests

## When to Use

- When investigating specific UI navigation issues
- When debugging login/authentication problems
- When auditing accessibility violations
- When needing to capture screenshots for bug reports

## Running Local Scripts

To run any local debug script:

```bash
cd apps/web
npx playwright test scripts/local/<script-name>.spec.ts --headed
```

Use `--headed` flag to see the browser window for visual debugging.
