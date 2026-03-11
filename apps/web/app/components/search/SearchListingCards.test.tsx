import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

vi.mock('lucide-react', () => ({
  MapPin: (props: Record<string, unknown>) => <svg data-testid="map-pin-icon" {...props} />,
  Package: (props: Record<string, unknown>) => <svg data-testid="package-icon" {...props} />,
}));

vi.mock('~/components/favorites', () => ({
  CompactFavoriteButton: ({ listingId }: { listingId: string }) => (
    <button data-testid={`fav-${listingId}`}>Fav</button>
  ),
}));

vi.mock('~/components/ui', () => ({
  Badge: ({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span data-testid={`badge-${variant}`} className={className}>{children}</span>
  ),
}));

import { SearchListingCard, SearchListingListItem, SearchListingCompactCard } from './SearchListingCards';

const baseListing = {
  id: 'listing-1',
  title: 'Camera for Rent',
  basePrice: 25,
  condition: 'like-new',
  photos: ['photo1.jpg'],
  location: { city: 'Kathmandu', state: 'Bagmati' },
  rating: 4.5,
  totalReviews: 12,
  featured: false,
  instantBooking: false,
  description: 'A great camera.',
} as any;

function wrapRouter(el: React.ReactElement) {
  return <MemoryRouter>{el}</MemoryRouter>;
}

describe('SearchListingCard', () => {
  it('renders listing title', () => {
    render(wrapRouter(<SearchListingCard listing={baseListing} />));
    expect(screen.getByText('Camera for Rent')).toBeInTheDocument();
  });

  it('renders price', () => {
    render(wrapRouter(<SearchListingCard listing={baseListing} />));
    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByText('/day')).toBeInTheDocument();
  });

  it('renders city and state', () => {
    render(wrapRouter(<SearchListingCard listing={baseListing} />));
    expect(screen.getByText(/Kathmandu/)).toBeInTheDocument();
  });

  it('renders condition', () => {
    render(wrapRouter(<SearchListingCard listing={baseListing} />));
    expect(screen.getByText('like new')).toBeInTheDocument();
  });

  it('renders star rating', () => {
    render(wrapRouter(<SearchListingCard listing={baseListing} />));
    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/(12)/)).toBeInTheDocument();
  });

  it('links to listing page', () => {
    render(wrapRouter(<SearchListingCard listing={baseListing} />));
    const link = screen.getByText('Camera for Rent').closest('a');
    expect(link).toHaveAttribute('href', '/listings/listing-1');
  });

  it('renders image when photo exists', () => {
    render(wrapRouter(<SearchListingCard listing={baseListing} />));
    const img = screen.getByAltText('Camera for Rent');
    expect(img).toHaveAttribute('src', 'photo1.jpg');
  });

  it('renders package icon when no photos', () => {
    const noPhoto = { ...baseListing, photos: [] };
    render(wrapRouter(<SearchListingCard listing={noPhoto} />));
    expect(screen.getByTestId('package-icon')).toBeInTheDocument();
  });

  it('shows Featured badge when featured', () => {
    const featured = { ...baseListing, featured: true };
    render(wrapRouter(<SearchListingCard listing={featured} />));
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('shows Instant badge when instantBooking', () => {
    const instant = { ...baseListing, instantBooking: true };
    render(wrapRouter(<SearchListingCard listing={instant} />));
    expect(screen.getByText('Instant')).toBeInTheDocument();
  });

  it('renders favorite button', () => {
    render(wrapRouter(<SearchListingCard listing={baseListing} />));
    expect(screen.getByTestId('fav-listing-1')).toBeInTheDocument();
  });

  it('fallbacks to "Listing" when title is empty', () => {
    const noTitle = { ...baseListing, title: '' };
    render(wrapRouter(<SearchListingCard listing={noTitle} />));
    expect(screen.getByText('Listing')).toBeInTheDocument();
  });
});

describe('SearchListingListItem', () => {
  it('renders title', () => {
    render(wrapRouter(<SearchListingListItem listing={baseListing} />));
    expect(screen.getByText('Camera for Rent')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(wrapRouter(<SearchListingListItem listing={baseListing} />));
    expect(screen.getByText('A great camera.')).toBeInTheDocument();
  });

  it('shows Featured badge when featured', () => {
    const featured = { ...baseListing, featured: true };
    render(wrapRouter(<SearchListingListItem listing={featured} />));
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('renders price', () => {
    render(wrapRouter(<SearchListingListItem listing={baseListing} />));
    expect(screen.getByText('$25')).toBeInTheDocument();
  });

  it('renders location', () => {
    render(wrapRouter(<SearchListingListItem listing={baseListing} />));
    expect(screen.getByText(/Kathmandu/)).toBeInTheDocument();
  });
});

describe('SearchListingCompactCard', () => {
  const onHighlightChange = vi.fn();

  it('renders title', () => {
    render(wrapRouter(
      <SearchListingCompactCard listing={baseListing} onHighlightChange={onHighlightChange} />
    ));
    expect(screen.getByText('Camera for Rent')).toBeInTheDocument();
  });

  it('renders price with /day', () => {
    render(wrapRouter(
      <SearchListingCompactCard listing={baseListing} onHighlightChange={onHighlightChange} />
    ));
    expect(screen.getByText('$25/day')).toBeInTheDocument();
  });

  it('calls onHighlightChange on hover', () => {
    render(wrapRouter(
      <SearchListingCompactCard listing={baseListing} onHighlightChange={onHighlightChange} />
    ));
    const link = screen.getByText('Camera for Rent').closest('a')!;
    fireEvent.mouseEnter(link);
    expect(onHighlightChange).toHaveBeenCalledWith('listing-1');
    fireEvent.mouseLeave(link);
    expect(onHighlightChange).toHaveBeenCalledWith(undefined);
  });

  it('renders city', () => {
    render(wrapRouter(
      <SearchListingCompactCard listing={baseListing} onHighlightChange={onHighlightChange} />
    ));
    expect(screen.getByText('Kathmandu')).toBeInTheDocument();
  });

  it('renders rating', () => {
    render(wrapRouter(
      <SearchListingCompactCard listing={baseListing} onHighlightChange={onHighlightChange} />
    ));
    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
  });
});
