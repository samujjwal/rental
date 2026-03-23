# Unified Product Quality Audit

Date: 2026-03-16
Scope: web, api, mobile, database, integrations, automation, UX, architecture, operability
Auditor: GitHub Copilot using GPT-5.4
Verdict: Broad, real product surface with major reliability gaps. Current state is not 10/10 production grade.

## Executive Scorecard

| Area | Score | Evidence | What blocks 10/10 | Remediation to reach 10/10 |
| --- | ---: | --- | --- | --- |
| Product completeness | 8.5/10 | Large route surface in web/mobile, 24+ API modules, 78 Prisma models | Some admin and diagnostics surfaces are still mock or disconnected | Remove mock-only surfaces, finish operational pages, and enforce route-to-backend parity checks in CI |
| Architecture integrity | 4.5/10 | `apps/api` architecture lint failed with 17 violations and circular dependencies | Common layer reaches module internals, cyclical service graphs, oversized orchestration services | Enforce dep-cruiser in CI, extract shared contracts to common, split mega-services, eliminate circulars to zero |
| Booking lifecycle correctness | 7.8/10 | Core lifecycle now passes the targeted isolated Playwright dispute, return-damage, and payment retry slice after route/auth/CORS/UI fixes | Full-suite reliability still depends on keeping isolated preview/API wiring deterministic and reducing route complexity | Keep critical lifecycle paths green in hermetic CI, simplify route action logic further, and retain regression coverage for sticky layouts and direct route loads |
| Payments and escrow reliability | 5.5/10 | Strong domain breadth and hardening work exists, but representative escrow E2E failed on missing Redis | Financial workflow depends on infra availability without graceful degradation, reconciliation visibility is incomplete | Add resilient degraded mode, separate infra-required and mocked suites, finish reconciliation dashboards and alerting |
| Database integrity | 8.0/10 | Rich schema, explicit financial models, recent hardening migration for FK behavior and overlap constraints | More invariants still live in application code instead of DB, migration validation not consistently correlated to flows | Add more exclusion/unique/check constraints, run schema drift and migration smoke tests in CI, publish persistence matrices |
| Integration resilience | 6.0/10 | Stripe, Redis, storage, email, messaging, AI and websocket integrations are wired | Limited degraded-mode behavior, admin visibility is partial, external failure handling varies by module | Standardize timeout, retry, circuit breaker, and observability policies across all integrations |
| Automation coverage | 7.5/10 | Extensive API tests, Playwright suites, mobile tests, load and chaos surfaces | Coverage inventory is strong but representative high-risk flows still fail in live execution | Move from quantity to reliability: gate critical-path suites, quarantine flaky tests, and publish red/green critical path dashboard |
| Web UX and navigation | 7.0/10 | Strong route coverage, shared shell, renter/owner/admin portals | Sticky header interaction conflicts, some dashboard/system data contracts drift, cognitive load remains high in admin areas | Fix shell ergonomics, align contracts, add targeted interaction tests for fixed/sticky layouts, simplify admin information density |
| Mobile parity | 7.5/10 | Real navigation tree and real API client, broad feature presence | Automation depth and parity validation trail web, some state handling remains fragmented | Add higher-confidence end-to-end mobile flows, contract tests against shared APIs, and parity score tracking |
| Observability and operations | 5.0/10 | Health endpoints and system pages exist, plus runbooks and monitoring scaffolding | Diagnostics were partially mock-backed, cron/queue visibility is incomplete, command reconciliation needed more first-class surfacing | Ship real diagnostics, queue/cron telemetry, redline SLOs, synthetic checks, and operator dashboards tied to real backend state |
| Security and abuse controls | 7.5/10 | Auth, throttling, moderation, fraud, policy, compliance, audit logs are present | Architecture drift and operational blind spots weaken assurance | Keep controls but add evidence-driven validation: security regression suites, threat-model refresh, and audit sampling dashboards |
| Performance and scale-readiness | 6.0/10 | Multi-region and deployment planning exists, caching/queueing are present | Live reliability still breaks before true scale validation, and architecture drift increases latency risk | Fix correctness and resilience first, then run repeatable load budgets and capacity regressions on critical flows |

## Overall Verdict

Overall score: 6.6/10

The platform is materially implemented, not speculative. It spans renter, owner, admin, payments, disputes, insurance, messaging, organizations, analytics, and mobile surfaces. The main gap is not missing features; it is reliability discipline. Several critical paths still fail under representative execution, and architecture guardrails are declared more strongly than they are enforced.

## Highest-Risk Findings

1. Architecture rules are red in the API.
   Evidence: dependency-cruiser reported 17 violations, including common-to-module breaches and circular dependencies.
   Risk: hidden coupling, brittle refactors, unpredictable blast radius.
   10/10 target: zero dep-cruiser violations, enforced in CI and release gates.

2. Critical booking lifecycle interactions required both product and environment hardening.
   Evidence: representative isolated Playwright failures traced to a combination of duplicate stepper CTAs, client-auth/bootstrap fragility, and isolated-preview CORS/API wiring mismatches.
   Risk: renters and owners can be redirected away from critical actions or lose confidence in booking state progression when environment assumptions drift.
   10/10 target: all critical booking lifecycle tests green in hermetic CI, with direct route loads, sticky layout interactions, and isolated-preview wiring covered by regression checks.

3. Financial flow validation is infra-fragile.
   Evidence: escrow lifecycle E2E failed with Redis connection refusal instead of cleanly isolating infra requirements.
   Risk: financial correctness becomes hard to prove and hard to recover when dependencies are degraded.
   10/10 target: clear separation of mocked, hermetic, and infra-integrated financial suites, with deterministic reconciliation and alerting.

4. Lifecycle visibility and diagnostics were below operator-grade.
   Evidence: admin diagnostics existed as a mock/orphan route during audit.
   Risk: on-call and admin users lack trustworthy operational visibility.
   10/10 target: real diagnostics page backed by live API data, queue/cron telemetry, and operator-focused failure surfacing.

## Remediation Program To Reach 10/10

### Phase 1: Stop the Known Bleeding

Target score impact: +1.0 to +1.5

1. Fix all representative critical-path failures already observed in live validation.
2. Make admin diagnostics real and reachable.
3. Remove low-value mock surfaces from production navigation unless clearly marked as development-only.
4. Stabilize booking action interactions under sticky/shared shells.
5. Separate test failures caused by infrastructure absence from product regressions.

### Phase 2: Restore Architectural Trust

Target score impact: +0.8 to +1.2

1. Reduce API architecture lint violations to zero.
2. Move shared contracts and types into common infrastructure, never into feature internals.
3. Split orchestration-heavy services like booking and marketplace services into smaller use-case units.
4. Enforce acyclic module boundaries in CI.

### Phase 3: Prove Financial Correctness

Target score impact: +0.8 to +1.0

1. Complete payment command reconciliation surfaces and admin visibility.
2. Add synthetic failure drills for Redis, Stripe webhooks, and payout/refund command processing.
3. Publish an explicit state-and-ledger consistency matrix for booking, payment, refund, payout, and deposit flows.
4. Gate releases on critical financial suite health.

### Phase 4: Upgrade Product Operations

Target score impact: +0.5 to +0.8

1. Add queue and cron status endpoints with real freshness and failure counts.
2. Add synthetic user journeys covering search, booking, checkout, payout, and dispute filing.
3. Add dashboard-level SLOs for API latency, checkout success, booking state transition success, webhook lag, and reconciliation lag.
4. Correlate runbooks to real dashboards and alerts.

### Phase 5: Tighten UX and Parity

Target score impact: +0.4 to +0.7

1. Audit all sticky/fixed shell interactions for pointer interception and scroll ergonomics.
2. Reduce admin cognitive load by prioritizing decision-critical telemetry over decorative metrics.
3. Bring mobile parity from feature-presence to validated flow-parity.
4. Add accessibility and responsive regression baselines for lifecycle-critical screens.

## Non-Negotiable 10/10 Exit Criteria

1. Zero architecture-lint violations in protected branches.
2. Zero known critical-path Playwright failures in hermetic CI.
3. Financial reconciliation dashboards and alerts show green for payout, refund, and deposit-release commands.
4. Every operator-facing system page is backed by live data, not placeholders.
5. Database-level constraints protect against double-booking and orphaned financial records.
6. Critical user journeys are green across web and validated on mobile.
7. Production SLOs and synthetic checks are defined, measured, and actively reviewed.

## Immediate Next Steps Executed In This Pass

1. Replace the mock admin diagnostics surface with a real admin diagnostics route backed by existing admin APIs.
2. Make the diagnostics page reachable from admin routing.
3. Reduce one architecture violation by moving payment command contracts into common infrastructure.
4. Stabilize the booking lifecycle interaction helper to avoid sticky-header click interception in Playwright.

## Immediate Next Steps Still Open

1. Add explicit cron and queue telemetry endpoints so diagnostics can show truth instead of placeholders.
2. Split critical-path test suites into hermetic and infra-required tiers and gate on the hermetic tier first.
3. Make isolated preview/API environment wiring explicit in repeatable scripts so verification does not depend on ad hoc shell state.

## Remediation Progress Update

Post-audit remediation in this branch removed the API architecture-lint failures entirely.

- `apps/api` dependency-cruiser status moved from 17 violations at audit time, to 16 after payment-command type extraction, to 9 after common-auth and scheduler boundary cleanup, and then to 0 after extracting shared moderation, marketplace, and insurance types into neutral files.
- The admin diagnostics route was replaced with a live-data implementation and wired into admin routing/navigation.
- The admin system backend now returns live queue, scheduler, process, database, and audit-log telemetry instead of placeholder values, and the system UI was updated to consume the richer uptime and telemetry payloads.
- Web typecheck is green and API build is green.
- The API health controller's database probe was corrected to use a direct Prisma query instead of the failing Terminus Prisma indicator path in the local environment; an isolated API instance on `3402` now reports healthy database and overall status.
- Runtime verification is no longer blocked by environment bootstrapping. An isolated web preview on `3403` successfully served against the healthy isolated API on `3402`, and public API/listing plus dev-login checks passed.
- The last direct-route auth failures on the isolated stack were traced to API CORS defaults that allowed `localhost` preview origins but not the actual `127.0.0.1:3403` browser origin. Expanding dev CORS defaults and restarting the isolated API with explicit `CORS_ORIGINS` fixed the `/auth/login` bounce on protected booking and dispute routes.
- The booking detail page was hardened to rely on loader-derived role plus backend transitions, and the shared API client now avoids forced login navigation when no access token existed yet during early hydration.
- Shared web auth bootstrap now normalizes persisted `HOST` and `OWNER` roles consistently in both `root.tsx` and `utils/auth.ts`, preventing owner sessions from silently degrading into renter navigation and owner-only route redirects.
- The booking progress stepper no longer competes with the sidebar action panel on the booking detail page: duplicate inline lifecycle CTAs were disabled there so primary actions such as `Pay Now` resolve to a single authoritative control.
- After rebuilding the isolated preview against `VITE_API_URL=http://127.0.0.1:3402/api`, the targeted Playwright booking lifecycle verification for dispute redirects, dispute back-navigation, owner return-damage handling, and renter payment retry paths passed `7/7` on Chromium.
- The web package now exposes repeatable isolated verification entrypoints: `start:isolated`, `start:isolated:skip-build`, and `test:e2e:isolated`, with the preview launcher building against the isolated API URL and starting Vite preview via a stable Node entrypoint.
- The repo root now exposes `dev:isolated`, `dev:isolated:skip-build`, `test:e2e:web:isolated`, `test:e2e:web:isolated:core`, and `test:e2e:web:isolated:comprehensive`, so the verified API `3402` plus web `3403` stack can be started and tested from one command path instead of shell history.
- Wider isolated runtime verification is green beyond booking lifecycle: `owner-dashboard`, `renter-dashboard`, `owner-listings`, `search-browse`, and `messages` passed `131/131`, and `payments-reviews-notifications` passed `21/21` against the `3403 -> 3402` stack.
- The new repo-level isolated runner was validated on alternate ports without disturbing the live verification stack: API health passed on `3412` and web preview health passed on `3413`.
- README guidance now documents the isolated stack workflow, expected ports, environment behavior, and alternate-port override example so the validated `3402 -> 3403` path is discoverable for future contributors.