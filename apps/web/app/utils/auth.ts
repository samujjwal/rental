import { createCookieSessionStorage, redirect } from "react-router";
import { api } from "~/lib/api-client";
import { useAuthStore } from "~/lib/store/auth";
import type { User } from "~/types/user";

// Safe access for browser environments where process might not exist
const isServer = typeof process !== "undefined" && process.env && process.env.NODE_ENV;

// Enforce SESSION_SECRET on server — throw in production, warn + use random in dev
if (isServer && !process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET environment variable must be set in production");
  } else {
    const randomSecret = Math.random().toString(36) + Math.random().toString(36);
    process.env.SESSION_SECRET = randomSecret;
    console.warn("[Web] WARNING: SESSION_SECRET not set — using a random secret for this session. Sessions will be invalidated on restart.");
  }
}

const sessionSecret = isServer ? process.env.SESSION_SECRET! : "browser-safe-secret";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: isServer ? process.env.NODE_ENV === "production" : false,
  },
});

export async function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

export async function getUserId(request: Request): Promise<string | undefined> {
  const session = await getSession(request);
  return session.get("userId");
}

export async function getUserToken(
  request: Request
): Promise<string | undefined> {
  const session = await getSession(request);
  return session.get("accessToken");
}

export async function getUser(request: Request): Promise<User | null> {
  const session = await getSession(request);
  let token: string | null = session.get("accessToken") ?? null;
  let persistedUser: User | null = null;

  // Fall back to Zustand store for client-side navigation
  // Session cookie is primary source of truth
  if (typeof window !== "undefined" && !token) {
    const storeState = useAuthStore.getState();
    token = storeState.accessToken;
    persistedUser = storeState.user
      ? {
          ...storeState.user,
          role: normalizeStoredRole(storeState.user.role),
        }
      : null;

    // Zustand v5 persist may hydrate async; read localStorage directly as fallback
    if (!token || !persistedUser) {
      try {
        const raw = localStorage.getItem("auth-storage");
        if (raw) {
          const parsed = JSON.parse(raw) as {
            state?: { accessToken?: string; user?: User | null };
          };
          token = parsed?.state?.accessToken ?? null;
          persistedUser = parsed?.state?.user
            ? {
                ...parsed.state.user,
                role: normalizeStoredRole(parsed.state.user.role),
              }
            : persistedUser;
        }
      } catch {
        // ignore parse errors
      }
      // Sync token into Zustand store so the API client interceptor can use it
      if (token) {
        useAuthStore.getState().setAccessToken(token);
      }
    }
  }

  if (typeof window !== "undefined" && token && persistedUser) {
    const storeState = useAuthStore.getState();
    if (!storeState.accessToken) {
      storeState.setAccessToken(token);
    }
    return persistedUser;
  }

  if (!token) return null;

  // Retry auth check up to 2 times for transient errors (e.g., API under load)
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const rawUser = await api.get<User>("/auth/me");
      const normalizedRole = (() => {
        const role = String((rawUser as { role?: unknown }).role || "").toUpperCase();
        if (role === "ADMIN" || role === "SUPER_ADMIN") return "admin";
        if (role === "HOST" || role === "OWNER") return "owner";
        return "renter";
      })();
      return {
        ...rawUser,
        role: normalizedRole,
      };
    } catch (error) {
      const status =
        error &&
        typeof error === "object" &&
        "response" in error &&
        (error as { response?: { status?: number } }).response?.status;

      // 401 is expected for anonymous users or expired sessions.
      // Clear the Zustand auth store to stay in sync.
      if (status === 401) {
        if (typeof window !== "undefined") {
          useAuthStore.getState().clearAuth();
        }
        return null;
      }

      // For transient errors (5xx, 429, network timeout), retry with backoff
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }

      // Non-401 errors after retries: fall back to persisted client auth state.
      if (typeof window !== "undefined" && persistedUser) {
        return persistedUser;
      }

      return null;
    }
  }
  return null;
}

function normalizeStoredRole(role?: string | null): User["role"] {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "ADMIN" || normalized === "SUPER_ADMIN") return "admin";
  if (normalized === "HOST" || normalized === "OWNER") return "owner";
  return "renter";
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const session = await getSession(request);
  const userId = session.get("userId");

  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/auth/login?${searchParams}`);
  }
  return userId;
}

export async function requireUser(request: Request) {
  const user = await getUser(request);

  if (!user) {
    const redirectTo = new URL(request.url).pathname;
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/auth/login?${searchParams}`);
  }

  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);

  if (user.role !== "admin") {
    throw redirect("/dashboard"); // Better to redirect to dashboard if not admin
  }
  return user;
}

export async function createUserSession({
  userId,
  accessToken,
  refreshToken,
  remember,
  redirectTo,
}: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  remember: boolean;
  redirectTo: string;
}) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  session.set("accessToken", accessToken);
  session.set("refreshToken", refreshToken);

  const response = redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        maxAge: remember ? 60 * 60 * 24 * 30 : undefined, // 30 days
      }),
    },
  });

  return response;
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
