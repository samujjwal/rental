// ============================================================================
// User Types
// Shared contract for user data between frontend and backend
// ============================================================================

import { UserRole, UserStatus } from './enums';

// ---------------------------------------------------------------------------
// Role / Status mapping helpers
// The API returns raw Prisma enum values (USER, HOST, ADMIN …).
// Frontends display friendlier labels (renter, owner, admin).
// These helpers centralise the mapping so every consumer stays in sync.
// ---------------------------------------------------------------------------

/** Lowercase role labels used by frontends after normalisation */
export type FrontendRole = 'renter' | 'owner' | 'admin';

/** Lowercase status labels used by frontends after normalisation */
export type FrontendStatus = 'active' | 'suspended' | 'pending' | 'deleted';

/** Union of API (DB) values and frontend-friendly values */
export type UserRoleValue = UserRole | FrontendRole;
export type UserStatusValue = UserStatus | FrontendStatus;

/** Map a raw DB role to the frontend-friendly label */
export function normalizeRole(role?: string | null): FrontendRole {
  const upper = String(role ?? '').toUpperCase();
  if (upper === 'HOST' || upper === 'OWNER') return 'owner';
  if (
    upper === 'ADMIN' ||
    upper === 'SUPER_ADMIN' ||
    upper === 'OPERATIONS_ADMIN' ||
    upper === 'FINANCE_ADMIN' ||
    upper === 'SUPPORT_ADMIN'
  )
    return 'admin';
  return 'renter';
}

/** Map a raw DB status to the frontend-friendly label */
export function normalizeStatus(status?: string | null): FrontendStatus {
  const upper = String(status ?? '').toUpperCase();
  if (upper === 'ACTIVE') return 'active';
  if (upper === 'SUSPENDED') return 'suspended';
  if (upper === 'DELETED') return 'deleted';
  if (upper === 'PENDING_VERIFICATION' || upper === 'PENDING') return 'pending';
  return 'active'; // safe default
}

/** Auth response after login/signup */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** Full user record (authenticated user) */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  avatar: string | null;
  profilePhotoUrl?: string | null;
  phone: string | null;
  role: UserRoleValue;
  status: UserStatusValue;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  averageRating: number | null;
  rating?: number | null;
  totalReviews: number;
  totalBookings: number;
  totalListings?: number;
  bio?: string;
  responseRate?: number;
  responseTime?: string;
  location?: {
    city: string;
    state: string;
    country: string;
  };
  preferences?: UserPreferences;
  stripeCustomerId?: string;
  stripeConnectId?: string;
  createdAt: string;
  updatedAt: string;
  verified?: boolean;
}

/** Public user profile (visible to other users) */
export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string | null;
  profilePhotoUrl: string | null;
  bio?: string | null;
  averageRating: number | null;
  totalReviews: number | null;
  responseRate: number | null;
  responseTime: string | null;
  idVerificationStatus?: string | null;
  createdAt: string;
}

/**
 * Lightweight user profile (backward compat alias).
 * Prefer `User` for full authenticated user data.
 */
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

/** User preferences */
export interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  currency: string;
  language: string;
  timezone: string;
}

/** Notification preferences */
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  bookingUpdates: boolean;
  paymentUpdates: boolean;
  reviewAlerts: boolean;
  messageAlerts: boolean;
  marketingEmails: boolean;
}

/** Update user request body */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  bio?: string;
  location?: {
    city: string;
    state: string;
    country: string;
  };
}

/** Update profile input (simplified) */
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
  role: 'renter' | 'owner' | UserRole;
}

/** Extended user profile with listings and reviews */
export interface UserProfileExtended extends User {
  listings?: {
    id: string;
    title: string;
    images: string[];
    basePrice: number;
    rating: number;
  }[];
  reviews?: {
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    reviewer: {
      id: string;
      firstName: string;
      lastName: string | null;
      avatar: string | null;
    };
  }[];
}

/** Simplified user for lightweight contexts (mobile auth, etc.) */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  role?: string;
}

/** User statistics */
export interface UserStats {
  listingsCount: number;
  bookingsAsRenter: number;
  bookingsAsOwner: number;
  reviewsGiven: number;
  reviewsReceived: number;
  averageRating?: number | null;
  totalReviews?: number | null;
  responseRate?: number | null;
  responseTime?: number | null;
  memberSince?: string;
}
