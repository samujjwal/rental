import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

// Mock useFocusEffect to behave like useEffect (no NavigationContainer needed)
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

/* ── mock functions ── */
const mockGetOrganizations = jest.fn();
const mockCreateOrganization = jest.fn();
const mockResetPassword = jest.fn();
const mockGetNotificationPreferences = jest.fn();
const mockUpdateNotificationPreferences = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();

let mockUser: any = { id: 'u1', email: 'ram@test.np', firstName: 'Ram', lastName: 'Sharma' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: jest.fn(),
    isLoading: false,
  }),
}));

jest.mock('../../api/authStore', () => ({
  authStore: {
    getToken: jest.fn(() => 'mock-token'),
  },
}));

jest.mock('../../api/client', () => ({
  mobileClient: {
    getOrganizations: (...args: any[]) => mockGetOrganizations(...args),
    createOrganization: (...args: any[]) => mockCreateOrganization(...args),
    resetPassword: (...args: any[]) => mockResetPassword(...args),
    getNotificationPreferences: (...args: any[]) => mockGetNotificationPreferences(...args),
    updateNotificationPreferences: (...args: any[]) => mockUpdateNotificationPreferences(...args),
  },
}));

jest.mock('../../config', () => ({
  API_BASE_URL: 'https://api.test',
  WEB_BASE_URL: 'https://web.test',
}));

import { OrganizationsScreen } from '../../screens/OrganizationsScreen';
import { OrganizationCreateScreen } from '../../screens/OrganizationCreateScreen';
import { ResetPasswordScreen } from '../../screens/ResetPasswordScreen';
import { SettingsNotificationsScreen } from '../../screens/SettingsNotificationsScreen';

const nav = (overrides: Record<string, any> = {}) =>
  ({ navigate: mockNavigate, replace: mockReplace, goBack: mockGoBack, ...overrides } as any);
const route = (params: Record<string, any> = {}) => ({ params } as any);

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'ram@test.np', firstName: 'Ram', lastName: 'Sharma' };
});

/* ═══════════════════ OrganizationsScreen ═══════════════════ */

describe('OrganizationsScreen', () => {
  it('shows sign-in prompt when unauthenticated', () => {
    mockUser = null;
    const { getByText } = render(<OrganizationsScreen navigation={nav()} route={route()} />);
    expect(getByText('Sign in to manage organizations.')).toBeTruthy();
  });

  it('navigates to Login on sign-in press', () => {
    mockUser = null;
    const { getByText } = render(<OrganizationsScreen navigation={nav()} route={route()} />);
    fireEvent.press(getByText('Sign In'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('renders organization list', async () => {
    mockGetOrganizations.mockResolvedValue({
      organizations: [
        { id: 'org-1', name: 'Sunrise Rentals', businessType: 'LLC', logoUrl: null },
        { id: 'org-2', name: 'Valley Corp', businessType: 'CORPORATION', logoUrl: 'https://logo.png' },
      ],
    });
    const { getByText } = render(<OrganizationsScreen navigation={nav()} route={route()} />);
    await waitFor(() => expect(getByText('Sunrise Rentals')).toBeTruthy(), { timeout: 10000 });
    expect(getByText('Valley Corp')).toBeTruthy();
  }, 10000);

  it('shows empty state when no orgs', async () => {
    mockGetOrganizations.mockResolvedValue({ organizations: [] });
    const { getByText } = render(<OrganizationsScreen navigation={nav()} route={route()} />);
    await waitFor(() => expect(getByText('No organizations yet.')).toBeTruthy());
  });

  it('navigates to OrganizationCreate on Create press', async () => {
    mockGetOrganizations.mockResolvedValue({ organizations: [] });
    const { getByText } = render(<OrganizationsScreen navigation={nav()} route={route()} />);
    fireEvent.press(getByText('Create'));
    expect(mockNavigate).toHaveBeenCalledWith('OrganizationCreate');
  });

  it('navigates to Settings on card action', async () => {
    mockGetOrganizations.mockResolvedValue({
      organizations: [{ id: 'org-1', name: 'Test Org', businessType: 'LLC' }],
    });
    const { getByText } = render(<OrganizationsScreen navigation={nav()} route={route()} />);
    await waitFor(() => expect(getByText('Settings')).toBeTruthy());
    fireEvent.press(getByText('Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('OrganizationSettings', { organizationId: 'org-1' });
  });

  it('navigates to Members on card action', async () => {
    mockGetOrganizations.mockResolvedValue({
      organizations: [{ id: 'org-1', name: 'Test Org', businessType: 'LLC' }],
    });
    const { getByText } = render(<OrganizationsScreen navigation={nav()} route={route()} />);
    await waitFor(() => expect(getByText('Members')).toBeTruthy());
    fireEvent.press(getByText('Members'));
    expect(mockNavigate).toHaveBeenCalledWith('OrganizationMembers', { organizationId: 'org-1' });
  });

  it('shows error status on API failure', async () => {
    mockGetOrganizations.mockRejectedValue(new Error('net'));
    const { getByText } = render(<OrganizationsScreen navigation={nav()} route={route()} />);
    await waitFor(() => expect(getByText('Unable to load organizations.')).toBeTruthy());
  });
});

/* ═══════════════════ OrganizationCreateScreen ═══════════════════ */

describe('OrganizationCreateScreen', () => {
  it('renders heading and input fields', () => {
    const { getByText, getByPlaceholderText } = render(
      <OrganizationCreateScreen navigation={nav()} route={route()} />,
    );
    expect(getByText('Create Organization')).toBeTruthy();
    expect(getByPlaceholderText('Organization name')).toBeTruthy();
    expect(getByPlaceholderText('Email')).toBeTruthy();
  });

  it('shows validation error when name or email empty', async () => {
    const { getByText } = render(
      <OrganizationCreateScreen navigation={nav()} route={route()} />,
    );
    fireEvent.press(getByText('Create'));
    await waitFor(() =>
      expect(getByText('Organization name and email are required.')).toBeTruthy(),
    );
  });

  it('creates organization on valid submission', async () => {
    mockCreateOrganization.mockResolvedValue({ id: 'org-new' });
    const { getByText, getByPlaceholderText } = render(
      <OrganizationCreateScreen navigation={nav()} route={route()} />,
    );
    fireEvent.changeText(getByPlaceholderText('Organization name'), 'My Org');
    fireEvent.changeText(getByPlaceholderText('Email'), 'org@test.np');
    fireEvent.press(getByText('Create'));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('OrganizationSettings', { organizationId: 'org-new' }),
    );
  });

  it('shows error on API failure', async () => {
    mockCreateOrganization.mockRejectedValue(new Error('fail'));
    const { getByText, getByPlaceholderText } = render(
      <OrganizationCreateScreen navigation={nav()} route={route()} />,
    );
    fireEvent.changeText(getByPlaceholderText('Organization name'), 'Org');
    fireEvent.changeText(getByPlaceholderText('Email'), 'e@e.np');
    fireEvent.press(getByText('Create'));
    await waitFor(() => expect(getByText('Unable to create organization.')).toBeTruthy());
  });

  it('renders business type chips', () => {
    const { getByText } = render(
      <OrganizationCreateScreen navigation={nav()} route={route()} />,
    );
    expect(getByText('Individual')).toBeTruthy();
    expect(getByText('LLC')).toBeTruthy();
    expect(getByText('Corporation')).toBeTruthy();
    expect(getByText('Partnership')).toBeTruthy();
  });
});

/* ═══════════════════ ResetPasswordScreen ═══════════════════ */

describe('ResetPasswordScreen', () => {
  it('renders heading and inputs', () => {
    const { getAllByText, getByPlaceholderText } = render(
      <ResetPasswordScreen navigation={nav()} route={route()} />,
    );
    // "Reset password" appears as both heading and button text
    expect(getAllByText('Reset password').length).toBeGreaterThanOrEqual(2);
    expect(getByPlaceholderText('Reset token')).toBeTruthy();
    expect(getByPlaceholderText('New password')).toBeTruthy();
    expect(getByPlaceholderText('Confirm password')).toBeTruthy();
  });

  it('shows error when token or password empty', async () => {
    const { getAllByText, getByText } = render(
      <ResetPasswordScreen navigation={nav()} route={route()} />,
    );
    // The button is the second "Reset password" element
    const buttons = getAllByText('Reset password');
    fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(getByText('Token and password are required.')).toBeTruthy());
  });

  it('shows error when passwords do not match', async () => {
    const { getAllByText, getByText, getByPlaceholderText } = render(
      <ResetPasswordScreen navigation={nav()} route={route()} />,
    );
    fireEvent.changeText(getByPlaceholderText('Reset token'), 'tok-123');
    fireEvent.changeText(getByPlaceholderText('New password'), 'pass1');
    fireEvent.changeText(getByPlaceholderText('Confirm password'), 'pass2');
    const buttons = getAllByText('Reset password');
    fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(getByText('Passwords do not match.')).toBeTruthy());
  });

  it('resets password on valid submission', async () => {
    mockResetPassword.mockResolvedValue({});
    const { getAllByText, getByPlaceholderText } = render(
      <ResetPasswordScreen navigation={nav()} route={route()} />,
    );
    fireEvent.changeText(getByPlaceholderText('Reset token'), 'tok-123');
    fireEvent.changeText(getByPlaceholderText('New password'), 'newpass');
    fireEvent.changeText(getByPlaceholderText('Confirm password'), 'newpass');
    const buttons = getAllByText('Reset password');
    fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Login'));
    expect(mockResetPassword).toHaveBeenCalledWith('tok-123', 'newpass');
  });

  it('shows error on API failure', async () => {
    mockResetPassword.mockRejectedValue(new Error('fail'));
    const { getAllByText, getByText, getByPlaceholderText } = render(
      <ResetPasswordScreen navigation={nav()} route={route()} />,
    );
    fireEvent.changeText(getByPlaceholderText('Reset token'), 'tok');
    fireEvent.changeText(getByPlaceholderText('New password'), 'p');
    fireEvent.changeText(getByPlaceholderText('Confirm password'), 'p');
    const buttons = getAllByText('Reset password');
    fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(getByText('Unable to reset password. Please try again.')).toBeTruthy(),
    );
  });
});

/* ═══════════════════ SettingsNotificationsScreen ═══════════════════ */

describe('SettingsNotificationsScreen', () => {
  it('renders heading and channel labels', async () => {
    mockGetNotificationPreferences.mockResolvedValue({
      email: true,
      sms: false,
      push: true,
      inApp: true,
      bookingUpdates: true,
      paymentUpdates: true,
      reviewAlerts: true,
      messageAlerts: true,
      marketingEmails: false,
    });
    const { getByText } = render(<SettingsNotificationsScreen />);
    expect(getByText('Notification Preferences')).toBeTruthy();
    await waitFor(() => expect(getByText('Email')).toBeTruthy());
    expect(getByText('Push')).toBeTruthy();
    expect(getByText('SMS')).toBeTruthy();
  });

  it('renders activity type labels', async () => {
    mockGetNotificationPreferences.mockResolvedValue({
      email: true, sms: false, push: true, inApp: true,
      bookingUpdates: true, paymentUpdates: true, reviewAlerts: true,
      messageAlerts: true, marketingEmails: false,
    });
    const { getByText } = render(<SettingsNotificationsScreen />);
    await waitFor(() => expect(getByText('Booking updates')).toBeTruthy());
    expect(getByText('Payment updates')).toBeTruthy();
    expect(getByText('Messages')).toBeTruthy();
    expect(getByText('Marketing')).toBeTruthy();
  });

  it('saves preferences on Save press', async () => {
    mockGetNotificationPreferences.mockResolvedValue({
      email: true, sms: false, push: true, inApp: true,
      bookingUpdates: true, paymentUpdates: true, reviewAlerts: true,
      messageAlerts: true, marketingEmails: false,
    });
    mockUpdateNotificationPreferences.mockResolvedValue({});
    const { getByText } = render(<SettingsNotificationsScreen />);
    await waitFor(() => expect(getByText('Save')).toBeTruthy());
    fireEvent.press(getByText('Save'));
    await waitFor(() => expect(getByText('Saved.')).toBeTruthy());
    expect(mockUpdateNotificationPreferences).toHaveBeenCalled();
  });

  it('shows error on save failure', async () => {
    mockGetNotificationPreferences.mockResolvedValue({
      email: true, sms: false, push: true, inApp: true,
      bookingUpdates: true, paymentUpdates: true, reviewAlerts: true,
      messageAlerts: true, marketingEmails: false,
    });
    mockUpdateNotificationPreferences.mockRejectedValue(new Error('net'));
    const { getByText } = render(<SettingsNotificationsScreen />);
    await waitFor(() => expect(getByText('Save')).toBeTruthy());
    fireEvent.press(getByText('Save'));
    await waitFor(() => expect(getByText('Unable to save preferences.')).toBeTruthy());
  });

  it('falls back to defaults on load error', async () => {
    mockGetNotificationPreferences.mockRejectedValue(new Error('err'));
    const { getByText } = render(<SettingsNotificationsScreen />);
    // Should still render with defaults
    await waitFor(() => expect(getByText('Save')).toBeTruthy());
  });
});
