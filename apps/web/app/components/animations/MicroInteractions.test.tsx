import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const { mockReducedMotion } = vi.hoisted(() => ({
  mockReducedMotion: { value: false },
}));

vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => mockReducedMotion.value,
}));

import {
  Bounce,
  Shake,
  Pulse,
  Wiggle,
  ExpandOnHover,
  RotateOnHover,
  GlowOnHover,
} from './MicroInteractions';

describe('Bounce', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders children', () => {
    render(<Bounce><span>Bouncy</span></Bounce>);
    expect(screen.getByText('Bouncy')).toBeInTheDocument();
  });

  it('renders with reduced motion', () => {
    mockReducedMotion.value = true;
    render(<Bounce><span>Still</span></Bounce>);
    expect(screen.getByText('Still')).toBeInTheDocument();
  });
});

describe('Shake', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders children', () => {
    render(<Shake><span>Shaky</span></Shake>);
    expect(screen.getByText('Shaky')).toBeInTheDocument();
  });

  it('renders when trigger is true', () => {
    render(<Shake trigger><span>Error field</span></Shake>);
    expect(screen.getByText('Error field')).toBeInTheDocument();
  });

  it('renders when trigger is false (default)', () => {
    render(<Shake><span>Calm</span></Shake>);
    expect(screen.getByText('Calm')).toBeInTheDocument();
  });
});

describe('Pulse', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders children', () => {
    render(<Pulse><span>Notification</span></Pulse>);
    expect(screen.getByText('Notification')).toBeInTheDocument();
  });

  it('supports repeat prop', () => {
    render(<Pulse repeat><span>Repeating</span></Pulse>);
    expect(screen.getByText('Repeating')).toBeInTheDocument();
  });

  it('renders with reduced motion', () => {
    mockReducedMotion.value = true;
    render(<Pulse><span>Static</span></Pulse>);
    expect(screen.getByText('Static')).toBeInTheDocument();
  });
});

describe('Wiggle', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders children', () => {
    render(<Wiggle><span>Attention</span></Wiggle>);
    expect(screen.getByText('Attention')).toBeInTheDocument();
  });

  it('renders when trigger is true', () => {
    render(<Wiggle trigger><span>Look here</span></Wiggle>);
    expect(screen.getByText('Look here')).toBeInTheDocument();
  });

  it('renders with reduced motion', () => {
    mockReducedMotion.value = true;
    render(<Wiggle trigger><span>No wiggle</span></Wiggle>);
    expect(screen.getByText('No wiggle')).toBeInTheDocument();
  });
});

describe('ExpandOnHover', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders children', () => {
    render(<ExpandOnHover><span>Card</span></ExpandOnHover>);
    expect(screen.getByText('Card')).toBeInTheDocument();
  });

  it('accepts custom expandBy prop', () => {
    render(<ExpandOnHover expandBy={1.1}><span>Big expand</span></ExpandOnHover>);
    expect(screen.getByText('Big expand')).toBeInTheDocument();
  });

  it('renders with reduced motion', () => {
    mockReducedMotion.value = true;
    render(<ExpandOnHover><span>No expand</span></ExpandOnHover>);
    expect(screen.getByText('No expand')).toBeInTheDocument();
  });
});

describe('RotateOnHover', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders children', () => {
    render(<RotateOnHover><span>Icon</span></RotateOnHover>);
    expect(screen.getByText('Icon')).toBeInTheDocument();
  });

  it('accepts custom degrees prop', () => {
    render(<RotateOnHover degrees={15}><span>Tilted</span></RotateOnHover>);
    expect(screen.getByText('Tilted')).toBeInTheDocument();
  });

  it('renders with reduced motion', () => {
    mockReducedMotion.value = true;
    render(<RotateOnHover><span>No rotate</span></RotateOnHover>);
    expect(screen.getByText('No rotate')).toBeInTheDocument();
  });
});

describe('GlowOnHover', () => {
  beforeEach(() => { mockReducedMotion.value = false; });

  it('renders children', () => {
    render(<GlowOnHover><span>Glow button</span></GlowOnHover>);
    expect(screen.getByText('Glow button')).toBeInTheDocument();
  });

  it('accepts custom color prop', () => {
    render(
      <GlowOnHover color="rgba(255,0,0,0.5)">
        <span>Red glow</span>
      </GlowOnHover>
    );
    expect(screen.getByText('Red glow')).toBeInTheDocument();
  });

  it('renders with reduced motion', () => {
    mockReducedMotion.value = true;
    render(<GlowOnHover><span>No glow</span></GlowOnHover>);
    expect(screen.getByText('No glow')).toBeInTheDocument();
  });
});
