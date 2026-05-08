/**
 * Cache Manager Component
 * 
 * Manages cache operations for search results.
 * Provides deterministic cache key generation and TTL management.
 */

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
}

@Injectable()
export class CacheManagerComponent {
  private readonly logger = new Logger(CacheManagerComponent.name);
  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor(private readonly cache: CacheService) {}

  /**
   * Generate a deterministic cache key from search query parameters.
   * Uses sorted key ordering to ensure consistent keys regardless of parameter order.
   */
  generateCacheKey(prefix: string, query: Record<string, any>): string {
    // Sort keys to ensure deterministic key generation
    const sortedQuery: Record<string, any> = {};
    const sortedKeys = Object.keys(query).sort();
    for (const key of sortedKeys) {
      sortedQuery[key] = query[key];
    }
    return `${prefix}:${JSON.stringify(sortedQuery)}`;
  }

  /**
   * Get cached search results
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.cache.get<T>(key);
      if (cached) {
        this.logger.debug(`Cache hit for key: ${key}`);
      }
      return cached;
    } catch (error) {
      this.logger.warn(`Cache get failed for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Set cached search results
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const cacheTtl = ttl ?? this.DEFAULT_TTL;
      await this.cache.set(key, value, cacheTtl);
      this.logger.debug(`Cache set for key: ${key} with TTL: ${cacheTtl}s`);
    } catch (error) {
      this.logger.warn(`Cache set failed for key: ${key}`, error);
      // Fail silently - cache failures should not break search functionality
    }
  }

  /**
   * Delete cached search results
   */
  async delete(key: string): Promise<void> {
    try {
      await this.cache.del(key);
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      this.logger.warn(`Cache delete failed for key: ${key}`, error);
    }
  }

  /**
   * Delete cache entries matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      await this.cache.delPattern(pattern);
      this.logger.debug(`Cache deleted for pattern: ${pattern}`);
    } catch (error) {
      this.logger.warn(`Cache pattern delete failed for pattern: ${pattern}`, error);
    }
  }

  /**
   * Invalidate all search-related cache entries
   */
  async invalidateSearchCache(): Promise<void> {
    try {
      await this.cache.delPattern('search:*');
      await this.cache.delPattern('autocomplete:*');
      await this.cache.delPattern('suggestions:*');
      await this.cache.delPattern('similar:*');
      await this.cache.delPattern('popular_searches:*');
      this.logger.log('Search cache invalidated');
    } catch (error) {
      this.logger.warn('Search cache invalidation failed', error);
    }
  }

  /**
   * Get or set pattern - returns cached value if exists, otherwise computes and caches it
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Cache search results with automatic key generation
   */
  async cacheSearchResults<T>(
    query: any,
    results: T,
    options?: CacheOptions,
  ): Promise<void> {
    const key = this.generateCacheKey(options?.prefix || 'search', query);
    await this.set(key, results, options?.ttl);
  }

  /**
   * Get cached search results with automatic key generation
   */
  async getCachedSearchResults<T>(
    query: any,
    options?: CacheOptions,
  ): Promise<T | null> {
    const key = this.generateCacheKey(options?.prefix || 'search', query);
    return this.get<T>(key);
  }

  /**
   * Check if cache is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const testKey = 'cache:health_check';
      await this.cache.set(testKey, 'ok', 10);
      const value = await this.cache.get(testKey);
      await this.cache.del(testKey);
      return value === 'ok';
    } catch (error) {
      this.logger.warn('Cache health check failed', error);
      return false;
    }
  }
}
