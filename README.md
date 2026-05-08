# Universal Rental Portal

A production-ready, multi-category rental marketplace platform supporting spaces, vehicles, instruments, event venues, event items, and wearables.

**Current Status:** Active development  
**Live Documentation Home:** [docs/README.md](docs/README.md)

## Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd rental
pnpm run setup

# Start all services (Docker recommended)
pnpm run dev:full

# Run tests
pnpm run test
```

Services available at:
- API: http://localhost:3400
- API Docs: http://localhost:3400/api/docs
- Web App: http://localhost:3401

## Architecture

Turbo monorepo with:
- **apps/api**: NestJS backend
- **apps/web**: React Router v7 web app
- **apps/mobile**: React Native mobile app
- **packages/database**: Prisma schema and migrations

## Tech Stack

- **Backend**: NestJS, TypeScript, Prisma, PostgreSQL (pgvector), Redis
- **Web**: React Router v7, TailwindCSS
- **Mobile**: React Native, Expo
- **Payments**: Stripe Connect
- **Real-time**: Socket.io with Redis adapter
- **Infrastructure**: Docker (local), serverless containers (cloud target)

## Core Commands

```bash
# Development
pnpm run dev:full          # Start all services
pnpm run dev:isolated      # Isolated validation stack

# Testing
pnpm run test              # All workspace tests
pnpm run test:coverage     # Coverage report
pnpm run test:integration  # API integration tests
pnpm run test:e2e:web      # Web end-to-end tests
pnpm run test:e2e:mobile   # Mobile E2E tests

# Services
pnpm run services:up       # Start Docker services
pnpm run services:down     # Stop Docker services
```

## Documentation

See [docs/README.md](docs/README.md) for canonical documentation:
- [Product Vision](docs/product/vision.md)
- [Developer Guide](docs/engineering/developer-guide.md)
- [Testing Guide](docs/engineering/testing.md)
- [Deployment Guide](docs/engineering/deployment.md)
- [Integrations](docs/engineering/integrations.md)
- [Runbooks](docs/operations/runbooks.md)

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0
- Docker & Docker Compose
- PostgreSQL >= 15 (with pgvector)
- Redis >= 7

## License

MIT License - see LICENSE file for details.

## Support

Open an issue on GitHub for questions and support.
