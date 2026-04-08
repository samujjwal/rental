// Global Jest setup for test environment
global.describe = global.describe || require('jest').describe;
global.test = global.test || require('jest').test;
global.it = global.it || require('jest').it;
global.expect = global.expect || require('jest').expect;
global.beforeEach = global.beforeEach || require('jest').beforeEach;
global.afterEach = global.afterEach || require('jest').afterEach;
global.beforeAll = global.beforeAll || require('jest').beforeAll;
global.afterAll = global.afterAll || require('jest').afterAll;
global.jest = global.jest || require('jest');

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});
