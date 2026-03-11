import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrefersReducedMotion } = vi.hoisted(() => ({
  mockPrefersReducedMotion: vi.fn(() => false),
}));

vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: mockPrefersReducedMotion,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial,
      whileInView,
      viewport,
      transition,
      ...rest
    }: Record<string, unknown>) => {
      const safeProps: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (
          key.startsWith('aria-') ||
          key.startsWith('data-') ||
          key === 'className' ||
          key === 'id' ||
          key === 'role' ||
          key === 'style'
        ) {
          safeProps[key] = value;
        }
      }
      return (
        <div
          data-testid="motion-div"
          data-initial={JSON.stringify(initial)}
          data-while-in-view={JSON.stringify(whileInView)}
          data-viewport={JSON.stringify(viewport)}
          data-transition={JSON.stringify(transition)}
          {...safeProps}
        >
          {children as React.ReactNode}
        </div>
      );
    },
  },
}));

import { SlideIn } from './SlideIn';

describe('SlideIn', () => {
  beforeEach(() => {
    mockPrefersReducedMotion.mockReturnValue(false);
  });

  it('renders children', () => {
    render(<SlideIn><span>Hello</span></SlideIn>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders a motion.div wrapper', () => {
    render(<SlideIn>Content</SlideIn>);
    expect(screen.getByTestId('motion-div')).toBeInTheDocument();
  });

  describe('direction initial positions', () => {
    it('slides from below for direction="up" (default)', () => {
      render(<SlideIn>Up</SlideIn>);
      const el = screen.getByTestId('motion-div');
      const initial = JSON.parse(el.getAttribute('data-initial')!);
      expect(initial).toEqual({ y: 50, opacity: 0 });
    });

    it('slides from above for direction="down"', () => {
      render(<SlideIn direction="down">Down</SlideIn>);
      const el = screen.getByTestId('motion-div');
      const initial = JSON.parse(el.getAttribute('data-initial')!);
      expect(initial).toEqual({ y: -50, opacity: 0 });
    });

    it('slides from right for direction="left"', () => {
      render(<SlideIn direction="left">Left</SlideIn>);
      const el = screen.getByTestId('motion-div');
      const initial = JSON.parse(el.getAttribute('data-initial')!);
      expect(initial).toEqual({ x: 50, opacity: 0 });
    });

    it('slides from left for direction="right"', () => {
      render(<SlideIn direction="right">Right</SlideIn>);
      const el = screen.getByTestId('motion-div');
      const initial = JSON.parse(el.getAttribute('data-initial')!);
      expect(initial).toEqual({ x: -50, opacity: 0 });
    });
  });

  describe('custom distance', () => {
    it('uses custom distance for up direction', () => {
      render(<SlideIn distance={100}>Far</SlideIn>);
      const initial = JSON.parse(screen.getByTestId('motion-div').getAttribute('data-initial')!);
      expect(initial).toEqual({ y: 100, opacity: 0 });
    });

    it('uses custom distance for left direction', () => {
      render(<SlideIn direction="left" distance={200}>Far left</SlideIn>);
      const initial = JSON.parse(screen.getByTestId('motion-div').getAttribute('data-initial')!);
      expect(initial).toEqual({ x: 200, opacity: 0 });
    });
  });

  describe('whileInView target', () => {
    it('animates to origin position', () => {
      render(<SlideIn>Content</SlideIn>);
      const whileInView = JSON.parse(screen.getByTestId('motion-div').getAttribute('data-while-in-view')!);
      expect(whileInView).toEqual({ x: 0, y: 0, opacity: 1 });
    });
  });

  describe('viewport options', () => {
    it('defaults once to true', () => {
      render(<SlideIn>Content</SlideIn>);
      const viewport = JSON.parse(screen.getByTestId('motion-div').getAttribute('data-viewport')!);
      expect(viewport).toEqual({ once: true });
    });

    it('can set once to false', () => {
      render(<SlideIn once={false}>Repeat</SlideIn>);
      const viewport = JSON.parse(screen.getByTestId('motion-div').getAttribute('data-viewport')!);
      expect(viewport).toEqual({ once: false });
    });
  });

  describe('transition', () => {
    it('has default duration and delay', () => {
      render(<SlideIn>Content</SlideIn>);
      const transition = JSON.parse(screen.getByTestId('motion-div').getAttribute('data-transition')!);
      expect(transition.duration).toBe(0.5);
      expect(transition.delay).toBe(0);
      expect(transition.ease).toEqual([0.25, 0.1, 0.25, 1]);
    });

    it('uses custom duration and delay', () => {
      render(<SlideIn duration={1} delay={0.3}>Custom</SlideIn>);
      const transition = JSON.parse(screen.getByTestId('motion-div').getAttribute('data-transition')!);
      expect(transition.duration).toBe(1);
      expect(transition.delay).toBe(0.3);
    });
  });

  describe('reduced motion', () => {
    it('returns opacity-only initial when reduced motion preferred', () => {
      mockPrefersReducedMotion.mockReturnValue(true);
      render(<SlideIn direction="left" distance={100}>Accessible</SlideIn>);
      const initial = JSON.parse(screen.getByTestId('motion-div').getAttribute('data-initial')!);
      expect(initial).toEqual({ opacity: 1 });
    });

    it('sets zero duration and delay when reduced motion preferred', () => {
      mockPrefersReducedMotion.mockReturnValue(true);
      render(<SlideIn duration={1} delay={0.5}>Accessible</SlideIn>);
      const transition = JSON.parse(screen.getByTestId('motion-div').getAttribute('data-transition')!);
      expect(transition.duration).toBe(0);
      expect(transition.delay).toBe(0);
    });
  });

  it('passes through extra props', () => {
    render(<SlideIn className="custom" data-extra="value">Props</SlideIn>);
    const el = screen.getByTestId('motion-div');
    expect(el).toHaveClass('custom');
    expect(el).toHaveAttribute('data-extra', 'value');
  });
});
