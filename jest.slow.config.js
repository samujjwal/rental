/**
 * Jest Configuration for Slow Tests
 * 
 * This configuration runs slow integration and E2E tests.
 * These tests may take longer to complete due to external dependencies.
 */

module.exports = {
  displayName: 'slow',
  testMatch: [
    '**/integration/**/*.spec.ts',
    '**/e2e/**/*.spec.ts',
    '**/performance/**/*.spec.ts',
    '**/retry-logic/**/*.spec.ts',
    '**/fallback/**/*.spec.ts',
    '**/workflows/**/*.spec.ts',
    '**/*.e2e-spec.ts',
    '**/*.integration-spec.ts',
    '**/*.performance.spec.ts',
  ],
  testPathIgnorePatterns: [
    '**/node_modules/',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
  ],
  maxWorkers: 1, // Run slow tests sequentially to avoid resource conflicts
  testTimeout: 60000, // 60 second timeout for slow tests
  verbose: true,
};
