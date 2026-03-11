import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { MessagesScreen } from '../../screens/MessagesScreen';

const mockNavigate = jest.fn();
let mockUser: any = { id: 'u1', role: 'renter' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
  }),
}));

const mockGetConversations = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    getConversations: (...args: any[]) => mockGetConversations(...args),
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

describe('MessagesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'u1', role: 'renter' };
  });

  it('renders heading', async () => {
    mockGetConversations.mockResolvedValue({ items: [] });
    render(<MessagesScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('Messages')).toBeTruthy();
  });

  it('shows empty state when no conversations', async () => {
    mockGetConversations.mockResolvedValue({ items: [] });
    render(<MessagesScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('No conversations yet.')).toBeTruthy();
    });
  });

  it('renders conversation list', async () => {
    mockGetConversations.mockResolvedValue({
      items: [
        {
          id: 'c1',
          participants: [
            { id: 'u1', name: 'Current User' },
            { id: 'u2', name: 'Ram Sharma' },
          ],
          lastMessage: 'Hello!',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    });
    render(<MessagesScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('Ram Sharma')).toBeTruthy();
    });
  });
});
