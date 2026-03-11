import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./ListingsMap', () => ({
  ListingsMap: ({ listings, highlightedListingId, className }: any) => (
    <div data-testid="listings-map" data-count={listings.length} className={className} />
  ),
}));

vi.mock('./MapViewToggle', () => ({
  MapViewToggle: ({ view, onViewChange }: any) => (
    <button data-testid="view-toggle" onClick={() => onViewChange(view === 'map' ? 'list' : 'map')}>
      {view}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  RefreshCw: (props: Record<string, unknown>) => <svg data-testid="refresh-icon" {...props} />,
}));

import { MapSearchView } from './MapSearchView';

const listings = [
  { id: 'l1', title: 'A', price: 10, currency: 'USD', location: { lat: 27.7, lng: 85.3 } },
  { id: 'l2', title: 'B', price: 20, currency: 'USD', location: { lat: 28.0, lng: 84.0 } },
];

describe('MapSearchView', () => {
  it('renders view toggle', () => {
    render(<MapSearchView listings={listings} view="map" onViewChange={vi.fn()} />);
    expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
  });

  it('renders map when view is map', () => {
    render(<MapSearchView listings={listings} view="map" onViewChange={vi.fn()} />);
    expect(screen.getByTestId('listings-map')).toBeInTheDocument();
  });

  it('does not render map when view is list', () => {
    render(<MapSearchView listings={listings} view="list" onViewChange={vi.fn()} />);
    expect(screen.queryByTestId('listings-map')).not.toBeInTheDocument();
  });

  it('shows listing count in map view', () => {
    render(<MapSearchView listings={listings} view="map" onViewChange={vi.fn()} />);
    expect(screen.getByText('2 listings')).toBeInTheDocument();
  });

  it('shows singular "listing" for count of 1', () => {
    render(<MapSearchView listings={[listings[0]]} view="map" onViewChange={vi.fn()} />);
    expect(screen.getByText('1 listing')).toBeInTheDocument();
  });

  it('shows "Search this area" button when enabled', () => {
    render(
      <MapSearchView
        listings={listings}
        view="map"
        onViewChange={vi.fn()}
        showSearchThisArea
        onSearchThisArea={vi.fn()}
      />
    );
    expect(screen.getByText('Search this area')).toBeInTheDocument();
  });

  it('does not show "Search this area" in list view', () => {
    render(
      <MapSearchView
        listings={listings}
        view="list"
        onViewChange={vi.fn()}
        showSearchThisArea
      />
    );
    expect(screen.queryByText('Search this area')).not.toBeInTheDocument();
  });

  it('calls onViewChange when toggle clicked', () => {
    const onViewChange = vi.fn();
    render(<MapSearchView listings={listings} view="map" onViewChange={onViewChange} />);
    fireEvent.click(screen.getByTestId('view-toggle'));
    expect(onViewChange).toHaveBeenCalledWith('list');
  });
});
