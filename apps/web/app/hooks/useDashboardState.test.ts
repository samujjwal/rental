import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDashboardState } from './useDashboardState';

describe('useDashboardState - P0.1 State Synchronization Fix', () => {
  const createMockBooking = (status: string, createdAt: string): any => ({
    id: Math.random().toString(),
    status,
    createdAt,
    startDate: '2024-01-01',
    endDate: '2024-01-02',
    totalAmount: 100,
  });

  describe('User Activity Level Calculation', () => {
    it('should return "new" for users with no bookings', () => {
      const { result } = renderHook(() => useDashboardState([]));
      
      expect(result.current.userActivityLevel).toBe('new');
      expect(result.current.showFirstTimeHelp).toBe(true);
    });

    it('should return "returning" for users with 1 completed booking', () => {
      const bookings = [createMockBooking('COMPLETED', '2024-01-01')];
      const { result } = renderHook(() => useDashboardState(bookings));
      
      expect(result.current.userActivityLevel).toBe('returning');
      expect(result.current.showFirstTimeHelp).toBe(false);
    });

    it('should return "active" for users with 2-4 completed bookings', () => {
      const bookings = [
        createMockBooking('COMPLETED', '2024-01-01'),
        createMockBooking('COMPLETED', '2024-01-02'),
        createMockBooking('PENDING', '2024-01-03'),
      ];
      const { result } = renderHook(() => useDashboardState(bookings));
      
      expect(result.current.userActivityLevel).toBe('active');
    });

    it('should return "experienced" for users with 5+ completed bookings', () => {
      const bookings = Array.from({ length: 6 }, (_, i) =>
        createMockBooking('COMPLETED', `2024-01-${i + 1}`)
      );
      const { result } = renderHook(() => useDashboardState(bookings));
      
      expect(result.current.userActivityLevel).toBe('experienced');
    });

    it('should handle SETTLED status as completed', () => {
      const bookings = [
        createMockBooking('SETTLED', '2024-01-01'),
        createMockBooking('SETTLED', '2024-01-02'),
      ];
      const { result } = renderHook(() => useDashboardState(bookings));
      
      expect(result.current.userActivityLevel).toBe('active');
    });
  });

  describe('Personalized Recommendations', () => {
    it('should provide "Getting Started" recommendations for new users', () => {
      const { result } = renderHook(() => useDashboardState([]));
      
      expect(result.current.personalizedRecommendations).toEqual({
        title: 'Getting Started',
        description: 'Discover popular items in your area',
        actionText: 'Browse Popular',
        actionUrl: '/search?sort=popular',
      });
    });

    it('should provide "Expand Your Horizons" for experienced users', () => {
      const bookings = Array.from({ length: 6 }, (_, i) =>
        createMockBooking('COMPLETED', `2024-01-${i + 1}`)
      );
      const { result } = renderHook(() => useDashboardState(bookings));
      
      expect(result.current.personalizedRecommendations).toEqual({
        title: 'Expand Your Horizons',
        description: 'Try new categories and experiences',
        actionText: 'Explore Categories',
        actionUrl: '/search',
      });
    });

    it('should provide "Continue Your Journey" for active/returning users', () => {
      const bookings = [
        createMockBooking('COMPLETED', '2024-01-01'),
        createMockBooking('COMPLETED', '2024-01-02'),
      ];
      const { result } = renderHook(() => useDashboardState(bookings));
      
      expect(result.current.personalizedRecommendations).toEqual({
        title: 'Continue Your Journey',
        description: 'Find items similar to your bookings',
        actionText: 'Find Similar',
        actionUrl: '/search',
      });
    });
  });

  describe('State Consistency - No Race Conditions', () => {
    it('should compute all derived state in single pass', () => {
      const bookings = [createMockBooking('COMPLETED', '2024-01-01')];
      const { result, rerender } = renderHook(
        ({ bookings }) => useDashboardState(bookings),
        { initialProps: { bookings } }
      );
      
      const firstRender = result.current;
      
      // Rerender with same data should return same reference (memoized)
      rerender({ bookings });
      
      expect(result.current).toBe(firstRender);
    });

    it('should update all derived state atomically when bookings change', () => {
      const { result, rerender } = renderHook(
        ({ bookings }: { bookings: any[] }) => useDashboardState(bookings),
        { initialProps: { bookings: [] as any[] } }
      );
      
      // Initial state: new user
      expect(result.current.userActivityLevel).toBe('new');
      expect(result.current.personalizedRecommendations.title).toBe('Getting Started');
      
      // Update to active user
      const activeBookings: any[] = [
        createMockBooking('COMPLETED', '2024-01-01'),
        createMockBooking('COMPLETED', '2024-01-02'),
      ];
      rerender({ bookings: activeBookings });
      
      // All state should update together - no stale closures
      expect(result.current.userActivityLevel).toBe('active');
      expect(result.current.personalizedRecommendations.title).toBe('Continue Your Journey');
      expect(result.current.showFirstTimeHelp).toBe(false);
    });

    it('should handle rapid state changes without inconsistency', () => {
      const { result, rerender } = renderHook(
        ({ bookings }: { bookings: any[] }) => useDashboardState(bookings),
        { initialProps: { bookings: [] as any[] } }
      );
      
      // Simulate rapid changes
      const states: any[][] = [
        [],
        [createMockBooking('COMPLETED', '2024-01-01')],
        [
          createMockBooking('COMPLETED', '2024-01-01'),
          createMockBooking('COMPLETED', '2024-01-02'),
        ],
        Array.from({ length: 6 }, (_, i) =>
          createMockBooking('COMPLETED', `2024-01-${i + 1}`)
        ),
      ];
      
      const expectedLevels = ['new', 'returning', 'active', 'experienced'];
      
      states.forEach((bookings, index) => {
        rerender({ bookings });
        expect(result.current.userActivityLevel).toBe(expectedLevels[index]);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle bookings with invalid status', () => {
      const bookings = [
        createMockBooking('INVALID_STATUS', '2024-01-01'),
        createMockBooking('', '2024-01-02'),
      ];
      const { result } = renderHook(() => useDashboardState(bookings));
      
      // Should treat invalid statuses as not completed
      expect(result.current.userActivityLevel).toBe('returning');
    });

    it('should handle mixed status bookings correctly', () => {
      const bookings = [
        createMockBooking('COMPLETED', '2024-01-01'),
        createMockBooking('PENDING', '2024-01-02'),
        createMockBooking('CANCELLED', '2024-01-03'),
        createMockBooking('SETTLED', '2024-01-04'),
      ];
      const { result } = renderHook(() => useDashboardState(bookings));
      
      // Should count only COMPLETED and SETTLED (2 total)
      expect(result.current.userActivityLevel).toBe('active');
    });

    it('should memoize results to prevent unnecessary recalculations', () => {
      const bookings = [createMockBooking('COMPLETED', '2024-01-01')];
      const { result, rerender } = renderHook(
        ({ bookings }) => useDashboardState(bookings),
        { initialProps: { bookings } }
      );
      
      const firstResult = result.current;
      
      // Multiple rerenders with same reference should return same object
      rerender({ bookings });
      rerender({ bookings });
      rerender({ bookings });
      
      expect(result.current).toBe(firstResult);
    });
  });
});
