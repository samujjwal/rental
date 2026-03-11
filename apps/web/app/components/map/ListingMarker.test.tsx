import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-leaflet', () => ({
  Marker: ({ children, position, eventHandlers }: any) => (
    <div data-testid="marker" data-lat={position[0]} data-lng={position[1]}>
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
}));

vi.mock('leaflet', () => ({
  DivIcon: class DivIcon {
    options: any;
    constructor(options: any) {
      this.options = options;
    }
  },
}));

import { ListingMarker } from './ListingMarker';

const listing = {
  id: 'l1',
  title: 'Sony Camera',
  price: 50,
  currency: 'USD',
  imageUrl: '/camera.jpg',
  location: { lat: 27.7, lng: 85.3 },
  category: 'Electronics',
};

describe('ListingMarker', () => {
  it('renders marker at correct position', () => {
    render(<ListingMarker listing={listing} />);
    const marker = screen.getByTestId('marker');
    expect(marker).toHaveAttribute('data-lat', '27.7');
    expect(marker).toHaveAttribute('data-lng', '85.3');
  });

  it('renders popup with listing title', () => {
    render(<ListingMarker listing={listing} />);
    expect(screen.getByText('Sony Camera')).toBeInTheDocument();
  });

  it('renders popup with category', () => {
    render(<ListingMarker listing={listing} />);
    expect(screen.getByText('Electronics')).toBeInTheDocument();
  });

  it('renders popup with price and /day', () => {
    render(<ListingMarker listing={listing} />);
    expect(screen.getByText('/day')).toBeInTheDocument();
  });

  it('renders popup image when imageUrl provided', () => {
    render(<ListingMarker listing={listing} />);
    const img = screen.getByAltText('Sony Camera');
    expect(img).toHaveAttribute('src', '/camera.jpg');
  });

  it('does not render popup image when imageUrl missing', () => {
    const noImage = { ...listing, imageUrl: undefined };
    render(<ListingMarker listing={noImage} />);
    expect(screen.queryByAltText('Sony Camera')).not.toBeInTheDocument();
  });

  it('does not render category when missing', () => {
    const noCat = { ...listing, category: undefined };
    render(<ListingMarker listing={noCat} />);
    expect(screen.queryByText('Electronics')).not.toBeInTheDocument();
  });
});
