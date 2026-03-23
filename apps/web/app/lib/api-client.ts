import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "./store/auth";
import { requestNavigation } from "~/lib/navigation";
import { toast } from "sonner";
import { ApiErrorType, parseApiError } from "~/lib/api-error";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3400/api";

function getRuntimeApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return API_BASE_URL;
  }

  const runtimeApiUrl =
    (window as Window & { __APP_ENV__?: { API_URL?: string } }).__APP_ENV__?.API_URL ||
    document.documentElement.dataset.apiUrl;

  return runtimeApiUrl || API_BASE_URL;
}

type ApiRequestConfig = AxiosRequestConfig & {
  suppressErrorToast?: boolean;
  disableIdempotency?: boolean;
  allowOffline?: boolean;
};

const IDEMPOTENT_METHODS = new Set(["post", "put", "patch", "delete"]);
const AUTH_URL_EXCLUSIONS = ["/auth/login", "/auth/refresh", "/auth/logout"];

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function shouldAttachIdempotencyKey(config: ApiRequestConfig) {
  const method = String(config.method || "get").toLowerCase();
  if (!IDEMPOTENT_METHODS.has(method)) return false;
  if (config.disableIdempotency) return false;
  const url = String(config.url || "");
  return !AUTH_URL_EXCLUSIONS.some((segment) => url.includes(segment));
}

function setHeader(config: ApiRequestConfig, key: string, value: string) {
  if (!config.headers) {
    config.headers = {};
  }
  const headers = config.headers as Record<string, string>;
  headers[key] = value;
}

function shouldToastError(config: ApiRequestConfig | undefined, type: ApiErrorType) {
  if (config?.suppressErrorToast) return false;
  return [
    ApiErrorType.OFFLINE,
    ApiErrorType.NETWORK_ERROR,
    ApiErrorType.TIMEOUT_ERROR,
    ApiErrorType.SERVER_ERROR,
  ].includes(type);
}

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      withCredentials: true, // Send httpOnly cookies for auth (B-29)
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const requestConfig = config as ApiRequestConfig;
        requestConfig.baseURL = getRuntimeApiBaseUrl();

        if (
          typeof window !== "undefined" &&
          navigator.onLine === false &&
          !requestConfig.allowOffline
        ) {
          return Promise.reject(
            new AxiosError(
              "You appear to be offline. Check your connection and try again.",
              "ERR_NETWORK",
              config
            )
          );
        }

        const requestId = createRequestId();
        setHeader(requestConfig, "X-Request-Id", requestId);
        if (shouldAttachIdempotencyKey(requestConfig)) {
          setHeader(requestConfig, "Idempotency-Key", requestId);
        }

        // Skip adding token for auth routes
        if (
          config.url?.includes("/auth/login") ||
          config.url?.includes("/auth/refresh")
        ) {
          return config;
        }

        if (typeof window !== "undefined") {
          const token = useAuthStore.getState().accessToken;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh and error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const parsedError = parseApiError(error);
        const authStore = useAuthStore.getState();
        const hadAccessToken = Boolean(authStore.accessToken);

        if (shouldToastError(originalRequest as ApiRequestConfig | undefined, parsedError.type)) {
          if (typeof window !== "undefined") {
            toast.error(parsedError.message, {
              description:
                parsedError.type === ApiErrorType.TIMEOUT_ERROR
                  ? "The service is responding slowly. Retry when ready."
                  : parsedError.type === ApiErrorType.OFFLINE
                    ? "Reconnect to continue."
                    : parsedError.statusCode
                      ? `Server error (${parsedError.statusCode})`
                      : undefined,
            });
          }
        }

        // Handle rate limiting (429)
        if (error.response?.status === 429) {
          if (typeof window !== "undefined") {
            toast.error("Too many requests. Please try again later.", {
              description: "Rate limit exceeded",
            });
          }
          return Promise.reject(error);
        }

        // Handle unauthorized (401)
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.includes("/auth/login") &&
          !originalRequest.url?.includes("/auth/refresh")
        ) {
          originalRequest._retry = true;

          try {
            // Refresh token is sent automatically via httpOnly cookie (B-29).
            // No need to read it from store or send in body.
            // Coalesce concurrent 401 refreshes into a single request
            if (!this.refreshPromise) {
              this.refreshPromise = this.client
                .post("/auth/refresh", {})
                .then((res) => res.data)
                .finally(() => {
                  this.refreshPromise = null;
                });
            }

            const { accessToken } = await this.refreshPromise;

            // Update the auth store with new access token
            const authStore = useAuthStore.getState();
            authStore.setAccessToken(accessToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, logout user
            authStore.clearAuth();

            // Show session expired message
            if (typeof window !== "undefined") {
              toast.error("Session expired. Please login again.");
            }

            // Avoid forcing a login navigation when the request was never
            // authenticated in the first place. This prevents direct protected
            // route loads from bouncing to /auth/login before client auth state
            // has hydrated from local storage.
            if (hadAccessToken) {
              requestNavigation("/auth/login", { replace: true });
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: ApiRequestConfig
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: ApiRequestConfig
  ): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: ApiRequestConfig
  ): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export const api = apiClient;
