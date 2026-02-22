import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export const authStore = {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setTokens(access: string, refresh: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, access),
      SecureStore.setItemAsync(REFRESH_KEY, refresh),
    ]);
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },

  async setUser(user: Record<string, unknown>): Promise<void> {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async getUser<T>(): Promise<T | null> {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};
