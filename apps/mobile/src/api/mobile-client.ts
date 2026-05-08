/**
 * Mobile Client
 * 
 * Composed of domain-specific clients for clean separation of concerns.
 * Each domain client has its own error handling, retry logic, and type safety.
 */

import type { MobileClientConfig } from '~/types';
import {
  AuthClient,
  ListingsClient,
  BookingsClient,
  PaymentsClient,
  MessagingClient,
  UsersClient,
  OrganizationsClient,
  DisputesClient,
  ReviewsClient,
  NotificationsClient,
  GeoClient,
  AIClient,
  initializeAuth,
} from './clients';

export interface MobileClients {
  auth: AuthClient;
  listings: ListingsClient;
  bookings: BookingsClient;
  payments: PaymentsClient;
  messaging: MessagingClient;
  users: UsersClient;
  organizations: OrganizationsClient;
  disputes: DisputesClient;
  reviews: ReviewsClient;
  notifications: NotificationsClient;
  geo: GeoClient;
  ai: AIClient;
}

/**
 * Create mobile client with domain-specific clients
 */
export function createMobileClient(config: MobileClientConfig = {}): MobileClients {
  const baseUrl = config.baseUrl || process.env.API_BASE_URL || 'http://localhost:3400/api';
  const timeout = 15000; // Default timeout

  const clientConfig = { baseUrl, timeout, getAuthToken: config.getAuthToken };

  return {
    auth: new AuthClient(clientConfig),
    listings: new ListingsClient(clientConfig),
    bookings: new BookingsClient(clientConfig),
    payments: new PaymentsClient(clientConfig),
    messaging: new MessagingClient(clientConfig),
    users: new UsersClient(clientConfig),
    organizations: new OrganizationsClient(clientConfig),
    disputes: new DisputesClient(clientConfig),
    reviews: new ReviewsClient(clientConfig),
    notifications: new NotificationsClient(clientConfig),
    geo: new GeoClient(clientConfig),
    ai: new AIClient(clientConfig),
  };
}

/**
 * Initialize mobile client with auth
 */
export async function initializeMobileClient(config: MobileClientConfig = {}): Promise<MobileClients> {
  await initializeAuth();
  return createMobileClient(config);
}

// Default mobile client instance
let defaultMobileClient: MobileClients | null = null;

/**
 * Get or create default mobile client
 */
export function getMobileClient(config?: MobileClientConfig): MobileClients {
  if (!defaultMobileClient) {
    defaultMobileClient = createMobileClient(config);
  }
  return defaultMobileClient;
}

/**
 * Reset default mobile client (useful for testing)
 */
export function resetMobileClient(): void {
  defaultMobileClient = null;
}
