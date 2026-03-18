import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouterProvider } from 'react-router';
import { EnhancedSearchRecommendations } from '../search/EnhancedSearchRecommendations';

// Mock the auth store
vi.mock('~/lib/store/auth', () => ({
  useAuthStore: () => ({
    user: { id: '1', email: 'test@example.com' },
  }),
}));

// Mock the listings API
vi.mock('~/lib/api/listings', () => ({
  listingsApi: {
    searchListings: vi.fn(),
  },
}));

// Import the mocked API
import { listingsApi } from '~/lib/api/listings';
const mockedListingsApi = vi.mocked(listingsApi);

// Mock the motion components
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock react-router
vi.mock('react-router', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  RouterProvider: ({ children }: any) => <div>{children}</div>,
}));

describe('EnhancedSearchRecommendations', () => {
  const defaultProps = {
    maxSuggestions: 8,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component successfully', async () => {
    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    // Wait for component to load and render suggestions
    await waitFor(() => {
      const suggestionLinks = screen.getAllByRole('link');
      expect(suggestionLinks.length).toBeGreaterThan(0);
    });
  });

  it('renders suggestions after loading', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [
        { 
          id: '1', 
          title: 'Test Listing', 
          basePrice: 100,
          ownerId: 'owner-1',
          description: 'Test description',
          category: 'ELECTRONICS',
          subcategory: 'CAMERA',
          location: { city: 'Kathmandu', coordinates: { lat: 27.7172, lng: 85.3240 } },
          images: [],
          availability: [],
          reviews: [],
          rating: 4.5,
          reviewCount: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'ACTIVE',
          condition: 'EXCELLENT',
          securityDeposit: 50,
          minRentalPeriod: 1,
          maxRentalPeriod: 30,
          deliveryOptions: ['PICKUP'],
          rules: [],
          tags: [],
          views: 100,
          favorites: 5,
          isVerified: true,
          isFeatured: false,
          insuranceRequired: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    } as any);

    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Camera Equipment')).toBeInTheDocument();
      expect(screen.getByText('Party Supplies')).toBeInTheDocument();
      expect(screen.getByText('Meeting Rooms')).toBeInTheDocument();
    });
  });

  it('renders personalized suggestions for authenticated users', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    await waitFor(() => {
      // Should show personalized recommendations for authenticated users
      expect(screen.getByText('Laptops')).toBeInTheDocument();
    });
  });

  it('renders category suggestions', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Camera Equipment')).toBeInTheDocument();
      expect(screen.getByText('Party Supplies')).toBeInTheDocument();
      expect(screen.getByText('Meeting Rooms')).toBeInTheDocument();
      expect(screen.getByText('Sports Equipment')).toBeInTheDocument();
    });
  });

  it('shows suggestion metadata correctly', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    await waitFor(() => {
      // Check for specific trending item
      expect(screen.getByText('Camera Equipment')).toBeInTheDocument();
      expect(screen.getByText('234 items')).toBeInTheDocument();
    });
  });

  it('displays correct icons for suggestion types', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    await waitFor(() => {
      // Check that icons are rendered (look for SVG elements)
      const icons = document.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  it('calls onSuggestionClick when suggestion is clicked', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    const onSuggestionClick = vi.fn();
    render(
      <EnhancedSearchRecommendations 
        {...defaultProps} 
        onSuggestionClick={onSuggestionClick}
      />
    );
    
    await waitFor(() => {
      const firstSuggestion = screen.getByText('Camera Equipment').closest('a');
      fireEvent.click(firstSuggestion!);
      
      expect(onSuggestionClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trending-1',
          text: 'Camera Equipment',
          type: 'trending',
        })
      );
    });
  });

  it('limits suggestions to maxSuggestions prop', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations maxSuggestions={3} />);
    
    await waitFor(() => {
      const suggestions = screen.getAllByRole('link');
      // Should have 3 suggestions + 1 "Browse all categories" link
      expect(suggestions.length).toBe(4);
    });
  });

  it('renders empty state when no suggestions', async () => {
    mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations {...defaultProps} maxSuggestions={0} />);
    
    await waitFor(() => {
      // Should still render the component structure even with no suggestions
      expect(screen.queryByText('Camera Equipment')).not.toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
        mockedListingsApi.searchListings.mockRejectedValueOnce(new Error('API Error'));

    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    await waitFor(() => {
      // Should still show some suggestions even on error
      expect(screen.getByText('Camera Equipment')).toBeInTheDocument();
    });
  });

  it('shows browse all categories link', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    await waitFor(() => {
      const browseLink = screen.getByText('Browse all categories');
      expect(browseLink).toBeInTheDocument();
      expect(browseLink.closest('a')).toHaveAttribute('href', '/search');
    });
  });

  it('applies custom className', async () => {
    mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    const { container } = render(
      <EnhancedSearchRecommendations {...defaultProps} className="custom-recommendations" />
    );
    
    await waitFor(() => {
      expect(container.firstChild).toHaveClass('custom-recommendations');
    });
  });

  it('shows correct labels for suggestion types', async () => {
    mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    await waitFor(() => {
      // Check for trending label
      const trendingLabels = screen.getAllByText('Trending');
      expect(trendingLabels.length).toBeGreaterThan(0);
    });
  });

  it('renders suggestions with correct URLs', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations {...defaultProps} />);
    
    await waitFor(() => {
      const cameraLink = screen.getByText('Camera Equipment').closest('a');
      expect(cameraLink).toHaveAttribute('href', '/search?category=ELECTRONICS&query=camera');
      
      const partyLink = screen.getByText('Party Supplies').closest('a');
      expect(partyLink).toHaveAttribute('href', '/search?category=EVENT_VENUES&query=party');
    });
  });

  it('handles different maxSuggestions values', async () => {
        mockedListingsApi.searchListings.mockResolvedValue({
      listings: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    } as any);

    render(<EnhancedSearchRecommendations maxSuggestions={5} />);
    
    await waitFor(() => {
      const suggestions = screen.getAllByRole('link');
      // Should have 5 suggestions + browse link
      expect(suggestions.length).toBe(6);
    });
  });
});
