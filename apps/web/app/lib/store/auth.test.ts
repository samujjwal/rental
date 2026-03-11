import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";

// Mock the api module before importing the store
vi.mock("~/lib/api-client", () => ({
  api: {
    post: vi.fn(),
  },
}));

import { useAuthStore } from "./auth";
import { api } from "~/lib/api-client";
import type { User } from "~/types/auth";

// Helper: build a complete User for test assertions
const makeUser = (overrides: Record<string, unknown> = {}): User =>
  ({
    id: "u1",
    email: "test@example.com",
    firstName: "Test",
    lastName: null,
    avatar: null,
    phone: null,
    role: "renter",
    status: "ACTIVE",
    emailVerified: true,
    phoneVerified: false,
    identityVerified: false,
    averageRating: null,
    totalReviews: 0,
    totalBookings: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as unknown as User);

// Helper: create a fake JWT with given exp (seconds since epoch)
function fakeJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "user-1", exp }));
  return `${header}.${payload}.fake-signature`;
}

describe("useAuthStore", () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    act(() => {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        isInitialized: false,
        isLoading: false,
      });
    });
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should have null user, token, and isInitialized false", () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isInitialized).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("setAuth", () => {
    it("should set user, accessToken, and mark initialized", () => {
      const user = makeUser({ role: "HOST" as any });

      act(() => {
        useAuthStore.getState().setAuth(user, "access-tok");
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual({ ...user, role: "owner" });
      expect(state.accessToken).toBe("access-tok");
      expect(state.isInitialized).toBe(true);
    });

    it("should normalize HOST role to owner", () => {
      act(() => {
        useAuthStore.getState().setAuth(
          makeUser({ role: "HOST" as any }),
          "a"
        );
      });

      expect(useAuthStore.getState().user?.role).toBe("owner");
    });

    it("should normalize ADMIN role to admin", () => {
      act(() => {
        useAuthStore.getState().setAuth(
          makeUser({ role: "ADMIN" as any }),
          "a"
        );
      });

      expect(useAuthStore.getState().user?.role).toBe("admin");
    });

    it("should normalize SUPER_ADMIN role to admin", () => {
      act(() => {
        useAuthStore.getState().setAuth(
          makeUser({ role: "SUPER_ADMIN" as any }),
          "a"
        );
      });

      expect(useAuthStore.getState().user?.role).toBe("admin");
    });

    it("should normalize USER role to renter", () => {
      act(() => {
        useAuthStore.getState().setAuth(
          makeUser({ role: "USER" as any }),
          "a"
        );
      });

      expect(useAuthStore.getState().user?.role).toBe("renter");
    });

    it("should default unknown roles to renter", () => {
      act(() => {
        useAuthStore.getState().setAuth(
          makeUser({ role: "UNKNOWN" as any }),
          "a"
        );
      });

      expect(useAuthStore.getState().user?.role).toBe("renter");
    });

    it("should handle null/undefined role as renter", () => {
      act(() => {
        useAuthStore.getState().setAuth(
          makeUser({ role: undefined as any }),
          "a"
        );
      });

      expect(useAuthStore.getState().user?.role).toBe("renter");
    });
  });

  describe("clearAuth", () => {
    it("should clear user and tokens", () => {
      act(() => {
        useAuthStore.getState().setAuth(
          makeUser({ role: "HOST" as any }),
          "access"
        );
      });

      act(() => {
        useAuthStore.getState().clearAuth();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isInitialized).toBe(true);
    });

    it("should remove localStorage key", () => {
      act(() => {
        useAuthStore.getState().clearAuth();
      });

      expect(localStorage.removeItem).toHaveBeenCalledWith("auth-storage");
    });
  });

  describe("updateUser", () => {
    it("should merge partial user data", () => {
      act(() => {
        useAuthStore.getState().setAuth(
          { id: "u1", email: "old@example.com", role: "HOST" as any, name: "Old" } as any,
          "a"
        );
      });

      act(() => {
        useAuthStore.getState().updateUser({ name: "New Name" } as any);
      });

      expect((useAuthStore.getState().user as any)?.name).toBe("New Name");
      expect(useAuthStore.getState().user?.email).toBe("old@example.com");
    });

    it("should normalize role when updating role", () => {
      act(() => {
        useAuthStore.getState().setAuth(
          makeUser({ role: "USER" as any }),
          "a"
        );
      });

      act(() => {
        useAuthStore.getState().updateUser({ role: "HOST" } as any);
      });

      expect(useAuthStore.getState().user?.role).toBe("owner");
    });

    it("should not create user when user is null", () => {
      act(() => {
        useAuthStore.getState().updateUser({ name: "test" } as any);
      });

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe("setAccessToken", () => {
    it("should update access token", () => {
      act(() => {
        useAuthStore.getState().setAccessToken("new-access");
      });

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe("new-access");
    });
  });

  describe("restoreSession", () => {
    it("should set isInitialized when no tokens stored", async () => {
      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });

      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("should keep valid session when token not expired", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1h from now
      const validToken = fakeJwt(futureExp);

      act(() => {
        useAuthStore.setState({
          user: { id: "u1", email: "test@example.com", role: "renter" } as any,
          accessToken: validToken,
        });
      });

      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });

      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().user).not.toBeNull();
      expect(useAuthStore.getState().accessToken).toBe(validToken);
    });

    it("should refresh expired token via httpOnly cookie", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60; // expired 1 min ago
      const expiredToken = fakeJwt(pastExp);

      const newUser = { id: "u1", email: "test@example.com", role: "HOST" };
      vi.mocked(api.post).mockResolvedValue({
        accessToken: "new-access",
        user: newUser,
      });

      act(() => {
        useAuthStore.setState({
          user: { id: "u1", email: "test@example.com", role: "renter" } as any,
          accessToken: expiredToken,
        });
      });

      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });

      // B-29: refresh token is sent via httpOnly cookie, body is empty
      expect(api.post).toHaveBeenCalledWith("/auth/refresh", {});
      expect(useAuthStore.getState().accessToken).toBe("new-access");
      expect(useAuthStore.getState().user?.role).toBe("owner"); // HOST → owner
    });

    it("should clear auth when refresh fails", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      const expiredToken = fakeJwt(pastExp);

      vi.mocked(api.post).mockRejectedValue(new Error("Refresh failed"));

      act(() => {
        useAuthStore.setState({
          user: { id: "u1", email: "test@example.com", role: "renter" } as any,
          accessToken: expiredToken,
        });
      });

      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });

    it("should handle malformed token as expired", async () => {
      vi.mocked(api.post).mockRejectedValue(new Error("Refresh failed"));

      act(() => {
        useAuthStore.setState({
          user: { id: "u1", email: "test@example.com", role: "renter" } as any,
          accessToken: "not-a-jwt",
        });
      });

      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });

      // Malformed token → treated as expired → refresh attempt → fails → clear
      expect(api.post).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe("persist middleware", () => {
    it("should only persist user and accessToken (not refreshToken)", () => {
      // The partialize function should exclude isInitialized, isLoading, and refreshToken
      const fullState = {
        user: { id: "u1" } as any,
        accessToken: "at",
        isInitialized: true,
        isLoading: false,
        isAuthenticated: true,
        setAuth: vi.fn(),
        clearAuth: vi.fn(),
        updateUser: vi.fn(),
        restoreSession: vi.fn(),
        setAccessToken: vi.fn(),
      };

      // Access the persist config via the store API
      const persistOptions = (useAuthStore as any).persist;
      if (persistOptions?.getOptions) {
        const opts = persistOptions.getOptions();
        if (opts.partialize) {
          const partialState = opts.partialize(fullState);
          expect(partialState).toHaveProperty("user");
          expect(partialState).toHaveProperty("accessToken");
          expect(partialState).not.toHaveProperty("refreshToken");
          expect(partialState).not.toHaveProperty("isInitialized");
          expect(partialState).not.toHaveProperty("isLoading");
        }
      }
    });
  });
});
