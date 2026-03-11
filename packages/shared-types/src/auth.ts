// ============================================================================
// Auth Types
// Shared contract for authentication between frontend and backend
// ============================================================================

import type { User } from './user';

/** Auth response (re-exported from user.ts for convenience) */
export type { AuthResponse } from './user';

/** Login request body */
export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

/** Signup request body */
export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role?: string;
}

/** Refresh token request */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** Forgot password request */
export interface ForgotPasswordRequest {
  email: string;
}

/** Reset password request */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** Verify email request */
export interface VerifyEmailRequest {
  token: string;
}
