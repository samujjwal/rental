import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import RenterDashboardRoute from '../routes/dashboard.renter';

// Hoist the useLoaderData mock so it can be used in vi.mock factory
const _mockUseLoaderData = vi.hoisted(() => vi.fn());

// Mock react-router with useLoaderData intercepted
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...(actual as object),
    useLoaderData: () => _mockUseLoaderData(),
  };
});

// Mock all the dependencies
vi.mock('~/lib/store/auth', () => ({
  useAuthStore: () => ({
    user: { id: '1', firstName: 'John', email: 'test@example.com' },
  }),
}));

vi.mock('~/hooks/useDashboardPreferences', () => ({
  useDashboardPreferences: (_storageKey: string, sections: any[]) => ({
    orderedSections: sections,
    pinnedIds: new Set(),
    hiddenIds: new Set(),
    togglePinned: vi.fn(),
    toggleHidden: vi.fn(),
    resetPreferences: vi.fn(),
  }),
}));

vi.mock('~/components/dashboard/RecentActivity', () => ({
  RecentActivity: ({ className }: { className?: string }) => (
    <div data-testid="recent-activity" className={className}>Recent Activity</div>
  ),
}));

vi.mock('~/components/dashboard/DashboardCustomizer', () => ({
  DashboardCustomizer: ({ onReset }: { onReset: () => void }) => (
    <button data-testid="dashboard-customizer" onClick={onReset}>
      Customize
    </button>
  ),
}));

vi.mock('~/components/mobile', () => ({
  MobileDashboardNavigation: ({ items, className }: { items: any[]; className?: string }) => (
    <div data-testid="mobile-nav" className={className}>
      Mobile Nav ({items.length} items)
    </div>
  ),
}));

vi.mock('~/components/ui', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>{children}</h2>
  ),
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  ProgressiveDisclosure: ({ title, children, defaultExpanded }: { 
    title: string; 
    children: React.ReactNode; 
    defaultExpanded?: boolean 
  }) => (
    <div data-testid="progressive-disclosure" data-expanded={defaultExpanded}>
      <h3>{title}</h3>
      {defaultExpanded && children}
    </div>
  ),
  FirstTimeHelp: ({ title, description, action, onDismiss }: {
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
    onDismiss?: () => void;
  }) => (
    <div data-testid="first-time-help">
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <button onClick={action.onClick}>{action.label}</button>}
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

vi.mock('~/components/layout', () => ({
  PortalPageLayout: ({ children, title, sidebarSections, banner, contentClassName, actions }: any) => (
    <div data-testid="portal-layout">
      <h1 data-testid="page-title">{title}</h1>
      <div data-testid="sidebar-sections">{sidebarSections?.length || 0} sections</div>
      {banner && <div data-testid="banner">{banner}</div>}
      <div data-testid="content" className={contentClassName}>
        {actions}
        {children}
      </div>
    </div>
  ),
}));

// Mock the loader data
const mockLoaderData = {
  stats: {
    totalBookings: 5,
    upcomingBookings: 2,
    completedBookings: 3,
    totalSpent: 1500,
    averageRating: 4.5,
  },
  recentBookings: [
    {
      id: '1',
      status: 'CONFIRMED',
      startDate: '2024-01-15',
      endDate: '2024-01-17',
      totalAmount: 300,
      listing: {
        id: '1',
        title: 'Test Listing',
        basePrice: 100,
        location: { city: 'Test City' },
        images: ['test.jpg'],
      },
    },
  ],
  favorites: [
    {
      id: '1',
      title: 'Favorite Listing',
      basePrice: 150,
      location: { city: 'Favorite City' },
      images: ['fav.jpg'],
    },
  ],
  recommendations: [
    {
      id: '1',
      title: 'Recommended Listing',
      basePrice: 200,
      location: { city: 'Recommended City' },
      images: ['rec.jpg'],
    },
  ],
  unreadNotifications: 3,
  unreadMessages: 5,
  urgentPaymentBookingId: null,
  error: null,
  failedSections: [],
};

describe('Dashboard Personalization Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockUseLoaderData.mockReturnValue(mockLoaderData);
  });

  const renderDashboard = (loaderData = mockLoaderData) => {
    _mockUseLoaderData.mockReturnValue(loaderData);
    return render(
      <MemoryRouter>
        <RenterDashboardRoute />
      </MemoryRouter>
    );
  };

  it('renders personalized dashboard for new user', async () => {
    const newUserData = {
      ...mockLoaderData,
      recentBookings: [], // No bookings for new user
    };

    renderDashboard(newUserData);

    await waitFor(() => {
      // Should show first-time help for new users
      expect(screen.getByTestId('first-time-help')).toBeInTheDocument();
      expect(screen.getByText('Welcome to Your Dashboard!')).toBeInTheDocument();
      
      // Should show personalized recommendations for new users
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });
  });

  it('renders personalized dashboard for experienced user', async () => {
    const experiencedUserData = {
      ...mockLoaderData,
      recentBookings: [
        ...mockLoaderData.recentBookings,
        // Add more bookings to make user experienced
        { id: '2', status: 'COMPLETED' },
        { id: '3', status: 'COMPLETED' },
        { id: '4', status: 'COMPLETED' },
        { id: '5', status: 'COMPLETED' },
        { id: '6', status: 'COMPLETED' },
      ],
    };

    renderDashboard(experiencedUserData);

    await waitFor(() => {
      // Should not show first-time help for experienced users
      expect(screen.queryByTestId('first-time-help')).not.toBeInTheDocument();
      
      // Should show appropriate recommendations for experienced users
      expect(screen.getByText('Expand Your Horizons')).toBeInTheDocument();
    });
  });

  it('renders mobile navigation on mobile', async () => {
    renderDashboard();

    await waitFor(() => {
      // Should render mobile navigation
      expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav')).toHaveTextContent('Mobile Nav (5 items)');
    });
  });

  it('shows urgent payment alert when needed', async () => {
    const paymentUrgentData = {
      ...mockLoaderData,
      urgentPaymentBookingId: 'payment-123',
    };

    renderDashboard(paymentUrgentData);

    await waitFor(() => {
      // Should show urgent payment alert
      expect(screen.getByText('Payment Required')).toBeInTheDocument();
      expect(screen.getByText('Complete Payment')).toBeInTheDocument();
    });
  });

  it('displays user activity level correctly', async () => {
    renderDashboard();

    await waitFor(() => {
      // Should show appropriate content based on user activity
      expect(screen.getByTestId('progressive-disclosure')).toBeInTheDocument();
      
      // Should show recent activity component
      expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
    });
  });

  it('handles dashboard customization', async () => {
    renderDashboard();

    await waitFor(() => {
      // Should render dashboard customizer
      expect(screen.getByTestId('dashboard-customizer')).toBeInTheDocument();
    });

    // Test customization interactions
    const customizeButton = screen.getByTestId('dashboard-customizer');
    fireEvent.click(customizeButton);
    
    // Should not throw errors
    expect(customizeButton).toBeInTheDocument();
  });

  it('integrates progressive disclosure correctly', async () => {
    renderDashboard();

    await waitFor(() => {
      // Should render progressive disclosure components
      const progressiveDisclosures = screen.getAllByTestId('progressive-disclosure');
      expect(progressiveDisclosures.length).toBeGreaterThan(0);
      
      // Recommendations disclosure is currently rendered collapsed by default
      const recommendationsDisclosure = progressiveDisclosures.find(
        el => el.textContent?.includes('Recommended for You')
      );
      expect(recommendationsDisclosure).toHaveAttribute('data-expanded', 'false');
    });
  });

  it('handles error states gracefully', async () => {
    const errorData = {
      ...mockLoaderData,
      error: 'Failed to load dashboard data',
      failedSections: ['recentBookings', 'favorites'],
    };

    renderDashboard(errorData);

    await waitFor(() => {
      // Error takes precedence over the partial-failure banner
      expect(screen.getByTestId('banner')).toBeInTheDocument();
      expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
      expect(screen.queryByText('Some sections failed to load: recentBookings, favorites')).not.toBeInTheDocument();
    });
  });

  it('displays correct navigation badges', async () => {
    renderDashboard();

    await waitFor(() => {
      // The mocked layout surfaces the number of sidebar groups, not leaf nav items
      expect(screen.getByTestId('sidebar-sections')).toHaveTextContent('2 sections');
    });
  });

  it('handles empty states correctly', async () => {
    const emptyData = {
      ...mockLoaderData,
      recentBookings: [],
      favorites: [],
      recommendations: [],
    };

    renderDashboard(emptyData);

    await waitFor(() => {
      // Should still render dashboard without crashing
      expect(screen.getByTestId('portal-layout')).toBeInTheDocument();
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  it('integrates all new components seamlessly', async () => {
    renderDashboard();

    await waitFor(() => {
      // Should render all new components
      expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
      expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-customizer')).toBeInTheDocument();
      
      // Should render personalized content
      expect(screen.getByTestId('progressive-disclosure')).toBeInTheDocument();
      
      // Should maintain existing functionality
      expect(screen.getByTestId('portal-layout')).toBeInTheDocument();
      expect(screen.getByTestId('page-title')).toHaveTextContent('Renter Portal');
    });
  });

  it('handles user activity level transitions', async () => {
    // Start with new user
    const { rerender } = renderDashboard({
      ...mockLoaderData,
      recentBookings: [],
    });

    await waitFor(() => {
      expect(screen.getByTestId('first-time-help')).toBeInTheDocument();
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    // Simulate user becoming active
    _mockUseLoaderData.mockReturnValue({
      ...mockLoaderData,
      recentBookings: [
        { id: '1', status: 'COMPLETED' },
        { id: '2', status: 'COMPLETED' },
      ],
    });
    rerender(
      <MemoryRouter>
        <RenterDashboardRoute />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Should update recommendations based on new activity level
      expect(screen.getByText('Continue Your Journey')).toBeInTheDocument();
    });
  });
});
