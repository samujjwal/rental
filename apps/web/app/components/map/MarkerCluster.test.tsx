import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMap = {
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
};

const mockClusterGroup = {
  clearLayers: vi.fn(),
  addLayer: vi.fn(),
};

vi.mock('react-leaflet', () => ({
  useMap: () => mockMap,
}));

vi.mock('leaflet', () => {
  const mod = {
    markerClusterGroup: vi.fn(() => mockClusterGroup),
    marker: vi.fn(() => ({
      bindPopup: vi.fn(),
      on: vi.fn(),
    })),
    divIcon: vi.fn((opts: any) => opts),
    point: vi.fn((x: number, y: number) => [x, y]),
  };
  return { ...mod, default: mod };
});

vi.mock('leaflet.markercluster', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}));

import { renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import L from 'leaflet';

// Since MarkerCluster renders null and operates via useEffect + useMap,
// we test the side effects through the mocks
import { MarkerCluster } from './MarkerCluster';
import { render } from '@testing-library/react';

const listings = [
  {
    id: 'l1',
    title: 'Camera',
    price: 50,
    currency: 'USD',
    location: { lat: 27.7, lng: 85.3 },
    imageUrl: '/camera.jpg',
    category: 'Electronics',
  },
  {
    id: 'l2',
    title: 'Bike',
    price: 25,
    currency: 'USD',
    location: { lat: 28.0, lng: 84.0 },
  },
];

describe('MarkerCluster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null (no DOM output)', () => {
    const { container } = render(
      <MarkerCluster listings={listings} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('creates marker cluster group on map', () => {
    render(<MarkerCluster listings={listings} />);
    expect(L.markerClusterGroup).toHaveBeenCalled();
    expect(mockMap.addLayer).toHaveBeenCalledWith(mockClusterGroup);
  });

  it('creates markers for each listing', () => {
    render(<MarkerCluster listings={listings} />);
    expect(L.marker).toHaveBeenCalledTimes(2);
  });

  it('adds markers to cluster group', () => {
    render(<MarkerCluster listings={listings} />);
    expect(mockClusterGroup.addLayer).toHaveBeenCalledTimes(2);
  });

  it('binds popup to each marker', () => {
    render(<MarkerCluster listings={listings} />);
    const marker = (L.marker as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(marker.bindPopup).toHaveBeenCalled();
  });

  it('binds click handler when onMarkerClick provided', () => {
    const onClick = vi.fn();
    render(<MarkerCluster listings={listings} onMarkerClick={onClick} />);
    const marker = (L.marker as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(marker.on).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('clears layers on effect cleanup', () => {
    const { unmount } = render(<MarkerCluster listings={listings} />);
    unmount();
    expect(mockClusterGroup.clearLayers).toHaveBeenCalled();
  });
});
