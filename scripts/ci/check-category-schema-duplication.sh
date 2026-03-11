#!/usr/bin/env bash
# CI Guardrail: Detect duplicate category schema definitions
# Only DB-backed definitions should be canonical.
# Flag if both static frontend and backend registries are still present.
set -euo pipefail

WARNINGS=0

# Check for static frontend category field registry
if [ -f "apps/web/app/lib/category-fields.ts" ]; then
  LINES=$(wc -l < "apps/web/app/lib/category-fields.ts" | tr -d ' ')
  if [ "$LINES" -gt 10 ]; then
    echo "⚠️  WARNING: Static category field registry still active in apps/web/app/lib/category-fields.ts ($LINES lines)"
    echo "   This should be replaced by server-driven category schema from API."
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Check for static backend category templates
if grep -q "CATEGORY_TEMPLATES" apps/api/src/modules/categories/services/category-template.service.ts 2>/dev/null; then
  echo "⚠️  WARNING: Static CATEGORY_TEMPLATES registry still active in backend."
  echo "   This should be migrated to DB-backed CategoryAttributeDefinition."
  WARNINGS=$((WARNINGS + 1))
fi

if [ $WARNINGS -gt 0 ]; then
  echo ""
  echo "⚠️  $WARNINGS category schema duplication warning(s) found."
  echo "   These are tracked for migration but do not block CI."
  exit 0  # Warning only, not blocking
fi

echo "✅ No duplicate category schema sources detected."
