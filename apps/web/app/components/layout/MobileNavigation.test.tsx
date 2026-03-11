import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('lucide-react', () => ({
  Menu: (props: any) => <span data-testid="menu-icon" {...props} />,
  X: (props: any) => <span data-testid="x-icon" {...props} />,
  Home: (props: any) => <span data-testid="home-icon" {...props} />,
  Search: (props: any) => <span data-testid="search-icon" {...props} />,
  Calendar: (props: any) => <span data-testid="calendar-icon" {...props} />,
  Heart: (props: any) => <span data-testid="heart-icon" {...props} />,
  MessageCircle: (props: any) => <span data-testid="message-icon" {...props} />,
  Settings: (props: any) => <span data-testid="settings-icon" {...props} />,
  HelpCircle: (props: any) => <span data-testid="help-icon" {...props} />,
  LogOut: (props: any) => <span data-testid="logout-icon" {...props} />,
  Bell: (props: any) => <span data-testid="bell-icon" {...props} />,
  User: (props: any) => <span data-testid="user-icon" {...props} />,
  Plus: (props: any) => <span data-testid="plus-icon" {...props} />,
}));

vi.mock('~/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}));

const { mockAuthStore } = vi.hoisted(() => ({
  mockAuthStore: {
    getState: vi.fn(() => ({ refreshToken: 'test-token', clearAuth: vi.fn() })),
  },
}));

vi.mock('~/lib/store/auth', () => ({
  useAuthStore: mockAuthStore,
}));

vi.mock('~/lib/api/auth', () => ({
  authApi: { logout: vi.fn().mockResolvedValue(undefined) },
}));

import { MobileHeader, MobileBottomNav } from './MobileNavigation';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('MobileHeader', () => {
  it('renders hamburger menu button', () => {
    renderWithRouter(<MobileHeader />);
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
  });

  it('renders logo "G"', () => {
    renderWithRouter(<MobileHeader />);
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('shows Login link when not authenticated', () => {
    renderWithRouter(<MobileHeader isAuthenticated={false} />);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('shows notification and profile icons when authenticated', () => {
    renderWithRouter(<MobileHeader isAuthenticated={true} />);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('Profile')).toBeInTheDocument();
  });

  it('shows notification count badge', () => {
    renderWithRouter(
      <MobileHeader isAuthenticated={true} notificationCount={5} />
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 9+ for counts over 9', () => {
    renderWithRouter(
      <MobileHeader isAuthenticated={true} notificationCount={15} />
    );
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('does not show notification badge when count is 0', () => {
    renderWithRouter(
      <MobileHeader isAuthenticated={true} notificationCount={0} />
    );
    // notificationCount=0 is falsy, so the badge span is not rendered
    // React may render the literal 0 from short-circuit; just verify no badge span
    const badges = document.querySelectorAll('.bg-destructive');
    expect(badges).toHaveLength(0);
  });

  it('opens slide menu when hamburger is clicked', () => {
    renderWithRouter(<MobileHeader isAuthenticated={true} userName="Alice" />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
    expect(screen.getByText('GharBatai')).toBeInTheDocument();
  });

  it('shows search bar in slide menu', () => {
    renderWithRouter(<MobileHeader isAuthenticated={true} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByText('Search rentals…')).toBeInTheDocument();
  });

  it('shows authenticated nav links in menu', () => {
    renderWithRouter(<MobileHeader isAuthenticated={true} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByText('My Bookings')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(screen.getByText('Help Center')).toBeInTheDocument();
  });

  it('shows Log Out button for authenticated users', () => {
    renderWithRouter(<MobileHeader isAuthenticated={true} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByText('Log Out')).toBeInTheDocument();
  });

  it('shows Log In and Sign Up for unauthenticated users', () => {
    renderWithRouter(<MobileHeader isAuthenticated={false} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    // "Sign In" appears both in the header bar and the slide menu
    const signInElements = screen.getAllByText('Sign In');
    expect(signInElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  it('shows message count badge in menu', () => {
    renderWithRouter(
      <MobileHeader isAuthenticated={true} messageCount={3} />
    );
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows username in footer when authenticated', () => {
    renderWithRouter(
      <MobileHeader isAuthenticated={true} userName="Alice Smith" />
    );
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument(); // avatar initial
    expect(screen.getByText('View profile')).toBeInTheDocument();
  });

  it('closes menu when close button is clicked', () => {
    renderWithRouter(<MobileHeader isAuthenticated={true} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close menu'));
    expect(screen.queryByLabelText('Close menu')).not.toBeInTheDocument();
  });

  it('closes menu when backdrop is clicked', () => {
    renderWithRouter(<MobileHeader isAuthenticated={true} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    const backdrop = document.querySelector('[aria-hidden="true"]')!;
    fireEvent.click(backdrop);
    expect(screen.queryByLabelText('Close menu')).not.toBeInTheDocument();
  });
});

describe('MobileBottomNav', () => {
  it('renders public nav items when not authenticated', () => {
    renderWithRouter(<MobileBottomNav isAuthenticated={false} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('renders renter nav items when authenticated as renter', () => {
    renderWithRouter(
      <MobileBottomNav isAuthenticated={true} userType="renter" />
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
    expect(screen.getByText('My Bookings')).toBeInTheDocument();
    expect(screen.getByText('Favorites')).toBeInTheDocument();
  });

  it('renders owner nav items when authenticated as owner', () => {
    renderWithRouter(
      <MobileBottomNav isAuthenticated={true} userType="owner" />
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Listings')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('Earnings')).toBeInTheDocument();
  });

  it('defaults to renter items when userType not specified', () => {
    renderWithRouter(<MobileBottomNav isAuthenticated={true} />);
    expect(screen.getByText('Favorites')).toBeInTheDocument();
  });

  it('limits to 5 items max', () => {
    renderWithRouter(
      <MobileBottomNav isAuthenticated={true} userType="renter" />
    );
    const links = screen.getAllByRole('link');
    expect(links.length).toBeLessThanOrEqual(5);
  });
});
