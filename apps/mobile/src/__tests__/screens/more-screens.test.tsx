import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mock useFocusEffect to behave like useEffect (no NavigationContainer needed)
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

/* ---------- mock functions ---------- */
const mockGetMyDisputes = jest.fn();
const mockGetDisputeById = jest.fn();
const mockRespondToDispute = jest.fn();
const mockCloseDispute = jest.fn();
const mockCreateDispute = jest.fn();
const mockGetBooking = jest.fn();
const mockGetProfile = jest.fn();
const mockGetNotificationPreferences = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUpdateNotificationPreferences = jest.fn();
const mockGetUserReviews = jest.fn();
const mockGetMyBookings = jest.fn();
const mockGetHostBookings = jest.fn();
const mockCreateReview = jest.fn();
const mockSignOut = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();

let mockUser: any = { id: 'u1', email: 'test@x.np', firstName: 'Ram', lastName: 'Sharma' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
    isLoading: false,
  }),
}));

jest.mock('../../api/client', () => ({
  mobileClient: {
    getMyDisputes: (...args: any[]) => mockGetMyDisputes(...args),
    getDisputeById: (...args: any[]) => mockGetDisputeById(...args),
    respondToDispute: (...args: any[]) => mockRespondToDispute(...args),
    closeDispute: (...args: any[]) => mockCloseDispute(...args),
    createDispute: (...args: any[]) => mockCreateDispute(...args),
    getBooking: (...args: any[]) => mockGetBooking(...args),
    getProfile: (...args: any[]) => mockGetProfile(...args),
    getNotificationPreferences: (...args: any[]) => mockGetNotificationPreferences(...args),
    updateProfile: (...args: any[]) => mockUpdateProfile(...args),
    updateNotificationPreferences: (...args: any[]) => mockUpdateNotificationPreferences(...args),
    getUserReviews: (...args: any[]) => mockGetUserReviews(...args),
    getMyBookings: (...args: any[]) => mockGetMyBookings(...args),
    getHostBookings: (...args: any[]) => mockGetHostBookings(...args),
    createReview: (...args: any[]) => mockCreateReview(...args),
  },
}));

import { DisputesScreen } from '../../screens/DisputesScreen';
import { DisputeDetailScreen } from '../../screens/DisputeDetailScreen';
import { DisputeCreateScreen } from '../../screens/DisputeCreateScreen';
import { DashboardScreen } from '../../screens/DashboardScreen';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { ReviewsScreen } from '../../screens/ReviewsScreen';

const nav = (overrides: Record<string, any> = {}) =>
  ({ navigate: mockNavigate, replace: mockReplace, goBack: mockGoBack, setOptions: jest.fn(), ...overrides } as any);
const route = (params: Record<string, any> = {}) => ({ params, key: 'k', name: 'test' as any });

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@x.np', firstName: 'Ram', lastName: 'Sharma' };
});

/* ================================================================== */
/*  DisputesScreen                                                     */
/* ================================================================== */
describe('DisputesScreen', () => {
  it('shows sign-in prompt when unauthenticated', () => {
    mockUser = null;
    const { getAllByText } = render(<DisputesScreen navigation={nav()} route={route()} />);
    expect(getAllByText(/sign in/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders dispute list', async () => {
    mockGetMyDisputes.mockResolvedValue({
      disputes: [{ id: 'd1', title: 'Broken item', status: 'OPEN', description: 'desc' }],
    });

    const { getByText } = render(<DisputesScreen navigation={nav()} route={route()} />);
    await waitFor(() => expect(getByText('Broken item')).toBeTruthy());
  });

  it('shows empty state when no disputes', async () => {
    mockGetMyDisputes.mockResolvedValue({ disputes: [] });
    const { getByText } = render(<DisputesScreen navigation={nav()} route={route()} />);
    await waitFor(() => expect(getByText(/no disputes/i)).toBeTruthy());
  });

  it('navigates to DisputeDetail on card press', async () => {
    mockGetMyDisputes.mockResolvedValue({
      disputes: [{ id: 'd1', title: 'Issue', status: 'OPEN', description: '' }],
    });

    const { getByText } = render(<DisputesScreen navigation={nav()} route={route()} />);
    await waitFor(() => expect(getByText('Issue')).toBeTruthy());
    fireEvent.press(getByText('Issue'));
    expect(mockNavigate).toHaveBeenCalledWith('DisputeDetail', expect.objectContaining({ disputeId: 'd1' }));
  });

  it('filters disputes by status chip', async () => {
    mockGetMyDisputes.mockResolvedValue({ disputes: [] });
    const { getByText } = render(<DisputesScreen navigation={nav()} route={route()} />);
    await waitFor(() => expect(getByText(/no disputes/i)).toBeTruthy());

    fireEvent.press(getByText('OPEN'));
    await waitFor(() => {
      expect(mockGetMyDisputes).toHaveBeenCalledWith('OPEN');
    });
  });
});

/* ================================================================== */
/*  DisputeDetailScreen                                                */
/* ================================================================== */
describe('DisputeDetailScreen', () => {
  const disputeRoute = route({ disputeId: 'd1' });

  it('shows loading indicator', () => {
    mockGetDisputeById.mockReturnValue(new Promise(() => {})); // never resolves
    const { queryByText } = render(
      <DisputeDetailScreen navigation={nav()} route={disputeRoute} />
    );
    // Loading is shown via ActivityIndicator
    expect(queryByText('Dispute not found')).toBeNull();
  });

  it('renders dispute details after load', async () => {
    mockGetDisputeById.mockResolvedValue({
      id: 'd1',
      title: 'Broken Chair',
      status: 'OPEN',
      description: 'The chair was broken',
      bookingId: 'b1',
      responses: [],
      initiatorId: 'u1',
    });

    const { getByText } = render(
      <DisputeDetailScreen navigation={nav()} route={disputeRoute} />
    );

    await waitFor(() => expect(getByText('Broken Chair')).toBeTruthy());
    expect(getByText(/the chair was broken/i)).toBeTruthy();
  });

  it('shows not-found when dispute is null', async () => {
    mockGetDisputeById.mockResolvedValue(null);
    const { getByText } = render(
      <DisputeDetailScreen navigation={nav()} route={disputeRoute} />
    );
    await waitFor(() => expect(getByText(/not found/i)).toBeTruthy());
  });
});

/* ================================================================== */
/*  DisputeCreateScreen                                                */
/* ================================================================== */
describe('DisputeCreateScreen', () => {
  const createRoute = route({ bookingId: 'b1' });

  it('loads booking summary on mount', async () => {
    mockGetBooking.mockResolvedValue({ id: 'b1', listing: { title: 'Camera' } });
    render(
      <DisputeCreateScreen navigation={nav()} route={createRoute} />
    );
    await waitFor(() => expect(mockGetBooking).toHaveBeenCalledWith('b1'));
  });

  it('submits dispute and navigates on success', async () => {
    mockGetBooking.mockResolvedValue({ id: 'b1', listing: { title: 'Camera' } });
    mockCreateDispute.mockResolvedValue({ id: 'd-new' });

    const { getByText, getByPlaceholderText } = render(
      <DisputeCreateScreen navigation={nav()} route={createRoute} />
    );

    await waitFor(() => expect(getByText(/file a dispute/i)).toBeTruthy());

    // Select dispute type
    fireEvent.press(getByText('Property Damage'));

    // Fill in fields
    const titleInput = getByPlaceholderText('Dispute title');
    const descInput = getByPlaceholderText('Describe the issue');
    fireEvent.changeText(titleInput, 'Damaged item');
    fireEvent.changeText(descInput, 'The item was damaged on return');

    fireEvent.press(getByText(/submit dispute/i));

    await waitFor(() => {
      expect(mockCreateDispute).toHaveBeenCalled();
    });
  });
});

/* ================================================================== */
/*  DashboardScreen                                                    */
/* ================================================================== */
describe('DashboardScreen', () => {
  it('shows sign-in prompt when unauthenticated', () => {
    mockUser = null;
    const { getAllByText } = render(
      <DashboardScreen navigation={nav()} route={route()} />
    );
    expect(getAllByText(/sign in/i).length).toBeGreaterThanOrEqual(1);
  });

  it('redirects owner to OwnerDashboard', async () => {
    mockUser = { ...mockUser, role: 'owner' };
    render(
      <DashboardScreen navigation={nav()} route={route()} />
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('OwnerDashboard'));
  });

  it('redirects renter to RenterDashboard', async () => {
    mockUser = { ...mockUser, role: 'renter' };
    render(
      <DashboardScreen navigation={nav()} route={route()} />
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('RenterDashboard'));
  });
});

/* ================================================================== */
/*  SettingsScreen                                                     */
/* ================================================================== */
describe('SettingsScreen', () => {
  it('renders settings form for any user', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
  });

  it('loads profile and notification preferences', async () => {
    mockGetProfile.mockResolvedValue({ preferredLanguage: 'ne', preferredCurrency: 'NPR', timezone: 'Asia/Kathmandu' });
    mockGetNotificationPreferences.mockResolvedValue({ pushNotifications: true, emailNotifications: false });

    render(<SettingsScreen />);

    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalled();
      expect(mockGetNotificationPreferences).toHaveBeenCalled();
    });
  });

  it('saves settings on Save press', async () => {
    mockGetProfile.mockResolvedValue({});
    mockGetNotificationPreferences.mockResolvedValue({});
    mockUpdateProfile.mockResolvedValue({});
    mockUpdateNotificationPreferences.mockResolvedValue({});

    const { getByText } = render(<SettingsScreen />);

    await waitFor(() => expect(getByText(/save/i)).toBeTruthy());
    fireEvent.press(getByText(/save/i));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
      expect(mockUpdateNotificationPreferences).toHaveBeenCalled();
    });
  });

  it('signs out on Sign Out press', async () => {
    mockGetProfile.mockResolvedValue({});
    mockGetNotificationPreferences.mockResolvedValue({});

    const { getByText } = render(<SettingsScreen />);

    await waitFor(() => expect(getByText(/sign out/i)).toBeTruthy());
    fireEvent.press(getByText(/sign out/i));
    expect(mockSignOut).toHaveBeenCalled();
  });
});

/* ================================================================== */
/*  ReviewsScreen                                                      */
/* ================================================================== */
describe('ReviewsScreen', () => {
  it('shows sign-in prompt when unauthenticated', () => {
    mockUser = null;
    const { getByText } = render(<ReviewsScreen />);
    expect(getByText(/sign in/i)).toBeTruthy();
  });

  it('loads user reviews on mount', async () => {
    mockGetUserReviews.mockResolvedValue({ reviews: [] });
    mockGetMyBookings.mockResolvedValue([]);

    render(<ReviewsScreen />);

    await waitFor(() => expect(mockGetUserReviews).toHaveBeenCalled());
  });

  it('renders reviews list', async () => {
    mockGetUserReviews.mockResolvedValue({
      reviews: [{ id: 'r1', overallRating: 5, comment: 'Great experience', reviewer: { firstName: 'Sita' } }],
    });
    mockGetMyBookings.mockResolvedValue([]);

    const { getByText } = render(<ReviewsScreen />);

    await waitFor(() => expect(getByText(/great experience/i)).toBeTruthy());
  });

  it('submits a new review', async () => {
    mockGetUserReviews.mockResolvedValue({ reviews: [] });
    mockGetMyBookings.mockResolvedValue([
      { id: 'b1', status: 'COMPLETED', listing: { title: 'Camera' } },
    ]);
    mockCreateReview.mockResolvedValue({ id: 'r-new' });

    const { getByText, getByPlaceholderText } = render(<ReviewsScreen />);

    await waitFor(() => expect(getByText(/leave a review/i)).toBeTruthy());

    // Select booking
    fireEvent.press(getByText('Camera'));

    // Add comment
    const commentInput = getByPlaceholderText(/comment/i);
    fireEvent.changeText(commentInput, 'Excellent quality gear');

    fireEvent.press(getByText(/submit/i));

    await waitFor(() => expect(mockCreateReview).toHaveBeenCalled());
  });
});
