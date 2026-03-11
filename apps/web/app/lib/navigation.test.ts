import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestNavigation, requestRevalidate } from './navigation';

describe('navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestNavigation', () => {
    it('dispatches app:navigate custom event', () => {
      const spy = vi.spyOn(window, 'dispatchEvent');
      requestNavigation('/dashboard');
      expect(spy).toHaveBeenCalledTimes(1);
      const event = spy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('app:navigate');
      expect(event.detail).toEqual({ to: '/dashboard', replace: false });
    });

    it('passes replace option when true', () => {
      const spy = vi.spyOn(window, 'dispatchEvent');
      requestNavigation('/login', { replace: true });
      const event = spy.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ to: '/login', replace: true });
    });

    it('defaults replace to false when options omitted', () => {
      const spy = vi.spyOn(window, 'dispatchEvent');
      requestNavigation('/home');
      const event = spy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.replace).toBe(false);
    });

    it('defaults replace to false when replace is undefined', () => {
      const spy = vi.spyOn(window, 'dispatchEvent');
      requestNavigation('/page', {});
      const event = spy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.replace).toBe(false);
    });

    it('works with event listener receiving event', () => {
      let received: CustomEvent | null = null;
      const handler = (e: Event) => { received = e as CustomEvent; };
      window.addEventListener('app:navigate', handler);
      requestNavigation('/test-path', { replace: true });
      window.removeEventListener('app:navigate', handler);
      expect(received).not.toBeNull();
      expect(received!.detail).toEqual({ to: '/test-path', replace: true });
    });
  });

  describe('requestRevalidate', () => {
    it('dispatches app:revalidate custom event', () => {
      const spy = vi.spyOn(window, 'dispatchEvent');
      requestRevalidate();
      expect(spy).toHaveBeenCalledTimes(1);
      const event = spy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('app:revalidate');
    });

    it('event has no detail', () => {
      const spy = vi.spyOn(window, 'dispatchEvent');
      requestRevalidate();
      const event = spy.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toBeNull();
    });

    it('works with event listener', () => {
      let called = false;
      const handler = () => { called = true; };
      window.addEventListener('app:revalidate', handler);
      requestRevalidate();
      window.removeEventListener('app:revalidate', handler);
      expect(called).toBe(true);
    });
  });
});
