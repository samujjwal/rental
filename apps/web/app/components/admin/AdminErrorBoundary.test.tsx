import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';

const { mockUseRouteError, mockIsRouteErrorResponse, mockRevalidate, mockUseRevalidator } = vi.hoisted(() => {
  const mockRevalidate = vi.fn();
  return {
    mockUseRouteError: vi.fn(),
    mockIsRouteErrorResponse: vi.fn(() => false),
    mockRevalidate,
    mockUseRevalidator: vi.fn(() => ({ revalidate: mockRevalidate })),
  };
});

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useRouteError: mockUseRouteError,
    isRouteErrorResponse: mockIsRouteErrorResponse,
    useRevalidator: mockUseRevalidator,
  };
});

vi.mock('lucide-react', () => ({
  AlertCircle: (props: Record<string, unknown>) => <svg data-testid="alert-icon" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <svg data-testid="refresh-icon" {...props} />,
  Home: (props: Record<string, unknown>) => <svg data-testid="home-icon" {...props} />,
}));

import { AdminErrorBoundary } from './AdminErrorBoundary';

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <AdminErrorBoundary />
    </MemoryRouter>
  );
}

describe('AdminErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouteError.mockReturnValue(new Error('Test error'));
    mockIsRouteErrorResponse.mockReturnValue(false);
  });

  it('renders "Something went wrong" heading', () => {
    renderWithRouter();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders error description text', () => {
    renderWithRouter();
    expect(screen.getByText(/error occurred in the admin panel/i)).toBeInTheDocument();
  });

  it('renders alert icon', () => {
    renderWithRouter();
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
  });

  it('renders "Refresh Page" button', () => {
    renderWithRouter();
    expect(screen.getByText('Refresh Page')).toBeInTheDocument();
  });

  it('renders "Back to Dashboard" link', () => {
    renderWithRouter();
    const link = screen.getByText('Back to Dashboard');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/admin');
  });

  it('calls revalidate when Refresh Page is clicked', () => {
    renderWithRouter();
    fireEvent.click(screen.getByText('Refresh Page'));
    expect(mockRevalidate).toHaveBeenCalledTimes(1);
  });

  it('displays Error message from Error instance', () => {
    mockUseRouteError.mockReturnValue(new Error('Custom error message'));
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    renderWithRouter();
    expect(screen.getByText(/Custom error message/)).toBeInTheDocument();
    process.env.NODE_ENV = originalEnv;
  });

  it('displays route error response status text', () => {
    mockIsRouteErrorResponse.mockReturnValue(true);
    mockUseRouteError.mockReturnValue({ status: 404, statusText: 'Not Found', data: null });
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    renderWithRouter();
    expect(screen.getByText(/Not Found/)).toBeInTheDocument();
    process.env.NODE_ENV = originalEnv;
  });

  it('displays fallback status for route error without statusText', () => {
    mockIsRouteErrorResponse.mockReturnValue(true);
    mockUseRouteError.mockReturnValue({ status: 500, statusText: '', data: null });
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    renderWithRouter();
    expect(screen.getByText(/Error 500/)).toBeInTheDocument();
    process.env.NODE_ENV = originalEnv;
  });

  it('displays string error', () => {
    mockUseRouteError.mockReturnValue('String error occurred');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    renderWithRouter();
    expect(screen.getByText(/String error occurred/)).toBeInTheDocument();
    process.env.NODE_ENV = originalEnv;
  });

  it('renders refresh and home icons', () => {
    renderWithRouter();
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    expect(screen.getByTestId('home-icon')).toBeInTheDocument();
  });

  it('has default error message for unknown error types', () => {
    mockUseRouteError.mockReturnValue(42); // non-standard error type
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    renderWithRouter();
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    process.env.NODE_ENV = originalEnv;
  });
});
