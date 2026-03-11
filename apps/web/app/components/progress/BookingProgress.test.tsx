import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    circle: (props: any) => <circle {...props} />,
  },
}));

// Mock accessibility
vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => false,
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Check: ({ className }: any) => <span data-testid="check-icon" className={className}>check</span>,
}));

import {
  BookingProgress,
  SimpleProgress,
  CircularProgress,
} from './BookingProgress';

const mockSteps = [
  { id: 'search', label: 'Search' },
  { id: 'select', label: 'Select', description: 'Choose dates' },
  { id: 'pay', label: 'Payment' },
  { id: 'confirm', label: 'Confirm' },
];

describe('BookingProgress', () => {
  it('renders all step labels', () => {
    render(<BookingProgress steps={mockSteps} currentStep={0} />);
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Payment')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('renders step descriptions when provided', () => {
    render(<BookingProgress steps={mockSteps} currentStep={1} />);
    expect(screen.getByText('Choose dates')).toBeInTheDocument();
  });

  it('renders step numbers for pending and current steps', () => {
    render(<BookingProgress steps={mockSteps} currentStep={1} />);
    // Step 3 and 4 should show numbers
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders check icon for completed steps', () => {
    render(<BookingProgress steps={mockSteps} currentStep={2} />);
    // Steps 0 and 1 are completed
    const checks = screen.getAllByTestId('check-icon');
    expect(checks).toHaveLength(2);
  });

  it('has progressbar role with correct ARIA attributes', () => {
    render(<BookingProgress steps={mockSteps} currentStep={1} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '2');
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '4');
    expect(progressbar).toHaveAttribute('aria-label', 'Step 2 of 4: Select');
  });

  it('applies custom className', () => {
    const { container } = render(
      <BookingProgress steps={mockSteps} currentStep={0} className="my-custom" />
    );
    expect(container.querySelector('.my-custom')).toBeTruthy();
  });

  it('supports vertical orientation', () => {
    const { container } = render(
      <BookingProgress steps={mockSteps} currentStep={1} orientation="vertical" />
    );
    expect(container.querySelector('.h-full')).toBeTruthy();
  });

  it('supports sm size', () => {
    render(<BookingProgress steps={mockSteps} currentStep={0} size="sm" />);
    // sm step circles have w-8/h-8 class
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
  });

  it('supports lg size', () => {
    render(<BookingProgress steps={mockSteps} currentStep={0} size="lg" />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
  });
});

describe('SimpleProgress', () => {
  it('renders progressbar with correct values', () => {
    render(<SimpleProgress value={50} max={100} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('defaults max to 100', () => {
    render(<SimpleProgress value={30} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('shows label when showLabel is true', () => {
    render(<SimpleProgress value={75} showLabel />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('does not show label by default', () => {
    render(<SimpleProgress value={75} />);
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('clamps percent to 0-100 range', () => {
    render(<SimpleProgress value={150} max={100} showLabel />);
    // Should cap at 100%
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SimpleProgress value={50} className="my-prog" />);
    expect(container.querySelector('.my-prog')).toBeTruthy();
  });

  it('supports size variants', () => {
    const { container: sm } = render(<SimpleProgress value={50} size="sm" />);
    expect(sm.querySelector('.h-1')).toBeTruthy();

    const { container: lg } = render(<SimpleProgress value={50} size="lg" />);
    expect(lg.querySelector('.h-3')).toBeTruthy();
  });
});

describe('CircularProgress', () => {
  it('renders progressbar with correct values', () => {
    render(<CircularProgress value={60} max={100} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('shows percentage label by default', () => {
    render(<CircularProgress value={42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<CircularProgress value={42} showLabel={false} />);
    expect(screen.queryByText('42%')).not.toBeInTheDocument();
  });

  it('renders SVG with circles', () => {
    const { container } = render(<CircularProgress value={50} />);
    const circles = container.querySelectorAll('circle');
    // Background circle + progress circle
    expect(circles).toHaveLength(2);
  });

  it('clamps values to 0-100%', () => {
    render(<CircularProgress value={-10} showLabel />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CircularProgress value={50} className="circ-custom" />);
    expect(container.querySelector('.circ-custom')).toBeTruthy();
  });
});
