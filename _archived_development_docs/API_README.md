# Universal Rental Portal - Backend API

A comprehensive, scalable backend system for a universal rental marketplace built with NestJS, PostgreSQL, Redis, and Elasticsearch.

## 🚀 Features

### Core Modules

- **Authentication & Authorization**: JWT-based auth with refresh tokens, role-based access control
- **User Management**: Complete user profiles, verification (email/phone/identity), ratings
- **Listings Management**: Multi-category rentals, condition reports, availability tracking
- **Bookings System**: Real-time availability, expiration handling, status management
- **Payments**: Stripe integration with escrow, refunds, payouts, webhooks
- **Search**: Elasticsearch-powered with filters, geo-location, autocomplete
- **Reviews & Ratings**: Bidirectional reviews for renters and owners
- **Notifications**: Multi-channel (email, SMS, push, in-app) with templates
- **Messaging**: Real-time chat between renters and owners
- **Fulfillment**: Condition inspection, damage assessment, return verification
- **Disputes**: Comprehensive dispute resolution with evidence, admin decisions
- **Admin Panel**: Analytics, moderation, user management, system monitoring

### Infrastructure

- **Background Jobs**: BullMQ queue system for async processing
- **Scheduled Tasks**: Cron jobs for expiration checks, reminders, cleanup, reindexing
- **Event-Driven Architecture**: EventEmitter2 for decoupled module communication
- **File Uploads**: AWS S3 integration with image processing and CDN support
- **Rate Limiting**: Redis-based with configurable limits per endpoint
- **Health Checks**: Database, Redis, queues, memory, disk monitoring
- **Logging**: Winston with structured logging, daily rotation
- **Security**: Helmet, CORS, XSS protection, SQL injection prevention
- **API Documentation**: Swagger/OpenAPI with interactive docs
- **Error Handling**: Global exception filters with proper status codes

## 📋 Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 15+
- Redis 7+
- Elasticsearch 8+
- AWS S3 account (for file uploads)
- Stripe account (for payments)

## 🛠️ Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd gharbatai-rentals
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your actual configuration
```

4. **Start infrastructure services**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

5. **Run database migrations**

```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
```

6. **Seed the database (optional)**

```bash
npx prisma db seed
```

7. **Start the development server**

```bash
pnpm run dev
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

Interactive API documentation is available at:

- Swagger UI: `http://localhost:3000/api/docs`

## 🏗️ Architecture

### Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with BullMQ
- **Search**: Elasticsearch
- **File Storage**: AWS S3
- **Payments**: Stripe
- **Email**: SMTP (configurable)
- **SMS**: Twilio (optional)
- **Push Notifications**: Firebase (optional)

### Project Structure

```
apps/api/src/
├── modules/           # Feature modules
│   ├── auth/         # Authentication & authorization
│   ├── users/        # User management
│   ├── categories/   # Category management
│   ├── listings/     # Rental listings
│   ├── bookings/     # Booking system
│   ├── payments/     # Payment processing
│   ├── search/       # Search functionality
│   ├── reviews/      # Reviews & ratings
│   ├── notifications/ # Multi-channel notifications
│   ├── messages/     # Real-time messaging
│   ├── fulfillment/  # Condition inspection & returns
│   ├── disputes/     # Dispute resolution
│   └── admin/        # Admin panel
├── common/           # Shared utilities
│   ├── config/       # Configuration
│   ├── database/     # Database connection
│   ├── queue/        # Queue configuration
│   ├── events/       # Event system
│   ├── scheduler/    # Cron jobs
│   ├── upload/       # File upload service
│   ├── logger/       # Logging service
│   ├── health/       # Health checks
│   ├── rate-limit/   # Rate limiting
│   ├── security/     # Security middleware
│   ├── filters/      # Exception filters
│   ├── pipes/        # Validation pipes
│   └── swagger/      # API documentation
└── main.ts           # Application entry point
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret for JWT token signing
- `STRIPE_SECRET_KEY`: Stripe API key
- `AWS_ACCESS_KEY_ID`: AWS credentials for S3
- `ELASTICSEARCH_NODE`: Elasticsearch URL

## 🚦 Running Tests

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## 📦 Deployment

### Using Docker

1. **Build production image**

```bash
docker build -f apps/api/Dockerfile -t rental-api .
```

2. **Run with docker-compose**

```bash
docker-compose up -d
```

### Manual Deployment

1. **Build the application**

```bash
pnpm run build
```

2. **Run migrations**

```bash
npx prisma migrate deploy
```

3. **Start production server**

```bash
NODE_ENV=production node dist/apps/api/main.js
```

## 🔍 Key Features Details

### Background Jobs

- **Booking Expiration**: Automatically cancels bookings pending payment after 30 minutes
- **Reminders**: Sends booking reminders 24 hours before start, during ongoing, and before return
- **Auto-Completion**: Completes bookings after 48-hour inspection period
- **Search Indexing**: Bulk indexing and reindexing of listings
- **Notifications**: Batch processing of scheduled notifications

### Scheduled Tasks (Cron)

- Every 5 minutes: Check expired bookings
- Hourly: Send booking reminders, auto-complete bookings
- Every 6 hours: Send return reminders, update aggregated ratings
- Daily (2 AM): Full search reindex
- Weekly (Sunday 3 AM): Data cleanup (old notifications, sessions, audit logs)

### Event-Driven Communication

- **Booking Events**: created, confirmed, cancelled, completed
- **Payment Events**: succeeded, failed, refunded
- **Listing Events**: created, updated, activated, deleted
- **Review Events**: created
- **Dispute Events**: created, resolved
- **Message Events**: sent
- **User Events**: registered, verified

## 🔐 Security

- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Rate limiting per endpoint
- CORS configuration
- Helmet security headers
- XSS protection
- SQL injection prevention
- Input validation and sanitization
- Suspicious activity detection and logging

## 📊 Monitoring

### Health Check Endpoints

- `GET /health` - General health check
- `GET /health/database` - Database connectivity
- `GET /health/queues` - Queue system status
- `GET /health/memory` - Memory usage
- `GET /health/disk` - Disk usage
- `GET /health/liveness` - Kubernetes liveness probe
- `GET /health/readiness` - Kubernetes readiness probe

### Logging

- Structured logging with Winston
- Daily log rotation
- Separate files for errors, application, and combined logs
- Request/response logging
- Business event tracking
- Security event monitoring

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 📧 Contact

For questions or support, please contact [your-email@example.com]

## 🎯 Roadmap

- [ ] GraphQL API support
- [ ] WebSocket for real-time updates
- [ ] Mobile app integration
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] AI-powered recommendations
- [ ] Dynamic pricing engine
- [ ] Insurance integration
- [ ] Blockchain-based verification
