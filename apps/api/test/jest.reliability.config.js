/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'reliability/.*\\.spec\\.ts$',
  testTimeout: 30000,
  forceExit: true,
  maxWorkers: 1,
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
  coverageDirectory: '../coverage-reliability',
  collectCoverageFrom: [
    '../src/**/*.(t|j)s',
    '!../src/**/*.spec.ts',
    '!../src/**/*.module.ts',
    '!../src/main.ts',
  ],
};
