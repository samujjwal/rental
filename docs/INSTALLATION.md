# Installation Guide

This guide covers installing and setting up the GharBatai Nepal Rental Portal for development, testing, and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Test Setup](#test-setup)
- [Production Setup](#production-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js**: >= 20.0.0 (recommended: LTS version)
- **pnpm**: >= 10.28.2
- **Docker**: >= 24.0.0
- **Docker Compose**: >= 2.0.0
- **Git**: >= 2.0.0

### Optional Software

- **PostgreSQL Client**: For direct database access
- **Redis CLI**: For direct cache access
- **Make**: For running make commands (if using Makefile)

### System Requirements

See [RESOURCE_REQUIREMENTS.md](./RESOURCE_REQUIREMENTS.md) for detailed resource requirements.

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd rental
```

### 2. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm@10.28.2

# Install project dependencies
pnpm install
```

### 3. Configure Environment

```bash
# Copy environment example
cp .env.example .env

# Edit .env with your configuration
# At minimum, set:
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET
# - JWT_REFRESH_SECRET
```

### 4. Start Development Environment

```bash
# Start infrastructure services
./scripts/env/start-env.sh dev start

# Run database migrations
pnpm run db:migrate

# Seed database (optional)
pnpm run db:seed

# Start development servers
pnpm run dev
```

### 5. Access the Application

- **Web Application**: http://localhost:3001
- **API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs

## Development Setup

### 1. Environment Configuration

Create `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your development configuration:

```env
# Database
DATABASE_URL="postgresql://rental_user:rental_password@localhost:5432/rental_portal?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# API
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Web
FRONTEND_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3001,http://localhost:3000

# JWT
JWT_SECRET=your_jwt_secret_minimum_32_characters
JWT_REFRESH_SECRET=your_refresh_secret_minimum_32_characters

# Email (optional - use Resend for free tier)
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@resend.dev

# Storage (optional - use Cloudflare R2 or local)
# For local development, leave empty to use local storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
LOCAL_STORAGE_PATH=./uploads

# Stripe (optional - for payment testing)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 2. Start Infrastructure Services

```bash
# Start PostgreSQL and Redis
./scripts/env/start-env.sh dev start

# Verify services are running
./scripts/env/start-env.sh dev status
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm run db:generate

# Run migrations
pnpm run db:migrate

# Seed database with sample data (optional)
pnpm run db:seed
```

### 4. Start Development Servers

```bash
# Start all services (API + Web)
pnpm run dev

# Or start individually:
pnpm run dev:api   # API only
pnpm run dev:web   # Web only
```

### 5. Run Tests

```bash
# Run all tests
./scripts/test/run-tests.sh all

# Run specific test types
./scripts/test/run-tests.sh unit
./scripts/test/run-tests.sh integration
./scripts/test/run-tests.sh e2e
./scripts/test/run-tests.sh coverage
```

### 6. Development Tools

```bash
# Type checking
pnpm run typecheck

# Linting
pnpm run lint

# Format code
pnpm run format

# Clean build artifacts
pnpm run clean
```

## Test Setup

### 1. Test Environment Configuration

Create `.env.test` file:

```bash
cp .env.example .env.test
```

Edit `.env.test` with test-specific configuration:

```env
NODE_ENV=test
PORT=3000
DATABASE_URL="postgresql://test:test@localhost:6432/rental_test?schema=public"
REDIS_HOST=localhost
REDIS_PORT=7379
REDIS_URL=redis://localhost:7379

# Use test/stripe bypass mode
STRIPE_TEST_BYPASS=true

# Disable external services in tests
EMAIL_ENABLED=false
TWILIO_ACCOUNT_SID=test
TWILIO_AUTH_TOKEN=test

# Enable dev login for E2E tests
ALLOW_DEV_LOGIN=true
DEV_SEED_ENABLED=true
```

### 2. Start Test Infrastructure

```bash
# Start test environment with port offsets
./scripts/env/start-env.sh test start

# Verify services
./scripts/env/start-env.sh test status
```

### 3. Run Tests

```bash
# Run all tests
./scripts/test/run-tests.sh all test

# Run specific test suites
./scripts/test/run-tests.sh unit test
./scripts/test/run-tests.sh integration test
./scripts/test/run-tests.sh e2e test

# With verbose output
./scripts/test/run-tests.sh unit test --verbose

# With coverage
./scripts/test/run-tests.sh coverage test
```

### 4. Parallel Test Execution

The test environment uses port offsets to allow parallel execution:

- **Dev**: PostgreSQL on 5432, Redis on 6379
- **Test**: PostgreSQL on 6432, Redis on 7379
- **E2E**: PostgreSQL on 7432, Redis on 8379

You can run dev and test environments simultaneously without port conflicts.

## Production Setup

### 1. Server Preparation

#### System Requirements

- **OS**: Ubuntu 22.04 LTS or CentOS 8+
- **CPU**: 8 cores minimum
- **RAM**: 16 GB minimum
- **Disk**: 100 GB SSD minimum
- **Docker**: Latest version
- **Docker Compose**: Latest version

#### Install Docker

```bash
# Update package index
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Environment Configuration

Create `.env.production` file:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` with production values:

```env
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
VITE_API_URL=/api

# Database (external managed database recommended)
DATABASE_URL=postgresql://user:password@db-host:5432/gharbatai?schema=public

# Redis (external managed Redis recommended)
REDIS_URL=redis://:password@redis-host:6379

# JWT (generate secure random strings)
JWT_SECRET=<generate_64_char_random_string>
JWT_REFRESH_SECRET=<generate_64_char_random_string>

# DigitalOcean Spaces (or AWS S3)
DO_SPACES_KEY=your_access_key
DO_SPACES_SECRET=your_secret_key
DO_SPACES_REGION=nyc3
DO_SPACES_BUCKET=gharbatai-uploads
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_CDN=https://yourdomain.com.cdn.digitaloceanspaces.com

# Stripe (production keys)
STRIPE_SECRET_KEY=sk_live_your_production_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# SendGrid (or Resend)
SENDGRID_API_KEY=SG.your_sendgrid_key

# Sentry (error tracking)
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
```

### 3. SSL Certificate Setup

#### Using Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates will be saved to /etc/letsencrypt/live/yourdomain.com/
```

#### Copy Certificates to Project

```bash
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
sudo chmod 644 nginx/ssl/cert.pem
sudo chmod 600 nginx/ssl/key.pem
```

### 4. Deploy with Docker Compose

```bash
# Build and start services
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Check service status
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# View logs
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f
```

### 5. Database Migrations

```bash
# Run migrations in production
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api pnpm --filter @rental-portal/database migrate:deploy
```

### 6. Health Check

```bash
# Check API health
curl https://yourdomain.com/api/health

# Check web health
curl https://yourdomain.com
```

### 7. Setup Backups

Configure automated database backups:

```bash
# Add to crontab
0 2 * * * cd /path/to/rental && ./scripts/backup/backup.sh production
```

## Troubleshooting

### Port Conflicts

If you encounter port conflicts:

```bash
# Check what's using a port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # API
lsof -i :3001  # Web

# Use environment-specific port offsets
export ENVIRONMENT=test
./scripts/env/start-env.sh test start
```

### Docker Issues

```bash
# Check Docker is running
docker info

# Restart Docker
sudo systemctl restart docker

# Clean up Docker resources
docker system prune -a
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose -f docker-compose.dev.yml ps postgres

# Check PostgreSQL logs
docker compose -f docker-compose.dev.yml logs postgres

# Test database connection
psql -h localhost -p 5432 -U rental_user -d rental_portal
```

### Redis Connection Issues

```bash
# Check Redis is running
docker compose -f docker-compose.dev.yml ps redis

# Check Redis logs
docker compose -f docker-compose.dev.yml logs redis

# Test Redis connection
redis-cli -h localhost -p 6379 ping
```

### Build Failures

```bash
# Clean build artifacts
pnpm run clean

# Clear pnpm cache
pnpm store prune

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

### Test Failures

```bash
# Check test infrastructure is running
./scripts/env/start-env.sh test status

# Restart test infrastructure
./scripts/env/start-env.sh test restart

# Run tests with verbose output
./scripts/test/run-tests.sh unit test --verbose

# Run tests in debug mode
./scripts/test/run-tests.sh unit test --debug
```

### Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Fix Docker socket permission
sudo chmod 666 /var/run/docker.sock
```

## Next Steps

- [Review RESOURCE_REQUIREMENTS.md](./RESOURCE_REQUIREMENTS.md) for scaling guidance
- [Review DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
- [Review TESTING.md](./TESTING.md) for testing guidelines

## Support

For issues or questions:
- Check the [GitHub Issues](https://github.com/your-org/rental/issues)
- Review [Troubleshooting](#troubleshooting) section
- Contact support at support@yourdomain.com
