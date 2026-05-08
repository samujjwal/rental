/**
 * Search Components
 * 
 * Exports all search-related components for easy importing.
 */

export { QueryBuilderComponent } from './query-builder.component';
export { GeoEngineComponent } from './geo-engine.component';
export { FilterProcessorComponent } from './filter-processor.component';
export { CacheManagerComponent } from './cache-manager.component';
export { ResultAggregatorComponent } from './result-aggregator.component';

export type { ProcessedFilters } from './filter-processor.component';
export type { GeoSearchParams, BoundingBox, GeoFilterResult } from './geo-engine.component';
export type { CacheOptions } from './cache-manager.component';
export type { AggregationOptions, AggregatedResult } from './result-aggregator.component';
