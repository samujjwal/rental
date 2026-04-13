# Scripts Documentation

This directory contains the unified script architecture for the GharBatai Nepal Rental Portal.

## Directory Structure

```
scripts/
├── README.md                    # This file
├── lib/
│   └── config-loader.sh         # Configuration management library
├── ci/                          # CI/CD guardrails
│   ├── check-category-schema-duplication.sh
│   ├── check-controller-prisma.sh
│   ├── check-enum-drift.sh
│   ├── check-marketplace-boundaries.sh
│   ├── check-schema-domain-governance.sh
│   └── run-guardrails.sh        # Run all CI checks
├── backup/
│   └── backup.sh                # Unified backup script
├── deploy/
│   └── deploy.sh                # Unified deployment script
├── setup/
│   └── setup-server.sh          # Server setup script
├── test/                        # Test runners (consolidated)
│   ├── run-tests.sh             # Unified test runner
│   ├── run-e2e.sh               # E2E test automation
│   ├── run-coverage.sh          # Coverage test runner (consolidated)
│   ├── run-performance-tests.sh # Performance test runner (K6)
│   └── run-security-audit.sh    # Security audit script
└── env/
    └── start-env.sh             # Environment startup/management
```

## Overview

The script architecture provides:
- **Flexible configuration** via environment variables
- **Parallel execution** support with port offsets
- **No hardcoded configs** - everything configurable
- **Concise reporting** for all operations
- **Production-ready** deployment scripts
- **Organized structure** - scripts categorized by purpose

## Core Scripts by Category

### Environment Management (`env/`)

#### 1. Configuration Loader (`lib/config-loader.sh`)

Centralized configuration management with environment variable support.

**Features:**
- Environment-specific port offsets (dev, test, e2e, staging, prod)
- Configuration validation
- Default value fallbacks
- Port calculation with offsets

**Usage:**
```bash
source scripts/lib/config-loader.sh
```

**Port Offsets:**
- `dev`: 0 (default ports)
- `test`: +1000
- `e2e`: +2000
- `staging`: +3000
- `prod`: 0 (default ports)

**Functions:**
- `get_port_offset [env]` - Get port offset for environment
- `calculate_port [base_port] [offset]` - Calculate actual port
- `load_env_file [env_file]` - Load environment file
- `validate_required_vars [var1 var2 ...]` - Validate required variables
- `get_config [var_name] [default]` - Get config value with fallback
- `print_config` - Print configuration summary

#### 2. Environment Startup (`env/start-env.sh`)

Unified script to start/stop/manage environments (dev, test, e2e, staging, prod).

**Usage:**
```bash
./scripts/env/start-env.sh [environment] [action]
```

**Arguments:**
- `environment`: dev, test, e2e, staging, prod (default: dev)
- `action`: start, stop, restart, status, logs (default: start)

**Examples:**
```bash
# Start development environment
./scripts/env/start-env.sh dev start

# Stop test environment
./scripts/env/start-env.sh test stop

# Check status
./scripts/env/start-env.sh dev status

# View logs
./scripts/env/start-env.sh dev logs

# Restart environment
./scripts/env/start-env.sh e2e restart
```

**Features:**
- Automatic port offset calculation
- Health check waiting
- Database migration support
- Service URL display
- Environment variable loading

### Testing (`test/`)

#### 1. Test Runner (`test/run-tests.sh`)

Flexible test runner with concise reporting for all test types.

**Usage:**
```bash
./scripts/test/run-tests.sh [test-type] [environment] [options]
```

**Arguments:**
- `test-type`: unit, integration, e2e, all, coverage, security, performance
- `environment`: dev, test, e2e (default: test)
- `options`: --verbose, --watch, --debug, --reporter=<format>

**Examples:**
```bash
# Run all tests in test environment
./scripts/test/run-tests.sh all test

# Run unit tests in development
./scripts/test/run-tests.sh unit dev

# Run E2E tests with verbose output
./scripts/test/run-tests.sh e2e test --verbose

# Run tests with coverage
./scripts/test/run-tests.sh coverage test

# Run tests in watch mode
./scripts/test/run-tests.sh unit dev --watch
```

**Test Types:**
- `unit` - Jest unit tests
- `integration` - Integration tests
- `e2e` - Playwright end-to-end tests
- `coverage` - Code coverage reports
- `security` - Security tests
- `performance` - Load/performance tests
- `all` - All test types

#### 2. Fast Test Runner (`test/run-tests-fast.sh`)

Quick test runner excluding chaos/e2e tests for rapid feedback.

**Usage:**
```bash
./scripts/test/run-tests-fast.sh
```

#### 3. Performance Tests (`test/run-performance-tests.mjs`)

K6 performance test runner for load testing.

**Usage:**
```bash
./scripts/test/run-performance-tests.mjs [suite] [extra-args]
```

**Suites:**
- `api` - API load tests
- `journey` - User journey tests
- `stress` - Stress tests
- `spike` - Spike tests
- `all` - All suites

**Example:**
```bash
./scripts/test/run-performance-tests.mjs api
./scripts/test/run-performance-tests.mjs all
```

#### 4. Security Audit (`test/run-security-audit.sh`)

Comprehensive security audit script.

**Usage:**
```bash
./scripts/test/run-security-audit.sh
```

**Checks:**
- NPM audit for vulnerabilities
- Outdated dependencies
- License compliance
- Secret scanning
- Code quality linting
- CORS configuration
- SQL injection prevention
- XSS prevention
- Authentication security
- Rate limiting
- HTTPS/SSL configuration
- Docker security

### Deployment (`deploy/`)

#### Unified Deployment Script (`deploy/deploy.sh`)

Deploys application to production or MVP environment with SSL setup.

**Usage:**
```bash
sudo ./scripts/deploy/deploy.sh [domain] [mode]
```

**Arguments:**
- `domain`: yourdomain.com (required for MVP mode)
- `mode`: mvp, production (default: production)

**Examples:**
```bash
# Deploy MVP with domain
sudo ./scripts/deploy/deploy.sh myapp.com mvp

# Deploy to production
sudo ./scripts/deploy/deploy.sh production
```

**Features:**
- Let's Encrypt SSL certificate setup (MVP mode)
- Docker Compose deployment
- Database migrations
- Health checks
- Backup automation (MVP mode)
- Nginx log rotation (MVP mode)

### Backup (`backup/`)

#### Unified Backup Script (`backup/backup.sh`)

Creates automated backups of database and uploads with cloud storage support.

**Usage:**
```bash
./scripts/backup/backup.sh [environment] [mode]
```

**Arguments:**
- `environment`: production, mvp (default: production)
- `mode`: full (includes app files), minimal (database only) (default: full)

**Examples:**
```bash
# Full backup for MVP
./scripts/backup/backup.sh mvp full

# Minimal backup for production
./scripts/backup/backup.sh production minimal
```

**Features:**
- PostgreSQL backup
- Redis backup (full mode)
- Application files backup (full mode)
- Cloud storage upload (S3/Spaces)
- Automatic cleanup based on retention
- Backup integrity verification
- Slack notifications (optional)

### Server Setup (`setup/`)

#### Server Setup Script (`setup/setup-server.sh`)

Sets up a fresh server for GharBatai Rentals deployment.

**Usage:**
```bash
REPO_URL=https://github.com/<org>/<repo>.git sudo ./scripts/setup/setup-server.sh [mode]
```

**Arguments:**
- `mode`: mvp, production (default: production)
- `REPO_URL`: Repository URL (environment variable)

**Examples:**
```bash
# Setup for MVP
REPO_URL=https://github.com/myorg/gharbatai-rentals.git sudo ./scripts/setup/setup-server.sh mvp

# Setup for production
REPO_URL=https://github.com/myorg/gharbatai-rentals.git sudo ./scripts/setup/setup-server.sh production
```

**Features:**
- System updates and package installation
- Docker and Docker Compose setup
- User creation (deploy user)
- Firewall configuration (UFW)
- Fail2ban setup
- Swap file creation
- System optimization
- Log rotation configuration
- Automatic security updates
- Repository cloning
- Cron job setup

### CI/CD (`ci/`)

#### CI Guardrails

All CI guardrail scripts are located in `scripts/ci/`:

- `check-category-schema-duplication.sh` - Detects duplicate category schema definitions
- `check-controller-prisma.sh` - Detects direct Prisma access in controllers
- `check-enum-drift.sh` - Detects enum/contract drift between Prisma and shared-types
- `check-marketplace-boundaries.sh` - Enforces marketplace sub-module boundaries
- `check-schema-domain-governance.sh` - Enforces database schema domain governance
- `run-guardrails.sh` - Runs all CI guardrail checks

**Usage:**
```bash
# Run all guardrails
./scripts/ci/run-guardrails.sh

# Run individual check
./scripts/ci/check-enum-drift.sh
```

## NPM Scripts

The root `package.json` has been updated to use the new unified scripts:

### Environment Management
```bash
pnpm run env:start [env] [action]  # Start environment
pnpm run env:stop [env] [action]  # Stop environment
pnpm run env:restart [env] [action] # Restart environment
pnpm run env:status [env] [action] # Check status
pnpm run env:logs [env] [action]   # View logs
```

### Development
```bash
pnpm run dev          # Start all dev servers
pnpm run dev:api      # Start API only
pnpm run dev:web      # Start Web only
pnpm run dev:mobile   # Start Mobile
```

### Testing
```bash
pnpm run test                # Run all tests (test environment)
pnpm run test:unit           # Unit tests only
pnpm run test:integration    # Integration tests
pnpm run test:e2e            # E2E tests
pnpm run test:coverage       # Coverage report
pnpm run test:security       # Security tests
pnpm run test:performance    # Performance tests
pnpm run test:all            # All test types
pnpm run test:watch          # Watch mode
pnpm run test:verbose        # Verbose output
```

### Database
```bash
pnpm run db:generate  # Generate Prisma client
pnpm run db:migrate   # Run migrations
pnpm run db:studio    # Open Prisma Studio
pnpm run db:seed      # Seed database
```

### Deployment
```bash
pnpm run deploy         # Deploy (default environment)
pnpm run deploy:prod    # Deploy to production
pnpm run deploy:mvp     # Deploy MVP
```

### Backup
```bash
pnpm run backup         # Backup (default environment)
pnpm run backup:prod    # Backup production
pnpm run backup:mvp     # Backup MVP
```

## Docker Compose Files

All Docker Compose files have been updated to use environment variables:

### `docker-compose.dev.yml`
- Development infrastructure (PostgreSQL, Redis)
- Environment variables: `POSTGRES_PORT`, `REDIS_PORT`, etc.
- Health checks added
- No hardcoded ports or credentials

### `docker-compose.test.yml`
- Test infrastructure (PostgreSQL, Redis, MinIO, Mailhog)
- Environment variables for all services
- Port offset support for parallel execution
- Health checks for all services

### `docker-compose.prod.yml`
- Production infrastructure (API, Web, Nginx)
- Resource limits configurable via env vars
- Health checks and logging
- No hardcoded values

## Configuration Files

### Environment Files

Create environment-specific configuration files:

- `.env` - Development (default)
- `.env.dev` - Development specific
- `.env.test` - Test environment
- `.env.e2e` - E2E test environment
- `.env.staging` - Staging environment
- `.env.prod` - Production

### Example `.env.test`
```env
ENVIRONMENT=test
POSTGRES_PORT=6432
REDIS_PORT=7379
API_PORT=3000
WEB_PORT=3001
POSTGRES_USER=test
POSTGRES_PASSWORD=test
POSTGRES_DB=rental_test
STRIPE_TEST_BYPASS=true
ALLOW_DEV_LOGIN=true
DEV_SEED_ENABLED=true
EMAIL_ENABLED=false
```

## Port Configuration

### Default Ports (Base)
- PostgreSQL: 5432
- Redis: 6379
- API: 3000
- Web: 3001
- MinIO: 9000
- MinIO Console: 9001
- Mailhog: 8025

### Environment-Specific Ports (with Offsets)

| Environment | Offset | PostgreSQL | Redis | API | Web |
|-------------|--------|------------|-------|-----|-----|
| dev         | 0      | 5432       | 6379  | 3000 | 3001 |
| test        | 1000   | 6432       | 7379  | 4000 | 4001 |
| e2e         | 2000   | 7432       | 8379  | 5000 | 5001 |
| staging     | 3000   | 8432       | 9379  | 6000 | 6001 |
| prod        | 0      | 5432       | 6379  | 3000 | 3000 |

This allows parallel execution of dev, test, and e2e environments without port conflicts.

## Migration Guide

### For Developers

**Old way:**
```bash
./scripts/dev-full.sh
```

**New way:**
```bash
./scripts/env/start-env.sh dev start
pnpm run dev
```

### For Testing

**Old way:**
```bash
./scripts/run-tests.sh e2e
```

**New way:**
```bash
./scripts/test/run-tests.sh e2e
```

### For Environment Management

**Old way:**
```bash
docker compose -f docker-compose.dev.yml up -d
```

**New way:**
```bash
./scripts/env/start-env.sh dev start
```

### For Backup

**Old way:**
```bash
./scripts/backup.sh production
./scripts/backup-mvp.sh
```

**New way:**
```bash
./scripts/backup/backup.sh production
./scripts/backup/backup.sh mvp full
```

### For Deployment

**Old way:**
```bash
./scripts/deploy.sh production
./scripts/deploy-mvp.sh mydomain.com
./scripts/deploy-digitalocean.sh mydomain.com 1.2.3.4
```

**New way:**
```bash
sudo ./scripts/deploy/deploy.sh production
sudo ./scripts/deploy/deploy.sh mydomain.com mvp
```

### For Server Setup

**Old way:**
```bash
./scripts/setup-server.sh
./scripts/setup-mvp-server.sh
```

**New way:**
```bash
REPO_URL=https://github.com/<org>/<repo>.git sudo ./scripts/setup/setup-server.sh production
REPO_URL=https://github.com/<org>/<repo>.git sudo ./scripts/setup/setup-server.sh mvp
```

## Documentation

- [RESOURCE_REQUIREMENTS.md](../docs/RESOURCE_REQUIREMENTS.md) - Resource requirements for all environments
- [INSTALLATION.md](../docs/INSTALLATION.md) - Installation guide
- [DEPLOYMENT.md](../docs/DEPLOYMENT.md) - Deployment guide

## Troubleshooting

### Port Conflicts

If you encounter port conflicts, the script will automatically use port offsets based on the environment. You can also manually set ports:

```bash
export POSTGRES_PORT=5433
./scripts/env/start-env.sh dev start
```

### Environment Variables Not Loading

Ensure your environment file exists:
```bash
ls -la .env*
```

Load it explicitly:
```bash
export ENVIRONMENT=test
./scripts/env/start-env.sh test start
```

### Services Not Starting

Check Docker status:
```bash
docker info
```

Check service logs:
```bash
./scripts/env/start-env.sh dev logs
```

## Best Practices

1. **Always use environment files** - Never hardcode credentials
2. **Use appropriate environments** - dev for development, test for testing, prod for production
3. **Run tests before deployment** - Use `pnpm run test:all`
4. **Monitor resource usage** - Check resource requirements documentation
5. **Keep backups** - Use backup scripts regularly
6. **Review logs** - Use `env:logs` to troubleshoot issues

## Contributing

When adding new scripts:
1. Place scripts in appropriate category directories (env/, test/, backup/, deploy/, setup/, ci/)
2. Source the config loader: `source scripts/lib/config-loader.sh`
3. Use environment variables for all configuration
4. Add health checks for services
5. Include error handling
6. Document usage in this README
7. Add corresponding NPM script if needed
