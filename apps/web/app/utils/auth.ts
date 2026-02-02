import { createCookieSessionStorage, redirect } from "react-router";
import { api } from "~/lib/api-client";

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

export async function getUser(request: Request) {
  const session = await getSession(request);
  let token: string | null = session.get("accessToken") ?? null;
  let refreshToken: string | null = session.get("refreshToken") ?? null;

  if (typeof window !== "undefined") {
    const storedAccessToken = localStorage.getItem("accessToken");
    const storedRefreshToken = localStorage.getItem("refreshToken");

    token = token ?? storedAccessToken;
    refreshToken = refreshToken ?? storedRefreshToken;

    // Ensure the shared api client can refresh tokens when needed.
    if (token && token !== storedAccessToken) {
      localStorage.setItem("accessToken", token);
    }
    if (refreshToken && refreshToken !== storedRefreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
  }

  if (!token) return null;

  try {
    return await api.get<any>("/auth/me");
  } catch (error) {
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

  if (user.role !== "ADMIN") {
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
