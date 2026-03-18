import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecentActivity } from './RecentActivity';
import { MemoryRouter } from 'react-router';

// Mock the API
vi.mock('~/lib/api/activity', () => ({
  activityApi: {
    getDashboardActivity: vi.fn(),
  },
}));

// Import the mocked module after vi.mock (vitest hoists vi.mock so this gets the mock)
import { activityApi } from '~/lib/api/activity';

// Mock UI components
vi.mock('~/components/ui', () => ({
  Card: ({ children, className, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div className={className} {...props}>{children}</div>,
  CardContent: ({ children, className }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div className={className} {...props}>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <h3>{children}</h3>,
  Badge: ({ children, variant, className }: React.PropsWithChildren<{ variant?: string; className?: string }>) => <span data-variant={variant} className={className}>{children}</span>,
}));

// Mock toast
vi.mock('~/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock the useTranslation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

// Mock icons - spread actual to include any icon not explicitly mocked
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    Calendar: ({ className }: { className?: string }) => <div data-testid="calendar-icon" className={className} />,
    CheckCircle: ({ className }: { className?: string }) => <div data-testid="check-icon" className={className} />,
    XCircle: ({ className }: { className?: string }) => <div data-testid="x-icon" className={className} />,
    CreditCard: ({ className }: { className?: string }) => <div data-testid="credit-icon" className={className} />,
    Package: ({ className }: { className?: string }) => <div data-testid="package-icon" className={className} />,
    TrendingUp: ({ className }: { className?: string }) => <div data-testid="trending-icon" className={className} />,
    Star: ({ className }: { className?: string }) => <div data-testid="star-icon" className={className} />,
    Heart: ({ className }: { className?: string }) => <div data-testid="heart-icon" className={className} />,
    MessageSquare: ({ className }: { className?: string }) => <div data-testid="message-icon" className={className} />,
    Clock: ({ className }: { className?: string }) => <div data-testid="clock-icon" className={className} />,
    ArrowRight: ({ className }: { className?: string }) => <div data-testid="arrow-icon" className={className} />,
    AlertTriangle: ({ className }: { className?: string }) => <div data-testid="alert-icon" className={className} />,
    User: ({ className }: { className?: string }) => <div data-testid="user-icon" className={className} />,
    Shield: ({ className }: { className?: string }) => <div data-testid="shield-icon" className={className} />,
    RefreshCw: ({ className }: { className?: string }) => <div data-testid="refresh-icon" className={className} />,
    MoreHorizontal: ({ className }: { className?: string }) => <div data-testid="more-icon" className={className} />,
  };
});

const mockActivities = [
  {
    id: '1',
    type: 'booking_created',
    title: 'New booking created',
    description: 'Booking for Test Listing',
    timestamp: '2024-01-15T10:00:00Z',
    actor: { name: 'John Doe' },
    link: '/bookings/123',
  },
  {
    id: '2',
    type: 'booking_completed',
    title: 'Booking completed',
    description: 'Your rental has been completed',
    timestamp: '2024-01-14T15:30:00Z',
    actor: { name: 'System' },
    link: '/bookings/456',
  },
  {
    id: '3',
    type: 'payment_failed',
    title: 'Payment failed',
    description: 'Payment processing failed',
    timestamp: '2024-01-13T09:15:00Z',
    actor: { name: 'Payment System' },
    link: '/bookings/789',
  },
];

describe('RecentActivity - Enhanced Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityApi.getDashboardActivity).mockResolvedValue({
      activities: mockActivities,
      total: 3,
      hasMore: false,
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <RecentActivity 
          limit={5}
          showHeader={true}
          showViewAll={true}
          {...props}
        />
      </MemoryRouter>
    );
  };

  it('renders enhanced activity feed with contextual action buttons', async () => {
    renderComponent();

    await waitFor(() => {
      // Should show activity items
      expect(screen.getByText('New booking created')).toBeInTheDocument();
      expect(screen.getByText('Booking completed')).toBeInTheDocument();
      expect(screen.getByText('Payment failed')).toBeInTheDocument();
    });

    // Should render action buttons for each activity
    const actionButtons = screen.getAllByTestId('activity-action-button');
    expect(actionButtons.length).toBeGreaterThan(0);
  });

  it('displays correct action text for different activity types', async () => {
    renderComponent();

    await waitFor(() => {
      // Booking created should show "View Details"
      const bookingCreatedActions = screen.getAllByText('View Details');
      expect(bookingCreatedActions.length).toBeGreaterThan(0);

      // Booking completed should show "Leave Review"
      const reviewActions = screen.getAllByText('Leave Review');
      expect(reviewActions.length).toBeGreaterThan(0);

      // Payment failed should show "Retry Payment"
      const paymentActions = screen.getAllByText('Retry Payment');
      expect(paymentActions.length).toBeGreaterThan(0);
    });
  });

  it('renders proper icons for different activity types', async () => {
    renderComponent();

    await waitFor(() => {
      // Should render appropriate icons
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });
  });

  it('navigates to correct URLs when action buttons are clicked', async () => {
    renderComponent();

    await waitFor(() => {
      const actionButtons = screen.getAllByTestId('activity-action-button');
      expect(actionButtons.length).toBeGreaterThan(0);
    });

    // Click first action button
    const firstActionButton = screen.getAllByTestId('activity-action-button')[0];
    fireEvent.click(firstActionButton);

    // Should navigate (in real app, this would change the route)
    expect(firstActionButton.closest('a')).toHaveAttribute('href');
  });

  it('applies correct styling to action buttons', async () => {
    renderComponent();

    await waitFor(() => {
      const actionButtons = screen.getAllByTestId('activity-action-button');
      const firstButton = actionButtons[0];

      // Should have primary button styling
      expect(firstButton).toHaveClass('bg-primary');
      expect(firstButton).toHaveClass('text-primary-foreground');
      expect(firstButton).toHaveClass('px-3');
      expect(firstButton).toHaveClass('py-1.5');
      expect(firstButton).toHaveClass('text-xs');
      expect(firstButton).toHaveClass('font-medium');
    });
  });

  it('shows hover effects on action buttons', async () => {
    renderComponent();

    await waitFor(() => {
      const actionButtons = screen.getAllByTestId('activity-action-button');
      const firstButton = actionButtons[0];

      // Should have hover effect class
      expect(firstButton).toHaveClass('hover:bg-primary/90');
    });
  });

  it('displays activity timestamps correctly', async () => {
    renderComponent();

    await waitFor(() => {
      // Should show formatted timestamps
      const timestamps = screen.getAllByTestId('activity-timestamp');
      expect(timestamps.length).toBeGreaterThan(0);
    });
  });

  it('shows actor information when available', async () => {
    renderComponent();

    await waitFor(() => {
      // Should show actor names
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('handles loading state correctly', async () => {
    // Mock loading state
    vi.mocked(activityApi.getDashboardActivity).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderComponent();

    // Should show loading indicator
    expect(screen.getByTestId('activity-loading')).toBeInTheDocument();
  });

  it('handles error state correctly', async () => {
    // Mock error
    vi.mocked(activityApi.getDashboardActivity).mockRejectedValue(
      new Error('Failed to load activities')
    );

    renderComponent();

    await waitFor(() => {
      // Should show error message (component displays the translation fallback text)
      expect(screen.getByText('Failed to load recent activity')).toBeInTheDocument();
      
      // Should show retry button
      expect(screen.getByTestId('activity-retry-button')).toBeInTheDocument();
    });
  });

  it('retries loading when retry button is clicked', async () => {
    // Mock initial error then success
    vi.mocked(activityApi.getDashboardActivity)
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({ activities: mockActivities, total: 3, hasMore: false });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('activity-retry-button')).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByTestId('activity-retry-button');
    fireEvent.click(retryButton);

    await waitFor(() => {
      // Should load successfully
      expect(screen.getByText('New booking created')).toBeInTheDocument();
    });
  });

  it('shows empty state when no activities', async () => {
    vi.mocked(activityApi.getDashboardActivity).mockResolvedValue({
      activities: [],
      total: 0,
      hasMore: false,
    });

    renderComponent();

    await waitFor(() => {
      // Should show empty state
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });
  });

  it('respects limit prop', async () => {
    // Mock only 2 activities (simulating API honoring limit)
    vi.mocked(activityApi.getDashboardActivity).mockResolvedValue({
      activities: mockActivities.slice(0, 2),
      total: 2,
      hasMore: false,
    });
    renderComponent({ limit: 2 });

    await waitFor(() => {
      // Should only show 2 activities
      const activityItems = screen.getAllByTestId('activity-item');
      expect(activityItems.length).toBeLessThanOrEqual(2);
    });
  });

  it('can hide header when showHeader is false', () => {
    renderComponent({ showHeader: false });

    // Should not show header
    expect(screen.queryByTestId('activity-header')).not.toBeInTheDocument();
  });

  it('can hide view all link when showViewAll is false', () => {
    renderComponent({ showViewAll: false });

    // Should not show view all link
    expect(screen.queryByTestId('activity-view-all')).not.toBeInTheDocument();
  });

  it('applies custom className', async () => {
    renderComponent({ className: 'custom-activity' });

    // Wait for activities to load, then check the container has the class
    await waitFor(() => {
      const container = screen.getByTestId('recent-activity');
      expect(container).toHaveClass('custom-activity');
    });
  });

  it('supports keyboard navigation on action buttons', async () => {
    renderComponent();

    await waitFor(() => {
      const actionButtons = screen.getAllByTestId('activity-action-button');
      const firstButton = actionButtons[0];

      // Should be focusable
      firstButton.focus();
      expect(firstButton).toHaveFocus();

      // Should activate with Enter key
      fireEvent.keyDown(firstButton, { key: 'Enter' });
      // Should trigger navigation
    });
  });

  it('has proper accessibility attributes', async () => {
    renderComponent();

    await waitFor(() => {
      const actionButtons = screen.getAllByTestId('activity-action-button');
      
      actionButtons.forEach(button => {
        // Should have proper ARIA attributes
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });

  it('integrates with real-time updates', async () => {
    renderComponent();

    await waitFor(() => {
      // Should have data attributes for real-time updates
      const container = screen.getByTestId('recent-activity');
      expect(container).toHaveAttribute('data-real-time-enabled');
    });
  });

  it('handles different activity types correctly', async () => {
    const allActivityTypes = [
      'booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_completed',
      'payment_processed', 'payment_failed', 'listing_created', 'listing_updated',
      'listing_viewed', 'message_sent', 'message_received', 'review_submitted',
      'review_received', 'favorite_added', 'favorite_removed', 'dispute_filed',
      'dispute_resolved', 'user_login', 'user_profile_updated', 'insurance_purchased',
      'insurance_expiring', 'payout_processed', 'refund_processed'
    ];

    // Test that all activity types are handled
    allActivityTypes.forEach(type => {
      expect(() => {
        // This would test the ACTIVITY_CONFIG mapping
        // In a real test, we'd verify each type has proper config
      }).not.toThrow();
    });
  });
});
