import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Linking } from 'react-native';

/* ── mock functions ── */
const mockGetOrganizationMembers = jest.fn();
const mockInviteOrganizationMember = jest.fn();
const mockUpdateOrganizationMemberRole = jest.fn();
const mockRemoveOrganizationMember = jest.fn();
const mockGetOrganization = jest.fn();
const mockUpdateOrganization = jest.fn();
const mockDeactivateOrganization = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

let mockUser: any = { id: 'u1', email: 'ram@test.np', firstName: 'Ram' };

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
    getOrganizationMembers: (...a: any[]) => mockGetOrganizationMembers(...a),
    inviteOrganizationMember: (...a: any[]) => mockInviteOrganizationMember(...a),
    updateOrganizationMemberRole: (...a: any[]) => mockUpdateOrganizationMemberRole(...a),
    removeOrganizationMember: (...a: any[]) => mockRemoveOrganizationMember(...a),
    getOrganization: (...a: any[]) => mockGetOrganization(...a),
    updateOrganization: (...a: any[]) => mockUpdateOrganization(...a),
    deactivateOrganization: (...a: any[]) => mockDeactivateOrganization(...a),
  },
}));

jest.mock('../../config', () => ({
  API_BASE_URL: 'https://api.test',
  WEB_BASE_URL: 'https://web.test',
}));

import { OrganizationMembersScreen } from '../../screens/OrganizationMembersScreen';
import { OrganizationSettingsScreen } from '../../screens/OrganizationSettingsScreen';
import { InsuranceUploadScreen } from '../../screens/InsuranceUploadScreen';
import { ContactScreen } from '../../screens/ContactScreen';
import { SettingsIndexScreen } from '../../screens/SettingsIndexScreen';
import { TermsScreen } from '../../screens/TermsScreen';
import { SafetyScreen } from '../../screens/SafetyScreen';
import { PrivacyScreen } from '../../screens/PrivacyScreen';
import { PressScreen } from '../../screens/PressScreen';
import { InsuranceScreen } from '../../screens/InsuranceScreen';
import { HowItWorksScreen } from '../../screens/HowItWorksScreen';
import { HelpScreen } from '../../screens/HelpScreen';
import { CookiesScreen } from '../../screens/CookiesScreen';
import { CareersScreen } from '../../screens/CareersScreen';
import { AboutScreen } from '../../screens/AboutScreen';
import { EarningsScreen } from '../../screens/EarningsScreen';

const nav = (overrides: Record<string, any> = {}) =>
  ({ navigate: mockNavigate, replace: jest.fn(), goBack: mockGoBack, ...overrides }) as any;

const route = (params: Record<string, any> = {}) => ({ params }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'ram@test.np', firstName: 'Ram' };
});

/* ────────────────────────────────────────────────
 * OrganizationMembersScreen
 * ──────────────────────────────────────────────── */
describe('OrganizationMembersScreen', () => {
  const members = [
    { id: 'm1', userId: 'u1', role: 'OWNER', user: { firstName: 'Ram', lastName: 'Sharma', email: 'ram@test.np' } },
    { id: 'm2', userId: 'u2', role: 'MEMBER', user: { firstName: 'Sita', lastName: '', email: 'sita@test.np' } },
  ];

  const rp = () => route({ organizationId: 'org1' });

  it('renders heading and invite section', async () => {
    mockGetOrganizationMembers.mockResolvedValue({ members });
    const { getByText, getByPlaceholderText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    expect(getByText('Team Members')).toBeTruthy();
    expect(getByPlaceholderText('Invite email')).toBeTruthy();
    expect(getByText('Invite')).toBeTruthy();
  });

  it('loads and displays members', async () => {
    mockGetOrganizationMembers.mockResolvedValue({ members });
    const { getByText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByText('Ram Sharma')).toBeTruthy());
    expect(getByText('sita@test.np')).toBeTruthy();
  });

  it('shows error when load fails', async () => {
    mockGetOrganizationMembers.mockRejectedValue(new Error('fail'));
    const { getByText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByText('Unable to load members.')).toBeTruthy());
  });

  it('invites member with email and role', async () => {
    mockGetOrganizationMembers.mockResolvedValue({ members: [] });
    mockInviteOrganizationMember.mockResolvedValue({});
    const { getByPlaceholderText, getByText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Invite email'), 'new@test.np');
    });
    await act(async () => {
      fireEvent.press(getByText('Invite'));
    });
    await waitFor(() =>
      expect(mockInviteOrganizationMember).toHaveBeenCalledWith('org1', {
        email: 'new@test.np',
        role: 'MEMBER',
      })
    );
  });

  it('shows error when invite email is empty', async () => {
    mockGetOrganizationMembers.mockResolvedValue({ members: [] });
    const { getByText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    await act(async () => {
      fireEvent.press(getByText('Invite'));
    });
    expect(getByText('Enter an email to invite.')).toBeTruthy();
  });

  it('shows error when invite fails', async () => {
    mockGetOrganizationMembers.mockResolvedValue({ members: [] });
    mockInviteOrganizationMember.mockRejectedValue(new Error('fail'));
    const { getByPlaceholderText, getByText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Invite email'), 'new@test.np');
    });
    await act(async () => {
      fireEvent.press(getByText('Invite'));
    });
    await waitFor(() => expect(getByText('Unable to invite member.')).toBeTruthy());
  });

  it('changes member role', async () => {
    mockGetOrganizationMembers.mockResolvedValue({ members });
    mockUpdateOrganizationMemberRole.mockResolvedValue({});
    const { getAllByText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(mockGetOrganizationMembers).toHaveBeenCalled());
    // member list has ADMIN/MEMBER chips per member row; press the first ADMIN chip in member list
    const adminChips = getAllByText('ADMIN');
    await act(async () => {
      fireEvent.press(adminChips[adminChips.length - 1]);
    });
    await waitFor(() =>
      expect(mockUpdateOrganizationMemberRole).toHaveBeenCalled()
    );
  });

  it('removes a non-owner member', async () => {
    mockGetOrganizationMembers.mockResolvedValue({ members });
    mockRemoveOrganizationMember.mockResolvedValue({});
    const { getByText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByText('Remove')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Remove'));
    });
    expect(mockRemoveOrganizationMember).toHaveBeenCalledWith('org1', 'u2');
  });

  it('shows error when remove fails', async () => {
    mockGetOrganizationMembers.mockResolvedValue({ members });
    mockRemoveOrganizationMember.mockRejectedValue(new Error('fail'));
    const { getByText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByText('Remove')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Remove'));
    });
    await waitFor(() => expect(getByText('Unable to remove member.')).toBeTruthy());
  });

  it('shows empty state when no members', async () => {
    mockGetOrganizationMembers.mockResolvedValue({ members: [] });
    const { getByText } = render(
      <OrganizationMembersScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByText('No members yet.')).toBeTruthy());
  });
});

/* ────────────────────────────────────────────────
 * OrganizationSettingsScreen
 * ──────────────────────────────────────────────── */
describe('OrganizationSettingsScreen', () => {
  const org = {
    id: 'org1',
    name: 'Test Org',
    description: 'A rental org',
    website: 'https://test.np',
    email: 'org@test.np',
    phone: '9812345678',
    settings: { autoApproveMembers: true, requireInsurance: false, allowPublicProfile: true },
  };

  const rp = () => route({ organizationId: 'org1' });

  it('renders heading', () => {
    mockGetOrganization.mockResolvedValue(org);
    const { getByText } = render(
      <OrganizationSettingsScreen navigation={nav()} route={rp()} />
    );
    expect(getByText('Organization Settings')).toBeTruthy();
  });

  it('loads and populates org data', async () => {
    mockGetOrganization.mockResolvedValue(org);
    const { getByDisplayValue } = render(
      <OrganizationSettingsScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByDisplayValue('Test Org')).toBeTruthy());
    expect(getByDisplayValue('A rental org')).toBeTruthy();
    expect(getByDisplayValue('https://test.np')).toBeTruthy();
  });

  it('shows error when load fails', async () => {
    mockGetOrganization.mockRejectedValue(new Error('fail'));
    const { getByText } = render(
      <OrganizationSettingsScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByText('Unable to load organization.')).toBeTruthy());
  });

  it('saves updated settings', async () => {
    mockGetOrganization.mockResolvedValue(org);
    mockUpdateOrganization.mockResolvedValue({});
    const { getByText, getByDisplayValue } = render(
      <OrganizationSettingsScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByDisplayValue('Test Org')).toBeTruthy());
    fireEvent.changeText(getByDisplayValue('Test Org'), 'New Org Name');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    await waitFor(() =>
      expect(mockUpdateOrganization).toHaveBeenCalledWith(
        'org1',
        expect.objectContaining({ name: 'New Org Name' })
      )
    );
  });

  it('shows error when save fails', async () => {
    mockGetOrganization.mockResolvedValue(org);
    mockUpdateOrganization.mockRejectedValue(new Error('fail'));
    const { getByText, getByDisplayValue } = render(
      <OrganizationSettingsScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByDisplayValue('Test Org')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    await waitFor(() => expect(getByText('Unable to save changes.')).toBeTruthy());
  });

  it('deactivates and navigates to Organizations', async () => {
    mockGetOrganization.mockResolvedValue(org);
    mockDeactivateOrganization.mockResolvedValue({});
    const { getByText, getByDisplayValue } = render(
      <OrganizationSettingsScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByDisplayValue('Test Org')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Deactivate'));
    });
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('Organizations')
    );
  });

  it('shows error when deactivate fails', async () => {
    mockGetOrganization.mockResolvedValue(org);
    mockDeactivateOrganization.mockRejectedValue(new Error('fail'));
    const { getByText, getByDisplayValue } = render(
      <OrganizationSettingsScreen navigation={nav()} route={rp()} />
    );
    await waitFor(() => expect(getByDisplayValue('Test Org')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Deactivate'));
    });
    await waitFor(() => expect(getByText('Unable to deactivate organization.')).toBeTruthy());
  });
});

/* ────────────────────────────────────────────────
 * InsuranceUploadScreen
 * ──────────────────────────────────────────────── */
describe('InsuranceUploadScreen', () => {
  it('renders title', () => {
    const { getByText } = render(<InsuranceUploadScreen navigation={nav()} route={route()} />);
    expect(getByText('Upload Insurance Policy')).toBeTruthy();
  });

  it('shows sign-in notice when no user', () => {
    mockUser = null;
    const { getByText } = render(<InsuranceUploadScreen navigation={nav()} route={route()} />);
    expect(getByText('Sign in to submit insurance details.')).toBeTruthy();
  });

  it('shows listing ID input when authenticated', () => {
    const { getByPlaceholderText } = render(<InsuranceUploadScreen navigation={nav()} route={route()} />);
    expect(getByPlaceholderText('Listing ID')).toBeTruthy();
  });

  it('shows error when no listing ID on submit', async () => {
    const { getByText } = render(<InsuranceUploadScreen navigation={nav()} route={route()} />);
    await act(async () => {
      fireEvent.press(getByText('Open secure upload'));
    });
    expect(getByText('Listing ID is required.')).toBeTruthy();
  });

  it('opens Linking URL with listing ID', async () => {
    // Mock fetch so the useEffect completes when listingId changes
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ required: false }),
    } as any);
    const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);
    const { getByPlaceholderText, getByText } = render(
      <InsuranceUploadScreen navigation={nav()} route={route()} />
    );
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Listing ID'), 'lst123');
    });
    // Wait for the effect to finish (loading becomes false)
    await waitFor(() => expect(getByText('Open secure upload')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Open secure upload'));
    });
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('listingId=lst123')
      )
    );
    fetchSpy.mockRestore();
    canOpenSpy.mockRestore();
    openSpy.mockRestore();
  });

  it('shows error when Linking cannot open URL', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ required: false }),
    } as any);
    const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const { getByPlaceholderText, getByText } = render(
      <InsuranceUploadScreen navigation={nav()} route={route()} />
    );
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Listing ID'), 'lst123');
    });
    await waitFor(() => expect(getByText('Open secure upload')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Open secure upload'));
    });
    await waitFor(() => expect(getByText('Unable to open secure upload.')).toBeTruthy());
    fetchSpy.mockRestore();
    canOpenSpy.mockRestore();
  });
});

/* ────────────────────────────────────────────────
 * Simple screens: Contact, SettingsIndex, static info
 * ──────────────────────────────────────────────── */
describe('ContactScreen', () => {
  it('renders title and CTA', () => {
    const { getByText } = render(<ContactScreen navigation={nav()} route={route()} />);
    expect(getByText('Contact Us')).toBeTruthy();
    fireEvent.press(getByText('Browse listings'));
    expect(mockNavigate).toHaveBeenCalledWith('Main');
  });
});

describe('SettingsIndexScreen', () => {
  it('renders navigation buttons', () => {
    const { getByText } = render(<SettingsIndexScreen navigation={nav()} route={route()} />);
    expect(getByText('Settings')).toBeTruthy();
    fireEvent.press(getByText('Profile Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('SettingsProfile');
    fireEvent.press(getByText('Notifications'));
    expect(mockNavigate).toHaveBeenCalledWith('SettingsNotifications');
    fireEvent.press(getByText('Preferences'));
    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });
});

describe('Static info screens', () => {
  const cases: [string, React.ComponentType<any>, string, string, string, Record<string, string>?][] = [
    ['TermsScreen', TermsScreen, 'Terms of Service', 'Privacy policy', 'Privacy', undefined],
    ['SafetyScreen', SafetyScreen, 'Safety', 'Get support', 'Help', undefined],
    ['PrivacyScreen', PrivacyScreen, 'Privacy Policy', 'Cookies policy', 'Cookies', undefined],
    ['PressScreen', PressScreen, 'Press', 'Contact press', 'Contact', undefined],
    ['InsuranceScreen', InsuranceScreen, 'Insurance', 'Upload documents', 'InsuranceUpload', undefined],
    ['HowItWorksScreen', HowItWorksScreen, 'How It Works', 'Start searching', 'Main', undefined],
    ['HelpScreen', HelpScreen, 'Help Center', 'Contact support', 'Contact', undefined],
    ['CookiesScreen', CookiesScreen, 'Cookies Policy', 'Privacy policy', 'Privacy', undefined],
    ['CareersScreen', CareersScreen, 'Careers', 'Contact us', 'Contact', undefined],
    ['AboutScreen', AboutScreen, 'About GharBatai', 'Browse listings', 'Main', { screen: 'SearchTab' }],
    ['EarningsScreen', EarningsScreen, 'Earnings', 'Go to dashboard', 'OwnerDashboard', undefined],
  ];

  it.each(cases)(
    '%s renders title and CTA navigates to %s',
    (name, Component, title, ctaText, target, nestedTarget) => {
      mockNavigate.mockClear();
      const { getByText } = render(<Component navigation={nav()} route={route()} />);
      expect(getByText(title)).toBeTruthy();
      fireEvent.press(getByText(ctaText));
      if (nestedTarget) {
        expect(mockNavigate).toHaveBeenCalledWith(target, nestedTarget);
      } else {
        expect(mockNavigate).toHaveBeenCalledWith(target);
      }
    }
  );
});
