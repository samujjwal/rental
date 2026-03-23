#!/usr/bin/env bash
# CI Guardrail: Marketplace Sub-Module Boundary Enforcement
#
# Checks that services within one Marketplace sub-module do not directly
# import services from another Marketplace sub-module by bypassing the
# published barrel index files.
#
# Exit code: 0 = clean, 1 = violations found (blocks CI merge).

set -euo pipefail

MARKETPLACE="apps/api/src/modules/marketplace"
ERRORS=0

echo "=== Marketplace Sub-Module Boundary Check ==="
echo ""

# Map: sub-module name → space-separated list of service file basenames (no .ts)
AI_SERVICES="ai-concierge.service multi-modal-search.service demand-forecasting.service expansion-planner.service"
PRICING_SERVICES="pricing-intelligence.service liquidity-engine.service tax-policy-engine.service country-policy-pack.service policy-pack-loader.service geo-distribution.service"
COMPLIANCE_SERVICES="compliance-automation.service fraud-intelligence.service reputation.service dispute-resolution.service"
OPERATIONS_SERVICES="checkout-orchestrator.service payment-orchestration.service availability-graph.service inventory-graph.service observability.service bulk-operations.service"

check_cross_imports() {
  local from_module="$1"
  local from_services="$2"
  local to_module="$3"
  local to_services="$4"

  for target_svc in $to_services; do
    for from_svc in $from_services; do
      from_file="$MARKETPLACE/services/${from_svc}.ts"
      [[ -f "$from_file" ]] || continue

      if grep -q "from.*/${target_svc}" "$from_file" 2>/dev/null; then
        echo "  ❌ Cross-boundary import: ${from_module}/${from_svc}.ts"
        echo "     directly imports ${to_module}/${target_svc}"
        echo "     Use sub-modules/marketplace-${to_module}.index.ts barrel instead."
        ERRORS=$((ERRORS + 1))
      fi
    done
  done
}

# Check each sub-module against all others
check_cross_imports "ai"          "$AI_SERVICES"         "pricing"     "$PRICING_SERVICES"
check_cross_imports "ai"          "$AI_SERVICES"         "compliance"  "$COMPLIANCE_SERVICES"
check_cross_imports "ai"          "$AI_SERVICES"         "operations"  "$OPERATIONS_SERVICES"

check_cross_imports "pricing"     "$PRICING_SERVICES"    "ai"          "$AI_SERVICES"
check_cross_imports "pricing"     "$PRICING_SERVICES"    "compliance"  "$COMPLIANCE_SERVICES"
check_cross_imports "pricing"     "$PRICING_SERVICES"    "operations"  "$OPERATIONS_SERVICES"

check_cross_imports "compliance"  "$COMPLIANCE_SERVICES" "ai"          "$AI_SERVICES"
check_cross_imports "compliance"  "$COMPLIANCE_SERVICES" "pricing"     "$PRICING_SERVICES"
check_cross_imports "compliance"  "$COMPLIANCE_SERVICES" "operations"  "$OPERATIONS_SERVICES"

check_cross_imports "operations"  "$OPERATIONS_SERVICES" "ai"          "$AI_SERVICES"
check_cross_imports "operations"  "$OPERATIONS_SERVICES" "pricing"     "$PRICING_SERVICES"
check_cross_imports "operations"  "$OPERATIONS_SERVICES" "compliance"  "$COMPLIANCE_SERVICES"

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ $ERRORS cross-sub-module boundary violation(s) found."
  echo "   Cross-module service imports must go through the published barrel files:"
  echo "   apps/api/src/modules/marketplace/sub-modules/marketplace-<domain>.index.ts"
  exit 1
else
  echo "✅ All marketplace sub-module boundary checks passed."
  exit 0
fi
