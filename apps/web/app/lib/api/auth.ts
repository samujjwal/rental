import { api } from "~/lib/api-client";
import type {
  AuthResponse,
  LoginRequest,
  SignupRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "~/types/auth";

export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return api.post<AuthResponse>("/auth/login", credentials);
  },

  async devLogin(data: { email?: string; role?: string }): Promise<AuthResponse> {
    return api.post<AuthResponse>("/auth/dev-login", data);
  },

  async signup(data: SignupRequest): Promise<AuthResponse> {
    return api.post<AuthResponse>("/auth/register", data);
  },

  async logout(refreshToken?: string): Promise<void> {
    return api.post<void>("/auth/logout", { refreshToken });
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return api.post<AuthResponse>("/auth/refresh", { refreshToken });
  },

  async forgotPassword(
    data: ForgotPasswordRequest
  ): Promise<{ message: string }> {
    return api.post<{ message: string }>("/auth/password/reset-request", data);
  },

  async resetPassword(
    data: ResetPasswordRequest
  ): Promise<{ message: string }> {
    return api.post<{ message: string }>("/auth/password/reset", data);
  },

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    return api.post<void>("/auth/password/change", data);
  },

  async getCurrentUser() {
    return api.get("/auth/me");
  },
};
