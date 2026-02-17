# E2E Test Database Setup

## Problem

E2E tests are failing because test users don't exist in the database. The tests expect:

- **Renter**: `renter@test.com` / `Test123!@#`
- **Owner**: `owner@test.com` / `Test123!@#`
- **Admin**: `admin@test.com` / `Test123!@#`

## Solution Options

### Option 1: Seed Test Database (Recommended)

Create test users in your database before running E2E tests.

#### Using Prisma Seed

1. Check if seed script exists:
```bash
cd apps/api
cat prisma/seed.ts
```

2. If it exists and includes test users, run:
```bash
cd apps/api
pnpm prisma db seed
```

3. If it doesn't have test users, add them to the seed script.

#### Manual Database Seeding

If you need to add test users manually:

```bash
cd apps/api
# Open Prisma Studio
pnpm prisma studio

# Or use psql/your database client to insert:
# - renter@test.com (password: Test123!@#, role: renter)
# - owner@test.com (password: Test123!@#, role: owner)
# - admin@test.com (password: Test123!@#, role: admin)
```

### Option 2: Use Existing Users

If you already have test users with different credentials:

1. Update [e2e/helpers/fixtures.ts](../e2e/helpers/fixtures.ts):

```typescript
export const testUsers: Record<string, TestUser> = {
  renter: {
    email: "your-renter-email@example.com",  // Change this
    password: "your-renter-password",         // Change this
    // ... rest stays same
  },
  owner: {
    email: "your-owner-email@example.com",    // Change this
    password: "your-owner-password",           // Change this
    // ... rest stays same
  },
  // ...
};
```

### Option 3: Create Test Database

Set up a separate test database that gets seeded before each test run:

```bash
# In apps/api/.env.test
DATABASE_URL="postgresql://user:password@localhost:5432/rental_test"

# Run migrations and seed
cd apps/api
DATABASE_URL=$DATABASE_URL pnpm prisma migrate deploy
DATABASE_URL=$DATABASE_URL pnpm prisma db seed
```

## Current Test Status

### Passing Tests ✅
- Home page loads
- Login page displays
- Listings page loads
- Search page loads  
- API endpoints are accessible

### Failing Tests ❌
- **User login tests** - Users don't exist in database
- **Dashboard tests** - Skipped (depend on login)
- **Admin tests** - Skipped (admin user doesn't exist)

### Skipped Tests ⏭️
- All admin-flows tests (405 tests)
- Dashboard load tests (2 tests)

## Next Steps

1. **Seed the database** with test users using one of the options above
2. **Run smoke tests** to verify login works:
   ```bash
   cd apps/web
   pnpm e2e smoke.spec.ts --project=chromium --workers=1
   ```

3. **Run comprehensive tests** once smoke tests pass:
   ```bash
   # Form validation
   pnpm e2e comprehensive-form-validation --workers=2
   
   # User journeys
   pnpm e2e comprehensive-user-journeys --workers=1
   
   # Edge cases
   pnpm e2e comprehensive-edge-cases --workers=2
   ```

## Test Data Requirements

The E2E tests need:

- **3 test users** (renter, owner, admin) with known credentials
- **Test listings** (created dynamically during tests)
- **Test bookings** (created dynam during tests)
- **Clean state** between test runs (or use test isolation)

## Troubleshooting

### Tests timeout on login

**Cause**: User credentials don't match database
**Fix**: Update fixtures.ts or seed database

### "Invalid credentials" errors

**Cause**: Password hashing mismatch
**Fix**: Ensure seed script uses same hashing as auth system

### Tests pass locally but fail in CI

**Cause**: CI database not seeded
**Fix**: Add seed step to CI workflow

```yaml
# .github/workflows/e2e.yml
- name: Seed test database
  run: |
    cd apps/api
    pnpm prisma db seed
```

## Running Tests Without Database

Some tests can run without requiring authentication:

```bash
# Public pages only
pnpm e2e --grep "should load" --project=chromium

# Form validation (UI-only tests)
pnpm e2e comprehensive-form-validation --grep "empty" --workers=2
```
