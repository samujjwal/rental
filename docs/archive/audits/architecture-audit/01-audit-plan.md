# 01. Audit Plan & Method — GharBatai Monorepo

> Scope: `apps/api` (NestJS 11), `apps/web` (React 19 / React Router 7), `apps/mobile` (Expo 52 / RN 0.76), plus 3 shared packages.

---

## Objectives

1. **Reduce library & version sprawl** — enforce a single blessed stack per concern, pinned versions across workspaces.
2. **Maximize reusability** — consolidate `shared-types` as single source of truth for contracts, enums, and domain types across API, web, and mobile.
3. **Enforce clean architecture layering** — no upward imports, no Prisma in controllers, no circular module deps.
4. **Improve testability** — raise coverage gates, add contract tests between API ↔ clients, close the mobile test gap.
5. **Improve observability** — structured logging with request IDs, OpenTelemetry tracing, Sentry error tracking, business metrics.
6. **Identify modules to merge/split/extract** — with rationale, migration steps, and effort estimates.
7. **Produce usage guides** — When/What/How/Where for every workspace package and API infrastructure module.
8. **Establish CI/CD guardrails** — SBOM generation, vulnerability scanning, architectural rule enforcement, coverage ratchets.

---

## Phases

### Phase 1: Discovery & Inventory (Complete)
- Run `tools/inventory.sh` → `outputs/inventory.json`
- Run `tools/dep-graph.sh` → `outputs/dep-graph.txt`
- Capture: LoC per package, dependency counts, version mismatches, cross-module imports, Prisma-in-controller violations, forwardRef usages, shared-types adoption metrics.

### Phase 2: Analysis & Synthesis (Complete)
- Classify modules by cohesion/coupling → merge/split candidates.
- Detect type duplication across `shared-types`, `web/types/`, `mobile-sdk`.
- Map architectural layer violations.
- Assess test pyramid gaps.

### Phase 3: Standards & Documentation (Complete)
- Blessed stack determination per concern.
- Architecture standards codified.
- Dependency governance policy.
- Testing strategy with quality gates.
- CI/CD guardrail recommendations.

### Phase 4: Execution Planning (Complete)
- 12 refactor tickets (REFACTOR-v2-001 through v2-012) prioritized P0–P3.
- Wave-based execution plan (3 sprints).
- Total estimated effort: 24–35.5 hours.

---

## Deliverables

| Deliverable | File | Status |
|-------------|------|--------|
| Audit report | `audit-report.md` | ✅ v2 complete |
| Dependency inventory | `outputs/dependency-inventory.md` | ✅ v3 refreshed |
| Merge/split/reuse report | `02-merge-split-reuse-report.md` | ✅ |
| Architecture standards | `03-architecture-standards.md` | ✅ |
| Dependency governance | `04-dependency-governance.md` | ✅ |
| Testing strategy | `05-testing-strategy.md` | ✅ |
| CI/CD guardrails | `06-ci-cd-guardrails.md` | ✅ |
| Refactor playbook | `07-refactor-playbook.md` | ✅ |
| Refactor tickets | `refactor-tickets.md` | ✅ v2 (12 tickets) |
| Module usage guides | `module-guides/README.md` | ✅ |
| Inventory scripts | `tools/inventory.sh`, `tools/dep-graph.sh` | ✅ |

---

## Metrics Collected

| Metric | Source | Value |
|--------|--------|-------|
| Total LoC | inventory.sh | 122,675 |
| API modules | inventory.sh | 21 |
| Prisma models / enums | inventory.sh | 43 / 39 |
| Web routes | inventory.sh | 72 |
| forwardRef usages | dep-graph.sh | 0 (fixed in v2 refactors) |
| Prisma-in-controller violations | dep-graph.sh | 0 (fixed in v2 refactors) |
| Cross-module imports | dep-graph.sh | 6 (bookings→5, search→1) |
| Upward violations (common→modules) | dep-graph.sh | 3 (1 intentional, 2 fixable) |
| shared-types consumers in web | dep-graph.sh | 8 files direct, 28 via local `~/types/` |
| Version mismatches | inventory.sh | 4 deps (2 accepted, 2 constraint-blocked) |
