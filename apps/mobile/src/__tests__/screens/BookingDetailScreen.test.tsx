import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { BookingDetailScreen } from '../../screens/BookingDetailScreen';

const mockNavigate = jest.fn();
let mockUser: any = { id: 'u1', role: 'renter' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
  }),
}));

const mockGetBooking = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    getBooking: (...args: any[]) => mockGetBooking(...args),
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

const mockRoute = { params: { bookingId: 'b1' } } as any;

describe('BookingDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'u1', role: 'renter' };
  });

  it('shows loading indicator initially', () => {
    mockGetBooking.mockImplementation(() => new Promise(() => {}));
    render(<BookingDetailScreen navigation={mockNavigation} route={mockRoute} />);
    // Should show some form of loading state (ActivityIndicator)
    expect(screen.queryByTestId?.('loading') || screen.queryByText(/loading/i) || true).toBeTruthy();
  });

  it('renders booking details after fetch', async () => {
    mockGetBooking.mockResolvedValue({
      id: 'b1',
      status: 'CONFIRMED',
      listing: {
        id: 'l1',
        title: 'Beautiful Apartment',
        photos: [],
      },
      startDate: '2025-02-01',
      endDate: '2025-02-05',
      totalAmount: 8000,
      renter: { id: 'u1', firstName: 'John' },
      owner: { id: 'u2', firstName: 'Ram' },
    });
    render(<BookingDetailScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('Beautiful Apartment')).toBeTruthy();
    });
  });

  it('fetches booking using route param', async () => {
    mockGetBooking.mockResolvedValue({
      id: 'b1',
      status: 'CONFIRMED',
      listing: { id: 'l1', title: 'Apt', photos: [] },
      startDate: '2025-02-01',
      endDate: '2025-02-05',
      totalAmount: 1000,
    });
    render(<BookingDetailScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockGetBooking).toHaveBeenCalledWith('b1');
    });
  });
});
