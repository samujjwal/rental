#!/usr/bin/env bash
# CI Guardrail: Detect direct Prisma access in controller files
# Controllers must delegate to services, not access PrismaService directly.
set -euo pipefail

VIOLATIONS=0
VIOLATION_FILES=""

while IFS= read -r file; do
  # Skip spec files
  [[ "$file" == *".spec."* ]] && continue
  
  if grep -qE "this\.\w+\[.prisma.\]|private.*prisma.*:.*PrismaService|this\.prisma\." "$file" 2>/dev/null; then
    VIOLATIONS=$((VIOLATIONS + 1))
    VIOLATION_FILES="$VIOLATION_FILES\n  $file"
  fi
done < <(find apps/api/src/modules -path "*/controllers/*.ts" -type f)

if [ $VIOLATIONS -gt 0 ]; then
  echo "❌ GUARDRAIL VIOLATION: Direct Prisma access found in $VIOLATIONS controller(s):"
  echo -e "$VIOLATION_FILES"
  echo ""
  echo "Controllers must not access PrismaService directly. Move data access to the owning service."
  exit 1
fi

echo "✅ No direct Prisma access in controllers."
