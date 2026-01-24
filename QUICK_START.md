# 🚀 Quick Start Guide

## Prerequisites

- Node.js 22+
- PostgreSQL 15+
- Redis 7+
- Stripe account (for payments)

## Installation Steps

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install workspace dependencies
cd packages/database && npm install
cd ../../apps/api && npm install
```

### 2. Environment Setup

Create `.env` file in `apps/api/`:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/rental_portal"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6382
REDIS_PASSWORD=
REDIS_TTL=3600

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PLATFORM_FEE_PERCENTAGE=15

# AWS S3 (for photo uploads)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=rental-portal-uploads

# Email (SendGrid)
EMAIL_FROM=noreply@rentalportal.com
SENDGRID_API_KEY=your_sendgrid_api_key

# Frontend
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:3001

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=

# Security
BCRYPT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT=100
```

### 3. Database Setup

```bash
# Generate Prisma Client
cd packages/database
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Seed database
npx prisma db seed
```

### 4. Start Services

#### Development Mode:

```bash
# Terminal 1 - Start PostgreSQL
# (varies by OS)

# Terminal 2 - Start Redis
redis-server

# Terminal 3 - Start API server
cd apps/api
npm run start:dev
```

The API will be available at `http://localhost:3000`

#### Swagger Documentation:

Visit `http://localhost:3000/api/docs` for interactive API documentation

## 📦 Available Scripts

### Root Level:

- `npm run build` - Build all packages
- `npm run dev` - Start development mode (Turbo)
- `npm run lint` - Lint all packages
- `npm run format` - Format code with Prettier

### API (`apps/api`):

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start with debugger
- `npm run build` - Build for production
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run E2E tests

### Database (`packages/database`):

- `npx prisma studio` - Open Prisma Studio (DB GUI)
- `npx prisma migrate dev` - Create new migration
- `npx prisma migrate reset` - Reset database
- `npx prisma generate` - Generate Prisma Client
- `npx prisma db seed` - Seed database

## 🧪 Testing

### Unit Tests:

```bash
cd apps/api
npm run test
```

### E2E Tests:

```bash
cd apps/api
npm run test:e2e
```

### Coverage:

```bash
cd apps/api
npm run test:cov
```

## 🔍 Troubleshooting

### Error: Cannot find module '@nestjs/common'

```bash
cd apps/api
npm install
```

### Error: Prisma Client not generated

```bash
cd packages/database
npx prisma generate
```

### Error: Database connection failed

- Check PostgreSQL is running
- Verify DATABASE_URL in `.env`
- Ensure database exists

### Error: Redis connection failed

- Check Redis is running: `redis-cli ping` (should return PONG)
- Verify REDIS_HOST and REDIS_PORT

### Error: Stripe webhook validation failed

- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/payments/webhook`
- Copy webhook secret to STRIPE_WEBHOOK_SECRET

## 📚 API Endpoints

### Authentication (`/api/v1/auth`)

- POST `/register` - Register new user
- POST `/login` - Login
- POST `/refresh` - Refresh tokens
- POST `/logout` - Logout current session
- POST `/logout-all` - Logout all sessions
- GET `/me` - Get current user
- POST `/password/reset-request` - Request password reset
- POST `/password/reset` - Reset password
- POST `/password/change` - Change password
- POST `/mfa/enable` - Enable MFA
- POST `/mfa/verify` - Verify MFA code
- POST `/mfa/disable` - Disable MFA

### Users (`/api/v1/users`)

- GET `/me` - Get current user profile
- PATCH `/me` - Update profile
- GET `/me/stats` - Get user statistics
- GET `/:id` - Get public profile

### Categories (`/api/v1/categories`)

- GET `/categories` - List all categories
- GET `/categories/templates` - Get all category templates
- GET `/:id` - Get category details
- GET `/:id/template` - Get category template
- POST `/` - Create category (admin)
- PATCH `/:id` - Update category (admin)
- DELETE `/:id` - Delete category (admin)

### Listings (`/api/v1/listings`)

- POST `/` - Create listing
- GET `/` - Search listings
- GET `/my-listings` - Get user's listings
- GET `/:id` - Get listing details
- PATCH `/:id` - Update listing
- DELETE `/:id` - Archive listing
- POST `/:id/publish` - Publish listing
- POST `/:id/pause` - Pause listing
- POST `/:id/activate` - Activate listing
- GET `/:id/stats` - Get listing stats
- POST `/:id/availability` - Create availability rule
- GET `/:id/availability` - Get availability
- POST `/:id/check-availability` - Check if available

### Bookings (`/api/v1/bookings`)

- POST `/` - Create booking
- GET `/my-bookings` - Get bookings as renter
- GET `/host-bookings` - Get bookings as host
- GET `/:id` - Get booking details
- POST `/:id/approve` - Approve booking (host)
- POST `/:id/reject` - Reject booking (host)
- POST `/:id/cancel` - Cancel booking
- POST `/:id/start` - Start rental
- POST `/:id/request-return` - Request return inspection
- POST `/:id/approve-return` - Approve return (host)
- POST `/:id/dispute` - Initiate dispute
- GET `/:id/stats` - Get booking timeline
- POST `/calculate-price` - Calculate booking price

### Payments (`/api/v1/payments`)

- POST `/connect/onboard` - Start Stripe Connect onboarding
- GET `/connect/status` - Get Connect account status
- POST `/intents/:bookingId` - Create payment intent
- POST `/deposit/hold/:bookingId` - Hold security deposit
- POST `/deposit/release/:depositId` - Release deposit
- POST `/customer` - Create Stripe customer
- GET `/methods` - Get payment methods
- POST `/methods/attach` - Attach payment method
- POST `/payouts` - Request payout
- GET `/payouts` - Get payout history
- GET `/earnings` - Get pending earnings
- GET `/balance` - Get account balance
- GET `/ledger/booking/:bookingId` - Get booking ledger
- POST `/webhook` - Stripe webhook endpoint

## 🎯 Next Steps

1. **Implement Search Module** - Elasticsearch integration
2. **Implement Messaging** - Socket.io real-time chat
3. **Implement Reviews** - Bidirectional review system
4. **Implement Notifications** - Email/SMS/Push notifications
5. **Add Tests** - Unit and E2E test coverage
6. **Build Frontend** - React Router v7 web app
7. **Build Mobile Apps** - React Native iOS/Android
8. **Deploy Infrastructure** - AWS with Terraform
9. **Setup CI/CD** - GitHub Actions pipelines

## 📖 Documentation

- **Architecture:** See [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
- **Progress:** See [PROGRESS_REPORT.md](./PROGRESS_REPORT.md)
- **API Docs:** Visit `/api/docs` when running
- **Execution Plans:** See EXECUTION*PLAN*\*.md files

## 🤝 Support

For issues or questions, refer to the documentation or check the codebase comments.
