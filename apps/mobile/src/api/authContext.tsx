import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authStore } from './authStore';
import { mobileClient, initializeAuth, setCachedToken, setOnForceLogout } from './client';
import type { AuthResponse, AuthUser, LoginPayload, RegisterPayload } from '@rental-portal/mobile-sdk';

const normalizeRole = (role?: string | null): string => {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'HOST') return 'owner';
  if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN') return 'admin';
  return 'renter';
};

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (payload: LoginPayload) => Promise<AuthResponse>;
  signUp: (payload: RegisterPayload) => Promise<AuthResponse>;
  signOut: () => void;
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
  signOut: () => {},
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

        // Validate stored token by fetching current user
        const storedUser = await authStore.getUser<AuthUser>();
        if (storedUser && !cancelled) {
          setUserState({ ...storedUser, role: normalizeRole(storedUser.role) });
        }
      } catch {
        // Token invalid or expired — clear it
        await authStore.clearTokens();
        setCachedToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const signOut = useCallback(() => {
    const doLogout = async () => {
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
    };
    doLogout();
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
