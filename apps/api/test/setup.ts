/**
 * Jest Test Setup File
 * 
 * Global configuration and utilities for all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-in-tests-only';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global beforeAll - runs once before all tests
global.beforeAll?.(() => {
  // Any global test setup
});

// Global afterAll - runs once after all tests
global.afterAll?.(() => {
  // Any global test cleanup
});

// Silence console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: console.error,
// };
