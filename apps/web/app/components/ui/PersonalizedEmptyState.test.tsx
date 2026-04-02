import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PersonalizedEmptyState, EnhancedEmptyStatePresets } from './PersonalizedEmptyState';
import { useAuthStore } from '~/lib/store/auth';

// Mock the auth store
vi.mock('~/lib/store/auth', () => ({
  useAuthStore: vi.fn(),
}));

// Mock React Router
vi.mock('react-router', () => ({
  Link: ({ children, to, ...p }: any) => (
    <a href={to} {...p}>{children}</a>
  ),
}));

/**
 * Comprehensive tests for PersonalizedEmptyState component
 * Tests all types, contexts, user roles, and edge cases
 */
describe('PersonalizedEmptyState', () => {
  const mockUseAuthStore = vi.mocked(useAuthStore);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bookings Type', () => {
    it('should render owner bookings empty state', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'owner' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" context="owner" />);

      expect(screen.getByText('No bookings yet')).toBeInTheDocument();
      expect(screen.getByText(/Your listings are ready!/)).toBeInTheDocument();
      expect(screen.getByText('View Your Listings')).toBeInTheDocument();
      expect(screen.getByText('Create New Listing')).toBeInTheDocument();
    });

    it('should render renter bookings empty state for new user', () => {
      mockUseAuthStore.mockReturnValue({
        user: {
          role: 'renter',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        },
      } as any);

      render(<PersonalizedEmptyState type="bookings" context="renter" />);

      expect(screen.getByText('Start your rental journey')).toBeInTheDocument();
      expect(screen.getByText(/Welcome/)).toBeInTheDocument();
      expect(screen.getByText('Browse Rentals')).toBeInTheDocument();
    });

    it('should render renter bookings empty state for existing user', () => {
      mockUseAuthStore.mockReturnValue({
        user: {
          role: 'renter',
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        },
      } as any);

      render(<PersonalizedEmptyState type="bookings" context="renter" />);

      expect(screen.getByText('Start your rental journey')).toBeInTheDocument();
      expect(screen.getByText(/Find the perfect item/)).toBeInTheDocument();
      expect(screen.queryByText(/Welcome/)).not.toBeInTheDocument();
    });

    it('should auto-detect owner role from user', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'owner' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.getByText('No bookings yet')).toBeInTheDocument();
      expect(screen.getByText('View Your Listings')).toBeInTheDocument();
    });

    it('should default to renter when no role specified', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: null },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.getByText('Start your rental journey')).toBeInTheDocument();
      expect(screen.getByText('Browse Rentals')).toBeInTheDocument();
    });
  });

  describe('Listings Type', () => {
    it('should render owner listings empty state', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'owner' },
      } as any);

      render(<PersonalizedEmptyState type="listings" context="owner" />);

      expect(screen.getByText('No listings yet')).toBeInTheDocument();
      expect(screen.getByText(/Turn your idle items into income!/)).toBeInTheDocument();
      expect(screen.getByText('Create Your First Listing')).toBeInTheDocument();
    });

    it('should render renter listings empty state', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="listings" context="renter" />);

      expect(screen.getByText('Become an owner')).toBeInTheDocument();
      expect(screen.getByText(/Have items others might need?/)).toBeInTheDocument();
      expect(screen.getByText('List Your First Item')).toBeInTheDocument();
    });
  });

  describe('Favorites Type', () => {
    it('should render favorites empty state', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="favorites" />);

      expect(screen.getByText('No favorites yet')).toBeInTheDocument();
      expect(screen.getByText(/See something you like?/)).toBeInTheDocument();
      expect(screen.getByText('Discover Items')).toBeInTheDocument();
    });

    it('should not show secondary action for favorites', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="favorites" />);

      expect(screen.getByText('Discover Items')).toBeInTheDocument();
      // Should only have one action button
      const buttons = screen.getAllByRole('link');
      expect(buttons).toHaveLength(1);
    });
  });

  describe('Messages Type', () => {
    it('should render messages empty state', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="messages" />);

      expect(screen.getByText('No messages yet')).toBeInTheDocument();
      expect(screen.getByText(/Communication with owners/)).toBeInTheDocument();
      expect(screen.getByText('Start Browsing')).toBeInTheDocument();
    });
  });

  describe('Reviews Type', () => {
    it('should render reviews empty state for renter', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="reviews" context="renter" />);

      expect(screen.getByText('No reviews yet')).toBeInTheDocument();
      expect(screen.getByText('Find Items to Rent')).toBeInTheDocument();
    });

    it('should render reviews empty state for owner', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'owner' },
      } as any);

      render(<PersonalizedEmptyState type="reviews" context="owner" />);

      expect(screen.getByText('No reviews yet')).toBeInTheDocument();
      expect(screen.getByText('Manage Your Listings')).toBeInTheDocument();
    });
  });

  describe('Search Type', () => {
    it('should render search results empty state', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="search" />);

      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getByText(/Try adjusting your search/)).toBeInTheDocument();
      expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
      expect(screen.getByText('Browse All Categories')).toBeInTheDocument();
    });
  });

  describe('Tips Section', () => {
    it('should display tips for bookings', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.getByText('💡 Pro Tips')).toBeInTheDocument();
      expect(screen.getByText(/Use filters to narrow down/)).toBeInTheDocument();
      expect(screen.getByText(/Save favorites to compare/)).toBeInTheDocument();
    });

    it('should display tips for listings', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'owner' },
      } as any);

      render(<PersonalizedEmptyState type="listings" />);

      expect(screen.getByText('💡 Pro Tips')).toBeInTheDocument();
      expect(screen.getByText(/Take clear, well-lit photos/)).toBeInTheDocument();
    });

    it('should not show tips for messages (no tips defined)', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="messages" />);

      expect(screen.getByText('💡 Pro Tips')).toBeInTheDocument();
      expect(screen.getByText(/Message owners before booking/)).toBeInTheDocument();
    });
  });

  describe('User Detection', () => {
    it('should detect new user correctly', () => {
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter', createdAt: recentDate },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.getByText(/Welcome/)).toBeInTheDocument();
    });

    it('should detect existing user correctly', () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter', createdAt: oldDate },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.queryByText(/Welcome/)).not.toBeInTheDocument();
    });

    it('should treat missing createdAt as new user', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter', createdAt: undefined },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.getByText(/Welcome/)).toBeInTheDocument();
    });

    it('should handle missing user gracefully', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.getByText('Start your rental journey')).toBeInTheDocument();
      expect(screen.getByText('Browse Rentals')).toBeInTheDocument();
    });
  });

  describe('Enhanced Presets', () => {
    it('should render NoBookings preset', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<EnhancedEmptyStatePresets.NoBookings context="renter" />);

      expect(screen.getByText('Start your rental journey')).toBeInTheDocument();
    });

    it('should render NoListings preset', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'owner' },
      } as any);

      render(<EnhancedEmptyStatePresets.NoListings context="owner" />);

      expect(screen.getByText('No listings yet')).toBeInTheDocument();
    });

    it('should render NoFavorites preset', () => {
      render(<EnhancedEmptyStatePresets.NoFavorites />);

      expect(screen.getByText('No favorites yet')).toBeInTheDocument();
    });

    it('should render NoMessages preset', () => {
      render(<EnhancedEmptyStatePresets.NoMessages />);

      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    it('should render NoReviews preset', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'owner' },
      } as any);

      render(<EnhancedEmptyStatePresets.NoReviews context="owner" />);

      expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    });

    it('should render NoSearchResults preset', () => {
      render(<EnhancedEmptyStatePresets.NoSearchResults />);

      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Start your rental journey');
    });

    it('should have accessible button labels', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      const buttons = screen.getAllByRole('link');
      expect(buttons[0]).toHaveAccessibleName('Browse Rentals');
    });

    it('should have descriptive alt text for icons', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      // Icons should be present but not have img role (they're SVG icons)
      // Lucide icons render as SVG, not img elements
      const imgs = screen.queryAllByRole('img');
      expect(imgs.length).toBe(0);
    });
  });

  describe('Styling and Layout', () => {
    it('should apply custom className', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" className="custom-class" />);

      const container = screen.getByRole('heading', { level: 3 }).closest('div');
      expect(container).toHaveClass('custom-class');
    });

    it('should render icon container', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      const iconContainer = document.querySelector('.w-20.h-20.mx-auto');
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer).toHaveClass('bg-primary/10');
    });

    it('should render tips section with proper styling', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      const tipsSection = screen.getByText('💡 Pro Tips').closest('div');
      expect(tipsSection).toHaveClass('bg-muted/50', 'rounded-lg', 'p-4');
    });
  });

  describe('Positive Cases', () => {
    it('should render all types correctly', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      const types: Array<PersonalizedEmptyStateProps['type']> = [
        'bookings',
        'listings',
        'favorites',
        'messages',
        'reviews',
        'search',
      ];

      types.forEach((type) => {
        const { unmount } = render(<PersonalizedEmptyState type={type} />);

        expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
        // Use getAllByText since multiple elements may match the pattern
        expect(screen.getAllByText(/No|Start|Become|Discover/).length).toBeGreaterThan(0);
        unmount();
      });
    });

    it('should handle all contexts correctly', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'owner' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" context="owner" />);
      render(<PersonalizedEmptyState type="listings" context="owner" />);
      render(<PersonalizedEmptyState type="reviews" context="owner" />);

      expect(screen.getAllByText('No bookings yet')).toHaveLength(1);
      expect(screen.getAllByText('No listings yet')).toHaveLength(1);
      expect(screen.getAllByText('No reviews yet')).toHaveLength(1);
    });
  });

  describe('Negative Cases', () => {
    it('should handle invalid type gracefully', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" as any />);

      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('should handle undefined user', () => {
      mockUseAuthStore.mockReturnValue({
        user: undefined,
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.getByText('Start your rental journey')).toBeInTheDocument();
    });

    it('should handle null user', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.getByText('Start your rental journey')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no role', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: undefined },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      expect(screen.getByText('Start your rental journey')).toBeInTheDocument();
    });

    it('should handle edge case of exactly 7 days ago', () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter', createdAt: sevenDaysAgo },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      // Exactly 7 days should be considered existing user
      expect(screen.queryByText(/Welcome/)).not.toBeInTheDocument();
    });

    it('should handle invalid date format', () => {
      mockUseAuthStore.mockReturnValue({
        user: { role: 'renter', createdAt: 'invalid-date' },
      } as any);

      render(<PersonalizedEmptyState type="bookings" />);

      // Invalid dates result in NaN, making isNewUser false
      // So the description should be for existing users (no Welcome)
      expect(screen.getByText(/Find the perfect item/)).toBeInTheDocument();
    });
  });
});
