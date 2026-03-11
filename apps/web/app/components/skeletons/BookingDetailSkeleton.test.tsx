import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock Skeleton component
vi.mock('../ui/skeleton', () => ({
  Skeleton: ({ variant, className, ...props }: any) => (
    <div
      data-testid="skeleton"
      data-variant={variant}
      className={className}
      {...props}
    />
  ),
}));

import { BookingDetailSkeleton } from './BookingDetailSkeleton';

describe('BookingDetailSkeleton', () => {
  it('renders without errors', () => {
    const { container } = render(<BookingDetailSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders skeleton elements', () => {
    const { container } = render(<BookingDetailSkeleton />);
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it('renders text variant skeletons for labels', () => {
    const { container } = render(<BookingDetailSkeleton />);
    const textSkeletons = container.querySelectorAll('[data-variant="text"]');
    expect(textSkeletons.length).toBeGreaterThan(5);
  });

  it('renders rounded variant skeletons', () => {
    const { container } = render(<BookingDetailSkeleton />);
    const roundedSkeletons = container.querySelectorAll('[data-variant="rounded"]');
    expect(roundedSkeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders circular variant skeletons for timeline', () => {
    const { container } = render(<BookingDetailSkeleton />);
    const circularSkeletons = container.querySelectorAll('[data-variant="circular"]');
    expect(circularSkeletons.length).toBe(4);
  });

  it('has a grid layout with two columns', () => {
    const { container } = render(<BookingDetailSkeleton />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('grid-cols-1');
  });

  it('renders listing info card', () => {
    const { container } = render(<BookingDetailSkeleton />);
    const cards = container.querySelectorAll('.rounded-lg.border');
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('renders header section', () => {
    const { container } = render(<BookingDetailSkeleton />);
    const header = container.querySelector('.space-y-2');
    expect(header).toBeInTheDocument();
  });

  it('renders 4 timeline items', () => {
    const { container } = render(<BookingDetailSkeleton />);
    // Timeline has circular skeletons
    const timelineCircles = container.querySelectorAll('[data-variant="circular"]');
    expect(timelineCircles.length).toBe(4);
  });

  it('renders price breakdown with 5 line items', () => {
    const { container } = render(<BookingDetailSkeleton />);
    // Price breakdown has pairs of text skeletons in flex justify-between
    const justifyBetween = container.querySelectorAll('.flex.justify-between');
    expect(justifyBetween.length).toBeGreaterThanOrEqual(5);
  });

  it('renders action buttons section', () => {
    const { container } = render(<BookingDetailSkeleton />);
    // Action buttons are full-width rounded skeletons at the bottom
    const fullWidthButtons = container.querySelectorAll('[data-variant="rounded"].w-full');
    expect(fullWidthButtons.length).toBe(2);
  });

  it('has max-w-4xl container', () => {
    const { container } = render(<BookingDetailSkeleton />);
    expect(container.firstElementChild).toHaveClass('max-w-4xl', 'mx-auto');
  });
});
