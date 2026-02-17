import { createCookieSessionStorage, redirect } from "react-router";
import { api } from "~/lib/api-client";
import type { User } from "~/types/user";

// Safe access for browser environments where process might not exist
const isServer = typeof process !== "undefined" && process.env && process.env.NODE_ENV;
const sessionSecret = (isServer ? process.env.SESSION_SECRET : "browser-safe-secret") || "default-secret";

// Only enforce secret on server
if (isServer && !sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set");
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: false,
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
  let refreshToken: string | null = session.get("refreshToken") ?? null;

  // Fall back to localStorage for client-side navigation
  // Session cookie is primary source of truth
  if (typeof window !== "undefined" && !token) {
    const storedAccessToken = localStorage.getItem("accessToken");
    const storedRefreshToken = localStorage.getItem("refreshToken");
    
    token = storedAccessToken;
    refreshToken = storedRefreshToken;
  }

  if (!token) return null;

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
    // Normalize to "no user" and clear stale client tokens.
    if (status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
      }
      return null;
    }

    console.error("Auth error:", error);
    return null;
  }
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
  console.log("=== CREATE USER SESSION START ===");
  console.log("createUserSession: creating session for userId:", userId);
  console.log("createUserSession: redirectTo:", redirectTo);
  console.log("createUserSession: remember:", remember);

  try {
    const session = await sessionStorage.getSession();
    session.set("userId", userId);
    session.set("accessToken", accessToken);
    session.set("refreshToken", refreshToken);

    console.log("createUserSession: session data set, creating redirect");
    const response = redirect(redirectTo, {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session, {
          maxAge: remember ? 60 * 60 * 24 * 30 : undefined, // 30 days
        }),
      },
    });

    console.log("createUserSession: redirect created successfully");
    console.log("=== CREATE USER SESSION END ===");
    return response;
  } catch (error) {
    console.error("createUserSession: ERROR:", error);
    console.log("=== CREATE USER SESSION END WITH ERROR ===");
    throw error;
  }
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
