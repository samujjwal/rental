// ============================================================================
// Mobile-specific type shapes
// Simplified / divergent types for the mobile app that differ from shared-types.
// These represent the mobile API response shapes (lighter than full shared-types).
// ============================================================================

/**
 * Simplified listing detail for mobile views.
 */
export interface ListingDetail {
  id: string;
  title: string;
  description?: string;
  basePrice?: number;
  pricePerDay?: number;
  currency?: string;
  photos?: string[];
  images?: string[];
  status?: string;
  instantBooking?: boolean;
  bookingMode?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  owner?: {
    firstName?: string;
    lastName?: string | null;
  };
  averageRating?: number;
  totalReviews?: number;
  pricingMode?: string;
  serviceFeeRate?: number;
  taxRate?: number;
  fees?: {
    serviceFeePercent?: number;
    taxPercent?: number;
  };
}

/**
 * Simplified category for mobile views.
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
}

/**
 * Simplified booking summary for mobile list views.
 */
export interface BookingSummary {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalPrice?: number;
  totalAmount?: number;
  listing?: {
    id: string;
    title: string;
    photos?: string[];
  };
}

/**
 * Simplified booking detail for mobile.
 */
export interface BookingDetail {
  id: string;
  status: string;
  renterId?: string;
  ownerId?: string;
  startDate: string;
  endDate: string;
  totalAmount?: number;
  totalPrice?: number;
  listing?: {
    id: string;
    title: string;
    photos?: string[];
    images?: string[];
  };
}

/**
 * Simplified booking response after creation.
 */
export interface BookingResponse {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalPrice?: number;
}

/**
 * Simplified conversation summary for mobile messaging.
 */
export interface ConversationSummary {
  id: string;
  lastMessage?: string;
  updatedAt?: string;
  participants?: { id: string; name?: string }[];
}

/**
 * Mobile user profile — uses mobile field naming conventions.
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
  profilePhotoUrl?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone?: string | null;
  preferredLanguage?: string | null;
  preferredCurrency?: string | null;
  role?: string | null;
}

export type UpdateProfilePayload = Partial<Omit<UserProfile, 'id' | 'email'>>;

/**
 * Mobile review response (a review entity, different from shared-types ReviewResponse which is an owner reply).
 */
export interface ReviewResponse {
  id: string;
  overallRating: number;
  comment?: string | null;
  createdAt: string;
}

/**
 * Mobile organization — richer than shared-types OrganizationDetail.
 */
export type BusinessType = 'INDIVIDUAL' | 'LLC' | 'CORPORATION' | 'PARTNERSHIP';

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  businessType?: BusinessType | null;
  status?: string;
  verificationStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    listings?: number;
    members?: number;
  };
  settings?: {
    autoApproveMembers?: boolean;
    requireInsurance?: boolean;
    allowPublicProfile?: boolean;
  };
}

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  createdAt?: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string | null;
    profilePhotoUrl?: string | null;
  };
}

/**
 * Mobile message item for conversation threads.
 */
export interface MessageItem {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  attachments?: string[];
}

/**
 * Payment types for mobile.
 */
export interface PaymentBalance {
  balance: number;
  currency: string;
}

export interface PaymentTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  createdAt: string;
}

/**
 * Auth payloads for mobile login/register.
 */
export interface LoginPayload {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role?: string;
}

/**
 * Mobile client configuration.
 */
export interface MobileClientConfig {
  baseUrl?: string;
  getAuthToken?: () => string | null;
}
