export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL
    ? `${process.env.EXPO_PUBLIC_API_URL}/api`
    : "http://localhost:3400/api";
// Socket.io connects to the root URL (no /api prefix)
export const SOCKET_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3400";
export const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_URL || "http://localhost:3401";
