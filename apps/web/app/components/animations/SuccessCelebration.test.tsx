import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, ...props }: any) => (
      <div onClick={onClick} data-testid={props['data-testid']} className={props.className}>
        {children}
      </div>
    ),
    path: (props: any) => <path {...props} />,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

import {
  ConfettiCelebration,
  SuccessCelebration,
} from './SuccessCelebration';

describe('ConfettiCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when show is false', () => {
    const { container } = render(<ConfettiCelebration show={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders confetti pieces when show is true', () => {
    const { container } = render(<ConfettiCelebration show={true} />);
    // Default count is 60
    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper!.children.length).toBe(60);
  });

  it('renders custom count of confetti pieces', () => {
    const { container } = render(<ConfettiCelebration show={true} count={10} />);
    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper!.children.length).toBe(10);
  });

  it('is aria-hidden from assistive technology', () => {
    const { container } = render(<ConfettiCelebration show={true} count={5} />);
    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeInTheDocument();
  });

  it('calls onComplete after duration timeout', () => {
    const onComplete = vi.fn();
    render(
      <ConfettiCelebration show={true} duration={3000} onComplete={onComplete} />
    );
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('uses custom duration for onComplete', () => {
    const onComplete = vi.fn();
    render(
      <ConfettiCelebration show={true} duration={1000} onComplete={onComplete} />
    );
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('clears timeout on unmount', () => {
    const onComplete = vi.fn();
    const { unmount } = render(
      <ConfettiCelebration show={true} duration={3000} onComplete={onComplete} />
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('regenerates pieces when show transitions to true', () => {
    const { container, rerender } = render(
      <ConfettiCelebration show={false} count={5} />
    );
    expect(container.innerHTML).toBe('');
    rerender(<ConfettiCelebration show={true} count={5} />);
    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper!.children.length).toBe(5);
  });
});

describe('SuccessCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when show is false', () => {
    const { container } = render(<SuccessCelebration show={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders default title and message', () => {
    render(<SuccessCelebration show={true} />);
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(
      screen.getByText('Your action was completed successfully.')
    ).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(
      <SuccessCelebration
        show={true}
        title="Booking Confirmed"
        message="Your rental is ready."
      />
    );
    expect(screen.getByText('Booking Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Your rental is ready.')).toBeInTheDocument();
  });

  it('renders a Continue button', () => {
    render(<SuccessCelebration show={true} />);
    expect(
      screen.getByRole('button', { name: 'Continue' })
    ).toBeInTheDocument();
  });

  it('calls onClose when Continue button is clicked', () => {
    const onClose = vi.fn();
    render(<SuccessCelebration show={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<SuccessCelebration show={true} onClose={onClose} />);
    // The backdrop is the outer motion.div
    const backdrop = screen.getByText('Success!').parentElement!.parentElement!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when card content is clicked', () => {
    const onClose = vi.fn();
    render(<SuccessCelebration show={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Success!'));
    // Should NOT propagate to backdrop
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders checkmark SVG', () => {
    const { container } = render(<SuccessCelebration show={true} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg!.querySelector('path')).toBeInTheDocument();
  });

  it('calls onClose when confetti animation completes', () => {
    const onClose = vi.fn();
    render(<SuccessCelebration show={true} onClose={onClose} />);
    // Confetti default duration is 3000ms
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('includes confetti overlay', () => {
    const { container } = render(<SuccessCelebration show={true} />);
    // Confetti renders aria-hidden container
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
