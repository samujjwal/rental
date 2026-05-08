# GharBatai Rental Portal - Operations Guide

## Quick Reference

| Task | Command |
|------|---------|
| Start dev environment | `pnpm dev` or `pnpm env:start dev start` |
| Run all tests | `pnpm test` |
| Run unit tests | `pnpm test:unit` |
| Run E2E tests | `pnpm test:e2e` |
| Check coverage | `pnpm test:coverage` |
| Deploy to production | `pnpm deploy` |
| Validate build | `pnpm validate` |

---

## Environment Management

### Development Environment

**Start all services:**
```bash
pnpm dev
# or
pnpm env:start dev start
```

**Start individual services:**
```bash
pnpm dev:api      # API server only
pnpm dev:web      # Web app only
pnpm dev:mobile   # Mobile app only
```

**Stop environment:**
```bash
pnpm env:stop dev stop
```

**Restart environment:**
```bash
pnpm env:restart dev restart
```

**Check status:**
```bash
pnpm env:status dev status
```

**View logs:**
```bash
pnpm env:logs dev logs
```

### Test Environment

**Start test environment:**
```bash
pnpm env:start test start
```

**Run tests against test environment:**
```bash
pnpm test
```

**Stop test environment:**
```bash
pnpm env:stop test stop
```

### Production Environment

**⚠️ Production operations require elevated privileges**

**Deploy to production:**
```bash
pnpm deploy
# or
sudo ./scripts/deploy/deploy.sh production
```

**Create backup:**
```bash
pnpm backup
# or
./scripts/backup/backup.sh production
```

---

## Testing Guide

### Test Types Overview

| Test Type | Purpose | Speed | Command |
|-----------|---------|-------|---------|
| Unit | Test individual functions/classes | Fast (~1-2 min) | `pnpm test:unit` |
| Integration | Test module interactions | Medium (~5-10 min) | `pnpm test:integration` |
| E2E | Test full user workflows | Slow (~15-30 min) | `pnpm test:e2e` |
| Coverage | Measure code coverage | Medium (~10 min) | `pnpm test:coverage` |
| Security | Security vulnerability scan | Medium (~5 min) | `pnpm test:security` |
| Performance | Load/stress testing | Slow (~30+ min) | `pnpm test:performance` |

### Running Unit Tests

**All unit tests:**
```bash
pnpm test:unit
```

**With watch mode (auto-reload):**
```bash
pnpm test:unit dev --watch
```

**With verbose output:**
```bash
pnpm test:unit dev --verbose
```

**Specific test file:**
```bash
./scripts/test/run-tests.sh unit test --testPathPattern=bookings.service.spec.ts
```

### Running Integration Tests

**All integration tests:**
```bash
pnpm test:integration
```

**Specific integration test:**
```bash
./scripts/test/run-tests.sh integration test --testPathPattern=stripe.integration-spec.ts
```

### Running E2E Tests

**All E2E tests:**
```bash
pnpm test:e2e
```

**E2E with verbose output:**
```bash
pnpm test:verbose
```

**E2E in watch mode:**
```bash
pnpm test:watch
```

**Specific E2E test file:**
```bash
./scripts/test/run-e2e.sh --grep="booking-flow"
```

### Coverage Testing

**Quick coverage check:**
```bash
pnpm test:coverage:fast
```

**Full coverage report:**
```bash
pnpm test:coverage
```

**Comprehensive 100% coverage test:**
```bash
pnpm test:coverage:full
```

**View coverage report:**
```bash
# After running coverage, open in browser
open apps/api/test/coverage/lcov-report/index.html
```

### Security Testing

**Run security audit:**
```bash
pnpm test:security
# or
pnpm audit:security
```

### Performance Testing

**Run all performance tests:**
```bash
pnpm test:performance
```

**Run specific performance suite:**
```bash
# API load tests
./scripts/test/run-performance-tests.sh api

# Stress tests
./scripts/test/run-performance-tests.sh stress

# Spike tests
./scripts/test/run-performance-tests.sh spike
```

**Run with custom duration:**
```bash
DURATION=5m ./scripts/test/run-performance-tests.sh api
```

### Running All Tests

**Complete test suite:**
```bash
pnpm test:all
```

This runs: Unit → Integration → E2E → Coverage → Security

---

## Code Quality

**Check code style:**
```bash
pnpm lint
```

**Check architecture rules:**
```bash
pnpm arch-lint
```

**Check for circular dependencies:**
```bash
pnpm check-circular
```

**Generate dependency graph:**
```bash
pnpm check-deps
```

### Type Checking

**TypeScript validation:**
```bash
pnpm typecheck
```

### Module Bootstrap Validation

**Test application can bootstrap successfully:**
```bash
pnpm --filter @rental-portal/api test -- --testPathPatterns module-bootstrap
```

This test catches:
- Circular dependencies
- Missing providers
- Invalid constructor signatures
- Module resolution errors

### Formatting

**Format all code:**
```bash
pnpm format
```

**Check formatting without changes:**
```bash
pnpm format:check
```

### Pre-commit Validation

**Run all guardrails:**
```bash
pnpm guardrails
```

This runs:
- Category schema duplication check
- Controller-Prisma boundary check
- Enum drift check
- Marketplace boundary check
- Schema domain governance check

---

## Database Operations

### Generate Prisma Client

After schema changes:
```bash
pnpm db:generate
```

### Run Migrations

**Apply migrations:**
```bash
pnpm db:migrate
```

**View migration status:**
```bash
pnpm --filter @rental-portal/database run migrate:status
```

### Open Prisma Studio

**GUI for database inspection:**
```bash
pnpm db:studio
```

### Seed Database

**Populate with test data:**
```bash
pnpm db:seed
```

**Seed specific environment:**
```bash
ENVIRONMENT=test pnpm db:seed
```

---

## Build & Validation

### Build All Applications

**Production build:**
```bash
pnpm build
```

### Validate Build

**Run full validation:**
```bash
pnpm validate
```

This checks:
- Node.js version
- Dependencies
- TypeScript compilation
- Build success
- Test execution

---

## Deployment Guide

### Pre-Deployment Checklist

1. **Validate build:**
   ```bash
   pnpm validate
   ```

2. **Run all tests:**
   ```bash
   pnpm test:all
   ```

3. **Check security:**
   ```bash
   pnpm test:security
   ```

4. **Run guardrails:**
   ```bash
   pnpm guardrails
   ```

### Deploy to Production

```bash
pnpm deploy
```

This will:
- Create backup
- Run migrations
- Deploy new version
- Verify health checks
- Rollback on failure

### Deploy to MVP Environment

```bash
pnpm deploy:mvp
```

### Manual Deployment Steps

If automatic deployment fails:

1. **Create backup:**
   ```bash
   pnpm backup
   ```

2. **SSH to server:**
   ```bash
   ssh user@production-server
   ```

3. **Pull latest code:**
   ```bash
   cd /var/www/rental
   git pull origin main
   ```

4. **Install dependencies:**
   ```bash
   pnpm install --frozen-lockfile
   ```

5. **Run migrations:**
   ```bash
   pnpm db:migrate
   ```

6. **Build:**
   ```bash
   pnpm build
   ```

7. **Restart services:**
   ```bash
   pnpm env:restart prod restart
   ```

---

## Troubleshooting

### Port Conflicts

If you see "Port already in use":

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev:api
```

### Database Connection Issues

```bash
# Reset database connection
pnpm env:stop dev stop
pnpm db:generate
pnpm env:start dev start
```

### Test Failures

**Reset test environment:**
```bash
pnpm env:restart test restart
pnpm test
```

**Run tests with debug output:**
```bash
DEBUG=true pnpm test:verbose
```

### Clean Everything

```bash
# Stop all environments
pnpm env:stop dev stop
pnpm env:stop test stop

# Clean build artifacts
pnpm clean

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Regenerate Prisma client
pnpm db:generate
```

---

## Environment Variables

### Required Variables

Create `.env` files in:
- `/apps/api/.env`
- `/apps/web/.env`
- `/packages/database/.env`

### Common Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/rental"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API
API_PORT=3000
API_URL=http://localhost:3000
JWT_SECRET=your-secret-key

# Stripe (test mode for dev/test)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email
RESEND_API_KEY=re_...

# SMS
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
```

---

## Script Reference

### Root-Level Scripts

| Script | Purpose |
|--------|---------|
| `setup-env.sh` | Initial environment setup |
| `validate-build.sh` | Build validation |

### scripts/ Directory

| Category | Scripts |
|----------|---------|
| `scripts/ci/` | CI guardrails and checks |
| `scripts/test/` | Test runners (unit, integration, e2e, coverage, performance, security) |
| `scripts/deploy/` | Deployment automation |
| `scripts/backup/` | Backup automation |
| `scripts/env/` | Environment management |
| `scripts/setup/` | Server setup |
| `scripts/lib/` | Shared configuration library |

---

## CI/CD Integration

### GitHub Actions

The project includes workflows in `.github/workflows/`:
- `ci.yml` - Continuous Integration
- `chaos-engineering-weekly.yml` - Weekly chaos tests

### Running CI Locally

```bash
# Run all CI checks
pnpm guardrails

# Individual checks
./scripts/ci/check-category-schema-duplication.sh
./scripts/ci/check-controller-prisma.sh
./scripts/ci/check-enum-drift.sh
./scripts/ci/check-marketplace-boundaries.sh
./scripts/ci/check-schema-domain-governance.sh
```

---

## Best Practices

### Development Workflow

1. Start dev environment: `pnpm dev`
2. Make changes
3. Run unit tests: `pnpm test:unit`
4. Check types: `pnpm typecheck`
5. Run lint: `pnpm lint`
6. Commit changes

### Pre-Commit Checklist

- [ ] Code compiles without errors (`pnpm typecheck`)
- [ ] Tests pass (`pnpm test:unit`)
- [ ] Linting passes (`pnpm lint`)
- [ ] No secrets committed
- [ ] Meaningful commit message

### Testing Strategy

- **Unit tests**: Run frequently during development
- **Integration tests**: Run before pushing changes
- **E2E tests**: Run before major releases
- **Coverage**: Check weekly to maintain 95%+
- **Security**: Run before any deployment

---

## Support

For issues or questions:
1. Check this guide
2. Review `SCRIPTS_CLEANUP.md`
3. Check `scripts/README.md`
4. Review test output with `--verbose` flag
5. Check environment logs: `pnpm env:logs dev logs`
