import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  HomeSkeleton,
  SearchSkeleton,
  ListingDetailSkeleton,
  BookingsSkeleton,
  DashboardSkeleton,
  MessagesSkeleton,
  CheckoutSkeleton,
  FavoritesSkeleton,
  EarningsSkeleton,
  GenericSkeleton,
} from './route-skeletons';

describe('HomeSkeleton', () => {
  it('renders shimmer elements for hero and cards', () => {
    const { container } = render(<HomeSkeleton />);
    const shimmers = container.querySelectorAll('.animate-pulse');
    // hero (3) + 8 cards * 4 shimmers each = 35 total
    expect(shimmers.length).toBeGreaterThan(10);
  });

  it('renders 8 featured card placeholders', () => {
    const { container } = render(<HomeSkeleton />);
    const cards = container.querySelectorAll('.rounded-lg.border');
    expect(cards).toHaveLength(8);
  });
});

describe('SearchSkeleton', () => {
  it('renders filter chips and result grid', () => {
    const { container } = render(<SearchSkeleton />);
    // 5 filter chips (rounded-full) + search bar + results
    const chips = container.querySelectorAll('.rounded-full');
    expect(chips.length).toBeGreaterThanOrEqual(5);
  });

  it('renders 9 result cards', () => {
    const { container } = render(<SearchSkeleton />);
    const cards = container.querySelectorAll('.rounded-lg.border');
    expect(cards).toHaveLength(9);
  });
});

describe('ListingDetailSkeleton', () => {
  it('renders gallery and info panels', () => {
    const { container } = render(<ListingDetailSkeleton />);
    const shimmers = container.querySelectorAll('.animate-pulse');
    expect(shimmers.length).toBeGreaterThan(5);
  });
});

describe('BookingsSkeleton', () => {
  it('renders booking list items', () => {
    const { container } = render(<BookingsSkeleton />);
    // 5 booking row items + header elements
    const shimmers = container.querySelectorAll('.animate-pulse');
    expect(shimmers.length).toBeGreaterThan(10);
  });
});

describe('DashboardSkeleton', () => {
  it('renders 4 stat cards and 4 content cards', () => {
    const { container } = render(<DashboardSkeleton />);
    const cards = container.querySelectorAll('.rounded-lg.border');
    expect(cards).toHaveLength(8); // 4 stats + 4 content
  });
});

describe('MessagesSkeleton', () => {
  it('renders sidebar and chat area', () => {
    const { container } = render(<MessagesSkeleton />);
    // Sidebar has 6 conversation items + search, chat has messages + input
    const shimmers = container.querySelectorAll('.animate-pulse');
    expect(shimmers.length).toBeGreaterThan(10);
  });
});

describe('CheckoutSkeleton', () => {
  it('renders form and summary sections', () => {
    const { container } = render(<CheckoutSkeleton />);
    const shimmers = container.querySelectorAll('.animate-pulse');
    expect(shimmers.length).toBeGreaterThan(5);
  });
});

describe('FavoritesSkeleton', () => {
  it('renders 6 favorite card placeholders', () => {
    const { container } = render(<FavoritesSkeleton />);
    const cards = container.querySelectorAll('.rounded-lg.border');
    expect(cards).toHaveLength(6);
  });
});

describe('EarningsSkeleton', () => {
  it('renders 3 stat cards and transaction rows', () => {
    const { container } = render(<EarningsSkeleton />);
    const cards = container.querySelectorAll('.rounded-lg.border');
    expect(cards).toHaveLength(4); // 3 stats + 1 table
  });
});

describe('GenericSkeleton', () => {
  it('renders basic shimmer elements', () => {
    const { container } = render(<GenericSkeleton />);
    const shimmers = container.querySelectorAll('.animate-pulse');
    expect(shimmers).toHaveLength(3);
  });
});
