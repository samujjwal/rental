import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../ui/skeleton', () => ({
  Skeleton: ({ className, variant, ...props }: Record<string, unknown>) => (
    <div data-testid="skeleton" data-variant={variant} className={className as string} {...props} />
  ),
  StatCardSkeleton: (props: Record<string, unknown>) => (
    <div data-testid="stat-card-skeleton" {...props} />
  ),
}));

import { DashboardSkeleton } from './DashboardSkeleton';

describe('DashboardSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders header skeletons', () => {
    const { container } = render(<DashboardSkeleton />);
    // Header has 2 skeleton elements (title + subtitle)
    const headerSection = container.querySelector('.space-y-2');
    expect(headerSection).toBeInTheDocument();
    const headerSkeletons = headerSection!.querySelectorAll('[data-testid="skeleton"]');
    expect(headerSkeletons.length).toBe(2);
  });

  it('renders 4 stat card skeletons', () => {
    render(<DashboardSkeleton />);
    const statCards = screen.getAllByTestId('stat-card-skeleton');
    expect(statCards).toHaveLength(4);
  });

  it('renders stats in a 4-column grid', () => {
    const { container } = render(<DashboardSkeleton />);
    const grid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4');
    expect(grid).toBeInTheDocument();
  });

  it('renders main content area with 3-column grid', () => {
    const { container } = render(<DashboardSkeleton />);
    const mainGrid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-3');
    expect(mainGrid).toBeInTheDocument();
  });

  it('renders left column spanning 2 columns', () => {
    const { container } = render(<DashboardSkeleton />);
    const leftCol = container.querySelector('.lg\\:col-span-2');
    expect(leftCol).toBeInTheDocument();
  });

  it('renders 3 content items in left column', () => {
    const { container } = render(<DashboardSkeleton />);
    const leftCol = container.querySelector('.lg\\:col-span-2');
    // Each item has a rounded skeleton (image placeholder)
    const roundedSkeletons = leftCol!.querySelectorAll('[data-variant="rounded"]');
    expect(roundedSkeletons).toHaveLength(3); // 3 image placeholders
  });

  it('renders sidebar section in right column', () => {
    const { container } = render(<DashboardSkeleton />);
    const mainGrid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-3');
    const columns = mainGrid!.children;
    // Right column is the second child
    expect(columns.length).toBe(2);
  });

  it('renders sidebar with text skeletons', () => {
    const { container } = render(<DashboardSkeleton />);
    // Sidebar has 4 text skeleton items + 1 title
    const mainGrid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-3');
    const rightCol = mainGrid!.children[1];
    const textSkeletons = rightCol.querySelectorAll('[data-variant="text"]');
    expect(textSkeletons.length).toBeGreaterThanOrEqual(4);
  });

  it('renders card-styled containers', () => {
    const { container } = render(<DashboardSkeleton />);
    const cards = container.querySelectorAll('.bg-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it('renders many skeleton elements overall', () => {
    render(<DashboardSkeleton />);
    const allSkeletons = screen.getAllByTestId('skeleton');
    // Header(2) + card title(1) + 3 items x 3 skeletons(9) + sidebar title(1) + sidebar items(4)
    expect(allSkeletons.length).toBeGreaterThanOrEqual(10);
  });
});
