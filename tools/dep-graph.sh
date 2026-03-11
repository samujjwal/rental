#!/usr/bin/env bash
# tools/dep-graph.sh — Cross-module import analysis
# Run from repo root: bash tools/dep-graph.sh > outputs/dep-graph.txt
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== API: Cross-Module Imports ==="
echo "(module A → module B via direct file import)"
echo ""

for mod in apps/api/src/modules/*/; do
  modname=$(basename "$mod")
  # Find imports from other modules (not the same module)
  grep -rn "from.*modules/" "$mod" --include="*.ts" 2>/dev/null \
    | grep -v node_modules \
    | grep -v ".spec.ts" \
    | grep -v ".e2e-spec.ts" \
    | while read -r line; do
        target=$(echo "$line" | sed -n 's/.*modules\/\([^/]*\).*/\1/p')
        [ -n "$target" ] && [ "$target" != "$modname" ] && echo "  $modname → $target  ($line)"
      done
done | sort -u

echo ""
echo "=== API: common/ → modules/ Violations ==="
grep -rn "from.*modules/" apps/api/src/common/ --include="*.ts" 2>/dev/null \
  | grep -v node_modules \
  | grep -v ".spec.ts" \
  || echo "  (none — clean)"

echo ""
echo "=== API: Prisma Direct Access in Controllers ==="
grep -rn "this\.prisma\." apps/api/src/modules/*/controllers/ --include="*.ts" 2>/dev/null \
  || echo "  (none — clean)"

echo ""
echo "=== API: forwardRef Usage (Circular Dependency Markers) ==="
grep -rn "forwardRef" apps/api/src --include="*.ts" 2>/dev/null \
  | grep -v node_modules \
  | grep -v ".spec." \
  || echo "  (none)"

echo ""
echo "=== Web: shared-types Adoption ==="
echo "Files importing from shared-types:"
grep -rn "@rental-portal/shared-types\|~/lib/shared-types" apps/web/app --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v node_modules \
  | grep -v ".d.ts" \
  || echo "  (none)"

echo ""
echo "Files importing from local ~/types/:"
grep -rn "from.*~/types/" apps/web/app --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v node_modules \
  | wc -l | awk '{print "  " $1 " import statements from ~/types/"}'

echo ""
echo "=== Duplicate Library Detection ==="
echo "Form libraries in web:"
echo -n "  react-hook-form imports: "
grep -rc "react-hook-form\|useForm\|@hookform" apps/web/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ":0$" | wc -l | tr -d ' '
echo -n "  @tanstack/react-form imports: "
grep -rc "@tanstack/react-form" apps/web/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ":0$" | wc -l | tr -d ' '

echo ""
echo "=== API Module Sizes ==="
for mod in apps/api/src/modules/*/; do
  modname=$(basename "$mod")
  loc=$(find "$mod" -type f -name "*.ts" ! -name "*.spec.ts" ! -name "*.e2e-spec.ts" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
  printf "  %-25s %s LoC\n" "$modname" "${loc:-0}"
done | sort -t' ' -k2 -rn
