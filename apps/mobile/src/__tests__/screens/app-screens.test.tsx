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

const mockGetMyBookings = jest.fn();
const mockGetHostBookings = jest.fn();
const mockGetBooking = jest.fn();
const mockApproveBooking = jest.fn();
const mockCancelBooking = jest.fn();
const mockRejectBooking = jest.fn();
const mockStartBooking = jest.fn();
const mockRequestReturn = jest.fn();
const mockApproveReturn = jest.fn();
const mockGetFavorites = jest.fn();
const mockRemoveFavorite = jest.fn();
const mockGetConversations = jest.fn();
const mockGetProfile = jest.fn();
const mockSignOut = jest.fn();

const mockNavigate = jest.fn();
const mockReplace = jest.fn();

let mockUser: any = { id: 'u1', email: 'test@x.np', firstName: 'Ram', lastName: 'Sharma' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
    isLoading: false,
  }),
}));

jest.mock('../../api/client', () => ({
  mobileClient: {
    getMyBookings: (...a: any[]) => mockGetMyBookings(...a),
    getHostBookings: (...a: any[]) => mockGetHostBookings(...a),
    getBooking: (...a: any[]) => mockGetBooking(...a),
    approveBooking: (...a: any[]) => mockApproveBooking(...a),
    cancelBooking: (...a: any[]) => mockCancelBooking(...a),
    rejectBooking: (...a: any[]) => mockRejectBooking(...a),
    startBooking: (...a: any[]) => mockStartBooking(...a),
    requestReturn: (...a: any[]) => mockRequestReturn(...a),
    approveReturn: (...a: any[]) => mockApproveReturn(...a),
    getFavorites: (...a: any[]) => mockGetFavorites(...a),
    removeFavorite: (...a: any[]) => mockRemoveFavorite(...a),
    getConversations: (...a: any[]) => mockGetConversations(...a),
    getProfile: (...a: any[]) => mockGetProfile(...a),
  },
}));

const nav = { navigate: mockNavigate, replace: mockReplace, goBack: jest.fn(), setOptions: jest.fn() } as any;
const route = (params: any = {}) => ({ params }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@x.np', firstName: 'Ram', lastName: 'Sharma' };
});

/* ═══════════════════════════ BookingsScreen ═══════════════════════════ */

import { BookingsScreen } from '../../screens/BookingsScreen';

describe('BookingsScreen', () => {
  it('shows sign-in prompt when not logged in', () => {
    mockUser = null;
    render(<BookingsScreen navigation={nav} route={route()} />);
    expect(screen.getByText('Sign in to view your bookings.')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('renders view toggle buttons', async () => {
    mockGetMyBookings.mockResolvedValueOnce([]);
    render(<BookingsScreen navigation={nav} route={route()} />);
    expect(screen.getByText('My Rentals')).toBeTruthy();
    expect(screen.getByText('My Listings')).toBeTruthy();
    await waitFor(() => expect(mockGetMyBookings).toHaveBeenCalled(), { timeout: 10000 });
  }, 10000);

  it('fetches renter bookings by default', async () => {
    mockGetMyBookings.mockResolvedValueOnce([
      { id: 'b1', listing: { title: 'Bike' }, status: 'CONFIRMED', startDate: '2025-01-01', endDate: '2025-01-05' },
    ]);
    render(<BookingsScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(mockGetMyBookings).toHaveBeenCalled();
      expect(screen.getByText('Bike')).toBeTruthy();
      expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);
    });
  });

  it('switches to owner bookings view', async () => {
    mockGetMyBookings.mockResolvedValueOnce([]);
    mockGetHostBookings.mockResolvedValueOnce([]);
    render(<BookingsScreen navigation={nav} route={route()} />);
    await waitFor(() => expect(mockGetMyBookings).toHaveBeenCalled());

    fireEvent.press(screen.getByText('My Listings'));
    await waitFor(() => expect(mockGetHostBookings).toHaveBeenCalled());
  });

  it('shows empty state', async () => {
    mockGetMyBookings.mockResolvedValueOnce([]);
    render(<BookingsScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(screen.getByText('No bookings yet')).toBeTruthy();
    });
    expect(screen.getByText('Browse Listings')).toBeTruthy();
  });

  it('navigates to booking detail on press', async () => {
    mockGetMyBookings.mockResolvedValueOnce([
      { id: 'b1', listing: { title: 'Bike' }, status: 'CONFIRMED', startDate: '2025-01-01', endDate: '2025-01-05' },
    ]);
    render(<BookingsScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(screen.getByText('Bike')).toBeTruthy());
    fireEvent.press(screen.getByText('Bike'));
    expect(mockNavigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b1' });
  });
});

/* ═══════════════════════ BookingDetailScreen ═══════════════════════ */

import { BookingDetailScreen } from '../../screens/BookingDetailScreen';

describe('BookingDetailScreen', () => {
  const confirmedBooking = {
    id: 'b1',
    listing: { id: 'l1', title: 'Mountain Bike', images: ['http://img.png'] },
    status: 'CONFIRMED',
    startDate: '2025-07-01',
    endDate: '2025-07-05',
    totalAmount: 5000,
    ownerId: 'owner1',
    renterId: 'u1',
  };

  it('shows sign-in message when not logged in', () => {
    mockUser = null;
    render(<BookingDetailScreen navigation={nav} route={route({ bookingId: 'b1' })} />);
    expect(screen.getByText('Sign in to view booking details.')).toBeTruthy();
  });

  it('shows not-found when booking is null', async () => {
    mockGetBooking.mockRejectedValueOnce(new Error('not found'));
    render(<BookingDetailScreen navigation={nav} route={route({ bookingId: 'b1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Booking not found.')).toBeTruthy();
    });
  });

  it('renders booking details', async () => {
    mockGetBooking.mockResolvedValueOnce(confirmedBooking);
    render(<BookingDetailScreen navigation={nav} route={route({ bookingId: 'b1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Mountain Bike')).toBeTruthy();
      expect(screen.getByText('CONFIRMED')).toBeTruthy();
      // Date formatting is timezone-dependent; just verify date text exists
      expect(screen.getByText(/2025/)).toBeTruthy();
      expect(screen.getByText(/Rs\.\s*5,?000/)).toBeTruthy();
    });
  });

  it('shows cancel button for confirmed booking', async () => {
    mockGetBooking.mockResolvedValueOnce(confirmedBooking);
    render(<BookingDetailScreen navigation={nav} route={route({ bookingId: 'b1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Booking')).toBeTruthy();
    });
  });

  it('shows approve and decline for owner with pending approval', async () => {
    mockGetBooking.mockResolvedValueOnce({
      ...confirmedBooking,
      status: 'PENDING_OWNER_APPROVAL',
      ownerId: 'u1', // current user is owner
    });
    render(<BookingDetailScreen navigation={nav} route={route({ bookingId: 'b1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Approve Booking')).toBeTruthy();
      expect(screen.getByText('Decline Booking')).toBeTruthy();
    });
  });

  it('shows request-return for renter with active booking', async () => {
    mockGetBooking.mockResolvedValueOnce({
      ...confirmedBooking,
      status: 'IN_PROGRESS',
      renterId: 'u1',
    });
    render(<BookingDetailScreen navigation={nav} route={route({ bookingId: 'b1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Request Return')).toBeTruthy();
    });
  });

  it('navigates to listing on "View Listing" press', async () => {
    mockGetBooking.mockResolvedValueOnce(confirmedBooking);
    render(<BookingDetailScreen navigation={nav} route={route({ bookingId: 'b1' })} />);

    await waitFor(() => expect(screen.getByText('View Listing')).toBeTruthy());
    fireEvent.press(screen.getByText('View Listing'));
    expect(mockNavigate).toHaveBeenCalledWith('Listing', { listingId: 'l1' });
  });
});

/* ═══════════════════════════ FavoritesScreen ═══════════════════════════ */

import { FavoritesScreen } from '../../screens/FavoritesScreen';

describe('FavoritesScreen', () => {
  const favListing = {
    id: 'l1',
    title: 'Camera Lens',
    location: { city: 'Kathmandu', state: 'Bagmati' },
    basePrice: 1500,
    currency: 'NPR',
    images: ['http://img.png'],
  };

  it('shows sign-in prompt when not logged in', () => {
    mockUser = null;
    render(<FavoritesScreen navigation={nav} route={route()} />);
    expect(screen.getByText('Sign in to view favorites.')).toBeTruthy();
  });

  it('renders favorites list', async () => {
    mockGetFavorites.mockResolvedValueOnce([favListing]);
    render(<FavoritesScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(screen.getByText('Camera Lens')).toBeTruthy();
      expect(screen.getByText(/Kathmandu/)).toBeTruthy();
      expect(screen.getByText(/1,?500/)).toBeTruthy();
    });
  });

  it('filters favorites by search query', async () => {
    mockGetFavorites.mockResolvedValueOnce([
      favListing,
      { id: 'l2', title: 'Tent', location: {}, basePrice: 500 },
    ]);
    render(<FavoritesScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(screen.getByText('Camera Lens')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search favorites...'), 'tent');

    await waitFor(() => {
      expect(screen.getByText('Tent')).toBeTruthy();
      expect(screen.queryByText('Camera Lens')).toBeNull();
    });
  });

  it('removes a favorite', async () => {
    mockGetFavorites.mockResolvedValueOnce([favListing]);
    mockRemoveFavorite.mockResolvedValueOnce({});
    render(<FavoritesScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(screen.getByText('Camera Lens')).toBeTruthy());
    fireEvent.press(screen.getByText('Remove'));

    // Wait for the removal to be called and UI to update
    await waitFor(() => {
      expect(mockRemoveFavorite).toHaveBeenCalledWith('l1');
    }, { timeout: 3000 });

    // Wait a bit more for the state to update and re-render
    await waitFor(() => {
      expect(screen.queryByText('Camera Lens')).toBeNull();
    }, { timeout: 3000 });
  });

  it('shows empty state', async () => {
    mockGetFavorites.mockResolvedValueOnce([]);
    render(<FavoritesScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(screen.getByText('No favorites yet.')).toBeTruthy();
    });
  });
});

/* ═══════════════════════════ MessagesScreen ═══════════════════════════ */

import { MessagesScreen } from '../../screens/MessagesScreen';

describe('MessagesScreen', () => {
  it('shows sign-in prompt when not logged in', () => {
    mockUser = null;
    render(<MessagesScreen navigation={nav} route={route()} />);
    expect(screen.getByText('Sign in to view your messages.')).toBeTruthy();
  });

  it('renders conversations', async () => {
    mockGetConversations.mockResolvedValueOnce({
      items: [
        { id: 'c1', lastMessage: 'Is it available?', participants: [{ id: 'u2', name: 'Sita' }] },
      ],
    });
    render(<MessagesScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(screen.getByText('Sita')).toBeTruthy();
      expect(screen.getByText('Is it available?')).toBeTruthy();
    });
  });

  it('navigates to message thread on press', async () => {
    mockGetConversations.mockResolvedValueOnce({
      items: [
        { id: 'c1', lastMessage: 'Hello', participants: [{ id: 'u2', name: 'Sita' }] },
      ],
    });
    render(<MessagesScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(screen.getByText('Sita')).toBeTruthy());
    fireEvent.press(screen.getByText('Sita'));
    expect(mockNavigate).toHaveBeenCalledWith('MessageThread', { conversationId: 'c1' });
  });

  it('shows empty state', async () => {
    mockGetConversations.mockResolvedValueOnce({ items: [] });
    render(<MessagesScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(screen.getByText('No conversations yet.')).toBeTruthy();
    });
  });
});

/* ═══════════════════════════ ProfileScreen ═══════════════════════════ */

import { ProfileScreen } from '../../screens/ProfileScreen';

describe('ProfileScreen', () => {
  it('shows sign-in prompt when not logged in', () => {
    mockUser = null;
    render(<ProfileScreen navigation={nav} route={route()} />);
    expect(screen.getByText('Sign in to view your profile.')).toBeTruthy();
  });

  it('renders profile data from API', async () => {
    mockGetProfile.mockResolvedValueOnce({
      firstName: 'Ram',
      lastName: 'Sharma',
      email: 'ram@test.np',
      city: 'Kathmandu',
      state: 'Bagmati',
    });
    render(<ProfileScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(screen.getByText('Ram Sharma')).toBeTruthy();
      expect(screen.getByText('ram@test.np')).toBeTruthy();
      expect(screen.getByText(/Kathmandu, Bagmati/)).toBeTruthy();
    });
  });

  it('falls back to user context data when profile fails', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('fail'));
    render(<ProfileScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(screen.getByText('Ram Sharma')).toBeTruthy();
      expect(screen.getByText('test@x.np')).toBeTruthy();
    });
  });

  it('calls signOut when Sign Out is pressed', async () => {
    mockGetProfile.mockResolvedValueOnce({ firstName: 'Ram', email: 'ram@test.np' });
    render(<ProfileScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(screen.getByText('Sign Out')).toBeTruthy());
    fireEvent.press(screen.getByText('Sign Out'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('navigates to settings screens', async () => {
    mockGetProfile.mockResolvedValueOnce({ firstName: 'Ram', email: 'ram@test.np' });
    render(<ProfileScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(screen.getByText('Settings')).toBeTruthy());
    fireEvent.press(screen.getByText('Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('Settings', {});
  });
});
