import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../ui/skeleton', () => ({
  Skeleton: ({ className, variant, animation, ...props }: any) => (
    <div
      data-testid="skeleton"
      data-variant={variant}
      data-animation={animation}
      className={className}
      {...props}
    />
  ),
}));

import { ListingCardSkeleton, ListingGridSkeleton } from './ListingCardSkeleton';

describe('ListingCardSkeleton', () => {
  it('renders default variant', () => {
    const { container } = render(<ListingCardSkeleton />);
    expect(container.querySelector('.rounded-lg')).toBeTruthy();
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it('renders image area with wave animation', () => {
    const { container } = render(<ListingCardSkeleton />);
    const waveSkeletons = container.querySelectorAll('[data-animation="wave"]');
    expect(waveSkeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders horizontal variant', () => {
    const { container } = render(<ListingCardSkeleton variant="horizontal" />);
    expect(container.querySelector('.flex')).toBeTruthy();
    expect(container.querySelector('.w-48')).toBeTruthy();
  });

  it('renders compact variant', () => {
    const { container } = render(<ListingCardSkeleton variant="compact" />);
    expect(container.querySelector('.w-20')).toBeTruthy();
  });

  it('applies custom className to default variant', () => {
    const { container } = render(<ListingCardSkeleton className="my-class" />);
    expect(container.querySelector('.my-class')).toBeTruthy();
  });

  it('applies custom className to horizontal variant', () => {
    const { container } = render(
      <ListingCardSkeleton variant="horizontal" className="h-class" />
    );
    expect(container.querySelector('.h-class')).toBeTruthy();
  });

  it('applies custom className to compact variant', () => {
    const { container } = render(
      <ListingCardSkeleton variant="compact" className="c-class" />
    );
    expect(container.querySelector('.c-class')).toBeTruthy();
  });

  it('uses text variant skeletons for text elements', () => {
    const { container } = render(<ListingCardSkeleton />);
    const textSkeletons = container.querySelectorAll('[data-variant="text"]');
    expect(textSkeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('uses circular variant for avatar/icon elements', () => {
    const { container } = render(<ListingCardSkeleton />);
    const circularSkeletons = container.querySelectorAll('[data-variant="circular"]');
    expect(circularSkeletons.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ListingGridSkeleton', () => {
  it('renders default 8 skeletons', () => {
    const { container } = render(<ListingGridSkeleton />);
    const cards = container.querySelectorAll('.rounded-lg');
    expect(cards.length).toBe(8);
  });

  it('renders custom count', () => {
    const { container } = render(<ListingGridSkeleton count={3} />);
    const skeletonGroups = container.querySelectorAll('.rounded-lg');
    expect(skeletonGroups.length).toBe(3);
  });

  it('renders as grid for default variant', () => {
    const { container } = render(<ListingGridSkeleton />);
    expect(container.querySelector('.grid')).toBeTruthy();
  });

  it('renders as stacked list for horizontal variant', () => {
    const { container } = render(<ListingGridSkeleton variant="horizontal" count={2} />);
    expect(container.querySelector('.space-y-4')).toBeTruthy();
    // Each horizontal card has w-48 image
    const images = container.querySelectorAll('.w-48');
    expect(images.length).toBe(2);
  });

  it('applies column classes for 2 columns', () => {
    const { container } = render(<ListingGridSkeleton columns={2} />);
    expect(container.querySelector('.sm\\:grid-cols-2')).toBeTruthy();
  });

  it('applies column classes for 4 columns', () => {
    const { container } = render(<ListingGridSkeleton columns={4} />);
    expect(container.querySelector('.xl\\:grid-cols-4')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<ListingGridSkeleton className="grid-custom" />);
    expect(container.querySelector('.grid-custom')).toBeTruthy();
  });
});
