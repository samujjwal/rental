import { createMobileClient } from '@rental-portal/mobile-sdk';
import { authStore } from './authStore';
import { API_BASE_URL } from '../config';

// In-memory cache for current access token (avoid async SecureStore on every request)
let cachedToken: string | null = null;

// Initialize cached token from SecureStore on app load
export async function initializeAuth(): Promise<string | null> {
  cachedToken = await authStore.getToken();
  return cachedToken;
}

export function setCachedToken(token: string | null): void {
  cachedToken = token;
}

// Event emitter for auth state changes (logout on refresh failure)
type AuthEventHandler = () => void;
let onForceLogout: AuthEventHandler | null = null;

export function setOnForceLogout(handler: AuthEventHandler | null): void {
  onForceLogout = handler;
}

// Token refresh state to prevent concurrent refreshes
let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await authStore.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      await authStore.setTokens(data.accessToken, data.refreshToken);
      cachedToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const mobileClient = createMobileClient({
  baseUrl: API_BASE_URL,
  getAuthToken: () => cachedToken,
});

/**
 * Authenticated fetch wrapper with automatic 401 refresh.
 * Use this for custom API calls not covered by mobileClient.
 */
export async function authenticatedFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (cachedToken) {
    headers.set('Authorization', `Bearer ${cachedToken}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${cachedToken}`);
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    } else {
      await authStore.clearTokens();
      cachedToken = null;
      onForceLogout?.();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
