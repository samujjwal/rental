# Documentation Consolidation Plan

This plan defines how we will reduce the current documentation sprawl into a
small, coherent live set while preserving useful detail in archive form.

## Objectives

- keep one canonical home for each type of knowledge
- remove duplicate status, report, summary, and audit documents from the live path
- preserve important historical detail without letting it drift into the source of truth
- clean out tracked generated artifacts and obvious temporary files
- make the repo easier to navigate for product, engineering, QA, and operations work

## Target Live Structure

```text
docs/
  README.md
  product/
    vision.md
    market-analysis.md
    requirements.md
    features.md
  architecture/
    overview.md
    domain-model.md
    capabilities/
    adr/
    diagrams/
  engineering/
    developer-guide.md
    testing.md
    deployment.md
    integrations.md
  operations/
    runbooks.md
    slo.md
  qa/
    manual-test-cases.md
    release-gates.md
  users/
    renter-manual.md
    owner-manual.md
    admin-manual.md
  traceability/
    requirements-matrix.md
  archive/
    audits/
    legacy-docs/
    test-reports/
    implementation-notes/
```

## Current State Summary

- Root contains many competing Markdown files with overlapping scope.
- `docs/architecture/` contains 19 prompt-style capability docs with mixed
  relationship to implemented code.
- `docs/architecture-audit/` contains useful audit material, but both live and
  historical versions are mixed with generated outputs.
- `apps/web/` contains implementation summaries and test status reports that
  should not stay as app-local source-of-truth docs.
- Tracked generated artifacts and temporary files are present in the repo.

## Classification Rules

Each existing file should be assigned one of four actions:

- `keep`
  Already canonical and current; retain in place or with a light rename.
- `merge`
  Fold its durable content into a target live doc, then remove the original.
- `archive`
  Move to `docs/archive/` because it is historical or report-oriented.
- `delete`
  Remove because it is generated, temporary, duplicated output, or no longer useful.

## Mapping Plan

### Repo Root

| Current file | Action | Target |
| --- | --- | --- |
| `README.md` | keep | Repo entry point, but trim status-report drift and broken links |
| `RequirementsForRentalSystem.md` | merge | `docs/product/requirements.md` |
| `COMPREHENSIVE_FEATURES_DOCUMENTATION.md` | merge | `docs/product/features.md` and `docs/product/vision.md` |
| `MOBILE_SPEC.md` | merge | `docs/product/features.md` and `docs/users/owner-manual.md` / `docs/users/renter-manual.md` where relevant |
| `MOBILE_WIREFRAMES.md` | merge | `docs/architecture/diagrams/` or `docs/product/features.md` |
| `GLOBAL_POLICY_ENGINE_SPEC.md` | merge | `docs/architecture/capabilities/policy-engine.md` |
| `BUILD_SYSTEM.md` | merge | `docs/engineering/developer-guide.md` |
| `PRODUCTION_DEPLOYMENT_GUIDE.md` | merge | `docs/engineering/deployment.md` |
| `EXTERNAL_SERVICES_SETUP.md` | merge | `docs/engineering/integrations.md` |
| `COMPREHENSIVE_TESTING_CHECKLIST.md` | merge | `docs/qa/manual-test-cases.md` and `docs/qa/release-gates.md` |
| `TEST_COVERAGE_ANALYSIS.md` | archive | `docs/archive/test-reports/` |
| `SYSTEM_TESTING_RESULTS.md` | archive | `docs/archive/test-reports/` |
| `COMPREHENSIVE_ALL_TESTS_STATUS.md` | archive | `docs/archive/test-reports/` |
| `FINAL_COMPREHENSIVE_TEST_STATUS.md` | archive | `docs/archive/test-reports/` |
| `E2E_TEST_COVERAGE_AND_EXECUTION_REPORT.md` | archive | `docs/archive/test-reports/` |
| `E2E_TEST_EXECUTION_COMPLETE_REPORT.md` | archive | `docs/archive/test-reports/` |
| `E2E_TEST_GAPS_COMPLETION_REPORT.md` | archive | `docs/archive/test-reports/` |
| `PRODUCTION_READINESS_AUDIT.md` | archive | `docs/archive/audits/` |
| `PRODUCTION_READINESS_AUDIT_DEEP.md` | archive | `docs/archive/audits/` |
| `PRODUCTION_READINESS_FIXES_COMPLETE.md` | archive | `docs/archive/implementation-notes/` |
| `ENTERPRISE_V2_DEEP_AUDIT_2026-03-21.md` | archive | `docs/archive/audits/` |
| `ENTERPRISE_10_10_IMPLEMENTATION_PROMPT.md` | archive | `docs/archive/implementation-notes/` |
| `ui_ux_ultra_strict_audit_report.md` | archive | `docs/archive/audits/` |
| fully superseded source docs after merge | archive | `docs/archive/legacy-docs/` |

### `docs/`

| Current file | Action | Target |
| --- | --- | --- |
| `docs/RUNBOOKS.md` | merge | `docs/operations/runbooks.md` |
| `docs/SLO.md` | merge | `docs/operations/slo.md` |
| `docs/TEST_SUITE_GUIDE.md` | merge | `docs/engineering/testing.md` |
| `docs/traceability/requirements-matrix.md` | keep | Canonical traceability doc |

### `docs/architecture/`

| Current set | Action | Target |
| --- | --- | --- |
| `01_ENTERPRISE_DOMAIN_MODEL.md` | merge | `docs/architecture/domain-model.md` |
| `02-19` capability docs | merge selectively | `docs/architecture/capabilities/` only for implemented, durable systems |
| prompt-only or speculative sections | archive | `docs/archive/audits/` or remove if fully redundant |

### `docs/architecture-audit/`

| Current set | Action | Target |
| --- | --- | --- |
| `README.md` | keep with rewrite | Index for current architecture audit material only |
| `audit-report.md` | keep or archive based on whether it stays current | Prefer archive if it becomes dated |
| `audit-report-v1.md` | archive | `docs/archive/audits/` |
| `refactor-tickets.md` | keep if still active | Otherwise archive |
| `refactor-tickets-v1.md` | archive | `docs/archive/implementation-notes/` |
| `outputs/` | delete or regenerate outside docs | Prefer `tools/outputs/` as the only generated location |
| `prompts/` | archive | Historical supporting material |

### `apps/web/`

| Current file | Action | Target |
| --- | --- | --- |
| `COMPREHENSIVE_TEST_STATUS.md` | archive | `docs/archive/test-reports/` |
| `FINAL_IMPLEMENTATION_STATUS.md` | archive | `docs/archive/implementation-notes/` |
| `P2_IMPLEMENTATION_SUMMARY.md` | archive | `docs/archive/implementation-notes/` |
| `TEST_COVERAGE_REPORT.md` | archive | `docs/archive/test-reports/` |
| `TEST_STATUS_SUMMARY.md` | archive | `docs/archive/test-reports/` |
| `UX_AUDIT_IMPLEMENTATION_SUMMARY.md` | archive | `docs/archive/implementation-notes/` |
| component-local READMEs | keep | Only where they explain a local subsystem |

### Generated And Temporary Files

Delete in cleanup pass:

- `.DS_Store`
- `apps/web/playwright-report/`
- `apps/web/test-results/`
- duplicated generated inventories under `docs/architecture-audit/outputs/` and `tools/outputs/`
- ad hoc local outputs under `outputs/` if they are no longer referenced

Delete when unreferenced:

- `test_api.sh`
- `test_booking_api.py`
- ad hoc root-level logs or manual probe outputs

Keep:

- `.maestro/` flow definitions
- durable repo scripts in `scripts/`, `tools/`, and app-level `scripts/`

## Execution Sequence

1. Create the target `docs/` structure and indexes.
2. Rewrite `README.md` to point only at canonical docs.
3. Merge product docs into `docs/product/`.
4. Merge engineering and operations docs into `docs/engineering/` and `docs/operations/`.
5. Reduce architecture docs to an overview, domain model, ADRs, diagrams, and a smaller capability set.
6. Move historical reports into `docs/archive/`.
7. Delete tracked generated artifacts and obvious temp files.
8. Run a link check and repo search for stale references.

## Done Criteria

- no live status or report docs remain at the repo root except the repo `README.md`
- all durable documentation lives under `docs/`
- generated artifacts are not tracked
- app-local summary docs are archived or removed
- the README has no broken internal links
