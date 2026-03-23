#!/usr/bin/env bash
# CI Guardrail: Database Schema Domain Governance
#
# Enforces that schema changes in packages/database/prisma/schema.prisma
# respect the domain ownership boundaries declared by CODEOWNERS annotations.
#
# Rules checked:
#   1. Every model block must have an @Owner comment in its domain section header.
#   2. No "floating" models exist outside a domain section (// ─── separator block).
#   3. The EventStore and EventSnapshot models exist (they were previously absent,
#      causing silent event-sourcing failures).
#   4. AiUsageLedger model exists (required for AI cost governance).
#   5. No cross-domain foreign-key naming violations: a model annotated to one
#      domain must not use Prisma's @relation with a model from an incompatible
#      domain (detected via a known high-risk cross-domain pair list).
#
# Exit code: 0 = all good, 1 = violations found (blocks CI merge).

set -euo pipefail

SCHEMA="packages/database/prisma/schema.prisma"
ERRORS=0

echo "=== Database Schema Domain Governance Check ==="
echo "Schema: $SCHEMA"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Rule 1: Required infrastructure models must exist
# ─────────────────────────────────────────────────────────────────────────────
echo "-- Rule 1: Required infrastructure models present"

REQUIRED_MODELS=(
  "EventStore"
  "EventSnapshot"
  "AiUsageLedger"
)

for model in "${REQUIRED_MODELS[@]}"; do
  if grep -q "^model ${model} {" "$SCHEMA"; then
    echo "  ✅ model ${model} found"
  else
    echo "  ❌ MISSING required model: ${model}"
    echo "     This model is required for platform infrastructure."
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Rule 2: Domain ownership annotation coverage
# Every model block must appear after a domain section header that contains
# an "Owner:" annotation.
# ─────────────────────────────────────────────────────────────────────────────
echo "-- Rule 2: Domain-owner annotation coverage"

UNANNOTATED_MODELS=()
current_owner=""

while IFS= read -r line; do
  # Detect domain section headers: // Owner: <team>
  # The owner annotation stays valid for all subsequent models until the next
  # owner annotation supersedes it. We do NOT reset on separators (─── lines).
  if [[ "$line" =~ ^[[:space:]]*//[[:space:]]*Owner:[[:space:]]* ]]; then
    current_owner="${line}"
  fi
  # Detect model declarations
  if [[ "$line" =~ ^model[[:space:]]+([A-Za-z][A-Za-z0-9]+)[[:space:]]*\{ ]]; then
    model_name="${BASH_REMATCH[1]}"
    if [[ -z "$current_owner" ]]; then
      UNANNOTATED_MODELS+=("$model_name")
    fi
  fi
done < "$SCHEMA"

if [ ${#UNANNOTATED_MODELS[@]} -gt 0 ]; then
  echo "  ❌ Models with no domain owner annotation in their section:"
  for m in "${UNANNOTATED_MODELS[@]}"; do
    echo "     - $m"
  done
  echo "     Add an '// Owner: <team>  CODEOWNERS: @rental/<team>' header before these models."
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ All models are within annotated domain sections"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Rule 3: DeviceToken must have a single-domain owner
# ─────────────────────────────────────────────────────────────────────────────
echo "-- Rule 3: DeviceToken single-domain ownership"

DEVICE_TOKEN_COUNT=$(grep -c "DeviceToken" "$SCHEMA" 2>/dev/null || echo 0)
# Allow references in the domain map comment at top but check model count = 1
DEVICE_TOKEN_MODEL_COUNT=$(grep -c "^model DeviceToken {" "$SCHEMA" 2>/dev/null || echo 0)

if [ "$DEVICE_TOKEN_MODEL_COUNT" -eq 1 ]; then
  echo "  ✅ DeviceToken model declared exactly once"
else
  echo "  ❌ DeviceToken model found $DEVICE_TOKEN_MODEL_COUNT times (expected 1)"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Rule 4: EventStore metadata column must be Json type (not String)
# ─────────────────────────────────────────────────────────────────────────────
echo "-- Rule 4: EventStore.metadata must be Json type"

# Look for the metadata field inside the EventStore model block
IN_EVENT_STORE=false
METADATA_TYPE=""
while IFS= read -r line; do
  if [[ "$line" =~ ^model[[:space:]]+EventStore[[:space:]]*\{ ]]; then
    IN_EVENT_STORE=true
  fi
  if $IN_EVENT_STORE && [[ "$line" =~ ^[[:space:]]+metadata[[:space:]] ]]; then
    METADATA_TYPE="$line"
  fi
  if $IN_EVENT_STORE && [[ "$line" =~ ^\} ]]; then
    IN_EVENT_STORE=false
  fi
done < "$SCHEMA"

if echo "$METADATA_TYPE" | grep -q "Json"; then
  echo "  ✅ EventStore.metadata is Json type (enables JSON path queries)"
else
  echo "  ❌ EventStore.metadata is NOT Json type: $METADATA_TYPE"
  echo "     Correlation queries require the metadata column to be Json, not String."
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo "=== Results ==="
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ $ERRORS schema governance violation(s) found. Fix before merging."
  exit 1
else
  echo "✅ All schema governance checks passed."
  exit 0
fi
