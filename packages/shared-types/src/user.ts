// ============================================================================
// User Types
// Shared contract for user data between frontend and backend
// ============================================================================

import { UserRole, UserStatus } from './enums';

/** Auth response after login/signup */
export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: UserProfile;
}

/** Public user profile */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  role: UserRole | string;
  status?: UserStatus | string;
  isVerified?: boolean;
  bio?: string;
  joinedAt?: string;
  rating?: number;
  reviewCount?: number;
}

/** Update profile input */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
}

/** Login input */
export interface LoginInput {
  email: string;
  password: string;
}

/** Signup input */
export interface SignupInput {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role: 'renter' | 'owner';
}
