/**
 * Development Auto-Login Utility
 * Automatically logs in test users in development mode
 */

import { sessionStorage } from "./auth.server";
import { serverApi } from "~/lib/api-client.server";
import type { AuthResponse } from "~/types/auth";

export async function createDevSession(email: string, request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  try {
    const data = await serverApi.post<AuthResponse>("/auth/login", {
      email,
      password: "password123",
    });
    const session = await sessionStorage.getSession(
      request.headers.get("Cookie")
    );

    session.set("userId", data.user.id);
    session.set("accessToken", data.accessToken);
    session.set("refreshToken", data.refreshToken);
    session.set("user", data.user);

    return session;
  } catch (error) {
    console.error("Dev auto-login error:", error);
    return null;
  }
}

export const DEV_USERS = {
  admin: "admin@rental-portal.com",
  support: "support@rental.local",
  owner1: "john.owner@rental.local",
  owner2: "emily.tools@rental.local",
  customer1: "mike.customer@rental.local",
  customer2: "lisa.renter@rental.local",
} as const;
