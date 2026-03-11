import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Check: ({ className, strokeWidth }: any) => (
    <span data-testid="check-icon" className={className}>check</span>
  ),
}));

const { mockReducedMotion } = vi.hoisted(() => ({
  mockReducedMotion: { value: false },
}));

vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => mockReducedMotion.value,
}));

import {
  SuccessCheckmark,
  SuccessMessage,
  ErrorIndicator,
  WarningIndicator,
} from './SuccessCheckmark';

describe('SuccessCheckmark', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders with role="img" and aria-label="Success"', () => {
    render(<SuccessCheckmark />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Success');
  });

  it('renders check icon', () => {
    render(<SuccessCheckmark />);
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SuccessCheckmark className="my-class" />);
    expect(container.querySelector('.my-class')).toBeTruthy();
  });

  it('supports sm/md/lg/xl sizes', () => {
    const { unmount: u1 } = render(<SuccessCheckmark size="sm" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    u1();

    render(<SuccessCheckmark size="xl" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders static version when reduced motion preferred', () => {
    mockReducedMotion.value = true;
    render(<SuccessCheckmark />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Success');
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });
});

describe('SuccessMessage', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders title', () => {
    render(<SuccessMessage title="Booking Confirmed!" />);
    expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <SuccessMessage
        title="Done"
        description="Your booking has been placed."
      />
    );
    expect(screen.getByText('Your booking has been placed.')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    render(<SuccessMessage title="Done" />);
    expect(screen.queryByText('Your booking has been placed.')).not.toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(
      <SuccessMessage
        title="Done"
        action={<button>Go to bookings</button>}
      />
    );
    expect(screen.getByText('Go to bookings')).toBeInTheDocument();
  });

  it('includes SuccessCheckmark', () => {
    render(<SuccessMessage title="Done" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Success');
  });
});

describe('ErrorIndicator', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders with role="img" and aria-label="Error"', () => {
    render(<ErrorIndicator />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Error');
  });

  it('renders X mark symbol', () => {
    render(<ErrorIndicator />);
    // The X mark character
    const xMark = screen.getByText((content) => content.includes('\u2715'));
    expect(xMark).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ErrorIndicator className="err-class" />);
    expect(container.querySelector('.err-class')).toBeTruthy();
  });

  it('renders static version with reduced motion', () => {
    mockReducedMotion.value = true;
    render(<ErrorIndicator />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Error');
  });

  it('supports size variants', () => {
    render(<ErrorIndicator size="sm" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});

describe('WarningIndicator', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders with role="img" and aria-label="Warning"', () => {
    render(<WarningIndicator />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Warning');
  });

  it('renders ! symbol', () => {
    render(<WarningIndicator />);
    expect(screen.getByText('!')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<WarningIndicator className="warn-class" />);
    expect(container.querySelector('.warn-class')).toBeTruthy();
  });

  it('renders static version with reduced motion', () => {
    mockReducedMotion.value = true;
    render(<WarningIndicator />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Warning');
  });

  it('supports delay prop without errors', () => {
    render(<WarningIndicator delay={0.5} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
