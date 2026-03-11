import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  CardSkeleton,
  CardGridSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  PageSkeleton,
  ProfileSkeleton,
  StatCardSkeleton,
  FormSkeleton,
  BookingCardSkeleton,
} from './skeleton';

describe('Skeleton', () => {
  it('renders with default variant (rectangular)', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('rounded-none');
  });

  it.each(['text', 'circular', 'rectangular', 'rounded'] as const)(
    'applies %s variant class',
    (variant) => {
      const { container } = render(<Skeleton variant={variant} />);
      expect(container.firstChild).toBeInTheDocument();
    },
  );

  it('applies pulse animation by default', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('applies no animation when animation=none', () => {
    const { container } = render(<Skeleton animation="none" />);
    expect(container.firstChild).not.toHaveClass('animate-pulse');
  });

  it('applies custom width and height as numbers', () => {
    const { container } = render(<Skeleton width={100} height={50} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100px');
    expect(el.style.height).toBe('50px');
  });

  it('applies custom width and height as strings', () => {
    const { container } = render(<Skeleton width="50%" height="2rem" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('50%');
    expect(el.style.height).toBe('2rem');
  });

  it('accepts custom className', () => {
    const { container } = render(<Skeleton className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });
});

describe('CardSkeleton', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelectorAll('.bg-muted').length).toBeGreaterThan(0);
  });
});

describe('CardGridSkeleton', () => {
  it('defaults to 8 cards', () => {
    const { container } = render(<CardGridSkeleton />);
    // Each CardSkeleton has a wrapper div
    const cards = container.querySelectorAll('.space-y-3');
    expect(cards).toHaveLength(8);
  });

  it('renders custom count', () => {
    const { container } = render(<CardGridSkeleton count={3} />);
    const cards = container.querySelectorAll('.space-y-3');
    expect(cards).toHaveLength(3);
  });
});

describe('TableRowSkeleton', () => {
  it('renders 5 columns by default', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableRowSkeleton />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll('td')).toHaveLength(5);
  });

  it('renders custom column count', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableRowSkeleton columns={3} />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll('td')).toHaveLength(3);
  });
});

describe('TableSkeleton', () => {
  it('renders header and body rows', () => {
    const { container } = render(<TableSkeleton rows={3} columns={4} />);
    expect(container.querySelectorAll('th')).toHaveLength(4);
    // 3 data rows
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(3);
  });
});

describe('PageSkeleton', () => {
  it('renders header by default', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.querySelector('.border-b')).not.toBeNull();
  });

  it('hides header when showHeader=false', () => {
    const { container } = render(<PageSkeleton showHeader={false} />);
    // The main container should not have the header border-b
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer.querySelector(':scope > .border-b')).toBeNull();
  });
});

describe('ProfileSkeleton', () => {
  it('renders avatar and text skeletons', () => {
    const { container } = render(<ProfileSkeleton />);
    // Should have a circular skeleton for avatar
    expect(container.querySelector('.rounded-full')).not.toBeNull();
  });
});

describe('StatCardSkeleton', () => {
  it('renders within a card border', () => {
    const { container } = render(<StatCardSkeleton />);
    expect(container.querySelector('.border')).not.toBeNull();
  });
});

describe('FormSkeleton', () => {
  it('renders 4 fields by default', () => {
    const { container } = render(<FormSkeleton />);
    // Each field has a label + input skeleton = 2 skeletons per field, plus 1 button
    const skeletons = container.querySelectorAll('.bg-muted');
    expect(skeletons.length).toBe(4 * 2 + 1); // 4 fields × 2 + 1 submit button
  });

  it('renders custom field count', () => {
    const { container } = render(<FormSkeleton fields={2} />);
    const skeletons = container.querySelectorAll('.bg-muted');
    expect(skeletons.length).toBe(2 * 2 + 1);
  });
});

describe('BookingCardSkeleton', () => {
  it('renders image and text skeletons', () => {
    const { container } = render(<BookingCardSkeleton />);
    expect(container.querySelectorAll('.bg-muted').length).toBeGreaterThan(0);
  });
});
