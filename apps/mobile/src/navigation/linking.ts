import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import type { RootStackParamList } from '../../App';

/**
 * Deep linking configuration for the mobile app.
 *
 * Supports:
 *   - Custom scheme: gharbatai://
 *   - Universal links: https://gharbatai.com
 *
 * Examples:
 *   gharbatai://listings/abc123       → Listing screen
 *   gharbatai://bookings/abc123       → BookingDetail screen
 *   gharbatai://messages/abc123       → MessageThread screen
 *   gharbatai://checkout/abc123       → Checkout screen
 *   gharbatai://search                → Main (Search tab)
 *   gharbatai://profile/abc123        → ProfileView screen
 *   gharbatai://disputes/abc123       → DisputeDetail screen
 *   gharbatai://settings              → Settings screen
 */
export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),          // gharbatai://
    'https://gharbatai.com',
    'https://www.gharbatai.com',
  ],
  config: {
    screens: {
      // Auth
      Login: 'login',
      Signup: 'signup',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',

      // Main tab navigator
      Main: {
        path: '',
        screens: {
          HomeTab: 'home',
          SearchTab: 'search',
          BookingsTab: 'my-bookings',
          MessagesTab: 'inbox',
          ProfileTab: 'me',
        },
      },

      // Detail screens
      Listing: 'listings/:listingId',
      BookingDetail: 'bookings/:bookingId',
      BookingFlow: 'book/:listingId',
      Checkout: 'checkout/:bookingId',
      MessageThread: 'messages/:conversationId',
      ProfileView: 'profile/:userId',
      Reviews: 'reviews',
      Favorites: 'favorites',

      // Listing management (create route before parameterized route)
      CreateListing: 'listing/create',
      EditListing: 'listings/:listingId/edit',

      // Owner screens
      OwnerDashboard: 'owner/dashboard',
      OwnerListings: 'owner/listings',
      OwnerCalendar: 'owner/calendar',
      OwnerEarnings: 'owner/earnings',
      OwnerInsights: 'owner/insights',
      OwnerPerformance: 'owner/performance',
      BecomeOwner: 'become-owner',

      // Renter & common
      RenterDashboard: 'renter/dashboard',
      Dashboard: 'dashboard',
      Earnings: 'earnings',
      Payments: 'payments',

      // Disputes
      Disputes: 'disputes',
      DisputeCreate: 'disputes/new/:bookingId',
      DisputeDetail: 'disputes/:disputeId',

      // Organizations
      Organizations: 'organizations',
      OrganizationCreate: 'organizations/new',
      OrganizationSettings: 'organizations/:organizationId/settings',
      OrganizationMembers: 'organizations/:organizationId/members',

      // Insurance
      Insurance: 'insurance',
      InsuranceUpload: 'insurance/upload',

      // Settings
      Settings: 'settings',
      SettingsIndex: 'settings/index',
      SettingsProfile: 'settings/profile',
      SettingsNotifications: 'settings/notifications',

      // Static
      About: 'about',
      Careers: 'careers',
      Contact: 'contact',
      Press: 'press',
      HowItWorks: 'how-it-works',
      OwnerGuide: 'owner-guide',
      Help: 'help',
      Safety: 'safety',
      Terms: 'terms',
      Privacy: 'privacy',
      Cookies: 'cookies',
    },
  },
};
