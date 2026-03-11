import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  ErrorState,
  ErrorStatePresets,
  ErrorStateWithChildren,
} from './error-state';

// Mock UnifiedButton
vi.mock('./unified-button', () => ({
  UnifiedButton: ({ children, onClick, variant, className, ...props }: any) => (
    <button data-variant={variant} onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

const withRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ErrorState', () => {
  it('renders default title when none provided', () => {
    withRouter(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    withRouter(<ErrorState title="Custom Error" />);
    expect(screen.getByText('Custom Error')).toBeInTheDocument();
  });

  it('renders message when provided', () => {
    withRouter(<ErrorState title="Oops" message="Something broke" />);
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('does not render message when omitted', () => {
    withRouter(<ErrorState title="Oops" />);
    expect(screen.queryByText('Something broke')).not.toBeInTheDocument();
  });

  it('renders error code', () => {
    withRouter(<ErrorState code={404} />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders string error code', () => {
    withRouter(<ErrorState code="ERR_500" />);
    expect(screen.getByText('ERR_500')).toBeInTheDocument();
  });

  it('renders icon when provided and no code', () => {
    withRouter(<ErrorState icon="⚠️" />);
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('prefers code over icon when both provided', () => {
    withRouter(<ErrorState code={500} icon="⚠️" />);
    expect(screen.getByText('500')).toBeInTheDocument();
    // icon should not render when code is present
    expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
  });

  it('renders retry button that calls onRetry', () => {
    const onRetry = vi.fn();
    withRouter(<ErrorState title="Error" onRetry={onRetry} />);
    const btn = screen.getByText('Try Again');
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button without onRetry', () => {
    withRouter(<ErrorState title="Error" showHomeButton={false} />);
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('renders home button by default', () => {
    withRouter(<ErrorState title="Error" />);
    expect(screen.getByText('Go to Home')).toBeInTheDocument();
  });

  it('hides home button when showHomeButton=false', () => {
    withRouter(<ErrorState title="Error" showHomeButton={false} />);
    expect(screen.queryByText('Go to Home')).not.toBeInTheDocument();
  });

  it('renders children in action area', () => {
    withRouter(
      <ErrorState title="Error" showHomeButton={false}>
        <button>Custom Action</button>
      </ErrorState>
    );
    expect(screen.getByText('Custom Action')).toBeInTheDocument();
  });

  it('shows error details in development when error prop given', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = new Error('Test stack');
    withRouter(<ErrorState title="Error" error={err} />);
    expect(screen.getByText('Error Details (dev only)')).toBeInTheDocument();
    expect(screen.getByText(/Test stack/)).toBeInTheDocument();
    process.env.NODE_ENV = origEnv;
  });

  it('applies size sm/md/lg classes', () => {
    const { container: sm } = withRouter(<ErrorState title="E" size="sm" />);
    expect(sm.querySelector('.py-8')).toBeTruthy();

    const { container: lg } = withRouter(<ErrorState title="E" size="lg" />);
    expect(lg.querySelector('.py-16')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = withRouter(<ErrorState title="E" className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeTruthy();
  });
});

describe('ErrorStatePresets', () => {
  it('NotFound renders 404 code and default message', () => {
    withRouter(<ErrorStatePresets.NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('NotFound renders custom message', () => {
    withRouter(<ErrorStatePresets.NotFound message="Listing gone" />);
    expect(screen.getByText('Listing gone')).toBeInTheDocument();
  });

  it('ServerError renders with retry', () => {
    const onRetry = vi.fn();
    withRouter(<ErrorStatePresets.ServerError onRetry={onRetry} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('Unauthorized renders access denied', () => {
    withRouter(<ErrorStatePresets.Unauthorized />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('Forbidden renders access forbidden', () => {
    withRouter(<ErrorStatePresets.Forbidden />);
    expect(screen.getByText('Access Forbidden')).toBeInTheDocument();
  });

  it('SessionExpired renders login link', () => {
    withRouter(<ErrorStatePresets.SessionExpired />);
    expect(screen.getByText('Session Expired')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('NetworkError renders with retry', () => {
    const onRetry = vi.fn();
    withRouter(<ErrorStatePresets.NetworkError onRetry={onRetry} />);
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('ListingNotAvailable renders browse link', () => {
    withRouter(<ErrorStatePresets.ListingNotAvailable />);
    expect(screen.getByText('Listing no longer available')).toBeInTheDocument();
    expect(screen.getByText('Browse Similar Listings')).toBeInTheDocument();
  });

  it('PaymentFailed renders with retry', () => {
    const onRetry = vi.fn();
    withRouter(<ErrorStatePresets.PaymentFailed onRetry={onRetry} />);
    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
  });

  it('DatesUnavailable renders message', () => {
    withRouter(<ErrorStatePresets.DatesUnavailable />);
    expect(screen.getByText('These dates are no longer available')).toBeInTheDocument();
  });
});

describe('ErrorStateWithChildren', () => {
  it('renders ErrorState and children', () => {
    withRouter(
      <ErrorStateWithChildren title="Wrapped Error">
        <p>Extra info</p>
      </ErrorStateWithChildren>
    );
    expect(screen.getByText('Wrapped Error')).toBeInTheDocument();
    expect(screen.getByText('Extra info')).toBeInTheDocument();
  });
});
