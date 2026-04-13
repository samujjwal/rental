/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '\\.integration-spec\\.ts$',
  testTimeout: 15000,
  forceExit: true,
  maxWorkers: 2,
  setupFiles: ['./setup-e2e.js'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
      },
    ],
  },
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
  },
  coverageDirectory: '../coverage-integration',
  collectCoverageFrom: [
    '../src/**/*.(t|j)s',
    '!../src/**/*.spec.ts',
    '!../src/**/*.module.ts',
    '!../src/main.ts',
    '!../src/**/*.dto.ts',
    '!../src/**/*.entity.ts',
    '!../src/**/*.enum.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/modules/auth/**/*': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/modules/bookings/**/*': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/modules/payments/**/*': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/modules/listings/**/*': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/modules/insurance/**/*': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/modules/disputes/**/*': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/dist/',
    '/__mocks__/',
  ],
};
