import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

/* ── mocks ── */

// Mock useFocusEffect to behave like useEffect (no NavigationContainer needed)
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

const mockGetUserById = jest.fn();
const mockGetUserListings = jest.fn();
const mockGetUserReviews = jest.fn();
const mockGetProfile = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUpgradeToOwner = jest.fn();

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

let mockUser: any = { id: 'u1', email: 'test@x.np', firstName: 'Ram', lastName: 'Sharma', role: 'renter' };
const mockSetUser = jest.fn();

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    setUser: mockSetUser,
    isLoading: false,
  }),
}));

jest.mock('../../api/client', () => ({
  mobileClient: {
    getUserById: (...a: any[]) => mockGetUserById(...a),
    getUserListings: (...a: any[]) => mockGetUserListings(...a),
    getUserReviews: (...a: any[]) => mockGetUserReviews(...a),
    getProfile: (...a: any[]) => mockGetProfile(...a),
    updateProfile: (...a: any[]) => mockUpdateProfile(...a),
    upgradeToOwner: (...a: any[]) => mockUpgradeToOwner(...a),
  },
}));

import { ProfileViewScreen } from '../../screens/ProfileViewScreen';
import { SettingsProfileScreen } from '../../screens/SettingsProfileScreen';
import { BecomeOwnerScreen } from '../../screens/BecomeOwnerScreen';

const nav = { navigate: mockNavigate, goBack: mockGoBack, setOptions: mockSetOptions } as any;
const route = (params: any = {}) => ({ params }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@x.np', firstName: 'Ram', lastName: 'Sharma', role: 'renter' };
});

/* ═══════════════════════ ProfileViewScreen ═══════════════════════ */

describe('ProfileViewScreen', () => {
  const profileRoute = () => route({ userId: 'u2' });

  it('loads user profile on mount', async () => {
    mockGetUserById.mockResolvedValue({ id: 'u2', firstName: 'Sita', lastName: 'KC' });
    mockGetUserListings.mockResolvedValue({ listings: [] });
    mockGetUserReviews.mockResolvedValue({ reviews: [] });

    render(<ProfileViewScreen navigation={nav} route={profileRoute()} />);

    await waitFor(() => {
      expect(mockGetUserById).toHaveBeenCalledWith('u2');
      expect(screen.getByText(/Sita/)).toBeTruthy();
    }, { timeout: 15000 });
  }, 15000);

  it('shows error when profile fails to load', async () => {
    mockGetUserById.mockRejectedValue(new Error('fail'));

    render(<ProfileViewScreen navigation={nav} route={profileRoute()} />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load/i)).toBeTruthy();
    });
  });

  it('displays fallback name when user has no name', async () => {
    mockGetUserById.mockResolvedValue({ id: 'u2' });
    mockGetUserListings.mockResolvedValue({ listings: [] });
    mockGetUserReviews.mockResolvedValue({ reviews: [] });

    render(<ProfileViewScreen navigation={nav} route={profileRoute()} />);

    await waitFor(() => {
      expect(screen.getByText(/User/)).toBeTruthy();
    });
  });

  it('fetches listings and reviews', async () => {
    mockGetUserById.mockResolvedValue({ id: 'u2', firstName: 'Sita' });
    mockGetUserListings.mockResolvedValue({ listings: [{ id: 'l1', title: 'Camera' }] });
    mockGetUserReviews.mockResolvedValue({ reviews: [] });

    render(<ProfileViewScreen navigation={nav} route={profileRoute()} />);

    await waitFor(() => {
      expect(mockGetUserListings).toHaveBeenCalledWith('u2');
      expect(mockGetUserReviews).toHaveBeenCalledWith('u2', 'received');
    });
  });
});

/* ═══════════════════════ SettingsProfileScreen ═══════════════════════ */

describe('SettingsProfileScreen', () => {
  it('loads profile data into form', async () => {
    mockGetProfile.mockResolvedValue({
      firstName: 'Ram',
      lastName: 'Sharma',
      phoneNumber: '+977981234',
      city: 'Kathmandu',
      state: 'Bagmati',
      country: 'Nepal',
    });

    render(<SettingsProfileScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ram')).toBeTruthy();
      expect(screen.getByDisplayValue('Kathmandu')).toBeTruthy();
    });
  });

  it('shows error when profile fails to load', async () => {
    mockGetProfile.mockRejectedValue(new Error('fail'));

    render(<SettingsProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load/i)).toBeTruthy();
    });
  });

  it('saves profile successfully', async () => {
    mockGetProfile.mockResolvedValue({
      firstName: 'Ram',
      lastName: '',
      phoneNumber: '',
      city: '',
      state: '',
      country: '',
    });
    mockUpdateProfile.mockResolvedValue({});

    render(<SettingsProfileScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Ram')).toBeTruthy());

    fireEvent.changeText(screen.getByDisplayValue('Ram'), 'Hari');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Hari' }),
      );
      expect(screen.getByText('Saved.')).toBeTruthy();
    });
  });

  it('shows error when save fails', async () => {
    mockGetProfile.mockResolvedValue({ firstName: 'Ram' });
    mockUpdateProfile.mockRejectedValue(new Error('fail'));

    render(<SettingsProfileScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Ram')).toBeTruthy());

    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText(/unable to save/i)).toBeTruthy();
    });
  });
});

/* ═══════════════════════ BecomeOwnerScreen ═══════════════════════ */

describe('BecomeOwnerScreen', () => {
  it('shows already-owner message when user is owner', () => {
    mockUser = { ...mockUser, role: 'owner' };
    render(<BecomeOwnerScreen />);
    expect(screen.getByText(/already an owner/i)).toBeTruthy();
  });

  it('shows already-owner message for admin users', () => {
    mockUser = { ...mockUser, role: 'admin' };
    render(<BecomeOwnerScreen />);
    expect(screen.getByText(/already an owner/i)).toBeTruthy();
  });

  it('renders upgrade form for renters', () => {
    render(<BecomeOwnerScreen />);
    expect(screen.getByText('Become an Owner')).toBeTruthy();
    expect(screen.getByText(/agree to the owner terms/i)).toBeTruthy();
    expect(screen.getByText('Become an owner')).toBeTruthy();
  });

  it('shows terms validation error when checkbox not checked', () => {
    render(<BecomeOwnerScreen />);

    fireEvent.press(screen.getByText('Become an owner'));

    expect(screen.getByText(/accept the terms/i)).toBeTruthy();
  });

  it('upgrades successfully and updates auth context', async () => {
    const updatedUser = { ...mockUser, role: 'owner' };
    mockUpgradeToOwner.mockResolvedValue(updatedUser);

    render(<BecomeOwnerScreen />);

    // Toggle checkbox
    fireEvent.press(screen.getByText(/agree to the owner terms/i));
    // Submit
    fireEvent.press(screen.getByText('Become an owner'));

    await waitFor(() => {
      expect(mockUpgradeToOwner).toHaveBeenCalled();
      expect(mockSetUser).toHaveBeenCalledWith(updatedUser);
      expect(screen.getByText(/now an owner/i)).toBeTruthy();
    });
  });

  it('shows error when upgrade fails', async () => {
    mockUpgradeToOwner.mockRejectedValue(new Error('fail'));

    render(<BecomeOwnerScreen />);

    fireEvent.press(screen.getByText(/agree to the owner terms/i));
    fireEvent.press(screen.getByText('Become an owner'));

    await waitFor(() => {
      expect(screen.getByText(/unable to upgrade/i)).toBeTruthy();
    });
  });
});
