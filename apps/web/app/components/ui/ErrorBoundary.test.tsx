import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ErrorBoundary, withErrorBoundary } from '~/components/ui/ErrorBoundary';
import { useTranslation } from 'react-i18next';

const mockRequestNavigation = vi.hoisted(() => vi.fn());

// Mock the translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

vi.mock('~/lib/navigation', () => ({
  requestNavigation: mockRequestNavigation,
}));

// Mock console.error to avoid noise in tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    const ChildComponent = () => <div>Child Component</div>;

    render(
      <ErrorBoundary onError={mockOnError}>
        <ChildComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Child Component')).toBeInTheDocument();
    expect(mockOnError).not.toHaveBeenCalled();
  });

  it('catches and displays error information', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. We apologize for the inconvenience.')).toBeInTheDocument();
    expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
    expect(mockOnError).toHaveBeenCalled();
  });

  it('shows retry button when enabled', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary onError={mockOnError} showRetry={true}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('shows go home button when enabled', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary onError={mockOnError} showHome={true}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('shows report bug button when enabled', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary onError={mockOnError} showReport={true}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Report Bug')).toBeInTheDocument();
  });

  it('shows retry count when retrying', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary onError={mockOnError} showRetry={true}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    // Should show retry count
    expect(screen.getByText('Try Again (1/3)')).toBeInTheDocument();
  });

  it('shows retry exhausted message', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary onError={mockOnError} showRetry={true}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    // Retry 3 times to exhaust attempts
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));

    expect(screen.getByText(/Maximum retry attempts reached/)).toBeInTheDocument();
  });

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const ThrowErrorComponent = () => {
      throw new Error('Test error with stack');
    };

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error Details')).toBeInTheDocument();
    expect(screen.getByText('Test error with stack')).toBeInTheDocument();

    // Restore original env
    process.env.NODE_ENV = originalEnv;
  });

  it('uses custom fallback when provided', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    const CustomFallback = () => <div>Custom Error Fallback</div>;

    render(
      <ErrorBoundary onError={mockOnError} fallback={<CustomFallback />}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error Fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('handles report bug functionality', () => {
    const originalWindowOpen = window.open;
    window.open = vi.fn();

    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary onError={mockOnError} showReport={true}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    const reportButton = screen.getByText('Report Bug');
    fireEvent.click(reportButton);

    expect(window.open).toHaveBeenCalled();
    const [mailtoUrl] = (window.open as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(mailtoUrl)).toContain('mailto:');
    expect(decodeURIComponent(String(mailtoUrl))).toContain('Test error');

    // Restore original window.open
    window.open = originalWindowOpen;
  });

  it('handles go home functionality', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary onError={mockOnError} showHome={true}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    const homeButton = screen.getByText('Go Home');
    fireEvent.click(homeButton);

    expect(mockRequestNavigation).toHaveBeenCalledWith('/', { replace: true });
  });

  it('generates unique error IDs', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    const firstRender = render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    const firstErrorId = screen.getByText(/Error ID:/).textContent?.match(/Error ID: (.*)/)?.[1];

    firstRender.unmount();

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    const secondErrorId = screen.getByText(/Error ID:/).textContent?.match(/Error ID: (.*)/)?.[1];

    expect(firstErrorId).not.toBe(secondErrorId);
  });
});

describe('withErrorBoundary HOC', () => {
  it('wraps component with error boundary', () => {
    const ThrowErrorComponent = () => {
      throw new Error('Test error');
    };

    const WrappedComponent = withErrorBoundary(ThrowErrorComponent);

    render(<WrappedComponent />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('passes props through HOC', () => {
    const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent message="Test message" />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('sets correct display name', () => {
    const TestComponent = () => <div>Test</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });
});
