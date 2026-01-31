# Development Environment Setup - Complete Guide

## Quick Start

```bash
./run-dev.sh
```

This single command will:

1. ✅ Start all infrastructure (PostgreSQL, Redis, Elasticsearch)
2. ✅ Wait for database to be ready
3. ✅ Run database migrations
4. ✅ Seed comprehensive test data
5. ✅ Start API and Web applications

## Access Points

### Customer Portal

**URL**: http://localhost:3401

- Browse listings
- Make bookings
- View dashboard
- Manage profile

### Admin Portal

**URL**: http://localhost:3401/admin

- User management
- Listing moderation
- Dispute resolution
- Analytics dashboard

### API Backend

**URL**: http://localhost:3400
**Documentation**: http://localhost:3400/api/docs

## Test Users (Password: password123)

### 👨‍💼 Admin User

```
Email: admin@rental.local
Role: ADMIN
Features: Auto-login enabled in dev mode
```

### 👩‍💼 Support User

```
Email: support@rental.local
Role: SUPPORT
```

### 👔 Owners

```
John (Camera Equipment):
  Email: john.owner@rental.local
  Listings: 2 professional cameras
  Rating: 4.8 ⭐

Emily (Tools & Camping):
  Email: emily.tools@rental.local
  Listings: 3 tools/camping items
  Rating: 4.9 ⭐
```

### 👤 Customers

```
Mike:
  Email: mike.customer@rental.local
  Bookings: 2 (1 completed, 1 pending)
  Rating: 4.7 ⭐

Lisa:
  Email: lisa.renter@rental.local
  Bookings: 1 active
  Rating: 5.0 ⭐
```

## Development Features

### 🎯 Quick Login Switcher

In development mode, the homepage shows a yellow "DEV" panel at the bottom-left corner with:

- One-click login for all test users
- Quick links to Customer and Admin portals
- Visual role indicators (Admin, Support, Owner, Customer)

### 🔐 Auto-Login for Admin

The admin user is automatically logged in when you start the development server. Just navigate to `/admin` and you're in!

### 📊 Seeded Data

- **6 Users** (1 admin, 1 support, 2 owners, 2 customers)
- **5 Categories** (Tools, Camera, Outdoor, Party, Electronics)
- **5 Listings** (Mix of cameras, tools, and camping gear)
- **3 Bookings** (Completed, active, and pending)
- **2 Reviews** (With realistic ratings and comments)

## Database Management

### View Data

```bash
cd packages/database
npm run studio
```

Opens Prisma Studio at http://localhost:5555

### Reset & Reseed

```bash
cd packages/database
npx prisma migrate reset
```

This will drop, recreate, migrate, and reseed automatically.

### Manual Seed

```bash
cd packages/database
npm run seed
```

## Infrastructure Services

### PostgreSQL

- **Port**: 3432
- **Database**: rental_portal
- **User**: rental_user
- **Password**: rental_password

### Redis

- **Port**: 3479
- **No password** (development)

### Elasticsearch

- **Port**: 9200
- **No security** (development)

## Project Structure

```
rental/
├── apps/
│   ├── api/          # NestJS backend API
│   └── web/          # React Router v7 frontend
├── packages/
│   └── database/     # Prisma schema and migrations
├── run-dev.sh        # Main development startup script
└── docker-compose.dev.yml  # Infrastructure services
```

## Common Tasks

### Start Everything

```bash
./run-dev.sh
```

### Stop Everything

Press `Ctrl+C` in the terminal running run-dev.sh, or:

```bash
docker compose -f docker-compose.dev.yml down
```

### View Logs

```bash
# API logs
cd apps/api && npm run dev

# Web logs
cd apps/web && npm run dev

# Docker logs
docker compose -f docker-compose.dev.yml logs -f
```

### Clean Start

```bash
# Stop and remove containers
docker compose -f docker-compose.dev.yml down -v

# Start fresh
./run-dev.sh
```

## Testing Different User Roles

### As Admin

1. Click "Admin" in the dev switcher panel
2. Navigate to http://localhost:3401/admin
3. Access all administrative features

### As Owner

1. Click "John (Owner)" or "Emily (Owner)" in dev switcher
2. Navigate to dashboard to see your listings
3. Manage bookings and respond to requests

### As Customer

1. Click "Mike (Customer)" or "Lisa (Customer)"
2. Browse listings at http://localhost:3401/search
3. Make bookings and leave reviews

## API Testing

### Swagger UI

Visit http://localhost:3400/api/docs for interactive API documentation

### Authentication

```bash
# Login
curl -X POST http://localhost:3400/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rental.local","password":"password123"}'

# Use the returned accessToken for authenticated requests
curl -X GET http://localhost:3400/api/listings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process on port 3400 (API)
lsof -ti:3400 | xargs kill -9

# Find and kill process on port 3401 (Web)
lsof -ti:3401 | xargs kill -9
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep rental-postgres

# Restart PostgreSQL
docker compose -f docker-compose.dev.yml restart postgres

# Check database logs
docker logs rental-postgres
```

### Seed Fails

```bash
# Ensure migrations are up to date
cd packages/database
npx prisma migrate dev

# Try seeding again
npm run seed
```

### Clear Node Modules

```bash
# Remove all node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules

# Reinstall
pnpm install
```

## Environment Variables

All environment variables are in the root `.env` file:

- Database connection
- JWT secrets
- Stripe keys (test mode)
- API URLs
- Email service config

See `.env.example` for all available options.

## Next Steps

- ✅ Seed data is loaded
- ✅ Both portals are accessible
- ✅ Test users are ready
- ✅ Quick login is enabled

Now you can:

1. Test the customer flow (search, book, review)
2. Test the owner flow (create listings, manage bookings)
3. Test the admin flow (moderate content, manage users)
4. Build new features with realistic data

## Documentation

- [Seed Data Details](./SEED_DATA_README.md)
- [API Documentation](./API_README.md)
- [Architecture Overview](./ARCHITECTURE_OVERVIEW.md)

---

**Happy Developing! 🚀**
