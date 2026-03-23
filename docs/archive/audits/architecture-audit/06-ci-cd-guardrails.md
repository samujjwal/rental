# 06. CI/CD Guardrails — GharBatai Monorepo

> Updated: 2026-02-25 · Reflects post-refactor pipeline state

---

## 1  Current Pipeline

```yaml
# .github/workflows/ci.yml (simplified)
jobs:
  lint-and-format:     # ESLint + Prettier across workspace
  typecheck:           # pnpm turbo typecheck
  test-api:            # Jest (49 suites, 648 tests, 26% ratchet)
  build:               # pnpm turbo build
  security-scan:       # pnpm audit + Trivy container scan
  e2e-tests:           # Playwright (PR-only)
```

## 2  Guardrail Status

| Guardrail | Status | Details |
|-----------|--------|---------|
| **Lint + Format** | ✅ Enforced | ESLint + Prettier via Turbo |
| **TypeScript typecheck** | ✅ Enforced | `pnpm turbo typecheck` |
| **API unit tests** | ✅ Enforced | Jest with 26% ratcheted coverage threshold |
| **Web unit tests** | ⚠️ Runs, no gate | Vitest runs but no coverage threshold |
| **Mobile unit tests** | ⚠️ Runs, no gate | Jest runs but no coverage threshold |
| **E2E tests** | ✅ PR-gated | Playwright for web; API e2e via Jest |
| **Security audit** | ✅ Enforced | `pnpm audit` (upgraded from `npm audit`) |
| **Container scan** | ⚠️ Partial | Trivy runs, sarif generated, **not uploaded** to GitHub Security |
| **SBOM generation** | ❌ Missing | No CycloneDX or SPDX output |
| **Arch lint** | ⚠️ Partial | `.dependency-cruiser.cjs` exists but not in Turbo task or CI |
| **Coverage ratchet** | ⚠️ API only | Web and mobile have no threshold |

## 3  Recommended Pipeline (Target State)

```yaml
jobs:
  lint-and-format:
    steps:
      - pnpm turbo lint format:check

  typecheck:
    needs: [lint-and-format]
    steps:
      - pnpm turbo typecheck          # add ^typecheck dependency in turbo.json

  arch-lint:
    needs: [typecheck]
    steps:
      - pnpm turbo arch-lint          # dependency-cruiser rules
    # New Turbo task: "arch-lint": { "dependsOn": ["^build"], "outputs": [] }

  test:
    needs: [typecheck]
    strategy:
      matrix:
        app: [api, web, mobile]
    steps:
      - pnpm turbo test --filter=@rental-portal/${{ matrix.app }}
      - coverage threshold check (26% API, 10% web, 10% mobile)

  build:
    needs: [test]
    steps:
      - pnpm turbo build

  security:
    needs: [build]
    steps:
      - pnpm audit --audit-level moderate
      - trivy image scan → sarif
      - github/codeql-action/upload-sarif@v3    # NEW: upload to Security tab
      - pnpm dlx @cyclonedx/cyclonedx-npm --output-file sbom.json
      - actions/upload-artifact (sbom.json)

  e2e:
    needs: [build]
    if: github.event_name == 'pull_request'
    steps:
      - Playwright tests
      - API e2e tests
```

## 4  Turbo Configuration Updates Needed

```jsonc
// turbo.json additions
{
  "tasks": {
    "typecheck": {
      "dependsOn": ["^typecheck"]     // Currently missing ^typecheck
    },
    "arch-lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "e2e": {
      "dependsOn": ["build"],
      "outputs": []
    }
  }
}
```

## 5  Coverage Thresholds

| App | Current | Target (Sprint 3) | Enforcement |
|-----|---------|-------------------|-------------|
| API | 26% (ratchet) | 40% | Jest `coverageThreshold` |
| Web | Not tracked | 10% | Vitest `coverage.thresholds` |
| Mobile | Not tracked | 10% | Jest `coverageThreshold` |

## 6  Branch Protection Rules

| Rule | Recommended Setting |
|------|-------------------|
| Required reviews | 1 minimum |
| Required status checks | lint, typecheck, arch-lint, test-api, test-web, build |
| Dismiss stale reviews | Yes |
| CODEOWNERS required for | `packages/database/**`, `packages/shared-types/**` |
| Force push protection | Enabled on `main` |

## 7  Supply Chain Security

| Tool | Purpose | Status |
|------|---------|--------|
| `pnpm audit` | Known vulnerability check | ✅ In CI |
| Trivy | Container image scanning | ⚠️ Runs but no GitHub integration |
| CycloneDX SBOM | Software bill of materials | ❌ Not wired |
| Renovate | Automated dependency PRs | ✅ Configured |
| GitHub Dependabot | Security alerts | ✅ Active |

## 8  Action Items

See refactor tickets:
- **REFACTOR-v2-010** — Wire dependency-cruiser into CI + Turbo
- **REFACTOR-v2-009** — Add web and mobile coverage gates
- **REFACTOR-v2-012** — Wire SBOM generation and Trivy upload
