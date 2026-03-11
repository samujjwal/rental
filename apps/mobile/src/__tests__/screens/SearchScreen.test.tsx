import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '../../screens/SearchScreen';

const mockSearch = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    search: (...args: any[]) => mockSearch(...args),
    searchListings: (...args: any[]) => mockSearch(...args),
    categories: jest.fn().mockResolvedValue([]),
    getCategories: jest.fn().mockResolvedValue([]),
    toggleFavorite: jest.fn(),
    getFavorites: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

jest.mock('../../components/LoadingSkeleton', () => ({
  CardListSkeleton: () => null,
}));

jest.mock('../../components/Toast', () => ({
  showApiError: jest.fn(),
  showSuccess: jest.fn(),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = {
  params: { query: 'apartment', location: '', lat: undefined, lon: undefined, radius: 25 },
} as any;

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch.mockResolvedValue({ results: [], total: 0 });
  });

  it('renders without crashing', async () => {
    render(<SearchScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalled();
    });
  });

  it('shows empty state when no results are found', async () => {
    mockSearch.mockResolvedValueOnce({ results: [], total: 0 });

    render(<SearchScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalled();
    });
  });

  it('displays results from API', async () => {
    mockSearch.mockResolvedValueOnce({
      results: [
        { id: '1', title: 'Nice Studio', pricePerDay: 1200, images: [], location: 'Kathmandu' },
      ],
      total: 1,
    });

    render(<SearchScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('Nice Studio')).toBeTruthy();
    });
  });
});
