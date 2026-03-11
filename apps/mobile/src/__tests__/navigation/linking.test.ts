jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `gharbatai://${path}`),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
}));

import { linkingConfig } from '../../navigation/linking';

describe('linkingConfig', () => {
  describe('prefixes', () => {
    it('includes custom scheme prefix', () => {
      expect(linkingConfig.prefixes).toContain('gharbatai:///');
    });

    it('includes https universal links', () => {
      expect(linkingConfig.prefixes).toContain('https://gharbatai.com');
      expect(linkingConfig.prefixes).toContain('https://www.gharbatai.com');
    });

    it('has exactly 3 prefixes', () => {
      expect(linkingConfig.prefixes).toHaveLength(3);
    });
  });

  describe('screen config', () => {
    const screens = linkingConfig.config?.screens as Record<string, any>;

    it('defines auth screens', () => {
      expect(screens.Login).toBe('login');
      expect(screens.Signup).toBe('signup');
      expect(screens.ForgotPassword).toBe('forgot-password');
      expect(screens.ResetPassword).toBe('reset-password');
    });

    it('defines Main tab navigator with nested screens', () => {
      expect(screens.Main).toBeDefined();
      expect(screens.Main.screens.HomeTab).toBe('home');
      expect(screens.Main.screens.SearchTab).toBe('search');
      expect(screens.Main.screens.BookingsTab).toBe('my-bookings');
      expect(screens.Main.screens.MessagesTab).toBe('inbox');
      expect(screens.Main.screens.ProfileTab).toBe('me');
    });

    it('defines detail screens with parameters', () => {
      expect(screens.Listing).toBe('listings/:listingId');
      expect(screens.BookingDetail).toBe('bookings/:bookingId');
      expect(screens.BookingFlow).toBe('book/:listingId');
      expect(screens.Checkout).toBe('checkout/:bookingId');
      expect(screens.MessageThread).toBe('messages/:conversationId');
      expect(screens.ProfileView).toBe('profile/:userId');
    });

    it('defines listing management screens', () => {
      expect(screens.CreateListing).toBe('listing/create');
      expect(screens.EditListing).toBe('listings/:listingId/edit');
    });

    it('defines owner screens', () => {
      expect(screens.OwnerDashboard).toBe('owner/dashboard');
      expect(screens.OwnerListings).toBe('owner/listings');
      expect(screens.OwnerCalendar).toBe('owner/calendar');
      expect(screens.OwnerEarnings).toBe('owner/earnings');
      expect(screens.OwnerInsights).toBe('owner/insights');
      expect(screens.OwnerPerformance).toBe('owner/performance');
      expect(screens.BecomeOwner).toBe('become-owner');
    });

    it('defines dispute screens', () => {
      expect(screens.Disputes).toBe('disputes');
      expect(screens.DisputeCreate).toBe('disputes/new/:bookingId');
      expect(screens.DisputeDetail).toBe('disputes/:disputeId');
    });

    it('defines organization screens', () => {
      expect(screens.Organizations).toBe('organizations');
      expect(screens.OrganizationCreate).toBe('organizations/new');
      expect(screens.OrganizationSettings).toBe('organizations/:organizationId/settings');
      expect(screens.OrganizationMembers).toBe('organizations/:organizationId/members');
    });

    it('defines insurance screens', () => {
      expect(screens.Insurance).toBe('insurance');
      expect(screens.InsuranceUpload).toBe('insurance/upload');
    });

    it('defines settings screens', () => {
      expect(screens.Settings).toBe('settings');
      expect(screens.SettingsProfile).toBe('settings/profile');
      expect(screens.SettingsNotifications).toBe('settings/notifications');
    });

    it('defines static pages', () => {
      const staticScreens = ['About', 'Careers', 'Contact', 'Press', 'HowItWorks', 'OwnerGuide', 'Help', 'Safety', 'Terms', 'Privacy', 'Cookies'];
      for (const screen of staticScreens) {
        expect(screens[screen]).toBeDefined();
      }
    });

    it('covers all expected screen count', () => {
      // Count all screens including nested Main screens
      const topLevelCount = Object.keys(screens).length;
      const mainCount = Object.keys(screens.Main.screens).length;
      // Total mapped screens = top-level (minus Main container) + Main children
      expect(topLevelCount - 1 + mainCount).toBeGreaterThanOrEqual(40);
    });
  });
});
