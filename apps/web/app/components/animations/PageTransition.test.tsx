import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { mockReducedMotion } = vi.hoisted(() => ({
  mockReducedMotion: { value: false },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => mockReducedMotion.value,
}));

import { PageTransition, FadeTransition, SlideTransition } from './PageTransition';

function renderWithRouter(ui: React.ReactElement, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {ui}
    </MemoryRouter>
  );
}

describe('PageTransition', () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
  });

  it('renders children', () => {
    renderWithRouter(
      <PageTransition><div>Page Content</div></PageTransition>
    );
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('renders with fade mode', () => {
    renderWithRouter(
      <PageTransition mode="fade"><div>Fade Page</div></PageTransition>
    );
    expect(screen.getByText('Fade Page')).toBeInTheDocument();
  });

  it('renders with slide mode', () => {
    renderWithRouter(
      <PageTransition mode="slide"><div>Slide Page</div></PageTransition>
    );
    expect(screen.getByText('Slide Page')).toBeInTheDocument();
  });

  it('renders with scale mode', () => {
    renderWithRouter(
      <PageTransition mode="scale"><div>Scale Page</div></PageTransition>
    );
    expect(screen.getByText('Scale Page')).toBeInTheDocument();
  });

  it('renders with none mode', () => {
    renderWithRouter(
      <PageTransition mode="none"><div>No Anim</div></PageTransition>
    );
    expect(screen.getByText('No Anim')).toBeInTheDocument();
  });

  it('renders with custom duration', () => {
    renderWithRouter(
      <PageTransition duration={0.5}><div>Custom</div></PageTransition>
    );
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('respects reduced motion preference', () => {
    mockReducedMotion.value = true;
    renderWithRouter(
      <PageTransition><div>Accessible</div></PageTransition>
    );
    expect(screen.getByText('Accessible')).toBeInTheDocument();
  });

  it('renders at different routes', () => {
    renderWithRouter(
      <PageTransition><div>Route Page</div></PageTransition>,
      '/about'
    );
    expect(screen.getByText('Route Page')).toBeInTheDocument();
  });
});

describe('FadeTransition', () => {
  it('renders children with fade animation', () => {
    renderWithRouter(
      <FadeTransition><div>Fade Content</div></FadeTransition>
    );
    expect(screen.getByText('Fade Content')).toBeInTheDocument();
  });
});

describe('SlideTransition', () => {
  it('renders children with slide animation', () => {
    renderWithRouter(
      <SlideTransition><div>Slide Content</div></SlideTransition>
    );
    expect(screen.getByText('Slide Content')).toBeInTheDocument();
  });
});
