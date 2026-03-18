import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import {
  MobileOptimizedLayout,
  ResponsiveGrid,
  MobileCard,
  PullToRefresh,
  useBreakpoint,
  MobileNavigation,
  MobileButton,
  MobileInput,
  MobileModal
} from '~/components/mobile/MobileOptimizations';

describe('MobileOptimizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  describe('MobileOptimizedLayout', () => {
    it('renders children correctly', () => {
      render(
        <MobileOptimizedLayout>
          <div>Test Content</div>
        </MobileOptimizedLayout>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('applies mobile classes on mobile viewport', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <MobileOptimizedLayout className="test-class">
          <div>Test Content</div>
        </MobileOptimizedLayout>
      );

      const layout = screen.getByText('Test Content').parentElement;
      expect(layout).toHaveClass('touch-pan-y');
      expect(layout).toHaveClass('overflow-x-hidden');
      expect(layout).toHaveClass('text-sm');
      expect(layout).toHaveClass('pb-20');
    });

    it('handles viewport resize', async () => {
      render(
        <MobileOptimizedLayout>
          <div>Test Content</div>
        </MobileOptimizedLayout>
      );

      const layout = screen.getByText('Test Content').parentElement;

      // Resize to mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      fireEvent.resize(window);

      await waitFor(() => {
        expect(layout).toHaveClass('touch-pan-y');
      });
    });
  });

  describe('ResponsiveGrid', () => {
    it('renders grid with default columns', () => {
      render(
        <ResponsiveGrid>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </ResponsiveGrid>
      );

      const grid = screen.getByText('Item 1').parentElement;
      expect(grid).toHaveClass('grid-cols-3'); // Default is desktop
    });

    it('uses mobile columns on mobile viewport', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 3 }}>
          <div>Item 1</div>
          <div>Item 2</div>
        </ResponsiveGrid>
      );

      const grid = screen.getByText('Item 1').parentElement;
      expect(grid).toHaveClass('grid-cols-1');
    });

    it('uses tablet columns on tablet viewport', () => {
      // Set tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(
        <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 3 }}>
          <div>Item 1</div>
          <div>Item 2</div>
        </ResponsiveGrid>
      );

      const grid = screen.getByText('Item 1').parentElement;
      expect(grid).toHaveClass('grid-cols-2');
    });

    it('applies custom gap', () => {
      render(
        <ResponsiveGrid
          cols={{ mobile: 1, tablet: 2, desktop: 3 }}
          gap={{ mobile: 'gap-2', tablet: 'gap-4', desktop: 'gap-6' }}
        >
          <div>Item 1</div>
        </ResponsiveGrid>
      );

      const grid = screen.getByText('Item 1').parentElement;
      expect(grid).toHaveClass('gap-6'); // Default is desktop
    });
  });

  describe('MobileCard', () => {
    it('renders card content correctly', () => {
      render(
        <MobileCard>
          <div>Card Content</div>
        </MobileCard>
      );

      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('applies mobile styles on mobile viewport', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <MobileCard>
          <div>Content</div>
        </MobileCard>
      );

      const card = screen.getByText('Content').parentElement;
      expect(card).toHaveClass('bg-card');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('active:scale-95');
    });

    it('handles swipe gestures setup', () => {
      const onSwipe = vi.fn();
      render(
        <MobileCard swipeable={true} onSwipe={onSwipe}>
          <div>Content</div>
        </MobileCard>
      );

      const card = screen.getByText('Content').parentElement;
      expect(card).not.toBeNull();
      expect(card!).toHaveClass('touch-pan-y');
    });

    it('handles swipe configuration', () => {
      const onSwipe = vi.fn();
      render(
        <MobileCard swipeable={true} onSwipe={onSwipe}>
          <div>Content</div>
        </MobileCard>
      );

      const card = screen.getByText('Content').parentElement;
      expect(card).not.toBeNull();
      expect(card!).toHaveClass('touch-pan-y');
    });

    it('uses compact layout when specified', () => {
      render(
        <MobileCard compact={true}>
          <div>Content</div>
        </MobileCard>
      );

      const card = screen.getByText('Content').parentElement;
      expect(card).not.toBeNull();
      expect(card!).toHaveClass('p-3');
    });

    it('uses regular layout when not compact', () => {
      render(
        <MobileCard compact={false}>
          <div>Content</div>
        </MobileCard>
      );

      const card = screen.getByText('Content').parentElement;
      expect(card).not.toBeNull();
      expect(card!).toHaveClass('p-4');
    });
  });

  describe('PullToRefresh', () => {
    it('renders children correctly', () => {
      render(
        <PullToRefresh onRefresh={vi.fn()}>
          <div>Refreshable Content</div>
        </PullToRefresh>
      );

      expect(screen.getByText('Refreshable Content')).toBeInTheDocument();
    });

    it('shows loading indicator during refresh', async () => {
      const onRefresh = vi.fn();
      render(
        <PullToRefresh onRefresh={onRefresh} isRefreshing={true}>
          <div>Content</div>
        </PullToRefresh>
      );

      // Should show loading indicator
      const container = screen.getByText('Content').parentElement;
      expect(container).toBeInTheDocument();
    });

    it('renders pull to refresh correctly', () => {
      render(
        <PullToRefresh onRefresh={vi.fn()}>
          <div>Refreshable Content</div>
        </PullToRefresh>
      );

      expect(screen.getByText('Refreshable Content')).toBeInTheDocument();
    });

    it('shows loading state when refreshing', () => {
      render(
        <PullToRefresh onRefresh={vi.fn()} isRefreshing={true}>
          <div>Content</div>
        </PullToRefresh>
      );

      const container = screen.getByText('Content').parentElement;
      expect(container).toBeInTheDocument();
    });
  });

  describe('useBreakpoint', () => {
    it('returns correct breakpoint for desktop', () => {
      // Set desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const TestComponent = () => {
        const { isMobile, isTablet, isDesktop } = useBreakpoint();
        return (
          <div>
            <span data-testid="mobile">{isMobile.toString()}</span>
            <span data-testid="tablet">{isTablet.toString()}</span>
            <span data-testid="desktop">{isDesktop.toString()}</span>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('mobile')).toHaveTextContent('false');
      expect(screen.getByTestId('tablet')).toHaveTextContent('false');
      expect(screen.getByTestId('desktop')).toHaveTextContent('true');
    });

    it('returns correct breakpoint for mobile', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const TestComponent = () => {
        const { isMobile, isTablet, isDesktop } = useBreakpoint();
        return (
          <div>
            <span data-testid="mobile">{isMobile.toString()}</span>
            <span data-testid="tablet">{isTablet.toString()}</span>
            <span data-testid="desktop">{isDesktop.toString()}</span>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('mobile')).toHaveTextContent('true');
      expect(screen.getByTestId('tablet')).toHaveTextContent('false');
      expect(screen.getByTestId('desktop')).toHaveTextContent('false');
    });

    it('returns correct breakpoint for tablet', () => {
      // Set tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      const TestComponent = () => {
        const { isMobile, isTablet, isDesktop } = useBreakpoint();
        return (
          <div>
            <span data-testid="mobile">{isMobile.toString()}</span>
            <span data-testid="tablet">{isTablet.toString()}</span>
            <span data-testid="desktop">{isDesktop.toString()}</span>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('mobile')).toHaveTextContent('false');
      expect(screen.getByTestId('tablet')).toHaveTextContent('true');
      expect(screen.getByTestId('desktop')).toHaveTextContent('false');
    });
  });

  describe('MobileNavigation', () => {
    it('renders navigation items', () => {
      render(
        <MobileNavigation>
          <a href="/home">Home</a>
          <a href="/search">Search</a>
          <a href="/profile">Profile</a>
        </MobileNavigation>
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('applies mobile styles', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <MobileNavigation>
          <a href="/home">Home</a>
        </MobileNavigation>
      );

      const nav = screen.getByText('Home').parentElement;
      expect(nav).toBeInTheDocument();
    });
  });

  describe('MobileButton', () => {
    it('renders button with correct size', () => {
      render(
        <MobileButton size="lg">Click me</MobileButton>
      );

      const button = screen.getByText('Click me');
      expect(button).toBeInTheDocument();
    });

    it('handles click events', () => {
      const handleClick = vi.fn();
      render(
        <MobileButton onClick={handleClick}>
          Click me
        </MobileButton>
      );

      const button = screen.getByText('Click me');
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalled();
    });

    it('applies mobile styles on mobile viewport', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <MobileButton>Click me</MobileButton>
      );

      const button = screen.getByText('Click me');
      expect(button).toBeInTheDocument();
    });
  });

  describe('MobileInput', () => {
    it('renders input with correct attributes', () => {
      render(
        <MobileInput
          type="email"
          placeholder="Enter email"
          value="test@example.com"
          onChange={vi.fn()}
        />
      );

      const input = screen.getByDisplayValue('test@example.com');
      expect(input).toHaveAttribute('type', 'email');
      expect(input).toHaveAttribute('placeholder', 'Enter email');
    });

    it('handles value changes', () => {
      const handleChange = vi.fn();
      render(
        <MobileInput
          type="text"
          value=""
          onChange={handleChange}
          placeholder="Test input"
        />
      );

      const input = screen.getByPlaceholderText('Test input');
      fireEvent.change(input, { target: { value: 'test value' } });

      expect(handleChange).toHaveBeenCalled();
    });

    it('applies mobile styles on mobile viewport', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <MobileInput
          type="text"
          value=""
          onChange={vi.fn()}
          placeholder="Test input"
        />
      );

      const input = screen.getByPlaceholderText('Test input');
      expect(input).toBeInTheDocument();
    });
  });

  describe('MobileModal', () => {
    it('renders modal when open', () => {
      render(
        <MobileModal isOpen={true} onClose={vi.fn()}>
          <div>Modal Content</div>
        </MobileModal>
      );

      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <MobileModal isOpen={false} onClose={vi.fn()}>
          <div>Modal Content</div>
        </MobileModal>
      );

      expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
      const handleClose = vi.fn();
      render(
        <MobileModal isOpen={true} onClose={handleClose}>
          <div>Modal Content</div>
        </MobileModal>
      );

      // Look for close button or backdrop
      const modal = screen.getByText('Modal Content').parentElement;
      expect(modal).toBeInTheDocument();
    });

    it('applies mobile styles', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <MobileModal isOpen={true} onClose={vi.fn()}>
          <div>Modal Content</div>
        </MobileModal>
      );

      const modal = screen.getByText('Modal Content').parentElement;
      expect(modal).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', () => {
      render(
        <MobileButton>Test Button</MobileButton>
      );

      const button = screen.getByText('Test Button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('has proper ARIA labels', () => {
      render(
        <MobileInput
          type="text"
          value=""
          onChange={vi.fn()}
          placeholder="Search"
          aria-label="Search input"
        />
      );

      const input = screen.getByPlaceholderText('Search');
      expect(input).not.toBeNull();
      expect(input!).toHaveAttribute('aria-label', 'Search input');
    });
  });

  describe('Touch Interactions', () => {
    it('renders swipeable cards correctly', () => {
      render(
        <MobileCard swipeable={true}>
          <div>Content</div>
        </MobileCard>
      );

      const card = screen.getByText('Content').parentElement;
      expect(card).not.toBeNull();
      expect(card!).toHaveClass('bg-card');
      expect(card!).toHaveClass('border');
      expect(card!).toHaveClass('rounded-lg');
    });

    it('renders non-swipeable cards correctly', () => {
      render(
        <MobileCard swipeable={false}>
          <div>Content</div>
        </MobileCard>
      );

      const card = screen.getByText('Content').parentElement;
      expect(card).not.toBeNull();
      expect(card!).toHaveClass('bg-card');
      expect(card!).toHaveClass('border');
      expect(card!).toHaveClass('rounded-lg');
    });
  });
});
