import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { DashboardScreen } from '../../screens/DashboardScreen';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
  }),
}));

let mockUser: any = null;

const mockNavigation = {
  navigate: mockNavigate,
  replace: mockReplace,
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = { params: {} } as any;

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it('shows sign-in prompt when not authenticated', () => {
    mockUser = null;
    render(<DashboardScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('Sign in to manage your rentals, bookings, and messages.')).toBeTruthy();
  });

  it('redirects owner to OwnerDashboard', async () => {
    mockUser = { id: 'u1', role: 'owner', firstName: 'Test' };
    render(<DashboardScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('OwnerDashboard');
    });
  });

  it('redirects renter to RenterDashboard', async () => {
    mockUser = { id: 'u1', role: 'renter', firstName: 'Test' };
    render(<DashboardScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('RenterDashboard');
    });
  });
});
