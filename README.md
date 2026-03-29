# Universal Rental Portal

A production-ready, multi-category rental marketplace platform supporting spaces, vehicles, instruments, event venues, event items, and wearables.

**Current Status:** Active development  
**Live Documentation Home:** [docs/README.md](docs/README.md)

## 📚 Documentation

- [Documentation Map](docs/README.md)
- [Product Vision](docs/product/vision.md)
- [Product Requirements](docs/product/requirements.md)
- [Feature Catalog](docs/product/features.md)
- [Developer Guide](docs/engineering/developer-guide.md)
- [Testing Guide](docs/engineering/testing.md)
- [Deployment Guide](docs/engineering/deployment.md)
- [Integrations Guide](docs/engineering/integrations.md)
- [Runbooks](docs/operations/runbooks.md)
- [SLOs](docs/operations/slo.md)
- [Consolidation Plan](docs/CONSOLIDATION_PLAN.md)

---

## 🏗️ Architecture

This is a monorepo managed by Turbo, containing:

- **apps/api**: NestJS backend API ✅ Live
- **apps/web**: React Router v7 web application 🟡 Active development
- **apps/mobile**: React Native mobile app 🟡 Live beta
- **packages/database**: Prisma database schema and client ✅ Live

## 🚀 Tech Stack

- **Backend**: NestJS, TypeScript, Prisma, PostgreSQL (pgvector), Redis
- **Search**: PostgreSQL full-text search + pgvector semantic ranking
- **Web**: React Router v7 (Framework Mode), TailwindCSS
- **Mobile**: React Native, Expo (live beta)
- **Infrastructure**: Docker (local). Cloud deployment target: serverless containers + managed DB.
- **Payments**: Stripe Connect ✅
- **Real-time**: Socket.io with Redis adapter ✅
- **Email**: Resend / SendGrid depending on path
- **SMS**: Twilio
- **Push**: Firebase Cloud Messaging
- **AI**: OpenAI-backed features where enabled

## 📋 Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0 (package manager)
- Docker & Docker Compose (for local services)
- PostgreSQL >= 15 (with pgvector extension)
- Redis >= 7

### Option 1: Using Docker (Recommended)

```bash
# 1. Clone repository
git clone <repository-url>
cd rental

# 2. Prepare local env files and install dependencies
pnpm run setup

# 3. Start services, migrate, and run API + web
pnpm run dev:full
```

**Services will be available at:**

- API: http://localhost:3400
- API Docs: http://localhost:3400/api/docs
- Web App: http://localhost:3401
- PostgreSQL: localhost:3432
- Redis: localhost:3479

### Option 2: Manual Setup

See [docs/engineering/developer-guide.md](docs/engineering/developer-guide.md) for the canonical local workflow.

### Option 3: Run Tests

```bash
# Local bootstrap
pnpm run setup
pnpm run services:up

# Workspace tests
pnpm run test
pnpm run test:coverage

# API integration and specialty suites
pnpm run test:integration
pnpm run test:security
pnpm run test:property
pnpm run test:chaos

# Web and mobile end-to-end suites
pnpm run test:e2e:web
pnpm run test:e2e:web:isolated
pnpm run test:e2e:web:isolated:core
pnpm run test:e2e:mobile

# Load tests
pnpm run test:load -- api
```

- API server on http://localhost:3000
- API docs on http://localhost:3000/api/docs

### Option 4: Run The Isolated Validation Stack

Use this path when you want deterministic local verification without disturbing the default `3400/3401` stack.

```bash
# Start the isolated API + web preview pair
pnpm run dev:isolated

# Start the isolated stack in the fail-open mode required by
# the browser-first manual booking unhappy-path lane
pnpm run dev:isolated:manual

# Faster restart when builds are already fresh
pnpm run dev:isolated:skip-build

# Faster restart for the fail-open manual lane
pnpm run dev:isolated:manual:skip-build

# Run isolated Playwright suites against the validated stack
pnpm run test:e2e:web:isolated
pnpm run test:e2e:web:isolated:core
pnpm run test:e2e:web:isolated:manual
pnpm run test:e2e:web:isolated:manual:chromium
pnpm run test:e2e:web:isolated:comprehensive
```

Default isolated ports:

- API: http://127.0.0.1:3402/api
- API health: http://127.0.0.1:3402/api/health
- Web preview: http://127.0.0.1:3403

Important notes:

- The isolated runner sets `ALLOW_DEV_LOGIN=true`, `STRIPE_TEST_BYPASS=true`, `DISABLE_THROTTLE=true`, and the local `CORS_ORIGINS` needed for the `127.0.0.1:3403 -> 3402` browser path.
- The web preview is rebuilt against `VITE_API_URL=http://127.0.0.1:3402/api` so client-side route loaders do not silently fall back to `http://localhost:3400/api`.
- You can override ports safely, for example: `API_PORT=3412 WEB_PORT=3413 pnpm run dev:isolated:skip-build`.
- For the browser-first manual Playwright lane, use `pnpm run dev:isolated:manual` or set `SAFETY_CHECKS_FAIL_OPEN=true` yourself in local or CI-like validation. The manual unhappy-path booking tests intentionally exercise decline, checkout cancellation, and payment-retry flows, and those setups are blocked by the default fail-closed compliance gate.

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
# Unit, component, and package tests
pnpm run test

# Coverage across workspaces
pnpm run test:coverage

# API integration tests
pnpm run test:integration

# Browser and device end-to-end tests
pnpm run test:e2e:web
pnpm run test:e2e:mobile

# Full local test pass
pnpm run test:all
```

## 🎯 Implementation Roadmap

### ✅ Phase 1: Core Backend (Complete)

- [x] Authentication & Authorization
- [x] User Management
- [x] Category System with Templates
- [x] Listings Management
- [x] Booking State Machine
- [x] Payment Integration (Stripe Connect)
- [x] Search & Discovery
- [x] Real-time Messaging
- [x] Dispute Resolution
- [x] Reviews & Ratings
- [x] Notifications (Multi-channel)
- [x] Insurance Management
- [x] Content Moderation
- [x] Admin Dashboard

### 🟡 Phase 2: Frontend & Testing (In Progress)

- [x] Admin portal UI
- [x] Organization management
- [x] Insurance verification
- [x] Listing creation/viewing
- [x] Search interface
- [x] Booking management
- [x] Messaging interface
- [ ] Checkout flow (pending)
- [ ] User profile pages (pending)
- [x] Unit tests (70% coverage)
- [x] E2E tests (basic flows)
- [ ] Load testing (pending)
- [ ] Security audit (pending)

### 🔜 Phase 3: External Services & Infrastructure (Next)

- [ ] Configure SendGrid email service
- [ ] Configure Twilio SMS service
- [ ] Configure Firebase push notifications
- [ ] Configure OpenAI content moderation
- [ ] Set up AWS infrastructure (Terraform)
- [ ] Deploy staging environment
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure CI/CD (GitHub Actions)

### 📱 Phase 4: Mobile App (Post-Launch)

- [ ] React Native app architecture
- [ ] Core user flows
- [ ] Camera integration for condition reports
- [ ] Push notifications
- [ ] Offline support

## 📚 Key Documentation

### Getting Started

- [README.md](README.md) - Local setup, dev, test, and deployment overview
- [BUILD_SYSTEM.md](BUILD_SYSTEM.md) - Workspace command reference

### Implementation

- [COMPREHENSIVE_QUALITY_AUDIT_REPORT.md](COMPREHENSIVE_QUALITY_AUDIT_REPORT.md) - Current codebase audit
- [RequirementsForRentalSystem.md](RequirementsForRentalSystem.md) - Product requirements
- [SEED_DATA_SUMMARY.md](SEED_DATA_SUMMARY.md) - Seeded local data overview

### Deployment

- [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) - Production deployment steps
- [EXTERNAL_SERVICES_SETUP.md](EXTERNAL_SERVICES_SETUP.md) - External service configuration

### Architecture

- [GLOBAL_POLICY_ENGINE_SPEC.md](GLOBAL_POLICY_ENGINE_SPEC.md) - Policy and domain rules
- [MOBILE_SPEC.md](MOBILE_SPEC.md) - Mobile product scope
- [MOBILE_WIREFRAMES.md](MOBILE_WIREFRAMES.md) - Mobile UX reference

### Testing

- [docs/TEST_SUITE_GUIDE.md](docs/TEST_SUITE_GUIDE.md) - Test commands and suite coverage
- [COMPREHENSIVE_TESTING_CHECKLIST.md](COMPREHENSIVE_TESTING_CHECKLIST.md) - Test coverage checklist

## 🚨 Critical Next Steps

### Immediate Actions (This Week)

1. **Configure External Services** (Priority: P0)
   - Follow [EXTERNAL_SERVICES_SETUP.md](EXTERNAL_SERVICES_SETUP.md)
   - Set up SendGrid, Twilio, Firebase, OpenAI, AWS
   - Update `.env` files with API keys
   - Test each integration

2. **Run Complete Test Suite** (Priority: P0)

   ```bash
   pnpm run test:all
   ```

   - Fix any failing tests
   - Achieve 90%+ test coverage
   - Document test results

3. **Complete Frontend Routes** (Priority: P1)
   - Implement checkout flow
   - Create user profile pages
   - Enhance dashboard views

### This Month

4. **Load & Security Testing** (Priority: P1)
   - Execute k6 load tests
   - Run OWASP ZAP security scan
   - Address critical findings

5. **Deploy Staging Environment** (Priority: P2)
   - Set up AWS infrastructure with Terraform
   - Deploy to ECS Fargate
   - Configure monitoring

6. **Production Preparation** (Priority: P2)
   - Final security audit
   - Performance optimization
   - Create runbooks

## 📊 Current Metrics

- **Backend Code:** ~9,550 lines (15 modules)
- **Frontend Code:** ~4,500 lines (24 routes)
- **Database Models:** 70+ Prisma models
- **Test Code:** ~3,300 lines
- **Documentation:** ~22,000+ lines total
- **API Endpoints:** 100+ REST endpoints
- **Test Coverage:** 60-70% (target: 95%)

## 🤝 Contributing

This project follows standard development practices:

1. Create feature branch from `develop`
2. Write tests for new features
3. Ensure all tests pass: `pnpm run test:all`
4. Submit pull request for review
5. Merge to `develop` after approval
6. Deploy to staging for validation
7. Merge to `main` for production

## 🔗 Links

- **Documentation:** All markdown files in repository root
- **API Docs:** http://localhost:3000/api/docs (when running)
- **Build System:** [BUILD_SYSTEM.md](BUILD_SYSTEM.md)
- **Test Guide:** [docs/TEST_SUITE_GUIDE.md](docs/TEST_SUITE_GUIDE.md)
- **Deployment Guide:** [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md)
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
