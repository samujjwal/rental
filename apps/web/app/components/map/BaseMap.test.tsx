import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom, className }: any) => (
    <div data-testid="map-container" data-center={JSON.stringify(center)} data-zoom={zoom} className={className}>
      {children}
    </div>
  ),
  TileLayer: ({ attribution, url }: any) => (
    <div data-testid="tile-layer" data-url={url} />
  ),
  useMap: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    getBounds: vi.fn(() => ({
      getSouth: () => 0,
      getWest: () => 0,
      getNorth: () => 1,
      getEast: () => 1,
    })),
  })),
}));

import { BaseMap } from './BaseMap';

describe('BaseMap', () => {
  it('renders MapContainer', () => {
    render(<BaseMap />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('uses default center when none provided', () => {
    render(<BaseMap />);
    const container = screen.getByTestId('map-container');
    // Default center is Nepal coordinates from APP_MAP_CENTER
    expect(container.dataset.center).toContain('27.7');
  });

  it('uses custom center', () => {
    render(<BaseMap center={[27.7, 85.3]} />);
    const container = screen.getByTestId('map-container');
    expect(container.dataset.center).toContain('27.7');
  });

  it('uses custom zoom', () => {
    render(<BaseMap zoom={15} />);
    expect(screen.getByTestId('map-container')).toHaveAttribute('data-zoom', '15');
  });

  it('renders TileLayer with OpenStreetMap', () => {
    render(<BaseMap />);
    const tile = screen.getByTestId('tile-layer');
    expect(tile.dataset.url).toContain('openstreetmap');
  });

  it('renders children', () => {
    render(
      <BaseMap>
        <div data-testid="child">Child content</div>
      </BaseMap>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies className', () => {
    render(<BaseMap className="custom-class" />);
    expect(screen.getByTestId('map-container')).toHaveClass('custom-class');
  });
});
