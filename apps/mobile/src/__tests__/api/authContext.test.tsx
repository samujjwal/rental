import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../api/authStore', () => ({
  authStore: {
    getToken: jest.fn(),
    setTokens: jest.fn().mockResolvedValue(undefined),
    getRefreshToken: jest.fn(),
    clearTokens: jest.fn().mockResolvedValue(undefined),
    setUser: jest.fn().mockResolvedValue(undefined),
    getUser: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../api/client', () => ({
  mobileClient: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  },
  initializeAuth: jest.fn().mockResolvedValue(null),
  setCachedToken: jest.fn(),
  setOnForceLogout: jest.fn(),
}));

import { AuthProvider, useAuth } from '../../api/authContext';
import { authStore } from '../../api/authStore';
import { mobileClient, initializeAuth, setCachedToken, setOnForceLogout } from '../../api/client';

const mockAuthStore = jest.mocked(authStore);
const mockLogin = jest.mocked(mobileClient.login);
const mockRegister = jest.mocked(mobileClient.register);
const mockLogout = jest.mocked(mobileClient.logout);
const mockInitializeAuth = jest.mocked(initializeAuth);
const mockSetCachedToken = jest.mocked(setCachedToken);
const mockSetOnForceLogout = jest.mocked(setOnForceLogout);

// ── Helpers ────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializeAuth.mockResolvedValue(null);
    mockAuthStore.getUser.mockResolvedValue(null);
  });

  describe('initial state', () => {
    it('starts with isLoading=true and user=null', async () => {
      const { result } = renderAuth();

      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('session restore', () => {
    it('restores user from authStore when token is valid', async () => {
      const storedUser = { id: 'u1', email: 't@t.com', role: 'HOST' };
      mockInitializeAuth.mockResolvedValue('access-token');
      mockAuthStore.getUser.mockResolvedValue(storedUser);

      const { result } = renderAuth();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual({ ...storedUser, role: 'owner' });
    });

    it('stays null when no stored token', async () => {
      mockInitializeAuth.mockResolvedValue(null);

      const { result } = renderAuth();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('clears tokens when restore fails', async () => {
      mockInitializeAuth.mockRejectedValue(new Error('corrupt'));

      const { result } = renderAuth();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAuthStore.clearTokens).toHaveBeenCalled();
      expect(mockSetCachedToken).toHaveBeenCalledWith(null);
    });
  });

  describe('normalizeRole', () => {
    it.each([
      ['HOST', 'owner'],
      ['ADMIN', 'admin'],
      ['SUPER_ADMIN', 'admin'],
      ['USER', 'renter'],
      ['RENTER', 'renter'],
      [null, 'renter'],
      [undefined, 'renter'],
    ])('normalizes %s to %s', async (role, expected) => {
      const storedUser = { id: 'u1', email: 't@t.com', role };
      mockInitializeAuth.mockResolvedValue('token');
      mockAuthStore.getUser.mockResolvedValue(storedUser);

      const { result } = renderAuth();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user?.role).toBe(expected);
    });
  });

  describe('signIn', () => {
    it('calls mobileClient.login, stores tokens, and sets user', async () => {
      const loginResp = {
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 'u1', email: 'a@b.com', role: 'HOST' },
      };
      mockLogin.mockResolvedValue(loginResp);

      const { result } = renderAuth();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let resp: any;
      await act(async () => {
        resp = await result.current.signIn({ email: 'a@b.com', password: 'pass' });
      });

      expect(mockLogin).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' });
      expect(mockAuthStore.setTokens).toHaveBeenCalledWith('at', 'rt');
      expect(mockSetCachedToken).toHaveBeenCalledWith('at');
      expect(result.current.user?.role).toBe('owner');
      expect(resp.accessToken).toBe('at');
    });
  });

  describe('signUp', () => {
    it('calls mobileClient.register, stores tokens, and sets user', async () => {
      const regResp = {
        accessToken: 'at2',
        refreshToken: 'rt2',
        user: { id: 'u2', email: 'new@new.com', role: 'USER' },
      };
      mockRegister.mockResolvedValue(regResp);

      const { result } = renderAuth();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.signUp({ email: 'new@new.com', password: 'pass', name: 'New' } as any);
      });

      expect(mockRegister).toHaveBeenCalled();
      expect(result.current.user?.role).toBe('renter');
    });
  });

  describe('signOut', () => {
    it('calls logout, clears tokens, and nulls user', async () => {
      mockInitializeAuth.mockResolvedValue('token');
      mockAuthStore.getUser.mockResolvedValue({ id: 'u1', email: 'a@b.com', role: 'USER' });
      mockAuthStore.getRefreshToken.mockResolvedValue('rt');
      mockLogout.mockResolvedValue(undefined);

      const { result } = renderAuth();
      await waitFor(() => expect(result.current.user).not.toBeNull());

      await act(async () => {
        result.current.signOut();
        // signOut is fire-and-forget async
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockLogout).toHaveBeenCalledWith('rt');
      expect(mockAuthStore.clearTokens).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });

    it('clears state even if logout API fails', async () => {
      mockInitializeAuth.mockResolvedValue('token');
      mockAuthStore.getUser.mockResolvedValue({ id: 'u1', email: 'a@b.com', role: 'USER' });
      mockAuthStore.getRefreshToken.mockResolvedValue('rt');
      mockLogout.mockRejectedValue(new Error('network'));

      const { result } = renderAuth();
      await waitFor(() => expect(result.current.user).not.toBeNull());

      await act(async () => {
        result.current.signOut();
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockAuthStore.clearTokens).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });
  });

  describe('setUser', () => {
    it('normalizes role when setting user', async () => {
      const { result } = renderAuth();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setUser({ id: 'u1', email: 'a@b.com', role: 'ADMIN' } as any);
      });

      expect(result.current.user?.role).toBe('admin');
    });

    it('sets user to null', async () => {
      mockInitializeAuth.mockResolvedValue('token');
      mockAuthStore.getUser.mockResolvedValue({ id: 'u1', email: 'a@b.com', role: 'USER' });

      const { result } = renderAuth();
      await waitFor(() => expect(result.current.user).not.toBeNull());

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('force logout registration', () => {
    it('registers signOut as force logout handler', async () => {
      renderAuth();
      await waitFor(() => {
        expect(mockSetOnForceLogout).toHaveBeenCalled();
      });

      const handler = mockSetOnForceLogout.mock.calls[0][0];
      expect(typeof handler).toBe('function');
    });
  });
});
