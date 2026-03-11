# 07. Refactor Playbook — GharBatai Monorepo

> Execution plan for the 12 REFACTOR-v2 tickets. Organized in 3 waves (sprints).
> See [refactor-tickets.md](refactor-tickets.md) for full ticket details.

---

## Wave Overview

| Wave | Sprint | Theme | Tickets | Est. Hours |
|------|--------|-------|---------|-----------|
| **1** | Sprint 1 | Quick wins: layer fixes, dedup, CI wiring | v2-001, v2-006, v2-008, v2-011, v2-012 | 5–7h |
| **2** | Sprint 2 | Architecture: circular dep, consolidation, god-service | v2-002, v2-004, v2-005, v2-010 | 8–12h |
| **3** | Sprint 3 | Contracts: shared-types SSOT, auth fix, coverage gates | v2-003, v2-007, v2-009 | 11–15h |

**Total: 24–35.5 hours across ~3 sprints**

---

## Wave 1 — Quick Wins (Sprint 1)

Low-risk, high-impact changes. Most are independent and parallelizable.

### v2-001 · Extract Prisma calls from controllers → services (P0)
- **Scope:** 7 Prisma calls in 2 controllers (bookings: 1, organizations: 6)
- **Risk:** None — pure refactor, no behavior change
- **Verify:** Run API test suite; verify no runtime regressions
- **2–3h**

### v2-006 · Remove duplicate form library (P2)
- **Scope:** Convert 1 file (`EnhancedForm.tsx`) from `@tanstack/react-form` → `react-hook-form`
- **Risk:** None — single file
- **Verify:** Manual test of admin enhanced form; run web tests
- **30min–1h**

### v2-008 · Align dependency versions (P2)
- **Scope:** Remove duplicate deps from API `package.json`; standardize versions
- **Risk:** Low — pnpm resolves from lockfile
- **Verify:** `pnpm install && pnpm turbo build test`
- **1h**

### v2-011 · Bulk-update auth imports to common/auth barrel (P2)
- **Scope:** ~31 files: change `@/modules/auth/guards/*` → `@/common/auth`
- **Risk:** None — import path change only
- **Verify:** API tests; grep for remaining direct imports
- **1h**

### v2-012 · Wire SBOM + Trivy in CI (P3)
- **Scope:** Add 2 CI steps (CycloneDX + sarif upload)
- **Risk:** None
- **Verify:** CI run succeeds; sarif appears in GitHub Security tab
- **30min**

---

## Wave 2 — Architecture (Sprint 2)

Structural improvements requiring more careful execution.

### v2-002 · Resolve Listings ↔ Search circular dependency (P1)
- **Scope:** Remove `forwardRef` by moving search endpoint or extracting interface
- **Risk:** Medium — route URL must remain stable
- **Verify:** E2E test that search endpoints still work; `npx madge --circular apps/api/src/`
- **2–3h**

### v2-004 · Consolidate notification controllers (P1)
- **Scope:** Merge 5 → 3 controllers in notifications module
- **Risk:** Low — route consolidation
- **Verify:** API e2e test notifications; manual Swagger verification
- **1–2h**

### v2-005 · Split admin.service.ts god-service (P1)
- **Scope:** Extract analytics + user-mgmt from 3,000 LoC service
- **Risk:** Medium — large file, careful method extraction needed
- **Verify:** Full admin test suite; manual admin dashboard check
- **4–6h**

### v2-010 · Wire dependency-cruiser in CI + Turbo (P2)
- **Scope:** Add `arch-lint` Turbo task; add CI step
- **Risk:** Low — may surface existing violations that need fixing
- **Verify:** `pnpm turbo arch-lint` passes; CI green
- **1h**

---

## Wave 3 — Contracts & Quality (Sprint 3)

Largest impact, highest effort. Builds on Wave 1 (auth fix must precede types migration).

### v2-007 · Fix auth token dual-write (P2)
- **Scope:** Remove direct `localStorage.setItem('accessToken')` calls; use Zustand persist exclusively
- **Risk:** Medium — must verify all auth flows
- **Verify:** Login/logout/refresh E2E tests; manual testing
- **Must complete BEFORE v2-003**
- **1–2h**

### v2-003 · Consolidate shared-types as SSOT (P1)
- **Scope:** ~30 web files, shared-types enrichment, mobile-sdk deletion
- **Risk:** High — large surface area; do in 2–3 incremental PRs:
  1. PR 1: Enrich shared-types (add admin types, fix AuthResponse)
  2. PR 2: Migrate web imports (delete `~/types/`)
  3. PR 3: Delete mobile-sdk, update mobile imports
- **Verify:** Full build (`pnpm turbo build`); all test suites
- **8–12h**

### v2-009 · Add web + mobile coverage gates (P2)
- **Scope:** Add coverage config to Vitest + mobile Jest; add CI steps
- **Risk:** Low
- **Verify:** CI run with coverage reporting
- **2h**

---

## Dependency Graph

```
v2-001 → standalone
v2-002 → standalone
v2-003 → depends on v2-007 (auth token field name must be resolved first)
v2-004 → standalone
v2-005 → standalone
v2-006 → standalone
v2-007 → standalone (but blocks v2-003)
v2-008 → standalone
v2-009 → standalone
v2-010 → standalone
v2-011 → standalone
v2-012 → standalone
```

Most tickets are independent. Only `v2-003 → v2-007` has a hard dependency.

---

## Execution Checklist

### Per-Ticket Process

- [ ] Create feature branch from `main`
- [ ] Implement change
- [ ] Run affected test suite
- [ ] Run `pnpm turbo build` to verify cross-package builds
- [ ] Update relevant audit doc if metrics change
- [ ] PR with ticket ID in title
- [ ] Merge after CI passes + review

### Post-Wave Validation

- [ ] Re-run `bash tools/inventory.sh > tools/outputs/inventory.json`
- [ ] Re-run `bash tools/dep-graph.sh > tools/outputs/dep-graph.txt`
- [ ] Diff metrics against previous run
- [ ] Update `outputs/dependency-inventory.md` with new numbers
- [ ] Update `audit-report.md` findings status

---

## Effort Summary

| Priority | Count | Total Estimate |
|----------|-------|---------------|
| P0 | 1 | 2–3h |
| P1 | 4 | 15–23h |
| P2 | 6 | 6.5–9h |
| P3 | 1 | 0.5h |
| **Total** | **12** | **24–35.5h** |
