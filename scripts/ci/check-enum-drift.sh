#!/usr/bin/env bash
# CI Guardrail: Detect enum/contract drift between Prisma schema and shared-types
set -euo pipefail

SCHEMA="packages/database/prisma/schema.prisma"
GENERATED="packages/shared-types/src/enums.generated.ts"

# Extract enum names from Prisma schema
PRISMA_ENUMS=$(grep -E "^enum " "$SCHEMA" | awk '{print $2}' | sort)

# Extract enum names from generated file
GENERATED_ENUMS=$(grep -E "^export enum " "$GENERATED" | awk '{print $3}' | sort)

MISSING=""
for enum in $PRISMA_ENUMS; do
  if ! echo "$GENERATED_ENUMS" | grep -qx "$enum"; then
    MISSING="$MISSING  $enum\n"
  fi
done

if [ -n "$MISSING" ]; then
  echo "❌ GUARDRAIL VIOLATION: Enums in Prisma schema missing from shared-types:"
  echo -e "$MISSING"
  echo "Run: pnpm --filter shared-types generate"
  exit 1
fi

echo "✅ Enum contracts are in sync."
