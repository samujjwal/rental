#!/bin/bash
# Fast Test Runner Script
# Runs tests efficiently without hangs

echo "🏃 Running Fast Test Suite..."
echo ""

# Run backend tests (excluding problematic chaos tests)
echo "📦 Backend Tests (excluding chaos/e2e)..."
cd apps/api
pnpm jest \
  --testPathIgnorePatterns='chaos|e2e|expansion' \
  --maxWorkers=4 \
  --testTimeout=10000 \
  --silent \
  --coverage \
  --coverageReporters=text-summary \
  --coverageDirectory=coverage-fast

echo ""
echo "🎨 Frontend Tests..."
cd ../web
pnpm vitest run --reporter=verbose --coverage

echo ""
echo "✅ Fast test run complete!"
echo "📊 Coverage reports:"
echo "   - Backend: apps/api/coverage-fast"
echo "   - Frontend: apps/web/html"
