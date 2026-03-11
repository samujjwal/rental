import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "~/types/auth";
import { api } from "~/lib/api-client";

const STORAGE_KEY = "auth-storage";

const normalizeRole = (role?: string | null): User["role"] => {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "HOST") return "owner";
  if (normalized === "ADMIN" || normalized === "SUPER_ADMIN") return "admin";
  return "renter";
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  restoreSession: () => Promise<void>;
  setAccessToken: (accessToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isInitialized: false,
      isLoading: false,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        const normalizedUser = { ...user, role: normalizeRole(user.role) };
        set({ user: normalizedUser, accessToken, isInitialized: true, isAuthenticated: true });
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          isInitialized: true,
          isAuthenticated: false,
        });
        // Zustand persist handles localStorage cleanup automatically.
        // Also remove the persist key to ensure a clean logout.
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
        }
      },

      updateUser: (userData) => {
        set((state) => {
          const updatedUser = state.user
            ? {
                ...state.user,
                ...userData,
                role: normalizeRole(
                  (userData as Partial<User>).role ?? state.user?.role
                ),
              }
            : null;
          return { user: updatedUser };
        });
      },

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },

      restoreSession: async () => {
        if (typeof window === "undefined") {
          set({ isInitialized: true });
          return;
        }

        set({ isLoading: true });

        try {
          // Read from Zustand persisted state (auto-rehydrated by persist middleware)
          const { accessToken: storedAccessToken, user: storedUser } = get();

          if (storedAccessToken && storedUser) {
            // Check if access token is expired
            if (isTokenExpired(storedAccessToken)) {
              // Try to refresh the token — refresh token is sent via httpOnly cookie (B-29)
              try {
                const data = await api.post<{
                  accessToken: string;
                  user: User;
                }>("/auth/refresh", {});

                set({
                  user: { ...data.user, role: normalizeRole(data.user.role) },
                  accessToken: data.accessToken,
                  isInitialized: true,
                  isAuthenticated: true,
                  isLoading: false,
                });
                return;
              } catch {
                get().clearAuth();
                set({ isInitialized: true, isLoading: false });
                return;
              }
            }

            // Access token is still valid, mark initialized
            set({ isInitialized: true, isAuthenticated: true });
          } else {
            // No stored tokens, clear auth state
            set({ isInitialized: true });
          }
        } catch {
          set({ isInitialized: true });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      // B-29: Only persist user + accessToken. Refresh token lives in httpOnly cookie.
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
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
