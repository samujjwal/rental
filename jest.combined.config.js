module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/api/src'],
  testMatch: [
    '**/auth.service.100percent.working.spec.ts',
    '**/bookings.service.100percent.final.spec.ts',
    '**/admin.service.100percent.spec.ts',
    '**/field-encryption.service.100percent.spec.ts',
    '**/cache.service.100percent.spec.ts',
    '**/events.service.100percent.spec.ts',
    '**/fx.service.100percent.spec.ts',
    '**/storage.service.100percent.spec.ts'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage/combined',
  coverageReporters: ['text', 'lcov', 'html', 'json', 'clover'],
  collectCoverageFrom: [
    'apps/api/src/**/*.ts',
    '!apps/api/src/**/*.spec.ts',
    '!apps/api/src/**/*.test.ts',
    '!apps/api/src/**/*.d.ts',
    '!apps/api/src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  verbose: true
};
