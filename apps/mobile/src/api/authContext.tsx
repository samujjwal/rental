import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authStore } from './authStore';
import { mobileClient, initializeAuth, setCachedToken, setOnForceLogout } from './client';
import type { AuthUser, LoginPayload, RegisterPayload } from '~/types';
import { normalizeRole } from '@rental-portal/shared-types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (payload: LoginPayload) => Promise<{ accessToken: string; refreshToken: string; user: AuthUser }>;
  signUp: (payload: RegisterPayload) => Promise<{ accessToken: string; refreshToken: string; user: AuthUser }>;
  signOut: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signIn: async () => {
    throw new Error('Auth provider not initialized');
  },
  signUp: async () => {
    throw new Error('Auth provider not initialized');
  },
  signOut: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from SecureStore on mount
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const token = await initializeAuth();
        if (!token || cancelled) {
          setIsLoading(false);
          return;
        }

        // Validate the stored token against the server; fall back to stored user
        // on network failure so offline app launches still work.
        let freshUser: AuthUser | null = null;
        try {
          const profile = await mobileClient.getProfile();
          freshUser = { ...profile, role: normalizeRole(profile.role) } as AuthUser;
        } catch {
          // Server unreachable or token revoked — use stored user for offline UX
          const storedUser = await authStore.getUser<AuthUser>();
          if (storedUser) {
            freshUser = { ...storedUser, role: normalizeRole(storedUser.role) };
          }
        }

        if (freshUser && !cancelled) {
          await authStore.setUser(freshUser);
          setUserState(freshUser);
        }
      } catch {
        // Token invalid or storage error — clear session
        await authStore.clearTokens();
        setCachedToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const refresh = await authStore.getRefreshToken();
      if (refresh) {
        await mobileClient.logout(refresh).catch(() => undefined);
      }
    } finally {
      await authStore.clearTokens();
      setCachedToken(null);
      setUserState(null);
    }
  }, []);

  // Register force-logout handler for 401 refresh failures
  useEffect(() => {
    setOnForceLogout(signOut);
    return () => setOnForceLogout(null);
  }, [signOut]);

  const signIn = useCallback(async (payload: LoginPayload) => {
    const response = await mobileClient.login(payload);
    await authStore.setTokens(response.accessToken, response.refreshToken);
    setCachedToken(response.accessToken);
    const normalized = { ...response.user, role: normalizeRole(response.user.role) };
    await authStore.setUser(normalized);
    setUserState(normalized);
    return { ...response, user: normalized };
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const response = await mobileClient.register(payload);
    await authStore.setTokens(response.accessToken, response.refreshToken);
    setCachedToken(response.accessToken);
    const normalized = { ...response.user, role: normalizeRole(response.user.role) };
    await authStore.setUser(normalized);
    setUserState(normalized);
    return { ...response, user: normalized };
  }, []);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    if (!nextUser) {
      setUserState(null);
      return;
    }
    const normalized = { ...nextUser, role: normalizeRole(nextUser.role) };
    setUserState(normalized);
    authStore.setUser(normalized);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, signIn, signUp, signOut, setUser }),
    [user, isLoading, signIn, signUp, signOut, setUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
