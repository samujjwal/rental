/**
 * Filter Processor Component
 * 
 * Processes and validates search filters.
 * Ensures filter values are sanitized and applied correctly.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SearchQuery } from '../services/search.service';

export interface ProcessedFilters {
  bookingMode?: string;
  condition?: string;
  features?: string[];
  amenities?: string[];
  delivery?: boolean;
  categoryId?: string;
  priceRange?: { min?: number; max?: number };
  location?: SearchQuery['location'];
  dates?: SearchQuery['dates'];
}

@Injectable()
export class FilterProcessorComponent {
  private readonly logger = new Logger(FilterProcessorComponent.name);

  /**
   * Process and sanitize all filters from the search query
   */
  processFilters(query: SearchQuery): ProcessedFilters {
    const processed: ProcessedFilters = {};

    // Process booking mode
    if (query.filters?.bookingMode) {
      processed.bookingMode = this.sanitizeBookingMode(query.filters.bookingMode);
    }

    // Process condition
    if (query.filters?.condition) {
      processed.condition = this.sanitizeCondition(query.filters.condition);
    }

    // Process features
    if (query.filters?.features && query.filters.features.length > 0) {
      processed.features = this.sanitizeArray(query.filters.features);
    }

    // Process amenities
    if (query.filters?.amenities && query.filters.amenities.length > 0) {
      processed.amenities = this.sanitizeArray(query.filters.amenities);
    }

    // Process delivery flag
    if (query.filters?.delivery !== undefined) {
      processed.delivery = Boolean(query.filters.delivery);
    }

    // Process category ID
    if (query.categoryId) {
      processed.categoryId = this.sanitizeString(query.categoryId);
    }

    // Process price range
    if (query.priceRange) {
      processed.priceRange = this.sanitizePriceRange(query.priceRange);
    }

    // Process location
    if (query.location) {
      processed.location = this.sanitizeLocation(query.location);
    }

    // Process dates
    if (query.dates) {
      processed.dates = this.sanitizeDates(query.dates);
    }

    return processed;
  }

  /**
   * Sanitize booking mode value
   */
  private sanitizeBookingMode(value: string): string {
    const validModes = ['REQUEST', 'INSTANT', 'INQUIRY'];
    const upperValue = value.toUpperCase();
    return validModes.includes(upperValue) ? upperValue : 'REQUEST';
  }

  /**
   * Sanitize condition value
   */
  private sanitizeCondition(value: string): string {
    const validConditions = ['NEW', 'GOOD', 'FAIR', 'EXCELLENT', 'LIKE_NEW'];
    const upperValue = value.toUpperCase();
    return validConditions.includes(upperValue) ? upperValue : undefined;
  }

  /**
   * Sanitize array of strings
   */
  private sanitizeArray(arr: string[]): string[] {
    return arr
      .filter(Boolean)
      .map((item) => this.sanitizeString(item))
      .filter(Boolean);
  }

  /**
   * Sanitize string value
   */
  private sanitizeString(value: string): string {
    return value.trim().substring(0, 255);
  }

  /**
   * Sanitize price range
   */
  private sanitizePriceRange(range: SearchQuery['priceRange']): { min?: number; max?: number } {
    const sanitized: { min?: number; max?: number } = {};

    if (range.min !== undefined) {
      sanitized.min = Math.max(0, Number(range.min) || 0);
    }
    if (range.max !== undefined) {
      sanitized.max = Math.max(0, Number(range.max) || 0);
    }

    // Ensure min <= max
    if (sanitized.min !== undefined && sanitized.max !== undefined && sanitized.min > sanitized.max) {
      [sanitized.min, sanitized.max] = [sanitized.max, sanitized.min];
    }

    return sanitized;
  }

  /**
   * Sanitize location parameters
   */
  private sanitizeLocation(location: SearchQuery['location']): SearchQuery['location'] {
    const sanitized: SearchQuery['location'] = {};

    if (location.city) {
      sanitized.city = this.sanitizeString(location.city);
    }
    if (location.state) {
      sanitized.state = this.sanitizeString(location.state);
    }
    if (location.country) {
      sanitized.country = this.sanitizeString(location.country);
    }
    if (location.lat !== undefined) {
      sanitized.lat = Math.max(-90, Math.min(90, Number(location.lat) || 0));
    }
    if (location.lon !== undefined) {
      sanitized.lon = Math.max(-180, Math.min(180, Number(location.lon) || 0));
    }
    if (location.radius) {
      sanitized.radius = location.radius;
    }

    return sanitized;
  }

  /**
   * Sanitize date range
   */
  private sanitizeDates(dates: SearchQuery['dates']): SearchQuery['dates'] {
    const startDate = dates.startDate instanceof Date ? dates.startDate : new Date(dates.startDate);
    const endDate = dates.endDate instanceof Date ? dates.endDate : new Date(dates.endDate);

    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      this.logger.warn('Invalid date range provided, skipping date filter');
      return undefined;
    }

    // Ensure startDate <= endDate
    if (startDate > endDate) {
      this.logger.warn('Start date after end date, swapping');
      return { startDate: endDate, endDate: startDate };
    }

    return { startDate, endDate };
  }

  /**
   * Validate that filters are internally consistent
   */
  validateFilters(filters: ProcessedFilters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate price range
    if (filters.priceRange?.min && filters.priceRange?.max && filters.priceRange.min > filters.priceRange.max) {
      errors.push('Price range minimum cannot exceed maximum');
    }

    // Validate dates
    if (filters.dates?.startDate && filters.dates?.endDate && filters.dates.startDate > filters.dates.endDate) {
      errors.push('Start date cannot be after end date');
    }

    // Validate coordinates
    if (filters.location?.lat && (filters.location.lat < -90 || filters.location.lat > 90)) {
      errors.push('Latitude must be between -90 and 90');
    }
    if (filters.location?.lon && (filters.location.lon < -180 || filters.location.lon > 180)) {
      errors.push('Longitude must be between -180 and 180');
    }

    return { valid: errors.length === 0, errors };
  }
}
