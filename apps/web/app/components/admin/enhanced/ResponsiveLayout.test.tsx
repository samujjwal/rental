import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

import {
  useResponsiveMode,
  ResponsiveLayout,
  MobileLayout,
  TabletLayout,
  DesktopLayout,
  AdaptiveContainer,
} from './ResponsiveLayout';

describe('useResponsiveMode', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  function setWidth(w: number) {
    Object.defineProperty(window, 'innerWidth', {
      value: w,
      writable: true,
      configurable: true,
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }

  it('returns mobile for width < 640', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });
    const { result } = renderHook(() => useResponsiveMode());
    expect(result.current).toBe('mobile');
  });

  it('returns tablet for 640 <= width < 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 700, writable: true, configurable: true });
    const { result } = renderHook(() => useResponsiveMode());
    expect(result.current).toBe('tablet');
  });

  it('returns desktop for 768 <= width < 1280', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
    const { result } = renderHook(() => useResponsiveMode());
    expect(result.current).toBe('desktop');
  });

  it('returns wide for width >= 1280', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1440, writable: true, configurable: true });
    const { result } = renderHook(() => useResponsiveMode());
    expect(result.current).toBe('wide');
  });

  it('updates on resize', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
    const { result } = renderHook(() => useResponsiveMode());
    expect(result.current).toBe('desktop');
    setWidth(400);
    expect(result.current).toBe('mobile');
  });

  it('cleans up resize listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useResponsiveMode());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});

describe('ResponsiveLayout', () => {
  function setWidth(w: number) {
    Object.defineProperty(window, 'innerWidth', {
      value: w,
      writable: true,
      configurable: true,
    });
  }

  it('renders mobile component on mobile', () => {
    setWidth(400);
    render(
      <ResponsiveLayout
        mobileComponent={<div>Mobile</div>}
        desktopComponent={<div>Desktop</div>}
      >
        <div>Default</div>
      </ResponsiveLayout>
    );
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.queryByText('Desktop')).not.toBeInTheDocument();
  });

  it('renders tablet component on tablet', () => {
    setWidth(700);
    render(
      <ResponsiveLayout
        tabletComponent={<div>Tablet</div>}
        desktopComponent={<div>Desktop</div>}
      >
        <div>Default</div>
      </ResponsiveLayout>
    );
    expect(screen.getByText('Tablet')).toBeInTheDocument();
  });

  it('renders desktop component on desktop', () => {
    setWidth(1024);
    render(
      <ResponsiveLayout desktopComponent={<div>Desktop</div>}>
        <div>Default</div>
      </ResponsiveLayout>
    );
    expect(screen.getByText('Desktop')).toBeInTheDocument();
  });

  it('renders desktop component on wide', () => {
    setWidth(1440);
    render(
      <ResponsiveLayout desktopComponent={<div>Desktop</div>}>
        <div>Default</div>
      </ResponsiveLayout>
    );
    expect(screen.getByText('Desktop')).toBeInTheDocument();
  });

  it('falls back to children when no specific component provided', () => {
    setWidth(400);
    render(
      <ResponsiveLayout>
        <div>Fallback</div>
      </ResponsiveLayout>
    );
    expect(screen.getByText('Fallback')).toBeInTheDocument();
  });
});

describe('Layout components', () => {
  it('MobileLayout renders children with correct classes', () => {
    const { container } = render(
      <MobileLayout><span>Mobile</span></MobileLayout>
    );
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('px-2', 'py-2');
  });

  it('TabletLayout renders children with correct classes', () => {
    const { container } = render(
      <TabletLayout><span>Tablet</span></TabletLayout>
    );
    expect(screen.getByText('Tablet')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('px-3', 'py-2');
  });

  it('DesktopLayout renders children with correct classes', () => {
    const { container } = render(
      <DesktopLayout><span>Desktop</span></DesktopLayout>
    );
    expect(screen.getByText('Desktop')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('px-4', 'py-3');
  });
});

describe('AdaptiveContainer', () => {
  it('renders children', () => {
    render(<AdaptiveContainer>Content</AdaptiveContainer>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('defaults to xl max-width', () => {
    const { container } = render(
      <AdaptiveContainer>Content</AdaptiveContainer>
    );
    expect(container.firstElementChild).toHaveClass('max-w-screen-xl');
  });

  it('applies sm max-width', () => {
    const { container } = render(
      <AdaptiveContainer maxWidth="sm">Content</AdaptiveContainer>
    );
    expect(container.firstElementChild).toHaveClass('max-w-screen-sm');
  });

  it('applies lg max-width', () => {
    const { container } = render(
      <AdaptiveContainer maxWidth="lg">Content</AdaptiveContainer>
    );
    expect(container.firstElementChild).toHaveClass('max-w-screen-lg');
  });

  it('has no max-width when maxWidth is false', () => {
    const { container } = render(
      <AdaptiveContainer maxWidth={false}>Content</AdaptiveContainer>
    );
    expect(container.firstElementChild).not.toHaveClass('max-w-screen-xl');
  });

  it('has responsive padding classes', () => {
    const { container } = render(
      <AdaptiveContainer>Content</AdaptiveContainer>
    );
    expect(container.firstElementChild).toHaveClass('mx-auto', 'w-full');
  });
});
