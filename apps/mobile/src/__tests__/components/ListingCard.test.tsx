import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ListingCard } from '../../components/ListingCard';

jest.mock('../../theme', () => ({
  colors: {
    card: '#fff',
    border: '#eee',
    borderLight: '#f5f5f5',
    text: '#000',
    textSecondary: '#666',
    textMuted: '#999',
  },
  typography: {
    h2: { fontSize: 20 },
    body: { fontSize: 14 },
    caption: { fontSize: 12 },
    button: { fontSize: 14 },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  borderRadius: { lg: 12 },
  shadows: { sm: {} },
}));

const baseListing = {
  id: 'listing-1',
  title: 'Modern Apartment',
  basePrice: 50,
  pricingMode: 'PER_DAY',
  city: 'Kathmandu',
  state: 'Bagmati',
  averageRating: 4.5,
  photos: ['https://example.com/photo.jpg'],
  latitude: 27.7,
  longitude: 85.3,
  reviewCount: 10,
  slug: 'modern-apartment',
  categoryId: 'cat-1',
  categoryName: 'Apartment',
  ownerId: 'owner-1',
  ownerName: 'John',
  status: 'ACTIVE' as const,
  createdAt: '2024-01-01',
};

describe('ListingCard', () => {
  it('renders listing title', () => {
    const { getByText } = render(<ListingCard listing={baseListing as any} onPress={jest.fn()} />);
    expect(getByText('Modern Apartment')).toBeTruthy();
  });

  it('renders price per day', () => {
    const { getByText } = render(<ListingCard listing={baseListing as any} onPress={jest.fn()} />);
    expect(getByText('Rs. 50/day')).toBeTruthy();
  });

  it('renders city and state', () => {
    const { getByText } = render(<ListingCard listing={baseListing as any} onPress={jest.fn()} />);
    expect(getByText('Kathmandu, Bagmati')).toBeTruthy();
  });

  it('renders rating when > 0', () => {
    const { getByText } = render(<ListingCard listing={baseListing as any} onPress={jest.fn()} />);
    expect(getByText(/4\.5/)).toBeTruthy();
  });

  it('hides rating when 0', () => {
    const listing = { ...baseListing, averageRating: 0 };
    const { queryByText } = render(<ListingCard listing={listing as any} onPress={jest.fn()} />);
    expect(queryByText(/\u2B50/)).toBeNull();
  });

  it('calls onPress when card is pressed', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <ListingCard listing={baseListing as any} onPress={onPress} />,
    );
    fireEvent.press(getByLabelText(/Modern Apartment/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders placeholder when no photos', () => {
    const listing = { ...baseListing, photos: [] };
    const { getByText } = render(<ListingCard listing={listing as any} onPress={jest.fn()} />);
    expect(getByText('M')).toBeTruthy(); // First char of title
  });

  it('renders favorite button when onToggleFavorite provided', () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      <ListingCard
        listing={baseListing as any}
        onPress={jest.fn()}
        onToggleFavorite={onToggle}
      />,
    );
    expect(getByLabelText('Add to favorites')).toBeTruthy();
  });

  it('shows filled heart when isFavorite is true', () => {
    const { getByLabelText } = render(
      <ListingCard
        listing={baseListing as any}
        onPress={jest.fn()}
        isFavorite={true}
        onToggleFavorite={jest.fn()}
      />,
    );
    expect(getByLabelText('Remove from favorites')).toBeTruthy();
  });

  it('calls onToggleFavorite when favorite button pressed', () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      <ListingCard
        listing={baseListing as any}
        onPress={jest.fn()}
        onToggleFavorite={onToggle}
      />,
    );
    fireEvent.press(getByLabelText('Add to favorites'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not render favorite button when onToggleFavorite not provided', () => {
    const { queryByLabelText } = render(
      <ListingCard listing={baseListing as any} onPress={jest.fn()} />,
    );
    expect(queryByLabelText(/favorites/)).toBeNull();
  });

  it('renders city only when state is empty', () => {
    const listing = { ...baseListing, state: '' };
    const { getByText } = render(<ListingCard listing={listing as any} onPress={jest.fn()} />);
    expect(getByText('Kathmandu')).toBeTruthy();
  });

  it('has correct accessibility label with rating', () => {
    const { getByLabelText } = render(
      <ListingCard listing={baseListing as any} onPress={jest.fn()} />,
    );
    expect(getByLabelText(/Modern Apartment, Rs\. 50 per day, rated 4\.5 stars/)).toBeTruthy();
  });

  it('has correct accessibility label without rating', () => {
    const listing = { ...baseListing, averageRating: 0 };
    const { getByLabelText } = render(
      <ListingCard listing={listing as any} onPress={jest.fn()} />,
    );
    const label = getByLabelText(/Modern Apartment, Rs\. 50 per day/);
    expect(label).toBeTruthy();
  });
});
