import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock PageLoading
vi.mock('~/components/ui/loading', () => ({
  PageLoading: () => <div data-testid="page-loading">Loading...</div>,
}));

import {
  createLazyRoute,
  usePreloadOnHover,
  PreloadLink,
  RouteFallbacks,
} from './LazyRoute';

// Helper component for testing hook
function PreloadHookTester({ preloadFn }: { preloadFn: () => Promise<unknown> }) {
  const { onMouseEnter } = usePreloadOnHover(preloadFn);
  return <div data-testid="hover-target" onMouseEnter={onMouseEnter} />;
}

describe('createLazyRoute', () => {
  it('renders fallback while loading', () => {
    const importFn = () => new Promise<{ default: React.ComponentType }>(() => {});
    const LazyRoute = createLazyRoute(importFn);
    render(<LazyRoute />);
    expect(screen.getByTestId('page-loading')).toBeInTheDocument();
  });

  it('renders the lazy component after loading', async () => {
    const TestComponent = () => <div>Loaded Component</div>;
    const importFn = () => Promise.resolve({ default: TestComponent });
    const LazyRoute = createLazyRoute(importFn);
    render(<LazyRoute />);
    expect(await screen.findByText('Loaded Component')).toBeInTheDocument();
  });

  it('uses custom fallback when provided', () => {
    const importFn = () => new Promise<{ default: React.ComponentType }>(() => {});
    const LazyRoute = createLazyRoute(importFn, {
      fallback: <div data-testid="custom-fallback">Custom Loading</div>,
    });
    render(<LazyRoute />);
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
  });

  it('attaches preload function', () => {
    const importFn = vi.fn(() => Promise.resolve({ default: () => <div /> }));
    const LazyRoute = createLazyRoute(importFn);
    expect(LazyRoute.preload).toBe(importFn);
  });

  it('calls import function immediately when preload is true', () => {
    const importFn = vi.fn(() => Promise.resolve({ default: () => <div /> }));
    createLazyRoute(importFn, { preload: true });
    // Called once for lazy() and once for preload
    expect(importFn).toHaveBeenCalled();
  });

  it('passes props through to lazy component', async () => {
    const TestComponent = ({ title }: { title: string }) => <div>{title}</div>;
    const importFn = () => Promise.resolve({ default: TestComponent });
    const LazyRoute = createLazyRoute(importFn);
    render(<LazyRoute title="Hello" />);
    expect(await screen.findByText('Hello')).toBeInTheDocument();
  });
});

describe('usePreloadOnHover', () => {
  it('calls preload function on first mouse enter', () => {
    const preloadFn = vi.fn(() => Promise.resolve());
    render(<PreloadHookTester preloadFn={preloadFn} />);
    fireEvent.mouseEnter(screen.getByTestId('hover-target'));
    expect(preloadFn).toHaveBeenCalledTimes(1);
  });

  it('only preloads once on multiple hovers', () => {
    const preloadFn = vi.fn(() => Promise.resolve());
    render(<PreloadHookTester preloadFn={preloadFn} />);
    fireEvent.mouseEnter(screen.getByTestId('hover-target'));
    fireEvent.mouseEnter(screen.getByTestId('hover-target'));
    fireEvent.mouseEnter(screen.getByTestId('hover-target'));
    expect(preloadFn).toHaveBeenCalledTimes(1);
  });
});

describe('PreloadLink', () => {
  it('renders an anchor tag with correct href', () => {
    render(
      <PreloadLink to="/test">Click me</PreloadLink>
    );
    const link = screen.getByText('Click me');
    expect(link.closest('a')).toHaveAttribute('href', '/test');
  });

  it('calls preload on mouse enter', () => {
    const preloadFn = vi.fn(() => Promise.resolve());
    render(
      <PreloadLink to="/test" preload={preloadFn}>
        Hover me
      </PreloadLink>
    );
    fireEvent.mouseEnter(screen.getByText('Hover me').closest('a')!);
    expect(preloadFn).toHaveBeenCalledTimes(1);
  });

  it('works without preload prop', () => {
    render(
      <PreloadLink to="/test">No preload</PreloadLink>
    );
    // Should not throw
    fireEvent.mouseEnter(screen.getByText('No preload').closest('a')!);
  });

  it('passes additional html attributes', () => {
    render(
      <PreloadLink to="/test" className="custom" data-testid="custom-link">
        Styled
      </PreloadLink>
    );
    const link = screen.getByTestId('custom-link');
    expect(link).toHaveClass('custom');
  });
});

describe('RouteFallbacks', () => {
  it('renders Dashboard fallback with skeleton grid', () => {
    const { container } = render(<RouteFallbacks.Dashboard />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThanOrEqual(5);
  });

  it('renders Listing fallback with image and content skeleton', () => {
    const { container } = render(<RouteFallbacks.Listing />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThanOrEqual(4);
  });

  it('renders Form fallback with input skeletons', () => {
    const { container } = render(<RouteFallbacks.Form />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThanOrEqual(5);
  });

  it('renders Messages fallback with sidebar and main area', () => {
    const { container } = render(<RouteFallbacks.Messages />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThanOrEqual(5);
  });

  it('Dashboard fallback has 4 grid cards', () => {
    const { container } = render(<RouteFallbacks.Dashboard />);
    const gridCards = container.querySelectorAll('.h-24');
    expect(gridCards.length).toBe(4);
  });

  it('Messages fallback has conversation list items', () => {
    const { container } = render(<RouteFallbacks.Messages />);
    const avatars = container.querySelectorAll('.rounded-full');
    expect(avatars.length).toBe(5);
  });
});
