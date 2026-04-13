#!/usr/bin/env bash
# Run all CI guardrail checks
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXIT_CODE=0

echo "=== Running CI Guardrails ==="
echo ""

for script in "$SCRIPT_DIR"/ci/check-*.sh; do
  echo "--- Running $(basename "$script") ---"
  if bash "$script"; then
    echo ""
  else
    EXIT_CODE=1
    echo ""
  fi
done

if [ $EXIT_CODE -eq 0 ]; then
  echo "=== All guardrails passed ==="
else
  echo "=== Some guardrails failed ==="
fi

exit $EXIT_CODE
