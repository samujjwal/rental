import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { EmptyState, EmptyStatePresets } from './empty-state';

// Mock UnifiedButton to simplify testing
vi.mock('./unified-button', () => ({
  UnifiedButton: ({ children, onClick, variant, ...props }: any) => (
    <button data-variant={variant} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

const withRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('EmptyState', () => {
  it('renders title', () => {
    withRouter(<EmptyState title="No items" />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    withRouter(<EmptyState title="Empty" description="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    withRouter(<EmptyState title="Empty" />);
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    withRouter(<EmptyState title="Empty" icon="📭" />);
    expect(screen.getByText('📭')).toBeInTheDocument();
  });

  it('renders action button with onClick', () => {
    const onClick = vi.fn();
    withRouter(
      <EmptyState title="Empty" action={{ label: 'Add Item', onClick }} />,
    );
    fireEvent.click(screen.getByText('Add Item'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders action as Link when href is provided', () => {
    withRouter(
      <EmptyState title="Empty" action={{ label: 'Browse', href: '/search' }} />,
    );
    const link = screen.getByText('Browse').closest('a');
    expect(link).toHaveAttribute('href', '/search');
  });

  it('renders secondary action', () => {
    const onClick = vi.fn();
    withRouter(
      <EmptyState
        title="Empty"
        action={{ label: 'Primary', onClick: vi.fn() }}
        secondaryAction={{ label: 'Secondary', onClick }}
      />,
    );
    fireEvent.click(screen.getByText('Secondary'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = withRouter(
      <EmptyState title="Empty" className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('EmptyStatePresets', () => {
  it('NoBookings renders with browse link', () => {
    withRouter(<EmptyStatePresets.NoBookings />);
    expect(screen.getByText('You have no bookings yet')).toBeInTheDocument();
    expect(screen.getByText('Browse Listings')).toBeInTheDocument();
  });

  it('NoListings renders with create listing link', () => {
    withRouter(<EmptyStatePresets.NoListings />);
    expect(screen.getByText("You haven't created any listings")).toBeInTheDocument();
  });

  it('NoFavorites renders', () => {
    withRouter(<EmptyStatePresets.NoFavorites />);
    expect(screen.getByText('No favorites yet')).toBeInTheDocument();
  });

  it('NoMessages renders', () => {
    withRouter(<EmptyStatePresets.NoMessages />);
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('NoReviews renders without action', () => {
    withRouter(<EmptyStatePresets.NoReviews />);
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
  });

  it('NoNotifications renders with sm size', () => {
    withRouter(<EmptyStatePresets.NoNotifications />);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('NoSearchResults includes search term', () => {
    withRouter(<EmptyStatePresets.NoSearchResults searchTerm="drone" />);
    expect(screen.getByText('No results found for "drone"')).toBeInTheDocument();
  });

  it('NoSearchResults calls onClearFilters', () => {
    const onClearFilters = vi.fn();
    withRouter(<EmptyStatePresets.NoSearchResults onClearFilters={onClearFilters} />);
    fireEvent.click(screen.getByText('Clear Filters'));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('Generic uses defaults', () => {
    withRouter(<EmptyStatePresets.Generic />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('Generic accepts custom title/description', () => {
    withRouter(<EmptyStatePresets.Generic title="Custom" description="Custom desc" />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Custom desc')).toBeInTheDocument();
  });
});
