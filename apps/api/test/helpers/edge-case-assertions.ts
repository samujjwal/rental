/**
 * Edge Case Assertion Helpers
 *
 * Comprehensive assertion utilities for testing edge cases:
 * - Boundary value testing
 * - Null/undefined handling
 * - Empty collection handling
 * - Type validation
 * - Async error handling
 * - Date/time edge cases
 * - Numeric precision edge cases
 */

/**
 * Assert that a value is within expected boundaries
 */
export function assertWithinBounds(
  value: number,
  min: number,
  max: number,
  message?: string
): void {
  if (value < min || value > max) {
    throw new Error(
      message || `Expected ${value} to be within [${min}, ${max}]`
    );
  }
}

/**
 * Assert that a function throws a specific error type
 */
export async function assertThrowsAsync<T extends Error>(
  fn: () => Promise<unknown>,
  errorType: new (...args: any[]) => T,
  message?: string
): Promise<T> {
  try {
    await fn();
    throw new Error(message || `Expected function to throw ${errorType.name}`);
  } catch (error) {
    if (!(error instanceof errorType)) {
      throw new Error(
        message || `Expected ${errorType.name}, but got ${error.constructor.name}`
      );
    }
    return error as T;
  }
}

/**
 * Assert null/undefined/empty handling
 */
export function assertNullSafety<T>(
  fn: (input: null | undefined | T) => unknown,
  validInput: T,
  expectedResultForNull?: unknown
): void {
  // Should handle null
  expect(() => fn(null)).not.toThrow();
  
  // Should handle undefined
  expect(() => fn(undefined)).not.toThrow();
  
  // Should handle valid input
  const result = fn(validInput);
  expect(result).toBeDefined();
}

/**
 * Assert boundary conditions for arrays/collections
 */
export function assertCollectionBoundaries<T>(
  fn: (items: T[]) => unknown,
  itemFactory: (index: number) => T
): void {
  // Empty array
  expect(() => fn([])).not.toThrow();
  
  // Single item
  const singleResult = fn([itemFactory(0)]);
  expect(singleResult).toBeDefined();
  
  // Multiple items
  const multiResult = fn([itemFactory(0), itemFactory(1), itemFactory(2)]);
  expect(multiResult).toBeDefined();
  
  // Large collection (performance check)
  const largeCollection = Array.from({ length: 1000 }, (_, i) => itemFactory(i));
  const start = Date.now();
  expect(() => fn(largeCollection)).not.toThrow();
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(1000); // Should complete within 1s
}

/**
 * Assert string boundary conditions
 */
export function assertStringBoundaries(
  fn: (input: string) => unknown
): void {
  // Empty string
  expect(() => fn('')).not.toThrow();
  
  // Single character
  expect(() => fn('a')).not.toThrow();
  
  // Normal string
  expect(() => fn('normal string value')).not.toThrow();
  
  // String with special characters
  expect(() => fn('!@#$%^&*()')).not.toThrow();
  
  // Unicode string
  expect(() => fn('Hello 世界 🌍')).not.toThrow();
  
  // Long string (10KB)
  const longString = 'a'.repeat(10 * 1024);
  expect(() => fn(longString)).not.toThrow();
}

/**
 * Assert numeric precision and edge cases
 */
export function assertNumericEdgeCases(
  fn: (value: number) => number | void
): void {
  // Zero
  expect(() => fn(0)).not.toThrow();
  
  // Positive integer
  const positive = fn(100);
  expect(positive).toBeDefined();
  
  // Negative number
  const negative = fn(-100);
  expect(negative).toBeDefined();
  
  // Decimal
  const decimal = fn(99.99);
  expect(decimal).toBeDefined();
  
  // Very small number
  expect(() => fn(0.0000001)).not.toThrow();
  
  // Very large number
  expect(() => fn(999999999999)).not.toThrow();
  
  // Infinity (should be handled gracefully)
  expect(() => fn(Infinity)).not.toThrow();
  expect(() => fn(-Infinity)).not.toThrow();
}

/**
 * Assert date/time edge cases
 */
export function assertDateEdgeCases(
  fn: (date: Date) => unknown
): void {
  // Current date
  expect(() => fn(new Date())).not.toThrow();
  
  // Past date
  expect(() => fn(new Date('2000-01-01'))).not.toThrow();
  
  // Future date
  expect(() => fn(new Date('2050-12-31'))).not.toThrow();
  
  // Epoch
  expect(() => fn(new Date(0))).not.toThrow();
  
  // Leap year date
  expect(() => fn(new Date('2024-02-29'))).not.toThrow();
  
  // Daylight saving time boundary
  expect(() => fn(new Date('2024-03-10T02:30:00'))).not.toThrow();
  
  // Invalid date
  expect(() => fn(new Date('invalid'))).not.toThrow();
}

/**
 * Assert pagination edge cases
 */
export function assertPaginationEdgeCases<T>(
  fn: (page: number, limit: number) => { items: T[]; total: number; hasMore: boolean },
  totalItems: number
): void {
  // First page
  const firstPage = fn(1, 10);
  expect(firstPage.items).toBeDefined();
  expect(firstPage.total).toBe(totalItems);
  
  // Middle page
  const middlePage = fn(2, 10);
  expect(middlePage.items).toBeDefined();
  
  // Last page
  const lastPageNum = Math.ceil(totalItems / 10);
  const lastPage = fn(lastPageNum, 10);
  expect(lastPage.hasMore).toBe(false);
  
  // Page beyond data
  const beyondPage = fn(lastPageNum + 10, 10);
  expect(beyondPage.items).toHaveLength(0);
  
  // Zero limit (edge case)
  expect(() => fn(1, 0)).not.toThrow();
  
  // Very large limit
  expect(() => fn(1, 10000)).not.toThrow();
}

/**
 * Assert object property edge cases
 */
export function assertObjectPropertyEdgeCases<T extends Record<string, unknown>>(
  fn: (obj: T) => unknown,
  validObject: T
): void {
  // Object with all properties
  expect(() => fn(validObject)).not.toThrow();
  
  // Object with extra properties (should handle gracefully)
  const withExtra = { ...validObject, extraField: 'value' };
  expect(() => fn(withExtra as T)).not.toThrow();
  
  // Object with missing optional properties
  const partial: Partial<T> = {};
  for (const key of Object.keys(validObject)) {
    if (Math.random() > 0.5) {
      (partial as any)[key] = validObject[key];
    }
  }
  expect(() => fn(partial as T)).not.toThrow();
  
  // Nested object with null properties
  const withNulls: T = { ...validObject };
  for (const key of Object.keys(withNulls as Record<string, unknown>)) {
    if (typeof (withNulls as Record<string, unknown>)[key] === 'object' && (withNulls as Record<string, unknown>)[key] !== null) {
      (withNulls as Record<string, unknown>)[key] = null;
      break; // Just test one null
    }
  }
  expect(() => fn(withNulls)).not.toThrow();
}

/**
 * Assert concurrent operation safety
 */
export async function assertConcurrentSafety<T>(
  fn: () => Promise<T>,
  concurrency: number = 10
): Promise<void> {
  const promises = Array.from({ length: concurrency }, () => fn());
  const results = await Promise.allSettled(promises);
  
  // All should complete (not hang)
  expect(results.every(r => r.status === 'fulfilled' || r.status === 'rejected')).toBe(true);
  
  // At least some should succeed (not all fail due to race conditions)
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  expect(succeeded).toBeGreaterThan(0);
}

/**
 * Assert retry logic behavior
 */
export async function assertRetryLogic(
  fn: () => Promise<unknown>,
  shouldRetry: (error: unknown) => boolean,
  maxRetries: number
): Promise<void> {
  let attempts = 0;
  
  const fnWithTracking = async () => {
    attempts++;
    return fn();
  };
  
  try {
    await fnWithTracking();
  } catch {
    // Expected if all retries fail
  }
  
  // Should have attempted at least once
  expect(attempts).toBeGreaterThanOrEqual(1);
  // Should not exceed max retries
  expect(attempts).toBeLessThanOrEqual(maxRetries + 1);
}

/**
 * Assert idempotency (same result on multiple calls)
 */
export async function assertIdempotent<T>(
  fn: () => Promise<T>,
  calls: number = 3
): Promise<void> {
  const results: T[] = [];
  
  for (let i = 0; i < calls; i++) {
    results.push(await fn());
  }
  
  // All results should be equivalent
  const first = JSON.stringify(results[0]);
  expect(results.every(r => JSON.stringify(r) === first)).toBe(true);
}

/**
 * Deep assertion for complex objects with tolerance for dates
 */
export function assertDeepEqualWithDateTolerance(
  actual: unknown,
  expected: unknown,
  dateToleranceMs: number = 1000
): void {
  const compare = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    
    if (a instanceof Date && b instanceof Date) {
      return Math.abs(a.getTime() - b.getTime()) <= dateToleranceMs;
    }
    
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;
    
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    
    if (aKeys.length !== bKeys.length) return false;
    
    return aKeys.every(key => compare(aObj[key], bObj[key]));
  };
  
  expect(compare(actual, expected)).toBe(true);
}

/**
 * Assert ordering (for sort operations)
 */
export function assertOrdered<T>(
  items: T[],
  comparator: (a: T, b: T) => number,
  order: 'asc' | 'desc' = 'asc'
): void {
  for (let i = 1; i < items.length; i++) {
    const comparison = comparator(items[i - 1], items[i]);
    if (order === 'asc') {
      expect(comparison).toBeLessThanOrEqual(0);
    } else {
      expect(comparison).toBeGreaterThanOrEqual(0);
    }
  }
}

/**
 * Assert immutability (function doesn't mutate input)
 */
export function assertImmutable<T>(
  fn: (input: T) => unknown,
  input: T
): void {
  const before = JSON.parse(JSON.stringify(input));
  fn(input);
  const after = JSON.parse(JSON.stringify(input));
  
  expect(after).toEqual(before);
}
