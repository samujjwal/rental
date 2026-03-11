# 03. Architecture Standards — GharBatai Monorepo

> Applies to: NestJS API, React Router web, Expo React Native mobile

---

## 1  Layering Model

```
┌─────────────────────────────────────────────────┐
│  Routes / Controllers / Gateways  (Adapters)    │  ← HTTP, WebSocket, cron entry points
├─────────────────────────────────────────────────┤
│  Services  (Application / Use-Cases)            │  ← Business logic, orchestration
├─────────────────────────────────────────────────┤
│  Common Infrastructure  (Ports & Adapters)      │  ← Email, storage, cache, queue, telemetry
├─────────────────────────────────────────────────┤
│  Database / Prisma  (Data Access)               │  ← Models, queries, migrations
├─────────────────────────────────────────────────┤
│  Shared Types / Contracts  (Domain Layer)       │  ← Interfaces, enums, DTOs
└─────────────────────────────────────────────────┘
```

### Rules

| Rule | Enforcement | Tool |
|------|-------------|------|
| Controllers MUST NOT inject `PrismaService` | dependency-cruiser rule | `arch-lint` Turbo task |
| `common/` MUST NOT import from `modules/` (except `common/auth/` barrel) | dependency-cruiser rule | `arch-lint` |
| No circular module dependencies (`forwardRef`) | dependency-cruiser no-circular | `arch-lint` |
| Modules import auth guards from `@/common/auth/` (not `@/modules/auth/`) | Code review / codemod | REFACTOR-v2-011 |
| Web components import types from `~/lib/shared-types.ts` or `@rental-portal/shared-types` | ESLint import rule | Future |
| No vendor-specific code in feature modules (S3, Twilio, Resend) | Code review | `common/` abstractions |

### Valid Import Directions

```
modules/* → common/*       ✅  Feature modules use infrastructure
modules/* → modules/*      ⚠️  Allowed but tracked (cross-module deps must be explicit)
common/*  → common/*       ✅
common/*  → modules/*      ❌  Upward violation (except auth barrel)
controllers → services     ✅
controllers → PrismaService ❌  Must go through services
```

---

## 2  Blessed Stack

### API (NestJS)

| Concern | Blessed | Rationale |
|---------|---------|-----------|
| Framework | NestJS 11 + Express 5 | Mature, decorator-based, module system |
| ORM | Prisma 7.x with `@prisma/adapter-pg` | Type-safe queries, schema-first |
| Validation | `class-validator` + `class-transformer` | NestJS-native, decorator DTOs |
| Queue | Bull + Redis | Reliable job processing |
| Email | Resend via `common/email/EmailPort` | Abstracted behind port interface |
| Storage | S3 (MinIO local) via `common/storage/StorageService` | Abstracted |
| Auth | Passport + JWT + bcrypt | Standard |
| Logging | Winston + `x-request-id` correlation | Structured JSON logs |
| Tracing | `@opentelemetry/sdk-node` | Automatic instrumentation |
| Error tracking | `@sentry/nestjs` | Exception capture with context |
| Testing | Jest 30 + Supertest | Standard NestJS testing |
| Build | SWC (via `nest build --builder swc`) | Fast compilation |

### Web (React)

| Concern | Blessed | Rationale |
|---------|---------|-----------|
| Framework | React 19 + React Router 7 | SSR framework mode |
| Bundler | Vite 7 | Fast dev, good chunk splitting |
| Styling | Tailwind CSS 4 + `tailwind-merge` | Utility-first, Tailwind v4 |
| State (client) | Zustand 5 | Lightweight, no boilerplate |
| State (server) | TanStack Query 5 | Cache, refetch, optimistic |
| Forms | react-hook-form 7 + Zod 4 | performant forms + schema validation |
| HTTP | axios | Consistent with API |
| UI | `components/ui/` (custom) | Tailwind-based design system |
| Icons | lucide-react | Tree-shakeable SVG icons |
| Animations | framer-motion | Declarative |
| Maps | Leaflet + react-leaflet | OSM-based (Nepal context) |
| Testing (unit) | Vitest + Testing Library | Fast, Vite-native |
| Testing (E2E) | Playwright | Cross-browser |

### Mobile (React Native)

| Concern | Blessed | Rationale |
|---------|---------|-----------|
| Framework | Expo 52, React Native 0.76, React 18 | Expo managed flow |
| Navigation | React Navigation 7 | Native stack + bottom tabs |
| Types | `@rental-portal/shared-types` (direct) | Single source of truth |
| Testing | Jest + Testing Library (React Native) | Standard |

### Shared Packages

| Package | Purpose | Consumers |
|---------|---------|-----------|
| `@rental-portal/shared-types` | Contracts, enums, domain types | Web, Mobile (target: + API) |
| `@rental-portal/database` | Prisma schema, migrations, seed | API |
| `@rental-portal/mobile-sdk` | ⛔ Deprecated — migrate to direct shared-types | Mobile |

---

## 3  Module Patterns

### API Module Structure

Every API feature module follows this convention:

```
modules/<name>/
├── <name>.module.ts              # NestJS module registration
├── controllers/
│   └── <name>.controller.ts      # HTTP routes, DTOs → services
├── services/
│   ├── <name>.service.ts         # Core business logic
│   └── <name>.service.spec.ts    # Unit tests
├── dto/
│   └── <name>.dto.ts             # class-validator DTOs
├── processors/                   # Bull queue processors (if async work)
└── gateways/                     # WebSocket gateways (if real-time)
```

**Rules:**
- Controllers receive DTOs, delegate to services, return responses
- Services own business logic and Prisma queries
- DTOs validate input at boundary using class-validator decorators
- Cross-module calls go through injected services (NestJS DI)

### Web Route Pattern

```
routes/<name>.tsx                 # Route component with loader/action
lib/api/<name>.ts                 # API client calls for this domain
lib/validation/<name>.ts          # Zod schemas for forms
types/<name>.ts                   # Type re-exports (→ migrate to shared-types)
components/<name>/                # Domain-specific components
```

---

## 4  Vendor Abstraction

Third-party services MUST be hidden behind product-level interfaces in `common/`.

| Vendor | Abstraction | Location |
|--------|-------------|----------|
| AWS S3 / MinIO | `StorageService` | `common/storage/` |
| Resend | `EmailPort` interface | `common/email/` |
| Redis | `CacheService` | `common/cache/` |
| Sentry | Exception filter | `common/telemetry/` |
| OpenTelemetry | Auto-instrumentation | `common/telemetry/` |
| Stripe | `StripeService` | `modules/payments/` (domain-bound) |
| Twilio | `TwilioService` | `modules/notifications/` (**should** be in `common/sms/`) |

**Gap:** Twilio and Resend services in `modules/notifications/` should be extracted to `common/sms/` and `common/email/` respectively, behind vendor-agnostic port interfaces.

---

## 5  Observability Standards

| Pillar | Implementation | Status |
|--------|---------------|--------|
| **Structured Logging** | Winston with JSON format, `x-request-id` correlation | ✅ |
| **Distributed Tracing** | `@opentelemetry/sdk-node` auto-instrumentation | ✅ |
| **Error Tracking** | `@sentry/nestjs` exception filter | ✅ |
| **Health Checks** | Terminus: DB + Redis | ✅ |
| **Business Metrics** | Custom metrics (booking rates, payments) | ⏳ Not yet |

**Next:** Add custom business metrics for booking completion rate, payment success rate, search latency P50/P95.

---

## 6  Security Standards

| Control | Implementation | Status |
|---------|---------------|--------|
| Helmet (HTTP headers) | Global middleware in `main.ts` | ✅ |
| CORS | Origin-aware configuration | ✅ |
| Rate limiting | `@nestjs/throttler` (60s/100 req) | ✅ |
| JWT authentication | Passport + access/refresh tokens | ✅ |
| RBAC | `RolesGuard` + `@Roles()` decorator | ✅ |
| Input validation | `ValidationPipe` (whitelist + transform) | ✅ |
| Password hashing | bcrypt (rounds from config) | ✅ |
| MFA | TOTP via otplib | ✅ |
| SBOM | CycloneDX | ⏳ Not wired in CI |
| Container scanning | Trivy | ⚠️ Runs but no GitHub upload |
| Dependency audit | `pnpm audit` | ✅ |
