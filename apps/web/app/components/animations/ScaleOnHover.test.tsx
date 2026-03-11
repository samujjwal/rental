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

import { ScaleOnHover, PressableScale, FloatOnHover } from './ScaleOnHover';

describe('ScaleOnHover', () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
  });

  it('renders children', () => {
    render(<ScaleOnHover><div>Hover Me</div></ScaleOnHover>);
    expect(screen.getByText('Hover Me')).toBeInTheDocument();
  });

  it('accepts custom scale', () => {
    render(<ScaleOnHover scale={1.1}><div>Scaled</div></ScaleOnHover>);
    expect(screen.getByText('Scaled')).toBeInTheDocument();
  });

  it('accepts custom tapScale', () => {
    render(<ScaleOnHover tapScale={0.9}><div>Tap</div></ScaleOnHover>);
    expect(screen.getByText('Tap')).toBeInTheDocument();
  });

  it('accepts custom duration', () => {
    render(<ScaleOnHover duration={0.5}><div>Duration</div></ScaleOnHover>);
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });

  it('respects reduced motion', () => {
    mockReducedMotion.value = true;
    render(<ScaleOnHover><div>Accessible</div></ScaleOnHover>);
    expect(screen.getByText('Accessible')).toBeInTheDocument();
  });

  it('passes className through', () => {
    const { container } = render(
      <ScaleOnHover className="test-class"><div>Styled</div></ScaleOnHover>
    );
    expect(container.querySelector('.test-class')).toBeInTheDocument();
  });
});

describe('PressableScale', () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
  });

  it('renders children', () => {
    render(<PressableScale><div>Press Me</div></PressableScale>);
    expect(screen.getByText('Press Me')).toBeInTheDocument();
  });

  it('accepts custom scale', () => {
    render(<PressableScale scale={0.9}><div>Press</div></PressableScale>);
    expect(screen.getByText('Press')).toBeInTheDocument();
  });

  it('accepts custom duration', () => {
    render(<PressableScale duration={0.2}><div>Fast</div></PressableScale>);
    expect(screen.getByText('Fast')).toBeInTheDocument();
  });

  it('respects reduced motion', () => {
    mockReducedMotion.value = true;
    render(<PressableScale><div>A11y</div></PressableScale>);
    expect(screen.getByText('A11y')).toBeInTheDocument();
  });
});

describe('FloatOnHover', () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
  });

  it('renders children', () => {
    render(<FloatOnHover><div>Float</div></FloatOnHover>);
    expect(screen.getByText('Float')).toBeInTheDocument();
  });

  it('accepts custom distance', () => {
    render(<FloatOnHover distance={-10}><div>Far</div></FloatOnHover>);
    expect(screen.getByText('Far')).toBeInTheDocument();
  });

  it('accepts custom duration', () => {
    render(<FloatOnHover duration={0.5}><div>Slow</div></FloatOnHover>);
    expect(screen.getByText('Slow')).toBeInTheDocument();
  });

  it('respects reduced motion', () => {
    mockReducedMotion.value = true;
    render(<FloatOnHover><div>Still</div></FloatOnHover>);
    expect(screen.getByText('Still')).toBeInTheDocument();
  });
});
