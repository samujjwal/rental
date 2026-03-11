import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { mockReducedMotion } = vi.hoisted(() => ({
  mockReducedMotion: { value: false },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className}>{children}</div>
    ),
  },
}));

vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => mockReducedMotion.value,
}));

import { FadeIn, FadeInWhenVisible } from './FadeIn';

describe('FadeIn', () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
  });

  it('renders children', () => {
    render(<FadeIn><div>Fading In</div></FadeIn>);
    expect(screen.getByText('Fading In')).toBeInTheDocument();
  });

  it('renders with direction up', () => {
    render(<FadeIn direction="up"><div>Up</div></FadeIn>);
    expect(screen.getByText('Up')).toBeInTheDocument();
  });

  it('renders with direction down', () => {
    render(<FadeIn direction="down"><div>Down</div></FadeIn>);
    expect(screen.getByText('Down')).toBeInTheDocument();
  });

  it('renders with direction left', () => {
    render(<FadeIn direction="left"><div>Left</div></FadeIn>);
    expect(screen.getByText('Left')).toBeInTheDocument();
  });

  it('renders with direction right', () => {
    render(<FadeIn direction="right"><div>Right</div></FadeIn>);
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('renders with direction none', () => {
    render(<FadeIn direction="none"><div>None</div></FadeIn>);
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('accepts custom delay', () => {
    render(<FadeIn delay={0.5}><div>Delayed</div></FadeIn>);
    expect(screen.getByText('Delayed')).toBeInTheDocument();
  });

  it('accepts custom duration', () => {
    render(<FadeIn duration={1}><div>Slow</div></FadeIn>);
    expect(screen.getByText('Slow')).toBeInTheDocument();
  });

  it('accepts custom distance', () => {
    render(<FadeIn direction="up" distance={40}><div>Far</div></FadeIn>);
    expect(screen.getByText('Far')).toBeInTheDocument();
  });

  it('respects reduced motion', () => {
    mockReducedMotion.value = true;
    render(<FadeIn direction="up"><div>Accessible</div></FadeIn>);
    expect(screen.getByText('Accessible')).toBeInTheDocument();
  });

  it('passes className through', () => {
    const { container } = render(
      <FadeIn className="fade-class"><div>Styled</div></FadeIn>
    );
    expect(container.querySelector('.fade-class')).toBeInTheDocument();
  });
});

describe('FadeInWhenVisible', () => {
  it('renders children', () => {
    render(<FadeInWhenVisible><div>Visible</div></FadeInWhenVisible>);
    expect(screen.getByText('Visible')).toBeInTheDocument();
  });

  it('accepts custom delay', () => {
    render(<FadeInWhenVisible delay={0.3}><div>Delayed</div></FadeInWhenVisible>);
    expect(screen.getByText('Delayed')).toBeInTheDocument();
  });

  it('accepts custom duration', () => {
    render(<FadeInWhenVisible duration={1}><div>Slow</div></FadeInWhenVisible>);
    expect(screen.getByText('Slow')).toBeInTheDocument();
  });
});
