import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    id: '1',
    firstName: 'Ram',
    lastName: 'Sharma',
    email: 'ram@test.com',
    role: 'owner',
    profilePhotoUrl: null as string | null,
  },
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useLoaderData: () => ({ user: mockUser }),
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
  };
});

vi.mock('~/utils/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('~/components/theme', () => ({
  ThemeToggle: ({ size }: { size?: string }) => (
    <button data-testid="theme-toggle" data-size={size}>Theme</button>
  ),
}));

vi.mock('~/components/language', () => ({
  LanguageSelector: ({ size, iconOnly }: { size?: string; iconOnly?: boolean }) => (
    <button data-testid="language-selector" data-size={size} data-icon-only={String(iconOnly)}>
      Lang
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Bell: (props: Record<string, unknown>) => <svg data-testid="bell-icon" {...props} />,
  LogOut: (props: Record<string, unknown>) => <svg data-testid="logout-icon" {...props} />,
  User: (props: Record<string, unknown>) => <svg data-testid="user-icon" {...props} />,
  Search: (props: Record<string, unknown>) => <svg data-testid="search-icon" {...props} />,
}));

import { MemoryRouter } from 'react-router';

// Must import after mocks
const { default: DashboardLayout, HydrateFallback } = await import('./DashboardLayout');

function renderLayout() {
  return render(
    <MemoryRouter>
      <DashboardLayout />
    </MemoryRouter>
  );
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    mockUser.firstName = 'Ram';
    mockUser.lastName = 'Sharma';
    mockUser.email = 'ram@test.com';
    mockUser.profilePhotoUrl = null;
  });

  it('renders GharBatai logo link', () => {
    renderLayout();
    const logo = screen.getByText('GharBatai');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/dashboard');
  });

  it('renders search link', () => {
    renderLayout();
    expect(screen.getByText('Search rentals…')).toBeInTheDocument();
  });

  it('renders theme toggle', () => {
    renderLayout();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('renders language selector', () => {
    renderLayout();
    expect(screen.getByTestId('language-selector')).toBeInTheDocument();
  });

  it('renders notifications link with bell icon', () => {
    renderLayout();
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    expect(screen.getByTestId('bell-icon')).toBeInTheDocument();
  });

  it('renders sign out link', () => {
    renderLayout();
    const signOut = screen.getByLabelText('Log Out');
    expect(signOut.closest('a')).toHaveAttribute('href', '/auth/logout');
  });

  it('renders display name from firstName and lastName', () => {
    renderLayout();
    expect(screen.getByText('Ram Sharma')).toBeInTheDocument();
  });

  it('renders Outlet for child routes', () => {
    renderLayout();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('shows user icon when no profile photo', () => {
    mockUser.profilePhotoUrl = null;
    renderLayout();
    expect(screen.getByTestId('user-icon')).toBeInTheDocument();
  });

  it('shows profile photo when URL provided', () => {
    mockUser.profilePhotoUrl = 'https://example.com/photo.jpg';
    renderLayout();
    const img = screen.getByAltText('Ram Sharma');
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('falls back to email when no name', () => {
    mockUser.firstName = '';
    mockUser.lastName = '';
    renderLayout();
    expect(screen.getByText('ram@test.com')).toBeInTheDocument();
  });

  it('falls back to "User" when no name or email', () => {
    mockUser.firstName = '';
    mockUser.lastName = '';
    mockUser.email = '';
    renderLayout();
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  it('shows only firstName when lastName is empty', () => {
    mockUser.lastName = '';
    renderLayout();
    expect(screen.getByText('Ram')).toBeInTheDocument();
  });
});

describe('HydrateFallback', () => {
  it('renders a loading spinner', () => {
    const { container } = render(<HydrateFallback />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('is centered vertically', () => {
    const { container } = render(<HydrateFallback />);
    expect(container.firstChild).toHaveClass('min-h-screen');
  });
});
