---
status: archived
owner: engineering
last_reviewed: 2026-05-08
source_of_truth: false
---

# Documentation Cleanup Disposition Table

**Date:** 2026-05-08  
**Plan:** rental-docs-cleanup-plan-reviewed-v2.md  
**Status:** In Progress

---

## Disposition Table

| File | Action | Target | Preserve Content | Delete After Merge | Notes |
|------|--------|--------|-----------------|------------------|-------|
| **Root Level** | | | | | |
| README.md | REWRITE | N/A | N/A | N/A | Reduce to 150-250 lines, concise entry point |
| SCRIPTS_CLEANUP.md | DELETE | N/A | N/A | N/A | Implementation note, superseded by canonical docs |
| **Apps - API** | | | | | |
| apps/api/TEST_INVENTORY.md | DELETE | N/A | N/A | N/A | Generated inventory, superseded |
| apps/api/src/modules/payments/PAYMENT_IDEMPOTENCY_AUDIT_REPORT.md | DELETE | N/A | N/A | N/A | Audit report, extract if any durable content |
| apps/api/src/modules/policy-engine/POLICY_ENGINE_AUDIT_REPORT.md | DELETE | N/A | N/A | N/A | Audit report, extract if any durable content |
| **Apps - Mobile** | | | | | |
| apps/mobile/.expo/README.md | KEEP | N/A | N/A | N/A | Local subsystem README, allowed |
| apps/mobile/.maestro/README.md | KEEP | N/A | N/A | N/A | Local subsystem README, allowed |
| apps/mobile/README.md | KEEP | N/A | N/A | N/A | Local subsystem README, allowed |
| **Apps - Web** | | | | | |
| apps/web/app/components/accessibility/README.md | KEEP | N/A | N/A | N/A | Local subsystem README, allowed |
| apps/web/app/components/animations/README.md | KEEP | N/A | N/A | N/A | Local subsystem README, allowed |
| apps/web/app/components/map/README.md | KEEP | N/A | N/A | N/A | Local subsystem README, allowed |
| apps/web/e2e/INSURANCE_CLAIMS_AUDIT_REPORT.md | DELETE | N/A | N/A | N/A | Audit report, superseded |
| apps/web/e2e/MOBILE_COVERAGE_AUDIT_REPORT.md | DELETE | N/A | N/A | N/A | Audit report, superseded |
| apps/web/e2e/README.md | KEEP | N/A | N/A | N/A | Local subsystem README, allowed |
| apps/web/e2e/WEBSOCKET_TEST_AUDIT_REPORT.md | DELETE | N/A | N/A | N/A | Audit report, superseded |
| apps/web/scripts/local/README.md | KEEP | N/A | N/A | N/A | Local subsystem README, allowed |
| **Docs - Root Level** | | | | | |
| docs/CONSOLIDATION_PLAN.md | ARCHIVE | docs/archive/implementation-notes/ | Yes | N/A | Historical implementation plan |
| docs/DEPENDENCY_HYGIENE_REPORT.md | DELETE | N/A | N/A | N/A | Audit report, superseded |
| docs/DEPLOYMENT.md | MERGE | docs/engineering/deployment.md | Yes | Yes | Merge into canonical deployment doc |
| docs/E2E_SCRIPT_CONVERSION.md | DELETE | N/A | N/A | N/A | Implementation note, superseded |
| docs/INSTALLATION.md | MERGE | docs/engineering/developer-guide.md | Yes | Yes | Merge into developer guide |
| docs/OPERATIONS_GUIDE.md | MERGE | docs/operations/runbooks.md | Yes | Yes | Merge into runbooks |
| docs/PRISMA_ACCESS_VIOLATIONS.md | DELETE | N/A | N/A | N/A | Audit report, superseded |
| docs/README.md | UPDATE | N/A | N/A | N/A | Update to only link to canonical docs |
| docs/RELEASE_CHECKLIST.md | MERGE | docs/qa/release-gates.md | Yes | Yes | Merge into release gates |
| docs/RESOURCE_REQUIREMENTS.md | DELETE | N/A | N/A | N/A | Implementation note, superseded |
| docs/ROUTE_SCREEN_INVENTORY.md | DELETE | N/A | N/A | N/A | Generated inventory, superseded |
| **Docs - ADR** | | | | | |
| docs/adr/001-listing-extensibility.md | KEEP | N/A | N/A | N/A | ADR, add metadata |
| docs/adr/002-i18n-strategy.md | KEEP | N/A | N/A | N/A | ADR, add metadata |
| docs/adr/003-currency-fx-strategy.md | KEEP | N/A | N/A | N/A | ADR, add metadata |
| docs/adr/004-availability-modes.md | KEEP | N/A | N/A | N/A | ADR, add metadata |
| **Docs - Architecture** | | | | | |
| docs/architecture/capabilities/policy-engine.md | MERGE | docs/architecture/capabilities.md | Yes | Yes | Merge into single capabilities doc |
| docs/architecture/domain-model.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| docs/architecture/overview.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| **Docs - Archive** | | | | | |
| docs/archive/audits/PRODUCT_V4_1_COMPREHENSIVE_AUDIT_REPORT.md | KEEP | N/A | N/A | N/A | Already archived, add archive metadata |
| docs/archive/audits/ci-cd-gatekeeper-decision.md | KEEP | N/A | N/A | N/A | Already archived, add archive metadata |
| **Docs - Audits** | | | | | |
| docs/audits/FAILING_TEST_TRACKER.md | DELETE | N/A | N/A | N/A | Status report, extract active tasks if any |
| docs/audits/end-to-end-rental-marketplace-correctness-todos.md | ARCHIVE | docs/archive/audits/ | Yes | N/A | Historical TODO list, valuable reference |
| **Docs - Engineering** | | | | | |
| docs/engineering/README.md | CREATE | N/A | N/A | N/A | Need to create |
| docs/engineering/ai-restructuring-plan.md | DELETE | N/A | N/A | N/A | Implementation plan, superseded |
| docs/engineering/deployment.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| docs/engineering/developer-guide.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| docs/engineering/integrations.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| docs/engineering/marketplace-restructuring-plan.md | DELETE | N/A | N/A | N/A | Implementation plan, superseded |
| docs/engineering/notification-consolidation-plan.md | DELETE | N/A | N/A | N/A | Implementation plan, superseded |
| docs/engineering/testing.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| **Docs - Operations** | | | | | |
| docs/operations/README.md | CREATE | N/A | N/A | N/A | Need to create |
| docs/operations/runbooks.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| docs/operations/slo.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| **Docs - Product** | | | | | |
| docs/product/README.md | CREATE | N/A | N/A | N/A | Need to create |
| docs/product/features.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| docs/product/requirements.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| docs/product/vision.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| **Docs - QA** | | | | | |
| docs/qa/FINAL_AUDIT_REPORT.md | DELETE | N/A | N/A | N/A | Audit report, superseded |
| docs/qa/README.md | CREATE | N/A | N/A | N/A | Need to create |
| docs/qa/TESTING_STRATEGY.md | MERGE | docs/engineering/testing.md | Yes | Yes | Merge into engineering/testing.md |
| docs/qa/e2e-architecture.md | DELETE | N/A | N/A | N/A | Implementation note, superseded |
| **Docs - Testing** | | | | | |
| docs/testing/TEST_RECLASSIFICATION_GUIDE.md | DELETE | N/A | N/A | N/A | Implementation note, superseded |
| docs/testing/TEST_STRATEGY.md | MERGE | docs/engineering/testing.md | Yes | Yes | Merge into engineering/testing.md |
| docs/testing/ULTRA_STRICT_100_PERCENT_COVERAGE_AUDIT_REPORT.md | DELETE | N/A | N/A | N/A | Audit report, superseded |
| docs/testing/test-boundaries.md | DELETE | N/A | N/A | N/A | Implementation note, superseded |
| **Docs - Traceability** | | | | | |
| docs/traceability/FEATURE_TRACEABILITY_MATRIX.md | DELETE | N/A | N/A | N/A | Generated matrix, superseded |
| docs/traceability/README.md | CREATE | N/A | N/A | N/A | Need to create |
| docs/traceability/requirements-matrix.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| **Docs - Users** | | | | | |
| docs/users/README.md | CREATE | N/A | N/A | N/A | Need to create |
| docs/users/admin-manual.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| docs/users/owner-manual.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| docs/users/renter-manual.md | KEEP | N/A | N/A | N/A | Canonical, add metadata |
| **Scripts** | | | | | |
| scripts/README.md | KEEP | N/A | N/A | N/A | Local subsystem README, allowed |

---

## Summary

- **Total files:** 54
- **KEEP:** 23 (canonical docs and local subsystem READMEs)
- **MERGE THEN DELETE:** 8
- **ARCHIVE:** 3
- **DELETE:** 17
- **CREATE:** 5 (missing README files)
- **REWRITE:** 1 (root README.md)
- **UPDATE:** 1 (docs/README.md)

---

## Next Steps

1. Phase 1: Create missing README files
2. Phase 2: Rewrite root README.md
3. Phase 3: Merge durable content
4. Phase 4: Delete and archive files
5. Phase 5: Add metadata blocks
6. Phase 6: Validate links and cleanliness
