# Testing Guide

This is the canonical overview of how testing is organized in the repository.

## Test Layers

- unit and service tests
- integration and API E2E tests
- web browser E2E tests
- mobile E2E validation
- property-based, security, load, and chaos tests

## Core Commands

```bash
pnpm test
pnpm run test:coverage

pnpm --filter @rental-portal/api test
pnpm --filter @rental-portal/api test:e2e
pnpm --filter @rental-portal/api test:smoke
pnpm --filter @rental-portal/api test:security
pnpm --filter @rental-portal/api test:property
pnpm --filter @rental-portal/api test:chaos

pnpm --filter @rental-portal/web test
pnpm run test:e2e:web
pnpm run test:e2e:web:full

pnpm --filter rental-portal-mobile test
pnpm run test:e2e:mobile:syntax
pnpm run test:e2e:mobile:doctor
pnpm run test:e2e:mobile

pnpm run test:load
```

## Test Ownership By Area

- `apps/api/test/`
  API integration, security, load, and smoke suites
- `apps/api/src/**/*.spec.ts`
  API unit and service tests
- `apps/web/e2e/`
  Playwright browser journeys
- `apps/web/app/**/*.test.ts(x)`
  web unit and component tests
- `apps/mobile/.maestro/`
  mobile end-to-end flows
- `apps/mobile/src/**/__tests__` and `*.test.*`
  mobile unit and integration tests

## Principles

- critical-path suites should be deterministic and easy to rerun
- manual QA checklists belong in `docs/qa/`
- test execution reports belong in `docs/archive/test-reports/`, not in the live doc path
- failures in generated reports must be translated into actionable issues or fixes, not preserved as permanent repo clutter
