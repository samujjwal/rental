import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Mock useFocusEffect to behave like useEffect (no NavigationContainer needed)
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

/* ── mocks ── */

const mockGetBooking = jest.fn();
const mockCreatePaymentIntent = jest.fn();
const mockGetPaymentBalance = jest.fn();
const mockGetPaymentTransactions = jest.fn();
const mockGetPaymentEarnings = jest.fn();
const mockGetMyBookings = jest.fn();

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

let mockUser: any = { id: 'u1', email: 'test@x.np', firstName: 'Ram' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
  }),
}));

jest.mock('../../api/client', () => ({
  mobileClient: {
    getBooking: (...a: any[]) => mockGetBooking(...a),
    createPaymentIntent: (...a: any[]) => mockCreatePaymentIntent(...a),
    getPaymentBalance: (...a: any[]) => mockGetPaymentBalance(...a),
    getPaymentTransactions: (...a: any[]) => mockGetPaymentTransactions(...a),
    getPaymentEarnings: (...a: any[]) => mockGetPaymentEarnings(...a),
    getMyBookings: (...a: any[]) => mockGetMyBookings(...a),
  },
}));

// Mock Stripe (not available in test env)
jest.mock('@stripe/stripe-react-native', () => ({}), { virtual: true });

jest.mock('../../components/Toast', () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
  showApiError: jest.fn(),
}));

jest.mock('../../components/LoadingSkeleton', () => ({
  DetailPageSkeleton: () => <></>,
  ListSkeleton: () => <></>,
}));

jest.mock('../../components/FormInput', () => ({
  FormButton: ({ title, onPress }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} testID={`btn-${title}`}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

const nav = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  setOptions: jest.fn(),
} as any;
const route = (params: any = {}) => ({ params }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@x.np', firstName: 'Ram' };
});

/* ═══════════════════════════ CheckoutScreen ═══════════════════════════ */

import { CheckoutScreen } from '../../screens/CheckoutScreen';

describe('CheckoutScreen', () => {
  it('shows sign in required when user is null', () => {
    mockUser = null;
    render(<CheckoutScreen navigation={nav} route={route({ bookingId: 'b1' })} />);
    expect(screen.getByText('Sign In Required')).toBeTruthy();
    expect(screen.getByText('Sign in to complete checkout.')).toBeTruthy();
  });

  it('navigates to Login on sign in press', () => {
    mockUser = null;
    render(<CheckoutScreen navigation={nav} route={route({ bookingId: 'b1' })} />);
    fireEvent.press(screen.getByText('Sign In'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('shows booking not found when fetch fails', async () => {
    mockGetBooking.mockRejectedValue(new Error('not found'));
    render(<CheckoutScreen navigation={nav} route={route({ bookingId: 'b1' })} />);
    await waitFor(() => {
      expect(screen.getByText('Booking Not Found')).toBeTruthy();
    });
  });

  it('shows Go Back button on booking not found', async () => {
    mockGetBooking.mockRejectedValue(new Error('not found'));
    render(<CheckoutScreen navigation={nav} route={route({ bookingId: 'b1' })} />);
    await waitFor(() => {
      expect(screen.getByText('Go Back')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Go Back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders booking summary after successful fetch', async () => {
    mockGetBooking.mockResolvedValue({
      id: 'b1',
      listing: { title: 'Mountain Bike' },
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-05T00:00:00Z',
      totalAmount: 250.00,
    });
    render(<CheckoutScreen navigation={nav} route={route({ bookingId: 'b1' })} />);
    await waitFor(() => {
      expect(screen.getByText('Checkout')).toBeTruthy();
    });
    expect(screen.getByText('Booking Summary')).toBeTruthy();
    expect(screen.getByText('Mountain Bike')).toBeTruthy();
    expect(screen.getByText('Rs. 250')).toBeTruthy();
  });

  it('shows web fallback button when Stripe not available', async () => {
    mockGetBooking.mockResolvedValue({
      id: 'b1',
      listing: { title: 'Camera' },
      startDate: '2026-03-01',
      endDate: '2026-03-03',
      totalAmount: 100,
    });
    render(<CheckoutScreen navigation={nav} route={route({ bookingId: 'b1' })} />);
    await waitFor(() => {
      expect(screen.getByText('Open Secure Checkout')).toBeTruthy();
    });
  });

  it('displays security note', async () => {
    mockGetBooking.mockResolvedValue({
      id: 'b1',
      listing: { title: 'Item' },
      startDate: '2026-03-01',
      endDate: '2026-03-03',
      totalAmount: 50,
    });
    render(<CheckoutScreen navigation={nav} route={route({ bookingId: 'b1' })} />);
    await waitFor(() => {
      expect(screen.getByText(/securely processed/i)).toBeTruthy();
    });
  });
});

/* ═══════════════════════════ PaymentsScreen ═══════════════════════════ */

import { PaymentsScreen } from '../../screens/PaymentsScreen';

describe('PaymentsScreen', () => {
  it('renders heading', async () => {
    mockGetPaymentBalance.mockResolvedValue({ balance: 5000, currency: 'NPR' });
    mockGetPaymentTransactions.mockResolvedValue({ transactions: [] });
    mockGetPaymentEarnings.mockResolvedValue({ amount: 2000, currency: 'NPR' });
    render(<PaymentsScreen />);
    expect(screen.getByText('Payments')).toBeTruthy();
  });

  it('displays balance and earnings cards', async () => {
    mockGetPaymentBalance.mockResolvedValue({ balance: 5000, currency: 'NPR' });
    mockGetPaymentTransactions.mockResolvedValue({ transactions: [] });
    mockGetPaymentEarnings.mockResolvedValue({ amount: 2000, currency: 'NPR' });
    render(<PaymentsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Total Balance')).toBeTruthy();
      expect(screen.getByText('Rs. 5,000')).toBeTruthy();
    });
    expect(screen.getByText('Available for payout')).toBeTruthy();
    expect(screen.getByText('Rs. 2,000')).toBeTruthy();
  });

  it('renders transaction list', async () => {
    mockGetPaymentBalance.mockResolvedValue({ balance: 100, currency: 'NPR' });
    mockGetPaymentTransactions.mockResolvedValue({
      transactions: [
        { id: 't1', type: 'PAYMENT', amount: 500, currency: 'NPR', status: 'POSTED' },
        { id: 't2', type: 'REFUND', amount: 200, currency: 'NPR', status: 'SETTLED' },
      ],
    });
    mockGetPaymentEarnings.mockResolvedValue({ amount: 0, currency: 'NPR' });
    render(<PaymentsScreen />);
    await waitFor(() => {
      expect(screen.getByText('PAYMENT')).toBeTruthy();
    });
    expect(screen.getByText('REFUND')).toBeTruthy();
    expect(screen.getByText('Rs. 500 · POSTED')).toBeTruthy();
  });

  it('shows empty state when no transactions', async () => {
    mockGetPaymentBalance.mockResolvedValue({ balance: 0, currency: 'NPR' });
    mockGetPaymentTransactions.mockResolvedValue({ transactions: [] });
    mockGetPaymentEarnings.mockResolvedValue({ amount: 0, currency: 'NPR' });
    render(<PaymentsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No transactions yet.')).toBeTruthy();
    });
  });

  it('shows error state on API failure', async () => {
    mockGetPaymentBalance.mockRejectedValue(new Error('fail'));
    mockGetPaymentTransactions.mockRejectedValue(new Error('fail'));
    mockGetPaymentEarnings.mockRejectedValue(new Error('fail'));
    render(<PaymentsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Unable to load payment data.')).toBeTruthy();
    });
  });

  it('renders recent transactions section title', () => {
    mockGetPaymentBalance.mockResolvedValue({ balance: 0, currency: 'NPR' });
    mockGetPaymentTransactions.mockResolvedValue({ transactions: [] });
    mockGetPaymentEarnings.mockResolvedValue({ amount: 0, currency: 'NPR' });
    render(<PaymentsScreen />);
    expect(screen.getByText('Recent transactions')).toBeTruthy();
  });
});

/* ═══════════════════════════ RenterDashboardScreen ═══════════════════════════ */

import { RenterDashboardScreen } from '../../screens/RenterDashboardScreen';

describe('RenterDashboardScreen', () => {
  it('renders heading and subheading', async () => {
    mockGetMyBookings.mockResolvedValue([]);
    render(<RenterDashboardScreen navigation={nav} route={route()} />);
    expect(screen.getByText('Renter Dashboard')).toBeTruthy();
    expect(screen.getByText('Track your bookings and activity.')).toBeTruthy();
  });

  it('shows sign in message when user is null', () => {
    mockUser = null;
    render(<RenterDashboardScreen navigation={nav} route={route()} />);
    expect(screen.getByText('Sign in to view your dashboard.')).toBeTruthy();
  });

  it('computes stats from bookings', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
    mockGetMyBookings.mockResolvedValue([
      { id: 'b1', status: 'CONFIRMED', startDate: futureDate, endDate: futureDate, listing: { title: 'A' } },
      { id: 'b2', status: 'IN_PROGRESS', startDate: '2025-01-01', endDate: '2025-01-05', listing: { title: 'B' } },
      { id: 'b3', status: 'COMPLETED', startDate: '2024-12-01', endDate: '2024-12-10', listing: { title: 'C' } },
    ]);
    render(<RenterDashboardScreen navigation={nav} route={route()} />);
    await waitFor(() => {
      expect(screen.getByText('Upcoming')).toBeTruthy();
      expect(screen.getByText('Active')).toBeTruthy();
      expect(screen.getByText('Completed')).toBeTruthy();
    });
  });

  it('renders quick action buttons', async () => {
    mockGetMyBookings.mockResolvedValue([]);
    render(<RenterDashboardScreen navigation={nav} route={route()} />);
    expect(screen.getByText('Search')).toBeTruthy();
    expect(screen.getByText('Bookings')).toBeTruthy();
    expect(screen.getByText('Messages')).toBeTruthy();
    expect(screen.getByText('Reviews')).toBeTruthy();
    expect(screen.getByText('Become Owner')).toBeTruthy();
  });

  it('navigates to Search on quick action press', async () => {
    mockGetMyBookings.mockResolvedValue([]);
    render(<RenterDashboardScreen navigation={nav} route={route()} />);
    fireEvent.press(screen.getByText('Search'));
    expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'SearchTab' });
  });

  it('renders recent bookings section', async () => {
    mockGetMyBookings.mockResolvedValue([
      { id: 'b1', status: 'CONFIRMED', startDate: '2026-01-01', endDate: '2026-01-05', listing: { title: 'Drone' } },
    ]);
    render(<RenterDashboardScreen navigation={nav} route={route()} />);
    await waitFor(() => {
      expect(screen.getByText('Drone')).toBeTruthy();
    });
    expect(screen.getByText('Recent bookings')).toBeTruthy();
  });

  it('navigates to BookingDetail on booking press', async () => {
    mockGetMyBookings.mockResolvedValue([
      { id: 'b1', status: 'CONFIRMED', startDate: '2026-01-01', endDate: '2026-01-05', listing: { title: 'Tent' } },
    ]);
    render(<RenterDashboardScreen navigation={nav} route={route()} />);
    await waitFor(() => {
      expect(screen.getByText('Tent')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Tent'));
    expect(mockNavigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b1' });
  });

  it('shows no bookings message when empty', async () => {
    mockGetMyBookings.mockResolvedValue([]);
    render(<RenterDashboardScreen navigation={nav} route={route()} />);
    await waitFor(() => {
      expect(screen.getByText('No bookings yet.')).toBeTruthy();
    });
  });

  it('shows error message on API failure', async () => {
    mockGetMyBookings.mockRejectedValue(new Error('fail'));
    render(<RenterDashboardScreen navigation={nav} route={route()} />);
    await waitFor(() => {
      expect(screen.getByText('Unable to load dashboard data.')).toBeTruthy();
    });
  });
});
