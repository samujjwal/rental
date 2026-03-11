import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { FavoritesScreen } from '../../screens/FavoritesScreen';

const mockNavigate = jest.fn();
let mockUser: any = { id: 'u1', role: 'renter' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
  }),
}));

const mockGetFavorites = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    getFavorites: (...args: any[]) => mockGetFavorites(...args),
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

const mockNavigation = {
  navigate: mockNavigate,
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = { params: {} } as any;

describe('FavoritesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'u1', role: 'renter' };
  });

  it('renders heading', async () => {
    mockGetFavorites.mockResolvedValue([]);
    render(<FavoritesScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('My Favorites')).toBeTruthy();
  });

  it('shows empty state when no favorites', async () => {
    mockGetFavorites.mockResolvedValue([]);
    render(<FavoritesScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('No favorites yet.')).toBeTruthy();
    });
  });

  it('renders favorite listings', async () => {
    mockGetFavorites.mockResolvedValue([
      {
        id: 'l1',
        title: 'Cozy Apartment',
        basePrice: 2000,
        location: { city: 'Kathmandu' },
      },
    ]);
    render(<FavoritesScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('Cozy Apartment')).toBeTruthy();
    });
  });
});
