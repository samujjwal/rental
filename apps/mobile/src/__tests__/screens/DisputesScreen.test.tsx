import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { DisputesScreen } from '../../screens/DisputesScreen';

const mockNavigate = jest.fn();
let mockUser: any = { id: 'u1', role: 'renter' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
  }),
}));

const mockGetMyDisputes = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    getMyDisputes: (...args: any[]) => mockGetMyDisputes(...args),
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

const mockNavigation = {
  navigate: mockNavigate,
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = { params: {} } as any;

describe('DisputesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'u1', role: 'renter' };
  });

  it('renders heading', async () => {
    mockGetMyDisputes.mockResolvedValue({ disputes: [] });
    render(<DisputesScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('My Disputes')).toBeTruthy();
  });

  it('shows empty state when no disputes', async () => {
    mockGetMyDisputes.mockResolvedValue({ disputes: [] });
    render(<DisputesScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText(/no disputes|empty|none/i)).toBeTruthy();
    });
  });

  it('renders dispute list', async () => {
    mockGetMyDisputes.mockResolvedValue({
      disputes: [
        {
          id: 'd1',
          title: 'Damaged item',
          status: 'OPEN',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
    });
    render(<DisputesScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('Damaged item')).toBeTruthy();
    });
  });
});
