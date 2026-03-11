# 04. Dependency Governance & Version Discipline — GharBatai Monorepo

---

## Goals

1. **No sprawl:** Single version per library across the monorepo (exceptions documented).
2. **Pinned versions** with Renovate automation and workspace-level overrides.
3. **Third-party hidden** behind product-level abstractions (`common/email/`, `common/storage/`, etc.).
4. **No unapproved libraries** — new deps require review against the blessed stack.

---

## Controls

### 1. pnpm Workspace + Lockfile

- **Single `pnpm-lock.yaml`** at root ensures all packages resolve from the same lockfile.
- `pnpm-workspace.yaml` declares `apps/*` and `packages/*` as workspace members.
- Workspace protocol (`workspace:*`) enforces local package resolution.

### 2. Version Overrides (Root `package.json`)

When a dependency needs to be aligned across all packages, add an `overrides` block:

```jsonc
// package.json (root) — add when needed
{
  "pnpm": {
    "overrides": {
      "axios": "^1.13.4",
      "socket.io-client": "^4.8.3"
    }
  }
}
```

### 3. Renovate Configuration

`renovate.json` at root handles automated dependency PRs:
- Group `@nestjs/*` packages together
- Group `@types/*` with their runtime packages
- Auto-merge patch bumps for blessed dependencies
- Require manual review for major bumps

### 4. Dependency Allowlist

New dependencies must be vetted against the blessed stack (see `03-architecture-standards.md §2`). Direct introductions of competing libraries are blocked:

| Category | Blessed | Banned Alternatives |
|----------|---------|-------------------|
| Forms (web) | `react-hook-form` | `@tanstack/react-form`, `formik` |
| Validation (API) | `class-validator` | `joi`, `yup` |
| Validation (web) | `zod` | `joi`, `yup`, `class-validator` |
| State (web) | `zustand` + `@tanstack/react-query` | `redux`, `mobx`, `jotai`, `recoil` |
| HTTP client | `axios` | `got`, `node-fetch`, `ky` (except mobile-sdk) |
| Styling (web) | `tailwindcss` | `styled-components`, `emotion`, `css-modules` |
| Email (API) | Resend via `EmailPort` | `@sendgrid/mail`, `nodemailer` |
| Icons (web) | `lucide-react` | `react-icons`, `heroicons` |
| Date | `date-fns` | `moment`, `dayjs`, `luxon` |

---

## Current Version Alignment Status

### Aligned ✅

| Dependency | Version | Packages |
|-----------|---------|----------|
| typescript | ^5.9.3 | All 6 |
| axios | ^1.13.4 | api, web |
| date-fns | ^4.1.0 | api, web |
| stripe | ^20.3.0 | api, web |
| socket.io-client | ^4.8.3 | api (dev), web, mobile |
| eslint | ^9.39.2 | api, web |
| prettier | ^3.8.1 | root, api, web |
| prisma / @prisma/client | ^7.3.0 | api, database |
| bcrypt / @types/bcrypt | ^6.0.0 | api, database |

### Accepted Splits ⚠️

| Dependency | Split | Reason |
|-----------|-------|--------|
| react | 19 (web) vs 18 (mobile) | Expo 52 pins React 18 — cannot upgrade until Expo 53 |
| @types/react | 19 vs 18 | Follows react |
| jest | 30 (api) vs 29 (mobile) | `jest-expo` ~52.0.0 requires Jest 29 |
| @types/jest | 30 vs 29 | Follows jest |

### Actionable Items

| Issue | Action | Ticket |
|-------|--------|--------|
| `bcrypt` + `@types/bcrypt` in both API and database | Remove from API — transitive via database | REFACTOR-v2-008 |
| `stripe` server SDK in web `dependencies` | Move to devDependencies or remove (only `@stripe/stripe-js` needed client-side) | Housekeeping |
| Web still has 0 `pnpm.overrides` | Add overrides as needed for forced alignment | — |

---

## Governance Workflow

### Adding a New Dependency

1. Check the blessed stack in `03-architecture-standards.md §2`.
2. If the concern already has a blessed library, use it.
3. If no blessed library exists, open an RFC-style PR:
   - Document: What problem does this solve? What's the API surface? Bundle size impact?
   - Get architecture review.
4. Add to blessed stack doc after approval.

### Removing a Deprecated Dependency

1. Ensure all consumers have migrated (grep for imports).
2. Remove from all `package.json` files.
3. Run `pnpm install` to clean lockfile.
4. Verify build + tests pass.
5. Update blessed stack doc.

### Version Bump Policy

| Bump Type | Automation | Review |
|-----------|-----------|--------|
| Patch (1.2.x) | Renovate auto-merge | None |
| Minor (1.x.0) | Renovate PR | CI must pass |
| Major (x.0.0) | Renovate PR | Manual review required |
| Security fix | Renovate priority PR | Fast-track merge |

---

## Supply Chain Security

| Tool | Purpose | Status |
|------|---------|--------|
| `pnpm audit` | Known CVE check | ✅ In CI |
| Renovate | Automated dependency PRs | ✅ Configured |
| GitHub Dependabot | Security alerts | ✅ Active |
| Trivy | Container image scanning | ⚠️ Runs, no GitHub Security upload |
| CycloneDX SBOM | Software bill of materials | ❌ Not wired in CI |

**Target (REFACTOR-v2-012):**
```bash
# Generate SBOM
pnpm dlx @cyclonedx/cyclonedx-npm --output-file sbom.json

# Upload Trivy results to GitHub Security tab
github/codeql-action/upload-sarif@v3
```
