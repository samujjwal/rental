import { Platform } from 'react-native';

const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const defaultApiOrigin = `http://${defaultHost}:3400`;
const defaultWebOrigin = `http://${defaultHost}:3401`;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL
    ? `${process.env.EXPO_PUBLIC_API_URL}/api`
    : `${defaultApiOrigin}/api`;
// Socket.io connects to the root URL (no /api prefix)
export const SOCKET_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || defaultApiOrigin;
export const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_URL || defaultWebOrigin;
