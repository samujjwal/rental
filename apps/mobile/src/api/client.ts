import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  UserProfile,
  BookingSummary,
  BookingDetail,
  BookingResponse,
  ConversationSummary,
  ListingDetail,
  Category,
  Organization,
  OrganizationMember,
  Dispute,
  DisputeDetail,
  NotificationPreferences,
  ReviewResponse,
  PaymentBalance,
  PaymentTransaction,
  AuthUser,
  UserStats,
  GeoSuggestion,
  GeoAutocompleteOptions,
  SearchParams,
  SearchResponse,
  MessageItem,
  MobileClientConfig,
  CreateDisputePayload,
} from '~/types';
import type { BookingAvailability } from '@rental-portal/shared-types';
import type { DisputeResponse as DisputeResponseType } from '@rental-portal/shared-types';
import { authStore } from './authStore';
import { API_BASE_URL } from '../config';

// ---------------------------------------------------------------------------
// createMobileClient — previously in @rental-portal/mobile-sdk
// ---------------------------------------------------------------------------
function createMobileClient(config: MobileClientConfig = {}) {
  const baseUrl = config.baseUrl || 'http://localhost:3400/api';

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = config.getAuthToken?.();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = `${baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      let response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      // Automatic 401 retry with token refresh
      if (response.status === 401 && token) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          headers.set('Authorization', `Bearer ${cachedToken}`);
          // Create a fresh AbortController for the retry — the original may have
          // consumed part of its timeout budget already.
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), 15000);
          try {
            response = await fetch(url, { ...init, headers, signal: retryController.signal });
          } finally {
            clearTimeout(retryTimeoutId);
          }
        } else {
          await authStore.clearTokens();
          cachedToken = null;
          onForceLogout?.();
          throw new Error('Session expired. Please sign in again.');
        }
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed (${response.status})`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return {
    login: (payload: LoginPayload) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    register: (payload: RegisterPayload) =>
      request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    requestPasswordReset: (email: string) =>
      request<void>('/auth/password/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, newPassword: string) =>
      request<void>('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),

    logout: (refreshToken: string) =>
      request<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),

    geoAutocomplete: (query: string, options: GeoAutocompleteOptions = {}) => {
      const params = new URLSearchParams({ q: query });
      if (options.limit != null) params.set('limit', String(options.limit));
      if (options.lang) params.set('lang', options.lang);
      if (options.biasLat != null) params.set('lat', String(options.biasLat));
      if (options.biasLon != null) params.set('lon', String(options.biasLon));
      if (options.biasZoom != null) params.set('zoom', String(options.biasZoom));
      if (options.biasScale != null) {
        params.set('location_bias_scale', String(options.biasScale));
      }
      if (options.bbox) params.set('bbox', options.bbox);
      if (options.layer) params.set('layer', options.layer);
      return request<{ results: GeoSuggestion[] }>(`/geo/autocomplete?${params}`);
    },

    geoReverse: (lat: number, lon: number, lang?: string) => {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
      });
      if (lang) params.set('lang', lang);
      return request<{ result: GeoSuggestion | null }>(`/geo/reverse?${params}`);
    },

    search: (params: SearchParams) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          query.set(key, value.join(','));
        } else {
          query.set(key, String(value));
        }
      });
      return request<SearchResponse>(`/search?${query}`);
    },

    categories: () => request<Category[]>('/categories'),

    getListing: (listingId: string) =>
      request<ListingDetail>(`/listings/${listingId}`),

    getMyListings: () => request<ListingDetail[]>('/listings/my-listings'),

    getMyBookings: (status?: string) =>
      request<BookingSummary[]>(
        `/bookings/my-bookings${
          status ? `?status=${encodeURIComponent(status.toUpperCase())}` : ''
        }`,
      ),

    getHostBookings: (status?: string) =>
      request<BookingSummary[]>(
        `/bookings/host-bookings${
          status ? `?status=${encodeURIComponent(status.toUpperCase())}` : ''
        }`,
      ),

    getConversations: async () => {
      const response = await request<{ conversations: any[] }>('/conversations');
      const items = (response.conversations || []).map((conv: any) => {
        const participants = (conv.participants || []).map((p: any) => {
          const user = p.user || {};
          const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
          return {
            id: p.userId || user.id,
            name: name || user.email || 'User',
          };
        });

        return {
          id: conv.id,
          lastMessage: conv.lastMessage?.content || '',
          updatedAt: conv.updatedAt,
          participants,
        } as ConversationSummary;
      });

      return { items };
    },

    getProfile: () => request<UserProfile>('/users/me'),

    updateProfile: (payload: Partial<Omit<UserProfile, 'id' | 'email'>>) =>
      request<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    upgradeToOwner: () =>
      request<AuthUser>('/users/upgrade-to-owner', {
        method: 'POST',
      }),

    getOrganizations: () =>
      request<{ organizations: Organization[]; total: number }>('/organizations/my'),

    getOrganization: (organizationId: string) =>
      request<Organization>(`/organizations/${organizationId}`),

    createOrganization: (payload: any) =>
      request<Organization>('/organizations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    updateOrganization: (organizationId: string, payload: any) =>
      request<Organization>(`/organizations/${organizationId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    deactivateOrganization: (organizationId: string) =>
      request<void>(`/organizations/${organizationId}`, {
        method: 'DELETE',
      }),

    getOrganizationMembers: (organizationId: string) =>
      request<{ members: OrganizationMember[]; total: number }>(
        `/organizations/${organizationId}/members`,
      ),

    inviteOrganizationMember: (organizationId: string, payload: { email: string; role: string }) =>
      request<{ message: string; invitationId: string }>(
        `/organizations/${organizationId}/members`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),

    updateOrganizationMemberRole: (
      organizationId: string,
      memberId: string,
      payload: { role: string },
    ) =>
      request<OrganizationMember>(
        `/organizations/${organizationId}/members/${memberId}/role`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
      ),

    removeOrganizationMember: (organizationId: string, memberId: string) =>
      request<void>(`/organizations/${organizationId}/members/${memberId}`, {
        method: 'DELETE',
      }),

    createDispute: (payload: CreateDisputePayload) =>
      request<Dispute>('/disputes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getMyDisputes: (status?: string) =>
      request<{ disputes: Dispute[]; total: number }>(
        `/disputes${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      ),

    getDisputeById: (disputeId: string) =>
      request<DisputeDetail>(`/disputes/${disputeId}`),

    respondToDispute: (disputeId: string, message: string) =>
      request<DisputeResponseType>(`/disputes/${disputeId}/responses`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),

    closeDispute: (disputeId: string, reason: string) =>
      request<DisputeDetail>(`/disputes/${disputeId}/close`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    getNotificationPreferences: () =>
      request<NotificationPreferences>('/notifications/preferences'),

    updateNotificationPreferences: (payload: Partial<NotificationPreferences>) =>
      request<NotificationPreferences>('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    getUserById: (userId: string) =>
      request<UserProfile>(`/users/${userId}`),

    getUserListings: (userId: string) =>
      request<{ listings: ListingDetail[] }>(`/listings?ownerId=${encodeURIComponent(userId)}`),

    getUserReviews: (
      userId: string,
      type: 'received' | 'given' = 'received',
      page: number = 1,
      limit: number = 10,
    ) =>
      request<{ reviews: ReviewResponse[]; total: number }>(
        `/reviews/user/${encodeURIComponent(userId)}?type=${type}&page=${page}&limit=${limit}`,
      ),

    getFavorites: () =>
      request<{ favorites: { createdAt: string; listing: ListingDetail }[] }>('/favorites').then(
        (response) => (response.favorites || []).map((favorite) => favorite.listing),
      ),

    addFavorite: (listingId: string) =>
      request<void>('/favorites', {
        method: 'POST',
        body: JSON.stringify({ listingId }),
      }),

    removeFavorite: (listingId: string) =>
      request<void>(`/favorites/${listingId}`, {
        method: 'DELETE',
      }),

    createListing: (payload: any) =>
      request<ListingDetail>('/listings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    uploadImages: async (images: Array<{ uri: string; fileName?: string; mimeType?: string }>): Promise<string[]> => {
      const formData = new FormData();
      images.forEach((img, i) => {
        formData.append('files', {
          uri: img.uri,
          name: img.fileName || `image_${i}.jpg`,
          type: img.mimeType || 'image/jpeg',
        } as any);
      });

      const doUpload = async (token: string | null) => {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${baseUrl}/upload/images`, {
          method: 'POST',
          headers,
          body: formData,
        });
        return response;
      };

      let token = config.getAuthToken?.() || null;
      let response = await doUpload(token);

      // Retry on 401
      if (response.status === 401 && token) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          token = cachedToken;
          response = await doUpload(token);
        } else {
          await authStore.clearTokens();
          cachedToken = null;
          onForceLogout?.();
          throw new Error('Session expired. Please sign in again.');
        }
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Image upload failed');
      }
      const results: { url: string }[] = await response.json();
      return results.map((r) => r.url);
    },

    updateListing: (listingId: string, payload: any) =>
      request<ListingDetail>(`/listings/${listingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    publishListing: (listingId: string) =>
      request<void>(`/listings/${listingId}/publish`, {
        method: 'POST',
      }),

    pauseListing: (listingId: string) =>
      request<void>(`/listings/${listingId}/pause`, {
        method: 'POST',
      }),

    activateListing: (listingId: string) =>
      request<void>(`/listings/${listingId}/activate`, {
        method: 'POST',
      }),

    deleteListing: (listingId: string) =>
      request<void>(`/listings/${listingId}`, {
        method: 'DELETE',
      }),

    createPaymentIntent: (bookingId: string) =>
      request<{ clientSecret?: string; paymentIntentId?: string }>(
        `/payments/intents/${bookingId}`,
        { method: 'POST' },
      ),

    getPaymentBalance: () => request<PaymentBalance>('/payments/balance'),

    getPaymentEarnings: () =>
      request<{ amount: number; currency: string }>('/payments/earnings'),

    getPaymentTransactions: (page: number = 1, limit: number = 20) =>
      request<{ transactions: PaymentTransaction[]; total: number; page: number; limit: number }>(
        `/payments/transactions?page=${page}&limit=${limit}`,
      ),

    createBooking: (payload: any) =>
      request<BookingResponse>('/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    approveBooking: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/approve`, {
        method: 'POST',
      }),

    cancelBooking: (bookingId: string, reason?: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    rejectBooking: (bookingId: string, reason?: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    startBooking: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/start`, {
        method: 'POST',
      }),

    requestReturn: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/request-return`, {
        method: 'POST',
      }),

    approveReturn: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/approve-return`, {
        method: 'POST',
      }),

    rejectReturn: (bookingId: string, reason: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/reject-return`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    checkAvailability: (listingId: string, startDate: string, endDate: string) =>
      request<BookingAvailability>(`/listings/${listingId}/check-availability`, {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate }),
      }),

    getBooking: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}`),

    getConversationMessages: (conversationId: string) =>
      request<{ messages: MessageItem[]; total: number; hasMore: boolean }>(
        `/conversations/${conversationId}/messages`,
      ),

    sendMessage: (conversationId: string, payload: { content: string; attachments?: string[] }) =>
      request<MessageItem>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    markConversationRead: (conversationId: string) =>
      request<{ marked: number }>(`/conversations/${conversationId}/read`, {
        method: 'POST',
      }),

    getListingReviews: (listingId: string, page: number = 1, limit: number = 10) =>
      request<{
        reviews: ReviewResponse[];
        total: number;
        averageRating: number;
        ratingDistribution: Record<number, number>;
      }>(`/reviews/listing/${listingId}?page=${page}&limit=${limit}`),

    createReview: (payload: {
      bookingId: string;
      reviewType: 'RENTER_TO_OWNER' | 'OWNER_TO_RENTER';
      overallRating: number;
      comment?: string;
    }) =>
      request<ReviewResponse>('/reviews', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getUserStats: () => request<UserStats>('/users/me/stats'),

    registerDeviceToken: (token: string, platform: string) =>
      request<void>('/notifications/devices/register', {
        method: 'POST',
        body: JSON.stringify({ token, platform }),
      }),

    unregisterDeviceToken: (token: string) =>
      request<void>('/notifications/devices/unregister', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),

    getNotifications: (page = 1, limit = 20) =>
      request<{ data: any[]; total: number; page: number; limit: number }>(
        `/notifications?page=${page}&limit=${limit}`,
      ),

    getUnreadNotificationCount: () =>
      request<{ count: number }>('/notifications/unread-count'),

    markNotificationRead: (id: string) =>
      request<void>(`/notifications/${id}/read`, { method: 'POST' }),

    markAllNotificationsRead: () =>
      request<void>('/notifications/read-all', { method: 'POST' }),

    deleteNotification: (id: string) =>
      request<void>(`/notifications/${id}`, { method: 'DELETE' }),

    createConversation: (payload: { listingId?: string; recipientId: string; message?: string }) =>
      request<any>('/conversations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    generateDescription: (data: {
      title: string;
      category?: string;
      city?: string;
      features?: string[];
      condition?: string;
      basePrice?: number;
    }) =>
      request<{ description: string; model: string; tokens?: number }>(
        '/ai/generate-description',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),

    getPriceSuggestion: (params?: {
      categoryId?: string;
      city?: string;
      condition?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params?.categoryId) qs.set('categoryId', params.categoryId);
      if (params?.city) qs.set('city', params.city);
      if (params?.condition) qs.set('condition', params.condition);
      const query = qs.toString();
      return request<{
        averagePrice: number;
        medianPrice: number;
        minPrice: number;
        maxPrice: number;
        suggestedRange: { min: number; max: number };
        sampleSize: number;
      }>(`/listings/price-suggestion${query ? `?${query}` : ''}`, {});
    },

    exportData: () => request<any>('/users/me/export'),

    googleLogin: (idToken: string) =>
      request<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      }),

    appleLogin: (
      identityToken: string,
      authorizationCode: string,
      firstName?: string,
      lastName?: string,
    ) =>
      request<AuthResponse>('/auth/apple', {
        method: 'POST',
        body: JSON.stringify({ identityToken, authorizationCode, firstName, lastName }),
      }),

    requestOtp: (email: string) =>
      request<{ message: string }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    verifyOtp: (email: string, code: string) =>
      request<AuthResponse>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      }),

    sendVerificationEmail: () =>
      request<void>('/auth/verify-email/send', { method: 'POST' }),

    sendPhoneVerification: () =>
      request<{ message: string }>('/auth/verify-phone/send', { method: 'POST' }),

    verifyPhone: (code: string) =>
      request<{ message: string }>('/auth/verify-phone/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),

    uploadIdentityDocument: (data: {
      documentType: string;
      documentUrl: string;
      expiresAt?: string;
    }) =>
      request<any>('/kyc/documents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getIdentityDocuments: () => request<any[]>('/kyc/documents'),

    getBookingInvoice: (bookingId: string) =>
      request<any>(`/bookings/${bookingId}/invoice?format=json`),
  };
}

// In-memory cache for current access token (avoid async SecureStore on every request)
let cachedToken: string | null = null;

// Initialize cached token from SecureStore on app load
export async function initializeAuth(): Promise<string | null> {
  cachedToken = await authStore.getToken();
  return cachedToken;
}

export function setCachedToken(token: string | null): void {
  cachedToken = token;
}

// Event emitter for auth state changes (logout on refresh failure)
type AuthEventHandler = () => void;
let onForceLogout: AuthEventHandler | null = null;

export function setOnForceLogout(handler: AuthEventHandler | null): void {
  onForceLogout = handler;
}

// Token refresh state to prevent concurrent refreshes
let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await authStore.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      await authStore.setTokens(data.accessToken, data.refreshToken);
      cachedToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const mobileClient = createMobileClient({
  baseUrl: API_BASE_URL,
  getAuthToken: () => cachedToken,
});

/**
 * Authenticated fetch wrapper with automatic 401 refresh.
 * Use this for custom API calls not covered by mobileClient.
 */
export async function authenticatedFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (cachedToken) {
    headers.set('Authorization', `Bearer ${cachedToken}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${cachedToken}`);
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    } else {
      await authStore.clearTokens();
      cachedToken = null;
      onForceLogout?.();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
