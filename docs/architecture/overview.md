# Architecture Overview

This document is the canonical high-level architecture summary for the monorepo.

## Workspace Shape

- `apps/api`
  NestJS backend organized into domain modules such as auth, listings, bookings,
  payments, search, messaging, reviews, disputes, insurance, notifications,
  analytics, marketplace, moderation, and policy-related services.
- `apps/web`
  React Router application covering guest, renter, owner, organization, and admin flows.
- `apps/mobile`
  React Native / Expo client covering core renter and owner journeys.
- `packages/database`
  Prisma schema, migrations, and seed logic.
- `packages/shared-types`
  shared type contracts used across workspaces.

## Core Architectural Layers

### Client Layer

- web and mobile experiences
- route loaders, forms, view models, and local interaction logic

### API Layer

- controllers, DTOs, guards, interceptors, and module boundaries
- orchestration of business flows across product domains

### Domain And Service Layer

- listing, availability, booking, pricing, payment, messaging, trust, dispute,
  moderation, analytics, and policy services

### Persistence Layer

- Prisma models and migrations
- relational integrity, enums, and persistence-oriented constraints

## Dominant Product Domains

- identity and organization
- catalog and listing management
- availability and inventory
- booking lifecycle
- payments, taxes, and payouts
- messaging and notifications
- trust, moderation, reviews, disputes, and insurance
- operations, analytics, and policy enforcement

## Integration Model

The system relies on external providers for:

- Stripe payments
- email delivery
- SMS and push notifications
- object storage
- optional AI and search enhancements

Those integrations should be treated as boundary concerns and configured
through environment-specific settings documented in
[`../engineering/integrations.md`](../engineering/integrations.md).

## Architectural Guidance

- keep durable architectural decisions in ADRs
- keep speculative or dated design material in archive, not in the live path
- prefer capability-specific docs only for implemented or actively maintained systems

## Related Docs

- [`domain-model.md`](domain-model.md)
- [`capabilities/policy-engine.md`](capabilities/policy-engine.md)
- [`../adr/`](../adr/)
