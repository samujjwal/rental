import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorMessage, InlineError } from './error-message';

// Mock UnifiedButton
vi.mock('./unified-button', () => ({
  UnifiedButton: ({ children, onClick, variant, ...props }: any) => (
    <button data-variant={variant} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('ErrorMessage', () => {
  it('renders default title', () => {
    render(<ErrorMessage message="Something failed" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ErrorMessage title="Connection Error" message="Cannot connect" />);
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
  });

  it('renders message', () => {
    render(<ErrorMessage message="Please try again later" />);
    expect(screen.getByText('Please try again later')).toBeInTheDocument();
  });

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorMessage message="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show retry button when onRetry is not provided', () => {
    render(<ErrorMessage message="Error" />);
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('shows custom action button', () => {
    const onClick = vi.fn();
    render(<ErrorMessage message="Error" action={{ label: 'Go Home', onClick }} />);
    fireEvent.click(screen.getByText('Go Home'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('InlineError', () => {
  it('renders error message', () => {
    render(<InlineError message="Field is required" />);
    expect(screen.getByText('Field is required')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<InlineError message="Error" className="mt-2" />);
    expect(container.firstChild).toHaveClass('mt-2');
  });
});
