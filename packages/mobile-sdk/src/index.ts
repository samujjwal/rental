export type GeoSuggestion = {
  id: string;
  provider: string;
  placeId?: string;
  shortLabel: string;
  formattedAddress: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  address: {
    subLocality?: string;
    locality?: string;
    adminAreaLevel1?: string;
    adminAreaLevel2?: string;
    postalCode?: string;
    countryCode?: string;
    country?: string;
  };
  types: string[];
  confidence?: number;
  accuracyMeters?: number;
};

export type GeoAutocompleteOptions = {
  limit?: number;
  lang?: string;
  biasLat?: number;
  biasLon?: number;
  biasZoom?: number;
  biasScale?: number;
  bbox?: string;
  layer?: string;
};

export type SearchSort = "relevance" | "price_asc" | "price_desc" | "rating" | "newest";

export type SearchParams = {
  query?: string;
  categoryId?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  minPrice?: number;
  maxPrice?: number;
  bookingMode?: string;
  condition?: string;
  features?: string[];
  sort?: SearchSort;
  page?: number;
  size?: number;
};

export type SearchResult = {
  id: string;
  title: string;
  description: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  city: string;
  state: string;
  country: string;
  location?: { lat?: number; lon?: number };
  basePrice: number;
  currency: string;
  photos: string[];
  ownerName: string;
  ownerRating: number;
  averageRating: number;
  totalReviews: number;
  bookingMode?: string;
  condition?: string;
  features?: string[];
  score?: number;
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
  page: number;
  size: number;
  aggregations?: unknown;
};

export type ListingDetail = {
  id: string;
  title: string;
  description?: string;
  pricePerDay?: number;
  basePrice?: number;
  currency?: string;
  images?: string[];
  photos?: string[];
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
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
};

export type MobileClientConfig = {
  baseUrl?: string;
  getAuthToken?: () => string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  role?: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
  mfaCode?: string;
};

export type BookingSummary = {
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
};

export type ConversationSummary = {
  id: string;
  lastMessage?: string;
  updatedAt?: string;
  participants?: { id: string; name?: string }[];
};

export type UserProfile = {
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
};

export type UpdateProfilePayload = Partial<Omit<UserProfile, "id" | "email">>;

export type BusinessType = "INDIVIDUAL" | "LLC" | "CORPORATION" | "PARTNERSHIP";
export type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER";

export type Organization = {
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
};

export type OrganizationMember = {
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
};

export type CreateOrganizationPayload = {
  name: string;
  description?: string;
  businessType: BusinessType;
  taxId?: string;
  email: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type UpdateOrganizationPayload = {
  name?: string;
  description?: string;
  website?: string;
  email?: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  settings?: Record<string, unknown>;
};

export type InviteMemberPayload = {
  email: string;
  role: OrganizationRole;
};

export type UpdateMemberRolePayload = {
  role: OrganizationRole;
};

export type DisputeType =
  | "PROPERTY_DAMAGE"
  | "MISSING_ITEMS"
  | "CONDITION_MISMATCH"
  | "REFUND_REQUEST"
  | "PAYMENT_ISSUE"
  | "OTHER";

export type CreateDisputePayload = {
  bookingId: string;
  type: DisputeType;
  title: string;
  description: string;
  amount?: number;
};

export type Dispute = {
  id: string;
  bookingId: string;
  title?: string | null;
  type: string;
  description: string;
  amount?: number;
  status: string;
  createdAt: string;
};

export type DisputeParticipant = {
  id: string;
  email?: string;
};

export type DisputeResponse = {
  id: string;
  content: string;
  createdAt: string;
  user?: DisputeParticipant;
};

export type DisputeDetail = Dispute & {
  initiatorId?: string;
  defendantId?: string;
  booking?: {
    id: string;
    listing?: {
      id: string;
      title: string;
    };
    renter?: DisputeParticipant;
  };
  initiator?: DisputeParticipant;
  defendant?: DisputeParticipant;
  responses?: DisputeResponse[];
};

export type NotificationPreferences = {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  bookingUpdates: boolean;
  paymentUpdates: boolean;
  reviewAlerts: boolean;
  messageAlerts: boolean;
  marketingEmails: boolean;
};

export type CreateListingPayload = {
  categoryId: string;
  title: string;
  description: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  pricingMode: string;
  basePrice: number;
  bookingMode: string;
  categorySpecificData: Record<string, unknown>;
  currency?: string;
};

export type PaymentIntentResponse = {
  clientSecret?: string;
  paymentIntentId?: string;
};

export type PaymentBalance = {
  balance: number;
  currency: string;
};

export type PaymentTransaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  createdAt: string;
};

export type BookingCreatePayload = {
  listingId: string;
  startDate: string;
  endDate: string;
  guestCount?: number;
  message?: string;
  promoCode?: string;
};

export type BookingResponse = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalPrice?: number;
};

export type BookingAvailability = {
  available: boolean;
  blockedDates?: string[];
  availableDates?: string[];
  message?: string;
};

export type BookingDetail = {
  id: string;
  status: string;
  renterId?: string;
  ownerId?: string;
  startDate: string;
  endDate: string;
  totalAmount?: number;
  listing?: {
    id: string;
    title: string;
    images?: string[];
  };
};

export type MessageItem = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  attachments?: string[];
};

export type SendMessagePayload = {
  content: string;
  attachments?: string[];
};

export type ReviewPayload = {
  bookingId: string;
  reviewType: "RENTER_TO_OWNER" | "OWNER_TO_RENTER";
  overallRating: number;
  comment?: string;
};

export type ReviewResponse = {
  id: string;
  overallRating: number;
  comment?: string | null;
  createdAt: string;
};

export type UserStats = {
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
};

export function createMobileClient(config: MobileClientConfig = {}) {
  const baseUrl = config.baseUrl || "http://localhost:3400/api";

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers || {});
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const token = config.getAuthToken?.();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed (${response.status})`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  };

  return {
    login: (payload: LoginPayload) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    register: (payload: RegisterPayload) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    requestPasswordReset: (email: string) =>
      request<void>("/auth/password/reset-request", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, newPassword: string) =>
      request<void>("/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      }),

    logout: (refreshToken: string) =>
      request<void>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),

    geoAutocomplete: (query: string, options: GeoAutocompleteOptions = {}) => {
      const params = new URLSearchParams({ q: query });
      if (options.limit != null) params.set("limit", String(options.limit));
      if (options.lang) params.set("lang", options.lang);
      if (options.biasLat != null) params.set("lat", String(options.biasLat));
      if (options.biasLon != null) params.set("lon", String(options.biasLon));
      if (options.biasZoom != null) params.set("zoom", String(options.biasZoom));
      if (options.biasScale != null) {
        params.set("location_bias_scale", String(options.biasScale));
      }
      if (options.bbox) params.set("bbox", options.bbox);
      if (options.layer) params.set("layer", options.layer);
      return request<{ results: GeoSuggestion[] }>(`/geo/autocomplete?${params}`);
    },

    geoReverse: (lat: number, lon: number, lang?: string) => {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
      });
      if (lang) params.set("lang", lang);
      return request<{ result: GeoSuggestion | null }>(`/geo/reverse?${params}`);
    },

    search: (params: SearchParams) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          query.set(key, value.join(","));
        } else {
          query.set(key, String(value));
        }
      });
      return request<SearchResponse>(`/search?${query}`);
    },

    categories: () => request<Category[]>("/categories"),

    getListing: (listingId: string) =>
      request<ListingDetail>(`/listings/${listingId}`),

    getMyListings: () => request<ListingDetail[]>("/listings/my-listings"),

    getMyBookings: (status?: string) =>
      request<BookingSummary[]>(
        `/bookings/my-bookings${
          status ? `?status=${encodeURIComponent(status.toUpperCase())}` : ""
        }`
      ),

    getHostBookings: (status?: string) =>
      request<BookingSummary[]>(
        `/bookings/host-bookings${
          status ? `?status=${encodeURIComponent(status.toUpperCase())}` : ""
        }`
      ),

    getConversations: async () => {
      const response = await request<{ conversations: any[] }>(`/conversations`);
      const items = (response.conversations || []).map((conv) => {
        const participants = (conv.participants || []).map((p: any) => {
          const user = p.user || {};
          const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
          return {
            id: p.userId || user.id,
            name: name || user.email || "User",
          };
        });

        return {
          id: conv.id,
          lastMessage: conv.lastMessage?.content || "",
          updatedAt: conv.updatedAt,
          participants,
        } as ConversationSummary;
      });

      return { items };
    },

    getProfile: () => request<UserProfile>("/users/me"),

    updateProfile: (payload: UpdateProfilePayload) =>
      request<UserProfile>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    upgradeToOwner: () =>
      request<AuthUser>("/users/upgrade-to-owner", {
        method: "POST",
      }),

    getOrganizations: () =>
      request<{ organizations: Organization[]; total: number }>("/organizations/my"),

    getOrganization: (organizationId: string) =>
      request<Organization>(`/organizations/${organizationId}`),

    createOrganization: (payload: CreateOrganizationPayload) =>
      request<Organization>("/organizations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    updateOrganization: (organizationId: string, payload: UpdateOrganizationPayload) =>
      request<Organization>(`/organizations/${organizationId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),

    deactivateOrganization: (organizationId: string) =>
      request<void>(`/organizations/${organizationId}`, {
        method: "DELETE",
      }),

    getOrganizationMembers: (organizationId: string) =>
      request<{ members: OrganizationMember[]; total: number }>(
        `/organizations/${organizationId}/members`
      ),

    inviteOrganizationMember: (organizationId: string, payload: InviteMemberPayload) =>
      request<{ message: string; invitationId: string }>(
        `/organizations/${organizationId}/members`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    updateOrganizationMemberRole: (
      organizationId: string,
      memberId: string,
      payload: UpdateMemberRolePayload
    ) =>
      request<OrganizationMember>(
        `/organizations/${organizationId}/members/${memberId}/role`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      ),

    removeOrganizationMember: (organizationId: string, memberId: string) =>
      request<void>(`/organizations/${organizationId}/members/${memberId}`, {
        method: "DELETE",
      }),

    createDispute: (payload: CreateDisputePayload) =>
      request<Dispute>("/disputes", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    getMyDisputes: (status?: string) =>
      request<{ disputes: Dispute[]; total: number }>(
        `/disputes${status ? `?status=${encodeURIComponent(status)}` : ""}`
      ),

    getDisputeById: (disputeId: string) =>
      request<DisputeDetail>(`/disputes/${disputeId}`),

    respondToDispute: (disputeId: string, message: string) =>
      request<DisputeResponse>(`/disputes/${disputeId}/responses`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),

    closeDispute: (disputeId: string, reason: string) =>
      request<DisputeDetail>(`/disputes/${disputeId}/close`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),

    getNotificationPreferences: () =>
      request<NotificationPreferences>("/notifications/preferences"),

    updateNotificationPreferences: (payload: Partial<NotificationPreferences>) =>
      request<NotificationPreferences>("/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    getUserById: (userId: string) =>
      request<UserProfile>(`/users/${userId}`),

    getUserListings: (userId: string) =>
      request<{ listings: ListingDetail[] }>(`/listings?ownerId=${encodeURIComponent(userId)}`),

    getUserReviews: (userId: string, type: "received" | "given" = "received", page: number = 1, limit: number = 10) =>
      request<{ reviews: ReviewResponse[]; total: number }>(
        `/reviews/user/${encodeURIComponent(userId)}?type=${type}&page=${page}&limit=${limit}`
      ),

    getFavorites: () =>
      request<{ favorites: { createdAt: string; listing: ListingDetail }[] }>(`/favorites`)
        .then((response) => (response.favorites || []).map((favorite) => favorite.listing)),

    addFavorite: (listingId: string) =>
      request<void>("/favorites", {
        method: "POST",
        body: JSON.stringify({ listingId }),
      }),

    removeFavorite: (listingId: string) =>
      request<void>(`/favorites/${listingId}`, {
        method: "DELETE",
      }),

    createListing: (payload: CreateListingPayload) =>
      request<ListingDetail>("/listings", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    updateListing: (listingId: string, payload: Partial<CreateListingPayload>) =>
      request<ListingDetail>(`/listings/${listingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    publishListing: (listingId: string) =>
      request<void>(`/listings/${listingId}/publish`, {
        method: "POST",
      }),

    pauseListing: (listingId: string) =>
      request<void>(`/listings/${listingId}/pause`, {
        method: "POST",
      }),

    activateListing: (listingId: string) =>
      request<void>(`/listings/${listingId}/activate`, {
        method: "POST",
      }),

    deleteListing: (listingId: string) =>
      request<void>(`/listings/${listingId}`, {
        method: "DELETE",
      }),

    createPaymentIntent: (bookingId: string) =>
      request<PaymentIntentResponse>(`/payments/intents/${bookingId}`, {
        method: "POST",
      }),

    getPaymentBalance: () => request<PaymentBalance>("/payments/balance"),

    getPaymentEarnings: () =>
      request<{ amount: number; currency: string }>("/payments/earnings"),

    getPaymentTransactions: (page: number = 1, limit: number = 20) =>
      request<{ transactions: PaymentTransaction[]; total: number; page: number; limit: number }>(
        `/payments/transactions?page=${page}&limit=${limit}`
      ),

    createBooking: (payload: BookingCreatePayload) =>
      request<BookingResponse>("/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    approveBooking: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/approve`, {
        method: "POST",
      }),

    cancelBooking: (bookingId: string, reason?: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),

    rejectBooking: (bookingId: string, reason?: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),

    startBooking: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/start`, {
        method: "POST",
      }),

    requestReturn: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/request-return`, {
        method: "POST",
      }),

    approveReturn: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}/approve-return`, {
        method: "POST",
      }),

    checkAvailability: (listingId: string, startDate: string, endDate: string) =>
      request<BookingAvailability>(`/listings/${listingId}/check-availability`, {
        method: "POST",
        body: JSON.stringify({ startDate, endDate }),
      }),

    getBooking: (bookingId: string) =>
      request<BookingDetail>(`/bookings/${bookingId}`),

    getConversationMessages: (conversationId: string) =>
      request<{ messages: MessageItem[]; total: number; hasMore: boolean }>(
        `/conversations/${conversationId}/messages`
      ),

    sendMessage: (conversationId: string, payload: SendMessagePayload) =>
      request<MessageItem>(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    markConversationRead: (conversationId: string) =>
      request<{ marked: number }>(`/conversations/${conversationId}/read`, {
        method: "POST",
      }),

    getListingReviews: (listingId: string, page: number = 1, limit: number = 10) =>
      request<{
        reviews: ReviewResponse[];
        total: number;
        averageRating: number;
        ratingDistribution: Record<number, number>;
      }>(`/reviews/listing/${listingId}?page=${page}&limit=${limit}`),

    createReview: (payload: ReviewPayload) =>
      request<ReviewResponse>("/reviews", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    getUserStats: () => request<UserStats>("/users/me/stats"),
  };
}
