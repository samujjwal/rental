import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

/* ── mocks ── */

const mockGetConversationMessages = jest.fn();
const mockMarkConversationRead = jest.fn();
const mockSendMessage = jest.fn();
const mockCategories = jest.fn();
const mockCreateListing = jest.fn();
const mockGetListing = jest.fn();
const mockUpdateListing = jest.fn();
const mockGenerateDescription = jest.fn();

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

let mockUser: any = { id: 'u1', email: 'test@x.np', firstName: 'Ram', lastName: 'Sharma' };

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
  }),
}));

jest.mock('../../api/client', () => ({
  mobileClient: {
    getConversationMessages: (...a: any[]) => mockGetConversationMessages(...a),
    markConversationRead: (...a: any[]) => mockMarkConversationRead(...a),
    sendMessage: (...a: any[]) => mockSendMessage(...a),
    categories: (...a: any[]) => mockCategories(...a),
    createListing: (...a: any[]) => mockCreateListing(...a),
    getListing: (...a: any[]) => mockGetListing(...a),
    updateListing: (...a: any[]) => mockUpdateListing(...a),
    generateDescription: (...a: any[]) => mockGenerateDescription(...a),
  },
}));

const mockConnectSocket = jest.fn().mockResolvedValue(null);
const mockJoinConversation = jest.fn();
const mockLeaveConversation = jest.fn();
const mockSendMessageViaSocket = jest.fn().mockReturnValue(false);
const mockOnNewMessage = jest.fn().mockReturnValue(() => {});
const mockOnTypingIndicator = jest.fn().mockReturnValue(() => {});
const mockSendTypingIndicator = jest.fn();
const mockOnSocketStatusChange = jest.fn().mockReturnValue(() => {});

jest.mock('../../api/socket', () => ({
  connectSocket: (...a: any[]) => mockConnectSocket(...a),
  joinConversation: (...a: any[]) => mockJoinConversation(...a),
  leaveConversation: (...a: any[]) => mockLeaveConversation(...a),
  sendMessageViaSocket: (...a: any[]) => mockSendMessageViaSocket(...a),
  onNewMessage: (...a: any[]) => mockOnNewMessage(...a),
  onTypingIndicator: (...a: any[]) => mockOnTypingIndicator(...a),
  sendTypingIndicator: (...a: any[]) => mockSendTypingIndicator(...a),
  onSocketStatusChange: (...a: any[]) => mockOnSocketStatusChange(...a),
}));

jest.mock('../../components/LoadingSkeleton', () => ({
  ListSkeleton: () => <MockText>Loading skeleton</MockText>,
}));

jest.mock('../../components/ImagePicker', () => ({
  ImagePicker: ({ label }: any) => <MockText>{label || 'ImagePicker'}</MockText>,
}));

jest.mock('../../components/Toast', () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
  showApiError: jest.fn(),
}));

// RN mock helper
function MockText({ children }: { children: React.ReactNode }) {
  const { Text } = require('react-native');
  return <Text>{children}</Text>;
}

import { MessageThreadScreen } from '../../screens/MessageThreadScreen';
import { CreateListingScreen } from '../../screens/CreateListingScreen';
import { EditListingScreen } from '../../screens/EditListingScreen';

const nav = { navigate: mockNavigate, goBack: mockGoBack, setOptions: mockSetOptions } as any;
const route = (params: any = {}) => ({ params }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@x.np', firstName: 'Ram', lastName: 'Sharma' };
});

/* ═══════════════════════ MessageThreadScreen ═══════════════════════ */

describe('MessageThreadScreen', () => {
  const makeRoute = (conversationId = 'conv1') => route({ conversationId });

  it('shows sign-in prompt when no user', () => {
    mockUser = null;
    render(<MessageThreadScreen navigation={nav} route={makeRoute()} />);
    expect(screen.getAllByText(/sign in/i).length).toBeGreaterThan(0);
  });

  it('shows loading skeleton while fetching messages', () => {
    mockGetConversationMessages.mockReturnValue(new Promise(() => {})); // never resolves
    render(<MessageThreadScreen navigation={nav} route={makeRoute()} />);
    expect(screen.getByText('Loading skeleton')).toBeTruthy();
  });

  it('renders messages after loading', async () => {
    mockGetConversationMessages.mockResolvedValue({
      messages: [
        { id: 'm1', content: 'Hello from Ram', senderId: 'u1', createdAt: new Date().toISOString() },
        { id: 'm2', content: 'Hi there!', senderId: 'u2', createdAt: new Date().toISOString() },
      ],
    });
    mockMarkConversationRead.mockResolvedValue(undefined);

    render(<MessageThreadScreen navigation={nav} route={makeRoute()} />);

    await waitFor(() => {
      expect(screen.getByText('Hello from Ram')).toBeTruthy();
      expect(screen.getByText('Hi there!')).toBeTruthy();
    });
    expect(mockMarkConversationRead).toHaveBeenCalledWith('conv1');
  });

  it('shows empty state when no messages', async () => {
    mockGetConversationMessages.mockResolvedValue({ messages: [] });
    mockMarkConversationRead.mockResolvedValue(undefined);

    render(<MessageThreadScreen navigation={nav} route={makeRoute()} />);

    await waitFor(() => {
      expect(screen.getByText(/no messages/i)).toBeTruthy();
    });
  });

  it('has a text input and send button', async () => {
    mockGetConversationMessages.mockResolvedValue({ messages: [] });
    mockMarkConversationRead.mockResolvedValue(undefined);

    render(<MessageThreadScreen navigation={nav} route={makeRoute()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type.*message/i)).toBeTruthy();
    });
  });

  it('connects to socket on mount', async () => {
    mockGetConversationMessages.mockResolvedValue({ messages: [] });
    mockMarkConversationRead.mockResolvedValue(undefined);

    render(<MessageThreadScreen navigation={nav} route={makeRoute()} />);

    await waitFor(() => {
      expect(mockConnectSocket).toHaveBeenCalled();
    });
  });

  it('fetches messages for the conversation', async () => {
    mockGetConversationMessages.mockResolvedValue({ messages: [] });
    mockMarkConversationRead.mockResolvedValue(undefined);

    render(<MessageThreadScreen navigation={nav} route={makeRoute('conv-99')} />);

    await waitFor(() => {
      expect(mockGetConversationMessages).toHaveBeenCalledWith('conv-99');
    });
  });
});

/* ═══════════════════════ CreateListingScreen ═══════════════════════ */

describe('CreateListingScreen', () => {
  it('loads categories on mount', async () => {
    mockCategories.mockResolvedValue([
      { id: 'c1', name: 'Apartments', slug: 'apartments' },
    ]);

    render(<CreateListingScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(mockCategories).toHaveBeenCalled();
    });
    expect(screen.getByText('Apartments')).toBeTruthy();
  });

  it('renders form fields', async () => {
    mockCategories.mockResolvedValue([]);
    render(<CreateListingScreen navigation={nav} route={route()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/listing title/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/description/i)).toBeTruthy();
    });
  });

  it('shows validation error for missing fields', async () => {
    mockCategories.mockResolvedValue([]);
    render(<CreateListingScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(mockCategories).toHaveBeenCalled());

    fireEvent.press(screen.getByText('Create'));

    expect(screen.getByText(/fill in all required/i)).toBeTruthy();
  });

  it('shows error for invalid price', async () => {
    mockCategories.mockResolvedValue([
      { id: 'c1', name: 'Apartments', slug: 'apartments' },
    ]);
    render(<CreateListingScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(screen.getByText('Apartments')).toBeTruthy());

    // Fill required fields except price
    fireEvent.changeText(screen.getByPlaceholderText(/listing title/i), 'Test');
    fireEvent.changeText(screen.getByPlaceholderText(/description/i), 'A description');
    fireEvent.press(screen.getByText('Apartments'));
    fireEvent.changeText(screen.getByPlaceholderText(/street address/i), '123 Main St');
    fireEvent.changeText(screen.getByPlaceholderText(/city/i), 'Kathmandu');
    fireEvent.changeText(screen.getByPlaceholderText(/state/i), 'Bagmati');
    fireEvent.changeText(screen.getByPlaceholderText(/country/i), 'Nepal');
    fireEvent.changeText(screen.getByPlaceholderText(/price/i), 'abc');

    fireEvent.press(screen.getByText('Create'));

    expect(screen.getByText(/valid price/i)).toBeTruthy();
  });

  it('calls createListing and navigates on success', async () => {
    mockCategories.mockResolvedValue([
      { id: 'c1', name: 'Apartments', slug: 'apartments' },
    ]);
    mockCreateListing.mockResolvedValue({ id: 'listing-1' });

    render(<CreateListingScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(screen.getByText('Apartments')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText(/listing title/i), 'My Apartment');
    fireEvent.changeText(screen.getByPlaceholderText(/description/i), 'Nice place');
    fireEvent.press(screen.getByText('Apartments'));
    fireEvent.changeText(screen.getByPlaceholderText(/street address/i), '123 Main St');
    fireEvent.changeText(screen.getByPlaceholderText(/city/i), 'Kathmandu');
    fireEvent.changeText(screen.getByPlaceholderText(/state/i), 'Bagmati');
    fireEvent.changeText(screen.getByPlaceholderText(/country/i), 'Nepal');
    fireEvent.changeText(screen.getByPlaceholderText(/latitude/i), '27.7');
    fireEvent.changeText(screen.getByPlaceholderText(/longitude/i), '85.3');
    fireEvent.changeText(screen.getByPlaceholderText(/price/i), '1000');

    fireEvent.press(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockCreateListing).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Apartment',
          basePrice: 1000,
          categoryId: 'c1',
        }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('Listing', { listingId: 'listing-1' });
    });
  });

  it('shows error for missing lat/lon', async () => {
    mockCategories.mockResolvedValue([
      { id: 'c1', name: 'Apartments', slug: 'apartments' },
    ]);
    render(<CreateListingScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(screen.getByText('Apartments')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText(/listing title/i), 'Test');
    fireEvent.changeText(screen.getByPlaceholderText(/description/i), 'Desc');
    fireEvent.press(screen.getByText('Apartments'));
    fireEvent.changeText(screen.getByPlaceholderText(/street address/i), '456 Park Ave');
    fireEvent.changeText(screen.getByPlaceholderText(/city/i), 'Kathmandu');
    fireEvent.changeText(screen.getByPlaceholderText(/state/i), 'Bagmati');
    fireEvent.changeText(screen.getByPlaceholderText(/country/i), 'Nepal');
    fireEvent.changeText(screen.getByPlaceholderText(/price/i), '1000');

    fireEvent.press(screen.getByText('Create'));

    expect(screen.getByText(/latitude and longitude/i)).toBeTruthy();
  });

  it('shows sign-in error when user is null', async () => {
    mockUser = null;
    mockCategories.mockResolvedValue([]);
    render(<CreateListingScreen navigation={nav} route={route()} />);

    await waitFor(() => expect(mockCategories).toHaveBeenCalled());

    fireEvent.press(screen.getByText('Create'));

    expect(screen.getByText(/sign in/i)).toBeTruthy();
  });
});

/* ═══════════════════════ EditListingScreen ═══════════════════════ */

describe('EditListingScreen', () => {
  const editRoute = () => route({ listingId: 'l1' });

  it('loads listing data on mount', async () => {
    mockGetListing.mockResolvedValue({
      title: 'Mountain Cabin',
      description: 'Cozy place',
      basePrice: 5000,
      bookingMode: 'REQUEST',
      photos: [],
    });

    render(<EditListingScreen navigation={nav} route={editRoute()} />);

    await waitFor(() => {
      expect(mockGetListing).toHaveBeenCalledWith('l1');
      expect(screen.getByDisplayValue('Mountain Cabin')).toBeTruthy();
      expect(screen.getByDisplayValue('5000')).toBeTruthy();
    });
  });

  it('shows error when listing fetch fails', async () => {
    mockGetListing.mockRejectedValue(new Error('Network error'));

    render(<EditListingScreen navigation={nav} route={editRoute()} />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load/i)).toBeTruthy();
    });
  });

  it('shows error for invalid price on save', async () => {
    mockGetListing.mockResolvedValue({
      title: 'Test',
      description: 'Desc',
      basePrice: 100,
      photos: [],
    });

    render(<EditListingScreen navigation={nav} route={editRoute()} />);

    await waitFor(() => expect(screen.getByDisplayValue('100')).toBeTruthy());

    fireEvent.changeText(screen.getByDisplayValue('100'), 'abc');
    fireEvent.press(screen.getByText('Save'));

    expect(screen.getByText(/valid price/i)).toBeTruthy();
  });

  it('calls updateListing on valid save', async () => {
    mockGetListing.mockResolvedValue({
      title: 'Old Title',
      description: 'Old desc',
      basePrice: 100,
      bookingMode: 'REQUEST',
      photos: [],
    });
    mockUpdateListing.mockResolvedValue({ id: 'l1' });

    render(<EditListingScreen navigation={nav} route={editRoute()} />);

    await waitFor(() => expect(screen.getByDisplayValue('Old Title')).toBeTruthy());

    fireEvent.changeText(screen.getByDisplayValue('Old Title'), 'New Title');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdateListing).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({ title: 'New Title' }),
      );
    });
  });

  it('shows sign-in error when user is null', async () => {
    mockUser = null;
    mockGetListing.mockResolvedValue({
      title: 'Test',
      description: 'Desc',
      basePrice: 100,
      photos: [],
    });

    render(<EditListingScreen navigation={nav} route={editRoute()} />);

    await waitFor(() => expect(screen.getByDisplayValue('Test')).toBeTruthy());

    fireEvent.press(screen.getByText('Save'));

    expect(screen.getByText(/sign in/i)).toBeTruthy();
  });

  it('handles pricePerDay as fallback pricing', async () => {
    mockGetListing.mockResolvedValue({
      title: 'Room',
      description: 'Desc',
      pricePerDay: 2500,
      photos: [],
    });

    render(<EditListingScreen navigation={nav} route={editRoute()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('2500')).toBeTruthy();
    });
  });

  it('normalizes instantBooking to booking mode', async () => {
    mockGetListing.mockResolvedValue({
      title: 'Room',
      description: 'Desc',
      basePrice: 1000,
      instantBooking: true,
      photos: [],
    });

    render(<EditListingScreen navigation={nav} route={editRoute()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Room')).toBeTruthy();
    });
    // If INSTANT mode is set, the "Instant" toggle should be present
    expect(screen.getByText('Instant')).toBeTruthy();
  });
});
