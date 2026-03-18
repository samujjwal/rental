/** @type {import('jest').Config} */

// Set the default currency for test environment (Nepal-focused app)
process.env.DEFAULT_CURRENCY = 'NPR';

export default {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/[^/]+/node_modules/)?(?:(?:jest-)?react-native|@react-native(?:/[^/]+)?|expo(?:nent)?(?:/[^/]+)?|@expo(?:nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-toast-message|@rental-portal/shared-types|expo-modules-core))',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
  // Note: @testing-library/react-native v13+ automatically registers custom
  // matchers — the legacy `extend-expect` entry point no longer exists.
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^expo-device$': '<rootDir>/src/__mocks__/expo-device.cjs',
    '^expo-linking$': '<rootDir>/src/__mocks__/expo-linking.cjs',
    '^expo-modules-core/src/Refs$': '<rootDir>/node_modules/expo-modules-core/src/Refs.ts',
    '^expo-modules-core/src/web/index.web$': '<rootDir>/node_modules/expo-modules-core/src/web/index.web.ts',
  },
};
