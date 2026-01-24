# Universal Rental Portal

A production-ready, multi-category rental marketplace platform supporting spaces, vehicles, instruments, event venues, event items, and wearables.

## 🏗️ Architecture

This is a monorepo managed by Turbo, containing:

- **apps/api**: NestJS backend API
- **apps/web**: React Router v7 web application (coming soon)
- **apps/mobile**: React Native mobile app (coming soon)
- **packages/database**: Prisma database schema and client

## 🚀 Tech Stack

- **Backend**: NestJS, TypeScript, Prisma, PostgreSQL, Redis, Elasticsearch
- **Web**: React Router v7 (Framework Mode), TailwindCSS
- **Mobile**: React Native, Expo
- **Infrastructure**: AWS (ECS, RDS, ElastiCache, CloudFront), Terraform
- **Payments**: Stripe Connect
- **Real-time**: Socket.io with Redis adapter

## 📋 Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 15
- Redis >= 7
- Elasticsearch >= 8 (optional for search features)

## 🔧 Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd gharbatai-rentals
npm install
```

### 2. Set up Database

```bash
# Create PostgreSQL database
createdb rental_portal

# Copy environment file
cd packages/database
cp .env.example .env

# Edit .env with your database URL
DATABASE_URL="postgresql://user:password@localhost:5432/rental_portal"

# Generate Prisma client and run migrations
npm run db:generate
npm run migrate:dev
```

### 3. Configure API

```bash
cd apps/api
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start Development Servers

```bash
# From root directory
npm run dev
```

This will start:

- API server on http://localhost:3000
- API docs on http://localhost:3000/api/docs

## 📚 API Documentation

Interactive API documentation is available at `/api/docs` when running in development mode.

### Authentication Endpoints

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/mfa/enable` - Enable MFA
- `POST /api/v1/auth/mfa/verify` - Verify and activate MFA

### User Endpoints

- `GET /api/v1/users/me` - Get current user profile
- `PATCH /api/v1/users/me` - Update profile
- `GET /api/v1/users/me/stats` - Get user statistics
- `GET /api/v1/users/:id` - Get public user profile

### Category Endpoints

- `GET /api/v1/categories` - Get all categories
- `GET /api/v1/categories/:id` - Get category by ID
- `GET /api/v1/categories/slug/:slug` - Get category by slug
- `GET /api/v1/categories/:id/template` - Get category template schema
- `GET /api/v1/categories/:id/stats` - Get category statistics

## 🗂️ Project Structure

```
gharbatai-rentals/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── common/         # Shared utilities
│   │   │   │   ├── cache/      # Redis caching service
│   │   │   │   ├── prisma/     # Prisma service
│   │   │   │   └── queue/      # BullMQ queue management
│   │   │   ├── config/         # Configuration
│   │   │   ├── modules/        # Feature modules
│   │   │   │   ├── auth/       # Authentication & authorization
│   │   │   │   ├── users/      # User management
│   │   │   │   ├── categories/ # Category & template system
│   │   │   │   ├── listings/   # Listing management (coming)
│   │   │   │   ├── bookings/   # Booking state machine (coming)
│   │   │   │   ├── payments/   # Stripe integration (coming)
│   │   │   │   ├── search/     # Elasticsearch search (coming)
│   │   │   │   ├── messaging/  # Real-time messaging (coming)
│   │   │   │   ├── reviews/    # Reviews & ratings (coming)
│   │   │   │   ├── fulfillment/# Condition reports (coming)
│   │   │   │   ├── disputes/   # Dispute resolution (coming)
│   │   │   │   ├── notifications/ # Notifications (coming)
│   │   │   │   └── admin/      # Admin operations (coming)
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   └── package.json
│   ├── web/                    # React Router v7 app (coming)
│   └── mobile/                 # React Native app (coming)
├── packages/
│   └── database/               # Prisma schema & migrations
│       ├── prisma/
│       │   └── schema.prisma   # Complete database schema
│       └── src/
│           └── index.ts
├── infrastructure/             # Terraform IaC (coming)
├── package.json
├── turbo.json
└── README.md
```

## 🎯 Features

### ✅ Completed

- [x] Project structure and monorepo setup
- [x] Complete Prisma database schema (70+ models)
- [x] NestJS backend foundation
- [x] JWT authentication with refresh tokens
- [x] Multi-factor authentication (MFA/2FA)
- [x] Session management
- [x] Password reset flow
- [x] User management
- [x] Role-based access control (RBAC)
- [x] Redis caching layer
- [x] Dynamic category template system
- [x] Category management
- [x] API documentation with Swagger

### 🚧 In Progress

- [ ] Listing management module
- [ ] Booking state machine (12 states)
- [ ] Stripe Connect payment integration
- [ ] Elasticsearch search & discovery
- [ ] Real-time messaging (Socket.io)
- [ ] Condition reports & fulfillment
- [ ] Dispute resolution system
- [ ] Review & rating system
- [ ] Notification system
- [ ] Admin dashboard
- [ ] React Router v7 web app
- [ ] React Native mobile app
- [ ] Background job processing
- [ ] Email service integration
- [ ] AWS infrastructure (Terraform)
- [ ] Monitoring & observability
- [ ] Comprehensive testing suite
- [ ] CI/CD pipeline

## 🔐 Security Features

- JWT-based authentication with secure refresh tokens
- Password hashing with bcrypt (configurable rounds)
- Multi-factor authentication (TOTP)
- Rate limiting on sensitive endpoints
- Helmet.js security headers
- CORS configuration
- SQL injection prevention (Prisma)
- XSS protection
- Session management with Redis
- Audit logging

## 📦 Database Schema

The database schema includes 70+ models covering:

- **Users & Authentication**: Users, Sessions, Organizations
- **Categories & Templates**: Dynamic category schemas
- **Listings**: Multi-category listings with custom fields
- **Bookings**: Complete booking lifecycle (12 states)
- **Payments**: Double-entry ledger, deposits, refunds, payouts
- **Reviews**: Bidirectional reviews (listing, renter, owner)
- **Messaging**: Real-time conversations with privacy controls
- **Fulfillment**: Check-in/check-out condition reports
- **Disputes**: Resolution system with evidence tracking
- **Notifications**: Multi-channel notifications
- **Audit Logs**: Complete activity tracking

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🚀 Deployment

### Production Build

```bash
npm run build
```

### Docker

```bash
# Build
docker build -t rental-portal-api ./apps/api

# Run
docker run -p 3000:3000 rental-portal-api
```

### AWS Deployment

Infrastructure as Code with Terraform (coming soon):

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

## 📝 Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `STRIPE_SECRET_KEY`: Stripe API key

### Optional

- `ELASTICSEARCH_NODE`: Elasticsearch connection
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: AWS credentials
- `SENDGRID_API_KEY`: Email service API key

See `.env.example` files for complete list.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For questions and support, please open an issue on GitHub.

---

**Status**: 🚧 Active Development

This is a production-grade implementation of a universal rental marketplace. The project follows industry best practices and is being built incrementally with full test coverage and documentation.
