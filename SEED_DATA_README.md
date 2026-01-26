# Database Seed Documentation

## Overview
This seed script populates the database with comprehensive test data for development and testing purposes.

## Test Users

All test users have the password: **password123**

### Admin User (Auto-login enabled)
- **Email**: admin@rental.local
- **Role**: ADMIN
- **Access**: Full platform administration
- **Auto-login**: Yes (in development mode)

### Support User
- **Email**: support@rental.local
- **Role**: SUPPORT
- **Access**: Customer support tools

### Owner Users

#### John Smith (Camera Equipment Owner)
- **Email**: john.owner@rental.local
- **Role**: OWNER
- **Location**: Los Angeles, CA
- **Listings**: 2 professional camera setups
- **Rating**: 4.8 stars (24 reviews)
- **Stripe**: Connected and verified

#### Emily Johnson (Tools & Equipment Owner)
- **Email**: emily.tools@rental.local
- **Role**: OWNER
- **Location**: Seattle, WA
- **Listings**: 3 tool and camping equipment items
- **Rating**: 4.9 stars (42 reviews)
- **Stripe**: Connected and verified

### Customer Users

#### Mike Davis
- **Email**: mike.customer@rental.local
- **Role**: CUSTOMER
- **Location**: Portland, OR
- **Bookings**: 2 (1 completed, 1 pending)
- **Rating**: 4.7 stars (8 reviews)
- **Stripe**: Has saved payment methods

#### Lisa Anderson
- **Email**: lisa.renter@rental.local
- **Role**: CUSTOMER
- **Location**: Austin, TX
- **Bookings**: 1 active booking
- **Rating**: 5.0 stars (12 reviews)
- **Stripe**: Has saved payment methods

## Seeded Data

### Categories (5)
1. Tools & Equipment
2. Camera & Photography
3. Outdoor & Camping
4. Party & Events
5. Electronics

### Listings (5)
1. **Canon EOS R5** - $150/day (Owner: John Smith)
2. **Sony A7 IV + Lens Kit** - $180/day (Owner: John Smith)
3. **DeWalt Drill Kit** - $35/day (Owner: Emily Johnson)
4. **Milwaukee Table Saw** - $55/day (Owner: Emily Johnson)
5. **4-Person Camping Tent** - $25/day (Owner: Emily Johnson)

### Bookings (3)
1. **Completed**: Mike rented Canon EOS R5 (Jan 10-15, 2024)
2. **Active**: Lisa rented DeWalt Drill Kit (Tomorrow - Next Week)
3. **Pending**: Mike requested Milwaukee Table Saw (2 weeks from now)

### Reviews (2)
- Mike → John: 5 stars for Canon EOS R5 rental
- John → Mike: 5 stars for being a great renter

## Running the Seed

The seed runs automatically when you start the development environment:

```bash
./run-dev.sh
```

Or manually:

```bash
cd packages/database
npm run seed
```

## Accessing Portals

After seeding, you can access:

- **Customer Portal**: http://localhost:3401
- **Admin Portal**: http://localhost:3401/admin
- **API Documentation**: http://localhost:3400/api/docs

## Development Features

### Auto-Login (Development Only)
The admin user has an auto-login session created for quick testing. Simply navigate to the admin portal and you'll be logged in automatically.

### Quick Login Switcher
On the homepage in development mode, you'll see a yellow "DEV" panel in the bottom-left corner. Click any user to instantly log in as that user for testing different roles and permissions.

### Portal Links
The dev panel also includes quick links to:
- Customer Portal (main app)
- Admin Portal

## Resetting Data

To reset and re-seed the database:

```bash
cd packages/database
npx prisma migrate reset
```

This will:
1. Drop the database
2. Recreate it
3. Run all migrations
4. Run the seed script automatically

## Notes

- All seeded data uses realistic but fake information
- Stripe IDs are test values (prefixed with `acct_test_` or `cus_test_`)
- Images use Unsplash URLs for realistic product photos
- Dates for bookings are relative to the current date
- The seed is idempotent - it clears existing data before seeding
