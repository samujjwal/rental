#!/usr/bin/env bash
# tools/inventory-go.sh
# Usage: bash tools/inventory-go.sh > docs/architecture-audit/outputs/go-inventory.txt
set -euo pipefail
if command -v go >/dev/null 2>&1; then
  go list -m all
  echo "----"
  go mod graph || true
else
  echo "go not found" 1>&2
fi
