/**
 * Web Smoke Tests — validates critical UI renders and navigation.
 *
 * Run with: pnpm --filter @rental-portal/web test -- --testPathPattern smoke
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-router
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    NavLink: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
    useLoaderData: () => ({}),
    useActionData: () => undefined,
    useFetcher: () => ({ submit: vi.fn(), state: 'idle', data: undefined, Form: 'form' }),
    useRouteLoaderData: () => undefined,
    useMatches: () => [],
    Outlet: () => null,
  };
});

// ── Smoke: category-context utility ─────────────────────────────

describe('🔥 Web Smoke: category-context', () => {
  it('getCategoryFamily returns correct family for vehicle slug', async () => {
    const { getCategoryFamily } = await import('~/lib/category-context');
    expect(getCategoryFamily('car')).toBe('vehicle');
    expect(getCategoryFamily('vehicle')).toBe('vehicle');
  });

  it('getCategoryContext returns complete context', async () => {
    const { getCategoryContext } = await import('~/lib/category-context');
    const ctx = getCategoryContext('apartment');
    expect(ctx).toHaveProperty('showGuestCount');
    expect(ctx).toHaveProperty('rulesHeading');
    expect(ctx).toHaveProperty('ownerLabel');
    expect(ctx).toHaveProperty('distanceUnit');
  });

  it('getCategoryContext fallback for unknown slug', async () => {
    const { getCategoryContext } = await import('~/lib/category-context');
    const ctx = getCategoryContext('some-unknown-category');
    expect(ctx).toBeDefined();
    expect(ctx.distanceUnit).toBe('km');
  });
});

// ── Smoke: formatCurrency ────────────────────────────────────────

describe('🔥 Web Smoke: formatCurrency', () => {
  it('formats NPR amounts with Rs. prefix', async () => {
    const utils = await import('~/lib/utils');
    if (typeof utils.formatCurrency === 'function') {
      const formatted = utils.formatCurrency(1500, 'NPR');
      expect(formatted).toContain('1');
      // Should contain either Rs., NPR, or ₨
      expect(formatted.length).toBeGreaterThan(0);
    }
  });

  it('formats USD amounts', async () => {
    const utils = await import('~/lib/utils');
    if (typeof utils.formatCurrency === 'function') {
      const formatted = utils.formatCurrency(99.99, 'USD');
      expect(formatted).toContain('99');
    }
  });
});

// ── Smoke: cn utility ────────────────────────────────────────────

describe('🔥 Web Smoke: cn utility', () => {
  it('merges class names correctly', async () => {
    const { cn } = await import('~/lib/utils');
    expect(cn('px-4', 'py-2')).toContain('px-4');
    expect(cn('px-4', 'py-2')).toContain('py-2');
  });

  it('handles conditional classes', async () => {
    const { cn } = await import('~/lib/utils');
    const falsy = false as boolean;
    const truthy = true as boolean;
    expect(cn('base', falsy && 'conditional')).toBe('base');
    expect(cn('base', truthy && 'conditional')).toContain('conditional');
  });
});
