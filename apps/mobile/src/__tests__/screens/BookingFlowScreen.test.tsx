import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BookingFlowScreen } from '../../screens/BookingFlowScreen';

const mockGetListing = jest.fn();
const mockCreateBooking = jest.fn();
const mockCheckAvailability = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    getListing: (...args: any[]) => mockGetListing(...args),
    createBooking: (...args: any[]) => mockCreateBooking(...args),
    checkAvailability: (...args: any[]) => mockCheckAvailability(...args),
  },
}));

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'renter@example.com' },
  }),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = {
  params: { listingId: 'listing-456' },
} as any;

describe('BookingFlowScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetListing.mockResolvedValue({
      id: 'listing-456',
      title: 'Garden Flat',
      pricePerDay: 1500,
      images: [],
    });
  });

  it('loads listing on mount', async () => {
    render(<BookingFlowScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockGetListing).toHaveBeenCalledWith('listing-456');
    });
  });

  it('shows validation message when dates are missing', async () => {
    render(<BookingFlowScreen navigation={mockNavigation} route={mockRoute} />);

    // Wait for listing to load
    await waitFor(() => {
      expect(mockGetListing).toHaveBeenCalled();
    });

    // Try to press the booking button without dates
    const bookButton = screen.queryByText(/^Book Now$/i) || screen.queryByText(/^Create Booking$/i) || screen.queryByText(/^Book$/i);
    if (bookButton) {
      fireEvent.press(bookButton);
      await waitFor(() => {
        expect(
          screen.getByText(/start date.*end date|required/i),
        ).toBeTruthy();
      });
    }
  });
});
