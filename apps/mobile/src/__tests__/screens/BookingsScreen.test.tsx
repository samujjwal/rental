import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { BookingsScreen } from '../../screens/BookingsScreen';

const mockNavigate = jest.fn();
let mockUser: any = { id: 'u1', role: 'renter' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
  }),
}));

const mockGetMyBookings = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    getMyBookings: (...args: any[]) => mockGetMyBookings(...args),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => {
    const React = require('react');
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, []);
  },
}));

jest.mock('../../utils/currency', () => ({
  formatCurrency: (v: number) => `NPR ${v}`,
}));

jest.mock('../../utils/date', () => ({
  formatDate: (d: any) => '2025-01-01',
}));

const mockNavigation = {
  navigate: mockNavigate,
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = { params: {} } as any;

describe('BookingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'u1', role: 'renter' };
  });

  it('renders heading', async () => {
    mockGetMyBookings.mockResolvedValue([]);
    render(<BookingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('My Bookings')).toBeTruthy();
  });

  it('shows empty state when no bookings', async () => {
    mockGetMyBookings.mockResolvedValue([]);
    render(<BookingsScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('No bookings yet')).toBeTruthy();
    });
    expect(screen.getByText('Browse Listings')).toBeTruthy();
  });

  it('renders booking entries', async () => {
    mockGetMyBookings.mockResolvedValue([
      {
        id: 'b1',
        status: 'CONFIRMED',
        listing: { title: 'Mountain View Apartment' },
        startDate: '2025-02-01',
        endDate: '2025-02-05',
        totalAmount: 8000,
      },
    ]);
    render(<BookingsScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('Mountain View Apartment')).toBeTruthy();
    });
  });
});
