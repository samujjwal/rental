# Quick Start Guide - Developer Setup

Get the Rental Portal platform running locally in under 10 minutes.

---

## Prerequisites

### Required
- **Node.js**: v20+ ([Download](https://nodejs.org/))
- **pnpm**: v8+ (`npm install -g pnpm`)
- **Docker Desktop**: For PostgreSQL, Redis, Elasticsearch ([Download](https://www.docker.com/products/docker-desktop))

### Optional (for full features)
- **SendGrid Account**: Email delivery
- **Firebase Project**: Push notifications
- **Twilio Account**: SMS delivery
- **OpenAI API Key**: Content moderation

---

## Quick Start (5 Minutes)

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd rental

# Install dependencies
pnpm install
```

### 2. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, and Elasticsearch with Docker Compose
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# NAME                STATUS
# rental-postgres     Up
# rental-redis        Up  
# rental-elasticsearch Up
```

### 3. Setup Database

```bash
# Navigate to database package
cd packages/database

# Copy environment template
cp .env.example .env

# Run migrations
npx prisma migrate dev

# Seed database with sample data
npx prisma db seed

# Open Prisma Studio (optional - database GUI)
npx prisma studio
```

### 4. Configure API

```bash
# Navigate to API
cd ../../apps/api

# Copy environment template
cp .env.example .env

# Edit .env and set required variables
# At minimum, verify DATABASE_URL, REDIS_HOST, ELASTICSEARCH_NODE
```

**Minimal `.env` for local development:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rental_portal
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_NODE=http://localhost:9200
JWT_SECRET=your-local-dev-secret-key-change-in-production
STRIPE_SECRET_KEY=sk_test_xxxxx  # Get from Stripe Dashboard
```

### 5. Start Backend

```bash
# From apps/api directory
pnpm dev

# Server starts at http://localhost:3000
# API docs available at http://localhost:3000/api/docs
```

### 6. Start Frontend (New Terminal)

```bash
# Navigate to web app
cd apps/web

# Copy environment template
cp .env.example .env

# Start development server
pnpm dev

# App starts at http://localhost:5173
```

### 7. Verify Installation

Open browser to:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000/api/health
- **API Docs**: http://localhost:3000/api/docs
- **Prisma Studio**: http://localhost:5555

---

## Test Accounts (After Seeding)

```
Admin:
  Email: admin@rentalportal.com
  Password: Admin123!

User 1:
  Email: john@example.com
  Password: User123!

User 2:
  Email: sarah@example.com
  Password: User123!
```

---

## Development Workflow

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests (API running required)
cd apps/api
pnpm test:e2e

# Load tests (k6 required)
cd apps/api/test/load
k6 run search-queries.load.js
```

### Database Operations

```bash
# Create new migration
cd packages/database
npx prisma migrate dev --name description_of_change

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate

# View database
npx prisma studio
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Format code
pnpm format

# Type check
pnpm type-check
```

---

## Project Structure

```
rental/
├── apps/
│   ├── api/                 # NestJS backend
│   │   ├── src/
│   │   │   ├── common/      # Shared infrastructure
│   │   │   ├── modules/     # Feature modules
│   │   │   └── main.ts      # Application entry
│   │   └── test/            # E2E & load tests
│   │
│   └── web/                 # React Router v7 frontend
│       ├── app/
│       │   ├── routes/      # File-based routing
│       │   ├── components/  # UI components
│       │   └── lib/         # API client & utilities
│       └── vite.config.ts
│
├── packages/
│   └── database/            # Prisma schema & migrations
│       ├── prisma/
│       │   └── schema.prisma
│       └── src/
│
├── docker-compose.yml       # Local infrastructure
└── turbo.json              # Monorepo configuration
```

---

## Feature Flags (Environment Variables)

Enable/disable features during development:

```env
# Feature Flags
ENABLE_ORGANIZATIONS=true
ENABLE_FRAUD_DETECTION=true
ENABLE_CONTENT_MODERATION=false  # Set true when OpenAI API configured
ENABLE_NOTIFICATIONS=false       # Set true when SendGrid/FCM configured
ENABLE_INSURANCE=true
ENABLE_TAX_CALCULATION=true

# External Services (optional for local dev)
OPENAI_API_KEY=sk-xxxxx          # Content moderation
SENDGRID_API_KEY=SG.xxxxx        # Email delivery
FIREBASE_SERVICE_ACCOUNT='{...}' # Push notifications
TWILIO_ACCOUNT_SID=ACxxxxx       # SMS delivery
```

---

## Common Issues & Solutions

### Issue: Port already in use
```bash
# Find process using port
lsof -i :3000  # or :5173, :5432, :6379, :9200

# Kill process
kill -9 <PID>

# Or use different ports in .env
PORT=3001
```

### Issue: Docker containers not starting
```bash
# Check Docker Desktop is running
docker ps

# Restart containers
docker-compose down
docker-compose up -d

# View logs
docker-compose logs -f
```

### Issue: Database connection error
```bash
# Verify PostgreSQL is running
docker-compose ps

# Check DATABASE_URL in .env matches docker-compose.yml
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rental_portal

# Reset database
cd packages/database
npx prisma migrate reset
```

### Issue: Prisma Client not generated
```bash
cd packages/database
npx prisma generate

# If still errors, delete node_modules and reinstall
rm -rf node_modules
pnpm install
```

### Issue: Redis connection error
```bash
# Verify Redis is running
docker-compose ps

# Test connection
redis-cli ping
# Expected: PONG

# Check REDIS_HOST in .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Issue: Elasticsearch not accessible
```bash
# Check if Elasticsearch is running
curl http://localhost:9200
# Should return cluster info JSON

# Restart Elasticsearch
docker-compose restart elasticsearch

# Wait for yellow status (30 seconds)
curl http://localhost:9200/_cluster/health
```

---

## API Testing with cURL

### Authentication
```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'

# Save the returned access_token
export TOKEN=<access_token_from_login>
```

### Create Listing
```bash
curl -X POST http://localhost:3000/api/listings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Listing",
    "description": "A test item for rent",
    "categoryId": "category-id-from-seed",
    "pricePerDay": 50,
    "location": {
      "address": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "country": "US",
      "postalCode": "94102",
      "latitude": 37.7749,
      "longitude": -122.4194
    }
  }'
```

### Search Listings
```bash
curl -X GET "http://localhost:3000/api/search/listings?query=test&location=San+Francisco&radius=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Create Booking
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "listingId": "listing-id-from-previous-response",
    "startDate": "2026-02-01",
    "endDate": "2026-02-05",
    "message": "Looking forward to renting this!"
  }'
```

---

## VS Code Extensions (Recommended)

Install these extensions for better DX:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "orta.vscode-jest"
  ]
}
```

Save this as `.vscode/extensions.json` and VS Code will prompt to install.

---

## Monitoring & Debugging

### View Logs

```bash
# API logs
cd apps/api
pnpm dev  # Logs show in terminal

# Database logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis

# Elasticsearch logs
docker-compose logs -f elasticsearch
```

### Health Checks

```bash
# API health
curl http://localhost:3000/api/health

# Database connection
curl http://localhost:3000/api/health/db

# Redis connection
curl http://localhost:3000/api/health/redis

# Elasticsearch connection
curl http://localhost:3000/api/health/elasticsearch
```

### Debug Mode (VS Code)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/apps/api",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

Set breakpoints and press F5 to start debugging.

---

## Next Steps

### For Backend Development
1. Read [API_README.md](./API_README.md)
2. Review [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
3. Explore Swagger docs at http://localhost:3000/api/docs
4. Check out [INTEGRATION_EXAMPLES.md](./INTEGRATION_EXAMPLES.md)

### For Frontend Development
1. Read [apps/web/README.md](./apps/web/README.md)
2. Review React Router v7 documentation
3. Explore [apps/web/app/lib/api/](./apps/web/app/lib/api/) for API hooks

### For Database Work
1. Review [packages/database/prisma/schema.prisma](./packages/database/prisma/schema.prisma)
2. Read Prisma documentation
3. Use Prisma Studio for visual exploration

### Configure External Services (Optional)
1. [SendGrid Setup](https://docs.sendgrid.com/) - Email delivery
2. [Firebase Setup](https://firebase.google.com/docs/cloud-messaging) - Push notifications
3. [Twilio Setup](https://www.twilio.com/docs/sms) - SMS delivery
4. [OpenAI Setup](https://platform.openai.com/docs/guides/moderation) - Content moderation
5. [Stripe Setup](https://stripe.com/docs/connect) - Payments

---

## Getting Help

### Documentation
- **Project Status**: [CURRENT_PROJECT_STATUS.md](./CURRENT_PROJECT_STATUS.md)
- **API Reference**: [API_README.md](./API_README.md)
- **Testing Guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **New Features**: [SPRINT_1_COMPLETE.md](./SPRINT_1_COMPLETE.md)

### External Resources
- [NestJS Documentation](https://docs.nestjs.com/)
- [React Router v7 Docs](https://reactrouter.com/en/main)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Community
- Open an issue on GitHub
- Check existing documentation in `/docs`

---

## Production Deployment

For production deployment instructions, see:
- [DEPLOYMENT.md](./apps/web/DEPLOYMENT.md) - Frontend deployment
- [SPRINT_1_COMPLETE.md](./SPRINT_1_COMPLETE.md) - Production checklist

---

**Happy Coding! 🚀**
