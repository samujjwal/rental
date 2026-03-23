# Developer Guide

This is the canonical starting point for local engineering workflows in the monorepo.

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
pnpm run setup
pnpm run services:up
pnpm run dev:full

pnpm run dev
pnpm run dev:api
pnpm run dev:web
pnpm run dev:mobile

pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run validate
```

## Database Workflows

```bash
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
pnpm run db:studio
```

## Quality Guardrails

- use `pnpm run lint` and `pnpm run typecheck` before pushing large changes
- use `pnpm run guardrails` for repository-specific CI checks
- prefer repo scripts over one-off local commands when the workflow is repeatable
- do not treat generated reports as source-of-truth documentation

## Related Docs

- [`testing.md`](testing.md)
- [`deployment.md`](deployment.md)
- [`integrations.md`](integrations.md)
