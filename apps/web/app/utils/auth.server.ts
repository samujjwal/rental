import { createCookieSessionStorage, redirect } from "react-router";
import { apiClient } from "~/lib/api-client";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const API_URL = process.env.API_URL || "http://localhost:3400/api/v1";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
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
  const token = session.get("accessToken");
  const refreshToken = session.get("refreshToken");

  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return await response.json();
    }

    // If unauthorized, try to refresh
    if (response.status === 401 && refreshToken) {
      console.log("Access token expired, attempting server-side refresh...");
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        console.log("Server-side refresh successful");

        // We can't update the cookie from directly within getUser without returning the session
        // However, we can return the new user and tokens, and let the caller handle it.
        // For simplicity and minimal changes to existing code, we return the user
        // and ideally we should redirect to refresh the cookie, but that can't happen in getUser.

        // Return user with a special flag so requireUser can handle the redirect
        return {
          ...data.user,
          __newTokens: {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          },
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Auth server error:", error);
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

  // Handle silent refresh redirect if tokens were updated
  if (user.__newTokens) {
    const { accessToken, refreshToken } = user.__newTokens;
    const session = await getSession(request);
    session.set("accessToken", accessToken);
    session.set("refreshToken", refreshToken);

    // Remote the internal flag
    delete user.__newTokens;

    // Redirect to the same URL to commit the new session cookie
    throw redirect(request.url, {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session),
      },
    });
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
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  session.set("accessToken", accessToken);
  session.set("refreshToken", refreshToken);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        maxAge: remember ? 60 * 60 * 24 * 30 : undefined, // 30 days
      }),
    },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
