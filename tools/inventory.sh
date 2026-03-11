#!/usr/bin/env bash
# tools/inventory.sh — Monorepo metrics collector
# Run from repo root: bash tools/inventory.sh > outputs/inventory.json
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "{"

# 1. LOC per package
echo '  "loc": {'
first=true
for dir in apps/api/src apps/web/app apps/mobile/src packages/database/src packages/database/prisma packages/shared-types/src packages/mobile-sdk/src; do
  [ -d "$dir" ] || continue
  count=$(find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) ! -path "*/node_modules/*" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
  $first && first=false || echo ","
  printf '    "%s": %s' "$dir" "${count:-0}"
done
echo ""
echo "  },"

# 2. Test file count by app
echo '  "testFiles": {'
api_tests=$(find apps/api -type f \( -name "*.spec.ts" -o -name "*.e2e-spec.ts" \) ! -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')
web_tests=$(find apps/web/tests apps/web/e2e -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" \) ! -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')
mobile_tests=$(find apps/mobile -type f -name "*.test.*" ! -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')
printf '    "api": %s,\n    "web": %s,\n    "mobile": %s\n' "$api_tests" "$web_tests" "$mobile_tests"
echo "  },"

# 3. Route count
routes=$(find apps/web/app/routes -type f -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "  \"webRoutes\": $routes,"

# 4. Prisma stats
models=$(grep -c "^model " packages/database/prisma/schema.prisma 2>/dev/null || echo 0)
enums=$(grep -c "^enum " packages/database/prisma/schema.prisma 2>/dev/null || echo 0)
schema_loc=$(wc -l < packages/database/prisma/schema.prisma 2>/dev/null | tr -d ' ')
echo "  \"prisma\": { \"models\": $models, \"enums\": $enums, \"schemaLoc\": $schema_loc },"

# 5. API module count
api_modules=$(ls -d apps/api/src/modules/*/ 2>/dev/null | wc -l | tr -d ' ')
echo "  \"apiModules\": $api_modules,"

# 6. forwardRef count (circular dep markers)
fwd_refs=$(grep -rc "forwardRef" apps/api/src --include="*.ts" 2>/dev/null | grep -v ":0$" | grep -v ".spec." | wc -l | tr -d ' ')
fwd_refs=${fwd_refs:-0}
echo "  \"forwardRefs\": $fwd_refs,"

# 7. Prisma-in-controller violations
prisma_ctrl=$(grep -rn "this\.prisma\." apps/api/src/modules/*/controllers/ --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
prisma_ctrl=${prisma_ctrl:-0}
echo "  \"prismaInControllers\": $prisma_ctrl,"

# 8. Dependency counts per package
echo '  "deps": {'
first=true
for pkg in package.json apps/api/package.json apps/web/package.json apps/mobile/package.json packages/database/package.json packages/shared-types/package.json packages/mobile-sdk/package.json; do
  [ -f "$pkg" ] || continue
  name=$(node -e "console.log(require('./$pkg').name || '$pkg')")
  deps=$(node -e "console.log(Object.keys(require('./$pkg').dependencies||{}).length)")
  devdeps=$(node -e "console.log(Object.keys(require('./$pkg').devDependencies||{}).length)")
  $first && first=false || echo ","
  printf '    "%s": { "deps": %s, "devDeps": %s }' "$name" "$deps" "$devdeps"
done
echo ""
echo "  },"

# 9. Version mismatches
echo '  "versionMismatches": ['
node -e "
const fs = require('fs');
const pkgs = ['apps/api/package.json','apps/web/package.json','apps/mobile/package.json','packages/database/package.json','packages/shared-types/package.json','packages/mobile-sdk/package.json'];
const all = {};
pkgs.forEach(p => {
  if (!fs.existsSync(p)) return;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const deps = { ...j.dependencies, ...j.devDependencies };
  Object.entries(deps).forEach(([k, v]) => {
    if (!all[k]) all[k] = {};
    all[k][p.split('/').slice(0,2).join('/')] = v;
  });
});
const mismatches = Object.entries(all)
  .filter(([, vs]) => new Set(Object.values(vs)).size > 1)
  .map(([dep, vs]) => ({ dep, versions: vs }));
console.log(JSON.stringify(mismatches, null, 4));
" | sed 's/^/    /'
echo "  ]"

echo "}"
