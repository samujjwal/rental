/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: '.*\.spec\.ts$',
  testTimeout: 10000,
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.enum.ts',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/modules/auth/**/*': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/modules/bookings/**/*': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/modules/payments/**/*': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/modules/listings/**/*': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/modules/insurance/**/*': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/modules/disputes/**/*': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/common/**/*': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/dist/',
    '/__mocks__/',
    '/src/database/',
    '/src/config/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  verbose: true,
};
