import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

import { LiveRegion, useAnnounce } from './LiveRegion';

describe('LiveRegion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders message text', () => {
    render(<LiveRegion message="Update available" />);
    expect(screen.getByText('Update available')).toBeInTheDocument();
  });

  it('has role status', () => {
    render(<LiveRegion message="Status update" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('defaults to polite aria-live', () => {
    render(<LiveRegion message="Polite" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('supports assertive priority', () => {
    render(<LiveRegion message="Urgent" priority="assertive" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive');
  });

  it('has aria-atomic true', () => {
    render(<LiveRegion message="Atomic" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  });

  it('has sr-only class', () => {
    render(<LiveRegion message="Hidden" />);
    expect(screen.getByRole('status')).toHaveClass('sr-only');
  });

  it('clears message after clearAfter timeout', () => {
    render(<LiveRegion message="Temporary" clearAfter={1000} />);
    expect(screen.getByRole('status').textContent).toBe('Temporary');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('uses default 1000ms clearAfter', () => {
    render(<LiveRegion message="Default clear" />);
    expect(screen.getByRole('status').textContent).toBe('Default clear');
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByRole('status').textContent).toBe('Default clear');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('renders empty string without starting timer', () => {
    render(<LiveRegion message="" />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});

describe('useAnnounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns announce function', () => {
    const { result } = renderHook(() => useAnnounce());
    expect(typeof result.current.announce).toBe('function');
  });

  it('creates announcement element in document body', () => {
    const { result } = renderHook(() => useAnnounce());
    act(() => {
      result.current.announce('Hello world');
    });
    const announcement = document.querySelector('[role="status"][aria-live="polite"]');
    expect(announcement).toBeInTheDocument();
    expect(announcement!.textContent).toBe('Hello world');
    // Cleanup
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });

  it('creates assertive announcement', () => {
    const { result } = renderHook(() => useAnnounce());
    act(() => {
      result.current.announce('Alert!', 'assertive');
    });
    const announcement = document.querySelector('[aria-live="assertive"]');
    expect(announcement).toBeInTheDocument();
    expect(announcement!.textContent).toBe('Alert!');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });

  it('removes announcement after 1 second', () => {
    const { result } = renderHook(() => useAnnounce());
    act(() => {
      result.current.announce('Temporary');
    });
    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // The announcement element should have been removed
    const remaining = document.querySelectorAll('[aria-live="polite"][aria-atomic="true"]');
    // After removal, there should be fewer
    expect(remaining.length).toBe(0);
  });

  it('announcement has sr-only class', () => {
    const { result } = renderHook(() => useAnnounce());
    act(() => {
      result.current.announce('Screen Reader Only');
    });
    const announcement = document.querySelector('[role="status"][aria-live="polite"]');
    expect(announcement).toHaveClass('sr-only');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });
});
