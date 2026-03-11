import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

// Mock useFocusEffect to behave like useEffect (no NavigationContainer needed)
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

/* ---------- mock functions ---------- */
const mockGetUserStats = jest.fn();
const mockGetPaymentBalance = jest.fn();
const mockGetPaymentEarnings = jest.fn();
const mockGetPaymentTransactions = jest.fn();
const mockGetHostBookings = jest.fn();
const mockGetMyListings = jest.fn();
const mockPublishListing = jest.fn();
const mockPauseListing = jest.fn();
const mockActivateListing = jest.fn();
const mockDeleteListing = jest.fn();
const mockNavigate = jest.fn();

let mockUser: any = { id: 'u1', email: 'owner@x.np', firstName: 'Sita', lastName: 'KC' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
  }),
}));

jest.mock('../../api/client', () => ({
  mobileClient: {
    getUserStats: (...args: any[]) => mockGetUserStats(...args),
    getPaymentBalance: (...args: any[]) => mockGetPaymentBalance(...args),
    getPaymentEarnings: (...args: any[]) => mockGetPaymentEarnings(...args),
    getPaymentTransactions: (...args: any[]) => mockGetPaymentTransactions(...args),
    getHostBookings: (...args: any[]) => mockGetHostBookings(...args),
    getMyListings: (...args: any[]) => mockGetMyListings(...args),
    publishListing: (...args: any[]) => mockPublishListing(...args),
    pauseListing: (...args: any[]) => mockPauseListing(...args),
    activateListing: (...args: any[]) => mockActivateListing(...args),
    deleteListing: (...args: any[]) => mockDeleteListing(...args),
  },
}));

jest.mock('../../components/StaticInfoScreen', () => ({
  StaticInfoScreen: ({ title, description, ctaLabel, onPressCta }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        <Text>{description}</Text>
        <Pressable onPress={onPressCta}><Text>{ctaLabel}</Text></Pressable>
      </View>
    );
  },
}));

import { OwnerDashboardScreen } from '../../screens/OwnerDashboardScreen';
import { OwnerEarningsScreen } from '../../screens/OwnerEarningsScreen';
import { OwnerCalendarScreen } from '../../screens/OwnerCalendarScreen';
import { OwnerInsightsScreen } from '../../screens/OwnerInsightsScreen';
import { OwnerPerformanceScreen } from '../../screens/OwnerPerformanceScreen';
import { OwnerGuideScreen } from '../../screens/OwnerGuideScreen';
import { OwnerListingsScreen } from '../../screens/OwnerListingsScreen';

const nav = (overrides: Record<string, any> = {}) => ({
  navigate: mockNavigate,
  goBack: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'owner@x.np', firstName: 'Sita', lastName: 'KC' };
});

/* ===== OwnerDashboardScreen ===== */
describe('OwnerDashboardScreen', () => {
  it('renders heading', () => {
    mockGetUserStats.mockResolvedValue(null);
    const { getByText } = render(<OwnerDashboardScreen navigation={nav()} />);
    expect(getByText('Owner Dashboard')).toBeTruthy();
  });

  it('shows stats when loaded', async () => {
    mockGetUserStats.mockResolvedValue({
      listingsCount: 5,
      bookingsAsOwner: 12,
      bookingsAsRenter: 3,
      averageRating: 4.5,
      totalReviews: 8,
    });

    const { getByText } = render(<OwnerDashboardScreen navigation={nav()} />);

    await waitFor(() => expect(getByText('5')).toBeTruthy());
    expect(getByText('12')).toBeTruthy();
    expect(getByText('4.5 ★')).toBeTruthy();
  });

  it('shows sign-in message when no user', () => {
    mockUser = null;
    const { getByText } = render(<OwnerDashboardScreen navigation={nav()} />);
    expect(getByText('Sign in to view owner stats.')).toBeTruthy();
  });

  it('navigates to sub-screens via quick buttons', async () => {
    mockGetUserStats.mockResolvedValue({
      listingsCount: 0,
      bookingsAsOwner: 0,
      bookingsAsRenter: 0,
    });

    const { getByText } = render(<OwnerDashboardScreen navigation={nav()} />);
    fireEvent.press(getByText('My Listings'));
    expect(mockNavigate).toHaveBeenCalledWith('OwnerListings');

    fireEvent.press(getByText('Calendar'));
    expect(mockNavigate).toHaveBeenCalledWith('OwnerCalendar');

    fireEvent.press(getByText('Earnings'));
    expect(mockNavigate).toHaveBeenCalledWith('OwnerEarnings');
  });
});

/* ===== OwnerEarningsScreen ===== */
describe('OwnerEarningsScreen', () => {
  it('renders heading', () => {
    mockGetPaymentBalance.mockResolvedValue({ balance: 0, currency: 'NPR' });
    mockGetPaymentEarnings.mockResolvedValue({ amount: 0, currency: 'NPR' });
    mockGetPaymentTransactions.mockResolvedValue({ transactions: [] });

    const { getByText } = render(<OwnerEarningsScreen />);
    expect(getByText('Owner Earnings')).toBeTruthy();
  });

  it('shows sign-in message when no user', () => {
    mockUser = null;
    const { getByText } = render(<OwnerEarningsScreen />);
    expect(getByText('Sign in to view earnings.')).toBeTruthy();
  });

  it('displays balance and earnings', async () => {
    mockGetPaymentBalance.mockResolvedValue({ balance: 5000, currency: 'NPR' });
    mockGetPaymentEarnings.mockResolvedValue({ amount: 3500, currency: 'NPR' });
    mockGetPaymentTransactions.mockResolvedValue({ transactions: [] });

    const { getByText } = render(<OwnerEarningsScreen />);

    await waitFor(() => expect(getByText('Rs. 3,500')).toBeTruthy());
    expect(getByText('Rs. 5,000')).toBeTruthy();
  });

  it('shows transactions list', async () => {
    mockGetPaymentBalance.mockResolvedValue({ balance: 100, currency: 'NPR' });
    mockGetPaymentEarnings.mockResolvedValue({ amount: 50, currency: 'NPR' });
    mockGetPaymentTransactions.mockResolvedValue({
      transactions: [
        { id: 'tx1', type: 'PAYOUT', description: 'Weekly payout', status: 'completed', amount: 50, currency: 'NPR' },
      ],
    });

    const { getByText } = render(<OwnerEarningsScreen />);

    await waitFor(() => expect(getByText('PAYOUT')).toBeTruthy());
    expect(getByText('Weekly payout')).toBeTruthy();
  });
});

/* ===== OwnerCalendarScreen ===== */
describe('OwnerCalendarScreen', () => {
  it('renders heading', () => {
    mockGetHostBookings.mockResolvedValue([]);
    const { getByText } = render(<OwnerCalendarScreen />);
    expect(getByText('Owner Calendar')).toBeTruthy();
  });

  it('shows sign-in message when no user', () => {
    mockUser = null;
    const { getByText } = render(<OwnerCalendarScreen />);
    expect(getByText('Sign in to view your calendar.')).toBeTruthy();
  });

  it('displays bookings sorted by date', async () => {
    mockGetHostBookings.mockResolvedValue([
      { id: 'b2', listing: { title: 'Second' }, startDate: '2024-03-01', endDate: '2024-03-05', status: 'CONFIRMED' },
      { id: 'b1', listing: { title: 'First' }, startDate: '2024-02-01', endDate: '2024-02-05', status: 'PENDING' },
    ]);

    const { getByText } = render(<OwnerCalendarScreen />);

    await waitFor(() => expect(getByText('First')).toBeTruthy());
    expect(getByText('Second')).toBeTruthy();
  });

  it('shows empty state', async () => {
    mockGetHostBookings.mockResolvedValue([]);

    const { getByText } = render(<OwnerCalendarScreen />);

    await waitFor(() => expect(getByText('No bookings yet.')).toBeTruthy());
  });
});

/* ===== OwnerInsightsScreen ===== */
describe('OwnerInsightsScreen', () => {
  it('renders heading', () => {
    mockGetUserStats.mockResolvedValue(null);
    const { getByText } = render(<OwnerInsightsScreen />);
    expect(getByText('Owner Insights')).toBeTruthy();
  });

  it('shows sign-in message when no user', () => {
    mockUser = null;
    const { getByText } = render(<OwnerInsightsScreen />);
    expect(getByText('Sign in to view insights.')).toBeTruthy();
  });

  it('displays stats', async () => {
    mockGetUserStats.mockResolvedValue({
      listingsCount: 10,
      bookingsAsOwner: 20,
      averageRating: 4.8,
      totalReviews: 15,
      responseRate: '95%',
      responseTime: '2',
    });

    const { getByText } = render(<OwnerInsightsScreen />);

    await waitFor(() => expect(getByText('10')).toBeTruthy());
    expect(getByText('4.8')).toBeTruthy();
    expect(getByText('95%')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });
});

/* ===== OwnerPerformanceScreen ===== */
describe('OwnerPerformanceScreen', () => {
  it('renders heading', () => {
    mockGetUserStats.mockResolvedValue(null);
    const { getByText } = render(<OwnerPerformanceScreen />);
    expect(getByText('Owner Performance')).toBeTruthy();
  });

  it('shows sign-in message when no user', () => {
    mockUser = null;
    const { getByText } = render(<OwnerPerformanceScreen />);
    expect(getByText('Sign in to view performance.')).toBeTruthy();
  });

  it('displays performance metrics', async () => {
    mockGetUserStats.mockResolvedValue({
      responseRate: '90%',
      responseTime: '3',
      reviewsReceived: 10,
      averageRating: 4.2,
    });

    const { getByText } = render(<OwnerPerformanceScreen />);

    await waitFor(() => expect(getByText('90%')).toBeTruthy());
    expect(getByText('3')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
    expect(getByText('4.2')).toBeTruthy();
  });
});

/* ===== OwnerGuideScreen ===== */
describe('OwnerGuideScreen', () => {
  it('renders guide title and description', () => {
    const { getByText } = render(<OwnerGuideScreen navigation={nav()} route={{} as any} />);
    expect(getByText('Owner Guide')).toBeTruthy();
    expect(getByText(/Best practices/)).toBeTruthy();
  });

  it('navigates to CreateListing on CTA press', () => {
    const { getByText } = render(<OwnerGuideScreen navigation={nav()} route={{} as any} />);
    fireEvent.press(getByText('List an item'));
    expect(mockNavigate).toHaveBeenCalledWith('CreateListing');
  });
});

/* ===== OwnerListingsScreen ===== */
describe('OwnerListingsScreen', () => {
  it('renders heading', () => {
    mockGetMyListings.mockResolvedValue([]);
    const { getByText } = render(<OwnerListingsScreen navigation={nav()} route={{} as any} />);
    expect(getByText('My Listings')).toBeTruthy();
  });

  it('shows sign-in message when no user', () => {
    mockUser = null;
    const { getByText } = render(<OwnerListingsScreen navigation={nav()} route={{} as any} />);
    expect(getByText('Sign in to manage listings.')).toBeTruthy();
  });

  it('displays listings', async () => {
    mockGetMyListings.mockResolvedValue([
      { id: 'l1', title: 'Camping Tent', basePrice: 500, status: 'ACTIVE', images: [] },
      { id: 'l2', title: 'Generator', basePrice: 1000, status: 'DRAFT', images: [] },
    ]);

    const { getByText } = render(<OwnerListingsScreen navigation={nav()} route={{} as any} />);

    await waitFor(() => expect(getByText('Camping Tent')).toBeTruthy());
    expect(getByText('Generator')).toBeTruthy();
  });

  it('navigates to create listing on New button', async () => {
    mockGetMyListings.mockResolvedValue([]);
    const { getByText } = render(<OwnerListingsScreen navigation={nav()} route={{} as any} />);

    await waitFor(() => expect(getByText('New')).toBeTruthy());
    fireEvent.press(getByText('New'));
    expect(mockNavigate).toHaveBeenCalledWith('CreateListing');
  });
});
