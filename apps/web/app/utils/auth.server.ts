import { createCookieSessionStorage, redirect } from "@react-router/node";
import { apiClient } from "~/lib/api-client";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

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
  const userId = session.get("userId");
  return userId;
}

export async function getUserToken(
  request: Request
): Promise<string | undefined> {
  const session = await getSession(request);
  const token = session.get("accessToken");
  return token;
}

export async function getUser(request: Request) {
  const token = await getUserToken(request);
  if (!token) return null;

  try {
    const response = await apiClient.get("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    return null;
  }
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/auth/login?${searchParams}`);
  }
  return userId;
}

export async function requireUser(request: Request) {
  const user = await getUser(request);
  if (!user) {
    throw redirect("/auth/login");
  }
  return user;
}

export async function requireAdmin(request: Request) {
  const user = await getUser(request);
  if (!user || user.role !== "admin") {
    throw redirect("/dashboard");
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
