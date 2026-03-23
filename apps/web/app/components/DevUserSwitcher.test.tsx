import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router';

const { mockNavigate, mockAuthApi, mockUseAuthStore, mockCreateUserSession } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAuthApi: {
    login: vi.fn(),
    devLogin: vi.fn(),
  },
  mockUseAuthStore: {
    getState: vi.fn(() => ({
      clearAuth: vi.fn(),
      setAuth: vi.fn(),
    })),
  },
  mockCreateUserSession: vi.fn(),
}));

// Stub import.meta.env.MODE to "development" so DevUserSwitcher renders
const originalMode = import.meta.env.MODE;
beforeEach(() => {
  import.meta.env.MODE = 'development';
});
afterEach(() => {
  import.meta.env.MODE = originalMode;
});

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('~/lib/api/auth', () => ({
  authApi: mockAuthApi,
}));

vi.mock('~/lib/store/auth', () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock('~/utils/auth', () => ({
  createUserSession: mockCreateUserSession,
}));

vi.mock('axios', () => ({
  default: { isAxiosError: vi.fn(() => false) },
}));

import { DevUserSwitcher } from './DevUserSwitcher';

function renderSwitcher() {
  return render(
    <MemoryRouter>
      <DevUserSwitcher />
    </MemoryRouter>
  );
}

describe('DevUserSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.getState.mockReturnValue({
      clearAuth: vi.fn(),
      setAuth: vi.fn(),
    });
  });

  it('renders in development mode', () => {
    renderSwitcher();
    expect(screen.getByText('Quick Login (Dev Mode)')).toBeInTheDocument();
  });

  it('renders DEV badge', () => {
    renderSwitcher();
    expect(screen.getByText('DEV')).toBeInTheDocument();
  });

  it('renders all dev user buttons', () => {
    renderSwitcher();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Host')).toBeInTheDocument();
  });

  it('renders role descriptions', () => {
    renderSwitcher();
    expect(screen.getByText('System Admin')).toBeInTheDocument();
    expect(screen.getByText('Portal Admin')).toBeInTheDocument();
    expect(screen.getByText('Property Owner')).toBeInTheDocument();
  });

  it('renders Home link', () => {
    renderSwitcher();
    const homeLink = screen.getByText('Home');
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders Admin Portal button', () => {
    renderSwitcher();
    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
  });

  it('renders dev password input', () => {
    renderSwitcher();
    const input = screen.getByPlaceholderText('Dev password');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('password123');
  });

  it('updates password on change', () => {
    renderSwitcher();
    const input = screen.getByPlaceholderText('Dev password');
    fireEvent.change(input, { target: { value: 'newpass' } });
    expect(input).toHaveValue('newpass');
  });

  it('calls devLogin when user button is clicked', async () => {
    mockAuthApi.login.mockResolvedValue({
      user: { id: '1', role: 'ADMIN' },
      accessToken: 'tok',
      refreshToken: 'ref',
    });
    renderSwitcher();
    fireEvent.click(screen.getByText('Admin'));
    await waitFor(() => {
      expect(mockAuthApi.login).toHaveBeenCalledWith({
        email: 'admin@rental-portal.com',
        password: 'password123',
      });
    });
  });

  it('navigates to /admin for admin users', async () => {
    mockAuthApi.login.mockResolvedValue({
      user: { id: '1', role: 'ADMIN' },
      accessToken: 'tok',
      refreshToken: 'ref',
    });
    renderSwitcher();
    fireEvent.click(screen.getByText('Admin'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });
  });

  it('navigates to /dashboard for host users', async () => {
    mockAuthApi.login.mockResolvedValue({
      user: { id: '2', role: 'HOST' },
      accessToken: 'tok',
      refreshToken: 'ref',
    });
    renderSwitcher();
    fireEvent.click(screen.getByText('Host'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message on login failure', async () => {
    mockAuthApi.login.mockRejectedValue(new Error('Network error'));
    renderSwitcher();
    fireEvent.click(screen.getByText('Admin'));
    await waitFor(() => {
      expect(screen.getByText(/Quick login failed/)).toBeInTheDocument();
    });
  });

  it('shows error if admin login returns non-admin role', async () => {
    mockAuthApi.login.mockResolvedValue({
      user: { id: '1', role: 'USER' },
      accessToken: 'tok',
      refreshToken: 'ref',
    });
    renderSwitcher();
    fireEvent.click(screen.getByText('Admin'));
    await waitFor(() => {
      expect(screen.getByText(/Expected admin login/)).toBeInTheDocument();
    });
  });

  it('renders instruction text', () => {
    renderSwitcher();
    expect(screen.getByText('Click to login as test user')).toBeInTheDocument();
  });
});
