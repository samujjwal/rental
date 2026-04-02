import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ErrorDisplay, ErrorList, ErrorBanner, InlineError } from './ErrorDisplay';
import type { AppError } from '~/hooks/useErrorHandler';

/**
 * Comprehensive tests for ErrorDisplay components
 * Tests all error severities, actions, edge cases, and accessibility
 */
describe('ErrorDisplay', () => {
  const mockRetry = vi.fn();
  const mockDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockError = (overrides: Partial<AppError> = {}): AppError => ({
    id: 'error-1',
    message: 'Test error message',
    severity: 'error',
    retryable: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  describe('Rendering', () => {
    it('should render error with correct severity styling', () => {
      const error = createMockError({ severity: 'critical' });

      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Critical Error')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });

    it('should render compact variant', () => {
      const error = createMockError();

      render(<ErrorDisplay error={error} compact />);

      const container = screen.getByRole('alert');
      expect(container).toHaveClass('p-3'); // Compact padding
    });

    it('should render with custom className', () => {
      const error = createMockError();

      render(<ErrorDisplay error={error} className="custom-class" />);

      expect(screen.getByRole('alert')).toHaveClass('custom-class');
    });

    it('should display component context when not compact', () => {
      const error = createMockError({
        context: {
          component: 'BookingForm',
          action: 'submit',
        },
      });

      render(<ErrorDisplay error={error} />);

      expect(screen.getByText(/Component: BookingForm/)).toBeInTheDocument();
      expect(screen.getByText(/Action: submit/)).toBeInTheDocument();
    });

    it('should not display context in compact mode', () => {
      const error = createMockError({
        context: { component: 'TestComponent' },
      });

      render(<ErrorDisplay error={error} compact />);

      expect(screen.queryByText(/Component:/)).not.toBeInTheDocument();
    });
  });

  describe('Severity Levels', () => {
    const severities: Array<AppError['severity']> = ['critical', 'error', 'warning', 'info'];

    severities.forEach((severity) => {
      it(`should render ${severity} severity correctly`, () => {
        const error = createMockError({ severity });

        render(<ErrorDisplay error={error} />);

        const titles = {
          critical: 'Critical Error',
          error: 'Error',
          warning: 'Warning',
          info: 'Information',
        };

        expect(screen.getByText(titles[severity])).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('should show retry button for retryable errors', () => {
      const error = createMockError({ retryable: true });

      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should not show retry button for non-retryable errors', () => {
      const error = createMockError({ retryable: false });

      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });

    it('should call onRetry when retry button clicked', async () => {
      const error = createMockError({ retryable: true });

      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      fireEvent.click(screen.getByText('Retry'));
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('should show dismiss button when onDismiss provided', () => {
      const error = createMockError();

      render(<ErrorDisplay error={error} onDismiss={mockDismiss} />);

      expect(screen.getByLabelText('Dismiss error')).toBeInTheDocument();
    });

    it('should call onDismiss when dismiss button clicked', async () => {
      const error = createMockError();

      render(<ErrorDisplay error={error} onDismiss={mockDismiss} />);

      fireEvent.click(screen.getByLabelText('Dismiss error'));
      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not show dismiss button when onDismiss not provided', () => {
      const error = createMockError();

      render(<ErrorDisplay error={error} />);

      expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument();
    });
  });

  describe('ErrorList', () => {
    const multipleErrors: AppError[] = [
      createMockError({ id: 'error-1', message: 'First error', retryable: true }),
      createMockError({ id: 'error-2', message: 'Second error', retryable: true }),
      createMockError({ id: 'error-3', message: 'Third error', retryable: true }),
    ];

    it('should render multiple errors', () => {
      render(<ErrorList errors={multipleErrors} />);

      expect(screen.getByText('First error')).toBeInTheDocument();
      expect(screen.getByText('Second error')).toBeInTheDocument();
      expect(screen.getByText('Third error')).toBeInTheDocument();
    });

    it('should limit visible errors with maxVisible', () => {
      render(<ErrorList errors={multipleErrors} maxVisible={2} />);

      expect(screen.getByText('First error')).toBeInTheDocument();
      expect(screen.getByText('Second error')).toBeInTheDocument();
      expect(screen.queryByText('Third error')).not.toBeInTheDocument();
      expect(screen.getByText('+1 more error')).toBeInTheDocument();
    });

    it('should return null when no errors', () => {
      const { container } = render(<ErrorList errors={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle individual error actions', () => {
      render(
        <ErrorList
          errors={multipleErrors}
          onRetry={mockRetry}
          onDismiss={mockDismiss}
        />
      );

      const retryButtons = screen.getAllByText('Retry');
      fireEvent.click(retryButtons[0]);
      expect(mockRetry).toHaveBeenCalledWith('error-1');

      const dismissButtons = screen.getAllByLabelText(/dismiss/i);
      fireEvent.click(dismissButtons[1]);
      expect(mockDismiss).toHaveBeenCalledWith('error-2');
    });

    it('should render errors in compact mode', () => {
      render(<ErrorList errors={multipleErrors} />);

      // All errors in ErrorList should be compact
      const errorContainers = screen.getAllByRole('alert');
      errorContainers.forEach((container) => {
        expect(container).toHaveClass('p-3');
      });
    });
  });

  describe('ErrorBanner', () => {
    it('should render banner with full width', () => {
      const error = createMockError({ severity: 'critical' });

      render(<ErrorBanner error={error} />);

      const banner = screen.getByRole('alert');
      expect(banner).toHaveClass('w-full');
      expect(banner).toHaveAttribute('aria-live', 'assertive');
    });

    it('should render at top position by default', () => {
      const error = createMockError();

      render(<ErrorBanner error={error} />);

      expect(screen.getByRole('alert')).toHaveClass('border-t');
    });

    it('should render at bottom position', () => {
      const error = createMockError();

      render(<ErrorBanner error={error} position="bottom" />);

      expect(screen.getByRole('alert')).toHaveClass('border-b');
    });

    it('should show retry button for retryable errors', () => {
      const error = createMockError({ retryable: true });

      render(<ErrorBanner error={error} onRetry={mockRetry} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call onRetry when retry clicked', () => {
      const error = createMockError({ retryable: true });

      render(<ErrorBanner error={error} onRetry={mockRetry} />);

      fireEvent.click(screen.getByText('Retry'));
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('should show dismiss button when provided', () => {
      const error = createMockError();

      render(<ErrorBanner error={error} onDismiss={mockDismiss} />);

      expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
    });

    it('should call onDismiss when dismiss clicked', () => {
      const error = createMockError();

      render(<ErrorBanner error={error} onDismiss={mockDismiss} />);

      fireEvent.click(screen.getByLabelText('Dismiss'));
      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('InlineError', () => {
    it('should render inline error with message', () => {
      render(<InlineError message="Field is required" />);

      expect(screen.getByText('Field is required')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should use error severity by default', () => {
      render(<InlineError message="Test error" />);

      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('should use custom severity', () => {
      render(<InlineError message="Warning message" severity="warning" />);

      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<InlineError message="Test" className="custom-error" />);

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveClass('custom-error');
    });

    it('should render with icon', () => {
      render(<InlineError message="Test error" />);

      // Should have AlertCircle icon
      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle error without context', () => {
      const error = createMockError();
      delete error.context;

      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.queryByText(/Component:/)).not.toBeInTheDocument();
    });

    it('should handle error with empty message', () => {
      const error = createMockError({ message: '' });

      render(<ErrorDisplay error={error} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      // Should not crash with empty message
    });

    it('should handle very long error messages', () => {
      const longMessage = 'This is a very long error message that could potentially wrap and cause layout issues in certain scenarios and we need to ensure it handles gracefully';
      const error = createMockError({ message: longMessage });

      render(<ErrorDisplay error={error} />);

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle missing retry callback', () => {
      const error = createMockError({ retryable: true });

      render(<ErrorDisplay error={error} />);

      // Should not show retry button without callback
      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });

    it('should handle ErrorList with single error', () => {
      const singleError = [createMockError({ message: 'Single error' })];

      render(<ErrorList errors={singleError} />);

      expect(screen.getByText('Single error')).toBeInTheDocument();
      expect(screen.queryByText(/more error/)).not.toBeInTheDocument();
    });

    it('should handle ErrorList with many errors', () => {
      const manyErrors = Array.from({ length: 10 }, (_, i) =>
        createMockError({ id: `error-${i}`, message: `Error ${i}` })
      );

      render(<ErrorList errors={manyErrors} maxVisible={3} />);

      expect(screen.getByText('Error 0')).toBeInTheDocument();
      expect(screen.getByText('Error 1')).toBeInTheDocument();
      expect(screen.getByText('Error 2')).toBeInTheDocument();
      expect(screen.getByText('+7 more errors')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const error = createMockError({ severity: 'critical' });

      render(<ErrorDisplay error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('should use assertive live region for critical errors in banner', () => {
      const error = createMockError({ severity: 'critical' });

      render(<ErrorBanner error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('should have accessible button labels', () => {
      const error = createMockError({ retryable: true });

      render(<ErrorDisplay error={error} onRetry={mockRetry} onDismiss={mockDismiss} />);

      expect(screen.getByLabelText('Dismiss error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should have proper region label for ErrorList', () => {
      const errors = [createMockError()];

      render(<ErrorList errors={errors} />);

      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Error messages');
    });
  });

  describe('Positive Cases', () => {
    it('should successfully render all severity types', () => {
      const severities: Array<AppError['severity']> = ['critical', 'error', 'warning', 'info'];

      severities.forEach((severity) => {
        const error = createMockError({ severity });
        const { unmount } = render(<ErrorDisplay error={error} />);

        expect(screen.getByText(error.message)).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle all actions correctly', () => {
      const error = createMockError({ retryable: true });

      render(<ErrorDisplay error={error} onRetry={mockRetry} onDismiss={mockDismiss} />);

      fireEvent.click(screen.getByText('Retry'));
      fireEvent.click(screen.getByLabelText('Dismiss error'));

      expect(mockRetry).toHaveBeenCalledTimes(1);
      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });

    it('should render ErrorList with proper pagination', () => {
      const errors = Array.from({ length: 5 }, (_, i) =>
        createMockError({ id: `error-${i}`, message: `Error ${i}` })
      );

      render(<ErrorList errors={errors} maxVisible={2} />);

      expect(screen.getByText('Error 0')).toBeInTheDocument();
      expect(screen.getByText('Error 1')).toBeInTheDocument();
      expect(screen.getByText('+3 more errors')).toBeInTheDocument();
    });
  });

  describe('Negative Cases', () => {
    it('should not render actions when callbacks not provided', () => {
      const error = createMockError({ retryable: true });

      render(<ErrorDisplay error={error} />);

      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/dismiss/i)).not.toBeInTheDocument();
    });

    it('should handle empty error list gracefully', () => {
      const { container } = render(<ErrorList errors={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('should not show context in compact mode', () => {
      const error = createMockError({
        context: { component: 'TestComponent', action: 'test' },
      });

      render(<ErrorDisplay error={error} compact />);

      expect(screen.queryByText(/Component:/)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle maximum number of errors', () => {
      const errors = Array.from({ length: 100 }, (_, i) =>
        createMockError({ id: `error-${i}`, message: `Error ${i}` })
      );

      render(<ErrorList errors={errors} maxVisible={5} />);

      expect(screen.getByText('+95 more errors')).toBeInTheDocument();
    });

    it('should handle special characters in error messages', () => {
      const error = createMockError({
        message: 'Error with special chars: <script>alert("xss")</script> & quotes "test"',
      });

      render(<ErrorDisplay error={error} />);

      expect(screen.getByText(/Error with special chars:/)).toBeInTheDocument();
    });

    it('should handle undefined context gracefully', () => {
      const error = createMockError();
      error.context = undefined;

      render(<ErrorDisplay error={error} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
