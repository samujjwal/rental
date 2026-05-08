---
status: canonical
owner: engineering
last_reviewed: 2026-05-08
source_of_truth: true
---

# Developer Guide

This is the canonical starting point for local engineering workflows in the monorepo.

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0
- Docker & Docker Compose
- PostgreSQL >= 15 (with pgvector extension)
- Redis >= 7

## Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd rental
pnpm run setup

# Start services
pnpm run services:up

# Start development servers
pnpm run dev:full
```

Services available at:
- API: http://localhost:3400
- API Docs: http://localhost:3400/api/docs
- Web App: http://localhost:3401

## Workspace Overview

- `apps/api`
  NestJS backend API
- `apps/web`
  React Router web application
- `apps/mobile`
  React Native / Expo mobile app
- `packages/database`
  Prisma schema, migrations, seed logic, and database utilities
- `packages/shared-types`
  shared contract types

## Tooling

- `pnpm` for workspace package management
- `turbo` for monorepo task orchestration
- `TypeScript` for static typing
- `ESLint` and `Prettier` for linting and formatting
- `Jest`, `Vitest`, `Playwright`, Maestro, and k6 for testing

## Core Local Commands

```bash
# Setup
pnpm run setup              # Install dependencies and prepare environment
pnpm run services:up        # Start Docker services (PostgreSQL, Redis)
pnpm run services:down      # Stop Docker services

# Development
pnpm run dev                # Start API + web + mobile
pnpm run dev:full           # Start all services (API + web + Docker services)
pnpm run dev:api            # Start API only
pnpm run dev:web            # Start web only
pnpm run dev:mobile         # Start mobile only

# Isolated validation stack
pnpm run dev:isolated       # Start isolated API + web for validation
pnpm run dev:isolated:manual # Start isolated stack in fail-open mode

# Quality
pnpm run lint               # Run ESLint
pnpm run typecheck          # Run TypeScript type checking
pnpm run test               # Run all tests
pnpm run validate           # Run all quality checks
```

## Database Workflows

```bash
# Prisma commands
pnpm run db:generate        # Generate Prisma client
pnpm run db:migrate         # Run database migrations
pnpm run db:seed            # Seed database with sample data
pnpm run db:studio          # Open Prisma Studio
pnpm run db:push            # Push schema changes to database
pnpm run db:pull            # Pull schema from database
```

## Environment Configuration

### Development

```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
# Required: DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET
# Optional: Stripe keys, email service, storage configuration
```

### Test

```bash
# Copy test environment template
cp .env.example .env.test

# Test environment uses port offsets to avoid conflicts
# PostgreSQL: 6432, Redis: 7379
```

## Quality Guardrails

- use `pnpm run lint` and `pnpm run typecheck` before pushing large changes
- use `pnpm run guardrails` for repository-specific CI checks
- prefer repo scripts over one-off local commands when the workflow is repeatable
- do not treat generated reports as source-of-truth documentation

## Troubleshooting

### Port Conflicts

```bash
# Check what's using a port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # API
```

### Docker Issues

```bash
# Check Docker is running
docker info

# Clean up Docker resources
docker system prune -a
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres
```

## Related Docs

- [`testing.md`](testing.md)
- [`deployment.md`](deployment.md)
- [`integrations.md`](integrations.md)
- [`../operations/runbooks.md`](../operations/runbooks.md)
