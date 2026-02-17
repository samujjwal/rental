let accessToken: string | null = null;
let refreshToken: string | null = null;

export const authStore = {
  getToken: () => accessToken,
  getRefreshToken: () => refreshToken,
  setToken: (token: string | null) => {
    accessToken = token;
  },
  setTokens: (token: string | null, refresh: string | null) => {
    accessToken = token;
    refreshToken = refresh;
  },
  clear: () => {
    accessToken = null;
    refreshToken = null;
  },
};
