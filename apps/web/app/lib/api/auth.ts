import { api } from "~/lib/api-client";
import type {
  AuthResponse,
  LoginRequest,
  SignupRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from "~/types/auth";

export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return api.post<AuthResponse>("/auth/login", credentials);
  },

  async signup(data: SignupRequest): Promise<AuthResponse> {
    return api.post<AuthResponse>("/auth/signup", data);
  },

  async logout(): Promise<void> {
    return api.post<void>("/auth/logout");
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return api.post<AuthResponse>("/auth/refresh", { refreshToken });
  },

  async forgotPassword(
    data: ForgotPasswordRequest
  ): Promise<{ message: string }> {
    return api.post<{ message: string }>("/auth/forgot-password", data);
  },

  async resetPassword(
    data: ResetPasswordRequest
  ): Promise<{ message: string }> {
    return api.post<{ message: string }>("/auth/reset-password", data);
  },

  async verifyEmail(data: VerifyEmailRequest): Promise<{ message: string }> {
    return api.post<{ message: string }>("/auth/verify-email", data);
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    return api.post<{ message: string }>("/auth/resend-verification", {
      email,
    });
  },

  async getCurrentUser() {
    return api.get("/auth/me");
  },
};
