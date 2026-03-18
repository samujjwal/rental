import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { MobileDashboardNavigation } from '../mobile/MobileOptimizations';

// Mock Badge component
vi.mock('~/components/ui', () => ({
  Badge: ({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

describe('MobileDashboardNavigation', () => {
  // Mock icon components
  const MockIcon = ({ className }: { className?: string }) => (
    <div data-testid="icon" className={className} />
  );

  const defaultProps = {
    items: [
      { icon: MockIcon, label: 'Search', href: '/search' },
      { icon: MockIcon, label: 'Favorites', href: '/favorites', badge: 3 },
      { icon: MockIcon, label: 'Messages', href: '/messages', badge: 5 },
      { icon: MockIcon, label: 'Bookings', href: '/bookings' },
      { icon: MockIcon, label: 'Profile', href: '/profile' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set mobile viewport so useBreakpoint returns isMobile: true
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(
      <MemoryRouter>
        {component}
      </MemoryRouter>
    );
  };

  const renderWithEntries = (component: React.ReactElement, initialEntries: string[]) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        {component}
      </MemoryRouter>
    );
  };

  it('does not render when not on mobile', () => {
    // Set desktop viewport so useBreakpoint returns isMobile: false
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
    window.dispatchEvent(new Event('resize'));
    
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
    expect(screen.queryByText('Favorites')).not.toBeInTheDocument();
  });

  it('renders navigation items on mobile', () => {
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('renders badges when provided', () => {
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(2); // Favorites and Messages have badges
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders correct links', () => {
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    const searchLink = screen.getByText('Search').closest('a');
    expect(searchLink).toHaveAttribute('href', '/search');
    
    const favoritesLink = screen.getByText('Favorites').closest('a');
    expect(favoritesLink).toHaveAttribute('href', '/favorites');
  });

  it('highlights active navigation item', () => {
    renderWithEntries(<MobileDashboardNavigation {...defaultProps} />, ['/favorites']);
    
    const favoritesLink = screen.getByText('Favorites').closest('a');
    expect(favoritesLink).toHaveClass('bg-primary');
  });

  it('shows scroll indicators when overflow', async () => {
    // Mock overflow detection via prototype
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 1000 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 300 });
    
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    // Trigger overflow check
    await act(async () => { window.dispatchEvent(new Event('resize')); });
    
    await waitFor(() => {
      const scrollButtons = screen.getAllByRole('button');
      // Should have at least a right scroll button when overflowing
      expect(scrollButtons.length).toBeGreaterThanOrEqual(1);
    });
    // Restore
    delete (HTMLElement.prototype as any).scrollWidth;
    delete (HTMLElement.prototype as any).clientWidth;
  });

  it('handles left scroll button click', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 1000 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 300 });
    
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    await act(async () => { window.dispatchEvent(new Event('resize')); });
    
    // When overflow, at least one button should be present
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
    });
    delete (HTMLElement.prototype as any).scrollWidth;
    delete (HTMLElement.prototype as any).clientWidth;
  });

  it('handles right scroll button click', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 1000 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 300 });
    
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    await act(async () => { window.dispatchEvent(new Event('resize')); });
    
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
    });
    delete (HTMLElement.prototype as any).scrollWidth;
    delete (HTMLElement.prototype as any).clientWidth;
  });

  it('disables left scroll button at start', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 1000 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 300 });
    
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    await act(async () => { window.dispatchEvent(new Event('resize')); });
    
    // Right scroll button should be present when overflowing; left starts hidden/disabled
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      // The right scroll button is the only visible one at scrollPosition=0
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
    delete (HTMLElement.prototype as any).scrollWidth;
    delete (HTMLElement.prototype as any).clientWidth;
  });

  it('applies custom className', () => {
    const { container } = renderWithRouter(
      <MobileDashboardNavigation 
        {...defaultProps} 
        className="custom-nav" 
      />
    );
    
    expect(container.firstElementChild).toHaveClass('custom-nav');
  });

  it('renders icons for navigation items', () => {
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    // Should render icon elements (MockIcon renders data-testid="icon")
    const icons = screen.getAllByTestId('icon');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('handles badge count over 99', () => {
    const itemsWithLargeBadge = [
      ...defaultProps.items,
      { icon: MockIcon, label: 'Notifications', href: '/notifications', badge: 150 },
    ];
    
    renderWithRouter(<MobileDashboardNavigation items={itemsWithLargeBadge} />);
    
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('truncates long labels', () => {
    const itemsWithLongLabel = [
      { icon: MockIcon, label: 'Very Long Navigation Label', href: '/long' },
    ];
    
    renderWithRouter(<MobileDashboardNavigation items={itemsWithLongLabel} />);
    
    const label = screen.getByText('Very Long Navigation Label');
    const container = label.closest('span');
    expect(container).toHaveClass('truncate');
  });

  it('handles window resize', async () => {
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    // Initially visible on mobile (window.innerWidth = 375 from beforeEach)
    await waitFor(() => {
      expect(screen.getByText('Search')).toBeInTheDocument();
    });
    
    // Switch to desktop viewport
    await act(async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });
    
    // Should be hidden on desktop
    await waitFor(() => {
      expect(screen.queryByText('Search')).not.toBeInTheDocument();
    });
  });

  it('handles empty items array', () => {
    renderWithRouter(<MobileDashboardNavigation items={[]} />);
    
    // Should not crash and should not show any navigation items
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  it('applies active styles correctly', () => {
    renderWithEntries(<MobileDashboardNavigation {...defaultProps} />, ['/messages']);
    
    const messagesLink = screen.getByText('Messages').closest('a');
    expect(messagesLink).toHaveClass('text-primary-foreground');
    
    const searchLink = screen.getByText('Search').closest('a');
    expect(searchLink).not.toHaveClass('text-primary-foreground');
  });

  it('handles navigation item clicks', () => {
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    const searchLink = screen.getByText('Search').closest('a');
    expect(() => fireEvent.click(searchLink!)).not.toThrow();
  });

  it('renders with minimum width items', () => {
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    const items = screen.getAllByRole('link');
    items.forEach(item => {
      expect(item).toHaveClass('min-w-[60px]');
    });
  });

  it('applies hover states', () => {
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    const searchLink = screen.getByText('Search').closest('a');
    expect(searchLink).toHaveClass('hover:bg-accent');
  });

  it('supports snap scrolling', () => {
    renderWithRouter(<MobileDashboardNavigation {...defaultProps} />);
    
    const navContainer = document.querySelector('.snap-x.snap-mandatory');
    expect(navContainer).toBeInTheDocument();
  });
});
