import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock Skeleton
vi.mock('~/components/ui/skeleton', () => ({
  Skeleton: ({ variant, className, ...props }: any) => (
    <div
      data-testid="skeleton"
      data-variant={variant}
      className={className}
      {...props}
    />
  ),
}));

import {
  lazyLoad,
  lazyLoadWithRetry,
  preloadComponent,
  createRoutes,
} from './CodeSplitting';

describe('lazyLoad', () => {
  it('renders fallback while loading', () => {
    const importFn = () => new Promise<{ default: React.ComponentType }>(() => {});
    const LazyComp = lazyLoad(importFn);
    render(<LazyComp />);
    // Default fallback is Skeleton
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders component after loading', async () => {
    const TestComponent = () => <div>Loaded</div>;
    const importFn = () => Promise.resolve({ default: TestComponent });
    const LazyComp = lazyLoad(importFn);
    render(<LazyComp />);
    expect(await screen.findByText('Loaded')).toBeInTheDocument();
  });

  it('uses custom fallback', () => {
    const importFn = () => new Promise<{ default: React.ComponentType }>(() => {});
    const LazyComp = lazyLoad(importFn, <div data-testid="custom">Loading...</div>);
    render(<LazyComp />);
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });

  it('passes props to lazy component', async () => {
    const TestComponent = ({ title }: { title: string }) => <div>{title}</div>;
    const importFn = () => Promise.resolve({ default: TestComponent });
    const LazyComp = lazyLoad(importFn);
    render(<LazyComp title="Props Test" />);
    expect(await screen.findByText('Props Test')).toBeInTheDocument();
  });
});

describe('lazyLoadWithRetry', () => {
  it('renders component on successful load', async () => {
    const TestComponent = () => <div>Retried</div>;
    const importFn = () => Promise.resolve({ default: TestComponent });
    const LazyComp = lazyLoadWithRetry(importFn);
    render(<LazyComp />);
    expect(await screen.findByText('Retried')).toBeInTheDocument();
  });

  it('renders fallback while loading', () => {
    const importFn = () => new Promise<{ default: React.ComponentType }>(() => {});
    const LazyComp = lazyLoadWithRetry(importFn);
    render(<LazyComp />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('uses custom fallback', () => {
    const importFn = () => new Promise<{ default: React.ComponentType }>(() => {});
    const LazyComp = lazyLoadWithRetry(importFn, 3, <div data-testid="retry-fb">Retrying</div>);
    render(<LazyComp />);
    expect(screen.getByTestId('retry-fb')).toBeInTheDocument();
  });
});

describe('preloadComponent', () => {
  it('returns object with preload and Component', () => {
    const importFn = () => Promise.resolve({ default: () => <div /> });
    const result = preloadComponent(importFn);
    expect(result.preload).toBeDefined();
    expect(result.Component).toBeDefined();
  });

  it('preload calls import function', () => {
    const importFn = vi.fn(() => Promise.resolve({ default: () => <div /> }));
    const result = preloadComponent(importFn);
    result.preload();
    expect(importFn).toHaveBeenCalled();
  });

  it('preload caches the promise', () => {
    const importFn = vi.fn(() => Promise.resolve({ default: () => <div /> }));
    const result = preloadComponent(importFn);
    result.preload();
    result.preload();
    expect(importFn).toHaveBeenCalledTimes(1);
  });
});

describe('createRoutes', () => {
  it('creates route configs with lazy Components', () => {
    const routes = createRoutes([
      { path: '/dashboard', component: () => Promise.resolve({ default: () => <div /> }) },
      { path: '/settings', component: () => Promise.resolve({ default: () => <div /> }) },
    ]);
    expect(routes.length).toBe(2);
    expect(routes[0].path).toBe('/dashboard');
    expect(routes[1].path).toBe('/settings');
  });

  it('includes preload function when preload is true', () => {
    const routes = createRoutes([
      { path: '/home', component: () => Promise.resolve({ default: () => <div /> }), preload: true },
    ]);
    expect(typeof routes[0].preload).toBe('function');
  });

  it('does not include preload when preload is false', () => {
    const routes = createRoutes([
      { path: '/home', component: () => Promise.resolve({ default: () => <div /> }), preload: false },
    ]);
    expect(routes[0].preload).toBeUndefined();
  });

  it('returns Component function for each route', () => {
    const routes = createRoutes([
      { path: '/test', component: () => Promise.resolve({ default: () => <div /> }) },
    ]);
    expect(typeof routes[0].Component).toBe('function');
  });
});
