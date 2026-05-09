/**
 * Base Client
 * 
 * Provides common functionality for all domain-specific clients:
 * - Request handling with automatic authentication
 * - Token refresh on 401 errors
 * - Error parsing from JSON envelopes
 * - Timeout handling
 * - Retry logic
 */

import type { MobileClientConfig } from '~/types';
import { authStore } from '../authStore';
import { API_BASE_URL } from '../../config';

let cachedToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let onForceLogout: (() => void) | null = null;

export function setCachedToken(token: string | null): void {
  cachedToken = token;
}

export function setOnForceLogout(handler: (() => void) | null): void {
  onForceLogout = handler;
}

export async function initializeAuth(): Promise<string | null> {
  cachedToken = await authStore.getToken();
  return cachedToken;
}

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

export class BaseClient {
  protected readonly baseUrl: string;
  protected readonly getAuthToken: () => string | null;
  protected readonly defaultTimeout: number;

  constructor(config: MobileClientConfig = {}) {
    this.baseUrl = config.baseUrl || API_BASE_URL;
    this.getAuthToken = config.getAuthToken || (() => cachedToken);
    this.defaultTimeout = config.timeout || 15000;
  }

  /**
   * Make an authenticated HTTP request with automatic token refresh and error handling
   */
  protected async request<T>(
    path: string,
    init: RequestInit = {},
    options: { timeout?: number; skipAuth?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = options.skipAuth ? null : this.getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout);

    try {
      let response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      // Automatic 401 retry with token refresh
      if (response.status === 401 && token) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          headers.set('Authorization', `Bearer ${cachedToken}`);
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), options.timeout || this.defaultTimeout);
          try {
            response = await fetch(url, { ...init, headers, signal: retryController.signal });
          } finally {
            clearTimeout(retryTimeoutId);
          }
        } else {
          await authStore.clearTokens();
          cachedToken = null;
          onForceLogout?.();
          throw new Error('Session expired. Please sign in again.');
        }
      }

      if (!response.ok) {
        await this.handleError(response);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle HTTP errors with JSON error envelope parsing
   */
  protected async handleError(response: Response): Promise<never> {
    const text = await response.text();
    try {
      const errorJson = JSON.parse(text);
      const errorMessage = errorJson.message || errorJson.error || text;
      const errorCode = errorJson.statusCode || errorJson.code;
      const errorDetails = {
        messageKey: errorJson.messageKey,
        requestId: errorJson.requestId,
        path: errorJson.path,
        timestamp: errorJson.timestamp,
      };
      
      const error = new Error(
        typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
      );
      (error as any).code = errorCode;
      (error as any).statusCode = response.status;
      (error as any).details = errorDetails;
      throw error;
    } catch {
      // If JSON parsing fails, throw a generic error with the text
      const error = new Error(text || `Request failed (${response.status})`);
      (error as any).statusCode = response.status;
      throw error;
    }
  }

  /**
   * Build query string from parameters
   */
  protected buildQueryString(params: Record<string, any>): string {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        query.set(key, value.join(','));
      } else {
        query.set(key, String(value));
      }
    });
    return query.toString();
  }
}
