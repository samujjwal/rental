import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./BaseMap', () => ({
  BaseMap: ({ children, center, zoom, onMapReady, onBoundsChange }: any) => (
    <div data-testid="base-map" data-center={JSON.stringify(center)} data-zoom={zoom}>
      {children}
    </div>
  ),
}));

vi.mock('./MarkerCluster', () => ({
  MarkerCluster: ({ listings, onMarkerClick, highlightedListingId }: any) => (
    <div
      data-testid="marker-cluster"
      data-count={listings.length}
      data-highlighted={highlightedListingId || ''}
    />
  ),
}));

import { ListingsMap } from './ListingsMap';

const listings = [
  { id: 'l1', title: 'A', price: 10, currency: 'USD', location: { lat: 27.7, lng: 85.3 } },
  { id: 'l2', title: 'B', price: 20, currency: 'USD', location: { lat: 28.0, lng: 84.0 } },
];

describe('ListingsMap', () => {
  it('renders BaseMap', () => {
    render(<ListingsMap listings={listings} />);
    expect(screen.getByTestId('base-map')).toBeInTheDocument();
  });

  it('renders MarkerCluster with listings', () => {
    render(<ListingsMap listings={listings} />);
    expect(screen.getByTestId('marker-cluster')).toHaveAttribute('data-count', '2');
  });

  it('passes highlighted listing ID to MarkerCluster', () => {
    render(<ListingsMap listings={listings} highlightedListingId="l1" />);
    expect(screen.getByTestId('marker-cluster')).toHaveAttribute('data-highlighted', 'l1');
  });

  it('uses provided center', () => {
    render(<ListingsMap listings={listings} center={[10, 20]} />);
    expect(screen.getByTestId('base-map').dataset.center).toContain('10');
  });

  it('calculates center from listings when not provided', () => {
    render(<ListingsMap listings={listings} />);
    const center = JSON.parse(screen.getByTestId('base-map').dataset.center!);
    // Average of 27.7 and 28.0  
    expect(center[0]).toBeCloseTo(27.85, 1);
  });

  it('uses default center when no listings and no center', () => {
    render(<ListingsMap listings={[]} />);
    const center = JSON.parse(screen.getByTestId('base-map').dataset.center!);
    // Default map center is Nepal coordinates
    expect(center[0]).toBeCloseTo(27.7, 1);
  });

  it('uses provided zoom level', () => {
    render(<ListingsMap listings={listings} zoom={15} />);
    expect(screen.getByTestId('base-map')).toHaveAttribute('data-zoom', '15');
  });

  it('applies className', () => {
    const { container } = render(<ListingsMap listings={listings} className="my-map" />);
    expect(container.firstChild).toHaveClass('my-map');
  });
});
