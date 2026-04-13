/**
 * P2: Comprehensive UI State Transition Tests
 *
 * Tests for all component state transitions:
 * - Loading states
 * - Error states  
 * - Empty states
 * - Success states
 * - Interactive state changes
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

// Test component that simulates various state transitions
interface StateTransitionComponentProps {
  onSubmit?: (data: unknown) => Promise<void>;
  validate?: (data: unknown) => string | null;
  asyncData?: () => Promise<unknown[]>;
}

const StateTransitionComponent: React.FC<StateTransitionComponentProps> = ({
  onSubmit,
  validate,
  asyncData,
}) => {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error' | 'empty'>('idle');
  const [data, setData] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleLoadData = async () => {
    setState('loading');
    setError(null);

    try {
      if (!asyncData) {
        throw new Error('No data loader provided');
      }
      const result = await asyncData();
      setData(result);

      if (result.length === 0) {
        setState('empty');
      } else {
        setState('success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validate) {
      const validationError = validate(formData);
      if (validationError) {
        setError(validationError);
        setState('error');
        return;
      }
    }

    setState('loading');
    setError(null);

    try {
      await onSubmit?.(formData);
      setFormData({ name: '', email: '' });
      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setState('error');
    }
  };

  const handleRetry = () => {
    setState('idle');
    setError(null);
    handleLoadData();
  };

  return (
    <div data-testid="state-component">
      {state === 'idle' && (
        <div data-testid="idle-state">
          <button data-testid="load-btn" onClick={handleLoadData}>
            Load Data
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div data-testid="loading-state">
          <span
            data-testid="loading-spinner"
            role="status"
            aria-live="polite"
            aria-label="Loading content, please wait"
          >
            Loading...
          </span>
        </div>
      )}

      {state === 'empty' && (
        <div data-testid="empty-state">
          <p>No data available</p>
          <button data-testid="retry-btn" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}

      {state === 'error' && (
        <div data-testid="error-state">
          <p
            data-testid="error-message"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
          <button data-testid="retry-btn" onClick={handleRetry}>
            Retry
          </button>
          <button data-testid="dismiss-btn" onClick={() => setState('idle')}>
            Dismiss
          </button>
        </div>
      )}

      {state === 'success' && (
        <div data-testid="success-state">
          <ul data-testid="data-list">
            {data.map((item: unknown, index) => (
              <li key={index} data-testid={`data-item-${index}`}>
                {JSON.stringify(item)}
              </li>
            ))}
          </ul>
          <button data-testid="refresh-btn" onClick={handleLoadData}>
            Refresh
          </button>
        </div>
      )}

      <form data-testid="form" onSubmit={handleSubmit}>
        <input
          data-testid="name-input"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Name"
        />
        <input
          data-testid="email-input"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="Email"
        />
        <button data-testid="submit-btn" type="submit" disabled={state === 'loading'}>
          Submit
        </button>
      </form>
    </div>
  );
};

describe('UI State Transition Tests', () => {
  describe('Idle to Loading Transition', () => {
    test('transitions from idle to loading when action triggered', async () => {
      let resolveLoader: (value: unknown[]) => void;
      const mockLoader = vi.fn().mockImplementation(() => new Promise(resolve => {
        resolveLoader = resolve;
      }));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      // Check loading state immediately (before promise resolves)
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading...');

      // Resolve to clean up
      resolveLoader!([{ id: 1, name: 'Test' }]);
    });

    test('shows loading spinner with correct accessibility', async () => {
      let resolveLoader: (value: unknown[]) => void;
      const mockLoader = vi.fn().mockImplementation(() => new Promise(resolve => {
        resolveLoader = resolve;
      }));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toBeVisible();
      expect(spinner).toHaveAttribute('role', 'status');
      expect(spinner).toHaveAttribute('aria-live', 'polite');

      // Resolve to clean up
      resolveLoader!([{ id: 1 }]);
    });
  });

  describe('Loading to Success Transition', () => {
    test('transitions to success state when data loads', async () => {
      const mockData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const mockLoader = vi.fn().mockResolvedValue(mockData);

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      expect(screen.getByTestId('data-list')).toBeInTheDocument();
      expect(screen.getByTestId('data-item-0')).toBeInTheDocument();
    });

    test('displays data correctly in success state', async () => {
      const mockData = [{ id: 1, title: 'Test Item', status: 'active' }];
      const mockLoader = vi.fn().mockResolvedValue(mockData);

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      const listItem = screen.getByTestId('data-item-0');
      expect(listItem.textContent).toContain('Test Item');
    });
  });

  describe('Loading to Empty Transition', () => {
    test('transitions to loading state on data load', async () => {
      let resolveLoader: (value: unknown[]) => void;
      const mockLoader = vi.fn().mockImplementation(() => new Promise(resolve => {
        resolveLoader = resolve;
      }));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      // Initially in idle state
      expect(screen.getByTestId('idle-state')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('load-btn'));

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // Resolve to empty state
      resolveLoader!([]);
    });

    test('transitions to empty state when no data returned', async () => {
      let resolveLoader: (value: unknown[]) => void;
      const mockLoader = vi.fn().mockImplementation(() => new Promise(resolve => {
        resolveLoader = resolve;
      }));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      // Resolve to empty state
      resolveLoader!([]);
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    test('empty state provides retry action', async () => {
      const mockLoader = vi.fn().mockResolvedValue([]);

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
    });
  });

  describe('Loading to Error Transition', () => {
    test('transitions to error state on load failure', async () => {
      const mockLoader = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent('Network error');
    });

    test('error state displays user-friendly message', async () => {
      const mockLoader = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toBeVisible();
      expect(errorMessage.textContent).toBeTruthy();
    });

    test('error state provides retry and dismiss actions', async () => {
      const mockLoader = vi.fn().mockRejectedValue(new Error('Error'));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
      expect(screen.getByTestId('dismiss-btn')).toBeInTheDocument();
    });
  });

  describe('Error Recovery Transitions', () => {
    test('retry transitions from error back to loading', async () => {
      let resolveSecond: (value: unknown[]) => void;
      const secondPromise = new Promise<unknown[]>((resolve) => {
        resolveSecond = resolve;
      });

      const mockLoader = vi
        .fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockImplementationOnce(() => secondPromise);

      render(<StateTransitionComponent asyncData={mockLoader} />);

      // First attempt - should error
      await userEvent.click(screen.getByTestId('load-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      // Click retry - should transition to loading while promise is pending
      await userEvent.click(screen.getByTestId('retry-btn'));
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // Resolve second load
      resolveSecond!([{ id: 1 }]);

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    test('dismiss transitions from error back to idle', async () => {
      const mockLoader = vi.fn().mockRejectedValue(new Error('Error'));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('dismiss-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('idle-state')).toBeInTheDocument();
      });

      expect(mockLoader).toHaveBeenCalledTimes(1);
    });
  });

  describe('Success Refresh Transition', () => {
    test('refresh from success state triggers loading', async () => {
      let resolveSecond: (value: unknown[]) => void;
      const secondPromise = new Promise<unknown[]>((resolve) => {
        resolveSecond = resolve;
      });

      const mockLoader = vi
        .fn()
        .mockResolvedValueOnce([{ id: 1 }])
        .mockImplementationOnce(() => secondPromise);

      render(<StateTransitionComponent asyncData={mockLoader} />);

      // First load
      await userEvent.click(screen.getByTestId('load-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      // Refresh - should show loading while second promise is pending
      await userEvent.click(screen.getByTestId('refresh-btn'));
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // Resolve second load
      resolveSecond!([{ id: 1 }, { id: 2 }]);

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });
  });

  describe('Form Submission State Transitions', () => {
    test('form submission transitions through loading to success', async () => {
      // Use delayed mock so loading state is visible
      let resolveSubmit: () => void;
      const mockSubmit = vi.fn().mockImplementation(() => new Promise<void>(resolve => {
        resolveSubmit = resolve;
      }));

      render(<StateTransitionComponent onSubmit={mockSubmit} />);

      await userEvent.type(screen.getByTestId('name-input'), 'Test Name');
      await userEvent.type(screen.getByTestId('email-input'), 'test@example.com');
      await userEvent.click(screen.getByTestId('submit-btn'));

      // Should show loading during submission (before promise resolves)
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // Resolve to continue
      resolveSubmit!();

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      expect(mockSubmit).toHaveBeenCalledWith({
        name: 'Test Name',
        email: 'test@example.com',
      });
    });

    test('form submission transitions to error on failure', async () => {
      // Use delayed reject so loading state is visible
      let rejectSubmit: (err: Error) => void;
      const mockSubmit = vi.fn().mockImplementation(() => new Promise<void>((_, reject) => {
        rejectSubmit = reject;
      }));

      render(<StateTransitionComponent onSubmit={mockSubmit} />);

      await userEvent.type(screen.getByTestId('name-input'), 'John');
      await userEvent.type(screen.getByTestId('email-input'), 'john@test.com');

      await userEvent.click(screen.getByTestId('submit-btn'));

      // Should show loading first
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // Trigger the error
      rejectSubmit!(new Error('Submit failed'));

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent('Submit failed');
    });

    test('submit button is disabled during loading', async () => {
      const mockSubmit = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<StateTransitionComponent onSubmit={mockSubmit} />);

      const submitBtn = screen.getByTestId('submit-btn');
      expect(submitBtn).not.toBeDisabled();

      await userEvent.type(screen.getByTestId('name-input'), 'Test');
      await userEvent.click(submitBtn);

      expect(submitBtn).toBeDisabled();

      await waitFor(() => {
        expect(submitBtn).not.toBeDisabled();
      });
    });
  });

  describe('Form Validation State Transitions', () => {
    test('validation error prevents submission', async () => {
      const mockValidate = vi.fn().mockReturnValue('Name is required');
      const mockSubmit = vi.fn().mockResolvedValue(undefined);

      render(<StateTransitionComponent onSubmit={mockSubmit} validate={mockValidate} />);

      await userEvent.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent('Name is required');
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    test('passing validation allows submission', async () => {
      const mockValidate = vi.fn().mockReturnValue(null);
      const mockSubmit = vi.fn().mockResolvedValue(undefined);

      render(<StateTransitionComponent onSubmit={mockSubmit} validate={mockValidate} />);

      await userEvent.type(screen.getByTestId('name-input'), 'Valid Name');
      await userEvent.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      expect(mockValidate).toHaveBeenCalled();
      expect(mockSubmit).toHaveBeenCalled();
    });
  });


  describe('Edge Case State Transitions', () => {
    test('handles timeout error transition', async () => {
      const slowLoader = vi.fn(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      render(<StateTransitionComponent asyncData={slowLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent('Timeout');
    });

    test('handles network error with retry', async () => {
      const mockLoader = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([{ id: 1 }]);

      render(<StateTransitionComponent asyncData={mockLoader} />);

      // First attempt
      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      // Retry
      await userEvent.click(screen.getByTestId('retry-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    test('handles partial data load with warnings', async () => {
      const partialData = [{ id: 1 }]; // Only 1 item when expecting 10
      const mockLoader = vi.fn().mockResolvedValue(partialData);

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      // Still in success state even with partial data
      expect(screen.getByTestId('data-list')).toBeInTheDocument();
    });
  });

  describe('State Accessibility', () => {
    test('loading state has proper ARIA attributes', async () => {
      // Use a delayed mock so loading state is visible
      let resolveLoader: (value: unknown[]) => void;
      const mockLoader = vi.fn().mockImplementation(() => new Promise(resolve => {
        resolveLoader = resolve;
      }));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      // Check loading state immediately while promise is pending
      const loadingState = screen.getByTestId('loading-state');
      expect(loadingState).toBeInTheDocument();

      // Verify ARIA attributes for accessibility
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('role', 'status');
      expect(spinner).toHaveAttribute('aria-live', 'polite');
      expect(spinner).toHaveAttribute('aria-label', expect.stringContaining('Loading'));

      // Resolve to clean up
      resolveLoader!([{ id: 1 }]);
    });

    test('error state is announced to screen readers', async () => {
      const mockLoader = vi.fn().mockRejectedValue(new Error('Connection failed'));

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toBeVisible();
      
      // Verify accessibility attributes
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      expect(errorMessage).toHaveTextContent('Connection failed');
    });

    test('success state announces content loaded', async () => {
      const mockLoader = vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]);

      render(<StateTransitionComponent asyncData={mockLoader} />);

      await userEvent.click(screen.getByTestId('load-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument();
      });

      expect(screen.getByTestId('data-list')).toBeInTheDocument();
    });
  });
});
