import React, { createContext, useContext, useMemo, useState } from "react";
import { authStore } from "./authStore";
import { mobileClient } from "./client";
import type { AuthResponse, AuthUser, LoginPayload, RegisterPayload } from "@rental-portal/mobile-sdk";

const normalizeRole = (role?: string | null): string => {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "HOST") return "owner";
  if (normalized === "ADMIN" || normalized === "SUPER_ADMIN") return "admin";
  return "renter";
};

const AuthContext = createContext<{
  user: AuthUser | null;
  signIn: (payload: LoginPayload) => Promise<AuthResponse>;
  signUp: (payload: RegisterPayload) => Promise<AuthResponse>;
  signOut: () => void;
  setUser: (user: AuthUser | null) => void;
}>({
  user: null,
  signIn: async () => {
    throw new Error("Auth provider not initialized");
  },
  signUp: async () => {
    throw new Error("Auth provider not initialized");
  },
  signOut: () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);

  const signIn = async (payload: LoginPayload) => {
    const response = await mobileClient.login(payload);
    authStore.setTokens(response.accessToken, response.refreshToken);
    const normalized = { ...response.user, role: normalizeRole(response.user.role) };
    setUserState(normalized);
    return { ...response, user: normalized };
  };

  const signUp = async (payload: RegisterPayload) => {
    const response = await mobileClient.register(payload);
    authStore.setTokens(response.accessToken, response.refreshToken);
    const normalized = { ...response.user, role: normalizeRole(response.user.role) };
    setUserState(normalized);
    return { ...response, user: normalized };
  };

  const signOut = () => {
    const refresh = authStore.getRefreshToken();
    if (refresh) {
      mobileClient.logout(refresh).catch(() => undefined);
    }
    authStore.clear();
    setUserState(null);
  };

  const setUser = (nextUser: AuthUser | null) => {
    if (!nextUser) {
      setUserState(null);
      return;
    }
    setUserState({ ...nextUser, role: normalizeRole(nextUser.role) });
  };

  const value = useMemo(() => ({ user, signIn, signUp, signOut, setUser }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
