#!/usr/bin/env bash
# CI Guardrail: Detect duplicate category schema definitions
# The backend CATEGORY_TEMPLATES registry is the canonical source.
# The web static category-fields.ts migration is COMPLETE and the file has been
# deleted. This check BLOCKS CI if the file is re-introduced.
set -euo pipefail

ERRORS=0

# Enforce that the deprecated static frontend registry does not exist.
# All callers have been migrated to GET /categories/slug/:slug/fields.
if [ -f "apps/web/app/lib/category-fields.ts" ]; then
  echo "❌ ERROR: Deprecated static category field registry has been re-introduced at"
  echo "   apps/web/app/lib/category-fields.ts"
  echo "   This file was deleted after migration. All callers must use:"
  echo "     listingsApi.getCategoryFieldDefinitions(slug)  →  GET /categories/slug/:slug/fields"
  ERRORS=$((ERRORS + 1))
fi

# Check for static backend category templates
if grep -q "CATEGORY_TEMPLATES" apps/api/src/modules/categories/services/category-template.service.ts 2>/dev/null; then
  echo "✅ Backend CATEGORY_TEMPLATES registry active (canonical source)"
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS category schema duplication error(s) found. Fix before merging."
  exit 1
fi

echo "✅ Category schema duplication check passed."
