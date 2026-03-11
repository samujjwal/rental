import { authStore } from '../../api/authStore';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

const SecureStore = jest.requireMock('expo-secure-store');

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore.__store as Map<string, string>).clear();
});

describe('authStore', () => {
  describe('getToken / setTokens', () => {
    it('returns null when no token stored', async () => {
      expect(await authStore.getToken()).toBeNull();
    });

    it('returns token after setTokens', async () => {
      await authStore.setTokens('access-123', 'refresh-456');
      expect(await authStore.getToken()).toBe('access-123');
    });

    it('stores both access and refresh tokens', async () => {
      await authStore.setTokens('at', 'rt');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_access_token', 'at');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_refresh_token', 'rt');
    });
  });

  describe('getRefreshToken', () => {
    it('returns null when no refresh token stored', async () => {
      expect(await authStore.getRefreshToken()).toBeNull();
    });

    it('returns refresh token after setTokens', async () => {
      await authStore.setTokens('at', 'my-refresh');
      expect(await authStore.getRefreshToken()).toBe('my-refresh');
    });
  });

  describe('clearTokens', () => {
    it('clears all stored data', async () => {
      await authStore.setTokens('at', 'rt');
      await authStore.setUser({ id: 'u1' });

      await authStore.clearTokens();

      expect(await authStore.getToken()).toBeNull();
      expect(await authStore.getRefreshToken()).toBeNull();
      expect(await authStore.getUser()).toBeNull();
    });

    it('calls deleteItemAsync for all keys', async () => {
      await authStore.clearTokens();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_refresh_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user');
    });
  });

  describe('setUser / getUser', () => {
    it('returns null when no user stored', async () => {
      expect(await authStore.getUser()).toBeNull();
    });

    it('stores and retrieves user as JSON', async () => {
      const user = { id: 'u1', email: 'test@test.com', role: 'renter' };
      await authStore.setUser(user);

      const result = await authStore.getUser<typeof user>();
      expect(result).toEqual(user);
    });

    it('handles getToken error gracefully', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('keychain locked'));
      expect(await authStore.getToken()).toBeNull();
    });

    it('handles getUser error gracefully', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('corrupt'));
      expect(await authStore.getUser()).toBeNull();
    });
  });
});
