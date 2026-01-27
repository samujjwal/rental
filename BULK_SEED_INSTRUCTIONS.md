# Bulk Seed Data Instructions

## Overview

Run the bulk seed script to generate 100+ records for each major table (except small reference tables like Categories/Roles). This is ideal for development and testing to ensure admin tables have sufficient data for pagination, filtering, and performance testing.

## Generated Data Volumes

- **Users**: 150 (3 admins, 30 owners, 117 customers)
- **Organizations**: 25
- **Categories**: 5 (reference table)
- **Listings**: 200
- **Bookings**: 300
- **Payments**: 250
- **Reviews**: 400
- **Messages**: 300 (100 conversations × 3 messages)
- **Favorites**: 180
- **Insurance Policies**: 120

## How to Run

### Option 1: Use the provided bulk seed script (Recommended)

```bash
cd packages/database
npx tsx prisma/seed-minimal.ts
```

### Option 2: Replace the default seed

If you want this to run automatically with `npm run db:seed`:

```bash
cd packages/database
mv prisma/seed.ts prisma/seed-original.ts
mv prisma/seed-minimal.ts prisma/seed.ts
npm run db:seed
```

### Option 3: Run via root package.json

```bash
# From project root
npm run db:seed
```

## Admin Login

After seeding, you can log in to the admin portal:

- **Email**: admin1@rental.local
- **Password**: password123

## Notes

- All passwords are `password123`
- Data is randomly generated but realistic
- Stripe IDs are test values (prefixed with `acct_test_`/`cus_test_`)
- Images use Unsplash URLs
- Dates are relative to 2024 for consistency
- The seed script clears existing data before seeding
- Script handles unique constraints to avoid duplicate errors

## Resetting Data

To completely reset and re-seed:

```bash
cd packages/database
npx prisma migrate reset
```
