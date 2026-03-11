import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { ListingScreen } from '../../screens/ListingScreen';

const mockGetListing = jest.fn();
const mockGetListingReviews = jest.fn();

// Mock useFocusEffect to behave like useEffect (no NavigationContainer needed)
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

jest.mock('../../api/client', () => ({
  mobileClient: {
    getListing: (...args: any[]) => mockGetListing(...args),
    getListingReviews: (...args: any[]) => mockGetListingReviews(...args),
  },
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = {
  params: { listingId: 'listing-123' },
} as any;

describe('ListingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetListingReviews.mockResolvedValue({ reviews: [], total: 0 });
  });

  it('fetches and shows listing details', async () => {
    mockGetListing.mockResolvedValueOnce({
      id: 'listing-123',
      title: 'Cozy Apartment in Kathmandu',
      description: 'A great place for short-term stays.',
      pricePerDay: 2500,
      images: [],
    });

    render(<ListingScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('Cozy Apartment in Kathmandu')).toBeTruthy();
    });
    expect(mockGetListing).toHaveBeenCalledWith('listing-123');
  });

  it('handles fetch error gracefully', async () => {
    mockGetListing.mockRejectedValueOnce(new Error('Network Error'));

    render(<ListingScreen navigation={mockNavigation} route={mockRoute} />);

    // Should not crash — listing stays null
    await waitFor(() => {
      expect(mockGetListing).toHaveBeenCalled();
    });
  });
});
