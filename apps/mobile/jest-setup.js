/**
 * Jest setup file for React Native / Expo tests.
 * Loaded via setupFilesAfterEnv in jest.config.js.
 */

// ── expo-font: fix "loadedNativeFonts.forEach is not a function" ─────────────
// The jest-expo preset stubs expo-font, but the internal `loadedNativeFonts`
// may be undefined. Override the whole module with a minimal working mock.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  isLoading: () => false,
  loadAsync: jest.fn().mockResolvedValue(undefined),
  unloadAsync: jest.fn().mockResolvedValue(undefined),
  FontDisplay: { AUTO: 'auto', BLOCK: 'block', SWAP: 'swap', FALLBACK: 'fallback', OPTIONAL: 'optional' },
}));

// ── @expo/vector-icons: avoid real font loading in tests ─────────────────────
jest.mock('@expo/vector-icons', () => {
  const { View, Text } = require('react-native');
  const createIconSet = (name) =>
    function MockIcon({ size, color, style }) {
      return require('react').createElement(View, { style }, require('react').createElement(Text, { style: { fontSize: size, color } }, name));
    };
  return {
    Ionicons: createIconSet('Ionicons'),
    MaterialIcons: createIconSet('MaterialIcons'),
    FontAwesome: createIconSet('FontAwesome'),
    Feather: createIconSet('Feather'),
    createIconSet,
    createIconSetFromIcoMoon: createIconSet,
  };
});

// ── expo-notifications: avoid real device token requests ─────────────────────
jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-token' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
}));

const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("Warning: An update to") && args[0].includes("inside a test was not wrapped in act"))
  ) {
    return;
  }
  originalConsoleError(...args);
};

