/**
 * Jest Configuration for Fast Tests
 * 
 * This configuration runs fast unit tests only.
 * These tests should complete in < 5 seconds.
 */

module.exports = {
  displayName: 'fast',
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/integration/',
    '/e2e/',
    '/performance/',
    '/retry-logic/',
    '/fallback/',
    '/workflows/',
    '/test/',
    '**/*.e2e-spec.ts',
    '**/*.integration-spec.ts',
    '**/*.performance.spec.ts',
  ],
  coveragePathIgnorePatterns: [
    '/integration/',
    '/e2e/',
    '/performance/',
  ],
  maxWorkers: 4, // Run fast tests in parallel
  testTimeout: 5000, // 5 second timeout for fast tests
  verbose: true,
};
