import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

import {
  useOnlineStatus,
  OfflineBanner,
  SlowConnectionBanner,
  ConnectionIndicator,
} from './offline-banner';
import { renderHook } from '@testing-library/react';

describe('useOnlineStatus', () => {
  beforeEach(() => {
    // Default navigator.onLine to true
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('returns isOnline true when navigator is online', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(false);
  });

  it('detects offline status on offline event', () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);
    expect(result.current.wasOffline).toBe(true);
  });

  it('detects back-online status on online event', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(true);
    // After 3 seconds wasOffline resets
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.wasOffline).toBe(false);
    vi.useRealTimers();
  });

  it('cleans up event listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    removeSpy.mockRestore();
  });
});

describe('OfflineBanner', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('renders nothing when online and was never offline', () => {
    const { container } = render(<OfflineBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('shows offline message when offline event fires', () => {
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it('shows back online message after reconnecting', () => {
    vi.useFakeTimers();
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByText(/You're back online/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('has role alert and aria-live polite', () => {
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('applies custom className', () => {
    render(<OfflineBanner className="custom-banner" />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alert')).toHaveClass('custom-banner');
  });

  it('uses yellow styling when offline', () => {
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-500');
  });

  it('uses green styling when back online', () => {
    vi.useFakeTimers();
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByRole('alert')).toHaveClass('bg-green-500');
    vi.useRealTimers();
  });
});

describe('SlowConnectionBanner', () => {
  it('renders nothing when visible is false', () => {
    const { container } = render(<SlowConnectionBanner visible={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders slow connection message when visible', () => {
    render(<SlowConnectionBanner visible={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Slow connection detected/)).toBeInTheDocument();
  });

  it('has role alert with aria-live polite', () => {
    render(<SlowConnectionBanner visible={true} />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
  });

  it('applies custom className', () => {
    render(<SlowConnectionBanner visible={true} className="custom" />);
    expect(screen.getByRole('alert')).toHaveClass('custom');
  });

  it('uses amber styling', () => {
    render(<SlowConnectionBanner visible={true} />);
    expect(screen.getByRole('alert')).toHaveClass('bg-amber-100');
  });
});

describe('ConnectionIndicator', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('shows green dot when online', () => {
    render(<ConnectionIndicator />);
    const indicator = screen.getByLabelText('Online');
    expect(indicator).toHaveClass('bg-green-500');
  });

  it('shows red dot when offline', () => {
    render(<ConnectionIndicator />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    const indicator = screen.getByLabelText('Offline');
    expect(indicator).toHaveClass('bg-red-500');
  });

  it('has appropriate title attribute', () => {
    render(<ConnectionIndicator />);
    expect(screen.getByLabelText('Online')).toHaveAttribute('title', 'Online');
  });

  it('renders as a span element', () => {
    render(<ConnectionIndicator />);
    expect(screen.getByLabelText('Online').tagName).toBe('SPAN');
  });

  it('applies custom className', () => {
    render(<ConnectionIndicator className="extra" />);
    expect(screen.getByLabelText('Online')).toHaveClass('extra');
  });

  it('is a small rounded dot', () => {
    render(<ConnectionIndicator />);
    const dot = screen.getByLabelText('Online');
    expect(dot).toHaveClass('h-2', 'w-2', 'rounded-full');
  });
});
