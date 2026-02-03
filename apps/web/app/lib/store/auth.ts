import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "~/types/auth";
import { api } from "~/lib/api-client";

const STORAGE_KEY = "auth-storage";
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  restoreSession: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isInitialized: false,
      isLoading: false,
      get isAuthenticated() {
        return !!get().user && !!get().accessToken;
      },

      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isInitialized: true });
        if (typeof window !== "undefined") {
          localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isInitialized: true,
        });
        if (typeof window !== "undefined") {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      },

      updateUser: (userData) => {
        set((state) => {
          const updatedUser = state.user
            ? { ...state.user, ...userData }
            : null;
          if (typeof window !== "undefined" && updatedUser) {
            localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
          }
          return { user: updatedUser };
        });
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
        if (typeof window !== "undefined") {
          localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
      },

      restoreSession: async () => {
        if (typeof window === "undefined") {
          set({ isInitialized: true });
          return;
        }

        set({ isLoading: true });

        try {
          const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          const storedUser = localStorage.getItem(USER_KEY);

          if (storedAccessToken && storedRefreshToken && storedUser) {
            // Check if access token is expired
            if (isTokenExpired(storedAccessToken)) {
              // Try to refresh the token
              try {
                const data = await api.post<{
                  accessToken: string;
                  refreshToken: string;
                  user: User;
                }>("/auth/refresh", { refreshToken: storedRefreshToken });

                localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
                localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);

                set({
                  user: data.user,
                  accessToken: data.accessToken,
                  refreshToken: data.refreshToken,
                  isInitialized: true,
                  isLoading: false,
                });
                return;
              } catch (error) {
                console.error("Token refresh failed:", error);
                get().clearAuth();
                set({ isInitialized: true, isLoading: false });
                return;
              }
            }

            // Access token is still valid, restore session
            set({
              user: JSON.parse(storedUser),
              accessToken: storedAccessToken,
              refreshToken: storedRefreshToken,
              isInitialized: true,
            });
          } else {
            // No stored tokens, clear auth state
            set({ isInitialized: true });
          }
        } catch (error) {
          console.error("Failed to restore session:", error);
          set({ isInitialized: true });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

/**
 * Check if a JWT token is expired
 * @param token - JWT token to check
 * @returns true if token is expired, false otherwise
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiresAt = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expiresAt;
  } catch {
    // If we can't parse the token, consider it expired
    return true;
  }
}
