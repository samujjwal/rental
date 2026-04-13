# Test Reclassification Guide

## Overview

This document provides guidance on reclassifying tests from the E2E directory to their appropriate test tiers.

## Test Tier Definitions

### Unit Tests
- **Location**: `/apps/api/src/**/*.spec.ts`
- **Scope**: Single function/class in isolation
- **Dependencies**: Mocked
- **Speed**: Fast (<100ms per test)

### Integration Tests
- **Location**: `/apps/api/test/integration/*.integration-spec.ts`
- **Scope**: Multiple modules working together
- **Dependencies**: Real (database, cache, external APIs in test mode)

### API E2E Tests
- **Location**: `/apps/api/test/*.e2e-spec.ts`
- **Scope**: Full HTTP request/response cycle
- **Dependencies**: Complete application stack

## Files to Reclassify

### Move to Integration Tests
- `cache-integration.e2e-spec.ts` → `integration/cache-layer.integration-spec.ts`
- `email-sms-provider-integration.e2e-spec.ts` → `integration/`

### Keep as E2E Tests
- `auth.e2e-spec.ts`
- `booking-lifecycle-complete.e2e-spec.ts`
- `complete-user-journeys.e2e-spec.ts`

## Verification Checklist

- [ ] Moved tests still pass after relocation
- [ ] Imports updated correctly
- [ ] Test coverage not reduced
- [ ] CI pipeline updated
- [ ] Documentation updated
