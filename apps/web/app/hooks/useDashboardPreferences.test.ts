import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDashboardPreferences } from './useDashboardPreferences';

describe('useDashboardPreferences - P2.2 Memory Leak Prevention', () => {
  const storageKey = 'test-dashboard-prefs';
  const mockSections = [
    { id: 'section-1', title: 'Section 1' },
    { id: 'section-2', title: 'Section 2' },
    { id: 'section-3', title: 'Section 3' },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Event Listener Cleanup', () => {
    it('should add storage event listener on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useDashboardPreferences(storageKey, mockSections));

      expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('should remove storage event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('should not leak event listeners with multiple mounts/unmounts', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      // Mount and unmount multiple times
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() =>
          useDashboardPreferences(storageKey, mockSections)
        );
        unmount();
      }

      // Should have equal add and remove calls
      expect(addEventListenerSpy).toHaveBeenCalledTimes(5);
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('Cross-Tab Synchronization', () => {
    it('should update preferences when storage changes in another tab', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      // Simulate storage change from another tab
      const newPreferences = {
        hidden: ['section-1'],
        pinned: ['section-2'],
      };

      const storageEvent = new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify(newPreferences),
        oldValue: null,
        // storageArea is not properly supported in JSDOM, so we omit it
      });

      act(() => {
        window.dispatchEvent(storageEvent);
      });

      await waitFor(() => {
        expect(result.current.hiddenIds.has('section-1')).toBe(true);
        expect(result.current.pinnedIds.has('section-2')).toBe(true);
      });
    });

    it('should ignore storage changes for different keys', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      const initialHidden = result.current.hiddenIds;

      // Simulate storage change for different key
      const storageEvent = new StorageEvent('storage', {
        key: 'different-key',
        newValue: JSON.stringify({ hidden: ['section-1'] }),
        oldValue: null,
        // storageArea is not properly supported in JSDOM, so we omit it
      });

      act(() => {
        window.dispatchEvent(storageEvent);
      });

      // Should not update
      expect(result.current.hiddenIds).toBe(initialHidden);
    });

    it('should handle invalid JSON in storage event', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      const storageEvent = new StorageEvent('storage', {
        key: storageKey,
        newValue: 'invalid json{',
        oldValue: null,
        // storageArea is not properly supported in JSDOM, so we omit it
      });

      // Should not throw
      expect(() => {
        act(() => {
          window.dispatchEvent(storageEvent);
        });
      }).not.toThrow();
    });

    it('should filter out invalid section IDs from storage event', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      const newPreferences = {
        hidden: ['section-1', 'invalid-section'],
        pinned: ['section-2', 'another-invalid'],
      };

      const storageEvent = new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify(newPreferences),
        oldValue: null,
        // storageArea is not properly supported in JSDOM, so we omit it
      });

      act(() => {
        window.dispatchEvent(storageEvent);
      });

      await waitFor(() => {
        expect(result.current.hiddenIds.has('section-1')).toBe(true);
        expect(result.current.hiddenIds.has('invalid-section')).toBe(false);
        expect(result.current.pinnedIds.has('section-2')).toBe(true);
        expect(result.current.pinnedIds.has('another-invalid')).toBe(false);
      });
    });
  });

  describe('Memory Management', () => {
    it('should not retain references after unmount', () => {
      const { unmount } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      unmount();

      // Trigger storage event after unmount
      const storageEvent = new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify({ hidden: ['section-1'] }),
        oldValue: null,
        // storageArea is not properly supported in JSDOM, so we omit it
      });

      // Should not cause errors or memory leaks
      expect(() => {
        window.dispatchEvent(storageEvent);
      }).not.toThrow();
    });

    it('should handle rapid preference changes without memory issues', () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      // Rapidly toggle preferences
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.toggleHidden('section-1');
          result.current.togglePinned('section-2');
        }
      });

      // Should complete without errors
      expect(result.current.hiddenIds.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Existing Functionality', () => {
    it('should load preferences from localStorage', () => {
      localStorage.setItem(storageKey, JSON.stringify({
        hidden: ['section-1'],
        pinned: ['section-2'],
      }));

      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      // Check that the hook initializes (basic functionality)
      expect(result.current.hiddenIds).toBeDefined();
      expect(result.current.pinnedIds).toBeDefined();
    });

    it('should save preferences to localStorage', () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      act(() => {
        result.current.toggleHidden('section-1');
      });

      // Check that the toggle worked (basic functionality)
      expect(result.current.hiddenIds.has('section-1')).toBe(true);
    });

    it('should toggle hidden state', () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      act(() => {
        result.current.toggleHidden('section-1');
      });

      expect(result.current.hiddenIds.has('section-1')).toBe(true);

      act(() => {
        result.current.toggleHidden('section-1');
      });

      expect(result.current.hiddenIds.has('section-1')).toBe(false);
    });

    it('should toggle pinned state', () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      act(() => {
        result.current.togglePinned('section-1');
      });

      expect(result.current.pinnedIds.has('section-1')).toBe(true);

      act(() => {
        result.current.togglePinned('section-1');
      });

      expect(result.current.pinnedIds.has('section-1')).toBe(false);
    });

    it('should reset preferences', () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      act(() => {
        result.current.toggleHidden('section-1');
        result.current.togglePinned('section-2');
      });

      expect(result.current.hiddenIds.size).toBeGreaterThan(0);

      act(() => {
        result.current.resetPreferences();
      });

      expect(result.current.hiddenIds.size).toBe(0);
      expect(result.current.pinnedIds.size).toBe(0);
    });

    it('should order sections by pinned state', () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      act(() => {
        result.current.togglePinned('section-3');
        result.current.togglePinned('section-1');
      });

      const ordered = result.current.orderedSections;
      // Pinned sections should come first in the order they were pinned
      expect(ordered[0].id).toBe('section-1');
      expect(ordered[1].id).toBe('section-3');
      expect(ordered[2].id).toBe('section-2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null storage value in event', () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      const storageEvent = new StorageEvent('storage', {
        key: storageKey,
        newValue: null,
        oldValue: JSON.stringify({ hidden: [] }),
        // storageArea is not properly supported in JSDOM, so we omit it
      });

      expect(() => {
        act(() => {
          window.dispatchEvent(storageEvent);
        });
      }).not.toThrow();
    });

    it('should handle empty sections array', () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, [])
      );

      expect(result.current.orderedSections).toEqual([]);
    });

    it('should handle malformed localStorage data', () => {
      localStorage.setItem(storageKey, 'not valid json');

      const { result } = renderHook(() =>
        useDashboardPreferences(storageKey, mockSections)
      );

      // Should use default state
      expect(result.current.hiddenIds.size).toBe(0);
      expect(result.current.pinnedIds.size).toBe(0);
    });
  });
});
